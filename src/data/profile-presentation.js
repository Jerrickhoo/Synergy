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
export const profileTags = (value) =>
  String(value || "")
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
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
export function fitSummary(person, factors) {
  const rows = fitFactors(person, factors);
  const strong = rows
    .filter((row) => row.score !== null && row.score >= 30)
    .map(
      (row) =>
        ({
          0: "needs and offers",
          1: "relevant expertise",
          2: "industry context",
          3: "startup stage and size",
          4: "collaboration goals",
        })[row.index] || row.label.toLowerCase(),
    );
  if (strong.length)
    return `Your profiles connect through ${new Intl.ListFormat("en", { type: "conjunction" }).format(strong)}. Use an introduction to discuss whether the collaboration fits.`;
  if (rows.every((row) => row.score === null))
    return "There is not enough information to explain this fit yet. Read the profile and ask about the help you need.";
  if (person.score === 0)
    return "The information provided does not show shared matching signals yet. You can still explore the profile and discuss a specific goal.";
  return "Your profiles currently show limited alignment. Compare the help offered with your goals before introducing yourself.";
}
