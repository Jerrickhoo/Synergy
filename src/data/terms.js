import defaultTemplates from "./engagement-templates.json" with { type: "json" };

// Milestones that mean the same as agreeing the terms (for example a Skill
// Swap's "Trade agreed") are confirmed for both sides when the terms are, so
// the room never asks for them again once work starts.
export function completeTermsMilestones(room) {
  const ids = (defaultTemplates[room.type]?.milestones || [])
    .filter((milestone) => milestone.completedByTerms)
    .map((milestone) => milestone.id);
  for (const id of ids) {
    const milestone = room.milestones?.[id];
    if (milestone && !milestone.disputed)
      milestone.me = milestone.partner = true;
  }
}

// The timeline is picked as a start and an end date, like a booking, and
// saved in the one Timeline term as "2026-12-01 to 2026-12-14". Older
// terms written as text ("Two weeks") still show as written.
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function timelineDates(value = "") {
  const [start = "", end = ""] = String(value).split(" to ");
  return isoDate.test(start.trim()) || isoDate.test(end.trim())
    ? { start: start.trim(), end: end.trim(), written: "" }
    : { start: "", end: "", written: String(value).trim() };
}
export const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function timelineText(value = "") {
  const { start, end, written } = timelineDates(value);
  if (written) return written;
  if (start && end) return `${dayLabel(start)} – ${dayLabel(end)}`;
  return start
    ? `From ${dayLabel(start)}`
    : end
      ? `Until ${dayLabel(end)}`
      : "";
}
// How much time each side gives, as a choice instead of free text.
export const commitmentChoices = [
  "About 1 hour a week",
  "2–3 hours a week",
  "Half a day a week",
  "A full day a week",
  "A few hours in total",
];
