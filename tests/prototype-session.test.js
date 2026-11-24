// Prototype review fixes: a founder can simulate the booked Single Session
// with a fictional mentor, then reach follow-up and a released review.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import {
  mentorSessions,
  mentorshipStage,
  stageMarks,
} from "../src/data/mentor-room.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

function mentorshipRoom(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-prototype-session-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), {
    demoMode: true,
  });
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const user = workspace.openDemo("founder");
  const mentor = user.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  workspace.act(user.token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const roomId = workspace.act(user.token, {
    role: "founder",
    action: "simulate-acceptance",
    id: mentor.id,
  }).state.activeRoomId;
  const run = (command) =>
    workspace.act(user.token, {
      role: "founder",
      activeRoomId: roomId,
      ...command,
    }).state;
  const act = (command) => run(command).rooms[roomId];
  return { workspace, user, roomId, run, act };
}

const futureDate = () =>
  new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test("a simulated session opens follow-up and review, and the room reaches Reviewed", (t) => {
  const { run, act } = mentorshipRoom(t);
  act({ action: "simulate-goal-confirmation" });
  act({
    form: "schedule",
    values: {
      date: futureDate(),
      time: "10:00",
      timeZone: "UTC",
      durationMinutes: "60",
    },
  });
  const heldState = run({ action: "simulate-session-held" });
  assert.equal(heldState.toast, "Session marked as held.");
  const held = Object.values(heldState.rooms).find(
    (room) => room.mentorship?.followup,
  );
  const [session] = mentorSessions(held);
  assert.equal(session.outcome, "held");
  assert.ok(held.milestones.held.me);
  assert.ok(Date.parse(held.mentorship.followup.availableAt) <= Date.now());
  assert.ok(held.mentorship.reviewOpenedAt);
  assert.ok(
    stageMarks(held).find((mark) => mark.label === "Session Held").current,
  );
  assert.ok(
    heldState.notifications.some((item) =>
      /^Prototype: your session with .+ was marked as held/.test(item.text),
    ),
  );

  act({
    action: "submit-followup",
    values: { summary: "We tested pricing." },
  });
  const reviewedState = run({
    form: "review-form",
    values: { usefulness: "5", clarity: "4", responsiveness: "5" },
  });
  const reviewed = Object.values(reviewedState.rooms).find(
    (room) => room.id === held.id,
  );
  assert.equal(reviewed.status, "reviewed");
  assert.equal(reviewed.review.partner, true);
  assert.equal(reviewed.review.partnerRating, 4);
  assert.deepEqual(Object.keys(reviewed.review.partnerScores).sort(), [
    "followThrough",
    "preparedness",
  ]);
  assert.equal(mentorshipStage(reviewed).index, 5);
  assert.ok(
    reviewedState.notifications.some((item) =>
      /^Prototype: .+ submitted a review\./.test(item.text),
    ),
  );
});

test("session simulation needs a booked session and the founder's own room", (t) => {
  const { act } = mentorshipRoom(t);
  act({ action: "simulate-goal-confirmation" });
  assert.throws(
    () => act({ action: "simulate-session-held" }),
    (error) => error.status === 409,
  );
  act({
    form: "schedule",
    values: {
      date: futureDate(),
      time: "10:00",
      timeZone: "UTC",
      durationMinutes: "60",
    },
  });
  act({ action: "simulate-session-held" });
  // Once held, there is no open session left to simulate.
  assert.throws(
    () => act({ action: "simulate-session-held" }),
    (error) => error.status === 409,
  );
});
