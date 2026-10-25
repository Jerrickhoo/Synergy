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
    headless: true,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  projects: ["chromium", "firefox", "webkit"].map((browserName, index) => ({
    name: browserName,
    use: { browserName, baseURL: `http://127.0.0.1:${5181 + index}` },
  })),
  webServer: ["chromium", "firefox", "webkit"].map((browserName, index) => ({
    command: "node tests/browser-server.js",
    url: `http://127.0.0.1:${5181 + index}`,
    reuseExistingServer: false,
    env: {
      PORT: String(5181 + index),
      SYNERGY_DATA_FILE: resolve(
        ".data",
        `e2e-${browserName}-${randomUUID()}.sqlite`,
      ),
    },
  })),
});
