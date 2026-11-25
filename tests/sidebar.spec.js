// The collapsible sidebar, for founders and mentors: desktop keeps the
// choice per browser, tablets open the full sidebar over the page, and
// phones keep the drawer.
import { test, expect } from "@playwright/test";
import { command, open, post, user } from "./founder-browser-helpers.js";
import { mentorRequestValues } from "./mentor-request-fixtures.js";
import { confirmSignOut } from "./ui-helpers.js";

const desktop = { width: 1440, height: 900 };
const tablet = { width: 1024, height: 768 };
const phone = { width: 390, height: 844 };
const mentorProfile = {
  bio: "Product mentor for student teams.",
  offer: "Product strategy",
  need: "Focused questions",
  expertise: "Product strategy",
  startups: "EdTech student tools",
};
const founderPages = [
  "home",
  "discover",
  "waiting",
  "rooms",
  "notifications",
  "settings",
];
const mentorPages = [
  "home",
  "requests",
  "discover",
  "mentees",
  "calendar",
  "impact",
  "notifications",
  "settings",
];

const sidebar = (page) => page.locator("#workspace-sidebar");
const toggle = (page) =>
  page.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });

async function visitEveryLink(page, pages) {
  for (const id of pages) {
    const link = sidebar(page).locator(`.nav-btn[data-page="${id}"]`);
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".page h1").first()).toBeVisible();
  }
}

for (const role of ["founder", "mentor"]) {
  test(`a ${role} collapses and expands the desktop sidebar and every link works`, async ({
    page,
    request,
  }) => {
    const account = await user(
      request,
      `Sidebar${role}`,
      role === "mentor" ? mentorProfile : undefined,
      role,
    );
    await page.setViewportSize(desktop);
    await open(page, account);
    const pages = role === "mentor" ? mentorPages : founderPages;
    await expect(toggle(page)).toHaveAccessibleName("Collapse sidebar");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(toggle(page)).toHaveAttribute(
      "aria-controls",
      "workspace-sidebar",
    );
    await visitEveryLink(page, pages);

    await toggle(page).click();
    await expect(sidebar(page)).toHaveClass(/is-rail/);
    await expect(toggle(page)).toHaveAccessibleName("Expand sidebar");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(toggle(page)).toBeFocused();
    await expect
      .poll(() => sidebar(page).evaluate((node) => node.offsetWidth))
      .toBe(90);
    // Icons keep their names and tooltips.
    const home = sidebar(page).locator('.nav-btn[data-page="home"]');
    await expect(home).toHaveAttribute("title", "Home");
    await visitEveryLink(page, pages);

    await toggle(page).click();
    await expect(sidebar(page)).not.toHaveClass(/is-rail/);
    await expect(toggle(page)).toBeFocused();
    expect(
      await page.evaluate(() => localStorage.getItem("synergy-sidebar")),
    ).toBe("expanded");
  });
}

test("the collapsed sidebar survives a reload and signing in again, without showing open first", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarReload");
  await page.setViewportSize(desktop);
  await open(page, account);
  await toggle(page).click();
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  // Any open sidebar drawn while the page loads would count as a flash.
  await page.addInitScript(() => {
    window.sidebarFlash = false;
    new MutationObserver(() => {
      if (document.querySelector(".sidebar:not(.is-rail)"))
        window.sidebarFlash = true;
    }).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(
    await page.evaluate(() => document.documentElement.dataset.sidebar),
  ).toBe("collapsed");
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  expect(await page.evaluate(() => window.sidebarFlash)).toBe(false);

  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await confirmSignOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(account.state.accountEmail);
  await page.getByLabel("Password", { exact: true }).fill("private-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  expect(await page.evaluate(() => window.sidebarFlash)).toBe(false);
});

test("incoming introductions and requests show as a badge on the rail icon", async ({
  page,
  browser,
  request,
}) => {
  const founder = await user(request, "SidebarBadge");
  const peer = await user(request, "SidebarPeer");
  await command(request, peer, {
    action: "interest",
    id: `${founder.state.accountId}:founder`,
  });
  const mentor = await user(request, "SidebarMentor", mentorProfile, "mentor");
  await command(request, founder, {
    action: "send-request",
    id: `${mentor.state.accountId}:mentor`,
    values: mentorRequestValues,
  });
  for (const [account, id] of [
    [founder, "waiting"],
    [mentor, "requests"],
  ]) {
    const context = await browser.newContext({ viewport: desktop });
    const tab = await context.newPage();
    try {
      await tab.addInitScript(() =>
        localStorage.setItem("synergy-sidebar", "collapsed"),
      );
      await open(tab, account);
      const link = sidebar(tab).locator(`.nav-btn[data-page="${id}"]`);
      const badge = link.locator(".nav-count");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("1");
      await expect(link).toHaveAccessibleName(/, 1 waiting for you$/);
      // The badge sits on the icon, inside the rail.
      const [icon, mark] = await Promise.all([
        link.locator(".nav-icon").boundingBox(),
        badge.boundingBox(),
      ]);
      expect(mark.y).toBeLessThan(icon.y + icon.height);
      expect(mark.x + mark.width).toBeLessThanOrEqual(90);
    } finally {
      await context.close();
    }
  }
});

test("the rail's avatar menu switches role and signs out, by mouse and keyboard", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarBoth");
  // Opening the mentor side once gives the account both roles.
  await command(request, account, {
    action: "choose-role",
    roleChoice: "mentor",
  });
  const asMentor = { ...account, role: "mentor" };
  await command(request, asMentor, {
    form: "profile-form",
    values: mentorProfile,
  });
  await command(request, asMentor, {
    form: "accept-guidelines",
    values: { version: 2 },
  });
  await command(request, asMentor, {
    action: "choose-role",
    roleChoice: "founder",
  });
  await page.setViewportSize(desktop);
  await page.addInitScript(() =>
    localStorage.setItem("synergy-sidebar", "collapsed"),
  );
  await open(page, account);
  const avatar = page.getByRole("button", { name: /^Account menu for / });
  const menu = page.getByRole("menu", { name: /^Account menu for / });
  await expect(avatar).toHaveAttribute("aria-haspopup", "menu");

  // Esc and an outside click close the menu and return focus to the avatar.
  await avatar.click();
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Switch to mentor" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(avatar).toBeFocused();
  await avatar.click();
  await page.mouse.click(900, 500);
  await expect(menu).toBeHidden();
  await expect(avatar).toBeFocused();

  // Keyboard: Enter opens, arrows move, Enter switches role.
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const switchItem = menu.getByRole("menuitem", { name: "Switch to mentor" });
  await expect(switchItem).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    sidebar(page).locator('.nav-btn[data-page="requests"]'),
  ).toBeVisible();
  await expect(sidebar(page)).toHaveClass(/is-rail/);

  await avatar.click();
  await menu.getByRole("menuitem", { name: "Switch to founder" }).click();
  await expect(
    sidebar(page).locator('.nav-btn[data-page="waiting"]'),
  ).toBeVisible();

  await avatar.click();
  await menu.getByRole("menuitem", { name: "Sign out" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign out of Synergy?" });
  await dialog.getByRole("button", { name: "Keep working" }).click();
  await expect(avatar).toBeFocused();
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Sign out" }).click();
  await confirmSignOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy", exact: true }),
  ).toBeVisible();
});

test("the moderator's Moderation link stays on the rail", async ({
  page,
  request,
}) => {
  const credentials = {
    firstName: "Moderator",
    lastName: "Audit",
    email: "moderator@example.com",
    password: "private-password",
    role: "founder",
  };
  const signup = await request.post("/api/signup", { data: credentials });
  const admin = signup.ok()
    ? JSON.parse(await signup.text())
    : await post(request, "login", credentials);
  admin.role = "founder";
  await page.setViewportSize(desktop);
  await page.addInitScript(() =>
    localStorage.setItem("synergy-sidebar", "collapsed"),
  );
  await open(page, admin);
  const moderation = sidebar(page).locator('.nav-btn[data-page="moderation"]');
  await expect(moderation).toBeVisible();
  await moderation.click();
  await expect(moderation).toHaveAttribute("aria-current", "page");
});

test("on a tablet the sidebar opens over the page and closes on Esc, outside click and navigation", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarTablet");
  await page.setViewportSize(tablet);
  await open(page, account);
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  const main = page.locator("#main-content");
  const before = await main.boundingBox();

  await toggle(page).click();
  await expect(sidebar(page)).toHaveClass(/is-overlay/);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(toggle(page)).toBeFocused();
  // The page does not move; the sidebar lies over it.
  expect((await main.boundingBox()).x).toBe(before.x);
  // The sidebar widens over 200ms.
  await expect
    .poll(() => sidebar(page).evaluate((node) => node.offsetWidth))
    .toBe(252);
  expect((await main.boundingBox()).x).toBe(before.x);
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);
  await expect(toggle(page)).toBeFocused();

  await toggle(page).click();
  await page.mouse.click(800, 400);
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);

  await toggle(page).click();
  await sidebar(page).locator('.nav-btn[data-page="rooms"]').click();
  await expect(page).toHaveURL(/#\/rooms$/);
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  // The tablet overlay is never remembered.
  expect(
    await page.evaluate(() => localStorage.getItem("synergy-sidebar")),
  ).toBe(null);
  // Sign out lives in the rail's account menu on tablets.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
});

test("on a phone there is no sidebar toggle and the drawer still opens", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarPhone");
  await page.setViewportSize(phone);
  await page.addInitScript(() =>
    localStorage.setItem("synergy-sidebar", "collapsed"),
  );
  await open(page, account);
  await expect(toggle(page)).toBeHidden();
  await expect(sidebar(page)).toBeHidden();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const drawer = page.getByRole("navigation", { name: "Mobile navigation" });
  await drawer.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(page).toHaveURL(/#\/rooms$/);
});

test("keyboard users reach the toggle, the rail links and the avatar menu with visible focus", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarKeys");
  await page.setViewportSize(desktop);
  await open(page, account);
  // Each walk starts at the top of the page; Firefox does not wrap from the
  // end of the page back to the sidebar.
  const focusTo = async (locator) => {
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.removeAttribute("tabindex");
    });
    for (let step = 0; step < 40; step += 1) {
      if (await locator.evaluate((node) => node === document.activeElement))
        return;
      await page.keyboard.press("Tab");
    }
    throw new Error("Not reachable with Tab");
  };
  const outline = (locator) =>
    locator.evaluate((node) => getComputedStyle(node).outlineStyle);

  await focusTo(toggle(page));
  expect(await outline(toggle(page))).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  await expect(toggle(page)).toBeFocused();

  const matches = sidebar(page).locator('.nav-btn[data-page="discover"]');
  await focusTo(matches);
  expect(await outline(matches)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(matches).toHaveAttribute("aria-current", "page");

  const avatar = page.getByRole("button", { name: /^Account menu for / });
  await focusTo(avatar);
  expect(await outline(avatar)).not.toBe("none");
  await page.keyboard.press("Enter");
  const signOut = page.getByRole("menuitem", { name: "Sign out" });
  await expect(signOut).toBeFocused();
  expect(await outline(signOut)).not.toBe("none");
  // Tab leaves the menu and closes it.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu")).toBeHidden();
});

// Samples the toggle and the Updates and Settings icons on every frame of
// one transition, after slowing it so the samples land mid-animation.
async function sampleTransition(page, click) {
  return page.evaluate(async (point) => {
    const centre = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const pick = () => ({
      width: document.querySelector("#workspace-sidebar").offsetWidth,
      toggle: centre(".sidebar-toggle"),
      updates: centre('.sidebar .nav-btn[data-page="notifications"] .nav-icon'),
      settings: centre('.sidebar .nav-btn[data-page="settings"] .nav-icon'),
    });
    const frames = [pick()];
    document.elementFromPoint(point.x, point.y).closest("button").click();
    const start = performance.now();
    while (performance.now() - start < 900) {
      await new Promise(requestAnimationFrame);
      frames.push(pick());
    }
    return frames;
  }, click);
}

// Waits until the sidebar has stopped changing width.
async function settle(page) {
  let last = -1;
  await expect
    .poll(async () => {
      const width = await sidebar(page).evaluate((node) => node.offsetWidth);
      const steady = width === last;
      last = width;
      return steady;
    })
    .toBe(true);
}

const spread = (frames, read) => {
  const values = frames.map(read);
  return Math.max(...values) - Math.min(...values);
};

for (const [layout, viewport] of [
  ["desktop", desktop],
  ["tablet", tablet],
]) {
  for (const role of ["founder", "mentor"]) {
    test(`on ${layout}, a ${role}'s toggle, Updates and Settings stay still through the whole animation`, async ({
      page,
      request,
    }) => {
      const account = await user(
        request,
        `SidebarSteady${role}`,
        role === "mentor" ? mentorProfile : undefined,
        role,
      );
      await page.setViewportSize(viewport);
      await open(page, account);
      // Slowed down, so frames are sampled while the width is changing.
      await page.addStyleTag({
        content: ":root { --duration-base: 600ms; --duration-fast: 400ms; }",
      });
      await settle(page);
      const startRail = /is-rail/.test(
        await sidebar(page).getAttribute("class"),
      );
      const box = await toggle(page).boundingBox();
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      // Centred in the 90px rail.
      expect(Math.abs(point.x - 45)).toBeLessThanOrEqual(1);
      for (const step of ["first", "second"]) {
        const frames = await sampleTransition(page, point);
        const widths = frames.map(({ width }) => width);
        expect(
          widths.some((width) => width > 95 && width < 245),
          `${step} click is sampled mid-animation`,
        ).toBe(true);
        for (const key of ["toggle", "updates", "settings"])
          expect(
            spread(frames, (frame) => frame[key].y),
            `${key} stays level on the ${step} click`,
          ).toBeLessThanOrEqual(1);
        expect(spread(frames, (frame) => frame.toggle.x)).toBeLessThanOrEqual(
          1,
        );
      }
      // Two clicks at the same point opened and closed it again.
      expect(/is-rail/.test(await sidebar(page).getAttribute("class"))).toBe(
        startRail,
      );
    });
  }
}

test("two clicks at the same point open and close the sidebar, even when the second reverses it mid-animation", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarReverse");
  for (const viewport of [desktop, tablet]) {
    await page.setViewportSize(viewport);
    await open(page, account);
    await page.addStyleTag({
      content: ":root { --duration-base: 600ms; --duration-fast: 400ms; }",
    });
    await settle(page);
    const box = await toggle(page).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const startWidth = await sidebar(page).evaluate((node) => node.offsetWidth);
    const startExpanded = await toggle(page).getAttribute("aria-expanded");

    // Settled: open or close, then back, without moving the pointer.
    await page.mouse.click(x, y);
    await expect(toggle(page)).not.toHaveAttribute(
      "aria-expanded",
      startExpanded,
    );
    await page.waitForTimeout(700);
    await page.mouse.click(x, y);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", startExpanded);
    await expect
      .poll(() => sidebar(page).evaluate((node) => node.offsetWidth))
      .toBe(startWidth);

    // Rapid: the second click lands mid-animation and turns it back from
    // where it is.
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    const midWidth = await sidebar(page).evaluate((node) => node.offsetWidth);
    expect(midWidth).not.toBe(startWidth);
    await page.mouse.click(x, y);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", startExpanded);
    const afterReverse = await sidebar(page).evaluate(
      (node) => node.offsetWidth,
    );
    // It turns back from the current width rather than jumping to an end.
    expect(Math.abs(afterReverse - midWidth)).toBeLessThan(60);
    await expect
      .poll(() => sidebar(page).evaluate((node) => node.offsetWidth))
      .toBe(startWidth);
    await expect(toggle(page)).toBeFocused();
  }
});
