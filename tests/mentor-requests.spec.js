import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

const mentorProfile = {
  bio: "Advising early student teams",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech idea stage",
};

async function audit(page) {
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test("a founder shares a structured request and a mentor refers them without forwarding it", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(60000);
  const founder = await user(request, "RequestFounder");
  const mentor = await user(request, "RequestMentor", mentorProfile, "mentor");
  const referralName = `ReferralMentor${testInfo.repeatEachIndex}`;
  const alternative = await user(
    request,
    referralName,
    mentorProfile,
    "mentor",
  );
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
  });
  const inbox = await context.newPage();
  try {
    await open(page, founder, `matches/${mentor.state.accountId}:mentor`);
    await page
      .getByLabel("What's the problem?")
      .fill(mentorRequestValues.problem);
    await page
      .getByLabel("What have you already tried?")
      .fill(mentorRequestValues.tried);
    await page
      .getByLabel("What specific question do you want answered?")
      .fill(mentorRequestValues.question);
    await expect(
      page.getByText(/Only RequestMentor Audit will see/),
    ).toBeVisible();
    await audit(page);
    await page.getByRole("button", { name: "Send mentorship request" }).click();
    await expect(page).toHaveURL(/#\/waiting\?request=/);
    await expect(page.getByRole("button", { name: "Withdraw" })).toBeVisible();
    await open(inbox, mentor, "requests");
    await expect(inbox.getByText(mentorRequestValues.question)).toBeVisible();
    await audit(inbox);
    await inbox.getByRole("button", { name: "Refer", exact: true }).click();
    await inbox
      .getByRole("checkbox", { name: new RegExp(`${referralName} Audit`) })
      .check();
    await inbox.getByRole("button", { name: "Send referral" }).click();
    await expect(inbox.getByText(mentorRequestValues.question)).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("button", { name: `Ask, ${referralName} Audit`, exact: true })
      .click();
    await expect(
      page.getByLabel("What specific question do you want answered?"),
    ).toHaveValue(mentorRequestValues.question);
    expect(alternative.state.accountId).toBeTruthy();
  } finally {
    await context.close();
  }
});

test("a mentor who reaches capacity can recover from a blocked acceptance", async ({
  page,
  request,
}) => {
  const mentor = await user(request, "FullMentor", mentorProfile, "mentor");
  const first = await user(request, "FirstSlot");
  const second = await user(request, "SecondSlot");
  await command(request, mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: "1",
      monthlyHours: "4",
      maxOpenAsync: "3",
      responseDays: "3",
      "format-single-session": "on",
      timeZone: "Asia/Manila",
    },
  });
  for (const founder of [first, second])
    await command(request, founder, {
      action: "send-request",
      id: `${mentor.state.accountId}:mentor`,
      values: mentorRequestValues,
    });
  await command(request, mentor, {
    action: "accept-request",
    id: `${first.state.accountId}:founder`,
  });
  await open(page, mentor, "requests");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  const settings = page.getByRole("button", {
    name: "mentoring settings",
    exact: true,
  });
  await expect(settings).toBeVisible();
  await expect(
    page.getByText(/decline, or suggest another mentor/),
  ).toBeVisible();
  await settings.click();
  await expect(page.getByLabel("Mentees at once")).toHaveValue("1");
});

test("a founder opening an unavailable mentor link can find active mentors", async ({
  page,
  request,
}) => {
  const founder = await user(request, "MissingMatchFounder");
  await user(request, "AvailableMatchMentor", mentorProfile, "mentor");
  await open(page, founder, "matches/no-longer-listed:mentor");
  await expect(
    page.getByRole("heading", { name: "Match unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^View match,/ }).first(),
  ).toBeVisible();
});
