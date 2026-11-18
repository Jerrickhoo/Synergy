import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  command,
  getState,
  open,
  post,
  user,
} from "./founder-browser-helpers.js";

test.use({ baseURL: "http://127.0.0.1:5186" });

test("mentor application survives a reload and approval is required for discovery", async ({
  page,
  request,
}) => {
  const founder = await user(request, "ApprovalFounder");
  const mentor = await post(request, "signup", {
    firstName: "New",
    lastName: "Mentor",
    email: `mentor-${Date.now()}@example.com`,
    password: "private-password",
    role: "mentor",
  });
  mentor.role = "mentor";
  const listed = async () =>
    (await getState(request, founder)).directory.mentors.some(
      (person) => person.accountId === mentor.state.accountId,
    );
  expect(await listed()).toBe(false);
  await open(page, mentor, "onboarding");
  await page.getByLabel("Verification method").selectOption("linkedin");
  await page
    .getByLabel("Verification details")
    .fill("https://www.linkedin.com/in/example-mentor");
  const next = () =>
    page.getByRole("button", { name: "Save and continue" }).click();
  await next();
  await expect(page.getByText(/Step 2 of 8/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Step 2 of 8/)).toBeVisible();
  for (const topic of ["Product Feedback", "Product Design", "User Research"])
    await page.getByRole("checkbox", { name: topic, exact: true }).check();
  for (const step of [3, 4, 5]) {
    await next();
    await expect(page.getByText(new RegExp(`Step ${step} of 8`))).toBeVisible();
  }
  await page.getByRole("checkbox", { name: "I have no conflicts" }).check();
  await next();
  await page
    .getByRole("checkbox", { name: /I accept the mentor guidelines/ })
    .check();
  await next();
  await expect(page.getByText(/Step 7 of 8/)).toBeVisible();
  await next();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByText(/Your profile is with our team/)).toBeVisible();
  expect(await listed()).toBe(false);
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
  expect(audit.violations.map(({ id }) => id)).toEqual([]);
  const credentials = {
    firstName: "Moderator",
    lastName: "Audit",
    email: "moderator@example.com",
    password: "private-password",
    role: "founder",
  };
  const signup = await request.post("/api/signup", { data: credentials });
  const admin = signup.ok()
    ? JSON.parse(await signup.text())
    : await post(request, "login", credentials);
  admin.role = "founder";
  await command(request, admin, {
    action: "approve-mentor",
    id: mentor.state.accountId,
  });
  expect(await listed()).toBe(true);
});
