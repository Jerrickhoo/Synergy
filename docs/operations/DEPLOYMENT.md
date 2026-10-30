# Prototype deployment

The app runs without external API keys. The sign-in screen accepts any non-empty credentials and provides a founder/mentor dropdown at the bottom right; no signup or email verification is required. Email and AI integrations have been removed from the code and hosting configuration.

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

## Storage and operations

The default data file is `.data/synergy.sqlite`; explicit JSON paths are also supported. An empty default SQLite database imports a neighboring `synergy.json` without deleting the original. Preserve the database and uploads before changing data paths. Do not copy an active SQLite file alone: committed data may remain in WAL journals. Use the backup command for a consistent live snapshot.

`SYNERGY_BACKUP_DIR` enables scheduled checksummed backups to a separately mounted or synchronized directory outside the data directory. `SYNERGY_BACKUP_INTERVAL_HOURS` defaults to 24. Failures retry after 15 minutes. Configure the storage destination and retention yourself and perform a restore drill.

`/api/health` checks database integrity, a write probe and at least 20 MB of free disk; it returns 503 if unavailable. Readiness is cached for 30 seconds. Structured logs omit passwords, tokens and submitted text.

Files are limited to 5 MB each and 50 MB uploaded per account. Allowed formats are PDF, PNG, JPEG, WebP and UTF-8 text. Downloads require a session and room membership. Files are served as downloads. Uploads are not antivirus-scanned.

Moderation is granted only to local accounts explicitly listed in `SYNERGY_ADMIN_EMAILS`. Role-preview accounts receive no administrator privileges. Affiliation review, reports, vocabulary and matching settings remain available. Notifications are in-app only.

## Acceptance checks

Run formatting, unit/backend, browser and build checks. Demonstrate a founder pair or mentor connection through introduction, shared terms, evidence and mutual milestone confirmation. Check stale-edit conflicts, private reviews, temporary connection recovery, visibility, blocking, export and deletion with disposable accounts. Restore a verified backup into a separate directory and inspect a room and uploaded file.

## Backup and recovery

Run `npm run backup -- /absolute/backup/directory` (PowerShell: `npm.cmd run backup -- C:\Backups\Synergy`). Keep the destination outside the workspace data directory. The command reads one atomic database snapshot, copies the immutable upload IDs referenced by that snapshot, writes SHA-256 checksums, and verifies the result. The server can remain running for snapshot creation because uploads are immutable. Each backup gets a separate timestamp/UUID directory. Missing upload bytes cause backup failure; never restore a partial directory without a valid manifest.

Verify a snapshot with `node server/backup.js --verify /absolute/backup/snapshot`. Copy verified snapshots to a separate storage location and apply a retention policy. This command does not configure off-site storage or a managed backup service.

To restore: stop the server; preserve the current database/uploads as a rollback copy; verify the selected backup; copy its `synergy.json` and `uploads` directory together into a new data directory; set `SYNERGY_DATA_FILE` to that copy; then start a single server and sign in to check profiles, rooms and evidence downloads. Restoring ends existing sessions. Regression tests open a copied backup as a workspace and detect modified evidence bytes.
