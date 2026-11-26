// The founder's Requests page: Incoming, Outgoing and History tabs, each
// request dated, with search and date and collaborator-type filters.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  command,
  founderProfile,
  open,
  user,
} from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { selectValue } from "./ui-helpers.js";

const mentorProfile = {
  bio: "Product mentor for student teams.",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech student tools",
};
const partnerProfile = {
  ...founderProfile,
  offer: founderProfile.need,
  need: founderProfile.offer,
};

test("Requests splits incoming, outgoing and past requests into tabs that search and filter", async ({
  page,
  request,
}) => {
  const founder = await user(request, "RequestsBoard");
  const founderId = `${founder.state.accountId}:founder`;
  // Incoming: another founder asks to work together.
  const asker = await user(request, "IncomingPeer", partnerProfile);
  await command(request, asker, { action: "interest", id: founderId });
  // Outgoing: a request to a founder and a mentorship request to a mentor.
  const invited = await user(request, "OutgoingPeer", partnerProfile);
  await command(request, founder, {
    action: "interest",
    id: `${invited.state.accountId}:founder`,
  });
  const mentor = await user(request, "OutgoingMentor", mentorProfile, "mentor");
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  // History: a request the founder declined.
  const declined = await user(request, "DeclinedPeer", partnerProfile);
  await command(request, declined, { action: "interest", id: founderId });
  await command(request, founder, {
    action: "decline-interest",
    id: `${declined.state.accountId}:founder`,
    values: { reason: "Not the right time" },
  });

  await open(page, founder, "waiting");
  await expect(
    page.getByRole("heading", { name: "Requests", exact: true }),
  ).toBeVisible();
  const tab = (name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
  const panel = page.getByRole("tabpanel");
  // Opens where a reply is due, with a count on every tab.
  await expect(tab("Incoming")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Incoming")).toHaveText("Incoming1");
  await expect(tab("Outgoing")).toHaveText("Outgoing2");
  await expect(tab("History")).toHaveText("History1");
  await expect(
    panel.getByRole("heading", { name: "IncomingPeer Audit", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".introduction-timing")).toHaveText(
    /^Received \w{3} \d{1,2}, \d{4} · expires in 14 days$/,
  );

  // Arrow keys move between tabs.
  await tab("Incoming").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("Outgoing")).toBeFocused();
  await expect(tab("Outgoing")).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByRole("heading", { name: "OutgoingPeer Audit", exact: true }),
  ).toBeVisible();
  const mentorCard = panel.locator(".mentor-request-card");
  await expect(mentorCard).toContainText("OutgoingMentor Audit");
  await expect(mentorCard.locator(".introduction-timing")).toHaveText(
    /^Sent \w{3} \d{1,2}, \d{4}$/,
  );

  // Type: mentors only, then startup founders only.
  const type = page.getByRole("combobox", { name: "Collaborator type" });
  await selectValue(type, "mentor");
  await expect(tab("Outgoing")).toHaveText("Outgoing1");
  await expect(tab("Incoming")).toHaveText("Incoming0");
  await expect(mentorCard).toBeVisible();
  await expect(panel.locator(".introduction-row")).toHaveCount(0);
  await selectValue(type, "startup");
  await expect(mentorCard).toHaveCount(0);
  await expect(panel.locator(".introduction-row")).toHaveCount(1);

  // Search by name, and clear everything when nothing matches.
  await page.getByRole("searchbox", { name: "Search requests" }).fill("zzz");
  await expect(panel).toContainText("No requests match these filters.");
  await panel.getByRole("button", { name: "Clear filters" }).click();
  await expect(tab("Outgoing")).toHaveText("Outgoing2");
  await page
    .getByRole("searchbox", { name: "Search requests" })
    .fill("outgoingmentor");
  await expect(tab("Outgoing")).toHaveText("Outgoing1");
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Date: everything here was sent today, so it is within the last 7 days.
  await selectValue(page.getByRole("combobox", { name: "Date sent" }), "7");
  await expect(tab("Outgoing")).toHaveText("Outgoing2");
  await page.getByRole("button", { name: "Clear filters" }).click();

  // History: who, which way, when it was sent and closed, and the outcome.
  await tab("History").click();
  const past = panel.locator(".requests-history-row");
  await expect(past).toHaveCount(1);
  await expect(past).toContainText("DeclinedPeer Audit");
  await expect(past).toContainText("Startup founder · Sent to you");
  await expect(past).toContainText(/Requested \w{3} \d{1,2}, \d{4}/);
  await expect(past).toContainText(/Closed \w{3} \d{1,2}, \d{4}/);
  await expect(past.locator(".activity-status")).toHaveText("Declined");

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
  ).toEqual([]);
});
