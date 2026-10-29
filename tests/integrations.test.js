import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createApi } from "../server/api.js";
import { createWorkspace } from "../server/workspace.js";
import { configuration as appConfiguration } from "../server/config.js";
import { decode } from "../src/state/serialization.js";

// Exercise local password accounts alongside credential-free role access.
const configuration = (env) =>
  appConfiguration({ SYNERGY_DEMO_MODE: "false", ...env });

const profile = {
  bio: "We build student tools.",
  offer: "Product development",
  need: "Beta testing",
  industry: "Education",
  stage: "idea",
  teamSize: "3",
};
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-integrations-"));
  const file = join(dir, "workspace.json");
  t.after(() => {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const config = {
    ...configuration({}),
    file,
    ...options,
  };
  return { dir, file, config, workspace: createWorkspace(file, config) };
}
async function apiFixture(t, options = {}) {
  const fixtureData = fixture(t, options);
  const handler = createApi({
    file: fixtureData.file,
    config: fixtureData.config,
  });
  const server = createServer((req, res) =>
    handler(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(
    () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(done);
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  async function call(path, body, token, extra = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra.headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...extra,
    });
    return { status: response.status, result: decode(await response.text()) };
  }
  return { ...fixtureData, base, call };
}

test("prototype mode opens isolated role previews without credentials or email calls", async (t) => {
  const demoConfig = appConfiguration({ NODE_ENV: "production" });
  assert.equal(demoConfig.demoMode, true);
  const { call } = await apiFixture(t, demoConfig);
  const capabilities = await call("capabilities");
  assert.equal(capabilities.result.demoMode, true);
  assert.equal((await call("demo", { role: "admin" })).status, 400);
  const founder = await call("demo", { role: "founder" });
  const mentor = await call("demo", { role: "mentor" });
  for (const result of [founder, mentor]) {
    assert.equal(result.status, 200);
    assert.ok(result.result.token);
    assert.equal(result.result.state.authenticated, true);
    assert.equal(result.result.state.page, "home");
    assert.equal(result.result.state.emailVerified, false);
    assert.equal(result.result.state.isAdmin, false);
  }
  assert.equal(founder.result.state.role, "founder");
  assert.equal(mentor.result.state.role, "mentor");
  const suggestions = [
    ...founder.result.state.directory.founders,
    ...founder.result.state.directory.mentors,
  ];
  assert.equal(suggestions.length, 24);
  assert.equal(new Set(suggestions.map((person) => person.name)).size, 24);
  assert.equal(mentor.result.state.directory.mentorStartups.length, 14);
  assert.ok(suggestions.some((person) => person.score >= 70));
  assert.ok(suggestions.some((person) => person.score < 30));
  assert.ok(suggestions.some((person) => person.image));
  assert.ok(suggestions.some((person) => !person.image));
  assert.notEqual(
    founder.result.state.accountId,
    mentor.result.state.accountId,
  );
  const restored = await call("state", undefined, founder.result.token);
  assert.equal(restored.result.state.accountId, founder.result.state.accountId);
  assert.deepEqual(
    restored.result.state.directory.mentors.map((person) => person.id),
    founder.result.state.directory.mentors.map((person) => person.id),
  );
  const bookmarked = await call(
    "action",
    {
      action: "save",
      role: "founder",
      id: suggestions[0].id,
    },
    founder.result.token,
  );
  assert.equal(bookmarked.status, 200);
  assert.ok(bookmarked.result.state.savedByRole.founder.has(suggestions[0].id));
  const real = await call("signup", {
    firstName: "Real",
    lastName: "Founder",
    email: "real@example.com",
    password: "private-password",
    role: "founder",
  });
  assert.equal(real.status, 200);
  assert.equal(real.result.state.directory.founders.length, 0);
  assert.equal(real.result.state.directory.mentors.length, 0);
  await call("logout", {}, founder.result.token);
  assert.equal(
    (await call("state", undefined, founder.result.token)).status,
    401,
  );
});

test("real-account mode does not allow credential-free demo access", async (t) => {
  const { call } = await apiFixture(t);
  assert.equal((await call("demo", { role: "founder" })).status, 404);
});

test("binary uploads are private, shared, validated and survive server restart", async (t) => {
  const { call, base, file, config, dir } = await apiFixture(t);
  async function make(name) {
    return (
      await call("signup", {
        firstName: name,
        lastName: "Test",
        email: `${name}@example.com`,
        password: "private-password",
        role: "founder",
      })
    ).result;
  }
  const a = await make("Alex"),
    b = await make("Jamie"),
    outsider = await make("Outside");
  for (const user of [a, b])
    await call(
      "action",
      { role: "founder", form: "profile-form", values: profile },
      user.token,
    );
  await call(
    "action",
    { role: "founder", action: "interest", id: `${b.state.accountId}:founder` },
    a.token,
  );
  const room = (
    await call(
      "action",
      {
        role: "founder",
        action: "accept-interest",
        id: `${a.state.accountId}:founder`,
      },
      b.token,
    )
  ).result.state.activeRoomId;
  const upload = (
    token,
    name = "feedback.txt",
    bytes = "Useful product feedback",
    role = "founder",
  ) =>
    fetch(
      `${base}upload?${new URLSearchParams({ role, room, milestone: "feedback" })}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-File-Name": encodeURIComponent(name),
          "Content-Type": "application/octet-stream",
        },
        body: bytes,
      },
    );
  assert.equal((await upload(outsider.token)).status, 404);
  assert.equal(
    (await upload(a.token, "feedback.txt", "test", "mentor")).status,
    404,
  );
  assert.equal(
    (await upload(a.token, "bad.html", "<script>bad</script>")).status,
    400,
  );
  assert.equal((await upload(a.token, "fake.pdf", "not a PDF")).status, 400);
  assert.equal((await upload(a.token, "../secret.txt", "bad")).status, 400);
  assert.equal(
    (await upload(a.token, "large.txt", "x".repeat(config.maxFileBytes + 1)))
      .status,
    413,
  );
  assert.equal((await upload(a.token, "empty.txt", "")).status, 400);
  const uploaded = await upload(a.token);
  assert.equal(uploaded.status, 200);
  const result = decode(await uploaded.text());
  const metadata = result.state.rooms[room].milestones.feedback.file;
  assert.equal(metadata.name, "feedback.txt");
  assert.equal(
    (await call("state", undefined, b.token)).result.state.rooms[room]
      .milestones.feedback.file.id,
    metadata.id,
  );
  assert.equal((await fetch(`${base}files/${metadata.id}`)).status, 401);
  assert.equal(
    (await call(`files/${metadata.id}`, undefined, outsider.token)).status,
    404,
  );
  const download = await fetch(`${base}files/${metadata.id}`, {
    headers: { Authorization: `Bearer ${b.token}` },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  assert.equal(await download.text(), "Useful product feedback");
  assert.equal(readdirSync(join(dir, "uploads")).length, 1);
  const restarted = createWorkspace(file, config);
  const login = restarted.login({
    email: "jamie@example.com",
    password: "private-password",
  });
  assert.equal(
    restarted.fileFor(login.token, metadata.id).name,
    "feedback.txt",
  );
  assert.equal(
    readFileSync(join(dir, "uploads", metadata.id), "utf8"),
    "Useful product feedback",
  );
  await call(
    "action",
    {
      role: "founder",
      activeRoomId: room,
      form: "evidence",
      id: "feedback",
      values: { attachment: "Updated description" },
    },
    a.token,
  );
  assert.equal(
    (await call("state", undefined, b.token)).result.state.rooms[room]
      .milestones.feedback.file,
    null,
  );
});

test("removed external-service endpoints are unavailable", async (t) => {
  const { call } = await apiFixture(t);
  for (const path of [
    "email/send",
    "email/verify",
    "auth/verify",
    "auth/resend",
    "password/request",
    "password/reset",
    "ai/profile",
  ]) {
    assert.equal((await call(path, {})).status, 404);
  }
});
