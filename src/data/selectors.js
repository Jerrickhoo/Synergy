import { terminalStatuses } from "./collaboration.js";
import { normalizeProfile } from "./profile-content.js";
export const profileFieldNames = {
  bio: "an introduction",
  offer: "what you offer",
  need: "what you need",
  industry: "your industry",
  stage: "your startup stage",
  teamSize: "your team size",
  expertise: "your expertise",
  availability: "your availability",
  startups: "the startups you want to help",
};
export const profileKeys = (role) =>
  role === "founder"
    ? ["bio", "offer", "need", "industry", "stage", "teamSize"]
    : ["bio", "offer", "need", "expertise", "availability", "startups"];

export function profileCompleteness(profile, role) {
  profile = normalizeProfile(profile);
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

export function attentionItems(state, now = Date.now()) {
  const items = [];
  const add = (priority, text, room, tab = "milestones") =>
    items.push({ priority, text, roomId: room.id, tab });
  for (const room of roleRooms(state)) {
    if (room.status === "launched" && !room.review.me) {
      items.push({
        priority: 3,
        text: "Review your completed collaboration",
        roomId: room.id,
        review: true,
      });
    }
    if (terminalStatuses.includes(room.status)) continue;
    if (room.terms.locked && !room.terms.confirmedByMe)
      add(1, "Review and accept your collaborator's terms", room, "terms");
    for (const item of Object.values(room.milestones)) {
      if (item.disputed) add(0, `Resolve a dispute: ${item.title}`, room);
      else if (item.proposal && item.proposal.proposedBy !== state.accountId)
        add(1, `Review proposed scope: ${item.title}`, room);
      else if (item.partner && !item.me)
        add(2, `Review and confirm: ${item.title}`, room);
      if (item.dueDate && !(item.me && item.partner)) {
        const remaining = Date.parse(`${item.dueDate}T23:59:59Z`) - now;
        if (remaining <= 86400000)
          add(
            remaining < 0 ? 1 : 3,
            `${remaining < 0 ? "Overdue" : "Due soon"}: ${item.title}`,
            room,
          );
      }
    }
  }
  if (state.incomingByRole[state.role].size)
    items.push({
      priority: 2,
      text: "Respond to your pending introductions",
      page: "waiting",
    });
  return items.sort(
    (a, b) => a.priority - b.priority || a.text.localeCompare(b.text),
  );
}

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
      "Both collaborators must resolve open disputes before completion.",
    );
  if (items.some((item) => item.proposal))
    reasons.push("Resolve proposed milestone revisions before completion.");
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
    const p = Object.fromEntries(
      format
        .formatToParts(new Date(instant))
        .map(({ type, value }) => [type, value]),
    );
    const represented = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    return represented === target ? new Date(instant) : new Date(NaN);
  } catch {
    return new Date(NaN);
  }
}
