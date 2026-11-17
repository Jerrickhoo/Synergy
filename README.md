# Synergy

Synergy is a React/Vite prototype for finding startup collaborators and mentors and completing shared work in deal rooms. It runs without third-party API keys or accounts. Enter any non-empty email and password, choose **Founder** or **Mentor** in the bottom-right **Prototype role** dropdown, and select **Sign in**. These inputs simulate login; they do not need to be real credentials.

## Run locally

Requires Node.js 24+ and npm (SQLite uses the built-in Node database module).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is restricted. Vite also runs the local workspace API; no separate backend command is required. `.env` is optional.

For a built version:

```sh
npm run build
npm start
```

This serves the app and local API at http://localhost:4173. `npm run preview` also includes the API. The app needs its Node server to save work; uploading only `dist/` to a static host is insufficient.

## Present the prototype

1. Enter any credentials and choose a founder or mentor in the bottom-right dropdown on the sign-in screen. Each entry creates a separate account with editable sample profiles. The session survives page refreshes. Signing out returns to the welcome screen.
2. Role previews can browse fictional sample profiles and send introductions. For a pending outgoing introduction to a fictional sample, **Simulate acceptance** opens one shared room. This prototype action is authorized on the server only for preview accounts and fictional fixtures. Preview accounts cannot discover or connect with one another. For a reciprocal demonstration with two people, set `SYNERGY_DEMO_MODE=false`, restart the server, and create two local password accounts in separate tabs, choosing Founder and Mentor. Complete both profiles so they appear in each other's Matches. No sample conversations, rooms, ratings or activity are inserted.
3. Send an introduction from Matches. The other account accepts it to open a shared room. Founder pairs can choose beta testing or co-marketing; mentor connections use mentorship.
4. Agree on terms, discuss details in Chat, schedule sessions, set deadlines, upload evidence and confirm milestones from both accounts. Changes appear automatically in the other account.
5. The last mutual milestone confirmation automatically launches the exchange (or completes one-off mentorship). Both participants have 14 days to submit private reviews; feedback is released when both submit or the window closes. Either participant can undo completion within 24 hours before either review is submitted. Ongoing mentorship uses 8-week cycles with goals, a check-in summary, blind cycle reviews, and a Continue/Finish decision from each participant.
6. Use Updates for unread activity, match suggestions, deadlines and upcoming-session reminders. Settings provides Light/Dark appearance, confirmed active-profile switching, blocking, data export and a collapsed Danger zone containing profile visibility, session management and account deletion.

Prototype Matches includes 24 fictional collaborators: 14 startups and 10 mentors, with a mix of local illustrated avatars and initials. Suggested shows eligible profiles with at least 30% fit; Browse all also includes weak and zero-fit profiles. Scores use the normal matching algorithm. Restart an already-running server to load the expanded directory. Versioned fixture refreshes preserve edited sample profiles and existing references. See the [Phase 2 delivery notes](docs/ux/PHASE-2-DELIVERY.md) for sparse/no-suggestion reference scenarios and verification.

Match details now lead with identity, relevant support and a collaboration action panel, with the numerical fit breakdown available on demand. Profile viewing and editing have separate layouts for founders and mentors; drafts stay in the current browser tab and role until saved or canceled. Updates supports All/Unread filtering, date groups, relative times and the same rows in the header preview. Generated updates retain their first-seen time across polling and server restarts; session times and UTC deadlines remain separate. See the [Phase 3 delivery notes](docs/ux/PHASE-3-DELIVERY.md).

Rooms also include a **Task board** with shared cards, owners, priorities, milestone links and due dates. Drag cards between To do, In progress and Done, or use each card's status menu. Task completion does not confirm the room's milestones. Mentorship rooms use one **Schedule** planner from both the Schedule tab and session milestone. Choose a date, time, duration and optional weekly series, then review before saving. Agree on availability and a meeting link in Chat; these tools do not check conflicts or connect to external calendars.

**Calendar** is a secondary tool reached from Home sessions, mentorship Schedule, dated Deal Rooms or Settings. Main navigation has four items. Calendar has Month and Agenda views, a collaboration filter and selected-day details. It combines active-room sessions, open task deadlines and unconfirmed milestones. Sessions display in your device timezone; task dates stay on their assigned date and milestones retain their UTC date. New schedules use your device timezone; editing a saved series retains its original timezone. Task board is an optional disclosure under Milestones. See the [Phase 4 delivery notes](docs/ux/PHASE-4-DELIVERY.md).

Mentor Home prioritizes requests, upcoming sessions, active mentees and assigned preparation/follow-up. Mentor Matches leads with startup needs and goals; introduction briefs use the current profile. Mentorship rooms distinguish the shared progress reflection from the private review after completion. Both collaborators still confirm every milestone before completion. See the [Phase 5 delivery](docs/ux/PHASE-5-DELIVERY.md) and [Phase 6 release review](docs/ux/PHASE-6-DELIVERY.md).

Post-test polish phases A–F are complete: custom dropdowns across the app, compact Updates, a notification preview positioned below the header, a quiet workspace background, a dedicated Danger zone, confirmed voluntary sign-out and simpler profiles with one completion ring. Active profile switching now lives in Settings. The [baseline](docs/ux/POST-TEST-POLISH-BASELINE.md) inventories the controls; [A–B delivery](docs/ux/POST-TEST-POLISH-DELIVERY.md), [C–D delivery](docs/ux/POST-TEST-POLISH-CD-DELIVERY.md) and [E–F cleanup/release review](docs/ux/POST-TEST-POLISH-EF-DELIVERY.md) record acceptance. Documentation is categorized, obsolete native-dropdown CSS is removed, and the final unit/browser/build checks pass.

All matching, profile editing, notifications, uploads and collaboration flows run locally. Email delivery, email verification, password recovery and email changes are unavailable. A durable outbox and stub sender provide an email integration boundary without external services. New accounts default to weekly in-app digests; top three new matches link to their profiles, with a 70% alert threshold. Items needing a reply remain immediate. Profile drafting is a rule-based browser assistant; founders review every suggestion before saving.

`SYNERGY_REQUIRE_VERIFICATION=false` is the local default; Render enables it. When enabled, affiliation verification by a moderator is required to send or accept introductions. Browsing, searching, profile editing and saving remain available. Accelerator, university, community and referral evidence are supported without a business domain. Preview accounts remain exempt. Moderation queues and escalated disputes show three-weekday due dates and overdue status. Pair scores use symmetric factors (`reciprocal-v3`), with unchanged weights and the existing uneven-audience cap; saved room snapshots retain their original algorithm. See the [founder audit delivery](docs/ux/FOUNDER-UX-AUDIT-DELIVERY.md).

`SYNERGY_DEMO_MODE=true` is the default locally and in Render. Set it to `false` only if you want to use local signup and password validation instead of simulated sign-in. This does not enable external authentication. Local passwords are salted and hashed with scrypt. Role-preview accounts do not have user-facing passwords; deleting one requires its current session and typing DELETE.

## Storage and account controls

New workspaces use transactional SQLite with WAL at `.data/synergy.sqlite`. The previous neighboring `synergy.json` is imported once when an empty default database is opened; its original is preserved. Explicit JSON paths remain supported. Uploads live beside the database in `uploads/`. Set `SYNERGY_DATA_FILE` to change the location. Run one application writer per database.

The local API requires an account session and enforces profile ownership and room membership. Simulated partner behavior exists only for prototype preview accounts working with server-verified fictional fixtures, with demo mode enabled. A fictional partner accepts a pending introduction on request, then answers the preview account's own actions automatically: accepting terms, agreeing to reopen them, confirming milestones, accepting revisions, agreeing to resolve disputes and submitting a review. Each response is labelled as simulated in the room and in Updates. Repeated requests reuse the same room. Real accounts, real counterpart profiles, other preview accounts, withdrawn introductions and hidden or blocked profiles cannot use this exception, and terms, confirmations, dispute resolutions and reviews between real accounts always require the other participant. Tokens are scoped to a browser tab and survive refreshes; restarting the server ends sessions. Prototype accounts and edits remain in the database after sign-out and are not automatically deleted. To present an empty workspace, use a new data file.

Light is the first-visit appearance, independently of the operating system. Settings persists an explicit Light/Dark choice in browser local storage and applies it before React renders. Profiles keep unpublished drafts separately per account, role and tab. Typing, blur and Enter in a text field do not publish changes; activate **Save profile** explicitly. Enter in a multiline field inserts a newline. Cancel restores the published profile. Role switching confirms the current and target profiles and keeps separate drafts. Successful sign-out clears this tab's drafts; a failed request keeps the session, drafts and retryable dialog.

**Change photo** accepts JPEG, PNG and WebP up to 5 MB, with preview, replacement and removal. Photos remain part of the draft until Save profile succeeds. The server decodes and validates photos with Sharp, rejects corrupt, animated or over-40-megapixel images, removes metadata and stores a bounded WebP beside the database using the existing file infrastructure. Images are served only to an authenticated owner, an eligible viewer or an existing collaborator; old/replaced photos are no longer served. Include uploads in backups as usual. Blank offer/need entries are discarded and whitespace-only About me remains subject to the existing required-field rule.

Match filters accept any whole minimum-fit percentage from 0 to 100 inclusive; an empty field or Reset means no minimum. Apply narrows the current Suggested, Browse or Saved list without changing scores or eligibility. Saved state persists across cards, details, Saved and Home. **Report collaborator** in match details' Safety and privacy and room reporting both save to the moderator queue, including the authenticated reporter and reported profile IDs. Reporting requires a reason, accepts optional details, and does not block. Blocking remains a separate confirmed action. See the [R1–R19 delivery record](docs/ux/UI-INTERACTION-DELIVERY.md) for implementation and verification evidence.

Visibility pauses discovery and pending introductions. Blocking withdraws introductions, closes unfinished rooms and prevents further chat. Deletion removes private account details, revokes sessions and anonymizes names in shared history; agreements, evidence, messages and released reviews remain available to collaborators. Backup snapshots follow the operator's retention policy.

Matching uses Unicode-aware word coverage and separately recorded algorithm and weight versions. Exchanges score both directions of need/offer coverage; mentorship compares founder needs with mentor offers and expertise. Missing inputs earn no positive signal. Scores describe provisional profile fit.

Set `SYNERGY_ADMIN_EMAILS` to allow specific local password accounts to moderate. Moderation supports reports, disputes, account suspension, affiliation review, proposed vocabulary, reusable engagement templates and versioned matching weights. Role-preview accounts receive no moderator privileges. Decisions are audited.

See [DEPLOYMENT.md](docs/operations/DEPLOYMENT.md) for hosting, backups and recovery. `npm run benchmark` runs a disposable synthetic local concurrency check.

## Checks

For a full manual walkthrough with test accounts, steps and expected results, see the [test-case runthrough](docs/testing/TEST-CASE-RUNTHROUGH.md).

```sh
npx playwright install chromium firefox webkit
npm run check:references
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Checks cover account isolation, simulated sign-in and role selection, profile editing, matching, shared terms, evidence, milestone revisions, blind reviews, moderation, unread updates, private files, backups, storage failures and accessibility. Four browser projects use isolated databases on ports 5181–5184; a gated verification server uses 5185. They include both mentorship initiation directions, keyboard task cards, milestone menus and dialogs, phone reflow and accessibility preferences. Removed service endpoints are checked to return 404.

## Source layout

- `server/workspace.js`: accounts, matching, introductions, shared rooms, sessions and simulated sign-in and role selection.
- `server/api.js`: local JSON API and Vite integration.
- `server/features.js`: collaboration lifecycle, moderation and in-app notifications.
- `server/delivery.js`: durable deduplicated outbox, injectable sender and non-delivering email stub.
- `server/storage.js`: transactional SQLite persistence and atomic JSON compatibility.
- `server/accounts.js`: visibility, blocking, exports, sessions and deletion.
- `server/operations.js` and `server/backup.js`: storage readiness and consistent backups.
- `server/start.js`: server for the built app.
- `src/state/`: UI state, local API synchronization, routing and validation.
- `src/data/`: matching, collaboration rules and reusable engagement templates.
- `src/components/` and `src/pages/`: interface and workflows.
- `tests/`: state, backend, local API and browser checks.

The [documentation index](docs/README.md) links product references, operations, architecture plans, UX delivery and archived reviews. [Source and stylesheet ownership](docs/maintenance/SOURCE-LAYOUT.md) explains the CSS cascade and generated/data boundaries. [Historical audits](docs/archive/AUDIT.md) and [QA records](docs/archive/QA-REPORT.md) retain earlier development results; their integration descriptions do not describe the current prototype.
