import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { createWorkspace, scoreProfile } from "../server/workspace.js";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import { backupWorkspace, verifyBackup } from "../server/backup.js";
import { createOperations } from "../server/operations.js";
import { fetchWithDeadline } from "../src/state/request.js";
import { encode, decode } from "../src/state/serialization.js";
import { attentionItems } from "../src/data/selectors.js";

const profile = {
  name: "Alex Example",
  bio: "Student tools",
  offer: "Technical development",
  need: "Beta testing",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
  goals: "Validate student tools",
};
const terms = {
  goal: "Validate onboarding",
  scope: "Five testers",
  timeline: "Two weeks",
  commitment: "Two hours",
  compensation: "Mutual feedback",
};
function fixture(t, sqlite = false) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-review-"));
  const file = join(
    dir,
    "data",
    sqlite ? "workspace.sqlite" : "workspace.json",
  );
  const w = createWorkspace(file);
  t.after(() => {
    w.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const signup = (name) =>
    w.login(
      {
        firstName: name,
        lastName: "Example",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role: "founder",
      },
      true,
    );
  const a = signup("Alex"),
    b = signup("Blair"),
    c = signup("Casey");
  const act = (u, command) => {
    const room = w.get(u.token, command.role || "founder").state.rooms[
      command.activeRoomId
    ];
    return w.act(u.token, {
      role: "founder",
      termsRevision: room?.terms.revision || 0,
      milestoneVersion: room?.milestones[command.id]?.contentVersion || 0,
      ...command,
    });
  };
  act(a, { form: "profile-form", values: profile });
  for (const u of [b, c])
    act(u, {
      form: "profile-form",
      values: {
        ...profile,
        name: u.state.accountName,
        offer: profile.need,
        need: profile.offer,
      },
    });
  const pair = (type = "beta") => {
    act(a, {
      action: "interest",
      id: `${b.state.accountId}:founder`,
      engagementType: type,
    });
    return act(b, {
      action: "accept-interest",
      id: `${a.state.accountId}:founder`,
    }).state.activeRoomId;
  };
  const agree = (id) => {
    act(a, { action: "lock-terms", activeRoomId: id, values: terms });
    act(b, { action: "accept-terms", activeRoomId: id });
  };
  return { dir, file, w, a, b, c, act, pair, agree, signup };
}

test("terms saves and locks reject stale or missing versions without overwriting a collaborator", (t) => {
  const { w, a, b, act, pair } = fixture(t);
  const id = pair();
  act(a, {
    form: "terms-form",
    activeRoomId: id,
    values: terms,
    termsRevision: 0,
  });
  assert.throws(
    () =>
      act(b, {
        form: "terms-form",
        activeRoomId: id,
        values: { ...terms, scope: "Stale edit" },
        termsRevision: 0,
      }),
    (error) => error.status === 409,
  );
  assert.throws(
    () =>
      w.act(b.token, {
        role: "founder",
        action: "lock-terms",
        activeRoomId: id,
        values: terms,
      }),
    (error) => error.status === 409,
  );
  act(a, { action: "lock-terms", activeRoomId: id, values: terms });
  assert.throws(
    () =>
      act(b, { action: "accept-terms", activeRoomId: id, termsRevision: 1 }),
    (error) => error.status === 409,
  );
  assert.equal(w.get(b.token).state.rooms[id].terms.draft.scope, terms.scope);
  act(b, { action: "accept-terms", activeRoomId: id });
  assert.equal(w.get(a.token).state.rooms[id].status, "in-progress");
});

test("confirmations and dispute resolutions apply only to the milestone content actually reviewed", (t) => {
  const { w, a, b, act, pair, agree } = fixture(t);
  const activeRoomId = pair();
  agree(activeRoomId);
  const evidence = (text) =>
    act(a, {
      form: "evidence",
      activeRoomId,
      id: "testing",
      values: { attachment: text },
    });
  evidence("Original evidence");
  const seen = w.get(b.token).state.rooms[activeRoomId].milestones.testing
    .contentVersion;
  evidence("Replacement evidence");
  assert.throws(
    () =>
      act(b, {
        action: "confirm-milestone",
        activeRoomId,
        id: "testing",
        milestoneVersion: seen,
      }),
    (error) => error.status === 409,
  );
  assert.throws(
    () =>
      w.act(b.token, {
        role: "founder",
        action: "confirm-milestone",
        activeRoomId,
        id: "testing",
      }),
    (error) => error.status === 409,
  );
  for (const u of [a, b])
    act(u, { action: "confirm-milestone", activeRoomId, id: "testing" });
  const current = w.get(b.token).state.rooms[activeRoomId].milestones.testing
    .contentVersion;
  act(a, {
    form: "milestone-date",
    activeRoomId,
    id: "testing",
    values: { dueDate: "2035-01-01" },
  });
  const item = w.get(b.token).state.rooms[activeRoomId].milestones.testing;
  assert.equal(item.me, false);
  assert.equal(item.partner, false);
  assert.ok(item.contentVersion > current);
  act(a, { action: "dispute", activeRoomId, id: "testing" });
  assert.throws(
    () =>
      act(b, {
        action: "resolve-dispute",
        activeRoomId,
        id: "testing",
        milestoneVersion: current,
      }),
    (error) => error.status === 409,
  );
  for (const u of [a, b])
    act(u, { action: "resolve-dispute", activeRoomId, id: "testing" });
  assert.equal(
    w.get(a.token).state.rooms[activeRoomId].milestones.testing.disputed,
    false,
  );
});

test("matching measures reciprocal coverage, handles Unicode and does not assume missing inputs", () => {
  const oneSided = scoreProfile(
    { ...profile, offer: "Legal advice" },
    { ...profile, offer: "Beta testing", need: "Financial analysis" },
    false,
  );
  assert.equal(oneSided.factorScores[0], 0);
  assert.ok(oneSided.score < 100);
  assert.deepEqual(oneSided.directionalFit, { yourNeeds: 100, theirNeeds: 0 });
  const missing = scoreProfile({ need: "研究" }, { offer: "研究" }, false);
  assert.equal(missing.factorScores[3], 0);
  assert.equal(missing.factorScores[4], 0);
  const unicode = scoreProfile(
    { need: "研究", offer: "設計" },
    { need: "設計", offer: "研究" },
    false,
  );
  assert.equal(unicode.factorScores[0], 100);
  const mentor = {
    offer: "Pricing advice",
    need: "Students",
    expertise: "Pricing",
    startups: "EdTech idea",
  };
  const founder = { ...profile, need: "Pricing" };
  assert.deepEqual(
    scoreProfile(founder, mentor, true).factorScores,
    scoreProfile(mentor, founder, true).factorScores,
  );
});

test("visibility, blocking and agreed engagement types persist and enforce contact boundaries", (t) => {
  const { w, a, b, act, pair, file } = fixture(t);
  const activeRoomId = pair("marketing");
  assert.equal(w.get(a.token).state.rooms[activeRoomId].type, "marketing");
  assert.equal(
    w.get(b.token).state.rooms[activeRoomId].engagementType,
    "Co-Marketing Swap",
  );
  w.accounts.visibility(a.token, false);
  assert.equal(
    w
      .get(b.token)
      .state.directory.founders.some((p) => p.accountId === a.state.accountId),
    false,
  );
  assert.throws(
    () => act(a, { action: "interest", id: `${b.state.accountId}:founder` }),
    /visible/,
  );
  w.accounts.visibility(a.token, true);
  w.accounts.block(a.token, b.state.accountId, true);
  assert.equal(w.get(b.token).state.rooms[activeRoomId].status, "cancelled");
  assert.equal(
    w
      .get(b.token)
      .state.directory.founders.some((p) => p.accountId === a.state.accountId),
    false,
  );
  assert.throws(
    () =>
      act(b, {
        form: "chat-form",
        activeRoomId,
        values: { message: "Unwanted contact" },
      }),
    (error) => error.status === 403,
  );
  assert.throws(
    () => w.accounts.block(a.token, "__proto__", true),
    /available/,
  );
  const reloaded = createWorkspace(file);
  try {
    const login = reloaded.login({
      email: "alex@example.com",
      password: "private-password",
    });
    assert.equal(
      reloaded.accounts.settings(login.token).blocked[0].id,
      b.state.accountId,
    );
  } finally {
    reloaded.close();
  }
});

test("account export excludes credentials, session revocation is isolated, and deletion preserves anonymous shared history", async (t) => {
  const { w, a, b, c, act, pair, file } = fixture(t);
  const activeRoomId = pair();
  act(a, {
    form: "chat-form",
    activeRoomId,
    values: { message: "Shared plan" },
  });
  const otherSession = await w.loginAsync({
    email: "alex@example.com",
    password: "private-password",
  });
  await assert.rejects(
    w.accounts.password(a.token, "wrong-password"),
    /incorrect/,
  );
  await w.accounts.password(a.token, "private-password");
  w.accounts.revoke(a.token, "others");
  assert.throws(
    () => w.get(otherSession.token),
    (error) => error.status === 401,
  );
  assert.ok(w.get(c.token));
  const exported = w.accounts.export(a.token);
  assert.equal(JSON.stringify(exported).includes("passwordHash"), false);
  assert.equal(JSON.stringify(exported).includes(a.token), false);
  w.accounts.delete(a.token);
  assert.throws(
    () => w.get(a.token),
    (error) => error.status === 401,
  );
  const partner = w.get(b.token).state;
  assert.equal(partner.rooms[activeRoomId].status, "cancelled");
  assert.equal(partner.rooms[activeRoomId].messages[0].name, "Deleted account");
  assert.equal(
    partner.directory.roomPartners.find(
      (p) => p.accountId === a.state.accountId,
    ).name,
    "Deleted account",
  );
  const deleted = readWorkspaceSnapshot(file).accounts[a.state.accountId];
  assert.equal(deleted.email, "");
  assert.equal(deleted.passwordHash, "");
  assert.equal(deleted.state.profiles.founder.bio, "");
});

test("email changes require delivered, current, bounded codes and revoke other sessions", (t) => {
  const { w, a } = fixture(t);
  const other = w.login({
    email: "alex@example.com",
    password: "private-password",
  });
  const proof = w.accounts.beginEmail(a.token, "new-alex@example.com");
  assert.throws(
    () => w.accounts.confirmEmail(a.token, proof.code),
    /unavailable/,
  );
  w.accounts.emailSent(a.token, proof.email, proof.code);
  assert.throws(() => w.accounts.confirmEmail(a.token, "000000"), /incorrect/);
  const result = w.accounts.confirmEmail(a.token, proof.code);
  assert.equal(result.state.accountEmail, proof.email);
  assert.equal(result.state.emailVerified, true);
  assert.throws(
    () => w.get(other.token),
    (error) => error.status === 401,
  );
  assert.throws(
    () => w.accounts.confirmEmail(a.token, proof.code),
    /unavailable/,
  );
  assert.throws(
    () => w.login({ email: "alex@example.com", password: "private-password" }),
    /incorrect/,
  );
  assert.ok(
    w.login({ email: proof.email, password: "private-password" }).token,
  );
});

test("SQLite transactions preserve history, reject competing stale writers and support verified portable backups", (t) => {
  const { w, file, dir, a, b, act, pair } = fixture(t, true);
  const id = pair();
  const stale = createWorkspace(file);
  try {
    const staleUser = stale.login({
      email: "alex@example.com",
      password: "private-password",
    });
    act(a, {
      form: "chat-form",
      activeRoomId: id,
      values: { message: "Latest plan" },
    });
    assert.throws(
      () => stale.accounts.visibility(staleUser.token, false),
      /Another server/,
    );
    assert.equal(
      w.get(b.token).state.rooms[id].messages[0].text,
      "Latest plan",
    );
    const backup = backupWorkspace(file, join(dir, "backups"));
    assert.ok(verifyBackup(backup).revision > 0);
    const restored = createWorkspace(join(backup, "synergy.json"));
    try {
      assert.equal(
        restored.login({
          email: "blair@example.com",
          password: "private-password",
        }).state.rooms[id].messages[0].text,
        "Latest plan",
      );
    } finally {
      restored.close();
    }
  } finally {
    stale.close();
  }
});

test("conditional polling validates sessions and roles and Home prioritizes real pending work", (t) => {
  const { w, a, b, act, pair } = fixture(t);
  const first = w.get(a.token);
  assert.equal(
    w.poll(a.token, "founder", first.revision, first.refreshKey).unchanged,
    true,
  );
  assert.ok(w.poll(a.token, "mentor", first.revision, first.refreshKey).state);
  assert.throws(
    () => w.poll("invalid", "founder", first.revision, first.refreshKey),
    (error) => error.status === 401,
  );
  const id = pair();
  act(a, { action: "lock-terms", activeRoomId: id, values: terms });
  assert.equal(attentionItems(w.get(b.token).state)[0].tab, "terms");
  const current = w.get(a.token);
  assert.ok(w.poll(a.token, "founder", first.revision, first.refreshKey).state);
  assert.equal(
    w.poll(a.token, "founder", current.revision, current.refreshKey).unchanged,
    true,
  );
});

test("account HTTP routes require a session and current password, with real storage readiness", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "synergy-api-review-"));
  const config = configuration({
    SYNERGY_DATA_FILE: join(dir, "workspace.sqlite"),
  });
  const api = createApi({ config });
  const server = createServer((req, res) => api(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    api.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const call = async (path, body, token) => {
    const res = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: decode(await res.text()) };
  };
  assert.equal((await call("health")).body.storage, "ready");
  assert.equal((await call("account")).status, 401);
  const signup = await call("signup", {
    firstName: "HTTP",
    lastName: "Example",
    email: "http@example.com",
    password: "private-password",
    role: "founder",
  });
  const token = signup.body.token;
  assert.ok(token);
  assert.equal(
    (
      await call(
        "account/delete",
        { password: "wrong-password", confirmation: "DELETE" },
        token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "account/sessions/revoke",
        { password: "private-password", id: "others" },
        token,
      )
    ).status,
    200,
  );
  assert.equal((await call("account/export", undefined, token)).status, 200);
  assert.equal(
    (
      await call(
        "account/delete",
        { password: "private-password", confirmation: "DELETE" },
        token,
      )
    ).status,
    200,
  );
  assert.equal((await call("state", undefined, token)).status, 401);
});

test("legacy migration preserves the source and retries safely after an invalid snapshot", (t) => {
  const { file, dir } = fixture(t);
  const legacy = join(dir, "data", "synergy.json");
  const target = join(dir, "data", "synergy.sqlite");
  writeFileSync(legacy, "invalid snapshot");
  assert.throws(() => createWorkspace(target));
  const bytes = readFileSync(file);
  writeFileSync(legacy, bytes);
  const migrated = createWorkspace(target);
  try {
    assert.ok(
      migrated.login({
        email: "alex@example.com",
        password: "private-password",
      }).token,
    );
    assert.deepEqual(readFileSync(legacy), bytes);
    assert.equal(
      readWorkspaceSnapshot(target).revision,
      readWorkspaceSnapshot(file).revision,
    );
  } finally {
    migrated.close();
  }
});

test("scheduled backups are verified, deduplicated and report unreadable storage", (t) => {
  const { w, file, dir } = fixture(t);
  const snapshot = readWorkspaceSnapshot(file);
  const id = "11111111-1111-4111-8111-111111111111";
  snapshot.files[id] = { id, size: 4 };
  mkdirSync(join(dir, "data", "uploads"));
  writeFileSync(join(dir, "data", "uploads", id), "file");
  writeFileSync(file, encode(snapshot));
  const backupDirectory = join(dir, "backups");
  const operations = createOperations(
    { file, backupDirectory, backupIntervalHours: 24 },
    () => w.health(),
  );
  assert.equal(operations.health().ok, true);
  operations.tick();
  operations.tick();
  assert.equal(readdirSync(backupDirectory).length, 1);
  assert.ok(operations.health().backups.lastSuccessAt);
  const target = join(backupDirectory, readdirSync(backupDirectory)[0]);
  const manifest = verifyBackup(target);
  delete manifest.files[`uploads/${id}`];
  writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest));
  assert.throws(() => verifyBackup(target), /missing referenced evidence/);
  writeFileSync(file, "corrupt storage");
  operations.invalidate();
  assert.equal(operations.health().ok, false);
});

test("request deadlines cover a stalled response body as well as connection setup", async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("unfinished");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  await assert.rejects(
    fetchWithDeadline(`http://127.0.0.1:${server.address().port}`, {}, 50),
    /timed out/,
  );
});
