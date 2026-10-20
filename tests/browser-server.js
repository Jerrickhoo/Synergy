// Isolated browser-test server. Never uses .env credentials or sends real mail.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";

const outbox = new Map();
const failures = new Set();
const config = configuration({
  SYNERGY_DATA_FILE: process.env.SYNERGY_DATA_FILE,
  EMAIL_PROVIDER: "brevo",
  BREVO_API_KEY: "browser-test-key",
  MAIL_FROM: "Synergy <test@example.com>",
  REQUIRE_EMAIL_VERIFICATION: "true",
  SYNERGY_ADMIN_EMAILS: "moderator@example.com,settings-moderator@example.com",
  OPENAI_API_KEY: "browser-test-ai-key",
});
const api = createApi({
  config,
  // This isolated suite creates many accounts on one loopback IP. Production
  // keeps createApi's default of 30 authentication requests per minute.
  authAttemptsPerMinute: 300,
  fetcher: async (url, request) => {
    if (url !== "https://api.brevo.com/v3/smtp/email")
      throw new Error("Unexpected provider call in browser test");
    const body = JSON.parse(request.body);
    const email = body.to[0].email;
    if (email.startsWith("delivery-failure") && !failures.has(email)) {
      failures.add(email);
      return { ok: false };
    }
    outbox.set(email, body.textContent.match(/code is (\d{6})/)[1]);
    return {
      ok: true,
      json: async () => ({ messageId: "browser-test-message" }),
    };
  },
});
const server = await createServer({
  configFile: false,
  base: "./",
  plugins: [
    react(),
    {
      name: "isolated-browser-workspace",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, "http://localhost");
          if (url.pathname !== "/__test__/email") return api(req, res, next);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            JSON.stringify({
              code: outbox.get(url.searchParams.get("address")),
            }),
          );
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5181,
    strictPort: true,
    watch: { ignored: ["**/.data/**", "**/output/**"] },
  },
});
await server.listen();
server.printUrls();
