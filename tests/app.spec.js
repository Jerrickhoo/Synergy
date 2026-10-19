import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/");
});

async function signIn(page, email = "alex@example.com") {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Synergy" }),
  ).toBeVisible();
}

async function navigate(page, name) {
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

async function fillProfile(page) {
  await page.getByLabel("Your name").fill("Alex Rivera");
  await page
    .getByLabel("About me")
    .fill("Building a tool to help local communities.");
  await page.getByLabel("What I offer").fill("Product design and research");
  await page.getByLabel("What I need").fill("Feedback from early users");
  await page.getByLabel("Industry", { exact: true }).fill("Community tools");
  await page.getByLabel("Stage", { exact: true }).selectOption("idea");
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
    page.getByText("No collaborations yet.", { exact: false }),
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
  await navigate(page, "Rooms");
  await expect(
    page.getByRole("heading", { name: "No rooms yet" }),
  ).toBeVisible();
  await navigate(page, "Profile");
  await expect(page.getByText("0% complete", { exact: true })).toBeVisible();
  await page.getByText("Collaboration history (0)", { exact: true }).click();
  await expect(
    page.getByText("No completed collaborations or reviews yet."),
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
    "Your name",
    "About me",
    "What I offer",
    "What I need",
    "Industry",
    "Team size",
  ]) {
    await expect(page.getByLabel(name, { exact: true })).toHaveValue("");
  }
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue("");
  await fillProfile(page);
  await page.getByLabel("About me").fill("   ");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("About me is required.")).toBeVisible();
  await page
    .getByLabel("About me")
    .fill("Building a tool to help local communities.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("100% complete", { exact: true })).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your profile is ready" }),
  ).toBeVisible();
  await expect(
    page.getByText("You updated your profile.", { exact: true }),
  ).toBeVisible();
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
    await page.getByLabel("Email", { exact: true }).fill("jamie@example.com");
    await page.getByLabel("Password", { exact: true }).fill("testpassword");
    await page.locator("#signup-role").selectOption(role);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Jamie" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Set up your profile", exact: true })
      .click();
    await expect(page.getByLabel("Your name")).toHaveValue("Jamie Lee");
    await expect(page.getByLabel("About me")).toHaveValue("");
    if (role === "mentor") {
      await expect(page.getByLabel("Expertise areas")).toHaveValue("");
      await expect(page.getByLabel("Availability")).toHaveValue("");
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
  await signIn(page, "new@example.com");
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await expect(page.getByLabel("About me")).toHaveValue("");
});

test("browser navigation, unavailable rooms and session refresh remain safe", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "Matches");
  await navigate(page, "Rooms");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Matches", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Rooms", exact: true }),
  ).toBeVisible();
  await page.goto("/#/rooms/founder-campus");
  await expect(
    page.getByRole("heading", { name: "Room unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View your rooms" }).click();
  await expect(
    page.getByRole("heading", { name: "No rooms yet" }),
  ).toBeVisible();
  await page.goto("/#/unknown");
  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
});

for (const width of [360, 768, 1024, 1440]) {
  test(`workspace navigation and empty states fit ${width}px screens`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const name of ["Matches", "Rooms", "Profile", "Home"]) {
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
