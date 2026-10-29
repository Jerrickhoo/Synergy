# Phase 1 — shared UI delivery

Completed October 29, 2026, following the [Phase 0 review](PHASE-0-REVIEW.md).

## Implemented

| Feedback                      | Result                                                                                                                                                                                                                                                                                  | Evidence                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 — finalize logo           | Retained the linked-ribbon identity with balanced clear space, revised light/dark colors, compact/monochrome variants, exportable SVG assets and a matching favicon.                                                                                                                    | [Identity assets](../../public/brand/README.md), [reference sheet](visual-reference.html)                                                                  |
| F02 — login background        | Lightweight local SVG connection artwork behind a white form card; simpler mobile treatment; decorative artwork excluded from accessibility and pointer interaction.                                                                                                                    | [Desktop login](../../output/playwright/phase1/login-desktop.png), [mobile login](../../output/playwright/phase1/login-mobile.png)                         |
| F07 — improve dropdowns       | Shared 44px minimum controls, 8px corners, consistent chevron/padding, hover, keyboard focus, disabled and invalid states. Long sort values have enough space; mobile avoids text clipping. Native option lists retain keyboard, type-ahead and mobile picker behavior.                 | [Filter controls](../../output/playwright/phase1/filter-controls.png), [mobile Matches](../../output/playwright/phase1/matches-390.png)                    |
| F08 — replace toast stripe    | Uniform neutral border, compact status icon, restrained elevation, clear text and close control. Existing timeout, hover/focus pause and alert/status behavior retained.                                                                                                                | [Success toast](../../output/playwright/phase1/toast-success.png)                                                                                          |
| F13 — remove sidebar Profile  | Profile removed from shared sidebar/mobile navigation; account button remains available on desktop and mobile and indicates the current profile page. Direct routes remain supported.                                                                                                   | [Mobile navigation](../../output/playwright/phase1/mobile-navigation.png), [mobile profile entry](../../output/playwright/phase1/profile-entry-mobile.png) |
| F16 — Settings cog            | Replaced the sun-like radial geometry with a recognizable cog through the shared Icon component.                                                                                                                                                                                        | Desktop and mobile navigation captures                                                                                                                     |
| F17 — one interruption notice | A single persistent banner owns global outage feedback. Background polling does not generate outage toasts. An unconfirmed save preserves the form with inline retry guidance. Successful recovery clears the banner, including unchanged-state responses, and announces recovery once. | [Outage](../../output/playwright/phase1/connection-interrupted.png), [interrupted save](../../output/playwright/phase1/interrupted-save.png)               |

The select inventory covered discovery sorting and advanced filters; collaboration type; profile stage and engagement preference; task status/owner/priority/milestone; schedule recurrence; calendar collaboration filter; Settings session selection; moderation decision/assignee/remedy; review outcome controls; and the prototype-role selector. Shared CSS applies the same base treatment without replacing their form semantics.

## Verification

- Format check passed and production build passed.
- All 54 unit tests passed, including repeated outage, recovery, and interrupted-save state behavior.
- The full existing browser suite ran 76 scenarios: 73 passed initially. Three scenarios still asserted five sidebar destinations; after updating that obsolete assertion, all three passed on Chromium, Firefox and WebKit. Profile navigation tests now use the account button.
- After widening shared select controls, six targeted browser scenarios passed again across all three engines, covering mobile discovery visibility and keyboard/accessibility behavior.
- A separate real-browser outage check exercised four failed requests, one banner, no outage toast, preserved input during a failed save, reconnection, successful retry, a second outage, uniform toast borders and mobile profile access.
- Keyboard sorting, filter selection and Escape dismissal passed. Long selected sort text fits at 360, 390, 768 and 1440px without horizontal overflow. Forced-colors mode restores native select affordances; reduced-motion mode retains usable controls.
- Both local account participants completed the mentorship journey through shared terms, scheduling, evidence, mutual milestone confirmation, completion and release of private reviews.

No new service or external asset dependency was added. The larger Matches, Profile, Updates, Calendar and Mentor reworks remain assigned to their roadmap phases; their required changes are documented in Phase 0.

## Main implementation locations

- `src/shared-ui.css`: identity, login, select, toast and outage presentation; loaded after existing page styles.
- `src/components/Brand.jsx`, `Login.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `Icon.jsx`: identity, decorative artwork, profile navigation and Settings symbol.
- `src/App.jsx`: single persistent outage banner.
- `src/state/feedback.js`, `AppContext.jsx`, `request.js`: outage ownership, network-error classification, failed-save guidance and recovery.
- `tests/state.test.js`, `app.spec.js`, `features.spec.js`: focused state regression checks and updated navigation expectations.

Review screenshots and the ad hoc Playwright CLI scripts are in ignored `output/playwright/phase0` and `output/playwright/phase1`. The existing working-tree changes were preserved; no commits or database resets were performed.
