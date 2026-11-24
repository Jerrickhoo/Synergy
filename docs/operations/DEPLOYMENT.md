# Prototype deployment

The local demo runs without external API keys. Choose Founder or Mentor in Prototype role and use made-up credentials to enter the sample workspace.

## Local or built preview

Use Node.js 24+ and run `npm install` followed by `npm run dev`. For a built preview run `npm run build` and `npm start`. The local workspace API is part of the same server. `.env` is optional; `.env.example` contains only local application and storage settings.

`SYNERGY_DEMO_MODE=true` is the default. Each entry creates a separate sample account. A refresh keeps the current tab's session; sign-out opens the welcome screen again. Accounts remain in the database. `SYNERGY_DEMO_MODE=false` exposes local signup/password sign-in and does not restore external authentication.

## Render

1. Commit and push the reviewed source, including `render.yaml`, to the repository connected to Render.
2. Create or update a Blueprint using `render.yaml`. It configures one Node service in Singapore with a 1 GB persistent disk. Review the displayed hosting charges before provisioning.
3. Keep `SYNERGY_DEMO_MODE=true`. No provider secrets are needed. `SYNERGY_ADMIN_EMAILS` is optional and lists local password accounts allowed to moderate.
4. The build runs `npm ci --include=dev && npm run build`; startup runs `npm start`. The server binds to `0.0.0.0:$PORT` in production and uses `/api/health` for readiness.
5. Check both roles, refresh, sign-out and the collaboration flows you will present on the resulting HTTPS URL.

Accounts and uploads live together under `/var/data`. Keep one server instance and one writer per database. Use persistent storage; a static deployment of `dist/` cannot run the local API or preserve work. Updating this repository does not automatically update an existing hosted service's environment settings.

## Netlify frontend

`https://synergy-prototype.netlify.app` serves the built frontend. `netlify.toml` proxies `/api/*` to the Render service at `https://synergy-prototype-api.onrender.com`, so the browser stays on one origin and the existing CSP and sessions work unchanged. The Render service must list the Netlify URL in `SYNERGY_ALLOWED_ORIGINS` (set in `render.yaml`) or every sign-in and change is rejected with 403.

1. Deploy the Render service first and confirm its URL matches the proxy target in `netlify.toml`. Render appends a suffix when a service name is taken; update `netlify.toml` if it did.
2. Run `netlify deploy --build --prod --site synergy-prototype`.
3. Open the Netlify URL and sign in as each role.

Keep the Render service on a paid instance: a free instance sleeps when idle, and its cold start exceeds Netlify's proxy timeout. Every visitor reaches Render through Netlify's proxy, so the 30-per-minute sign-in limit is shared across visitors.

## Storage and operations

The default data file is `.data/synergy.sqlite`; explicit JSON paths are also supported. An empty default SQLite database imports a neighboring `synergy.json` without deleting the original. Preserve the database and uploads before changing data paths. Do not copy an active SQLite file alone: committed data may remain in WAL journals. Use the backup command for a consistent live snapshot.

`SYNERGY_BACKUP_DIR` enables scheduled checksummed backups to a separately mounted or synchronized directory outside the data directory. `SYNERGY_BACKUP_INTERVAL_HOURS` defaults to 24. Failures retry after 15 minutes. Configure the storage destination and retention yourself and perform a restore drill.

`/api/health` checks database integrity, a write probe and at least 20 MB of free disk; it returns 503 if unavailable. Readiness is cached for 30 seconds. Structured logs omit passwords, tokens and submitted text.

Files are limited to 5 MB each and 50 MB uploaded per account. Allowed formats are PDF, PNG, JPEG, WebP and UTF-8 text. Downloads require a session and room membership. Files are served as downloads. Uploads are not antivirus-scanned.

Moderation is granted only to local accounts explicitly listed in `SYNERGY_ADMIN_EMAILS`. Role-preview accounts receive no administrator privileges. Affiliation review, reports, vocabulary and matching settings remain available. Keep the moderator list empty in a public demo and use a separate controlled workspace for moderation walkthroughs.

`SYNERGY_REQUIRE_VERIFICATION` defaults to `false` locally and is `true` in `render.yaml`. With gating enabled, local password accounts need moderator-verified affiliation before sending or accepting introductions. Configure at least one reachable moderator before inviting real accounts. Accelerator, university, community or referral evidence is accepted through the existing request form; no business domain or email verification is claimed. Demo previews are exempt.

Moderation deadlines are three weekdays after submission, preserving the UTC submission time and skipping Saturday/Sunday; public holidays are not modeled. Both participants see the due date on escalated disputes. Queue entries flag overdue open work. Existing pending affiliation records without a submission timestamp get a persisted submission time on the first upgraded server start. New accounts default to weekly digests; existing explicit preferences are preserved and older accounts without preferences retain their prior Off default.

Password recovery remains unavailable, by owner decision on 7 November 2026. A founder who loses a local password cannot reset it in the app. Do not direct them to an email reset or promise a moderator reset: neither exists. Authenticated users can change their password in Settings. A future recovery flow needs a defined identity check, authorized moderator handling or actual email delivery, a single-use expiring token, session revocation and an audit trail. This gap is documented instead of introducing an unreviewed recovery bypass. Keep exports and tested backups, but a backup is not a password-reset procedure.

The local demo uses the email stub and sends no email. The workspace still keeps in-app Updates and records pending notices in the outbox. A separate staging workspace can use Brevo as described under Mentorship email.

## Acceptance checks

Run formatting, unit/backend, browser and build checks. Demonstrate a founder pair or mentor connection through introduction, shared terms, evidence and mutual milestone confirmation. Check stale-edit conflicts, private reviews, temporary connection recovery, visibility, blocking, export and deletion with disposable accounts. Restore a verified backup into a separate directory and inspect a room and uploaded file.

## Backup and recovery

Run `npm run backup -- /absolute/backup/directory` (PowerShell: `npm.cmd run backup -- C:\Backups\Synergy`). Keep the destination outside the workspace data directory. The command reads one atomic database snapshot, copies the immutable upload IDs referenced by that snapshot, writes SHA-256 checksums, and verifies the result. The server can remain running for snapshot creation because uploads are immutable. Each backup gets a separate timestamp/UUID directory. Missing upload bytes cause backup failure; never restore a partial directory without a valid manifest.

Verify a snapshot with `node server/backup.js --verify /absolute/backup/snapshot`. Copy verified snapshots to a separate storage location and apply a retention policy. This command does not configure off-site storage or a managed backup service.

To restore: stop the server; preserve the current database/uploads as a rollback copy; verify the selected backup; copy its `synergy.json` and `uploads` directory together into a new data directory; set `SYNERGY_DATA_FILE` to that copy; then start a single server and sign in to check profiles, rooms and evidence downloads. Restoring ends existing sessions. Regression tests open a copied backup as a workspace and detect modified evidence bytes.

## Mentorship email

Mentorship email defaults to the local stub. To validate transactional email on staging, use a staging workspace with demo mode disabled and a verified sender and sending domain. Configure the domain's SPF, DKIM and DMARC records in Brevo. Set `SYNERGY_DEMO_MODE=false`, `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`, `SYNERGY_PUBLIC_URL` and a random `BREVO_WEBHOOK_SECRET` of at least 32 characters in the staging secret store. Startup fails if Brevo is selected while demo mode is on, or if `SYNERGY_DEMO_MODE` is anything other than `true` or `false`. Use the public HTTPS frontend origin for links and ensure its `/api` requests reach the same workspace. [Brevo transactional email guide](https://developers.brevo.com/docs/send-a-transactional-email)

Register a transactional webhook at `/api/email/brevo-webhook` for `hardBounce`, `invalid`, `blocked`, `spam` and `unsubscribed`. Configure bearer authorization with the same webhook secret; Brevo's built-in token option and an explicit `Authorization: Bearer` header both work. The workspace checks it before applying suppression. It retries temporary send failures, including a rejected API key (HTTP 401/403), for up to five attempts over about an hour, logs each failure as `email_delivery_failed`, and stops sending to suppressed addresses. [Brevo secure webhook setup](https://developers.brevo.com/docs/secured-webhooks)

### Sign-in email

With Brevo enabled, the same configuration also sends three sign-in emails. They ignore mentorship email preferences and carry no unsubscribe link, but stop for bounced addresses; sign-in alerts also stop after a spam complaint or full unsubscribe.

- **Email verification.** Signup emails a link that works for 24 hours. Until it is opened, the account sees only a "Check your inbox" screen that offers a new link (at most one a minute, with a countdown) and a way to sign out. The server refuses every action, profile save and upload with reason `email-unverified`; reading the account state stays open, so the screen opens the workspace as soon as the link is opened, even on another device. Accounts that existed before Brevo was enabled are unverified and must verify on their next visit. Preview accounts are exempt, and with the stub nobody is asked to verify.
- **Password reset.** "Forgot password?" on the sign-in page emails a link that works once, for 1 hour. The response is the same whether or not the address has an account. Saving a new password signs out every session, signs in on the current one and marks the email as verified.
- **Sign-in alert.** Each successful password sign-in emails the time (UTC) and a coarse browser and platform, such as "Chrome on Windows", with a link to reset the password. Signup and password reset don't send one.

Links are signed with `BREVO_WEBHOOK_SECRET` and name a nonce stored on the account. Asking again while a link is live sends the same link with a fresh expiry, so every email in the inbox works; using a reset link, verifying, or letting the link expire ends it. Rotating the secret invalidates every outstanding link. Sign-in emails are sent right after the request and go ahead of mentorship emails in each delivery batch; failures retry like any other email. The `/api/auth/*` endpoints share the sign-in rate limit and return 404 without Brevo.

Use dedicated staging accounts to send and accept a mentorship request. Switch one mentor to instant email and verify the other receives a digest at the configured time in their time zone. Confirm the links open the right request or room and that the email contains only notice details. Verify a per-kind unsubscribe and a bounce suppression using the staging provider. Sign up a new account, open the verification link on another device, reset its password from the sign-in page and confirm the earlier session ends, then sign in again and check the alert. The regular server process runs the maintenance and delivery job every minute.

## v1.1 payment simulation

Set PAYMENTS_PROVIDER=simulated. Set a private PAYMENTS_WEBHOOK_SECRET to enable POST /api/payments/webhook. Callbacks carry x-payment-signature, the lowercase hexadecimal HMAC-SHA256 of the exact request body. Bodies contain a distinct id, a saved providerRef and a result of success, failure or expiry. Repeated event IDs are ignored.

Payment records and provider simulation state live in the workspace database and use the normal database backup. The simulation transfers no real funds. Configuration rejects live provider values. Complete the [P2 requirements](../product/V1.1-IMPLEMENTATION.md) before connecting a live marketplace provider.
