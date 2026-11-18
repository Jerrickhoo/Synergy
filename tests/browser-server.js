// Isolated browser-test server with disposable local accounts.
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { createApi } from "../server/api.js";
import { configuration } from "../server/config.js";

const config = configuration({
  SYNERGY_DEMO_MODE: process.env.SYNERGY_DEMO_MODE || "false",
  SYNERGY_DATA_FILE: process.env.SYNERGY_DATA_FILE,
  SYNERGY_REQUIRE_VERIFICATION: process.env.SYNERGY_REQUIRE_VERIFICATION,
  SYNERGY_ADMIN_EMAILS: "moderator@example.com,settings-moderator@example.com",
});
const api = createApi({
  config: {
    ...config,
    mentorApprovalRequired: process.env.SYNERGY_TEST_MENTOR_APPROVAL === "true",
    ...(process.env.SYNERGY_TEST_CLOCK_FILE && {
      now: () =>
        Date.parse(readFileSync(process.env.SYNERGY_TEST_CLOCK_FILE, "utf8")),
    }),
  },
  // This isolated suite creates many accounts on one loopback IP. Production
  // keeps createApi's default of 30 authentication requests per minute.
  authAttemptsPerMinute: 300,
});
const server = await createServer({
  configFile: false,
  cacheDir: `.data/vite-${process.env.PORT || 5181}`,
  base: "./",
  plugins: [
    react(),
    {
      name: "isolated-browser-workspace",
      configureServer(server) {
        server.middlewares.use(api);
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT || 5181),
    strictPort: true,
    watch: { ignored: ["**/.data/**", "**/output/**"] },
  },
});
await server.listen();
server.printUrls();
