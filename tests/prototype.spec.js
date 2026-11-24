import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { selectValue, confirmSignOut } from "./ui-helpers.js";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { decode } from "../src/state/serialization.js";

test("prototype discovery preserves filters, sort, saved profiles and image fallbacks", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByLabel("About this prototype", { exact: true }).click();
  await expect(
    page.getByText(
      "Sample mentors and startups are fictional. Where they would normally reply, a Prototype only button lets you continue. Nothing is emailed and no money moves.",
    ),
  ).toBeVisible();
  // Preview emails are validated; first-run founders choose the sample.
  await page.getByLabel("Email address").fill("directory-review@example.com");
  await page.getByLabel("Password", { exact: true }).fill("preview");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore with a sample startup", exact: true })
    .click();
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
  // 14 sample mentors since directory version 10: the first page shows 12.
  await expect(page.locator(".match-card")).toHaveCount(12);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByLabel("Filter by type")).toHaveText("Mentors");
  await selectValue(page.getByLabel("Filter by type"), "Startup");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await expect(page.locator(".match-card")).toHaveCount(12);
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
  await expect(page.getByLabel("I'm signing in as")).toHaveText("Founder");
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
  const selector = await page.getByLabel("I'm signing in as").boundingBox();
  const signIn = await page
    .getByRole("button", { name: "Sign in", exact: true })
    .boundingBox();
  expect(selector.x).toBeGreaterThanOrEqual(0);
  expect(selector.x + selector.width).toBeLessThanOrEqual(360);
  expect(selector.y + selector.height).toBeLessThan(signIn.y);
  await page.getByLabel("I'm signing in as").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("welcome-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#app-shell")).toHaveCount(0);
  // The summary toast repeats the field errors, so it leaves once the
  // fields are being fixed instead of covering them.
  await expect(page.locator(".toast-error")).toBeVisible();
  // Typed key by key: dismissing the toast must not drop the first one.
  await page
    .getByLabel("Email address")
    .pressSequentially("anything@example.com");
  await expect(page.locator(".toast-error")).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toHaveValue(
    "anything@example.com",
  );
  await page.getByLabel("Password", { exact: true }).fill("x");
  await page.getByRole("button", { name: "Sign in", exact: true }).dblclick();
  await page
    .getByRole("button", { name: "Explore with a sample startup", exact: true })
    .click();
  await expect(page.locator("#app-shell")).toBeVisible();
  await expect(
    page.getByText("You're exploring as Maria Santos, a sample founder."),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  await selectValue(page.getByLabel("I'm signing in as"), "mentor");
  await page.getByLabel("Email address").fill("another-pretend@example.com");
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
  // Same credentials return to the same account, so they travel with the role.
  expect(demoRequests).toEqual([
    { role: "founder", email: "anything@example.com", password: "x" },
    { role: "mentor", email: "another-pretend@example.com", password: "?" },
  ]);
});

for (const role of ["founder", "mentor"])
  test(`fictional ${role} introductions can simulate acceptance once without partner confirmations`, async ({
    page,
    request,
  }) => {
    const response = await request.post("/api/demo", { data: { role } });
    const user = decode(await response.text());
    const person =
      role === "founder"
        ? user.state.directory.mentors.find((candidate) =>
            candidate.availableFormats?.some(
              (format) => format !== "office-hours",
            ),
          )
        : user.state.directory.founders[0];
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
    if (role === "founder") {
      await page
        .getByLabel("What's the problem?")
        .fill(mentorRequestValues.problem);
      await page
        .getByLabel("What have you already tried?")
        .fill(mentorRequestValues.tried);
      await page
        .getByLabel("What specific question do you want answered?")
        .fill(mentorRequestValues.question);
      await page
        .getByRole("button", { name: "Send mentorship request" })
        .click();
      await page
        .getByRole("button", { name: "Simulate acceptance", exact: true })
        .click();
    } else {
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
    }
    await expect(page).toHaveURL(/#\/rooms\//);
    await expect(
      page.getByRole("tab", { name: "Overview", exact: true }),
    ).toBeVisible();
    if (role === "founder") {
      await expect(
        page.getByText("Waiting for the mentor to confirm the goal", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Share preparation" }),
      ).toBeVisible();
    }
    const stateResponse = await request.get("/api/state", { headers });
    const state = decode(await stateResponse.text()).state;
    const room = Object.values(state.rooms)[0];
    expect(Object.keys(state.rooms)).toHaveLength(1);
    expect(room.template.version).toBe(4);
    expect(room.review.me).toBe(false);
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
          ? "No new mentorship requests"
          : "No pending introductions for founder exchanges.",
        { exact: false },
      ),
    ).toBeVisible();
    await page.goto("/#/");
    if (role === "mentor")
      await expect(
        page.getByRole("heading", { name: "Active mentees" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: /^Active rooms/ }),
      ).toContainText("1");
    await page.goto("/#/updates");
    await expect(
      page.getByText(
        role === "founder"
          ? `${person.name} accepted your mentorship request.`
          : `${person.name} accepted your introduction. Your room is ready.`,
        { exact: true },
      ),
    ).toBeVisible();
  });

test("preview sign-in waits for the workspace and recovers after a failed mode check", async ({
  page,
}) => {
  let recover = false;
  let finishFirstCheck;
  const firstCheck = new Promise((resolve) => {
    finishFirstCheck = resolve;
  });
  await page.route("**/api/capabilities", async (route) => {
    if (recover) return route.continue();
    await firstCheck;
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Connecting to Synergy");
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  finishFirstCheck();
  await expect(page.getByRole("alert")).toHaveText(
    "The workspace is unavailable.",
  );
  recover = true;
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByLabel("I'm signing in as")).toHaveText("Founder");
  await expect(
    page.getByText(
      "Use any email and password. Sign in with the same ones to come back to your work.",
    ),
  ).toBeVisible();
});

// Founder first-run review fixes (A1, B1, B2, D1–D9).
async function signInPreview(page, email, password, role = "founder") {
  if (role !== "founder")
    await selectValue(page.getByLabel("I'm signing in as"), role);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function api(request, token, data) {
  const response = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return decode(await response.text()).state;
}
const shiftly =
  "Shiftly is staff scheduling software for independent restaurants. We are a seed-stage team of 6 with 40 paying restaurants, but churn spikes after month two. We need help with pricing strategy and customer retention. We can offer intros to restaurant operators and product feedback.";

test("a preview founder sets up their own startup and returns to it from a new tab", async ({
  page,
  request,
}) => {
  const email = `return-${Date.now()}@example.com`;
  await page.goto("/");
  await signInPreview(page, email, "same-password");
  await expect(
    page.getByRole("heading", { name: "How do you want to start?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Set up my startup", exact: true })
    .click();
  const description = page.getByLabel("Your description", { exact: true });
  await expect(description).toBeFocused();
  await expect(description).toHaveValue("");
  await expect(page.getByLabel("About me")).toHaveValue("");
  await description.fill(shiftly);
  await page
    .getByRole("button", { name: "Suggest profile details", exact: true })
    .click();
  const review = page.getByRole("group", { name: "Fields to update" });
  await expect(review.getByRole("checkbox", { name: /^Stage/ })).toBeChecked();
  await expect(
    review.getByRole("checkbox", { name: /^Startup name/ }),
  ).toBeChecked();
  await expect(review).toContainText("Pricing strategy, Customer retention");
  await expect(review).not.toContainText("Technical Development");
  await page
    .getByRole("button", { name: "Apply suggestions", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Updated:/ }),
  ).toContainText("Select Save profile to keep these changes.");
  await expect(page.getByLabel("Team size")).toHaveValue("6");
  await expect(page.getByLabel("What I need")).toHaveValue(
    "Pricing strategy, Customer retention",
  );
  await expect(page.getByLabel("Startup name")).toHaveValue("Shiftly");
  // Save requires a name, so the checklist does too.
  const checklist = page.locator(".profile-checklist");
  await expect(checklist).toContainText("Your name, still to add");
  await expect(checklist).not.toContainText("Every required detail");
  await page.getByLabel("Your name").fill("Jordan Lee");
  await expect(checklist).toContainText("Every required detail is filled in.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(
    page.getByRole("progressbar", { name: "Required profile details" }),
  ).toHaveAttribute("aria-valuenow", "100");

  // Round 3: Hana's card names the need she covers, as her match page does,
  // and sample cards carry no "New Mentor" badge.
  await page.goto("/#/matches");
  const hana = page
    .locator("article.match-card")
    .filter({ has: page.getByRole("heading", { name: "Hana Sato" }) });
  // The You get chips name it; the card no longer repeats it in a line.
  await expect(hana.locator(".preview-reason")).toHaveCount(0);
  await expect(hana.locator(".preview-exchange dt")).toHaveText(["You get"]);
  await expect(hana.locator(".preview-exchange dd")).toHaveText([
    "Customer retention",
  ]);
  await expect(page.locator(".match-card .mentorship-badges")).toHaveCount(0);
  await hana.getByRole("button", { name: /^View match/ }).click();
  await expect(page.locator(".fit-section")).toContainText(
    "They offer what you need: Customer retention.",
  );
  await expect(
    page.getByText("New mentor · no completed sessions yet"),
  ).toBeVisible();

  // A room to deep-link to from the new tab.
  const token = await page.evaluate(() =>
    sessionStorage.getItem("synergy-session"),
  );
  const state = decode(
    await (
      await request.get("/api/state?role=founder", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).text(),
  ).state;
  const mentor = state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  await api(request, token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const roomId = (
    await api(request, token, {
      role: "founder",
      action: "simulate-acceptance",
      id: mentor.id,
    })
  ).activeRoomId;

  const tab = await page.context().newPage();
  await tab.goto(`/#/rooms/${roomId}`);
  await signInPreview(tab, email.toUpperCase(), "wrong-password");
  await expect(
    tab
      .getByText(
        "That email is already used in this preview. Use the same password as before, or a different email.",
      )
      .first(),
  ).toBeVisible();
  await expect(tab.locator("#app-shell")).toHaveCount(0);
  await tab.getByLabel("Password", { exact: true }).fill("same-password");
  await tab.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(tab).toHaveURL(new RegExp(`#/rooms/${roomId}`));
  await expect(
    tab.getByRole("heading", { name: "Mentorship room", exact: true }),
  ).toBeVisible();
  await tab.goto("/#/profile");
  // The suggested startup name leads, with the founder beside it.
  await expect(
    tab.getByRole("heading", { name: "Shiftly", exact: true }),
  ).toBeVisible();
  await expect(tab.getByText("Founder: Jordan Lee")).toBeVisible();
  await expect(tab.getByText("SaaS", { exact: true })).toBeVisible();
  await tab.close();
});

test("Apply suggestions lists each change and writes only the checked fields", async ({
  page,
}) => {
  await page.goto("/");
  await signInPreview(page, `apply-${Date.now()}@example.com`, "pw");
  await page
    .getByRole("button", { name: "Explore with a sample startup", exact: true })
    .click();
  await expect(page.locator("#app-shell")).toBeVisible();
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const description = page.getByLabel("Your description", { exact: true });
  await expect(description).toHaveValue("");
  await expect(description).toHaveAttribute("placeholder", /For example/);
  await description.fill(
    "We are a seed-stage team of 6 building budgeting tools. We need pricing strategy.",
  );
  await page
    .getByRole("button", { name: "Suggest profile details", exact: true })
    .click();
  const review = page.getByRole("group", { name: "Fields to update" });
  // Sample values are replaceable, so their suggestions start checked.
  const stage = review.getByRole("checkbox", { name: /^Stage/ });
  await expect(stage).toBeChecked();
  await expect(review.getByText("Pre-seed")).toBeVisible();
  await expect(review.getByText("Seed", { exact: true })).toBeVisible();
  const team = review.getByRole("checkbox", { name: /^Team size/ });
  await expect(team).toBeChecked();
  await team.uncheck();
  await expect(page.getByText(/fills empty fields only/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Apply suggestions", exact: true })
    .click();
  const note = page.getByRole("status").filter({ hasText: /^Updated:/ });
  await expect(note).toContainText("Stage");
  await expect(note).not.toContainText("Team size");
  await expect(note).toContainText(
    "Select Save profile to keep these changes.",
  );
  await expect(page.getByLabel("Stage")).toHaveText("Seed");
  await expect(page.getByLabel("Team size")).toHaveValue("4");
  // The checklist uses the save validator: an invalid team size is not ticked.
  await page.getByLabel("Team size").fill("-3");
  await expect(
    page
      .locator(".profile-checklist")
      .getByText("Team size must be a positive whole number."),
  ).toBeVisible();
});

test("a founder request shows inline errors, keeps its draft and reaches a reviewed session", async ({
  page,
  request,
}) => {
  const user = decode(
    await (
      await request.post("/api/demo", { data: { role: "founder" } })
    ).text(),
  );
  const mentor = user.state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  await page.goto("/");
  await page.evaluate(
    (token) => sessionStorage.setItem("synergy-session", token),
    user.token,
  );
  await page.goto(
    `/?draft=${Date.now()}#/matches/${encodeURIComponent(mentor.id)}`,
  );
  await page.getByRole("button", { name: "Send mentorship request" }).click();
  const problem = page.getByLabel("What's the problem?");
  for (const label of [
    "What's the problem?",
    "What have you already tried?",
    "What specific question do you want answered?",
  ])
    await expect(page.getByLabel(label)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  await expect(page.getByText("Add at least 20 characters.")).toHaveCount(3);
  await expect(problem).toBeFocused();
  await problem.fill(mentorRequestValues.problem);
  await expect(problem).toHaveAttribute("aria-invalid", "false");
  await page.reload();
  await expect(page.getByLabel("What's the problem?")).toHaveValue(
    mentorRequestValues.problem,
  );
  await page
    .getByLabel("What have you already tried?")
    .fill(mentorRequestValues.tried);
  await page
    .getByLabel("What specific question do you want answered?")
    .fill(mentorRequestValues.question);
  await page.getByRole("button", { name: "Send mentorship request" }).click();
  await expect(page).toHaveURL(/#\/waiting/);
  const card = page.locator(".mentor-request-card").first();
  await expect(card).toContainText(
    /usually replies within \d+ days?\. You’ll see the reply in Updates\./,
  );
  await card.getByText("View request", { exact: true }).click();
  await expect(card.getByText(mentorRequestValues.question)).toBeVisible();
  await expect(card.getByText("Format", { exact: true })).toBeVisible();
  await card
    .getByRole("button", { name: "Simulate acceptance", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/rooms\//);
  await expect(
    page.getByRole("button", { name: "Report collaborator" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Share preparation" }),
  ).toHaveClass(/primary/);
  await expect(
    page.getByText("Share your deck, metrics and links before your session."),
  ).toBeVisible();
  await expect(
    page.locator(".mentor-stage-line li.done").first(),
  ).toContainText("Requested");
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  await expect(
    page.getByText(
      `You can pick a time once ${mentor.name} confirms the goal.`,
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate mentor confirming the goal" })
    .click();
  // The stage reached is current; the session still ahead is not marked.
  await expect(
    page.locator(".mentor-stage-line [aria-current=step]"),
  ).toHaveText("Goal Confirmed");
  await expect(
    page
      .locator(".mentor-stage-line li.done")
      .filter({ hasText: "Session Held" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Write a message")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator(".toast-error")).toContainText(
    "Couldn't send your message",
  );
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  const date = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await page.locator("#single-session-date").fill(date);
  await page.locator("#single-session-time").fill("10:00");
  await page.getByRole("button", { name: "Schedule session" }).click();
  await expect(page.locator(".mentor-session")).toHaveCount(1);
  // The next step asks for prep before the session, and opens Overview.
  const nextStep = page.locator(".room-next-step");
  await expect(nextStep.locator("strong")).toHaveText(
    /^Share your prep before \w{3}, \w{3} \d+ · /,
  );
  await nextStep.getByRole("button", { name: "Go to prep" }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Deck").fill("https://example.com/deck");
  await page.getByRole("button", { name: "Share preparation" }).click();
  await expect(page.getByText("Prep shared", { exact: true })).toBeVisible();
  await expect(nextStep.locator(".section-eyebrow")).toHaveText("Up next");
  await expect(nextStep.locator("strong")).toHaveText(
    /^Session booked for \w{3}, \w{3} \d+ · /,
  );
  await page.getByText("Safety", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Report collaborator" }),
  ).toBeVisible();
  // Prototype only: the booked session takes place now, so follow-up and
  // reviews can be tried in one sitting, and the room reaches Reviewed.
  await expect(
    page.getByText(
      `Prototype only: ${mentor.name} is a fictional mentor. Simulate the session taking place to try follow-up and reviews.`,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate the session taking place" })
    .click();
  await expect(
    page.locator(".mentor-stage-line [aria-current=step]"),
  ).toHaveText("Session Held");
  // Once the session is held, shared prep stays readable but not editable,
  // so the follow-up is the only next step on the page.
  await expect(page.getByText("Prep shared", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share preparation" }),
  ).toHaveCount(0);
  await page
    .getByLabel("What happened? (optional)")
    .fill("We chose a flat-fee pricing test.");
  await expect(
    page.getByRole("button", { name: "Submit follow-up" }),
  ).toHaveClass(/primary/);
  await page.getByRole("button", { name: "Submit follow-up" }).click();
  await expect(
    page.getByText("We chose a flat-fee pricing test."),
  ).toBeVisible();
  await nextStep.getByRole("button", { name: "Write review" }).click();
  for (const label of ["Usefulness", "Clarity", "Responsiveness"])
    await selectValue(
      page.getByRole("combobox", { name: label, exact: true }),
      "5",
    );
  await page.getByRole("button", { name: "Submit private review" }).click();
  await expect(
    page.getByRole("heading", { name: "Mentorship feedback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to mentorship room" }).click();
  await expect(
    page.locator(".mentor-stage-line li.done").filter({ hasText: "Reviewed" }),
  ).toHaveCount(1);
});

test("a founder trades advice with a sample startup in a Skill Swap without a false terms conflict", async ({
  page,
  request,
}) => {
  const user = decode(
    await (
      await request.post("/api/demo", { data: { role: "founder" } })
    ).text(),
  );
  const headers = { Authorization: `Bearer ${user.token}` };
  const profiled = decode(
    await (
      await request.post("/api/action", {
        headers,
        data: {
          role: "founder",
          form: "profile-form",
          values: {
            bio: "Reservation and waitlist app for independent cafes.",
            offer: "Product design feedback, Intros to cafe owners",
            need: "Pricing strategy, Fundraising",
            industry: "Hospitality software",
            stage: "pre-seed",
            teamSize: "2",
          },
        },
      })
    ).text(),
  );
  const fairtab = profiled.state.directory.founders.find(
    (person) => person.name === "Fairtab",
  );
  await page.goto("/");
  await page.evaluate(
    (token) => sessionStorage.setItem("synergy-session", token),
    user.token,
  );
  await page.goto(`/?swap=${Date.now()}#/matches`);
  await expect(page.getByRole("heading", { name: "Fairtab" })).toBeVisible();
  await page.goto(`/#/matches/${encodeURIComponent(fairtab.id)}`);
  await expect(page.getByLabel("Collaboration type")).toHaveText("Skill Swap");
  await page.getByRole("button", { name: "Send introduction" }).click();
  await page
    .getByRole("button", {
      name: "Simulate acceptance from Fairtab",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#\/rooms\//);
  await expect(page.getByRole("heading", { name: "Skill Swap" })).toBeVisible();
  for (const [label, value] of [
    ["Shared goal", "Fairtab improves onboarding; we set our first price."],
    ["Scope and deliverables", "We review onboarding; Fairtab shares pricing."],
    ["Timeline", "2 weeks"],
    ["Commitment", "2 calls"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Exchange", { exact: true })
    .fill("Design feedback for a pricing playbook");
  await page
    .getByRole("button", { name: "Send for Fairtab’s approval" })
    .click();
  await expect(page.getByText("Agreed by both", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your collaborator changed these terms", { exact: false }),
  ).toHaveCount(0);
  // Optional terms nobody filled in are left out of the agreement.
  await expect(page.getByLabel("Exchange", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Working sessions")).toHaveCount(0);
  // After a reload, an agreed room opens on Milestones; the Agreement tab
  // still shows no conflict.
  await page.reload();
  await page.getByRole("tab", { name: "Agreement", exact: true }).click();
  await expect(page.getByText("Agreed by both", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Your collaborator changed these terms", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Trade agreed/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^First side shared/ }),
  ).toBeVisible();
});

test("signing in as the other role asks first, and a founder room offers the switch back", async ({
  page,
  request,
}) => {
  const email = `roles-${Date.now()}@example.com`;
  await page.goto("/");
  await signInPreview(page, email, "pw");
  await page
    .getByRole("button", { name: "Explore with a sample startup", exact: true })
    .click();
  await expect(page.locator("#app-shell")).toBeVisible();
  const token = await page.evaluate(() =>
    sessionStorage.getItem("synergy-session"),
  );
  const state = decode(
    await (
      await request.get("/api/state?role=founder", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).text(),
  ).state;
  const mentor = state.directory.mentors.find((person) =>
    person.availableFormats?.includes("single-session"),
  );
  await api(request, token, {
    role: "founder",
    action: "send-request",
    id: mentor.id,
    values: { ...mentorRequestValues, format: "single-session" },
  });
  const roomId = (
    await api(request, token, {
      role: "founder",
      action: "simulate-acceptance",
      id: mentor.id,
    })
  ).activeRoomId;
  await page.goto(`/?room=${Date.now()}#/rooms/${roomId}`);
  await expect(
    page.getByRole("heading", { name: "Mentorship room", exact: true }),
  ).toBeVisible();

  const tab = await page.context().newPage();
  await tab.goto("/");
  await signInPreview(tab, email, "pw", "mentor");
  const dialog = tab.getByRole("dialog", { name: "Switch to mentor?" });
  // The title asks the question; the body gives the context only (round 3).
  await expect(dialog.locator("p")).toHaveText(
    "You were last using Synergy as a founder. Other open tabs will switch too.",
  );
  await expect(tab.locator("#app-shell")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Switch to mentor", exact: true })
    .click();
  await expect(tab.locator("#app-shell")).toBeVisible();
  await expect(
    tab.getByRole("button", { name: /Mentor$/ }).first(),
  ).toBeVisible();
  await tab.close();

  // The founder tab's next load is in mentor mode; the room offers a way back.
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "This room belongs to your founder profile",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch to founder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mentorship room", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/rooms/${roomId}`));
});

// Readiness plan Phase 1: a mentor preview can be evaluated on its own. It
// starts with one request from a fictional startup and reaches Reviewed.
test("a mentor preview takes the sample request to Reviewed", async ({
  page,
}) => {
  await page.goto("/");
  await selectValue(
    page.getByRole("combobox", { name: "I'm signing in as" }),
    "mentor",
  );
  await page.getByLabel("Email address").fill("mentor-preview@example.com");
  await page.getByLabel("Password", { exact: true }).fill("preview");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "1 request waiting" }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).toContainText("Alex Navarro");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Startups", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Mentorship room" }),
  ).toBeVisible();
  await expect(page.getByText("What they already tried")).toBeVisible();
  await page.getByRole("button", { name: "Confirm goal", exact: true }).click();
  const nextStep = page.locator(".room-next-step");
  await expect(nextStep.locator("strong")).toHaveText("Arrange a session");
  await nextStep.getByRole("button", { name: "Go to schedule" }).click();
  const date = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await page.locator("#single-session-date").fill(date);
  await page.locator("#single-session-time").fill("10:00");
  await page.getByRole("button", { name: "Schedule session" }).click();
  await page
    .getByRole("button", { name: "Simulate the session taking place" })
    .click();
  await expect(nextStep.locator("strong")).toHaveText(
    "Write your private review",
  );
  await nextStep.getByRole("button", { name: "Write review" }).click();
  for (const label of ["Preparedness", "Follow-through"])
    await selectValue(
      page.getByRole("combobox", { name: label, exact: true }),
      "4",
    );
  await page.getByRole("button", { name: "Submit private review" }).click();
  // The fictional founder's review reads like real feedback, rated per question.
  await expect(
    page.getByText(/You pointed us to the one step that mattered/),
  ).toBeVisible();
  await expect(
    page.locator(".review-scores").getByText("Usefulness"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to mentorship room" }).click();
  await expect(
    page.locator(".mentor-stage-line li.done").filter({ hasText: "Reviewed" }),
  ).toHaveCount(1);
});
