import { isMentorRoom, mentorSessions, roomFormat } from "./mentor-room.js";
// Mentor capacity, Pause Mode, conflicts of interest and guidelines (roadmap
// Phase 1). Shared by the server, which enforces these rules, and the client,
// which only displays what the server computed.
import { scheduleInstant } from "./selectors.js";
import { formatDate, formatMonth } from "./dates.js";
import { terminalStatuses } from "./collaboration.js";
import {
  advisoryCycle,
  mentorFormat,
  mentorFormatIds,
  normalizeOfferedFormats,
} from "./mentor-formats.js";

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
  cycleWeeks: advisoryCycle.weeks,
  checkInsPerCycle: advisoryCycle.checkIns,
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
  rapidReviewSeconds: 10,
  rapidReviewCount: 2,
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
  guidelinesVersion: 2,
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
    officeHours: [],
    preferredHours: null,
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

export const mentorMonthKey = (instant, timeZone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
  }).format(instant);

const roomSchedules = (room) =>
  Object.values(room.milestones || {}).flatMap(
    (item) => item.schedules || (item.schedule ? [item.schedule] : []),
  );

export function cyclePlan(
  start,
  config = mentorConfig,
  count = config.checkInsPerCycle,
  minutes = config.checkInMinutes,
  end = start + config.cycleWeeks * 7 * 86400000,
) {
  const interval = (end - start) / count;
  return Array.from({ length: count }, (_, index) => ({
    instant: start + index * interval,
    minutes,
  }));
}

export function mentorCommitments(
  state,
  now = Date.now(),
  config = mentorConfig,
  exclude = {},
) {
  const timeZone = state.profiles.mentor?.timeZone || "Asia/Manila";
  const months = {};
  const add = (instant, minutes) => {
    if (!Number.isFinite(instant)) return;
    const month = mentorMonthKey(instant, timeZone);
    months[month] = (months[month] || 0) + minutes;
  };
  for (const room of Object.values(state.rooms || {})) {
    if (room.role !== "mentor" || room.type !== "mentorship") continue;
    const active = !terminalStatuses.includes(room.status);
    const format = mentorFormat(room.terms?.draft?.format);
    if (format?.sync === false && (active || room.mentorship?.deliveredAt))
      add(
        Date.parse(room.mentorship?.acceptedAt || room.createdAt) || now,
        format.effortMinutes,
      );
    if (!isMentorRoom(room) && !active) continue;
    if (
      isMentorRoom(room) &&
      roomFormat(room) === "ongoing-advisory" &&
      active &&
      room.cycle &&
      !room.cycle.confirmedAt &&
      room.cycle.phase === "active" &&
      exclude.reservationRoomId !== room.id
    ) {
      for (const { instant, minutes } of cyclePlan(
        Date.parse(room.cycle.startsAt),
        config,
        room.cycle.checkIns,
        room.cycle.checkInMinutes,
        Date.parse(room.cycle.dueAt),
      ))
        add(instant, minutes);
    }
    const sessions = [
      ...roomSchedules(room),
      ...(room.mentorship?.sessionHistory || []),
    ];
    for (const schedule of sessions) {
      if (
        schedule === exclude.schedule ||
        (exclude.roomId === room.id &&
          (!exclude.scheduleId || schedule.id === exclude.scheduleId))
      )
        continue;
      if (
        schedule.cancelledAt ||
        (!active && isMentorRoom(room) && !schedule.outcome)
      )
        continue;
      add(
        scheduleInstant(schedule).getTime(),
        Number(schedule.durationMinutes) || 60,
      );
    }
  }
  return months;
}

export function mentorMinutesFit(
  state,
  proposed,
  config = mentorConfig,
  commitments = mentorCommitments(state, Date.now(), config),
) {
  const timeZone = state.profiles.mentor?.timeZone || "Asia/Manila";
  const limit =
    (state.profiles.mentor?.capacity?.monthlyHours ||
      config.defaultMonthlyHours) * 60;
  const added = {};
  for (const { instant, minutes } of proposed) {
    const month = mentorMonthKey(instant, timeZone);
    added[month] = (added[month] || 0) + minutes;
    if ((commitments[month] || 0) + added[month] > limit) return false;
  }
  return true;
}

// The single rule for what a mentor has committed and what they can still
// take on (roadmap Phase 1, "What uses capacity"). `state` is the mentor's
// account state; only rooms held in the mentor role count.
export function capacityUsage(
  state,
  now = Date.now(),
  config = mentorConfig,
  allocated,
) {
  const profile = state.profiles?.mentor || {};
  const capacity = {
    ...mentorDefaults(config).capacity,
    ...(profile.capacity || {}),
  };
  const timeZone = profile.timeZone || "Asia/Manila";
  const offered = normalizeOfferedFormats(profile.formats).map((f) => f.id);
  const rooms = Object.values(state.rooms || {}).filter(
    (room) => room.role === "mentor" && room.type === "mentorship",
  );
  const active = rooms.filter(
    (room) => !terminalStatuses.includes(room.status),
  );
  const asyncRoom = (room) =>
    mentorFormat(room.terms?.draft?.format)?.sync === false;
  const openAsync = active.filter(
    (room) =>
      asyncRoom(room) &&
      !room.mentorship?.deliveredAt &&
      !room.mentorship?.answerExpiredAt,
  ).length;
  const activeMentees = active.filter(
    (room) =>
      !asyncRoom(room) &&
      !(
        isMentorRoom(room) &&
        roomFormat(room) !== "ongoing-advisory" &&
        (room.mentorship.slotReleased ||
          mentorSessions(room).some(
            (session) => session.outcome && session.outcome !== "disputed",
          ))
      ),
  ).length;
  const thisMonth = mentorMonthKey(now, timeZone);
  const commitments = mentorCommitments(state, now, config);
  const minutesCommitted = commitments[thisMonth] || 0;
  // `allocated` adds the minutes held by open, unbooked Office Hours slots.
  // The server enforces against it, so the mentor sees the same total.
  const availabilityCommitments = allocated || commitments;
  const minutesUsed = Math.max(
    minutesCommitted,
    availabilityCommitments[thisMonth] || 0,
  );
  const minutesLeft = Math.max(0, capacity.monthlyHours * 60 - minutesUsed);
  const guidelines = guidelinesStatus(profile, now, config);
  const formatReason = (id) => {
    if (id === "ongoing-advisory") {
      if (
        !mentorMinutesFit(
          state,
          cyclePlan(now, config),
          config,
          availabilityCommitments,
        )
      )
        return "hours-limit";
    } else if (id !== "office-hours" && minutesLeft < minutesNeeded(id, config))
      return "hours-limit";
    if (mentorFormat(id).sync)
      return activeMentees < capacity.maxMentees ? null : "mentee-limit";
    return openAsync < capacity.maxOpenAsync ? null : "async-limit";
  };
  const reasons = Object.fromEntries(
    offered.map((id) => [id, formatReason(id)]),
  );
  const fitReasons = Object.fromEntries(
    mentorFormatIds.map((id) => [id, formatReason(id)]),
  );
  // (Nov 22, round 2) The month an hours limit bites, from the same numbers
  // as the reason, so founders and the mentor name the same month.
  const reasonMonths = Object.fromEntries(
    mentorFormatIds
      .filter((id) => fitReasons[id] === "hours-limit")
      .map((id) => [
        id,
        hoursLimitMonth(state, id, now, config, availabilityCommitments) ||
          thisMonth,
      ]),
  );
  const openSlots =
    (offered.some((id) => mentorFormat(id).sync)
      ? Math.max(0, capacity.maxMentees - activeMentees)
      : 0) +
    (offered.some((id) => !mentorFormat(id).sync)
      ? Math.max(0, capacity.maxOpenAsync - openAsync)
      : 0);
  const pendingRequests = state.incomingByRole?.mentor?.size || 0;
  const pendingLimit = Math.max(2, openSlots * config.pendingPerOpenSlot);
  const bookableFormats = offered.filter((id) => !reasons[id]);
  let availableFormats = bookableFormats;
  let reason = null;
  if (Date.parse(state.mentorshipLimits?.mentor || "") > now)
    reason = "no-show-limit";
  else if (profile.paused) reason = "paused";
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
  if (!reason && pendingRequests >= pendingLimit) {
    reason = "inbox-full";
    availableFormats = [];
  }
  return {
    capacity,
    timeZone,
    activeMentees,
    openAsync,
    pendingRequests,
    pendingLimit,
    bookableFormats,
    minutesCommitted,
    minutesReserved: minutesUsed - minutesCommitted,
    minutesUsed,
    month: thisMonth,
    cycleWeeks: config.cycleWeeks,
    hoursLeft: Math.round((minutesLeft / 60) * 10) / 10,
    openSlots,
    openMenteeSlots: Math.max(0, capacity.maxMentees - activeMentees),
    openAsyncSlots: Math.max(0, capacity.maxOpenAsync - openAsync),
    offeredFormats: offered,
    formatReasons: reasons,
    fitReasons,
    reasonMonths,
    reasonMonth:
      reason === "hours-limit"
        ? offered
            .map((id) => reasonMonths[id])
            .filter(Boolean)
            .sort()[0] || thisMonth
        : null,
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

const plural = (count, one, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

// What a founder can actually ask for, named by slot type, e.g.
// "2 session slots · 2 quick-ask slots open". Mentee slots and async slots
// are never added together, because they hold different formats.
export function openSlotsText(usage) {
  const available = usage.availableFormats || [];
  const parts = [];
  if (available.some((id) => mentorFormat(id)?.sync))
    parts.push(plural(usage.openMenteeSlots ?? 0, "session slot"));
  const async = available.filter((id) => mentorFormat(id)?.sync === false);
  if (async.length)
    parts.push(
      plural(
        usage.openAsyncSlots ?? 0,
        async.length > 1
          ? "quick-ask or review slot"
          : async[0] === "doc-review"
            ? "review slot"
            : "quick-ask slot",
      ),
    );
  return parts.length ? `${parts.join(" · ")} open` : "";
}

// The structured line that replaces free-text availability on profiles and
// match cards, e.g. "Usually replies within 3 days · 2 session slots open".
// The mentor's Home shows the same line as "what founders see".
export function availabilityLine(usage) {
  if (usage.paused) return "Not taking requests";
  if (usage.reason === "guidelines") return "Not taking requests yet";
  const days = usage.capacity.responseDays;
  const replies = `Usually replies within ${plural(days, "day")}`;
  const open = usage.available && openSlotsText(usage);
  return open
    ? `${replies} · ${open}`
    : `${replies} · Not taking new requests right now`;
}

// Short reasons for the mentor's own "Closed to founders right now" line.
const closedReasonText = {
  paused: "Pause Mode is on",
  guidelines: "guidelines not accepted",
  "approval-required": "waiting for approval",
  suspended: "profile suspended",
  "no-show-limit": "attendance limit",
  "inbox-full": "too many requests waiting for a reply",
  "mentee-limit": "all session slots in use",
  "async-limit": "all quick-ask and review slots in use",
  "no-office-hours": "no open slots",
};
const accountWide = [
  "paused",
  "guidelines",
  "approval-required",
  "suspended",
  "no-show-limit",
  "inbox-full",
];

// Offered formats founders can't request now, each with its reason.
export function closedFormats(usage) {
  if (!usage) return [];
  const open = new Set(usage.availableFormats || []);
  return (usage.offeredFormats || [])
    .filter((id) => !open.has(id))
    .map((id) => {
      const reason = accountWide.includes(usage.reason)
        ? usage.reason
        : usage.formatReasons?.[id] || usage.reason;
      const month =
        reason === "hours-limit"
          ? usage.reasonMonths?.[id] || usage.month
          : null;
      const when = month ? formatMonth(month) : "this month";
      return {
        id,
        label: mentorFormat(id)?.label || id,
        reason,
        month,
        text:
          reason !== "hours-limit"
            ? closedReasonText[reason] || "unavailable"
            : id === "ongoing-advisory"
              ? `not enough hours in ${when} for a new ${usage.cycleWeeks || advisoryCycle.weeks}-week cycle`
              : `not enough hours left in ${when}`,
      };
    });
}

// "Closed to founders right now: Ongoing Advisory (not enough hours …)".
export function closedFormatsLine(usage) {
  const groups = new Map();
  for (const item of closedFormats(usage))
    groups.set(item.text, [...(groups.get(item.text) || []), item.label]);
  if (!groups.size) return "";
  return `Closed to founders right now: ${[...groups]
    .map(([text, labels]) => `${labels.join(", ")} (${text})`)
    .join("; ")}.`;
}

// The first month in which a format no longer fits the mentor's hours. Ongoing
// Advisory needs a new cycle's check-ins across several months; the other
// formats need minutes in the current month.
export function hoursLimitMonth(
  state,
  formatId,
  now = Date.now(),
  config = mentorConfig,
  allocated = mentorCommitments(state, now, config),
) {
  const timeZone = state.profiles.mentor?.timeZone || "Asia/Manila";
  const limit =
    (state.profiles.mentor?.capacity?.monthlyHours ||
      config.defaultMonthlyHours) * 60;
  const proposed =
    formatId === "ongoing-advisory"
      ? cyclePlan(now, config)
      : [{ instant: now, minutes: minutesNeeded(formatId, config) }];
  const added = {};
  for (const { instant, minutes } of proposed) {
    const month = mentorMonthKey(instant, timeZone);
    added[month] = (added[month] || 0) + minutes;
    if ((allocated[month] || 0) + added[month] > limit) return month;
  }
  return null;
}

// Human labels and messages for capacity fields, shared by the application
// and Settings so an error names the field and its range.
export const capacityFieldLabels = {
  maxMentees: "Mentees at once",
  monthlyHours: "Hours per month",
  maxOpenAsync: "Open quick asks and reviews",
  responseDays: "Reply time",
  timeZone: "Time zone",
  formats: "Formats you offer",
};
export function capacityErrors(values) {
  const errors = {};
  const capacity = {};
  for (const [key, [min, max]] of Object.entries(capacityLimits)) {
    const value = Number(values[key]);
    if (
      values[key] === "" ||
      values[key] == null ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    )
      errors[key] = `${capacityFieldLabels[key]}: choose ${min} to ${max}.`;
    capacity[key] = value;
  }
  capacity.responseDays = Number(values.responseDays);
  if (!responseDayOptions.includes(capacity.responseDays))
    errors.responseDays = `${capacityFieldLabels.responseDays}: choose 1, 2, 3, 5 or 7 days.`;
  if (!validTimeZone(values.timeZone))
    errors.timeZone = `${capacityFieldLabels.timeZone}: choose a time zone from the list.`;
  return { errors, capacity };
}
// One sentence for the whole form: the single problem, or the fields to check.
export function capacityErrorMessage(errors) {
  const messages = Object.values(errors);
  if (messages.length === 1) return messages[0];
  const labels = Object.keys(errors)
    .map((key) => capacityFieldLabels[key])
    .filter(Boolean);
  return labels.length
    ? `Check ${labels.join(", ")}.`
    : "Check your mentoring settings.";
}

// Every IANA zone the runtime knows, plus the current and device zones, so
// the application and Settings offer the same list.
const fallbackZones = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];
export function timeZoneOptions(current) {
  let zones = fallbackZones;
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    /* Older browsers list the common zones only. */
  }
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [...new Set([current, device, ...zones].filter(Boolean))]
    .sort()
    .map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }));
}

// "1.75 h", "6 h"
export const formatHours = (minutes) =>
  `${Number((Number(minutes || 0) / 60).toFixed(2))} h`;

// "Ongoing Advisory and Office Hours"
export const formatList = (labels) =>
  labels.length < 2
    ? labels.join("")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;

// Founder-facing reasons. (Nov 22, round 2) An hours limit names the month
// whose hours are booked, the same month as the mentor's own "Closed to
// founders right now" line, and slots are named "session slots" or
// "quick-ask or review slots" everywhere.
const firstName = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)[0] || "";
const possessive = (name) => (name ? `${name}'s` : "This mentor's");
// "Maya's December hours are already booked"
export function hoursBookedText(name, month) {
  const who = possessive(firstName(name));
  return month
    ? `${who} ${formatMonth(month)} hours are already booked`
    : `${who} hours for this month are already booked`;
}
const founderReasonText = {
  "format-unavailable": (name) => `${name} does not offer this format.`,
  "no-office-hours": (name) => `${name} has no open Office Hours slots.`,
  "no-show-limit": (name) => `${name} is temporarily unable to take requests.`,
  "inbox-full": (name) =>
    `${name} has several requests waiting. Try again in a few days, or ask another mentor.`,
  paused: (name) => `${name} is not taking requests right now.`,
  guidelines: (name) =>
    `${name} can take requests once they accept the mentor guidelines.`,
  "mentee-limit": (name) => `${name} has no session slots open right now.`,
  "async-limit": (name) =>
    `${name} has no quick-ask or review slots open right now.`,
  "hours-limit": (name, month) =>
    `${name} isn't taking new requests right now: ${hoursBookedText(name, month)}.`,
};
// Why one format is closed, as the clause after "isn't open right now:".
const founderFormatClause = {
  "hours-limit": (name, month) => hoursBookedText(name, month),
  "mentee-limit": (name) => `${name} has no session slots open`,
  "async-limit": (name) => `${name} has no quick-ask or review slots open`,
};
// `format` and `month` make the sentence about one format, e.g. "Ongoing
// Advisory isn't open right now: Maya's December hours are already booked."
export function unavailableText(
  reason,
  name = "This mentor",
  { format, month } = {},
) {
  const clause = format && founderFormatClause[reason]?.(name, month);
  if (clause)
    return `${mentorFormat(format)?.label || "This format"} isn't open right now: ${clause}.`;
  return founderReasonText[reason]?.(name, month) || "";
}

// A decline cooldown keeps a founder from asking that mentor again until its
// end date. Every list that could offer the mentor to that founder checks it,
// and Match details shows this line instead of the request form (Nov 22,
// round 3): "You can ask again after Dec 22".
export const cooldownActive = (until, now = Date.now()) =>
  Date.parse(until || "") > now;
export const cooldownText = (until, { now = Date.now(), timeZone } = {}) =>
  `You can ask again after ${formatDate(until, { now, timeZone })}`;

// One sentence-case label per mentorship request status, for every place a
// request's status is shown (Nov 22, round 2).
export const requestStatusLabels = {
  pending: "Waiting for a reply",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  returned: "Returned",
  referred: "Mentor suggested others",
  withdrawn: "Withdrawn",
};
export const requestStatusLabel = (status) =>
  requestStatusLabels[status] ||
  String(status || "")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

// Short founder-facing reasons for one unavailable format, e.g. on the
// mentor's format list: "Ongoing Advisory · Unavailable: Maya's December
// hours are already booked".
const formatReasonText = {
  "format-unavailable": "not offered",
  "no-office-hours": "no open times",
  "no-show-limit": "not taking requests right now",
  "inbox-full": "requests are full",
  paused: "not taking requests right now",
  guidelines: "not taking requests yet",
  "approval-required": "not taking requests yet",
  suspended: "not taking requests",
  "mentee-limit": "no session slots open",
  "async-limit": "no quick-ask or review slots open",
};
export const formatUnavailableText = (reason, { name, month } = {}) =>
  reason === "hours-limit"
    ? hoursBookedText(name, month)
    : formatReasonText[reason] || "not available right now";

const mentorReasonText = {
  "format-unavailable":
    "Enable Single Session in Mentoring settings to invite a founder.",
  "no-show-limit":
    "An attendance limit pauses new requests. Check Updates for the details.",
  suspended: "Your mentor profile is suspended.",
  "approval-required": "Complete mentor approval to start receiving requests.",
  "inbox-full": "Reply to pending requests to make space for new ones.",
  paused: "Pause Mode is on, so founders can't send you requests.",
  guidelines: "Accept the mentor guidelines to start receiving requests.",
  "mentee-limit":
    "All your session slots are in use. New session requests resume when a slot opens or you raise your limit.",
  "async-limit":
    "All your quick ask and review slots are in use. New ones resume when one is answered.",
  "hours-limit":
    "You've used your mentoring hours for this month. Raise your hours to take on more.",
  "no-office-hours":
    "Office Hours is your only open format, and no slot is open. Open a slot in Calendar.",
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

// The live capacity sentence under the steppers. Over a limit it explains
// what happens instead of reporting an impossible "2 of 1".
export function capacityUsageText(usage, capacity = usage.capacity) {
  const used = usage.minutesUsed ?? usage.minutesCommitted;
  const reserved = usage.minutesReserved
    ? `, ${formatHours(usage.minutesReserved)} of it reserved by open Office Hours`
    : "";
  const lines = [];
  if (usage.activeMentees > capacity.maxMentees)
    lines.push(
      `You have ${usage.activeMentees} active mentees and a limit of ${capacity.maxMentees}. New requests for sessions resume when you're under the limit.`,
    );
  if (usage.openAsync > capacity.maxOpenAsync)
    lines.push(
      `You have ${usage.openAsync} open quick asks and reviews and a limit of ${capacity.maxOpenAsync}. New quick asks and reviews resume when you're under the limit.`,
    );
  if (used > capacity.monthlyHours * 60)
    lines.push(
      `This month needs ${formatHours(used)} and your limit is ${capacity.monthlyHours} h${reserved}. New requests that need hours resume next month, or when you close slots or raise your hours.`,
    );
  if (lines.length) return lines.join(" ");
  return `You're using ${usage.activeMentees} of ${capacity.maxMentees} session slots and ${Number((used / 60).toFixed(2))} of ${capacity.monthlyHours} hours this month${reserved}.`;
}
