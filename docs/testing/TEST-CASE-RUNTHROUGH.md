# Synergy manual test-case runthrough

This is a manual walkthrough of the current local prototype, based on the application source and existing automated tests. Follow the main flow in order, then run the additional cases with the stated prerequisites. Expected results are acceptance criteria; this document does not record a completed test run.

## 1. Prepare the test workspace

Run commands from the repository root. Install Node.js 24+ and dependencies with `npm install`. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is restricted.

Use disposable test accounts and a separate database. Do not point this run at a workspace containing real collaboration data. Leave `.env` and existing databases unchanged.

### Pass A: prototype browsing

Start a fresh prototype workspace in PowerShell:

```powershell
$env:SYNERGY_DEMO_MODE = 'true'
$env:SYNERGY_DATA_FILE = ".data/manual-preview-$([guid]::NewGuid()).sqlite"
npm.cmd run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Run TC-01 and the discovery checks TC-13 through TC-18 in this mode. The fictional directory contains 14 startups and 10 mentors; results are paginated and filtered by the active role. Sample profiles have no fabricated collaboration history.

Role previews cannot discover or connect with one another. Do not use them to test acceptance, shared rooms or two-party reviews. Each simulated sign-in creates a separate preview account; use refresh to retain the current session while testing it.

### Pass B: shared workflows with local accounts

Stop the Pass A server with Ctrl+C, then run:

```powershell
$env:SYNERGY_DEMO_MODE = 'false'
$env:SYNERGY_DATA_FILE = ".data/manual-accounts-$([guid]::NewGuid()).sqlite"
$env:SYNERGY_ADMIN_EMAILS = 'qa-moderator@example.com'
npm.cmd run dev
```

Keep this server running throughout the main flow. A server restart invalidates sessions, but saved accounts and collaboration records remain. When a restart is required, retain the same `SYNERGY_DATA_FILE` value and sign in again. Generating another filename starts another workspace.

Create the following accounts through **Create account**, using separate independently opened tabs or browser profiles. Avoid duplicating an already signed-in tab because the browser may copy its session storage. Use an 8+ character test password, for example `Synergy-QA-2026!`.

| Actor | Name             | Email                    | Initial role    | Purpose                          |
| ----- | ---------------- | ------------------------ | --------------- | -------------------------------- |
| A     | QA Founder Alpha | qa-alpha@example.com     | Startup founder | Main founder                     |
| B     | QA Founder Beta  | qa-beta@example.com      | Startup founder | Exchange partner                 |
| M     | QA Mentor Morgan | qa-mentor@example.com    | Mentor          | Mentorship partner               |
| O     | QA Observer      | qa-observer@example.com  | Startup founder | Public profile and access checks |
| Admin | QA Moderator     | qa-moderator@example.com | Startup founder | Moderation cases                 |

Local accounts are used only on this server. They do not require email delivery or external authentication.

Use these profile values so the test accounts can find each other. Fill **Your name** with the actor name above. Optional preferences can be expanded below the main profile fields.

| Field                   | A                                   | B                                     | M                                  |
| ----------------------- | ----------------------------------- | ------------------------------------- | ---------------------------------- |
| About me                | Building accessible student tools   | Helping student teams test and launch | Advising early startup teams       |
| What I offer            | Technical development, beta testing | Beta testing, product feedback        | Product feedback, product strategy |
| What I need             | Beta testing, product feedback      | Technical development, beta testing   | Focused questions                  |
| Industry                | EdTech                              | EdTech                                | Not applicable                     |
| Stage                   | Idea                                | Idea                                  | Not applicable                     |
| Team size               | 3                                   | 3                                     | Not applicable                     |
| Expertise areas         | Not applicable                      | Not applicable                        | Product feedback, product strategy |
| Availability            | Not applicable                      | Not applicable                        | Weekly                             |
| Startups I want to help | Not applicable                      | Not applicable                        | EdTech idea stage                  |
| Goals for collaborating | Validate onboarding                 | Validate onboarding                   | Validate onboarding                |

Give O a completed founder profile using A's values and O's own name. Admin only needs a completed profile if testing discovery from that account.

Prepare a small valid UTF-8 `qa-evidence.txt`, one valid PDF or image, an empty file, and an unsupported file such as a ZIP. Choose session and task dates relative to the actual test day: tomorrow for upcoming work and yesterday for overdue work. Note the device timezone; use `Asia/Manila` for the baseline if available.

## 2. Record results

For every executed case, record a status of **Pass**, **Fail**, **Blocked**, or **Not run**. If a prerequisite fails, mark dependent cases Blocked and record the prerequisite instead of marking them Pass.

| Case ID | Status  | Actual result / issue link | Evidence |
| ------- | ------- | -------------------------- | -------- |
| TC-01   | Not run |                            |          |

Copy the row for each case. Include the tested commit or working-tree version, tester, date, browser/version, viewport, app URL, mode, database filename, device timezone and room IDs in the run notes. Keep screenshots, downloaded files and console/network errors where useful. Do not include passwords or session tokens in evidence.

## 3. Sign-in, navigation and profiles

### TC-01 - Prototype role previews

**Mode:** Pass A.

1. Submit the sign-in form empty and inspect the field errors.
2. Enter any non-empty email text and password. Choose **Founder** in **Prototype role** and select **Sign in**.
3. Visit Home, Matches and Profile, then refresh.
4. Sign out through the confirmation dialog, then repeat with **Mentor**.

**Expected:** Empty inputs are rejected. Non-empty preview credentials work without real email validation or delivery. The selected role opens with an editable sample profile; refresh retains the current session. Mentor views use mentoring language. No sample rooms, messages, ratings or activity are inserted. Preview help explains the connection limitation.

### TC-02 - Local signup validation

**Mode:** Pass B.

1. Open **Create account** and submit blank fields.
2. Try an invalid email and a password shorter than eight characters.
3. Toggle **Show password** and **Hide password**.
4. Create A with valid values and the founder role.

**Expected:** Invalid inputs have useful guidance and prevent account creation. Password visibility toggles without clearing the value. Valid signup opens the founder workspace directly, with no email-verification or AI-onboarding step.

### TC-03 - Clean accounts and duplicate email

1. Inspect A's Home, Rooms, Introductions, Calendar and Profile before completing the profile.
2. In independently opened tabs, create B, M, O and Admin.
3. In a signed-out tab, attempt signup with A's email again.

**Expected:** New local accounts have no sample collaborations, conversations or reviews. Profile setup is clearly offered. Mentor signup opens the mentor experience. Duplicate signup is rejected without overwriting A.

### TC-04 - Password sign-in and account isolation

1. Sign out of A. Attempt sign-in with A's email and an incorrect password twice.
2. Dismiss the error, then sign in with the correct password.
3. Refresh, then sign out and sign in as B in that tab. Keep A's original session in another independently signed-in tab if needed.

**Expected:** Incorrect credentials produce persistent, actionable feedback and allow retry. Correct credentials restore saved data. B does not inherit A's private profile drafts, saved matches or session state.

### TC-05 - Workspace navigation and route recovery

1. Visit Home, Matches, Introductions, Rooms, Calendar, Profile, Updates and Settings through navigation.
2. Use browser Back and Forward, then refresh on Calendar and Profile.
3. Open `/#/rooms/does-not-exist`, `/#/matches/does-not-exist` and an unknown route such as `/#/unknown`.
4. Open a protected workspace URL in a signed-out tab.

**Expected:** Navigation and refresh retain the correct authenticated account. Unavailable records and invalid routes have a safe fallback without a crash or invented room. Signed-out access requires sign-in.

### TC-05a - Mentor navigation

1. Sign in as a mentor. Check the sidebar and the mobile menu at 390px.
2. Open Requests, then choose Browse startups.
3. Open Mentees with no mentorships, then choose Review requests.
4. Switch to a founder account and check the sidebar again.

**Expected:** Mentors see Home, Requests, Mentees and Calendar, plus Updates and Settings. They do not see Matches, Introductions or Deal Rooms. Requests is titled "Requests" and says how many founders are waiting, or "No pending requests" when none are. Browse startups opens Matches. Mentees is titled "Mentees", and its empty state leads to Requests. Founders still see Matches, Introductions and Deal Rooms, and no Calendar item.

### TC-06 - Founder profile validation and save

1. As A, open Profile and its edit action. Clear required inputs and try **Save profile**.
2. Try Team size `0` and leave Stage unselected on a fresh profile.
3. Enter A's prepared profile values and save. Repeat with B and O.
4. Refresh and inspect the public profile view.

**Expected:** Required inputs and positive team size are enforced, including the custom Stage control. Successful saves leave editing mode, update completion information and persist after refresh. Founder details appear in the founder layout.

### TC-07 - Mentor profile and optional experience

1. As M, complete and save the prepared mentor values.
2. Add **Past experience**: `Led onboarding reviews for three student startups` and save again.
3. As A, find M in **Matches > Browse all** and open the profile.
4. Remove the optional experience, save, then restore it for later checks.

**Expected:** Expertise, availability and preferred startups appear in the mentor layout. Saved experience is public; leaving it empty does not prevent saving a complete mentor profile.

### TC-08 - Profile drafts, cancel and role separation

1. As A, edit About me and an optional engagement preference without saving.
2. Navigate away and return to Profile editing in the same tab.
3. In **Settings > Active profile**, switch to Mentor, then back to Startup founder and reopen editing.
4. Select **Cancel** and reopen the editor.

**Expected:** The unsaved founder draft survives same-tab navigation and role switching, including custom-select values. It does not replace the mentor draft or published profile. Cancel discards the draft and restores saved values. Drafts are scoped to the current tab and role.

### TC-09 - Optional preferences and community disclosures

1. Edit a profile, expand **Optional collaboration preferences and tags**, set goals, engagement preference and relevant tags, then save.
2. Open **Affiliation verification and community tags** on the profile.
3. Enter organization/evidence and a proposed tag without submitting. Collapse and reopen the disclosure.

**Expected:** Saved preferences appear where applicable and persist. Disclosure toggling keeps entered values. Pending community requests are distinguished from approved vocabulary and verified affiliation.

### TC-10 - Founder and mentor Home priorities

**Prerequisites:** Revisit after TC-20, TC-28 and TC-36 create requests, tasks and sessions.

1. Open A's Home and follow its setup or next-work action.
2. Open M's Home with a pending founder request, then again after accepting it and assigning M a task.
3. Follow the request, upcoming session, active mentee and preparation/follow-up links that are present.

**Expected:** Home reflects actual account work. Mentor Home prioritizes requests, sessions, mentees and assigned actions. Links open the corresponding record or room section; empty states do not invent work.

## 4. Matches and discovery

### TC-11 - Suggested, Browse all and role eligibility

1. With complete profiles, compare **Suggested** and **Browse all** for A and M.
2. Search for the prepared partner names in Browse all.
3. In Pass A, inspect the fictional directory as both roles.

**Expected:** Eligible completed local profiles can find each other in Pass B. Suggested requires at least 30% fit; Browse all can include weak or zero-fit profiles. Mentors discover startups to support. Do not require the same numerical fit for every dataset or role.

### TC-12 - Public match detail

1. As A, open B and M from a match card.
2. Inspect identity, profile context, offers, needs, collaboration actions and trust information.
3. As M, open A and inspect startup needs and goals.

**Expected:** Detail content matches saved profiles. Mentorship choices and language fit the participants. New accounts show no ratings or fabricated history. Numerical fit details are available on demand.

### TC-13 - Search and empty results

1. Open Matches and search by a visible name, then a word from that profile's offers or needs.
2. Search for `no-such-qa-collaborator-xyz`.
3. Use **Clear filters** and clear any remaining search text.

**Expected:** Search narrows results, an unmatched query shows a useful empty state, and clearing the criteria restores eligible results.

### TC-14 - Apply and cancel filters

1. Open **Filters**, set applicable type, industry, minimum fit and collaboration filters, then select **Show matches**.
2. Reopen Filters and inspect the applied values.
3. Change an option and close with Escape without applying.
4. Clear filters.

**Expected:** Applied results satisfy all selected criteria. Reopening shows current choices; canceling leaves applied results unchanged. Clearing restores the unfiltered set. Role-specific controls remain appropriate.

### TC-15 - Sorting and pagination

**Dataset:** Use Pass A for enough results to paginate.

1. In Browse all, choose **Highest fit**, then **Name**, then **Completed collaborations** under **Sort by**.
2. Use **Next** and **Previous** where available.
3. Apply a filter while on a later page.

**Expected:** Fit sorts descending and names alphabetically. Pagination retains the sort and never strands the tester on an invalid empty page after filtering. Zero completed-collaboration counts do not imply sample history.

### TC-16 - Saved matches

1. Save a visible match using **Save match**.
2. Open **Saved**, refresh and return to Saved if needed.
3. Remove the match from saved profiles.

**Expected:** Saved state persists for that account and active role. Removing it updates the button and Saved list. Another account does not inherit the selection.

### TC-17 - Fit explanations and sparse profiles

1. Open **Why this match** and **How the score works**.
2. Close each dialog with Escape and check focus returns to its trigger.
3. Compare a strong match and a weak/zero-fit result where available. In a fresh local account, inspect discovery before completing the profile.

**Expected:** Explanations describe the available profile signals. Missing profile inputs do not earn positive signals or appear as fabricated certainty. Sparse input offers useful profile-completion guidance.

### TC-18 - Avatar fallback

**Dataset:** Pass A includes illustrated avatars and initials.

1. Inspect cards with and without avatar images.
2. In browser developer tools, block one observed avatar image request and reload.
3. Open that person's detail view, then remove the request block.

**Expected:** A failed image falls back to usable initials instead of a broken image or missing identity. Discovery and profile actions remain usable.

## 5. Introductions and shared terms

Use Pass B for all remaining shared workflow cases. Keep A, B and M signed in independently. Use Browse all and search by exact prepared name if Suggested does not list a partner.

### TC-19 - Withdraw and decline introductions

1. A opens B, chooses **Beta Testing Exchange** and selects **Express interest**.
2. Check A's outgoing introduction and B's incoming introduction, then A selects **Withdraw**.
3. Send another introduction; B selects **Decline**.
4. Refresh both tabs after each outcome.

**Expected:** Both accounts agree on pending, withdrawn and declined state. Withdrawal or decline does not create a shared room. Refresh does not restore a pending request that has ended.

### TC-20 - Accept a founder exchange

1. A sends B another Beta Testing Exchange introduction.
2. B opens Introductions, checks A's current profile brief and selects **Accept introduction**.
3. A opens the resulting room through Rooms or its update.
4. Record the room URL as **R-BETA**.

**Expected:** Acceptance creates one shared Beta Testing Exchange room visible to both participants. The pending introduction clears. Repeated clicks or refresh do not create duplicate rooms.

### TC-21 - Mentorship in both initiation directions

1. A opens M, checks that the collaboration type is Mentorship, and sends an introduction.
2. M inspects the founder's current needs and goals, then accepts. Record **R-MENTOR**.
3. Separately, M sends O a mentorship introduction and O accepts. Record **R-REVERSE**.
4. Inspect both participants' Rooms lists.

**Expected:** Both founder-initiated and mentor-initiated mentorship work. Mentor connections offer Mentorship only. Each accepted request creates the correct shared room with consistent participant identity and request state.

### TC-22 - Save and mutually confirm terms

1. In R-BETA, A enters Shared goal `Validate onboarding`, Scope and deliverables `Exchange feedback from five testers each`, Timeline `Two weeks`, Commitment `One feedback report each`, and an agreed compensation description.
2. Select **Save draft**. B opens Terms and checks the saved text.
3. A selects **Lock terms & start**. B reviews and selects **Accept shared terms**.
4. Refresh both tabs. Repeat the agreement process in R-MENTOR using **Confirm mentoring agreement** and a **Mentoring arrangement** such as `Voluntary guidance`.

**Expected:** Saved terms are shared; unsaved drafts stay local. The first confirmation waits for the partner. Both confirmations are required for the agreed state, which persists after refresh. Mentorship uses its own agreement labels.

### TC-23 - Reopen terms and reconfirm

**Prerequisite:** Agreed R-BETA with some milestone progress; run after TC-31 if needed.

1. Select **Request changes / reopen terms**.
2. Update scope and save or lock the revised terms.
3. Check both accounts, then have the other participant accept the new terms.

**Expected:** Reopening clears agreement and milestone confirmations that require fresh approval, while retaining evidence/history. Work cannot be completed using old confirmations. Both participants must accept the current terms.

### TC-24 - Conflicting shared-term drafts

1. Before locking terms in an unfinished room, open Terms in both participant tabs.
2. A edits scope without saving; B saves a different scope.
3. Wait for synchronization, then try saving A's older draft. Inspect the conflict guidance and use its offered review/recovery controls.

**Expected:** A's dirty draft is retained and the newer shared values are identified. A stale save cannot silently overwrite B's version. The tester can review current terms and deliberately recover or reapply edits.

### TC-25 - Shared room chat

1. In R-BETA, A sends `QA Alpha: please review the onboarding flow`.
2. B replies `QA Beta: review received`.
3. Refresh both tabs and reopen Chat.
4. Attempt an empty or whitespace-only message.

**Expected:** Messages appear automatically for both participants, identify the sender and time, and survive refresh. Empty content does not create a message. Room messages are not exposed to O.

## 6. Task board, milestones and evidence

### TC-26 - Room list and next steps

1. Open Rooms and compare **All rooms**, **In progress**, **Completed** and **Closed** under **Show rooms**.
2. Open an active room, inspect progress and next-step guidance, and use **All rooms** to return.
3. Revisit the filters after completion and closure cases.

**Expected:** Rooms belong to the active account/role and appear in the correct lifecycle category. Progress and next steps reflect actual confirmations and agreements.

### TC-27 - Create and validate tasks

1. In R-BETA's **Task board**, select **+ Add task** and submit with no title.
2. Create `Review onboarding checklist`, with a description, B as Owner, High priority, tomorrow's Due date and a Linked milestone.
3. Create another unassigned task without an optional date or milestone.

**Expected:** A title is required. Saved cards show the correct owner, priority and optional metadata, appear in the chosen status column and synchronize to B.

### TC-28 - Edit, filter and move tasks

1. Edit the first task's title or description and save.
2. Move it from To do to In progress to Done by drag-and-drop on desktop.
3. Move it again with the card's status control using keyboard or mobile interaction.
4. Search for the task and toggle **Assigned to me** from A and B. Assign M a preparation task in R-MENTOR for TC-10.

**Expected:** Edits, status and completion counts synchronize. Search and assignment filters use actual card data. Status changes have an alternative to dragging. Completing a task does not confirm its linked milestone.

### TC-29 - Cancel, delete and stale task edits

1. Edit a task, change its title and select Cancel; reopen it.
2. Open the same task for editing as both participants. Save a change as B, then try A's stale save.
3. Reopen the current task, select **Delete task**, then **Confirm delete**.

**Expected:** Cancel preserves saved values. Stale updates are rejected with recoverable feedback. Delete requires its second action and removes the card for both participants.

### TC-30 - Milestone prerequisites and UTC deadlines

1. In an unagreed room, open Milestones and inspect **Confirm yours** and the completion action.
2. After both accept terms, set a milestone's **Due date (UTC)** to tomorrow and save.
3. Set another unconfirmed milestone to yesterday, then change or clear that date.
4. Inspect the labels, Updates and Calendar.

**Expected:** Required agreement, evidence and partner confirmations gate progress. Dates retain their assigned UTC date. Overdue/open milestone deadlines are surfaced appropriately; changed or removed dates update the corresponding views.

### TC-31 - Evidence descriptions and private file uploads

1. In R-BETA, use **Attach evidence** on Testing round. Enter a description or link and select **Attach**.
2. On Feedback submitted, upload `qa-evidence.txt` or a valid PDF/image using **Upload file**.
3. B downloads the file and verifies its contents. Refresh and download again.
4. After confirming the evidence milestone, replace its evidence and inspect both participants' confirmation state.

**Expected:** Both participants can read saved evidence and download the original file. Uploads persist. Replacing evidence invalidates confirmations tied to the previous evidence so the current version must be reviewed again.

### TC-32 - Invalid uploads and unauthorized file access

1. Attempt an empty upload and an unsupported file such as ZIP. If needed, select All files in the OS picker to exercise rejection.
2. Attempt a file whose extension does not match its content, such as plain text renamed to `.png`.
3. With an authorized download request identified in developer tools, replay it in O's session and with no session. Do not share participant tokens with O.

**Expected:** Invalid files are rejected without replacing saved evidence. Supported formats are valid PDF, PNG, JPEG, WebP and UTF-8 text. An unrelated or signed-out user cannot download room evidence; a copied address alone grants no access.

### TC-33 - Independent milestone confirmations

1. In agreed R-BETA, A selects **Confirm yours** on Scope defined.
2. Inspect B's view before B confirms, then have B confirm the same milestone.
3. Try confirming an evidence-required milestone without evidence.

**Expected:** A confirms only A's participation. The milestone waits for B and becomes mutually confirmed only after B acts. Evidence-required milestones cannot be confirmed without evidence. One completed milestone does not enable room completion.

### TC-34 - Propose, withdraw, reject and accept milestone revisions

1. On a milestone with existing evidence, open **Propose title or scope revision**, enter a revised title/scope and send it for approval.
2. Check that milestone confirmation and room completion are blocked while the proposal is pending. Withdraw the proposal as its author.
3. Propose again; the partner rejects it through **Revision decision > Save revision decision**.
4. Propose once more; the partner accepts it.

**Expected:** Pending revisions are visible to both participants. Only the partner can accept/reject; the author can withdraw. Rejection/withdrawal preserves the current title and scope. Acceptance updates them, clears that milestone's confirmations and preserves evidence.

### TC-35 - Disputes and mutual resolution

1. Flag a dispute on an unfinished milestone.
2. Inspect the milestone and completion blockers from both accounts.
3. A selects **Agree to resolve dispute**; verify the dispute remains pending until B does the same.
4. Have both confirm the milestone again after resolution.

**Expected:** An open dispute prevents confirmation/completion. Both participants must agree to resolve it, unless a moderator applies a permitted remedy. Resolution requires fresh confirmations of the current milestone content.

## 7. Mentorship scheduling and Calendar

### TC-36 - Review and save a session schedule

**Prerequisite:** Mutually agreed R-MENTOR.

1. Open **Schedule**, choose tomorrow's Session date, time `10:00`, Session duration `45` minutes and no repetition.
2. Select **Review schedule** and inspect date, time, timezone and duration before saving.
3. Use the review's edit action, change the time, review again and select **Save session schedule**.
4. Inspect M's room and the **Session scheduled** milestone.

**Expected:** Nothing is shared until saved. The reviewed schedule saves once and appears for both participants. Scheduling alone does not confirm both participants' milestones. No external calendar invite or availability check is implied.

### TC-37 - Weekly series and rescheduling

1. Open the session planner from **Milestones > Schedule session** or **Reschedule session**.
2. Choose three weekly occurrences, review all dates and save/update the schedule.
3. Confirm the session milestone from both accounts, then reschedule the series by one day.
4. Compare Schedule, Milestones and both Calendars after synchronization.

**Expected:** Both entry points use the same planner and saved series. Weekly dates and duration are consistent. Updating the series removes stale schedule entries and clears session-milestone confirmations for renewed review.

### TC-38 - Schedule validation and timezone handling

1. Try reviewing a schedule with a missing date or missing time.
2. Save a valid schedule and view it from a browser/device using a different timezone.
3. Open the saved series for editing in that other timezone and inspect its original scheduling timezone.
4. Compare a task due date and UTC milestone deadline across the same views.

**Expected:** Incomplete input cannot save. Sessions represent the same instant and display in each viewer's timezone. Editing retains the original series timezone. Task dates remain on their assigned date; milestone deadlines retain their UTC date.

### TC-39 - Calendar Month, Agenda and room links

1. Open Calendar with an upcoming session, open dated task and unconfirmed dated milestone.
2. Check Month and Agenda, navigate Previous/Next month and select **Today**.
3. Select an event date and inspect the selected-day details.
4. Filter by collaboration and open each event kind.

**Expected:** Calendar combines relevant events from active rooms for the current role. Filters and day details agree. Session links open Schedule, task links open Task board and milestone links open Milestones in the correct room. Empty days/months have helpful empty states.

### TC-40 - Calendar updates after work changes

1. Complete a dated task, mutually confirm a dated milestone and reschedule a session.
2. Revisit Month, Agenda and the relevant collaboration filter.
3. Later, repeat after closing or completing that room.

**Expected:** Completed tasks and mutually confirmed milestones no longer appear as open deadlines. Old session occurrences are replaced on reschedule. Terminal rooms do not continue contributing active-room events.

## 8. Complete collaborations and release reviews

### TC-41 - Finish a beta exchange and mentorship

1. In R-BETA, resolve disputes/revisions, mutually agree current terms, attach all required evidence and have each participant independently confirm every milestone.
2. Check **Mark as launched** before and after the final partner confirmation, then select it.
3. In R-MENTOR, complete Goals defined, Session scheduled, Guidance delivered, Follow-up actions logged and Progress reflected on together, with required guidance evidence and both confirmations.
4. Select **Complete mentorship**. Inspect both participants' room state and the review action.

**Expected:** Completion stays blocked until all current requirements are met. Either participant can complete after the final mutual confirmation. Mentorship says completed; exchanges say launched. Shared progress reflection does not substitute for the private review.

### TC-42 - Blind reviews and public trust

1. Before completion, open a room's URL with `/review` appended and verify review gating.
2. After completion, attempt a review without a star rating, then submit A's 4-star review with a distinctive note and optional outcome answers.
3. Before B submits, inspect B's review page and O's view of B's public trust history.
4. B submits a 5-star review. Check both review pages and public collaboration history as O.

**Expected:** Reviews require completion and a rating. A's note, rating and optional answers remain withheld from B until both submit; public trust does not release the first review early. Both participants then see released feedback, and completed history/reputation updates. Private notes are not exposed as public profile text.

### TC-43 - Co-marketing and repeated collaborations

1. With no active A/B engagement, send and accept a new **Co-Marketing Swap** introduction. Record **R-MARKETING** and compare its room ID with R-BETA.
2. Agree terms; complete Audience aligned, Campaign assets ready, Campaign launched, Results shared and Next steps agreed, attaching required launch/results evidence.
3. Confirm all milestones from both accounts, mark as launched and submit both reviews.
4. Inspect room history and O's view of public trust.

**Expected:** Co-marketing follows the full shared lifecycle with its own milestones. Earlier rooms and evidence remain intact. Repeat collaborations add history without counting the same partner as multiple distinct collaborators.

### TC-44 - Close and reconnect without losing history

**Prerequisite:** A separate unfinished room, such as R-REVERSE after basic terms are saved. Do not close the main rooms before their completion cases.

1. Open **Close this collaboration**, enter `QA: priorities changed`, then select **Close collaboration**.
2. Inspect the partner tab, Rooms > Closed, saved terms, chat and evidence.
3. Try changing the closed room's tasks, terms, milestones or schedule.
4. Send and accept a new introduction between the same participants.

**Expected:** Closure reason and history remain available to both participants. The closed room rejects further shared-work mutations. Reconnection creates a different room and preserves the previous one.

## 9. Updates and notification preview

### TC-45 - Unread state, filtering and navigation

**Prerequisite:** Recent partner actions from earlier cases, plus an open overdue deadline/upcoming session for reminder checks.

1. Open Updates and compare **All** and **Unread**, unread counts and grouped dates.
2. Open an introduction/room update and inspect its destination and read state.
3. Use **Mark all as read**, refresh and check the count again.
4. Trigger another partner action and wait for synchronization.

**Expected:** Updates describe real events and use relevant destinations. Read state persists. A later new event becomes unread without restoring previously read items. Dates and relative times distinguish event creation from the actual session time or UTC deadline.

### TC-46 - Header preview and stable timestamps

1. Open the header notification preview with enough updates to scroll.
2. Scroll to the final row, use its link to Updates, and compare row content/read state.
3. Open and dismiss other available header popovers, then test Escape and outside-click dismissal.
4. Refresh several times; after the persistence case, compare generated match/reminder first-seen times again.

**Expected:** The preview stays below the header, fits the viewport and keeps its last row reachable. Preview and Updates use consistent rows/state. Popovers coordinate and return focus appropriately. Polling, refresh and server restart do not continually recreate first-seen timestamps.

## 10. Account controls and moderation

Run account closure, blocking, suspension and deletion after the main lifecycle. Use additional disposable accounts/unfinished rooms where needed so these cases do not invalidate earlier prerequisites.

### TC-47 - Voluntary sign-out confirmation

1. Begin an unsaved profile draft and select Sign out.
2. Cancel the dialog; reopen it and dismiss with Escape or outside click.
3. Check that the draft remains, then confirm **Sign out** once.
4. Sign in again and inspect the saved profile. Repeat cancellation/confirmation through mobile navigation.

**Expected:** Cancellation keeps the session and unsaved draft. Confirmation returns to sign-in and clears that tab's unsaved drafts. Saved account data persists; one confirmation does not issue duplicate sign-outs.

### TC-48 - Pause and resume discovery

**Prerequisite:** A pending introduction from a disposable account and an existing room for the tested account.

1. Open **Settings > Danger zone > Pause discovery** and cancel once.
2. Reopen and confirm. Inspect Matches and pending introductions from the other account.
3. Open an existing room, then return to Settings and select **Resume discovery**.

**Expected:** Cancel changes nothing. Pause hides both role profiles and withdraws pending introductions while retaining existing room access. Resume restores eligible discovery without restoring withdrawn introductions.

### TC-49 - Block and unblock a collaborator

**Prerequisite:** A disposable partner with an unfinished room and preferably a pending introduction in another role.

1. Open that collaborator's match profile and complete the block action.
2. Check both accounts' Matches, introductions, unfinished room status and ability to send chat.
3. In Settings > Blocked collaborators, select **Unblock** for that person.

**Expected:** Blocking hides both accounts from one another, withdraws introductions, closes unfinished collaborations and prevents further chat. Shared history remains. Unblocking does not reopen a closed collaboration or restore old introductions.

### TC-51 - Revoke other sessions

1. Sign into the same local password account in two independent tabs/profiles.
2. In the first tab's Danger zone, open **Sign out other sessions** and cancel once.
3. Retry, test an incorrect Current password, then supply the correct password and confirm the selected other session or all other sessions.
4. Use the revoked tab again and refresh it.

**Expected:** Cancel or incorrect password revokes nothing. Successful revocation preserves the initiating tab while the targeted session must sign in again. Forced session expiry does not require the voluntary sign-out confirmation.

### TC-52 - Delete a disposable account

**Prerequisite:** A disposable account with shared history, an unfinished room and another signed-in session.

1. Open **Delete my account**, inspect the consequences and cancel once.
2. Retry with an incorrect password or confirmation other than exact `DELETE`.
3. Supply the current password and exact confirmation, then select **Permanently delete account**.
4. Try the other session and old credentials. Inspect retained history from the collaborator's account.

**Expected:** Invalid confirmation/password cannot delete. Successful deletion revokes sessions, removes private account details and closes unfinished rooms. Shared agreements, evidence, messages and released reviews remain with the identity anonymized as Deleted account. For a Pass A preview account, deletion uses its current session and `DELETE`, without a password prompt.

### TC-53 - Submit community requests and a room report

1. As an ordinary account, submit Organization or program plus Affiliation evidence through the profile disclosure.
2. Propose a new community tag of 3-60 characters; try blank/too-short input first.
3. In an unfinished room with a dispute, select **Report a concern**, enter a meaningful reason and submit.

**Expected:** Required fields are validated. Requests/reports persist as pending work for configured moderators. Submitting a request does not immediately grant a verified badge or approve shared vocabulary.

### TC-54 - Moderator decisions and audit history

**Prerequisite:** Admin email was configured before server startup; TC-53 produced pending requests.

1. Sign in as Admin and open Moderation. Inspect the report's room context, evidence and recent messages.
2. Assign or escalate a report, then resolve one using **Clear disputes; require both partners to reconfirm** and a written reason.
3. Approve or reject a tag and verify or reject an affiliation, recording reasons.
4. Expand **Decision history** and inspect the affected ordinary accounts.

**Expected:** Authorized moderators can review and decide. Decisions record moderator, reason and time. Approved tags become shared vocabulary; affiliation status reflects the decision. Clearing disputes requires renewed participant confirmations and does not fabricate their approval.

### TC-55 - Suspension and moderation access boundaries

1. As O, open `/#/moderation`.
2. As Admin, suspend an additional disposable ordinary account with a reason.
3. Try using that account's active session and signing in again; then restore it through Admin and retry sign-in.
4. In Pass A, check that a role preview does not gain moderator access by typing an allowlisted email.

**Expected:** Ordinary accounts and role previews cannot access privileged moderation data/actions. Suspension enforces account access restrictions. Restoration permits normal access again without removing audit history.

### TC-56 - Versioned templates and matching weights

1. As Admin, record current engagement templates and matching weights.
2. Change a template name or milestone title and save. Create a new room of that type.
3. Compare the new room with a room created before the change.
4. Change matching weights while keeping each role's total at 100%, save and inspect the version/evaluation. Try an invalid total.
5. Restore the original template contents and weights through new saves.

**Expected:** Only moderators can save these settings. Versions advance on accepted changes. New rooms copy the current template; existing room scope/history remains unchanged. Valid weight changes are versioned and invalid configurations are rejected. Restoring values creates another version instead of erasing history.

## 11. Reliability, responsive layout and accessibility

### TC-57 - Network failure and recovery

1. On sign-in, use developer tools to fail a login request, then restore connectivity and retry.
2. While signed in, fail workspace polling requests temporarily; refresh once during the outage.
3. In Profile editing, enter a draft and attempt saving during the outage. Repeat the outage/recovery cycle before finally saving successfully.
4. Try a room save during a short outage, then restore the connection and review current server data before retrying.

**Expected:** Errors give actionable feedback without false success. Temporary restore failures preserve a still-valid session and offer retry. Unsaved drafts survive failed saves. Recovery synchronizes real state without duplicate records or silently overwriting a partner's newer work.

### TC-58 - Saved data across server restart

1. Record saved profile values, room IDs, chat, evidence, tasks, schedules and read/unread state.
2. Stop and restart the server using the same database filename.
3. Sign in again with local account credentials and compare the saved records.
4. Repeat an authorized evidence download.

**Expected:** Sessions expire on restart and require sign-in. Saved workspace data, uploads and notification read/first-seen state persist. No duplicate history appears solely because the server restarted.

### TC-59 - Desktop, tablet and mobile layouts

1. Repeat navigation at viewport widths 1440, 768, 390 and 360 pixels in the supported browsers: Chromium, Firefox and WebKit/Safari where available.
2. Inspect login, both roles' Home/Profile/Matches, introductions, room tabs, Terms, Milestones, Task board, Schedule, Calendar, Updates, Settings and Moderation if authorized.
3. Open filter, fit, account-action and sign-out dialogs; scroll content and use their final actions.

**Expected:** No page-wide horizontal overflow hides content. Mobile navigation works; room tabs and long forms remain reachable. Text, controls and notification previews do not overlap. Primary actions remain visible or reachable by normal scrolling.

### TC-60 - Keyboard, focus and visual accessibility

1. Use keyboard only to navigate login, Matches, profile editing, Settings and a room. Activate tabs with their supported arrow keys and select ratings without a mouse.
2. Exercise custom dropdowns using Enter/Space, arrows, Home/End, typeahead, Enter selection, Escape cancellation and Tab dismissal.
3. Open dialogs and check initial focus, focus containment, Escape dismissal and focus return. Open overlapping popovers/dialogs and confirm page scrolling is restored only after the final modal closes.
4. Inspect at 200% zoom and with reduced motion; check visible focus, form errors and forced-colors mode where supported.

**Expected:** Controls have meaningful names and visible focus. Dropdown keyboard operations match pointer selection without accidental changes on cancellation. Dialog content and actions remain reachable, errors identify fields, and motion/contrast preferences preserve usability.

## 11A. Mentor capacity, conflicts and guidelines

Run these as a mentor (R-MENTOR) with a second founder account. Mentor settings are in **Settings → Mentoring**.

### TC-61 - Accept the mentor guidelines

1. Create a new mentor account and complete the profile. Do not open Settings yet.
2. As a founder, find that mentor in **Matches → Browse all** and open the match.
3. As the mentor, open **Settings → Mentoring**, read the guidelines and select **Accept guidelines**.
4. As the founder, reload the match.

**Expected:** Before acceptance the founder sees "can take requests once they accept the mentor guidelines", the send button is disabled and a direct request is refused with the same reason. Mentor Home shows a banner with the action. After acceptance the mentor is available and the banner is gone. A mentor who existed before this release instead sees an "accept by {date}" banner for 14 days and stays available during that time.

### TC-62 - Set capacity and formats

1. In Mentoring, set mentees to 1, hours to 6, and keep only Quick Ask and Single Session. Save.
2. Try 11 mentees, 0 hours, a response time of 4 days and no formats.
3. Accept one session request from a founder, then ask as a second founder.

**Expected:** Valid settings save and show "You're using N of 1 mentee slots and X of 6 hours this month". Each invalid value is rejected beside its field. At the mentee limit the second founder cannot request a Single Session and sees the reason with up to three similar available mentors, but a Quick Ask is still possible when the mentor offers it and has async room and hours.

### TC-63 - Pause Mode

1. As a founder, send a request to the mentor. As the mentor, turn on **Pause new requests** with a resume date.
2. As the founder, open Updates, Introductions and the mentor's match page.
3. As the mentor, turn Pause Mode off. Repeat with a resume date that passes.

**Expected:** The pending request leaves the mentor's inbox and the founder's history records it as returned, with similar mentors to ask and a notification. The mentor stays visible in Discover with "Not taking requests" and no send button. Current mentees and rooms are unaffected. Pause Mode ends by itself on the resume date. A past or same-day resume date is rejected.

### TC-64 - Conflicts of interest

1. As the mentor, add a conflict with the same company name as a founder's startup (try different capitalisation and a trailing "Inc"). Check each founder's Matches.
2. Remove it, then add an investor conflict in the founder's industry.
3. Choose **I have no conflicts** with and without a listed conflict.

**Expected:** A matching company hides the pair from both sides, and a direct request is refused. An industry-only match keeps the pair visible and shows the mentor a "Possible conflict" warning. The conflict list is never visible to founders. "No conflicts" is only accepted when the list is empty.

### TC-65 - Available now filter and score factors

1. As a founder, open **Filters** and choose **Available now**.
2. Open **Why this match?** on a mentor card and the **How the score works** guide.

**Expected:** Only mentors who can take a request now are listed, and the filter counts in the Filters badge. Mentor scores show Availability fit and Format fit, and the guide lists both with weights that total 100%.

## 12. Optional engineering checks

Manual UI checks do not fully establish API authorization, stale-version enforcement, storage transactions or backup integrity. The repository's automated tests cover additional cases in these areas. Run the checks below when doing a release/regression pass; do not mark manual cases passed solely because automation passed.

```powershell
npm.cmd run check:references
npm.cmd run check:format
npm.cmd run test:unit
npx.cmd playwright install chromium firefox webkit
npm.cmd run test:e2e
npm.cmd run build
```

The browser suite uses isolated generated databases and ports 5181-5184. It includes local-account browser projects and a separate prototype project. Existing tests in [app.spec.js](../../tests/app.spec.js), [prototype.spec.js](../../tests/prototype.spec.js), [features.spec.js](../../tests/features.spec.js), [mentorship.spec.js](../../tests/mentorship.spec.js) and [mentor-capacity.spec.js](../../tests/mentor-capacity.spec.js) provide executable workflow references. Backend coverage includes [reliability.test.js](../../tests/reliability.test.js), [features.test.js](../../tests/features.test.js) and [integrations.test.js](../../tests/integrations.test.js).

For an operator rehearsal, follow [Deployment, storage and recovery](../operations/DEPLOYMENT.md) using disposable database/upload copies. Verify backup creation, integrity checks and restore in a separate workspace before comparing saved records and downloads. Do not restore over the main test run or a real workspace.

Email delivery, email verification/recovery/change, email digests, AI profile drafting, external calendar synchronization and automatic scheduling-conflict checking are outside this prototype. Their absence is expected.

## 13. Finish the run

Record which mode, roles, browsers and cases were actually exercised, plus remaining failures/blocked cases. Retain room IDs and useful evidence for reproducibility. Stop the server when finished. The PowerShell variables above apply only to the current shell; close the test shell or clear those task-specific overrides before starting a normal workspace. Retain test databases until findings are resolved, and do not delete existing workspace data as part of this walkthrough.
