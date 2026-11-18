import { randomUUID } from "node:crypto";
import {
  mentorConfig,
  capacityLimits,
  responseDayOptions,
} from "../src/data/mentor-rules.js";
import {
  dayMs,
  isMentorRoom,
  mentorSessions,
} from "../src/data/mentor-room.js";

const details = {
  defaultMaxMentees: capacityLimits.maxMentees,
  defaultMonthlyHours: capacityLimits.monthlyHours,
  defaultMaxOpenAsync: capacityLimits.maxOpenAsync,
  defaultResponseDays: responseDayOptions,
  maxReferrals: [1, 5],
  alternativesCount: [1, 10],
  qualityBonusMax: [0, 5],
  preparedFounderBonus: [0, 10],
  freeReschedulesPerSide: [0, 3],
  checkInMinutes: [15, 30, 45, 60],
  checkInsPerCycle: [1, 12],
  cycleWeeks: [1, 26],
  digestHour: [0, 23],
  guidelinesVersion: [2, 999],
  lateNoticeHours: [0, 168],
  bookingMinLeadHours: [0, 168],
  bookingMaxAheadDays: [1, 90],
};
const minValue = (path) => (path.includes("cooldownDays.") ? 0 : 1);
const percentKeys = new Set(["followThrough", "responseRate", "followupRate"]);
const ratingKeys = new Set(["avgRating", "preparedness"]);
export function mentorSettingEntries(config, prefix = "") {
  return Object.entries(config).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? mentorSettingEntries(value, path)
      : [{ path, value }];
  });
}

export function updatedMentorConfig(config, path, input) {
  if (typeof path !== "string") throw new Error("Choose a mentoring setting.");
  const prior = mentorSettingEntries(mentorConfig).find(
    (entry) => entry.path === path,
  );
  if (!prior) throw new Error("Choose a mentoring setting.");
  const leaf = path.split(".").at(-1);
  let value;
  if (Array.isArray(prior.value)) {
    const values =
      typeof input === "string"
        ? input.split(",").map((item) => item.trim())
        : input;
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 10 ||
      values.some((item) => item === "" || item === null)
    )
      throw new Error("Use a comma-separated list of reminder days.");
    value = values.map(Number);
    if (
      value.some(
        (item, index) =>
          !Number.isInteger(item) ||
          item < 1 ||
          item > 365 ||
          (index > 0 && item <= value[index - 1]),
      )
    )
      throw new Error(
        "Reminder days must be distinct and in increasing order.",
      );
  } else {
    if (
      (typeof input !== "number" && typeof input !== "string") ||
      String(input).trim() === ""
    )
      throw new Error("Enter a numeric setting.");
    value = Number(input);
    if (percentKeys.has(leaf)) {
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new Error("Enter a rate between 0 and 1.");
    } else if (ratingKeys.has(leaf)) {
      if (!Number.isFinite(value) || value < 1 || value > 5)
        throw new Error("Enter a rating between 1 and 5.");
    } else {
      const allowed = details[path] || [minValue(path), 365];
      const exact = ["defaultResponseDays", "checkInMinutes"].includes(path);
      if (
        !Number.isInteger(value) ||
        (exact
          ? !allowed.includes(value)
          : value < allowed[0] || value > allowed[1])
      )
        throw new Error(
          exact
            ? `Use one of ${allowed.join(", ")}.`
            : `Enter a whole number between ${allowed[0]} and ${allowed[1]}.`,
        );
    }
  }
  const next = structuredClone(config);
  const keys = path.split(".");
  const parent = keys.slice(0, -1).reduce((item, key) => item[key], next);
  const before = parent[leaf];
  parent[leaf] = value;
  if (next.founderLimitedPending > next.founderMaxPending)
    throw new Error(
      "The limited request count must fit the standard founder limit.",
    );
  if (next.followupAfterDays > next.followupOverdueDays)
    throw new Error("Follow-up must open before it becomes overdue.");
  if (next.bookingMinLeadHours >= next.bookingMaxAheadDays * 24)
    throw new Error(
      "Booking lead time must fit inside the advance booking window.",
    );
  return { next, before, value };
}

const eligible = (accounts) =>
  Object.values(accounts).filter(
    (account) => !account.demo && !account.deletedAt,
  );
const responseStates = new Set(["accepted", "declined", "referred"]);
const metric = (label, numerator, denominator, threshold) => {
  const value =
    denominator === null
      ? numerator
      : denominator
        ? numerator / denominator
        : null;
  return {
    label,
    numerator,
    denominator,
    value,
    threshold,
    met: value !== null && value >= threshold,
  };
};

export function mentorshipMetrics(accounts, now = Date.now()) {
  const users = eligible(accounts);
  const mentorAccounts = users.filter(
    (account) => account.state.profiles.mentor.mentorApprovedAt,
  );
  const mentorRequests = (account) =>
    account.state.mentorRequestsByRole?.mentor || [];
  const approvedActive = mentorAccounts.filter((account) =>
    mentorRequests(account).some(
      (entry) =>
        entry.status === "accepted" && Date.parse(entry.at) >= now - 30 * dayMs,
    ),
  );
  const retentionPool = mentorAccounts.filter(
    (account) =>
      now >=
      Date.parse(account.state.profiles.mentor.mentorApprovedAt) + 60 * dayMs,
  );
  const retained = retentionPool.filter((account) => {
    const threshold =
      Date.parse(account.state.profiles.mentor.mentorApprovedAt) + 60 * dayMs;
    return (
      mentorRequests(account).some(
        (entry) =>
          responseStates.has(entry.status) && Date.parse(entry.at) >= threshold,
      ) ||
      Object.values(account.state.rooms).some(
        (room) =>
          isMentorRoom(room) &&
          room.role === "mentor" &&
          Math.max(
            Date.parse(room.updatedAt) || 0,
            Date.parse(room.mentorship.deliveredAt) || 0,
          ) >= threshold,
      )
    );
  });
  const requests = mentorAccounts.flatMap(mentorRequests);
  const answered = requests.filter((entry) =>
    responseStates.has(entry.status),
  ).length;
  const requestsConsidered =
    answered +
    requests.filter((entry) => entry.status === "expired").length +
    mentorAccounts.reduce(
      (sum, account) => sum + account.state.incomingByRole.mentor.size,
      0,
    );
  const mentorRooms = users.flatMap((account) =>
    Object.values(account.state.rooms).filter(
      (room) => isMentorRoom(room) && room.role === "mentor",
    ),
  );
  const outcomes = mentorRooms
    .flatMap((room) => {
      const sessions = [
        ...mentorSessions(room),
        ...(room.mentorship.sessionHistory || []),
      ];
      return [
        ...new Map(
          sessions.map((session, index) => [session.id || index, session]),
        ).values(),
      ];
    })
    .filter((session) => session.outcome);
  const heldWithoutDispute = outcomes.filter(
    (session) => session.outcome === "held" && !session.disputedAt,
  ).length;
  const followup = mentorRooms
    .flatMap((room) => [
      room.mentorship.followup,
      ...(room.mentorship.history || []).map((entry) => entry.followup),
    ])
    .filter(
      (entry) =>
        entry &&
        (entry.submittedAt ||
          entry.overdue ||
          now >= Date.parse(entry.availableAt)),
    );
  const survey = mentorAccounts.filter(
    (account) => typeof account.mentorshipSurvey?.wouldCharge === "boolean",
  );
  return [
    metric(
      "Approved mentors who accepted a request in the last 30 days",
      approvedActive.length,
      null,
      20,
    ),
    metric(
      "Mentor 60-day retention",
      retained.length,
      retentionPool.length,
      0.5,
    ),
    metric("Request response rate", answered, requestsConsidered, 0.7),
    metric(
      "Sessions held without dispute",
      heldWithoutDispute,
      outcomes.length,
      0.9,
    ),
    metric(
      "Founder follow-up submission rate",
      followup.filter((entry) => entry.submittedAt).length,
      followup.length,
      0.5,
    ),
    metric(
      "Surveyed mentors who would charge for a format",
      survey.filter((account) => account.mentorshipSurvey.wouldCharge).length,
      survey.length,
      0.3,
    ),
  ];
}

export function mentoringGate(db, now) {
  const current = mentorshipMetrics(db.accounts, now);
  const history = db.mentorGate?.weeks || [];
  let consecutiveWeeks = 0;
  const period = 7 * dayMs;
  let prior = null;
  for (const entry of [...history].reverse()) {
    if (
      !entry.met ||
      (prior && Date.parse(prior) - Date.parse(entry.week) !== period)
    )
      break;
    consecutiveWeeks += 1;
    prior = entry.week;
  }
  return {
    current,
    weeks: history.slice(-8),
    consecutiveWeeks,
    ready: consecutiveWeeks >= 4 && current.every((entry) => entry.met),
  };
}

export function recordMentoringWeek(db, now) {
  const local = new Date(now + 8 * 3600000);
  const day = Date.parse(local.toISOString().slice(0, 10) + "T00:00:00Z");
  const week = new Date(day - ((new Date(day).getUTCDay() + 6) % 7) * dayMs)
    .toISOString()
    .slice(0, 10);
  if (!db.mentorGate) {
    db.mentorGate = { week, weeks: [] };
    return true;
  }
  const state = db.mentorGate;
  if (state.week === week) return false;
  const lastWeek = Date.parse(week) - 7 * dayMs;
  if (Date.parse(state.week) === lastWeek) {
    const metrics = mentorshipMetrics(db.accounts, now);
    state.weeks.push({
      week: state.week,
      checkedAt: new Date(now).toISOString(),
      met: metrics.every((entry) => entry.met),
    });
    state.weeks = state.weeks.slice(-52);
  }
  state.week = week;
  return true;
}

export function logMentorSetting(db, moderator, path, before, value, now) {
  (db.mentorConfigHistory ||= []).unshift({
    id: randomUUID(),
    moderator,
    path,
    before,
    value,
    at: new Date(now).toISOString(),
  });
}
