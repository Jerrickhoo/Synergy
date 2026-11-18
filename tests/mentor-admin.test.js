import test from "node:test";
import assert from "node:assert/strict";
import { configuration } from "../server/config.js";
import {
  mentoringGate,
  mentorshipMetrics,
  updatedMentorConfig,
} from "../server/mentor-admin.js";
import { nextRequestDigest } from "../server/mentor-email.js";
import { mentorConfig } from "../src/data/mentor-rules.js";
import { createInitialState } from "../src/data/model.js";
import { initMentorship } from "../src/data/mentor-room.js";

test("mentor digest follows the recipient's wall clock and uses the stub for demos", () => {
  const now = Date.parse("2031-01-20T20:00:00Z");
  assert.equal(
    nextRequestDigest(now, "Asia/Manila", 8),
    "2031-01-21T00:00:00.000Z",
  );
  assert.equal(
    nextRequestDigest(now, "America/Los_Angeles", 8),
    "2031-01-21T16:00:00.000Z",
  );
  assert.equal(
    configuration({ SYNERGY_DEMO_MODE: "true", EMAIL_PROVIDER: "brevo" })
      .emailProvider,
    "stub",
  );
  assert.throws(
    () =>
      configuration({ SYNERGY_DEMO_MODE: "false", EMAIL_PROVIDER: "brevo" }),
    /BREVO_API_KEY/,
  );
});

test("admin config validates percentages, exact options and dependent settings", () => {
  assert.equal(
    updatedMentorConfig(mentorConfig, "digestHour", 0).next.digestHour,
    0,
  );
  assert.throws(
    () => updatedMentorConfig(mentorConfig, "badges.topMentor.responseRate", 8),
    /rate between/,
  );
  assert.throws(
    () => updatedMentorConfig(mentorConfig, "defaultResponseDays", 4),
    /Use one of/,
  );
  assert.throws(
    () => updatedMentorConfig(mentorConfig, "followupRemindDays", "14,14"),
    /increasing order/,
  );
  assert.throws(
    () => updatedMentorConfig(mentorConfig, "followupAfterDays", "30"),
    /before it becomes overdue/,
  );
});

test("launch metrics match fixture numerators and denominators and require four qualifying weeks", () => {
  const now = Date.parse("2031-04-07T08:00:00Z");
  const account = (id, approvedAt) => {
    const state = createInitialState();
    state.profiles.mentor.mentorApprovedAt = approvedAt;
    state.mentorRequestsByRole = { founder: [], mentor: [] };
    return { id, state };
  };
  const a = account("m1", "2031-01-01T00:00:00Z");
  const b = account("m2", "2031-01-02T00:00:00Z");
  a.state.mentorRequestsByRole.mentor = [
    { status: "accepted", at: "2031-04-01T00:00:00Z" },
    { status: "referred", at: "2031-03-15T00:00:00Z" },
    { status: "expired" },
    { status: "returned" },
  ];
  a.mentorshipSurvey = { wouldCharge: true };
  b.mentorshipSurvey = { wouldCharge: false };
  const room = initMentorship(
    { id: "r1", type: "mentorship", role: "mentor", terms: { draft: {} } },
    "single-session",
    "Fixture",
    now,
  );
  room.milestones.held.schedules = [
    { id: "s1", outcome: "held" },
    { id: "s2", outcome: "held", disputedAt: "2031-04-03" },
  ];
  room.mentorship.followup = { submittedAt: "2031-04-05" };
  a.state.rooms.r1 = room;
  const accounts = { a, b };
  const metrics = mentorshipMetrics(accounts, now);
  assert.deepEqual(
    metrics.map(({ numerator, denominator }) => [numerator, denominator]),
    [
      [1, null],
      [1, 2],
      [2, 3],
      [1, 2],
      [1, 1],
      [1, 2],
    ],
  );
  const weeks = ["2031-03-10", "2031-03-17", "2031-03-24", "2031-03-31"].map(
    (week) => ({ week, met: true }),
  );
  const gate = mentoringGate({ accounts, mentorGate: { weeks } }, now);
  assert.equal(gate.consecutiveWeeks, 4);
  assert.equal(gate.ready, false);
  weeks[2].met = false;
  assert.equal(
    mentoringGate({ accounts, mentorGate: { weeks } }, now).consecutiveWeeks,
    1,
  );
});
