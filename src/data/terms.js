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
