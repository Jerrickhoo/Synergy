import { test, expect } from "@playwright/test";
import {
  command,
  founderProfile,
  getState,
  open,
  user,
} from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

const shots = process.env.MENTOR_HOME_SHOTS;
const shot = (page, name) =>
  shots
    ? page.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
    : null;

const mentorProfile = (expertise) => ({
  bio: "Advising early startup teams",
  offer: expertise,
  need: "Focused questions",
  expertise,
  startups: "EdTech idea stage",
});

async function mentorWithFormats(request, prefix, expertise) {
  const mentor = await user(
    request,
    prefix,
    mentorProfile(expertise),
    "mentor",
  );
  await command(request, mentor, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 10,
      maxOpenAsync: 3,
      responseDays: 3,
      timeZone: "Asia/Manila",
      "format-single-session": "on",
      "format-quick-ask": "on",
      "format-ongoing-advisory": "on",
    },
  });
  return mentor;
}

const nextCard = (page) => page.getByRole("region", { name: "Your next step" });

test("a quiet mentor sees startups they can help, or Browse startups when none fit", async ({
  page,
  request,
}) => {
  const founder = await user(request, "PriceFounder", {
    ...founderProfile,
    need: "Pricing strategy",
  });
  const mentor = await mentorWithFormats(
    request,
    "PriceMentor",
    "Pricing strategy",
  );
  await open(page, mentor);
  const card = page.getByRole("region", { name: "Startups you can help" });
  await expect(card).toBeVisible();
  // Nothing specific to do: the list leads instead of a generic next step.
  await expect(nextCard(page)).toHaveCount(0);
  const tile = card.getByRole("button", { name: /PriceFounder/ });
  await expect(tile).toContainText(
    "Needs pricing strategy, your area of expertise",
  );
  expect(await card.locator(".top-match").count()).toBeLessThanOrEqual(3);
  await shot(page, "mentor-quiet");
  await tile.click();
  await expect(page).toHaveURL(
    new RegExp(`#/matches/${founder.state.accountId}`),
  );
  await page.goBack();
  await card.getByRole("button", { name: "See all startups" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Startups" }),
  ).toBeVisible();

  const lonely = await mentorWithFormats(
    request,
    "LonelyMentor",
    "Underwater basket weaving",
  );
  const other = await page.context().newPage();
  await open(other, lonely);
  const empty = other.getByRole("region", {
    name: "No startups match your expertise yet",
  });
  await expect(empty).toBeVisible();
  await shot(other, "mentor-quiet-empty");
  await empty.getByRole("button", { name: "Browse startups" }).click();
  await expect(
    other.getByRole("heading", { level: 1, name: "Startups" }),
  ).toBeVisible();
});

test("a mentor with a pending request is sent to that request", async ({
  page,
  request,
}) => {
  const mentor = await mentorWithFormats(
    request,
    "RequestMentor",
    "Product feedback",
  );
  const founder = await user(request, "AskingFounder");
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  const [pending] = (await getState(request, mentor)).mentorRequests;
  await open(page, mentor);
  const card = nextCard(page);
  await expect(card).toContainText(
    `Reply to ${pending.name}'s mentorship request`,
  );
  // The request list stays on Home, and the quiet-state list does not show.
  await expect(
    page.getByRole("region", { name: "Top requests" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Startups you can help" }),
  ).toHaveCount(0);
  await shot(page, "mentor-requests");
  await card.getByRole("button", { name: "Review request" }).click();
  await expect(page).toHaveURL(new RegExp(`request=${pending.id}`));
  await expect(page.locator(`#request-${pending.id}`)).toBeFocused();
});

test("a mentor with mentees acts on the most urgent step, and Mentees lists who acts next", async ({
  page,
  request,
}) => {
  const mentor = await mentorWithFormats(
    request,
    "BusyMentor",
    "Product feedback",
  );
  const accept = async (prefix, format) => {
    const founder = await user(request, prefix);
    await command(request, founder, {
      action: "send-request",
      id: `${mentor.state.accountId}:mentor`,
      values: { ...mentorRequestValues, format },
    });
    const id = (
      await command(request, mentor, {
        action: "accept-request",
        id: `${founder.state.accountId}:founder`,
      })
    ).state.activeRoomId;
    return { founder, id };
  };
  const quick = await accept("QuickFounder", "quick-ask");
  const session = await accept("SessionFounder", "single-session");
  const advisory = await accept("AdvisoryFounder", "ongoing-advisory");
  // The mentor confirms the advisory goals; the founder proposes a time next.
  await command(request, mentor, {
    action: "confirm-goal",
    activeRoomId: advisory.id,
  });

  await open(page, mentor);
  const card = nextCard(page);
  // Confirming a goal outranks delivering an answer.
  await expect(card).toContainText(/Confirm SessionFounder.*mentorship goal/);
  await expect(
    page.getByRole("heading", { name: "Active mentees" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Startups you can help" }),
  ).toHaveCount(0);
  await shot(page, "mentor-mentees-home");
  await card.getByRole("button", { name: "Confirm goal" }).click();
  await expect(page).toHaveURL(new RegExp(`#/rooms/${session.id}`));
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.goto("/#/mentees");
  await expect(
    page.getByRole("heading", { level: 1, name: "Mentees" }),
  ).toBeVisible();
  await expect(page.getByText("2 mentorships need your action")).toBeVisible();
  const advisoryRow = page
    .locator(".collaboration-row")
    .filter({ hasText: "AdvisoryFounder" });
  await expect(advisoryRow).toContainText(
    /Waiting for AdvisoryFounder.* to propose a check-in time/,
  );
  await expect(advisoryRow.getByRole("button")).toHaveText(/^Open room/);
  // Within the Accepted group, the goal comes before the answer.
  const accepted = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Accepted" }) });
  await expect(accepted.locator(".collaboration-row h3")).toHaveText([
    /SessionFounder/,
    /QuickFounder/,
  ]);
  const sessionButton = accepted.getByRole("button", { name: /Confirm goal/ });
  await expect(sessionButton).toHaveClass(/primary/);
  await expect(page.locator(".collaboration-row .btn.primary")).toHaveCount(1);
  await shot(page, "mentor-mentees-page");
  await accepted.getByRole("button", { name: /Deliver answer/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/rooms/${quick.id}`));
  await expect(
    page.getByRole("tabpanel").getByLabel("Write your response"),
  ).toBeVisible();

  // The founder side keeps its own next step.
  const founderPage = await page.context().newPage();
  await open(founderPage, advisory.founder);
  const founderNext = nextCard(founderPage);
  await expect(founderNext).toBeVisible();
  await expect(
    founderPage.getByRole("region", { name: "Startups you can help" }),
  ).toHaveCount(0);
  await shot(founderPage, "founder-home");
  await founderNext.getByRole("button").click();
  await expect(founderPage).toHaveURL(new RegExp(`#/rooms/${advisory.id}`));
});
