import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(".data", { recursive: true });
writeFileSync(".data/mentor-payment-browser-clock.txt", "2031-03-02T02:00:00Z");

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
  projects: [
    ...["chromium", "firefox", "webkit"].map((browserName, index) => ({
      name: browserName,
      testIgnore: "**/prototype.spec.js",
      use: { browserName, baseURL: `http://127.0.0.1:${5181 + index}` },
    })),
    {
      name: "prototype",
      testMatch: "**/prototype.spec.js",
      use: { browserName: "chromium", baseURL: "http://127.0.0.1:5184" },
    },
  ],
  webServer: [
    {
      command: "node tests/browser-server.js",
      url: "http://127.0.0.1:5187",
      reuseExistingServer: false,
      env: {
        PORT: "5187",
        SYNERGY_DEMO_MODE: "false",
        SYNERGY_TEST_CLOCK_FILE: resolve(
          ".data/mentor-payment-browser-clock.txt",
        ),
        SYNERGY_DATA_FILE: resolve(
          ".data",
          `e2e-payment-${randomUUID()}.sqlite`,
        ),
      },
    },
    ...["chromium", "firefox", "webkit", "prototype"].map(
      (browserName, index) => ({
        command: "node tests/browser-server.js",
        url: `http://127.0.0.1:${5181 + index}`,
        reuseExistingServer: false,
        env: {
          PORT: String(5181 + index),
          SYNERGY_DEMO_MODE: browserName === "prototype" ? "true" : "false",
          SYNERGY_DATA_FILE: resolve(
            ".data",
            `e2e-${browserName}-${randomUUID()}.sqlite`,
          ),
        },
      }),
    ),
    {
      command: "node tests/browser-server.js",
      url: "http://127.0.0.1:5185",
      reuseExistingServer: false,
      env: {
        PORT: "5185",
        SYNERGY_DEMO_MODE: "false",
        SYNERGY_REQUIRE_VERIFICATION: "true",
        SYNERGY_DATA_FILE: resolve(
          ".data",
          `e2e-verification-${randomUUID()}.sqlite`,
        ),
      },
    },
    {
      command: "node tests/browser-server.js",
      url: "http://127.0.0.1:5186",
      reuseExistingServer: false,
      env: {
        PORT: "5186",
        SYNERGY_DEMO_MODE: "false",
        SYNERGY_TEST_MENTOR_APPROVAL: "true",
        SYNERGY_DATA_FILE: resolve(
          ".data",
          `e2e-mentor-approval-${randomUUID()}.sqlite`,
        ),
      },
    },
  ],
});
