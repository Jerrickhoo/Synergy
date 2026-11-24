import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, getState, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { selectValue } from "./ui-helpers.js";

test("Office Hours booking is atomic, displays local time and produces a private calendar feed", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
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
  await page.getByLabel(/^Start time \(Philippine/).fill("10:00");
  await expect(page.getByLabel("First date")).toHaveAttribute(
    "min",
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await page.getByRole("button", { name: "Open slot" }).click();
  // Slots are labelled for people, never "2026-11-24 · 10:00".
  const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const slotHeading = page.getByRole("heading", {
    name: new RegExp(`^${dayLabel}.* · 10:00–10:30 AM`),
  });
  await expect(slotHeading).toBeVisible();
  await expect(page.getByText(date, { exact: true })).toHaveCount(0);
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
  // The mentor sees who booked, and closing a booked slot asks first.
  await page.reload();
  await expect(
    page.getByText(/^Booked by (Another)?OfficeFounder Audit · /),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close slot", exact: true }).click();
  await expect(
    page.getByText(/It counts as a mentor cancellation\./),
  ).toBeVisible();
  await expect(
    page.getByText(/no other open times, so the founder is told/),
  ).toBeVisible();
  // (Nov 22, round 2) Keeping the slot is the focused default; cancelling
  // the booking uses the danger style.
  await expect(
    page.getByRole("button", { name: "Keep slot", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Close slot and cancel booking" }),
  ).toHaveClass(/\bdanger\b/);
  await page.getByRole("button", { name: "Keep slot", exact: true }).click();
  await expect(slotHeading).toBeVisible();
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

// (Nov 22, round 2) A slot that closes another format asks first, as a
// confirmation: no failed request, no error alert and no console error.
test("opening a format-closing slot asks to confirm without an error", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const mentor = await user(
    request,
    "ClosingMentor",
    {
      bio: "Advising student teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  await command(request, mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 4,
      maxOpenAsync: 3,
      responseDays: 3,
      "format-single-session": "on",
      "format-ongoing-advisory": "on",
      "format-office-hours": "on",
      timeZone: "Asia/Manila",
    },
  });
  const failures = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await open(page, mentor, "calendar");
  await page.getByLabel("First date").fill(date);
  await page.getByLabel(/^Start time \(Philippine/).fill("18:00");
  // A weekly 45-minute slot always leaves too few hours at 4 h for a new
  // 8-week advisory cycle.
  await selectValue(page.getByRole("combobox", { name: "Duration" }), "45");
  await page.getByLabel("Repeat weekly").check();
  await page.getByRole("button", { name: "Open slot" }).click();
  await expect(
    page.getByText(/^This slot closes Ongoing Advisory to new founders in /),
  ).toBeVisible();
  await expect(page.getByText("Something needs your attention")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Open slot anyway" }).click();
  await expect(
    page.getByText(/Ongoing Advisory is closed to new founders/).first(),
  ).toBeVisible();
  expect(
    (await getState(request, mentor)).profiles.mentor.officeHours,
  ).toHaveLength(1);
  expect(failures).toEqual([]);
});
