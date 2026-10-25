// Local, synthetic smoke benchmark. Never reads .env credentials or normal data.
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { createApi } from "./api.js";
import { configuration } from "./config.js";
import { decode } from "../src/state/serialization.js";

const dir = mkdtempSync(join(tmpdir(), "synergy-benchmark-"));
const api = createApi({
  config: configuration({ SYNERGY_DATA_FILE: join(dir, "workspace.sqlite") }),
  authAttemptsPerMinute: 10000,
});
const server = createServer((req, res) => api(req, res));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/`;
async function request(path, token, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(`Benchmark request failed: ${response.status}`);
  return decode(await response.text());
}
try {
  const users = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      request("signup", null, {
        firstName: `Synthetic${index}`,
        lastName: "User",
        email: `benchmark${index}@example.com`,
        password: "synthetic-password",
        role: "founder",
      }),
    ),
  );
  for (const user of users)
    await request("action", user.token, {
      role: "founder",
      form: "profile-form",
      values: {
        bio: "Synthetic student tools",
        offer: "Product design",
        need: "Product design",
        industry: "EdTech",
        stage: "idea",
        teamSize: "3",
      },
    });
  const snapshots = await Promise.all(
    users.map((user) => request("state", user.token)),
  );
  const latency = [];
  let unchanged = 0;
  for (let round = 0; round < 10; round++)
    await Promise.all(
      users.map(async (user, index) => {
        const start = performance.now();
        const snapshot = snapshots[index];
        const response = await request(
          `state?role=founder&since=${snapshot.revision}&key=${encodeURIComponent(snapshot.refreshKey)}`,
          user.token,
        );
        latency.push(performance.now() - start);
        if (response.unchanged) unchanged++;
      }),
    );
  latency.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        note: "Synthetic loopback smoke test; not a production capacity estimate",
        concurrentUsers: users.length,
        requests: latency.length,
        unchangedResponses: unchanged,
        medianMs: Math.round(latency[Math.floor(latency.length * 0.5)]),
        p95Ms: Math.round(latency[Math.floor(latency.length * 0.95)]),
        maximumMs: Math.round(latency.at(-1)),
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  api.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
    throw new Error("Invalid benchmark cleanup target");
  rmSync(dir, { recursive: true });
}
