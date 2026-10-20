import { terminalStatuses } from "./collaboration.js";
export const profileKeys = (role) =>
  role === "founder"
    ? ["bio", "offer", "need", "industry", "stage", "teamSize"]
    : ["bio", "offer", "need", "expertise", "availability", "startups"];

export function profileCompleteness(profile, role) {
  const keys = profileKeys(role);
  return Math.round(
    (keys.filter((key) => String(profile[key] || "").trim()).length /
      keys.length) *
      100,
  );
}

export const roleRooms = (state) =>
  Object.values(state.rooms).filter((room) => room.role === state.role);
export const activeRooms = (state) =>
  roleRooms(state).filter((room) => !terminalStatuses.includes(room.status));
export const roomProgress = (room) => {
  const items = Object.values(room.milestones);
  return items.length
    ? Math.round(
        (items.filter((item) => item.me && item.partner).length /
          items.length) *
          100,
      )
    : 0;
};

export function launchBlockers(room) {
  if (!room) return ["This room is unavailable."];
  if (room.status === "cancelled") return ["This collaboration is closed."];
  const reasons = [];
  const items = Object.values(room.milestones);
  if (!room.terms.locked || !room.terms.partnerLocked)
    reasons.push("Both partners must agree to the terms.");
  if (!items.length || items.some((item) => !item.me || !item.partner))
    reasons.push("Both partners must confirm every milestone.");
  if (
    items.some((item) => item.evidence && !String(item.attachment || "").trim())
  )
    reasons.push("Add evidence for each required milestone.");
  if (items.some((item) => item.disputed))
    reasons.push(
      "Both collaborators must resolve open disputes before launch.",
    );
  if (items.some((item) => item.proposal))
    reasons.push("Resolve proposed milestone revisions before launch.");
  if (room.type === "mentorship" && !room.milestones.session?.schedule)
    reasons.push("Schedule the mentorship session.");
  return reasons;
}

export function scheduleLabel(schedule) {
  return schedule
    ? `${schedule.date} · ${schedule.time} (${schedule.timeZone})`
    : "Not scheduled";
}

export function upcomingSessions(state, now = new Date()) {
  return activeRooms(state)
    .filter((room) => room.milestones.session?.schedule)
    .flatMap((room) =>
      (
        room.milestones.session.schedules || [room.milestones.session.schedule]
      ).map((schedule) => ({ room, schedule })),
    )
    .filter(({ schedule }) => scheduleInstant(schedule) > now)
    .sort((a, b) => scheduleInstant(a.schedule) - scheduleInstant(b.schedule));
}

export function scheduleInstant(schedule) {
  if (!schedule.timeZone) return new Date(`${schedule.date}T${schedule.time}`);
  try {
    const target = Date.parse(`${schedule.date}T${schedule.time}:00Z`);
    let instant = target;
    const format = new Intl.DateTimeFormat("en-CA", {
      timeZone: schedule.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    for (let n = 0; n < 3; n++) {
      const p = Object.fromEntries(
        format
          .formatToParts(new Date(instant))
          .map(({ type, value }) => [type, value]),
      );
      const represented = Date.parse(
        `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
      );
      instant += target - represented;
    }
    return new Date(instant);
  } catch {
    return new Date(NaN);
  }
}
