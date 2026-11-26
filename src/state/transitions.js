import { createInitialState, createModel } from "../data/model.js";
import { completeTermsMilestones } from "../data/terms.js";
import { readField } from "./fields.js";
import { profileOptions, terminalStatuses } from "../data/collaboration.js";
import { errorMessage, errorTitle, publishToast } from "./feedback.js";
import { weeklySchedules } from "../data/planning.js";
import { normalizeProfile } from "../data/profile-content.js";
import { profileChanges, profileChangeText } from "../data/profile-changes.js";
import { takesMeetings } from "../data/meetings.js";
import { longDate } from "../data/profile-presentation.js";
import { defaultMatchFilters, restoreMatchFilters } from "../data/filters.js";
import {
  launchBlockers,
  profileCompleteness,
  profileKeys,
  roomNextAction,
  roomProgress,
} from "../data/selectors.js";
import {
  cleanValues,
  requiredFields,
  validateCredentials,
  validateMeeting,
  validateProfile,
  validateSchedule,
  validateTerms,
} from "./validation.js";
export function transition(state, payload) {
  const {
    allPeople,
    roomTypeForPerson,
    roleName,
    roleInitials,
    senderForRole,
    createRoom,
    currentAgreement,
    activeRoom,
    matches,
    rolePeople,
    savedMatches,
    waitingMatches,
    interestedMatches,
    existingRoomFor,
  } = createModel(state);
  const field = (id) => readField(state, id);
  const toast = (message, type = "success") => {
    publishToast(state, message, { type });
  };
  const invalid = (scope, fields) => {
    if (!Object.keys(fields).length) {
      state.formErrors = null;
      return false;
    }
    state.formErrors = { scope, fields };
    publishToast(
      state,
      errorMessage(
        scope,
        fields,
        "Review the highlighted details and try again.",
      ),
      {
        type: "error",
        title: errorTitle(scope),
        field: true,
      },
    );
    return true;
  };
  const record = (text, roomId, extra = {}) => {
    state.activity.unshift({
      id: `${payload.timestamp || Date.now()}-${state.activity.length}`,
      role: state.role,
      text,
      roomId,
      timestamp: payload.timestamp || new Date().toISOString(),
      sample: false,
      self: true,
      ...extra,
    });
  };
  // Resource mutations must never use an absent or another role's room.
  const roomActions = new Set([
    "demo-partner-confirm",
    "demo-partner-review",
    "room-tab",
    "confirm-milestone",
    "partner-confirm",
    "evidence-toggle",
    "dispute",
    "lock-terms",
    "partner-lock-terms",
    "launch-room",
    "partner-review",
  ]);
  const roomForms = new Set([
    "review-form",
    "terms-form",
    "evidence",
    "schedule",
    "chat-form",
  ]);
  if (
    (roomActions.has(payload.action) || roomForms.has(payload.form)) &&
    !activeRoom()
  ) {
    toast("This room is unavailable for the current role.", "error");
    return;
  }
  if (payload.action === "set-toast") {
    publishToast(state, payload.message, {
      type: payload.type,
      title: payload.title,
    });
    return;
  }
  const nextRoomId = (personId) =>
    `room-${state.role}-${personId}-${payload.roomId}`;
  function saveOnboardingStory() {
    state.profiles[state.role].bio = field("story").trim();
  }
  function createMutualRoom(person) {
    if (!person) return;
    let room = existingRoomFor(state.role, person.id);
    if (!room) {
      const id = nextRoomId(person.id);
      room = createRoom({
        id,
        role: state.role,
        partnerId: person.id,
        type: roomTypeForPerson(person),
        sender: senderForRole(state.role),
      });
      state.rooms[id] = room;
    }
    state.activeRoomId = room.id;
    state.roomTab = "terms";
    state.page = "room-detail";
    waitingMatches().delete(person.id);
    interestedMatches().delete(person.id);
    state.confirmation =
      "Both sides are interested. Your shared deal room is ready.";
  }
  if (payload.action === "set-field") {
    state.fields[payload.key] = payload.value;
    if (payload.key.endsWith(":verify-email"))
      state.onboarding.verified = false;
    return;
  }
  if (payload.action === "set-filter") {
    state.matchFilters[payload.key] = payload.value;
    return;
  }
  if (payload.action === "restore-filters") {
    state.matchFilters = restoreMatchFilters(payload.filters);
    return;
  }
  if (payload.action === "set-rating") {
    state.rating = payload.value;
    return;
  }
  if (payload.action === "clear-toast") {
    state.toast = "";
    return;
  }
  if (payload.action === "route-login") {
    state.authenticated = false;
    state.page = "home";
    state.notificationOpen = false;
    state.moreOpen = false;
    state.demoOpen = false;
    return;
  }
  if (payload.action === "route-home") {
    if (state.authenticated) state.page = "home";
    return;
  }
  if (payload.action === "back-to-sign-in") {
    state.authenticated = false;
    state.page = "home";
    return;
  }
  if (payload.action === "toggle-notifications") {
    state.notificationOpen = !state.notificationOpen;
    return;
  }
  if (payload.action === "close-notifications") {
    state.notificationOpen = false;
    return;
  }
  if (payload.action === "close-overlays") {
    state.notificationOpen = false;
    state.moreOpen = false;
    state.demoOpen = false;
    return;
  }
  if (payload.action === "header-search") {
    state.matchFilters = {
      ...defaultMatchFilters,
      search: String(payload.query || "").trim(),
    };
    state.matchTab = "browse";
    state.page = "discover";
    state.moreOpen = false;
    return;
  }
  if (payload.action === "verification-done") {
    state.onboarding.verifying = false;
    state.onboarding.verified = true;
    return;
  }
  if (payload.action === "analysis-done") {
    state.onboarding.analyzing = false;
    state.onboarding.analyzed = true;
    state.onboarding.tags = state.profiles[state.role].offer
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    state.onboarding.pendingTags = [];
    return;
  }
  if (payload.form) {
    payload.values = cleanValues(payload.values || {});
    if (payload.form === "signup-form") {
      if (invalid("signup-form", validateCredentials(payload.values, true)))
        return;
      const values = new Map(Object.entries(payload.values));
      const firstName = values.get("firstName").trim();
      const lastName = values.get("lastName").trim();
      Object.assign(state, createInitialState());
      state.accountName = `${firstName} ${lastName}`;
      state.accountEmail = values.get("email").toLowerCase();
      state.role = values.get("role") === "mentor" ? "mentor" : "founder";
      // "Both" starts with the founder profile; the mentor profile is one
      // switch away and is suggested on Home.
      state.bothRoles = values.get("role") === "both";
      state.authenticated = true;
      state.page = "home";
      return;
    }
    if (payload.form === "login-form") {
      if (invalid("login-form", validateCredentials(payload.values))) return;
      const email = payload.values.email.toLowerCase();
      if (state.accountEmail && state.accountEmail !== email)
        Object.assign(state, createInitialState());
      state.accountEmail = email;
      state.authenticated = true;
      state.page = "home";
      toast("Welcome to your workspace.");
      return;
    }
    if (payload.form === "review-form") {
      if (!["launched", "reviewed"].includes(activeRoom().status)) {
        toast(
          activeRoom().type === "mentorship"
            ? "Complete the mentorship before reviewing it."
            : "Launch the completed collaboration before reviewing it.",
          "error",
        );
        return;
      }
      const values = new Map(Object.entries(payload.values));
      const rating = values.get("rating");
      if (![1, 2, 3, 4, 5].includes(Number(rating))) {
        toast("Choose a rating before submitting.", "error");
        return;
      }
      activeRoom().review.me = true;
      activeRoom().review.rating = Number(rating);
      activeRoom().review.note = String(values.get("note") || "").trim();
      if (activeRoom().review.partner) activeRoom().status = "reviewed";
      state.confirmation = "";
      record("You submitted a private review.", activeRoom().id);
      return;
    }
    if (payload.form === "profile-form") {
      payload.values = normalizeProfile(payload.values);
      if (
        invalid("profile-form", {
          ...validateProfile(payload.values, state.role),
          ...("name" in payload.values
            ? requiredFields(payload.values, ["name"])
            : {}),
        })
      )
        return;
      const wasComplete =
        profileCompleteness(state.profiles[state.role], state.role) === 100;
      // Recent activity names what this save changed.
      const changed = profileChanges(
        state.profiles[state.role],
        payload.values,
        state.role,
        state.accountName,
      );
      if ("name" in payload.values) state.accountName = payload.values.name;
      const values = new Map(Object.entries(payload.values));
      state.profiles[state.role] = {
        ...state.profiles[state.role],
        ...Object.fromEntries(
          [...values.entries()]
            .filter(([key]) =>
              [...profileKeys(state.role), ...profileOptions, "need"].includes(
                key,
              ),
            )
            .map(([key, value]) => [key, String(value).trim()]),
        ),
      };
      state.profileEditing = false;
      // The first complete save takes the founder straight to Matches.
      state.profileWentLive =
        !wasComplete &&
        profileCompleteness(state.profiles[state.role], state.role) === 100;
      toast("Your profile has been updated.");
      record(profileChangeText(changed), undefined, { kind: "profile" });
      return;
    }
    if (payload.form === "terms-form") {
      if (currentAgreement().locked) {
        toast("Locked terms cannot be edited.", "error");
        return;
      }
      // A draft may be partial; lock-terms checks that every term is filled.
      const values = new Map(Object.entries(payload.values));
      currentAgreement().draft = Object.fromEntries(values.entries());
      toast(
        "Draft saved and shared. Send it for approval when every term is filled in.",
      );
      return;
    }
    if (payload.form === "evidence") {
      if (
        invalid(
          `evidence-${payload.id}`,
          requiredFields(payload.values, ["attachment"]),
        )
      )
        return;
      const item = activeRoom().milestones[payload.id];
      if (!item) return;
      item.attachment = new Map(Object.entries(payload.values))
        .get("attachment")
        .trim();
      item.evidenceOpen = false;
      toast("Evidence attached to this milestone.");
      record(`You added proof to “${item.title}”.`, activeRoom().id);
      return;
    }
    if (payload.form === "schedule") {
      if (activeRoom().type !== "mentorship") return;
      const count = Number(payload.values.count || 1);
      if (
        invalid(
          "schedule",
          validateSchedule({ ...payload.values, timeZone: payload.timeZone }),
        )
      )
        return;
      activeRoom().milestones.session.schedule = {
        date: payload.values.date,
        time: payload.values.time,
        timeZone:
          payload.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(payload.values.durationMinutes
          ? { durationMinutes: Number(payload.values.durationMinutes) }
          : {}),
      };
      const first = activeRoom().milestones.session.schedule;
      activeRoom().milestones.session.schedules = weeklySchedules(first, count);
      toast("Session scheduled.");
      record("You scheduled a mentorship session.", activeRoom().id);
      return;
    }
    if (payload.form === "meeting") {
      // One meeting in an exchange collaboration, shared with the partner.
      const room = activeRoom();
      if (!takesMeetings(room)) return;
      if (terminalStatuses.includes(room.status)) {
        toast("This collaboration has ended.", "error");
        return;
      }
      const values = cleanValues(payload.values);
      if (
        invalid(
          "meeting",
          validateMeeting({ ...values, timeZone: payload.timeZone }),
        )
      )
        return;
      const meeting = {
        id: crypto.randomUUID(),
        date: values.date,
        time: values.time,
        timeZone:
          payload.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationMinutes: Number(values.durationMinutes) || 30,
        note: values.note || "",
        byAccountId: state.accountId,
        createdAt: payload.timestamp || new Date().toISOString(),
      };
      (room.meetings ||= []).push(meeting);
      toast("Meeting scheduled. Your collaborator can see it in the room.");
      record(
        `You scheduled a meeting for ${longDate(meeting.date)} at ${meeting.time}.`,
        room.id,
        { tab: "schedule" },
      );
      return;
    }
    if (payload.form !== "chat-form") return;
    const input = {
      value: payload.values.message || "",
    };
    const message = input.value.trim();
    if (!message) {
      toast("Write a message before sending.", "error");
      return;
    }
    activeRoom().messages.push({
      who: "me",
      name: roleName(),
      initials: roleInitials(),
      text: message,
      time: payload.time,
      timestamp: payload.timestamp,
    });
    record("You sent a room message.", activeRoom().id);
    toast("Message sent.");
    return;
  }
  if (payload.action === "sign-out") {
    state.confirmation = "";
    state.authenticated = false;
    state.page = "home";
    state.formErrors = null;
    state.passwordVisible = false;
    return;
  }
  if (payload.action === "toggle-password") {
    state.passwordVisible = !state.passwordVisible;
    return;
  }
  if (payload.action === "forgot-password") {
    toast("Password reset is a prototype action; no email was sent.");
    return;
  }
  if (payload.action === "google-sign-in") {
    state.authenticated = true;
    state.page = "home";
    toast("Demo sign-in successful. No account was contacted.");
    return;
  }
  if (payload.action === "create-account") {
    state.confirmation = "";
    state.authenticated = false;
    state.page = "signup";
    return;
  }
  if (payload.action === "toggle-demo") {
    state.demoOpen = !state.demoOpen;
    return;
  }
  if (payload.action === "skip-to-content") {
    return;
  }
  if (payload.action === "more-menu") {
    state.moreOpen = !state.moreOpen;
    return;
  }
  if (payload.action === "dismiss-confirmation") {
    state.confirmation = "";
    return;
  }
  if (payload.page) {
    state.formErrors = null;
    state.confirmation = "";
    if (payload.page !== "profile") state.profileEditing = false;
    state.page = payload.page;
    state.activeMentorRequest = payload.requestId || null;
    state.mentorshipActionError = null;
    state.notificationOpen = false;
    state.moreOpen = false;
    if (state.page === "rooms")
      state.activeRoomId =
        Object.values(state.rooms).find((room) => room.role === state.role)
          ?.id || null;
    if (payload.matchTab) state.matchTab = payload.matchTab;
    return;
  }
  if (payload.role) {
    state.role = payload.role;
    state.activeRoomId =
      Object.values(state.rooms).find((room) => room.role === state.role)?.id ||
      null;
    state.page = "home";
    state.profileEditing = false;
    state.moreOpen = false;
    state.demoOpen = false;
    state.formErrors = null;
    return;
  }
  const action = payload.action;
  if (!action) return;
  if (action === "demo-mutual") {
    const person =
      rolePeople().find(
        (candidate) => candidate.id === state.activeWaitingMatch,
      ) ||
      rolePeople().find((candidate) => waitingMatches().has(candidate.id)) ||
      matches()[0];
    if (person) createMutualRoom(person);
    state.demoOpen = false;
  } else if (action === "demo-partner-confirm") {
    const room = activeRoom();
    if (!room.terms.locked) {
      toast(
        "Lock your terms before simulating the partner’s confirmation.",
        "error",
      );
      return;
    }
    if (!room.terms.partnerLocked) {
      room.terms.partnerLocked = true;
      room.status = "in-progress";
      completeTermsMilestones(room);
    } else {
      Object.values(room.milestones).forEach((item) => {
        if (
          (!item.evidence || item.attachment) &&
          !item.disputed &&
          (item.title !== "Session scheduled" || item.schedule)
        ) {
          item.partner = true;
        }
      });
      room.progress = roomProgress(room);
    }
    state.confirmation = "Partner confirmation simulated for this deal room.";
    state.demoOpen = false;
    record("Partner confirmation was simulated.", room.id);
  } else if (action === "demo-partner-review") {
    if (!["launched", "reviewed"].includes(activeRoom().status)) {
      toast("Launch the collaboration before simulating a review.", "error");
      return;
    }
    activeRoom().review.partner = true;
    if (activeRoom().review.me) activeRoom().status = "reviewed";
    state.confirmation =
      "Partner review simulated. Their review stays private until yours is submitted.";
    state.demoOpen = false;
  } else if (action === "room-tab") {
    state.roomTab = payload.tab;
  } else if (action === "profile-tab") {
    state.profileTab = payload.tab;
    state.page = "profile";
    state.profileEditing = false;
    state.moreOpen = false;
  } else if (action === "edit-profile") {
    state.formErrors = null;
    state.page = "profile";
    state.profileEditing = true;
    state.moreOpen = false;
  } else if (action === "start-profile-setup") {
    // First run: open Edit profile with the description box ready to type in.
    state.formErrors = null;
    state.page = "profile";
    state.profileEditing = true;
    state.assistantFocus = true;
  } else if (action === "assistant-focused") {
    state.assistantFocus = false;
  } else if (action === "cancel-profile-edit") {
    state.profileEditing = false;
  } else if (action === "clear-filters") {
    state.matchFilters = { ...defaultMatchFilters };
  } else if (action === "match-tab") {
    state.matchTab = payload.tab || "suggested";
  } else if (action === "select-waiting") {
    state.activeWaitingMatch = payload.id;
  } else if (action === "verify-email") {
    state.onboarding.verifying = true;
  } else if (action === "analyze-story") {
    if (
      invalid(
        "onboarding",
        requiredFields({ story: field("story") }, ["story"]),
      )
    )
      return;
    saveOnboardingStory();
    state.onboarding.analyzing = true;
  } else if (action === "remove-tag" || action === "remove-pending-tag") {
    const collection =
      action === "remove-tag"
        ? state.onboarding.tags
        : state.onboarding.pendingTags;
    collection.splice(Number(payload.index), 1);
  } else if (action === "add-tag") {
    const input = {
      value: field("tag-input"),
    };
    const tag = input.value.trim();
    if (!tag) {
      toast("Enter a tag first.", "error");
      return;
    }
    const isControlled = [
      "FinTech",
      "Student tools",
      "Beta testers",
      "Product strategy",
      "Onboarding",
      "Growth",
      "Early-stage teams",
    ].some((item) => item.toLowerCase() === tag.toLowerCase());
    (isControlled ? state.onboarding.tags : state.onboarding.pendingTags).push(
      tag,
    );
  } else if (action === "match-detail") {
    state.mentorReferralId = payload.referralId || null;
    state.mentorshipActionError = null;
    state.activeMatch = payload.id;
    state.page = "match-detail";
  } else if (action === "open-room") {
    state.activeRoomId = payload.id;
    state.page = payload.review ? "review" : "room-detail";
    // Open on the tab that holds the next action rather than always on Terms.
    const opened = state.rooms[payload.id];
    state.roomTab =
      payload.tab ||
      (opened?.role === state.role && roomNextAction(opened).tab) ||
      "terms";
  } else if (
    action === "simulate-response" ||
    action === "review-proposed-terms"
  ) {
    const person = allPeople().find((item) => item.id === payload.id);
    if (action === "review-proposed-terms" && person) {
      let room = existingRoomFor(state.role, person.id);
      if (!room) {
        const id = nextRoomId(person.id);
        room = createRoom({
          id,
          role: state.role,
          partnerId: person.id,
          type: roomTypeForPerson(person),
          sender: senderForRole(state.role),
        });
        state.rooms[id] = room;
      }
      state.activeRoomId = room.id;
      state.roomTab = "terms";
      state.page = "room-detail";
    } else if (action === "simulate-response" && person) {
      createMutualRoom(person);
    }
  } else if (action === "cancel-interest") {
    waitingMatches().delete(payload.id);
    interestedMatches().delete(payload.id);
    toast("Request withdrawn.");
  } else if (action === "save") {
    const id = payload.id;
    savedMatches().has(id) ? savedMatches().delete(id) : savedMatches().add(id);
    toast(
      savedMatches().has(id)
        ? "Saved to your matches."
        : "Removed from saved matches.",
    );
  } else if (action === "interest") {
    const person = allPeople().find((item) => item.id === payload.id);
    if (!person) return;
    interestedMatches().add(payload.id);
    waitingMatches().add(payload.id);
    state.activeWaitingMatch = payload.id;
    state.page = "waiting";
    state.confirmation = `Demo request to ${person.name} recorded. No message was sent.`;
    record(`You expressed interest in ${person.name}.`);
  } else if (action === "mutual-interest") {
    const person = allPeople().find((item) => item.id === payload.id);
    createMutualRoom(person);
  } else if (action === "why") {
    const id = payload.id;
    state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
  } else if (action === "onboarding-next") {
    if (state.onboardingStep === 1 && !state.onboarding.verified) return;
    if (state.onboardingStep === 3) {
      if (
        invalid(
          "onboarding",
          requiredFields({ story: field("story") }, ["story"]),
        )
      )
        return;
      saveOnboardingStory();
      if (!state.onboarding.tags.length)
        state.onboarding.tags = state.profiles[state.role].offer
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
    }
    if (state.onboardingStep === 4) {
      const candidate = {
        bio: state.profiles[state.role].bio,
        offer: field("confirm-offer"),
        need: field("confirm-need"),
        industry: field("confirm-industry"),
        stage: field("confirm-stage"),
        teamSize: field("confirm-team"),
        expertise: field("confirm-expertise"),
        availability: field("confirm-availability"),
        startups: field("confirm-startups"),
      };
      if (
        invalid(
          "onboarding",
          validateProfile(cleanValues(candidate), state.role),
        )
      )
        return;
      const profile = state.profiles[state.role];
      Object.assign(
        profile,
        Object.fromEntries(
          profileKeys(state.role).map((key) => [
            key,
            String(candidate[key]).trim(),
          ]),
        ),
      );
      profile.goals = field("confirm-goals").trim();
    }
    state.onboardingStep = Math.min(5, state.onboardingStep + 1);
  } else if (action === "onboarding-back") {
    state.onboardingStep = Math.max(1, state.onboardingStep - 1);
  } else if (action === "choose-role") {
    if (["founder", "mentor"].includes(payload.roleChoice)) {
      if (payload.roleChoice !== state.role) state.bothRoles = true;
      state.role = payload.roleChoice;
      state.formErrors = null;
    }
  } else if (action === "toggle-both") {
    toast(
      "Dual-role accounts are unavailable in this demo. Preview either role with Demo controls.",
    );
  } else if (action === "finish-onboarding") {
    if (
      state.onboardingStep !== 5 ||
      invalid(
        "onboarding",
        validateProfile(state.profiles[state.role], state.role),
      )
    )
      return;
    state.authenticated = true;
    state.profileDone = true;
    state.page = "home";
    state.confirmation =
      "Your demo profile is ready. Changes last for this browser session.";
  } else if (action === "cancel-meeting") {
    // Either collaborator can call off a meeting; it stays in the record.
    const room = activeRoom();
    const meeting = room?.meetings?.find((item) => item.id === payload.id);
    if (!meeting || meeting.cancelledAt) return;
    meeting.cancelledAt = payload.timestamp || new Date().toISOString();
    meeting.cancelledByAccountId = state.accountId;
    toast("Meeting cancelled. Your collaborator will see it in the room.");
    record(
      `You cancelled the meeting on ${longDate(meeting.date)} at ${meeting.time}.`,
      room.id,
      { tab: "schedule" },
    );
  } else if (action === "confirm-milestone" || action === "partner-confirm") {
    const id = payload.id;
    const milestone = activeRoom().milestones[id];
    if (!milestone) return;
    if (milestone.disputed) {
      toast(
        "Resolve this dispute together before confirming the milestone.",
        "error",
      );
      return;
    }
    if (!currentAgreement().locked || !currentAgreement().partnerLocked) {
      toast("Both partners must agree to terms first.", "error");
      return;
    }
    if (id === "session" && !milestone.schedule) {
      toast("Schedule the session before confirming it.", "error");
      return;
    }
    if (milestone.evidence && !milestone.attachment) {
      toast("Attach evidence before confirming this milestone.", "error");
      return;
    }
    milestone[action === "confirm-milestone" ? "me" : "partner"] = true;
    activeRoom().progress = Math.round(
      (Object.values(activeRoom().milestones).filter(
        (item) => item.me && item.partner,
      ).length /
        5) *
        100,
    );
    toast(
      action === "confirm-milestone"
        ? "Your confirmation is recorded."
        : "Partner confirmation simulated for this prototype.",
    );
    record(
      `${action === "confirm-milestone" ? "You confirmed" : "Simulated partner confirmation for"} “${milestone.title}”.`,
      activeRoom().id,
    );
    if (
      !payload.serverManaged &&
      !launchBlockers(activeRoom()).length &&
      activeRoom().terms.draft.format !== "ongoing"
    ) {
      activeRoom().status = "launched";
      activeRoom().launchedAt = payload.timestamp || new Date().toISOString();
      state.page = "review";
      state.rating = 0;
      state.confirmation =
        activeRoom().type === "mentorship"
          ? "Your mentorship completed. Review within 14 days."
          : "Your deal launched. Review within 14 days.";
    }
  } else if (action === "evidence-toggle") {
    const item = activeRoom().milestones[payload.id];
    if (!item) return;
    item.evidenceOpen = !item.evidenceOpen;
  } else if (action === "dispute") {
    const item = activeRoom().milestones[payload.id];
    if (!item) return;
    if (!currentAgreement().locked || !currentAgreement().partnerLocked) {
      toast("Agree on terms together before flagging a dispute.", "error");
      return;
    }
    const reason = String(payload.values?.reason || "").trim();
    if (
      invalid(
        `dispute-${payload.id}`,
        reason ? {} : { reason: "Describe what is disputed." },
      )
    )
      return;
    item.disputed = true;
    item.dispute = {
      reason: reason.slice(0, 1000),
      outcome: String(payload.values?.outcome || "")
        .trim()
        .slice(0, 1000),
      byAccountId: state.accountId,
      at: payload.timestamp || new Date().toISOString(),
    };
    record(`You flagged a dispute on “${item.title}”.`, activeRoom().id);
    toast(
      "Dispute flagged. Your collaborator can see your reason. If it is not resolved, either of you can send it to a moderator.",
    );
  } else if (action === "lock-terms") {
    if (currentAgreement().locked) return;
    const terms = cleanValues(payload.values || {});
    if (invalid("terms-form", validateTerms(terms))) return;
    const agreement = currentAgreement();
    agreement.draft = terms;
    agreement.locked = true;
    activeRoom().status = "terms";
    state.confirmation =
      "Terms are locked. Your partner can now review and confirm them.";
  } else if (action === "partner-lock-terms") {
    const agreement = currentAgreement();
    if (!agreement.locked) {
      toast("Lock your terms first.", "error");
      return;
    }
    agreement.partnerLocked = true;
    activeRoom().status = "in-progress";
    completeTermsMilestones(activeRoom());
    state.confirmation = "Your partner confirmed the shared terms.";
  } else if (action === "launch-room") {
    if (
      ["launched", "reviewed"].includes(activeRoom().status) ||
      activeRoom().terms.draft.format === "ongoing"
    )
      return;
    const reasons = launchBlockers(activeRoom());
    if (reasons.length) {
      toast(reasons[0], "error");
      return;
    }
    activeRoom().status = "launched";
    state.rating = 0;
    state.page = "review";
    state.confirmation =
      activeRoom().type === "mentorship"
        ? "Your mentorship is complete. Share a private review when you’re ready."
        : "Your collaboration is marked as launched. Share a private review when you’re ready.";
    record(
      activeRoom().type === "mentorship"
        ? "You completed the mentorship after both collaborators confirmed every milestone."
        : "You marked the completed collaboration as launched.",
      activeRoom().id,
    );
  } else if (action === "partner-review") {
    if (!["launched", "reviewed"].includes(activeRoom().status)) return;
    activeRoom().review.partner = true;
    if (activeRoom().review.me) activeRoom().status = "reviewed";
    state.confirmation = "Partner review simulated.";
  } else if (action === "milestone-help") {
    toast("A milestone is complete when both people confirm it.", "info");
  } else if (action === "room-history") {
    toast("Your completed rooms stay here as a shared record.", "info");
  } else if (action === "report") {
    toast("A private report form would open here in the full product.");
  }
}
