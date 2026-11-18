import {
  isMentorRoom,
  mentorSessions,
  mentorshipNextAction,
} from "./mentor-room.js";
import { reviewDeadline, terminalStatuses } from "./collaboration.js";
import { normalizeProfile } from "./profile-content.js";
export const profileFieldNames = {
  bio: "an introduction",
  offer: "what you offer",
  need: "what you need",
  industry: "your industry",
  stage: "your startup stage",
  teamSize: "your team size",
  expertise: "your expertise",
  startups: "the startups you want to help",
};
export const profileKeys = (role) =>
  role === "founder"
    ? ["bio", "offer", "need", "industry", "stage", "teamSize"]
    : ["bio", "offer", "need", "expertise", "startups"];

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
    if (
      room.terms.reopenRequest &&
      room.terms.reopenRequest.byAccountId === room.partnerAccountId
    )
      add(1, "Respond to a request to change agreed terms", room, "terms");
    if (room.cycle?.phase === "review")
      add(
        1,
        `Review mentorship cycle ${room.cycle.number} and choose Continue or Finish`,
        room,
      );
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
    .flatMap((room) =>
      (isMentorRoom(room)
        ? mentorSessions(room).filter(
            (session) => !session.cancelledAt && !session.outcome,
          )
        : room.milestones.session?.schedules ||
          (room.milestones.session?.schedule
            ? [room.milestones.session.schedule]
            : [])
      ).map((schedule) => ({ room, schedule })),
    )
    .filter(({ schedule }) => scheduleInstant(schedule) > now)
    .sort((a, b) => scheduleInstant(a.schedule) - scheduleInstant(b.schedule));
}

export function scheduleInstant(schedule) {
  if (schedule.startsAt) return new Date(schedule.startsAt);
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

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";
// Local display of a milestone's calendar date (stored as YYYY-MM-DD).
export const milestoneDate = (date) => {
  if (!date) return "";
  const when = new Date(`${date}T12:00:00`);
  return when.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(when.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" }
      : {}),
  });
};

// The single answer to "what happens next, and whose turn is it?" for a room.
export function roomNextAction(room, partner = "your collaborator") {
  if (isMentorRoom(room)) return mentorshipNextAction(room);
  if (!room || room.status === "cancelled")
    return { mine: false, done: true, text: "This collaboration is closed." };
  const deadline = shortDate(reviewDeadline(room));
  if (room.status === "reviewed")
    return {
      mine: false,
      done: true,
      text: "Completed and reviewed.",
      review: true,
      tab: "milestones",
    };
  if (room.status === "launched")
    return room.review.me
      ? {
          mine: false,
          text: `Waiting for ${partner}'s review`,
          detail: deadline
            ? `Feedback is released when both reviews are in, or on ${deadline}.`
            : "",
          review: true,
          tab: "milestones",
        }
      : {
          mine: true,
          text: "Leave your private review",
          detail: deadline ? `Reviews close on ${deadline}.` : "",
          review: true,
          tab: "milestones",
          action: "Write review",
        };
  const terms = room.terms;
  if (room.cycle?.phase === "review") {
    const cycle = room.cycle;
    const ownId = Object.keys(cycle.reviews || {}).find(
      (id) => id !== room.partnerAccountId,
    );
    const ownReview = Boolean(ownId),
      released = ownReview && Boolean(cycle.reviews[room.partnerAccountId]);
    const waiting =
      ownReview && (!released || Boolean(cycle.decisions?.[ownId]));
    return {
      mine: !waiting,
      text: waiting
        ? `Waiting for ${partner}'s ${released ? "cycle decision" : "private cycle review"}`
        : released
          ? `Choose Continue or Finish for cycle ${cycle.number}`
          : `Review cycle ${cycle.number}`,
      detail:
        "Add a check-in summary, submit private reviews, then choose Continue or Finish together.",
      tab: "milestones",
      action: released ? "Choose next step" : "Review cycle",
    };
  }
  if (room.cycle && !room.cycle.goals?.trim())
    return {
      mine: true,
      text: `Agree goals for cycle ${room.cycle.number}`,
      tab: "milestones",
      action: "Add cycle goals",
    };
  if (terms.reopenRequest)
    return terms.reopenRequest.mine === false ||
      terms.reopenRequest.byAccountId === room.partnerAccountId
      ? {
          mine: true,
          text: `Respond to ${partner}'s request to change the terms`,
          detail: "The current terms stay in place until you agree.",
          tab: "terms",
          action: "Review request",
        }
      : {
          mine: false,
          text: `Waiting for ${partner} to respond to your change request`,
          tab: "terms",
        };
  if (!terms.locked)
    return {
      mine: true,
      text: "Agree the terms",
      detail: "Fill in the shared goal and scope, then send them for approval.",
      tab: "terms",
      action: "Open terms",
    };
  if (!terms.confirmedByMe)
    return {
      mine: true,
      text: `Review and accept ${partner}'s terms`,
      tab: "terms",
      action: "Review terms",
    };
  if (!terms.partnerLocked)
    return {
      mine: false,
      text: `Waiting for ${partner} to accept the terms`,
      tab: "terms",
    };
  const items = Object.entries(room.milestones);
  const disputed = items.find(([, item]) => item.disputed);
  if (disputed)
    return {
      mine: true,
      text: `Resolve the dispute on “${disputed[1].title}”`,
      detail: disputed[1].dispute?.reason || "",
      tab: "milestones",
      milestoneId: disputed[0],
      action: "Open dispute",
    };
  const proposal = items.find(
    ([, item]) =>
      item.proposal && item.proposal.proposedBy === room.partnerAccountId,
  );
  if (proposal)
    return {
      mine: true,
      text: `Review ${partner}'s proposed change to “${proposal[1].title}”`,
      tab: "milestones",
      milestoneId: proposal[0],
      action: "Review change",
    };
  const theirs = items.find(([, item]) => item.partner && !item.me);
  if (theirs)
    return {
      mine: true,
      text: `Your turn: confirm “${theirs[1].title}”`,
      detail: `${partner} marked it done${theirs[1].attachment ? " and attached proof" : ""}.`,
      tab: "milestones",
      milestoneId: theirs[0],
      due: theirs[1].dueDate,
      action: theirs[1].attachment ? "Review proof" : "Review milestone",
    };
  if (items.length && items.every(([, item]) => item.me && item.partner))
    return {
      mine: false,
      text: "Every milestone is confirmed by both of you.",
      detail: "Completion is recorded automatically.",
      tab: "milestones",
    };
  const next = items.find(([, item]) => !item.me);
  if (next)
    return {
      mine: true,
      text: `Next: ${next[1].title}`,
      detail:
        next[1].evidence && !next[1].attachment
          ? "Attach proof, then mark it done."
          : "Mark it done when the work is finished.",
      tab: "milestones",
      milestoneId: next[0],
      due: next[1].dueDate,
      action: "Open milestone",
    };
  const waiting = items.find(([, item]) => item.me && !item.partner);
  return {
    mine: false,
    text: waiting
      ? `Waiting for ${partner} to confirm “${waiting[1].title}”`
      : `Waiting for ${partner}`,
    tab: "milestones",
    milestoneId: waiting?.[0],
  };
}
