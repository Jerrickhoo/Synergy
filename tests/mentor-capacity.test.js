import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import { encode } from "../src/state/serialization.js";
import { canonicalTags } from "../src/data/collaboration.js";
import { createInitialState } from "../src/data/model.js";
import {
  availabilityFit,
  backfillMentorProfile,
  capacityUsage,
  conflictWith,
  formatFit,
  guidelinesStatus,
  mentorConfig,
  mentorDefaults,
  normalizeCompany,
} from "../src/data/mentor-rules.js";
import { normalizeOfferedFormats } from "../src/data/mentor-formats.js";

const NOW = Date.parse("2030-03-15T05:00:00Z");

// A mentor account state with accepted guidelines and the given overrides.
function mentorState(profile = {}, rooms = {}) {
  const state = createInitialState();
  Object.assign(state.profiles.mentor, {
    guidelinesVersion: mentorConfig.guidelinesVersion,
    formats: [
      { id: "quick-ask", price: 0 },
      { id: "single-session", price: 0 },
    ],
    ...profile,
  });
  state.rooms = rooms;
  return state;
}
const room = (id, format, extra = {}) => ({
  id,
  role: "mentor",
  type: "mentorship",
  status: "in-progress",
  createdAt: "2030-03-02T00:00:00.000Z",
  terms: { draft: { format } },
  milestones: {},
  ...extra,
});
const session = (date, durationMinutes) => ({
  date,
  time: "10:00",
  timeZone: "Asia/Manila",
  durationMinutes,
});

test("a mentor at the mentee limit can still take quick asks", () => {
  const state = mentorState(
    { capacity: { ...mentorDefaults().capacity, maxMentees: 2 } },
    {
      a: room("a", "single-session"),
      b: room("b", "ongoing-advisory"),
    },
  );
  const usage = capacityUsage(state, NOW);
  assert.equal(usage.activeMentees, 2);
  assert.equal(usage.formatReasons["single-session"], "mentee-limit");
  assert.deepEqual(usage.availableFormats, ["quick-ask"]);
  assert.equal(usage.available, true);
  assert.equal(usage.reason, null);
});

test("quick asks and reviews use async slots, never mentee slots", () => {
  const state = mentorState(
    { capacity: { ...mentorDefaults().capacity, maxOpenAsync: 1 } },
    { a: room("a", "quick-ask"), b: room("b", "doc-review") },
  );
  const usage = capacityUsage(state, NOW);
  assert.equal(usage.activeMentees, 0);
  assert.equal(usage.openAsync, 2);
  assert.equal(usage.formatReasons["quick-ask"], "async-limit");
  assert.deepEqual(usage.availableFormats, ["single-session"]);
});

test("hours count the accepted month for async work and the scheduled month for sessions", () => {
  const state = mentorState(
    {},
    {
      a: room("a", "quick-ask"), // 15 min, accepted in March
      b: room("b", "single-session", {
        milestones: {
          held: {
            schedules: [
              session("2030-03-20", 60), // March: counts
              session("2030-04-02", 120), // April: does not
            ],
          },
        },
      }),
    },
  );
  assert.equal(capacityUsage(state, NOW).minutesCommitted, 75);
});

test("a mentor out of hours has no available format", () => {
  const state = mentorState(
    {},
    {
      a: room("a", "single-session", {
        milestones: { held: { schedules: [session("2030-03-20", 240)] } },
      }),
    },
  );
  const usage = capacityUsage(state, NOW);
  assert.equal(usage.hoursLeft, 0);
  assert.equal(usage.available, false);
  assert.equal(usage.reason, "hours-limit");
  assert.equal(availabilityFit(usage), 0);
  assert.equal(formatFit(usage), 0);
});

test("the capacity month follows the mentor's time zone", () => {
  // 31 March 20:00 UTC is already 1 April in Manila.
  const state = mentorState(
    { timeZone: "Asia/Manila" },
    {
      a: room("a", "single-session", {
        milestones: {
          held: {
            schedules: [
              {
                date: "2030-03-31",
                time: "20:00",
                timeZone: "UTC",
                durationMinutes: 60,
              },
            ],
          },
        },
      }),
    },
  );
  assert.equal(
    capacityUsage(state, Date.parse("2030-03-31T20:30:00Z")).minutesCommitted,
    60,
  );
  assert.equal(capacityUsage(state, NOW).minutesCommitted, 0);
});

test("pause and missing guidelines make a mentor unavailable with a reason", () => {
  assert.equal(
    capacityUsage(mentorState({ paused: true }), NOW).reason,
    "paused",
  );
  const unaccepted = mentorState({ guidelinesVersion: null });
  assert.equal(capacityUsage(unaccepted, NOW).reason, "guidelines");
  assert.equal(capacityUsage(unaccepted, NOW).available, false);
  assert.equal(availabilityFit(capacityUsage(unaccepted, NOW)), 0);
});

test("mentors having room in hours but no slot type score half on availability", () => {
  const state = mentorState(
    { capacity: { ...mentorDefaults().capacity, maxMentees: 1 } },
    { a: room("a", "single-session") },
  );
  state.profiles.mentor.formats = [{ id: "single-session", price: 0 }];
  const usage = capacityUsage(state, NOW);
  assert.equal(usage.reason, "mentee-limit");
  assert.equal(availabilityFit(usage), 0.5);
});

test("closed rooms free their slot", () => {
  const state = mentorState(
    { capacity: { ...mentorDefaults().capacity, maxMentees: 1 } },
    { a: room("a", "single-session", { status: "launched" }) },
  );
  assert.equal(capacityUsage(state, NOW).activeMentees, 0);
});

test("guidelines have a grace period for existing mentors only", () => {
  const graceUntil = "2030-03-20T00:00:00.000Z";
  assert.equal(
    guidelinesStatus({ guidelinesGraceUntil: graceUntil }, NOW).status,
    "grace",
  );
  assert.equal(
    guidelinesStatus(
      { guidelinesGraceUntil: graceUntil },
      Date.parse("2030-03-21T00:00:00Z"),
    ).status,
    "required",
  );
  assert.equal(guidelinesStatus({}, NOW).status, "required");
  assert.equal(
    guidelinesStatus({ guidelinesVersion: 1 }, NOW).status,
    "accepted",
  );
  // Raising the version puts an accepted mentor back in need of acceptance.
  assert.equal(
    guidelinesStatus({ guidelinesVersion: 1 }, NOW, {
      ...mentorConfig,
      guidelinesVersion: 2,
    }).status,
    "required",
  );
});

test("formats normalize from ids or objects and prices are always 0 in v1", () => {
  assert.deepEqual(normalizeOfferedFormats(["quick-ask", "one-off"]), [
    { id: "quick-ask", price: 0 },
    { id: "single-session", price: 0 },
  ]);
  assert.deepEqual(
    normalizeOfferedFormats([{ id: "doc-review", price: 99900 }, "nope"]),
    [{ id: "doc-review", price: 0 }],
  );
});

test("conflicts block on a matching company and warn on the same industry", () => {
  const mentor = {
    conflicts: [
      { company: "Acme, Inc.", relation: "advisor" },
      { company: "Fin Co", relation: "investor", industry: "FinTech" },
    ],
  };
  assert.equal(
    conflictWith(mentor, { startupName: "ACME", industry: "EdTech" })?.level,
    "block",
  );
  const warn = conflictWith(mentor, {
    startupName: "Other",
    industry: "fintech",
  });
  assert.equal(warn.level, "warn");
  assert.match(warn.text, /Fin Co/);
  assert.equal(
    conflictWith(mentor, { startupName: "Other", industry: "Health" }),
    null,
  );
  // An advisor tie in the same industry is not enough for a warning.
  assert.equal(
    conflictWith(
      {
        conflicts: [{ company: "X", relation: "advisor", industry: "EdTech" }],
      },
      { startupName: "Y", industry: "EdTech" },
    ),
    null,
  );
  assert.equal(normalizeCompany("The Acme Corp."), "the acme");
});

test("users with both roles conflict with their own startup", () => {
  assert.equal(
    conflictWith(
      {},
      { startupName: "My Startup" },
      { ownStartup: "my startup" },
    )?.level,
    "block",
  );
  assert.equal(conflictWith({}, {}, { sameAccount: true })?.level, "block");
});

test("the mentor profile backfill keeps old data and is idempotent", () => {
  const profile = {
    expertise: "Fundraising",
    availability: "Weekly sessions",
    engagementPreference: "ongoing",
  };
  assert.equal(backfillMentorProfile(profile, { topics: "Fundraising" }), true);
  assert.deepEqual(profile.formats, [{ id: "ongoing-advisory", price: 0 }]);
  assert.equal(profile.availability, "Weekly sessions");
  assert.equal(profile.topics, "Fundraising");
  assert.equal(profile.capacity.maxMentees, 3);
  const snapshot = structuredClone(profile);
  assert.equal(backfillMentorProfile(profile, { topics: "Other" }), false);
  assert.deepEqual(profile, snapshot);
});

// --- Workspace behaviour --------------------------------------------------

const founderValues = {
  bio: "We build student tools.",
  offer: "Beta testing",
  need: "Product strategy",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
  startupName: "Studyloop",
};
const mentorValues = {
  bio: "Product mentor for student teams.",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech student tools",
};
function setup(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-mentor-"));
  const file = join(dir, "workspace.json");
  const clock = { value: Date.now() };
  const open = () =>
    createWorkspace(file, { now: () => clock.value, ...options });
  let workspace = open();
  t.after(() => {
    workspace.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const user = (name, role, values, accept = true) => {
    const u = workspace.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
    u.role = role;
    workspace.act(u.token, { role, form: "profile-form", values });
    if (role === "mentor" && accept)
      workspace.act(u.token, {
        role,
        form: "accept-guidelines",
        values: { version: 1 },
      });
    return u;
  };
  const act = (u, command) =>
    workspace.act(u.token, { role: u.role, ...command });
  const view = (u) => workspace.get(u.token, u.role).state;
  return {
    clock,
    file,
    user,
    act,
    view,
    open,
    get workspace() {
      return workspace;
    },
    reopen() {
      workspace.close();
      workspace = open();
      return workspace;
    },
  };
}
const idOf = (u) => `${u.state.accountId}:${u.role}`;

test("a paused mentor returns pending requests with alternatives and stays discoverable", (t) => {
  const s = setup(t);
  const founder = s.user("Alex", "founder", founderValues);
  const paused = s.user("Pat", "mentor", mentorValues);
  const other = s.user("Jordan", "mentor", mentorValues);
  s.act(founder, { action: "interest", id: idOf(paused) });
  assert.equal(s.view(paused).incomingByRole.mentor.size, 1);

  const result = s.act(paused, {
    form: "set-mentor-pause",
    values: { paused: "on" },
  });
  assert.match(result.state.toast, /1 pending request was returned/);
  assert.equal(s.view(paused).incomingByRole.mentor.size, 0);
  assert.equal(s.view(paused).profiles.mentor.paused, true);

  const mine = s.view(founder);
  assert.equal(mine.waitingByRole.founder.size, 0);
  const entry = mine.introHistoryByRole.founder[0];
  assert.equal(entry.status, "returned");
  assert.equal(entry.reason, "mentor-paused");
  assert.deepEqual(
    entry.alternatives.map((item) => item.id),
    [idOf(other)],
  );
  // The paused mentor stays visible, flagged as unavailable.
  const listed = mine.directory.mentors.find(
    (item) => item.id === idOf(paused),
  );
  assert.equal(listed.available, false);
  assert.equal(listed.reason, "paused");
  assert.match(listed.availability, /Not taking requests/);
  // And a new request is refused with the reason and alternatives.
  assert.throws(
    () => s.act(founder, { action: "interest", id: idOf(paused) }),
    (error) =>
      error.status === 409 &&
      error.data.reason === "paused" &&
      error.data.alternatives[0].id === idOf(other),
  );
  // Resuming reopens requests.
  s.act(paused, { form: "set-mentor-pause", values: {} });
  s.act(founder, { action: "interest", id: idOf(paused) });
});

test("Pause Mode resumes automatically on the chosen date", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const day = 86400000;
  const resume = new Date(s.clock.value + 3 * day).toISOString().slice(0, 10);
  s.act(mentor, {
    form: "set-mentor-pause",
    values: { paused: "on", pausedUntil: resume },
  });
  assert.equal(s.view(mentor).profiles.mentor.paused, true);
  s.clock.value += 5 * day;
  const after = s.view(mentor).profiles.mentor;
  assert.equal(after.paused, false);
  assert.equal(after.pausedUntil, null);
  assert.throws(
    () =>
      s.act(mentor, {
        form: "set-mentor-pause",
        values: { paused: "on", pausedUntil: "2000-01-01" },
      }),
    /resume date/i,
  );
});

test("a mentor at the mentee limit refuses further session requests with a reason", (t) => {
  const s = setup(t);
  const first = s.user("Alex", "founder", founderValues);
  const second = s.user("Sam", "founder", {
    ...founderValues,
    startupName: "Other Co",
  });
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: "1",
      monthlyHours: "4",
      maxOpenAsync: "3",
      responseDays: "3",
      "format-single-session": "on",
      timeZone: "Asia/Manila",
    },
  });
  s.act(first, { action: "interest", id: idOf(mentor) });
  s.act(mentor, {
    action: "accept-interest",
    id: idOf(first).replace(":mentor", ":founder"),
  });
  assert.equal(s.view(mentor).mentorUsage.activeMentees, 1);
  assert.throws(
    () => s.act(second, { action: "interest", id: idOf(mentor) }),
    (error) => error.status === 409 && error.data.reason === "mentee-limit",
  );
  assert.equal(s.view(second).directory.mentors[0].availableFormats.length, 0);
});

test("mentoring settings validate limits, formats, time zone and the guidelines version", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const values = {
    maxMentees: "2",
    monthlyHours: "6",
    maxOpenAsync: "4",
    responseDays: "5",
    "format-quick-ask": "on",
    "format-office-hours": "on",
    timeZone: "Asia/Singapore",
  };
  s.act(mentor, { form: "mentor-capacity", values });
  const saved = s.view(mentor).profiles.mentor;
  assert.deepEqual(saved.capacity, {
    maxMentees: 2,
    monthlyHours: 6,
    maxOpenAsync: 4,
    responseDays: 5,
  });
  assert.deepEqual(
    saved.formats.map((item) => item.id),
    ["quick-ask", "office-hours"],
  );
  for (const [patch, field] of [
    [{ maxMentees: "11" }, "maxMentees"],
    [{ monthlyHours: "0" }, "monthlyHours"],
    [{ responseDays: "4" }, "responseDays"],
    [{ timeZone: "Mars/Base" }, "timeZone"],
    [{ "format-quick-ask": "", "format-office-hours": "" }, "formats"],
  ])
    assert.throws(
      () =>
        s.act(mentor, {
          form: "mentor-capacity",
          values: { ...values, ...patch },
        }),
      (error) => Boolean(error.fields?.[field]),
    );
  assert.throws(
    () => s.act(mentor, { form: "accept-guidelines", values: { version: 9 } }),
    /updated/i,
  );
  const founder = s.user("Alex", "founder", founderValues);
  assert.throws(
    () =>
      s.act(founder, { form: "set-mentor-pause", values: { paused: "on" } }),
    /mentor profile/i,
  );
});

test("a disclosed conflict hides the pair in both directions and blocks direct requests", (t) => {
  const s = setup(t);
  const founder = s.user("Alex", "founder", founderValues);
  const mentor = s.user("Pat", "mentor", mentorValues);
  assert.equal(s.view(founder).directory.mentors.length, 1);
  s.act(mentor, {
    form: "mentor-conflicts",
    values: { op: "add", company: "Studyloop Inc", relation: "advisor" },
  });
  assert.equal(s.view(founder).directory.mentors.length, 0);
  assert.equal(s.view(mentor).directory.mentorStartups.length, 0);
  assert.throws(
    () => s.act(founder, { action: "interest", id: idOf(mentor) }),
    (error) => error.status === 404 || error.data?.reason === "conflict",
  );
  // The conflict list is never exposed to founders.
  assert.equal(
    JSON.stringify(s.view(founder)).includes("Studyloop Inc"),
    false,
  );
  // Removing the conflict restores visibility.
  const item = s.view(mentor).profiles.mentor.conflicts[0];
  s.act(mentor, {
    form: "mentor-conflicts",
    values: { op: "remove", id: item.id },
  });
  assert.equal(s.view(founder).directory.mentors.length, 1);
});

test("a same-industry investment warns the mentor but keeps the pair matched", (t) => {
  const s = setup(t);
  const founder = s.user("Alex", "founder", founderValues);
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.act(mentor, {
    form: "mentor-conflicts",
    values: {
      op: "add",
      company: "Learn Fund",
      relation: "investor",
      industry: "EdTech",
    },
  });
  const listed = s.view(mentor).directory.mentorStartups[0];
  assert.match(listed.conflictWarning, /Learn Fund/);
  assert.equal(s.view(founder).directory.mentors.length, 1);
});

test("conflict entries are validated and 'no conflicts' needs an empty list", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  assert.throws(
    () =>
      s.act(mentor, {
        form: "mentor-conflicts",
        values: { op: "add", company: "", relation: "boss" },
      }),
    (error) => Boolean(error.fields?.company && error.fields?.relation),
  );
  s.act(mentor, {
    form: "mentor-conflicts",
    values: { op: "add", company: "Acme", relation: "employee" },
  });
  assert.throws(
    () => s.act(mentor, { form: "mentor-conflicts", values: { op: "none" } }),
    /Remove your listed conflicts/,
  );
  const id = s.view(mentor).profiles.mentor.conflicts[0].id;
  s.act(mentor, { form: "mentor-conflicts", values: { op: "remove", id } });
  s.act(mentor, { form: "mentor-conflicts", values: { op: "none" } });
  assert.equal(s.view(mentor).profiles.mentor.noConflicts, true);
});

test("existing mentors are migrated with a guidelines grace period, and migrating twice changes nothing", (t) => {
  const s = setup(t);
  s.user("Pat", "mentor", mentorValues);
  // Rewrite the stored account as a pre-Phase 1 mentor, then reopen.
  s.workspace.close();
  const raw = readWorkspaceSnapshot(s.file);
  const stored = Object.values(raw.accounts)[0];
  for (const key of Object.keys(mentorDefaults()))
    delete stored.state.profiles.mentor[key];
  stored.state.profiles.mentor.engagementPreference = "either";
  stored.state.profiles.mentor.availability = "Weekly sessions";
  delete raw.mentorRules;
  writeFileSync(s.file, encode(raw));
  // Sessions end when the workspace closes, so sign in again after reopening.
  const signIn = () => {
    const u = s.workspace.login({
      email: "pat@example.com",
      password: "private-password",
    });
    u.role = "mentor";
    return u;
  };
  s.reopen();
  let again = signIn();
  const first = s.view(again).profiles.mentor;
  assert.equal(first.capacity.maxMentees, 3);
  assert.deepEqual(
    first.formats.map((item) => item.id),
    ["single-session", "ongoing-advisory"],
  );
  // Nothing the mentor wrote is lost.
  assert.equal(first.availability, "Weekly sessions");
  assert.equal(first.topics, canonicalTags(mentorValues.expertise).join(", "));
  assert.ok(first.guidelinesGraceUntil);
  assert.equal(s.view(again).mentorUsage.guidelines.status, "grace");
  // The grace window counts from the release, not from each reopen.
  const before = JSON.stringify(first);
  s.clock.value += 3600000;
  s.reopen();
  again = signIn();
  assert.equal(JSON.stringify(s.view(again).profiles.mentor), before);
});

test("mentors who join after Phase 1 get no grace period", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues, false);
  const usage = s.view(mentor).mentorUsage;
  assert.equal(usage.available, false);
  assert.equal(usage.reason, "guidelines");
  assert.equal(usage.guidelines.status, "required");
  const founder = s.user("Alex", "founder", founderValues);
  assert.throws(
    () => s.act(founder, { action: "interest", id: idOf(mentor) }),
    (error) => error.status === 409 && error.data.reason === "guidelines",
  );
});
