import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  user,
  open,
  command,
  founderProfile,
} from "./founder-browser-helpers.js";
test.use({ baseURL: "http://127.0.0.1:5185" });
test("unverified founders can browse and save but introduction controls direct them to verification", async ({
  page,
  request,
}) => {
  const a = await user(request, "VerificationAudit"),
    b = await user(request, "VerificationPeer", {
      ...founderProfile,
      offer: founderProfile.need,
      need: founderProfile.offer,
    });
  await open(page, a, "matches");
  await page.getByRole("tab", { name: "Browse all", exact: true }).click();
  const card = page.locator(
    `.match-card[aria-labelledby="match-name-${b.state.accountId}:founder"]`,
  );
  await expect(
    card.getByRole("button", {
      name: "Verify to send introductions",
      exact: true,
    }),
  ).toBeDisabled();
  await card.getByRole("button", { name: /^Save / }).click();
  await card.getByRole("button", { name: /View match/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Verify to send introductions",
      exact: true,
    }),
  ).toBeDisabled();
  const forbidden = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${a.token}` },
    data: {
      role: "founder",
      action: "interest",
      id: `${b.state.accountId}:founder`,
    },
  });
  expect(forbidden.status()).toBe(403);
  await page
    .getByRole("link", { name: "Go to Verification", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verification", exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Program, organization or person")
    .fill("University referral");
  await page
    .getByLabel("How can a moderator check it?")
    .fill("Coordinator can check our cohort roster");
  await page
    .getByRole("button", { name: "Request verification", exact: true })
    .click();
  await expect(
    page.getByText(
      "A moderator is checking your evidence. You can keep browsing and saving matches in the meantime.",
      { exact: true },
    ),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
  ).toEqual([]);
  await page.goto("/#/");
  await expect(
    page.getByText(
      "A moderator is checking your evidence. You can keep browsing and saving matches in the meantime.",
      { exact: true },
    ),
  ).toBeVisible();
  // TEMPORARY demo shortcut (SYNERGY_SIMULATE_VERIFICATION).
  await page.goto("/#/profile");
  await page
    .getByRole("button", { name: "Simulate approval", exact: true })
    .click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  const allowed = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${a.token}` },
    data: {
      role: "founder",
      action: "interest",
      id: `${b.state.accountId}:founder`,
    },
  });
  expect(allowed.ok()).toBe(true);
});
