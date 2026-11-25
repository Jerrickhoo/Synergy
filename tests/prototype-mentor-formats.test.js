// Prototype shortcuts for every mentorship format: a founder with a fictional
// mentor can finish each room, and a real mentor's room refuses them.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { mentorSessions, mentorshipStage } from "../src/data/mentor-room.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

const review = { usefulness: "5", clarity: "4", responsiveness: "5" };
const futureDate = (days = 3) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function workspaceFor(t, options) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-prototype-formats-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), options);
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return workspace;
}

// A preview founder's room with a fictional mentor offering `format`.
function fictionalRoom(t, format) {
  const workspace = workspaceFor(t, { demoMode: true });
  const user = workspace.openDemo("founder");
  const mentor = user.state.directory.mentors.find((person) =>
    person.availableFormats?.includes(format),
  );
  workspace.act(user.token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format },
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
  return {
    run,
    act: (command) => run(command).rooms[roomId],
    view: () => workspace.get(user.token, "founder").state.rooms[roomId],
    roomId,
  };
}

// A real founder and a real mentor offering every requestable format.
function realPair(t) {
  const workspace = workspaceFor(t, { mentorApprovalRequired: false });
  let count = 0;
  const user = (role, values) => {
    count += 1;
    const account = workspace.login(
      {
        firstName: `Real${count}`,
        lastName: "Test",
        email: `real${count}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
    workspace.act(account.token, { role, form: "profile-form", values });
    return account;
  };
  const mentor = user("mentor", {
    bio: "Product mentor for student teams.",
    offer: "Product strategy",
    need: "Focused questions",
    expertise: "Product strategy",
    startups: "EdTech student tools",
  });
  workspace.act(mentor.token, {
    role: "mentor",
    form: "accept-guidelines",
    values: { version: 2 },
  });
  workspace.act(mentor.token, {
    role: "mentor",
    form: "mentor-capacity",
    values: {
      maxMentees: "5",
      monthlyHours: "20",
      maxOpenAsync: "4",
      responseDays: "5",
      "format-quick-ask": "on",
      "format-doc-review": "on",
      "format-single-session": "on",
      "format-ongoing-advisory": "on",
      timeZone: "UTC",
    },
  });
  // One founder per format, since a pair has one request at a time.
  const roomFor = (format) => {
    const founder = user("founder", {
      bio: "We build student tools.",
      offer: "Beta testing",
      need: "Product strategy",
      industry: "EdTech",
      stage: "idea",
      teamSize: "3",
    });
    workspace.act(founder.token, {
      role: "founder",
      action: "send-request",
      id: `${mentor.state.accountId}:mentor`,
      values: { ...mentorRequestValues, format },
    });
    const roomId = workspace.act(mentor.token, {
      role: "mentor",
      action: "accept-request",
      id: `${founder.state.accountId}:founder`,
    }).state.activeRoomId;
    const as = (account, role) => (command) =>
      workspace.act(account.token, { role, activeRoomId: roomId, ...command })
        .state.rooms[roomId];
    return {
      founder: as(founder, "founder"),
      mentor: as(mentor, "mentor"),
      view: () => workspace.get(founder.token, "founder").state.rooms[roomId],
    };
  };
  return { roomFor };
}

const refused = (run, action) =>
  assert.throws(
    () => run({ action }),
    (error) => error.status === 403,
  );

test("simulate-delivery: a fictional mentor answers a Quick Ask and the room reaches Reviewed", (t) => {
  const { run, act } = fictionalRoom(t, "quick-ask");
  const delivered = run({ action: "simulate-delivery" });
  const room = Object.values(delivered.rooms).find(
    (entry) => entry.mentorship?.deliveredAt,
  );
  assert.equal(delivered.toast, "The mentor answered the Quick Ask.");
  assert.ok(room.mentorship.answer);
  assert.equal(room.mentorship.answerSimulated, true);
  assert.ok(room.milestones.answer.me && room.milestones.answer.partner);
  assert.equal(room.milestones.answer.evidenceItems[0].simulated, true);
  assert.ok(room.mentorship.reviewOpenedAt);
  assert.ok(
    delivered.notifications.some(
      (item) =>
        item.roomId === room.id &&
        item.text === "The mentor answered the Quick Ask.",
    ),
  );
  // Delivery happens once, like the mentor's own action.
  assert.throws(
    () => act({ action: "simulate-delivery" }),
    (error) => error.status === 400,
  );
  act({ action: "rate-answer", values: { rating: "helpful" } });
  const reviewed = act({ form: "review-form", values: review });
  assert.equal(reviewed.status, "reviewed");
  assert.equal(mentorshipStage(reviewed).label, "Reviewed");
});

test("simulate-delivery: a Doc Review waits for the document, then reaches Reviewed", (t) => {
  const { act } = fictionalRoom(t, "doc-review");
  assert.throws(
    () => act({ action: "simulate-delivery" }),
    (error) => error.status === 409,
  );
  act({
    form: "evidence",
    id: "uploaded",
    values: { attachment: "https://example.com/pitch-deck" },
  });
  const delivered = act({ action: "simulate-delivery" });
  assert.ok(
    delivered.milestones.review.me && delivered.milestones.review.partner,
  );
  assert.equal(delivered.mentorship.answerSimulated, true);
  act({ action: "log-revision", values: { summary: "Moved traction up." } });
  const reviewed = act({ form: "review-form", values: review });
  assert.equal(reviewed.status, "reviewed");
});

test("simulate-delivery is refused with a real mentor", (t) => {
  const { founder, mentor, view } = realPair(t).roomFor("quick-ask");
  refused(founder, "simulate-delivery");
  refused(mentor, "simulate-delivery");
  assert.equal(view().mentorship.deliveredAt, undefined);
});

// Ongoing Advisory with a fictional mentor up to the cycle review.
function advisoryAtCycleReview(t) {
  const room = fictionalRoom(t, "ongoing-advisory");
  room.act({ action: "simulate-goal-confirmation" });
  room.act({
    form: "propose-check-in-time",
    values: { date: futureDate(), time: "10:00", timeZone: "UTC" },
  });
  const confirmed = room.run({ action: "simulate-check-in-confirmation" });
  const advisory = confirmed.rooms[room.roomId];
  assert.equal(mentorSessions(advisory).length, advisory.cycle.checkIns);
  for (let held = 1; held <= advisory.cycle.checkIns; held += 1) {
    const state = room.run({ action: "simulate-session-held" });
    assert.equal(state.toast, "Check-in marked as held.");
    assert.equal(
      mentorSessions(state.rooms[room.roomId]).filter(
        (session) => session.outcome === "held" && session.simulated,
      ).length,
      held,
    );
  }
  return room;
}

test("simulate-check-in-confirmation books every check-in through the real rule", (t) => {
  const { run, act, roomId } = fictionalRoom(t, "ongoing-advisory");
  act({ action: "simulate-goal-confirmation" });
  // Nothing to confirm before the founder proposes a time.
  assert.throws(
    () => act({ action: "simulate-check-in-confirmation" }),
    (error) => error.status === 409,
  );
  act({
    form: "propose-check-in-time",
    values: { date: futureDate(), time: "10:00", timeZone: "UTC" },
  });
  const state = run({ action: "simulate-check-in-confirmation" });
  const room = state.rooms[roomId];
  assert.ok(room.cycle.confirmedAt);
  assert.equal(room.cycle.confirmedSimulated, true);
  assert.equal(mentorSessions(room).length, room.cycle.checkIns);
  assert.equal(mentorshipStage(room).label, "Check-ins (0 of 4)");
  assert.ok(
    state.notifications.some(
      (item) =>
        item.roomId === roomId &&
        /^Advisory check-ins confirmed\. Check-ins: /.test(item.text),
    ),
  );
});

test("simulate-session-held holds advisory check-ins one at a time and opens the cycle review", (t) => {
  const { act, view } = advisoryAtCycleReview(t);
  const room = view();
  assert.equal(room.cycle.phase, "review");
  assert.ok(room.milestones.checkins.me && room.milestones.checkins.partner);
  assert.equal(mentorshipStage(room).label, "Check-ins (4 of 4)");
  // Every check-in is held, so there is none left to simulate.
  assert.throws(
    () => act({ action: "simulate-session-held" }),
    (error) => error.status === 409,
  );
});

test("simulate-cycle-review finishes Ongoing Advisory at Reviewed", (t) => {
  const { run, act, roomId } = advisoryAtCycleReview(t);
  // The mentor reviews only after the founder, so reviews stay blind.
  assert.throws(
    () => act({ action: "simulate-cycle-review" }),
    (error) => error.status === 409,
  );
  act({ form: "cycle-review", values: { ...review, note: "Good cycle." } });
  act({ action: "cycle-decision", values: { decision: "finish" } });
  const state = run({ action: "simulate-cycle-review" });
  const room = state.rooms[roomId];
  const mentorReview = room.cycle.reviews[room.partnerAccountId];
  assert.equal(mentorReview.simulated, true);
  assert.equal(room.status, "reviewed");
  assert.equal(mentorshipStage(room).label, "Reviewed");
  assert.ok(
    state.notifications.some((item) =>
      /^Prototype: .+ submitted a private cycle review\./.test(item.text),
    ),
  );
});

test("simulate-cycle-review agrees with Continue and starts the next cycle", (t) => {
  const { run, act, roomId } = advisoryAtCycleReview(t);
  act({ form: "cycle-review", values: review });
  act({ action: "simulate-cycle-review" });
  const waiting = act({
    action: "cycle-decision",
    values: { decision: "continue" },
  });
  assert.equal(waiting.cycle.number, 1);
  const state = run({ action: "simulate-cycle-review" });
  assert.equal(state.toast, "Advisory cycle 2 started.");
  assert.equal(state.rooms[roomId].cycle.number, 2);
  assert.equal(state.rooms[roomId].cycle.phase, "active");
});

test("advisory shortcuts are refused with a real mentor", (t) => {
  const { founder, mentor } = realPair(t).roomFor("ongoing-advisory");
  mentor({ action: "confirm-goal", values: {} });
  founder({
    form: "propose-check-in-time",
    values: { date: futureDate(), time: "10:00", timeZone: "UTC" },
  });
  refused(founder, "simulate-check-in-confirmation");
  refused(mentor, "simulate-check-in-confirmation");
  mentor({ action: "confirm-check-in-time" });
  refused(founder, "simulate-session-held");
  refused(mentor, "simulate-session-held");
  // Ending the advisory opens the cycle review without any shortcut.
  founder({ action: "end-mentorship", values: { reason: "Goal reached." } });
  const reviewing = founder({ form: "cycle-review", values: review });
  assert.equal(reviewing.cycle.phase, "review");
  refused(founder, "simulate-cycle-review");
  refused(mentor, "simulate-cycle-review");
  assert.equal(Object.keys(reviewing.cycle.reviews).length, 1);
});

// The real-mentor refusal for sessions is in the advisory test above.
test("simulate-session-held finishes Office Hours at Reviewed", (t) => {
  const workspace = workspaceFor(t, { demoMode: true });
  const user = workspace.openDemo("founder");
  const mentor = user.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("office-hours"),
  );
  const [slot] = mentor.officeHours;
  const booked = workspace.act(user.token, {
    role: "founder",
    action: "book-office-hours",
    id: mentor.id,
    values: { ...mentorRequestValues, slotId: slot.slotId, date: slot.date },
  }).state;
  const run = (command) =>
    workspace.act(user.token, {
      role: "founder",
      activeRoomId: booked.activeRoomId,
      ...command,
    }).state;
  const held = run({ action: "simulate-session-held" });
  const room = held.rooms[booked.activeRoomId];
  assert.equal(held.toast, "Session marked as held.");
  assert.equal(mentorSessions(room)[0].simulated, true);
  assert.equal(mentorshipStage(room).label, "Session Held");
  assert.ok(
    held.notifications.some((item) =>
      /^Prototype: your session with .+ was marked as held\. Your review is open\./.test(
        item.text,
      ),
    ),
  );
  const reviewed = run({ form: "review-form", values: review }).rooms[
    booked.activeRoomId
  ];
  assert.equal(reviewed.status, "reviewed");
});
