import { promisify, isDeepStrictEqual } from "node:util";
import { accountControls } from "./accounts.js";
import { createStorage } from "./storage.js";
import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { createInitialState, createModel } from "../src/data/model.js";
import { profileCompleteness, roomProgress } from "../src/data/selectors.js";
import { validateCredentials, cleanValues } from "../src/state/validation.js";
import { transition } from "../src/state/transitions.js";
import { encode, decode } from "../src/state/serialization.js";
import { createFeatures } from "./features.js";
import { trustSummary } from "../src/data/collaboration.js";
import { defaultMatching } from "../src/data/matching.js";
import { normalizeProfile } from "../src/data/profile-content.js";
import {
  demoProfiles,
  legacyDemoProfiles,
  demoDirectoryVersion,
} from "./demo-directory.js";

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
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\b(marketing|promotion|audience)\b/gu, "growth")
      .replace(/\b(testers|testing|test)\b/gu, "beta")
      .replace(
        /\b(development|developer|developers|coding|programming)\b/gu,
        "technical",
      )
      .match(/[\p{L}\p{N}]{2,}/gu)
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
  return a.size && b.size
    ? [...a].filter((word) => b.has(word)).length / a.size
    : 0;
};
export function scoreProfile(mine, theirs, mentor, config = defaultMatching) {
  mine = normalizeProfile(mine);
  theirs = normalizeProfile(theirs);
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
  const forward = overlap(mine.need, theirs.offer),
    reverse = overlap(theirs.need, mine.offer);
  const mentorProfile = mine.expertise ? mine : theirs;
  const founder = mine.expertise ? theirs : mine;
  const need = mentor
    ? overlap(founder.need, mentorProfile.offer)
    : Math.sqrt(forward * reverse);
  const expertise = mentor
    ? overlap(founder.need, mentorProfile.expertise || mentorProfile.offer)
    : 0;
  const industry = overlap(
    mentor ? founder.industry : mine.industry,
    mentor ? mentorProfile.startups : theirs.industry,
  );
  const stageKnown = Boolean(mine.stage && theirs.stage);
  const stageFit = stageKnown ? (mine.stage === theirs.stage ? 1 : 0.4) : 0;
  const marketing = [
    [mine.offer, theirs.need],
    [theirs.offer, mine.need],
  ].some(
    ([offer, need]) =>
      /marketing|audience|promotion|growth/i.test(offer) &&
      /marketing|audience|promotion|growth/i.test(need),
  );
  const sizes = marketing
    ? [Number(mine.audienceSize), Number(theirs.audienceSize)]
    : [Number(mine.teamSize), Number(theirs.teamSize)];
  const sizeFit = sizes.every((n) => n > 0)
    ? Math.min(...sizes) / Math.max(...sizes)
    : null;
  const stage = mentor
    ? overlap(founder.stage, mentorProfile.startups)
    : sizeFit === null
      ? stageFit
      : stageKnown
        ? (stageFit + sizeFit) / 2
        : sizeFit / 2;
  const explicitGoals = Boolean(mine.goals?.trim() && theirs.goals?.trim());
  const preference =
    mine.engagementPreference && theirs.engagementPreference
      ? mine.engagementPreference === "either" ||
        theirs.engagementPreference === "either" ||
        mine.engagementPreference === theirs.engagementPreference
        ? 1
        : 0
      : null;
  const goalWords = explicitGoals
    ? (overlap(mine.goals, theirs.goals) + overlap(theirs.goals, mine.goals)) /
      2
    : 0;
  const goal = preference === null ? goalWords : (goalWords + preference) / 2;
  const factors = [need, expertise, industry, stage, goal];
  const missing = [
    mentor
      ? !founder.need?.trim() || !mentorProfile.offer?.trim()
      : !mine.need.trim() ||
        !theirs.offer.trim() ||
        !theirs.need.trim() ||
        !mine.offer.trim(),
    !mentorProfile.expertise?.trim(),
    mentor
      ? !founder.industry || !mentorProfile.startups
      : !mine.industry || !theirs.industry,
    mentor
      ? !founder.stage || !mentorProfile.startups
      : !stageKnown && sizeFit === null,
    !explicitGoals && preference === null,
  ];
  const weights = config[mentor ? "mentor" : "founder"];
  return {
    score: Math.round(
      100 * factors.reduce((sum, value, i) => sum + value * weights[i], 0),
    ),
    matchingVersion: config.version,
    matchingAlgorithm: "reciprocal-v2",
    factorWeights: weights,
    directionalFit: {
      yourNeeds: Math.round(forward * 100),
      theirNeeds: Math.round(reverse * 100),
    },
    why: factors.map((value, i) =>
      missing[i]
        ? "Missing inputs"
        : value >= 0.65
          ? "Strong"
          : value >= 0.3
            ? "Good"
            : value > 0
              ? "Limited"
              : "No overlap",
    ),
    factorScores: factors.map((value) => Math.round(value * 100)),
    factorDetails: [
      mentor
        ? `Founder needs covered by mentor offers: ${Math.round(need * 100)}%.`
        : `Your needs covered: ${Math.round(forward * 100)}%; their needs covered: ${Math.round(reverse * 100)}%. Both directions contribute.`,
      mentor
        ? `Founder needs covered by mentor expertise: ${Math.round(expertise * 100)}%.`
        : "Expertise applies to mentorship only.",
      missing[2]
        ? "Industry inputs missing; no positive fit assumed."
        : `Industry context word overlap: ${Math.round(industry * 100)}%.`,
      mentor
        ? "Founder stage compared with the mentor's stated startup interests; missing context earns no positive fit."
        : sizeFit === null
          ? "Stage comparison only; both size values are needed for size fit."
          : `Stage and ${marketing ? "audience" : "team"} size; size ratio ${Math.round(sizeFit * 100)}%.`,
      `${explicitGoals ? "Stated goal overlap" : "Stated goals missing; no goal overlap assumed"}${preference === null ? "; engagement preference not provided by both" : "; engagement preferences included"}.`,
    ],
  };
}

export function createWorkspace(file, options = {}) {
  const storage = createStorage(file);
  let db = storage.load();
  if (db.version !== 1 || !db.accounts)
    throw new Error(
      "Unsupported workspace database. Existing data was not changed.",
    );
  const sessions = new Map();
  db.files ||= {};
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  let committed = clone(db);
  const save = () => {
    try {
      const expected = db.revision;
      db.revision += 1;
      storage.commit(db, expected);
      committed = clone(db);
    } catch (error) {
      db = clone(committed);
      throw error;
    }
  };

  if (options.demoMode) {
    let samplesChanged = false;
    const snapshot = (name, profile) => ({ name, profile });
    const sampleSnapshot = (sample) =>
      snapshot(sample.name, {
        ...createInitialState().profiles[sample.role],
        ...sample.profile,
      });
    for (const sample of demoProfiles) {
      const id = `demo-sample-${sample.id}`;
      const existing = db.accounts[id];
      if (existing) {
        // Only untouched fixtures are refreshed. Shared work and account settings
        // are outside the snapshot and are never reset by a fixture upgrade.
        if (
          !existing.demoSample ||
          existing.demoFixture?.version >= demoDirectoryVersion
        )
          continue;
        const legacy = legacyDemoProfiles.find((item) => item.id === sample.id);
        const baseline =
          existing.demoFixture?.snapshot || (legacy && sampleSnapshot(legacy));
        if (
          !baseline ||
          !isDeepStrictEqual(
            snapshot(
              existing.state.accountName,
              existing.state.profiles[sample.role],
            ),
            baseline,
          )
        )
          continue;
        existing.state.accountName = sample.name;
        existing.state.profiles[sample.role] = sampleSnapshot(sample).profile;
        existing.demoFixture = {
          version: demoDirectoryVersion,
          snapshot: sampleSnapshot(sample),
        };
        samplesChanged = true;
        continue;
      }
      const state = createInitialState();
      state.role = sample.role;
      state.accountName = sample.name;
      state.accountEmail = `${sample.id}@example.invalid`;
      state.profileDone = true;
      Object.assign(state.profiles[sample.role], sample.profile);
      db.accounts[id] = {
        id,
        demo: true,
        demoSample: true,
        demoFixture: {
          version: demoDirectoryVersion,
          snapshot: sampleSnapshot(sample),
        },
        email: state.accountEmail,
        salt: randomBytes(16).toString("hex"),
        passwordHash: randomBytes(64).toString("hex"),
        state,
      };
      samplesChanged = true;
    }
    if (samplesChanged) save();
  }

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
    const profile = normalizeProfile(account.state.profiles[role]);
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
      image: profile.image || "",
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
      expertise: role === "mentor" ? profile.expertise || "" : "",
      startups: role === "mentor" ? profile.startups || "" : "",
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
      demoMode: Boolean(options.demoMode),
      guest: Boolean(account.demo),
      maxFileBytes: options.maxFileBytes || 5 * 1024 * 1024,
      moderation: Boolean(options.adminEmails?.length),
    };
    state.introductionTypesByRole ||= { founder: {}, mentor: {} };
    state.directory = createInitialState().directory;
    for (const other of Object.values(db.accounts)) {
      if (
        other.id === account.id ||
        (other.demo &&
          (!account.demo || !other.demoSample || !options.demoMode)) ||
        other.suspended ||
        other.profileVisible === false ||
        account.blockedAccounts?.includes(other.id) ||
        other.blockedAccounts?.includes(account.id)
      )
        continue;
      for (const otherRole of roles) {
        if (
          profileCompleteness(other.state.profiles[otherRole], otherRole) < 100
        )
          continue;
        const item = person(other, otherRole, state);
        item.canSimulateAcceptance = Boolean(
          options.demoMode &&
          account.demo &&
          !account.demoSample &&
          other.demo &&
          other.demoSample &&
          account.profileVisible !== false &&
          state.waitingByRole[state.role].has(item.id) &&
          state.interestByRole[state.role].has(item.id) &&
          other.state.incomingByRole[otherRole].has(
            identity(account, state.role),
          ),
        );
        const proposed = state.introductionTypesByRole[state.role]?.[item.id];
        if (proposed)
          item.engagement = {
            beta: "Beta Testing Exchange",
            marketing: "Co-Marketing Swap",
            mentorship: "Mentorship",
          }[proposed];
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
    if (features.rememberNotifications(account, state)) save();
    for (const room of Object.values(state.rooms)) {
      if (!room.review.me || !room.review.partner) {
        delete room.review.partnerRating;
        delete room.review.partnerNote;
        delete room.review.partnerUseful;
        delete room.review.partnerGoalOutcome;
      }
    }
    return {
      state,
      revision: db.revision,
      refreshKey: `${db.revision}:${state.role}:${Math.floor(Date.now() / 60000)}`,
    };
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
    for (const [key, session] of sessions)
      if (session.expires <= Date.now()) sessions.delete(key);
    sessions.set(token, {
      createdAt: Date.now(),
      id: account.id,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return { ...response(account), token };
  }
  function login(values, signup = false, derived) {
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
      const salt = derived?.salt || randomBytes(16).toString("hex");
      account = {
        id: randomUUID(),
        email,
        salt,
        passwordHash:
          derived?.hash ||
          scryptSync(values.password, salt, 64).toString("hex"),
        state: createInitialState(),
      };
      transition(account.state, { form: "signup-form", values });
      db.accounts[account.id] = account;
      save();
    } else {
      if (derived && derived.expected !== account?.passwordHash)
        fail("Account changed. Sign in again.", 401);
      const candidate =
        derived?.candidate ||
        scryptSync(values.password, account?.salt || "unknown-account", 64);
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
    return openSession(account);
  }
  async function loginAsync(values, signup = false) {
    const errors = validateCredentials(values, signup);
    if (Object.keys(errors).length)
      fail("Check your account details.", 400, errors);
    const account = Object.values(db.accounts).find(
      (item) => item.email === String(values.email).trim().toLowerCase(),
    );
    const salt = signup
      ? randomBytes(16).toString("hex")
      : account?.salt || "unknown-account";
    const bytes = await promisify(scrypt)(
      String(values.password || ""),
      salt,
      64,
    );
    return login(values, signup, {
      salt,
      hash: bytes.toString("hex"),
      candidate: bytes,
      expected: account?.passwordHash,
    });
  }
  const allowedActions = new Set([
    "choose-role",
    "save",
    "interest",
    "cancel-interest",
    "accept-interest",
    "simulate-acceptance",
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
    sessions,
  });

  function mirror(account, state, room, text) {
    const partner = db.accounts[room.partnerAccountId];
    const previous = partner?.state.rooms[room.id];
    if (!partner || !previous || previous.partnerAccountId !== account.id)
      fail("This collaboration is unavailable.", 404);
    const content = (item) =>
      encode([
        item.title,
        item.description,
        item.evidence,
        item.attachment,
        item.file,
        item.dueDate,
        item.schedule,
        item.schedules,
        Boolean(item.disputed),
        room.terms.revision || 0,
      ]);
    for (const [id, item] of Object.entries(room.milestones)) {
      const old = previous.milestones[id];
      const oldContent = encode([
        old.title,
        old.description,
        old.evidence,
        old.attachment,
        old.file,
        old.dueDate,
        old.schedule,
        old.schedules,
        Boolean(old.disputed),
        previous.terms.revision || 0,
      ]);
      item.contentVersion =
        (old.contentVersion || 0) + (content(item) !== oldContent ? 1 : 0);
      if (content(item) !== oldContent) item.me = item.partner = false;
    }
    room.progress = roomProgress(room);
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
  function connect(account, state, person, acceptedByPartner = false) {
    const other = db.accounts[person.accountId];
    const ownId = identity(account, state.role);
    if (createModel(state).existingRoomFor(state.role, person.id))
      fail("You already have a room with this collaborator.");
    const id = randomUUID();
    const room = createModel(state).createRoom({
      id,
      role: state.role,
      partnerId: person.id,
      type:
        state.introductionTypesByRole[state.role]?.[person.id] ||
        createModel(state).roomTypeForPerson(person),
    });
    room.engagementType = {
      beta: "Beta Testing Exchange",
      marketing: "Co-Marketing Swap",
      mentorship: "Mentorship",
    }[room.type];
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
      algorithm: "reciprocal-v2",
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
      if (current.introductionTypesByRole?.[currentRole])
        delete current.introductionTypesByRole[currentRole][target];
    }
    state.activeRoomId = id;
    state.page = "room-detail";
    state.roomTab = "terms";
    state.confirmation = "You're connected. Your shared room is ready.";
    event(
      { state },
      state.role,
      acceptedByPartner
        ? `${person.name} accepted your introduction. Your room is ready.`
        : `You connected with ${person.name}.`,
      id,
    );
    event(
      other,
      person.role,
      acceptedByPartner
        ? `You accepted ${state.accountName}'s introduction. Your room is ready.`
        : `${state.accountName} accepted your introduction. Your room is ready.`,
      id,
    );
  }
  function act(token, input, uploadedFile, avatar) {
    if (features.handles(input)) return features.act(token, input);
    const account = authenticate(token);
    if (
      ["interest", "accept-interest", "simulate-acceptance"].includes(
        input.action,
      )
    ) {
      if (account.profileVisible === false)
        fail(
          "Make your profile visible in Account settings before connecting.",
          403,
        );
    }
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
    if (input.form === "terms-form" || input.action === "lock-terms")
      payload.values = Object.fromEntries(
        ["goal", "scope", "timeline", "commitment", "compensation"].map(
          (key) => [key, payload.values[key] || ""],
        ),
      );
    const roomOperation =
      roomActions.has(input.action) || roomForms.has(input.form);
    const room = roomOperation ? createModel(state).activeRoom() : null;
    const previousRoom = room ? encode(room) : null;
    if (roomOperation && !room)
      fail("This room is unavailable for your account and role.", 404);
    if (
      room &&
      input.form === "chat-form" &&
      (account.blockedAccounts?.includes(room.partnerAccountId) ||
        db.accounts[room.partnerAccountId]?.blockedAccounts?.includes(
          account.id,
        ) ||
        db.accounts[room.partnerAccountId]?.deletedAt)
    )
      fail("Further contact is unavailable for this collaboration.", 403);
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
    if (
      room &&
      ["confirm-milestone", "resolve-dispute"].includes(input.action) &&
      input.milestoneVersion !==
        (room.milestones[input.id]?.contentVersion || 0)
    )
      fail(
        "This milestone changed. Review the latest scope, evidence and schedule before confirming.",
        409,
      );
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
    if (input.action === "simulate-acceptance") {
      if (!options.demoMode || !account.demo || account.demoSample)
        fail(
          "Acceptance simulation is available only to prototype preview accounts.",
          403,
        );
      const target = createModel(state)
        .rolePeople()
        .find((person) => person.id === input.id);
      const fictional = target && db.accounts[target.accountId];
      if (!fictional?.demo || !fictional.demoSample || fictional.deletedAt)
        fail(
          "Only a fictional prototype collaborator can simulate acceptance.",
          403,
        );
      const existing = createModel(state).existingRoomFor(
        state.role,
        target.id,
      );
      if (existing) {
        if (["cancelled", "reviewed", "launched"].includes(existing.status))
          fail("This introduction has already been resolved.", 409);
        state.page = "room-detail";
        state.activeRoomId = existing.id;
        state.roomTab = "terms";
      } else {
        if (
          !target.canSimulateAcceptance ||
          profileCompleteness(state.profiles[state.role], state.role) !== 100
        )
          fail(
            "This outgoing introduction is no longer eligible for simulated acceptance.",
            409,
          );
        connect(account, state, target, true);
      }
    } else if (
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
      const proposedType =
        input.engagementType || createModel(state).roomTypeForPerson(person);
      const permittedTypes =
        state.role === "mentor" || person.role === "mentor"
          ? ["mentorship"]
          : ["beta", "marketing"];
      if (
        ["interest", "accept-interest"].includes(input.action) &&
        !permittedTypes.includes(proposedType)
      )
        fail("Choose an engagement type available for these profiles.");
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
          if (state.interestByRole[state.role].has(person.id))
            fail("This introduction is already pending.", 409);
          state.introductionTypesByRole ||= { founder: {}, mentor: {} };
          other.state.introductionTypesByRole ||= { founder: {}, mentor: {} };
          state.introductionTypesByRole[state.role][person.id] = proposedType;
          other.state.introductionTypesByRole[person.role][ownId] =
            proposedType;
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
        delete state.introductionTypesByRole[state.role][person.id];
        if (other.state.introductionTypesByRole?.[person.role])
          delete other.state.introductionTypesByRole[person.role][ownId];
        state.toast = "Introduction withdrawn.";
      } else if (input.action === "decline-interest") {
        state.incomingByRole[state.role].delete(person.id);
        other.state.waitingByRole[person.role].delete(ownId);
        other.state.interestByRole[person.role].delete(ownId);
        delete state.introductionTypesByRole[state.role][person.id];
        if (other.state.introductionTypesByRole?.[person.role])
          delete other.state.introductionTypesByRole[person.role][ownId];
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
      if (
        !payload.values.reason ||
        payload.values.reason.length > 3000 ||
        (payload.values.details || "").length > 3000
      )
        fail("Choose a reason and keep report details under 3,000 characters.");
      const requestedProfile = payload.values.profileId;
      const reportRoom = requestedProfile
        ? Object.values(state.rooms).find(
            (room) =>
              room.role === state.role && room.partnerId === requestedProfile,
          )
        : state.rooms[input.activeRoomId];
      const reported =
        createModel(state)
          .rolePeople()
          .find((person) => person.id === requestedProfile) ||
        (reportRoom?.role === state.role
          ? createModel(state)
              .allPeople()
              .find((person) => person.id === reportRoom.partnerId)
          : null);
      if (!reported || reported.accountId === account.id)
        fail("This collaborator is unavailable for reporting.", 404);
      db.reports.push({
        id: randomUUID(),
        accountId: account.id,
        reporterAccountId: account.id,
        reporterProfileId: identity(account, state.role),
        reportedAccountId: reported.accountId,
        reportedProfileId: reported.id,
        roomId: reportRoom?.id || null,
        reason: payload.values.reason,
        details: payload.values.details || "",
        timestamp: payload.timestamp,
        status: "open",
      });
      state.toast =
        "Report saved for moderator review. This collaborator has not been blocked.";
      state.reportOpen = false;
    } else {
      if (input.form === "profile-form") {
        payload.values = normalizeProfile(payload.values);
        const image = payload.values.image;
        if (
          image &&
          !avatar &&
          image !== account.state.profiles[state.role].image
        )
          fail("Upload your own profile photo using Save profile.", 403);
        for (const key of ["offerTags", "needTags"]) {
          const selected = tags(payload.values[key]);
          if (selected.some((tag) => !features.vocabulary().includes(tag)))
            fail("Choose approved tags or propose a new tag for review.");
        }
      }
      transition(state, payload);
      if (input.form === "profile-form" && !state.formErrors) {
        if (avatar) {
          state.profiles[state.role].image = `/api/avatars/${avatar.id}`;
          db.files[avatar.id] = {
            ...avatar,
            purpose: "avatar",
            accountId: account.id,
            role: state.role,
          };
        } else if (payload.values.image === "")
          state.profiles[state.role].image = "";
      }
      if (room && !state.formErrors) {
        if (input.form === "review-form" && room.review.me)
          Object.assign(room.review, {
            useful: payload.values.useful || "",
            goalOutcome: payload.values.goalOutcome || "",
          });
        if (
          (input.action === "lock-terms" || input.form === "terms-form") &&
          !state.formErrors
        ) {
          room.terms.revision = (room.terms.revision || 0) + 1;
          if (input.action === "lock-terms" && room.terms.locked)
            room.terms.confirmedByMe = true;
        }
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
  const accounts = accountControls({
    getDb: () => db,
    authenticate,
    sessions,
    hash,
    save,
    response,
    mirror,
    fail,
  });
  return {
    health: () => storage.health(),
    close: () => storage.close(),
    accounts,
    features,
    login,
    loginAsync,
    openDemo(role) {
      if (!options.demoMode) fail("Demo access is disabled.", 404);
      if (!roles.includes(role)) fail("Choose a founder or mentor preview.");
      const state = createInitialState();
      const account = {
        id: randomUUID(),
        demo: true,
        email: `demo-${randomUUID()}@example.invalid`,
        salt: randomBytes(16).toString("hex"),
        passwordHash: randomBytes(64).toString("hex"),
        state,
      };
      state.role = role;
      state.accountName = role === "founder" ? "Maria Santos" : "David Park";
      state.accountEmail = account.email;
      state.profileDone = true;
      Object.assign(state.profiles.founder, {
        bio: "Building a budgeting app that helps students manage their money.",
        offer: "Beta testing, Student user insights",
        need: "Product strategy, Onboarding guidance",
        industry: "FinTech",
        stage: "pre-seed",
        teamSize: "4",
        image: "/demo/avatars/maria.svg",
      });
      Object.assign(state.profiles.mentor, {
        bio: "Helping early teams improve their products and find traction.",
        offer: "Product strategy, Growth, Onboarding guidance",
        need: "Early teams, Product challenges",
        expertise: "Product strategy, Growth",
        availability: "Monthly sessions",
        startups: "Idea and pre-seed teams",
        image: "/demo/avatars/david.svg",
      });
      db.accounts[account.id] = account;
      save();
      return openSession(account);
    },
    act,
    authorizeProfile(token, input, size = 0) {
      const account = authenticate(token);
      if (
        input.form !== "profile-form" ||
        input.action ||
        !roles.includes(input.role)
      )
        fail("Submit a valid profile.");
      if (
        !input.values ||
        typeof input.values !== "object" ||
        Array.isArray(input.values) ||
        ("image" in input.values && typeof input.values.image !== "string")
      )
        fail("Submit valid profile fields and a JPEG, PNG or WebP photo.");
      const used = Object.values(db.files)
        .filter((item) => item.accountId === account.id)
        .reduce((sum, item) => sum + item.size, 0);
      if (used + size > (options.accountFileBytes || 50 * 1024 * 1024))
        fail("Your workspace file allowance of 50 MB has been reached.", 413);
    },
    saveProfile(token, input, metadata) {
      this.authorizeProfile(token, input, metadata.size);
      return act(token, input, undefined, metadata);
    },
    avatarStored(id) {
      const photo = db.files[id];
      return Boolean(
        photo?.purpose === "avatar" &&
        db.accounts[photo.accountId]?.state.profiles[photo.role]?.image ===
          `/api/avatars/${id}`,
      );
    },
    avatarFor(token, id) {
      const viewer = authenticate(token);
      const photo = db.files[id];
      const owner = photo && db.accounts[photo.accountId];
      const image = `/api/avatars/${id}`;
      if (
        !photo ||
        photo.purpose !== "avatar" ||
        !owner ||
        owner.deletedAt ||
        owner.state.profiles[photo.role]?.image !== image
      )
        fail("Profile photo unavailable.", 404);
      const visible =
        owner.profileVisible !== false &&
        !owner.suspended &&
        !viewer.blockedAccounts?.includes(owner.id) &&
        !owner.blockedAccounts?.includes(viewer.id) &&
        (!owner.demo || (viewer.demo && owner.demoSample && options.demoMode));
      const collaborator = Object.values(viewer.state.rooms).some(
        (room) =>
          room.partnerAccountId === owner.id && room.partnerRole === photo.role,
      );
      if (viewer.id !== owner.id && !visible && !collaborator)
        fail("Profile photo unavailable.", 404);
      return photo;
    },
    get: (token, role) => response(authenticate(token), role),
    poll(token, role, since, key) {
      const account = authenticate(token);
      const currentRole = roles.includes(role) ? role : account.state.role;
      const refreshKey = `${db.revision}:${currentRole}:${Math.floor(Date.now() / 60000)}`;
      if (Number(since) === db.revision && key === refreshKey)
        return { unchanged: true, revision: db.revision, refreshKey };
      return response(account, currentRole);
    },
    logout: (token) => sessions.delete(token),
    authorizeUpload(token, input, size = 0) {
      const account = authenticate(token);
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
