export const terminalStatuses = ["launched", "reviewed", "cancelled"];
export const profileOptions = [
  "pastExperience",
  "goals",
  "engagementPreference",
  "audienceSize",
  "offerTags",
  "needTags",
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
export function suggestTags(text, vocabulary = defaultVocabulary) {
  const normalized = String(text || "").toLowerCase();
  const aliases = {
    "Beta Testers": /beta|testers|early adopters|try (our|my|the) product/,
    "Technical Development": /develop|coding|technical|programming/,
    "Co-Marketing": /marketing|newsletter|audience|promotion/,
    "Product Feedback": /feedback/,
    "User Research": /research/,
  };
  return vocabulary.filter(
    (tag) =>
      aliases[tag]?.test(normalized) || normalized.includes(tag.toLowerCase()),
  );
}
export function trustSummary(rooms, role, now = Date.now()) {
  const all = Object.values(rooms).filter((room) => room.role === role);
  const completed = all.filter((room) =>
    ["launched", "reviewed"].includes(room.status),
  );
  const reviewed = all.filter(
    (room) =>
      room.status === "reviewed" && room.review.me && room.review.partner,
  );
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
  const closed = all.filter((room) => terminalStatuses.includes(room.status));
  return {
    completed: completed.length,
    reviewed: reviewed.length,
    distinctReviewers: eligible.length,
    averageRating: eligible.length
      ? Number(
          (eligible.reduce((a, b) => a + b, 0) / eligible.length).toFixed(1),
        )
      : null,
    cancelled: all.filter((room) => room.status === "cancelled").length,
    stalled: stalled.length,
    followThrough: closed.length
      ? Math.round((completed.length / closed.length) * 100)
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
      rating:
        room.status === "reviewed" && room.review.me && room.review.partner
          ? room.review.partnerRating
          : null,
    })),
  };
}
