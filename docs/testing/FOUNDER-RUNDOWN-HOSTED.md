# Founder rundown script: hosted site

A start-to-finish pass through the hosted Synergy site (synergy-prototype.netlify.app) as a startup founder: create a real account, confirm your email, set up the startup, get verified, find help, complete a mentorship and a founder exchange, then come back later. It takes about 45 minutes.

This is the hosted version of [FOUNDER-RUNDOWN.md](FOUNDER-RUNDOWN.md). For the mentor side, see [MENTOR-RUNDOWN-HOSTED.md](MENTOR-RUNDOWN-HOSTED.md). The hosted site uses real accounts and real email, so this run also covers sign-up email and verification. The people you work with are fictional showcase profiles that respond on their own, so you can finish the run alone.

## Before you start

**Check the hosted setup first.** The full run needs these settings on the Render service. Without them you can only get through Act 2.

| Setting                         | Needed for                                                       | Value                                                                             |
| ------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `SYNERGY_SHOWCASE_PROFILES`     | Marcus Webb, Brightlane and the other sample profiles in Matches | `true`                                                                            |
| `SYNERGY_SIMULATE_VERIFICATION` | **Simulate approval** on your verification request               | `true` (already in `render.yaml`)                                                 |
| `SYNERGY_ADMIN_EMAILS`          | The verification request form                                    | At least one address. Without one, the Verification section shows no form at all. |
| Deployed branch                 | Both features above                                              | A commit that includes `ade13d6` (showcase profiles)                              |

Quick check: try signing in as `marcus-webb@showcase.test` with the password `synergy-demo`. If that fails, showcase profiles are off and Matches will be empty. On 24 November 2026 that sign-in failed: the Netlify frontend already had the new build, but `SYNERGY_SHOWCASE_PROFILES` was not on in Render.

**Plan around Render's free plan.**

- The API sleeps after about 15 minutes without traffic. The first page load after that can fail or hang for up to a minute. Reload once before you record it as a finding.
- Every restart or deploy wipes all accounts, rooms and uploads. Run the whole script in one sitting, don't leave the site idle for more than 10 minutes, and check that nobody deploys while you test.

**Other things to have ready**

- An email address you have not used on the site and whose inbox you can open. If your provider supports `+` aliases, `you+run3@example.com` gives you a fresh address each run.
- A small .txt or PDF file for proof uploads.
- The [Findings log](#findings-log), open the whole time. Record every spot where you hesitate, get confused or hit an error, including slow or missing email. The findings are the main output of the rundown.

**Your character:** you run _Shiftly_, a seed-stage startup with a pricing and churn problem.

## Act 1: Create an account and set up the startup (about 8 min)

1. Open https://synergy-prototype.netlify.app. On _Sign in to Synergy_, select **Create an account**.

2. On _Create your account_, fill First name, Last name, Email and a password of at least 8 characters. Set **I'm here as a** to **Startup founder** and select **Create account**.

3. On _Check your inbox_, note the time. Open the email and select its link. Record how long it took to arrive and whether it landed in spam. If nothing arrives after a few minutes, use **Send a new link** and record that as a finding.

4. Check that the workspace opens with a "Your email is verified" message. Unlike local preview mode, the hosted site skips _How do you want to start?_ and opens your workspace with an empty profile.

5. Go to **Profile**. Paste this under _Describe your startup in your own words_:

   > Shiftly is staff scheduling software for independent restaurants. We are a seed-stage team of 6 with 40 paying restaurants, but churn spikes after month two. We need help with pricing strategy and customer retention. We can offer intros to restaurant operators and product feedback.

6. Select **Suggest profile details**. Check that it suggests Startup name "Shiftly", Stage Seed, and needs of Pricing strategy and Customer retention.

7. Select **Apply suggestions**. Fill anything still unticked in _Finish your profile_, then select **Save profile**. The card should change to _Ready for Matches_.

8. Refresh the page and confirm the profile is still there.

## Act 2: Get verified (about 3 min)

9. Go to **Home**. It should now ask you to verify, with a **Go to Verification** button. Note whether it is clear why.

10. In **Verification**, fill **Program, organization or person** (for example "Rundown test cohort") and **How can a moderator check it?** (for example "Test run, no real evidence"). Select **Request verification**.

11. Check that the status shows **Pending review** with a decision date. Then select **Simulate approval** in the dashed _Prototype only_ box.

12. Check that the status changes to **Verified** and that the badge shows on your profile.

## Act 3: Find help (about 5 min)

13. Go to **Home** again and read what it tells you to do next. Note whether that is clear.

14. Open **Matches** and compare **Suggested** with **Browse all**. You should see pricing and retention mentors such as Marcus Webb and Hana Sato. Both tabs sort by **Highest fit**. **Sort by** offers only Highest fit and Completed collaborations.

15. Open a mentor, then open **Why this match** and **See the factor breakdown**. Ask yourself whether you would trust the score.

16. Try a search, a filter and **Clear filters**. **Save for later** one profile.

17. If Matches offers **Get notified when someone offers…**, turn it on.

## Act 4: Get mentorship (about 10 min)

18. Open **Marcus Webb** (pricing) and choose **Single Session**, or the closest format he offers. Fill in the request:
    - Problem: "Restaurants churn after month two on our per-location plan."
    - What we tried: "We interviewed eight churned customers and added an annual discount."
    - Question: "Should we move to per-seat pricing or add a lower tier?"

19. Select **Send mentorship request**. Read the pending card, then select **Simulate acceptance** in the dashed _Prototype only_ box. If you get a "Verify to send introductions" message instead, record it as **Blocked at step 19** and go back to step 11.

20. Check your inbox and record whether an acceptance email arrived and whether its link opens the room.

21. In the Mentorship room, add a note in **Session prep** and select **Share preparation**.

22. Select **Simulate mentor confirming the goal**. Open **Schedule**, pick tomorrow at 10:00, save it, then select **Get calendar file** and **Download .ics**.

23. Add one action item, for example "Draft per-seat pricing page".

24. Select **Simulate the session taking place**. Fill in **Founder follow-up**, marking the action item Done or In progress, and select **Submit follow-up**.

25. Select **Write review**, then **Submit private review**. Check that both reviews are released and the room shows **Reviewed**.

## Act 5: Trade with another startup (about 12 min)

Brightlane is a fictional collaborator. The Deal Room says so at the top and has Brightlane respond on its own after each of your actions, so you won't see a button to make it accept.

26. In **Matches → Browse all**, search for **Brightlane** (or Fairtab). Choose **Beta Testing Exchange** and select **Send introduction**.

27. In **Introductions**, check that it is pending, then select **Simulate acceptance**. Open the Deal Room and check the _Prototype only_ note under the title.

28. In **Terms**, fill Shared goal, Scope and deliverables, Timeline, Commitment and Exchange. Select **Save draft**, then **Accept these terms**. Check that Brightlane accepts on its own and the room moves on to milestones.

29. In the **Task board**, add two tasks with an owner, priority and due date. Move one to **Done**.

30. Under **Milestones**, work through all five: Scope defined, Testers assigned, Testing round, Feedback submitted and Issues reviewed. Use **Attach proof** where it is required (upload your .txt or PDF at least once) and select **Mark as done**. Check that Brightlane confirms each one without you doing anything else.

31. When the last milestone is confirmed by both of you, the room should switch to **Launched** on its own. Submit your private review and check that Brightlane's review follows and the room reaches **Reviewed**.

32. Send one chat message in the room.

## Act 6: Daily use and coming back (about 5 min)

Do this act straight after Act 5. A server restart wipes your account, so a long pause here tests Render, not Synergy.

33. Open **Updates**, switch between **All** and **Unread**, open one update, then select **Mark all as read**.

34. In **Settings**, switch to Dark appearance and back, and check that your match alert is listed.

35. Sign out. Then sign back in with the same email and password and check that your profile, your Verified badge, both rooms and both reviews are still there. You should not have to confirm your email again.

36. Resize the window to phone width (about 390px) and repeat one task, such as opening a room from Home.

## Goal: when the rundown counts as done

The rundown is done when all ten of these are true. Tick each one as you confirm it.

| #   | Done when…                                                                                                                        | Done |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | You created the account with your own email and opened the workspace through the emailed link                                     | [ ]  |
| 2   | Your profile was built from your own description and shows _Ready for Matches_                                                    | [ ]  |
| 3   | Your profile shows **Verified**                                                                                                   | [ ]  |
| 4   | Suggested showed at least one mentor who covers a need you stated, and you opened **Why this match**                              | [ ]  |
| 5   | One **Mentorship room** shows **Reviewed**, and both reviews are visible                                                          | [ ]  |
| 6   | One **Deal Room** shows **Reviewed**, with all 5 milestones confirmed by both sides and at least one proof file attached          | [ ]  |
| 7   | You downloaded a calendar file for a scheduled session                                                                            | [ ]  |
| 8   | **Updates** shows 0 unread                                                                                                        | [ ]  |
| 9   | After signing out and back in, items 2–8 are still true                                                                           | [ ]  |
| 10  | The findings log lists every friction point with its step number, and the run has a 1–5 "would a real founder finish this?" score | [ ]  |

If you can't finish a step, record it as **Blocked at step N** with a screenshot and keep going where you can. A rundown with honest blocked steps still counts. Skipping a step quietly doesn't. If the server restarts mid-run and wipes your account, record the step where it happened and start again from Act 1 with a new email.

## Run details

| Field                          | Value |
| ------------------------------ | ----- |
| Date                           |       |
| Tester                         |       |
| Deployed commit (Render)       |       |
| Showcase sign-in check passed? |       |
| Browser and size               |       |
| Email provider of test inbox   |       |
| Sign-up email arrived after    |       |
| Server woke from sleep? (y/n)  |       |
| Total time                     |       |
| Founder score 1–5              |       |

## Step results

Status is **Pass**, **Fail**, **Blocked** or **Not run**.

| Step  | Status  | Notes |
| ----- | ------- | ----- |
| 1–8   | Not run |       |
| 9–12  | Not run |       |
| 13–17 | Not run |       |
| 18–25 | Not run |       |
| 26–32 | Not run |       |
| 33–36 | Not run |       |

## Findings log

One row per friction point, error or confusing moment. Severity is **Blocker** (couldn't continue), **Major** (got through but a real founder might quit) or **Minor** (wording, polish). Mark hosting problems, such as a cold start or a wiped account, as **Hosting** in the Step column's notes so they aren't counted against the product.

| #   | Step | Severity | What I expected | What happened | Screenshot |
| --- | ---- | -------- | --------------- | ------------- | ---------- |
| 1   |      |          |                 |               |            |

## After the demo

Simulated approval lets anyone verify themselves. When the demo period ends, set `SYNERGY_SIMULATE_VERIFICATION` to `false` in Render, or remove the TEMPORARY blocks it guards.
