// A new account is welcomed into the quick tour on its first Home, and can
// skip it. Browser automation normally keeps the tour away, so these tests
// present the page as an ordinary browser would.
import { test, expect } from "@playwright/test";

async function signUp(page, first) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  await page.goto("/#/signup");
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill("Tour");
  await page
    .getByLabel("Email")
    .fill(
      `${first.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    );
  await page.getByLabel("Password", { exact: true }).fill("private-password");
  await page.getByRole("button", { name: /Create account/ }).click();
}

test("a new account is welcomed into the tour and can skip it for good", async ({
  page,
}) => {
  await signUp(page, "Skipper");
  const welcome = page.getByRole("dialog", {
    name: "Welcome to Synergy, Skipper!",
  });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("Quick tour · about a minute");
  await welcome.getByRole("button", { name: "Skip for now" }).click();
  await expect(welcome).toHaveCount(0);
  // Skipped means done: it doesn't open by itself again, and the header's
  // tour button still replays it, without the welcome.
  await page.reload();
  await expect(page.locator(".page h1").first()).toBeVisible();
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Quick tour" }).click();
  await expect(
    page.getByRole("dialog", { name: "Find your missing piece" }),
  ).toBeVisible();
  await expect(page.locator(".tour-count")).toHaveText(/^Step 1 of \d+$/);
});

test("starting the tour from the welcome goes to its first step", async ({
  page,
}) => {
  await signUp(page, "Starter");
  const welcome = page.getByRole("dialog", {
    name: "Welcome to Synergy, Starter!",
  });
  await welcome.getByRole("button", { name: "Start the tour" }).click();
  const step = page.getByRole("dialog", { name: "Find your missing piece" });
  await expect(step).toBeVisible();
  await expect(page.locator(".tour-count")).toHaveText(/^Step 1 of \d+$/);
  // The welcome isn't a step to go back to.
  await expect(step.getByRole("button", { name: "Back" })).toHaveCount(0);
  await step.getByRole("button", { name: "End tour" }).click();
  await expect(page.locator(".tour-card")).toHaveCount(0);
});
