# Collapsible sidebar delivery

Work date: 25 November 2026. Branch `fix/ui-ux`, uncommitted for review. Scope: the workspace sidebar for founders and mentors on desktop and tablet. The phone drawer (760 px and narrower) and page navigation are unchanged. No dependency, route or server change.

## What changed

- **Toggle.** A 44 px button at the top of the 90 px rail, centred on the icon column, collapses the sidebar to the rail and expands it again. It sits at the same screen position in both states, so a second click without moving the pointer always reverses the first. The Synergy brand is revealed to its right when open. It is labelled **Collapse sidebar** or **Expand sidebar**, reports `aria-expanded`, controls `#workspace-sidebar`, and keeps focus after a click in every browser, including Safari.
- **Remembered per browser.** Desktop stores `synergy-sidebar` (`collapsed` or `expanded`) in localStorage through `src/state/sidebar.js`. `public/theme-init.js` sets `data-sidebar` on the root before the first paint, so a collapsed sidebar never shows open while the page loads. The loading skeleton uses the same width. The choice stays after signing out and in again.
- **One width variable.** `--sidebar-width` (252 px, 264 px from 1550 px, 90 px for the rail) drives the app grid, the loading skeleton and the positions that depended on the sidebar's width.
- **One structure at both widths.** Every row (the toggle and brand, each link, and the account footer) is an icon cell as wide as the rail, then the part the open sidebar reveals. Opening and closing changes only the width. The toggle, every icon, Updates, Settings and the avatar stay at the same screen positions throughout the animation, for founder and mentor menus alike. Labels, the brand, the name and role, and Sign out stay on one line and fade with the width. On the rail they are hidden from keyboards and screen readers; links keep their names and tooltips. The rail no longer shows small labels under its icons.
- **Motion.** On desktop the content area resizes with the sidebar (`grid-template-columns`, 200 ms, `--ease-out`). On tablet the sidebar widens over the page, which stays still. Both are CSS transitions, so a second click mid-animation reverses from the current width. There is no animation under `prefers-reduced-motion`.
- **Steady footer.** The footer is one fixed-height row at both widths: the avatar, then name and role, then a **Sign out** button. The avatar opens the account menu at either width. Before, the open footer listed Switch and Sign out as extra lines, and its name wrapped letter by letter while the sidebar was still narrow. That pushed Updates and Settings up by about 230 px mid-animation.
- **Short screens.** The sidebar scrolls vertically at both widths, so every link and account action stays reachable.
- **Count badge.** At both widths, the Introductions or Requests count sits on the icon in the accent colour (`--accent` with `--on-accent-warm`). The count is part of the link's accessible name (“Requests, 1 waiting for you”). Before, the link's `aria-label` hid the count from screen readers.
- **Account menu.** The avatar opens a menu with the person's name and role, **Switch to founder/mentor** (only for accounts with both roles) and **Sign out**. The menu is placed beside the sidebar, on the page body, so page content never covers it. Arrow keys, Home and End move between items. Esc, or a click outside on anything that isn't a control, closes the menu and returns focus to the avatar. Tab closes it and moves on. Cancelling sign-out returns focus to the avatar.
- **Tablet (761–1250 px).** The sidebar starts as the rail. **Expand sidebar** lays the full sidebar over a dimmed page without moving the page. Esc, a click outside or opening a page closes it, and the state is not saved. The Topbar **Sign out** button that tablets used to show is removed; sign out is in the account menu.
- **Wide screens with a collapsed sidebar** show the person's name and role beside the Topbar avatar again, since the rail no longer shows them.
- **Dark mode, forced colours and print.** The menu uses the surface, ink and line tokens, so it follows dark mode. Forced colours give the toggle, avatar button, Sign out button, menu and badge system colours and a border. The certificate print rule also hides the tablet backdrop.

## Files

`src/components/Sidebar.jsx`, `src/components/NavButton.jsx`, `src/components/Topbar.jsx`, `src/components/Icon.jsx` (a `panel` icon from Lucide), `src/state/sidebar.js` (new), `public/theme-init.js`, `src/styles.css`, `src/founder-ux.css`, `src/mentorship.css`, `tests/sidebar.spec.js` (new) and `tests/features.spec.js`. In `features.spec.js`, the tablet sign-out step now uses the account menu.

## How to test

1. Run `npm run dev` and sign in as a founder at 1440 px. Select **Collapse sidebar**, then click again without moving the pointer: it opens again. Watch Updates, Settings and the avatar; they don't move.
2. Visit every link on the rail, reload, then sign out and sign in again with the same email and password. The sidebar stays collapsed and never shows open while the page loads.
3. Sign in as a mentor in another browser profile. The sample requests show as a badge on **Requests**. Repeat steps 1 and 2.
4. Open the avatar menu at both widths, by mouse and by keyboard. Check Esc, an outside click, **Switch to founder/mentor** on an account with both roles, and **Sign out**.
5. At 1024 px, select **Expand sidebar**. The page stays where it is. Close the sidebar with Esc, a click outside and by opening a page. Reload: the rail is back.
6. At 390 px, no toggle shows, and **Open navigation** opens the drawer as before. At 1440 × 520 px, scroll the sidebar to reach the footer.
7. Repeat steps 1 and 4 in dark mode, with Windows contrast themes (forced colours) and with reduced motion.

Automated: `npx playwright test tests/sidebar.spec.js` runs 14 cases in Chromium, Firefox and WebKit. They cover desktop, tablet and phone, founder and mentor, persistence without a flash, the badge, the account menu, the Moderation link and keyboard focus. Five cases check the transition itself, with the animation slowed to 600 ms:

- the toggle, Updates and Settings stay within 1 px on every frame of opening and closing;
- two clicks at the same point open and close the sidebar;
- a second click mid-animation reverses it from the current width.

## Verification

- **Before the transition rework:** the full browser run passed 236 of 238. The two failures (a Chromium axe contrast check and a WebKit decline-flow timeout) also failed in the run before any sidebar code existed. Each passed on its own: 2 of 2 and 3 of 3 repeats.
- **After the transition rework:** `tests/sidebar.spec.js` passed 42 of 42 (14 cases × 3 browsers). `npm run build` passes.
- **The specs that use the footer's Sign out** (`app`, `features`, `ui-roadmap`) pass in Chromium. The rework briefly broke the tablet sign-out in `features.spec.js`: the account menu opened beneath the profile page's sticky action bar. Moving the menu onto the page body fixed it.
- **Frame sampling** on desktop and tablet, founder and mentor, measured the toggle at (45, 46) on every frame, with Updates and Settings at one y position each. Before the rework, the toggle jumped between x 45 and 215, and Updates dipped by up to 237 px mid-animation.
