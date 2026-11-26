import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  user,
  open,
  command,
  founderProfile,
} from "./founder-browser-helpers.js";
test.use({ baseURL: "http://127.0.0.1:5185" });
test("unverified founders can browse, and opening, saving or requesting asks them to verify first", async ({
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
  // Matches says it once, above the list, in the same large card as Home;
  // the cards don't repeat it.
  const notice = page.locator(".discovery-page > .home-next.is-verification");
  await expect(
    notice.getByRole("heading", {
      name: "Verify your account now to use Synergy to its full potential.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    notice.getByRole("button", { name: "Go to Verification" }),
  ).toBeVisible();
  await expect(card.locator(".verification-gate")).toHaveCount(0);
  // Saving asks to verify first and saves nothing.
  const save = card.getByRole("button", { name: /^Save / });
  await save.click();
  const prompt = page.getByRole("dialog", {
    name: "Verify your account",
    exact: true,
  });
  await expect(prompt).toContainText(
    "Verify your account now to use Synergy to its full potential.",
  );
  await expect(prompt).toContainText(
    "You need a verified account to save matches.",
  );
  await expect(
    prompt.getByRole("button", { name: "Go to Verification" }),
  ).toBeFocused();
  await prompt.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(save).toHaveAttribute("aria-pressed", "false");
  // Opening a match asks too, and stays on Matches.
  await card.getByRole("button", { name: /View match/ }).click();
  await expect(prompt).toContainText(
    "You need a verified account to view match profiles.",
  );
  await prompt.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(page).toHaveURL(/#\/matches$/);
  // A shared link still opens the profile; sending a request asks the same
  // way, instead of a disabled button.
  await page.goto(
    `/#/matches/${encodeURIComponent(`${b.state.accountId}:founder`)}`,
  );
  const send = page.getByRole("button", {
    name: "Send request",
    exact: true,
  });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(prompt).toContainText(
    "You need a verified account to send requests.",
  );
  const forbidden = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${a.token}` },
    data: {
      role: "founder",
      action: "interest",
      id: `${b.state.accountId}:founder`,
    },
  });
  expect(forbidden.status()).toBe(403);
  await prompt.getByRole("button", { name: "Go to Verification" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Verification", exact: true }),
  ).toBeFocused();
  // One short instruction, then the two questions and a button in the
  // logo's bright teal.
  await expect(
    page.getByText(
      "Tell us who can confirm you’re a founder, and a moderator will check it within three working days.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("#verification")).toHaveClass(/is-unverified/);
  await expect(
    page.getByRole("button", { name: "Request verification", exact: true }),
  ).toHaveClass(/verification-go/);
  await page.getByLabel("Who can vouch for you?").fill("University referral");
  await page
    .getByLabel("How can a moderator check it?")
    .fill("Coordinator can check our cohort roster");
  await page
    .getByRole("button", { name: "Request verification", exact: true })
    .click();
  // Sign out is never disabled (or repainted) while the request saves.
  await expect(page.locator(".sidebar-signout")).not.toHaveAttribute(
    "disabled",
  );
  const waiting =
    "Your request is waiting for a moderator. You can keep browsing matches in the meantime.";
  await expect(page.getByText(waiting, { exact: true })).toBeVisible();
  // Where the request stands: sent, then waiting for a moderator to open it.
  const progress = page.getByRole("list", { name: "Request progress" });
  await expect(progress.getByRole("listitem")).toHaveText([
    /Request sent/,
    /Seen by a moderator\s*Waiting/,
    /Approved\s*Not yet/,
  ]);
  await expect(progress.locator('[aria-current="step"]')).toContainText(
    "Seen by a moderator",
  );
  await expect(
    page.getByText(/^Verification request will expire in \d+ days?\.$/),
  ).toBeVisible();
  await expect(page.locator("#verification .verification-org")).toHaveText(
    "Vouched for by University referral",
  );
  // The demo shortcut is a plain disclaimer with its button, not a card.
  await expect(page.locator("#verification .prototype-acceptance")).toHaveCount(
    0,
  );
  await expect(page.locator(".verification-footer")).toContainText(
    "Prototype only:",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
  ).toEqual([]);
  await page.goto("/#/");
  await expect(page.getByText(waiting, { exact: true })).toBeVisible();
  // TEMPORARY demo shortcut (SYNERGY_SIMULATE_VERIFICATION).
  await page.goto("/#/profile");
  await page
    .getByRole("button", { name: "Simulate approval", exact: true })
    .click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  // Verified accounts carry the check on their photo and their profile.
  await expect(page.locator("#verification")).toHaveClass(/is-verified/);
  await expect(progress.locator("li.is-done")).toHaveCount(3);
  await expect(
    page.locator(".account-button .avatar.is-verified .avatar-check"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Open profile for .+, verified$/ }),
  ).toBeVisible();
  await expect(page.locator(".own-identity-verified")).toContainText(
    "Verified: University referral",
  );
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
