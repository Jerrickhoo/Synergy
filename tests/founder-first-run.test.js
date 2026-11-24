// Founder first-run review fixes: return visits, first-run choice, honest
// suggestions, search, match alerts and simulated goal confirmation.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createWorkspace } from "../server/workspace.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import { analyzeDescription } from "../src/data/profile-assistant.js";
import { filterPeople } from "../src/data/filters.js";
import { offersNeed } from "../src/data/collaboration.js";
import { primaryNeed } from "../src/data/home.js";
import { pageLabel } from "../src/data/filters.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

function workspaceFile(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-first-run-"));
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return join(dir, "workspace.json");
}
function demo(t, options = {}) {
  const file = workspaceFile(t);
  const workspace = createWorkspace(file, { demoMode: true, ...options });
  t.after(() => workspace.close());
  return { file, workspace };
}
const previews = (file) =>
  Object.values(readWorkspaceSnapshot(file).accounts).filter(
    (account) => account.demo && !account.demoSample,
  );
const mismatch =
  "That email is already used in this preview. Use the same password as before, or a different email.";

test("A1: the same preview email and password return the same account", async (t) => {
  const { file, workspace } = demo(t);
  const first = workspace.openDemo("founder", {
    email: "  Founder@Shiftly.io ",
    password: "pw",
  });
  assert.equal(first.state.accountEmail, "founder@shiftly.io");
  workspace.act(first.token, {
    role: "founder",
    form: "profile-form",
    values: {
      ...first.state.profiles.founder,
      name: "Jordan Lee",
      bio: "Shiftly schedules restaurant staff.",
    },
  });
  // A second tab signs in again, through the API's asynchronous path.
  const again = await workspace.openDemoAsync("founder", {
    email: "founder@shiftly.io",
    password: "pw",
  });
  assert.equal(again.state.accountId, first.state.accountId);
  assert.notEqual(again.token, first.token);
  assert.equal(again.state.accountName, "Jordan Lee");
  assert.equal(
    again.state.profiles.founder.bio,
    "Shiftly schedules restaurant staff.",
  );
  // Another role needs confirmation first (round 2, C1), then applies.
  const asMentor = workspace.openDemo("mentor", {
    email: "FOUNDER@shiftly.io",
    password: "pw",
    confirmRoleSwitch: true,
  });
  assert.equal(asMentor.state.accountId, first.state.accountId);
  assert.equal(asMentor.state.role, "mentor");
  // The password is stored as a salted scrypt hash, never in plain text.
  const [stored] = previews(file);
  assert.equal(previews(file).length, 1);
  assert.match(stored.salt, /^[0-9a-f]{32}$/);
  assert.match(stored.passwordHash, /^[0-9a-f]{128}$/);
  assert.equal(JSON.stringify(stored).includes('"pw"'), false);
  // Preview credentials never become password sign-in credentials.
  assert.throws(
    () =>
      workspace.login({ email: "founder@shiftly.io", password: "pw-pw-pw" }),
    (error) => error.status === 401,
  );
});

test("A1: a wrong password shows the preview message and creates nothing", async (t) => {
  const { file, workspace } = demo(t);
  workspace.openDemo("founder", { email: "a@example.com", password: "right" });
  for (const open of [
    () =>
      workspace.openDemo("founder", { email: "a@example.com", password: "x" }),
    () =>
      workspace.openDemoAsync("founder", {
        email: "A@example.com",
        password: "wrong",
      }),
  ])
    await assert.rejects(
      async () => open(),
      (error) =>
        error.status === 401 &&
        error.message === mismatch &&
        error.fields?.password === mismatch,
    );
  assert.equal(previews(file).length, 1);
});

test("A1: preview sign-in validates the email, and no credentials keeps today's fresh account", (t) => {
  const { file, workspace } = demo(t);
  for (const email of ["notanemail", "a@b", "", "two words@example.com"])
    assert.throws(
      () => workspace.openDemo("founder", { email, password: "pw" }),
      (error) => error.status === 400 && Boolean(error.fields?.email),
      email,
    );
  assert.throws(
    () => workspace.openDemo("founder", { email: "a@example.com" }),
    (error) => error.status === 400 && Boolean(error.fields?.password),
  );
  assert.equal(previews(file).length, 0);
  const one = workspace.openDemo("founder");
  const two = workspace.openDemo("founder");
  assert.notEqual(one.state.accountId, two.state.accountId);
  assert.equal(one.state.accountName, "Maria Santos");
  assert.equal(one.state.firstRunChoice, false);
  assert.equal(one.state.profiles.founder.stage, "pre-seed");
});

test("A1: deleting a preview account frees its email for a new account", (t) => {
  const { file, workspace } = demo(t);
  const credentials = { email: "gone@example.com", password: "pw" };
  const first = workspace.openDemo("founder", credentials);
  workspace.accounts.delete(first.token);
  const deleted = readWorkspaceSnapshot(file).accounts[first.state.accountId];
  assert.equal(deleted.previewEmail, undefined);
  assert.equal(deleted.passwordHash, "");
  const next = workspace.openDemo("founder", {
    ...credentials,
    password: "new",
  });
  assert.notEqual(next.state.accountId, first.state.accountId);
});

test("B1: a new founder preview chooses a blank startup or the sample", (t) => {
  const { workspace } = demo(t);
  const blank = workspace.openDemo("founder", {
    email: "blank@example.com",
    password: "pw",
  });
  assert.equal(blank.state.firstRunChoice, true);
  const chosen = workspace.act(blank.token, {
    role: "founder",
    action: "first-run-choice",
    values: { start: "blank" },
  }).state;
  assert.equal(chosen.firstRunChoice, false);
  assert.equal(chosen.accountName, "");
  for (const key of ["bio", "offer", "need", "industry", "stage", "teamSize"])
    assert.equal(chosen.profiles.founder[key], "", key);
  assert.equal(chosen.profiles.founder.image, undefined);
  // The mentor side is unchanged.
  assert.equal(chosen.profiles.mentor.expertise, "Product strategy, Growth");
  assert.throws(
    () =>
      workspace.act(blank.token, {
        role: "founder",
        action: "first-run-choice",
        values: { start: "sample" },
      }),
    (error) => error.status === 409,
  );
  // Coming back does not ask again.
  assert.equal(
    workspace.openDemo("founder", {
      email: "blank@example.com",
      password: "pw",
    }).state.firstRunChoice,
    false,
  );
  const sample = workspace.openDemo("founder", {
    email: "sample@example.com",
    password: "pw",
  });
  const kept = workspace.act(sample.token, {
    role: "founder",
    action: "first-run-choice",
    values: { start: "sample" },
  }).state;
  assert.equal(kept.accountName, "Maria Santos");
  assert.equal(kept.profiles.founder.image, "/demo/avatars/maria.svg");
  assert.equal(
    workspace.openDemo("mentor", { email: "m@example.com", password: "pw" })
      .state.firstRunChoice,
    false,
  );
});

test("B3: offers come only from offer phrasing, and unmatched needs stay in the text", () => {
  const shiftly = analyzeDescription(
    "Shiftly is staff scheduling software for independent restaurants. We are a seed-stage team of 6 with 40 paying restaurants, but churn spikes after month two. We need help with pricing strategy and customer retention. We can offer intros to restaurant operators and product feedback.",
  );
  assert.equal(shiftly.offers.includes("Technical Development"), false);
  assert.deepEqual(shiftly.offers, ["Product Feedback"]);
  assert.equal(
    shiftly.offerText,
    "Intros to restaurant operators, Product feedback",
  );
  assert.deepEqual(shiftly.needs, ["Pricing Strategy"]);
  assert.match(shiftly.needText, /Customer retention/);
  assert.deepEqual(shiftly.unmatched, ["customer retention"]);
  assert.equal(shiftly.stage, "seed");
  assert.equal(shiftly.teamSize, "6");
  // Feedback is offered, not asked for, so no clarifying question.
  assert.deepEqual(shiftly.questions, []);
  for (const phrase of [
    "We offer",
    "We can offer",
    "We can help with",
    "We can share",
  ])
    assert.deepEqual(
      analyzeDescription(`${phrase} user research.`).offers,
      ["User Research"],
      phrase,
    );
  assert.deepEqual(
    analyzeDescription("We can help with user research.").needs,
    [],
  );
  assert.deepEqual(
    analyzeDescription("We have 400 users and built an app.").offers,
    [],
  );
});

test("C4: search ignores surrounding spaces and treats spaces alone as no filter", () => {
  const people = [
    {
      name: "Ada",
      kind: "Mentor",
      sector: "SaaS",
      score: 10,
      offer: [],
      need: [],
    },
    {
      name: "Ben",
      kind: "Startup",
      sector: "EdTech",
      score: 5,
      offer: [],
      need: [],
    },
  ];
  const filters = {
    type: "all",
    industry: "all",
    engagement: "all",
    score: "",
  };
  assert.equal(filterPeople(people, { ...filters, search: "   " }).length, 2);
  assert.equal(filterPeople(people, { ...filters, search: "" }).length, 2);
  assert.deepEqual(
    filterPeople(people, { ...filters, search: "  ada  " }).map((p) => p.name),
    ["Ada"],
  );
});

test("C1/C2 helpers name the first need and recognise who offers it", () => {
  assert.equal(
    primaryNeed({ needTags: "Pricing Strategy", need: "pricing and churn" }),
    "pricing strategy",
  );
  assert.equal(
    primaryNeed({ need: "customer retention and pricing" }),
    "customer retention",
  );
  assert.equal(
    offersNeed({ offer: ["Pricing strategy"] }, "pricing strategy"),
    true,
  );
  assert.equal(
    offersNeed({ offer: ["Beta testing"] }, "pricing strategy"),
    false,
  );
  assert.equal(
    offersNeed(
      { offer: ["Customer retention playbooks"] },
      "customer retention",
    ),
    true,
  );
});

test("C2: a match alert adds a match-suggestion Update for new profiles only", (t) => {
  const file = workspaceFile(t);
  const workspace = createWorkspace(file, { mentorApprovalRequired: false });
  t.after(() => workspace.close());
  const user = (name, role, values) => {
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
    workspace.act(u.token, { role, form: "profile-form", values });
    if (role === "mentor")
      workspace.act(u.token, {
        role,
        form: "accept-guidelines",
        values: { version: 2 },
      });
    return u;
  };
  const founder = user("Shiftly", "founder", {
    bio: "Staff scheduling for restaurants.",
    offer: "Restaurant operator intros",
    need: "Customer retention",
    industry: "SaaS",
    stage: "seed",
    teamSize: "6",
  });
  const early = user("Early", "mentor", {
    bio: "Retention mentor.",
    offer: "Customer retention",
    need: "Focused questions",
    expertise: "Customer retention",
    startups: "SaaS",
  });
  const set = (enabled) =>
    workspace.act(founder.token, {
      role: "founder",
      form: "match-alert",
      values: { need: "customer retention", enabled },
    });
  workspace.act(founder.token, {
    role: "founder",
    form: "notification-preferences",
    values: { digest: "off" },
  });
  const on = set("on").state;
  assert.deepEqual(
    on.matchAlerts.map((alert) => alert.need),
    ["customer retention"],
  );
  assert.equal(on.notificationPreferences.match, true);
  const alerts = (state) =>
    state.notifications.filter((item) => item.id.startsWith("match-alert:"));
  // A profile that already offered it is the baseline.
  assert.equal(
    alerts(on).some((item) => item.matchId.startsWith(early.state.accountId)),
    false,
  );
  const late = user("Late", "mentor", {
    bio: "Churn and retention advisor.",
    offer: "Customer retention",
    need: "Focused questions",
    expertise: "Customer retention",
    startups: "SaaS",
  });
  const after = workspace.get(founder.token, "founder").state;
  const [update] = alerts(after);
  assert.equal(update.kind, "match");
  assert.equal(update.category, "match");
  assert.equal(update.matchId, `${late.state.accountId}:mentor`);
  assert.equal(update.text, "Late Test offers customer retention.");
  assert.equal(update.read, false);
  assert.deepEqual(set("off").state.matchAlerts, []);
  assert.equal(alerts(workspace.get(founder.token, "founder").state).length, 0);
  assert.throws(
    () =>
      workspace.act(founder.token, {
        role: "founder",
        form: "match-alert",
        values: { need: "" },
      }),
    (error) => error.status === 400,
  );
});

test("D4: a preview founder can simulate the fictional mentor confirming the goal", (t) => {
  const { file, workspace } = demo(t);
  const founder = workspace.openDemo("founder");
  const mentor = founder.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  assert.equal(mentor.prototypePartner, true);
  workspace.act(founder.token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const accepted = workspace.act(founder.token, {
    role: "founder",
    action: "simulate-acceptance",
    id: mentor.id,
  }).state;
  const room = Object.values(accepted.rooms)[0];
  assert.equal(room.milestones.goal.me, false);
  const confirmed = workspace.act(founder.token, {
    role: "founder",
    action: "simulate-goal-confirmation",
    activeRoomId: room.id,
    // A client-supplied goal is ignored; the founder's question stands.
    values: { goal: "Something else" },
  }).state;
  const after = confirmed.rooms[room.id];
  assert.equal(after.milestones.goal.me && after.milestones.goal.partner, true);
  assert.equal(after.terms.draft.goal, room.terms.draft.goal);
  assert.match(confirmed.toast, /confirmed the mentorship goal\.$/);
  assert.ok(
    confirmed.notifications.some(
      (item) =>
        item.roomId === room.id &&
        !item.self &&
        /confirmed the mentorship goal/.test(item.text),
    ),
  );
  // The fixture mentor's copy is confirmed too, through the same rule.
  const fixture = readWorkspaceSnapshot(file).accounts[mentor.accountId];
  assert.equal(fixture.state.rooms[room.id].milestones.goal.me, true);
  assert.throws(
    () =>
      workspace.act(founder.token, {
        role: "founder",
        action: "simulate-goal-confirmation",
        activeRoomId: room.id,
      }),
    (error) => error.status === 400,
  );
  // Scheduling now unlocks.
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const scheduled = workspace.act(founder.token, {
    role: "founder",
    form: "schedule",
    activeRoomId: room.id,
    values: { date, time: "10:00", timeZone: "UTC", durationMinutes: "60" },
  }).state;
  assert.equal(scheduled.toast, "Session scheduled.");
});

test("D4: goal simulation is refused for real founder and mentor accounts", (t) => {
  const file = workspaceFile(t);
  const real = createWorkspace(file, { mentorApprovalRequired: false });
  const user = (name, role, values) => {
    const u = real.login(
      {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      },
      true,
    );
    real.act(u.token, { role, form: "profile-form", values });
    if (role === "mentor")
      real.act(u.token, {
        role,
        form: "accept-guidelines",
        values: { version: 2 },
      });
    return u;
  };
  const founder = user("Alex", "founder", {
    bio: "We build student tools.",
    offer: "Beta testing",
    need: "Product strategy",
    industry: "EdTech",
    stage: "idea",
    teamSize: "3",
  });
  const mentor = user("Pat", "mentor", {
    bio: "Product mentor for student teams.",
    offer: "Product strategy",
    need: "Focused questions",
    expertise: "Product strategy",
    startups: "EdTech student tools",
  });
  real.act(founder.token, {
    role: "founder",
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  const roomId = real.act(mentor.token, {
    role: "mentor",
    action: "accept-request",
    id: `${founder.state.accountId}:founder`,
  }).state.activeRoomId;
  // Session-held and review simulation use the same fictional-mentor gate.
  for (const action of [
    "simulate-goal-confirmation",
    "simulate-session-held",
  ]) {
    const simulate = (user, role) =>
      real.act(user.token, { role, action, activeRoomId: roomId });
    assert.throws(
      () => simulate(founder, "founder"),
      (error) => error.status === 403,
    );
    assert.throws(
      () => simulate(mentor, "mentor"),
      (error) => error.status === 403,
    );
  }
  assert.equal(
    real.get(founder.token, "founder").state.rooms[roomId].milestones.goal.me,
    false,
  );
  real.close();
});

test("D6: a mentorship room has one name in the breadcrumb for both roles", () => {
  assert.equal(
    pageLabel("room-detail", "founder", "mentorship"),
    "Mentorship room",
  );
  assert.equal(
    pageLabel("room-detail", "mentor", "mentorship"),
    "Mentorship room",
  );
  assert.equal(pageLabel("room-detail", "founder", "beta"), "Deal Room");
  assert.equal(pageLabel("rooms", "founder"), "Rooms");
});
