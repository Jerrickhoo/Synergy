import { createModel } from "../data/model.js";
import { readField } from "./fields.js";
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
  const toast = (message) => {
    state.toast = message;
  };
  if (payload.action === "set-toast") {
    state.toast = payload.message;
    return;
  }
  const nextRoomId = (personId) =>
    `room-${state.role}-${personId}-${payload.roomId}`;
  function saveOnboardingStory() {
    state.profiles[state.role].bio = field("story").trim();
  }
  function createMutualRoom(person) {
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
    return;
  }
  if (payload.action === "set-filter") {
    state.matchFilters[payload.key] = payload.value;
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
    state.authenticated = true;
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
  if (payload.action === "verification-done") {
    state.onboarding.verifying = false;
    state.onboarding.verified = true;
    return;
  }
  if (payload.action === "analysis-done") {
    state.onboarding.analyzing = false;
    state.onboarding.analyzed = true;
    state.onboarding.tags =
      state.role === "founder"
        ? ["FinTech", "Student tools", "Beta testers"]
        : ["Product strategy", "Onboarding", "Growth"];
    state.onboarding.pendingTags = ["Impact Tech"];
    return;
  }
  if (payload.form) {
    if (payload.form === "signup-form") {
      const values = new Map(Object.entries(payload.values));
      const firstName = values.get("firstName").trim();
      const lastName = values.get("lastName").trim();
      state.accountName = `${firstName} ${lastName}`;
      state.onboarding.signup = {
        firstName,
        lastName,
        email: values.get("email").trim(),
      };
      state.onboarding.verified = false;
      state.onboardingStep = 1;
      state.role = "founder";
      state.authenticated = true;
      state.page = "onboarding";
      return;
    }
    if (payload.form === "login-form") {
      state.authenticated = true;
      state.page = "home";
      toast("Demo sign-in successful. Credentials were not stored.");
      return;
    }
    if (payload.form === "review-form") {
      const values = new Map(Object.entries(payload.values));
      const rating = values.get("rating");
      if (!rating) {
        toast("Choose a rating before submitting.");
        return;
      }
      activeRoom().review.me = true;
      activeRoom().review.rating = Number(rating);
      activeRoom().review.note = String(values.get("note") || "").trim();
      if (activeRoom().review.partner) activeRoom().status = "reviewed";
      state.confirmation = "";
      return;
    }
    if (payload.form === "profile-form") {
      const values = new Map(Object.entries(payload.values));
      state.profiles[state.role] = Object.fromEntries(
        [...values.entries()].map(([key, value]) => [
          key,
          String(value).trim(),
        ]),
      );
      state.profileEditing = false;
      toast("Your profile has been updated.");
      return;
    }
    if (payload.form === "terms-form") {
      const values = new Map(Object.entries(payload.values));
      currentAgreement().draft = Object.fromEntries(values.entries());
      toast("Terms draft saved. Lock them when you’re ready to confirm.");
      return;
    }
    if (payload.form === "evidence") {
      const item = activeRoom().milestones[payload.id];
      item.attachment = new Map(Object.entries(payload.values))
        .get("attachment")
        .trim();
      item.evidenceOpen = false;
      toast("Evidence attached to this milestone.");
      return;
    }
    if (payload.form === "schedule") {
      const values = new Map(Object.entries(payload.values));
      activeRoom().milestones.session.schedule = `${values.get("date")} · ${values.get("time")}`;
      toast("Session scheduled.");
      return;
    }
    if (payload.form !== "chat-form") return;
    const input = {
      value: payload.values.message || "",
    };
    const message = input.value.trim();
    if (!message) {
      toast("Write a message before sending.");
      return;
    }
    activeRoom().messages.push({
      who: "me",
      name: roleName(),
      initials: roleInitials(),
      text: message,
      time: payload.time,
    });
    toast("Message added to this prototype room.");
    return;
  }
  if (payload.action === "sign-out") {
    state.confirmation = "";
    state.authenticated = false;
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
    state.authenticated = true;
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
    state.confirmation = "";
    if (payload.page !== "profile") state.profileEditing = false;
    state.page = payload.page;
    state.moreOpen = false;
    if (state.page === "rooms")
      state.activeRoomId =
        state.role === "founder" ? "founder-campus" : "mentor-budgetbuddy";
    if (payload.matchTab) state.matchTab = payload.matchTab;
    return;
  }
  if (payload.role) {
    state.role = payload.role;
    state.activeRoomId =
      state.role === "founder" ? "founder-campus" : "mentor-budgetbuddy";
    state.page = "home";
    state.profileEditing = false;
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
    if (!room.terms.partnerLocked) {
      room.terms.locked = true;
      room.terms.partnerLocked = true;
      room.status = "in-progress";
    } else {
      Object.values(room.milestones).forEach((item) => {
        item.me = true;
        item.partner = true;
      });
      room.progress = 100;
    }
    state.confirmation = "Partner confirmation simulated for this deal room.";
    state.demoOpen = false;
  } else if (action === "demo-partner-review") {
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
    state.profileEditing = true;
  } else if (action === "cancel-profile-edit") {
    state.profileEditing = false;
  } else if (action === "clear-filters") {
    state.matchFilters = {
      search: "",
      type: "all",
      industry: "all",
      score: "0",
      engagement: "all",
    };
  } else if (action === "match-tab") {
    state.matchTab = payload.tab;
  } else if (action === "select-waiting") {
    state.activeWaitingMatch = payload.id;
  } else if (action === "verify-email") {
    state.onboarding.verifying = true;
  } else if (action === "analyze-story") {
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
      toast("Enter a tag first.");
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
    state.activeMatch = payload.id;
    state.page = "match-detail";
  } else if (action === "open-room") {
    state.activeRoomId = payload.id;
    state.page = "room-detail";
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
    toast("Introduction withdrawn.");
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
    state.confirmation = `Your introduction to ${person.name} is on its way.`;
  } else if (action === "mutual-interest") {
    const person = allPeople().find((item) => item.id === payload.id);
    createMutualRoom(person);
  } else if (action === "why") {
    const id = payload.id;
    state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
  } else if (action === "onboarding-next") {
    if (state.onboardingStep === 3) {
      saveOnboardingStory();
      if (!state.onboarding.tags.length)
        state.onboarding.tags = state.profiles[state.role].offer
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
      if (!state.onboarding.pendingTags.length)
        state.onboarding.pendingTags = ["Impact Tech"];
    }
    if (state.onboardingStep === 4) {
      const profile = state.profiles[state.role];
      profile.offer = field("confirm-offer");
      profile.need = field("confirm-need");
      if (state.role === "founder") {
        profile.industry = field("confirm-industry");
        profile.stage = field("confirm-stage");
        profile.teamSize = field("confirm-team");
      } else {
        profile.expertise = field("confirm-expertise");
        profile.availability = field("confirm-availability");
        profile.startups = field("confirm-startups");
      }
      profile.goals = field("confirm-goals");
    }
    state.onboardingStep = Math.min(5, state.onboardingStep + 1);
  } else if (action === "onboarding-back") {
    state.onboardingStep = Math.max(1, state.onboardingStep - 1);
  } else if (action === "choose-role") {
    state.role = payload.roleChoice;
  } else if (action === "toggle-both") {
    state.bothRoles = !state.bothRoles;
    toast(
      state.bothRoles
        ? "Founder and mentor roles are both enabled."
        : "Removed the additional role.",
    );
  } else if (action === "finish-onboarding") {
    state.profileDone = true;
    state.page = "home";
    state.confirmation =
      "Your profile is live. Better-fit people can find you now.";
  } else if (action === "confirm-milestone" || action === "partner-confirm") {
    const id = payload.id;
    const milestone = activeRoom().milestones[id];
    if (
      action === "confirm-milestone" &&
      milestone.evidence &&
      !milestone.attachment
    ) {
      toast("Attach evidence before confirming this milestone.");
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
  } else if (action === "evidence-toggle") {
    const item = activeRoom().milestones[payload.id];
    item.evidenceOpen = !item.evidenceOpen;
  } else if (action === "dispute") {
    activeRoom().milestones[payload.id].disputed = true;
    toast("Dispute flagged. It’s noted on this milestone for both sides.");
  } else if (action === "lock-terms") {
    const agreement = currentAgreement();
    agreement.draft = payload.values;
    agreement.locked = true;
    activeRoom().status = "terms";
    state.confirmation =
      "Terms are locked. Your partner can now review and confirm them.";
  } else if (action === "partner-lock-terms") {
    const agreement = currentAgreement();
    agreement.partnerLocked = true;
    activeRoom().status = "in-progress";
    state.confirmation = "Your partner confirmed the shared terms.";
  } else if (action === "launch-room") {
    activeRoom().status = "launched";
    state.page = "review";
    state.confirmation =
      "Your collaboration is marked as launched. Share a private review when you’re ready.";
  } else if (action === "partner-review") {
    activeRoom().review.partner = true;
    if (activeRoom().review.me) activeRoom().status = "reviewed";
    state.confirmation = "Partner review simulated.";
  } else if (action === "digest") {
    toast("Weekly match digest selected.");
  } else if (action === "milestone-help") {
    toast("A milestone is complete when both people confirm it.");
  } else if (action === "room-history") {
    toast("Your completed rooms stay here as a shared record.");
  } else if (action === "report") {
    toast("A private report form would open here in the full product.");
  }
}
