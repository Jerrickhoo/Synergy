// Home: collaborator colours, the task list and labelled activity.
import { roomNextAction } from "./selectors.js";

// Eight collaborator colours (theme tokens --collab-1 to --collab-8). A room
// keeps its colour by the order rooms were opened, so finishing one never
// repaints the others; a ninth and later collaborator share a neutral one.
export const collaboratorSlotCount = 8;
export function collaboratorSlots(rooms) {
  const ordered = [...rooms].sort(
    (a, b) =>
      String(a.createdAt || "").localeCompare(String(b.createdAt || "")) ||
      a.id.localeCompare(b.id),
  );
  return new Map(
    ordered.map((room, index) => [
      room.id,
      index < collaboratorSlotCount ? `collab-${index + 1}` : "collab-other",
    ]),
  );
}

const stepText = (text) =>
  text.replace(/^Your turn: /, "").replace(/^Next: /, "");

// Things waiting on this person: each room's next step when it is theirs,
// and open board tasks assigned to them (or to nobody). Soonest due first.
export function homeTasks(state, rooms, nameOf, extra = []) {
  const items = [];
  for (const room of rooms) {
    const name = nameOf(room);
    const next = roomNextAction(room, name);
    if (next.mine)
      items.push({
        id: `${room.id}:next`,
        title: stepText(next.text),
        who: name,
        due: next.due || "",
        room,
        tab: next.tab,
        review: Boolean(next.review),
      });
    // A mentor never owns a mentorship's action items.
    if (room.type === "mentorship" && state.role === "mentor") continue;
    for (const task of room.tasks || [])
      if (
        task.status !== "done" &&
        (!task.assignee || task.assignee === state.accountId)
      )
        items.push({
          id: `${room.id}:task:${task.id}`,
          title: task.title,
          who: name,
          due: task.dueDate || "",
          room,
          tab: "tasks",
        });
  }
  // An extra item for a room step already listed is left out.
  const listed = new Set(items.map((item) => `${item.room.id}:${item.tab}`));
  const added = extra.filter(
    (item) => !listed.has(`${item.room.id}:${item.tab}`),
  );
  return [...items, ...added].sort(
    (a, b) =>
      (a.due ? 0 : 1) - (b.due ? 0 : 1) ||
      String(a.due).localeCompare(String(b.due)) ||
      a.title.localeCompare(b.title),
  );
}

// Who or what an activity entry is about, shown before its text:
// "Fairtab: Accepted the shared terms", "Profile: You updated your industry".
export function activityLabel(item, state, people) {
  const room = item.roomId && state.rooms[item.roomId];
  if (room)
    return people.find((person) => person.id === room.partnerId)?.name || "";
  if (item.matchId)
    return people.find((person) => person.id === item.matchId)?.name || "";
  if (item.kind === "profile" || /\byour profile\b/i.test(item.text))
    return "Profile";
  if (item.kind === "affiliation") return "Verification";
  if (item.requestId || item.kind === "request") return "Requests";
  return "";
}

// The label already names the collaborator, so a sentence that starts with
// that name drops it: "Fairtab accepted the terms." -> "Accepted the terms."
export function activityText(text, label) {
  if (!label || label === "Profile") return text;
  const lead = `${label} `;
  if (!text.startsWith(lead)) return text;
  const rest = text.slice(lead.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
