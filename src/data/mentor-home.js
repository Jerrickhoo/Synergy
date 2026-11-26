import {
  activeRooms,
  profileFieldNames,
  profileKeys,
  roomNextAction,
  scheduleLabel,
  upcomingSessions,
} from "./selectors.js";
import { isMentorRoom, roomFormat } from "./mentor-room.js";
import { mentorFormat } from "./mentor-formats.js";
import { offersNeed } from "./collaboration.js";
import { needLabel, verificationStep } from "./home.js";

// What a mentor does next in a mentorship, outside the room: the button
// label, and how urgent it is next to the mentor's other steps. Kinds come
// from mentorshipNextAction.
const steps = {
  attendance: [0, "Report attendance"],
  "check-in": [1, "Confirm check-in"],
  goal: [2, "Confirm goal"],
  "deliver-review": [3, "Deliver review"],
  "deliver-answer": [3, "Deliver answer"],
  cycle: [4, "Review cycle"],
  review: [5, "Write review"],
  session: [6, "Arrange session"],
};

export const mentorStepLabel = (next) =>
  (next.mine && steps[next.kind]?.[1]) || "Open room";

// Lower is more urgent; steps that are not the mentor's sort last.
export const mentorStepRank = (next) =>
  next.mine && !next.done ? (steps[next.kind]?.[0] ?? 7) : 8;

// The room's line with "the founder" replaced by their name, so a mentor
// waiting on someone sees who: "Waiting for Acme to propose a check-in time".
export const waitingText = (next, name) =>
  name ? next.text.replace(/\bthe founder\b/, name) : next.text;

function stepTitle(next, name, room) {
  switch (next.kind) {
    case "attendance":
      return `Report attendance for your session with ${name}`;
    case "check-in":
      return `Confirm ${name}'s proposed check-in time`;
    case "goal":
      return `Confirm ${name}'s mentorship goal`;
    case "deliver-review":
      return `Deliver your review for ${name}`;
    case "deliver-answer":
      return `Answer ${name}'s question`;
    case "cycle":
      // Only reached in a cycle's review phase, so the cycle exists.
      return `Review advisory cycle ${room.cycle.number} with ${name}`;
    case "review":
      return `Write your private review of ${name}`;
    case "session":
      return `Arrange a session with ${name}`;
    default:
      return `${next.text} with ${name}`;
  }
}

function expiryText(expiresAt, now) {
  const hours = Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 36e5));
  if (hours <= 24)
    return `The request expires in ${hours} ${hours === 1 ? "hour" : "hours"}.`;
  const days = Math.ceil(hours / 24);
  return `The request expires in ${days} days.`;
}

const urgentMs = 24 * 36e5;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// The mentor's one next step for Home, from their actual state: a request
// about to expire, then their turn in a mentorship (attendance, check-in,
// goal, delivery…), then other requests, the next session, a mentorship
// waiting on the founder, and finally setting up. Returns null while the
// application or a suspension banner already says what to do.
export function mentorNextStep(state, model, now = Date.now()) {
  const people = model.allPeople();
  const nameOf = (room) =>
    people.find((person) => person.id === room.partnerId)?.name ||
    "your mentee";
  const requests = [...(state.mentorRequests || [])].sort(
    (a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
  );
  const rooms = activeRooms(state).filter(
    (room) => isMentorRoom(room) && room.role === "mentor",
  );
  const mentees = rooms
    .map((room) => ({ room, next: roomNextAction(room, nameOf(room)) }))
    .sort((a, b) => mentorStepRank(a.next) - mentorStepRank(b.next));
  const turns = mentees.filter(({ next }) => mentorStepRank(next) < 8);
  const waiting = turns.length + requests.length - 1;
  const more =
    waiting > 0
      ? ` ${plural(waiting, "more thing needs", "more things need")} you after this.`
      : "";
  const requestStep = (request) => ({
    title: `Reply to ${request.name}'s mentorship request`,
    detail: `${expiryText(request.expiresAt, now)}${more}`,
    label: "Review request",
    command: { page: "requests", requestId: request.id },
  });
  const soonest = requests[0];
  if (soonest && Date.parse(soonest.expiresAt) - now <= urgentMs)
    return requestStep(soonest);
  if (turns.length) {
    const { room, next } = turns[0];
    const name = nameOf(room);
    return {
      title: stepTitle(next, name, room),
      detail: `${mentorFormat(roomFormat(room))?.label || "Mentorship"} with ${name}.${more}`,
      label: mentorStepLabel(next),
      command: {
        action: "open-room",
        id: room.id,
        tab: next.tab,
        review: next.review,
      },
    };
  }
  if (soonest) return requestStep(soonest);
  const session = upcomingSessions(state, new Date(now)).find(({ room }) =>
    rooms.includes(room),
  );
  if (session) {
    const name = nameOf(session.room);
    return {
      title: `Prepare for your session with ${name}`,
      detail: scheduleLabel(session.schedule),
      label: "View session",
      command: { action: "open-room", id: session.room.id, tab: "schedule" },
    };
  }
  if (mentees.length) {
    const { room, next } = mentees[0];
    const name = nameOf(room);
    return {
      title: `Waiting on ${name}`,
      detail: `${waitingText(next, name)}. Nothing needs you right now.`,
      label: "Open room",
      command: { action: "open-room", id: room.id, tab: next.tab },
    };
  }
  if (state.mentorApplication || state.mentorSuspension) return null;
  const profile = state.profiles.mentor || {};
  const missing = profileKeys("mentor").filter(
    (key) => !String(profile[key] || "").trim(),
  );
  // Once listed (or deliberately hidden) the profile is good enough to
  // match; the listing card covers those states, as Home did before.
  const listing = state.mentorListing;
  if (missing.length && !listing?.listed && !listing?.hidden)
    return {
      title: "Introduce your mentoring expertise",
      detail: `Still to add: ${missing.map((key) => profileFieldNames[key]).join(", ")}. Founders find you in Matches once your profile is complete.`,
      label: "Set up your profile",
      command: { action: "edit-profile" },
      profile: true,
    };
  const verify = verificationStep(state);
  if (verify) return verify;
  return {
    title: "Find a startup to support",
    detail: "Explore startup needs and find where your expertise can help.",
    label: "Browse startups",
    command: { page: "discover" },
    generic: true,
  };
}

// Why a suggested startup fits this mentor: the first of its needs the
// mentor offers, and the expertise it matches when one item does.
export function mentorHelpReason(needs, profile = {}) {
  const need = needs[0];
  if (!need) return "";
  const expertise = String(profile.expertise || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .find((item) => offersNeed({ expertise: item }, need));
  const asked = needLabel(need);
  const others = needs.length > 1 ? ` and ${needs.length - 1} more` : "";
  if (!expertise) return `Needs ${asked}${others}, which you offer`;
  return needLabel(expertise) === asked
    ? `Needs ${asked}${others}, your area of expertise`
    : `Needs ${asked}${others}, matching your ${needLabel(expertise)} expertise`;
}
