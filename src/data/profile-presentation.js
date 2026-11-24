import { profileEntries } from "./profile-content.js";
import { canonicalTags } from "./collaboration.js";
export const stageLabel = (stage) =>
  ({ idea: "Idea", "pre-seed": "Pre-seed", seed: "Seed", growth: "Growth" })[
    stage
  ] || stage;
export const preferenceLabel = (value) =>
  ({
    "one-off": "One-off collaborations",
    ongoing: "Ongoing collaborations",
    either: "Open to one-off or ongoing collaborations",
  })[value] || "Preference not added yet";
export const profileTags = profileEntries;
export function fitFactors(person, factors) {
  return factors.map(([label, index]) => {
    const missing = person.why?.[index] === "Missing inputs";
    const raw = person.factorScores?.[index];
    const score =
      typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 100
        ? raw
        : null;
    return {
      label,
      index,
      score: missing ? null : score,
      status: missing
        ? "Missing information"
        : score === null
          ? "Details unavailable"
          : score === 0
            ? "No overlap"
            : score >= 65
              ? "Strong alignment"
              : score >= 30
                ? "Some alignment"
                : "Limited alignment",
      detail:
        person.factorDetails?.[index] ||
        (missing
          ? "One or both profiles need more information for this factor."
          : score === null
            ? "A numerical breakdown is not available for this factor."
            : "Based on the information in both profiles."),
    };
  });
}
const factorPhrase = {
  0: "needs and offers",
  1: "relevant expertise",
  2: "industry",
  3: "stage and size",
  4: "collaboration goals",
  // Mentor-only factors (Phase 1). They describe capacity, not profile fit.
  5: "current availability",
  6: "the formats open now",
};
const profileFactorCount = 5;
// What this profile offers of your needs: shared standard tags, or else the
// need items Need fit matched word for word. Cards and match details both use
// it, so they always name the same help. Empty when Need fit is 0.
// For a mentor viewing a startup: the startup's needs that the mentor's own
// offer covers, compared by wording and by standard tag. A mentor receives
// nothing in a mentorship, so the exchange's "you get" is always empty there.
export function needsYouCover(person, mentorOffer) {
  const normalize = (value) => String(value).trim().toLowerCase();
  const offered = String(mentorOffer || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
  const offeredTags = canonicalTags(mentorOffer);
  return (person.need || []).filter(
    (need) =>
      offered.includes(normalize(need)) ||
      canonicalTags(need).some((tag) => offeredTags.includes(tag)),
  );
}
export function offeredToYou(person) {
  const youGet = person.exchange?.youGet || [];
  const ownWords = person.exchange?.matchedNeeds || [];
  // Lead with the need items in the founder's own wording. A shared standard
  // tag is added only when none of those items already maps to it, so
  // "Onboarding guidance" never reads as the vaguer "Mentorship".
  if (youGet.length && ownWords.length) {
    const named = new Set(canonicalTags(ownWords.join(", ")));
    return [...ownWords, ...youGet.filter((tag) => !named.has(tag))];
  }
  if (youGet.length) return youGet;
  const need = person.factorScores?.[0];
  return typeof need === "number" && need > 0
    ? person.exchange?.matchedNeeds || []
    : [];
}
// Lead with the exchange, then name any weak factor plainly (I-10).
// `covered` is set when a mentor views a startup (see needsYouCover).
export function fitSummary(person, factors, covered = null) {
  const rows = fitFactors(person, factors);
  if (rows.every((row) => row.score === null))
    return "There is not enough information to explain this fit yet. Read the profile and ask about the help you need.";
  const need = rows.find((row) => row.index === 0);
  const youGet = offeredToYou(person);
  const theyGet = person.exchange?.theyGet || [];
  const lead = covered
    ? covered.length
      ? `They need help you offer: ${covered.join(" and ")}.`
      : need && need.score !== null && need.score >= 30
        ? "Their needs partly overlap with what you offer."
        : "Their needs don’t clearly match what you offer."
    : youGet.length && theyGet.length
      ? `Strong two-way exchange: they offer ${youGet.join(" and ")}, and you offer ${theyGet.join(" and ")}.`
      : youGet.length
        ? `They offer what you need: ${youGet.join(" and ")}.`
        : need && need.score !== null && need.score >= 30
          ? "Your needs and their offers overlap."
          : "Neither profile clearly offers what the other needs.";
  const strong = rows
    .filter(
      (row) =>
        row.index !== 0 &&
        row.index < profileFactorCount &&
        row.score !== null &&
        row.score >= 65,
    )
    .map((row) => factorPhrase[row.index]);
  const weak = rows
    .filter((row) => row.score !== null && row.score < 30)
    .map((row) => factorPhrase[row.index]);
  return [
    lead,
    strong.length
      ? `Also aligned on ${new Intl.ListFormat("en", { type: "conjunction" }).format(strong)}.`
      : "",
    weak.length
      ? `Weak spot: ${new Intl.ListFormat("en", { type: "conjunction" }).format(weak)}.`
      : "",
    person.audienceWarning ? `${person.audienceWarning}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
// One-line reason for cards.
// The same bands as match suggestions and the match-quality report:
// 70%+ is strong, 40–69% moderate, below 40% low.
export function matchStrength(score) {
  const value = Number(score) || 0;
  return value >= 70 ? "Strong fit" : value >= 40 ? "Moderate fit" : "Low fit";
}
export function matchReason(person) {
  const youGet = offeredToYou(person);
  const theyGet = person.exchange?.theyGet || [];
  if (person.audienceWarning) return person.audienceWarning;
  if (youGet.length && theyGet.length)
    return `Two-way fit: ${youGet[0]} for ${theyGet[0]}`;
  if (youGet.length) return `Offers what you need: ${youGet.join(", ")}`;
  // Match details call a 30–64% Need fit an overlap, so the card does too.
  const need = person.factorScores?.[0];
  if (typeof need === "number" && need >= 30 && need < 65)
    return "Needs and offers partly overlap";
  const best = (person.why || [])
    .map((label, index) => [label, index])
    .find(([label, index]) => label === "Strong" && index < profileFactorCount);
  return best
    ? best[1] === 0
      ? "Strong needs and offers fit"
      : `Strong ${factorPhrase[best[1]]} fit; needs and offers are less clear`
    : "Limited overlap so far; compare what each side needs";
}
// Sample-size aware trust line (I-38).
export function trustLine(person) {
  const trust = person.trust;
  // No history yet is not information worth a line on every card.
  if (!trust || (!trust.completed && !trust.cancelled && !trust.averageRating))
    return "";
  const parts = [`${trust.completed} completed`];
  if (trust.averageRating !== null && trust.averageRating !== undefined)
    parts.push(
      `${trust.averageRating}/5 from ${trust.distinctReviewers} review${trust.distinctReviewers === 1 ? "" : "s"}`,
    );
  if (trust.cancelled) parts.push(`${trust.cancelled} closed early`);
  return parts.join(" · ");
}
