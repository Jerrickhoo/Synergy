import {
  activeRooms,
  attentionItems,
  profileCompleteness,
  upcomingSessions,
  scheduleInstant,
} from "./selectors.js";
import { mentorshipActions } from "./mentorship.js";

export function homeNextStep(state, now = new Date()) {
  const mentor = state.role === "mentor";
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
  const room = activeRooms(state)[0];
  if (room)
    return {
      title: mentor
        ? "Continue your mentorship"
        : "Continue your collaboration",
      detail:
        room.terms.draft.goal || "Agree on your shared goal and next steps.",
      label: "Open room",
      command: {
        action: "open-room",
        id: room.id,
        tab: room.terms.partnerLocked ? "milestones" : "terms",
      },
    };
  const completeness = profileCompleteness(
    state.profiles[state.role],
    state.role,
  );
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
