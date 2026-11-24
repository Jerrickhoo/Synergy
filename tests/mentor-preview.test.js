// Prototype evaluation readiness (Phase 1): a mentor preview can be tested on
// its own. It starts with one request from a fictional founder and can take
// the mentorship room to Reviewed with prototype shortcuts.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { mentorSessions } from "../src/data/mentor-room.js";
import {
  previewMentorName,
  sampleMentorRequest,
} from "../server/demo-directory.js";

function workspaceFor(t, options = { demoMode: true }) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-mentor-preview-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), options);
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return workspace;
}

const futureDate = () =>
  new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test("a new mentor preview has its own name and one sample request", (t) => {
  const workspace = workspaceFor(t);
  const mentor = workspace.openDemo("mentor", {
    email: "mentor@example.com",
    password: "pw",
  });
  assert.equal(mentor.state.accountName, previewMentorName);
  assert.notEqual(previewMentorName, "David Park");
  assert.equal(mentor.state.profiles.mentor.image, "");
  const requests = mentor.state.mentorRequests;
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].partnerId,
    `${sampleMentorRequest.accountId}:founder`,
  );
  assert.equal(requests[0].problem, sampleMentorRequest.problem);
  assert.ok(
    mentor.state.notifications.some((item) =>
      /sent a mentorship request/.test(item.text),
    ),
  );
  // Signing in again does not add a second request.
  const again = workspace.openDemo("mentor", {
    email: "mentor@example.com",
    password: "pw",
  });
  assert.equal(again.state.mentorRequests.length, 1);
});

test("a mentor preview takes the sample request to Reviewed", (t) => {
  const workspace = workspaceFor(t);
  const mentor = workspace.openDemo("mentor", {
    email: "mentor@example.com",
    password: "pw",
  });
  const accepted = workspace.act(mentor.token, {
    role: "mentor",
    action: "accept-request",
    id: `${sampleMentorRequest.accountId}:founder`,
  }).state;
  const roomId = accepted.activeRoomId;
  const run = (command) =>
    workspace.act(mentor.token, {
      role: "mentor",
      activeRoomId: roomId,
      ...command,
    }).state;
  const room = (state) => state.rooms[roomId];

  // The whole request travels into the room.
  const opened = room(accepted);
  assert.equal(opened.mentorship.problem, sampleMentorRequest.problem);
  assert.equal(opened.mentorship.tried, sampleMentorRequest.tried);

  run({
    action: "confirm-goal",
    values: { goal: "Pick the first onboarding step to redesign" },
  });
  run({
    form: "schedule",
    values: {
      date: futureDate(),
      time: "10:00",
      timeZone: "UTC",
      durationMinutes: "60",
    },
  });
  const heldState = run({ action: "simulate-session-held" });
  const held = room(heldState);
  assert.equal(mentorSessions(held)[0].outcome, "held");
  assert.ok(held.mentorship.followup.submittedAt);
  // The fictional founder reports what the mentoring led to.
  assert.match(held.mentorship.followup.summary, /9 of 12 students/);
  assert.doesNotMatch(held.mentorship.followup.summary, /fictional/i);
  assert.ok(held.mentorship.reviewOpenedAt);
  assert.ok(
    heldState.notifications.some((item) =>
      /shared a simulated follow-up/.test(item.text),
    ),
  );

  const reviewedState = run({
    form: "review-form",
    values: { preparedness: "5", followThrough: "4" },
  });
  const reviewed = room(reviewedState);
  assert.equal(reviewed.status, "reviewed");
  assert.equal(reviewed.review.partner, true);
  assert.doesNotMatch(reviewed.review.partnerNote, /fictional/i);
  // The founder rates each question, and the rating is their average.
  assert.deepEqual(reviewed.review.partnerScores, {
    usefulness: 5,
    clarity: 4,
    responsiveness: 4,
  });
  assert.equal(reviewed.review.partnerRating, 4.3);
  // The notice still says the review was simulated.
  assert.ok(
    reviewedState.notifications.some((item) =>
      /simulated response from a fictional founder/.test(item.text),
    ),
  );
});

test("answering the sample request clears it from Needs you", (t) => {
  const workspace = workspaceFor(t);
  const id = `${sampleMentorRequest.accountId}:founder`;
  for (const [email, action, values] of [
    ["accept@example.com", "accept-request"],
    ["decline@example.com", "decline-request", { reason: "not-a-fit" }],
  ]) {
    const mentor = workspace.openDemo("mentor", { email, password: "pw" });
    const request = (state) =>
      state.notifications.find((item) => item.kind === "request");
    assert.equal(request(mentor.state).read, false);
    const state = workspace.act(mentor.token, {
      role: "mentor",
      action,
      id,
      values,
    }).state;
    assert.equal(request(state).read, true, action);
  }
});

test("one preview mentor's review never reaches another preview's view of the startup", (t) => {
  const workspace = workspaceFor(t);
  const id = `${sampleMentorRequest.accountId}:founder`;
  const first = workspace.openDemo("mentor", {
    email: "first@example.com",
    password: "pw",
  });
  const roomId = workspace.act(first.token, {
    role: "mentor",
    action: "accept-request",
    id,
  }).state.activeRoomId;
  const run = (command) =>
    workspace.act(first.token, {
      role: "mentor",
      activeRoomId: roomId,
      ...command,
    }).state;
  run({ action: "confirm-goal", values: { goal: "One change to test" } });
  run({
    form: "schedule",
    values: {
      date: futureDate(),
      time: "10:00",
      timeZone: "UTC",
      durationMinutes: "60",
    },
  });
  run({ action: "simulate-session-held" });
  assert.equal(
    run({
      form: "review-form",
      values: { preparedness: "2", followThrough: "2" },
    }).rooms[roomId].status,
    "reviewed",
  );

  const second = workspace.openDemo("mentor", {
    email: "second@example.com",
    password: "pw",
  });
  const startup = second.state.directory.mentorStartups.find(
    (person) => person.id === id,
  );
  assert.equal(startup.trust.completed, 0);
  assert.equal(startup.founderTrackRecord.newFounder, true);
  assert.equal(second.state.mentorRequests[0].trackRecord.newFounder, true);
});

test("a mentor-started room proposes the startup's own goal", (t) => {
  const workspace = workspaceFor(t);
  const mentor = workspace.openDemo("mentor");
  const startup = mentor.state.directory.mentorStartups.find(
    (person) => person.id === `${sampleMentorRequest.accountId}:founder`,
  );
  workspace.act(mentor.token, {
    role: "mentor",
    action: "interest",
    id: startup.id,
  });
  const state = workspace.act(mentor.token, {
    role: "mentor",
    action: "simulate-acceptance",
    id: startup.id,
  }).state;
  const room = state.rooms[state.activeRoomId];
  assert.equal(room.terms.draft.goal, startup.goals);
});

test("a mentor's outreach note never replaces the startup's goal", (t) => {
  const workspace = workspaceFor(t);
  const mentor = workspace.openDemo("mentor");
  const startup = mentor.state.directory.mentorStartups.find(
    (person) => person.id === "demo-sample-trailnest:founder",
  );
  assert.ok(startup?.goals);
  workspace.act(mentor.token, {
    role: "mentor",
    action: "interest",
    id: startup.id,
    values: { note: "I've run growth experiments for travel marketplaces." },
  });
  const state = workspace.act(mentor.token, {
    role: "mentor",
    action: "simulate-acceptance",
    id: startup.id,
  }).state;
  assert.equal(state.rooms[state.activeRoomId].terms.draft.goal, startup.goals);
});

test("a mentor sees which of a startup's needs they cover", async () => {
  const { needsYouCover, fitSummary } =
    await import("../src/data/profile-presentation.js");
  const startup = { need: ["Product strategy", "Onboarding guidance"] };
  const offer = "Product strategy, Growth, Onboarding guidance";
  assert.deepEqual(needsYouCover(startup, offer), [
    "Product strategy",
    "Onboarding guidance",
  ]);
  assert.deepEqual(needsYouCover({ need: ["Legal advice"] }, offer), []);
  // Standard tags match differently worded offers.
  assert.deepEqual(
    needsYouCover({ need: ["Help with pricing"] }, "Monetization strategy"),
    ["Help with pricing"],
  );
  const summary = fitSummary(
    { ...startup, why: ["Strong"], factorScores: [100] },
    [["Need fit", 0]],
    needsYouCover(startup, offer),
  );
  assert.match(summary, /^They need help you offer: Product strategy/);
});

test("acting in an open room reads its informational notices only", (t) => {
  const workspace = workspaceFor(t);
  const founder = workspace.openDemo("founder");
  const mentor = founder.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  workspace.act(founder.token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: {
      problem: "Students leave our budgeting app during onboarding",
      tried: "We interviewed twelve teams and shortened the first form",
      question: "Which experiment should we run next?",
      format: "single-session",
    },
  });
  const roomId = workspace.act(founder.token, {
    role: "founder",
    action: "simulate-acceptance",
    id: mentor.id,
  }).state.activeRoomId;
  const unread = (state) =>
    state.notifications.filter((item) => item.roomId === roomId && !item.read);
  const before = workspace.get(founder.token).state;
  assert.ok(unread(before).length > 0);
  // An action from another page leaves the room's notices alone.
  workspace.act(founder.token, {
    role: "founder",
    action: "save",
    id: mentor.id,
    activeRoomId: roomId,
  });
  assert.ok(unread(workspace.get(founder.token).state).length > 0);
  // An action taken with the room open reads them.
  const after = workspace.act(founder.token, {
    role: "founder",
    action: "simulate-goal-confirmation",
    activeRoomId: roomId,
    roomOpen: true,
  }).state;
  assert.deepEqual(
    unread(after).filter((item) => item.kind !== "review-release"),
    [],
  );
});
