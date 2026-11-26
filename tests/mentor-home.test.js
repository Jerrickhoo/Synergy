import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, createModel } from "../src/data/model.js";
import { appointment, initMentorship } from "../src/data/mentor-room.js";
import { roomNextAction } from "../src/data/selectors.js";
import {
  mentorHelpReason,
  mentorNextStep,
  mentorStepLabel,
  waitingText,
} from "../src/data/mentor-home.js";

const now = Date.parse("2030-04-02T12:00:00Z");
const hours = 3600000;
const mentorProfile = {
  bio: "Mentor",
  offer: "Pricing strategy",
  need: "Questions",
  expertise: "Pricing, Fundraising",
  availability: "Weekly",
  startups: "Early teams",
};

function mentorState() {
  const state = createInitialState();
  state.role = "mentor";
  state.profiles.mentor = { ...mentorProfile };
  state.directory.roomPartners.push(
    { id: "acme", name: "Acme", kind: "Startup" },
    { id: "bolt", name: "Bolt", kind: "Startup" },
  );
  return state;
}

function addRoom(state, id, partnerId, format) {
  const room = initMentorship(
    { id, type: "mentorship", role: "mentor", partnerId, terms: { draft: {} } },
    format,
    "Fixture goal",
    now - 48 * hours,
  );
  room.review = {};
  state.rooms[id] = room;
  return room;
}

const step = (state) => mentorNextStep(state, createModel(state), now);

test("a quiet mentor is sent to set up, then to Startups you can help", () => {
  const state = mentorState();
  state.profiles.mentor.bio = "";
  assert.equal(step(state).command.action, "edit-profile");
  assert.match(step(state).detail, /Still to add/);
  state.profiles.mentor.bio = "Mentor";
  assert.equal(step(state).generic, true);
  assert.equal(step(state).command.page, "discover");
  // The application banner already holds the action.
  state.mentorApplication = { status: "submitted" };
  assert.equal(step(state), null);
});

test("the mentor's next step ranks expiring requests, then their turn, then other requests", () => {
  const state = mentorState();
  addRoom(state, "goal-room", "acme", "single-session");
  const goal = step(state);
  assert.equal(goal.label, "Confirm goal");
  assert.equal(goal.title, "Confirm Acme's mentorship goal");
  assert.deepEqual(goal.command, {
    action: "open-room",
    id: "goal-room",
    tab: "overview",
    review: undefined,
  });

  // A past session without the mentor's attendance outranks the goal
  // (the room reads the real clock for attendance).
  const held = addRoom(state, "held-room", "bolt", "single-session");
  held.milestones.goal.me = true;
  held.milestones.held.schedules = [
    appointment({
      id: "s1",
      date: "2020-04-01",
      time: "10:00",
      timeZone: "UTC",
      durationMinutes: 60,
    }),
  ];
  assert.equal(step(state).label, "Report attendance");
  assert.equal(step(state).command.tab, "schedule");
  assert.equal(step(state).command.id, "held-room");

  // A request not about to expire waits behind mentee work…
  state.mentorRequests = [
    {
      id: "req-later",
      name: "Later Co",
      expiresAt: new Date(now + 72 * hours).toISOString(),
    },
  ];
  assert.equal(step(state).command.id, "held-room");
  // …but one expiring within a day comes first and opens that request.
  state.mentorRequests.push({
    id: "req-soon",
    name: "Soon Co",
    expiresAt: new Date(now + 5 * hours).toISOString(),
  });
  assert.deepEqual(step(state).command, {
    page: "requests",
    requestId: "req-soon",
  });
  assert.match(step(state).detail, /expires in 5 hours/);
  assert.match(step(state).detail, /3 more things need you/);

  // With no mentee steps, the soonest request is next.
  delete state.rooms["goal-room"];
  delete state.rooms["held-room"];
  state.mentorRequests.pop();
  assert.equal(step(state).command.requestId, "req-later");
});

test("asynchronous formats ask the mentor to deliver, and waiting names the founder", () => {
  const state = mentorState();
  const room = addRoom(state, "doc", "acme", "doc-review");
  const next = roomNextAction(room, "Acme");
  assert.equal(mentorStepLabel(next), "Deliver review");
  assert.equal(step(state).title, "Deliver your review for Acme");

  room.mentorship.deliveredAt = new Date(now).toISOString();
  const advisory = addRoom(state, "adv", "bolt", "ongoing-advisory");
  advisory.milestones.goals.me = true;
  advisory.cycle = { number: 1, phase: "active", goals: "Grow" };
  const waiting = roomNextAction(advisory, "Bolt");
  assert.equal(waiting.mine, false);
  assert.equal(mentorStepLabel(waiting), "Open room");
  assert.equal(
    waitingText(waiting, "Bolt"),
    "Waiting for Bolt to propose a check-in time",
  );
  advisory.cycle.proposedTime = { proposedBy: "founder", date: "2030-04-09" };
  assert.equal(mentorStepLabel(roomNextAction(advisory)), "Confirm check-in");
});

test("suggested startups say which need matches the mentor's expertise", () => {
  const state = mentorState();
  const model = createModel(state);
  const startup = { need: ["Pricing strategy", "Hiring"], exchange: {} };
  assert.deepEqual(model.helpedNeeds(startup), ["Pricing strategy"]);
  assert.equal(model.coversNeed(startup), true);
  assert.equal(model.coversNeed({ need: ["Hiring"], exchange: {} }), false);
  assert.equal(
    mentorHelpReason(["Pricing strategy"], state.profiles.mentor),
    "Needs pricing strategy, matching your pricing expertise",
  );
  assert.equal(
    mentorHelpReason(["Fundraising", "Pricing"], state.profiles.mentor),
    "Needs fundraising and 1 more, your area of expertise",
  );
  assert.equal(
    mentorHelpReason(["Product feedback"], {
      expertise: "Growth",
      offer: "Product feedback",
    }),
    "Needs product feedback, which you offer",
  );
});
