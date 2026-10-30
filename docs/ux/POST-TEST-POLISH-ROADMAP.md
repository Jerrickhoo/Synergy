# Synergy post-test UX polish roadmap

Prepared October 30, 2026, from the user's 16 testing and review notes and a review of the current source.

**Status: phases A–F completed October 30, 2026.** All 16 source notes are accepted. See the [baseline and design rules](POST-TEST-POLISH-BASELINE.md), [A–B delivery](POST-TEST-POLISH-DELIVERY.md), [C–D delivery](POST-TEST-POLISH-CD-DELIVERY.md), [E–F cleanup and integrated acceptance](POST-TEST-POLISH-EF-DELIVERY.md), and [cleanup manifest](../maintenance/CLEANUP-MANIFEST.md). Final checks passed: 69 unit tests, 101 browser scenarios, formatting, reference checks and production build. This follows the earlier [UX improvement roadmap](UX-IMPROVEMENT-ROADMAP.md), whose numbered-phase delivery history stays separate. Verification limits are recorded in the E–F report.

## 1. Outcome

Make Synergy feel more compact, consistent and finished: readable Updates, intentional page backgrounds, custom dropdowns, predictable notifications, simpler profiles and clearer account controls. Preserve the existing Founder and Mentor workflows, data, matching rules and account protections.

The work should deliver:

- Less wasted space without shrinking text or making controls difficult to use.
- One consistent interaction treatment for dropdowns, clickable rows, disclosures and focus states.
- A notification panel that opens below the header and remains usable on small screens.
- A dedicated Danger zone and a confirmation before voluntary sign-out.
- One clear profile-completion indicator and less redundant profile/navigation copy.
- A documented, easier-to-maintain repository with evidence-based cleanup.

## 2. Decisions and working assumptions

These decisions make the notes actionable. Confirm ambiguous visual targets during baseline review; they do not require a separate approval gate for every routine edit.

| Topic                    | Proposed decision                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Text below the sign in” | Interpret as the prototype explanation below the Sign in button: “Role previews are for browsing sample profiles. Preview accounts cannot connect with each other.” Move necessary prototype guidance into contextual help beside Prototype role. Capture the screen to distinguish this from the subtitle below the sign-in heading. Preserve access to Create an account in password mode. |
| “Workspace / Home”       | Remove the redundant breadcrumb from Home. Keep the page's main heading and active navigation. Review other top-level routes for the same duplication, while retaining meaningful navigation context on detail screens.                                                                                                                                                                      |
| Hover treatment          | Use one subtle tinted surface, border and optional soft glow across the entire clickable control. Use a distinct focus ring for keyboard users. Apply this to icon and label together.                                                                                                                                                                                                       |
| Profile completion       | Keep one circular percentage indicator in Collaboration record; remove the narrow duplicate bar from the identity header. Keep the missing-fields guidance near Edit profile so incomplete users still know what to do.                                                                                                                                                                      |
| Role selector            | Remove “I'm here as a” and its selector from Profile. Preserve signup and prototype role choice. Put any still-required switch between existing role profiles in Settings as “Active profile”; do not imply it deletes or converts either profile.                                                                                                                                           |
| Background               | Use a restrained CSS gradient with a faint static dot or grid texture on the main workspace canvas. Keep content panels readable and avoid animation or new image downloads.                                                                                                                                                                                                                 |
| Custom dropdowns         | Customize both the closed trigger and the open options panel, starting with Matches sorting. Styling a native select alone does not satisfy this request.                                                                                                                                                                                                                                    |
| Danger zone              | Group consequential account actions: pause discovery, revoke other sessions and delete account. Use red emphasis for deletion; show the appropriate consequence and confirmation for each action. Keep data export and ordinary preferences in their normal sections.                                                                                                                        |
| Repository cleanup       | Inventory references first. Archive useful history; remove only confirmed obsolete or reproducible material. Preserve current uncommitted work and local account data.                                                                                                                                                                                                                       |

## 3. Source findings before post-test polish

This table records the starting point. Current behavior and verification are documented in the delivery reports linked above.

| Area                     | Source finding                                                                                                                                                                  | Planning consequence                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Login                    | `Login.jsx` renders Show/Hide text, already has accessible toggle labels, and contains both a heading subtitle and prototype help below the form.                               | Replace visible toggle content while retaining its accessible state; target the correct helper paragraph.                |
| Header                   | `Topbar.jsx` renders Workspace / page name and anchors the notification panel beside the bell.                                                                                  | Remove duplicate Home context without disrupting account controls or header spacing.                                     |
| Updates                  | `NotificationRow.jsx` is shared by the page and header preview. Full rows have 22px vertical padding in `profile-pages.css`, plus several internal text gaps.                   | Adjust shared structure with explicit full/compact variants rather than independent markup.                              |
| Notification positioning | `styles.css` includes absolute positioning and a mobile fixed top offset; `profile-pages.css` also changes panel width, height and overflow.                                    | Consolidate effective rules; calculate placement from the header instead of adding another override.                     |
| Dropdowns                | `shared-ui.css` explicitly preserves native select behavior; Matches sorting and filters use `<select>`.                                                                        | A reusable custom control needs interaction, form and validation work, beyond CSS.                                       |
| Match explanation        | `MatchCard.jsx` already places fit text and the info icon inside one button.                                                                                                    | Style the parent button's hover/focus state; do not introduce a second interactive target.                               |
| Sign-out                 | Sidebar, mobile navigation and topbar call `sign-out` directly. `AppContext.jsx` clears the session and account draft keys. Account deletion also calls sign-out after success. | Separate requesting confirmation from executing logout; deletion and session expiry must not receive a redundant prompt. |
| Confirmation component   | `Confirmation.jsx` displays a transient success status. `Overlay.jsx` supplies a dialog.                                                                                        | Reuse or extend the dialog pattern for sign-out; the success-status component is not a confirmation dialog.              |
| Settings                 | Account deletion lives under Your data; visibility and session revocation are separate sections. Password/DELETE checks already exist.                                          | Reorganize existing actions while preserving server enforcement and accurate consequences.                               |
| Profile                  | `ProfilePage.jsx` has a narrow completion bar and a live role switch; `ProfileStats.jsx` also reports completion.                                                               | Remove duplicate presentation without deleting role data or changing the completion calculation.                         |
| Community                | `CommunityRequests.jsx` is a native details/summary disclosure containing affiliation and tag forms.                                                                            | Improve it as an accordion, not as a select menu.                                                                        |
| Styles and files         | `main.jsx` imports several layered stylesheets; the root contains historical docs, reference artifacts and generated directories.                                               | Establish ownership and reference evidence before consolidating styles or moving files.                                  |

## 4. Priorities, sequence and estimates

**P1** means interaction correctness or a shared dependency. **P2** means visual/readability polish. **P3** means repository organization after the UI is stable. These are delivery priorities, not incident severity ratings.

Estimates assume one developer, existing local functionality, and targeted verification. They are planning ranges, not deadlines. Phase totals include the tickets listed; do not add separate ticket estimates on top.

| Phase                             | Work                                                                                                            | Effort       | Dependency                          | Exit condition                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ---------------------------------------------------------------- |
| A. Baseline and design rules      | Reproduce all notes; inventory controls, styles and cleanup candidates; define spacing, hover and overlay rules | 0.5–1 day    | Start                               | Each issue has a screenshot/state and a target behavior          |
| B. Login and shared interactions  | UX03–05, UX07–08; common dropdown and interactive-surface styles                                                | 2.5–4 days   | A                                   | Login refinements and keyboard-operable custom Matches sorting   |
| C. Updates and workspace surfaces | UX01, UX06, UX09–10                                                                                             | 1.5–2.5 days | A; shared styles from B             | Compact Updates and aligned, animated notification panel         |
| D. Settings and profile           | UX02, UX11–15; finish dropdown migration                                                                        | 2–3.5 days   | B; confirmation/dialog pattern      | Account prompts and simplified profile verified for both roles   |
| E. Repository cleanup             | UX16                                                                                                            | 1–1.5 days   | UI changes stable; inventory from A | Documented moves/removals with imports, links and scripts intact |
| F. Integrated verification        | Cross-browser, responsive and account-flow review                                                               | 1–2 days     | B–E                                 | Acceptance matrix and verification evidence complete             |

**Total: approximately 8.5–14.5 developer days**, or roughly 2–3 working weeks with prompt feedback. Re-estimate after the full dropdown inventory; complex form validation and role-switch dependencies are the largest uncertainties.

Recommended change sets: (1) login/header copy, (2) shared dropdown and hover treatment, (3) Updates/notification/background, (4) account confirmation and Danger zone, (5) profile/community, (6) repository cleanup. Keep file moves separate from functional changes so each is reviewable and reversible.

## 5. Detailed implementation backlog

### UX01 — Compact the Updates page

Delivered in C; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** C. **Source note:** 1.

**Target:** More relevant activity visible in the initial viewport, with a clear distinction between groups and between updates.

Implementation:

1. Capture identical fixtures with 0, 1, 6 and 20+ updates, mixed read states, long titles and session/deadline metadata.
2. Reduce full-row vertical padding from 22px toward 14–16px; start with 16–20px horizontal padding and 10–12px icon/content gaps.
3. Tighten toolbar-to-list, group-heading and internal metadata gaps. Keep timestamps and actions together where space permits.
4. Remove unnecessary repeated context, but keep information that identifies the collaborator, room, event and timing.
5. Allow content-driven height and wrapping. Do not insert filler cards to occupy empty space or force all rows to a fixed height.
6. Retain the shared row component with a dedicated compact preview variant.

Acceptance:

- [x] For the same six-item fixture at 1440×900, the list is measurably shorter; aim for a 20–30% height reduction without clipping or reducing body type below the agreed readable size.
- [x] Titles, actions, read states and dates remain distinguishable at 360px width and 200% zoom.
- [x] All/Unread, individual read actions, Mark all as read and destination links behave as before.
- [x] Empty and one-item states are compact and intentional; no arbitrary full-height cards.

Primary files: `src/pages/NotificationsPage.jsx`, `src/components/NotificationRow.jsx`, `src/profile-pages.css`.

### UX02 — Add a dedicated Danger zone in Settings

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P1. **Phase:** D. **Source note:** 2.

**Target:** Users can find consequential account actions in one clearly separated section at the bottom of Settings.

Implementation:

1. Add a Danger zone heading, restrained warning border, and rows with an action title, concrete consequences and a clear action button.
2. Place account deletion and revocation of other sessions here. Put the pause-discovery action here because it withdraws pending introductions; normal visibility status may remain above with a link to this action.
3. Before pausing, explain that profiles disappear from Matches, pending introductions are withdrawn, and existing rooms remain available. Resuming visibility must not promise to restore withdrawn introductions.
4. Keep the session list in Account access, with the revocation action in Danger zone. State which other sessions will be affected.
5. Preserve deletion's current-password requirement for password accounts and typed DELETE confirmation; preserve the guest/prototype exception already supported by the server.
6. Preserve the explanation that private account information is removed while shared history remains anonymized. Prevent duplicate submissions and keep actionable errors next to the relevant action.
7. Keep Download my data outside Danger zone. Do not introduce unsupported password/email-change or account-conversion features.

Acceptance:

- [x] Danger zone is visually separate and reachable on desktop and mobile.
- [x] Opening or canceling an action makes no server mutation.
- [x] Pausing, revoking and deleting display different, accurate consequences; red destructive emphasis is reserved for deletion.
- [x] Invalid password/DELETE input prevents deletion; server checks remain authoritative.
- [x] A failed request leaves the user able to retry, with controls and state restored.
- [x] Successful deletion ends the session without showing a second sign-out confirmation.

Primary files: `src/pages/SettingsPage.jsx`, `src/components/Overlay.jsx`, shared styles; regression coverage around `server/accounts.js`.

### UX03 — Replace Show/Hide with an eye icon

Delivered in B; see [verification](POST-TEST-POLISH-DELIVERY.md).

**Priority:** P2. **Phase:** B. **Source note:** 3.

Implementation: add or reuse eye/eye-off icons in `Icon.jsx`; replace only the visible Show/Hide text. Retain `type="button"`, the dynamic Show password/Hide password accessible name and the existing toggle state. Reserve input padding so passwords never overlap the icon. Use a comfortable touch target of approximately 44×44px.

Acceptance:

- [x] Clicking or keyboard-activating the icon toggles password visibility without submitting the form or changing its value.
- [x] The icon and accessible name reflect the current visibility action; focus is visible.
- [x] Prototype and password-login modes both work, including validation, autofill and long values.

Primary files: `src/components/Login.jsx`, `src/components/Icon.jsx`, login styles in `src/styles.css` / `src/shared-ui.css`.

### UX04 — Remove the text below Sign in

Delivered in B. The identified target was the prototype-limitations paragraph below the submit button; the heading subtitle remains.

**Priority:** P2. **Phase:** B. **Source note:** 4.

Implementation: remove the prototype paragraph below the submit form under the assumption in Section 2. Relocate necessary preview limitations to optional help beside Prototype role. Remove the leftover margin so the form ends cleanly. If baseline review establishes that the user meant the heading subtitle, remove that subtitle instead and record the resolved target.

Acceptance:

- [x] The identified redundant paragraph is absent and leaves no empty block.
- [x] Prototype role selection and needed help remain discoverable.
- [x] Password-mode account creation, field instructions and validation remain available; no dangling `aria-describedby` references.

Primary file: `src/components/Login.jsx`; related login spacing rules.

### UX05 — Remove redundant Workspace / Home text

Delivered in B for top-level pages whose own headings provide the context; detail routes retain the breadcrumb.

**Priority:** P2. **Phase:** B. **Source note:** 5.

Implementation: remove the breadcrumb-like Workspace / Home label from the Home header, retaining the page heading and selected Home navigation state. Use layout rules to align the bell and profile button without an empty text placeholder. Apply the same rule to other top-level pages only where their page heading supplies the same context.

Acceptance:

- [x] Founder and Mentor Home no longer repeat Workspace / Home.
- [x] Header controls stay aligned at desktop, tablet and mobile widths.
- [x] Accessible navigation labels and page headings remain meaningful; detail-page navigation still works.

Primary files: `src/components/Topbar.jsx`, `src/pages/HomePage.jsx`, `src/components/MentorHome.jsx`, shared shell styles.

### UX06 — Add a custom notification scrollbar

Delivered in C; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** C. **Source note:** 6.

Implementation: give the notification body its own bounded scroll area, leaving its heading and View all action reachable. Use a slim rounded thumb and quiet track through supported scrollbar CSS, with a visible hover state and a native fallback. Size the scroll area from available viewport space below the header; avoid nested vertical scrollbars. Keep wheel, touch and keyboard scrolling functional.

Acceptance:

- [x] Overflowing previews scroll without horizontal overflow or moving the page unexpectedly at panel boundaries.
- [x] Chromium, Firefox and WebKit all have a usable scrollbar; operating-system auto-hide preferences may still apply.
- [x] No scroll track is forced for a short list; no browser's scrollbar is made invisible.
- [x] Tab navigation can reach and reveal every row action.

Primary files: `src/components/Topbar.jsx`, `src/profile-pages.css`, existing notification rules in `src/styles.css`.

### UX07 — Replace default dropdown menus with a reusable custom control

**B and D delivered:** `SelectField`, custom Matches sorting and all remaining consumers in the [27-location inventory](POST-TEST-POLISH-BASELINE.md). The only native select remaining in `src` is the component’s hidden form backing control. Required validation, actual profile draft/save/cancel/failed-save behavior, scheduling, task, moderation and modal flows are verified in the [C–D report](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P1. **Phase:** B, completed in D. **Source note:** 7.

**Target:** Matches Sort by opens a Synergy-styled options panel; other selects follow the same visual and interaction pattern.

Implementation:

1. Inventory every select: Matches sorting and filters, Prototype role, profile fields/preferences, Calendar, scheduling, room/task controls, Settings sessions and moderation. Record labels, option sources, form names and state handlers. Treat datalist suggestions and details/summary accordions as separate control types.
2. Introduce a shared `SelectField` component with selected value, label, placeholder, disabled/error states, helper text and consistent chevron. Use a single-select listbox/combobox pattern, not menu semantics intended for commands.
3. Style the opened panel: matching trigger width where appropriate, subtle border/shadow, rounded options, whole-row hover, clear focused option, selected checkmark and bounded scrolling.
4. Support Enter/Space to open, arrows to navigate, Home/End, type-ahead, Enter to commit, Escape to cancel and return focus, Tab to leave without a focus trap, and outside-click dismissal. Keep committed and highlighted values distinct.
5. Position within viewport bounds and account for scroll containers. Controls inside modal dialogs must render options within a compatible dialog layer so the options remain visible and interactive.
6. Preserve `name`/value form serialization, required validation, error focus, reset, defaults and controlled updates. A hidden input alone does not provide native required-field validation. Ensure restored drafts and form-level change handling still receive changed values.
7. Migrate Matches Sort by first, then filters, login/profile/settings and the remaining inventoried selects. Update browser tests that currently use native `selectOption` to operate the visible control.

Acceptance:

- [x] Highest fit, Name and Completed collaborations sort correctly through the custom panel.
- [x] Selected values remain correct through filtering, pagination and any existing state-restoration behavior.
- [x] Keyboard, touch and screen-reader interaction work; labels and expanded/selected states are exposed correctly.
- [x] Long options, disabled options, empty option sets, required fields and error focus behave predictably.
- [x] Saving, canceling, restoring and resetting profile forms preserve the expected field values.
- [x] Every inventoried select is migrated or has a specific recorded technical exception; Matches sorting must be custom.

Primary files: new `src/components/SelectField.jsx`, `src/shared-ui.css`, consuming pages/components; tests in `tests/app.spec.js`, `tests/prototype.spec.js` and relevant feature suites.

### UX08 — Unify Why this match hover and focus

Delivered in B through the shared `interactive-surface` treatment on the existing fit button.

**Priority:** P2. **Phase:** B. **Source note:** 8.

Implementation: apply the shared hover surface/glow to the existing button containing the score, Why this match text and info icon. Remove text-only hover behavior that makes the icon feel disconnected. Provide a visible keyboard focus ring and avoid pulsing effects.

Acceptance:

- [x] Hovering the info icon, text or remaining button area produces the same treatment.
- [x] Clicking any part opens the same explanation once; keyboard activation works.
- [x] Focus returns to the originating button when the explanation closes.

Primary files: `src/components/MatchCard.jsx`, `src/discovery.css`, `src/match-overlays.css`.

### UX09 — Align and animate the notification panel

Delivered in C; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P1. **Phase:** C. **Source note:** 9. **Dependency:** shared overlay rules; coordinate with UX06.

Implementation:

1. Consolidate notification positioning into one owned style section/component. Remove superseded fixed offsets instead of adding competing overrides.
2. Anchor desktop placement to the header/bell area with the panel top 8–12px below the actual header bottom. Align to the action area's right edge where space allows, while staying inside viewport gutters.
3. On narrow screens, use the available width with approximately 12–16px gutters and a height bounded by the remaining viewport. Do not flip the panel upward over the header when space is short; shorten the scrolling body.
4. Add a short 140–180ms opacity/vertical-translation entrance. The final position must be stable; opening should not shift page content. Disable translation and unnecessary transitions for reduced-motion preferences.
5. Preserve close-on-Escape, outside-click dismissal, bell expanded state and focus return. Close or coordinate competing popovers so unrelated menus do not stack unpredictably.
6. Treat bell preview and toast feedback as distinct surfaces. Check toast placement as part of this issue if the reported header overlap is also reproducible there.

Acceptance:

- [x] The panel's bounds never intersect the header or profile button at the tested widths, scroll positions or zoom levels.
- [x] Resizing, scrolling and changing content length keep the panel aligned and reachable.
- [x] Opening is smooth, closing leaves no invisible click-blocking layer, and reduced-motion mode is immediate or near-immediate.
- [x] Bell toggle, Escape, outside click and navigation close the preview consistently without losing the requested action.

Primary files: `src/components/Topbar.jsx`, `src/App.jsx`, notification CSS; `src/components/Toast.jsx` only if its placement also needs correction.

### UX10 — Give main pages a subtle background

Delivered in C; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** C. **Source note:** 10.

Implementation: define a shared workspace background token using a very light green/neutral gradient and a faint static texture. Attach it to the main content container so it works across Home, Matches, Updates, Profile, Settings, Rooms and Calendar. Keep dense work areas and text panels on sufficiently opaque surfaces. If a pseudo-element supplies decoration, make it noninteractive and keep it behind content.

Acceptance:

- [x] Both Home variants and other main pages have visible but restrained depth.
- [x] Text, unread highlights, focus rings, calendar cells and disabled states remain distinguishable.
- [x] Background decoration never captures clicks, creates scrollbars or resets conspicuously on long pages.
- [x] No animated pattern, new network image dependency or layout shift is introduced.

Primary files: `src/App.jsx` for container identification, `src/styles.css`, `src/shared-ui.css`; page styles only for necessary exceptions.

### UX11 — Confirm voluntary sign-out

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P1. **Phase:** D. **Source note:** 11.

Implementation:

1. Add a shared confirmation dialog. Suggested title: **Sign out of Synergy?** Body: **You will return to the sign-in screen. Unsaved drafts in this tab will be cleared.** Buttons: **Cancel** and **Sign out**.
2. Route sidebar, topbar and mobile sign-out entry points through a request-sign-out action. Keep the actual logout execution separate.
3. Focus Cancel initially; Escape/backdrop dismissal cancels and returns focus to the opener. For mobile navigation, transfer to one modal at a time and restore focus to an available navigation control.
4. Clear neither session nor drafts until confirmation. Disable repeated confirmation while logout is in flight.
5. Preserve the existing ability to clear the local session offline. Bypass this voluntary prompt after confirmed account deletion or forced session expiry.

Acceptance:

- [x] Every voluntary sign-out entry point opens the same prompt.
- [x] Cancel, Escape and dismissal preserve authentication, current route and drafts.
- [x] Confirm sends at most one logout request, clears local session/drafts and returns to login.
- [x] Offline confirmation still signs out locally; no success claim about remote revocation is invented.
- [x] Account deletion and expired sessions never get stuck behind a new prompt.

Primary files: `src/components/Sidebar.jsx`, `src/components/Topbar.jsx`, `src/components/MobileMenu.jsx`, `src/components/Overlay.jsx`, `src/state/AppContext.jsx`, `src/state/transitions.js`, `src/App.jsx`.

### UX12 — Remove the Profile role-switch row

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** D. **Source note:** 12.

Implementation: remove the “I'm here as a” label and select from the identity footer. Keep a passive Founder/Mentor identity label where useful. Trace `choose-role` and existing tests to preserve access for accounts with both profiles; place that switch in Settings as Active profile when needed. A switch between existing profiles belongs with ordinary preferences; any future destructive role conversion would belong in Danger zone and is outside this plan.

Acceptance:

- [x] Neither Profile variant displays the removed row or an empty space where it used to be.
- [x] Signup and prototype role choice still work.
- [x] Existing role profiles, role-specific routes and draft isolation remain intact; required role switching remains accessible.

Primary files: `src/pages/ProfilePage.jsx`, `src/pages/SettingsPage.jsx`, role-action consumers and associated tests.

### UX13 — Keep one clearer profile-completion indicator

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** D. **Source note:** 13.

Implementation: remove the small identity-footer track and replace the existing percentage in Collaboration record with a circular indicator, initially about 56–64px in diameter. Use the existing `profileCompleteness` selector as the single calculation. Show the numeric percentage and Profile complete label; expose an accessible progress value without duplicate announcements. Keep missing-field guidance and Edit profile access near the identity header. Show completion from saved values unless the UI explicitly labels a draft preview.

Acceptance:

- [x] Profile has exactly one completion visualization and no duplicate standalone completion percentage.
- [x] 0%, partial and 100% states are readable and correct for both roles.
- [x] Saving changes refreshes completion; canceling or failing to save does not falsely update saved completion.
- [x] Incomplete users can identify missing fields; completed profiles no longer show setup warnings.
- [x] Existing Home completion guidance may remain because it serves a separate page context.

Primary files: `src/pages/ProfilePage.jsx`, `src/components/ProfileStats.jsx`, `src/data/selectors.js`, `src/profile-pages.css`.

### UX14 — Make Account settings and privacy a full-row action

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** D. **Source note:** 14.

Implementation: replace the text-sized link treatment with one full-width interactive row containing the label and trailing arrow. Apply the shared hover background/border/glow across its complete area. Use the same treatment for its sibling Updates action. Keep separate rows as separate targets; do not make the entire multi-action card clickable.

Acceptance:

- [x] Hovering the label, arrow or row padding highlights the same full row.
- [x] Each row has one keyboard focus stop and a clear focus ring.
- [x] Clicking anywhere within the row opens its intended destination, including on touch screens.

Primary files: `src/pages/ProfilePage.jsx`, `src/profile-pages.css`, shared interactive-row styles.

### UX15 — Improve affiliation verification and community tags disclosure

Delivered in D; see the [C–D acceptance evidence](POST-TEST-POLISH-CD-DELIVERY.md).

**Priority:** P2. **Phase:** D. **Source note:** 15.

Implementation: retain the current details/summary behavior while styling its summary as a full-width accordion header with a chevron, clear expanded state, whole-row hover and keyboard focus. Group the expanded body into Affiliation verification and Community tags with consistent spacing and a divider. Preserve status messages, moderator-availability guidance, approved vocabulary and both submission forms. Ensure closing and reopening does not erase entered values.

Acceptance:

- [x] The full summary row expands/collapses the section using mouse, touch or keyboard.
- [x] The chevron communicates open/closed state; reduced-motion preferences are respected.
- [x] Interacting with fields or submission buttons does not collapse the section.
- [x] Pending, approved/rejected where supported, unavailable-moderation, validation-error and successful-submit states remain understandable.
- [x] Long organization names, status notes and tag lists wrap without overflow.

Primary files: `src/components/CommunityRequests.jsx`, `src/profile-pages.css`, shared disclosure styles.

### UX16 — Clean and organize the repository

Delivered in E; see the [cleanup manifest](../maintenance/CLEANUP-MANIFEST.md), [documentation index](../README.md), [source/style ownership](../maintenance/SOURCE-LAYOUT.md) and [E–F acceptance evidence](POST-TEST-POLISH-EF-DELIVERY.md).

**Priority:** P3. **Phase:** E. **Source note:** 16. **Dependency:** stable functional changes.

**Target:** A smaller, clearer project surface with a known owner for each feature/style area and no broken runtime, documentation or development workflows.

Implementation:

1. Record the existing working-tree changes before cleanup. Keep new changes attributable; do not reset or overwrite in-progress work.
2. Inventory tracked files, imports, CSS selectors, public asset references, npm scripts, CI/deployment references and documentation links. Classify each candidate as retain, move/archive, generated, or proven obsolete.
3. Keep root essentials: README, package manifests/lockfile, app entry/configuration, deployment configuration, environment example and Git/CI configuration. Place detailed documentation under predictable categories.
4. Consider `docs/product/` for Synergy reference material, `docs/operations/` for operating/deployment guides, `docs/architecture/` for migration plans, and `docs/archive/` for historical audits. Keep active UX work in `docs/ux/`. Document proposed old/new paths before moving.
5. Review `Synergy.pdf`, `Synergy.md`, root screenshots, AUDIT/QA/UI review documents and old roadmaps for unique information and inbound references. These are candidates for organization, not automatically disposable files.
6. Keep generated directories such as `dist/`, `test-results/`, `artifacts/`, `output/` and `.playwright-cli/` ignored; clean only confirmed disposable contents. Preserve any selected QA evidence that needs archiving. Do not treat `node_modules/` as source clutter or delete the lockfile.
7. Preserve `.data/`, databases, uploads, backups, environment files and credentials. They are not cleanup candidates based on appearance or size.
8. Consolidate superseded notification, hover, spacing and select CSS only after checking effective styles and responsive rules. Keep stylesheet import order deliberate. Avoid a broad component-folder restructure during this polish pass.
9. Remove unused components/assets/dependencies only with usage evidence; account for dynamic references, fixtures and scripts. Update imports, scripts, CI paths and README links in the same change as each move.
10. Deliver a cleanup manifest listing each moved/deleted item, reason, reference checks and restoration method. Add a short documentation/source-layout index.

Acceptance:

- [x] Every removal has a recorded reason and usage check; no user data or uncommitted work is lost.
- [x] App imports, public asset URLs, relative documentation links and package/CI commands resolve after moves.
- [x] A fresh checkout can follow README to install, run, build and test.
- [x] Generated output stays ignored, operational/reference documents remain discoverable, and overlapping CSS has a clear owner.
- [x] Unit tests, browser tests, formatting checks and production build pass after cleanup; pre-existing failures are explicitly distinguished.

Primary scope: repository root, `docs/`, `.gitignore`, `README.md`, `package.json`, `.github/`, CSS imports and proven-unused source/assets.

## 6. Shared design rules

These are starting values for baseline comparison, not claims about the current rendered UI.

| Property         | Proposed rule                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Spacing          | Use a compact 4/8/12/16/24/32px scale; reserve larger gaps for page sections.                                     |
| Interactive rows | One full hit area with consistent padding; approximately 44px minimum height for touch-oriented primary controls. |
| Hover            | Soft tint, subtle border and restrained optional glow across the parent control; no pulsing.                      |
| Focus            | Clearly visible ring independent of hover; never rely on glow or color alone.                                     |
| Overlays         | Define layer ownership for header, popovers, dialogs and toasts; keep dropdowns compatible with modal dialogs.    |
| Motion           | Short opacity/transform transitions; respect reduced motion; avoid animating layout dimensions unnecessarily.     |
| Text             | Preserve a readable hierarchy and wrapping; solve density through spacing and grouping first.                     |
| Decoration       | Quiet main-canvas background with opaque enough content surfaces; no pointer interception.                        |

## 7. Verification plan

Capture baselines and matching after screenshots for the same accounts and fixtures. Use real browser checks during implementation; this document alone is not visual or functional acceptance evidence.

### Required coverage

| Dimension     | Scenarios                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles/auth    | Founder and Mentor; prototype preview and local password account; existing dual-profile account if supported by the current flow                |
| Viewports     | 1440×900 desktop, 1024×768 compact desktop/tablet, 768×1024 tablet, 390×844 and 360×800 mobile                                                  |
| Accessibility | Keyboard-only, visible focus, 200% zoom, reduced motion, screen-reader labels/states; existing axe checks on affected screens                   |
| Browsers      | Existing Chromium, Firefox and WebKit projects; existing prototype project for preview-specific behavior                                        |
| Updates       | Empty, one item, many items, long content, mixed read state, session/deadline metadata and unavailable destinations                             |
| Dropdowns     | Short/long lists, selected and disabled states, no options, errors, off-screen placement, modal-contained controls and form reset/draft restore |
| Profile       | 0%, partial and complete; view/edit/cancel/save failure; both roles; long names and empty optional fields                                       |
| Account       | Cancel/confirm sign-out; double click; offline logout; invalid deletion input; successful deletion; failed settings request; session expiry     |

### Focused automated checks to add or adapt

- **Sign-out:** cancel leaves session/drafts intact; confirm clears them; all entry points agree; post-deletion logout bypasses confirmation.
- **Dropdowns:** keyboard commit/cancel, form serialization/validation and reset; Matches sorting/filtering results; modal-contained option interaction.
- **Notification placement:** compare panel and header bounding boxes at desktop and mobile sizes; verify no overlap, valid viewport bounds and reachable overflow content.
- **Profile:** one completion indicator; correct saved percentage; role-switch migration preserves access and drafts; community forms remain functional.
- **Existing regressions:** retain accessible-name password-toggle tests, read-state/timestamp persistence tests and account-operation enforcement tests.

Use visual/manual checks for background subtlety, glow consistency, spacing and scrollbar appearance. Do not add brittle tests for every CSS value or copy removal.

Run targeted suites during each change, then the existing release checks once the integrated implementation and cleanup are stable:

```powershell
npm.cmd run check:format
npm.cmd run check:references
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run build
```

The formatting script now names the relocated operational/archive documents and checks the reference-check script. CI also runs `check:references`. Browser suites use isolated test databases; keep the working workspace database out of cleanup and destructive test fixtures.

## 8. Delivery evidence and completion gate

Maintain one checklist with ticket ID, implementation status, changed files, test evidence and screenshot links. A ticket is complete only when its acceptance criteria are met; a commit or screenshot alone is insufficient for an interaction change.

Suggested artifacts:

- `docs/ux/POST-TEST-POLISH-BASELINE.md`: reproduced findings, screenshots, dropdown inventory and resolved wording assumptions.
- `docs/ux/POST-TEST-POLISH-DELIVERY.md`: implementation summary and UX01–UX16 acceptance results.
- `docs/maintenance/CLEANUP-MANIFEST.md`: retained, archived, moved and removed files with reasons.

Final completion requires:

- [x] All 16 source notes are addressed and mapped to passing acceptance criteria.
- [x] No remaining header/profile overlap or unexpected native Matches sort menu.
- [x] Login, profile, Updates and account controls work for both roles and auth modes.
- [x] No lost drafts on canceled sign-out, duplicate logout prompts, broken form values or weakened deletion checks.
- [x] Responsive, keyboard and reduced-motion checks are recorded.
- [x] Cleanup manifest and documentation links are verified; working data is preserved.
- [x] Required checks pass, with any pre-existing failures or deferred exceptions explicitly documented.

## 9. Feedback traceability

| Original note                           | Ticket | Planned result                                              |
| --------------------------------------- | ------ | ----------------------------------------------------------- |
| 1. Compact whitespace in Updates        | UX01   | Denser, readable rows and groups                            |
| 2. Dangerous account section            | UX02   | Dedicated Danger zone with accurate consequences            |
| 3. Password eye icon                    | UX03   | Accessible eye/eye-off toggle                               |
| 4. Remove text below Sign in            | UX04   | Cleaner form ending with contextual prototype help          |
| 5. Remove Workspace / Home              | UX05   | No duplicated Home breadcrumb                               |
| 6. Notification custom scrollbar        | UX06   | Styled, usable overflow area                                |
| 7. Custom dropdown UI                   | UX07   | Shared custom options panel, beginning with Matches sorting |
| 8. Why this match text/icon hover       | UX08   | One unified hover/focus target                              |
| 9. Smooth, aligned notification popup   | UX09   | Animated panel below the header without profile overlap     |
| 10. Simple main-section background      | UX10   | Quiet shared workspace decoration                           |
| 11. Prompt before sign-out              | UX11   | Cancel/confirm flow with accurate draft warning             |
| 12. Remove I'm here as a                | UX12   | Simplified Profile with necessary role access preserved     |
| 13. Improve/deduplicate completion      | UX13   | One circular completion indicator                           |
| 14. Full Account settings/privacy hover | UX14   | Full-width interactive rows                                 |
| 15. Improve affiliation/tags dropdown   | UX15   | Clear, accessible accordion and form grouping               |
| 16. Clean Synergy files                 | UX16   | Evidence-based cleanup and documented project layout        |
