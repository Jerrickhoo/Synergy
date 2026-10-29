import { test, expect } from "@playwright/test";

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
  await expect(page.getByLabel("Prototype role")).toHaveValue("founder");
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
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
  await page.getByLabel("Prototype role").selectOption("mentor");
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
