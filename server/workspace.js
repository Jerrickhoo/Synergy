import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  randomBytes,
  randomUUID,
  randomInt,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { createInitialState, createModel } from "../src/data/model.js";
import { profileCompleteness, roomProgress } from "../src/data/selectors.js";
import { validateCredentials, cleanValues } from "../src/state/validation.js";
import { transition } from "../src/state/transitions.js";
import { encode, decode } from "../src/state/serialization.js";
import { emailConfiguration } from "./email-config.js";
import { createFeatures } from "./features.js";
import { trustSummary } from "../src/data/collaboration.js";
import { defaultMatching } from "../src/data/matching.js";

export class WorkspaceError extends Error {
  constructor(message, status = 400, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
const fail = (message, status, fields) => {
  throw new WorkspaceError(message, status, fields);
};
const clone = (value) => decode(encode(value));
const roles = ["founder", "mentor"];
const identity = (account, role) => `${account.id}:${role}`;
const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const tags = (text) =>
  String(text || "")
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
const tokens = (text) =>
  new Set(
    String(text || "")
      .toLowerCase()
      .replace(/marketing|promotion|audience/g, "growth")
      .replace(/testers|testing|test/g, "beta")
      .replace(/development|developer|coding/g, "technical")
      .match(/[a-z]{3,}/g)
      ?.filter(
        (word) =>
          ![
            "the",
            "and",
            "with",
            "for",
            "our",
            "help",
            "need",
            "looking",
            "startup",
            "startups",
          ].includes(word),
      ) || [],
  );
const overlap = (left, right) => {
  const a = tokens(left),
    b = tokens(right);
  if (!a.size || !b.size) return 0;
  return (
    [...a].filter((token) => b.has(token)).length / Math.min(a.size, b.size)
  );
};

export function scoreProfile(mine, theirs, mentor, config = defaultMatching) {
  mine = {
    ...mine,
    offer: `${mine.offer || ""} ${mine.offerTags || ""}`,
    need: `${mine.need || ""} ${mine.needTags || ""}`,
  };
  theirs = {
    ...theirs,
    offer: `${theirs.offer || ""} ${theirs.offerTags || ""}`,
    need: `${theirs.need || ""} ${theirs.needTags || ""}`,
  };
  const need = Math.max(
    overlap(mine.need, theirs.offer),
    overlap(theirs.need, mine.offer),
  );
  const expertise = Math.max(
    overlap(mine.need, theirs.expertise || theirs.offer),
    overlap(theirs.need, mine.expertise || mine.offer),
  );
  const industry = overlap(
    mine.industry || mine.startups,
    theirs.industry || theirs.startups,
  );
  const stageFit =
    mine.stage && theirs.stage ? (mine.stage === theirs.stage ? 1 : 0.4) : 0.5;
  const marketing = /marketing|audience|promotion|growth/i.test(
    `${mine.offer} ${mine.need} ${theirs.offer} ${theirs.need}`,
  );
  const sizes = marketing
    ? [Number(mine.audienceSize), Number(theirs.audienceSize)]
    : [Number(mine.teamSize), Number(theirs.teamSize)];
  const sizeFit = sizes.every((n) => n > 0)
    ? Math.min(...sizes) / Math.max(...sizes)
    : null;
  const stage = mentor
    ? stageFit
    : sizeFit === null
      ? stageFit
      : (stageFit + sizeFit) / 2;
  const explicitGoals = Boolean(mine.goals && theirs.goals);
  const preference =
    mine.engagementPreference && theirs.engagementPreference
      ? mine.engagementPreference === "either" ||
        theirs.engagementPreference === "either" ||
        mine.engagementPreference === theirs.engagementPreference
        ? 1
        : 0
      : null;
  const goalWords = explicitGoals
    ? overlap(mine.goals, theirs.goals)
    : overlap(`${mine.need} ${mine.bio}`, `${theirs.offer} ${theirs.bio}`);
  const goal = preference === null ? goalWords : (goalWords + preference) / 2;
  const factors = [need, expertise, industry, stage, goal];
  const weights = config[mentor ? "mentor" : "founder"];
  const score = Math.round(
    100 *
      factors.reduce((sum, value, index) => sum + value * weights[index], 0),
  );
  return {
    score,
    matchingVersion: config.version,
    factorWeights: weights,
    why: factors.map((value) =>
      value >= 0.65
        ? "Strong"
        : value >= 0.3
          ? "Good"
          : value > 0
            ? "Limited"
            : "No overlap",
    ),
    factorScores: factors.map((value) => Math.round(value * 100)),
    factorDetails: [
      `Need/offer word overlap: ${Math.round(need * 100)}%.`,
      `Expertise word overlap: ${Math.round(expertise * 100)}%.`,
      `Industry context word overlap: ${Math.round(industry * 100)}%.`,
      mentor
        ? "Stage context only; mentor capacity is not scored."
        : sizeFit === null
          ? "Stage comparison only; both size values are needed for size fit."
          : `Stage and ${marketing ? "audience" : "team"} size; size ratio ${Math.round(sizeFit * 100)}%.`,
      `${explicitGoals ? "Stated goal" : "Profile-context"} word overlap${preference === null ? "; engagement preference not provided by both" : "; engagement preferences included"}.`,
    ],
  };
}

export function createWorkspace(file, options = {}) {
  let db = existsSync(file)
    ? decode(readFileSync(file, "utf8"))
    : { version: 1, revision: 0, accounts: {}, reports: [] };
  if (db.version !== 1 || !db.accounts)
    throw new Error(
      "Unsupported workspace database. Existing data was not changed.",
    );
  const sessions = new Map();
  db.files ||= {};
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  let committed = clone(db);
  const save = () => {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      db.revision += 1;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(temporary, encode(db), { mode: 0o600 });
      // Windows indexers and file watchers can briefly hold the destination.
      for (let attempt = 0; ; attempt++) {
        try {
          renameSync(temporary, file);
          break;
        } catch (error) {
          if (
            !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
            attempt >= 10
          )
            throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
      }
      committed = clone(db);
    } catch (error) {
      db = clone(committed);
      try {
        unlinkSync(temporary);
      } catch {
        /* Preserve the original save error. */
      }
      throw error;
    }
  };
  const event = (account, role, text, roomId) =>
    account.state.activity.unshift({
      id: randomUUID(),
      role,
      text,
      roomId,
      timestamp: new Date().toISOString(),
      sample: false,
    });
  function person(account, role, viewer) {
    const profile = account.state.profiles[role];
    const mine = viewer.profiles[viewer.role];
    const marketing = [
      [mine.offer, profile.need],
      [profile.offer, mine.need],
    ].some(
      ([offer, need]) =>
        /marketing|audience|promotion|growth/i.test(offer) &&
        /marketing|audience|promotion|growth/i.test(need),
    );
    return {
      id: identity(account, role),
      accountId: account.id,
      role,
      name: account.state.accountName,
      kind: role === "mentor" ? "Mentor" : "Startup",
      initials: initials(account.state.accountName),
      color: role === "mentor" ? "blue" : "",
      sector: profile.industry || profile.expertise,
      summary: profile.bio,
      offer: [...new Set([...tags(profile.offer), ...tags(profile.offerTags)])],
      need: [...new Set([...tags(profile.need), ...tags(profile.needTags)])],
      goals: profile.goals || "",
      engagementPreference: profile.engagementPreference || "",
      teamSize: profile.teamSize || "",
      audienceSize: profile.audienceSize || "",
      stage: profile.stage || "",
      availability: profile.availability || "",
      pastExperience: role === "mentor" ? profile.pastExperience || "" : "",
      engagement:
        role === "mentor" || viewer.role === "mentor"
          ? "Mentorship"
          : marketing
            ? "Co-Marketing Swap"
            : "Beta Testing Exchange",
      emailVerified: Boolean(account.emailVerifiedAt),
      affiliation:
        account.affiliation?.status === "verified"
          ? {
              organization: account.affiliation.organization,
              status: "verified",
            }
          : null,
      trust: trustSummary(account.state.rooms, role),
      ...scoreProfile(
        viewer.profiles[viewer.role],
        profile,
        role === "mentor" || viewer.role === "mentor",
        db.matchingConfig || defaultMatching,
      ),
    };
  }
  function prepare(account, role = account.state.role) {
    const state = clone(account.state);
    state.role = roles.includes(role) ? role : state.role;
    state.authenticated = true;
    state.accountId = account.id;
    state.emailVerified = Boolean(account.emailVerifiedAt);
    state.integrations = {
      email: emailConfiguration(options).enabled,
      ai: Boolean(options.openaiKey),
      requireVerification: Boolean(options.requireVerification),
      maxFileBytes: options.maxFileBytes || 5 * 1024 * 1024,
      moderation: Boolean(options.adminEmails?.length),
    };
    state.directory = createInitialState().directory;
    for (const other of Object.values(db.accounts)) {
      if (other.id === account.id || other.suspended) continue;
      if (options.requireVerification && !other.emailVerifiedAt) continue;
      for (const otherRole of roles) {
        if (
          profileCompleteness(other.state.profiles[otherRole], otherRole) < 100
        )
          continue;
        const item = person(other, otherRole, state);
        state.directory[otherRole === "mentor" ? "mentors" : "founders"].push(
          item,
        );
        if (otherRole === "founder") state.directory.mentorStartups.push(item);
      }
    }
    // Existing collaborators remain identifiable if their public profile changes.
    for (const room of Object.values(state.rooms)) {
      const other = db.accounts[room.partnerAccountId];
      if (
        other &&
        !createModel(state)
          .allPeople()
          .some((p) => p.id === room.partnerId)
      )
        state.directory.roomPartners.push(
          person(other, room.partnerRole, state),
        );
    }
    state.trustHistoryByRole = { founder: [], mentor: [] };
    for (const room of Object.values(state.rooms)) {
      if (room.status !== "reviewed") continue;
      const partner = db.accounts[room.partnerAccountId];
      state.trustHistoryByRole[room.role].push({
        id: room.id,
        partner: partner?.state.accountName || "Collaborator",
        type: room.engagementType,
        rating: room.review.partnerRating,
        note: room.review.partnerNote,
        status: "Completed",
        date: room.completedAt?.slice(0, 10) || "",
        sample: false,
      });
    }
    return features.decorate(account, state);
  }
  function response(account, role) {
    const state = prepare(account, role);
    for (const room of Object.values(state.rooms)) {
      if (!room.review.me || !room.review.partner) {
        delete room.review.partnerRating;
        delete room.review.partnerNote;
        delete room.review.partnerUseful;
        delete room.review.partnerGoalOutcome;
      }
    }
    return { state, revision: db.revision };
  }
  function authenticate(token) {
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
      sessions.delete(token);
      fail("Please sign in to continue.", 401);
    }
    const account = db.accounts[session.id];
    if (!account || account.suspended)
      fail(
        "This account is unavailable. Contact the workspace moderator.",
        403,
      );
    return account;
  }
  function openSession(account) {
    if (account.suspended)
      fail(
        "This account is unavailable. Contact the workspace moderator.",
        403,
      );
    const token = randomBytes(32).toString("hex");
    sessions.set(token, {
      id: account.id,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return { ...response(account), token };
  }
  function reserveCode(account, field, extra = {}) {
    const lastSent = Math.max(
      account.verification?.sentAt || 0,
      account.loginVerification?.sentAt || 0,
      account.passwordReset?.sentAt || 0,
    );
    if (lastSent > Date.now() - 60000)
      fail("Wait one minute before requesting another code.", 429);
    const day = new Date().toISOString().slice(0, 10);
    if (db.mailUsage?.day !== day) db.mailUsage = { day, count: 0 };
    if (db.mailUsage.count >= 100)
      fail(
        "Today's email request limit has been reached. Please try again tomorrow.",
        429,
      );
    db.mailUsage.count += 1;
    const code = String(randomInt(100000, 1000000));
    const salt = randomBytes(16).toString("hex");
    account[field] = {
      ...extra,
      hash: hash(salt + code),
      salt,
      expires: extra.challengeExpires || Date.now() + 15 * 60000,
      sentAt: Date.now(),
      attempts: 0,
      delivered: false,
    };
    save();
    return { email: account.email, code };
  }
  function loginAccount(challengeId) {
    if (typeof challengeId !== "string" || !/^[a-f0-9]{64}$/.test(challengeId))
      fail("This sign-in request is unavailable. Start signing in again.", 401);
    const challengeHash = hash(challengeId);
    const account = Object.values(db.accounts).find(
      (item) => item.loginVerification?.challengeHash === challengeHash,
    );
    if (
      !account ||
      account.loginVerification.expires < Date.now() ||
      account.loginVerification.attempts >= 5
    )
      fail(
        "This sign-in request expired or has too many attempts. Start signing in again.",
        401,
      );
    return account;
  }
  function loginProof(account, challengeId, extra) {
    const proof = reserveCode(account, "loginVerification", extra);
    return {
      ...proof,
      verificationRequired: true,
      challengeId,
      purpose: extra.purpose,
      expiresAt: account.loginVerification.expires,
      resendAt: account.loginVerification.sentAt + 60000,
    };
  }
  function login(values, signup = false) {
    values = {
      ...cleanValues(values),
      password: String(values.password || ""),
    };
    const errors = validateCredentials(values, signup);
    if (Object.keys(errors).length)
      fail("Check your account details.", 400, errors);
    const email = values.email.toLowerCase();
    let account = Object.values(db.accounts).find(
      (item) => item.email === email,
    );
    if (signup) {
      if (account)
        fail("An account with this email already exists.", 409, {
          email: "This email is already registered. Sign in instead.",
        });
      const salt = randomBytes(16).toString("hex");
      account = {
        id: randomUUID(),
        email,
        salt,
        passwordHash: scryptSync(values.password, salt, 64).toString("hex"),
        state: createInitialState(),
      };
      transition(account.state, { form: "signup-form", values });
      db.accounts[account.id] = account;
      save();
    } else {
      const candidate = scryptSync(
        values.password,
        account?.salt || "unknown-account",
        64,
      );
      if (
        !account ||
        !timingSafeEqual(candidate, Buffer.from(account.passwordHash, "hex"))
      )
        fail("Email or password is incorrect.", 401, {
          password: "Email or password is incorrect.",
        });
    }
    if (account.suspended)
      fail(
        "This account is unavailable. Contact the workspace moderator.",
        403,
      );
    if (options.requireLoginCode) {
      const challengeId = randomBytes(32).toString("hex");
      return loginProof(account, challengeId, {
        challengeHash: hash(challengeId),
        challengeExpires: Date.now() + 15 * 60000,
        purpose: signup ? "signup" : "login",
      });
    }
    return openSession(account);
  }
  const allowedActions = new Set([
    "choose-role",
    "save",
    "interest",
    "cancel-interest",
    "accept-interest",
    "decline-interest",
    "lock-terms",
    "accept-terms",
    "confirm-milestone",
    "dispute",
    "resolve-dispute",
    "launch-room",
    "report",
  ]);
  const allowedForms = new Set([
    "profile-form",
    "terms-form",
    "evidence",
    "schedule",
    "chat-form",
    "review-form",
    "report-form",
  ]);
  const roomActions = new Set([
    "lock-terms",
    "accept-terms",
    "confirm-milestone",
    "dispute",
    "resolve-dispute",
    "launch-room",
  ]);
  const roomForms = new Set([
    "terms-form",
    "evidence",
    "schedule",
    "chat-form",
    "review-form",
  ]);
  const features = createFeatures({
    getDb: () => db,
    save,
    authenticate,
    prepare,
    response,
    mirror,
    event,
    options,
    fail,
    hash,
    reserveCode,
    sessions,
  });

  function mirror(account, state, room, text) {
    const partner = db.accounts[room.partnerAccountId];
    const previous = partner?.state.rooms[room.id];
    if (!partner || !previous || previous.partnerAccountId !== account.id)
      fail("This collaboration is unavailable.", 404);
    const shared = clone(room);
    shared.role = room.partnerRole;
    shared.partnerRole = room.role;
    shared.partnerId = identity(account, room.role);
    shared.partnerAccountId = account.id;
    shared.terms.confirmedByMe =
      room.terms.locked &&
      (room.terms.partnerLocked || !room.terms.confirmedByMe);
    for (const item of Object.values(shared.milestones)) {
      [item.me, item.partner] = [item.partner, item.me];
      [item.resolvedByMe, item.resolvedByPartner] = [
        item.resolvedByPartner,
        item.resolvedByMe,
      ];
      item.evidenceOpen = false;
    }
    shared.messages = shared.messages.map((message) => ({
      ...message,
      who: message.who === "me" ? "partner" : "me",
    }));
    shared.review = {
      me: room.review.partner,
      partner: room.review.me,
      rating: room.review.partnerRating,
      note: room.review.partnerNote,
      partnerRating: room.review.rating,
      partnerNote: room.review.note,
      useful: room.review.partnerUseful,
      goalOutcome: room.review.partnerGoalOutcome,
      partnerUseful: room.review.useful,
      partnerGoalOutcome: room.review.goalOutcome,
    };
    partner.state.rooms[room.id] = shared;
    if (text) event(partner, shared.role, text, room.id);
    state.rooms[room.id] = room;
  }
  function connect(account, state, person) {
    const other = db.accounts[person.accountId];
    const ownId = identity(account, state.role);
    if (createModel(state).existingRoomFor(state.role, person.id))
      fail("You already have a room with this collaborator.");
    const id = randomUUID();
    const room = createModel(state).createRoom({
      id,
      role: state.role,
      partnerId: person.id,
      type: createModel(state).roomTypeForPerson(person),
    });
    room.createdAt = room.updatedAt = new Date().toISOString();
    room.partnerAccountId = other.id;
    room.partnerRole = person.role;
    const config = clone(db.matchingConfig || defaultMatching);
    const mine = scoreProfile(
      state.profiles[state.role],
      other.state.profiles[person.role],
      state.role === "mentor" || person.role === "mentor",
      config,
    );
    const theirs = scoreProfile(
      other.state.profiles[person.role],
      state.profiles[state.role],
      state.role === "mentor" || person.role === "mentor",
      config,
    );
    room.matchingSnapshot = {
      version: config.version,
      weights: config,
      capturedAt: room.createdAt,
      scores: [
        {
          accountId: account.id,
          role: state.role,
          score: mine.score,
          factors: mine.factorScores,
        },
        {
          accountId: other.id,
          role: person.role,
          score: theirs.score,
          factors: theirs.factorScores,
        },
      ],
    };
    room.terms.confirmedByMe = false;
    state.rooms[id] = room;
    other.state.rooms[id] = {
      ...clone(room),
      role: person.role,
      partnerRole: state.role,
      partnerId: ownId,
      partnerAccountId: account.id,
    };
    for (const [current, currentRole, target] of [
      [state, state.role, person.id],
      [other.state, person.role, ownId],
    ]) {
      current.waitingByRole[currentRole].delete(target);
      current.interestByRole[currentRole].delete(target);
      current.incomingByRole[currentRole].delete(target);
    }
    state.activeRoomId = id;
    state.page = "room-detail";
    state.roomTab = "terms";
    state.confirmation = "You're connected. Your shared room is ready.";
    event({ state }, state.role, `You connected with ${person.name}.`, id);
    event(
      other,
      person.role,
      `${state.accountName} accepted your introduction. Your room is ready.`,
      id,
    );
  }
  function requireVerified(account) {
    if (options.requireVerification && !account.emailVerifiedAt)
      fail(
        "Verify your email in your profile before connecting, uploading files or using AI.",
        403,
      );
  }
  function act(token, input, uploadedFile) {
    if (features.handles(input)) return features.act(token, input);
    const account = authenticate(token);
    if (["interest", "accept-interest"].includes(input.action))
      requireVerified(account);
    if (Boolean(input.action) === Boolean(input.form))
      fail("Submit one action or form at a time.");
    if (!roles.includes(input.role)) fail("Choose a valid role.");
    if (
      input.form
        ? !allowedForms.has(input.form)
        : !allowedActions.has(input.action)
    )
      fail("This action is unavailable.", 400);
    // Mutations run synchronously against the latest saved data, never a client snapshot.
    const state = prepare(account, input.role);
    state.toast = "";
    state.toastType = "success";
    state.toastTitle = "";
    state.confirmation = "";
    state.formErrors = null;
    state.activeRoomId =
      typeof input.activeRoomId === "string" ? input.activeRoomId : null;
    const payload = {
      action: input.action,
      form: input.form,
      id: input.id,
      roleChoice: input.roleChoice,
      values: cleanValues(input.values || {}),
      timestamp: new Date().toISOString(),
      roomId: randomUUID(),
      timeZone: input.timeZone || "UTC",
      time: new Date().toLocaleTimeString("en", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      }),
    };
    const roomOperation =
      roomActions.has(input.action) || roomForms.has(input.form);
    const room = roomOperation ? createModel(state).activeRoom() : null;
    const previousRoom = room ? encode(room) : null;
    if (roomOperation && !room)
      fail("This room is unavailable for your account and role.", 404);
    if (room && input.form === "schedule" && room.type !== "mentorship")
      fail("Scheduling is available only in mentorship rooms.");
    if (
      room &&
      ["confirm-milestone", "dispute", "resolve-dispute"].includes(
        input.action,
      ) &&
      !Object.hasOwn(room.milestones, input.id)
    )
      fail("This milestone is unavailable.", 404);
    if (
      room &&
      input.form === "evidence" &&
      !Object.hasOwn(room.milestones, input.id)
    )
      fail("This milestone is unavailable.", 404);
    if (room && input.action === "lock-terms" && room.terms.locked)
      fail(
        "These terms are already locked. Use Accept shared terms to confirm them.",
      );
    if (
      room &&
      (input.action === "accept-terms" ||
        input.action === "lock-terms" ||
        input.form === "terms-form") &&
      input.termsRevision !== undefined &&
      input.termsRevision !== (room.terms.revision || 0)
    )
      fail(
        "The terms changed. Review the latest agreement before continuing.",
        409,
      );
    if (
      room &&
      ["launched", "reviewed", "cancelled"].includes(room.status) &&
      !["chat-form", "review-form"].includes(input.form)
    )
      fail("Completed collaborations cannot be changed.");
    if (room && input.form === "review-form" && room.review.me)
      fail("Your review has already been submitted.");
    if (
      room &&
      input.action === "confirm-milestone" &&
      room.milestones[input.id].proposal
    )
      fail(
        "Resolve the proposed milestone revision before confirming this work.",
      );
    if (room && input.form === "review-form") {
      if (
        payload.values.useful &&
        !["yes", "no"].includes(payload.values.useful)
      )
        fail("Choose a valid match usefulness response.");
      if (
        payload.values.goalOutcome &&
        !["achieved", "partial", "not-achieved"].includes(
          payload.values.goalOutcome,
        )
      )
        fail("Choose a valid goal outcome.");
    }
    let partnerText;
    if (
      [
        "interest",
        "accept-interest",
        "decline-interest",
        "cancel-interest",
        "save",
      ].includes(input.action)
    ) {
      const person = createModel(state)
        .rolePeople()
        .find((item) => item.id === input.id);
      if (!person) fail("This profile is unavailable.", 404);
      if (
        ["interest", "accept-interest"].includes(input.action) &&
        profileCompleteness(state.profiles[state.role], state.role) !== 100
      )
        fail(
          "Complete your profile before sending or accepting an introduction.",
        );
      const other = db.accounts[person.accountId];
      const ownId = identity(account, state.role);
      if (
        input.action === "accept-interest" &&
        !state.incomingByRole[state.role].has(person.id)
      )
        fail("This introduction is no longer pending.");
      if (input.action === "interest" || input.action === "accept-interest") {
        if (state.incomingByRole[state.role].has(person.id))
          connect(account, state, person);
        else if (!createModel(state).existingRoomFor(state.role, person.id)) {
          state.waitingByRole[state.role].add(person.id);
          state.interestByRole[state.role].add(person.id);
          other.state.incomingByRole[person.role].add(ownId);
          state.page = "waiting";
          state.activeWaitingMatch = person.id;
          state.toast = `Introduction sent to ${person.name}.`;
          event(
            { state },
            state.role,
            `You sent an introduction to ${person.name}.`,
          );
          event(
            other,
            person.role,
            `${state.accountName} wants to connect with you.`,
          );
        } else fail("You already have a room with this collaborator.");
      } else if (input.action === "cancel-interest") {
        state.waitingByRole[state.role].delete(person.id);
        state.interestByRole[state.role].delete(person.id);
        other.state.incomingByRole[person.role].delete(ownId);
        state.toast = "Introduction withdrawn.";
      } else if (input.action === "decline-interest") {
        state.incomingByRole[state.role].delete(person.id);
        other.state.waitingByRole[person.role].delete(ownId);
        other.state.interestByRole[person.role].delete(ownId);
        state.toast = "Introduction declined.";
        event(
          other,
          person.role,
          `${state.accountName} declined your introduction.`,
        );
      } else transition(state, payload);
    } else if (input.action === "accept-terms") {
      if (!room.terms.locked || room.terms.confirmedByMe)
        fail("There are no terms waiting for your confirmation.");
      room.terms.confirmedByMe = true;
      room.terms.partnerLocked = true;
      room.status = "in-progress";
      state.toast = "Terms confirmed by both collaborators.";
      partnerText = `${state.accountName} accepted the shared terms.`;
    } else if (input.action === "resolve-dispute") {
      const item = room.milestones[input.id];
      if (!item?.disputed) fail("This milestone has no open dispute.");
      item.resolvedByMe = true;
      if (item.resolvedByPartner) {
        item.disputed = false;
        item.me = false;
        item.partner = false;
      }
      state.toast = item.disputed
        ? "Resolution recorded. Your collaborator must also agree."
        : "Dispute resolved. Confirm the milestone again together.";
      partnerText = `${state.accountName} agreed to resolve a milestone dispute.`;
    } else if (input.form === "report-form") {
      if (!payload.values.reason) fail("Describe what happened.");
      const reportRoom = state.rooms[input.activeRoomId];
      if (!reportRoom || reportRoom.role !== state.role)
        fail("This room is unavailable.", 404);
      db.reports.push({
        id: randomUUID(),
        accountId: account.id,
        roomId: reportRoom.id,
        reason: payload.values.reason,
        timestamp: payload.timestamp,
        status: "open",
      });
      state.toast = "Report saved for local review.";
      state.reportOpen = false;
    } else {
      if (input.form === "profile-form") {
        for (const key of ["offerTags", "needTags"]) {
          const selected = tags(payload.values[key]);
          if (selected.some((tag) => !features.vocabulary().includes(tag)))
            fail("Choose approved tags or propose a new tag for review.");
        }
      }
      transition(state, payload);
      if (room && !state.formErrors) {
        if (input.form === "review-form" && room.review.me)
          Object.assign(room.review, {
            useful: payload.values.useful || "",
            goalOutcome: payload.values.goalOutcome || "",
          });
        if (input.action === "lock-terms" && room.terms.locked)
          room.terms.confirmedByMe = true;
        if (input.action === "dispute" && room.milestones[input.id])
          Object.assign(room.milestones[input.id], {
            me: false,
            partner: false,
            resolvedByMe: false,
            resolvedByPartner: false,
          });
        if (input.form === "evidence" && room.milestones[input.id])
          Object.assign(room.milestones[input.id], {
            me: false,
            partner: false,
            file: uploadedFile || null,
          });
        if (input.form === "schedule")
          Object.assign(room.milestones.session, { me: false, partner: false });
        if (input.form === "review-form" && room.status === "reviewed")
          room.completedAt = payload.timestamp;
        if (input.action === "launch-room" && room.status === "launched")
          room.launchedAt = payload.timestamp;
        room.progress = roomProgress(room);
        partnerText = `${state.accountName} ${input.form === "chat-form" ? "sent a message" : input.form === "review-form" ? "submitted a private review" : "updated your collaboration"}.`;
      }
    }
    if (room && !state.formErrors && encode(room) !== previousRoom) {
      room.updatedAt = new Date().toISOString();
      mirror(account, state, room, partnerText);
    }
    // Persist only this account's workspace. Directory and trust history are computed.
    state.directory = createInitialState().directory;
    account.state = state;
    if (uploadedFile && !state.formErrors)
      db.files[uploadedFile.id] = {
        ...uploadedFile,
        accountId: account.id,
        roomId: room.id,
      };
    save();
    return response(account);
  }
  return {
    features,
    login,
    act,
    get: (token, role) => response(authenticate(token), role),
    logout: (token) => sessions.delete(token),
    resendLogin(challengeId) {
      const account = loginAccount(challengeId);
      const { challengeHash, challengeExpires, purpose } =
        account.loginVerification;
      return loginProof(account, challengeId, {
        challengeHash,
        challengeExpires,
        purpose,
      });
    },
    loginCodeSent(challengeId, code) {
      const account = loginAccount(challengeId);
      const proof = account.loginVerification;
      if (proof.hash === hash(proof.salt + code)) {
        proof.delivered = true;
        save();
      }
    },
    verifyLogin(challengeId, code) {
      const account = loginAccount(challengeId);
      const proof = account.loginVerification;
      if (!proof.delivered)
        fail(
          "The email could not be sent. Request a new code before continuing.",
        );
      proof.attempts += 1;
      const valid =
        /^\d{6}$/.test(String(code)) &&
        timingSafeEqual(
          Buffer.from(proof.hash, "hex"),
          Buffer.from(hash(proof.salt + code), "hex"),
        );
      if (!valid) {
        save();
        fail("That verification code is incorrect.", 400, {
          code: "Enter the code from your latest email.",
        });
      }
      account.emailVerifiedAt ||= new Date().toISOString();
      delete account.loginVerification;
      delete account.verification;
      save();
      return openSession(account);
    },
    beginVerification(token) {
      const account = authenticate(token);
      if (account.emailVerifiedAt) fail("Your email is already verified.");
      return reserveCode(account, "verification");
    },
    verificationSent(token, code) {
      const account = authenticate(token);
      if (
        account.verification?.hash === hash(account.verification.salt + code)
      ) {
        account.verification.delivered = true;
        save();
      }
    },
    verifyEmail(token, code, role) {
      const account = authenticate(token);
      const proof = account.verification;
      if (
        !proof?.delivered ||
        proof.expires < Date.now() ||
        proof.attempts >= 5
      )
        fail(
          "Request a new verification code. The previous code is unavailable or expired.",
        );
      proof.attempts += 1;
      const valid =
        /^\d{6}$/.test(String(code)) &&
        timingSafeEqual(
          Buffer.from(proof.hash, "hex"),
          Buffer.from(hash(proof.salt + code), "hex"),
        );
      if (!valid) {
        save();
        fail("That verification code is incorrect.");
      }
      account.emailVerifiedAt = new Date().toISOString();
      delete account.verification;
      save();
      return response(account, role);
    },
    reserveAI(token, role, story) {
      const account = authenticate(token);
      requireVerified(account);
      if (
        !roles.includes(role) ||
        typeof story !== "string" ||
        story.trim().length < 20 ||
        story.length > 4000
      )
        fail(
          "Describe your work in 20–4,000 characters and choose a valid role.",
        );
      const day = new Date().toISOString().slice(0, 10);
      if (account.aiUsage?.day !== day) account.aiUsage = { day, count: 0 };
      db.aiUsage ||= { day, count: 0 };
      if (db.aiUsage.day !== day) db.aiUsage = { day, count: 0 };
      if (account.aiUsage.count >= 5 || db.aiUsage.count >= 100)
        fail(
          "Today's AI request limit has been reached. Please try again tomorrow.",
          429,
        );
      account.aiUsage.count += 1;
      db.aiUsage.count += 1;
      save();
    },
    authorizeUpload(token, input, size = 0) {
      const account = authenticate(token);
      requireVerified(account);
      const room = account.state.rooms[input.activeRoomId];
      if (
        !room ||
        room.role !== input.role ||
        !Object.hasOwn(room.milestones, input.id)
      )
        fail("This milestone is unavailable for your account and role.", 404);
      if (
        !room.milestones[input.id].evidence ||
        ["launched", "reviewed", "cancelled"].includes(room.status)
      )
        fail("Files cannot be added to this milestone.");
      const used = Object.values(db.files)
        .filter((item) => item.accountId === account.id)
        .reduce((sum, item) => sum + item.size, 0);
      if (used + size > (options.accountFileBytes || 50 * 1024 * 1024))
        fail("Your workspace file allowance of 50 MB has been reached.", 413);
    },
    attachFile(token, input, metadata) {
      this.authorizeUpload(token, input, metadata.size);
      return act(
        token,
        { ...input, form: "evidence", values: { attachment: metadata.name } },
        metadata,
      );
    },
    fileFor(token, id) {
      const account = authenticate(token);
      const file = db.files[id];
      if (
        !file ||
        (!account.state.rooms[file.roomId] &&
          !(
            features.isAdmin(account) &&
            db.reports.some((report) => report.roomId === file.roomId)
          ))
      )
        fail("File unavailable.", 404);
      return file;
    },
  };
}
