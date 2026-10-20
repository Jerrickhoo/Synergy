# Synergy

Synergy is a working local React/Vite prototype for finding startup collaborators and mentors and completing shared work in deal rooms. It starts empty: create accounts and complete their profiles to populate the directory.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

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
3. Open Matches. Search, filter, save profiles, and inspect the five fit factors. Scores are calculated from the current needs, offers, industry, stage, and goals and update when profiles change.
4. Send an introduction from one account. In the other account, open Home or Rooms, view introductions, and accept. You can also decline or withdraw invitations. A room is created only after both sides agree.
5. In the room, propose and lock terms. The other account reviews and accepts the shared terms. Discuss details in Chat; changes appear in the other account automatically, normally within 1.5 seconds.
6. Schedule a session for mentorship rooms. Upload an evidence file (up to 5 MB), or add a description or link to required milestones, then confirm every milestone from both accounts. Both partners can download uploaded files. Replacing evidence clears prior confirmations. Disputes block launch until both collaborators agree to resolve them and confirm the milestone again.
7. Launch the completed collaboration and submit a private rating and feedback from both accounts. Partner feedback is withheld by the API until both reviews are submitted. The completed collaboration and received rating then appear in each profile's history.
8. Refresh or sign out and sign back in. Each new sign-in requires a fresh email code when delivery is configured. Profiles, saved matches, introductions, terms, schedules, messages, milestones, reports, and reviews remain saved.

You can use the role selector in Profile to maintain separate founder and mentor profiles. The directory excludes your own account. No sample accounts, messages, ratings, or fabricated activity are inserted.

## Storage and boundaries

The server saves the workspace atomically in `.data/synergy.json` and binary files in the neighboring `uploads` directory, excluded from Git. Back up both together. Set `SYNERGY_DATA_FILE` to use another database path. `npm start` also accepts `HOST` and `PORT` (local defaults: `127.0.0.1`, `4173`; production binds to `0.0.0.0`). Run a single server process for each data file.

Passwords are salted and hashed with scrypt. With email configured, signup and every new sign-in require a six-digit emailed code before the server issues a session or returns workspace data. Codes allow five guesses and expire after 15 minutes; resends require a one-minute wait. Pending sign-ins survive a page refresh without storing the password or code. Without provider credentials, local development still supports password-only access; production requires email configuration. Requests require an account session and room membership; partner confirmations cannot be simulated through the API. Session tokens are scoped to a browser tab and remain across refreshes. Closing the tab or restarting the server requires signing in again; saved work remains.

See [DEPLOYMENT.md](DEPLOYMENT.md) for free Brevo email delivery (or the existing Resend option), OpenAI profile drafts, and the Render hosting configuration. Copy `.env.example` to `.env`, then set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, and your verified `MAIL_FROM` to activate real verification emails. Generate your own key in the provider account; no key is bundled. AI is optional and uses its separate key. Keys stay on the server. In production, email verification is required before introductions, uploads or AI use; unverified profiles stay out of the directory. AI suggestions are reviewed before saving, with five attempts per account per day. Matching continues to use transparent word-overlap rules.

Public hosting has been prepared but has not been activated. It requires a connected Render account, a paid persistent service, a verified sending domain and provider credentials. Concern reports remain stored for local review; password recovery, Google login, digests, push notifications, managed database infrastructure and a moderator dashboard remain outside the current prototype.

## Checks

```sh
npx playwright install chromium
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Unit and backend tests cover empty accounts, authentication, saved data after restart, matching, invitation consent, account and role isolation, shared rooms, evidence, disputes, scheduling, blind reviews, verification codes, provider contracts/failures, AI limits, and private binary uploads/downloads. Provider calls use controlled test responses and do not send mail or incur API charges. Browser regression checks cover signup and login codes, challenge refresh/recovery, profile validation, saved sessions, routing, and mobile/tablet/desktop layouts. Browser checks use an isolated database, fake email outbox and port 5181, leaving the normal workspace and live provider credentials untouched.

## Source layout

- `server/workspace.js`: saved accounts, matching, invitations, shared-room updates, authorization, and private reviews.
- `server/api.js`: JSON API and Vite integration.
- `server/start.js`: server for the built app.
- `src/state/`: UI state, API synchronization, routing, serialization, and validation.
- `src/components/` and `src/pages/`: interface and collaboration workflows.
- `tests/`: state, backend, API, and browser checks. Fictional fixtures are used only for tests.

`Synergy.md`, `Synergy.pdf`, and the original image are unchanged. `AUDIT.md` retains the earlier design and implementation history; its memory-only limitations describe previous versions.
