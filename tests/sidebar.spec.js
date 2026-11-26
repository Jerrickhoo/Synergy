// The collapsible sidebar, for founders and mentors: its edge is a handle
// you drag (or click, or move with the arrow keys) to open or close it.
// Desktop keeps the choice per browser, tablets open the full sidebar over
// the page, and phones keep the drawer. The footer holds only Sign out; the
// signed-in person shows at the top right.
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
  "activity",
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
  "activity",
  "notifications",
  "settings",
];

const sidebar = (page) => page.locator("#workspace-sidebar");
const handle = (page) =>
  page.getByRole("separator", { name: "Resize sidebar", exact: true });
const width = (page) =>
  sidebar(page).evaluate((node) => node.getBoundingClientRect().width);

async function visitEveryLink(page, pages) {
  for (const id of pages) {
    const link = sidebar(page).locator(`.nav-btn[data-page="${id}"]`);
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".page h1").first()).toBeVisible();
  }
}

// Presses on the handle, moves to `toX` in small steps and lets go. With
// `hold`, it checks the page while the pointer is still down. The handle
// slides with the sidebar's edge, so it is grabbed once it has stopped.
async function drag(page, toX, hold) {
  let last = null;
  await expect
    .poll(async () => {
      const { x } = await handle(page).boundingBox();
      const steady = x === last;
      last = x;
      return steady;
    })
    .toBe(true);
  const box = await handle(page).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (toX - x) / 2, y, { steps: 4 });
  await page.mouse.move(toX, y, { steps: 4 });
  if (hold) await hold();
  await page.mouse.up();
}

for (const role of ["founder", "mentor"]) {
  test(`a ${role} drags the sidebar's edge to collapse and expand it, and every link works`, async ({
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
    // No toggle button any more: the edge is the control.
    await expect(
      page.getByRole("button", { name: /(Collapse|Expand) sidebar/ }),
    ).toHaveCount(0);
    await expect(handle(page)).toHaveAttribute("aria-valuetext", "Expanded");
    await expect(handle(page)).toHaveAttribute(
      "aria-controls",
      "workspace-sidebar",
    );
    await expect(handle(page)).toHaveAttribute("aria-orientation", "vertical");
    await visitEveryLink(page, pages);

    // While dragging, the sidebar follows the pointer; letting go past the
    // middle snaps it to the icon rail.
    await drag(page, 120, async () => {
      await expect.poll(() => width(page)).toBeLessThan(140);
    });
    await expect(sidebar(page)).toHaveClass(/is-rail/);
    await expect(handle(page)).toHaveAttribute("aria-valuetext", "Collapsed");
    await expect.poll(() => width(page)).toBe(90);
    // Icons keep their names and tooltips.
    const home = sidebar(page).locator('.nav-btn[data-page="home"]');
    await expect(home).toHaveAttribute("title", "Home");
    await visitEveryLink(page, pages);
    expect(
      await page.evaluate(() => localStorage.getItem("synergy-sidebar")),
    ).toBe("collapsed");

    // A short drag that stays near the rail leaves it closed.
    await drag(page, 140);
    await expect(sidebar(page)).toHaveClass(/is-rail/);

    // Dragging out opens it again at its full width.
    await drag(page, 300);
    await expect(sidebar(page)).not.toHaveClass(/is-rail/);
    await expect.poll(() => width(page)).toBe(252);
    expect(
      await page.evaluate(() => localStorage.getItem("synergy-sidebar")),
    ).toBe("expanded");
  });
}

test("a click on the edge toggles the sidebar, and the arrow keys move it", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarClick");
  await page.setViewportSize(desktop);
  await open(page, account);
  await handle(page).click();
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  await expect(handle(page)).toBeFocused();
  await handle(page).click();
  await expect(sidebar(page)).not.toHaveClass(/is-rail/);

  await handle(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  await page.keyboard.press("ArrowRight");
  await expect(sidebar(page)).not.toHaveClass(/is-rail/);
  await page.keyboard.press("Enter");
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  await page.keyboard.press("End");
  await expect(sidebar(page)).not.toHaveClass(/is-rail/);
});

test("the collapsed sidebar survives a reload and signing in again, without showing open first", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarReload");
  await page.setViewportSize(desktop);
  await open(page, account);
  await handle(page).click();
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

  // Sign out keeps its place on the rail, as an icon.
  await sidebar(page).getByRole("button", { name: "Sign out" }).click();
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

test("the footer is a red Sign out, and the name and role show beside the photo at the top right", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarFooter");
  await page.setViewportSize(desktop);
  await open(page, account);
  const footer = sidebar(page).locator(".sidebar-signout-row");
  const signOut = footer.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();
  await expect(signOut).toContainText("Sign out");
  // The footer no longer repeats the avatar, name or role.
  await expect(footer.locator(".avatar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Account menu for / }),
  ).toHaveCount(0);
  // A warning: strong red text (the red channel clearly leads) on the
  // sidebar, without a filled background.
  const [red, green, blue] = (
    await signOut.evaluate((node) => getComputedStyle(node).color)
  )
    .match(/\d+/g)
    .map(Number);
  expect(red).toBeGreaterThan(green + 100);
  expect(red).toBeGreaterThan(blue + 100);
  await expect(signOut).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const account_ = page.getByRole("button", { name: /^Open profile for / });
  await expect(account_.locator(".account-copy")).toBeVisible();
  await expect(account_).toContainText(account.state.accountName);
  await expect(account_).toContainText("Startup founder");
  // The tagline fills the header beside them.
  await expect(page.locator(".topbar-tagline")).toHaveText(
    "Find your missing piece",
  );

  await signOut.click();
  const dialog = page.getByRole("dialog", { name: "Sign out of Synergy?" });
  await dialog.getByRole("button", { name: "Keep working" }).click();
  await expect(signOut).toBeFocused();
  await signOut.click();
  await confirmSignOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Synergy", exact: true }),
  ).toBeVisible();
});

test("incoming requests show as a badge on the rail icon", async ({
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

test("on a tablet the edge opens the sidebar over the page, which closes on Esc, outside click and navigation", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarTablet");
  await page.setViewportSize(tablet);
  await open(page, account);
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  const main = page.locator("#main-content");
  const before = await main.boundingBox();

  await handle(page).click();
  await expect(sidebar(page)).toHaveClass(/is-overlay/);
  await expect(handle(page)).toHaveAttribute("aria-valuetext", "Expanded");
  await expect(handle(page)).toBeFocused();
  // The page does not move; the sidebar lies over it.
  expect((await main.boundingBox()).x).toBe(before.x);
  await expect.poll(() => width(page)).toBe(252);
  expect((await main.boundingBox()).x).toBe(before.x);
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);
  await expect(handle(page)).toBeFocused();

  // Dragging works too, still without moving the page.
  await drag(page, 260, async () => {
    expect((await main.boundingBox()).x).toBe(before.x);
  });
  await expect(sidebar(page)).toHaveClass(/is-overlay/);
  await page.mouse.click(800, 400);
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);

  await handle(page).click();
  await sidebar(page).locator('.nav-btn[data-page="rooms"]').click();
  await expect(page).toHaveURL(/#\/rooms$/);
  await expect(sidebar(page)).not.toHaveClass(/is-overlay/);
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  // The tablet overlay is never remembered.
  expect(
    await page.evaluate(() => localStorage.getItem("synergy-sidebar")),
  ).toBe(null);
  // Sign out stays on the rail as an icon.
  await expect(
    sidebar(page).getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
});

test("on a phone there is no sidebar handle and the drawer still opens", async ({
  page,
  request,
}) => {
  const account = await user(request, "SidebarPhone");
  await page.setViewportSize(phone);
  await page.addInitScript(() =>
    localStorage.setItem("synergy-sidebar", "collapsed"),
  );
  await open(page, account);
  await expect(handle(page)).toBeHidden();
  await expect(sidebar(page)).toBeHidden();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const drawer = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(
    drawer.getByRole("button", { name: "Activity", exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(page).toHaveURL(/#\/rooms$/);
});

test("keyboard users reach the handle, the rail links and Sign out with visible focus", async ({
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

  await focusTo(handle(page));
  expect(await outline(handle(page).locator(".sidebar-resizer-grip"))).not.toBe(
    "none",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(sidebar(page)).toHaveClass(/is-rail/);
  await expect(handle(page)).toBeFocused();

  const matches = sidebar(page).locator('.nav-btn[data-page="discover"]');
  await focusTo(matches);
  expect(await outline(matches)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(matches).toHaveAttribute("aria-current", "page");

  const signOut = sidebar(page).getByRole("button", { name: "Sign out" });
  await focusTo(signOut);
  expect(await outline(signOut)).not.toBe("none");
});

// Samples the Updates, Settings and Sign out icons on every frame of one
// transition, after slowing it so the samples land mid-animation.
async function sampleTransition(page) {
  return page.evaluate(async () => {
    const centre = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const pick = () => ({
      width: document.querySelector("#workspace-sidebar").offsetWidth,
      updates: centre('.sidebar .nav-btn[data-page="notifications"] .nav-icon'),
      settings: centre('.sidebar .nav-btn[data-page="settings"] .nav-icon'),
      signOut: centre(".sidebar-signout .nav-icon"),
    });
    const frames = [pick()];
    document
      .querySelector(".sidebar-resizer")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    const start = performance.now();
    while (performance.now() - start < 900) {
      await new Promise(requestAnimationFrame);
      frames.push(pick());
    }
    return frames;
  });
}

// Waits until the sidebar has stopped changing width.
async function settle(page) {
  let last = -1;
  await expect
    .poll(async () => {
      const current = await width(page);
      const steady = current === last;
      last = current;
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
    test(`on ${layout}, a ${role}'s Updates, Settings and Sign out stay still through the whole animation`, async ({
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
      for (const step of ["first", "second"]) {
        const frames = await sampleTransition(page);
        const widths = frames.map((frame) => frame.width);
        expect(
          widths.some((value) => value > 95 && value < 245),
          `${step} toggle is sampled mid-animation`,
        ).toBe(true);
        for (const key of ["updates", "settings", "signOut"]) {
          expect(
            spread(frames, (frame) => frame[key].y),
            `${key} stays level on the ${step} toggle`,
          ).toBeLessThanOrEqual(1);
          expect(
            spread(frames, (frame) => frame[key].x),
            `${key} stays in the icon column on the ${step} toggle`,
          ).toBeLessThanOrEqual(1);
        }
        await settle(page);
      }
      // Two toggles opened and closed it again.
      expect(/is-rail/.test(await sidebar(page).getAttribute("class"))).toBe(
        startRail,
      );
    });
  }
}
