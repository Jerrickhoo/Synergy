# Founder first-run fixes delivery

Work date: 21 November 2026. Branch `fix/founder-first-run`, uncommitted for review. Scope: usability bugs found in a first-time founder review of the preview, phases A–E. No dependency, route or deployment change.

## What changed for a founder

- **Return visits (A1).** Signing in with the same email and password, in any tab, returns to the same preview account, set to the chosen role. Room links opened in a new tab work after sign-in. A used email with a different password shows “That email is already used in this preview. Use the same password as before, or a different email.” and creates nothing. Preview emails must be well formed. Passwords are stored as salted scrypt hashes; the preview email is kept apart from password sign-in, so a preview never becomes a local login. Sign-in without credentials (scripts and tests) still opens a fresh sample account.
- **First run (B1).** A new founder preview chooses **Set up my startup** (blank profile, no persona name or photo, Edit profile opens with the description box focused) or **Explore with a sample startup** (Maria Santos, as before). Mentor previews are unchanged.
- **Profile assistant (B2, B3).** The description box starts empty. Suggestions are listed field by field as current → suggested, with checkboxes pre-checked for empty fields and fields still holding the sample value. Apply writes only checked fields and reports “Updated: … Select Save profile to keep these changes.” Offers are inferred only from offer phrasing (“we offer”, “we can offer”, “we can help with”, “we can share”); wording without a standard tag, such as “customer retention”, stays in What I need and can be proposed as a tag.
- **Profile honesty (B4–B6).** The ring is labelled “Required details” and lists optional details not yet added. The checklist uses the save validator, so a team size of −3 is not ticked. A successful save returns to the top (no smooth scroll under reduced motion). Without configured moderators, Verification explains why requests are unavailable instead of offering a button.
- **Matching (C1–C5).** Home only asks to finish the profile when required details are missing; otherwise it says “No close matches yet for `<need>`” with a Browse all link. An empty Suggested list shows the three closest eligible profiles with real scores and one opt-in, “Get notified when someone offers `<need>`”. The opt-in reuses match-suggestion Updates and turns on the match preference; Settings lists and stops alerts. Cards using a profile's own words say “They offer” and “They’re looking for”, not “You get” and “They get”. Search ignores surrounding spaces. A new mentor's Trust section reads “New mentor · no completed sessions yet”, and impact tiles without data are hidden on public profiles.
- **Request and room (D1–D9).** The request form shows inline “Add at least 20 characters.” errors and keeps a per-account, role and mentor draft across refresh until sent. The pending card shows the request and “`<Mentor>` usually replies within N days. You’ll see the reply in Updates.” Preview founders can **Simulate mentor confirming the goal** with fictional mentors; it uses the same confirm-goal rule and the same gate as simulated acceptance. Room copy, naming (“Mentorship room”, “Mentorship with `<name>`”, “Open room”), action hierarchy (Share preparation primary, Report and Block in a Safety disclosure), progress markers and empty-chat validation were corrected. The Office Hours booking and action-based room forms now show their own field errors.
- **Updates (E1).** Updates lists other people's activity and items that need attention. Your own actions stay in Home's recent activity.

## Verification

- `npm run check:references`, `check:format`, `test:unit` (202 tests, 12 new in `tests/founder-first-run.test.js`) and `build` pass.
- `npm run test:e2e`: the final full run passed 184 of 185. The one failure was a WebKit timing failure in a profile-draft test. A WebKit-only rerun then failed two other tests (Quick Ask and restore retry), and each of those also passed in a full run. All three passed every repeated isolated run (8/8, 3/3, 3/3), and none failed twice. Whether they also flake on `main` was not checked.
- New browser tests in `tests/prototype.spec.js`: return visit with a wrong-password attempt and a deep link from a new tab; field-by-field Apply review and checklist validation; request inline errors, draft after reload, pending card, simulated acceptance and goal confirmation, empty chat, scheduling and shared prep.
- Manual Playwright pass on a throwaway database at 1440 and 390 px covered the same journey, a zero-suggestion profile, a spaces-only search, match alerts in Settings and a new mentor's Trust section, with no page errors or horizontal overflow.

## Deliberate test changes

Preview sign-ins in `prototype.spec.js` now use valid emails and choose the sample on first run; the expected demo request includes credentials; the sign-in hint text changed. The ring's accessible name is now “Required profile details”, the mentorship room heading is “Mentorship room”, and the assistant unit test no longer expects an inferred Technical Development offer.

## Round 2: matches, room guidance and roles

Branch `fix/founder-second-run`, uncommitted for review.

- **Useful suggestions (A1–A3).** Suggested now needs at least 30% fit and at least one stated need the profile offers (tag or phrase). For a mentor viewer, it's a startup need the mentor offers. Scores are unchanged. A Shiftly profile no longer gets Kai Chen (37%, no need covered). Ties sort by name, so the list is deterministic. Directory version 10 adds four mentors (Marcus Webb for B2B SaaS pricing, Hana Sato for customer retention, Diego Alvarez for go-to-market, Grace Liu for product design) and one startup (ShelfShare), so every standard tag is offered by at least two of the 29 profiles. Untouched samples refresh and edited ones are kept. **Get notified when someone offers…** appears whenever a stated need isn't covered by any suggestion, and names that need.
- **Profile helper (A4–A5).** Needs and offers are listed as sentence-case items (“Pricing strategy, Customer retention”). A description that opens with “Shiftly is…” or “BarLabs builds…” suggests the startup name. Your name is part of the Ready for Matches checklist. “Pre-seed” is no longer read as Seed.
- **Room guidance (B1–B6).** Reached stages are checked and the next one is current. A payment still due is the current step. A founder with an upcoming session and unshared prep sees “Share your prep before `<session>`” in the room, on Home and in lists, through one next-action function. The next-step line opens its tab when it lives on another one. Session times use one format (“Wed, Nov 25 · 10:00 AM”) in the viewer's zone, naming the zone only when the session was set elsewhere. Calendar files are unchanged. A past date marks the date field with an inline message. Ongoing Advisory's effort reads “4 check-ins over 8 weeks”, from the same defaults the rules use.
- **Roles across tabs (C1).** Signing in to a preview account as its other role asks first: “You were last using Synergy as a founder. Switch to mentor? Other open tabs will switch too.” The check runs after the password, so a wrong password doesn't reveal the role. A room, or a mentor's match link, that belongs to the other role shows “This room belongs to your founder profile” with **Switch to founder**.
- **Polish (D1–D6).** A wrong preview password appears once, beside its field. Updates' digest counts the rows it lists. The first-run choice has a quiet Sign out. Renaming away from Maria Santos drops the sample photo on Save. Home says “Your collaborations” and labels rows “Mentorship with `<name>`”. Error toasts no longer outlive the page they were raised on; success toasts already closed after five seconds.

### Round 2 verification

- `check:references`, `check:format`, `test:unit` (212 tests; 10 new in `tests/founder-second-run.test.js`) and `build` pass.
- `test:e2e`: 185 of 186 passed. The one failure was WebKit `mentor-safety.spec.js` timing out while opening a second page. Repeated three times, it passed 3/3 on this branch and 3/3 on a `main` worktree, so it didn't reproduce on either.
- New browser checks cover the progress marks after goal confirmation, the prep nudge and its tab link, the role-switch confirmation, and **Switch to founder** from a room.
- Manual Playwright pass at 1366 and 390 px on a throwaway database covered:
  - Shiftly setup with split items, the startup name and the name checklist.
  - Three relevant suggestions, including Marcus Webb.
  - Request, simulated acceptance and goal confirmation, the progress marks, the session format, the prep nudge clearing and the past-date inline error.
  - The role-switch dialog and Switch to founder.
  - BarLabs staying Pre-seed, the initials avatar after renaming, zero suggestions and the match-alert opt-in.

### Round 2 deliberate test changes

Directory counts moved from 24 to 29 (15 startups, 14 mentors) in the unit and browser checks. Specs that located the current stage by label now expect the reached stage checked and the next one current. The round-1 return-visit tests confirm the role switch and expect sentence-case need and offer items, with the startup name as the profile heading.

## Round 3: cards agree with details, digest and copy

Branch `fix/founder-second-run`, uncommitted for review.

- **Cards agree with match details (1a).** Need fit already counted plain-text overlap, but cards only named shared standard tags. The scorer now also reports which of your need items the word overlap matched (`exchange.matchedNeeds`), and cards, match details and introductions read it through one helper. A need item counts only when every one of its words is in their offer, so “Product strategy” never reads as covering “Pricing strategy”. For Shiftly, Hana Sato's card says “Offers what you need: Customer retention” with it under **You get**, and her match page leads with “They offer what you need: Customer retention.” The “They offer” fallback stays for profiles that match none of your needs word for word. A 30–64% Need fit with no whole item matched reads “Needs and offers partly overlap”. Scores, weights and the algorithm version are unchanged.
- **Customer Retention tag (1b) not added.** It changes Shiftly's scores without touching weights: with two need tags, Marcus Webb and Diego Alvarez cover half and drop from 78% to 51%, and no Shiftly match reaches the 70% Match Updates threshold. The product owner chose to keep ranking as it is. The vocabulary is computed at runtime (standard tags plus approved tags), so existing workspaces would pick it up with no migration if it's added later; a second sample offering it would need a directory version bump.
- **Digest (2).** The digest leaves out people you already have an open room with, from both the count and the list, as Suggested does. Its summary names what it counts: “1 strong match (70%+ fit)”, “2 match alerts”, “2 collaboration updates”. Its note says Matches shows every suggestion. An older “Marcus Webb is a 78% profile fit.” row offers **Open room** (or **Open Deal Room**) once you have a room together. The 70% threshold is unchanged.
- **Copy (3a–3c).** The role-switch dialog keeps its “Switch to mentor?” title and buttons; the body is “You were last using Synergy as a founder. Other open tabs will switch too.” In mentorship room schedules, **Enable calendar download** is now **Get calendar file**: it creates the private calendar link and replaces itself with **Download .ics** for that session, with a spinner on the clicked button only. Match cards no longer show the “New Mentor” badge; the match page keeps “New mentor · no completed sessions yet”. Home lists never showed it.

### Round 3 verification

- `check:references`, `check:format`, `test:unit` (219 tests; 7 new in `tests/founder-third-run.test.js`) and `build` pass.
- `test:e2e`: 184 of 186 passed. Two failures didn't reproduce on this branch and also occur on `main`:
  - Chromium `features.spec.js` accessibility check: axe reported color-contrast on one `.primary` element. It passed 3/3 on this branch on rerun. On a `main` worktree it failed 1 of 3 with the same violation.
  - WebKit `mentor-safety.spec.js`: `setViewportSize` timed out, as in round 2. It passed 3/3 on this branch and 3/3 on `main`.
- Manual Playwright pass at 1366 and 390 px on a throwaway database:
  - Shiftly setup through the profile helper.
  - Hana's card and match page both name Customer retention, and no card shows a “New Mentor” badge on Matches or Home.
  - Request, simulated acceptance, goal confirmation and scheduling with Marcus Webb.
  - **Get calendar file**, which shows the toast and a **Download .ics** file containing the event.
  - The digest reading “1 strong match (70%+ fit) and 2 collaboration updates” and listing only Diego Alvarez, with Marcus's row offering **Open room**.
  - The role-switch dialog copy from a second tab, then **Continue as founder**.

### Round 3 deliberate test changes

The update-destination unit test now expects a match update for someone with an open room to open that room, and adds a no-room case for **View match**. The role-switch browser check expects the new dialog body. The Shiftly browser check also covers Hana's card and match page and the missing badges.

## Round 4: price filters, one-click calendar file and form copy

Branch `fix/founder-second-run`, uncommitted for review.

- **Price filters count as active (1).** **Free only** and a set **Maximum price** now count toward the number on the **Filters** button, as the other dialog filters do. When they hide every suggestion, Matches shows “No matches found” with **Clear filters** instead of “No suggestions yet” and **Closest profiles so far**. The count and empty-state rules live in `src/data/filters.js` (`activeFilterCount`, `hasActiveFilters`, `emptyStateKind`). Before this round, **Clear filters**, header search and the dialog's **Reset filters** also left Free only and Maximum price set. All three now start from one `defaultMatchFilters`.
- **Maximum price is validated (2).** The field is empty for any price, or takes a whole or decimal number of 0 or more. Anything else marks it invalid, shows “Enter a price of 0 or more, or leave it empty.” and disables **Show matches**, as **Minimum fit** does. If an invalid value reaches `filterPeople` anyway, it is ignored and nobody is hidden.
- **Calendar file in one click (3).** **Get calendar file** creates the private calendar link, with a spinner on the button, then downloads that session's `.ics` file at once. The control then reads **Download .ics again**. If the link can't be created, the error shows beside the button. Events are named from the viewer's side: “Mentorship with Marcus Webb” for the founder, “Mentorship with Jordan Lee” for the mentor, and “Office Hours with …” for Office Hours. Names are escaped as RFC 5545 text. UID, DTSTART and DTEND are unchanged. The subscription feed on the Calendar page uses the same titles.
- **Form copy and icons (4a–4c).** The add-task form heading is **New task**. **Add task**, the column add buttons and each empty column's **Add a task** now use a new `plus` icon from the app's icon set, at 16px like other icons in buttons. Error toasts have specific titles: “Couldn't add your note” (`session-note`), “Couldn't save the task” (`task-create` and `task-update`) and “Couldn't create the calendar file” (`calendar-link`). These are the scopes the forms dispatch, read from their `data-form`.
- **Filters kept for the tab (4d).** Applied filters are saved in `sessionStorage`, keyed by account and role, so a reload keeps them. Invalid saved values are reset. The key uses the `synergy-draft:` prefix, so sign-out clears it along with drafts.

### Round 4 verification

- `check:references`, `check:format`, `test:unit` (227 tests; 8 new in `tests/founder-fourth-run.test.js`) and `build` pass.
- `test:e2e`: the first full run had 180 of 189 passing. Six failures were mine and are fixed. `office-hours.spec.js` still expected the old event title in all three browsers. The new price-filter check had an escaping error in its regex in all three browsers. Rerunning `office-hours`, `ui-roadmap`, `features` and `mentor-safety` in every browser passed 77 of 78. The other failures don't come from this round:
  - Chromium `ui-roadmap.spec.js` mentor photo draft timed out during a page reload while files were being edited mid-run. It passed on rerun.
  - WebKit `features.spec.js` notification preview and WebKit `mentor-safety.spec.js` each passed 3/3 on this branch and 3/3 on a `main` worktree.
  - Chromium `features.spec.js` keyboard and accessibility check: axe reported color-contrast on one `.primary` element, as in round 3. It passed in the full run and 3/3 on this branch, and failed 1 of 3 on `main` with the same violation.
- Manual Playwright pass at 1366 and 390 px on a throwaway database, 37 of 37 checks passing:
  - Shiftly setup through the profile helper.
  - Filters: Maximum price −100 shows the error and disables **Show matches**. Minimum fit 101 is still rejected. Maximum price 0 with Free only shows **Filters 2** and **Clear filters**, with no “Closest profiles so far”. The demo directory's mentors are all free, so the 3 suggestions stay. The filters survive a reload, and **Clear filters** brings back the full list of 3.
  - Request to Marcus Webb, simulated acceptance, simulated goal confirmation, then a session at 10:00 Asia/Manila.
  - A first **Get calendar file** with the API failing shows the spinner, then the inline error. A retry downloads the file in one click. The file has one event, `SUMMARY:Mentorship with Marcus Webb`, `DTSTART` 02:00Z and `DTEND` 03:00Z. **Download .ics again** downloads it again.
  - Action items show the **New task** heading and the plus icons, and an empty title gives “Couldn't save the task”. Notes: an empty note gives “Couldn't add your note”.
  - At 390 px, Action items, Schedule and the Filters dialog have no horizontal scroll.

### Round 4 deliberate test changes

`tests/office-hours.spec.js` now expects the mentor's feed to read `SUMMARY:Office Hours with OfficeFounder Audit` instead of `SUMMARY:Mentorship Office Hours`. No spec checked the old task copy or the two-step calendar flow. `tests/ui-roadmap.spec.js` gains a browser check for Maximum price validation, the active count, the filtered empty state, **Clear filters** and **Reset filters**.
