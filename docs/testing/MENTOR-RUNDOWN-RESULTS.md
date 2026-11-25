# Mentor rundown results: 25 Nov 2026

A full pass of [MENTOR-RUNDOWN-HOSTED.md](MENTOR-RUNDOWN-HOSTED.md), steps 1 to 40, run as Sam Ortega with the answers from [MENTOR-SAMPLE-ANSWERS.md](MENTOR-SAMPLE-ANSWERS.md).

**Verdict: a mentor can finish the whole flow.** No step was blocked. Every goal in the checklist was met except #7, where the rundown expects the wrong screen. One product issue would stop a real mentor partway: a profile without a short introduction can't send an introduction, and the error doesn't say why. Most other findings are rundown steps that no longer match the UI.

## Fixed since this run

- **F1:** the short introduction is now required in step 7 of the application, checked again before submitting. A profile still missing a field, such as _Startups I want to help_ when Industries was left blank, now disables **Send introduction** and names the missing field, with an **Edit profile** button. The server error names the field too.
- **F2:** **Submit for approval** now lands on _Application under review_, where the **Simulate approval** shortcut is.
- **F3:** working as intended, no change. AccessLearn needs "Onboarding guidance", which maps to the **Mentorship** tag that Sam picked.
- **F4:** **Mentor approvals** now sits with the other queues, below Tag proposals, with a waiting count in its heading. Account access is collapsed.
- **F5:** after saving, a mentor reads "Founders can now find you. See which startups need what you offer." and **See startups**.
- **Second rejection (found in review after this run):** the page said "needs changes" but offered no way forward. It now reads _Mentor application not approved_, says the application can't be resubmitted, and offers **Switch profiles in Settings**, which opens the Profiles section. Act 8 of the rundown covers this path.
- **D1–D8:** the rundown and sample answers now match the UI. Goal #7 checks **Mentees → Room history**, and the Calendar check moved to step 24.

The step results below record the run as it happened, before these fixes.

## How it was run

This was a local run, not the hosted site. The production build (`npm run build`, `npm start`) ran with the same settings as `render.yaml`, and a scripted browser drove the real UI in two windows: one for the mentor and one for the helper.

| Setting                         | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| `SYNERGY_DEMO_MODE`             | `false`                                        |
| `SYNERGY_REQUIRE_VERIFICATION`  | `true`                                         |
| `SYNERGY_SIMULATE_VERIFICATION` | `true`                                         |
| `SYNERGY_SHOWCASE_PROFILES`     | `true`                                         |
| `SYNERGY_ADMIN_EMAILS`          | The helper's email                             |
| `EMAIL_PROVIDER`                | `stub`, so no email was sent                   |
| Mentor approval                 | Required (the production default)              |
| Code                            | `0a90134` plus uncommitted work on `fix/ui-ux` |

What this run couldn't cover:

- **Email (steps 3 and 31).** The stub sends nothing, so sign-up skipped the inbox step and the request email wasn't checked. Check both on the hosted site with Brevo.
- **Render behaviour.** Cold starts and restarts that wipe accounts weren't tested.
- **Simulate approval in Act 3.** The helper approved Sam the real way. The button does show on the pending application. It's covered by a unit test, but it's uncommitted, so the hosted site doesn't have it until this branch is deployed.

All 342 unit tests pass.

## Run details

| Field                          | Value                                             |
| ------------------------------ | ------------------------------------------------- |
| Date                           | 25 Nov 2026                                       |
| Tester                         | Claude, scripted browser                          |
| Deployed commit                | Local build of `0a90134` plus uncommitted changes |
| Showcase sign-in check passed? | Yes: ShelfShare, Fairtab and others listed        |
| Helper email in admin list?    | Yes                                               |
| Browser and size               | Chromium 1440×1000, and 390×844 for step 40       |
| Sign-up and request email      | Not tested (stub)                                 |
| Total time                     | About 1 minute per scripted run                   |
| Mentor score 1–5               | **4**                                             |

## Goal checklist

| #   | Done when…                                                          | Result                                                                                                    |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Mentor account created and opened through the emailed link          | **Partly.** Account created and sent straight to the application. The email link wasn't tested.           |
| 2   | Application submitted, approved by the helper, profile **Verified** | **Yes.** "Verified mentor · Endorsing organization checked"                                               |
| 3   | Settings → Mentoring shows capacity; Pause turned on and off        | **Yes.** "You're using 0 of 3 session slots and 0 of 6 hours this month"                                  |
| 4   | Suggested shows ShelfShare; **Why this match** opened               | **Yes.** ShelfShare is 2nd of 3 at 64%                                                                    |
| 5   | ShelfShare room **Reviewed**, both reviews visible, .ics downloaded | **Yes.** `synergy-session.ics` downloaded                                                                 |
| 6   | Real request accepted, Quick Ask answered, room **Reviewed**        | **Yes**                                                                                                   |
| 7   | **Mentees** lists both founders                                     | **No, as written.** Mentees shows "No active mentees". Both rooms are under **Room history** as Reviewed. |
| 8   | **Updates** shows 0 unread                                          | **Yes**                                                                                                   |
| 9   | Items 2–8 still true after signing out and back in                  | **Yes.** Approval and both rooms kept                                                                     |
| 10  | Findings logged with a 1–5 score                                    | **Yes.** See below                                                                                        |

## Step results

| Step | Status  | Notes                                                                                                                                                                                                             |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2  | Pass    | Sign-up as Mentor works.                                                                                                                                                                                          |
| 3    | Not run | No email with the stub provider.                                                                                                                                                                                  |
| 4    | Pass    | Lands on _Mentor application_, Step 1 of 8.                                                                                                                                                                       |
| 5–11 | Pass    | All 8 steps accept the sample answers. **Continue later**, then **Continue application** on Home, resumes at step 2 with progress kept. The time zone defaulted correctly.                                        |
| 12   | Pass    | Lands on Home with "Your profile is with our team. Most approvals take up to 2 business days", not on _Application under review_ (F2). **View application** opens that page. Startups is browsable while pending. |
| 13   | Pass    | Helper sign-up as Startup founder.                                                                                                                                                                                |
| 14   | Pass    | **Mentor approvals** shows everything from Act 2: verification, 4 tags, formats, capacity, experience, preferences, no conflicts. The entry is collapsed and sits below a long Account access list (F4).          |
| 15   | Pass    | Home changed to "You're live in Matches" within about 4 seconds, with no reload. The Update arrived, and the profile shows **Verified mentor**.                                                                   |
| 16   | Pass    | Profile listed "Add an introduction". Filled **About me** and saved. Skipping this step causes F1 at step 21.                                                                                                     |
| 17   | Pass    | Capacity line correct. Guidelines show "You accepted version 2 on Nov 25, 2026".                                                                                                                                  |
| 18   | Pass    | **Pause new requests** with a resume date, then **Turn off Pause Mode**. It's two buttons, not an on/off switch with a save (D7).                                                                                 |
| 19   | Pass    | Suggested: AccessLearn, ShelfShare, StageBolt. **Why this match** and **See the factor breakdown** are clear: Need Fit 100%, Industry 0%. See F3.                                                                 |
| 20   | Pass    | Searching "pricing" returns ShelfShare, Brightlane and Fairtab; **Clear filters** resets the list.                                                                                                                |
| 21   | Pass    | The card explains "If ShelfShare accepts, a mentorship room opens…". **Blocked if step 16 was skipped** (F1).                                                                                                     |
| 22   | Pass    | Requests → **Your requests**, "Sent (1)", "Waiting for their reply · expires in 14 days". **Simulate acceptance** opens a Single Session room.                                                                    |
| 23   | Pass    | Goal confirmed.                                                                                                                                                                                                   |
| 24   | Pass    | Session scheduled for tomorrow at 10:00. **Get calendar file** downloads the .ics. The session shows on Calendar while the room is active.                                                                        |
| 25   | Pass    | Note added, and action item "Draft two pricing options for ShelfShare" created.                                                                                                                                   |
| 26   | Pass    | ShelfShare's follow-up appears after **Simulate the session taking place**.                                                                                                                                       |
| 27   | Pass    | Both reviews released (ShelfShare 4.3/5). The progress bar ends at **Reviewed**, with status "Mentorship reviewed".                                                                                               |
| 28   | Pass    | **Suggest profile details** and **Apply suggestions** don't exist (D1). Filled Startup name, Description, Industry, Stage, Team size and tags by hand.                                                            |
| 29   | Pass    | Verification isn't a page; it's reached from Home → **Go to Verification** (D2). **Request verification** and **Simulate approval** work.                                                                         |
| 30   | Pass    | Sam is 3rd in Fairway's Suggested. The request form needs a format and three answers. "Request sent to Sam Ortega."                                                                                               |
| 31   | Partly  | The sidebar showed "Requests · 1 waiting for you" within about 4 seconds, with no reload. The email wasn't tested.                                                                                                |
| 32   | Pass    | The card shows Quick Ask · 10–15 min · Expires in 2 days, the problem, what they tried and the question, plus a plain line on what accepting means.                                                               |
| 33   | Pass    | Response delivered.                                                                                                                                                                                               |
| 34   | Pass    | Helper marked **Helpful** and left a review.                                                                                                                                                                      |
| 35   | Pass    | Both reviews visible. Room history shows Fairway as **Reviewed**.                                                                                                                                                 |
| 36   | Partly  | Mentees: "No active mentees. Your 2 finished mentorships are in Room history." Calendar no longer lists ShelfShare's session because the room is finished (D3). Impact: 2 sessions, 2 founders helped, 1.25 h.    |
| 37   | Pass    | **All** and **Unread** work, and **Mark all as read** leaves 0 unread.                                                                                                                                            |
| 38   | Pass    | Settings → Appearance → **Color theme** dropdown switches to Dark and back.                                                                                                                                       |
| 39   | Pass    | Signed out and back in: approval, settings and both reviewed rooms are kept.                                                                                                                                      |
| 40   | Pass    | No sideways scrolling at 390px, and Home reads well.                                                                                                                                                              |

## Findings log

### Product

| #   | Step | Severity | What I expected                                                                               | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---- | -------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 21   | Major    | An approved mentor who skipped "Short introduction (optional)" can still introduce themselves | **Send introduction** fails with "Complete your profile before sending or accepting an introduction." The toast doesn't say what's missing or link to Edit profile, and the button looks enabled. Mentor profiles need a bio, offer, expertise and target startups (`profileKeys` in `src/data/selectors.js`), but the application marks the bio optional. Either require it in step 7 or name the missing field in the error, with a link. Industries in step 8 is likewise optional, but it's the only thing that sets "Startups I want to help", so leaving it blank blocks introductions the same way. |
| F2  | 12   | Minor    | _Application under review_ after **Submit for approval**                                      | Lands on Home with a banner. The review page, and the **Simulate approval** shortcut, are one click away behind **View application**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F3  | 19   | Minor    | ShelfShare first, since it needs Pricing Strategy                                             | AccessLearn ties at 64% and is listed first, with "Needs help you offer: Onboarding guidance". Sam picked no onboarding tag. Check whether that reason is right.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F4  | 14   | Minor    | The pending application is easy to find                                                       | It's a collapsed "Sam Ortega · 0 hours waiting" row below an Account access list of about 35 accounts, most of them showcase profiles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| F5  | 16   | Minor    | Mentor wording                                                                                | After saving, the mentor sees "Your profile is live. Partners can now find you. See who fits what you need." That's founder wording; a mentor isn't looking for help.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Rundown and sample answers out of date

| #   | Where                    | Says                                                           | Actually                                                                                                                                                                                        |
| --- | ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rundown step 28          | **Suggest profile details**, **Apply suggestions**             | Neither exists. Fill the fields by hand, and pick **Pricing Strategy** under "What Fairway needs", or Fairway won't match Sam.                                                                  |
| D2  | Rundown step 29          | "open **Verification**"                                        | No such page. Home → **Go to Verification**, which is the Verification section of Profile. Fields: "Program, organization or person" and "How can a moderator check it?"                        |
| D3  | Rundown step 36, goal #7 | Mentees lists both founders; Calendar shows tomorrow's session | Finished rooms move to **Mentees → Room history**, and their sessions leave Calendar. Check Calendar right after step 24, and change goal #7 to "Room history lists both founders as Reviewed". |
| D4  | Sample answers, step 3   | "Response time"                                                | The field is labelled **Reply time**.                                                                                                                                                           |
| D5  | Sample answers, step 2   | "You can't type your own"                                      | You can't tick your own, but **Missing a topic?** lets you propose a tag for a moderator to approve.                                                                                            |
| D6  | Sample answers, Step 8   | "You should see _Application under review_"                    | You land on Home (see F2).                                                                                                                                                                      |
| D7  | Rundown step 18          | Turn Pause on, save, turn it off                               | **Pause new requests** pauses immediately; **Turn off Pause Mode** ends it. There's no separate save.                                                                                           |
| D8  | Rundown step 30          | "choose **Quick Ask**. Ask '…' and send it"                    | The request form also requires "What's the problem?" and "What have you already tried?". Add sample answers for both.                                                                           |

## Would a real mentor finish? 4 of 5

The flow holds together from sign-up to a second reviewed mentorship. Approval reaches the mentor live, the prototype shortcuts sit where you'd wait for a fictional startup, and capacity, Impact and sign-in persistence all behave. It loses a point for F1. A mentor who trusts the "(optional)" label gets approved, picks a startup, and hits an error that doesn't tell them what to fix.
