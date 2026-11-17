import { activeRooms, attentionItems, launchBlockers } from "./selectors.js";

// Use existing room/task permissions. These are shared actions, not private notes.
export function mentorshipActions(state, now = Date.now()) {
  const actions = attentionItems(state, now).map((item) => ({ ...item }));
  for (const room of activeRooms(state).filter(
    (r) => r.type === "mentorship",
  )) {
    if (!room.terms.locked)
      actions.push({
        priority: 3,
        text: "Agree on mentoring goals",
        roomId: room.id,
        tab: "terms",
      });
    if (!room.terms.partnerLocked) continue;
    if (!room.milestones.session?.schedule)
      actions.push({
        priority: 3,
        text: "Arrange your first session",
        roomId: room.id,
        tab: "schedule",
      });
    for (const task of room.tasks || []) {
      if (task.status === "done" || task.assignee !== state.accountId) continue;
      actions.push({
        priority: 4,
        text: task.title,
        roomId: room.id,
        tab: "tasks",
        dueDate: task.dueDate,
      });
    }
    if (room.cycle?.phase === "review")
      actions.push({
        priority: 2,
        text: `Review mentorship cycle ${room.cycle.number}`,
        roomId: room.id,
        tab: "milestones",
      });
    else if (
      room.milestones.guidance?.me &&
      room.milestones.guidance?.partner &&
      !room.milestones.followup?.me
    )
      actions.push({
        priority: 4,
        text: "Record follow-up actions and owners",
        roomId: room.id,
        tab: "tasks",
      });
  }
  return actions.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.text.localeCompare(b.text),
  );
}
