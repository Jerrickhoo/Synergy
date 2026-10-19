import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    if (message.type() === "error") throw new Error(message.text());
  });
  await page.goto("/");
});

async function signIn(page) {
  await page.getByLabel("Email address").fill("maria@example.com");
  await page.getByLabel("Password", { exact: true }).fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good morning, Maria Santos" }),
  ).toBeVisible();
}

async function navigate(page, label) {
  await page.locator(".nav").getByRole("button", { name: label }).click();
}

test("sign-in, password visibility, notifications and sign-out", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await signIn(page);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page.locator("#notification-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#notification-panel")).toBeHidden();
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
});

test("match searching, combined filters, bookmarks and keyboard tabs", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "Matches");
  await expect(page.locator(".match-card")).toHaveCount(3);
  const firstMatch = page.locator(".match-card").first();
  await firstMatch.getByRole("button", { name: "Why this match?" }).click();
  await expect(firstMatch.locator(".why-content")).toBeVisible();
  await firstMatch.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(firstMatch.locator(".why-content")).toBeHidden();
  await page.getByLabel("Search matches").fill("priya");
  await expect(page.locator(".match-card")).toHaveCount(1);
  await expect(page.locator(".match-title")).toContainText("Priya Shah");
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove from saved matches" }),
  ).toBeVisible();
  await page.getByLabel("Search matches").fill("");
  await page.getByLabel("Filter by score").selectOption("85");
  await expect(page.locator(".match-card")).toHaveCount(1);
  await page.getByLabel("Filter by type").selectOption("Startup");
  await expect(page.locator(".match-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".match-card")).toHaveCount(3);
  await page.getByRole("tab", { name: "Suggested" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Saved/ })).toBeFocused();
  await expect(page.locator(".match-card")).toHaveCount(2);
});

test("introductions create rooms and preserve edited terms", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "Matches");
  const priya = page.locator(".match-card").filter({ hasText: "Priya Shah" });
  await priya.getByRole("button", { name: "View match" }).click();
  await page
    .getByRole("button", { name: "Express interest", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Waiting for response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review proposed terms" }).click();
  await page.getByLabel("Shared goal").fill("Prepare a strong seed pitch");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByLabel("Shared goal")).toHaveValue(
    "Prepare a strong seed pitch",
  );
  await page.getByRole("button", { name: "Lock terms & start" }).click();
  await expect(page.getByLabel("Shared goal")).toBeDisabled();
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page
    .getByRole("button", { name: "Simulate partner confirmation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View milestones", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Milestones", exact: true }),
  ).toBeVisible();
});

test("room chat, evidence, disputes, launch and private review", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "Rooms");
  await page.getByRole("button", { name: "Open deal room" }).click();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.getByLabel("Write a message").fill("Hello <script> & team");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".bubble").last()).toContainText(
    "Hello <script> & team",
  );
  await expect(page.getByLabel("Write a message")).toHaveValue("");
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  const testing = page
    .locator(".milestone")
    .filter({ hasText: "Testing round" });
  await testing.getByRole("button", { name: "Attach evidence" }).click();
  await testing
    .getByPlaceholder("File name or link")
    .fill("https://example.com/results");
  await testing.getByRole("button", { name: "Attach", exact: true }).click();
  await testing
    .getByRole("button", { name: "Confirm yours", exact: true })
    .click();
  await expect(testing).toContainText("Waiting on partner");
  await testing.getByRole("button", { name: "Flag a dispute" }).click();
  await expect(testing).toContainText("Disputed");
  await page
    .getByRole("button", { name: "Mark as launched", exact: true })
    .click();
  await page.getByRole("radio", { name: "5 stars" }).check();
  await page
    .getByLabel("A note about working together")
    .fill("Helpful, clear collaboration.");
  await page.getByRole("button", { name: "Send private review" }).click();
  await expect(
    page.getByText("Your review has been sent privately.", { exact: false }),
  ).toBeVisible();
});

test("profile editing and independent mentor data", async ({ page }) => {
  await signIn(page);
  await navigate(page, "Profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("About me", { exact: true })
    .fill("Building student tools with care.");
  await page.getByLabel("Stage", { exact: true }).selectOption("seed");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".profile-summary")).toContainText(
    "Building student tools with care.",
  );
  await page.getByRole("tab", { name: "Trust history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent collaborations" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Demo controls" }).click();
  await page.getByRole("button", { name: "Mentor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good morning, David Park" }),
  ).toBeVisible();
  await navigate(page, "Rooms");
  await page.getByRole("button", { name: "Open deal room" }).click();
  await expect(page.getByLabel("Shared goal")).toHaveValue(
    "Monthly product sessions with BudgetBuddy",
  );
  await page.getByRole("tab", { name: "Milestones" }).click();
  // The seeded mentorship has no scheduled date despite the completed demo milestone.
  await page.locator("#session-date").fill("2026-11-01");
  await page.locator('input[type="time"]').fill("10:00");
  await page.getByRole("button", { name: "Save time" }).click();
  await expect(
    page.getByText("2026-11-01 · 10:00", { exact: true }),
  ).toBeVisible();
});

for (const role of ["founder", "mentor"]) {
  test(`complete ${role} signup and onboarding`, async ({ page }) => {
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("First name").fill("Alex");
    await page.getByLabel("Last name").fill("Reyes");
    await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
    await page.getByLabel("Password", { exact: true }).fill("strongpass123");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Verify email", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Email verified", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    if (role === "mentor")
      await page.getByRole("button", { name: /I’m here to mentor/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .locator("#story")
      .fill(`Alex's ${role} story <with> clear goals.`);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Draft suggestions" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Add a profile tag").fill("Campus impact");
    await page.getByRole("button", { name: "+ Add tag" }).click();
    await expect(
      page.locator(".pending-tag").filter({ hasText: "Campus impact" }),
    ).toBeVisible();
    await page
      .getByLabel("Goals", { exact: true })
      .fill("Find thoughtful collaborators");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "You’re ready to go" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Explore Synergy", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Good morning, Alex Reyes" }),
    ).toBeVisible();
    await expect(page.locator(".profile-card")).toContainText(
      `Alex's ${role} story <with> clear goals.`,
    );
  });
}

test("mobile navigation and responsive layouts fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await navigate(page, "Matches");
  await expect(
    page.getByRole("heading", { name: "Matches", exact: true }),
  ).toBeVisible();
  await page
    .locator(".nav")
    .getByRole("button", { name: "More", exact: true })
    .click();
  await page
    .locator(".mobile-more-sheet")
    .getByRole("button", { name: "Saved matches" })
    .click();
  await expect(page.getByRole("tab", { name: /Saved/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-matches.png",
    fullPage: true,
  });
});
