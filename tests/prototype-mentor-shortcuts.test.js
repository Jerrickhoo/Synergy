// Mentor-side prototype shortcuts: a preview mentor can finish every format
// with fictional sample founders, and a real founder's room refuses them.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { mentorSessions, mentorshipStage } from "../src/data/mentor-room.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

const mentorReview = { rating: "4" };
const futureDate = (days = 5) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function workspaceFor(t, options) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-mentor-shortcuts-"));
  const workspace = createWorkspace(join(dir, "workspace.json"), options);
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return workspace;
}

// A new preview mentor with the four sample requests.
function previewMentor(t) {
  const workspace = workspaceFor(t, { demoMode: true });
  const mentor = workspace.openDemo("mentor", {
    email: "preview-mentor@example.com",
    password: "pw",
  });
  const run = (command) =>
    workspace.act(mentor.token, { role: "mentor", ...command }).state;
  const view = () => workspace.get(mentor.token, "mentor").state;
  const accept = (format) => {
    const request = view().mentorRequests.find(
      (entry) => entry.format === format && entry.status === "pending",
    );
    const roomId = run({
      action: "accept-request",
      id: request.partnerId,
      requestId: request.id,
    }).activeRoomId;
    const inRoom = (command) => run({ activeRoomId: roomId, ...command });
    return {
      roomId,
      inRoom,
      act: (command) => inRoom(command).rooms[roomId],
    };
  };
  return { workspace, mentor, run, view, accept };
}

// A real mentor offering every requestable format, and real founders.
function realMentor(t) {
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
    return { founder: as(founder, "founder"), mentor: as(mentor, "mentor") };
  };
  const run = (command) =>
    workspace.act(mentor.token, { role: "mentor", ...command });
  return { roomFor, run };
}

const refused = (call, action) =>
  assert.throws(
    () => call({ action }),
    (error) => error.status === 403,
    action,
  );

// M-1: upgrades
test("simulate-upgrade-acceptance: the fictional founder accepts the mentor's upgrade", (t) => {
  const { accept } = previewMentor(t);
  const { act, inRoom } = accept("single-session");
  act({ action: "confirm-goal", values: {} });
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
  act({ action: "propose-upgrade", values: { format: "ongoing-advisory" } });
  const state = inRoom({ action: "simulate-upgrade-acceptance" });
  const room = state.rooms[state.activeRoomId];
  assert.equal(room.terms.draft.format, "ongoing-advisory");
  assert.equal(room.mentorship.upgrade, undefined);
  assert.equal(room.mentorship.upgradeSimulated, true);
  assert.ok(room.cycle);
  assert.equal(room.mentorship.history.at(-1).format, "single-session");
  assert.equal(
    state.toast,
    "AccessLearn accepted the upgrade to Ongoing Advisory.",
  );
  assert.ok(
    state.notifications.some(
      (item) => item.text === "Mentorship upgrade accepted.",
    ),
  );
});

test("simulate-upgrade-decline: the fictional founder declines and the format stays", (t) => {
  const { accept } = previewMentor(t);
  const { act } = accept("quick-ask");
  act({ action: "deliver-answer", values: { answer: "Charge per term." } });
  // Nothing to answer before a proposal.
  assert.throws(
    () => act({ action: "simulate-upgrade-decline" }),
    (error) => error.status === 409,
  );
  act({ action: "propose-upgrade", values: { format: "single-session" } });
  const room = act({ action: "simulate-upgrade-decline" });
  assert.equal(room.terms.draft.format, "quick-ask");
  assert.equal(room.mentorship.upgrade, undefined);
});

test("upgrade simulations are refused with a real founder", (t) => {
  const { founder, mentor } = realMentor(t).roomFor("quick-ask");
  mentor({ action: "deliver-answer", values: { answer: "Charge per term." } });
  mentor({ action: "propose-upgrade", values: { format: "single-session" } });
  for (const action of [
    "simulate-upgrade-acceptance",
    "simulate-upgrade-decline",
  ]) {
    refused(mentor, action);
    refused(founder, action);
  }
});

// M-2: Office Hours
test("simulate-office-booking: a sample founder books an open slot and the room reaches Reviewed", (t) => {
  const { run } = previewMentor(t);
  const opened = run({
    action: "open-office-slot",
    values: {
      date: futureDate(4),
      time: "15:00",
      durationMinutes: "30",
      timeZone: "UTC",
      recurring: "",
    },
  });
  const [opening] = opened.mentorOfficeOpenings;
  const booked = run({
    action: "simulate-office-booking",
    values: { occurrenceId: opening.id },
  });
  assert.equal(booked.page, "room-detail");
  assert.match(booked.toast, /^Prototype: .+ booked your Office Hours slot\.$/);
  const room = booked.rooms[booked.activeRoomId];
  assert.equal(room.terms.draft.format, "office-hours");
  assert.equal(room.mentorship.booking.simulated, true);
  assert.equal(mentorSessions(room)[0].officeOccurrenceId, opening.id);
  assert.ok(room.milestones.booked.me);
  assert.ok(
    booked.notifications.some((item) =>
      /booked Office Hours\.$/.test(item.text),
    ),
  );
  // The slot is taken now.
  assert.ok(!booked.mentorOfficeOpenings.some(({ id }) => id === opening.id));
  const inRoom = (command) =>
    run({ activeRoomId: booked.activeRoomId, ...command }).rooms[
      booked.activeRoomId
    ];
  const held = inRoom({ action: "simulate-session-held" });
  assert.equal(mentorshipStage(held).label, "Session Held");
  assert.equal(mentorSessions(held)[0].simulated, true);
  const reviewed = inRoom({ form: "review-form", values: mentorReview });
  assert.equal(reviewed.status, "reviewed");
});

test("simulate-office-booking is refused for a real mentor", (t) => {
  const { run } = realMentor(t);
  assert.throws(
    () =>
      run({
        action: "simulate-office-booking",
        values: { occurrenceId: "any" },
      }),
    (error) => error.status === 403,
  );
});

// M-3: one path per format
test("Quick Ask: simulate-founder-rating marks the answer helpful and the room reaches Reviewed", (t) => {
  const { accept } = previewMentor(t);
  const { act, inRoom } = accept("quick-ask");
  // The founder rates only after the answer.
  assert.throws(
    () => act({ action: "simulate-founder-rating" }),
    (error) => error.status === 400,
  );
  act({ action: "deliver-answer", values: { answer: "Charge per term." } });
  const state = inRoom({ action: "simulate-founder-rating" });
  const rated = state.rooms[state.activeRoomId];
  assert.equal(rated.mentorship.answerRating, "helpful");
  assert.equal(rated.mentorship.answerRatingSimulated, true);
  assert.ok(rated.milestones.helpful.me && rated.milestones.helpful.partner);
  assert.ok(
    state.notifications.some((item) => item.text === "Answer feedback saved."),
  );
  const reviewed = act({ form: "review-form", values: mentorReview });
  assert.equal(reviewed.status, "reviewed");
});

test("Doc Review: simulate-doc-upload and simulate-revisions finish the room at Reviewed", (t) => {
  const { accept } = previewMentor(t);
  const { act } = accept("doc-review");
  // Revisions come after the review.
  assert.throws(
    () => act({ action: "simulate-revisions" }),
    (error) => error.status === 400,
  );
  const uploaded = act({ action: "simulate-doc-upload" });
  const [evidence] = uploaded.milestones.uploaded.evidenceItems;
  assert.equal(evidence.simulated, true);
  assert.ok(uploaded.milestones.uploaded.me);
  assert.throws(
    () => act({ action: "simulate-doc-upload" }),
    (error) => error.status === 409,
  );
  act({ action: "deliver-answer", values: { answer: "Move security up." } });
  const revised = act({ action: "simulate-revisions" });
  assert.equal(revised.mentorship.revisions.simulated, true);
  assert.ok(revised.milestones.revisions.me);
  const reviewed = act({ form: "review-form", values: mentorReview });
  assert.equal(reviewed.status, "reviewed");
});

test("Single Session: the sample request still reaches Reviewed", (t) => {
  const { accept } = previewMentor(t);
  const { act } = accept("single-session");
  act({ action: "confirm-goal", values: {} });
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
  const reviewed = act({ form: "review-form", values: mentorReview });
  assert.equal(reviewed.status, "reviewed");
});

test("Ongoing Advisory: simulate-check-in-proposal and simulate-cycle-review take the mentor to Reviewed", (t) => {
  const { accept } = previewMentor(t);
  const { act, inRoom } = accept("ongoing-advisory");
  act({ action: "confirm-goal", values: {} });
  const proposed = inRoom({ action: "simulate-check-in-proposal" });
  const room = proposed.rooms[proposed.activeRoomId];
  assert.equal(room.cycle.proposedTime.proposedBy, "founder");
  assert.equal(room.cycle.proposedTime.simulated, true);
  assert.ok(
    proposed.notifications.some((item) =>
      /^Founder proposed a regular advisory check-in time/.test(item.text),
    ),
  );
  assert.throws(
    () => act({ action: "simulate-check-in-proposal" }),
    (error) => error.status === 409,
  );
  act({ action: "confirm-check-in-time" });
  for (let held = 0; held < room.cycle.checkIns; held += 1)
    act({ action: "simulate-session-held" });
  act({ form: "cycle-review", values: mentorReview });
  const reviewedCycle = act({ action: "simulate-cycle-review" });
  const founderReview =
    reviewedCycle.cycle.reviews[reviewedCycle.partnerAccountId];
  assert.equal(founderReview.simulated, true);
  assert.deepEqual(Object.keys(founderReview.scores).sort(), [
    "clarity",
    "responsiveness",
    "usefulness",
  ]);
  const finished = act({
    action: "cycle-decision",
    values: { decision: "finish" },
  });
  assert.equal(finished.status, "reviewed");
  assert.equal(mentorshipStage(finished).label, "Reviewed");
});

test("mentor-side founder shortcuts are refused with a real founder", (t) => {
  const real = realMentor(t);
  const quick = real.roomFor("quick-ask");
  quick.mentor({ action: "deliver-answer", values: { answer: "Per term." } });
  refused(quick.mentor, "simulate-founder-rating");
  const doc = real.roomFor("doc-review");
  refused(doc.mentor, "simulate-doc-upload");
  refused(doc.mentor, "simulate-revisions");
  const advisory = real.roomFor("ongoing-advisory");
  advisory.mentor({ action: "confirm-goal", values: {} });
  refused(advisory.mentor, "simulate-check-in-proposal");
  advisory.mentor({ action: "end-mentorship", values: { reason: "Done." } });
  advisory.mentor({ form: "cycle-review", values: mentorReview });
  refused(advisory.mentor, "simulate-cycle-review");
  // A founder cannot run the founder-side shortcuts meant for mentors.
  refused(quick.founder, "simulate-founder-rating");
});

// m-4: another sample request
test("simulate-sample-request adds a request from a free sample founder", (t) => {
  const { run, view } = previewMentor(t);
  // All four sample founders are waiting, so there is nobody free yet.
  assert.throws(
    () => run({ action: "simulate-sample-request" }),
    (error) => error.status === 409,
  );
  const quickAsk = view().mentorRequests.find(
    ({ format }) => format === "quick-ask",
  );
  run({
    action: "decline-request",
    id: quickAsk.partnerId,
    requestId: quickAsk.id,
    values: { reason: "not-a-fit" },
  });
  const state = run({ action: "simulate-sample-request" });
  assert.equal(state.toast, "A new sample request arrived.");
  const again = state.mentorRequests.filter(
    ({ partnerId, status }) =>
      partnerId === quickAsk.partnerId && status === "pending",
  );
  assert.equal(again.length, 1);
  assert.equal(again[0].format, "quick-ask");
});

test("simulate-sample-request is refused for a real mentor", (t) => {
  const { run } = realMentor(t);
  assert.throws(
    () => run({ action: "simulate-sample-request" }),
    (error) => error.status === 403,
  );
});

// R-1: a cancelled Office Hours session
test("simulate-office-rebooking: after the mentor cancels, the fictional founder books the next open slot", (t) => {
  const { run } = previewMentor(t);
  const opened = run({
    action: "open-office-slot",
    values: {
      date: futureDate(4),
      time: "15:00",
      durationMinutes: "30",
      timeZone: "UTC",
      recurring: "on",
    },
  });
  const booked = run({
    action: "simulate-office-booking",
    values: { occurrenceId: opened.mentorOfficeOpenings[0].id },
  });
  const roomId = booked.activeRoomId;
  const inRoom = (command) => run({ activeRoomId: roomId, ...command });
  const cancelled = inRoom({
    action: "cancel-session",
    values: { scheduleIndex: 0, reason: "Sick today" },
  }).rooms[roomId];
  assert.equal(cancelled.mentorship.slotReleased, true);
  const rebooked = inRoom({ action: "simulate-office-rebooking" });
  const room = rebooked.rooms[roomId];
  assert.match(
    rebooked.toast,
    /^Prototype: .+ booked another Office Hours slot\.$/,
  );
  assert.equal(room.mentorship.slotReleased, false);
  const open = mentorSessions(room).filter(
    (session) => !session.cancelledAt && !session.outcome,
  );
  assert.equal(open.length, 1);
  assert.equal(open[0].simulatedBooking, true);
  assert.ok(
    rebooked.notifications.some(
      (item) => item.text === "The founder booked another Office Hours slot.",
    ),
  );
  inRoom({ action: "simulate-session-held" });
  const reviewed = inRoom({ form: "review-form", values: mentorReview }).rooms[
    roomId
  ];
  assert.equal(reviewed.status, "reviewed");
});

test("simulate-office-rebooking needs an open slot", (t) => {
  const { run } = previewMentor(t);
  const opened = run({
    action: "open-office-slot",
    values: {
      date: futureDate(4),
      time: "15:00",
      durationMinutes: "30",
      timeZone: "UTC",
      recurring: "",
    },
  });
  const roomId = run({
    action: "simulate-office-booking",
    values: { occurrenceId: opened.mentorOfficeOpenings[0].id },
  }).activeRoomId;
  run({
    activeRoomId: roomId,
    action: "cancel-session",
    values: { scheduleIndex: 0, reason: "Sick today" },
  });
  // Cancelling frees the slot again; once the mentor closes it, there is
  // nothing left to book.
  run({
    action: "close-office-slot",
    id: opened.mentorOfficeOpenings[0].slotId,
  });
  assert.throws(
    () => run({ activeRoomId: roomId, action: "simulate-office-rebooking" }),
    (error) => error.status === 409,
  );
});

test("simulate-office-rebooking is refused with a real founder", (t) => {
  const real = realMentor(t);
  const { mentor } = real.roomFor("single-session");
  refused(mentor, "simulate-office-rebooking");
});
