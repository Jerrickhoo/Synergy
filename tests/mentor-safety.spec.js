import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { command, getState, open, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";

test("warning preserves a draft and acknowledged messages have a report shortcut", async ({
  page,
  request,
}) => {
  const founder = await user(request, "SafetyFounder");
  const mentor = await user(
    request,
    "SafetyMentor",
    {
      bio: "Advising student teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  const id = (
    await command(request, mentor, {
      action: "accept-request",
      id: `${founder.state.accountId}:founder`,
    })
  ).state.activeRoomId;
  await open(page, mentor, `rooms/${id}`);
  await page.getByRole("tab", { name: "Chat" }).click();
  const input = page.getByRole("textbox", { name: "Write a message" });
  const message = "Please pay me for my time with GCash.";
  await input.fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "Check your message" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(
    "Payments for mentorship must go through Synergy",
  );
  await warning.getByRole("button", { name: "Edit message" }).click();
  await expect(input).toHaveValue(message);
  expect((await getState(request, founder)).rooms[id].messages).toHaveLength(0);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await warning.getByRole("button", { name: "Send anyway" }).click();
  await expect(page.getByText(message, { exact: false })).toBeVisible();

  const recipient = await page.context().newPage();
  await open(recipient, founder, `rooms/${id}`);
  await recipient.getByRole("tab", { name: "Chat" }).click();
  await expect(
    recipient.getByRole("button", { name: "Report", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390, 360]) {
    await recipient.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        recipient.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
  }
  const result = await new AxeBuilder({ page: recipient })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
});
