import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, getState, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { horizontalOverflow, openRequest } from "./ui-helpers.js";

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
      .toBe(true)
      .catch(async (error) => {
        const { offenders } = await horizontalOverflow(page);
        throw new Error(
          `Wider than the ${width}px window: ${offenders.join("; ")}
${error.message}`,
        );
      });
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
    await openRequest(page);
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
      page.getByText("Only RequestMentor Audit sees this request"),
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

test("a long decline message is flagged before sending and the founder gets an unread notice", async ({
  page,
  request,
}) => {
  const founder = await user(request, "DeclinedFounder");
  const mentor = await user(
    request,
    "DecliningMentor",
    mentorProfile,
    "mentor",
  );
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  await open(page, mentor, "requests");
  // The founder is named with stage and industry, and safety actions sit
  // below the reply.
  await expect(page.getByText(/Idea · EdTech/)).toBeVisible();
  await expect(
    page.getByText(/% match · (Strong|Moderate|Low) fit$/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  const message = page.getByLabel("Message to the founder (optional)");
  await message.fill("x".repeat(300));
  await expect(
    page.getByText(
      "20 characters over the 280-character limit. Shorten it to send.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send decline" }).click();
  await expect(
    page.getByRole("button", { name: "Send decline" }),
  ).toBeVisible();
  await message.fill("Thanks for asking. This is outside my expertise.");
  await expect(page.getByText("48 / 280")).toBeVisible();
  await page.getByRole("button", { name: "Send decline" }).click();
  await expect(page.getByText("No new mentorship requests")).toBeVisible();
  const notice = (await getState(request, founder)).notifications.find(
    (item) => item.kind === "declined",
  );
  expect(notice.read).toBe(false);
  expect(notice.digested).toBe(false);
  // (Nov 22, round 3) During the cooldown, the mentor's Match details shows
  // when the founder can ask again and other mentors, never the request form.
  await user(request, "OtherAvailableMentor", mentorProfile, "mentor");
  const founderPage = await page.context().newPage();
  await open(founderPage, founder, `matches/${mentor.state.accountId}:mentor`);
  await openRequest(founderPage);
  const panel = founderPage.locator("#match-action");
  await expect(
    panel.getByRole("heading", {
      name: /^You can ask again after [A-Z][a-z]{2} \d{1,2}(, \d{4})?$/,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^View match,/ }).first(),
  ).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Request mentorship" }),
  ).toHaveCount(0);
  await expect(panel.locator("form.mentor-request-form")).toHaveCount(0);
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel).not.toContainText(/\d{1,2}\/\d{1,2}\/\d{4}/);
  await audit(founderPage);
  await founderPage.close();
});

// (Nov 22, round 2) In a mentorship room the mentor adds action items but is
// never offered Done, and the tab never says "task".
test("a mentor's action items offer no Done and no task wording", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const founder = await user(request, "ActionFounder");
  const mentor = await user(request, "ActionMentor", mentorProfile, "mentor");
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  const roomId = (
    await command(request, mentor, {
      action: "accept-request",
      id: `${founder.state.accountId}:founder`,
    })
  ).state.activeRoomId;
  await command(request, mentor, {
    form: "task-create",
    activeRoomId: roomId,
    values: {
      title: "Interview five students",
      status: "todo",
      priority: "normal",
    },
  });
  await open(page, mentor, `rooms/${roomId}?tab=tasks`);
  const board = page.getByRole("region", { name: "Action items", exact: true });
  await expect(board).toBeVisible();
  await expect(board).not.toContainText(/task/i);
  await expect(board.getByText("Assigned to me")).toHaveCount(0);
  await expect(
    board.getByRole("button", { name: "Add action item to Done" }),
  ).toHaveCount(0);
  await board
    .getByRole("combobox", { name: "Status of Interview five students" })
    .click();
  await expect(page.getByRole("option", { name: "In progress" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Done" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await board
    .getByRole("button", { name: "Add action item", exact: true })
    .click();
  await board.getByRole("combobox", { name: "Status", exact: true }).click();
  await expect(page.getByRole("option", { name: "To do" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Done" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(board).not.toContainText(/task/i);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
