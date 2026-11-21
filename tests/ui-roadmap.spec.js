import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { decode } from "../src/state/serialization.js";
import { selectValue } from "./ui-helpers.js";

const profiles = {
  founder: {
    bio: "A complete startup description with enough detail to wrap over several lines. We build student products and work on onboarding. ".repeat(
      4,
    ),
    offer: "Product feedback, Beta testing",
    need: "Product strategy, Technical development",
    industry: "EdTech",
    stage: "idea",
    teamSize: "3",
  },
  mentor: {
    bio: "Mentoring startup teams through focused product conversations. ".repeat(
      5,
    ),
    offer: "Product strategy, Technical development",
    need: "Product feedback",
    expertise: "Product strategy",
    availability: "Weekly",
    startups: "EdTech idea teams",
  },
};
async function account(request, role, prefix = "Roadmap") {
  const response = await request.post("/api/signup", {
    data: {
      firstName: prefix,
      lastName: "Reviewer",
      email: `${prefix}-${role}-${Date.now()}-${Math.random()}@example.com`,
      password: "private-password",
      role,
    },
  });
  expect(response.ok()).toBeTruthy();
  const user = decode(await response.text());
  await action(request, user, { form: "profile-form", values: profiles[role] });
  // New mentors accept the guidelines before taking requests.
  if (role === "mentor")
    await action(request, user, {
      form: "accept-guidelines",
      values: { version: 2 },
    });
  return user;
}
async function action(request, user, command) {
  const response = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { role: user.state.role, ...command },
  });
  expect(response.ok()).toBeTruthy();
  return decode(await response.text());
}
async function open(page, user, route = "profile") {
  await page.goto("/");
  await page.evaluate(
    (token) => sessionStorage.setItem("synergy-session", token),
    user.token,
  );
  await page.goto(`/?review=${Date.now()}#/${route}`);
  await expect(page.locator(".account-button")).toBeVisible();
}
async function saved(request, user) {
  const response = await request.get("/api/state", {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  return decode(await response.text()).state;
}
// Let entrance animations settle so layout and contrast are measured at rest.
const settled = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
async function accessible(page) {
  await settled(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}
const noOverflow = async (page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);

test("first visit ignores OS dark mode and explicit theme survives refresh and sign-out", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const user = await account(request, "founder", "Theme");
  await open(page, user, "settings");
  await selectValue(
    page.getByRole("combobox", { name: "Color theme" }),
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveText(
    "Dark",
  );
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Keep working", exact: true }),
  ).toBeFocused();
  await accessible(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await accessible(page);
});

for (const role of ["founder", "mentor"])
  test(`${role} profile text and photo remain drafts through Enter, errors, cancel and refresh until explicit save`, async ({
    page,
    request,
  }) => {
    const user = await account(request, role, `Photo${role}`);
    await open(page, user);
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    let saves = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/profile")) saves++;
    });
    const name = page.getByLabel("Your name", { exact: true });
    await name.fill("Unpublished name");
    await name.press("Enter");
    await name.blur();
    expect(saves).toBe(0);
    expect((await saved(request, user)).accountName).not.toBe(
      "Unpublished name",
    );
    const bio = page.getByLabel("About me", { exact: true });
    await bio.fill("Private draft");
    await bio.press("End");
    await bio.press("Enter");
    await bio.press("B");
    await expect(bio).toHaveValue("Private draft\nB");
    expect(saves).toBe(0);
    const chooser = page.getByLabel("Choose profile photo", { exact: true });
    await chooser.setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "Choose a JPEG" }),
    ).toBeVisible();
    await chooser.setInputFiles({
      name: "big.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "up to 5 MB" }),
    ).toBeVisible();
    await chooser.setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("broken"),
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "could not be opened" }),
    ).toBeVisible();
    const buffer = await sharp({
      create: { width: 48, height: 48, channels: 3, background: "#245e49" },
    })
      .png()
      .toBuffer();
    await chooser.setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer,
    });
    await expect(page.locator(".profile-photo-editor img")).toBeVisible();
    expect((await saved(request, user)).profiles[role].image || "").toBe("");
    await page.reload();
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await expect(page.locator(".profile-photo-editor img")).toBeVisible();
    await expect(name).toHaveValue("Unpublished name");
    await page.route("**/api/profile", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary save failure" }),
      }),
    );
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.locator('#profile-form [data-error-scope="profile-form"]'),
    ).toContainText("Temporary save failure");
    await expect(bio).toHaveValue("Private draft\nB");
    await expect(page.locator(".profile-photo-editor img")).toBeVisible();
    await page.unroute("**/api/profile");
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Edit profile", exact: true }),
    ).toBeVisible();
    const image = (await saved(request, user)).profiles[role].image;
    expect(image).toMatch(/^\/api\/avatars\//);
    await expect(page.locator(".account-button .avatar img")).toBeVisible();
    await page.reload();
    await expect(page.locator(".own-identity-panel .avatar img")).toBeVisible();
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    const replacement = await sharp({
      create: { width: 24, height: 24, channels: 3, background: "#305d87" },
    })
      .jpeg()
      .toBuffer();
    await chooser.setInputFiles({
      name: "replacement.jpg",
      mimeType: "image/jpeg",
      buffer: replacement,
    });
    await expect(page.locator(".profile-photo-editor img")).toHaveAttribute(
      "src",
      /^data:image\//,
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await saved(request, user)).profiles[role].image).toBe(image);
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    await expect(page.locator(".profile-photo-editor img")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await saved(request, user)).profiles[role].image).toBe(image);
    await expect(page.locator(".own-identity-panel .avatar img")).toBeVisible();
    await page.route("**/api/avatars/*", (route) => route.abort());
    await page.reload();
    await expect(page.locator(".own-identity-panel .avatar img")).toHaveCount(
      0,
    );
    await expect(
      page.locator(".own-identity-panel .avatar-default"),
    ).toBeVisible();
    await page.unroute("**/api/avatars/*");
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit profile", exact: true }),
    ).toBeVisible();
    expect((await saved(request, user)).profiles[role].image).toBe("");
  });

test("role switching, Danger zone and both visibility directions require the intended explicit controls", async ({
  page,
  request,
}) => {
  const user = await account(request, "founder", "Switch");
  await open(page, user, "settings");
  await expect(page.locator("#danger-zone")).not.toHaveAttribute("open");
  await expect(
    page.getByRole("button", { name: "Pause discovery", exact: true }),
  ).not.toBeVisible();
  const roles = page.getByRole("combobox", { name: "Active profile" });
  await selectValue(roles, "founder");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await selectValue(roles, "mentor");
  const dialog = page.getByRole("dialog", { name: "Switch active profile?" });
  await expect(dialog).toContainText("Startup founder");
  await expect(dialog).toContainText("Mentor");
  expect((await saved(request, user)).role).toBe("founder");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(roles).toHaveText("Startup founder");
  await selectValue(roles, "mentor");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(request, user)).role).toBe("founder");
  await selectValue(roles, "mentor");
  await dialog
    .getByRole("button", { name: "Switch profile", exact: true })
    .click();
  await expect(roles).toHaveText("Mentor");
  const danger = page.locator("#danger-zone");
  await danger.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(danger).toHaveAttribute("open", "");
  await expect(
    danger.getByRole("heading", { name: "Profile visibility" }),
  ).toHaveCount(1);
  await danger
    .getByRole("button", { name: "Pause discovery", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Pause discovery?" })
    .getByRole("button", { name: "Pause discovery", exact: true })
    .click();
  await expect(danger).toContainText("Both profiles are hidden");
  await danger
    .getByRole("button", { name: "Resume discovery", exact: true })
    .click();
  await expect(danger).toContainText("Your completed profiles are visible");
});

test("exact fit draft Apply/Reset, clamped cards, saved synchronization and separate reporting work", async ({
  page,
  request,
}) => {
  const user = await account(request, "founder", "Filters");
  const peer = await account(request, "founder", "FilterPeer");
  await open(page, user, "matches");
  await page.getByRole("tab", { name: "Browse all", exact: true }).click();
  for (const threshold of [0, 1, 49, 99, 100]) {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page
      .getByRole("spinbutton", { name: "Minimum fit (%)" })
      .fill(String(threshold));
    await page
      .getByRole("button", { name: "Show matches", exact: true })
      .click();
    for (const score of await page
      .locator(".match-card .fit-ring strong")
      .allTextContents())
      expect(parseFloat(score)).toBeGreaterThanOrEqual(threshold);
  }
  await page.getByRole("button", { name: /^Filters/ }).click();
  const fit = page.getByRole("spinbutton", { name: "Minimum fit (%)" });
  for (const invalid of ["-1", "101", "49.5"]) {
    await fit.fill(invalid);
    await expect(
      page.getByRole("button", { name: "Show matches", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("alert").filter({ hasText: "whole percentage" }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(fit).toHaveValue("0");
  await fit.fill("");
  await fit.press("1");
  await fit.press("e");
  await expect(
    page.getByRole("button", { name: "Show matches", exact: true }),
  ).toBeDisabled();
  await fit.fill("");
  await page.getByRole("button", { name: "Show matches", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search matches" })
    .fill("FilterPeer");
  const card = page
    .locator(".match-card")
    .filter({ hasText: "FilterPeer" })
    .first();
  await expect(card).toBeVisible();
  const summary = card.locator(".preview-summary");
  expect(
    await summary.evaluate(
      (el) =>
        el.getBoundingClientRect().height <=
        parseFloat(getComputedStyle(el).lineHeight) * 2 + 1,
    ),
  ).toBe(true);
  await card.getByRole("button", { name: /^Save (?!for later)/ }).click();
  await expect(
    card.getByRole("button", {
      name: /^Remove .* from saved matches$/,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /^View match/ }).click();
  await expect(page.locator(".identity-summary")).toHaveText(
    profiles.founder.bio.trim(),
  );
  await expect(
    page.getByRole("button", { name: "Saved for later", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Safety and privacy", { exact: true }).click();
  await page
    .getByRole("button", { name: "Report collaborator", exact: true })
    .click();
  const report = page.getByRole("dialog", { name: /Report FilterPeer/ });
  let reports = 0;
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/action") &&
      r.postDataJSON()?.form === "report-form"
    )
      reports++;
  });
  await report.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(reports).toBe(0);
  await page
    .getByRole("button", { name: "Report collaborator", exact: true })
    .click();
  await report
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  expect(reports).toBe(0);
  await selectValue(
    report.getByRole("combobox", { name: "Reason", exact: true }),
    "Spam or scam",
  );
  await report
    .getByLabel("Details (optional)")
    .fill("Please review this profile.");
  await page.route("**/api/action", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unavailable" }),
    }),
  );
  await report
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(report.getByRole("alert")).toContainText("not submitted");
  await expect(report.getByLabel("Details (optional)")).toHaveValue(
    "Please review this profile.",
  );
  await page.unroute("**/api/action");
  await report
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(report.getByRole("status")).toContainText(
    "saved for moderator review",
  );
  await report.getByRole("button", { name: "Done", exact: true }).click();
  const settings = await request.get("/api/account", {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(decode(await settings.text()).blocked).toHaveLength(0);
  await page.getByText("Block this collaborator", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Block and close unfinished rooms",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#/");
  await page.getByRole("button", { name: /^Saved matches/ }).click();
  await expect(page.getByRole("tab", { name: /^Saved/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.reload();
  await page.getByRole("tab", { name: /^Saved/ }).click();
  await expect(
    page.locator(".match-card").filter({ hasText: "FilterPeer" }),
  ).toHaveCount(1);
  expect(
    (await saved(request, user)).savedByRole.founder.has(
      `${peer.state.accountId}:founder`,
    ),
  ).toBe(true);
});

test("price filters are validated, counted as active and cleared by Clear filters", async ({
  page,
  request,
}) => {
  const user = await account(request, "founder", "PriceFilter");
  await account(request, "founder", "PricePeer");
  await open(page, user, "matches");
  await page.getByRole("tab", { name: "Browse all", exact: true }).click();
  const filters = page.getByRole("button", { name: /^Filters/ });
  const show = page.getByRole("button", { name: "Show matches", exact: true });
  await filters.click();
  const price = page.getByRole("spinbutton", { name: "Maximum price in PHP" });
  for (const invalid of ["-100", "-0.5"]) {
    await price.fill(invalid);
    await expect(price).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("alert").filter({
        hasText: "Enter a price of 0 or more, or leave it empty.",
      }),
    ).toBeVisible();
    await expect(show).toBeDisabled();
  }
  await price.fill("");
  await expect(price).toHaveAttribute("aria-invalid", "false");
  await expect(show).toBeEnabled();
  // Minimum fit is still validated alongside it.
  await page.getByRole("spinbutton", { name: "Minimum fit (%)" }).fill("101");
  await expect(show).toBeDisabled();
  await page.getByRole("spinbutton", { name: "Minimum fit (%)" }).fill("0");
  await price.fill("0");
  await page.getByLabel("Free only").check();
  await show.click();
  // Both price filters count, and the list offers Clear filters.
  await expect(filters).toHaveAccessibleName(/^Filters\s*2$/);
  await expect(
    page.getByRole("button", { name: "Clear filters", exact: true }).first(),
  ).toBeVisible();
  // A startup has no paid or free mentoring formats, so it is filtered out.
  await page
    .getByRole("searchbox", { name: "Search matches" })
    .fill("PricePeer");
  await expect(
    page.getByRole("heading", { name: "No matches found", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Closest profiles so far")).toHaveCount(0);
  await page
    .locator(".empty-state")
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(filters).toHaveAccessibleName(/^Filters$/);
  await page
    .getByRole("searchbox", { name: "Search matches" })
    .fill("PricePeer");
  await expect(
    page.locator(".match-card").filter({ hasText: "PricePeer" }).first(),
  ).toBeVisible();
  // Reset in the dialog clears the price filters too.
  await filters.click();
  await price.fill("5");
  await page.getByLabel("Free only").check();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(price).toHaveValue("");
  await expect(page.getByLabel("Free only")).not.toBeChecked();
});

const unreadLabel = (count) =>
  count ? `Notifications, ${count} unread` : "Notifications";
test("Updates actions keep read state, chronology and header counts synchronized through failures, preview and zoom", async ({
  page,
  request,
}) => {
  const user = await account(request, "founder", "UpdateActions");
  await action(request, user, {
    form: "notification-preferences",
    values: { match: "on", activity: "on", reminders: "on", digest: "off" },
  });
  for (const prefix of ["UpdatePartner", "UpdatePartnerTwo"]) {
    const partner = await account(request, "mentor", prefix);
    await action(request, partner, {
      form: "profile-form",
      values: {
        ...profiles.mentor,
        expertise: "Product strategy, Technical development",
      },
    });
  }
  await open(page, user, "updates");
  const initial = await saved(request, user);
  const item = initial.notifications.find(
    (notification) => notification.matchId && !notification.read,
  );
  expect(item).toBeTruthy();
  const unread = initial.notifications.filter(
    (notification) => !notification.read,
  ).length;
  const row = page
    .locator(".updates-page .update-row")
    .filter({ hasText: item.text })
    .first();
  const order = await page
    .locator(".updates-page .update-title")
    .allTextContents();
  const heading = await row.locator(".update-meta").boundingBox();
  const indicator = await row.locator(".update-read-state").boundingBox();
  expect(
    Math.abs(heading.x + heading.width - indicator.x - indicator.width),
  ).toBeLessThanOrEqual(1);
  await page.route("**/api/action", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Could not mark this update as read" }),
    }),
  );
  await row.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.locator(".toast-error")).toContainText(
    "Could not mark this update as read",
  );
  await expect(row).toHaveClass(/unread/);
  expect(
    (await saved(request, user)).notifications.find(
      (notification) => notification.id === item.id,
    ).read,
  ).toBe(false);
  await page.unroute("**/api/action");
  await row.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(row).toHaveClass(/\bread\b/);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: new RegExp(`^${unread - 1} unread update`) }),
  ).toBeVisible();
  expect(
    await page.locator(".updates-page .update-title").allTextContents(),
  ).toEqual(order);
  await expect(
    page.getByRole("button", { name: /^Notifications/ }),
  ).toHaveAttribute("aria-label", unreadLabel(unread - 1));
  await row.getByRole("button", { name: /^View match/ }).click();
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(item.matchId)));
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const preview = page.locator("#notification-panel");
  const compactRead = preview
    .getByRole("button", { name: "Mark as read", exact: true })
    .first();
  await compactRead.click();
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(item.matchId)));
  await expect(
    page.getByRole("button", { name: /^Notifications/ }),
  ).toHaveAttribute("aria-label", unreadLabel(unread - 2));
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.evaluate(() => {
    document.body.style.zoom = "2";
    window.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => {
      const bounds = await preview.boundingBox();
      const header = await page.locator(".topbar").boundingBox();
      return (
        bounds.y >= header.y + header.height &&
        bounds.x >= 0 &&
        bounds.x + bounds.width <= 769 &&
        bounds.y + bounds.height <= 1001
      );
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /^Notifications/ }),
  ).toBeFocused();
  await page.evaluate(() => {
    document.body.style.zoom = "";
  });
  await page.goto("/#/updates");
  await page.reload();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: new RegExp(`^${unread - 2} unread update`) }),
  ).toBeVisible();
});

for (const role of ["founder", "mentor"])
  test(`${role} surfaces remain accessible in both themes and fit 375, 768 and 1440 pixels`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120000);
    const user = await account(request, role, `Layout${role}`);
    const peer = await account(
      request,
      role === "founder" ? "mentor" : "founder",
      `LayoutPeer${role}`,
    );
    const matchId = `${peer.state.accountId}:${peer.state.role}`;
    const extra = await account(
      request,
      peer.state.role,
      `LayoutLongName${role}WithAdditionalContext`,
    );
    await action(request, extra, {
      form: "profile-form",
      values: {
        ...profiles[peer.state.role],
        bio: "A short introduction.",
        offer: "Product strategy",
      },
    });
    await action(request, user, {
      action: role === "founder" ? "send-request" : "interest",
      id: matchId,
      engagementType: "mentorship",
      values: role === "founder" ? mentorRequestValues : undefined,
    });
    const connected = await action(request, peer, {
      action: role === "founder" ? "accept-request" : "accept-interest",
      id: `${user.state.accountId}:${role}`,
    });
    const roomId = connected.state.activeRoomId;
    await action(request, role === "mentor" ? user : peer, {
      action: "confirm-goal",
      activeRoomId: roomId,
      values: { goal: "Review the onboarding experience" },
    });
    await action(request, user, {
      form: "schedule",
      activeRoomId: roomId,
      values: {
        date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        time: "10:00",
        timeZone: "UTC",
        durationMinutes: "60",
        count: "1",
      },
    });
    await open(page, user, "settings");
    mkdirSync("output/playwright", { recursive: true });
    for (const theme of ["light", "dark"]) {
      await page.goto("/#/settings");
      await selectValue(
        page.getByRole("combobox", { name: "Color theme" }),
        theme,
      );
      for (const route of [
        "",
        "matches",
        `matches/${matchId}`,
        "profile",
        "calendar",
        "updates",
        "settings",
        `rooms/${roomId}`,
      ]) {
        await page.goto(`/#/${route}`);
        await expect(page.locator(".page h1").first()).toBeVisible();
        if (route === "settings")
          await page.locator("#danger-zone > summary").click();
        await noOverflow(page);
        await accessible(page);
        if (route === "matches") {
          await page.getByRole("button", { name: /^Filters/ }).click();
          await accessible(page);
          await page.keyboard.press("Escape");
        }
        if (route === "profile") {
          await page
            .getByRole("button", { name: "Edit profile", exact: true })
            .click();
          await accessible(page);
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        if (route.startsWith("rooms/")) {
          for (const tab of ["Overview", "Schedule", "Action items", "Chat"]) {
            await page.getByRole("tab", { name: tab, exact: true }).click();
            await accessible(page);
          }
        }
      }
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto("/#/");
        await noOverflow(page);
        for (const detail of await page
          .locator(".workspace-metric .metric-detail")
          .all())
          await expect(detail).toBeVisible();
        await page.screenshot({
          path: `output/playwright/roadmap-${testInfo.project.name}-${role}-${theme}-${width}-home.png`,
          fullPage: true,
        });
        await page.goto("/#/matches");
        await page
          .getByRole("tab", { name: "Browse all", exact: true })
          .click();
        await noOverflow(page);
        if (width === 1440) {
          await settled(page);
          const actions = await page
            .locator(".match-card .preview-footer > .btn")
            .evaluateAll((buttons) =>
              buttons
                .slice(0, 2)
                .map((button) => button.getBoundingClientRect().bottom),
            );
          expect(actions).toHaveLength(2);
          expect(Math.abs(actions[0] - actions[1])).toBeLessThanOrEqual(2);
        }
        await page.getByRole("button", { name: /Notifications/ }).click();
        const panel = page.locator("#notification-panel");
        await expect(panel).toBeVisible();
        const header = await page.locator(".topbar").boundingBox();
        await expect
          .poll(async () => (await panel.boundingBox()).y)
          .toBeGreaterThanOrEqual(header.y + header.height + 6);
        const bounds = await panel.boundingBox();
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(961);
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: /Notifications/ }),
        ).toBeFocused();
        await page.goto(`/#/matches/${matchId}`);
        await page.getByText("Safety and privacy", { exact: true }).click();
        await noOverflow(page);
        await page.screenshot({
          path: `output/playwright/roadmap-${testInfo.project.name}-${role}-${theme}-${width}-match.png`,
          fullPage: true,
        });
        await page.goto(`/#/rooms/${roomId}`);
        await noOverflow(page);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  });
