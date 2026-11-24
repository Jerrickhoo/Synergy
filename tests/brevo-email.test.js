// Brevo transactional email: webhook authentication and event handling,
// provider selection, and retry/logging of provider failures. Disposable
// databases, synthetic recipients and a mocked Brevo API; nothing leaves
// the machine.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import {
  applyEmailWebhook,
  bearerToken,
  createBrevoSender,
} from "../server/mentor-email.js";
import { authLinkToken } from "../server/auth-email.js";

const SECRET = "test-webhook-secret-32-characters-long";
const API_KEY = "test-brevo-api-key";
const brevoEnv = {
  SYNERGY_DEMO_MODE: "false",
  EMAIL_PROVIDER: "brevo",
  BREVO_API_KEY: API_KEY,
  EMAIL_FROM: "sender@example.com",
  BREVO_WEBHOOK_SECRET: SECRET,
  SYNERGY_PUBLIC_URL: "https://workspace.example.com/",
};
const mentorValues = {
  bio: "Product mentor for student teams.",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech student tools",
};
const accepted = () =>
  Response.json({ messageId: "<m@example>" }, { status: 201 });

// A Brevo-configured API on a loopback port, with a controllable clock and
// a mocked Brevo endpoint.
async function brevoApi(t, respond = accepted) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-brevo-"));
  const file = join(dir, "workspace.json");
  const clock = { value: Date.parse("2031-01-20T20:00:00Z") };
  const sent = [];
  const handler = createApi({
    file,
    config: {
      ...configuration({ ...brevoEnv, SYNERGY_DATA_FILE: file }),
      now: () => clock.value,
      mentorApprovalRequired: false,
      emailFetch: async (url, input) => {
        const body = JSON.parse(input.body);
        sent.push({ url, headers: input.headers, body });
        return respond(body, sent.length);
      },
    },
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
        server.close(() => {
          handler.close();
          assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
          rmSync(dir, { recursive: true });
          done();
        });
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const post = async (path, body, headers = {}) => {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.text() };
  };
  // New accounts wait for email verification, so open the stored link.
  const signup = async (name, role) => {
    const { body } = await post("signup", {
      firstName: name,
      lastName: "Test",
      email: `${name.toLowerCase()}@example.com`,
      password: "private-password",
      role,
    });
    const { token, state } = JSON.parse(body);
    const { nonce } =
      readWorkspaceSnapshot(file).accounts[state.accountId].emailVerification;
    await post("auth/verify", {
      token: authLinkToken(state.accountId, "verify-email", nonce, SECRET),
    });
    return token;
  };
  const deliveryStatus = (email) =>
    Object.values(readWorkspaceSnapshot(file).accounts).find(
      (account) => account.email === email,
    )?.emailDeliveryStatus || null;
  const outbox = () => readWorkspaceSnapshot(file).outbox || [];
  return { handler, clock, sent, post, signup, deliveryStatus, outbox };
}
const webhook = (api, event, authorization) =>
  api.post(
    "email/brevo-webhook",
    event,
    authorization === undefined ? {} : { Authorization: authorization },
  );
// Completing a mentor profile queues a guidelines-required email.
const queueMentorEmail = (api, token) =>
  api.post(
    "action",
    { role: "mentor", form: "profile-form", values: mentorValues },
    { Authorization: `Bearer ${token}` },
  );
function captureLogs(t) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => lines.push(args.join(" "));
  t.after(() => {
    console.error = original;
  });
  return lines;
}

// Bug 1 -------------------------------------------------------------------

test("invalid_email webhook payloads suppress the recipient", () => {
  const db = {
    accounts: { a: { id: "a", email: "pat@example.com", state: {} } },
  };
  const now = Date.parse("2031-01-01T00:00:00Z");
  assert.equal(
    applyEmailWebhook(
      db,
      { event: "invalid_email", email: "PAT@example.com" },
      now,
    ),
    true,
  );
  assert.deepEqual(db.accounts.a.emailDeliveryStatus, {
    bouncedAt: "2031-01-01T00:00:00.000Z",
  });
  // A repeat changes nothing.
  assert.equal(
    applyEmailWebhook(
      db,
      { event: "invalid_email", email: "pat@example.com" },
      now + 1000,
    ),
    false,
  );
  assert.equal(
    db.accounts.a.emailDeliveryStatus.bouncedAt,
    "2031-01-01T00:00:00.000Z",
  );
});

test("an invalid_email webhook stops the next email to that address", async (t) => {
  const api = await brevoApi(t);
  const token = await api.signup("Pat", "mentor");
  const response = await webhook(
    api,
    { event: "invalid_email", email: "pat@example.com" },
    `Bearer ${SECRET}`,
  );
  assert.equal(response.status, 200);
  assert.ok(api.deliveryStatus("pat@example.com")?.bouncedAt);
  await queueMentorEmail(api, token);
  await api.handler.runOperations();
  // Only the signup verification email went out, before the bounce.
  assert.deepEqual(
    api.sent.filter(({ body }) => !body.tags.includes("synergy-verify-email")),
    [],
  );
  assert.ok(
    api
      .outbox()
      .every(
        (entry) => entry.kind === "verify-email" || entry.status !== "sent",
      ),
    "no outbox entry was delivered after the bounce",
  );
});

// Bug 2 -------------------------------------------------------------------

test("bearerToken accepts any scheme casing and keeps the token exact", () => {
  assert.equal(bearerToken(`Bearer ${SECRET}`), SECRET);
  assert.equal(bearerToken(`bearer ${SECRET}`), SECRET);
  assert.equal(bearerToken(`BEARER  ${SECRET}`), SECRET);
  assert.equal(
    bearerToken(`bearer ${SECRET.toUpperCase()}`),
    SECRET.toUpperCase(),
  );
  for (const value of [
    undefined,
    "",
    "Bearer",
    "Bearer ",
    SECRET,
    `Basic ${SECRET}`,
    `Bearer ${SECRET} extra`,
  ])
    assert.equal(bearerToken(value), null, String(value));
});

test("the webhook accepts either scheme casing and applies the event", async (t) => {
  const api = await brevoApi(t);
  for (const [name, scheme] of [
    ["Pat", "Bearer"],
    ["Sam", "bearer"],
    ["Ray", "BEARER"],
  ]) {
    await api.signup(name, "founder");
    const email = `${name.toLowerCase()}@example.com`;
    const response = await webhook(
      api,
      { event: "unsubscribed", email },
      `${scheme} ${SECRET}`,
    );
    assert.equal(response.status, 200, scheme);
    // A 200 alone doesn't prove the event was applied.
    assert.ok(api.deliveryStatus(email)?.unsubscribedAt, scheme);
  }
});

test("the webhook rejects a missing, wrong or differently-cased secret without applying it", async (t) => {
  const api = await brevoApi(t);
  await api.signup("Pat", "founder");
  const event = { event: "hard_bounce", email: "pat@example.com" };
  for (const authorization of [
    undefined,
    "Bearer wrong-secret",
    `Bearer ${SECRET.toUpperCase()}`,
    `bearer ${SECRET.slice(0, -1)}`,
    SECRET,
    `Basic ${SECRET}`,
  ]) {
    const response = await webhook(api, event, authorization);
    assert.equal(response.status, 403, String(authorization));
  }
  assert.equal(api.deliveryStatus("pat@example.com"), null);
});

// Bug 3 -------------------------------------------------------------------

test("Brevo with demo mode on or unset fails at startup instead of using the stub", () => {
  const { SYNERGY_DEMO_MODE, ...withoutDemo } = brevoEnv;
  for (const env of [withoutDemo, { ...brevoEnv, SYNERGY_DEMO_MODE: "true" }])
    assert.throws(() => configuration(env), /requires SYNERGY_DEMO_MODE=false/);
});

test("SYNERGY_DEMO_MODE accepts only true or false", () => {
  for (const value of ["0", "no", "off", "flase"])
    assert.throws(
      () => configuration({ SYNERGY_DEMO_MODE: value }),
      /SYNERGY_DEMO_MODE must be true or false/,
      value,
    );
  assert.equal(configuration({}).demoMode, true);
  assert.equal(configuration({ SYNERGY_DEMO_MODE: "" }).demoMode, true);
  assert.equal(configuration({ SYNERGY_DEMO_MODE: " False " }).demoMode, false);
  assert.equal(
    configuration({ ...brevoEnv, SYNERGY_DEMO_MODE: "FALSE" }).emailProvider,
    "brevo",
  );
  // Demo mode with the default provider still uses the stub.
  assert.equal(
    configuration({ SYNERGY_DEMO_MODE: "true" }).emailProvider,
    "stub",
  );
  assert.equal(
    configuration({ SYNERGY_DEMO_MODE: "true", EMAIL_PROVIDER: "stub" })
      .emailProvider,
    "stub",
  );
});

// Bug 4 -------------------------------------------------------------------

test("Brevo 401 and 403 are retryable; other 4xx stay permanent", async () => {
  const resultFor = async (status) =>
    createBrevoSender({
      apiKey: API_KEY,
      from: "sender@example.com",
      publicUrl: "https://workspace.example.com/",
      webhookSecret: SECRET,
      fetcher: async () => Response.json({ code: "x" }, { status }),
    })(
      { id: "e1", kind: "accepted", payload: { route: "#/settings" } },
      { id: "a", email: "pat@example.com" },
    );
  for (const status of [401, 403, 408, 429, 500, 503])
    assert.equal((await resultFor(status)).permanent, false, String(status));
  for (const status of [400, 404, 422])
    assert.equal((await resultFor(status)).permanent, true, String(status));
  assert.equal((await resultFor(401)).status, 401);
});

test("a rejected API key is retried and delivered once fixed, with each failure logged", async (t) => {
  let keyWorks = false;
  const api = await brevoApi(t, () =>
    keyWorks
      ? accepted()
      : Response.json(
          { code: "unauthorized", message: "Key not found" },
          { status: 401 },
        ),
  );
  const token = await api.signup("Pat", "mentor");
  await queueMentorEmail(api, token);
  const logs = captureLogs(t);
  await api.handler.runOperations();
  let [entry] = api
    .outbox()
    .filter((item) => item.kind === "guidelines-required");
  assert.equal(entry.status, "pending");
  assert.equal(entry.attempts, 1);
  // The key is fixed before the backoff expires.
  keyWorks = true;
  api.clock.value += 3 * 60000;
  await api.handler.runOperations();
  [entry] = api.outbox().filter((item) => item.kind === "guidelines-required");
  assert.equal(entry.status, "sent");
  assert.equal(
    api.sent.filter(({ body }) =>
      body.tags.includes("synergy-guidelines-required"),
    ).length,
    2,
  );
  const failures = logs
    .map((line) => JSON.parse(line))
    .filter(
      ({ event, kind }) =>
        event === "email_delivery_failed" && kind === "guidelines-required",
    );
  assert.equal(failures.length, 1);
  assert.deepEqual(
    { ...failures[0], at: undefined },
    {
      event: "email_delivery_failed",
      at: undefined,
      entryId: entry.id,
      kind: "guidelines-required",
      status: 401,
      attempts: 1,
      final: false,
    },
  );
  const text = logs.join("\n");
  assert.ok(!text.includes(API_KEY), "API key not logged");
  assert.ok(!text.includes(SECRET), "webhook secret not logged");
  assert.ok(!text.includes("pat@example.com"), "recipient not logged");
});

test("a failure that exhausts retries is logged as final", async (t) => {
  const api = await brevoApi(t, () => new Response("down", { status: 502 }));
  const token = await api.signup("Pat", "mentor");
  await queueMentorEmail(api, token);
  const logs = captureLogs(t);
  for (let round = 0; round < 6; round++) {
    await api.handler.runOperations();
    api.clock.value += 61 * 60000;
  }
  const [entry] = api
    .outbox()
    .filter((item) => item.kind === "guidelines-required");
  assert.equal(entry.status, "failed");
  assert.equal(entry.attempts, 5);
  const failures = logs
    .map((line) => JSON.parse(line))
    .filter(
      ({ event, kind }) =>
        event === "email_delivery_failed" && kind === "guidelines-required",
    );
  assert.deepEqual(
    failures.map(({ attempts, final, status }) => [attempts, final, status]),
    [
      [1, false, 502],
      [2, false, 502],
      [3, false, 502],
      [4, false, 502],
      [5, true, 502],
    ],
  );
});

test("a network failure is logged with a null status", async (t) => {
  const api = await brevoApi(t, () => {
    throw new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
  });
  const token = await api.signup("Pat", "mentor");
  await queueMentorEmail(api, token);
  const logs = captureLogs(t);
  await api.handler.runOperations();
  const failure = logs
    .map((line) => JSON.parse(line))
    .find(({ event }) => event === "email_delivery_failed");
  assert.equal(failure.status, null);
  assert.equal(failure.final, false);
});
