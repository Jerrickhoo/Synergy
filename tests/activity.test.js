// The Activity record, open-step wording, the verification prompt's gate
// and the Google event mapping.
import test from "node:test";
import assert from "node:assert/strict";
import {
  activityDays,
  dealRecords,
  dealStatusLabel,
  dealStatuses,
  introductionRecords,
  introductionStatusLabel,
  introductionStatuses,
  statusMeaning,
} from "../src/data/activity.js";
import { milestoneTask, roomNextAction } from "../src/data/selectors.js";
import { calendarEvents } from "../src/data/planning.js";
import { activityLabel, homeTasks } from "../src/data/home-planner.js";
import {
  verificationNeededFor,
  verificationRequired,
} from "../src/data/collaboration.js";
import { googleEvent } from "../src/data/google-sync.js";

const lockedTerms = {
  locked: true,
  partnerLocked: true,
  confirmedByMe: true,
  draft: {},
};
const exchange = (milestones, extra = {}) => ({
  id: "r1",
  role: "founder",
  type: "beta",
  partnerId: "p1",
  status: "in-progress",
  terms: lockedTerms,
  review: {},
  milestones,
  tasks: [],
  ...extra,
});

test("open milestones read as instructions; finished and typed names stay as written", () => {
  assert.equal(milestoneTask("Scope defined"), "Define the scope");
  assert.equal(milestoneTask("Feedback submitted"), "Submit the feedback");
  assert.equal(milestoneTask("Assets shared"), "Share the assets");
  assert.equal(milestoneTask("Wrap-up"), "Wrap up");
  assert.equal(
    milestoneTask("Launch the landing page"),
    "Launch the landing page",
  );
  assert.equal(milestoneTask(""), "");

  const room = exchange({
    scope: { title: "Scope defined", me: true, partner: true },
    testers: {
      title: "Testers assigned",
      me: false,
      partner: false,
      dueDate: "2026-12-02",
    },
  });
  assert.equal(
    roomNextAction(room, "Fairtab").text,
    "Next: Assign the testers",
  );

  // Waiting on you to confirm what the partner finished keeps the name.
  const confirm = exchange({
    scope: { title: "Scope defined", me: false, partner: true },
  });
  const tasks = homeTasks(
    { role: "founder", accountId: "me", rooms: {} },
    [confirm],
    () => "Fairtab",
  );
  assert.equal(tasks[0].title, "Confirm “Scope defined”");

  // The calendar names the open milestone the same way as the task list.
  const state = {
    role: "founder",
    rooms: { r1: room },
    profiles: { mentor: {} },
  };
  const due = calendarEvents(state).find((event) => event.kind === "milestone");
  assert.equal(due.title, "Assign the testers");
  assert.equal(due.date, "2026-12-02");
});

test("Activity lists introductions and requests with their dates, waiting ones first", () => {
  const state = {
    role: "founder",
    waitingByRole: { founder: new Set(["a:founder", "m:mentor"]) },
    incomingByRole: { founder: new Set(["b:founder"]) },
    introductionMetaByRole: {
      founder: {
        "a:founder": { name: "Fairtab", sentAt: "2026-11-20T09:00:00.000Z" },
        "b:founder": { name: "PaceCircle", sentAt: "2026-11-22T09:00:00.000Z" },
        // A mentorship request: listed from its own record instead.
        "m:mentor": {
          name: "Maya",
          sentAt: "2026-11-21T09:00:00.000Z",
          kind: "mentorship",
        },
      },
    },
    introHistoryByRole: {
      founder: [
        {
          id: "c:founder",
          name: "Ledgerly",
          status: "declined",
          direction: "sent",
          sentAt: "2026-11-01T09:00:00.000Z",
          at: "2026-11-03T09:00:00.000Z",
          reason: "Not a fit",
        },
        // Recorded before requests kept their date.
        {
          id: "d:founder",
          name: "Older",
          status: "expired",
          direction: "sent",
          at: "2026-10-01T09:00:00.000Z",
        },
      ],
    },
    mentorRequests: [
      {
        id: "req-1",
        partnerId: "m:mentor",
        name: "Maya",
        status: "pending",
        sentAt: "2026-11-21T09:00:00.000Z",
        expiresAt: "2026-12-05T09:00:00.000Z",
      },
    ],
  };
  const rows = introductionRecords(state);
  assert.deepEqual(
    rows.map((row) => [row.name, row.kind, row.direction, row.status]),
    [
      ["PaceCircle", "Request", "received", "needs-reply"],
      ["Maya", "Mentorship request", "sent", "waiting"],
      ["Fairtab", "Request", "sent", "waiting"],
      ["Ledgerly", "Request", "sent", "declined"],
      ["Older", "Request", "sent", "expired"],
    ],
  );
  const fairtab = rows.find((row) => row.name === "Fairtab");
  assert.equal(fairtab.requestedAt, "2026-11-20T09:00:00.000Z");
  // Fourteen days to reply.
  assert.equal(fairtab.expiresAt, "2026-12-04T09:00:00.000Z");
  const declined = rows.find((row) => row.name === "Ledgerly");
  assert.equal(declined.requestedAt, "2026-11-01T09:00:00.000Z");
  assert.equal(declined.closedAt, "2026-11-03T09:00:00.000Z");
  assert.equal(rows.find((row) => row.name === "Older").requestedAt, "");
  assert.equal(rows.find((row) => row.name === "Maya").requestId, "req-1");
});

test("Activity lists every deal with when it opened, its status and when it finished", () => {
  const state = {
    role: "founder",
    rooms: {
      live: {
        id: "live",
        role: "founder",
        type: "beta",
        engagementType: "Evaluation and Feedback",
        status: "in-progress",
        createdAt: "2026-11-10T00:00:00.000Z",
        updatedAt: "2026-11-24T00:00:00.000Z",
      },
      done: {
        id: "done",
        role: "founder",
        type: "mentorship",
        status: "launched",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-20T00:00:00.000Z",
        completedAt: "2026-10-19T00:00:00.000Z",
      },
      closed: {
        id: "closed",
        role: "founder",
        type: "swap",
        engagementType: "Technical Development",
        status: "cancelled",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-05T00:00:00.000Z",
        closedAt: "2026-09-04T00:00:00.000Z",
      },
      other: { id: "other", role: "mentor", status: "in-progress" },
    },
  };
  const rows = dealRecords(state, (room) => `Partner ${room.id}`);
  assert.deepEqual(
    rows.map((row) => [row.name, row.kind, row.status, row.finishedAt]),
    [
      ["Partner live", "Evaluation and Feedback", "in-progress", ""],
      ["Partner done", "Mentorship", "launched", "2026-10-19T00:00:00.000Z"],
      [
        "Partner closed",
        "Technical Development",
        "cancelled",
        "2026-09-04T00:00:00.000Z",
      ],
    ],
  );
  assert.equal(dealStatusLabel(rows[0]), "In progress");
  // A finished mentorship is "Completed", as in Rooms.
  assert.equal(dealStatusLabel(rows[1]), "Completed");
  assert.equal(dealStatusLabel(rows[2]), "Closed");
});

test("every status has a plain meaning, and the log groups entries by day", () => {
  for (const item of [...introductionStatuses, ...dealStatuses]) {
    assert.ok(item.label, item.id);
    assert.match(item.meaning, /\.$/, item.id);
  }
  assert.match(statusMeaning("expired"), /14 days/);
  assert.match(statusMeaning("cancelled", "deal"), /closed/);
  assert.equal(introductionStatusLabel("needs-reply"), "Needs your reply");
  assert.equal(introductionStatusLabel("on-hold"), "On hold");
  // A verification notice mentions "your profile" but is about verification.
  assert.equal(
    activityLabel(
      {
        kind: "affiliation",
        text: "You are verified. The badge now shows on your profile and cards.",
      },
      { rooms: {} },
      [],
    ),
    "Verification",
  );

  const now = new Date(2026, 10, 25, 21, 0);
  const at = (day, hour) => new Date(2026, 10, day, hour).toISOString();
  const days = activityDays(
    {
      role: "founder",
      activity: [
        { id: "1", role: "founder", text: "a", timestamp: at(25, 20) },
        { id: "2", role: "founder", text: "b", timestamp: at(25, 9) },
        { id: "3", role: "mentor", text: "hidden", timestamp: at(25, 8) },
        { id: "4", role: "founder", text: "c", timestamp: at(24, 9) },
        { id: "5", role: "founder", text: "d", timestamp: at(3, 9) },
      ],
    },
    Infinity,
    now,
  );
  assert.deepEqual(
    days.map(([label, items]) => [label, items.map((item) => item.id)]),
    [
      ["Today", ["1", "2"]],
      ["Yesterday", ["4"]],
      [days[2][0], ["5"]],
    ],
  );
  assert.match(days[2][0], /3/);
});

test("unverified accounts are asked to verify before opening, saving or connecting, never to unsave", () => {
  const state = {
    role: "founder",
    verification: "none",
    integrations: { requireVerification: true },
    savedByRole: { founder: new Set(["kept"]) },
  };
  assert.equal(verificationRequired(state), true);
  assert.equal(
    verificationNeededFor(state, { action: "save", id: "new" }),
    true,
  );
  assert.equal(
    verificationNeededFor(state, { action: "save", id: "kept" }),
    false,
  );
  for (const action of [
    "match-detail",
    "interest",
    "accept-interest",
    "send-request",
    "book-office-hours",
  ])
    assert.equal(verificationNeededFor(state, { action }), true, action);
  // Browsing the list and moving between pages stay open.
  assert.equal(verificationNeededFor(state, { action: "match-tab" }), false);
  assert.equal(verificationNeededFor(state, { page: "discover" }), false);
  assert.equal(
    verificationNeededFor(
      { ...state, verification: "verified" },
      {
        action: "interest",
      },
    ),
    false,
  );
  assert.equal(
    verificationNeededFor(
      { ...state, integrations: { requireVerification: false } },
      { action: "save", id: "new" },
    ),
    false,
  );
});

test("Google gets timed events for sessions and all-day, free events for due dates", () => {
  const session = googleEvent({
    id: "r1:meeting:m1",
    title: "Meeting with Fairtab",
    date: "2026-12-01",
    start: new Date("2026-12-01T02:00:00.000Z"),
    minutes: 45,
    link: "https://example.test/#/rooms/r1",
  });
  assert.deepEqual(session.start, { dateTime: "2026-12-01T02:00:00.000Z" });
  assert.deepEqual(session.end, { dateTime: "2026-12-01T02:45:00.000Z" });
  assert.equal(session.extendedProperties.private.synergyId, "r1:meeting:m1");
  assert.match(session.description, /Open in Synergy: https:\/\/example\.test/);

  const due = googleEvent({
    id: "r1:milestone:testers",
    title: "Due: Assign the testers — Fairtab",
    date: "2026-12-31",
  });
  assert.deepEqual(due.start, { date: "2026-12-31" });
  // The end of an all-day event is the next day, across a year boundary too.
  assert.deepEqual(due.end, { date: "2027-01-01" });
  assert.equal(due.transparency, "transparent");
  assert.equal(due.extendedProperties.private.synergy, "1");
});

test("a request closed before send dates were kept takes its date from the activity log", () => {
  const sent = "2026-11-20T09:00:00.000Z";
  const state = {
    role: "founder",
    introductionMetaByRole: { founder: {} },
    waitingByRole: { founder: new Set() },
    incomingByRole: { founder: new Set() },
    mentorRequests: [],
    introHistoryByRole: {
      founder: [
        {
          id: "campuskit:founder",
          name: "CampusKit",
          status: "withdrawn",
          direction: "sent",
          at: "2026-11-26T10:00:00.000Z",
        },
      ],
    },
    activity: [
      {
        role: "founder",
        matchId: "campuskit:founder",
        text: "You withdrew your request.",
        timestamp: "2026-11-26T10:00:00.000Z",
      },
      {
        role: "founder",
        matchId: "campuskit:founder",
        text: "You sent an introduction to CampusKit.",
        timestamp: sent,
      },
      // A later send to someone else is never borrowed.
      {
        role: "founder",
        matchId: "other:founder",
        text: "You sent a request to Other.",
        timestamp: "2026-11-25T09:00:00.000Z",
      },
    ],
  };
  const [row] = introductionRecords(state);
  assert.equal(row.status, "withdrawn");
  assert.equal(row.requestedAt, sent);
});
