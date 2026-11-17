// Mentor capacity, Pause Mode, conflicts of interest and guidelines (roadmap
// Phase 1). Shared by the server, which enforces these rules, and the client,
// which only displays what the server computed.
import { scheduleInstant } from "./selectors.js";
import { terminalStatuses } from "./collaboration.js";
import { mentorFormat, normalizeOfferedFormats } from "./mentor-formats.js";

// Every tunable mentor number lives here. Later phases read the values they
// need; admins edit them from the Phase 8 admin settings.
export const mentorConfig = {
  // Capacity
  defaultMaxMentees: 3,
  defaultMonthlyHours: 4,
  defaultResponseDays: 3, // allowed values: responseDayOptions
  defaultMaxOpenAsync: 3, // open Quick Asks + Doc Reviews at once
  pendingPerOpenSlot: 2, // pending requests allowed = max(2, slots × this)
  // Requests
  founderMaxPending: 3,
  founderLimitedPending: 1,
  maxReferrals: 3,
  alternativesCount: 3,
  cooldownDays: {
    "not-a-fit": 30,
    "outside-expertise": 30,
    other: 7,
    "no-slots": 0,
  },
  requestContentRetentionDays: 30,
  qualityBonusMax: 5,
  preparedFounderBonus: 3,
  // Sessions
  attendanceAutoConfirmHours: 72,
  asyncAutoCompleteDays: 5,
  revisionWindowDays: 14,
  upgradeProposalDays: 7,
  freeReschedulesPerSide: 1,
  lateNoticeHours: 24,
  bookingMinLeadHours: 1,
  bookingMaxAheadDays: 30,
  followupAfterDays: 14,
  followupRemindDays: [14, 17, 21],
  followupOverdueDays: 21,
  // Ongoing Advisory
  cycleWeeks: 8,
  checkInsPerCycle: 4,
  checkInMinutes: 45,
  // Reviews and impact
  reviewWindowDays: 14,
  minDataPoints: 3,
  // Trust and safety
  noShowLimit: 2,
  noShowWindowDays: 90,
  noShowLimitDays: 30,
  flaggedMessageLimit: 3,
  flaggedMessageWindowDays: 30,
  // Notifications
  digestHour: 8,
  // Badges
  badges: {
    verifiedMentor: { sessions: 3, avgRating: 4.0 },
    topMentor: {
      sessions: 15,
      avgRating: 4.5,
      followThrough: 0.6,
      responseRate: 0.8,
    },
    preparedFounder: { engagements: 2, preparedness: 4.0, followupRate: 0.75 },
  },
  // Onboarding
  approvalTargetBusinessDays: 2,
  guidelinesVersion: 1,
  guidelinesGraceDays: 14,
};

export const responseDayOptions = [1, 2, 3, 5, 7];
export const capacityLimits = {
  maxMentees: [1, 10],
  monthlyHours: [1, 40],
  maxOpenAsync: [1, 10],
};
export const conflictRelations = [
  ["advisor", "Advisor"],
  ["employee", "Employee"],
  ["investor", "Investor"],
  ["founder", "Founder"],
  ["other", "Other"],
];

// Fields every mentor profile carries from Phase 1. New accounts start with
// these; existing accounts are backfilled by backfillMentorProfile.
export function mentorDefaults(config = mentorConfig) {
  return {
    timeZone: "Asia/Manila",
    capacity: {
      maxMentees: config.defaultMaxMentees,
      monthlyHours: config.defaultMonthlyHours,
      responseDays: config.defaultResponseDays,
      maxOpenAsync: config.defaultMaxOpenAsync,
    },
    formats: [{ id: "single-session", price: 0 }],
    topics: "",
    stages: [],
    industries: [],
    paused: false,
    pausedAt: null,
    pausedUntil: null,
    conflicts: [],
    noConflicts: false,
    guidelinesAcceptedAt: null,
    guidelinesVersion: null,
    guidelinesGraceUntil: null,
  };
}

const formatsByPreference = {
  "one-off": ["single-session"],
  ongoing: ["ongoing-advisory"],
  either: ["single-session", "ongoing-advisory"],
};
export const formatsForPreference = (preference) =>
  (formatsByPreference[preference] || ["single-session"]).map((id) => ({
    id,
    price: 0,
  }));

// Brings a pre-Phase 1 mentor profile up to date without losing anything:
// formats come from the old one-off/ongoing preference, topics from the old
// comma expertise text, and the old free-text availability stays in place.
// Returns true when it changed the profile, so running it twice is a no-op.
export function backfillMentorProfile(
  profile,
  { topics = "", graceUntil = null } = {},
) {
  if (!profile || profile.capacity) return false;
  for (const [key, value] of Object.entries(mentorDefaults()))
    if (!(key in profile)) profile[key] = structuredClone(value);
  profile.formats = formatsForPreference(profile.engagementPreference);
  profile.topics = topics;
  profile.guidelinesGraceUntil = graceUntil;
  return true;
}

// Minutes a new engagement of each format needs this month. Ongoing Advisory
// needs the check-ins that fall in the first month of a cycle.
export function minutesNeeded(formatId, config = mentorConfig) {
  if (formatId === "ongoing-advisory")
    return Math.ceil(config.checkInsPerCycle / 2) * config.checkInMinutes;
  return mentorFormat(formatId)?.effortMinutes ?? 60;
}

export function guidelinesStatus(
  profile,
  now = Date.now(),
  config = mentorConfig,
) {
  if (profile?.guidelinesVersion === config.guidelinesVersion)
    return { status: "accepted", graceUntil: null };
  const graceUntil = profile?.guidelinesGraceUntil || null;
  if (graceUntil && now < Date.parse(graceUntil))
    return { status: "grace", graceUntil };
  return { status: "required", graceUntil };
}

export function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return Boolean(value);
  } catch {
    return false;
  }
}

const monthKey = (instant, timeZone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
  }).format(instant);

const roomSchedules = (room) =>
  Object.values(room.milestones || {}).flatMap(
    (item) => item.schedules || (item.schedule ? [item.schedule] : []),
  );

// The single rule for what a mentor has committed and what they can still
// take on (roadmap Phase 1, "What uses capacity"). `state` is the mentor's
// account state; only rooms held in the mentor role count.
export function capacityUsage(state, now = Date.now(), config = mentorConfig) {
  const profile = state.profiles?.mentor || {};
  const capacity = {
    ...mentorDefaults(config).capacity,
    ...(profile.capacity || {}),
  };
  const timeZone = profile.timeZone || "Asia/Manila";
  const offered = normalizeOfferedFormats(profile.formats).map((f) => f.id);
  const rooms = Object.values(state.rooms || {}).filter(
    (room) =>
      room.role === "mentor" &&
      room.type === "mentorship" &&
      !terminalStatuses.includes(room.status),
  );
  const asyncRoom = (room) =>
    mentorFormat(room.terms?.draft?.format)?.sync === false;
  const activeMentees = rooms.filter((room) => !asyncRoom(room)).length;
  const openAsync = rooms.filter(asyncRoom).length;
  const thisMonth = monthKey(now, timeZone);
  let minutesCommitted = 0;
  for (const room of rooms) {
    if (asyncRoom(room)) {
      const accepted = Date.parse(room.createdAt || "") || now;
      if (monthKey(accepted, timeZone) === thisMonth)
        minutesCommitted += mentorFormat(room.terms.draft.format).effortMinutes;
      continue;
    }
    for (const schedule of roomSchedules(room)) {
      const instant = scheduleInstant(schedule);
      if (Number.isNaN(instant.getTime())) continue;
      if (monthKey(instant, timeZone) === thisMonth)
        minutesCommitted += Number(schedule.durationMinutes) || 60;
    }
  }
  const minutesLeft = Math.max(
    0,
    capacity.monthlyHours * 60 - minutesCommitted,
  );
  const guidelines = guidelinesStatus(profile, now, config);
  const formatReason = (id) => {
    if (minutesLeft < minutesNeeded(id, config)) return "hours-limit";
    if (mentorFormat(id).sync)
      return activeMentees < capacity.maxMentees ? null : "mentee-limit";
    return openAsync < capacity.maxOpenAsync ? null : "async-limit";
  };
  const reasons = Object.fromEntries(
    offered.map((id) => [id, formatReason(id)]),
  );
  let availableFormats = offered.filter((id) => !reasons[id]);
  let reason = null;
  if (profile.paused) reason = "paused";
  else if (guidelines.status === "required") reason = "guidelines";
  if (reason) availableFormats = [];
  else if (!availableFormats.length) {
    const blocked = Object.values(reasons);
    reason =
      !blocked.length || blocked.every((item) => item === "hours-limit")
        ? "hours-limit"
        : blocked.includes("mentee-limit")
          ? "mentee-limit"
          : "async-limit";
  }
  const offersSync = offered.some((id) => mentorFormat(id).sync);
  const offersAsync = offered.some((id) => !mentorFormat(id).sync);
  return {
    capacity,
    timeZone,
    activeMentees,
    openAsync,
    pendingRequests: state.incomingByRole?.mentor?.size || 0,
    minutesCommitted,
    hoursLeft: Math.round((minutesLeft / 60) * 10) / 10,
    openSlots:
      (offersSync ? Math.max(0, capacity.maxMentees - activeMentees) : 0) +
      (offersAsync ? Math.max(0, capacity.maxOpenAsync - openAsync) : 0),
    offeredFormats: offered,
    formatReasons: reasons,
    availableFormats,
    available: availableFormats.length > 0,
    reason,
    guidelines,
    paused: Boolean(profile.paused),
    pausedUntil: profile.pausedUntil || null,
  };
}

// Matching factor: available now, has hours but no free slot type, or cannot
// take anything (paused, guidelines or out of hours).
export function availabilityFit(usage) {
  if (usage.available) return 1;
  if (["mentee-limit", "async-limit"].includes(usage.reason)) return 0.5;
  return 0;
}

// Founders state no format preference until Phase 2, so every founder counts
// as "any": a mentor with at least one available format fits fully.
export function formatFit(usage) {
  return usage.availableFormats.length ? 1 : 0;
}

// The structured line that replaces free-text availability on profiles and
// match cards, e.g. "Usually replies within 3 days · 2 slots open".
export function availabilityLine(usage) {
  if (usage.paused) return "Not taking requests";
  if (usage.reason === "guidelines") return "Not taking requests yet";
  const days = usage.capacity.responseDays;
  const replies = `Usually replies within ${days} ${days === 1 ? "day" : "days"}`;
  if (!usage.available) return `${replies} · No slots open right now`;
  return `${replies} · ${usage.openSlots} ${usage.openSlots === 1 ? "slot" : "slots"} open`;
}

const founderReasonText = {
  paused: (name) => `${name} is not taking requests right now.`,
  guidelines: (name) =>
    `${name} can take requests once they accept the mentor guidelines.`,
  "mentee-limit": (name) => `${name} has no mentee slots open right now.`,
  "async-limit": (name) =>
    `${name} has no room for more quick asks or reviews right now.`,
  "hours-limit": (name) =>
    `${name} has used their mentoring hours for this month.`,
};
export const unavailableText = (reason, name = "This mentor") =>
  founderReasonText[reason]?.(name) || "";

const mentorReasonText = {
  paused: "Pause Mode is on, so founders can't send you requests.",
  guidelines: "Accept the mentor guidelines to start receiving requests.",
  "mentee-limit":
    "All your mentee slots are in use. New session requests resume when a slot opens or you raise your limit.",
  "async-limit":
    "All your quick ask and review slots are in use. New ones resume when one is answered.",
  "hours-limit":
    "You've used your mentoring hours for this month. Raise your hours to take on more.",
};
export const ownUnavailableText = (reason) => mentorReasonText[reason] || "";

// Company names compare without case, punctuation or a legal suffix.
export function normalizeCompany(name) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(
      /\b(inc|incorporated|corp|corporation|ltd|limited|llc|co|opc)\b/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// "block" hides the pair from each other in every direction; "warn" keeps
// them matched and tells the mentor. `ownStartup` is the mentor account's own
// founder startup, which is always a conflict for users with both roles.
export function conflictWith(
  mentorProfile,
  founderProfile,
  { ownStartup = "", sameAccount = false } = {},
) {
  if (sameAccount) return { level: "block" };
  const conflicts = [
    ...(mentorProfile?.conflicts || []),
    ...(ownStartup ? [{ company: ownStartup, relation: "founder" }] : []),
  ];
  const company = normalizeCompany(founderProfile?.startupName);
  if (
    company &&
    conflicts.some((item) => normalizeCompany(item.company) === company)
  )
    return { level: "block" };
  const industry = String(founderProfile?.industry || "")
    .trim()
    .toLowerCase();
  const related = conflicts.find(
    (item) =>
      industry &&
      ["employee", "investor", "founder"].includes(item.relation) &&
      String(item.industry || "")
        .trim()
        .toLowerCase() === industry,
  );
  if (!related) return null;
  const tie = {
    employee: "that you work for",
    investor: "that you invested in",
    founder: "that you founded",
  }[related.relation];
  return {
    level: "warn",
    text: `Possible conflict: you disclosed ${related.company}, a ${founderProfile.industry} company ${tie}.`,
  };
}
