import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { decode } from "../src/state/serialization.js";
import {
  command,
  founderProfile,
  getState,
  open,
  user,
} from "./founder-browser-helpers.js";

const mentorProfile = {
  bio: "Advising early student teams",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech idea stage",
  goals: "Validate onboarding",
};

async function checkLayout(page, name, testInfo) {
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `output/playwright/mentor-capacity/${testInfo.project.name}-${name}-${width}.png`,
      fullPage: true,
    });
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

// user() accepts the guidelines for mentors, so these mentors can take requests.
const newMentor = (request, name) =>
  user(request, name, mentorProfile, "mentor");

test("a new mentor accepts the guidelines in Settings before founders can ask them", async ({
  page,
  request,
}, testInfo) => {
  const founder = await user(request, "CapFounder");
  // user() accepts for mentors; create one that has not, through the API.
  const response = await request.post("/api/signup", {
    data: {
      firstName: "Guide",
      lastName: "Mentor",
      email: `guide-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      password: "private-password",
      role: "mentor",
    },
  });
  expect(response.ok()).toBeTruthy();
  const mentor = decode(await response.text());
  mentor.role = "mentor";
  await command(request, mentor, {
    form: "profile-form",
    values: mentorProfile,
  });

  let seen = (await getState(request, founder)).directory.mentors.find(
    (item) => item.accountId === mentor.state.accountId,
  );
  expect(seen.available).toBe(false);
  expect(seen.reason).toBe("guidelines");

  await open(page, mentor, "settings");
  await expect(
    page.getByRole("heading", { name: "Mentoring", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Accept these to start receiving requests/),
  ).toBeVisible();
  await checkLayout(page, "guidelines-required", testInfo);
  await page.getByRole("button", { name: "Accept guidelines" }).click();
  await expect(page.getByText(/You accepted version 2/)).toBeVisible();

  seen = (await getState(request, founder)).directory.mentors.find(
    (item) => item.accountId === mentor.state.accountId,
  );
  expect(seen.available).toBe(true);
});

test("mentors set capacity, pause requests and disclose conflicts from Settings", async ({
  page,
  request,
}, testInfo) => {
  const mentor = await newMentor(request, "CapMentor");
  const founder = await user(request, "CapFounder", {
    ...founderProfile,
    startupName: "Studyloop",
  });
  await open(page, mentor, "settings");

  // Capacity
  await page.getByLabel("Mentees at once").fill("1");
  await page.getByLabel("Hours per month").fill("6");
  await page.getByRole("button", { name: "Save mentoring settings" }).click();
  await expect(
    page.getByText(/You're using 0 of 1 mentee slots/),
  ).toBeVisible();
  expect(
    (await getState(request, mentor)).profiles.mentor.capacity.monthlyHours,
  ).toBe(6);

  // Conflicts: a disclosed company hides the mentor from that founder.
  await page.getByLabel("Company").fill("Studyloop Inc");
  await page.getByRole("button", { name: "Add conflict" }).click();
  const conflicts = page.locator(".mentoring-conflicts");
  await expect(conflicts.locator("strong")).toBeVisible();
  expect(
    (await getState(request, founder)).directory.mentors.filter(
      (item) => item.accountId === mentor.state.accountId,
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: /^Remove/ }).click();
  await expect(conflicts).toHaveCount(0);

  // Pause Mode
  await page.getByRole("button", { name: "Pause new requests" }).click();
  await expect(page.getByText(/Pause Mode is on/).first()).toBeVisible();
  const listed = (await getState(request, founder)).directory.mentors.find(
    (item) => item.accountId === mentor.state.accountId,
  );
  expect(listed.available).toBe(false);
  expect(listed.reason).toBe("paused");
  await checkLayout(page, "settings-paused", testInfo);
  await page.getByRole("button", { name: "Turn off Pause Mode" }).click();
  await expect(
    page.getByRole("button", { name: "Pause new requests" }),
  ).toBeVisible();
});

test("founders see why a paused mentor is unavailable and can filter to who is available now", async ({
  page,
  request,
}, testInfo) => {
  const paused = await newMentor(request, "PausedMentor");
  await newMentor(request, "OpenMentor");
  const founder = await user(request, "AvailFounder");
  await command(request, paused, {
    form: "set-mentor-pause",
    values: { paused: "on" },
  });

  await open(page, founder, "matches");
  await page.getByRole("tab", { name: "Browse all" }).click();
  // Other specs share this database, so narrow the list to this test's mentors.
  await page.getByLabel("Search matches").fill("PausedMentor");
  await expect(
    page.getByText(/PausedMentor Audit is not taking requests right now/),
  ).toBeVisible();
  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByLabel("Available now").check();
  await page.getByRole("button", { name: "Show matches" }).click();
  await expect(page.getByText(/is not taking requests right now/)).toHaveCount(
    0,
  );
  await checkLayout(page, "discover-available-now", testInfo);

  // The paused mentor's page explains the reason and blocks sending.
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.getByLabel("Search matches").fill("PausedMentor");
  await page
    .getByRole("button", { name: /View match\s*: PausedMentor/ })
    .click();
  await expect(
    page.getByText(/is not taking requests right now/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send mentorship request" }),
  ).toHaveCount(0);
  await checkLayout(page, "match-detail-paused", testInfo);
});
