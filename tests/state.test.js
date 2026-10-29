import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, createModel } from "../src/data/model.js";
import { createSeededState } from "./fixtures.js";
import {
  activeRooms,
  launchBlockers,
  profileCompleteness,
} from "../src/data/selectors.js";
import { transition } from "../src/state/transitions.js";
import { applyRoute, parseRoute, routeHash } from "../src/state/routes.js";
import {
  connectionInterrupted,
  connectionRestored,
  connectionMessage,
} from "../src/state/feedback.js";
import {
  validateCredentials,
  validateProfile,
  validateSchedule,
} from "../src/state/validation.js";

test("connection outages stay in one persistent notice and recovery announces once", () => {
  const state = createInitialState();
  for (let poll = 0; poll < 4; poll++) connectionInterrupted(state);
  assert.equal(state.connectionError, connectionMessage);
  assert.equal(state.toast, "");
  assert.equal(state.toastId, 0);
  connectionRestored(state);
  assert.equal(state.connectionError, "");
  assert.match(state.toast, /connected again/);
  const recoveryId = state.toastId;
  connectionRestored(state);
  assert.equal(state.toastId, recoveryId);
  state.toast = "";
  connectionInterrupted(state);
  assert.equal(state.connectionError, connectionMessage);
  assert.equal(state.toast, "");
});

test("an interrupted save keeps its form open with inline retry guidance", () => {
  const state = createInitialState();
  state.profileEditing = true;
  connectionInterrupted(state, { scope: "profile-form", saving: true });
  assert.equal(state.profileEditing, true);
  assert.equal(state.formErrors.scope, "profile-form");
  assert.match(state.formErrors.fields._request, /couldn't confirm/);
  assert.match(state.connectionError, /last change/);
  connectionInterrupted(state);
  assert.match(state.connectionError, /last change/);
  assert.equal(state.toast, "");
  connectionRestored(state, false);
  assert.equal(state.toast, "");
  assert.equal(state.connectionError, "");
  assert.match(state.formErrors.fields._request, /try again/);
});

const readyRoom = (state) => {
  const room = state.rooms["founder-campus"];
  Object.values(room.milestones).forEach((item) => {
    item.me = true;
    item.partner = true;
    if (item.evidence) item.attachment = "Demo results";
  });
  return room;
};

test("a fresh account contains no fabricated identity or workspace records", () => {
  const state = createInitialState();
  const model = createModel(state);
  assert.equal(state.accountName, "");
  assert.equal(state.accountEmail, "");
  assert.equal(state.activeRoomId, null);
  assert.deepEqual(state.rooms, {});
  assert.deepEqual(state.activity, []);
  assert.deepEqual(model.allPeople(), []);
  for (const role of ["founder", "mentor"]) {
    state.role = role;
    assert.equal(profileCompleteness(state.profiles[role], role), 0);
    assert.ok(
      Object.values(state.profiles[role]).every((value) => value === ""),
    );
    assert.equal(model.matches().length, 0);
    assert.equal(model.browsePeople().length, 0);
    assert.equal(model.savedMatches().size, 0);
    assert.equal(model.waitingMatches().size, 0);
    assert.equal(model.interestedMatches().size, 0);
    assert.deepEqual(state.trustHistoryByRole[role], []);
  }
});

test("signup starts clean, skips simulated onboarding and uses only supplied identity", () => {
  const state = createSeededState();
  transition(state, {
    form: "signup-form",
    values: {
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@example.com",
      password: "private-password",
      role: "mentor",
    },
  });
  assert.equal(state.accountName, "Alex Rivera");
  assert.equal(state.accountEmail, "alex@example.com");
  assert.equal(state.role, "mentor");
  assert.equal(state.page, "home");
  assert.equal(state.authenticated, true);
  assert.deepEqual(state.rooms, {});
  assert.deepEqual(state.activity, []);
  assert.deepEqual(createModel(state).allPeople(), []);
  assert.equal(profileCompleteness(state.profiles.mentor, "mentor"), 0);
  assert.equal(JSON.stringify(state).includes("private-password"), false);
});

test("different local sign-ins cannot inherit the previous account's profile or activity", () => {
  const state = createInitialState();
  transition(state, {
    form: "login-form",
    values: { email: "first@example.com", password: "1234" },
  });
  state.accountName = "First Person";
  state.profiles.founder.bio = "My own introduction";
  state.activity.push({ role: "founder", text: "Private activity" });
  transition(state, { action: "sign-out" });
  transition(state, {
    form: "login-form",
    values: { email: "second@example.com", password: "1234" },
  });
  assert.equal(state.accountName, "");
  assert.equal(state.profiles.founder.bio, "");
  assert.deepEqual(state.activity, []);
});

test("new collaboration rooms have no fabricated conversations or agreement details", () => {
  const state = createSeededState();
  const room = createModel(state).createRoom({
    id: "new",
    role: "founder",
    partnerId: "david",
    type: "mentorship",
  });
  assert.deepEqual(room.messages, []);
  assert.equal(room.targetDate, "");
  assert.ok(Object.values(room.terms.draft).every((value) => value === ""));
  assert.equal(room.terms.locked, false);
  assert.equal(room.progress, 0);
  assert.ok(
    Object.values(room.milestones).every(
      (item) => !item.me && !item.partner && !item.schedule,
    ),
  );
});

test("URLs never establish a demo session, including browser navigation after sign-out", () => {
  const state = createSeededState();
  for (const hash of [
    "#/",
    "#/profile",
    "#/rooms/founder-campus",
    "#/nonsense",
  ]) {
    applyRoute(state, parseRoute(hash));
    assert.equal(state.authenticated, false);
    assert.equal(routeHash(state), "#/login");
  }
  transition(state, {
    form: "login-form",
    values: { email: "demo@example.com", password: "demo1234" },
  });
  applyRoute(state, parseRoute("#/matches/david"));
  assert.equal(state.page, "match-detail");
  assert.equal(state.activeMatch, "david");
  assert.equal(routeHash(state), "#/matches/david");
  transition(state, { action: "sign-out" });
  applyRoute(state, parseRoute("#/rooms/founder-campus"));
  assert.equal(state.authenticated, false);
});

test("malformed routes are safe and room identifiers do not fall back or cross roles", () => {
  assert.equal(parseRoute("#/rooms/%E0%A4%A").page, "not-found");
  const state = createSeededState();
  state.activeRoomId = "missing";
  assert.equal(createModel(state).activeRoom(), null);
  state.activeRoomId = "mentor-budgetbuddy";
  assert.equal(createModel(state).activeRoom(), null);
  const before = structuredClone(state.rooms["mentor-budgetbuddy"]);
  transition(state, { action: "launch-room" });
  assert.deepEqual(state.rooms["mentor-budgetbuddy"], before);
});

test("launch requires mutual milestones, evidence, and no disputes at the reducer boundary", () => {
  const state = createSeededState();
  transition(state, { action: "launch-room" });
  assert.equal(state.rooms["founder-campus"].status, "in-progress");
  const room = readyRoom(state);
  room.milestones.testing.attachment = "";
  assert.ok(launchBlockers(room).some((reason) => reason.includes("evidence")));
  transition(state, { action: "launch-room" });
  assert.equal(room.status, "in-progress");
  room.milestones.testing.attachment = "Demo results";
  room.milestones.testing.disputed = true;
  transition(state, { action: "launch-room" });
  assert.equal(room.status, "in-progress");
  room.milestones.testing.disputed = false;
  transition(state, { action: "launch-room" });
  assert.equal(room.status, "launched");
  assert.equal(activeRooms(state).length, 0);
  assert.equal(state.page, "review");
});

test("simulated confirmations cannot bypass evidence or disputes", () => {
  const state = createSeededState();
  state.rooms["founder-campus"].milestones.testing.disputed = true;
  transition(state, { action: "demo-partner-confirm" });
  const room = state.rooms["founder-campus"];
  assert.equal(room.milestones.testing.me, false);
  assert.equal(room.milestones.feedback.me, false);
  assert.ok(
    Object.values(room.milestones).some(
      (item) => !item.evidence && item.partner && !item.me,
    ),
  );
  assert.ok(launchBlockers(room).length);
});

test("invalid profiles and blank evidence do not change saved records", () => {
  const state = createSeededState();
  const profile = structuredClone(state.profiles.founder);
  transition(state, {
    form: "profile-form",
    values: { ...profile, bio: " ", teamSize: "-1" },
  });
  assert.deepEqual(state.profiles.founder, profile);
  assert.ok(state.formErrors.fields.bio);
  assert.ok(state.formErrors.fields.teamSize);
  transition(state, {
    form: "evidence",
    id: "testing",
    values: { attachment: "   " },
  });
  assert.equal(state.rooms["founder-campus"].milestones.testing.attachment, "");
  assert.equal(
    validateProfile({ ...profile, stage: "arbitrary" }, "founder").stage,
    "Choose a valid stage.",
  );
  assert.equal(profileCompleteness(profile, "founder"), 100);
});

test("credentials validate locally without retaining passwords", () => {
  const state = createSeededState();
  transition(state, {
    form: "login-form",
    values: { email: "bad", password: "1234" },
  });
  assert.equal(state.authenticated, false);
  assert.ok(
    validateCredentials(
      {
        firstName: " ",
        lastName: "Person",
        email: "test@example.com",
        password: "12345678",
      },
      true,
    ).firstName,
  );
  transition(state, {
    form: "login-form",
    values: { email: "demo@example.com", password: "demo1234" },
  });
  assert.equal(state.authenticated, true);
  assert.equal(
    JSON.stringify(state, (_, value) =>
      value instanceof Set ? [...value] : value,
    ).includes("demo1234"),
    false,
  );
});

test("session validation rejects past and impossible dates, and keeps the user's timezone", () => {
  const now = new Date("2026-10-19T10:00:00");
  assert.ok(validateSchedule({ date: "2026-10-18", time: "10:00" }, now).date);
  assert.ok(validateSchedule({ date: "2027-02-30", time: "10:00" }, now).date);
  assert.deepEqual(
    validateSchedule({ date: "2027-11-01", time: "10:00" }, now),
    {},
  );
  const state = createSeededState();
  state.role = "mentor";
  state.activeRoomId = "mentor-budgetbuddy";
  const item = state.rooms[state.activeRoomId].milestones.session;
  assert.equal(item.me, false);
  assert.equal(item.schedule, null);
  transition(state, {
    form: "schedule",
    values: { date: "2999-11-01", time: "10:00" },
    timeZone: "Asia/Manila",
  });
  assert.deepEqual(item.schedule, {
    date: "2999-11-01",
    time: "10:00",
    timeZone: "Asia/Manila",
  });
});

test("unlaunched rooms cannot accept reviews; completing reviews stays local", () => {
  const state = createSeededState();
  transition(state, {
    form: "review-form",
    values: { rating: "5", note: "Great" },
  });
  assert.equal(state.rooms["founder-campus"].review.me, false);
  const history = structuredClone(state.trustHistoryByRole.founder);
  readyRoom(state);
  transition(state, { action: "launch-room" });
  transition(state, {
    form: "review-form",
    values: { rating: "6", note: "Great" },
  });
  assert.equal(state.rooms["founder-campus"].review.me, false);
  transition(state, {
    form: "review-form",
    values: { rating: "5", note: "Great" },
  });
  transition(state, { action: "demo-partner-review" });
  assert.equal(state.rooms["founder-campus"].status, "reviewed");
  assert.deepEqual(state.trustHistoryByRole.founder, history);
});
