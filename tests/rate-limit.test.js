import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";
import { clientAddress } from "../server/rate-limit.js";

async function serve(t, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "synergy-rate-limit-"));
  const file = join(dir, "workspace.sqlite");
  const api = createApi({
    file,
    config: configuration({ SYNERGY_DATA_FILE: file, ...env }),
    authAttemptsPerMinute: 5,
    authAttemptsPerEmailPerMinute: 3,
  });
  const server = createServer((req, res) => api(req, res));
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(async () => {
    await new Promise((done) => server.close(done));
    api.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return (email, headers = {}) =>
    fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ email, password: "wrong-password" }),
    }).then((response) => response.status);
}

test("a forged X-Forwarded-For does not reset the sign-in limit", async (t) => {
  const login = await serve(t, {
    SYNERGY_CLIENT_IP_HEADER: "cf-connecting-ip",
  });
  const proxy = (forged) => ({
    "X-Forwarded-For": `${forged}, 203.0.113.7`,
    "CF-Connecting-IP": "203.0.113.7",
  });
  for (let i = 0; i < 5; i += 1)
    assert.notEqual(
      await login(`person${i}@example.com`, proxy(`10.0.0.${i}`)),
      429,
    );
  assert.equal(await login("person9@example.com", proxy("10.0.0.99")), 429);
  // Another visitor behind the same proxy keeps a limit of their own.
  assert.notEqual(
    await login("person9@example.com", {
      "X-Forwarded-For": "198.51.100.4",
      "CF-Connecting-IP": "198.51.100.4",
    }),
    429,
  );
});

test("one email address is limited however many addresses try it", async (t) => {
  const login = await serve(t, {
    SYNERGY_CLIENT_IP_HEADER: "cf-connecting-ip",
  });
  const from = (ip) => ({ "CF-Connecting-IP": ip });
  for (let i = 0; i < 3; i += 1)
    assert.notEqual(
      await login("target@example.com", from(`198.51.100.${i}`)),
      429,
    );
  assert.equal(await login(" Target@Example.com ", from("198.51.100.50")), 429);
  assert.notEqual(await login("other@example.com", from("198.51.100.51")), 429);
});

test("the visitor's address comes only from the configured header or nearest proxy", () => {
  const req = (headers) => ({
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  });
  assert.equal(
    clientAddress(
      req({ "x-forwarded-for": "10.0.0.1", "cf-connecting-ip": "10.0.0.2" }),
    ),
    "127.0.0.1",
  );
  assert.equal(
    clientAddress(
      req({ "x-nf-client-connection-ip": "203.0.113.9" }),
      "x-nf-client-connection-ip",
    ),
    "203.0.113.9",
  );
  // A missing or malformed header falls back to the address the nearest proxy
  // appended, never the visitor-supplied first entry.
  assert.equal(
    clientAddress(
      req({
        "x-forwarded-for": "10.0.0.1, 203.0.113.5",
        "cf-connecting-ip": "nonsense",
      }),
      "cf-connecting-ip",
    ),
    "203.0.113.5",
  );
});
