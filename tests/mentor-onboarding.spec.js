import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  command,
  getState,
  open,
  post,
  user,
} from "./founder-browser-helpers.js";
import { selectValue } from "./ui-helpers.js";

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
  await selectValue(
    page.getByRole("combobox", { name: "Verification method" }),
    "linkedin",
  );
  await page
    .getByLabel("Verification details")
    .fill("https://www.linkedin.com/in/example-mentor");
  const next = () =>
    page.getByRole("button", { name: "Save and continue" }).click();
  await next();
  await expect(page.getByText(/Step 2 of 8/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Step 2 of 8/)).toBeVisible();
  // (Nov 22, round 2) A missing topic goes through the moderated proposal.
  await expect(
    page.getByRole("heading", { name: "Missing a topic?" }),
  ).toBeVisible();
  // The approval server is shared by every browser project, so each one
  // proposes its own label.
  const proposal = `Customer retention ${test.info().project.name}`;
  await page.getByLabel("Topic to propose").fill(proposal);
  await page.getByRole("button", { name: "Propose tag", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Your proposed tags" }),
  ).toContainText(proposal);
  for (const topic of ["Product Feedback", "Product Design", "User Research"])
    await page.getByRole("checkbox", { name: topic, exact: true }).check();
  for (const step of [3, 4, 5]) {
    await next();
    await expect(page.getByText(new RegExp(`Step ${step} of 8`))).toBeVisible();
    // The time zone is the same list Settings uses, never free text.
    if (step === 3)
      await expect(
        page.getByRole("combobox", { name: "Time zone" }),
      ).toBeVisible();
  }
  await page.getByRole("checkbox", { name: "I have no conflicts" }).check();
  await next();
  await page
    .getByRole("checkbox", { name: /I accept the mentor guidelines/ })
    .check();
  await next();
  await expect(page.getByText(/Step 7 of 8/)).toBeVisible();
  // Long text is never cut off: the count turns into a warning first.
  const experience = page.getByLabel("Experience summary (optional)");
  await experience.fill("Product advisor. ".repeat(100));
  await expect(
    page.getByText(/characters over the 1,500-character limit/),
  ).toBeVisible();
  await experience.fill("Product advisor for student founders.");
  await expect(page.getByText("37 / 1,500")).toBeVisible();
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
  // Approved: Home says what founders see, with no set-up nag or false banner.
  await page.goto("/#/");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You're live in Matches" }),
  ).toBeVisible();
  await expect(page.getByText(/^Usually replies within 3 days/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set up your profile" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View your profile" }).click();
  await expect(
    page.getByText("Complete your profile to appear in Matches"),
  ).toHaveCount(0);
  await expect(page.getByText(/what you need/i)).toHaveCount(0);
  await expect(page.getByText("Verified mentor")).toBeVisible();
  // Expertise tags are listed once.
  await expect(
    page.locator(".profile-section").getByText("Product Design", {
      exact: true,
    }),
  ).toHaveCount(1);
});
