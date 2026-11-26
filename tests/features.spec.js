import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { selectValue, confirmSignOut, openRequest } from "./ui-helpers.js";
import { defaultMatching } from "../src/data/matching.js";
import { test, expect } from "@playwright/test";
import { decode } from "../src/state/serialization.js";
import AxeBuilder from "@axe-core/playwright";
const profile = {
  bio: "Building tools for students",
  offer: "Technical development",
  need: "Beta testers",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
  goals: "Validate onboarding",
  engagementPreference: "one-off",
  audienceSize: "100",
  offerTags: "Technical Development",
  needTags: "Beta Testers",
};

test("voluntary sign-out preserves drafts on cancel and confirms once across desktop and mobile", async ({
  page,
  request,
}) => {
  const u = await user(request, "LogoutDraft");
  await act(request, u, { form: "profile-form", values: profile });
  await open(page, u, "profile");
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page.locator("#sign-out-dialog .sign-out-warning")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Keep my unsaved profile draft");
  await selectValue(page.getByLabel("Stage", { exact: true }), "growth");
  let logouts = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/logout")) logouts++;
  });
  const prompt = page.getByRole("dialog", {
    name: "Sign out of Synergy?",
    exact: true,
  });
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    prompt.getByRole("button", { name: "Keep working", exact: true }),
  ).toBeFocused();
  await expect(
    prompt.getByText("You have unsaved drafts", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await expect(prompt).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(prompt).toHaveCSS("color", "rgb(28, 48, 46)");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await prompt
    .getByRole("button", { name: "Keep working", exact: true })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Keep my unsaved profile draft",
  );
  await expect(page.getByLabel("Stage", { exact: true })).toHaveAttribute(
    "value",
    "growth",
  );
  expect(logouts).toBe(0);
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Workspace navigation", exact: true })
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation", exact: true }),
  ).toHaveCount(0);
  await expect(
    prompt.getByRole("button", { name: "Keep working", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 320, height: 640 });
  const dialogBounds = await prompt.boundingBox();
  expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(320);
  expect(
    await prompt.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
  await prompt
    .getByRole("button", { name: "Keep working", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  expect(logouts).toBe(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  // On a tablet, Sign out stays at the foot of the rail as an icon.
  await page
    .locator(".user-mini")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page.route("**/api/logout", (route) => route.abort());
  await prompt
    .getByRole("button", { name: "Sign out", exact: true })
    .dblclick();
  await expect(prompt.getByRole("alert")).toContainText(
    "Your session and drafts are preserved",
  );
  await expect(prompt).toBeVisible();
  await page.unroute("**/api/logout");
  await prompt.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy", exact: true }),
  ).toBeVisible();
  expect(logouts).toBe(2);
  expect(
    await page.evaluate(() => sessionStorage.getItem("synergy-session")),
  ).toBeNull();
  expect(
    await page.evaluate(
      () =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith("synergy-draft:"),
        ).length,
    ),
  ).toBe(0);
});

test("Settings role switching restores custom-select drafts and verification keeps its input", async ({
  page,
  request,
}) => {
  const u = await user(request, "RoleDraft");
  await act(request, u, { form: "profile-form", values: profile });
  await act(request, u, {
    role: "mentor",
    form: "profile-form",
    values: {
      bio: "Product mentor",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product",
      availability: "Monthly",
      startups: "Early teams",
    },
  });
  await act(request, u, { action: "choose-role", roleChoice: "founder" });
  await open(page, u, "profile");
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("I'm here as a", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Founder draft across role changes");
  await selectValue(page.getByLabel("Stage", { exact: true }), "growth");
  await page.goto("/#/settings");
  await selectValue(
    page.getByRole("combobox", { name: "Active profile", exact: true }),
    "mentor",
  );
  await page
    .getByRole("dialog", { name: "Switch active profile?" })
    .getByRole("button", { name: "Switch profile", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Active profile", exact: true }),
  ).toHaveText("Mentor");
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("About me", { exact: true })).toHaveValue(
    "Product mentor",
  );
  await page
    .getByLabel("Past experience", { exact: true })
    .fill("Separate mentor draft");
  await page.goto("/#/settings");
  await selectValue(
    page.getByRole("combobox", { name: "Active profile", exact: true }),
    "founder",
  );
  await page
    .getByRole("dialog", { name: "Switch active profile?" })
    .getByRole("button", { name: "Switch profile", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Active profile", exact: true }),
  ).toHaveText("Startup founder");
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Founder draft across role changes",
  );
  await expect(page.getByLabel("Stage", { exact: true })).toHaveAttribute(
    "value",
    "growth",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Complete your profile to appear in Matches", {
      exact: true,
    }),
  ).toHaveCount(0);
  const organization =
    "A fictional organization with a long name for wrapping and retained form values";
  // Verification is always visible on Your profile.
  await page
    .getByLabel("Who can vouch for you?", {
      exact: true,
    })
    .fill(organization);
  await page
    .getByLabel("How can a moderator check it?", { exact: true })
    .fill("Public roster available for moderator review");
  await expect(
    page.getByLabel("Who can vouch for you?", {
      exact: true,
    }),
  ).toHaveValue(organization);
  await expect(
    page.getByRole("button", { name: "Request verification", exact: true }),
  ).toBeEnabled();
  // Proposing tags is no longer offered on Your profile.
  await expect(page.getByText("Standard tags", { exact: true })).toHaveCount(0);
});

test("notification preview remains below the header with reachable overflow and coordinated popovers", async ({
  page,
  request,
}) => {
  const u = await user(request, "PreviewBounds");
  await act(request, u, { form: "profile-form", values: profile });
  const peer = await user(request, "PreviewMatch");
  await act(request, peer, {
    form: "profile-form",
    values: { ...profile, offer: profile.need, need: profile.offer },
  });
  await page.route("**/api/state**", async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.delete("since");
    const response = await route.fetch({ url: url.href });
    const body = await response.json();
    if (body.state)
      body.state.notifications = Array.from({ length: 24 }, (_, index) => ({
        id: `preview-${index}`,
        kind: "session",
        text: `Session preparation ${index + 1}: review a long fictional collaboration brief and record the next steps for mentoring and follow-up.`,
        timestamp: new Date(Date.now() - index * 60000).toISOString(),
        sessionAt: "2026-11-03T02:00:00.000Z",
        read: index % 2 === 0,
      }));
    await route.fulfill({ response, json: body });
  });
  await open(page, u, "matches");
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.click();
    const panel = page.getByRole("region", {
      name: "Notifications",
      exact: true,
    });
    await expect(panel).toBeVisible();
    // Use the finished entrance state when comparing geometry.
    await expect
      .poll(async () => panel.evaluate((el) => getComputedStyle(el).transform))
      .toBe("none");
    const header = await page.locator(".topbar").boundingBox();
    const bounds = await panel.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(header.y + header.height + 7);
    expect(bounds.x).toBeGreaterThanOrEqual(11);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 11);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844 - 11);
    const body = panel.getByRole("region", {
      name: "Recent updates",
      exact: true,
    });
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    );
    await body.focus();
    await page.keyboard.press("End");
    await expect(
      panel.getByRole("button", { name: "View all updates" }),
    ).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(bell).toBeFocused();
    await expect(panel).toHaveCount(0);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.locator("#notification-panel")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "View all updates" }).click();
  await expect(page.locator("#notification-panel")).toHaveCount(0);
  await expect(page.locator(".updates-page .update-row")).toHaveCount(24);
  await page.getByRole("button", { name: "Unread (12)", exact: true }).click();
  await expect(page.locator(".updates-page .update-row")).toHaveCount(12);
  await page.goto("/#/matches");
  const sort = page.getByRole("combobox", { name: "Sort by", exact: true });
  await sort.click();
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator("#notification-panel")).toBeVisible();
  await sort.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#notification-panel")).toHaveCount(0);
  await expect(page.getByRole("listbox")).toBeVisible();
});
async function post(request, path, data, token) {
  const response = await request.post(`/api/${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(response.ok(), await response.text()).toBe(true);
  return decode(await response.text());
}
async function user(
  request,
  name,
  role = "founder",
  email = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
) {
  email = email.toLowerCase();
  const account = await post(request, "signup", {
    firstName: name,
    lastName: "Browser",
    email,
    role,
    password: "private-password",
  });
  return { ...account, email, role };
}
const act = async (request, u, command) => {
  const current = await state(request, u);
  const room = current.state.rooms[command.activeRoomId];
  return post(
    request,
    "action",
    {
      role: u.role,
      termsRevision: room?.terms.revision || 0,
      milestoneVersion: room?.milestones[command.id]?.contentVersion || 0,
      ...command,
    },
    u.token,
  );
};
async function state(request, u) {
  return decode(
    await (
      await request.get(`/api/state?role=${u.role}`, {
        headers: { Authorization: `Bearer ${u.token}` },
      })
    ).text(),
  );
}
async function open(page, u, path = "") {
  await page.addInitScript(
    (token) => sessionStorage.setItem("synergy-session", token),
    u.token,
  );
  await page.goto(`/?open=${Date.now()}#/${path}`);
}
async function capture(page, name) {
  const toast = page.getByRole("button", {
    name: "Dismiss notification",
    exact: true,
  });
  if (await toast.isVisible()) await toast.click();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `artifacts/stakeholder-review/${name}.png`,
    fullPage: true,
  });
}
async function pair(request, mentor = false) {
  const a = await user(request, "Founder");
  const b = await user(request, "Partner", mentor ? "mentor" : "founder");
  await act(request, a, { form: "profile-form", values: profile });
  await act(request, b, {
    form: "profile-form",
    values: mentor
      ? {
          bio: "Guidance for student founders",
          offer: "Product feedback",
          need: "Student founders",
          expertise: "Product",
          availability: "Weekly",
          startups: "EdTech",
        }
      : { ...profile, offer: "Beta testers", need: "Technical development" },
  });
  // New mentors accept the guidelines before taking requests.
  if (mentor)
    await act(request, b, {
      form: "accept-guidelines",
      values: { version: 2 },
    });
  await act(request, a, {
    action: mentor ? "send-request" : "interest",
    values: mentor ? mentorRequestValues : undefined,
    id: `${b.state.accountId}:${b.role}`,
  });
  const connected = await act(request, b, {
    action: mentor ? "accept-request" : "accept-interest",
    id: `${a.state.accountId}:founder`,
  });
  return { a, b, id: connected.state.activeRoomId };
}
const terms = {
  goal: "Test onboarding",
  scope: "Twenty student testers",
  timeline: "Two weeks",
  commitment: "Two hours",
  compensation: "Shared feedback",
};

test("partners revise milestone scope with approval and preserve evidence", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request);
  await agree(request, a, b, id);
  await act(request, a, {
    form: "evidence",
    activeRoomId: id,
    id: "testing",
    values: { attachment: "Original evidence" },
  });
  await open(page, a, `rooms/${id}`);
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  const milestone = page.locator(".milestone").filter({
    has: page.locator(".milestone-title", { hasText: "Testing round" }),
  });
  await milestone.getByText(/^More/).click();
  await milestone
    .getByText("Propose a change to this milestone", { exact: true })
    .click();
  await milestone
    .getByLabel("Milestone title", { exact: true })
    .fill("Extended student testing");
  await milestone
    .getByLabel("Milestone scope", { exact: true })
    .fill("Include twenty more student testers.");
  await milestone
    .getByRole("button", { name: "Send revision for approval" })
    .click();
  await expect(
    milestone.getByText("Proposed milestone revision"),
  ).toBeVisible();
  await expect(
    milestone.getByRole("button", { name: "Mark as done" }),
  ).toBeDisabled();
  const partnerPage = await page.context().newPage();
  await open(partnerPage, b, `rooms/${id}`);
  await partnerPage
    .getByRole("tab", { name: "Milestones", exact: true })
    .click();
  const proposal = partnerPage.locator(".revision-proposal");
  await expect(proposal).toContainText("Extended student testing");
  await proposal
    .getByRole("button", { name: "Save revision decision" })
    .click();
  await expect(
    page.locator(".milestone-title", { hasText: "Extended student testing" }),
  ).toBeVisible();
  await expect(
    page.getByText("Original evidence", { exact: true }),
  ).toBeVisible();
  await capture(page, "milestone-revision-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "milestone-revision-mobile");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await partnerPage.close();
});

test("moderators edit reusable templates and versioned matching weights", async ({
  page,
  request,
}) => {
  const admin = await user(
    request,
    "Settings",
    "founder",
    "settings-moderator@example.com",
  );
  const initial = (await state(request, admin)).state;
  await open(page, admin, "moderation");
  await page
    .getByText("Evaluation and Feedback · Version 2", { exact: true })
    .click();
  const form = page
    .locator('form[data-form="engagement-template"]')
    .filter({ has: page.locator('input[value="beta"]') });
  await form
    .getByLabel("Template name", { exact: true })
    .fill("Student beta collaboration");
  await form
    .getByLabel("Title", { exact: true })
    .first()
    .fill("Agree student test scope");
  await form
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(
    page.getByText("Student beta collaboration · Version 3", { exact: true }),
  ).toBeVisible();
  await page
    .getByText(`Edit matching weights · Version ${defaultMatching.version}`, {
      exact: true,
    })
    .click();
  await page.locator("#weight-founder-0").fill("60");
  await page.locator("#weight-founder-2").fill("15");
  await page
    .getByRole("button", { name: "Save matching weights", exact: true })
    .click();
  await expect(
    page.getByText(
      `Edit matching weights · Version ${defaultMatching.version + 1}`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Matching evaluation", exact: true }),
  ).toBeVisible();
  expect(
    (await state(request, admin)).state.engagementTemplates.beta.milestones[0]
      .title,
  ).toBe("Agree student test scope");
  await capture(page, "templates-matching-settings-desktop");
  const template = initial.engagementTemplates.beta;
  const values = { type: "beta", version: 3, name: template.name };
  for (const item of template.milestones)
    Object.assign(values, {
      [`title-${item.id}`]: item.title,
      [`description-${item.id}`]: item.description,
      [`evidence-${item.id}`]: item.evidence ? "on" : "",
    });
  await act(request, admin, { form: "engagement-template", values });
  const weights = { version: defaultMatching.version + 1 };
  for (const kind of ["founder", "mentor"])
    initial.matchingConfig[kind].forEach((weight, index) => {
      weights[`${kind}-${index}`] = weight * 100;
    });
  await act(request, admin, { form: "matching-config", values: weights });
});

test("mentor experience can be edited and appears on the public mentor profile", async ({
  page,
  request,
}) => {
  const { a, b } = await pair(request, true);
  await open(page, b, "profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Past experience", { exact: true })
    .fill("Led product research.\nAdvised three student teams.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Led product research. Advised three student teams.", {
      exact: true,
    }),
  ).toBeVisible();
  const observerPage = await page.context().newPage();
  await open(
    observerPage,
    a,
    `matches/${encodeURIComponent(`${b.state.accountId}:mentor`)}`,
  );
  // Experience is on the match page's Trust tab.
  await observerPage
    .getByRole("tab", {
      name: "Experience and collaboration history",
      exact: true,
    })
    .click();
  await expect(
    observerPage.getByRole("heading", { name: "Past experience", exact: true }),
  ).toBeVisible();
  await expect(
    observerPage.getByText(
      "Led product research. Advised three student teams.",
      { exact: true },
    ),
  ).toBeVisible();
  await capture(observerPage, "mentor-experience-desktop");
  await observerPage.close();
});

async function agree(request, a, b, id) {
  await act(request, a, {
    action: "lock-terms",
    activeRoomId: id,
    values: terms,
  });
  await act(request, b, { action: "accept-terms", activeRoomId: id });
}
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("partners request revised terms, set due dates, close a room and reconnect without losing history", async ({
  page,
  request,
  context,
}) => {
  const { a, b, id } = await pair(request);
  await act(request, a, {
    action: "lock-terms",
    activeRoomId: id,
    values: terms,
  });
  await open(page, b, `rooms/${id}`);
  await page
    .getByText("Propose changes to these terms", { exact: true })
    .click();
  await page.getByRole("button", { name: "Send change request" }).click();
  // The terms stay agreed, and read as text, until the partner accepts.
  await expect(page.getByLabel("Shared goal", { exact: true })).toHaveText(
    terms.goal,
  );
  await expect(
    page.getByRole("textbox", { name: "Shared goal", exact: true }),
  ).toHaveCount(0);
  const requester = await context.newPage();
  await open(requester, a, `rooms/${id}`);
  await requester
    .getByRole("button", { name: "Agree to reopen terms" })
    .click();
  // Reopened terms become an editable draft again.
  const goal = page.getByRole("textbox", { name: "Shared goal", exact: true });
  await expect(goal).toBeEditable();
  await goal.fill("Revised onboarding outcome");
  await page.getByRole("button", { name: /^Send for / }).click();
  const other = await context.newPage();
  await open(other, a, `rooms/${id}`);
  await other.getByRole("button", { name: "Accept these terms" }).click();
  await requester.close();
  await expect(page.getByText("Agreed by both", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  const scope = page.locator(".milestone").filter({
    has: page.locator(".milestone-title", { hasText: "Scope defined" }),
  });
  await scope.getByText(/^More/).click();
  await scope.getByLabel("Due date", { exact: true }).fill("2025-01-01");
  await scope.getByRole("button", { name: "Save date and owner" }).click();
  await expect(scope.getByText(/^Due .*2025/)).toBeVisible();
  await page.getByText("More", { exact: true }).first().click();
  await page.getByRole("button", { name: "Close this collaboration" }).click();
  await selectValue(page.getByLabel("Why are you closing it?"), "other");
  await page.getByLabel(/^Details/).fill("Changing priorities");
  await page
    .getByRole("button", { name: "Close collaboration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Collaboration closed", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("heading", { name: "Collaboration closed", exact: true }),
  ).toBeVisible();
  await page.goto("/#/matches");
  await page
    .locator(
      `button[data-action="match-detail"][data-id="${a.state.accountId}:founder"]`,
    )
    .click();
  await openRequest(page);
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  const next = await act(request, a, {
    action: "accept-interest",
    id: `${b.state.accountId}:founder`,
  });
  expect(next.state.activeRoomId).not.toBe(id);
  expect(next.state.rooms[id].status).toBe("cancelled");
});

test("mentorship rescheduling and notification read state work on mobile", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request, true);
  await act(request, b, { action: "confirm-goal", activeRoomId: id });
  await page.setViewportSize({ width: 360, height: 900 });
  await open(page, a, `rooms/${id}`);
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Schedule" });
  await panel.getByLabel("Date", { exact: true }).fill("2035-04-01");
  await panel.getByLabel("Time", { exact: true }).fill("10:00");
  await selectValue(
    panel.getByRole("combobox", { name: "Duration", exact: true }),
    "45",
  );
  await panel
    .getByRole("button", { name: "Schedule session", exact: true })
    .click();
  // The duration dropdown also reads "45 minutes"; check the session itself.
  await expect(
    panel.locator(".mentor-session").getByText(/45 minutes/),
  ).toBeVisible();
  await panel.getByText("Reschedule or cancel", { exact: true }).click();
  await panel.getByLabel("Date", { exact: true }).fill("2035-04-02");
  await panel.getByLabel("Time", { exact: true }).fill("11:00");
  await panel
    .getByRole("button", { name: "Reschedule session", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await state(request, a)).state.rooms[id].milestones.held.schedules[0]
          .date,
    )
    .toBe("2035-04-02");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, "fixed-scheduling-mobile");
  await page.goto("/#/updates");
  // Opening the room already read its informational notices; anything left
  // is cleared with Mark all as read.
  const markAll = page.getByRole("button", {
    name: "Mark all as read",
    exact: true,
  });
  if (await markAll.isEnabled()) await markAll.click();
  await expect(
    page.getByRole("status").filter({ hasText: /^0 unread updates$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: /^0 unread updates$/ }),
  ).toBeVisible();
});

test("verified moderators review reports, tags and affiliations while ordinary accounts cannot access the queue", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request);
  await agree(request, a, b, id);
  await act(request, a, { action: "dispute", activeRoomId: id, id: "scope" });
  await act(request, a, {
    form: "report-form",
    activeRoomId: id,
    values: { reason: "Please review completion evidence" },
  });
  await act(request, a, {
    form: "tag-proposal",
    values: { label: "Accessible Onboarding" },
  });
  await act(request, a, {
    form: "affiliation-request",
    values: {
      organization: "Startup Program",
      evidence: "Membership roster checked by program coordinator",
    },
  });
  const admin = await user(
    request,
    "Moderator",
    "founder",
    "moderator@example.com",
  );
  await open(page, admin, "moderation");
  const report = page.locator(".moderation-entry").filter({
    has: page.locator("summary", {
      hasText: "Please review completion evidence",
    }),
  });
  await report.locator("summary").first().click();
  await selectValue(report.getByLabel("Decision", { exact: true }), "resolved");
  await selectValue(report.getByLabel("Resolution action"), "resolve-disputes");
  await report
    .getByLabel("Reason / resolution")
    .fill("Reviewed evidence; both sides should confirm again");
  await report.getByRole("button", { name: "Save decision" }).click();
  await expect(report.locator("summary").first()).toContainText("resolved");
  expect(
    (await state(request, a)).state.rooms[id].milestones.scope.disputed,
  ).toBe(false);
  // (Nov 22, round 3) A pending tag's decision is visible without expanding,
  // and the choices read as actions.
  const tag = page.locator(".moderation-entry").filter({
    has: page.getByRole("heading", { name: "Accessible Onboarding" }),
  });
  const decision = tag.getByLabel("Decision", { exact: true });
  await expect(decision).toBeVisible();
  await expect(decision).toContainText("Approve");
  await decision.click();
  await expect(
    page.getByRole("listbox").getByRole("option", { name: "Reject" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listbox").getByRole("option", { name: "approved" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await selectValue(decision, "approved");
  await tag.getByLabel("Reason / resolution").fill("A useful reusable tag");
  await tag.getByRole("button", { name: "Save decision" }).click();
  const affiliation = page
    .locator(".moderation-entry")
    .filter({ has: page.locator("summary", { hasText: "Startup Program" }) });
  await affiliation.locator("summary").click();
  await affiliation
    .getByLabel("Reason / resolution")
    .fill("Program coordinator confirmed membership");
  await affiliation.getByRole("button", { name: "Save decision" }).click();
  await expect(
    page.getByText("No pending requests.", { exact: true }),
  ).toBeVisible();
  expect((await state(request, b)).state.vocabulary).toContain(
    "Accessible Onboarding",
  );
  const forbidden = await request.post("/api/action", {
    headers: { Authorization: `Bearer ${b.token}` },
    data: { role: "founder", form: "moderation", values: { kind: "tag" } },
  });
  expect(forbidden.status()).toBe(403);
  await page.setViewportSize({ width: 360, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, "fixed-moderation-mobile");
});

test("prospective partners see public trust only after both blind reviews are submitted", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request);
  await agree(request, a, b, id);
  for (const [key, item] of Object.entries(
    (await state(request, a)).state.rooms[id].milestones,
  )) {
    if (item.evidence)
      await act(request, a, {
        form: "evidence",
        activeRoomId: id,
        id: key,
        values: { attachment: "Evidence summary" },
      });
    for (const u of [a, b])
      await act(request, u, {
        action: "confirm-milestone",
        activeRoomId: id,
        id: key,
      });
  }
  await act(request, a, { action: "launch-room", activeRoomId: id });
  await act(request, a, {
    form: "review-form",
    activeRoomId: id,
    values: { rating: "4", note: "Secret early feedback" },
  });
  const observer = await user(request, "Observer");
  await act(request, observer, { form: "profile-form", values: profile });
  await open(
    page,
    observer,
    `matches/${encodeURIComponent(`${b.state.accountId}:founder`)}`,
  );
  // Trust history is on the match page's Trust tab.
  await page
    .getByRole("tab", {
      name: "Experience and collaboration history",
      exact: true,
    })
    .click();
  const trust = page.getByRole("region", { name: /Trust history/ });
  await expect(trust).toContainText("No ratings yet");
  await expect(
    page.getByText("Secret early feedback", { exact: true }),
  ).toHaveCount(0);
  await act(request, b, {
    form: "review-form",
    activeRoomId: id,
    values: { rating: "5" },
  });
  await expect(trust).toContainText("4/5 from 1 review");
  await trust
    .getByText("Completed collaboration history (1)", { exact: true })
    .click();
  await expect(trust).toContainText("Evaluation and Feedback");
  await capture(page, "fixed-public-trust-desktop");
});

test("temporary restore failures preserve a valid session and allow retry", async ({
  page,
  request,
}) => {
  const u = await user(request, "Restore");
  await open(page, u);
  await expect(page.getByRole("heading", { name: /, Restore$/ })).toBeVisible();
  await page.route("**/api/state*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporarily unavailable" }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry opening workspace" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Boolean(sessionStorage.getItem("synergy-session")),
    ),
  ).toBe(true);
  await page.unroute("**/api/state*");
  await page.getByRole("button", { name: "Retry opening workspace" }).click();
  await expect(page.getByRole("heading", { name: /, Restore$/ })).toBeVisible();
});

test("shared terms preserve dirty drafts through remote edits and navigation", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request);
  await open(page, a, `rooms/${id}`);
  await page
    .getByLabel("Shared goal", { exact: true })
    .fill("My unsaved draft");
  await act(request, b, {
    form: "terms-form",
    activeRoomId: id,
    values: { ...terms, goal: "Partner's latest goal" },
  });
  await expect(
    page.getByRole("button", { name: "Use latest terms" }),
  ).toBeVisible();
  await expect(page.getByLabel("Shared goal", { exact: true })).toHaveValue(
    "My unsaved draft",
  );
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Shared goal", { exact: true })).toHaveValue(
    "My unsaved draft",
  );
  await page.getByRole("button", { name: "Use latest terms" }).click();
  await expect(page.getByLabel("Shared goal", { exact: true })).toHaveValue(
    "Partner's latest goal",
  );
  await page.getByRole("button", { name: /^Open profile for / }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Description", { exact: true })
    .fill("My profile draft survives navigation");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page.getByRole("button", { name: /^Open profile for / }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My profile draft survives navigation",
  );
});

test("account settings support visibility, session revocation and deletion", async ({
  page,
  request,
}) => {
  const u = await user(request, "Settings");
  await act(request, u, { form: "profile-form", values: profile });
  await open(page, u, "settings");
  await page.locator("#danger-zone > summary").click();
  await page
    .getByRole("button", { name: "Pause discovery", exact: true })
    .click();
  const pause = page.getByRole("dialog", {
    name: "Pause discovery?",
    exact: true,
  });
  await expect(pause).toContainText("all pending requests will be withdrawn");
  await pause.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Your completed profiles are visible in Matches.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause discovery", exact: true })
    .click();
  await pause
    .getByRole("button", { name: "Pause discovery", exact: true })
    .click();
  await expect(
    page.getByText(
      "Discovery is paused. Both profiles are hidden from Matches.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out other sessions" }).click();
  await page
    .getByLabel("Current password", { exact: true })
    .fill("private-password");
  await page
    .getByRole("button", { name: "Confirm session sign-out", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText(
    "Account settings updated",
  );
  await page.getByText("Delete my account", { exact: true }).click();
  const deletion = page.getByRole("dialog", {
    name: "Delete your account?",
    exact: true,
  });
  await expect(
    deletion.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.locator("#delete-password").fill("wrong-password");
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  let deleteRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/account/delete")) deleteRequests++;
  });
  await deletion
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  expect(deleteRequests).toBe(0);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await deletion
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(deletion.getByRole("alert")).toContainText(
    "password is incorrect",
  );
  await expect(deletion).toBeVisible();
  await page.locator("#delete-password").fill("private-password");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Sign out of Synergy?", exact: true }),
  ).toHaveCount(0);
});

test("mobile discovery keeps the first action visible and lets partners agree on a collaboration type", async ({
  page,
  request,
}) => {
  const a = await user(request, "MobileDiscovery");
  const b = await user(request, "MobilePartner");
  await act(request, a, { form: "profile-form", values: profile });
  await act(request, b, {
    form: "profile-form",
    values: { ...profile, offer: profile.need, need: profile.offer },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, a, "matches");
  await page
    .getByLabel("Search matches", { exact: true })
    .fill("MobilePartner");
  const view = page.getByRole("button", { name: /^View match/ });
  await expect(view).toBeInViewport();
  await view.click();
  await openRequest(page);
  await selectValue(page.getByLabel("Collaboration type"), "marketing");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  const accepted = await act(request, b, {
    action: "accept-interest",
    id: `${a.state.accountId}:founder`,
  });
  expect(accepted.state.rooms[accepted.state.activeRoomId].type).toBe(
    "marketing",
  );
});

test("keyboard navigation and accessibility checks cover login, discovery, settings and profile editing", async ({
  page,
  request,
}) => {
  const check = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await page.goto("/");
  await check();
  const a = await user(request, "Accessibility");
  await act(request, a, { form: "profile-form", values: profile });
  const peer = await user(request, "AccessibilityPartner");
  await act(request, peer, {
    form: "profile-form",
    values: { ...profile, offer: profile.need, need: profile.offer },
  });
  await open(page, a, "matches");
  await page.getByRole("tab", { name: "Suggested", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Saved/ })).toBeFocused();
  await check();
  await page.goto("/#/settings");
  await page.locator("#danger-zone > summary").click();
  await expect(
    page.getByRole("heading", { name: "Profile visibility" }),
  ).toBeVisible();
  await check();
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await check();
});
