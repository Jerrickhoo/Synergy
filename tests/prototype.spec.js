import { selectValue, confirmSignOut } from "./ui-helpers.js";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { decode } from "../src/state/serialization.js";

test("prototype discovery preserves filters, sort, saved profiles and image fallbacks", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("About role previews", { exact: true }).click();
  await expect(
    page.getByText(
      "Role previews are for browsing sample profiles. Preview accounts cannot connect with each other.",
    ),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("directory review");
  await page.getByLabel("Password", { exact: true }).fill("preview");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Matches", exact: true })
    .click();
  await page.getByRole("tab", { name: "Browse all", exact: true }).click();
  await expect(page.locator(".match-card")).toHaveCount(12);
  const image = page.locator(".match-card .avatar img").first();
  await expect(image).toBeVisible();
  const source = await image.getAttribute("src");
  const imageCardName = await image
    .locator("xpath=ancestor::article")
    .getByRole("heading")
    .innerText();
  expect(await image.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(
    true,
  );
  const noImage = page
    .locator(".match-card")
    .filter({ hasNot: page.locator(".avatar img") });
  expect(await noImage.count()).toBeGreaterThan(0);
  await page.route(`**${source}`, (route) => route.abort());
  await page.reload();
  await page.getByRole("tab", { name: "Browse all", exact: true }).click();
  const failedCard = page.locator(".match-card").filter({
    has: page.getByRole("heading", { name: imageCardName, exact: true }),
  });
  await expect(failedCard.locator(".avatar img")).toHaveCount(0);
  await expect(failedCard.locator(".avatar-default")).toBeVisible();
  const sort = page.getByRole("combobox", { name: "Sort by", exact: true });
  await sort.click();
  await expect(page.getByRole("listbox", { name: "Sort by" })).toBeVisible();
  await page.getByRole("option", { name: "Highest fit", exact: true }).click();
  const scores = await page
    .locator(".match-card .fit-ring strong")
    .allTextContents();
  expect(scores.map(parseFloat)).toEqual(
    scores.map(parseFloat).sort((a, b) => b - a),
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(sort).toHaveText("Highest fit");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await sort.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await expect(sort).toHaveText("Highest fit");
  await page.keyboard.press("Enter");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(sort).toHaveText("Completed collaborations");
  await sort.click();
  await page.keyboard.press("n");
  await page.keyboard.press("Enter");
  await expect(sort).toHaveText("Name");
  const names = await page.locator(".match-card h3").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await sort.click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(sort).not.toBeFocused();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await selectValue(page.getByLabel("Filter by type"), "Mentor");
  await page.getByRole("button", { name: "Show matches", exact: true }).click();
  await expect(page.locator(".match-card")).toHaveCount(10);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Filter by type")).toHaveText("Mentors");
  await selectValue(page.getByLabel("Filter by type"), "Startup");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await expect(page.locator(".match-card")).toHaveCount(10);
  const first = page.locator(".match-card").first();
  const why = first.getByRole("button", { name: /Why this match/ });
  await why.click();
  await page.keyboard.press("Escape");
  await expect(why).toBeFocused();
  const savedName = await first.getByRole("heading").innerText();
  await first.getByRole("button", { name: /^Save (?!for later)/ }).click();
  await page.getByRole("tab", { name: /^Saved/ }).click();
  await expect(
    page.getByRole("heading", { name: savedName, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /^Saved/ }).click();
  await expect(
    page.getByRole("heading", { name: savedName, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Search matches", { exact: true })
    .fill("nonexistent-profile-release-check");
  await expect(
    page.getByRole("heading", { name: "No matches found", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "How the score works", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "How the score works", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "How the score works", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/phase6/${testInfo.project.name}-directory-${width}.png`,
      fullPage: true,
    });
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("stakeholders can sign in with any credentials and choose their prototype role", async ({
  page,
}, testInfo) => {
  const externalRequests = [];
  const demoRequests = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/demo"))
      demoRequests.push(request.postDataJSON());
    if (
      new URL(request.url()).origin !==
      new URL(testInfo.project.use.baseURL).origin
    )
      externalRequests.push(request.url());
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
  await expect(page.getByLabel("Prototype role")).toHaveText("Founder");
  await page.screenshot({
    path: testInfo.outputPath("welcome.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const selector = await page.getByLabel("Prototype role").boundingBox();
  expect(selector.x + selector.width / 2).toBeGreaterThan(180);
  expect(selector.x + selector.width).toBeLessThanOrEqual(360);
  expect(selector.y + selector.height).toBeGreaterThan(850);
  await page.screenshot({
    path: testInfo.outputPath("welcome-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#app-shell")).toHaveCount(0);
  await page.getByLabel("Email address").fill("anything at all");
  await page.getByLabel("Password", { exact: true }).fill("x");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#app-shell")).toBeVisible();
  await expect(page.locator("#login-shell")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("home-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const founderSession = await page.evaluate(() =>
    sessionStorage.getItem("synergy-session"),
  );
  expect(founderSession).toBeTruthy();
  await page.reload();
  await expect(page.locator("#app-shell")).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("synergy-session")),
  ).toBe(founderSession);
  await page.goto("/#/profile");
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send verification code" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("profile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await confirmSignOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
  await selectValue(page.getByLabel("Prototype role"), "mentor");
  await page.getByLabel("Email address").fill("another pretend login");
  await page.getByLabel("Password", { exact: true }).fill("?");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#app-shell")).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("synergy-session")),
  ).not.toBe(founderSession);
  const account = await page.evaluate(async () => {
    const response = await fetch("/api/state", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("synergy-session")}`,
      },
    });
    return response.json();
  });
  expect(account.state.role).toBe("mentor");
  expect(account.state.integrations.demoMode).toBe(true);
  await page.goto("/#/settings");
  await page.locator("#danger-zone > summary").click();
  await expect(
    page.getByRole("heading", { name: "Profile visibility" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Change email" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sign out other sessions" }).click();
  await page
    .getByRole("button", { name: "Confirm session sign-out", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText(
    "Account settings updated",
  );
  await page.getByText("Delete my account", { exact: true }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(demoRequests).toEqual([{ role: "founder" }, { role: "mentor" }]);
});

for (const role of ["founder", "mentor"])
  test(`fictional ${role} introductions can simulate acceptance once without partner confirmations`, async ({
    page,
    request,
  }) => {
    const response = await request.post("/api/demo", { data: { role } });
    const user = decode(await response.text());
    const person =
      user.state.directory[role === "founder" ? "mentors" : "founders"][0];
    const headers = { Authorization: `Bearer ${user.token}` };
    const command = { role, action: "simulate-acceptance", id: person.id };
    const notPending = await request.post("/api/action", {
      headers,
      data: command,
    });
    expect(notPending.status()).toBe(409);
    await page.goto("/");
    await page.evaluate(
      (token) => sessionStorage.setItem("synergy-session", token),
      user.token,
    );
    await page.goto(
      `/?review=${Date.now()}#/matches/${encodeURIComponent(person.id)}`,
    );
    await page
      .getByRole("button", { name: "Send introduction", exact: true })
      .click();
    const introduction = page.locator(".introduction-row").filter({
      has: page.getByRole("heading", { name: person.name, exact: true }),
    });
    await expect(introduction).toContainText("Prototype only");
    await introduction
      .getByRole("button", {
        name: `Simulate acceptance from ${person.name}`,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/#\/rooms\//);
    await expect(
      page.getByRole("tab", { name: "Terms", exact: true }),
    ).toBeVisible();
    const stateResponse = await request.get("/api/state", { headers });
    const state = decode(await stateResponse.text()).state;
    const room = Object.values(state.rooms)[0];
    expect(Object.keys(state.rooms)).toHaveLength(1);
    expect(room.terms.locked).toBe(false);
    expect(room.terms.partnerLocked).toBe(false);
    for (const action of ["demo-partner-confirm", "demo-partner-review"]) {
      const denied = await request.post("/api/action", {
        headers,
        data: { role, action, activeRoomId: room.id, id: "session" },
      });
      expect(denied.status()).toBe(400);
    }
    const duplicate = await request.post("/api/action", {
      headers,
      data: command,
    });
    expect(
      Object.keys(decode(await duplicate.text()).state.rooms),
    ).toHaveLength(1);
    await page.reload();
    await expect(page).toHaveURL(/#\/rooms\//);
    await page.goto("/#/waiting");
    await expect(
      page.getByText(
        role === "mentor"
          ? "No pending requests."
          : "No pending introductions.",
        { exact: false },
      ),
    ).toBeVisible();
    await page.goto("/#/");
    await expect(
      page.getByRole("button", { name: /^Active Deal Rooms/ }),
    ).toContainText("1");
    await page.goto("/#/updates");
    await expect(
      page.getByText(
        `${person.name} accepted your introduction. Your room is ready.`,
        { exact: true },
      ),
    ).toBeVisible();
  });
