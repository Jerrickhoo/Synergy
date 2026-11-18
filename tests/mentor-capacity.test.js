import { flagMessage } from "../src/data/safety-rules.js";
import { applicationSteps } from "./mentor-onboarding-fixtures.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
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
    guidelinesStatus({ guidelinesVersion: 2 }, NOW).status,
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
    createWorkspace(file, {
      now: () => clock.value,
      mentorApprovalRequired: false,
      ...options,
    });
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
        values: { version: 2 },
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
  s.act(founder, {
    action: "interest",
    values: mentorRequestValues,
    id: idOf(paused),
  });
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
  const entry = mine.mentorRequests[0];
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
  s.act(founder, {
    action: "interest",
    values: mentorRequestValues,
    id: idOf(paused),
  });
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
  s.act(first, {
    action: "interest",
    values: mentorRequestValues,
    id: idOf(mentor),
  });
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

test("structured requests enforce pending capacity and recompute server-owned values", (t) => {
  const s = setup(t);
  const [a, b, c] = ["Alex", "Sam", "Quinn"].map((name) =>
    s.user(name, "founder", { ...founderValues, startupName: `${name} Tools` }),
  );
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
  const send = (founder) =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: {
        ...mentorRequestValues,
        price: 2500,
        expiresAt: "2999-01-01",
        quality: -100,
      },
    });
  send(a);
  send(b);
  const [first] = s.view(a).mentorRequests;
  assert.equal(first.price, 0);
  assert.equal(Date.parse(first.expiresAt), s.clock.value + 3 * 86400000);
  assert.ok(first.quality > 0);
  assert.equal(first.consentAt, first.sentAt);
  assert.equal(s.view(mentor).mentorUsage.pendingRequests, 2);
  assert.throws(
    () => send(c),
    (error) => error.status === 409 && error.data.reason === "inbox-full",
  );
  const accept = (founder) =>
    s.act(mentor, { action: "accept-request", id: idOf(founder) });
  const accepted = accept(a).state;
  assert.equal(
    accepted.rooms[accepted.activeRoomId].terms.draft.goal,
    first.question,
  );
  assert.throws(
    () => accept(b),
    (error) => error.status === 409 && error.data.reason === "mentee-limit",
  );
  assert.equal(s.view(a).mentorRequests[0].status, "accepted");
  s.act(b, { action: "withdraw-request", id: idOf(mentor) });
  assert.equal(s.view(b).mentorRequests[0].status, "withdrawn");
  assert.equal(s.view(mentor).mentorUsage.pendingRequests, 0);
});

test("referrals preserve founder consent and declines for no slots allow another request", (t) => {
  const s = setup(t);
  const founder = s.user("Alex", "founder", founderValues);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const alternative = s.user("Jordan", "mentor", mentorValues);
  const send = () =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
  send();
  s.act(mentor, {
    action: "decline-request",
    id: idOf(founder),
    values: { reason: "no-slots", message: "Try again next week." },
  });
  assert.equal(s.view(founder).mentorRequests[0].cooldownUntil, null);
  s.clock.value += 1000;
  send();
  s.act(mentor, {
    action: "refer-request",
    id: idOf(founder),
    values: { mentorIds: [idOf(alternative)] },
  });
  const referral = s.view(founder).mentorRequests[0];
  assert.equal(referral.status, "referred");
  assert.deepEqual(
    referral.alternatives.map(({ id }) => id),
    [idOf(alternative)],
  );
  assert.ok(
    !JSON.stringify(s.view(alternative)).includes(mentorRequestValues.question),
  );
  s.act(founder, {
    action: "send-request",
    id: idOf(alternative),
    values: { ...mentorRequestValues, referralId: referral.id },
  });
  assert.equal(
    s.view(alternative).mentorRequests[0].referredFrom,
    mentor.state.accountId,
  );
  assert.equal(
    s.view(alternative).mentorRequests[0].question,
    mentorRequestValues.question,
  );
});

test("legacy requests retain their original expiry and migrate once", (t) => {
  const s = setup(t);
  const founder = s.user("Alex", "founder", founderValues);
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.act(founder, {
    action: "send-request",
    id: idOf(mentor),
    values: mentorRequestValues,
  });
  s.workspace.close();
  const db = readWorkspaceSnapshot(s.file);
  const sentAt = new Date(s.clock.value - 4 * 86400000).toISOString();
  for (const [from, to] of [
    [founder, mentor],
    [mentor, founder],
  ]) {
    db.accounts[from.state.accountId].state.introductionMetaByRole[from.role][
      idOf(to)
    ] = {
      sentAt,
      note: "Could you look over our onboarding plan?",
      name: to.state.accountName,
    };
  }
  writeFileSync(s.file, encode(db));
  s.reopen();
  const login = (name, role) => ({
    ...s.workspace.login({
      email: `${name}@example.com`,
      password: "private-password",
    }),
    role,
  });
  const m = login("pat", "mentor");
  const f = login("alex", "founder");
  const legacy = s.view(m).mentorRequests[0];
  assert.equal(legacy.kind, "legacy-note");
  assert.equal(legacy.note, "Could you look over our onboarding plan?");
  assert.equal(
    Date.parse(legacy.expiresAt),
    Date.parse(sentAt) + 14 * 86400000,
  );
  assert.equal(s.view(m).mentorRequests[0].id, legacy.id);
  assert.equal(s.view(f).mentorRequests[0].id, legacy.id);
  s.clock.value += 10 * 86400000;
  assert.equal(s.view(f).mentorRequests[0].status, "expired");
  s.clock.value += 31 * 86400000;
  s.view(m);
  const stored = readWorkspaceSnapshot(s.file);
  const [mentorEntry] =
    stored.accounts[m.state.accountId].state.mentorRequestsByRole.mentor;
  assert.equal(mentorEntry.status, "expired");
  assert.equal(Object.hasOwn(mentorEntry, "note"), false);
  assert.equal(
    stored.accounts[f.state.accountId].state.mentorRequestsByRole.founder[0]
      .note,
    legacy.note,
  );
});

test("office hours verify monthly allocations, single-booking ownership and private feed rotation", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const a = s.user("Alex", "founder", founderValues);
  const b = s.user("Sam", "founder", {
    ...founderValues,
    startupName: "Second Co",
  });
  s.act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 1,
      responseDays: 3,
      maxOpenAsync: 3,
      "format-office-hours": "on",
      timeZone: "Asia/Manila",
    },
  });
  const date = new Date(s.clock.value + 3 * 86400000)
    .toISOString()
    .slice(0, 10);
  const open = (time, recurring = false) =>
    s.act(mentor, {
      action: "open-office-slot",
      values: { date, time, durationMinutes: 60, recurring },
    });
  assert.throws(
    () => open("10:00", true),
    (error) => error.status === 409 && error.data.reason === "hours-limit",
  );
  open("10:00");
  assert.throws(
    () => open("12:00"),
    (error) => error.status === 409 && error.data.reason === "hours-limit",
  );
  const [slot] = s.view(a).directory.mentors[0].officeHours;
  assert.equal(slot.startsAt, `${date}T02:00:00.000Z`);
  const book = (founder) =>
    s.act(founder, {
      action: "book-office-hours",
      id: idOf(mentor),
      values: {
        ...mentorRequestValues,
        slotId: slot.slotId,
        desiredOutcome: "Choose one onboarding experiment.",
        date,
      },
    });
  const booked = book(a).state;
  assert.equal(
    booked.rooms[booked.activeRoomId].mentorship.desiredOutcome,
    "Choose one onboarding experiment.",
  );
  assert.equal(
    booked.rooms[booked.activeRoomId].terms.draft.format,
    "office-hours",
  );
  assert.equal(s.view(b).directory.mentors[0].officeHours.length, 0);
  assert.throws(() => book(b), /Just taken/);
  const token = s.act(a, { action: "calendar-link" }).state.calendarToken;
  const feed = s.workspace.calendar(token);
  assert.match(feed, /BEGIN:VEVENT/);
  assert.match(feed, /DTSTART:\d{8}T020000Z/);
  assert.ok(!feed.includes(mentorRequestValues.question));
  s.act(a, { action: "calendar-link", values: { reset: true } });
  assert.throws(
    () => s.workspace.calendar(token),
    /calendar link is unavailable/,
  );
  s.act(mentor, { action: "close-office-slot", id: slot.slotId });
  assert.equal(
    s.view(a).rooms[booked.activeRoomId].milestones.held.schedules[0]
      .cancelledBy,
    "mentor",
  );
  assert.equal(s.view(mentor).mentorUsage.activeMentees, 0);
});

test("weekly Office Hours reserve enough capacity for calendar patterns past the first year", (t) => {
  const s = setup(t);
  s.clock.value = Date.parse("2031-03-02T02:00:00Z");
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 12,
      maxOpenAsync: 3,
      responseDays: 3,
      "format-office-hours": "on",
      timeZone: "Asia/Manila",
    },
  });
  const weekly = (date, durationMinutes) =>
    s.act(mentor, {
      action: "open-office-slot",
      values: {
        date,
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes,
        recurring: true,
      },
    });
  for (const date of ["2031-03-09", "2031-03-10", "2031-03-11"])
    weekly(date, 45);
  assert.throws(() => weekly("2031-03-13", 15), /future month/);
  assert.equal(s.view(mentor).profiles.mentor.officeHours.length, 3);
});

test("new mentors need approval, may resubmit once, and retain draft progress", (t) => {
  const s = setup(t, {
    mentorApprovalRequired: true,
    adminEmails: ["moderator@example.com"],
  });
  const admin = s.user("Moderator", "founder", founderValues);
  const founder = s.user("Alex", "founder", {
    ...founderValues,
    startupName: "Student tools",
  });
  const mentor = s.user("Pat", "mentor", mentorValues);
  const filled = () =>
    applicationSteps.forEach((values, step) =>
      s.act(mentor, {
        action: "mentor-onboarding-save",
        values: { ...values, step },
      }),
    );
  const send = () =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
  assert.equal(s.view(mentor).mentorApplication.step, 0);
  assert.equal(s.view(founder).directory.mentors.length, 0);
  assert.throws(send, { status: 409 });
  s.act(mentor, {
    action: "mentor-onboarding-save",
    values: { ...applicationSteps[0], step: 0 },
  });
  const retry = s.workspace.login({
    email: "pat@example.com",
    password: "private-password",
  });
  assert.equal(retry.state.mentorApplication.step, 1);
  s.act(mentor, { action: "mentor-onboarding-back" });
  filled();
  assert.equal(s.view(mentor).mentorApplication.status, "pending");
  assert.equal(s.view(admin).moderation.mentorApprovals.length, 1);
  assert.throws(
    () =>
      s.act(founder, { action: "approve-mentor", id: mentor.state.accountId }),
    { status: 403 },
  );
  s.act(admin, {
    action: "reject-mentor",
    id: mentor.state.accountId,
    values: { reason: "Please share a current verification reference." },
  });
  assert.match(s.view(mentor).mentorApplication.reason, /current verification/);
  s.act(mentor, { action: "mentor-onboarding-save" });
  filled();
  s.act(admin, { action: "approve-mentor", id: mentor.state.accountId });
  assert.ok(s.view(mentor).profiles.mentor.mentorApprovedAt);
  assert.equal(s.view(mentor).mentorApplication, null);
  assert.equal(s.view(founder).directory.mentors.length, 1);
  send();
});

test("the approval migration keeps established mentor profiles eligible and is idempotent", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  s.workspace.close();
  const migrated = createWorkspace(s.file, { now: () => s.clock.value });
  const signIn = (workspace) =>
    workspace.login({ email: "pat@example.com", password: "private-password" })
      .state.profiles.mentor;
  const first = signIn(migrated);
  assert.equal(first.mentorApprovedBy, "migration");
  migrated.close();
  s.clock.value += 86400000;
  const second = createWorkspace(s.file, { now: () => s.clock.value });
  assert.equal(signIn(second).mentorApprovedAt, first.mentorApprovedAt);
  second.close();
});

test("safety detection flags solicitation and leaves ordinary strategy and contact sharing alone", () => {
  for (const phrase of [
    "I need 5% of your company",
    "I want advisory shares for mentoring",
    "Equity",
    "Vesting",
    "Please pay me",
    "My rate is 500. Pay me through GCash.",
    "Pay using GCash",
    "Transfer to my bank account",
    "Send via Maya",
    "https://paypal.me/example",
    "Let's settle this outside",
    "Message me on WhatsApp to pay",
  ])
    assert.ok(flagMessage(phrase).length, phrase);
  for (const phrase of [
    "We tested PayPal as a checkout option.",
    "Let's share our WhatsApp numbers.",
    "Our cap table shows 10% employee equity.",
    "GCash checkout conversion is improving.",
    "Can you review how we compute churn?",
    "Tell me about vesting schedules.",
  ])
    assert.deepEqual(flagMessage(phrase), [], phrase);
});

test("blocking a request returns it, while suspension closes booked rooms and protects other founders", (t) => {
  const s = setup(t, { adminEmails: ["moderator@example.com"] });
  const mentor = s.user("Pat", "mentor", mentorValues);
  const admin = s.user("Moderator", "founder", founderValues);
  const [a, b, c] = ["Alex", "Blair", "Casey"].map((name) =>
    s.user(name, "founder", {
      ...founderValues,
      startupName: `${name} Company`,
    }),
  );
  const send = (founder) =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
  send(a);
  s.workspace.accounts.block(mentor.token, a.state.accountId, true);
  assert.equal(s.view(a).mentorRequests[0].reason, "blocked");
  send(b);
  const id = s.act(mentor, { action: "accept-request", id: idOf(b) }).state
    .activeRoomId;
  s.act(mentor, { action: "confirm-goal", activeRoomId: id });
  const date = new Date(s.clock.value + 3 * 86400000)
    .toISOString()
    .slice(0, 10);
  s.act(b, {
    form: "schedule",
    activeRoomId: id,
    values: { date, time: "10:00", timeZone: "Asia/Manila" },
  });
  send(c);
  assert.throws(
    () =>
      s.act(b, {
        action: "suspend-mentor",
        id: mentor.state.accountId,
        values: { reason: "Reviewed reported misconduct" },
      }),
    { status: 403 },
  );
  s.act(admin, {
    action: "suspend-mentor",
    id: mentor.state.accountId,
    values: { reason: "Reviewed reported misconduct" },
  });
  assert.equal(s.view(c).mentorRequests[0].reason, "mentor-suspended");
  assert.equal(s.view(c).directory.mentors.length, 0);
  assert.equal(s.view(b).rooms[id].status, "cancelled");
  assert.equal(
    s.view(b).rooms[id].milestones.held.schedules[0].cancelledBy,
    "mentor",
  );
  assert.ok(
    s.view(b).notifications.some((item) => item.kind === "mentor-unavailable"),
  );
  s.act(admin, { action: "reinstate-mentor", id: mentor.state.accountId });
  assert.equal(s.view(c).directory.mentors.length, 1);
  assert.equal(s.view(b).rooms[id].status, "cancelled");
});

test("two missed sessions apply a no-show limit and lifting it does not reapply the same incidents", (t) => {
  const s = setup(t, { adminEmails: ["moderator@example.com"] });
  const mentor = s.user("Pat", "mentor", mentorValues);
  const admin = s.user("Moderator", "founder", founderValues);
  const founders = ["Alex", "Blair"].map((name) =>
    s.user(name, "founder", {
      ...founderValues,
      startupName: `${name} Company`,
    }),
  );
  for (const founder of founders) {
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
    const activeRoomId = s.act(mentor, {
      action: "accept-request",
      id: idOf(founder),
    }).state.activeRoomId;
    s.act(mentor, { action: "confirm-goal", activeRoomId });
    const date = new Date(s.clock.value + 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    s.act(founder, {
      form: "schedule",
      activeRoomId,
      values: {
        date,
        time: "10:00",
        timeZone: "Asia/Manila",
        durationMinutes: 30,
      },
    });
    s.clock.value = Date.parse(`${date}T02:01:00Z`);
    s.act(mentor, {
      action: "report-attendance",
      activeRoomId,
      values: { scheduleIndex: 0, status: "i-missed" },
    });
  }
  assert.equal(s.view(mentor).mentorUsage.reason, "no-show-limit");
  assert.equal(s.view(admin).moderation.mentorSafety.limits.length, 1);
  s.act(admin, {
    action: "lift-limit",
    id: mentor.state.accountId,
    values: { role: "mentor" },
  });
  assert.equal(s.view(mentor).mentorUsage.available, true);
  assert.equal(s.view(admin).moderation.mentorSafety.limits.length, 0);
});

test("flagged messages require acknowledgement and show only categories in the automatic queue", (t) => {
  const s = setup(t, { adminEmails: ["moderator@example.com"] });
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  const admin = s.user("Moderator", "founder", founderValues);
  s.act(founder, {
    action: "send-request",
    id: idOf(mentor),
    values: mentorRequestValues,
  });
  const id = s.act(mentor, { action: "accept-request", id: idOf(founder) })
    .state.activeRoomId;
  const message = "Please pay me for my time with GCash.";
  const send = (acknowledgeSafety) =>
    s.act(mentor, {
      form: "chat-form",
      activeRoomId: id,
      values: { message, acknowledgeSafety },
    });
  assert.throws(
    () => send(false),
    (error) =>
      error.status === 409 && error.data.reason === "mentor-safety-warning",
  );
  assert.equal(s.view(founder).rooms[id].messages.length, 0);
  for (let i = 0; i < 3; i++) send(true);
  assert.deepEqual(s.view(founder).rooms[id].messages[0].safetyFlags, [
    "payment",
  ]);
  const flags = s.view(admin).moderation.mentorSafety.flags;
  assert.equal(flags[0].count, 3);
  assert.ok(!JSON.stringify(flags).includes(message));
});

test("admin mentoring settings take effect immediately and survive restart", (t) => {
  const s = setup(t, { adminEmails: ["moderator@example.com"] });
  const admin = s.user("Moderator", "founder", founderValues);
  const founder = s.user("Alex", "founder", founderValues);
  const first = s.user("Pat", "mentor", mentorValues);
  const second = s.user("Jordan", "mentor", mentorValues);
  const change = (user, path, value) =>
    s.act(user, { form: "mentor-config", values: { path, value } });
  assert.throws(() => change(founder, "freeReschedulesPerSide", "0"), {
    status: 403,
  });
  assert.throws(() => change(admin, "freeReschedulesPerSide", "4"), {
    status: 400,
  });
  assert.throws(() => change(admin, "__proto__.polluted", "1"), {
    status: 400,
  });
  change(admin, "founderMaxPending", "1");
  assert.equal(s.view(founder).mentorRequestLimit, 1);
  s.act(founder, {
    action: "send-request",
    id: idOf(first),
    values: mentorRequestValues,
  });
  assert.throws(
    () =>
      s.act(founder, {
        action: "send-request",
        id: idOf(second),
        values: mentorRequestValues,
      }),
    (error) => error.data.reason === "founder-limit",
  );
  const [entry] = s.view(admin).moderation.mentoring.history;
  assert.equal(entry.before, 3);
  assert.equal(entry.value, 1);
  assert.equal(entry.moderator, "moderator@example.com");
  s.reopen();
  const reopened = s.workspace.login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(reopened.state.mentorConfig.founderMaxPending, 1);
});

test("maintenance delivers a private local-time digest and honors unsubscribe and bounce suppression", async (t) => {
  const sent = [];
  const secret = "test-webhook-secret-32-characters";
  const s = setup(t, {
    emailProvider: "brevo",
    brevoApiKey: "fake-key",
    emailFrom: "sender@example.com",
    brevoWebhookSecret: secret,
    publicUrl: "https://workspace.example.com/",
    emailFetch: async (url, input) => {
      assert.equal(url, "https://api.brevo.com/v3/smtp/email");
      assert.equal(input.headers["api-key"], "fake-key");
      sent.push(JSON.parse(input.body));
      return Response.json(
        { messageId: `brevo-${sent.length}` },
        { status: 201 },
      );
    },
  });
  s.clock.value = Date.parse("2031-01-20T20:00:00Z");
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founders = ["Alex", "Sam", "Quinn"].map((name) =>
    s.user(name, "founder", {
      ...founderValues,
      startupName: `${name} Studio`,
    }),
  );
  const send = (founder) =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
  send(founders[0]);
  send(founders[1]);
  assert.equal(s.view(mentor).mentorRequests.length, 2);
  assert.equal(
    s
      .view(mentor)
      .notifications.some(({ kind }) =>
        ["request", "request-digest"].includes(kind),
      ),
    false,
  );
  await s.workspace.runMaintenance();
  assert.equal(
    sent.filter(({ tags }) => tags.includes("synergy-request-digest")).length,
    0,
  );
  s.clock.value += 4 * 3600000;
  await Promise.all([
    s.workspace.runMaintenance(),
    s.workspace.runMaintenance(),
  ]);
  const digests = sent.filter(({ tags }) =>
    tags.includes("synergy-request-digest"),
  );
  assert.equal(digests.length, 1);
  const digestUpdate = s
    .view(mentor)
    .notifications.filter(({ kind }) => kind === "request-digest");
  assert.equal(digestUpdate.length, 1);
  assert.equal(digestUpdate[0].text, "2 new mentorship requests");
  s.act(mentor, { action: "read-notifications", id: digestUpdate[0].id });
  assert.equal(
    s.view(mentor).notifications.find(({ id }) => id === digestUpdate[0].id)
      .read,
    true,
  );
  assert.match(digests[0].textContent, /2 mentorship requests/);
  assert.ok(!digests[0].textContent.includes(mentorRequestValues.question));
  const link = digests[0].textContent.split("\n").at(-1).split(" ").at(-1);
  const token = new URL(link).searchParams.get("token");
  assert.deepEqual(s.workspace.emailUnsubscribe(token, false), {
    kind: "request",
  });
  s.workspace.emailUnsubscribe(token, true);
  send(founders[2]);
  s.clock.value += 24 * 3600000;
  await s.workspace.runMaintenance();
  assert.equal(
    sent.filter(({ tags }) => tags.includes("synergy-request-digest")).length,
    1,
  );
  assert.throws(
    () =>
      s.workspace.emailWebhook("Bearer wrong", {
        event: "hard_bounce",
        email: "pat@example.com",
      }),
    { status: 403 },
  );
  s.workspace.emailWebhook(`Bearer ${secret}`, {
    event: "hard_bounce",
    email: "pat@example.com",
  });
  const bouncedAt = s.view(mentor).mentorEmailStatus.bouncedAt;
  s.clock.value += 1000;
  s.workspace.emailWebhook(`Bearer ${secret}`, {
    event: "hard_bounce",
    email: "pat@example.com",
  });
  assert.equal(s.view(mentor).mentorEmailStatus.bouncedAt, bouncedAt);
});

test("account deletion removes authored notes and unshared mentorship requests from the surviving copy", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const otherMentor = s.user("Jordan", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.act(founder, {
    action: "send-request",
    id: idOf(mentor),
    values: mentorRequestValues,
  });
  const roomId = s.act(mentor, { action: "accept-request", id: idOf(founder) })
    .state.activeRoomId;
  s.act(founder, {
    form: "session-note",
    activeRoomId: roomId,
    values: { text: "Founder note to remove" },
  });
  s.act(mentor, {
    form: "session-note",
    activeRoomId: roomId,
    values: { text: "Mentor note remains" },
  });
  s.act(founder, {
    action: "send-request",
    id: idOf(otherMentor),
    values: {
      ...mentorRequestValues,
      question: "Unshared request question to remove.",
    },
  });
  const id = founder.state.accountId;
  s.workspace.accounts.delete(founder.token);
  const room = s.view(mentor).rooms[roomId];
  assert.deepEqual(
    room.notes.map(({ text }) => text),
    ["Mentor note remains"],
  );
  assert.equal(room.status, "cancelled");
  const snapshot = readWorkspaceSnapshot(s.file);
  assert.equal(snapshot.accounts[id].state.accountName, "Deleted account");
  assert.deepEqual(snapshot.accounts[id].state.profiles.mentor.officeHours, []);
  const [entry] =
    snapshot.accounts[otherMentor.state.accountId].state.mentorRequestsByRole
      .mentor;
  assert.equal(entry.name, "Deleted account");
  assert.equal(entry.status, "returned");
  assert.equal(entry.question, undefined);
});

test("a founder and mentor complete a session, follow up, review privately and upgrade", (t) => {
  const s = setup(t);
  s.clock.value = Date.parse("2031-03-02T02:00:00Z");
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  const mentorCapacity = (monthlyHours) =>
    s.act(mentor, {
      form: "mentor-capacity",
      values: {
        maxMentees: 3,
        monthlyHours,
        maxOpenAsync: 3,
        responseDays: 3,
        "format-single-session": "on",
        "format-ongoing-advisory": "on",
        timeZone: "Asia/Manila",
      },
    });
  mentorCapacity(4);
  s.act(founder, {
    action: "send-request",
    id: idOf(mentor),
    values: {
      ...mentorRequestValues,
      desiredOutcome: "A concrete plan for a shorter signup flow.",
    },
  });
  const id = s.act(mentor, { action: "accept-request", id: idOf(founder) })
    .state.activeRoomId;
  const act = (who, command, values) =>
    s.act(who, { ...command, activeRoomId: id, values });
  const room = (who) => s.view(who).rooms[id];
  assert.equal(room(founder).mentorship.question, mentorRequestValues.question);
  assert.equal(
    room(mentor).terms.draft.goal,
    "A concrete plan for a shorter signup flow.",
  );
  act(mentor, { action: "confirm-goal" });
  act(
    founder,
    { form: "schedule" },
    {
      date: "2031-03-04",
      time: "10:00",
      timeZone: "Asia/Manila",
      durationMinutes: 60,
    },
  );
  act(
    founder,
    { form: "prep-checklist" },
    { metrics: "Completion rate 42 percent." },
  );
  assert.ok(room(mentor).mentorship.prep.sharedAt);
  act(
    mentor,
    { form: "session-note" },
    {
      sessionIndex: 0,
      text: "Start by removing the optional signup question.",
    },
  );
  act(
    mentor,
    { form: "task-create" },
    { title: "Test a shorter signup flow", priority: "normal", status: "todo" },
  );
  const task = room(founder).tasks[0];
  assert.equal(task.assignee, founder.state.accountId);
  assert.equal(room(founder).notes.length, 1);
  assert.equal(
    room(founder).notes[0].sessionId,
    room(founder).milestones.held.schedules[0].id,
  );
  assert.throws(
    () =>
      act(
        mentor,
        { form: "task-update", id: task.id },
        { ...task, status: "done" },
      ),
    { status: 403 },
  );
  s.clock.value = Date.parse("2031-03-04T02:01:00Z");
  for (const user of [mentor, founder])
    act(
      user,
      { action: "report-attendance" },
      { scheduleIndex: 0, status: "held" },
    );
  act(
    founder,
    { form: "review-form" },
    {
      usefulness: 5,
      clarity: 5,
      responsiveness: 4,
      testimonial: "Founder testimonial",
    },
  );
  assert.equal(room(mentor).review.partnerRating, undefined);
  act(mentor, { form: "review-form" }, { preparedness: 5, followThrough: 4 });
  assert.equal(room(mentor).review.partnerRating, 14 / 3);
  s.clock.value += 22 * 86400000;
  assert.equal(s.view(founder).mentorRequestLimit, 1);
  act(founder, { action: "propose-upgrade" }, { format: "ongoing-advisory" });
  mentorCapacity(1);
  assert.throws(
    () => act(mentor, { action: "accept-upgrade" }),
    (error) => error.status === 409 && error.data.reason === "hours-limit",
  );
  assert.ok(room(mentor).mentorship.upgrade);
  mentorCapacity(4);
  act(mentor, { action: "accept-upgrade" });
  assert.equal(room(founder).terms.draft.format, "ongoing-advisory");
  assert.equal(room(founder).cycle.checkIns, 4);
  assert.equal(s.view(founder).mentorRequestLimit, 1);
  assert.equal(
    room(mentor).notes[0].sessionId,
    room(mentor).mentorship.sessionHistory[0].id,
  );
  act(
    mentor,
    { form: "task-create" },
    { title: "New advisory action", priority: "normal", status: "todo" },
  );
  act(
    founder,
    { action: "submit-followup" },
    {
      [task.id]: "done",
      summary: "Completion improved to 68 percent.",
      shareable: true,
    },
  );
  assert.equal(s.view(founder).mentorRequestLimit, 3);
  assert.equal(
    room(mentor).mentorship.history[0].followup.outcomes[task.id],
    "done",
  );
  assert.equal(
    room(founder).mentorship.history[0].followup.summary,
    "Completion improved to 68 percent.",
  );
  act(
    founder,
    { action: "end-mentorship" },
    { reason: "The project is ready to proceed independently." },
  );
  assert.equal(s.view(mentor).mentorUsage.activeMentees, 0);
});

test("LinkedIn approval satisfies the mentor gate when affiliation verification is enabled", (t) => {
  const s = setup(t, {
    mentorApprovalRequired: true,
    requireVerification: true,
    adminEmails: ["moderator@example.com"],
  });
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  const admin = s.user("Moderator", "founder", founderValues);
  const steps = [...applicationSteps];
  steps[0] = {
    method: "linkedin",
    evidence: "https://www.linkedin.com/in/example-mentor",
  };
  for (const [step, values] of steps.entries())
    s.act(mentor, {
      action: "mentor-onboarding-save",
      values: { ...values, step },
    });
  s.act(admin, { action: "approve-mentor", id: mentor.state.accountId });
  assert.equal(s.view(mentor).affiliation, null);
  assert.equal(s.view(mentor).verification, "verified");
  const send = () =>
    s.act(founder, {
      action: "send-request",
      id: idOf(mentor),
      values: mentorRequestValues,
    });
  assert.throws(send, { status: 403 });
  s.act(founder, {
    form: "affiliation-request",
    values: {
      organization: "Example university",
      evidence: "Verify current enrolment on the public list.",
    },
  });
  s.act(admin, {
    form: "moderation",
    values: {
      kind: "affiliation",
      id: founder.state.accountId,
      decision: "verified",
      note: "Verified the enrolment record.",
    },
  });
  send();
  const accepted = s.act(mentor, {
    action: "accept-request",
    id: idOf(founder),
  }).state;
  assert.equal(accepted.rooms[accepted.activeRoomId].type, "mentorship");
});

test("Doc Review keeps founder materials and releases async capacity on delivery", (t) => {
  const s = setup(t);
  const mentor = s.user("Pat", "mentor", mentorValues);
  const founder = s.user("Alex", "founder", founderValues);
  s.act(mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 4,
      maxOpenAsync: 1,
      responseDays: 3,
      "format-doc-review": "on",
      timeZone: "Asia/Manila",
    },
  });
  s.act(founder, {
    action: "send-request",
    id: idOf(mentor),
    values: { ...mentorRequestValues, format: "doc-review" },
  });
  const activeRoomId = s.act(mentor, {
    action: "accept-request",
    id: idOf(founder),
  }).state.activeRoomId;
  assert.equal(s.view(mentor).mentorUsage.openAsync, 1);
  s.act(founder, {
    form: "evidence",
    activeRoomId,
    id: "uploaded",
    values: { attachment: "https://example.com/pitch" },
  });
  assert.equal(
    s.view(mentor).rooms[activeRoomId].milestones.uploaded.attachment,
    "https://example.com/pitch",
  );
  s.act(mentor, {
    action: "deliver-answer",
    activeRoomId,
    values: { answer: "Start the pitch with the retention result." },
  });
  assert.equal(s.view(mentor).mentorUsage.openAsync, 0);
  s.act(founder, {
    action: "rate-answer",
    activeRoomId,
    values: { rating: "helpful" },
  });
  s.act(founder, {
    action: "log-revision",
    activeRoomId,
    values: { summary: "Moved retention to the opening slide." },
  });
  assert.equal(
    s.view(mentor).rooms[activeRoomId].mentorship.revisions.summary,
    "Moved retention to the opening slide.",
  );
  s.clock.value += 15 * 86400000;
  assert.throws(
    () =>
      s.act(founder, {
        action: "log-revision",
        activeRoomId,
        values: { summary: "Late revision." },
      }),
    /revision window has closed/,
  );
});
