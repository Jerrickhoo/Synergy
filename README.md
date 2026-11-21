# Synergy

Synergy is a React/Vite prototype for finding startup collaborators and mentors and completing shared work in deal rooms. It runs without third-party API keys or accounts. Choose **Founder** or **Mentor** in **Prototype role**, enter any email and password, and select **Sign in**. Sign in again with the same email and password, in any tab, to come back to the same preview account.

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

### Five-minute founder walkthrough

1. Choose **Founder** and sign in with any email and password. Select **Explore with a sample startup**. Open **David Park** from Home or find him in **Matches**.
2. Choose **Single Session**. Describe the problem (“Students leave our budgeting app during onboarding”), what you tried (“We interviewed twelve teams and shortened the first form”), and the question (“Which experiment should we run next?”). Select **Send mentorship request**, then **Simulate acceptance**.
3. In the Mentorship room, add a short note in **Session prep** and select **Share preparation**. Refresh the page and check that the note is still there. To continue, select **Simulate mentor confirming the goal**, then pick a time in **Schedule**.

The first time a founder signs in with new credentials, Synergy asks how to start: **Set up my startup** opens Edit profile with an empty description box, and **Explore with a sample startup** uses Maria Santos’s sample company. Mentor previews start ready to mentor, as before. Signing in later with the same email and password returns to the same account, profile and rooms, including room links opened in a new tab; a different password for a used email is refused. The role is account-wide: signing in as the other role asks first, because other open tabs switch too, and a room that belongs to the other role offers **Switch to founder** (or mentor). Preview emails must look like real addresses but receive no mail. The directory is fictional. Use the two-account setup below to see the mentor receive and respond to a real request inside the local workspace. Demo email uses a stub and checkout uses simulated payments.

### Two-account walkthrough

1. Set `SYNERGY_DEMO_MODE=false`, restart the server, and create separate Founder and Mentor accounts. Submit the mentor application and approve it with a configured moderator account. Use a separate local database for this walkthrough.
2. Give both accounts complete profiles, with the mentor offering the type of help the founder needs.
3. From Matches, send a structured mentorship request or start a founder exchange. Open the mentor's Requests inbox to accept, decline or refer. Founders can also book public Office Hours slots directly.
4. Agree on terms and confirm milestones for founder exchanges. In a Mentorship Room, use the format-specific controls for goals, prep, scheduling, attendance, shared notes and action items.
5. Submit private reviews when the review window opens. Feedback is released after both reviews arrive or the window closes. Single Sessions prompt for a founder follow-up. Ongoing Advisory reserves four check-ins over eight weeks by default and uses a cycle review to decide whether to continue.
6. Use Updates for unread activity, match suggestions, deadlines and upcoming-session reminders. Settings provides Light/Dark appearance, confirmed active-profile switching, blocking, data export and a collapsed Danger zone containing profile visibility, session management and account deletion.

Prototype Matches includes 29 fictional collaborators: 15 startups and 14 mentors, with a mix of local illustrated avatars and initials. Every standard tag is offered by at least two of them. Suggested shows eligible profiles with at least 30% fit that also offer at least one of your stated needs (for mentors: that need help the mentor offers); Browse all also includes weak and zero-fit profiles, and an empty Suggested list shows the closest profiles. When a stated need is not covered by any suggestion, Matches offers **Get notified when someone offers** that need. Scores use the normal matching algorithm. Restart an already-running server to load the expanded directory. Versioned fixture refreshes preserve edited sample profiles and existing references. See the [Phase 2 delivery notes](docs/ux/PHASE-2-DELIVERY.md) for sparse/no-suggestion reference scenarios and verification.

Match details now lead with identity, relevant support and a collaboration action panel, with the numerical fit breakdown available on demand. Profile viewing and editing have separate layouts for founders and mentors; drafts stay in the current browser tab and role until saved or canceled. Updates supports All/Unread filtering, date groups, relative times and the same rows in the header preview. Generated updates retain their first-seen time across polling and server restarts; session times and UTC deadlines remain separate. See the [Phase 3 delivery notes](docs/ux/PHASE-3-DELIVERY.md).

Founder exchange rooms include a **Task board** with cards, priorities, milestones and deadlines. Mentorship rooms use founder-owned action items. Mentors manage recurring Office Hours in **Calendar**, and both participants can download session files or subscribe to a private calendar feed. The server checks scheduling conflicts and capacity. Sessions display in the viewer's time zone.

Mentor Home shows ranked requests, today's sessions, attendance, follow-ups and capacity. **Mentees** groups active rooms by stage. **Impact** shows mentoring stats, badges, agreed testimonials and a certificate with volunteer and paid hours. The moderation area covers approvals, disputes, safety, attendance and payments, along with mentoring settings and launch metrics. [Mentor-side roadmap](docs/product/MENTOR-ROADMAP.md)

v1.1 adds simulated paid mentoring. Complete simulated payout setup in Settings, set a format price, then use separate founder and mentor accounts to request, accept and pay. Checkout offers success, failure and expiry controls. Payment records cover session payouts, refunds, advisory cycles and moderator disputes. Set `PAYMENTS_PROVIDER=simulated` and set `PAYMENTS_WEBHOOK_SECRET` to verify signed callbacks. The [v1.1 checklist](docs/product/V1.1-IMPLEMENTATION.md) tracks verification and the live-provider requirements.

Post-test polish phases A–F are complete: custom dropdowns across the app, compact Updates, a notification preview positioned below the header, a quiet workspace background, a dedicated Danger zone, confirmed voluntary sign-out and simpler profiles with one completion ring. Active profile switching now lives in Settings. The [baseline](docs/ux/POST-TEST-POLISH-BASELINE.md) inventories the controls; [A–B delivery](docs/ux/POST-TEST-POLISH-DELIVERY.md), [C–D delivery](docs/ux/POST-TEST-POLISH-CD-DELIVERY.md) and [E–F cleanup/release review](docs/ux/POST-TEST-POLISH-EF-DELIVERY.md) record acceptance. Documentation is categorized, obsolete native-dropdown CSS is removed, and the final unit/browser/build checks pass.

Matching, profile editing, in-app notifications, uploads and collaboration run locally. The durable outbox uses a stub by default. A deployed workspace can enable Brevo for mentorship emails. New request emails default to a daily digest at 08:00 in the mentor's time zone, with an instant option in Settings. Actions that need attention remain visible in Updates. [Email setup](docs/operations/DEPLOYMENT.md#mentorship-email)

`SYNERGY_REQUIRE_VERIFICATION=false` is the local default; Render enables it. When enabled, affiliation verification by a moderator is required to send or accept introductions. Browsing, searching, profile editing and saving remain available. Accelerator, university, community and referral evidence are supported without a business domain. Preview accounts remain exempt. Moderation queues and escalated disputes show three-weekday due dates and overdue status. Pair scores use symmetric factors (`reciprocal-v3`), with unchanged weights and the existing uneven-audience cap; saved room snapshots retain their original algorithm. See the [founder audit delivery](docs/ux/FOUNDER-UX-AUDIT-DELIVERY.md).

`SYNERGY_DEMO_MODE=true` is the default locally and in Render. Set it to `false` only if you want to use local signup and password validation instead of simulated sign-in. This does not enable external authentication. Local passwords are salted and hashed with scrypt. A role-preview password only reopens that preview account; deleting one requires its current session and typing DELETE, without a password prompt.

## Storage and account controls

New workspaces use transactional SQLite with WAL at `.data/synergy.sqlite`. The previous neighboring `synergy.json` is imported once when an empty default database is opened; its original is preserved. Explicit JSON paths remain supported. Uploads live beside the database in `uploads/`. Set `SYNERGY_DATA_FILE` to change the location. Run one application writer per database.

The local API requires an account session and enforces profile ownership and room membership. Simulated partner behavior exists only for prototype preview accounts working with server-verified fictional fixtures, with demo mode enabled. A fictional partner can accept a pending introduction or mentorship request, and a fictional mentor can confirm a mentorship goal, through explicit simulation actions. Goal simulation uses the same confirm-goal rule as a real mentor. Fictional exchange partners can also respond to terms, milestones, revisions and reviews. Repeated requests reuse the same room. Real accounts, real counterpart profiles, other preview accounts, withdrawn introductions and hidden or blocked profiles cannot use this exception, and terms, confirmations, dispute resolutions and reviews between real accounts always require the other participant. Tokens are scoped to a browser tab and survive refreshes; restarting the server ends sessions. Prototype accounts and edits remain in the database after sign-out and are not automatically deleted. Preview passwords are salted and hashed with scrypt, and the preview email is stored apart from password sign-in, so it never becomes a local account login. To present an empty workspace, use a new data file.

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

Checks cover account isolation, simulated sign-in and role selection, profile editing, matching, shared terms, evidence, milestone revisions, blind reviews, moderation, unread updates, private files, backups, storage failures and accessibility. Four browser projects use isolated databases on ports 5181–5184. Verification and mentor approval have separate servers on ports 5185 and 5186. They include both mentorship initiation directions, keyboard task cards, milestone menus and dialogs, phone reflow and accessibility preferences. Removed service endpoints are checked to return 404.

## Source layout

- `server/workspace.js`: accounts, matching, introductions, shared rooms, sessions and simulated sign-in and role selection.
- `server/api.js`: local JSON API and Vite integration.
- `server/features.js`: collaboration lifecycle, moderation and in-app notifications.
- `server/delivery.js` and `server/mentor-email.js`: durable outbox, email stub, Brevo adapter and suppression.
- `server/storage.js`: transactional SQLite persistence and atomic JSON compatibility.
- `server/accounts.js`: visibility, blocking, exports, sessions and deletion.
- `server/operations.js` and `server/backup.js`: storage readiness and consistent backups.
- `server/start.js`: server for the built app.
- `src/state/`: UI state, local API synchronization, routing and validation.
- `src/data/`: matching, collaboration rules and reusable engagement templates.
- `src/components/` and `src/pages/`: interface and workflows.
- `tests/`: state, backend, local API and browser checks.

The [documentation index](docs/README.md) links product references, operations, architecture plans, UX delivery and archived reviews. [Source and stylesheet ownership](docs/maintenance/SOURCE-LAYOUT.md) explains the CSS cascade and generated/data boundaries. [Historical audits](docs/archive/AUDIT.md) and [QA records](docs/archive/QA-REPORT.md) retain earlier development results; their integration descriptions do not describe the current prototype.
