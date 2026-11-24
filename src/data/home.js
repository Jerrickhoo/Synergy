import {
  activeRooms,
  attentionItems,
  profileCompleteness,
  upcomingSessions,
  scheduleLabel,
} from "./selectors.js";
import { mentorshipActions } from "./mentorship.js";
import { roomNextAction } from "./selectors.js";
import { createModel } from "./model.js";
import { cooldownActive } from "./mentor-rules.js";
import {
  coveredNeeds,
  defaultVocabulary,
  needItems,
  verificationRequired,
} from "./collaboration.js";

export const partnerName = (state, room) =>
  createModel(state)
    .allPeople()
    .find((person) => person.id === room.partnerId)?.name ||
  "your collaborator";

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
      detail: scheduleLabel(next.schedule),
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
  // Verification only matters once there is a profile to match with, and
  // never outranks work already under way.
  if (verificationRequired(state)) {
    // Without a moderator nobody can verify, so point at what still works.
    if (!state.integrations?.moderation)
      return {
        title: "Introductions are not open yet",
        detail:
          "No moderator is set up to verify founders in this workspace. You can still browse and save matches.",
        label: mentor ? "Explore startups" : "Explore matches",
        command: { page: "discover" },
      };
    return {
      title: "Verify to send introductions",
      detail:
        state.verification === "pending"
          ? "A moderator is checking your evidence. You can keep browsing and saving matches in the meantime."
          : "A moderator can check an accelerator, university, community or referral note.",
      label: "Go to Verification",
      command: { action: "open-verification" },
    };
  }
  return {
    title: mentor ? "Find a startup to support" : "Find your next collaborator",
    detail: mentor
      ? "Explore startup needs and find where your expertise can help."
      : "Explore people whose skills and goals connect with yours.",
    label: mentor ? "Explore startups" : "Explore matches",
    command: { page: "discover" },
    // Nothing specific to do: Home can let the match list lead instead.
    generic: true,
  };
}

// The first thing a founder asked for, for empty states and match alerts:
// their first standard tag, else the first item of What I need.
export function primaryNeed(profile = {}) {
  const tagged = String(profile.needTags || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const written = String(profile.need || "")
    .split(/,|\s+and\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  return needLabel(tagged[0] || written[0] || "");
}

// A need as it reads mid-sentence: standard tags and sentence-case items are
// lowercased ("pricing strategy"); acronyms and names keep their capitals.
export function needLabel(item = "") {
  if (defaultVocabulary.includes(item)) return item.toLowerCase();
  const [first = "", ...rest] = item.split(" ");
  return /^[A-Z][a-z]+$/.test(first)
    ? [first.toLowerCase(), ...rest].join(" ")
    : item;
}

// The best eligible profiles below the suggestion threshold, with real scores.
// A mentor who declined this founder is left out until the cooldown ends, as
// in Suggested (Nov 22, round 3).
export function closestProfiles(state, count = 3) {
  const model = createModel(state);
  return model
    .matches()
    .filter(
      (person) =>
        person.score > 0 &&
        !model.existingRoomFor(state.role, person.id) &&
        !cooldownActive(person.cooldownUntil),
    )
    .slice(0, count);
}

// A founder's stated needs that none of the current suggestions covers.
export function uncoveredNeeds(state) {
  if (state.role !== "founder") return [];
  const profile = state.profiles.founder;
  const covered = new Set(
    createModel(state)
      .suggestedMatches()
      .flatMap((person) => coveredNeeds(person, profile))
      .map((item) => item.toLowerCase()),
  );
  return needItems(profile).filter((item) => !covered.has(item.toLowerCase()));
}
