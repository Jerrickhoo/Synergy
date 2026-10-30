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
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
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
  test(`${initiator}-initiated mentorship completes mutually and releases only both private reviews`, async ({
    page,
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(90000);
    const founder = await account(request, "founder");
    const mentor = await account(request, "mentor");
    const otherContext = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
    });
    const other = await otherContext.newPage();
    try {
      page.on("pageerror", (error) => {
        throw error;
      });
      other.on("pageerror", (error) => {
        throw error;
      });
      const sender = initiator === "mentor" ? mentor : founder;
      const receiver = initiator === "mentor" ? founder : mentor;
      await open(page, sender, "matches");
      await open(other, receiver, "waiting");
      await page.getByRole("tab", { name: "Browse all", exact: true }).click();
      await page
        .getByLabel("Search matches", { exact: true })
        .fill(receiver.name);
      const card = page
        .locator(".match-card")
        .filter({ hasText: receiver.name });
      if (initiator === "mentor")
        await expect(card).toContainText("Needs guidance with");
      await card
        .getByRole("button", { name: "Save match", exact: true })
        .click();
      await expect(
        card.getByRole("button", { name: "Remove from saved matches" }),
      ).toHaveAttribute("aria-pressed", "true");
      await card
        .getByRole("button", { name: "View match", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Collaboration type", exact: true })
        .click();
      await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(
        1,
      );
      await page
        .getByRole("option", { name: "Mentorship", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Express interest", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Withdraw", exact: true }),
      ).toBeVisible();
      const intro = other
        .locator(".introduction-row")
        .filter({ hasText: sender.name });
      if (initiator === "founder") {
        await expect(intro).toContainText("Validate onboarding");
        await expect(intro).toContainText("Product feedback");
        await checkLayout(other, "mentor-request", testInfo);
      }
      await intro
        .getByRole("button", { name: "Accept introduction", exact: true })
        .click();
      await expect(
        other.getByRole("heading", {
          name: "Mentorship Engagement",
          exact: true,
        }),
      ).toBeVisible();
      const id = (await state(request, receiver)).activeRoomId;
      await page.goto(`/#/rooms/${id}`);
      await page
        .getByLabel("Shared goal", { exact: true })
        .fill("Validate onboarding together");
      await page
        .getByLabel("Scope and deliverables")
        .fill("Review the first-use flow and agree next steps");
      await page.getByLabel("Timeline", { exact: true }).fill("Two weeks");
      await page
        .getByLabel("Commitment", { exact: true })
        .fill("One 45 minute session");
      await page
        .getByLabel("Mentoring arrangement", { exact: true })
        .fill("Voluntary guidance");
      await page
        .getByRole("button", {
          name: "Confirm mentoring agreement",
          exact: true,
        })
        .click();
      await other
        .getByRole("button", { name: "Accept shared terms", exact: true })
        .click();
      await expect(
        page.getByText("Confirmed by both", { exact: true }),
      ).toBeVisible();
      if (initiator === "mentor")
        await checkLayout(page, "mentorship-goals", testInfo);
      await page.getByRole("tab", { name: "Schedule", exact: true }).click();
      await page.getByLabel("Session date", { exact: true }).fill("2035-04-01");
      await page
        .getByLabel("Or choose another time", { exact: true })
        .fill("10:00");
      await selectValue(
        page.getByLabel("Session duration", { exact: true }),
        "45",
      );
      await page
        .getByRole("button", { name: "Review schedule", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save session schedule", exact: true })
        .click();
      await expect(
        page.getByText("Your session schedule is saved.", { exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Task board", exact: true }).click();
      await page
        .getByRole("button", { name: "+ Add task", exact: true })
        .click();
      await page
        .getByLabel("Task title", { exact: true })
        .fill("Prepare mentoring feedback");
      await selectValue(
        page.getByLabel("Owner", { exact: true }),
        mentor.state.accountId,
      );
      await page
        .getByRole("button", { name: "Create task", exact: true })
        .click();
      const mentorPage = initiator === "mentor" ? page : other;
      await mentorPage.goto("/#/");
      await expect(
        mentorPage.getByRole("region", { name: "Mentoring overview" }),
      ).toContainText("Active rooms");
      await expect(
        mentorPage
          .getByText("Prepare mentoring feedback", { exact: true })
          .first(),
      ).toBeVisible();
      if (initiator === "mentor")
        await checkLayout(mentorPage, "mentor-home", testInfo);
      for (const p of [page, other]) {
        await p.goto(`/#/rooms/${id}`);
        await p.getByRole("tab", { name: "Milestones", exact: true }).click();
      }
      await expect(
        page.getByRole("button", { name: "Complete mentorship", exact: true }),
      ).toBeDisabled();
      const guidance = page.locator(".milestone").filter({
        has: page.locator(".milestone-title", {
          hasText: "Guidance delivered",
        }),
      });
      await guidance
        .getByRole("button", { name: "Attach evidence", exact: true })
        .click();
      await guidance
        .getByLabel("Or add an evidence description or link")
        .fill(
          "Discussed the onboarding flow and recorded three recommendations",
        );
      await guidance
        .getByRole("button", { name: "Attach", exact: true })
        .click();
      // Each participant independently confirms what happened in this walkthrough.
      for (const p of [page, other]) {
        const buttons = p.getByRole("button", {
          name: "Confirm yours",
          exact: true,
        });
        await expect(buttons).toHaveCount(5);
        for (let i = 0; i < 5; i++) await buttons.first().click();
      }
      await expect(
        page.getByRole("button", { name: "Complete mentorship", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Complete mentorship", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "How did it go?" }),
      ).toBeVisible();
      await expect(
        other.getByText("Mentorship completed", { exact: true }),
      ).toBeVisible();
      await page.getByRole("radio", { name: "4 stars", exact: true }).check();
      await page
        .getByLabel("A note about working together")
        .fill("Private mentoring feedback from first reviewer");
      await page
        .getByRole("button", { name: "Submit private review", exact: true })
        .click();
      await other
        .getByRole("button", { name: "View your review", exact: true })
        .click();
      await expect(
        other.getByText("Private mentoring feedback from first reviewer", {
          exact: true,
        }),
      ).toHaveCount(0);
      const withheld = await state(request, receiver);
      expect(withheld.rooms[id].review.partnerNote).toBeFalsy();
      await other.getByRole("radio", { name: "5 stars", exact: true }).check();
      await other
        .getByLabel("A note about working together")
        .fill("Helpful shared guidance");
      await other
        .getByRole("button", { name: "Submit private review", exact: true })
        .click();
      await expect(
        other.getByText("Private mentoring feedback from first reviewer", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Helpful shared guidance", { exact: true }),
      ).toBeVisible();
      expect((await state(request, mentor)).rooms[id].status).toBe("reviewed");
      if (initiator === "mentor")
        await checkLayout(page, "mentorship-reviewed", testInfo);
    } finally {
      await otherContext.close();
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
      .getByRole("button", { name: "Express interest", exact: true })
      .click();
    await checkLayout(page, "long-startup-request", testInfo);
    await expect(
      other.getByRole("button", { name: "Accept introduction", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Withdraw", exact: true }).click();
    await expect(
      other.getByRole("button", { name: "Accept introduction", exact: true }),
    ).toHaveCount(0);
    await other.reload();
    await expect(other.getByText(/No pending introductions/)).toBeVisible();
    await page.goto(
      `/#/matches/${encodeURIComponent(`${founder.state.accountId}:founder`)}`,
    );
    await page
      .getByRole("button", { name: "Express interest", exact: true })
      .click();
    await other.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Withdraw", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/No pending introductions/)).toBeVisible();
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
