import { selectValue, confirmSignOut } from "./ui-helpers.js";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
});

test("login validation highlights fields and keeps password guidance accessible", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/login")) requests++;
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".toast-error")).toContainText("Couldn't sign in");
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "aria-describedby",
    /demo-password-help.*login-form-error-password/,
  );
  expect(requests).toBe(0);
  await page.getByLabel("Email address").fill("person@example.com");
  await expect(page.getByLabel("Email address")).not.toHaveAttribute(
    "aria-invalid",
  );
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.getByLabel("Password", { exact: true }).fill("a-password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "demo-password-help",
  );
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});

test("wrong credentials remain visible until dismissed and support repeat attempts", async ({
  page,
}) => {
  await page.clock.install();
  await page.getByLabel("Email address").fill("missing-account@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  const toast = page.locator(".toast-error");
  await submit.click();
  await expect(toast).toContainText("Email or password is incorrect.");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.clock.fastForward(6000);
  await submit.click();
  await expect(submit).toBeEnabled();
  await page.clock.fastForward(3000);
  await expect(toast).toBeVisible();
  await toast.hover();
  await page.clock.fastForward(30000);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toHaveValue(
    "missing-account@example.com",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "wrong-password",
  );
});

test("connection failures give actionable feedback and allow login to be retried", async ({
  page,
}) => {
  await page.route("**/api/login", (route) => route.abort());
  await page.getByLabel("Email address").fill("person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".toast-error")).toContainText(
    "Check your connection and try again.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "person@example.com",
  );
});

async function startSignIn(page, email = `account-${Date.now()}@example.com`) {
  email = email.replace("@", `-${Date.now()}@`);
  const created = await page.request.post("/api/signup", {
    data: {
      firstName: "Test",
      lastName: "User",
      email,
      password: "test1234",
      role: "founder",
    },
  });
  expect(created.ok()).toBe(true);
  const { token } = await created.json();
  await page.request.post("/api/logout", {
    data: {},
    headers: { Authorization: `Bearer ${token}` },
  });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return email;
}

async function signIn(page, email) {
  const address = await startSignIn(page, email);
  await expect(page.getByRole("heading", { name: /, Test$/ })).toBeVisible();
}

async function navigate(page, name) {
  if (name === "Profile") {
    await page.getByRole("button", { name: /^Open profile for / }).click();
    return;
  }
  const toggle = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await toggle.isVisible()) {
    await toggle.click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name, exact: true })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true })
      .click();
  }
}

async function fillProfile(page, { stage = "idea" } = {}) {
  await page.getByLabel("Your name").fill("Alex Rivera");
  await page
    .getByLabel("About me")
    .fill("Building a tool to help local communities.");
  await page.getByLabel("What I offer").fill("Product design and research");
  await page.getByLabel("What I need").fill("Feedback from early users");
  await page.getByLabel("Industry", { exact: true }).fill("Community tools");
  if (stage !== null)
    await selectValue(page.getByLabel("Stage", { exact: true }), stage);
  await page.getByLabel("Team size").fill("1");
}

test("fresh workspace has one setup action and no sample records", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Set up your profile", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Connect with someone to open a room", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Maria Santos|BudgetBuddy|Campus Grocer|David Park|Demo controls|Sample activity/,
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(".nav-count, .metric-card, .recommendation-row"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button"),
  ).toHaveCount(4);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Profile", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText("No updates yet.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#notification-panel")).toBeHidden();
  await navigate(page, "Matches");
  await expect(
    page.getByRole("heading", { name: "No matches yet" }),
  ).toBeVisible();
  await expect(page.locator(".match-card")).toHaveCount(0);
  await expect(page.getByLabel("Search matches", { exact: true })).toHaveCount(
    0,
  );
  await navigate(page, "Deal Rooms");
  await expect(
    page.getByRole("heading", { name: "No Deal Rooms yet" }),
  ).toBeVisible();
  await navigate(page, "Profile");
  await expect(
    page.getByRole("progressbar", {
      name: "Required profile details",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    page
      .getByRole("region", { name: "Collaboration history", exact: true })
      .getByRole("heading", {
        name: "Your collaboration story starts here",
        exact: true,
      }),
  ).toBeVisible();
});

test("blank profile fields, validation, saving and cancel work with user details", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  for (const name of [
    "About me",
    "What I offer",
    "What I need",
    "Industry",
    "Team size",
  ]) {
    await expect(page.getByLabel(name, { exact: true })).toHaveValue("");
  }
  await expect(page.getByLabel("Your name")).toHaveValue("Test User");
  await expect(page.getByLabel("Stage", { exact: true })).toHaveText(
    "Choose a stage",
  );
  await fillProfile(page);
  await page.getByLabel("About me").fill("   ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("About me is required.")).toBeVisible();
  await expect(page.locator(".toast-error")).toContainText(
    "Couldn't save your profile",
  );
  await page
    .getByLabel("About me")
    .fill("Building a tool to help local communities.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("progressbar", {
      name: "Required profile details",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".toast-success")).toContainText(
    "Your profile has been updated.",
  );
  await expect(
    page.getByText("Building a tool to help local communities."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("About me").fill("Unsaved change");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Unsaved change", { exact: true })).toHaveCount(
    0,
  );
  await navigate(page, "Home");
  await expect(page.getByRole("heading", { name: /, Alex$/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Find your next collaborator" }),
  ).toBeVisible();
  await expect(
    page.getByText("You updated your profile.", { exact: true }),
  ).toBeVisible();
});

test("custom profile selects retain native required validation and failed-save drafts", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  await fillProfile(page, { stage: null });
  let profileSaves = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/profile") &&
      request.postDataJSON()?.form === "profile-form"
    )
      profileSaves++;
  });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  const stage = page.getByRole("combobox", { name: "Stage", exact: true });
  await expect(stage).toBeFocused();
  await expect(stage).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Stage is required.", { exact: true }),
  ).toBeVisible();
  expect(profileSaves).toBe(0);
  await selectValue(stage, "idea");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("progressbar", {
      name: "Required profile details",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await selectValue(stage, "growth");
  await page.route("**/api/profile", (route) => route.abort());
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText(/We couldn't confirm this change was saved/),
  ).toBeVisible();
  await expect(stage).toHaveAttribute("value", "growth");
  await page.unroute("**/api/profile");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(stage).toHaveAttribute("value", "idea");
});

for (const role of ["founder", "mentor"]) {
  test(`signup as ${role} opens a clean account without simulated onboarding`, async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
    await page.getByLabel("First name").fill("Jamie");
    await page.getByLabel("Last name").fill("Lee");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`jamie-${role}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("testpassword");
    await selectValue(page.locator("#signup-role"), role);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: /, Jamie$/ })).toBeVisible();
    await page
      .getByRole("button", { name: "Set up your profile", exact: true })
      .click();
    await expect(page.getByLabel("Your name")).toHaveValue("Jamie Lee");
    await expect(page.getByLabel("About me")).toHaveValue("");
    if (role === "mentor") {
      await expect(page.getByLabel("Expertise areas")).toHaveValue("");
      await expect(page.getByLabel("Startups I want to help")).toHaveValue("");
    } else
      await expect(page.getByLabel("Industry", { exact: true })).toHaveValue(
        "",
      );
  });
}

test("signing in with another email clears the previous local account", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  await fillProfile(page);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out" })
    .click();
  await confirmSignOut(page);
  await signIn(page, "new@example.com");
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  await expect(page.getByLabel("Your name")).toHaveValue("Test User");
  await expect(page.getByLabel("About me")).toHaveValue("");
});

test("browser navigation, unavailable rooms and saved session refresh remain safe", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "Matches");
  await navigate(page, "Deal Rooms");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Matches", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Deal Rooms", exact: true }),
  ).toBeVisible();
  await page.goto("/#/rooms/founder-campus");
  await expect(
    page.getByRole("heading", { name: "Room unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View your rooms" }).click();
  await expect(
    page.getByRole("heading", { name: "No Deal Rooms yet" }),
  ).toBeVisible();
  await page.goto("/#/unknown");
  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
});

for (const width of [360, 768, 1024, 1440]) {
  test(`workspace navigation and empty states fit ${width}px screens`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const name of ["Matches", "Deal Rooms", "Profile", "Home"]) {
      await navigate(page, name);
      await expect(page.locator("main h1")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 360) {
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Workspace navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Workspace navigation" }),
      ).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Open navigation", exact: true }),
      ).toBeFocused();
    }
  });
}
