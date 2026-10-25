# Synergy

Synergy is a working local React/Vite prototype for finding startup collaborators and mentors and completing shared work in deal rooms. It starts empty: create accounts and complete their profiles to populate the directory.

## Run locally

Requires Node.js 24+ and npm (SQLite uses the built-in Node database module).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is restricted. The Vite server also runs the workspace API; no separate backend command or cloud account is required.

For a built version:

```sh
npm run build
npm start
```

This serves the app and API at http://localhost:4173. `npm run preview` also includes the API. The app requires its Node server; uploading only `dist/` to a static host will not provide accounts or saved work.

## Try the complete journey

1. Create a founder account, enter the emailed verification code when email delivery is configured, and fill in its Profile. Completed profiles become discoverable; incomplete profiles stay private.
2. Open another browser tab and create a second founder or mentor account. Tabs have separate sessions, so both accounts can remain open at once. Complete the second profile.
3. Open Matches. Search, filter, save profiles, and inspect the fit factors. Scores use needs/offers, approved tags, industry, stage and team size (audience size for co-marketing). Goals and engagement preferences are optional; missing inputs are explained rather than inferred. Public profiles show verified-email/affiliation badges, completed work and ratings from distinct collaborators.
4. Send an introduction from one account. In the other account, open Home or Rooms, view introductions, and accept. You can also decline or withdraw invitations. A room is created only after both sides agree.
5. In the room, propose and lock terms. The other account reviews and accepts, or either partner requests changes to reopen the draft. Reopening clears approvals and milestone confirmations; evidence remains. Either partner can close an unfinished room with a reason. Discuss details in Chat; changes appear in the other account automatically, normally within 1.5 seconds.
6. Schedule or reschedule one to twelve weekly mentorship sessions. Set milestone due dates (UTC). Propose a milestone title or scope revision for the other collaborator to accept or reject; the agreed scope changes only on acceptance. Pending revisions block confirmation and launch. Accepting a revision preserves evidence, records its history and clears that milestone’s confirmations. Upload evidence files (up to 5 MB) or add descriptions/links, then confirm milestones from both accounts. Replacing evidence, changing due dates or rescheduling clears prior confirmations. Disputes block launch until mutually resolved, or a moderator reviews a report and clears the dispute for fresh confirmation.
7. Launch the completed collaboration and submit a private rating and feedback from both accounts, with optional match usefulness and shared-goal outcomes. Partner feedback is withheld by the API until both reviews are submitted. The completed collaboration and received rating then appear in each profile's history.
8. Start a new introduction with a previous collaborator after a room is launched, reviewed or closed; earlier rooms remain available. Open Notifications → View all updates and preferences for read/unread activity, match suggestions, deadlines, upcoming-session reminders and optional daily/weekly email digests.
9. Refresh or sign out and sign back in. Each new sign-in requires a fresh email code when delivery is configured. Saved work remains. The sign-in screen also provides email-code password recovery, which revokes previous sessions after a successful reset.

You can use the role selector in Profile to maintain separate founder and mentor profiles. Mentors can add an optional dedicated Past experience field, shown on their public profile. The directory excludes your own account. No sample accounts, messages, ratings, or fabricated activity are inserted.

## Storage and boundaries

New workspaces use transactional SQLite with WAL at `.data/synergy.sqlite`. Changed account records are committed in one transaction. The previous default `.data/synergy.json` is imported once when the new default is first opened; the original file is preserved. An explicit `.json` `SYNERGY_DATA_FILE` remains supported through the atomic JSON compatibility adapter. The server saves binary files in the neighboring `uploads` directory, excluded from Git. Back up both together. Set `SYNERGY_DATA_FILE` to use another database path. `npm start` also accepts `HOST` and `PORT` (local defaults: `127.0.0.1`, `4173`; production binds to `0.0.0.0`). Run a single server process for each data file.

Passwords are salted and hashed with scrypt. With email configured, signup and every new sign-in require a six-digit emailed code before the server issues a session or returns workspace data. Codes allow five guesses and expire after 15 minutes; resends require a one-minute wait. Pending sign-ins survive a page refresh without storing the password or code. Without provider credentials, local development still supports password-only access; production requires email configuration. Requests require an account session and room membership; partner confirmations cannot be simulated through the API. Session tokens are scoped to a browser tab and remain across refreshes. Closing the tab or restarting the server requires signing in again; saved work remains.

See [DEPLOYMENT.md](DEPLOYMENT.md) for free Brevo email delivery (or the existing Resend option), OpenAI profile drafts, and the Render hosting configuration. Copy `.env.example` to `.env`, then set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and your verified `MAIL_FROM` to activate real verification emails. Generate your own key in the provider account; no key is bundled. AI is optional and uses its separate key. Keys stay on the server. In production, email verification is required before introductions, uploads or AI use; unverified profiles stay out of the directory. AI suggestions are reviewed before saving, with five attempts per account per day. Matching uses Unicode-aware word coverage. Exchanges score both directions of need/offer coverage; mentorship compares founder needs with mentor offers/expertise. Missing inputs earn no positive signal. Algorithm versions are recorded separately from weight versions.

Set `SYNERGY_ADMIN_EMAILS` to the comma-separated moderator account emails. Moderator access requires a verified email. The Moderation page supports report assignment/escalation/resolution, dispute remedies, closing unfinished rooms, account suspension, affiliation verification and approval of proposed vocabulary tags. Decisions are audited. Profile → Affiliation verification and community tags lets users submit evidence and propose tags. AI drafts ask follow-up questions about ambiguous intent, roles, audiences and unfamiliar terms, including fundraising. Users answer before applying suggestions and can submit automatically suggested unfamiliar tags for moderation. Drafts and tag suggestions never change a profile or the approved vocabulary automatically. Live model behavior still requires provider smoke checks.

Moderation → Reusable engagement templates edits the name, titles, scopes and evidence requirements for the three room types. Defaults are data in `src/data/engagement-templates.json`; edits are versioned in the workspace database. New rooms copy the current template; existing rooms retain their agreement. Concurrent stale template edits are rejected.

Moderation → Matching evaluation reports distinct rooms by scoring version, room type and average initial score band, with active/completed/closed counts and mutually released usefulness/goal feedback. Each new room captures both directional scores, factors and weights at connection time; older rooms remain explicitly unscored. Moderators can change weights in percentages, with a new version for each edit. These weights remain provisional: observational results from accepted collaborations, especially small samples or repeat partners, do not validate predictive quality or establish causation. No real collaboration-outcome study has been conducted here.

Digests are off by default. Verified accounts can opt in after mail delivery is configured. The running Node/Vite server checks every minute, sends due daily/weekly digests, and backs off for 15 minutes after failures. Delivery status appears in Updates. Reminders are computed from current workspace data; browser push is not implemented.

Public hosting has been prepared but has not been activated here. It requires a connected Render account, persistent storage, a verified sender and provider credentials. Real mail, AI completions and public deployment still require live smoke checks. Google login, antivirus scanning, managed multi-server database/object storage remain outside this single-server prototype. `npm run benchmark` runs a synthetic local concurrency smoke test, not a production capacity certification. `npm run backup` creates a checksummed database/upload snapshot; see [DEPLOYMENT.md](DEPLOYMENT.md) for verification and restore instructions.

## Checks

```sh
npx playwright install chromium firefox webkit
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Unit/backend checks also cover terms revision, repeat engagements, public trust privacy, moderator authorization/remedies, vocabulary approval, affiliation badges, deadline/read-state persistence, recurring rescheduling, password-reset security, digest delivery and backup restoration/corruption detection. Browser checks cover the original auth/profile/navigation flows plus revised terms, closure/reconnection, mobile scheduling/notifications, moderation and password recovery. Provider calls use controlled responses and never send real mail or incur API charges. Browser checks use isolated SQLite databases and fake outboxes on ports 5181-5183, one for each browser engine.

## Source layout

- `server/workspace.js`: saved accounts, matching, invitations, shared-room updates, authorization, and private reviews.
- `server/api.js`: JSON API and Vite integration.
- `server/features.js`: lifecycle extensions, moderation, notification/digest state and recovery.
- `server/storage.js`: transactional per-account SQLite persistence and atomic JSON compatibility.
- `server/accounts.js`: visibility, blocking, exports, email changes, sessions and account deletion.
- `server/operations.js`: storage readiness, safe error logs and optional scheduled backups.
- `server/backup.js`: consistent database/upload snapshots and checksum verification.
- `server/start.js`: server for the built app.
- `src/state/`: UI state, API synchronization, routing, serialization, and validation.
- `src/data/engagement-templates.json`: default reusable room checklists; moderator edits are persisted as new workspace versions.
- `src/data/matching.js`: initial scoring weights and aggregate outcome reports; rooms retain their original score and weight snapshots.
- `src/components/` and `src/pages/`: interface and collaboration workflows.
- `tests/`: state, backend, API, and browser checks. Fictional fixtures are used only for tests.

`Synergy.md`, `Synergy.pdf`, and the original image are unchanged. `AUDIT.md` retains the earlier design and implementation history; its memory-only limitations describe previous versions.

## Reliability and account controls (October 25, 2026)

Shared terms saves/locks/acceptance require the displayed revision. Every saved draft advances it. Milestone confirmations and dispute resolutions require the observed content version, including evidence, scope, schedule, due date and agreement changes. Stale commands return 409. The UI preserves local terms/profile drafts within an account's browser tab and shows remote conflicts without replacing unsaved text. Temporary restore failures preserve the session and provide Retry. Requests have deadlines; background polling pauses in hidden tabs, avoids overlapping requests and skips unchanged workspaces.

Suggested shows up to twelve eligible profiles with at least 30% fit; Browse all includes the full role directory. Search, data-derived industry choices, score thresholds, sorting and twelve-result pages support browsing. Introduction details let founders propose beta testing or co-marketing; the other party sees the selected type before accepting. Mentor introductions use mentorship. Home prioritizes disputes, terms, confirmations, deadlines and reviews.

Profile links to Account settings and privacy. Users can pause both profiles, export their workspace, revoke other sessions and change their email with their current password plus a delivered code to the new mailbox. Blocking withdraws introductions, closes unfinished shared rooms and prevents further chat. Account deletion requires the current password and typing DELETE. It removes profile details, credentials, email, pending codes and private preferences, revokes sessions and anonymizes the participant name in shared chat/history. Shared agreements, messages, evidence and reviews remain accessible to collaborators; uploaded evidence is retained with those shared records. Existing backup snapshots follow the operator's retention policy and are not rewritten. Users should avoid putting private information in shared messages/evidence they do not want collaborators to retain.

SQLite improves transactional durability and avoids rewriting the whole database file on every save. Directory/scoring and account snapshots still run in one process; this is not an autoscaling architecture. Run one application writer per database. Before migrating an existing deployment, back up the database and uploads together. Public providers, real devices and actual screen readers still require separate live checks; this repository does not claim real outcome validation for matching.
