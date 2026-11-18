import { mentorshipTrust } from "./mentor-impact.js";
import { mentorConfig } from "./mentor-rules.js";
import { normalizeMentorFormat } from "./mentor-formats.js";

export const terminalStatuses = ["launched", "reviewed", "cancelled"];
export const ongoingMentorship = (room) =>
  room.type === "mentorship" &&
  normalizeMentorFormat(room.terms.draft.format) === "ongoing-advisory";
export function ensureCycle(room, now = Date.now(), config = mentorConfig) {
  room.cycle ||= {
    number: 1,
    checkIns: config.checkInsPerCycle,
    checkInMinutes: config.checkInMinutes,
    startsAt: new Date(now).toISOString(),
    dueAt: new Date(now + config.cycleWeeks * 7 * 86400000).toISOString(),
    goals: room.terms.draft.goal,
    summary: "",
    reviews: {},
    decisions: {},
    phase: "active",
  };
  return room.cycle;
}
export function resolveCycleDecisions(room, now = Date.now()) {
  const cycle = room.cycle;
  if (!cycle || Object.keys(cycle.decisions).length !== 2) return "waiting";
  if (Object.values(cycle.decisions).includes("finish")) {
    room.finishingCycles = true;
    return "finish";
  }
  (room.cycleHistory ||= []).push({
    ...structuredClone(cycle),
    milestones: structuredClone(room.milestones),
  });
  delete room.cycle;
  const next = ensureCycle(room, now);
  next.number = cycle.number + 1;
  next.goals = "";
  for (const item of Object.values(room.milestones)) {
    item.me = item.partner = false;
    item.attachment = "";
    item.evidenceItems = [];
    delete item.file;
    delete item.schedule;
    delete item.schedules;
    delete item.dueDate;
  }
  return "continue";
}
// Three weekdays in UTC; public holidays require a future workspace calendar.
export function moderationDueAt(timestamp) {
  const date = new Date(timestamp);
  let remaining = 3;
  while (remaining) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![0, 6].includes(date.getUTCDay())) remaining--;
  }
  return date.toISOString();
}
export const verificationRequired = (state) =>
  Boolean(
    state.integrations?.requireVerification &&
    !state.integrations?.guest &&
    state.verification !== "verified",
  );
export const profileOptions = [
  "startupName",
  "pastExperience",
  "goals",
  "engagementPreference",
  "audienceSize",
  "offerTags",
  "needTags",
  "topics",
];
export const defaultVocabulary = [
  "Beta Testers",
  "Product Feedback",
  "Technical Development",
  "Product Design",
  "Co-Marketing",
  "Fundraising",
  "Pricing Strategy",
  "Mentorship",
  "Distribution",
  "User Research",
];
// Plain-language phrases that mean the same controlled tag. Founders confirm
// every suggestion; nothing is applied to a profile without their action.
export const tagAliases = {
  "Beta Testers":
    /\bbeta\b|\btesters?\b|\btesting\b|early adopters?|try (it|this|our|my|the) (out|product|app)|try it out|people to try|test(ing)? (our|my|the|new)/,
  "Product Feedback":
    /feedback|what'?s broken|tell us what|reviews? of (our|my) product/,
  "Technical Development":
    /\bdev(eloper|elopers|elopment)?\b|\bcoding\b|technical|programming|\bengineer(s|ing)?\b|\bbuild (it|features|the product)/,
  "Product Design": /\bdesign(er|ers)?\b|\bux\b|\bui\b|user experience/,
  "Co-Marketing":
    /marketing|newsletter|cross-?promot|audience swap|\bpromotion\b|subscribers/,
  Fundraising: /fundrais|\braise\b|raising|\binvestors?\b|funding|pitch deck/,
  "Pricing Strategy": /pricing|monetiz|monetis/,
  Mentorship: /mentor|advisor|guidance|coaching/,
  Distribution:
    /distribution|go-to-market|\bgtm\b|get (it|our product) in front of|reach (more )?(customers|users)/,
  "User Research": /research|interviews?|user insights?|usability stud/,
};
export function canonicalTags(text, vocabulary = defaultVocabulary) {
  const normalized = String(text || "").toLowerCase();
  return vocabulary.filter(
    (tag) =>
      tagAliases[tag]?.test(normalized) ||
      normalized.includes(tag.toLowerCase()),
  );
}
export const suggestTags = canonicalTags;
const reviewWindowMs = 14 * 86400000;
export const reviewDeadline = (room, windowMs = reviewWindowMs) =>
  room?.launchedAt
    ? new Date(Date.parse(room.launchedAt) + windowMs).toISOString()
    : null;
export const closeCategories = {
  mutual: "We agreed to stop",
  unresponsive: "Partner stopped responding",
  "not-relevant": "No longer relevant",
  other: "Other reason",
};
// Who a closed room counts against. Mutual and no-longer-relevant closures are
// neutral; an unresponsive partner bears the closure, never the person closing.
export function closureCountsAgainstMe(room) {
  if (room.status !== "cancelled") return false;
  if (["mutual", "not-relevant", "moderator"].includes(room.closeCategory))
    return false;
  if (room.closeCategory === "unresponsive")
    return room.closedByAccountId === room.partnerAccountId;
  return true;
}
export function trustSummary(
  rooms,
  role,
  now = Date.now(),
  mentorOptions = {},
) {
  const all = Object.values(rooms).filter((room) => room.role === role);
  const completed = all.filter((room) =>
    ["launched", "reviewed"].includes(room.status),
  );
  // Partner feedback counts once released: both reviews are in, or the review
  // window closed with the partner's review submitted.
  const released = (room) =>
    room.status === "reviewed" &&
    room.review.partner &&
    (room.review.me || room.review.windowClosed);
  const reviewed = all.filter(released);
  const stalled = all.filter(
    (room) =>
      !terminalStatuses.includes(room.status) &&
      now -
        Date.parse(
          room.updatedAt || room.createdAt || new Date(now).toISOString(),
        ) >
        14 * 86400000,
  );
  const ratings = reviewed
    .map((room) => room.review.partnerRating)
    .filter(Number.isFinite);
  // Only one review from each distinct partner contributes to the aggregate.
  const unique = new Map(
    reviewed.map((room) => [room.partnerAccountId, room.review.partnerRating]),
  );
  const eligible = [...unique.values()].filter(Number.isFinite);
  const closedEarly = all.filter(closureCountsAgainstMe);
  const closed = completed.length + closedEarly.length;
  return {
    mentorship: mentorshipTrust(rooms, role, { now, ...mentorOptions }),
    completed: completed.length,
    reviewed: reviewed.length,
    reviewCount: ratings.length,
    distinctReviewers: eligible.length,
    averageRating: eligible.length
      ? Number(
          (eligible.reduce((a, b) => a + b, 0) / eligible.length).toFixed(1),
        )
      : null,
    cancelled: closedEarly.length,
    closed,
    stalled: stalled.length,
    followThrough: closed
      ? Math.round((completed.length / closed) * 100)
      : null,
    ratingPattern:
      ratings.length >= 5 && new Set(ratings).size === 1
        ? "Uniform ratings; use the review count and outcomes for context."
        : "",
    history: completed.map((room) => ({
      id: room.id,
      type: room.engagementType,
      date: (room.completedAt || room.launchedAt)?.slice(0, 10) || "",
      status: room.status,
      rating: released(room) ? room.review.partnerRating : null,
    })),
  };
}
