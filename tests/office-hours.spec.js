import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, getState, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

test("Office Hours booking is atomic, displays local time and produces a private calendar feed", async ({
  page,
  request,
}) => {
  const mentor = await user(
    request,
    "OfficeMentor",
    {
      bio: "Advising student teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  const a = await user(request, "OfficeFounder");
  const b = await user(request, "AnotherOfficeFounder");
  await command(request, mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 4,
      maxOpenAsync: 3,
      responseDays: 3,
      "format-office-hours": "on",
      timeZone: "Asia/Manila",
    },
  });
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await open(page, mentor, "calendar");
  await page.getByLabel("First date").fill(date);
  await page.getByLabel("Start time (Asia/Manila)").fill("10:00");
  await page.getByRole("button", { name: "Open slot" }).click();
  await expect(page.getByText(`One time ${date}`)).toBeVisible();
  const id = `${mentor.state.accountId}:mentor`;
  const [slot] = (await getState(request, a)).directory.mentors.find(
    (person) => person.id === id,
  ).officeHours;
  expect(slot.startsAt).toBe(`${date}T02:00:00.000Z`);
  const tries = await Promise.all(
    [a, b].map((founder) =>
      request.post("/api/action", {
        headers: { Authorization: `Bearer ${founder.token}` },
        data: {
          role: "founder",
          action: "book-office-hours",
          id,
          values: { ...mentorRequestValues, slotId: slot.slotId, date },
        },
      }),
    ),
  );
  expect(tries.map((result) => result.status()).sort()).toEqual([200, 409]);
  expect(
    await tries.find((result) => result.status() === 409).text(),
  ).toContain("Just taken");
  await page.getByRole("button", { name: "Create calendar link" }).click();
  const path = await page.getByLabel("Private calendar link").inputValue();
  const feed = await request.get(path);
  // The mentor's feed names the founder who booked, from the mentor's side.
  expect(await feed.text()).toContain(
    "SUMMARY:Office Hours with OfficeFounder Audit",
  );
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
