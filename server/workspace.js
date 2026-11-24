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
import {
  sampleFounderName,
  sampleFounderProfile,
} from "../src/data/profile-assistant.js";
import {
  profileCompleteness,
  roomProgress,
  launchBlockers,
  scheduleInstant,
} from "../src/data/selectors.js";
import { validateCredentials, cleanValues } from "../src/state/validation.js";
import { transition } from "../src/state/transitions.js";
import { completeTermsMilestones } from "../src/data/terms.js";
import { encode, decode } from "../src/state/serialization.js";
import {
  calendarActions,
  calendarIcs,
  createOfficeHours,
  officeAllocation,
  officeAvailability,
  preferredAvailability,
} from "./office-hours.js";
import {
  applicationActions,
  createMentorOnboarding,
} from "./mentor-onboarding.js";
import { mentorVerificationLabel } from "../src/data/mentor-onboarding.js";
import {
  logMentorSetting,
  mentoringGate,
  mentorSettingEntries,
  recordMentoringWeek,
  updatedMentorConfig,
} from "./mentor-admin.js";
import {
  applyEmailWebhook,
  bearerToken,
  createBrevoSender,
  emailKindAllowed,
  equalSecret,
  nextRequestDigest,
  parseUnsubscribe,
} from "./mentor-email.js";
import {
  authEmailAllowed,
  authEmailWanted,
  linkCooldown,
  linkRecentlySent,
  liveLink,
  queueAuthEmail,
  readAuthLinkToken,
} from "./auth-email.js";
import { logEvent, logFailure } from "./operations.js";
import { createMentorSafety, safetyActions } from "./mentor-safety.js";
import { createMentorshipRooms } from "./mentorship-rooms.js";
import { createMentorPayments, paymentActions } from "./mentor-payments.js";
import {
  initMentorship,
  isMentorRoom,
  migrateMentorship,
  roomFormat,
} from "../src/data/mentor-room.js";
import { publicMentorshipTrust } from "../src/data/mentor-impact.js";
import { mentorFormat } from "../src/data/mentor-formats.js";
import { createMentorRequests, requestActions } from "./mentor-requests.js";
import { createFeatures, defaultPreferences } from "./features.js";
import defaultTemplates from "../src/data/engagement-templates.json" with { type: "json" };
import {
  trustSummary,
  canonicalTags,
  reviewDeadline,
  ongoingMentorship,
  needItems,
  ensureCycle,
  moderationDueAt,
  resolveCycleDecisions,
  terminalStatuses,
} from "../src/data/collaboration.js";
import { takesMeetings } from "../src/data/meetings.js";
import { longDate } from "../src/data/profile-presentation.js";

// The partner's notice for a meeting; the time is the scheduler's local time.
const meetingText = (meeting, lead) =>
  meeting
    ? `${lead} ${longDate(meeting.date)} at ${meeting.time} (${meeting.timeZone}).`
    : `${lead.replace(/ (for|on)$/, "")}.`;
import {
  defaultMatching,
  migrateMatchingConfig,
} from "../src/data/matching.js";
import { normalizeProfile } from "../src/data/profile-content.js";
import {
  availabilityFit,
  availabilityLine,
  backfillMentorProfile,
  capacityUsage,
  conflictWith,
  formatFit,
  guidelinesStatus,
  mentorConfig,
  mentorDefaults,
  ownUnavailableText,
  unavailableText,
} from "../src/data/mentor-rules.js";
import { normalizeOfferedFormats } from "../src/data/mentor-formats.js";
import {
  demoProfiles,
  legacyDemoProfiles,
  demoDirectoryVersion,
  previewMentorName,
  sampleMentorRequest,
  seedDemoImpact,
} from "./demo-directory.js";
import { seedShowcase } from "./showcase.js";

// Profile pictures: the startup logo (or a mentor's photo) and, for
// founders only, the founder's own photo.
export const profilePhotoFields = ["image", "personImage"];
const photoFieldsFor = (role) =>
  role === "founder" ? profilePhotoFields : ["image"];
export class WorkspaceError extends Error {
  // `data` adds machine-readable details to the response, such as the reason a
  // mentor is unavailable and similar mentors to ask instead.
  constructor(message, status = 400, fields, data) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}
const fail = (message, status, fields, data) => {
  throw new WorkspaceError(message, status, fields, data);
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
const sharedOverlap = (a, b) => (overlap(a, b) + overlap(b, a)) / 2;
// `mentorFit` carries the scored mentor's Availability Fit and Format Fit
// (0–1) from their live capacity; left out, both count as full. Pass `null`
// when the scored profile is a founder seen by a mentor: those two factors
// describe mentors only, so they are left out and the other weights rescaled.
export function scoreProfile(
  mine,
  theirs,
  mentor,
  config = defaultMatching,
  mentorFit = { availability: 1, format: 1 },
) {
  mine = normalizeProfile(mine);
  theirs = normalizeProfile(theirs);
  // Your stated needs, one item each, before tags and text are merged below.
  const myNeedItems = needItems(mine);
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
  // Needs and offers are compared both as words and as controlled tags, so
  // "people to try our product" and "beta testers" count as the same help.
  const tagged = (text) => new Set(canonicalTags(text));
  const covered = (needs, offers) => {
    const wanted = tagged(needs),
      given = tagged(offers);
    const shared = [...wanted].filter((tag) => given.has(tag));
    return { ratio: wanted.size ? shared.length / wanted.size : 0, shared };
  };
  // The need items the word overlap in Need fit matched, in your own wording.
  // An item counts only when every one of its words is in their offer, so
  // "Product strategy" never reads as covering "Pricing strategy".
  const wordsCovered = (offers) => {
    const given = tokens(offers);
    return myNeedItems.filter((item) => {
      const words = [...tokens(item)];
      return words.length > 0 && words.every((word) => given.has(word));
    });
  };
  const forwardTags = covered(mine.need, theirs.offer),
    reverseTags = covered(theirs.need, mine.offer);
  const forward = Math.max(overlap(mine.need, theirs.offer), forwardTags.ratio),
    reverse = Math.max(overlap(theirs.need, mine.offer), reverseTags.ratio);
  const mentorRank = (profile) =>
    ["expertise", "availability", "startups"].filter((key) =>
      Object.hasOwn(profile, key),
    ).length;
  const profileKey = (profile) =>
    JSON.stringify(
      Object.entries(profile).sort(([a], [b]) => a.localeCompare(b)),
    );
  const mineIsMentor =
    mentorRank(mine) === mentorRank(theirs)
      ? profileKey(mine) >= profileKey(theirs)
      : mentorRank(mine) > mentorRank(theirs);
  const mentorProfile = mineIsMentor ? mine : theirs;
  const founder = mineIsMentor ? theirs : mine;
  const need = mentor
    ? Math.max(
        overlap(founder.need, mentorProfile.offer),
        covered(founder.need, mentorProfile.offer).ratio,
      )
    : Math.sqrt(forward * reverse);
  const expertise = mentor
    ? Math.max(
        overlap(
          founder.need,
          `${mentorProfile.expertise || ""} ${mentorProfile.topics || ""}`.trim() ||
            mentorProfile.offer,
        ),
        covered(
          founder.need,
          `${mentorProfile.expertise || ""} ${mentorProfile.topics || ""} ${mentorProfile.offer}`,
        ).ratio,
      )
    : 0;
  const industry = sharedOverlap(
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
  // A swap needs both audience sizes. Unknown size is not treated as a fit.
  const sizeFit = sizes.every((n) => n > 0)
    ? Math.min(...sizes) / Math.max(...sizes)
    : marketing
      ? 0
      : null;
  // Audience fairness is about founder swaps; mentorship has no swap.
  const audienceGap = mentor
    ? ""
    : marketing && sizes.every((n) => n > 0) && sizeFit < 0.1
      ? `Uneven swap: ${Math.max(...sizes).toLocaleString("en")} vs ${Math.min(...sizes).toLocaleString("en")} audience`
      : marketing && !sizes.every((n) => n > 0)
        ? "Audience size missing for a co-marketing swap"
        : "";
  const stage = mentor
    ? sharedOverlap(founder.stage, mentorProfile.startups)
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
  const fitApplies = mentor && mentorFit !== null;
  if (fitApplies) factors.push(mentorFit.availability, mentorFit.format);
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
    false,
    false,
  ];
  const weights = config[mentor ? "mentor" : "founder"];
  const usedWeight = weights
    .slice(0, factors.length)
    .reduce((sum, weight) => sum + weight, 0);
  const weighted = Math.round(
    (100 * factors.reduce((sum, value, i) => sum + value * weights[i], 0)) /
      (usedWeight || 1),
  );
  const mentorTags = mentor
    ? covered(
        founder.need,
        `${mentorProfile.expertise || ""} ${mentorProfile.topics || ""} ${mentorProfile.offer}`,
      ).shared
    : [];
  return {
    // A 10x audience gap makes a swap unfair (§9), so it caps the score.
    score:
      !mentor && marketing && sizes.every((n) => n > 0) && sizeFit < 0.1
        ? Math.min(weighted, 40)
        : weighted,
    audienceWarning: audienceGap,
    exchange: mentor
      ? {
          youGet: founder === mine ? mentorTags : [],
          theyGet: founder === theirs ? mentorTags : [],
          matchedNeeds:
            founder === mine ? wordsCovered(mentorProfile.offer) : [],
        }
      : {
          youGet: forwardTags.shared,
          theyGet: reverseTags.shared,
          matchedNeeds: wordsCovered(theirs.offer),
        },
    matchingVersion: config.version,
    matchingAlgorithm: "reciprocal-v3",
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
          : audienceGap
            ? `${audienceGap}. A swap more than 10 times uneven is limited to 40% overall.`
            : `Stage and ${marketing ? "audience" : "team"} size; size ratio ${Math.round(sizeFit * 100)}%.`,
      `${explicitGoals ? "Stated goal overlap" : "Stated goals missing; no goal overlap assumed"}${preference === null ? "; engagement preference not provided by both" : "; engagement preferences included"}.`,
      ...(fitApplies
        ? [
            mentorFit.availability === 1
              ? "The mentor can take a new request now."
              : mentorFit.availability > 0
                ? "The mentor has hours left but no free slot right now."
                : "The mentor is paused, out of hours or not yet taking requests.",
            mentorFit.format === 1
              ? "The mentor offers a format that's open now."
              : "None of the mentor's formats is open now.",
          ]
        : []),
    ],
  };
}

export function createWorkspace(file, options = {}) {
  const now = () => options.now?.() ?? Date.now();
  const storage = createStorage(file);
  let db = storage.load();
  if (db.version !== 1 || !db.accounts)
    throw new Error(
      "Unsupported workspace database. Existing data was not changed.",
    );
  const sessions = new Map();
  // Sign-in emails (verification, password reset, sign-in alerts) need a real
  // provider; with the stub nobody is asked to verify.
  const emailAuth = options.emailProvider === "brevo" && !options.demoMode;
  const emailUnverified = (account) =>
    emailAuth && !account.demo && !account.emailVerifiedAt;
  const mentorSettings = () =>
    db.mentorConfig ? { ...mentorConfig, ...db.mentorConfig } : mentorConfig;
  db.files ||= {};
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  let committed = clone(db);
  // Another server can share this database (for example `npm run dev` beside
  // `npm start`). Before acting, pick up whatever it committed, so this
  // server's next save starts from the current revision instead of being
  // refused as out of date.
  function refresh() {
    const onDisk = storage.revision();
    if (onDisk === null || onDisk === db.revision) return false;
    const fresh = storage.load();
    if (fresh.version !== 1 || !fresh.accounts) return false;
    fresh.files ||= {};
    db = fresh;
    committed = clone(db);
    return true;
  }
  const save = () => {
    try {
      for (const { state } of Object.values(db.accounts)) {
        delete state.mentorRequests;
        delete state.referralChoices;
        delete state.mentorRequestLimit;
        delete state.calendarToken;
        delete state.mentorApplication;
        delete state.mentorSuspension;
        delete state.mentorConfig;
        delete state.pricingConfig;
        delete state.pricingHistory;
        delete state.paymentRecords;
        delete state.paymentCheckoutData;
        delete state.paymentModeration;
        delete state.mentorshipSurvey;
        delete state.mentorEmailStatus;
        delete state.mentorListing;
        delete state.mentorVerification;
        delete state.mentorOfficeOpenings;
        for (const room of Object.values(state.rooms))
          delete room.officeHoursSuggestions;
        for (const room of Object.values(state.rooms))
          delete room.preferredHoursSuggestions;
      }
      const expected = db.revision;
      db.revision += 1;
      storage.commit(db, expected);
      committed = clone(db);
    } catch (error) {
      db = clone(committed);
      throw error;
    }
  };

  const onboarding = createMentorOnboarding({
    accounts: () => db.accounts,
    config: mentorSettings,
    now,
    fail,
    event: (...args) => event(...args),
    vocabulary: () => features.vocabulary(),
    isAdmin: (account) => features.isAdmin(account),
    audit,
    required: options.mentorApprovalRequired !== false,
  });
  function audit(account, kind, id, decision, note = "") {
    (db.moderationAudit ||= []).push({
      id: randomUUID(),
      moderator: account.email,
      kind,
      targetId: id,
      decision,
      note,
      timestamp: new Date(now()).toISOString(),
    });
  }
  let migrated = false;
  if (
    db.mentorConfig &&
    db.mentorConfig.guidelinesVersion < mentorConfig.guidelinesVersion
  ) {
    db.mentorConfig.guidelinesVersion = mentorConfig.guidelinesVersion;
    migrated = true;
  }
  // Phase 1 mentoring: the release time starts the guidelines grace period for
  // mentors who existed before it. Mentors who join later get no grace.
  db.mentorRules ||= {};
  if (onboarding.migrations(db)) migrated = true;
  if (!db.mentorRules.phase1At) {
    db.mentorRules.phase1At = new Date(now()).toISOString();
    migrated = true;
  }
  const guidelinesGraceUntil = new Date(
    Date.parse(db.mentorRules.phase1At) +
      mentorSettings().guidelinesGraceDays * 86400000,
  ).toISOString();
  const backfillMentor = (profile) =>
    backfillMentorProfile(profile, {
      topics: canonicalTags(profile?.expertise).join(", "),
      graceUntil: String(profile?.expertise || profile?.offer || "").trim()
        ? guidelinesGraceUntil
        : null,
    });
  const matching = migrateMatchingConfig(db.matchingConfig);
  if (matching !== db.matchingConfig) {
    db.matchingConfig = matching;
    migrated = true;
  }
  for (const account of Object.values(db.accounts)) {
    if (backfillMentor(account.state.profiles.mentor)) migrated = true;
    if (!Array.isArray(account.state.profiles.mentor.officeHours)) {
      account.state.profiles.mentor.officeHours = [];
      migrated = true;
    }
    if (!Object.hasOwn(account.state.profiles.mentor, "preferredHours")) {
      account.state.profiles.mentor.preferredHours = null;
      migrated = true;
    }
    // A sample's stored baseline is migrated the same way, so an untouched
    // sample still matches it and is refreshed to the new fixture below.
    if (account.demoFixture?.snapshot?.profile?.expertise !== undefined) {
      const baseline = account.demoFixture.snapshot.profile;
      if (backfillMentor(baseline)) migrated = true;
      if (!Object.hasOwn(baseline, "officeHours")) {
        baseline.officeHours = [];
        migrated = true;
      }
      if (!Object.hasOwn(baseline, "preferredHours")) {
        baseline.preferredHours = null;
        migrated = true;
      }
    }
    for (const room of Object.values(account.state.rooms)) {
      if (migrateMentorship(room, now())) {
        if (room.status === "launched" && room.launchedAt) {
          room.mentorship.reviewOpenedAt = room.launchedAt;
          room.mentorship.reviewClosesAt = reviewDeadline(room);
        }
        if (room.cycle) {
          room.cycle.checkIns ||= mentorSettings().checkInsPerCycle;
          room.cycle.checkInMinutes ||= mentorSettings().checkInMinutes;
          if (room.milestones.checkins?.schedules?.length)
            room.cycle.confirmedAt ||= room.createdAt || room.cycle.startsAt;
        }
        migrated = true;
      }
      if (ongoingMentorship(room) && room.terms.partnerLocked && !room.cycle) {
        ensureCycle(room, now(), mentorSettings());
        migrated = true;
      }
    }
    if (!account.notificationPreferences) {
      account.notificationPreferences = {
        ...defaultPreferences,
        digest: "off",
      };
      migrated = true;
    }
    if (
      account.affiliation?.status === "pending" &&
      !account.affiliation.requestedAt
    ) {
      account.affiliation.requestedAt = new Date(now()).toISOString();
      account.affiliation.dueAt = moderationDueAt(
        account.affiliation.requestedAt,
      );
      migrated = true;
    }
  }
  if (migrated) save();
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
        notificationPreferences: { ...defaultPreferences },
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
    if (seedDemoImpact(db.accounts) || samplesChanged) save();
  }
  if (options.showcaseProfiles && seedShowcase(db.accounts, now())) save();

  const event = (account, role, text, roomId, extra = {}) => {
    const time = now();
    const mentorRequest = role === "mentor" && extra.kind === "request";
    account.state.activity.unshift({
      id: randomUUID(),
      role,
      text,
      roomId,
      timestamp: new Date(time).toISOString(),
      sample: false,
      ...extra,
      ...(mentorRequest && {
        requestDigestAt:
          account.notificationPreferences?.mentorRequestEmail === "instant"
            ? null
            : nextRequestDigest(
                time,
                account.state.profiles.mentor.timeZone || "Asia/Manila",
                mentorSettings().digestHour,
              ),
      }),
    });
  };
  // Startups appear under their company name when one is set.
  const displayName = (account, role) =>
    (role === "founder" &&
      account.state.profiles.founder?.startupName?.trim()) ||
    account.state.accountName;
  const introLimitMs = options.introductionLimitMs ?? 14 * 86400000;
  const mentorRequests = createMentorRequests({
    accounts: () => db.accounts,
    now,
    config: mentorSettings,
    identity,
    displayName,
    capacity: (state) => mentorUsage(state),
    similarMentors: (...args) => similarMentors(...args),
    conflict: (...args) => pairConflict(...args),
    fail,
    event,
    connect,
    legacyWindow: introLimitMs,
    approvedMentor: (account) => onboarding.approved(account),
    safetyCheck: (...args) => safety.check(...args),
    recordSafety: (...args) => safety.record(...args),
    options,
  });
  const mentorshipRooms = createMentorshipRooms({
    accounts: () => db.accounts,
    // Prototype only, with the same gate as simulate-acceptance: a
    // server-verified fictional partner (see simulatedAcceptor).
    canSimulatePartner(account, room) {
      const partner = db.accounts[room.partnerAccountId];
      return Boolean(partner && simulatedAcceptor(account, partner));
    },
    config: mentorSettings,
    now,
    capacity: (...args) => mentorUsage(...args),
    officeAllocation,
    safetyCheck: (...args) => safety.check(...args),
    recordSafety: (...args) => safety.record(...args),
    event,
    mirror,
    fail,
    isAdmin: (account) => features.isAdmin(account),
    audit(account, kind, id, decision) {
      (db.moderationAudit ||= []).push({
        id: randomUUID(),
        moderator: account.email,
        kind,
        targetId: id,
        decision,
        timestamp: new Date(now()).toISOString(),
      });
    },
  });
  const officeHours = createOfficeHours({
    accounts: () => db.accounts,
    config: mentorSettings,
    now,
    fail,
    mirror,
    connect,
    capacity: (state) => mentorUsage(state),
    verify: (...args) => mentorRequests.verify(...args),
    founderLimit: (state) => mentorRequests.founderLimit(state),
    eligible: directoryVisible,
    conflict: (...args) => pairConflict(...args),
    checkSchedule: (...args) => mentorshipRooms.checkSchedule(...args),
    safetyCheck: (...args) => safety.check(...args),
    recordSafety: (...args) => safety.record(...args),
  });
  const safety = createMentorSafety({
    accounts: () => db.accounts,
    config: mentorSettings,
    now,
    event,
    audit,
    fail,
    isAdmin: (account) => features.isAdmin(account),
    mirror,
    endRoom: (...args) => mentorshipRooms.end(...args),
    returnRequests: (...args) => mentorRequests.returned(...args),
    similarMentors: (...args) => similarMentors(...args),
  });
  const payments = createMentorPayments({
    getDb: () => db,
    now,
    fail,
    event,
    mirror,
    isAdmin: (account) => features.isAdmin(account),
    settings: mentorSettings,
    bookOffice: (...args) => officeHours.act(...args),
    validateOffice: (...args) => officeHours.validateBooking(...args),
    acceptUpgrade: (...args) => mentorshipRooms.act(...args),
    roomAction: (...args) => mentorshipRooms.act(...args),
    secret: options.paymentsWebhookSecret,
  });
  const keepHistory = (state, role, entry) => {
    state.introHistoryByRole ||= { founder: [], mentor: [] };
    state.introHistoryByRole[role] ||= [];
    state.introHistoryByRole[role].unshift({
      ...entry,
      at: new Date().toISOString(),
    });
    state.introHistoryByRole[role] = state.introHistoryByRole[role].slice(
      0,
      20,
    );
  };
  // Time-based closures run before any read: unanswered introductions expire
  // after 14 days and review windows close 14 days after launch (D1, D13).
  function sweepMentorship() {
    let changed = false;
    for (const owner of Object.values(db.accounts)) {
      for (const room of Object.values(owner.state.rooms)) {
        if (
          !isMentorRoom(room) ||
          room.role !== "mentor" ||
          !db.accounts[room.partnerAccountId]?.state.rooms[room.id]
        )
          continue;
        if (mentorshipRooms.sweep(owner, owner.state, room)) {
          mirror(owner, owner.state, room);
          changed = true;
        }
      }
    }
    if (payments.sweep()) changed = true;
    if (safety.sweep()) changed = true;
    return mentorRequests.sweep() || changed;
  }
  function sweep(account, mentoring = true) {
    let changed = mentoring && sweepMentorship();
    const time = now();
    const state = account.state;
    // Pause Mode ends by itself at the start of the chosen resume date, in the
    // mentor's own time zone.
    const mentor = state.profiles.mentor;
    if (
      mentor?.paused &&
      !account.mentorSafetyPause &&
      mentor.pausedUntil &&
      time >=
        scheduleInstant({
          date: mentor.pausedUntil,
          time: "00:00",
          timeZone: mentor.timeZone || "Asia/Manila",
        }).getTime()
    ) {
      Object.assign(mentor, {
        paused: false,
        pausedAt: null,
        pausedUntil: null,
      });
      event(
        account,
        "mentor",
        "Pause Mode ended as planned. Founders can send you requests again.",
        undefined,
        { kind: "mentoring" },
      );
      changed = true;
    }
    for (const role of roles) {
      const meta = state.introductionMetaByRole?.[role] || {};
      for (const [id, item] of Object.entries(meta)) {
        if (!state.waitingByRole[role].has(id) || item.kind) continue;
        if (
          time - Date.parse(item.sentAt || 0) <
          (options.introductionLimitMs ?? introLimitMs)
        )
          continue;
        const [otherId, otherRole] = id.split(":");
        const other = db.accounts[otherId];
        const ownId = identity(account, role);
        state.waitingByRole[role].delete(id);
        state.interestByRole[role].delete(id);
        delete meta[id];
        keepHistory(state, role, {
          id,
          name: item.name,
          status: "expired",
          direction: "sent",
        });
        event(
          account,
          role,
          `Your introduction to ${item.name} expired after 14 days without a reply.`,
          undefined,
          { matchId: id },
        );
        if (other?.state.incomingByRole[otherRole]?.has(ownId)) {
          other.state.incomingByRole[otherRole].delete(ownId);
          delete other.state.introductionMetaByRole?.[otherRole]?.[ownId];
          keepHistory(other.state, otherRole, {
            id: ownId,
            name: displayName(account, role),
            status: "expired",
            direction: "received",
          });
        }
        changed = true;
      }
    }
    for (const room of Object.values(state.rooms)) {
      if (isMentorRoom(room)) continue;
      if (room.status !== "launched") continue;
      if (!room.launchedAt) {
        room.launchedAt =
          room.updatedAt || room.createdAt || new Date(time).toISOString();
        const other = db.accounts[room.partnerAccountId]?.state.rooms[room.id];
        if (other) other.launchedAt ||= room.launchedAt;
        changed = true;
      }
      if (time < Date.parse(reviewDeadline(room, options.reviewWindowMs)))
        continue;
      for (const copy of [
        room,
        db.accounts[room.partnerAccountId]?.state.rooms[room.id],
      ]) {
        if (!copy || copy.status !== "launched") continue;
        copy.status = "reviewed";
        copy.review.windowClosed = true;
        copy.completedAt ||= new Date().toISOString();
      }
      event(
        account,
        room.role,
        "The review window closed. Submitted feedback is now visible.",
        room.id,
        { review: true, kind: "review-release" },
      );
      changed = true;
    }
    return changed;
  }
  const mentorUsage = (mentorState) => {
    const config = mentorSettings();
    const time = now();
    const allocation = mentorState.profiles.mentor?.officeHours?.length
      ? officeAllocation(mentorState, time, config).months
      : undefined;
    return capacityUsage(mentorState, time, config, allocation);
  };
  // What founders see for a mentor: capacity plus the Office Hours slots they
  // can book. Office Hours with no bookable slot is closed to founders. The
  // mentor's own Home and Settings use the same result.
  function publicMentorUsage(account) {
    const usage = mentorUsage(account.state);
    const officeHours =
      usage.offeredFormats.includes("office-hours") &&
      usage.activeMentees < usage.capacity.maxMentees &&
      ![
        "paused",
        "guidelines",
        "suspended",
        "approval-required",
        "no-show-limit",
      ].includes(usage.reason)
        ? officeAvailability(account.state, now(), mentorSettings()).filter(
            (slot) =>
              !Object.values(db.payments || {}).some(
                (payment) =>
                  payment.mentorId === account.id &&
                  payment.hold?.occurrenceId === slot.id &&
                  payment.status === "due" &&
                  Date.parse(payment.dueBy) > now(),
              ),
          )
        : [];
    if (
      usage.offeredFormats.includes("office-hours") &&
      !usage.formatReasons["office-hours"] &&
      !officeHours.length
    ) {
      usage.availableFormats = usage.availableFormats.filter(
        (id) => id !== "office-hours",
      );
      usage.formatReasons["office-hours"] = "no-office-hours";
      if (!usage.availableFormats.length && !usage.reason) {
        usage.available = false;
        usage.reason = "no-office-hours";
      }
    }
    return { usage, officeHours };
  }
  // Conflict of interest between a mentor account and a founder account.
  const pairConflict = (mentorAccount, founderAccount) =>
    conflictWith(
      mentorAccount.state.profiles.mentor,
      founderAccount.state.profiles.founder,
      {
        ownStartup: mentorAccount.state.profiles.founder?.startupName || "",
        sameAccount: mentorAccount.id === founderAccount.id,
      },
    );
  // The end of a decline cooldown between a founder and a mentor, if active.
  function cooldownUntil(founder, mentorId) {
    const entry = (founder.state.mentorRequestsByRole?.founder || []).find(
      (item) =>
        item.partnerId === mentorId && Date.parse(item.cooldownUntil) > now(),
    );
    return entry?.cooldownUntil || null;
  }
  // Available mentors most similar to the founder's needs, for every place a
  // request can't go ahead (paused, full, conflict). Mentors the founder
  // can't ask yet (a decline cooldown) are left out.
  function similarMentors(
    founder,
    excludeId,
    n = mentorSettings().alternativesCount,
  ) {
    const viewer = { ...founder.state, role: "founder" };
    return Object.values(db.accounts)
      .filter(
        (other) =>
          identity(other, "mentor") !== excludeId &&
          !cooldownUntil(founder, identity(other, "mentor")) &&
          directoryVisible(other, founder) &&
          discoverableMentor(other) &&
          pairConflict(other, founder)?.level !== "block",
      )
      .map((other) => person(other, "mentor", viewer))
      .filter((item) => item.available)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, n)
      .map(({ id, name, score }) => ({ id, name, score }));
  }
  // Sending or accepting a mentorship introduction needs a mentor who can take
  // it now and no blocking conflict. The server checks this on every path, so
  // a direct request from a shared link is held to the same rule.
  function mentorGate(account, state, person, other) {
    const mentorIsMe = state.role === "mentor" && person.role === "founder";
    const mentorIsThem = state.role === "founder" && person.role === "mentor";
    if (!mentorIsMe && !mentorIsThem) return;
    const [mentorAccount, founderAccount] = mentorIsMe
      ? [account, other]
      : [other, account];
    if (pairConflict(mentorAccount, founderAccount)?.level === "block")
      fail(
        "A conflict of interest prevents this introduction.",
        409,
        undefined,
        {
          reason: "conflict",
          alternatives: mentorIsThem ? similarMentors(account, person.id) : [],
        },
      );
    if (mentorAccount.mentorSuspension)
      fail("This mentor is suspended.", 409, undefined, {
        reason: "suspended",
      });
    if (!onboarding.approved(mentorAccount))
      fail(
        "This mentor must complete approval before connecting.",
        409,
        undefined,
        {
          reason: "approval-required",
          alternatives: similarMentors(
            founderAccount,
            identity(mentorAccount, "mentor"),
          ),
        },
      );
    const usage = mentorUsage(mentorIsMe ? state : mentorAccount.state);
    const single = "single-session";
    const reason = ["paused", "guidelines", "no-show-limit"].includes(
      usage.reason,
    )
      ? usage.reason
      : !usage.offeredFormats.includes(single)
        ? "format-unavailable"
        : usage.fitReasons[single];
    if (!reason) return;
    if (mentorIsMe)
      fail(ownUnavailableText(reason), 409, undefined, {
        reason,
      });
    fail(
      `${unavailableText(reason, person.name, {
        format: reason === usage.fitReasons[single] ? single : undefined,
        month: usage.reasonMonths?.[single],
      })} Try one of the suggested mentors instead.`,
      409,
      undefined,
      {
        reason,
        alternatives: similarMentors(account, person.id),
      },
    );
  }
  function person(account, role, viewer) {
    const profile = normalizeProfile(account.state.profiles[role]);
    const mine = viewer.profiles[viewer.role];
    const mentorPair = role === "mentor" || viewer.role === "mentor";
    const { usage, officeHours } =
      role === "mentor"
        ? publicMentorUsage(account)
        : { usage: null, officeHours: [] };
    // Availability and Format Fit describe the mentor in a pair. A mentor
    // browsing founders is scored on the same factors founders see for them,
    // so both sides of one pair read the same percentage.
    const viewerMentor =
      role === "founder" && viewer.role === "mentor"
        ? db.accounts[viewer.accountId]
        : null;
    const fitUsage =
      usage || (viewerMentor ? publicMentorUsage(viewerMentor).usage : null);
    const marketing = [
      [mine.offer, profile.need],
      [profile.offer, mine.need],
    ].some(
      ([offer, need]) =>
        /marketing|audience|promotion|growth/i.test(offer) &&
        /marketing|audience|promotion|growth/i.test(need),
    );
    // A beta-testing exchange fits when either startup wants its product
    // tested, since any founder can test the other's product. Any other
    // startup trade (advice, feedback, introductions) defaults to a Skill Swap.
    const testing = [
      `${mine.need || ""} ${mine.needTags || ""}`,
      String(profile.need || ""),
    ].some((need) => /beta|tester|testing/i.test(need));
    // Fictional sample partners are shared by every preview account, so their
    // rooms also hold other testers' sessions and ratings. Only their seeded
    // sample history counts, so one tester's review never shapes the next
    // tester's view of the same startup or mentor.
    const fictional = Boolean(account.demoSample);
    const rooms = fictional
      ? Object.fromEntries(
          Object.entries(account.state.rooms).filter(
            ([, room]) => room.mentorship?.sample,
          ),
        )
      : account.state.rooms;
    const { mentorship, ...trust } = trustSummary(rooms, role, now(), {
      requests: fictional
        ? []
        : account.state.mentorRequestsByRole?.[role] || [],
      pending:
        role === "mentor" && !fictional
          ? account.state.incomingByRole.mentor.size
          : 0,
      approved: role === "mentor" && onboarding.approved(account),
      config: mentorSettings(),
    });
    const mentorStats = publicMentorshipTrust(mentorship, mentorSettings());
    return {
      id: identity(account, role),
      accountId: account.id,
      role,
      // Startups are listed by company; the founder stays visible beside it.
      name:
        role === "founder" && profile.startupName?.trim()
          ? profile.startupName.trim()
          : account.state.accountName,
      founderName: role === "founder" ? account.state.accountName : "",
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
      // Structured capacity replaces the old free-text availability. The
      // mentor's conflict list is never exposed.
      availability:
        role === "mentor"
          ? availabilityLine(usage)
          : profile.availability || "",
      ...(role === "mentor" && {
        available: usage.available,
        availableFormats: usage.availableFormats,
        officeHours,
        formatReasons: usage.formatReasons,
        formatReasonMonths: usage.reasonMonths,
        reasonMonth: usage.reasonMonth,
        openSlots: usage.openSlots,
        hoursLeftThisMonth: usage.hoursLeft,
        formats: normalizeOfferedFormats(
          profile.formats,
          profile.payoutSetup?.status === "ready",
          payments.config(),
        ),
        responseDays: usage.capacity.responseDays,
        reason: usage.reason,
        paused: usage.paused,
        topics: profile.topics || "",
      }),
      pastExperience: role === "mentor" ? profile.pastExperience || "" : "",
      expertise: role === "mentor" ? profile.expertise || "" : "",
      startups: role === "mentor" ? profile.startups || "" : "",
      engagement:
        role === "mentor" || viewer.role === "mentor"
          ? "Mentorship"
          : marketing
            ? "Co-Marketing Swap"
            : testing
              ? "Beta Testing Exchange"
              : "Skill Swap",
      // Every startup pair can run any exchange; mentors offer mentorship.
      engagementTypes:
        role === "mentor" || viewer.role === "mentor"
          ? ["Mentorship"]
          : ["Beta Testing Exchange", "Co-Marketing Swap", "Skill Swap"],
      emailVerified: Boolean(account.emailVerifiedAt),
      affiliation:
        account.affiliation?.status === "verified"
          ? {
              organization: account.affiliation.organization,
              status: "verified",
            }
          : role === "mentor" &&
              mentorVerificationLabel(account.mentorApplication)
            ? {
                organization: mentorVerificationLabel(
                  account.mentorApplication,
                ),
                status: "verified",
              }
            : null,
      trust,
      ...(role === "mentor"
        ? { mentorImpact: mentorStats }
        : viewer.role === "mentor"
          ? { founderTrackRecord: mentorStats }
          : {}),
      badges: mentorStats.badges,
      ...scoreProfile(
        viewer.profiles[viewer.role],
        profile,
        mentorPair,
        db.matchingConfig || defaultMatching,
        fitUsage
          ? {
              availability: availabilityFit(fitUsage),
              format: formatFit(fitUsage),
            }
          : mentorPair
            ? null
            : undefined,
      ),
    };
  }
  function discoverableMentor(account) {
    return (
      !account.mentorSuspension &&
      onboarding.approved(account) &&
      (account.mentorApplication?.status === "approved" ||
        profileCompleteness(account.state.profiles.mentor, "mentor") === 100)
    );
  }
  // Whether `other` is fictional and may act for itself on `account`'s behalf
  // (accept an introduction, answer in a room): a demo-mode sample for a
  // preview account, or a showcase profile (server/showcase.js) for a real
  // account.
  function simulatedAcceptor(account, other) {
    if (other.deletedAt || account.demoSample || account.showcase) return false;
    if (account.demo)
      return Boolean(options.demoMode && other.demo && other.demoSample);
    return Boolean(other.showcase && !other.demo);
  }
  function directoryVisible(other, account) {
    return (
      other.id !== account.id &&
      !other.deletedAt &&
      (!other.demo || (account.demo && other.demoSample && options.demoMode)) &&
      !other.suspended &&
      other.profileVisible !== false &&
      !account.blockedAccounts?.includes(other.id) &&
      !other.blockedAccounts?.includes(account.id)
    );
  }
  function prepare(account, role = account.state.role) {
    if (sweep(account)) save();
    const state = clone(account.state);
    state.role = roles.includes(role) ? role : state.role;
    state.authenticated = true;
    state.accountId = account.id;
    state.calendarToken = account.calendarToken || null;
    state.mentorApplication = onboarding.get(account, state.role);
    state.mentorshipSurvey =
      state.role === "mentor" ? account.mentorshipSurvey || null : null;
    state.mentorSuspension =
      state.role === "mentor" ? account.mentorSuspension || null : null;
    state.emailVerified = Boolean(account.emailVerifiedAt);
    // When the banner may send another verification link.
    const linkSentAt = Date.parse(account.emailVerification?.sentAt);
    state.emailVerificationRetryAt = Number.isFinite(linkSentAt)
      ? new Date(linkSentAt + linkCooldown).toISOString()
      : null;
    state.integrations = {
      demoMode: Boolean(options.demoMode),
      guest: Boolean(account.demo),
      maxFileBytes: options.maxFileBytes || 5 * 1024 * 1024,
      moderation: Boolean(options.adminEmails?.length),
      requireVerification: Boolean(options.requireVerification),
      simulateVerification: Boolean(options.simulateVerification),
      emailAuth,
    };
    state.firstRunChoice = Boolean(
      account.firstRunChoice && state.role === "founder",
    );
    state.introductionTypesByRole ||= { founder: {}, mentor: {} };
    state.introductionMetaByRole ||= { founder: {}, mentor: {} };
    state.introHistoryByRole ||= { founder: [], mentor: [] };
    state.verification =
      (state.role === "mentor" &&
        account.mentorApplication?.status === "approved") ||
      account.affiliation?.status === "verified"
        ? "verified"
        : account.affiliation?.status || "none";
    // A moderator-approved mentor application is the mentor's verification.
    state.mentorVerification =
      state.role === "mentor" &&
      mentorVerificationLabel(account.mentorApplication)
        ? { label: mentorVerificationLabel(account.mentorApplication) }
        : null;
    // The mentor's own capacity, computed on the server and only shown by the
    // client (Settings, Home and Profile).
    state.mentorUsage = publicMentorUsage({ ...account, state }).usage;
    if (state.mentorApplication || state.mentorSuspension)
      Object.assign(state.mentorUsage, {
        available: false,
        availableFormats: [],
        reason: state.mentorSuspension ? "suspended" : "approval-required",
      });
    // The same rule that lists a mentor in founders' Matches, so the mentor's
    // own banners never disagree with what founders can see.
    state.mentorListing =
      state.role === "mentor"
        ? {
            listed:
              discoverableMentor(account) &&
              account.profileVisible !== false &&
              !account.suspended,
            hidden: account.profileVisible === false,
          }
        : null;
    // Upcoming open (unbooked) Office Hours times for the mentor's calendar.
    state.mentorOfficeOpenings =
      state.role === "mentor"
        ? officeAvailability(state, now(), mentorSettings())
        : [];
    state.directory = createInitialState().directory;
    for (const other of Object.values(db.accounts)) {
      if (!directoryVisible(other, account)) continue;
      for (const otherRole of roles) {
        if (
          otherRole === "mentor"
            ? !discoverableMentor(other)
            : profileCompleteness(other.state.profiles.founder, "founder") < 100
        )
          continue;
        // A blocking conflict hides the pair from each other in both
        // directions, so neither can find or request the other.
        const conflict =
          state.role === "founder" && otherRole === "mentor"
            ? pairConflict(other, account)
            : state.role === "mentor" && otherRole === "founder"
              ? pairConflict(account, other)
              : null;
        if (conflict?.level === "block") continue;
        const item = person(other, otherRole, state);
        if (conflict?.level === "warn" && state.role === "mentor")
          item.conflictWarning = conflict.text;
        if (state.role === "founder" && otherRole === "mentor") {
          const until = cooldownUntil(account, item.id);
          if (until) item.cooldownUntil = until;
        }
        // Display hint only; each simulated action re-checks on the server.
        item.prototypePartner = simulatedAcceptor(account, other);
        item.canSimulateAcceptance = Boolean(
          simulatedAcceptor(account, other) &&
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
            swap: "Skill Swap",
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
      if (isMentorRoom(room)) {
        const mentor = room.role === "mentor" ? account : other;
        if (mentor)
          room.officeHoursSuggestions = officeAvailability(
            mentor.state,
            now(),
            mentorSettings(),
          );
        if (mentor)
          room.preferredHoursSuggestions = preferredAvailability(
            mentor.state,
            now(),
            mentorSettings(),
          );
      }
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
      if (!["launched", "reviewed"].includes(room.status)) continue;
      const partner = db.accounts[room.partnerAccountId];
      const released =
        room.status === "reviewed" &&
        (room.review.me || room.review.windowClosed);
      state.trustHistoryByRole[room.role].push({
        id: room.id,
        partner: partner
          ? displayName(partner, room.partnerRole)
          : "Collaborator",
        type: room.engagementType,
        rating:
          released && room.review.partner ? room.review.partnerRating : null,
        note: released && room.review.partner ? room.review.partnerNote : "",
        status:
          room.status === "launched"
            ? "Reviews pending"
            : room.review.partner
              ? "Completed"
              : "Completed · no partner review",
        // The room opens when the collaboration starts; Your profile shows
        // started and ended dates.
        started: room.createdAt?.slice(0, 10) || "",
        date: (room.completedAt || room.launchedAt)?.slice(0, 10) || "",
        sample: false,
      });
    }
    mentorRequests.decorate(account, state);
    payments.decorate(account, state);
    return features.decorate(account, state);
  }
  function response(account, role) {
    const state = prepare(account, role);
    if (features.rememberNotifications(account, state)) save();
    if (features.readRoomNotices(account, state, actingRoomId)) save();
    for (const room of Object.values(state.rooms)) {
      for (const cycle of [...(room.cycleHistory || []), room.cycle].filter(
        Boolean,
      )) {
        const reviews = cycle.reviews || {};
        if (
          !cycle.reviewWindowClosed &&
          (!reviews[account.id] || !reviews[room.partnerAccountId])
        )
          delete reviews[room.partnerAccountId];
      }
      if (isMentorRoom(room)) {
        for (const entry of room.mentorship.history || []) {
          if (
            entry.review &&
            !(entry.review.me && entry.review.partner) &&
            !entry.review.windowClosed
          )
            delete entry.review;
        }
        if (
          !(room.review.me && room.review.partner) &&
          !room.review.windowClosed
        ) {
          for (const key of [
            "partnerScores",
            "partnerTestimonial",
            "partnerTestimonialPublic",
            "partnerSubmittedAt",
          ])
            delete room.review[key];
        }
      }
      if (
        !(room.review.me && room.review.partner) &&
        !room.review.windowClosed
      ) {
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
  // `context.device` describes the browser for the sign-in alert.
  function login(values, signup = false, derived, context = {}) {
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
        notificationPreferences: { ...defaultPreferences },
      };
      transition(account.state, { form: "signup-form", values });
      Object.assign(
        account.state.profiles.mentor,
        mentorDefaults(mentorSettings()),
      );
      if (values.role === "mentor" || values.role === "both")
        onboarding.begin(account);
      db.accounts[account.id] = account;
      if (emailAuth) queueAuthEmail(db, account, "verify-email", now());
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
    if (
      !signup &&
      emailAuth &&
      authEmailAllowed(account, "sign-in-alert") &&
      queueAuthEmail(db, account, "sign-in-alert", now(), {
        at: new Date(now()).toISOString(),
        device: context.device || "",
      })
    )
      save();
    return openSession(account);
  }
  async function loginAsync(values, signup = false, context) {
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
    const result = login(
      values,
      signup,
      {
        salt,
        hash: bytes.toString("hex"),
        candidate: bytes,
        expected: account?.passwordHash,
      },
      context,
    );
    deliverSoon();
    return result;
  }
  // Role-preview accounts. With credentials, the same email and password lead
  // back to the same preview account; without them (scripts and tests) every
  // call opens a fresh account as before. The preview email lives apart from
  // `email` so password sign-in and signup never see preview accounts.
  const previewMismatch =
    "That email is already used in this preview. Use the same password as before, or a different email.";
  const previewEmail = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();
  const findPreview = (email) =>
    Object.values(db.accounts).find(
      (item) =>
        item.demo &&
        !item.demoSample &&
        !item.deletedAt &&
        item.previewEmail === email,
    );
  function seedPreview(state, role, { sample = true } = {}) {
    state.role = role;
    state.profileDone = true;
    state.accountName =
      role === "founder" ? sampleFounderName : previewMentorName;
    Object.assign(state.profiles.founder, sampleFounderProfile);
    Object.assign(state.profiles.mentor, {
      bio: "Helping early teams improve their products and find traction.",
      offer: "Product strategy, Growth, Onboarding guidance",
      need: "Early teams, Product challenges",
      expertise: "Product strategy, Growth",
      availability: "Monthly sessions",
      startups: "Idea and pre-seed teams",
      // Initials, not a sample mentor's illustration (see previewMentorName).
      image: "",
      noConflicts: true,
      // The guided preview starts ready to mentor, but nobody accepted the
      // guidelines for it: it gets the grace period, and Home asks the
      // preview mentor to read and accept them.
      guidelinesVersion: null,
      guidelinesAcceptedAt: null,
      guidelinesGraceUntil: new Date(
        now() + mentorSettings().guidelinesGraceDays * 86400000,
      ).toISOString(),
    });
    if (!sample) blankFounder(state);
  }
  // "Set up my startup": no persona name, image or sample company.
  function blankFounder(state) {
    const empty = createInitialState().profiles.founder;
    state.profiles.founder = { ...empty };
    state.profileDone = false;
    if (state.accountName === sampleFounderName) state.accountName = "";
  }
  function openDemo(role, credentials, derived) {
    if (!options.demoMode) fail("Demo access is disabled.", 404);
    if (!roles.includes(role)) fail("Choose a founder or mentor preview.");
    const given =
      credentials && typeof credentials === "object" ? credentials : null;
    let email = "";
    let password = "";
    if (given) {
      email = previewEmail(given.email);
      password = typeof given.password === "string" ? given.password : "";
      const errors = {};
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        errors.email = "Enter a valid email address, like you@example.com.";
      if (!password.trim()) errors.password = "Enter a password.";
      else if (password.length > 1024)
        errors.password = "Use a password with at most 1,024 characters.";
      if (Object.keys(errors).length)
        fail("Check your sign-in details.", 400, errors);
      const existing = findPreview(email);
      if (existing) {
        if (derived && derived.expected !== existing.passwordHash)
          fail("Account changed. Sign in again.", 401);
        const candidate =
          derived?.candidate || scryptSync(password, existing.salt, 64);
        if (
          !timingSafeEqual(candidate, Buffer.from(existing.passwordHash, "hex"))
        )
          fail(previewMismatch, 401, { password: previewMismatch });
        // The role is account-wide, so every open tab follows a change. Ask
        // first; the password was checked, so the current role is not leaked.
        const current = existing.state.role;
        if (current !== role && given.confirmRoleSwitch !== true)
          fail(
            `You were last using Synergy as a ${current}. Switch to ${role}? Other open tabs will switch too.`,
            409,
            undefined,
            { reason: "role-switch", currentRole: current },
          );
        existing.state.role = role;
        // Earlier mentor previews shared the sample mentor's name and picture.
        if (existing.state.accountName === "David Park") {
          existing.state.accountName = previewMentorName;
          if (
            existing.state.profiles.mentor?.image === "/demo/avatars/david.svg"
          )
            existing.state.profiles.mentor.image = "";
        }
        save();
        return openSession(existing);
      }
    }
    const state = createInitialState();
    const salt = given
      ? derived?.salt || randomBytes(16).toString("hex")
      : randomBytes(16).toString("hex");
    const account = {
      id: randomUUID(),
      demo: true,
      notificationPreferences: { ...defaultPreferences },
      email: `demo-${randomUUID()}@example.invalid`,
      salt,
      passwordHash: given
        ? (derived?.candidate || scryptSync(password, salt, 64)).toString("hex")
        : randomBytes(64).toString("hex"),
      state,
    };
    if (given) account.previewEmail = email;
    // A founder who signs in with their own credentials chooses between a
    // blank startup and the sample one before seeing the workspace.
    if (given && role === "founder") account.firstRunChoice = true;
    seedPreview(state, role, { sample: given?.sample !== false });
    state.accountEmail = given ? email : account.email;
    db.accounts[account.id] = account;
    // A mentor signing in for the first time has one request to try.
    if (given && role === "mentor")
      mentorRequests.seedSampleRequest(account, sampleMentorRequest);
    save();
    return openSession(account);
  }
  // Prototype only: the first-run choice for a new founder preview account.
  function chooseFirstRun(account, input) {
    if (!options.demoMode || !account.demo || !account.firstRunChoice)
      fail("This choice is no longer available.", 409);
    const start = input.values?.start;
    if (!["blank", "sample"].includes(start))
      fail("Choose to set up your startup or explore with a sample.");
    delete account.firstRunChoice;
    const state = prepare(account, "founder");
    if (start === "blank") blankFounder(state);
    state.formErrors = null;
    state.directory = createInitialState().directory;
    account.state = state;
    save();
    return response(account, "founder");
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
    "cancel-meeting",
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
    "meeting",
    "chat-form",
    "review-form",
    "report-form",
  ]);
  const roomActions = new Set([
    "lock-terms",
    "accept-terms",
    "confirm-milestone",
    "cancel-meeting",
    "dispute",
    "resolve-dispute",
    "launch-room",
  ]);
  const roomForms = new Set([
    "terms-form",
    "evidence",
    "schedule",
    "meeting",
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
    displayName,
    simulatePartner: (...args) => simulatePartner(...args),
    advanceRoom,
    keepHistory,
    mentorSettings,
    mentorAdmin: () => ({
      entries: mentorSettingEntries(mentorSettings()),
      history: (db.mentorConfigHistory || []).slice(0, 100),
      gate: mentoringGate(db, now()),
    }),
    changeMentorSetting(account, path, input) {
      let change;
      try {
        change = updatedMentorConfig(mentorSettings(), path, input);
      } catch (error) {
        fail(error.message, 400, { value: error.message });
      }
      const { next, before, value } = change;
      if (isDeepStrictEqual(before, value)) return false;
      db.mentorConfig = next;
      logMentorSetting(db, account.email, path, before, value, now());
      if (path === "guidelinesVersion") {
        const until = new Date(
          now() + next.guidelinesGraceDays * 86400000,
        ).toISOString();
        for (const mentor of Object.values(db.accounts).filter(
          discoverableMentor,
        ))
          mentor.state.profiles.mentor.guidelinesGraceUntil = until;
      }
      return true;
    },
    mentorApproved: (account) => onboarding.approved(account),
    approvalQueue: () => onboarding.queue(),
    mentorSafetyQueue: () => safety.queue(),
    validateOfficeHours: (...args) => officeHours.validateLowering(...args),
    similarMentors: (...args) => similarMentors(...args),
    mentorRequestActions: requestActions,
    mentorRequestAction: (account, state, input) => {
      mentorRequests.verify(account, state, input);
      mentorRequests.act(account, state, input);
    },
    returnMentorRequests: (account, state, reason, founder) =>
      mentorRequests.returned({ ...account, state }, reason, founder),
  });

  function advanceRoom(account, state, room) {
    if (isMentorRoom(room)) return false;
    if (["launched", "reviewed", "cancelled"].includes(room.status))
      return false;
    if (!room.terms.locked || !room.terms.partnerLocked) return false;
    if (ongoingMentorship(room)) ensureCycle(room, now());
    if (launchBlockers(room).length) {
      if (room.cycle && !room.finishingCycles) room.cycle.phase = "active";
      return false;
    }
    const items = Object.values(room.milestones);
    if (
      !items.length ||
      items.some(
        (item) =>
          !item.me ||
          !item.partner ||
          item.disputed ||
          item.proposal ||
          (item.evidence && !item.attachment),
      )
    )
      return false;
    if (ongoingMentorship(room) && !room.finishingCycles) {
      room.cycle.phase = "review";
      return false;
    }
    room.status = "launched";
    room.launchedAt = new Date(now()).toISOString();
    state.rating = 0;
    state.page = "review";
    state.confirmation =
      room.type === "mentorship"
        ? "Your mentorship completed. Review within 14 days."
        : "Your deal launched. Review within 14 days.";
    state.toast = state.confirmation;
    event({ state }, room.role, state.confirmation, room.id, {
      kind: "review",
      review: true,
    });
    return true;
  }

  function mirror(account, state, room, text, extra = {}) {
    if (isMentorRoom(room)) payments.syncRoom(room);
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
        room.cycle?.goals,
        room.terms.revision || 0,
      ]);
    for (const [id, item] of Object.entries(
      isMentorRoom(room) ? {} : room.milestones,
    )) {
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
        previous.cycle?.goals,
        previous.terms.revision || 0,
      ]);
      item.contentVersion =
        (old.contentVersion || 0) + (content(item) !== oldContent ? 1 : 0);
      if (content(item) !== oldContent) item.me = item.partner = false;
    }
    room.progress = roomProgress(room);
    const justLaunched = advanceRoom(account, state, room);
    if (justLaunched) {
      text = state.confirmation;
      extra = { kind: "review", review: true };
    }
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
      windowClosed: room.review.windowClosed,
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
      scores: room.review.partnerScores,
      partnerScores: room.review.scores,
      testimonial: room.review.partnerTestimonial,
      partnerTestimonial: room.review.testimonial,
      testimonialPublic: room.review.partnerTestimonialPublic,
      partnerTestimonialPublic: room.review.testimonialPublic,
      submittedAt: room.review.partnerSubmittedAt,
      partnerSubmittedAt: room.review.submittedAt,
      testimonialAccepted: room.review.testimonialAccepted,
    };
    partner.state.rooms[room.id] = shared;
    if (text)
      event(
        partner,
        shared.role,
        text,
        room.id,
        Object.fromEntries(
          Object.entries(extra).filter(([, value]) => value !== undefined),
        ),
      );
    state.rooms[room.id] = room;
  }
  // Prototype only: fictional sample collaborators answer a preview account's
  // actions so the whole Deal Room can be explored without a second person.
  function simulatePartner(account, state, room) {
    const partner = db.accounts[room.partnerAccountId];
    if (!partner || !simulatedAcceptor(account, partner)) return;
    if (["cancelled", "reviewed"].includes(room.status)) return;
    const before = encode(room);
    const name = displayName(partner, room.partnerRole);
    const said = [];
    if (room.terms.reopenRequest?.byAccountId === account.id) {
      room.terms = {
        ...room.terms,
        locked: false,
        partnerLocked: false,
        confirmedByMe: false,
        reopenRequest: null,
        revision: (room.terms.revision || 0) + 1,
      };
      for (const item of Object.values(room.milestones))
        item.me = item.partner = false;
      room.status = "matched";
      said.push("agreed to reopen the terms");
    }
    if (
      room.terms.locked &&
      room.terms.confirmedByMe &&
      !room.terms.partnerLocked
    ) {
      room.terms.partnerLocked = true;
      room.status = "in-progress";
      completeTermsMilestones(room);
      said.push("accepted the shared terms");
      // Replaces "Your partner can now review and confirm them" from
      // lock-terms: a fictional partner has already agreed.
      state.confirmation = `${name} agreed to the terms. Start on the milestones together.`;
    }
    for (const item of Object.values(room.milestones)) {
      if (item.proposal && item.proposal.proposedBy === account.id) {
        (item.revisions ||= []).push({
          ...item.proposal,
          previousTitle: item.title,
          previousDescription: item.description,
          decision: "accept",
          decidedBy: partner.id,
          decidedAt: new Date().toISOString(),
        });
        Object.assign(item, {
          title: item.proposal.title,
          description: item.proposal.description,
          revision: (item.revision || 0) + 1,
          me: false,
          partner: false,
        });
        delete item.proposal;
        said.push(`accepted your revision to “${item.title}”`);
      }
      if (item.disputed && item.resolvedByMe) {
        Object.assign(item, {
          disputed: false,
          dispute: null,
          me: false,
          partner: false,
          resolvedByMe: false,
          resolvedByPartner: false,
        });
        said.push(`agreed to resolve the dispute on “${item.title}”`);
      }
      if (item.me && !item.partner && !item.disputed && !item.proposal) {
        item.partner = true;
        said.push(`confirmed “${item.title}”`);
      }
    }
    let cycleCompleted = false;
    if (room.cycle?.phase === "review" && room.cycle.reviews[account.id]) {
      if (!room.cycle.reviews[partner.id]) {
        room.cycle.reviews[partner.id] = {
          rating: 4,
          note: "Simulated private cycle review from a fictional collaborator.",
          at: new Date(now()).toISOString(),
        };
        said.push("submitted a private cycle review");
      }
      if (
        room.cycle.decisions[account.id] &&
        !room.cycle.decisions[partner.id]
      ) {
        room.cycle.decisions[partner.id] = room.cycle.decisions[account.id];
        const result = resolveCycleDecisions(room, now());
        said.push(
          result === "finish"
            ? "agreed to finish the mentorship"
            : "agreed to continue with a new cycle",
        );
        if (result === "continue")
          state.toast = `Cycle ${room.cycle.number} started. Agree new goals and sessions.`;
        if (result === "finish")
          cycleCompleted = advanceRoom(account, state, room);
      }
    }
    if (room.status === "launched" && room.review.me && !room.review.partner) {
      Object.assign(room.review, {
        partner: true,
        partnerRating: 4,
        // Sample wording, so a prototype profile reads like a real one.
        partnerNote:
          "Clear terms, milestones delivered on time and useful feedback throughout. We would work together again.",
        partnerUseful: "yes",
        partnerGoalOutcome: "achieved",
      });
      room.status = "reviewed";
      room.completedAt = new Date().toISOString();
      said.push("submitted a review");
    }
    if (encode(room) === before) return;
    room.progress = roomProgress(room);
    room.updatedAt = new Date().toISOString();
    mirror(
      account,
      state,
      room,
      cycleCompleted ? state.confirmation : null,
      cycleCompleted ? { kind: "review", review: true } : {},
    );
    event(
      { state },
      state.role,
      `Prototype: ${name} ${said.join(", ")}. This is a simulated response from a fictional collaborator.`,
      room.id,
      room.status === "reviewed"
        ? { review: true, kind: "review-release" }
        : { tab: "milestones" },
    );
  }
  function connect(account, state, person, acceptedByPartner = false, request) {
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
        (request && "mentorship") ||
        state.introductionTypesByRole[state.role]?.[person.id] ||
        createModel(state).roomTypeForPerson(person),
    });
    room.engagementType = {
      beta: "Beta Testing Exchange",
      marketing: "Co-Marketing Swap",
      swap: "Skill Swap",
      mentorship: "Mentorship",
    }[room.type];
    if (room.type === "mentorship") {
      const previous = state.introductionMetaByRole[state.role]?.[person.id];
      initMentorship(
        room,
        request?.format || "single-session",
        request?.desiredOutcome ||
          request?.question ||
          request?.note ||
          // A mentor's own outreach carries no request: start from the
          // startup's stated goal. The mentor's note pitches their help and
          // is not the founder's goal, so it is used only when none is set.
          (state.role === "mentor" && other.state.profiles.founder?.goals) ||
          previous?.note ||
          // A founder accepting a mentor's outreach starts from their own goal.
          (state.role === "founder" && state.profiles.founder?.goals) ||
          "",
        now(),
      );
      // The whole request travels into the room, so neither side has to look
      // back at the inbox for the problem or what was already tried.
      for (const field of ["problem", "tried", "question", "desiredOutcome"])
        if (request?.[field]) room.mentorship[field] = request[field];
      const mentorProfile =
        state.role === "mentor"
          ? state.profiles.mentor
          : other.state.profiles.mentor;
      room.mentorship.topics = tags(mentorProfile.topics);
      room.mentorship.mentorTimeZone = mentorProfile.timeZone;
      if (request) room.mentorshipRequestId = request.id;
      if (roomFormat(room) === "ongoing-advisory")
        ensureCycle(room, now(), mentorSettings());
    }
    room.createdAt = room.updatedAt = new Date(now()).toISOString();
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
      algorithm: "reciprocal-v3",
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
    if (!isMentorRoom(room)) room.terms.confirmedByMe = false;
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
    state.roomTab = isMentorRoom(room) ? "overview" : "terms";
    state.confirmation = "You're connected. Your shared room is ready.";
    if (!request)
      event(
        { state },
        state.role,
        acceptedByPartner
          ? `${person.name} accepted your introduction. Your room is ready.`
          : `You connected with ${person.name}.`,
        id,
      );
    if (!request)
      event(
        other,
        person.role,
        acceptedByPartner
          ? `You accepted ${displayName(account, state.role)}'s introduction. Your room is ready.`
          : `${displayName(account, state.role)} accepted your introduction. Your room is ready.`,
        id,
        { tab: "terms" },
      );
    if (request?.price && request.format !== "office-hours") {
      room.terms.draft.price = request.price;
      payments.initialize(room, request.price, account.id);
    }
    return room;
  }
  // With sign-in email on, a new account does nothing until its email is
  // verified; reading its state stays open so the client sees the change.
  function requireVerifiedEmail(account) {
    if (emailUnverified(account))
      fail(
        "Verify your email to start using Synergy. Open the link we emailed you, or send a new one.",
        403,
        undefined,
        { reason: "email-unverified" },
      );
  }
  // The room the current action was taken in; its informational notices are
  // read in the response (readiness plan P7).
  let actingRoomId = null;
  function act(token, input, uploadedFile, avatars) {
    actingRoomId =
      input?.roomOpen === true &&
      typeof input.activeRoomId === "string" &&
      input.action !== "read-notifications"
        ? input.activeRoomId
        : null;
    try {
      return actInternal(token, input, uploadedFile, avatars);
    } catch (error) {
      db = clone(committed);
      throw error;
    } finally {
      actingRoomId = null;
    }
  }
  function actInternal(token, input, uploadedFile, avatars) {
    const account = authenticate(token);
    requireVerifiedEmail(account);
    if (input.action === "first-run-choice")
      return chooseFirstRun(account, input);
    if (paymentActions.has(input.action)) {
      if (!roles.includes(input.role) || input.form)
        fail("Choose a role and one action.");
      const state = prepare(account, input.role);
      // A payment action gets its own message, never the previous action's.
      state.toast = "";
      state.toastType = "success";
      delete state.officeSlotCheck;
      state.toastTitle = "";
      state.toastField = false;
      state.formErrors = null;
      payments.act(account, state, input);
      account.state = state;
      save();
      return response(account, input.role);
    }
    const officeAction = calendarActions.has(input.action);
    const onboardingAction = applicationActions.has(input.action);
    const safetyAction = safetyActions.has(input.action);
    if (
      safetyAction ||
      onboardingAction ||
      officeAction ||
      mentorshipRooms.handles(input, account)
    ) {
      if (
        Boolean(input.action) === Boolean(input.form) ||
        !roles.includes(input.role)
      )
        fail("Choose a role and submit one action or form.");
      const state = prepare(account, input.role);
      state.toast = "";
      state.toastType = "success";
      delete state.officeSlotCheck;
      state.toastTitle = "";
      state.toastField = false;
      state.formErrors = null;
      state.confirmation = "";
      // Only room commands and Office Hours bookings go through the payment
      // gate. Calendar, onboarding and safety actions carry the tab's last
      // room id too, and an unpaid room must not block them (Nov 22, round 2).
      const paymentGate =
        !safetyAction &&
        !onboardingAction &&
        (!officeAction ||
          ["book-office-hours", "rebook-office-slot"].includes(input.action));
      if (paymentGate && payments.intercept(account, state, input)) {
        /* Checkout opened. */
      } else if (safetyAction) safety.act(account, state, input);
      else if (onboardingAction) onboarding.act(account, state, input);
      else if (officeAction) officeHours.act(account, state, input);
      else mentorshipRooms.act(account, state, input, uploadedFile);
      state.directory = createInitialState().directory;
      account.state = state;
      if (uploadedFile)
        db.files[uploadedFile.id] = {
          ...uploadedFile,
          accountId: account.id,
          roomId: input.activeRoomId,
        };
      save();
      return response(account, input.role);
    }
    if (features.handles(input)) return features.act(token, input);
    if (
      ["interest", "accept-interest", "simulate-acceptance"].includes(
        input.action,
      )
    ) {
      if (
        options.requireVerification &&
        !account.demo &&
        account.affiliation?.status !== "verified" &&
        !(
          input.role === "mentor" &&
          account.mentorApplication?.status === "approved"
        ) &&
        ["interest", "accept-interest"].includes(input.action)
      )
        fail(
          "Verify your affiliation before sending or accepting introductions. Open Verification on your profile.",
          403,
        );
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
    delete state.officeSlotCheck;
    state.toastTitle = "";
    state.toastField = false;
    state.confirmation = "";
    state.formErrors = null;
    if (input.form !== "profile-form") state.profileWentLive = false;
    state.activeRoomId =
      typeof input.activeRoomId === "string" ? input.activeRoomId : null;
    const payload = {
      serverManaged: true,
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
    if (input.form === "terms-form" || input.action === "lock-terms") {
      // Template-specific terms (tester count, send date, mentorship format)
      // travel with the shared agreement.
      const termsRoom = state.rooms[state.activeRoomId];
      const extra = (
        termsRoom?.template?.fields ||
        defaultTemplates[termsRoom?.type]?.fields ||
        []
      ).map((item) => item.id);
      payload.values = Object.fromEntries(
        [
          "goal",
          "scope",
          "timeline",
          "commitment",
          "compensation",
          ...extra,
        ].map((key) => [key, String(payload.values[key] || "").slice(0, 300)]),
      );
    }
    const roomOperation =
      roomActions.has(input.action) || roomForms.has(input.form);
    const room = roomOperation ? createModel(state).activeRoom() : null;
    const previousRoom = room ? encode(room) : null;
    if (roomOperation && !room)
      fail("This room is unavailable for your account and role.", 404);
    if (
      room?.status === "in-progress" &&
      room.cycle?.phase === "review" &&
      Object.keys(room.cycle.reviews).length &&
      input.form !== "chat-form" &&
      input.action !== "launch-room"
    )
      fail(
        "Cycle work is locked after a private cycle review. Choose Continue or Finish after both reviews.",
      );
    if (
      room &&
      input.action === "confirm-milestone" &&
      ongoingMentorship(room) &&
      !room.cycle?.goals?.trim()
    )
      fail("Add goals for this mentorship cycle before confirming work.");
    if (room && input.action === "launch-room" && room.status !== "cancelled")
      return response(account, input.role);
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
    if (
      isMentorRoom(room) &&
      input.form === "chat-form" &&
      ["launched", "reviewed", "cancelled"].includes(room.status)
    )
      fail("This mentorship room is read-only.", 409);
    if (room && input.form === "schedule" && room.type !== "mentorship")
      fail("Scheduling is available only in mentorship rooms.");
    // Meetings belong to exchange collaborations; a mentorship schedules
    // through its own room rules.
    if (
      room &&
      (input.form === "meeting" || input.action === "cancel-meeting") &&
      !takesMeetings(room)
    )
      fail("Schedule mentorship sessions from the mentorship room.");
    if (
      room &&
      input.form === "meeting" &&
      terminalStatuses.includes(room.status)
    )
      fail("This collaboration has ended.", 409);
    if (
      room &&
      input.action === "cancel-meeting" &&
      !room.meetings?.some(
        (meeting) => meeting.id === input.id && !meeting.cancelledAt,
      )
    )
      fail("This meeting is unavailable.", 404);
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
    if (room && input.form === "review-form" && room.review.windowClosed)
      fail("The 14-day review window has closed for this collaboration.");
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
      if (account.demoSample || account.showcase)
        fail(
          "Acceptance simulation is available only to prototype preview accounts.",
          403,
        );
      const target = createModel(state)
        .rolePeople()
        .find((person) => person.id === input.id);
      const fictional = target && db.accounts[target.accountId];
      if (!fictional || !simulatedAcceptor(account, fictional))
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
        if (state.introductionMetaByRole[state.role]?.[target.id]?.kind)
          mentorRequests.act(account, state, input);
        else connect(account, state, target, true);
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
      const structured =
        state.introductionMetaByRole[state.role]?.[input.id]?.kind;
      if (structured && input.action !== "save") {
        const mappedAction = {
          "accept-interest": "accept-request",
          "decline-interest": "decline-request",
          "cancel-interest": "withdraw-request",
        }[input.action];
        if (!mappedAction) fail("This request is already pending.", 409);
        mentorRequests.verify(account, state, { action: mappedAction });
        mentorRequests.act(account, state, {
          ...input,
          action: mappedAction,
          values:
            mappedAction === "decline-request"
              ? { reason: "other", message: input.values?.reason }
              : input.values,
        });
        state.directory = createInitialState().directory;
        account.state = state;
        save();
        return response(account);
      }
      if (
        input.action === "interest" &&
        state.role === "founder" &&
        typeof input.id === "string" &&
        input.id.endsWith(":mentor") &&
        !state.incomingByRole.founder.has(input.id)
      ) {
        const command = { ...input, action: "send-request" };
        mentorRequests.verify(account, state, command);
        mentorRequests.act(account, state, command);
        state.directory = createInitialState().directory;
        account.state = state;
        save();
        return response(account);
      }
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
          : ["beta", "marketing", "swap"];
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
      if (
        ["interest", "accept-interest"].includes(input.action) &&
        permittedTypes.includes("mentorship")
      )
        mentorGate(account, state, person, other);
      if (input.action === "interest" || input.action === "accept-interest") {
        if (state.incomingByRole[state.role].has(person.id)) {
          if (
            input.engagementType &&
            permittedTypes.includes(input.engagementType)
          )
            state.introductionTypesByRole[state.role][person.id] =
              input.engagementType;
          keepHistory(state, state.role, {
            id: person.id,
            name: person.name,
            status: "accepted",
            direction: "received",
          });
          keepHistory(other.state, person.role, {
            id: ownId,
            name: displayName(account, state.role),
            status: "accepted",
            direction: "sent",
          });
          delete state.introductionMetaByRole?.[state.role]?.[person.id];
          delete other.state.introductionMetaByRole?.[person.role]?.[ownId];
          connect(account, state, person);
        } else if (!createModel(state).existingRoomFor(state.role, person.id)) {
          if (state.interestByRole[state.role].has(person.id))
            fail("This introduction is already pending.", 409);
          state.introductionTypesByRole ||= { founder: {}, mentor: {} };
          other.state.introductionTypesByRole ||= { founder: {}, mentor: {} };
          state.introductionTypesByRole[state.role][person.id] = proposedType;
          other.state.introductionTypesByRole[person.role][ownId] =
            proposedType;
          const note = String(payload.values.note || "")
            .trim()
            .slice(0, 280);
          const sentAt = payload.timestamp;
          state.introductionMetaByRole ||= { founder: {}, mentor: {} };
          other.state.introductionMetaByRole ||= { founder: {}, mentor: {} };
          state.introductionMetaByRole[state.role][person.id] = {
            sentAt,
            note,
            name: person.name,
          };
          other.state.introductionMetaByRole[person.role] ||= {};
          other.state.introductionMetaByRole[person.role][ownId] = {
            sentAt,
            note,
            name: displayName(account, state.role),
          };
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
            undefined,
            { matchId: person.id },
          );
          event(
            other,
            person.role,
            `${displayName(account, state.role)} wants to connect with you.`,
            undefined,
            { matchId: ownId, kind: "confirmation" },
          );
        } else fail("You already have a room with this collaborator.");
      } else if (input.action === "cancel-interest") {
        state.waitingByRole[state.role].delete(person.id);
        state.interestByRole[state.role].delete(person.id);
        other.state.incomingByRole[person.role].delete(ownId);
        delete state.introductionTypesByRole[state.role][person.id];
        if (other.state.introductionTypesByRole?.[person.role])
          delete other.state.introductionTypesByRole[person.role][ownId];
        delete state.introductionMetaByRole?.[state.role]?.[person.id];
        delete other.state.introductionMetaByRole?.[person.role]?.[ownId];
        keepHistory(state, state.role, {
          id: person.id,
          name: person.name,
          status: "withdrawn",
          direction: "sent",
        });
        keepHistory(other.state, person.role, {
          id: ownId,
          name: displayName(account, state.role),
          status: "withdrawn",
          direction: "received",
        });
        event(
          other,
          person.role,
          `${displayName(account, state.role)} withdrew their introduction.`,
          undefined,
          { matchId: ownId },
        );
        state.toast = "Introduction withdrawn.";
      } else if (input.action === "decline-interest") {
        state.incomingByRole[state.role].delete(person.id);
        other.state.waitingByRole[person.role].delete(ownId);
        other.state.interestByRole[person.role].delete(ownId);
        delete state.introductionTypesByRole[state.role][person.id];
        if (other.state.introductionTypesByRole?.[person.role])
          delete other.state.introductionTypesByRole[person.role][ownId];
        delete state.introductionMetaByRole?.[state.role]?.[person.id];
        delete other.state.introductionMetaByRole?.[person.role]?.[ownId];
        const reason = String(payload.values.reason || "")
          .trim()
          .slice(0, 280);
        keepHistory(state, state.role, {
          id: person.id,
          name: person.name,
          status: "declined",
          direction: "received",
        });
        keepHistory(other.state, person.role, {
          id: ownId,
          name: displayName(account, state.role),
          status: "declined",
          direction: "sent",
          reason,
        });
        state.toast = "Introduction declined.";
        event(
          other,
          person.role,
          `${displayName(account, state.role)} declined your introduction.${reason ? ` Reason: ${reason}` : ""}`,
          undefined,
          { matchId: ownId },
        );
      } else transition(state, payload);
    } else if (input.action === "accept-terms") {
      if (!room.terms.locked || room.terms.confirmedByMe)
        fail("There are no terms waiting for your confirmation.");
      room.terms.confirmedByMe = true;
      room.terms.partnerLocked = true;
      room.status = "in-progress";
      completeTermsMilestones(room);
      state.toast = "Terms confirmed by both collaborators.";
      partnerText = `${displayName(account, state.role)} accepted the shared terms. Work can begin.`;
    } else if (input.action === "resolve-dispute") {
      const item = room.milestones[input.id];
      if (!item?.disputed) fail("This milestone has no open dispute.");
      item.resolvedByMe = true;
      if (item.resolvedByPartner) {
        item.disputed = false;
        item.dispute = null;
        item.me = false;
        item.partner = false;
      }
      state.toast = item.disputed
        ? "Resolution recorded. Your collaborator must also agree."
        : "Dispute resolved. Confirm the milestone again together.";
      partnerText = `${displayName(account, state.role)} agreed to resolve the dispute on “${item.title}”.`;
    } else if (input.form === "report-form") {
      if (
        !payload.values.reason ||
        payload.values.reason.length > 3000 ||
        (payload.values.details || "").length > 3000
      )
        fail("Choose a reason and keep report details under 3,000 characters.");
      if (
        payload.values.appeal === "mentor-suspension" &&
        state.role === "mentor"
      ) {
        safety.appeal(account);
        db.reports.push({
          id: randomUUID(),
          kind: "mentor-appeal",
          accountId: account.id,
          reporterAccountId: account.id,
          reporterProfileId: identity(account, "mentor"),
          reason: payload.values.reason,
          details: payload.values.details || "",
          timestamp: payload.timestamp,
          status: "open",
        });
        state.toast = "Your suspension appeal was sent to moderation.";
        state.directory = createInitialState().directory;
        account.state = state;
        save();
        return response(account);
      }
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
        ...(payload.values.messageId &&
        reportRoom?.messages.some(
          (message) =>
            message.id === payload.values.messageId &&
            message.who === "partner" &&
            message.safetyFlags?.length,
        )
          ? { messageId: payload.values.messageId }
          : {}),
        timestamp: payload.timestamp,
        status: "open",
      });
      state.toast =
        "Report saved for moderator review. This collaborator has not been blocked.";
      state.reportOpen = false;
    } else {
      if (input.form === "profile-form") {
        payload.values = normalizeProfile(payload.values);
        // A mentor profile has one photo; drop a founder-only field.
        if (state.role !== "founder") delete payload.values.personImage;
        for (const field of photoFieldsFor(state.role)) {
          const image = payload.values[field];
          if (
            image &&
            !avatars?.[field] &&
            image !== account.state.profiles[state.role][field]
          )
            fail("Upload your own profile photo using Save profile.", 403);
        }
        for (const key of ["offerTags", "needTags", "topics"]) {
          const selected = tags(payload.values[key]);
          if (selected.some((tag) => !features.vocabulary().includes(tag)))
            fail("Choose approved tags or propose a new tag for review.");
        }
      }
      const chatFlags =
        isMentorRoom(room) && input.form === "chat-form"
          ? safety.check(
              String(input.values?.message || "").slice(0, 3000),
              input.values?.acknowledgeSafety,
            )
          : [];
      const messageCount = room?.messages.length;
      transition(state, payload);
      if (chatFlags.length && room.messages.length > messageCount) {
        const message = room.messages.at(-1);
        message.id = randomUUID();
        message.safetyFlags = chatFlags;
        safety.record(
          account,
          state.role,
          chatFlags,
          `chat:${message.id}`,
          room.id,
        );
      }
      if (input.form === "profile-form" && !state.formErrors) {
        for (const field of photoFieldsFor(state.role)) {
          const avatar = avatars?.[field];
          if (avatar) {
            state.profiles[state.role][field] = `/api/avatars/${avatar.id}`;
            db.files[avatar.id] = {
              ...avatar,
              field,
              purpose: "avatar",
              accountId: account.id,
              role: state.role,
            };
          } else if (payload.values[field] === "")
            state.profiles[state.role][field] = "";
        }
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
        if (input.action === "dispute" && room.milestones[input.id]?.disputed)
          Object.assign(room.milestones[input.id], {
            me: false,
            partner: false,
            resolvedByMe: false,
            resolvedByPartner: false,
          });
        if (input.form === "evidence" && room.milestones[input.id]) {
          const item = room.milestones[input.id];
          // Keep every piece of proof; the latest stays the primary item.
          item.evidenceItems ||= [];
          item.evidenceItems.push({
            label: item.attachment,
            file: uploadedFile || null,
            at: payload.timestamp,
            byAccountId: account.id,
          });
          Object.assign(item, {
            me: false,
            partner: false,
            file: uploadedFile || null,
          });
        }
        if (input.form === "schedule")
          Object.assign(room.milestones.session, { me: false, partner: false });
        if (input.form === "review-form" && room.status === "reviewed")
          room.completedAt = payload.timestamp;
        if (input.action === "launch-room" && room.status === "launched")
          room.launchedAt ||= new Date(now()).toISOString();
        room.progress = roomProgress(room);
        const who = displayName(account, state.role);
        const title = room.milestones[input.id]?.title;
        partnerText =
          input.form === "chat-form"
            ? `${who} sent a message.`
            : input.form === "review-form"
              ? room.status === "reviewed"
                ? `Reviews are in. Read ${who}'s feedback.`
                : `${who} submitted a private review. Yours is still open.`
              : input.action === "lock-terms"
                ? `${who} sent terms for your approval.`
                : input.form === "terms-form"
                  ? `${who} updated the draft terms.`
                  : input.action === "confirm-milestone"
                    ? `${who} confirmed “${title}”. Your confirmation is needed.`
                    : input.form === "evidence"
                      ? `${who} added proof to “${title}”.`
                      : input.action === "dispute"
                        ? `${who} flagged a dispute on “${title}”: ${room.milestones[input.id]?.dispute?.reason || ""}`
                        : input.action === "launch-room"
                          ? `${who} marked the collaboration as ${room.type === "mentorship" ? "complete" : "launched"}. Leave your review within 14 days.`
                          : input.form === "schedule"
                            ? `${who} scheduled a session.`
                            : input.form === "meeting"
                              ? meetingText(
                                  room.meetings.at(-1),
                                  `${who} scheduled a meeting for`,
                                )
                              : input.action === "cancel-meeting"
                                ? meetingText(
                                    room.meetings.find(
                                      (meeting) => meeting.id === input.id,
                                    ),
                                    `${who} cancelled the meeting on`,
                                  )
                                : `${who} updated your collaboration.`;
        if (input.form === "review-form" && room.status === "reviewed") {
          event(
            { state },
            state.role,
            "Reviews are in. Read your collaborator's feedback.",
            room.id,
            { review: true, kind: "review-release", self: false },
          );
        }
      }
    }
    if (room && !state.formErrors && encode(room) !== previousRoom) {
      room.updatedAt = new Date().toISOString();
      mirror(account, state, room, partnerText, {
        tab:
          input.form === "chat-form"
            ? "chat"
            : ["lock-terms", "accept-terms"].includes(input.action) ||
                input.form === "terms-form"
              ? "terms"
              : input.form === "meeting" || input.action === "cancel-meeting"
                ? "schedule"
                : "milestones",
        review: input.form === "review-form" && room.status === "reviewed",
        kind:
          input.form === "review-form" && room.status === "reviewed"
            ? "review-release"
            : ["lock-terms", "confirm-milestone", "dispute"].includes(
                  input.action,
                )
              ? "confirmation"
              : input.action === "launch-room"
                ? "review"
                : undefined,
      });
    }
    if (room && !state.formErrors) simulatePartner(account, state, room);
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
  const brevoSender =
    options.emailProvider === "brevo" && !options.demoMode
      ? createBrevoSender({
          apiKey: options.brevoApiKey,
          from: options.emailFrom,
          publicUrl: options.publicUrl,
          webhookSecret: options.brevoWebhookSecret,
          fetcher: options.emailFetch,
        })
      : null;
  // A notice can be resolved between queueing and delivery, e.g. a mentor
  // accepts the guidelines right after completing the profile.
  const emailResolved = (account, entry) =>
    entry.kind === "guidelines-required" &&
    guidelinesStatus(account.state?.profiles?.mentor, now(), mentorSettings())
      .status === "accepted";
  let maintenance = null;
  async function maintain() {
    refresh();
    let changed = sweepMentorship();
    for (const account of Object.values(db.accounts)) {
      if (account.deletedAt) continue;
      if (sweep(account, false)) changed = true;
      if (brevoSender && !account.demo && features.scheduledEmails(account))
        changed = true;
    }
    if (recordMentoringWeek(db, now())) changed = true;
    if (changed) save();
    await deliver();
  }
  const signInEmail = (entry) => entry.key.includes(":auth-email:");
  // Send what is due now. Safe to run alongside another delivery: each entry
  // is claimed (attempts and availableAt move on) before the provider call.
  async function deliver() {
    if (!brevoSender) return;
    refresh();
    // Claim a bounded batch before awaiting the provider. Each completion
    // resolves against the current database, which may have been changed by
    // an account action while delivery was in flight. Sign-in emails go
    // first: someone is waiting for them.
    const ready = (db.outbox || [])
      .filter(
        (entry) =>
          (entry.key.includes(":mentor-email:") || signInEmail(entry)) &&
          entry.status === "pending" &&
          Date.parse(entry.availableAt) <= now(),
      )
      .sort((a, b) => signInEmail(b) - signInEmail(a))
      .slice(0, 20);
    for (const listed of ready) {
      refresh();
      const entry = db.outbox.find((item) => item.id === listed.id);
      if (
        !entry ||
        entry.status !== "pending" ||
        Date.parse(entry.availableAt) > now()
      )
        continue;
      const account = db.accounts[entry.accountId];
      if (
        signInEmail(entry)
          ? !authEmailWanted(account, entry, now())
          : !emailKindAllowed(account, entry.kind) ||
            emailResolved(account, entry)
      ) {
        entry.status = "skipped";
        save();
        continue;
      }
      const at = now();
      entry.attempts = (entry.attempts || 0) + 1;
      entry.availableAt = new Date(
        at + Math.min(60, 2 ** entry.attempts) * 60000,
      ).toISOString();
      save();
      const result = await brevoSender(structuredClone(entry), {
        id: account.id,
        email: account.email,
      });
      refresh();
      const saved = db.outbox.find((item) => item.id === entry.id);
      if (
        !saved ||
        saved.status !== "pending" ||
        saved.attempts !== entry.attempts
      )
        continue;
      if (result.delivered) {
        saved.status = "sent";
        saved.sentAt = new Date(now()).toISOString();
        saved.providerMessageId = result.messageId;
        delete saved.lastError;
      } else if (result.skipped) saved.status = "skipped";
      else {
        saved.lastError = result.reason;
        if (result.permanent || saved.attempts >= 5) saved.status = "failed";
        logEvent("email_delivery_failed", {
          entryId: saved.id,
          kind: saved.kind,
          status: result.status ?? null,
          attempts: saved.attempts,
          final: saved.status === "failed",
        });
      }
      save();
    }
  }
  // Start delivering a just-queued sign-in email without waiting for the
  // minute timer. The request never waits on, or fails because of, Brevo.
  function deliverSoon() {
    if (brevoSender)
      deliver().catch((error) => logFailure("email_delivery_failed", error));
  }
  // A link email is checked twice around the slow password hash; the same
  // message covers a forged, replaced, used or expired link.
  function linkAccount(token, kind, message) {
    const parsed =
      emailAuth && readAuthLinkToken(token, kind, options.brevoWebhookSecret);
    const account =
      parsed && Object.hasOwn(db.accounts, parsed.accountId)
        ? db.accounts[parsed.accountId]
        : null;
    if (!account || account.deletedAt) fail(message, 410);
    return { account, nonce: parsed.nonce };
  }
  const resetLinkUnavailable =
    "This reset link has expired or was already used.";
  const emailAccount = {
    resendVerification(token) {
      if (!emailAuth) fail("Email verification is unavailable.", 404);
      const account = authenticate(token);
      if (account.demo) fail("Preview accounts don't need verifying.", 409);
      if (!account.emailVerifiedAt) {
        if (!authEmailAllowed(account, "verify-email"))
          fail(
            "We can't deliver email to this address. Contact the workspace moderator.",
            409,
          );
        if (linkRecentlySent(account, "verify-email", now()))
          fail(
            "We sent you a link less than a minute ago. Check your inbox and spam folder.",
            429,
          );
        queueAuthEmail(db, account, "verify-email", now());
        save();
        deliverSoon();
      }
      return response(account);
    },
    // Works signed in or not, e.g. when the link is opened on a phone. An
    // already verified account accepts any of its own links, so a second
    // click (or React's double effect) still succeeds.
    verifyEmail(token) {
      if (!emailAuth) fail("Email verification is unavailable.", 404);
      const { account, nonce } = linkAccount(
        token,
        "verify-email",
        "This verification link isn't valid.",
      );
      if (!account.emailVerifiedAt) {
        if (!liveLink(account, "verify-email", nonce, now()))
          fail(
            "This verification link has expired or is no longer valid.",
            410,
          );
        account.emailVerifiedAt = new Date(now()).toISOString();
        delete account.emailVerification;
        save();
      }
      return { verified: true };
    },
    // The same answer whether or not the address has an account.
    requestPasswordReset(email) {
      if (!emailAuth) fail("Password reset by email is unavailable.", 404);
      const address = String(email ?? "")
        .trim()
        .toLowerCase();
      if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
        fail("Check your email address.", 400, {
          email: "Enter a valid email address.",
        });
      const account = Object.values(db.accounts).find(
        (item) => item.email === address && !item.demo && !item.deletedAt,
      );
      if (
        account &&
        authEmailAllowed(account, "password-reset") &&
        !linkRecentlySent(account, "password-reset", now())
      ) {
        queueAuthEmail(db, account, "password-reset", now());
        save();
        deliverSoon();
      }
      return { ok: true };
    },
    // Sets the new password, signs out every session and opens a new one.
    async resetPasswordAsync(token, password) {
      if (!emailAuth) fail("Password reset by email is unavailable.", 404);
      if (typeof password !== "string" || password.trim().length < 8)
        fail("Choose a new password.", 400, {
          password: "Use at least 8 characters for your password.",
        });
      if (password.length > 1024)
        fail("Choose a new password.", 400, {
          password: "Use a password with at most 1,024 characters.",
        });
      const live = () => {
        const { account, nonce } = linkAccount(
          token,
          "password-reset",
          resetLinkUnavailable,
        );
        if (!liveLink(account, "password-reset", nonce, now()))
          fail(resetLinkUnavailable, 410);
        if (account.suspended)
          fail(
            "This account is unavailable. Contact the workspace moderator.",
            403,
          );
        return { account, nonce };
      };
      const before = live();
      const salt = randomBytes(16).toString("hex");
      const hash = (await promisify(scrypt)(password, salt, 64)).toString(
        "hex",
      );
      // The link may have been used or replaced while hashing.
      const { account, nonce } = live();
      if (account !== before.account || nonce !== before.nonce)
        fail(resetLinkUnavailable, 410);
      account.salt = salt;
      account.passwordHash = hash;
      delete account.passwordReset;
      // Opening the emailed link also proves the address.
      if (!account.emailVerifiedAt) {
        account.emailVerifiedAt = new Date(now()).toISOString();
        delete account.emailVerification;
      }
      for (const [key, session] of sessions)
        if (session.id === account.id) sessions.delete(key);
      save();
      return openSession(account);
    },
  };

  const accounts = accountControls({
    closeMentorship: (...args) => mentorshipRooms.end(...args),
    disconnectMentorship(account, target, reason) {
      const other = target ? db.accounts[target] : null;
      mentorRequests.returned(account, reason, other);
      for (const id of account.state.waitingByRole.founder) {
        if (!id.endsWith(":mentor")) continue;
        const mentor = db.accounts[id.slice(0, -7)];
        if (mentor && (!target || mentor.id === target))
          mentorRequests.returned(mentor, reason, account);
      }
    },
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
    refresh,
    paymentWebhook(body, signature) {
      try {
        const result = payments.webhook(body, signature);
        if (!result.repeated) save();
        return result;
      } catch (error) {
        db = clone(committed);
        throw error;
      }
    },
    close: () => storage.close(),
    accounts,
    features,
    login,
    loginAsync,
    ...emailAccount,
    openDemo,
    async openDemoAsync(role, credentials) {
      // Hash off the event loop first, exactly like loginAsync, then reuse the
      // synchronous rules so tests and the API share one implementation.
      if (!credentials || typeof credentials !== "object")
        return openDemo(role);
      const email = previewEmail(credentials.email);
      const existing = email && findPreview(email);
      const salt = existing?.salt || randomBytes(16).toString("hex");
      const bytes = await promisify(scrypt)(
        String(credentials.password ?? ""),
        salt,
        64,
      );
      return openDemo(role, credentials, {
        salt,
        candidate: bytes,
        expected: existing?.passwordHash,
      });
    },
    act,
    authorizeProfile(token, input, size = 0) {
      const account = authenticate(token);
      requireVerifiedEmail(account);
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
        profilePhotoFields.some(
          (field) =>
            field in input.values && typeof input.values[field] !== "string",
        )
      )
        fail("Submit valid profile fields and a JPEG, PNG or WebP photo.");
      const used = Object.values(db.files)
        .filter((item) => item.accountId === account.id)
        .reduce((sum, item) => sum + item.size, 0);
      if (used + size > (options.accountFileBytes || 50 * 1024 * 1024))
        fail("Your workspace file allowance of 50 MB has been reached.", 413);
    },
    saveProfile(token, input, avatars) {
      this.authorizeProfile(
        token,
        input,
        Object.values(avatars).reduce((sum, photo) => sum + photo.size, 0),
      );
      return act(token, input, undefined, avatars);
    },
    avatarStored(id) {
      const photo = db.files[id];
      return Boolean(
        photo?.purpose === "avatar" &&
        db.accounts[photo.accountId]?.state.profiles[photo.role]?.[
          photo.field || "image"
        ] === `/api/avatars/${id}`,
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
        owner.state.profiles[photo.role]?.[photo.field || "image"] !== image
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
    runMaintenance() {
      maintenance ||= maintain().finally(() => {
        maintenance = null;
      });
      return maintenance;
    },
    emailWebhook(authorization, data) {
      if (
        !brevoSender ||
        !equalSecret(bearerToken(authorization), options.brevoWebhookSecret)
      )
        fail("Webhook authentication required.", 403);
      if (applyEmailWebhook(db, data, now())) save();
      return { ok: true };
    },
    emailUnsubscribe(token, confirm) {
      const parsed =
        brevoSender && parseUnsubscribe(token, options.brevoWebhookSecret);
      if (!parsed) fail("This unsubscribe link is unavailable.", 404);
      const [id, kind] = parsed;
      const account = Object.hasOwn(db.accounts, id) ? db.accounts[id] : null;
      if (!account || account.deletedAt)
        fail("This unsubscribe link is unavailable.", 404);
      if (confirm) {
        account.emailDeliveryStatus ||= {};
        const status = account.emailDeliveryStatus;
        status.unsubscribedKinds ||= [];
        if (!status.unsubscribedKinds.includes(kind)) {
          status.unsubscribedKinds.push(kind);
          save();
        }
      }
      return { kind };
    },
    calendar(token, selected) {
      const account = Object.values(db.accounts).find(
        (candidate) =>
          !candidate.deletedAt && candidate.calendarToken === token,
      );
      if (!account) fail("This calendar link is unavailable.", 404);
      // Each event names the other participant, as the viewer knows them.
      return calendarIcs(
        account.state,
        now(),
        selected,
        (room) => db.accounts[room.partnerAccountId]?.state.accountName,
      );
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
      requireVerifiedEmail(account);
      const room = account.state.rooms[input.activeRoomId];
      const mentoringUpload =
        isMentorRoom(room) &&
        room.role === "founder" &&
        ((input.id === "prep" && mentorFormat(roomFormat(room)).sync) ||
          (input.id === "uploaded" && roomFormat(room) === "doc-review"));
      if (
        !room ||
        room.role !== input.role ||
        (!mentoringUpload && !Object.hasOwn(room.milestones, input.id))
      )
        fail("This milestone is unavailable for your account and role.", 404);
      if (
        (!mentoringUpload && !room.milestones[input.id].evidence) ||
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
