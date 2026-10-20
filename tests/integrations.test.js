import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createApi } from "../server/api.js";
import { createWorkspace } from "../server/workspace.js";
import { configuration } from "../server/config.js";
import { createServices } from "../server/services.js";
import { emailConfiguration } from "../server/email-config.js";
import { decode } from "../src/state/serialization.js";

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
    resendKey: "test-email-key",
    mailFrom: "Synergy <test@example.com>",
    openaiKey: "test-ai-key",
    ...options,
  };
  return { dir, file, config, workspace: createWorkspace(file, config) };
}
const signup = (workspace, name) =>
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

test("AI clarifies general ambiguity, accepts follow-up answers and proposes only unfamiliar tags", async (t) => {
  let input;
  const { call } = await apiFixture(t, {}, async (url, request) => {
    input = JSON.parse(JSON.parse(request.body).input);
    const clarified = input.answers.length > 0;
    return {
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...profile,
                  need: clarified ? "Privacy engineering" : "",
                  clarifications: clarified
                    ? []
                    : [
                        "Do you offer privacy engineering or need help with it?",
                      ],
                  proposedTags: clarified
                    ? [
                        {
                          label: "Privacy Engineering",
                          side: "need",
                          reason:
                            "Explicitly requested in the clarification answer.",
                        },
                        {
                          label: "Beta Testers",
                          side: "need",
                          reason: "Already covered.",
                        },
                      ]
                    : [],
                }),
              },
            ],
          },
        ],
      }),
    };
  });
  const user = (
    await call("signup", {
      firstName: "AI",
      lastName: "Test",
      email: "ai@example.com",
      password: "private-password",
      role: "founder",
    })
  ).result;
  const first = await call(
    "ai/profile",
    {
      role: "founder",
      story: "We work on student tools and privacy engineering.",
    },
    user.token,
  );
  assert.equal(first.status, 200);
  assert.equal(first.result.clarifications.length, 1);
  assert.equal(first.result.draft.need, "");
  const second = await call(
    "ai/profile",
    {
      role: "founder",
      story: "We work on student tools and privacy engineering.",
      answers: [
        {
          question: first.result.clarifications[0],
          answer: "We need privacy engineering help.",
        },
      ],
    },
    user.token,
  );
  assert.equal(second.status, 200);
  assert.equal(second.result.clarifications.length, 0);
  assert.equal(input.answers[0].answer, "We need privacy engineering help.");
  assert.ok(input.approvedVocabulary.includes("Beta Testers"));
  assert.equal(second.result.proposedTags.length, 1);
  assert.equal(second.result.proposedTags[0].label, "Privacy Engineering");
  assert.equal(
    (await call("state", undefined, user.token)).result.state.profiles.founder
      .need,
    "",
  );
  assert.equal(
    (
      await call(
        "ai/profile",
        {
          role: "founder",
          story: "A sufficiently detailed description.",
          answers: [{ question: "Question", answer: "" }],
        },
        user.token,
      )
    ).status,
    400,
  );
  const proposed = await call(
    "action",
    {
      role: "founder",
      form: "tag-proposal",
      values: { label: second.result.proposedTags[0].label },
    },
    user.token,
  );
  assert.equal(proposed.status, 200);
  assert.ok(!proposed.result.state.vocabulary.includes("Privacy Engineering"));
});

test("AI mentor drafts include past experience and reject malformed clarification metadata", async () => {
  const draft = {
    bio: "Product mentor",
    offer: "Research",
    need: "Founder goals",
    expertise: "Product",
    availability: "Weekly",
    startups: "EdTech",
    pastExperience: "Led product research.",
    clarifications: [],
    proposedTags: [],
  };
  const provider = (data) => async () => ({
    ok: true,
    json: async () => ({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(data) }] },
      ],
    }),
  });
  const result = await createServices(
    { openaiKey: "fake", model: "test" },
    provider(draft),
  ).draftProfile("mentor", "Research mentor notes.");
  assert.equal(result.draft.pastExperience, "Led product research.");
  for (const invalid of [
    { ...draft, clarifications: ["a".repeat(301)] },
    {
      ...draft,
      proposedTags: [{ label: "Tag", side: "other", reason: "Reason" }],
    },
    { ...draft, proposedTags: "not an array" },
  ])
    await assert.rejects(
      createServices({ openaiKey: "fake" }, provider(invalid)).draftProfile(
        "mentor",
        "Research mentor notes.",
      ),
      (error) => error.status === 502,
    );
});

async function apiFixture(t, options = {}, providerResponse) {
  const fixtureData = fixture(t, options);
  const calls = [];
  const fetcher = async (url, request) => {
    calls.push({ url, ...request, body: JSON.parse(request.body) });
    if (providerResponse) return providerResponse(url, request);
    return {
      ok: true,
      json: async () =>
        url.includes("resend")
          ? { id: "test-message" }
          : url.includes("brevo")
            ? { messageId: "<test-message@brevo.example>" }
            : {
                status: "completed",
                output: [
                  {
                    content: [
                      {
                        type: "output_text",
                        text: JSON.stringify({
                          ...profile,
                          clarifications: [],
                          proposedTags: [],
                        }),
                      },
                    ],
                  },
                ],
              },
    };
  };
  const handler = createApi({
    file: fixtureData.file,
    config: fixtureData.config,
    fetcher,
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
  return { ...fixtureData, calls, base, call };
}

test("verification codes are private, single-use, rate-limited and survive restart", (t) => {
  const { workspace, file } = fixture(t, { requireVerification: true });
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie");
  workspace.act(a.token, {
    role: "founder",
    form: "profile-form",
    values: profile,
  });
  assert.equal(workspace.get(b.token).state.directory.founders.length, 0);
  const proof = workspace.beginVerification(a.token);
  assert.match(proof.code, /^\d{6}$/);
  assert.throws(
    () => workspace.verifyEmail(a.token, proof.code),
    /Request a new/,
  );
  workspace.verificationSent(a.token, proof.code);
  assert.throws(
    () => workspace.beginVerification(a.token),
    (error) => error.status === 429,
  );
  assert.throws(
    () => workspace.verifyEmail(b.token, proof.code),
    /Request a new/,
  );
  const serialized = JSON.stringify(workspace.get(a.token));
  assert.ok(!serialized.includes(proof.code));
  assert.ok(!serialized.includes("verification"));
  const saved = JSON.parse(readFileSync(file, "utf8"));
  assert.notEqual(
    saved.accounts[a.state.accountId].verification.hash,
    proof.code,
  );
  const restarted = createWorkspace(file, { requireVerification: true });
  const login = restarted.login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.equal(
    restarted.verifyEmail(login.token, proof.code, "founder").state
      .emailVerified,
    true,
  );
  assert.throws(
    () => restarted.verifyEmail(login.token, proof.code),
    /Request a new/,
  );
  const other = restarted.login({
    email: "jamie@example.com",
    password: "private-password",
  });
  assert.equal(restarted.get(other.token).state.directory.founders.length, 1);
});

test("verification rejects five bad guesses and expired codes", (t) => {
  const { workspace, file } = fixture(t);
  const a = signup(workspace, "Alex");
  const proof = workspace.beginVerification(a.token);
  workspace.verificationSent(a.token, proof.code);
  for (let i = 0; i < 5; i++)
    assert.throws(() => workspace.verifyEmail(a.token, "000000"), /incorrect/);
  assert.throws(
    () => workspace.verifyEmail(a.token, proof.code),
    /Request a new/,
  );
  const db = JSON.parse(readFileSync(file, "utf8"));
  Object.assign(db.accounts[a.state.accountId].verification, {
    attempts: 0,
    expires: Date.now() - 1,
  });
  writeFileSync(file, JSON.stringify(db));
  const restarted = createWorkspace(file);
  const login = restarted.login({
    email: "alex@example.com",
    password: "private-password",
  });
  assert.throws(
    () => restarted.verifyEmail(login.token, proof.code),
    /expired/,
  );
});

test("email and AI endpoints match provider contracts without saving drafts", async (t) => {
  const { call, calls } = await apiFixture(t, { requireVerification: true });
  const { result: user } = await call("signup", {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    password: "private-password",
    role: "founder",
  });
  assert.equal((await call("email/send", {})).status, 401);
  assert.equal(
    (
      await call(
        "ai/profile",
        {
          role: "founder",
          story: "We are three founders building student tools.",
        },
        user.token,
      )
    ).status,
    403,
  );
  assert.equal((await call("email/send", {}, user.token)).status, 200);
  const email = calls[0];
  assert.equal(email.url, "https://api.resend.com/emails");
  assert.deepEqual(email.body.to, ["alex@example.com"]);
  const code = email.body.text.match(/code is (\d{6})/)[1];
  assert.equal(
    (await call("email/verify", { code, role: "founder" }, user.token)).result
      .state.emailVerified,
    true,
  );
  const ai = await call(
    "ai/profile",
    { role: "founder", story: "We are three founders building student tools." },
    user.token,
  );
  assert.equal(ai.status, 200);
  assert.deepEqual(ai.result.draft, profile);
  assert.equal(calls[1].url, "https://api.openai.com/v1/responses");
  assert.equal(calls[1].body.store, false);
  assert.equal(calls[1].body.text.format.strict, true);
  assert.equal(
    (await call("state", undefined, user.token)).result.state.profiles.founder
      .bio,
    "",
  );
  for (let i = 0; i < 4; i++)
    assert.equal(
      (
        await call(
          "ai/profile",
          {
            role: "founder",
            story: "We are three founders building student tools.",
          },
          user.token,
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await call(
        "ai/profile",
        {
          role: "founder",
          story: "We are three founders building student tools.",
        },
        user.token,
      )
    ).status,
    429,
  );
});

test("provider failures, refusals and malformed AI drafts fail without leaking secrets", async () => {
  const config = {
    resendKey: "private-key",
    mailFrom: "test@example.com",
    openaiKey: "private-key",
    model: "gpt-4.1-mini",
  };
  const failed = createServices(config, async () => {
    throw new Error("private-key");
  });
  await assert.rejects(
    failed.sendVerification("alex@example.com", "123456"),
    (error) => error.status === 502 && !error.message.includes("private-key"),
  );
  await assert.rejects(
    failed.draftProfile("founder", "A founder's notes."),
    (error) => error.status === 502 && !error.message.includes("private-key"),
  );
  for (const data of [
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ content: [{ type: "refusal", refusal: "Cannot help" }] }],
    },
    {
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: '{"bio": "bad schema"}' }] },
      ],
    },
    {
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ ...profile, teamSize: "many" }),
            },
          ],
        },
      ],
    },
  ]) {
    const service = createServices(config, async () => ({
      ok: true,
      json: async () => data,
    }));
    await assert.rejects(
      service.draftProfile("founder", "User notes"),
      (error) => error.status === 502,
    );
  }
});

test("Brevo sends a private code to the authenticated account and verifies it", async (t) => {
  const { call, calls } = await apiFixture(t, {
    brevoKey: "private-brevo-key",
    requireVerification: true,
  });
  const { result: user } = await call("signup", {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    password: "private-password",
    role: "founder",
  });
  assert.equal(user.state.integrations.email, true);
  assert.equal((await call("email/send", {})).status, 401);
  assert.equal(calls.length, 0);
  const sent = await call(
    "email/send",
    { to: "someone-else@example.com", code: "000000" },
    user.token,
  );
  assert.equal(sent.status, 200);
  assert.deepEqual(sent.result, { ok: true, retryAfterSeconds: 60 });
  const email = calls[0];
  assert.equal(email.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(email.method, "POST");
  assert.equal(email.headers["api-key"], "private-brevo-key");
  assert.equal(email.headers.Authorization, undefined);
  assert.deepEqual(email.body.sender, {
    email: "test@example.com",
    name: "Synergy",
  });
  assert.deepEqual(email.body.to, [{ email: "alex@example.com" }]);
  assert.equal(email.body.subject, "Verify your Synergy email");
  const code = email.body.textContent.match(/code is (\d{6})/)[1];
  assert.notEqual(code, "000000");
  const publicState = JSON.stringify(
    (await call("state", undefined, user.token)).result,
  );
  assert.ok(!publicState.includes(code));
  assert.ok(!publicState.includes("private-brevo-key"));
  assert.equal((await call("email/send", {}, user.token)).status, 429);
  assert.equal(calls.length, 1);
  const verified = await call(
    "email/verify",
    { code, role: "founder" },
    user.token,
  );
  assert.equal(verified.status, 200);
  assert.equal(verified.result.state.emailVerified, true);
  assert.equal((await call("email/verify", { code }, user.token)).status, 400);
});

test("rejected or malformed email responses never activate verification", async (t) => {
  for (const provider of ["brevo", "resend"]) {
    for (const response of [
      {
        ok: false,
        json: async () => ({ message: "private-provider-details" }),
      },
      { ok: true, json: async () => ({}) },
      { ok: true, json: async () => null },
      {
        ok: true,
        json: async () => {
          throw new Error("private-provider-details");
        },
      },
    ]) {
      await t.test(
        `${provider}: ${response.ok ? "invalid response" : "HTTP rejection"}`,
        async (t) => {
          const { call, calls } = await apiFixture(
            t,
            {
              mailProvider: provider,
              brevoKey: "private-brevo-key",
            },
            () => response,
          );
          const { result: user } = await call("signup", {
            firstName: "Alex",
            lastName: "Test",
            email: "alex@example.com",
            password: "private-password",
            role: "founder",
          });
          const failed = await call("email/send", {}, user.token);
          assert.equal(failed.status, 502);
          assert.ok(!JSON.stringify(failed.result).includes("private-"));
          const request = calls[0].body;
          const code = (request.textContent || request.text).match(
            /code is (\d{6})/,
          )[1];
          const verify = await call("email/verify", { code }, user.token);
          assert.equal(verify.status, 400);
          assert.match(verify.result.error, /Request a new/);
          assert.equal(
            (await call("state", undefined, user.token)).result.state
              .emailVerified,
            false,
          );
        },
      );
    }
  }
});

test("email configuration selects only the requested provider and validates senders", () => {
  const values = {
    BREVO_API_KEY: "brevo-key",
    RESEND_API_KEY: "resend-key",
    MAIL_FROM: '"Synergy Team" <sender@example.com>',
  };
  const automatic = emailConfiguration(configuration(values));
  assert.equal(automatic.provider, "brevo");
  assert.equal(automatic.key, "brevo-key");
  assert.deepEqual(automatic.sender, {
    email: "sender@example.com",
    name: "Synergy Team",
  });
  const explicit = emailConfiguration(
    configuration({ ...values, EMAIL_PROVIDER: "resend" }),
  );
  assert.equal(explicit.provider, "resend");
  assert.equal(explicit.key, "resend-key");
  assert.deepEqual(
    emailConfiguration(
      configuration({ ...values, MAIL_FROM: "sender@example.com" }),
    ).sender,
    { email: "sender@example.com" },
  );
  for (const from of [
    "",
    "invalid",
    "sender@example.com,other@example.com",
    "Synergy\r\nBcc: other@example.com <sender@example.com>",
  ]) {
    assert.equal(
      emailConfiguration(configuration({ ...values, MAIL_FROM: from })).enabled,
      false,
    );
  }
  assert.throws(
    () => configuration({ EMAIL_PROVIDER: "unknown" }),
    /EMAIL_PROVIDER/,
  );
  assert.throws(
    () =>
      configuration({
        ...values,
        NODE_ENV: "production",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "",
      }),
    /requires BREVO_API_KEY or RESEND_API_KEY/,
  );
  assert.equal(
    configuration({
      ...values,
      NODE_ENV: "production",
      EMAIL_PROVIDER: "brevo",
    }).requireVerification,
    true,
  );
});

test("signup and every subsequent sign-in require an emailed code before a session exists", async (t) => {
  const { call, calls, file } = await apiFixture(t, {
    requireLoginCode: true,
    brevoKey: "private-brevo-key",
  });
  const values = {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    password: "private-password",
    role: "founder",
  };
  const pending = await call("signup", values);
  assert.equal(pending.status, 200);
  assert.equal(pending.result.verificationRequired, true);
  assert.equal(pending.result.purpose, "signup");
  assert.equal(pending.result.sent, true);
  assert.equal(pending.result.token, undefined);
  assert.equal(pending.result.state, undefined);
  assert.equal(pending.result.code, undefined);
  assert.equal(
    (await call("state", undefined, pending.result.challengeId)).status,
    401,
  );
  assert.equal(
    (
      await call(
        "action",
        { action: "choose-role", role: "mentor" },
        pending.result.challengeId,
      )
    ).status,
    401,
  );
  const firstCode = calls[0].body.textContent.match(/code is (\d{6})/)[1];
  assert.equal(calls[0].body.subject, "Complete your Synergy signup");
  const disk = readFileSync(file, "utf8");
  assert.ok(!disk.includes(firstCode));
  assert.ok(!disk.includes(pending.result.challengeId));
  assert.equal(
    (await call("auth/resend", { challengeId: pending.result.challengeId }))
      .status,
    429,
  );
  assert.equal(calls.length, 1);
  const verified = await call("auth/verify", {
    challengeId: pending.result.challengeId,
    code: firstCode,
  });
  assert.equal(verified.status, 200);
  assert.ok(verified.result.token);
  assert.equal(verified.result.state.emailVerified, true);
  assert.equal(
    (await call("state", undefined, verified.result.token)).status,
    200,
  );
  assert.equal(
    (
      await call("auth/verify", {
        challengeId: pending.result.challengeId,
        code: firstCode,
      })
    ).status,
    401,
  );
  await call("logout", {}, verified.result.token);
  assert.equal(
    (await call("login", { ...values, password: "incorrect-password" })).status,
    401,
  );
  assert.equal(calls.length, 1);
  const login = await call("login", values);
  assert.equal(login.result.purpose, "login");
  assert.equal(login.result.token, undefined);
  assert.notEqual(login.result.challengeId, pending.result.challengeId);
  assert.equal(calls[1].body.subject, "Your Synergy sign-in code");
  const code = calls[1].body.textContent.match(/code is (\d{6})/)[1];
  assert.equal(
    (await call("auth/verify", { challengeId: login.result.challengeId, code }))
      .status,
    200,
  );
});

test("sign-in codes persist across restarts, expire, lock after five guesses and cannot cross accounts", (t) => {
  const { workspace, file, config } = fixture(t, { requireLoginCode: true });
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie");
  assert.throws(
    () => workspace.verifyLogin(a.challengeId, a.code),
    /could not be sent/,
  );
  workspace.loginCodeSent(a.challengeId, a.code);
  workspace.loginCodeSent(b.challengeId, b.code);
  assert.throws(
    () => workspace.verifyLogin("bad-id", a.code),
    (error) => error.status === 401,
  );
  // An account's proof cannot be used as a session or as profile verification.
  assert.throws(
    () => workspace.get(a.challengeId),
    (error) => error.status === 401,
  );
  assert.throws(
    () => workspace.verifyEmail(a.challengeId, a.code),
    (error) => error.status === 401,
  );
  const restarted = createWorkspace(file, config);
  for (let i = 0; i < 5; i++)
    assert.throws(
      () => restarted.verifyLogin(a.challengeId, "000000"),
      /incorrect/,
    );
  assert.throws(
    () => restarted.verifyLogin(a.challengeId, a.code),
    /too many attempts/,
  );
  assert.throws(
    () => restarted.resendLogin(a.challengeId),
    /too many attempts/,
  );
  const saved = JSON.parse(readFileSync(file, "utf8"));
  const account = Object.values(saved.accounts).find(
    (account) => account.email === "jamie@example.com",
  );
  account.loginVerification.expires = Date.now() - 1;
  writeFileSync(file, JSON.stringify(saved));
  const expired = createWorkspace(file, config);
  assert.throws(() => expired.verifyLogin(b.challengeId, b.code), /expired/);
  assert.throws(() => expired.resendLogin(b.challengeId), /expired/);
});

test("resending replaces only that account's code and preserves the sign-in deadline", (t) => {
  const { workspace, file, config } = fixture(t, { requireLoginCode: true });
  const a = signup(workspace, "Alex"),
    b = signup(workspace, "Jamie");
  workspace.loginCodeSent(a.challengeId, a.code);
  workspace.loginCodeSent(b.challengeId, b.code);
  const saved = JSON.parse(readFileSync(file, "utf8"));
  const account = Object.values(saved.accounts).find(
    (account) => account.email === "alex@example.com",
  );
  account.loginVerification.sentAt -= 61000;
  writeFileSync(file, JSON.stringify(saved));
  const restarted = createWorkspace(file, config);
  const sent = restarted.resendLogin(a.challengeId);
  assert.equal(sent.expiresAt, a.expiresAt);
  assert.equal(sent.challengeId, a.challengeId);
  assert.throws(
    () => restarted.verifyLogin(a.challengeId, sent.code),
    /could not be sent/,
  );
  restarted.loginCodeSent(a.challengeId, sent.code);
  // The exact prior salted proof is replaced even if random digits happen to repeat.
  const after = JSON.parse(readFileSync(file, "utf8"));
  assert.notEqual(
    after.accounts[account.id].loginVerification.hash,
    account.loginVerification.hash,
  );
  assert.equal(
    restarted.verifyLogin(b.challengeId, b.code).state.accountEmail,
    "jamie@example.com",
  );
  assert.equal(
    restarted.verifyLogin(a.challengeId, sent.code).state.accountEmail,
    "alex@example.com",
  );
});

test("failed signup mail keeps a recoverable challenge and never signs in", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  let failing = true;
  const { call, calls } = await apiFixture(
    t,
    { requireLoginCode: true, brevoKey: "private-brevo-key" },
    () => ({ ok: !failing, json: async () => ({ messageId: "test-message" }) }),
  );
  const values = {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    password: "private-password",
    role: "founder",
  };
  const response = await call("signup", values);
  assert.equal(response.status, 502);
  assert.equal(response.result.challenge.sent, false);
  assert.equal(response.result.token, undefined);
  assert.equal(response.result.state, undefined);
  assert.ok(!JSON.stringify(response.result).includes("private-brevo-key"));
  const { challengeId } = response.result.challenge;
  const code = calls[0].body.textContent.match(/code is (\d{6})/)[1];
  assert.equal((await call("auth/verify", { challengeId, code })).status, 400);
  assert.equal((await call("state", undefined, challengeId)).status, 401);
  assert.equal((await call("auth/resend", { challengeId })).status, 429);
  assert.equal((await call("signup", values)).status, 409);
  // A new credential check remains subject to the same send cooldown.
  failing = false;
  assert.equal((await call("login", values)).status, 429);
  assert.equal(calls.length, 1);
  now += 61000;
  const resent = await call("auth/resend", { challengeId });
  assert.equal(resent.status, 200);
  assert.equal(resent.result.sent, true);
  const latest = calls[1].body.textContent.match(/code is (\d{6})/)[1];
  const completed = await call("auth/verify", { challengeId, code: latest });
  assert.equal(completed.status, 200);
  assert.equal(completed.result.state.emailVerified, true);
});

test("sign-in requirements activate automatically with email configuration", async (t) => {
  assert.equal(configuration({}).requireLoginCode, false);
  assert.equal(
    configuration({ BREVO_API_KEY: "key", MAIL_FROM: "sender@example.com" })
      .requireLoginCode,
    true,
  );
  assert.equal(
    configuration({ RESEND_API_KEY: "key", MAIL_FROM: "sender@example.com" })
      .requireLoginCode,
    true,
  );
  const { call, calls } = await apiFixture(t, {
    requireLoginCode: true,
    resendKey: "",
    brevoKey: "",
  });
  assert.equal(
    (
      await call("signup", {
        firstName: "Alex",
        lastName: "Test",
        email: "alex@example.com",
        password: "private-password",
      })
    ).status,
    503,
  );
  assert.equal(calls.length, 0);
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

test("production requires mail credentials and unconfigured providers stay disabled", async (t) => {
  assert.throws(
    () => configuration({ NODE_ENV: "production" }),
    /requires BREVO_API_KEY or RESEND_API_KEY/,
  );
  assert.equal(
    configuration({
      NODE_ENV: "production",
      RESEND_API_KEY: "test",
      MAIL_FROM: "test@example.com",
    }).requireVerification,
    true,
  );
  const { call } = await apiFixture(t, { resendKey: "", openaiKey: "" });
  const { result: user } = await call("signup", {
    firstName: "Alex",
    lastName: "Test",
    email: "alex@example.com",
    password: "private-password",
    role: "founder",
  });
  assert.equal(user.state.integrations.email, false);
  assert.equal(user.state.integrations.ai, false);
  assert.equal((await call("email/send", {}, user.token)).status, 503);
  assert.equal(
    (
      await call(
        "ai/profile",
        { role: "founder", story: "Some profile notes here." },
        user.token,
      )
    ).status,
    503,
  );
  assert.equal((await call("health")).status, 200);
});
