import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5181",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node tests/browser-server.js",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
    env: { SYNERGY_DATA_FILE: resolve(".data", `e2e-${randomUUID()}.json`) },
  },
});
