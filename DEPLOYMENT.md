# Enable the integrations

The app includes private file uploads, real email verification through Brevo or Resend, and optional OpenAI profile drafts. The code works locally without credentials; email and AI controls explain when a service is not enabled. Public production mode requires working email configuration and verified accounts before introductions, uploads, or AI use.

## Free email delivery with Brevo

[Brevo's free plan](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) includes 300 email sends per day. The app keeps its own lower limit of 100 verification requests per UTC day. This is real delivery to the registered user's address. No shared/public API key is included; your key must be generated in your own account.

1. [Create a free Brevo account](https://www.brevo.com/) and complete its onboarding and email confirmation.
2. Register and verify the sender you will use for Synergy. Complete any sending-domain authentication or transactional-account activation requested by Brevo. See [sender and domain setup](https://developers.brevo.com/docs/getting-started-with-senders-and-domains). Sender verification is separate from each Synergy user's email verification.
3. In **Settings > SMTP & API > API Keys & MCP**, generate an API key. Use an **API key**, not an SMTP key. See [Brevo's key instructions](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys).
4. Copy `.env.example` to `.env` if you have not already, and set these values with your own key and verified sender:

   ```dotenv
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=your_own_brevo_api_key
   MAIL_FROM=Synergy <your-verified-sender@your-domain.com>
   ```

5. Restart `npm run dev` (or `npm.cmd run dev` in PowerShell). Sign in, open **Profile > Email verification**, and choose **Send verification code**. Check the registered mailbox and spam folder, then enter the six-digit code.

The backend calls [Brevo's transactional endpoint](https://developers.brevo.com/reference/send-transac-email) directly; no extra SDK is needed. It only emails the account's saved address, after checking the password for sign-in or the account session for Profile verification. A successful API response means the provider accepted the message; actual arrival depends on sender configuration and recipient filtering. Check Brevo's transactional logs if a message does not arrive. No test inbox or preview mode is used.

Once email is configured, signup and every new sign-in automatically send a code after the account details/password are validated. Enter that code on the sign-in screen to open the workspace. The server issues no account session and returns no private workspace data until the code is confirmed. Successful confirmation also verifies the account's email, so the separate Profile step is unnecessary for those accounts. Existing sessions remain signed in until sign-out or expiry.

Sign-in requests expire after 15 minutes, allow five incorrect guesses, and permit resending after one minute. Resending replaces the previous code and keeps the original sign-in deadline. The shared workspace email limit includes these sends and failed provider attempts. Refreshing the page preserves the pending sign-in; passwords and codes are not stored in browser storage. If signup delivery fails, stay on the confirmation screen and resend after the cooldown, or sign in with the same account details later. Without email credentials, local development keeps password-only access; production requires email and cannot use that fallback.

Leaving `EMAIL_PROVIDER` empty selects Brevo when `BREVO_API_KEY` is present, otherwise Resend. Set the provider explicitly when both keys are configured. Failed sends never activate a code, and provider errors and keys are not returned to the browser.

## Accounts and keys

1. Configure Brevo using the steps above, or use [Resend](https://resend.com/signup) instead: add a sending domain you own, complete its DNS verification, and create a sending API key. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `MAIL_FROM`. Resend's test sender is restricted and is not a substitute for a verified sender when inviting other users. See [domain setup](https://resend.com/docs/dashboard/domains/introduction).
2. Create an [OpenAI API project](https://platform.openai.com/), add API billing, set a project budget/usage alert, and create a project API key. This is separate from a ChatGPT subscription. The app uses `gpt-4.1-mini`; `OPENAI_MODEL` can override it with a compatible Responses/Structured Outputs model. See [model details and pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
3. Create a [Render account](https://dashboard.render.com/) and connect the GitHub repository. A paid web service and persistent disk are required for this storage design. Review the displayed charges before creating the service. Render's free web service cannot preserve these accounts/uploads across deploys. See [persistent disks](https://render.com/docs/disks).

Keep keys in your local `.env` or Render's secret environment fields. Never put them in frontend variables, source code, screenshots, Git, or chat.

## Local activation

Copy `.env.example` to `.env` and configure `EMAIL_PROVIDER`, its API key (`BREVO_API_KEY` or `RESEND_API_KEY`), and `MAIL_FROM`. `OPENAI_API_KEY` is optional and independent of email. Restart the server. Set `REQUIRE_EMAIL_VERIFICATION=true` to exercise the public verification requirement locally.

Open Profile, send a code to your account's email, and enter it. Codes expire after 15 minutes, allow five guesses, and can be resent after one minute. The workspace permits at most 100 verification sends per UTC day. No code is returned by the API or printed to the server log.

In Profile → Edit profile, expand “Get help drafting your profile.” Generate, review, apply, then save. Only the notes you submit and selected role are sent to OpenAI. No collaborator messages or uploads are included. Drafts use `store: false`, never save automatically, and are limited to five attempts per account and 100 attempts per workspace per UTC day. Failed provider requests count toward these limits.

## Render deployment

1. Commit and push the reviewed source, including `render.yaml`, to the repository Render will use. This task does not push your local changes automatically.
2. In Render, create a Blueprint from that repository and choose `render.yaml`. It provisions one Node web service in Singapore with a 1 GB persistent disk.
3. Fill the prompted secret values. The Blueprint defaults to Brevo; set `BREVO_API_KEY` and a `MAIL_FROM` verified in Brevo. For Resend, change `EMAIL_PROVIDER` to `resend` and configure `RESEND_API_KEY` instead. AI can be disabled by leaving `OPENAI_API_KEY` empty. Review Render's current price before applying the Blueprint.
4. Deploy. The build runs `npm ci --include=dev && npm run build`; the service runs `npm start`. Render terminates HTTPS. The server listens on `0.0.0.0:$PORT`; `/api/health` is its health check.
5. Test signup, verification with a real mailbox, profile drafts, and a shared-room file upload/download on the resulting HTTPS URL. Provider contract tests do not prove real mail delivery, an active API balance, DNS configuration, or a successful public deployment.

Accounts and uploads are stored together under `/var/data`. Keep one instance and one writer for this JSON database. Do not move the data path onto the ephemeral source directory or configure autoscaling. Back up the database and the `uploads` directory together while the service is stopped or from a consistent disk snapshot. A server restart ends sessions; users sign in again to recover their saved work.

Files are limited to 5 MB each and 50 MB uploaded per account, including earlier evidence versions. Allowed formats are PDF, PNG, JPEG, WebP and UTF-8 text. Downloads require a current session and membership in the file's collaboration room. Files are served as downloads, never as executable pages. Existing evidence descriptions/links still work. Uploaded files are not scanned by an antivirus service; use only trusted participants for this prototype.

This deployment is for a single-server prototype. Password recovery and moderation tooling are implemented; antivirus scanning, managed database/object storage, and production load testing remain separate infrastructure work. Public email, AI billing and hosting are not activated until the corresponding accounts and secrets are configured.

## Moderator and notification setup

Set `SYNERGY_ADMIN_EMAILS` to the exact account emails that may moderate, separated by commas. The Render Blueprint prompts for this value. Those accounts must sign up and verify their mailbox before the Moderation navigation item or API privileges become available. No first-user administrator or default privileged account is created. Verify roster/business affiliation through evidence before approving the separate affiliation badge; an email badge establishes mailbox access only.

Moderators can assign/escalate reports, record resolutions, clear disputes for fresh participant confirmation, close unfinished rooms, suspend/restore non-moderator accounts, approve/reject tags and review affiliation requests. Report context includes recent room messages and evidence. Moderators can download files only for rooms that have a report. They cannot inspect blind ratings through the queue. Decisions retain an audit record.

Users can opt in to daily/weekly digests through Updates after email verification. The Node server and Vite plugin run a one-minute scheduler; preview includes the same integration. A single process must remain running. Failed delivery retries after a persisted 15-minute backoff and success advances the daily/weekly send deadline. Updates remain unread until the user marks them read. Digests are plain text and contain no passwords, codes or hidden reviews. Push notifications are not implemented.

Password recovery sends a six-digit, 15-minute code to the account mailbox. It allows five guesses, requires successful provider delivery, stores only a salted hash, and consumes the code on success. Request responses do not reveal whether an account exists. A successful reset revokes sessions and pending sign-in codes; the user must sign in again. Exercise this with a real mailbox during deployment verification.

## Backup and recovery

Run `npm run backup -- /absolute/backup/directory` (PowerShell: `npm.cmd run backup -- C:\Backups\Synergy`). Keep the destination outside the workspace data directory. The command reads one atomic database snapshot, copies the immutable upload IDs referenced by that snapshot, writes SHA-256 checksums, and verifies the result. The server can remain running for snapshot creation because uploads are immutable. Each backup gets a separate timestamp/UUID directory. Missing upload bytes cause backup failure; never restore a partial directory without a valid manifest.

Verify a snapshot with `node server/backup.js --verify /absolute/backup/snapshot`. Copy verified snapshots to a separate storage location and apply a retention policy. This command does not configure off-site storage or a managed backup service.

To restore: stop the server; preserve the current database/uploads as a rollback copy; verify the selected backup; copy its `synergy.json` and `uploads` directory together into a new data directory; set `SYNERGY_DATA_FILE` to that copy; then start a single server and sign in to check profiles, rooms and evidence downloads. Restoring ends existing sessions. Regression tests open a copied backup as a workspace and detect modified evidence bytes.
