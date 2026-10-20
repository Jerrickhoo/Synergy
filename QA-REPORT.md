# Synergy verification — October 20, 2026

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
