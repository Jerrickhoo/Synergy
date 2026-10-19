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
  roleRooms(state).filter(
    (room) => !["launched", "reviewed"].includes(room.status),
  );
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
      "Disputes must be resolved before launch. Dispute resolution is unavailable in this demo.",
    );
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
    .map((room) => ({ room, schedule: room.milestones.session.schedule }))
    .filter(
      ({ schedule }) => new Date(`${schedule.date}T${schedule.time}`) > now,
    )
    .sort((a, b) =>
      `${a.schedule.date}T${a.schedule.time}`.localeCompare(
        `${b.schedule.date}T${b.schedule.time}`,
      ),
    );
}
