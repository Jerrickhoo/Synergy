import { test, expect } from "@playwright/test";
import { decode } from "../src/state/serialization.js";
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
  const challenge = await post(request, "signup", {
    firstName: name,
    lastName: "Browser",
    email,
    role,
    password: "private-password",
  });
  const { code } = await (
    await request.get(`/__test__/email?address=${encodeURIComponent(email)}`)
  ).json();
  const account = await post(request, "auth/verify", {
    challengeId: challenge.challengeId,
    code,
  });
  return { ...account, email, role };
}
const act = (request, u, command) =>
  post(request, "action", { role: u.role, ...command }, u.token);
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
  await page.goto(`/#/${path}`);
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
  await act(request, a, {
    action: "interest",
    id: `${b.state.accountId}:${b.role}`,
  });
  const connected = await act(request, b, {
    action: "accept-interest",
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
  await milestone
    .getByText("Propose title or scope revision", { exact: true })
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
    milestone.getByRole("button", { name: "Confirm yours" }),
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
    .getByText("Beta Testing Exchange · Version 1", { exact: true })
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
    page.getByText("Student beta collaboration · Version 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Edit matching weights · Version 1", { exact: true })
    .click();
  await page.locator("#weight-founder-0").fill("60");
  await page.locator("#weight-founder-2").fill("10");
  await page
    .getByRole("button", { name: "Save matching weights", exact: true })
    .click();
  await expect(
    page.getByText("Edit matching weights · Version 2", { exact: true }),
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
  const values = { type: "beta", version: 2, name: template.name };
  for (const item of template.milestones)
    Object.assign(values, {
      [`title-${item.id}`]: item.title,
      [`description-${item.id}`]: item.description,
      [`evidence-${item.id}`]: item.evidence ? "on" : "",
    });
  await act(request, admin, { form: "engagement-template", values });
  const weights = { version: 2 };
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

test("AI follow-up questions block application until answered and unfamiliar tags can be proposed", async ({
  page,
  request,
}) => {
  const u = await user(request, "Clarification");
  await act(request, u, { form: "profile-form", values: profile });
  let calls = 0;
  await page.route("**/api/ai/profile", async (route) => {
    const body = route.request().postDataJSON();
    calls++;
    if (calls === 2)
      expect(body.answers[0].answer).toBe("We need privacy engineering help.");
    await route.fulfill({
      json: {
        draft: {
          bio: profile.bio,
          offer: profile.offer,
          need: calls === 1 ? "" : "Privacy engineering",
          industry: profile.industry,
          stage: profile.stage,
          teamSize: profile.teamSize,
        },
        clarifications:
          calls === 1
            ? ["Do you offer privacy engineering or need help with it?"]
            : [],
        proposedTags:
          calls === 1
            ? []
            : [
                {
                  label: "Privacy Engineering",
                  side: "need",
                  reason: "You explicitly need this skill.",
                },
              ],
        suggestedTags: { offer: ["Technical Development"], need: [] },
      },
    });
  });
  await open(page, u, "profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByText("Get help drafting your profile", { exact: true })
    .click();
  await page
    .getByLabel("Your notes", { exact: true })
    .fill("We build student tools and privacy engineering.");
  await page
    .getByRole("button", { name: "Generate draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use these suggestions", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Do you offer privacy engineering or need help with it?", {
      exact: true,
    })
    .fill("We need privacy engineering help.");
  await page
    .getByRole("button", { name: "Generate updated draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use these suggestions", exact: true })
    .click();
  await expect(page.getByLabel("What I need", { exact: true })).toHaveValue(
    "Privacy engineering",
  );
  await expect(page.getByLabel("Need tags", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: "Propose Privacy Engineering", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Submitted for review", exact: true }),
  ).toBeDisabled();
  await capture(page, "ai-clarification-tags-desktop");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect((await state(request, u)).state.profiles.founder.need).toBe(
    "Privacy engineering",
  );
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
    .getByRole("button", { name: "Request changes / reopen terms" })
    .click();
  await expect(page.getByLabel("Shared goal", { exact: true })).toBeEnabled();
  await page
    .getByLabel("Shared goal", { exact: true })
    .fill("Revised onboarding outcome");
  await page.getByRole("button", { name: "Lock terms & start" }).click();
  const other = await context.newPage();
  await open(other, a, `rooms/${id}`);
  await other.getByRole("button", { name: "Accept shared terms" }).click();
  await expect(
    page.getByText("Confirmed by both", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  const scope = page.locator(".milestone").filter({
    has: page.locator(".milestone-title", { hasText: "Scope defined" }),
  });
  await scope.getByText("Set due date", { exact: true }).click();
  await scope.getByLabel("Due date (UTC)").fill("2025-01-01");
  await scope.getByRole("button", { name: "Save due date" }).click();
  await expect(
    scope.getByText("Due 2025-01-01 (UTC)", { exact: true }),
  ).toBeVisible();
  await page.getByText("Close this collaboration", { exact: true }).click();
  await page.getByLabel("Reason for closing").fill("Changing priorities");
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
  await page
    .getByRole("button", { name: "Express interest", exact: true })
    .click();
  const next = await act(request, a, {
    action: "accept-interest",
    id: `${b.state.accountId}:founder`,
  });
  expect(next.state.activeRoomId).not.toBe(id);
  expect(next.state.rooms[id].status).toBe("cancelled");
});

test("weekly mentorship rescheduling and notification read state work on mobile", async ({
  page,
  request,
}) => {
  const { a, b, id } = await pair(request, true);
  await agree(request, a, b, id);
  await page.setViewportSize({ width: 360, height: 900 });
  await open(page, a, `rooms/${id}`);
  await page.getByRole("tab", { name: "Milestones", exact: true }).click();
  await page.getByText("Schedule session", { exact: true }).first().click();
  await page.getByLabel("Schedule session", { exact: true }).fill("2035-04-01");
  await page.getByLabel("Session time", { exact: true }).fill("10:00");
  await page.getByLabel("Weekly sessions (1–12)").fill("3");
  await page.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.getByText(/2035-04-15 · 10:00/)).toBeVisible();
  const scheduleDetails = page
    .locator("details")
    .filter({ has: page.getByText("Reschedule session", { exact: true }) });
  if ((await scheduleDetails.getAttribute("open")) === null)
    await page.getByText("Reschedule session", { exact: true }).click();
  await page.getByLabel("Schedule session", { exact: true }).fill("2035-04-02");
  await page.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.getByText(/2035-04-16 · 10:00/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture(page, "fixed-scheduling-mobile");
  await page.goto("/#/updates");
  await page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All updates (0 unread)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "All updates (0 unread)", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Digest frequency").selectOption("weekly");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  expect((await state(request, a)).state.notificationPreferences.digest).toBe(
    "weekly",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
  await report.getByLabel("Decision", { exact: true }).selectOption("resolved");
  await report.getByLabel("Resolution action").selectOption("resolve-disputes");
  await report
    .getByLabel("Reason / resolution")
    .fill("Reviewed evidence; both sides should confirm again");
  await report.getByRole("button", { name: "Save decision" }).click();
  await expect(report.locator("summary").first()).toContainText("resolved");
  expect(
    (await state(request, a)).state.rooms[id].milestones.scope.disputed,
  ).toBe(false);
  const tag = page.locator(".moderation-entry").filter({
    has: page.locator("summary", { hasText: "Accessible Onboarding" }),
  });
  await tag.locator("summary").click();
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

test("account recovery changes the password and returns to sign in without granting a session", async ({
  page,
  request,
}) => {
  const account = await user(request, "Recover");
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Account email").fill(account.email);
  await page
    .getByRole("button", { name: "Send reset code", exact: true })
    .click();
  const { code } = await (
    await request.get(
      `/__test__/email?address=${encodeURIComponent(account.email)}`,
    )
  ).json();
  await page.getByLabel("Reset code").fill(code);
  await page
    .getByLabel("New password", { exact: true })
    .fill("replacement-password");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    page.getByText(
      /Password updated. Sign in with your new password. Previous sessions/,
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("synergy-session")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy" }),
  ).toBeVisible();
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
  await expect(trust).toContainText("4/5 from 1 distinct collaborators");
  await trust
    .getByText("Completed engagement history (1)", { exact: true })
    .click();
  await expect(trust).toContainText("Beta Testing Exchange");
  await capture(page, "fixed-public-trust-desktop");
});
