import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, getState, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

test("a Quick Ask uses an async room and keeps the mentor's review blind", async ({
  page,
  request,
}) => {
  const mentor = await user(
    request,
    "QuickMentor",
    {
      bio: "Advising student teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  const founder = await user(request, "QuickFounder");
  await command(request, mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 4,
      maxOpenAsync: 3,
      responseDays: 3,
      "format-quick-ask": "on",
      timeZone: "Asia/Manila",
    },
  });
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: { ...mentorRequestValues, format: "quick-ask" },
  });
  const id = (
    await command(request, mentor, {
      action: "accept-request",
      id: `${founder.state.accountId}:founder`,
    })
  ).state.activeRoomId;
  const founderPage = await page.context().newPage();
  await open(founderPage, founder, `rooms/${id}`);
  await expect(
    founderPage.getByText("Waiting for the mentor's answer", { exact: true }),
  ).toBeVisible();
  await open(page, mentor, `rooms/${id}`);
  await expect(
    page.getByText("Deliver your answer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Schedule" })).toHaveCount(0);
  await page
    .getByLabel("Write your response")
    .fill("Compare the shorter flow with your current flow for one week.");
  await page.getByRole("button", { name: "Deliver response" }).click();
  // Delivered is the stage reached (current); the review is still ahead.
  await expect(
    page.locator(".mentor-stage-line [aria-current=step]"),
  ).toHaveText("Delivered");
  await expect(
    page.locator(".mentor-stage-line li.done").filter({ hasText: "Accepted" }),
  ).toHaveCount(1);
  expect((await getState(request, mentor)).mentorUsage.openAsync).toBe(0);
  await command(request, founder, {
    form: "review-form",
    activeRoomId: id,
    values: { usefulness: 5, clarity: 5, responsiveness: 4 },
  });
  expect(
    (await getState(request, mentor)).rooms[id].review.partnerRating,
  ).toBeUndefined();
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
});
