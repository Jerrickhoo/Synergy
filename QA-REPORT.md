# Current verification - October 25, 2026

The confirmed review defects and the locally implementable improvements are addressed. This is a local prototype, as confirmed by the user. No public deployment, real mailbox delivery, paid AI call or off-site service was activated.

## Verified results

| Check                                      | Result                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Unit, backend, storage and HTTP API checks | 74 passed                                                                                                |
| Chromium, Firefox and WebKit browser suite | 90 passed (30 per engine)                                                                                |
| Production build                           | Passed                                                                                                   |
| Formatting and diff whitespace             | Passed                                                                                                   |
| Automated accessibility scans              | No WCAG 2 A/AA and 2.1 AA violations in the scanned login, discovery, settings and profile-editor states |
| Synthetic local concurrency smoke test     | 20 users, 200 unchanged-state requests; median 10 ms, p95 16 ms, max 17 ms in that run                   |

The concurrency result describes a disposable loopback workspace on this machine while other checks were running. It is not a production throughput or capacity claim. Accessibility scans do not substitute for a screen-reader or real-device assessment.

## Review findings addressed

| Review area                    | Implemented behavior                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stale milestone confirmations  | Mandatory content versions bind confirmations and dispute resolutions to reviewed evidence, scope, dates, schedules and agreement changes. Stale/missing versions return 409.                                                                               |
| Lost shared edits              | Terms save/lock/acceptance require the observed revision; every save advances it. Unsaved drafts survive navigation/refresh and remain visible during conflicts.                                                                                            |
| Connection recovery            | Temporary restore failures preserve sessions and offer Retry. Request deadlines include stalled response bodies; polling has backoff, visibility handling and overlap prevention.                                                                           |
| Match quality                  | Reciprocal need coverage for exchanges, founder-to-mentor direction for mentorship, Unicode tokens, missing-input explanations and separate algorithm/weight versions.                                                                                      |
| Setup and activation           | Required profile fields have examples; optional preferences/tags collapse. Drafts are tab/account scoped. Signup reflects email configuration. A copyable invitation link includes localhost limitations.                                                   |
| Discovery                      | Suggested recommendations differ from Browse all. Industry choices derive from current data. Sort controls, broader score thresholds and twelve-result pages support browsing. Introductions propose an explicit engagement type for the partner to review. |
| Mobile usability               | Compact discovery headers, reduced spacing and early match actions. Firefox verification-screen sizing was corrected.                                                                                                                                       |
| Home priorities                | Disputes, pending terms, scope proposals, confirmations, deadlines and reviews take precedence over the completed-profile hero.                                                                                                                             |
| Persistence and performance    | Transactional SQLite per-account records, WAL, safe legacy import and portable backups. An explicit JSON path remains compatible. HTTP password hashing is asynchronous; unchanged polls avoid directory/scoring reconstruction.                            |
| Account/privacy                | Pause both profiles, export data, revoke selected/all other sessions, verified email changes, account blocking and password-confirmed deletion with stated shared-record retention.                                                                         |
| Operations                     | Database/disk/write readiness checks, structured safe failure logs, optional scheduled verified backups and a repeatable synthetic benchmark.                                                                                                               |
| Accessibility/browser coverage | Three browser engines, keyboard checks, automated accessibility scans and accessible unread counts. Error messages remain until dismissed. Route focus occurs before paint so it cannot steal typing from a newly opened form.                              |

Additional checks cover failed migration retry, competing stale SQLite writers, corruption/missing evidence in backups, account isolation, contact restrictions after blocking/deletion and code/session revocation.

## Compatibility and remaining real-world checks

- Node.js 24+ is now required. New defaults use `.data/synergy.sqlite`. An existing explicit `.json` `SYNERGY_DATA_FILE` remains on JSON until changed; migration does not override an explicit path.
- Back up an existing workspace and uploads before changing its data path. Automatic default-path migration preserves the neighboring original JSON file. Backups export portable JSON snapshots from either adapter.
- The app still runs as a single writer/process. SQLite transactions and conditional polling improve this prototype; they do not provide managed object storage or multi-instance autoscaling.
- A scheduled backup destination is optional and remains unconfigured unless `SYNERGY_BACKUP_DIR` is set. No off-site account or storage mount was provisioned. See [DEPLOYMENT.md](DEPLOYMENT.md) for destination, retention and restore instructions.
- Deletion removes credentials, email, profile details and preferences and anonymizes displayed identity. Shared agreements, messages, evidence and reviews remain for collaborators, as explained before deletion. Existing backups follow the operator's retention policy.
- Real email/AI provider behavior, public hosting, actual phones, physical screen readers, antivirus scanning and a real collaboration-outcome study remain unverified or outside this local prototype's scope. No claim of validated matching accuracy is made.
- Verification used disposable accounts/databases. Application workspace data, private `.env` credentials and the original project specification were not edited. Changes remain in the working tree; no commit, push or deployment was performed.

Visual checks included [mobile discovery](output/playwright/improved-matches-mobile.png) and [account settings](output/playwright/improved-settings-desktop.png). These are local ignored artifacts.

---

# Historical verification — October 20, 2026

The stakeholder review findings have been addressed in the application. The earlier report is retained below as a historical record and does not describe the current feature boundaries.

## Current checks

| Check                              | Result    |
| ---------------------------------- | --------- |
| State, backend and HTTP API checks | 62 passed |
| Chromium browser checks            | 25 passed |
| Production build                   | Passed    |
| Formatting                         | Passed    |
| Diff whitespace                    | Passed    |

The current changes cover:

- Reopening shared terms with both approvals and milestone confirmations reset; closing unfinished rooms with a recorded reason; starting repeat engagements while retaining prior rooms.
- Public completion history, distinct-partner ratings, follow-through/quiet-room summaries, verified-email and separately reviewed affiliation badges. Blind ratings remain absent until both reviews arrive. Repeat-partner reviews count once in the aggregate.
- Team-size and co-marketing audience-size comparison, optional goals/engagement preferences, approved profile tags, and factor explanations that identify missing inputs and zero overlap.
- Moderator-only report assignment/escalation/resolution, dispute remedies, room closure, suspension/restoration, affiliation review, vocabulary approval and audited decisions. Privileges require a server-configured email and mailbox verification.
- Full activity view with persisted read state, match suggestions, confirmation/review prompts, deadline/session/quiet-room reminders, and opt-in daily/weekly email digests. Failed provider sends leave updates unread and apply a persisted retry backoff.
- One to twelve weekly mentorship sessions, rescheduling, shared UTC milestone deadlines, and reset participant confirmations after schedule changes.
- Approved tag suggestions in AI drafts, clarification of ambiguous fundraising intent, and proposed tags routed to moderator approval.
- Email-code password recovery with delivery checks, expiration, bounded guesses, hashed codes, single use and session revocation.
- Consistent database/upload backups, checksums, corruption detection and recovery from a copied snapshot.
- A development-mode synchronization crash exposed by populated-room browser checks, caused by mutating incoming room objects reused during React reducer checks.
- Milestone title/scope proposals, partner-only acceptance/rejection, proposer withdrawal, stale decision protection, revision history and evidence preservation. Pending proposals block confirmation and launch; accepting a revision or changing a due date clears the affected milestone confirmations.
- Moderator-editable reusable room templates stored as versioned workspace data, with existing rooms retaining their copied checklist. Concurrent stale edits and unauthorized changes are rejected.
- General AI clarification questions and follow-up answers, reviewed unfamiliar-tag proposals, mentor past experience, and clearing stale profile tags when applying a draft. AI responses use the [official Structured Outputs format](https://developers.openai.com/api/docs/guides/structured-outputs); provider tests use controlled responses.
- Versioned matching weights, fixed directional score snapshots on connection, optional blind match usefulness/shared-goal feedback, and moderator-only aggregate room cohorts. Rooms count once; active, completed and closed outcomes remain separate; older rooms are explicitly unscored.

Browser regressions exercise revised agreements, closure/reconnection, mobile series rescheduling/read state, moderator queues, password recovery and public trust privacy in addition to the original auth/profile/routing/layout checks. Provider requests use controlled responses; no real mail or AI charges are generated. Tests use isolated databases rather than the normal workspace.

Screenshots inspected after the changes:

- [Public trust and score explanations](artifacts/stakeholder-review/fixed-public-trust-desktop.png)
- [Mobile recurring-session rescheduling](artifacts/stakeholder-review/fixed-scheduling-mobile.png)
- [Mobile moderation queue](artifacts/stakeholder-review/fixed-moderation-mobile.png)
- [Approved milestone revision on mobile](artifacts/stakeholder-review/milestone-revision-mobile.png)
- [Reusable templates and matching settings](artifacts/stakeholder-review/templates-matching-settings-desktop.png)
- [AI clarification and reviewed tag proposals](artifacts/stakeholder-review/ai-clarification-tags-desktop.png)
- [Dedicated public mentor experience](artifacts/stakeholder-review/mentor-experience-desktop.png)

## Remaining activation and infrastructure boundaries

Matching weights remain provisional. The new report makes real-outcome evaluation possible but does not validate usefulness or predictive quality by itself. Accepted-room cohorts are observational, include repeat partners and can have small samples. Real collaboration outcomes and a planned evaluation are still needed before tuning can be claimed as validated.

Actual email delivery, AI completions and a public HTTPS deployment still require provider credentials, a verified sender and hosting access. These cannot be established by fake-provider tests. The moderator email is configured locally in the ignored `.env`; the intended account must sign up/sign in and verify its mailbox. No account or verification is fabricated.

The storage remains a single-writer local JSON database with immutable private uploads. Backup/recovery tooling is implemented, while managed database/object storage, off-site backup scheduling, antivirus scanning, browser push and production load testing remain infrastructure/product scope. This verification establishes local prototype readiness, not production certification.

## Earlier verification record (historical)

The core local prototype workflows passed after correcting four issues found during this review. Verification used Windows, Chromium, separate browser tabs, and isolated test databases. The normal workspace database was not used for test accounts.

## Automated results

| Check                               | Result    |
| ----------------------------------- | --------- |
| State, backend, and HTTP API checks | 28 passed |
| Browser regression checks           | 10 passed |
| Production build                    | Passed    |
| Prettier formatting                 | Passed    |
| Diff whitespace check               | Passed    |

The browser suite checks widths of 360, 768, 1024, and 1440 pixels. Additional hands-on browser checks used the built app with its Node server.

## Workflows verified

| Workflow           | Verification and result                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accounts           | Founder and mentor signup, invalid-login feedback, sign-out, independent accounts and roles, and recovery after refresh passed.                                                                  |
| Profiles           | Required-field validation, saving, canceling, separate role profiles, and role selection surviving refresh passed.                                                                               |
| Discovery          | Current profiles appear in Matches; search, type filters, empty results, reset, saved matches, and bookmarks surviving refresh passed. Matching scores change with profile details.              |
| Introductions      | Sending, withdrawing, declining, and accepting invitations passed. Shared rooms require mutual consent.                                                                                          |
| Room templates     | A beta-testing collaboration passed the backend lifecycle checks; a mentorship completed through the browser; a co-marketing collaboration completed through the HTTP API.                       |
| Shared terms       | Whitespace validation, saving a draft, locking it, viewing the same terms in the other account, and partner acceptance passed.                                                                   |
| Scheduling         | Unscheduled confirmation was rejected; past dates were rejected; a future session and its Asia/Manila timezone appeared in both accounts and survived restart.                                   |
| Evidence           | Blank descriptions were rejected. Evidence was shared; replacing it cleared both confirmations and blocked launch until both users confirmed again.                                              |
| Disputes           | A dispute blocked confirmation and launch. One user's resolution was insufficient; both users resolved it and confirmed the milestone again.                                                     |
| Chat and recovery  | Shared messages and Unicode text passed. Going offline showed a connection message, preserved an unsent draft, and allowed successful retry after reconnection.                                  |
| Reports            | A submitted concern produced confirmation and was verified in the saved database after restart. Reports remain a local-review feature.                                                           |
| Launch and reviews | Launch required completed mutual milestones. Partner feedback was absent from both the UI and API until both reviews were submitted, then appeared in collaboration history and average ratings. |
| Persistence        | Profiles, completed rooms, messages, replaced evidence, schedules, reports, and reviews survived a real server restart. Signing in again recovered the workspace.                                |
| Access checks      | Invalid sessions, another account's room, another role's room, and simulated partner actions were rejected.                                                                                      |
| Save failures      | A forced disk-write failure preserved the previous saved workspace and rolled back unsaved changes.                                                                                              |
| Layout             | Populated mobile chat and tablet profile screens fit without horizontal page overflow. Automated navigation checks passed at all four widths.                                                    |

## Issues fixed during testing

1. A scheduling request to a beta-testing or marketing room could raise an internal error. It now returns a clear HTTP 400 validation response.
2. Rejected room actions, including empty chat submissions, could create misleading collaborator notifications. Notifications now require an actual room change.
3. A co-marketing invitation could create a beta-testing room when accepted from the other participant's perspective. Template selection now considers complementary offers and needs consistently from both sides.
4. Home could say there were no collaborations after a completed collaboration. It now distinguishes active work from completed work.

Backend regression checks cover the first three fixes. The corrected Home message was verified in the built app after recovering the completed mentorship.

## Visual evidence

- [Mobile chat after connection recovery](output/playwright/qa-chat-mobile.png)
- [Reviews revealed after both submissions](output/playwright/qa-reviews-desktop.png)
- [Tablet profile with completed collaboration history](output/playwright/qa-profile-tablet.png)

## Integration verification

The six additional integration tests passed on the installed Node runtime and on Node 22 (the configured hosting runtime). They use controlled provider responses, without sending real emails or spending API credits.

| Integration       | Result                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verification      | Codes are hashed in storage, absent from API responses, single-use, limited to five guesses, expire after 15 minutes, and persist through restart. Requests have a resend cooldown. Unverified profiles stay out of the public directory when verification is required.                                                                          |
| Email provider    | Resend request destination, recipient and payload passed contract checks. Missing configuration and provider failures return clear errors. No provider secrets appear in error messages.                                                                                                                                                         |
| AI provider       | OpenAI Responses/Structured Outputs requests passed contract checks. Draft generation leaves the saved profile unchanged. Refusals, incomplete responses and malformed fields are rejected. Per-account request limits are enforced.                                                                                                             |
| Files             | Real HTTP uploads/downloads passed. Unauthenticated users, unrelated accounts, wrong roles, unsupported formats, false file signatures, empty files, oversized files and unsafe names were rejected. Both room members can download evidence. Metadata and bytes survive restart; replacing a file with text removes the current file reference. |
| Browser controls  | In the built app, sent/entered a verification code, generated/reviewed/applied a profile draft, and saved it. Selected an actual text file in the browser file chooser, uploaded it, and downloaded the same contents. The mobile upload form fits 360 px with no horizontal page overflow. No browser console errors were recorded.             |
| Production server | Started in production mode with isolated data and dummy mail credentials. The app and `/api/health` returned HTTP 200, and the app included its Content Security Policy and cache headers. Production startup without email configuration is rejected. This check does not activate or validate real provider credentials.                       |

The Render Blueprint passed validation against Render's official JSON schema, and the [deployment guide](DEPLOYMENT.md) is prepared. Live mail delivery, real AI completions and public hosting still require provider accounts, a verified sending domain, API keys and a Render connection. They have not been claimed as live-tested or deployed.

- [Reviewed AI draft and populated form](output/playwright/integration-profile-draft.png)
- [Mobile file evidence controls](output/playwright/integration-file-mobile.png)

## Scope

These results cover the local prototype in Chromium and emulated mobile/tablet viewports, with controlled responses for external provider tests. They do not establish compatibility with every browser or physical device, production load capacity, live email delivery or successful public deployment. Password recovery, a moderator dashboard, antivirus scanning and managed database/object storage remain outside this prototype.
