import { selectValue } from "./ui-helpers.js";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { decode } from "../src/state/serialization.js";

async function post(request, path, data, token) {
  const result = await request.post(`/api/${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(result.ok(), await result.text()).toBe(true);
  return decode(await result.text());
}
const founderProfile = {
  bio: "Building accessible student tools",
  offer: "Technical development",
  need: "Product feedback",
  industry: "EdTech",
  stage: "idea",
  teamSize: "3",
  goals: "Validate onboarding",
};
const mentorProfile = {
  bio: "Advising early startup teams",
  offer: "Product feedback",
  need: "Focused questions",
  expertise: "Product feedback",
  availability: "Weekly",
  startups: "EdTech idea stage",
  goals: "Validate onboarding",
};
async function account(request, role) {
  const name = `${role === "mentor" ? "Advisor" : "Startup"}${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const u = await post(request, "signup", {
    firstName: name,
    lastName: "Review",
    email: `${name}@example.com`,
    password: "private-password",
    role,
  });
  u.role = role;
  u.name = `${name} Review`;
  await post(
    request,
    "action",
    {
      role,
      form: "profile-form",
      values: role === "mentor" ? mentorProfile : founderProfile,
    },
    u.token,
  );
  // New mentors accept the guidelines before taking requests.
  if (role === "mentor")
    await post(
      request,
      "action",
      { role, form: "accept-guidelines", values: { version: 2 } },
      u.token,
    );
  return u;
}
async function open(page, u, path = "") {
  await page.addInitScript(
    (token) => sessionStorage.setItem("synergy-session", token),
    u.token,
  );
  await page.goto(`/#/${path}`);
}
async function state(request, u) {
  return decode(
    await (
      await request.get(`/api/state?role=${u.role}`, {
        headers: { Authorization: `Bearer ${u.token}` },
      })
    ).text(),
  ).state;
}
async function checkLayout(page, name, testInfo, axe = true) {
  const dismiss = page.getByRole("button", {
    name: "Dismiss notification",
    exact: true,
  });
  if (await dismiss.isVisible()) {
    try {
      await dismiss.click({ timeout: 1500 });
    } catch (error) {
      // A success toast may expire between the visibility check and click.
      // Keep real dismissal failures visible, but do not wait for a new toast.
      if (await dismiss.isVisible()) throw error;
    }
  }
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `output/playwright/phase6/${testInfo.project.name}-${name}-${width}.png`,
      fullPage: true,
    });
  }
  if (axe) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

for (const initiator of ["founder", "mentor"]) {
  test(`${initiator}-initiated mentorship opens a format-specific room`, async ({
    page,
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(60000);
    const founder = await account(request, "founder");
    const mentor = await account(request, "mentor");
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
    });
    const inbox = await context.newPage();
    try {
      const sender = initiator === "founder" ? founder : mentor;
      const receiver = initiator === "founder" ? mentor : founder;
      await open(
        page,
        sender,
        `matches/${receiver.state.accountId}:${receiver.role}`,
      );
      if (initiator === "founder") {
        await page
          .getByLabel("What's the problem?")
          .fill("Student founders leave our product during onboarding.");
        await page
          .getByLabel("What have you already tried?")
          .fill("We interviewed 12 teams and shortened the signup flow.");
        await page
          .getByLabel("What specific question do you want answered?")
          .fill("Which onboarding experiment should we prioritize next?");
        await page
          .getByRole("button", { name: "Send mentorship request" })
          .click();
      } else {
        await page
          .getByLabel("Add a short note (optional)")
          .fill("Let's review your current onboarding goals.");
        await page
          .getByRole("button", { name: "Send introduction", exact: true })
          .click();
      }
      await open(
        inbox,
        receiver,
        initiator === "founder" ? "requests" : "waiting",
      );
      await inbox
        .getByRole("button", {
          name: initiator === "founder" ? /^Accept$/ : /^Accept introduction/,
        })
        .click();
      await expect(
        inbox.getByRole("heading", { name: "Mentorship Room", exact: true }),
      ).toBeVisible();
      await expect(
        inbox.getByRole("tab", { name: "Terms", exact: true }),
      ).toHaveCount(0);
      const id = (await state(request, receiver)).activeRoomId;
      if (initiator === "founder") {
        await inbox.getByRole("button", { name: "Confirm goal" }).click();
        await expect(
          inbox.getByText("Goal Confirmed", { exact: true }),
        ).toHaveAttribute("aria-current", "step");
      }
      await page.goto(`/#/rooms/${id}`);
      await page.getByRole("tab", { name: "Notes" }).click();
      await page
        .getByLabel("New session note")
        .fill("Review activation, retention and the new signup flow.");
      await page.getByRole("button", { name: "Add note" }).click();
      await expect(
        page.getByText("Review activation, retention and the new signup flow."),
      ).toBeVisible();
      await checkLayout(page, `${initiator}-mentorship-room`, testInfo);
    } finally {
      await context.close();
    }
  });
}

test("mentor requests can be withdrawn and declined, remain consistent after refresh and reject exchange types", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const founder = await account(request, "founder"),
    mentor = await account(request, "mentor");
  await post(
    request,
    "action",
    {
      role: "founder",
      form: "profile-form",
      values: {
        ...founderProfile,
        name: "CampusAccessibilityAndStudentSuccessResearchCollective",
        bio: "Building accessible onboarding for student founders. ".repeat(28),
        goals:
          "Agree three improvements to the student onboarding experience. ".repeat(
            8,
          ),
      },
    },
    founder.token,
  );
  const otherContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
  });
  const other = await otherContext.newPage();
  try {
    const invalid = await request.post("/api/action", {
      headers: { Authorization: `Bearer ${mentor.token}` },
      data: {
        role: "mentor",
        action: "interest",
        id: `${founder.state.accountId}:founder`,
        engagementType: "beta",
      },
    });
    expect(invalid.status()).toBe(400);
    await open(
      page,
      mentor,
      `matches/${encodeURIComponent(`${founder.state.accountId}:founder`)}`,
    );
    await open(other, founder, "waiting");
    await page
      .getByRole("button", { name: "Send introduction", exact: true })
      .click();
    await checkLayout(page, "long-startup-request", testInfo);
    await expect(
      other.getByRole("button", { name: /^Accept introduction/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Withdraw/ }).click();
    await expect(
      other.getByRole("button", { name: /^Accept introduction/ }),
    ).toHaveCount(0);
    await other.reload();
    await expect(other.getByText(/No pending introductions/)).toBeVisible();
    await page.goto(
      `/#/matches/${encodeURIComponent(`${founder.state.accountId}:founder`)}`,
    );
    await page
      .getByRole("button", { name: "Send introduction", exact: true })
      .click();
    await other.getByRole("button", { name: /^Decline/ }).click();
    await other
      .getByRole("dialog")
      .getByRole("button", { name: "Decline introduction", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /^Withdraw/ })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(page.getByText(/No new mentorship requests/)).toBeVisible();
    expect(Object.keys((await state(request, mentor)).rooms)).toHaveLength(0);
    expect(Object.keys((await state(request, founder)).rooms)).toHaveLength(0);
  } finally {
    await otherContext.close();
  }
});

test("mentor profile retains an interrupted save through repeated polling outages and recovery", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const mentor = await account(request, "mentor");
  await open(page, mentor, "profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("Past experience", { exact: true })
    .fill("Draft mentoring experience survives the outage");
  let polls = 0;
  await page.route("**/api/state*", (route) => {
    polls++;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary interruption" }),
    });
  });
  await expect(
    page.getByText("Connection interrupted", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect.poll(() => polls, { timeout: 12000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".workspace-connection")).toHaveCount(1);
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Save interrupted" }),
    }),
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByLabel("Past experience", { exact: true })).toHaveValue(
    "Draft mentoring experience survives the outage",
  );
  await expect(page.locator(".workspace-connection")).toHaveCount(1);
  await page.unroute("**/api/state*");
  await page.unroute("**/api/profile");
  await expect(page.locator(".workspace-connection")).toHaveCount(0, {
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Draft mentoring experience survives the outage", {
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/api/state*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Second interruption" }),
    }),
  );
  await expect(page.locator(".workspace-connection")).toHaveCount(1, {
    timeout: 10000,
  });
  await page.unroute("**/api/state*");
  await expect(page.locator(".workspace-connection")).toHaveCount(0, {
    timeout: 10000,
  });
});

test("mentors navigate by requests, mentees and calendar while founders keep matches", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.setTimeout(60000);
  const mentor = await account(request, "mentor");
  const founder = await account(request, "founder");
  await open(page, mentor);
  const main = page.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["Home", "Requests", "Mentees", "Calendar"])
    await expect(main.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of ["Matches", "Introductions", "Deal Rooms"])
    await expect(main.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await main.getByRole("button", { name: "Requests", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Requests" }),
  ).toBeVisible();
  await expect(page.getByText(/No new mentorship requests/)).toBeVisible();
  await page.getByRole("button", { name: "Browse startups" }).click();
  await expect(page).toHaveURL(/#\/matches$/);
  await main.getByRole("button", { name: "Mentees", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Mentees" }),
  ).toBeVisible();
  await main.getByRole("button", { name: "Requests", exact: true }).click();
  await expect(page).toHaveURL(/#\/requests$/);
  await checkLayout(page, "mentor-requests", testInfo);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(
    menu.getByRole("button", { name: "Calendar", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Matches", exact: true }),
  ).toHaveCount(0);

  const founderContext = await browser.newContext();
  const founderPage = await founderContext.newPage();
  try {
    await open(founderPage, founder);
    const founderNav = founderPage.getByRole("navigation", {
      name: "Main navigation",
    });
    for (const name of ["Matches", "Introductions", "Deal Rooms"])
      await expect(
        founderNav.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    await expect(
      founderNav.getByRole("button", { name: "Requests", exact: true }),
    ).toHaveCount(0);
  } finally {
    await founderContext.close();
  }
});
