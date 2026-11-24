// Sign-in emails through Brevo: signup verification, password reset and
// sign-in alerts. Disposable databases, synthetic recipients and a mocked
// Brevo API; nothing leaves the machine.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createServer } from "node:http";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { readWorkspaceSnapshot } from "../server/storage.js";
import { mentorRequestValues as requestValues } from "./mentor-request-fixtures.js";
import {
  authLinkToken,
  describeDevice,
  readAuthLinkToken,
} from "../server/auth-email.js";

const SECRET = "test-webhook-secret-32-characters-long";
const brevoEnv = {
  SYNERGY_DEMO_MODE: "false",
  EMAIL_PROVIDER: "brevo",
  BREVO_API_KEY: "test-brevo-api-key",
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
const founderValues = {
  bio: "We build student tools.",
  offer: "Product development",
  need: "Beta testing",
  industry: "Education",
  stage: "idea",
  teamSize: "3",
  startupName: "Study Loop",
};
const chrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function emailApi(t, env = brevoEnv) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-auth-email-"));
  const file = join(dir, "workspace.json");
  const clock = { value: Date.parse("2031-01-20T20:00:00Z") };
  const sent = [];
  const handler = createApi({
    file,
    config: {
      ...configuration({ ...env, SYNERGY_DATA_FILE: file }),
      now: () => clock.value,
      mentorApprovalRequired: false,
      emailFetch: async (url, input) => {
        sent.push(JSON.parse(input.body));
        return Response.json({ messageId: "<m@example>" }, { status: 201 });
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
  const call = async (path, body, token, headers = {}) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: JSON.parse(await response.text()) };
  };
  const signup = async (name, role = "founder") =>
    (
      await call("signup", {
        firstName: name,
        lastName: "Test",
        email: `${name.toLowerCase()}@example.com`,
        password: "private-password",
        role,
      })
    ).body;
  // Sign-in emails go out right after the request, without the minute timer.
  const emails = async (tag, count = 1) => {
    for (let wait = 0; wait < 100; wait++) {
      const found = sent.filter(({ tags }) => tags.includes(tag));
      if (found.length >= count) return found;
      await new Promise((done) => setTimeout(done, 10));
    }
    return sent.filter(({ tags }) => tags.includes(tag));
  };
  const linkToken = (email) =>
    new URL(email.textContent.match(/https:\S+/)[0]).hash.split("token=")[1];
  const account = (email) =>
    Object.values(readWorkspaceSnapshot(file).accounts).find(
      (item) => item.email === email,
    );
  // Opens the newest verification link sent to an address.
  const verify = async (address) => {
    for (let wait = 0; wait < 100; wait++) {
      const email = sent.findLast(
        ({ tags, to }) =>
          tags.includes("synergy-verify-email") && to[0].email === address,
      );
      if (email) return call("auth/verify", { token: linkToken(email) });
      await new Promise((done) => setTimeout(done, 10));
    }
    throw new Error(`No verification email for ${address}`);
  };
  return { clock, sent, call, signup, emails, linkToken, account, verify };
}

test("signup emails a verification link; the account waits until it is opened", async (t) => {
  const api = await emailApi(t);
  const capabilities = await api.call("capabilities");
  assert.equal(capabilities.body.emailAuth, true);
  const mentor = await api.signup("Pat", "mentor");
  assert.equal((await api.verify("pat@example.com")).status, 200);
  for (const form of [
    { form: "profile-form", values: mentorValues },
    { form: "accept-guidelines", values: { version: 2 } },
  ])
    assert.equal(
      (await api.call("action", { role: "mentor", ...form }, mentor.token))
        .status,
      200,
    );
  const founder = await api.signup("Alex");
  assert.equal(founder.state.emailVerified, false);
  assert.equal(founder.state.integrations.emailAuth, true);
  const saveProfile = () =>
    api.call(
      "action",
      { role: "founder", form: "profile-form", values: founderValues },
      founder.token,
    );
  const [email] = (await api.emails("synergy-verify-email", 2)).filter(
    ({ to }) => to[0].email === "alex@example.com",
  );
  assert.equal(email.subject, "Verify your email for Synergy");
  assert.match(
    email.textContent,
    /https:\/\/workspace\.example\.com\/#\/verify-email\?token=/,
  );
  assert.ok(!email.textContent.includes("Unsubscribe"));

  const sendRequest = () =>
    api.call(
      "action",
      {
        role: "founder",
        action: "send-request",
        id: `${mentor.state.accountId}:mentor`,
        values: requestValues,
      },
      founder.token,
    );
  // Nothing works until the link is opened, but the state stays readable so
  // the waiting screen notices the verification.
  for (const blocked of [await saveProfile(), await sendRequest()]) {
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.reason, "email-unverified");
  }
  assert.equal(
    (await api.call("state", undefined, founder.token)).body.state
      .emailVerified,
    false,
  );

  const token = api.linkToken(email);
  // A verification link is not a password reset link, and a forgery fails.
  assert.equal(
    (await api.call("auth/reset", { token, password: "another-password" }))
      .status,
    410,
  );
  assert.equal(
    (await api.call("auth/verify", { token: token.slice(0, -2) + "xx" }))
      .status,
    410,
  );
  const verified = await api.call("auth/verify", { token });
  assert.deepEqual(verified, { status: 200, body: { verified: true } });
  // A second click (or React's double effect) still succeeds.
  assert.equal((await api.call("auth/verify", { token })).status, 200);
  assert.ok(api.account("alex@example.com").emailVerifiedAt);
  assert.equal(api.account("alex@example.com").emailVerification, undefined);
  const state = await api.call("state", undefined, founder.token);
  assert.equal(state.body.state.emailVerified, true);
  assert.equal((await saveProfile()).status, 200);
  const sentRequest = await sendRequest();
  assert.equal(sentRequest.status, 200, sentRequest.body.error);
});

test("resending sends the same link with a fresh expiry, at most once a minute", async (t) => {
  const api = await emailApi(t);
  const founder = await api.signup("Alex");
  // "Check your inbox" counts down to this instead of offering a refused send.
  assert.equal(
    founder.state.emailVerificationRetryAt,
    "2031-01-20T20:01:00.000Z",
  );
  const [first] = await api.emails("synergy-verify-email");
  const tooSoon = await api.call("auth/resend", {}, founder.token);
  assert.equal(tooSoon.status, 429);
  assert.match(tooSoon.body.error, /less than a minute ago/);
  api.clock.value += 23 * 3600000;
  const resent = await api.call("auth/resend", {}, founder.token);
  assert.equal(resent.status, 200);
  assert.equal(resent.body.state.emailVerified, false);
  assert.equal(
    resent.body.state.emailVerificationRetryAt,
    "2031-01-21T19:01:00.000Z",
  );
  // Every email in the inbox carries the same working link, and the resend
  // restarted its 24 hours.
  const [, second] = await api.emails("synergy-verify-email", 2);
  assert.equal(api.linkToken(second), api.linkToken(first));
  api.clock.value += 2 * 3600000;
  assert.equal(
    (await api.call("auth/verify", { token: api.linkToken(first) })).status,
    200,
  );
  // Nothing to send once verified.
  api.clock.value += 61000;
  await api.call("auth/resend", {}, founder.token);
  await new Promise((done) => setTimeout(done, 50));
  assert.equal(api.sent.length, 2);
  assert.equal((await api.call("auth/resend", {})).status, 401);
});

test("an expired verification link is refused", async (t) => {
  const api = await emailApi(t);
  await api.signup("Alex");
  const [email] = await api.emails("synergy-verify-email");
  api.clock.value += 24 * 3600000 + 1000;
  const expired = await api.call("auth/verify", {
    token: api.linkToken(email),
  });
  assert.equal(expired.status, 410);
  assert.match(expired.body.error, /expired/);
  // Once expired, asking again sends a new link; the old one stays dead.
  const founder = (
    await api.call("login", {
      email: "alex@example.com",
      password: "private-password",
    })
  ).body;
  assert.equal((await api.call("auth/resend", {}, founder.token)).status, 200);
  const [, renewed] = await api.emails("synergy-verify-email", 2);
  assert.notEqual(api.linkToken(renewed), api.linkToken(email));
  assert.equal(
    (await api.call("auth/verify", { token: api.linkToken(email) })).status,
    410,
  );
  assert.equal(
    (await api.call("auth/verify", { token: api.linkToken(renewed) })).status,
    200,
  );
});

test("password reset emails a one-hour link that signs out every session", async (t) => {
  const api = await emailApi(t);
  const founder = await api.signup("Alex");
  const other = (
    await api.call("login", {
      email: "alex@example.com",
      password: "private-password",
    })
  ).body;
  const before = api.sent.length;
  // The same answer for an unknown address, and nothing is sent.
  const unknown = await api.call("auth/forgot", {
    email: "nobody@example.com",
  });
  assert.deepEqual(unknown, { status: 200, body: { ok: true } });
  assert.equal(
    (await api.call("auth/forgot", { email: "not-an-email" })).status,
    400,
  );
  const asked = await api.call("auth/forgot", { email: " ALEX@example.com " });
  assert.deepEqual(asked, { status: 200, body: { ok: true } });
  // A second request inside the minute sends nothing new.
  await api.call("auth/forgot", { email: "alex@example.com" });
  const resets = await api.emails("synergy-password-reset");
  await new Promise((done) => setTimeout(done, 50));
  assert.equal(
    api.sent
      .slice(before)
      .filter(({ tags }) => tags.includes("synergy-password-reset")).length,
    1,
  );
  assert.equal(resets[0].subject, "Reset your Synergy password");
  assert.match(resets[0].textContent, /#\/reset-password\?token=/);
  const token = api.linkToken(resets[0]);

  assert.equal(
    (await api.call("auth/reset", { token, password: "short" })).status,
    400,
  );
  const reset = await api.call("auth/reset", {
    token,
    password: "a-brand-new-password",
  });
  assert.equal(reset.status, 200);
  assert.ok(reset.body.token);
  // Opening the emailed link proves the address too.
  assert.equal(reset.body.state.emailVerified, true);
  for (const old of [founder.token, other.token])
    assert.equal((await api.call("state", undefined, old)).status, 401);
  assert.equal(
    (await api.call("state", undefined, reset.body.token)).status,
    200,
  );
  assert.equal(
    (
      await api.call("login", {
        email: "alex@example.com",
        password: "private-password",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api.call("login", {
        email: "alex@example.com",
        password: "a-brand-new-password",
      })
    ).status,
    200,
  );
  // The link works once.
  const reused = await api.call("auth/reset", {
    token,
    password: "yet-another-password",
  });
  assert.equal(reused.status, 410);
});

test("a reset link expires after an hour", async (t) => {
  const api = await emailApi(t);
  await api.signup("Alex");
  await api.call("auth/forgot", { email: "alex@example.com" });
  const [email] = await api.emails("synergy-password-reset");
  api.clock.value += 3600000 + 1000;
  const expired = await api.call("auth/reset", {
    token: api.linkToken(email),
    password: "a-brand-new-password",
  });
  assert.equal(expired.status, 410);
});

test("each password sign-in sends an alert naming the browser, not signup", async (t) => {
  const api = await emailApi(t);
  await api.signup("Alex");
  await api.emails("synergy-verify-email");
  assert.equal(
    api.sent.filter(({ tags }) => tags.includes("synergy-sign-in-alert"))
      .length,
    0,
  );
  const wrong = await api.call(
    "login",
    { email: "alex@example.com", password: "wrong-password" },
    undefined,
    { "User-Agent": chrome },
  );
  assert.equal(wrong.status, 401);
  await api.call(
    "login",
    { email: "alex@example.com", password: "private-password" },
    undefined,
    { "User-Agent": chrome },
  );
  const [alert] = await api.emails("synergy-sign-in-alert");
  assert.equal(alert.subject, "New sign-in to your Synergy account");
  assert.match(
    alert.textContent,
    /signed in on 20 Jan 2031, 20:00 UTC from Chrome on Windows\./,
  );
  assert.match(alert.textContent, /#\/forgot-password/);
  assert.ok(!alert.textContent.includes("Mozilla"));
  assert.equal(
    api.sent.filter(({ tags }) => tags.includes("synergy-sign-in-alert"))
      .length,
    1,
  );
});

test("a bounced address gets no sign-in emails", async (t) => {
  const api = await emailApi(t);
  const founder = await api.signup("Alex");
  await api.emails("synergy-verify-email");
  await api.call(
    "email/brevo-webhook",
    { event: "hard_bounce", email: "alex@example.com" },
    SECRET,
  );
  api.clock.value += 61000;
  assert.equal((await api.call("auth/resend", {}, founder.token)).status, 409);
  await api.call("auth/forgot", { email: "alex@example.com" });
  await api.call("login", {
    email: "alex@example.com",
    password: "private-password",
  });
  await new Promise((done) => setTimeout(done, 50));
  assert.equal(api.sent.length, 1);
});

test("without Brevo nobody is asked to verify and the email endpoints are unavailable", async (t) => {
  const api = await emailApi(t, { SYNERGY_DEMO_MODE: "false" });
  assert.equal((await api.call("capabilities")).body.emailAuth, false);
  const founder = await api.signup("Alex");
  assert.equal(founder.state.integrations.emailAuth, false);
  for (const [path, body] of [
    ["auth/verify", { token: "x" }],
    ["auth/resend", {}],
    ["auth/forgot", { email: "alex@example.com" }],
    ["auth/reset", { token: "x", password: "a-brand-new-password" }],
  ])
    assert.equal((await api.call(path, body, founder.token)).status, 404, path);
  assert.equal(api.sent.length, 0);
});

test("link tokens are bound to their account, kind and secret", () => {
  const token = authLinkToken("account-1", "verify-email", "nonce", SECRET);
  assert.deepEqual(readAuthLinkToken(token, "verify-email", SECRET), {
    accountId: "account-1",
    nonce: "nonce",
  });
  assert.equal(readAuthLinkToken(token, "password-reset", SECRET), null);
  assert.equal(readAuthLinkToken(token, "verify-email", SECRET + "x"), null);
  for (const value of [undefined, "", "a.b.c", "x".repeat(600), `${token}.x`])
    assert.equal(readAuthLinkToken(value, "verify-email", SECRET), null);
});

test("describeDevice reports only the browser family and platform", () => {
  assert.equal(describeDevice(chrome), "Chrome on Windows");
  assert.equal(
    describeDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ),
    "Safari on iPhone",
  );
  assert.equal(
    describeDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0",
    ),
    "Firefox on macOS",
  );
  assert.equal(describeDevice(`${chrome} Edg/140.0.0.0`), "Edge on Windows");
  assert.equal(describeDevice("curl/8.0"), "");
  assert.equal(describeDevice(undefined), "");
});

test("two servers sharing one database both see and save each other's changes", async (t) => {
  // e.g. `npm start` behind a tunnel next to `npm run dev`, as in a real
  // report: the signup went through one server, the emailed link through the
  // other, and the second server's save was refused as out of date.
  const dir = mkdtempSync(join(tmpdir(), "synergy-shared-db-"));
  const file = join(dir, "workspace.sqlite");
  const sent = [];
  const config = {
    ...configuration({ ...brevoEnv, SYNERGY_DATA_FILE: file }),
    mentorApprovalRequired: false,
    emailFetch: async (url, input) => {
      sent.push(JSON.parse(input.body));
      return Response.json({ messageId: "<m@example>" }, { status: 201 });
    },
  };
  const servers = [];
  for (let i = 0; i < 2; i++) {
    const handler = createApi({ file, config });
    const server = createServer((req, res) => handler(req, res));
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    servers.push({ handler, server });
  }
  t.after(async () => {
    for (const { handler, server } of servers) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
      handler.close();
    }
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    rmSync(dir, { recursive: true });
  });
  const call = async (index, path, body, token) => {
    const response = await fetch(
      `http://127.0.0.1:${servers[index].server.address().port}/api/${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );
    return { status: response.status, body: JSON.parse(await response.text()) };
  };
  // Both servers are running before the account exists.
  const founder = (
    await call(0, "signup", {
      firstName: "Alex",
      lastName: "Test",
      email: "alex@example.com",
      password: "private-password",
      role: "founder",
    })
  ).body;
  for (let wait = 0; wait < 100 && !sent.length; wait++)
    await new Promise((done) => setTimeout(done, 10));
  const token = new URL(sent[0].textContent.match(/https:\S+/)[0]).hash.split(
    "token=",
  )[1];
  const verified = await call(1, "auth/verify", { token });
  assert.deepEqual(verified, { status: 200, body: { verified: true } });
  // The first server picks up the verification and can save after it.
  const saved = await call(
    0,
    "action",
    { role: "founder", form: "profile-form", values: founderValues },
    founder.token,
  );
  assert.equal(saved.status, 200, saved.body.error);
  assert.equal(saved.body.state.emailVerified, true);
  assert.equal(
    readWorkspaceSnapshot(file).accounts[founder.state.accountId].state.profiles
      .founder.startupName,
    "Study Loop",
  );
});
