// Where a room stands as a numbered step ("Step 2 of 4"), and when it
// finished. Shared by the Rooms list and the room pages so both count the
// same steps.
import { isMentorRoom, stageMarks } from "./mentor-room.js";

const dealStages = {
  matched: 0,
  terms: 1,
  "in-progress": 2,
  launched: 3,
  reviewed: 4,
};

// A Deal Room's five stages, as its stage line names them.
export function dealStageLabels(room) {
  const stage = dealStages[room.status] || 0;
  return [
    "Matched",
    stage >= 2 ? "Terms agreed" : "Agreeing terms",
    "In progress",
    room.type === "mentorship" ? "Completed" : "Launched",
    "Reviewed",
  ];
}

// { number, total, label, complete } with `number` counted from 1, and
// `complete` once the last step is finished too. A closed Deal
// Room has no step (it stopped rather than reached one), so it gets null; a
// closed mentorship keeps the last step it reached.
export function roomStep(room) {
  if (!room) return null;
  if (isMentorRoom(room)) {
    const marks = stageMarks(room);
    const current = marks.findIndex((mark) => mark.current);
    const index =
      current >= 0
        ? current
        : marks.every((mark) => mark.done)
          ? marks.length - 1
          : 0;
    return {
      number: index + 1,
      total: marks.length,
      label: marks[index].label,
      complete: marks.every((mark) => mark.done),
    };
  }
  if (room.status === "cancelled") return null;
  const labels = dealStageLabels(room);
  const index = dealStages[room.status] || 0;
  return {
    number: index + 1,
    total: labels.length,
    label: labels[index],
    complete: room.status === "reviewed",
  };
}

// When a room was completed or closed: { kind: "Completed" | "Closed", at },
// or null while it is still being worked on.
export function roomFinished(room) {
  if (room.status === "cancelled") {
    const at = room.closedAt || room.updatedAt || "";
    return at ? { kind: "Closed", at } : null;
  }
  if (["launched", "reviewed"].includes(room.status)) {
    const at = room.completedAt || room.launchedAt || room.updatedAt || "";
    return at ? { kind: "Completed", at } : null;
  }
  return null;
}
