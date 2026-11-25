import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getState, open, post, user } from "./founder-browser-helpers.js";
import { selectValue } from "./ui-helpers.js";

test("mentoring moderation filters queues and logs validated settings with live values", async ({
  page,
  request,
}) => {
  const credentials = {
    firstName: "Settings",
    lastName: "Moderator",
    email: "settings-moderator@example.com",
    password: "private-password",
    role: "founder",
  };
  const signup = await request.post("/api/signup", { data: credentials });
  const admin = signup.ok()
    ? JSON.parse(await signup.text())
    : await post(request, "login", credentials);
  admin.role = "founder";
  const observer = await user(request, "SettingsObserver");
  await open(page, admin, "moderation");
  await selectValue(
    page.getByRole("combobox", { name: "Filter by", exact: true }),
    "sessions",
  );
  await expect(
    page.getByRole("heading", { name: "Session disputes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mentorship safety" }),
  ).toHaveCount(0);
  // Waiting applications sit above the queue filter, so they always show.
  await expect(
    page.getByRole("heading", { name: /^Mentor approvals \(\d+ waiting\)$/ }),
  ).toBeVisible();
  await page.getByLabel("New value").fill("2");
  await page
    .getByRole("button", { name: "Save mentoring setting", exact: true })
    .click();
  await expect(
    page.getByText("Mentoring setting saved.", { exact: true }),
  ).toBeVisible();
  expect(
    (await getState(request, observer)).mentorConfig.freeReschedulesPerSide,
  ).toBe(2);
  await page.getByText("Mentoring change log", { exact: true }).click();
  await expect(
    page.getByText(/Free Reschedules Per Side changed from 1 to 2/i),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mentorship launch metrics" }),
  ).toBeVisible();
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
