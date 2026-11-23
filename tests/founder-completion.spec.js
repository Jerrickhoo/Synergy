import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  pair,
  open,
  command,
  getState,
  finish,
  user,
  sharedTerms,
} from "./founder-browser-helpers.js";
test.setTimeout(60000);
const audit = async (page) => {
  await expect(page.locator(".saving-indicator")).toHaveCount(0);
  let previousColors;
  await expect
    .poll(
      async () => {
        const colors = await page
          .locator(".btn.primary:enabled")
          .evaluateAll((buttons) =>
            JSON.stringify(
              buttons.map((button) => getComputedStyle(button).backgroundColor),
            ),
          );
        const stable = colors === previousColors;
        previousColors = colors;
        return stable;
      },
      { intervals: [100, 150, 250] },
    )
    .toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) })),
  ).toEqual([]);
};
test("ongoing advisory exposes goals, fixed check-ins and blind cycle reviews", async ({
  page,
  request,
}) => {
  const a = await user(request, "CycleFounder");
  const b = await user(
    request,
    "CycleMentor",
    {
      bio: "Advising founders",
      offer: "Beta testers",
      need: "Focused questions",
      expertise: "Product feedback",
      startups: "EdTech idea stage",
    },
    "mentor",
  );
  await command(request, b, {
    form: "mentor-capacity",
    values: {
      maxMentees: 3,
      monthlyHours: 4,
      maxOpenAsync: 3,
      responseDays: 3,
      timeZone: "Asia/Manila",
      "format-ongoing-advisory": "on",
    },
  });
  await command(request, a, {
    action: "send-request",
    id: `${b.state.accountId}:mentor`,
    values: { ...mentorRequestValues, format: "ongoing-advisory" },
  });
  const id = (
    await command(request, b, {
      action: "accept-request",
      id: `${a.state.accountId}:founder`,
    })
  ).state.activeRoomId;
  await command(request, b, { action: "confirm-goal", activeRoomId: id });
  await open(page, a, `rooms/${id}`);
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(
    page.getByRole("heading", { name: "Mentorship cycle 1" }),
  ).toBeVisible();
  await expect(page.getByText(/4 check-ins.*ends/)).toBeVisible();
  await audit(page);
  await command(request, b, {
    action: "end-mentorship",
    activeRoomId: id,
    values: { reason: "Cycle ended early." },
  });
  await page.reload();
  await page.getByRole("tab", { name: "Overview" }).click();
  // Each 1–5 scale is chosen explicitly; nothing defaults to 5.
  for (const label of ["Usefulness", "Clarity", "Responsiveness"])
    await page.getByLabel(label, { exact: true }).selectOption("4");
  await page.getByLabel("Cycle review note").fill("Helpful cycle");
  await page
    .getByRole("button", { name: "Submit private cycle review" })
    .click();
  await expect(page.getByText(/Your private rating/)).toBeVisible();
  expect(
    (await getState(request, b)).rooms[id].cycle.reviews[a.state.accountId],
  ).toBeUndefined();
  await command(request, b, {
    form: "cycle-review",
    activeRoomId: id,
    values: { rating: 5, note: "Good shared progress" },
  });
  await page.reload();
  await expect(page.getByText(/Good shared progress/)).toBeVisible();
  await audit(page);
});

test("audit surfaces support axe and keyboard task cards, milestone menus, dialogs and focus return", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request);
  await command(request, a, {
    form: "task-create",
    activeRoomId: id,
    values: { title: "Audit real task", status: "todo", priority: "normal" },
  });
  await open(page, a, `rooms/${id}`);
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  const optional = page.getByText("Task board · optional room tool", {
    exact: true,
  });
  await optional.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("button", {
    name: "Audit real task",
    exact: true,
  });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Task title", { exact: true })).toBeFocused();
  await audit(page);
  const cancel = page
    .locator(".task-editor")
    .getByRole("button", { name: "Cancel", exact: true });
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(card).toBeFocused();
  const status = page.getByRole("combobox", {
    name: "Status of Audit real task",
    exact: true,
  });
  await status.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("In progress");
  await audit(page);
  const milestone = page.locator(".milestone").first();
  const more = milestone.locator(".milestone-more > summary");
  await more.focus();
  await page.keyboard.press("Enter");
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(milestone.locator(".milestone-more")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.keyboard.press("Enter");
  const flag = milestone.getByRole("button", {
    name: "Flag a dispute",
    exact: true,
  });
  await flag.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(flag).toBeFocused();
  const later = page
    .locator(".milestone")
    .nth(1)
    .getByRole("button", { name: /^Mark as done/ });
  await later.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", {
      name: "Earlier milestones are not done yet",
      exact: true,
    }),
  ).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(later).toBeFocused();
  await page.locator(".room-more > summary").focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", {
    name: "Close this collaboration",
    exact: true,
  });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", {
      name: "Close this collaboration?",
      exact: true,
    }),
  ).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(close).toBeFocused();
  await page.goto("/#/settings");
  await audit(page);
  await page.goto("/#/updates");
  await expect(
    page.getByRole("heading", { name: "Your weekly digest", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".digest-matches a").count()).toBeGreaterThan(0);
  expect(await page.locator(".digest-matches a").count()).toBeLessThanOrEqual(
    3,
  );
  await expect(page.locator(".digest-matches a").first()).toHaveAttribute(
    "href",
    /^#\/matches\//,
  );
  await audit(page);
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Your description", { exact: true })
    .fill(
      "We are a 4-person team building student budgeting tools and need people to try our product.",
    );
  await page
    .getByRole("button", { name: "Suggest profile details", exact: true })
    .click();
  await audit(page);
  const c = await user(request, "IntroductionAudit");
  await command(request, c, {
    action: "interest",
    id: `${a.state.accountId}:founder`,
  });
  await page.goto("/#/waiting");
  await expect(page.getByText(/Needs your reply \(/)).toBeVisible();
  await audit(page);
  const decline = page.getByRole("button", { name: /^Decline / }).first();
  await decline.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(decline).toBeFocused();
  await finish(request, a, b, id);
  await page.goto(`/#/rooms/${id}/review`);
  await audit(page);
  await page
    .getByRole("button", { name: "Undo completion", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "What happens next" }),
  ).toBeVisible();
});

test("Deal Room keeps the next action visible on phones and reflows at 320px, 200% scale and contrast preferences", async ({
  page,
  request,
}, testInfo) => {
  const { a, id } = await pair(request);
  await open(page, a, `rooms/${id}`);
  mkdirSync("output/playwright/founder-audit", { recursive: true });
  const measurements = [];
  for (const [width, height] of [
    [390, 844],
    [360, 800],
    [320, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    const next = await page
      .getByRole("region", { name: "What happens next" })
      .boundingBox();
    expect(next.y + next.height).toBeLessThanOrEqual(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const rail = await page.locator(".stage-compact").boundingBox();
    expect(rail.height).toBeLessThanOrEqual(44);
    measurements.push({
      width,
      height,
      nextBottom: next.y + next.height,
      stageHeight: rail.height,
    });
    await page.screenshot({
      path: `output/playwright/founder-audit/${testInfo.project.name}-room-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  await page.screenshot({
    path: `output/playwright/founder-audit/${testInfo.project.name}-zoom.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await audit(page);
  await page.evaluate(() => (document.documentElement.style.zoom = ""));
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await audit(page);
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/founder-audit/${testInfo.project.name}-forced-colors.png`,
    fullPage: true,
  });
  writeFileSync(
    `output/playwright/founder-audit/${testInfo.project.name}-measurements.json`,
    JSON.stringify(measurements, null, 2),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const menu = page.getByRole("navigation", {
    name: "Mobile navigation",
    exact: true,
  });
  await expect(
    menu.getByRole("button", { name: "Calendar", exact: true }),
  ).toHaveCount(0);
  await expect(menu.getByRole("button")).toHaveCount(6);
});
