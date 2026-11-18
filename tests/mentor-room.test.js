import test from "node:test";
import assert from "node:assert/strict";
import {
  appointment,
  migrateMentorship,
  requiredMentorActions,
  resolveAttendance,
} from "../src/data/mentor-room.js";
import { mentorFormatIds } from "../src/data/mentor-formats.js";

const since = Date.parse("2030-04-02T10:00:00Z");
const hours = 3600000;

test("attendance resolution covers testimony, silence, disagreement and both missing", () => {
  const at = new Date(since).toISOString();
  const outcomes = [
    [null, null, "held"],
    ["held", null, "held"],
    [null, "held", "held"],
    ["held", "held", "held"],
    ["i-missed", null, "no-show-mentor"],
    [null, "i-missed", "no-show-founder"],
    ["partner-absent", null, "no-show-founder"],
    [null, "partner-absent", "no-show-mentor"],
    ["partner-absent", "i-missed", "no-show-founder"],
    ["i-missed", "partner-absent", "no-show-mentor"],
    ["partner-absent", "partner-absent", "disputed"],
    ["held", "partner-absent", "disputed"],
    ["i-missed", "i-missed", "no-show-both"],
  ];
  const schedule = appointment({
    date: "2030-04-02",
    time: "10:00",
    timeZone: "UTC",
    durationMinutes: 60,
  });
  assert.equal(resolveAttendance(schedule, since + 72 * hours), null);
  for (const [mentor, founder, outcome] of outcomes)
    assert.equal(
      resolveAttendance(
        {
          ...schedule,
          attendance: { mentor, founder, at: { mentor: at, founder: at } },
        },
        since + 73 * hours,
      ),
      outcome,
    );
  assert.equal(
    resolveAttendance(
      {
        ...schedule,
        attendance: { mentor: "partner-absent", at: { mentor: at } },
      },
      since + 71 * hours,
    ),
    null,
  );
});

test("v3 mentorship migrates once with confirmations, schedule and goal preserved", () => {
  const room = {
    type: "mentorship",
    status: "in-progress",
    terms: {
      draft: {
        format: "one-off",
        goal: "Improve onboarding",
        compensation: "Old placeholder",
      },
    },
    milestones: {
      goals: { me: true, partner: true, title: "Original goal" },
      session: {
        me: true,
        partner: false,
        schedule: {
          date: "2030-04-02",
          time: "18:00",
          timeZone: "Asia/Manila",
        },
      },
      guidance: {
        me: false,
        partner: false,
        title: "Original evidence",
        evidenceItems: [{ label: "Example" }],
      },
      followup: { me: false, partner: false },
    },
  };
  assert.equal(migrateMentorship(room, since), true);
  assert.equal(room.template.version, 4);
  assert.equal(room.terms.draft.format, "single-session");
  assert.equal(room.terms.draft.goal, "Improve onboarding");
  assert.equal(room.terms.draft.price, 0);
  assert.equal(room.milestones.goal.me, true);
  assert.equal(
    room.milestones.held.schedules[0].startsAt,
    new Date(since).toISOString(),
  );
  assert.deepEqual(
    room.mentorship.history[0].milestones.guidance.evidenceItems,
    [{ label: "Example" }],
  );
  const saved = structuredClone(room);
  assert.equal(migrateMentorship(room, since), false);
  assert.deepEqual(room, saved);
});

test("mentor admin requirements stay within the approved steps for all five formats", () => {
  for (const format of mentorFormatIds) {
    const actions = requiredMentorActions(format);
    assert.ok(actions.includes("rate"));
    assert.deepEqual(
      actions.filter((action) => action === "confirm-check-in-time"),
      format === "ongoing-advisory" ? ["confirm-check-in-time"] : [],
    );
    assert.equal(
      actions.includes("report-attendance"),
      ["single-session", "office-hours", "ongoing-advisory"].includes(format),
    );
    assert.ok(
      actions.every((action) =>
        [
          "confirm-goal",
          "confirm-check-in-time",
          "report-attendance",
          "rate",
        ].includes(action),
      ),
    );
  }
});
