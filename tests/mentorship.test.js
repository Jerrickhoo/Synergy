import test from "node:test";
import assert from "node:assert/strict";
import { createSeededState } from "./fixtures.js";
import { mentorshipActions } from "../src/data/mentorship.js";

test("mentor next actions respect role, room closure, task ownership and completion gates", () => {
  const state = createSeededState();
  state.role = "mentor";
  state.accountId = "mentor-account";
  const room = state.rooms["mentor-budgetbuddy"];
  room.terms.locked =
    room.terms.partnerLocked =
    room.terms.confirmedByMe =
      true;
  room.tasks = [
    {
      id: "mine",
      title: "Prepare feedback",
      assignee: state.accountId,
      status: "todo",
      dueDate: "2035-01-01",
    },
    {
      id: "theirs",
      title: "Founder questions",
      assignee: "founder-account",
      status: "todo",
    },
    {
      id: "done",
      title: "Already finished",
      assignee: state.accountId,
      status: "done",
    },
    {
      id: "unassigned",
      title: "Unassigned task",
      assignee: "",
      status: "todo",
    },
  ];
  let actions = mentorshipActions(state);
  assert.ok(actions.some((a) => a.tab === "schedule"));
  assert.ok(
    actions.some((a) => a.text === "Prepare feedback" && a.tab === "tasks"),
  );
  assert.ok(actions.every((a) => a.roomId !== "founder-campus"));
  assert.ok(
    !actions.some((a) =>
      /Founder questions|Already finished|Unassigned task|Complete your mentorship/.test(
        a.text,
      ),
    ),
  );
  for (const milestone of Object.values(room.milestones)) {
    milestone.me = milestone.partner = true;
    if (milestone.evidence) milestone.attachment = "Guidance summary";
  }
  // Scheduling remains a completion gate even when both confirmations exist.
  assert.ok(
    !mentorshipActions(state).some(
      (a) => a.text === "Complete your mentorship",
    ),
  );
  room.milestones.session.schedule = {
    date: "2035-01-01",
    time: "10:00",
    timeZone: "Asia/Manila",
  };
  assert.ok(
    mentorshipActions(state).some((a) => a.text === "Complete your mentorship"),
  );
  room.status = "launched";
  actions = mentorshipActions(state);
  assert.deepEqual(
    actions.filter((a) => a.roomId),
    [
      {
        priority: 3,
        text: "Review your completed collaboration",
        roomId: room.id,
        review: true,
      },
    ],
  );
  room.status = "cancelled";
  assert.equal(mentorshipActions(state).filter((a) => a.roomId).length, 0);
});
