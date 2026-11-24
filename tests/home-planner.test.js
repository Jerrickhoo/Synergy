import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { calendarEvents } from "../src/data/planning.js";
import { takesMeetings } from "../src/data/meetings.js";
import {
  profileChanges,
  profileChangeText,
} from "../src/data/profile-changes.js";
import {
  activityLabel,
  activityText,
  collaboratorSlots,
  homeTasks,
} from "../src/data/home-planner.js";

const profile = {
  bio: "Student budgeting app",
  offer: "Product Feedback",
  need: "Beta Testers",
  industry: "FinTech",
  stage: "pre-seed",
  teamSize: "4",
};
const terms = {
  goal: "Validate onboarding",
  scope: "Fifty testers",
  timeline: "Two weeks",
  commitment: "Two hours weekly",
  compensation: "Early access",
};
// A date a week from now, as the scheduler's calendar shows it.
const nextWeek = () => {
  const date = new Date(Date.now() + 7 * 86400000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-home-planner-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const workspace = createWorkspace(join(dir, "workspace.json"));
  t.after(() => workspace.close());
  const user = (name) =>
    workspace.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role: "founder",
      },
      true,
    );
  const act = (u, command) =>
    workspace.act(u.token, {
      role: "founder",
      timeZone: "UTC",
      termsRevision:
        workspace.get(u.token).state.rooms[command.activeRoomId]?.terms
          .revision || 0,
      ...command,
    });
  const a = user("Maria");
  const b = user("Jordan");
  act(a, {
    form: "profile-form",
    values: { ...profile, startupName: "Budgetly" },
  });
  act(b, {
    form: "profile-form",
    values: { ...profile, startupName: "Fairtab" },
  });
  act(a, { action: "interest", id: `${b.state.accountId}:founder` });
  const id = act(b, {
    action: "accept-interest",
    id: `${a.state.accountId}:founder`,
  }).state.activeRoomId;
  return { workspace, a, b, act, id };
}

test("an exchange collaboration schedules a meeting both partners see, and either can cancel it", (t) => {
  const { workspace, a, b, act, id } = fixture(t);
  act(a, { action: "lock-terms", activeRoomId: id, values: terms });
  act(b, { action: "accept-terms", activeRoomId: id });
  const date = nextWeek();
  const saved = act(a, {
    form: "meeting",
    activeRoomId: id,
    values: {
      date,
      time: "10:00",
      durationMinutes: "45",
      note: "Walk through the beta",
    },
  });
  assert.equal(saved.state.formErrors, null);
  const [meeting] = saved.state.rooms[id].meetings;
  assert.equal(meeting.time, "10:00");
  assert.equal(meeting.durationMinutes, 45);
  assert.equal(meeting.note, "Walk through the beta");
  assert.equal(meeting.byAccountId, a.state.accountId);
  // The partner's copy of the room has the meeting, on the calendar too.
  const partner = workspace.get(b.token).state;
  assert.equal(partner.rooms[id].meetings[0].id, meeting.id);
  assert.ok(
    calendarEvents(partner).some(
      (event) => event.id === `${id}:meeting:${meeting.id}`,
    ),
  );
  // The partner is told, with the date and time.
  assert.match(partner.activity[0].text, /scheduled a meeting for .+ at 10:00/);
  assert.equal(partner.activity[0].tab, "schedule");
  // A past time, an unknown length and an over-long note are refused.
  for (const values of [
    { date: "2020-01-01", time: "10:00" },
    { date, time: "10:00", durationMinutes: "20" },
    { date, time: "10:00", note: "x".repeat(501) },
  ])
    assert.ok(
      act(a, { form: "meeting", activeRoomId: id, values }).state.formErrors,
    );
  assert.equal(workspace.get(a.token).state.rooms[id].meetings.length, 1);
  // The partner cancels; it stays on record but leaves both calendars.
  act(b, { action: "cancel-meeting", activeRoomId: id, id: meeting.id });
  for (const u of [a, b]) {
    const state = workspace.get(u.token).state;
    assert.ok(state.rooms[id].meetings[0].cancelledAt);
    assert.ok(
      !calendarEvents(state).some((event) => event.id.includes(":meeting:")),
    );
  }
  assert.throws(
    () =>
      act(a, { action: "cancel-meeting", activeRoomId: id, id: meeting.id }),
    /unavailable/,
  );
});

test("mentorships keep their own scheduling", () => {
  assert.equal(takesMeetings({ type: "mentorship" }), false);
  assert.equal(takesMeetings({ type: "exchange" }), true);
});

test("Recent activity names what a profile save changed", () => {
  const before = {
    bio: "Old",
    industry: "SaaS",
    need: "Beta Testers",
    image: "/api/avatars/x",
  };
  const changed = profileChanges(
    before,
    {
      bio: "New description",
      industry: "SaaS",
      need: "Pricing Strategy",
      image: "",
      personImage: "data:image/webp;base64,AAAA",
    },
    "founder",
    "Maria",
  );
  assert.deepEqual(changed, ["description", "needs", "logo", "photo"]);
  assert.equal(
    profileChangeText(changed),
    "You updated your description, needs, logo and photo.",
  );
  // The same tags in another order are not a change.
  assert.deepEqual(
    profileChanges(
      { need: "A, B" },
      { need: "B, A", name: "Maria" },
      "founder",
      "Maria",
    ),
    [],
  );
  assert.equal(
    profileChangeText([]),
    "You saved your profile without changes.",
  );
});

test("Home labels activity, lists tasks soonest first and keeps collaborator colours", () => {
  const rooms = [
    {
      id: "r2",
      createdAt: "2026-02-01",
      partnerId: "p2",
      status: "in-progress",
      milestones: {},
      terms: { locked: true, partnerLocked: true, draft: {} },
      review: {},
      tasks: [
        {
          id: "t1",
          title: "Send survey",
          status: "todo",
          dueDate: "2026-03-02",
        },
        { id: "t2", title: "Done already", status: "done" },
        {
          id: "t3",
          title: "Someone else's",
          status: "todo",
          assignee: "other",
        },
      ],
    },
    {
      id: "r1",
      createdAt: "2026-01-01",
      partnerId: "p1",
      status: "in-progress",
      milestones: {},
      terms: { locked: true, partnerLocked: true, draft: {} },
      review: {},
      tasks: [
        {
          id: "t4",
          title: "Book testers",
          status: "todo",
          dueDate: "2026-03-01",
        },
        { id: "t5", title: "No date", status: "todo" },
      ],
    },
  ];
  const slots = collaboratorSlots(rooms);
  assert.equal(slots.get("r1"), "collab-1");
  assert.equal(slots.get("r2"), "collab-2");
  const state = { role: "founder", accountId: "me", rooms: {} };
  const names = { r1: "Fairtab", r2: "PaceCircle" };
  const tasks = homeTasks(state, rooms, (room) => names[room.id]).filter(
    (task) => task.tab === "tasks",
  );
  assert.deepEqual(
    tasks.map((task) => `${task.title} — ${task.who}`),
    ["Book testers — Fairtab", "Send survey — PaceCircle", "No date — Fairtab"],
  );
  const people = [
    { id: "p1", name: "Fairtab" },
    { id: "p3", name: "Diego Alvarez" },
  ];
  const labelled = { rooms: { r1: rooms[1] } };
  assert.equal(
    activityLabel({ roomId: "r1", text: "x" }, labelled, people),
    "Fairtab",
  );
  assert.equal(
    activityLabel({ matchId: "p3", text: "x" }, labelled, people),
    "Diego Alvarez",
  );
  assert.equal(
    activityLabel({ kind: "profile", text: "x" }, labelled, people),
    "Profile",
  );
  assert.equal(
    activityText("Fairtab accepted the shared terms.", "Fairtab"),
    "Accepted the shared terms.",
  );
  assert.equal(
    activityText("You sent an introduction to Fairtab.", "Fairtab"),
    "You sent an introduction to Fairtab.",
  );
});
