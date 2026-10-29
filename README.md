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
2. Open a second browser tab and choose another role to demonstrate two collaborators. Completed profiles appear in Matches. No sample conversations, rooms, ratings or activity are inserted.
3. Send an introduction from Matches. The other account accepts it to open a shared room. Founder pairs can choose beta testing or co-marketing; mentor connections use mentorship.
4. Agree on terms, discuss details in Chat, schedule sessions, set deadlines, upload evidence and confirm milestones from both accounts. Changes appear automatically in the other account.
5. Launch a completed collaboration and submit private reviews. Partner feedback stays hidden until both reviews are submitted. Completed collaborations appear in profile history.
6. Use Updates for unread activity, match suggestions, deadlines and upcoming-session reminders. Settings provides visibility, blocking, data export, session management and account deletion.

Prototype Matches includes 24 fictional collaborators: 14 startups and 10 mentors, with a mix of local illustrated avatars and initials. Suggested shows eligible profiles with at least 30% fit; Browse all also includes weak and zero-fit profiles. Scores use the normal matching algorithm. Restart an already-running server to load the expanded directory. Versioned fixture refreshes preserve edited sample profiles and existing references. See the [Phase 2 delivery notes](docs/ux/PHASE-2-DELIVERY.md) for sparse/no-suggestion reference scenarios and verification.

Match details now lead with identity, relevant support and a collaboration action panel, with the numerical fit breakdown available on demand. Profile viewing and editing have separate layouts for founders and mentors; drafts stay in the current browser tab and role until saved or canceled. Updates supports All/Unread filtering, date groups, relative times and the same rows in the header preview. Generated updates retain their first-seen time across polling and server restarts; session times and UTC deadlines remain separate. See the [Phase 3 delivery notes](docs/ux/PHASE-3-DELIVERY.md).

Rooms also include a **Task board** with shared cards, owners, priorities, milestone links and due dates. Drag cards between To do, In progress and Done, or use each card's status menu. Task completion does not confirm the room's milestones. Mentorship rooms use one **Schedule** planner from both the Schedule tab and session milestone. Choose a date, time, duration and optional weekly series, then review before saving. Agree on availability and a meeting link in Chat; these tools do not check conflicts or connect to external calendars.

The sidebar **Calendar** has Month and Agenda views, a collaboration filter and selected-day details. It combines active-room sessions, open task deadlines and unconfirmed milestones. Sessions display in your device timezone; task dates stay on their assigned date and milestones retain their UTC date. New schedules use your device timezone; editing a saved series retains its original timezone so collaborators elsewhere do not shift it accidentally. See the [Phase 4 delivery notes](docs/ux/PHASE-4-DELIVERY.md).

All matching, profile editing, notifications, uploads and collaboration flows run locally. External email delivery, email verification, password recovery, email changes, email digests and AI profile drafting have been removed. No integration setup or unavailable-service controls appear in the interface.

`SYNERGY_DEMO_MODE=true` is the default locally and in Render. Set it to `false` only if you want to use local signup and password validation instead of simulated sign-in. This does not enable external authentication. Local passwords are salted and hashed with scrypt. Role-preview accounts do not have user-facing passwords; deleting one requires its current session and typing DELETE.

## Storage and account controls

New workspaces use transactional SQLite with WAL at `.data/synergy.sqlite`. The previous neighboring `synergy.json` is imported once when an empty default database is opened; its original is preserved. Explicit JSON paths remain supported. Uploads live beside the database in `uploads/`. Set `SYNERGY_DATA_FILE` to change the location. Run one application writer per database.

The local API requires an account session and room membership. Partner confirmations cannot be simulated through the API. Tokens are scoped to a browser tab and survive refreshes; restarting the server ends sessions. Prototype accounts and edits remain in the database after sign-out and are not automatically deleted. To present an empty workspace, use a new data file.

Visibility pauses discovery and pending introductions. Blocking withdraws introductions, closes unfinished rooms and prevents further chat. Deletion removes private account details, revokes sessions and anonymizes names in shared history; agreements, evidence, messages and released reviews remain available to collaborators. Backup snapshots follow the operator's retention policy.

Matching uses Unicode-aware word coverage and separately recorded algorithm and weight versions. Exchanges score both directions of need/offer coverage; mentorship compares founder needs with mentor offers and expertise. Missing inputs earn no positive signal. Scores describe provisional profile fit.

Set `SYNERGY_ADMIN_EMAILS` to allow specific local password accounts to moderate. Moderation supports reports, disputes, account suspension, affiliation review, proposed vocabulary, reusable engagement templates and versioned matching weights. Role-preview accounts receive no moderator privileges. Decisions are audited.

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting, backups and recovery. `npm run benchmark` runs a disposable synthetic local concurrency check.

## Checks

```sh
npx playwright install chromium firefox webkit
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Checks cover account isolation, simulated sign-in and role selection, profile editing, matching, shared terms, evidence, milestone revisions, blind reviews, moderation, unread updates, private files, backups, storage failures and accessibility. Browser checks use isolated databases on ports 5181?5184. Removed service endpoints are checked to return 404.

## Source layout

- `server/workspace.js`: accounts, matching, introductions, shared rooms, sessions and simulated sign-in and role selection.
- `server/api.js`: local JSON API and Vite integration.
- `server/features.js`: collaboration lifecycle, moderation and in-app notifications.
- `server/storage.js`: transactional SQLite persistence and atomic JSON compatibility.
- `server/accounts.js`: visibility, blocking, exports, sessions and deletion.
- `server/operations.js` and `server/backup.js`: storage readiness and consistent backups.
- `server/start.js`: server for the built app.
- `src/state/`: UI state, local API synchronization, routing and validation.
- `src/data/`: matching, collaboration rules and reusable engagement templates.
- `src/components/` and `src/pages/`: interface and workflows.
- `tests/`: state, backend, local API and browser checks.

`AUDIT.md` and `QA-REPORT.md` retain historical development records; earlier integration descriptions do not describe the current prototype.
