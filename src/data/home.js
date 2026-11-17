import {
  activeRooms,
  attentionItems,
  profileCompleteness,
  upcomingSessions,
  scheduleInstant,
} from "./selectors.js";
import { mentorshipActions } from "./mentorship.js";
import { roomNextAction } from "./selectors.js";
import { createModel } from "./model.js";
import { verificationRequired } from "./collaboration.js";

export const partnerName = (state, room) =>
  createModel(state)
    .allPeople()
    .find((person) => person.id === room.partnerId)?.name ||
  "your collaborator";

export function homeNextStep(state, now = new Date()) {
  const mentor = state.role === "mentor";
  if (verificationRequired(state))
    return {
      title: "Verify to send introductions",
      detail:
        state.verification === "pending"
          ? "A moderator is checking your evidence. You can keep browsing"
          : "A moderator can check an accelerator, university, community or referral note.",
      label: "Go to Verification",
      command: { action: "open-verification" },
    };
  const attention = mentor
    ? mentorshipActions(state, now.getTime())
    : attentionItems(state, now.getTime());
  if (attention.length) {
    const item = attention[0];
    return {
      title: item.text,
      detail: `${attention.length} pending action${attention.length === 1 ? "" : "s"} ${mentor ? "for your mentoring work" : "across your collaborations"}.`,
      label: "Review next action",
      command: item.page
        ? { page: item.page }
        : {
            action: "open-room",
            id: item.roomId,
            tab: item.tab,
            review: item.review,
          },
    };
  }
  const next = upcomingSessions(state, now)[0];
  if (next)
    return {
      title: "Prepare for your next session",
      detail: scheduleInstant(next.schedule).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      label: "View session",
      command: { action: "open-room", id: next.room.id, tab: "schedule" },
    };
  const rooms = activeRooms(state);
  const room =
    rooms.find((item) => roomNextAction(item, partnerName(state, item)).mine) ||
    rooms[0];
  if (room) {
    const name = partnerName(state, room);
    const next = roomNextAction(room, name);
    return {
      title: next.mine ? next.text : `Waiting on ${name}`,
      detail: next.mine
        ? next.detail || room.terms.draft.goal || ""
        : `${next.text}. Nothing needs you right now.`,
      label: next.mine ? next.action || "Open Deal Room" : "Open Deal Room",
      command: { action: "open-room", id: room.id, tab: next.tab },
    };
  }
  const completeness = profileCompleteness(
    state.profiles[state.role],
    state.role,
  );
  const other = mentor ? "founder" : "mentor";
  if (
    completeness === 100 &&
    state.bothRoles &&
    profileCompleteness(state.profiles[other], other) < 100
  )
    return {
      title: `Set up your ${other} profile`,
      detail:
        "You chose both roles. Switch profiles to add the details for your other role.",
      label: `Switch to ${other}`,
      command: { action: "choose-role", roleChoice: other, goHome: true },
    };
  if (completeness < 100)
    return {
      title: mentor
        ? "Introduce your mentoring expertise"
        : "Complete your startup profile",
      detail: `${completeness}% complete. Add ${mentor ? "expertise, availability and startup interests" : "your background, offers and requested help"} to appear in Matches.`,
      label: "Set up your profile",
      command: { action: "edit-profile" },
    };
  return {
    title: mentor ? "Find a startup to support" : "Find your next collaborator",
    detail: mentor
      ? "Explore startup needs and find where your expertise can help."
      : "Explore people whose skills and goals connect with yours.",
    label: mentor ? "Explore startups" : "Explore matches",
    command: { page: "discover" },
  };
}
