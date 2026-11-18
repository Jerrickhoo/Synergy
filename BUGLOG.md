# Synergy local review

Scope covers the existing local application and its simulated integrations. Hosting, API implementation, live email and real payments belong to a later session. The checklist follows the [product spec](docs/product/SYNERGY-SPEC.md), [mentor roadmap](docs/product/MENTOR-ROADMAP.md), and [v1.1 checklist](docs/product/V1.1-IMPLEMENTATION.md).

## Acceptance checklist

- [x] Open a fresh workspace as Founder and Mentor. Verify account sign-up, validation, saved sessions, sign-out, and logged-out navigation.
- [x] Verify matching, profile editing, filtering and saved matches. Confirm the founder exchange through terms, milestones and reviews.
- [x] Send, accept, decline and refer mentor requests. Verify capacity, blocked-state guidance, the mentorship room, scheduling, prep, notes, action items and reviews.
- [x] Verify mentor approval, moderation, trust, safety, Office Hours and simulated payments through the existing test suite.
- [x] Check desktop and phone layouts, keyboard order, empty and oversized input, repeated submission, and failed or slow connections.
- [ ] Verify the local walkthrough, dependency audit, production build and all tests. Complete two consecutive reviews with no new issues.

## Commands

Use Node.js 24 or later. Run `npm.cmd ci` and `npx.cmd playwright install chromium firefox webkit` on a fresh Windows checkout. Use `npm.cmd run dev` for development, or `npm.cmd run build` followed by `npm.cmd start` to open the built app at http://localhost:4173. For review, set `SYNERGY_DATA_FILE` to a disposable SQLite file and use the built app. Run `npm.cmd run test:unit`, `npm.cmd run test:e2e`, `npm.cmd run check:format` and `npm.cmd run check:references`.

## Issues

| ID   | Severity | Description and reproduction                                                                                                                                                                                               | Status                                                                                                                                     |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 | Major    | Open a fresh tab while the session mode check is slow or fails. The page silently offers account sign-in even in demo mode.                                                                                                | Fixed                                                                                                                                      |
| S-02 | Minor    | Open the demo at phone width. The role picker is below Sign in and outside the form.                                                                                                                                       | Fixed                                                                                                                                      |
| S-03 | Minor    | As a founder, request David Park and simulate acceptance. The room tells the founder to confirm a goal only the mentor can confirm.                                                                                        | Fixed                                                                                                                                      |
| S-04 | Major    | Open a pending mentor request, then exhaust capacity before accepting. The inbox shows the error with no clear recovery link. A founder following a link to a mentor who left discovery also gets no specific suggestions. | Fixed                                                                                                                                      |
| S-05 | Minor    | Open the founder's Introductions page with a pending mentorship request. The separate empty section does not say it covers founder exchanges.                                                                              | Fixed                                                                                                                                      |
| S-06 | Minor    | Follow the README and deployment guide for a local walkthrough. Steps mix preview and two-account paths, and email guidance contradicts itself.                                                                            | Fixed                                                                                                                                      |
| S-07 | Minor    | Open several fictional mentor profiles. Their background repeats the same placeholder.                                                                                                                                     | Fixed                                                                                                                                      |
| S-08 | Minor    | Run the full WebKit suite on Windows. The mentor chat safety test once reached the test deadline during cleanup and passed three isolated reruns.                                                                          | Fixed                                                                                                                                      |
| S-09 | Minor    | Run the full dependency audit. It flags the Vite development dependency chain through picomatch. The production dependency audit passes.                                                                                   | Deferred. The registry has no compatible patched picomatch release.                                                                        |
| S-10 | Major    | At 360 × 780, submit the preview form empty, fill both fields, then tap Sign in. The persistent error notification covers the submit button and catches taps.                                                              | Fixed                                                                                                                                      |
| S-11 | Minor    | Open an accepted Quick Ask or Doc/Pitch Review as the founder before the mentor replies. The next step tells the founder to deliver the answer or review.                                                                  | Fixed. The mentor sees the action and the founder sees what they are waiting for.                                                          |
| S-12 | Minor    | Run the WebKit referral case alongside the other browser projects. One run reached its 30-second test deadline with the final Ask button visible and enabled.                                                              | Fixed in the test. Names are unique per repeat and this two-audit scenario has a 60-second deadline. Three isolated WebKit repeats passed. |
| S-13 | Minor    | In the full WebKit run, the withdrawal and decline test reached its 1.5-second click deadline while dismissing a notification before a layout check.                                                                       | Open at the six-loop limit. The same scenario passed in isolation.                                                                         |

## Review rounds

1. Implemented the local sign-in, room guidance, request recovery and documentation fixes. Build and 190 unit tests passed. Eight targeted browser cases passed. The first hands-on phone review found S-10.
2. Moved sign-in notifications into the form and added a phone regression that corrects empty fields and double-clicks Sign in. The built app accepted one sign-in. The founder walkthrough reached David Park, opened the room, shared preparation and retained it on refresh. No new issues in this review.
3. Checked a logged-out room link, a service error and retry, a fresh Mentor preview, and an oversized password in the account sign-in form. A code review of room guidance found S-11. Made async room guidance role-specific and added checks for both participants.
4. Opened Quick Ask in the rebuilt app and verified the founder's waiting message. Checked the role-specific guidance for both async formats and reran the build and 190 unit tests. No new issues in this review.
5. Ran every browser project. The WebKit referral scenario reached its deadline after visiting both participants and running both accessibility scans. An isolated repeat passed once, then exposed duplicate referral fixture names in the shared test database. Recorded both causes under S-12.
6. Fixed the referral fixture and deadline. All three isolated referral reruns passed. The production build, reference and format checks, and all 190 unit tests passed. The complete browser rerun in isolated workspaces passed 181 of 182 cases. Chromium and the prototype passed 64 of 64, Firefox passed 59 of 59, and WebKit passed 58 of 59. The WebKit notification dismissal timed out in the full run and passed in isolation. Logged S-13 and stopped at the six-loop limit.

## Exit status

The local walkthrough and functional checklist passed. No known Critical or Major issues remain after six review rounds. The clean full-suite and two-consecutive-clean-reviews conditions remain open. The runtime dependency audit found no advisories. The development advisory and WebKit test timing are recorded above.

Review used disposable databases, desktop browsers and phone-sized viewports. Hosted operation, live integrations, real phones and production load were outside this review.
