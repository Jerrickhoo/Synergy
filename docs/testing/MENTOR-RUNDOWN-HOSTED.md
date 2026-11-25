# Mentor rundown script: hosted site

A start-to-finish pass through the hosted Synergy site (synergy-prototype.netlify.app) as a mentor: create a real account, apply to mentor, get approved, set your limits, help one startup you reach out to and one founder who asks you, then come back later. It takes about 50 minutes, plus 10 for the optional rejection check in Act 8.

This is the mentor companion to [FOUNDER-RUNDOWN-HOSTED.md](FOUNDER-RUNDOWN-HOSTED.md). Unlike the founder run, it needs a second account. A moderator has to approve every mentor application, and the server won't let anyone approve their own. Act 3 has a simulated approval shortcut, but use the helper as the moderator when you can, because that tests the real flow. The second account also plays a real founder in Act 6, so you see a request arrive in your inbox.

## Before you start

**Check the hosted setup first.**

| Setting                         | Needed for                                                                                  | Value                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| `SYNERGY_ADMIN_EMAILS`          | Approving your mentor application (Act 3)                                                   | Must include the **helper** email below |
| `SYNERGY_SHOWCASE_PROFILES`     | ShelfShare and the other sample startups under **Startups**                                 | `true`                                  |
| `SYNERGY_SIMULATE_VERIFICATION` | The helper founder verifying themselves in Act 6, and the mentor approval shortcut in Act 3 | `true` (already in `render.yaml`)       |
| Deployed branch                 | Showcase profiles and simulated verification                                                | A commit that includes `ade13d6`        |

Changing an environment variable in Render restarts the service, and on the free plan a restart wipes every account. Set all of these before anyone signs up, not halfway through.

Quick check: try signing in as `marcus-webb@showcase.test` with the password `synergy-demo`. If that fails, showcase profiles are off and the Startups list will be empty.

**Plan around Render's free plan.**

- The API sleeps after about 15 minutes without traffic. The first page load after that can fail or hang for up to a minute. Reload once before you record it as a finding.
- Every restart or deploy wipes all accounts, rooms and uploads. Run the whole script in one sitting and don't leave both windows idle for more than 10 minutes.

**Two accounts, two windows**

| Account    | Email                                         | Plays                                      | Window                              |
| ---------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| **Mentor** | Unused address whose inbox you can open       | You, the mentor being tested               | Your normal browser window          |
| **Helper** | Another unused address, listed as a moderator | The moderator in Act 3, a founder in Act 6 | A private window or another browser |

If your email provider supports `+` aliases, `you+mentor3@example.com` and `you+helper3@example.com` give you fresh addresses for each run.

Keep the [Findings log](#findings-log) open the whole time. Record every spot where you hesitate, get confused or hit an error, including slow or missing email. Only record findings for the **Mentor** account. The helper is scaffolding.

**Your character:** you are _Sam Ortega_, a former head of growth at a subscription software company. You mentor early-stage founders on pricing and retention.

## Act 1: Create an account (about 5 min)

1. In the **Mentor** window, open https://synergy-prototype.netlify.app. On _Sign in to Synergy_, select **Create an account**.

2. On _Create your account_, fill First name "Sam", Last name "Ortega", your mentor email and a password of at least 8 characters. Set **I'm here as a** to **Mentor** and select **Create account**.

3. On _Check your inbox_, note the time. Open the email and select its link. Record how long it took to arrive and whether it landed in spam.

4. Check that the workspace opens with a "Your email is verified" message and that you are pointed at the mentor application. If you land on Home instead, note what it tells you to do and follow it.

## Act 2: Apply to mentor (about 8 min)

The application has eight steps. Select **Save and continue** after each one. Before you continue, try **Continue later** once, then reopen the application from Home, and check that your progress was kept.

5. **Verification:** choose **Endorsing organization** and enter "Rundown test cohort, checked by the test moderator".

6. **Expertise:** choose **Pricing Strategy**, **Distribution**, **Mentorship** and **Fundraising**. The list has no retention tag. Pricing Strategy is the one ShelfShare and the Fairway founder in Act 6 need, so without it neither matches you.

7. **Capacity and time zone:** set 3 mentees, 6 hours a month and a 2-day response time. Check that your time zone is right.

8. **Formats:** keep at least **Quick Ask** and **Single Session**. Both are needed later.

9. **Conflicts of interest:** choose **I have no conflicts**.

10. **Mentor guidelines:** open at least two sections, then tick **I accept the mentor guidelines**.

11. **Experience:** add a one-line experience summary, for example "Ran pricing and retention for a 40-person subscription software company", and a **Short introduction**, which is required, for example "I help early-stage founders price their product and keep the customers they win." **Preferences:** fill both fields, including **Industries**, which becomes _Startups I want to help_ on your profile. Then select **Submit for approval**.

12. Check that you land on _Application under review_, which says how long approval usually takes. Select **Go to Home** and check that Home shows the same banner with **View application**. Open **Startups** and note what you can and can't do while you wait.

## Act 3: Get approved (about 5 min)

**Shortcut:** if the helper can't moderate, for example because its email isn't in `SYNERGY_ADMIN_EMAILS`, select **Simulate approval** on _Application under review_ in the **Mentor** window (from Home, select **View application** to get there) in the dashed _Prototype only_ box. Then skip to step 15, and record in the findings log that you used the shortcut. You still need the helper account for Act 6.

13. In the **Helper** window, create an account with the helper email, set **I'm here as a** to **Startup founder** and confirm the email.

14. Select **Moderation** in the sidebar. Under **Mentor approvals (1 waiting)**, below Tag proposals, expand the "Sam Ortega" row and check that the application shows what you entered in Act 2. Select **Approve mentor**.

15. Back in the **Mentor** window, check that an Update says your mentor profile is approved and that your profile shows a Verified badge. Note whether you had to reload to see it.

16. Open **Profile** and fill anything the profile card still lists as missing, then select **Save profile**.

## Act 4: Set your limits (about 3 min)

17. Open **Settings → Mentoring**. Check that the guidelines show as accepted and that capacity reads something like "You're using 0 of 3 session slots and 0 of 6 hours this month".

18. Under **Pause Mode**, pick a **Resume on** date next week and select **Pause new requests**. It takes effect straight away, with no separate save. Check the confirmation, then select **Turn off Pause Mode**. Leave it off for the rest of the run.

## Act 5: Offer help to a startup (about 12 min)

ShelfShare is a fictional showcase startup that needs pricing and retention help. It responds on its own, and the room offers _Prototype only_ buttons where you would otherwise wait for it.

19. Open **Startups** and compare **Suggested** with **Browse all**. ShelfShare should rank near the top of Suggested. Open it, then open **Why this match** and **See the factor breakdown**. Ask yourself whether the score makes sense from a mentor's side.

20. Try a search, a filter and **Clear filters**. **Save for later** one other startup.

21. On ShelfShare, select **Send introduction**. Check that the card explains what happens if they accept.

22. In **Requests**, under **Your requests**, find the introduction you sent, check that it is waiting for their reply, then select **Simulate acceptance** in the dashed _Prototype only_ box. Open the Mentorship room.

23. Confirm the goal, for example "Choose between per-seat pricing and a lower tier before the next renewal cycle", with **Confirm goal**.

24. Open **Schedule**, pick tomorrow at 10:00 and select **Schedule session**, then select **Get calendar file** to download the .ics. Open **Calendar** and check that tomorrow's session is there. Do it now: once the room is reviewed, its session leaves Calendar. Go back to the room through **Mentees → Open room**.

25. Add a note under **Shared notes** and one action item, for example "Draft two pricing options for ShelfShare".

26. Select **Simulate the session taking place**. Check that ShelfShare's follow-up appears.

27. Select **Write review** and submit your private review. Check that both reviews are released and the room shows **Reviewed**.

## Act 6: Answer a real founder's request (about 12 min)

28. In the **Helper** window, open your profile and select **Edit profile**. Fill Startup name "Fairway", Description "Fairway is a seed-stage golf booking app. We need help with pricing strategy.", any Industry, Stage **Seed** and Team size 4. Under _What Fairway needs_, choose **Pricing Strategy**, or Fairway won't match Sam. Under _What Fairway can offer_, choose any tag. Select **Save profile**.

29. Still as the helper, go to Home and select **Go to Verification**. Fill **Program, organization or person** and **How can a moderator check it?** with any test details, select **Request verification**, then **Simulate approval**.

30. As the helper, open **Matches** and find **Sam Ortega** under Suggested, or search for Sam under **Browse all**. Open the match. In **Request mentorship**, set **Which format do you prefer?** to **Quick Ask** and fill:
    - **What's the problem?** "We don't know how to price bookings for golf courses."
    - **What have you already tried?** "We charged a flat 5% fee for two months."
    - **What specific question do you want answered?** "Should a golf booking app charge per booking or a monthly fee?"

    Then select **Send mentorship request**.

31. In the **Mentor** window, check that **Requests** shows a count without reloading. Check your mentor inbox and record whether a request email arrived and whether its link opens the request.

32. Open the request and read it. Check that it shows the format, the question and when it expires. Select **Accept**.

33. In the room, write an answer under **Write your response** and select **Deliver response**.

34. In the **Helper** window, open the room, select **Helpful** and leave a review.

35. In the **Mentor** window, leave your review and check that the room shows **Reviewed**.

## Act 7: Daily use and coming back (about 5 min)

Do this act straight after Act 6. A server restart wipes your accounts, so a long pause here tests Render, not Synergy.

36. Open **Mentees**. With both mentorships finished, it says "No active mentees". Select **Room history** and check that ShelfShare and Fairway are both listed as **Reviewed**. Open **Impact** and note whether it reflects the two completed mentorships.

37. Open **Updates**, switch between **All** and **Unread**, open one update, then select **Mark all as read**.

38. In **Settings**, under **Appearance**, set **Color theme** to Dark, then back to Light.

39. Sign out. Then sign back in with the same email and password and check that your approval, your settings, both rooms and both reviews are still there.

40. Resize the window to phone width (about 390px) and repeat one task, such as opening a request or a room from Home.

## Act 8: A rejected application (optional, about 10 min)

This checks what a mentor sees when a moderator says no. It needs a third address, because Sam is already approved. Use the helper as the moderator, and record findings for the new mentor.

41. In a third window, create an account as **Mentor** with a fresh email, for example `you+reject3@example.com`, and submit the application with the [sample answers](MENTOR-SAMPLE-ANSWERS.md).

42. In the **Helper** window, open **Moderation**, expand the new applicant under **Mentor approvals**, enter a reason such as "The endorsement could not be checked" and select **Reject application**.

43. In the new mentor's window, check that the page reads _Mentor application needs changes_ and shows the reason. Select **Edit and resubmit**, check that it reopens at step 1 with your answers kept, then save each step and submit again.

44. As the helper, reject it a second time with a reason.

45. As the new mentor, check that the page reads _Mentor application not approved_, shows the reason, and says the application can't be resubmitted. Select **Switch profiles in Settings** and check that it opens the **Profiles** section. Check that Home shows the same message.

## Goal: when the rundown counts as done

The rundown is done when items 1–10 are true, and item 11 too if you ran Act 8. Tick each one as you confirm it.

| #   | Done when…                                                                                                                         | Done |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | You created the mentor account with your own email and opened the workspace through the emailed link                               | [ ]  |
| 2   | Your mentor application was submitted, approved by the helper moderator, and your profile shows **Verified**                       | [ ]  |
| 3   | **Settings → Mentoring** shows your capacity, and Pause new requests was turned on and off                                         | [ ]  |
| 4   | Suggested showed ShelfShare or another startup that needs one of your tags, and you opened **Why this match**                      | [ ]  |
| 5   | The ShelfShare Mentorship room shows **Reviewed**, with both reviews visible and a calendar file downloaded                        | [ ]  |
| 6   | You accepted a real request in **Requests**, delivered a Quick Ask answer, and that room shows **Reviewed**                        | [ ]  |
| 7   | **Mentees → Room history** lists both founders as **Reviewed**                                                                     | [ ]  |
| 8   | **Updates** shows 0 unread                                                                                                         | [ ]  |
| 9   | After signing out and back in, items 2–8 are still true                                                                            | [ ]  |
| 10  | The findings log lists every friction point with its step number, and the run has a 1–5 "would a real mentor finish this?" score   | [ ]  |
| 11  | Optional, if you ran Act 8: the second rejection shows _Mentor application not approved_ and **Switch profiles in Settings** works | [ ]  |

If you can't finish a step, record it as **Blocked at step N** with a screenshot and keep going where you can. A rundown with honest blocked steps still counts. Skipping a step quietly doesn't. If the server restarts mid-run and wipes your accounts, record the step where it happened and start again from Act 1 with new emails.

## Run details

| Field                          | Value |
| ------------------------------ | ----- |
| Date                           |       |
| Tester                         |       |
| Deployed commit (Render)       |       |
| Showcase sign-in check passed? |       |
| Helper email in admin list?    |       |
| Browser and size               |       |
| Email provider of test inbox   |       |
| Sign-up email arrived after    |       |
| Request email arrived after    |       |
| Server woke from sleep? (y/n)  |       |
| Total time                     |       |
| Mentor score 1–5               |       |

## Step results

Status is **Pass**, **Fail**, **Blocked** or **Not run**.

| Step  | Status  | Notes |
| ----- | ------- | ----- |
| 1–4   | Not run |       |
| 5–12  | Not run |       |
| 13–16 | Not run |       |
| 17–18 | Not run |       |
| 19–27 | Not run |       |
| 28–35 | Not run |       |
| 36–40 | Not run |       |
| 41–45 | Not run |       |

## Findings log

One row per friction point, error or confusing moment for the mentor. Severity is **Blocker** (couldn't continue), **Major** (got through but a real mentor might quit) or **Minor** (wording, polish). Mark hosting problems, such as a cold start or a wiped account, as **Hosting** in the notes so they aren't counted against the product.

| #   | Step | Severity | What I expected | What happened | Screenshot |
| --- | ---- | -------- | --------------- | ------------- | ---------- |
| 1   |      |          |                 |               |            |

## After the run

Take the helper email out of `SYNERGY_ADMIN_EMAILS` once testing ends, so a leftover test address can't moderate. When the demo period ends, also set `SYNERGY_SIMULATE_VERIFICATION` to `false`.
