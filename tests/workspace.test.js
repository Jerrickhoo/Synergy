import { mentorRequestValues } from "./mentor-request-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  renameSync,
  mkdirSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { decode } from "../src/state/serialization.js";
import { scheduleInstant, upcomingSessions } from "../src/data/selectors.js";

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-test-"));
  const file = join(dir, "workspace.json");
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  return {
    file,
    workspace: createWorkspace(file, { mentorApprovalRequired: false }),
  };
}
const founder = {
  name: "Alex Rivera",
  bio: "We build student tools.",
  offer: "Technical development, beta testing",
  need: "Beta testers, product feedback",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
};
const mentor = {
  name: "Jamie Lee",
  bio: "Product mentor for student teams.",
  offer: "Product feedback, beta testing",
  need: "Technical development",
  expertise: "Product strategy",
  availability: "Weekly sessions",
  startups: "EdTech student tools",
};
const terms = {
  goal: "Validate the product",
  scope: "Test the onboarding flow",
  timeline: "Two weeks",
  commitment: "Two hours per week",
  compensation: "Mutual feedback",
};
function signup(workspace, name, role = "founder") {
  const user = workspace.login(
    {
      firstName: name,
      lastName: "Tester",
      email: `${name.toLowerCase()}@example.com`,
      password: "private-password",
      role,
    },
    true,
  );
  // New mentors accept the guidelines before taking requests (Phase 1).
  if (role === "mentor")
    workspace.act(user.token, {
      role,
      form: "accept-guidelines",
      values: { version: 2 },
    });
  return user;
}
const act = (workspace, user, command) =>
  workspace.act(user.token, {
    role: user.state.role,
    termsRevision:
      workspace.get(user.token).state.rooms[command.activeRoomId]?.terms
        .revision || 0,
    milestoneVersion:
      workspace.get(user.token).state.rooms[command.activeRoomId]?.milestones[
        command.id
      ]?.contentVersion || 0,
    ...command,
  });
function pair(workspace) {
  const a = signup(workspace, "Alex");
  const b = signup(workspace, "Jamie");
  act(workspace, a, { form: "profile-form", values: founder });
  act(workspace, b, {
    form: "profile-form",
    values: {
      ...founder,
      name: "Jamie Lee",
      offer: "Beta testers, product feedback",
      need: "Technical development",
    },
  });
  const aId = `${a.state.accountId}:founder`,
    bId = `${b.state.accountId}:founder`;
  act(workspace, a, { action: "interest", id: bId });
  const result = act(workspace, b, { action: "accept-interest", id: aId });
  return { a, b, aId, bId, roomId: result.state.activeRoomId };
}

test("accounts authenticate, isolate private data, and survive a server restart", (t) => {
  const { workspace, file } = fixture(t);
  const a = signup(workspace, "Alex");
  assert.deepEqual(workspace.get(a.token).state.directory.founders, []);
  act(workspace, a, { form: "profile-form", values: founder });
  assert.throws(() => signup(workspace, "Alex"), /already exists/);
  assert.throws(
    () =>
      workspace.login({
        email: "alex@example.com",
        password: "wrong-password",
      }),
    /incorrect/,
  );
  assert.throws(() => workspace.get("invalid-token"), /sign in/);
  const b = signup(workspace, "Jamie");
  assert.equal(workspace.get(b.token).state.profiles.founder.bio, "");
  assert.equal(
    workspace.get(b.token).state.directory.founders[0].name,
    founder.name,
  );
  const stored = readFileSync(file, "utf8");
  assert.ok(!stored.includes("private-password"));
  assert.ok(stored.includes("passwordHash"));
  const restarted = createWorkspace(file);
  const login = restarted.login({
    email: "ALEX@example.com",
    password: "private-password",
  });
  assert.equal(login.state.profiles.founder.bio, founder.bio);
  workspace.logout(a.token);
  assert.throws(() => workspace.get(a.token), /sign in/);
});

test("profile changes recompute transparent scores and role-specific directories", (t) => {
  const { workspace } = fixture(t);
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie", "mentor");
  act(workspace, a, { form: "profile-form", values: founder });
  act(workspace, b, { form: "profile-form", values: mentor });
  const before = workspace.get(a.token).state.directory.mentors[0];
  assert.equal(before.kind, "Mentor");
  act(workspace, a, {
    form: "profile-form",
    values: { ...founder, need: "Astrophysics", offer: "Rocket launch" },
  });
  assert.ok(
    workspace.get(a.token).state.directory.mentors[0].score < before.score,
  );
  assert.ok(scoreProfile(founder, mentor, true).why.length === 7);
});

test("a failed disk write rolls back workspace changes", (t) => {
  const { workspace, file } = fixture(t);
  const a = signup(workspace, "Alex");
  const backup = `${file}.backup`;
  assert.ok(resolve(backup).startsWith(resolve(tmpdir()) + sep));
  assert.ok(resolve(file).startsWith(resolve(tmpdir()) + sep));
  renameSync(file, backup);
  mkdirSync(file);
  assert.throws(() =>
    act(workspace, a, { form: "profile-form", values: founder }),
  );
  assert.equal(workspace.get(a.token).state.profiles.founder.bio, "");
  rmdirSync(file);
  renameSync(backup, file);
  const restored = createWorkspace(file).login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(restored.state.profiles.founder.bio, "");
});

test("invitations can be withdrawn or declined and rooms require mutual consent", (t) => {
  const { workspace } = fixture(t);
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie");
  for (const user of [a, b])
    act(workspace, user, { form: "profile-form", values: founder });
  const aId = `${a.state.accountId}:founder`,
    bId = `${b.state.accountId}:founder`;
  act(workspace, a, { action: "interest", id: bId });
  assert.equal(Object.keys(workspace.get(a.token).state.rooms).length, 0);
  assert.ok(workspace.get(b.token).state.incomingByRole.founder.has(aId));
  act(workspace, a, { action: "cancel-interest", id: bId });
  assert.equal(workspace.get(b.token).state.incomingByRole.founder.size, 0);
  act(workspace, a, { action: "interest", id: bId });
  act(workspace, b, { action: "decline-interest", id: aId });
  assert.equal(workspace.get(a.token).state.waitingByRole.founder.size, 0);
  assert.throws(
    () => act(workspace, b, { action: "accept-interest", id: aId }),
    /no longer pending/,
  );
  // Both sides keep when each closed introduction was sent, for Activity.
  const sent = workspace.get(a.token).state.introHistoryByRole.founder;
  const received = workspace.get(b.token).state.introHistoryByRole.founder;
  assert.deepEqual(
    sent.map((item) => item.status),
    ["declined", "withdrawn"],
  );
  for (const item of [...sent, ...received]) {
    assert.ok(Number.isFinite(Date.parse(item.sentAt)), item.status);
    assert.ok(Date.parse(item.sentAt) <= Date.parse(item.at), item.status);
  }
});

test("co-marketing templates agree from either participant's perspective", (t) => {
  const { workspace } = fixture(t);
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie");
  act(workspace, a, {
    form: "profile-form",
    values: {
      ...founder,
      offer: "Technical development",
      need: "Marketing and audience growth",
    },
  });
  act(workspace, b, {
    form: "profile-form",
    values: {
      ...founder,
      name: "Jamie Lee",
      offer: "Marketing and audience growth",
      need: "Technical development",
    },
  });
  const aId = `${a.state.accountId}:founder`,
    bId = `${b.state.accountId}:founder`;
  assert.equal(
    workspace.get(a.token).state.directory.founders[0].engagement,
    "Co-Marketing Swap",
  );
  assert.equal(
    workspace.get(b.token).state.directory.founders[0].engagement,
    "Co-Marketing Swap",
  );
  act(workspace, a, { action: "interest", id: bId });
  const accepted = act(workspace, b, { action: "accept-interest", id: aId });
  const roomId = accepted.state.activeRoomId;
  assert.equal(accepted.state.rooms[roomId].type, "marketing");
  assert.equal(workspace.get(a.token).state.rooms[roomId].type, "marketing");
});

test("rejected room actions do not send collaborator notifications", (t) => {
  const { workspace } = fixture(t);
  const { a, b, roomId } = pair(workspace);
  const before = workspace.get(b.token).state;
  for (const command of [
    { form: "chat-form", values: { message: "   " } },
    { action: "launch-room" },
    { form: "review-form", values: { rating: "5", note: "Too early" } },
  ])
    act(workspace, a, { activeRoomId: roomId, ...command });
  const after = workspace.get(b.token).state;
  assert.deepEqual(after.activity, before.activity);
  assert.deepEqual(after.rooms[roomId], before.rooms[roomId]);
  act(workspace, a, {
    activeRoomId: roomId,
    form: "chat-form",
    values: { message: "A real message" },
  });
  assert.equal(
    workspace.get(b.token).state.activity.length,
    before.activity.length + 1,
  );
});

test("two accounts share terms, chat, evidence, disputes, milestones and blind reviews", (t) => {
  const { workspace, file } = fixture(t);
  const { a, b, roomId } = pair(workspace);
  const command = (user, payload) =>
    act(workspace, user, { activeRoomId: roomId, ...payload });
  const room = (user) => workspace.get(user.token).state.rooms[roomId];
  assert.equal(Object.keys(workspace.get(a.token).state.rooms).length, 1);
  assert.equal(workspace.get(a.token).state.waitingByRole.founder.size, 0);
  command(a, { action: "lock-terms", values: terms });
  assert.equal(room(b).terms.confirmedByMe, false);
  assert.equal(room(b).terms.draft.goal, terms.goal);
  assert.throws(
    () => command(a, { action: "accept-terms" }),
    /no terms waiting/,
  );
  command(b, { action: "accept-terms" });
  assert.equal(room(a).terms.partnerLocked, true);
  command(a, { form: "chat-form", values: { message: "Hello collaborator" } });
  command(b, { form: "chat-form", values: { message: "Hello back" } });
  assert.equal(room(b).messages[0].who, "partner");
  assert.equal(room(a).messages[1].who, "partner");
  command(a, {
    action: "dispute",
    id: "scope",
    values: { reason: "Scope is incomplete" },
  });
  assert.equal(room(b).milestones.scope.dispute.reason, "Scope is incomplete");
  command(a, { action: "resolve-dispute", id: "scope" });
  assert.equal(room(a).milestones.scope.disputed, true);
  command(b, { action: "resolve-dispute", id: "scope" });
  assert.equal(room(a).milestones.scope.disputed, false);
  for (const [id, item] of Object.entries(room(a).milestones)) {
    if (item.evidence)
      command(a, {
        form: "evidence",
        id,
        values: { attachment: `https://example.com/${id}` },
      });
    command(a, { action: "confirm-milestone", id });
    assert.equal(room(b).milestones[id].partner, true);
    command(b, { action: "confirm-milestone", id });
  }
  assert.equal(room(a).progress, 100);
  command(a, { action: "launch-room" });
  assert.equal(room(b).status, "launched");
  command(a, {
    form: "review-form",
    values: { rating: "4", note: "Private first review" },
  });
  assert.equal(room(b).review.partner, true);
  assert.equal(room(b).review.partnerNote, undefined);
  assert.ok(
    !JSON.stringify(workspace.get(b.token)).includes("Private first review"),
  );
  command(b, {
    form: "review-form",
    values: { rating: "5", note: "Great collaboration" },
  });
  assert.equal(room(a).review.partnerNote, "Great collaboration");
  assert.equal(room(b).review.partnerRating, 4);
  assert.equal(room(a).status, "reviewed");
  assert.equal(
    workspace.get(a.token).state.trustHistoryByRole.founder[0].rating,
    5,
  );
  assert.throws(
    () => command(a, { form: "review-form", values: { rating: "1" } }),
    /already been submitted/,
  );
  assert.throws(
    () => command(b, { action: "dispute", id: "scope" }),
    /cannot be changed/,
  );
  const restarted = createWorkspace(file).login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(restarted.state.rooms[roomId].messages.length, 2);
  assert.equal(restarted.state.rooms[roomId].status, "reviewed");
});

test("server rejects cross-account and cross-role room changes and simulation shortcuts", (t) => {
  const { workspace } = fixture(t);
  const { a, roomId } = pair(workspace);
  const stranger = signup(workspace, "Stranger");
  assert.throws(
    () =>
      act(workspace, a, {
        form: "schedule",
        activeRoomId: roomId,
        values: { date: "2099-01-15", time: "15:00" },
      }),
    /Scheduling is available only in mentorship rooms/,
  );
  assert.throws(
    () =>
      act(workspace, stranger, {
        action: "lock-terms",
        activeRoomId: roomId,
        values: terms,
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      workspace.act(a.token, {
        action: "confirm-milestone",
        role: "mentor",
        activeRoomId: roomId,
        id: "scope",
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      act(workspace, a, {
        action: "demo-partner-confirm",
        activeRoomId: roomId,
      }),
    /unavailable/,
  );
  const launch = act(workspace, a, {
    action: "launch-room",
    activeRoomId: roomId,
  });
  assert.equal(launch.state.rooms[roomId].status, "matched");
  act(workspace, a, {
    form: "report-form",
    activeRoomId: roomId,
    values: { reason: "Please review this issue" },
  });
});

test("HTTP API enforces sessions, JSON and same-origin requests", async (t) => {
  const { file } = fixture(t);
  const api = createApi({
    file,
    config: configuration({ SYNERGY_DATA_FILE: file }),
  });
  const server = createServer((req, res) =>
    api(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://another.example",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  const result = await fetch(`${base}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Alex",
      lastName: "Tester",
      email: "alex@example.com",
      password: "private-password",
    }),
  });
  assert.equal(result.status, 200);
  const { token } = decode(await result.text());
  const state = await fetch(`${base}/api/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(state.status, 200);
  assert.equal(decode(await state.text()).state.accountName, "Alex Tester");
});

test("HTTP API accepts configured frontend origins only", async (t) => {
  const { file } = fixture(t);
  const api = createApi({
    file,
    config: configuration({
      SYNERGY_DATA_FILE: file,
      SYNERGY_ALLOWED_ORIGINS: "https://frontend.example/",
    }),
  });
  const server = createServer((req, res) =>
    api(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise((done) => server.close(done)));
  const signup = (origin, email) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        firstName: "Alex",
        lastName: "Tester",
        email,
        password: "private-password",
      }),
    });
  assert.equal(
    (await signup("https://another.example", "a@example.com")).status,
    403,
  );
  assert.equal(
    (await signup("https://frontend.example", "b@example.com")).status,
    200,
  );
});

test("mentorship scheduling preserves the participant timezone across both accounts", (t) => {
  const { workspace } = fixture(t);
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie", "mentor");
  act(workspace, a, { form: "profile-form", values: founder });
  act(workspace, b, { form: "profile-form", values: mentor });
  act(workspace, a, {
    action: "interest",
    values: mentorRequestValues,
    id: `${b.state.accountId}:mentor`,
  });
  const accepted = act(workspace, b, {
    action: "accept-interest",
    id: `${a.state.accountId}:founder`,
  });
  const activeRoomId = accepted.state.activeRoomId;
  act(workspace, b, { activeRoomId, action: "confirm-goal" });
  const result = act(workspace, b, {
    activeRoomId,
    form: "schedule",
    values: { date: "2099-01-15", time: "15:00" },
    timeZone: "Asia/Manila",
  });
  assert.equal(result.state.rooms[activeRoomId].type, "mentorship");
  const schedule = workspace.get(a.token).state.rooms[activeRoomId].milestones
    .held.schedules[0];
  assert.equal(schedule.timeZone, "Asia/Manila");
  assert.equal(
    scheduleInstant(schedule).toISOString(),
    "2099-01-15T07:00:00.000Z",
  );
  assert.equal(upcomingSessions(workspace.get(a.token).state).length, 1);
});
