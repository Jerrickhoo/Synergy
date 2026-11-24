# Prototype evaluation readiness plan

Source: the readiness review of 23 Nov 2026 (fresh database, founder and mentor preview accounts, full unit and browser suites). Unit tests (268) and the build pass. The browser suite passed 204 of 205; the one WebKit timeout in `mentor-requests.spec.js:150` passed on a rerun.

The founder side can be evaluated now. The mentor side cannot: a mentor tester starts with nothing to act on and, once they find a way into a room, stops at Session Held. Phase 1 fixes that. Phases 2 and 3 remove friction and polish that testers would otherwise comment on.

Sizes: S = under an hour, M = a few hours, L = most of a day.

## Delivery status (24 Nov 2026)

All four phases are implemented, with the recommended defaults for the open decisions below. The preview mentor is **Alex Navarro**, agreeing terms completes the first milestone, the founder sidebar says **Rooms**, and review ratings use the custom dropdown. Where the delivery differs from the plan:

- **P7:** opening a room in the browser and sending a background "mark read" call blocked the user's own clicks while it was pending. Instead, the server reads a room's informational notices when the user acts with that room open. The client sends `roomOpen` with each action.
- **Found while verifying, and fixed:**
  - The mentor's **Startups** nav item was announced as "Matches"; it and the page title now say Startups.
  - "Arrange a session" was the founder's turn only, although either side can book (and a fictional founder never would).
  - "Desired outcome" repeated the confirmed goal.
  - Impact showed a "Not enough data yet" tile per rate; it now shows one line.
  - Upcoming stage dots were near-invisible.
  - Panel buttons shared names with the form buttons they lead to; they are now named for where they go ("Go to goal", "Go to schedule" and so on).
- **Tests:**
  - New unit tests are in `tests/mentor-preview.test.js` and `tests/readiness-founder.test.js`.
  - The new browser spec, "a mentor preview takes the sample request to Reviewed", is in `tests/prototype.spec.js`.
  - Existing tests were updated for the renamed labels, the custom dropdowns (`selectValue`) and the first milestone confirmed with the terms.

## Phase 1: Make the mentor side testable on its own

### M1. Let the mentor simulate the session with a fictional founder (M)

Today the room stops at Session Held with "Nothing needed from you". `SimulateSessionHeld` returns nothing unless `room.role === "founder"` ([MentorshipRoom.jsx:110](../../src/components/MentorshipRoom.jsx)), and the server enforces `requireRole("founder")` ([mentorship-rooms.js:527](../../server/mentorship-rooms.js)). A Single Session also cannot finish unless the founder submits a follow-up (`finalize`, mentorship-rooms.js:312), which a fictional founder never does.

- **Server, `simulate-session-held`:** accept either role, still gated by `canSimulatePartner` and `single-session`. When the caller is the mentor, also record a short follow-up from the fictional founder (`submittedAt`, a sample outcome) and set the follow-up milestone. The room then waits only on reviews.
- **Server, `review-form`:** mirror the existing founder branch (mentorship-rooms.js:1073). When a mentor reviews a fictional founder, add a simulated founder review using `reviewCategories({ ...room, role: "founder" })`. The room then reaches Reviewed.
- **Client:** drop the role check in `SimulateSessionHeld`. Word the note for the viewer, for example "AccessLearn is a fictional founder. Simulate the session taking place to try reviews."
- **Goal for mentor-started rooms:** a room the mentor opens by outreach shows "Agree on a focus in chat" as the proposed goal. When the room is created in `workspace.js` (around line 2100) with no request, use the startup's stated goal (`profiles.founder.goals`, for example "Validate accessible onboarding").
- **Tests:** extend `tests/prototype-session.test.js` with a mentor-side case (a held session, a simulated follow-up and reviews, ending in `reviewed`). Add a refusal case for a real founder partner.

### M2. Give a new mentor preview one incoming request (M)

A mentor tester's Requests, Mentees and Impact pages are all empty. The only route in (Home, then Browse startups, then send an introduction and simulate acceptance) is not signposted anywhere.

- Add `seedSampleRequest(mentorAccount)` to [mentor-requests.js](../../server/mentor-requests.js). It builds the same request shape as `send-request` (problem, what was tried, question, Single Session, `sentAt`, `expiresAt`) from one sample founder whose needs match the preview mentor's offers (AccessLearn: onboarding). It calls the existing `setPending` and the "sent a mentorship request" event.
- Call it from `openDemo` ([workspace.js](../../server/workspace.js), after `seedPreview`) for new mentor previews only. Accounts that already exist are left as they are.
- Check that accepting it works: `pairIssue`, capacity and guideline-grace checks must allow a fixture founder.
- **Tests:** a unit test that a new mentor preview has exactly one pending request, and that accepting it opens a room carrying the request's problem, what was tried and the question.

### M3. Give the preview mentor its own identity (S)

The preview mentor is named "David Park" with David's avatar (`seedPreview`, workspace.js:1593). That is the same name as the fictional mentor in the founder walkthrough, so a tester who tries both roles meets two different David Parks.

- Choose a name that no directory profile uses, and use initials instead of `/demo/avatars/david.svg`.
- Rename existing preview mentors still called "David Park" only where `account.demo && !account.demoSample`.
- Update the three tests that mention it: `tests/app.spec.js`, `tests/fixtures.js` and `tests/founder-third-run.test.js`.

### M4. Add Startups to the mentor sidebar (S)

`mentorNavigation` ([Sidebar.jsx:15](../../src/components/Sidebar.jsx)) has no entry for the match feed. Once a mentor reaches it through "Browse startups", no sidebar item is highlighted and there is no way back.

- Add `["discover", "Startups", "search"]` after Requests, and update the comment above the list.
- Keep "Browse startups" on Requests as a secondary button.
- Update any navigation assertions in the browser tests.

### M5. Show a mentor's match details from the mentor's side (M)

For a mentor viewing a startup, the card says "Strong needs and offers fit / Needs guidance with: Product strategy, Onboarding guidance". The details page says "They need: Nothing matched yet" and "They get: Mentorship". The cause is that [MatchDetailPage.jsx:527](../../src/pages/MatchDetailPage.jsx) labels `offeredToYou(person)` (what the mentor receives, which is empty) as "They need". The card falls back to `person.need` instead ([MatchCard.jsx:49](../../src/components/MatchCard.jsx)).

- Add one helper, `exchangeRows(person, role)`, in [profile-presentation.js](../../src/data/profile-presentation.js), and use it in `MatchCard`, `MatchDetailPage` and `Introductions`. When the viewer is a mentor, show one row, "They need help with", listing the startup's needs that the mentor offers (or its first two needs if none match). Drop "They get: Mentorship".
- Add a mentor branch to `fitSummary`, for example "They need help you offer: Product strategy and Onboarding guidance." Today it says "Your needs and their offers overlap".
- Make the side panel copy role-aware. For a mentor, the panel should say a mentorship room opens where the goal is confirmed and a session scheduled, not a Deal Room with terms. Change the note placeholder to "Which of their needs can you help with?" Hide the single-option "Collaboration type: Mentorship" dropdown.
- **Tests:** a unit test for `exchangeRows` with a mentor viewer, and a browser assertion that the mentor's details page agrees with its card.

### M6. Add a mentor walkthrough to the README (S)

Add a "Five-minute mentor walkthrough": sign in as Mentor, open the seeded request, accept it, confirm the goal, schedule, simulate the session, then write a review and reach Reviewed.

## Phase 2: Remove friction in the founder flow

### F1. Make the next-step control take you to the step (M)

Clicking "Share your follow-up" switches to Overview but leaves the form below the fold. After the follow-up is submitted, "Write review" appears at the top while the tester is still at the bottom.

- In [mentor-room.js](../../src/data/mentor-room.js), give each next step a target section ID as well as its tab. When the step is clicked, switch tab, scroll the section into view and focus its first field. Use an instant scroll under `prefers-reduced-motion`.
- After `submit-followup`, show the toast "Follow-up shared. Write your private review next." and scroll to the next-step line.
- Show the next-step line one way in every state: text plus a small button when it's the viewer's turn, and plain text otherwise. Today it swaps between a bold text button and an outlined button that has no gap from the text.

### F2. Write the founder's own room in the second person (S)

[MentorshipRoom.jsx:1050](../../src/components/MentorshipRoom.jsx) shows "What they already tried" and "Founder's question" to the founder who wrote them.

- Founders see "What you already tried" and "Your question"; mentors keep the current labels.
- Hide "Confirmed goal" when it matches the question word for word, and label the single row "Goal (confirmed)".

### F3. Add examples to blank exchange terms (S)

The five main terms fields (shared goal, scope, timeline, commitment, exchange) have no examples in any template.

- Add `termPlaceholders` per template in [engagement-templates.json](../../src/data/engagement-templates.json), for example "Set launch pricing using each other's experience", and render them in `TermsPanel`.
- Change the Working sessions placeholder from "2" to "For example: 2" so it doesn't look like a value.
- Stored moderator templates keep working: fall back to the defaults when the field is missing.

### F4. Stop "Trade agreed" appearing as the next task after terms are agreed (S/M)

Once both sides agree the terms, the room says "Next: Trade agreed. Mark it done when the work is finished."

- **Recommended:** add `completedByTerms: true` to milestones that mean the same as agreeing terms (Skill Swap "Trade agreed", Beta Testing "Scope defined"). Confirm them for both sides when terms lock.
- **Alternative:** rename them to a real first step. Existing rooms are unaffected either way.
- Check tests that count confirmed milestones.

### F5. Make the two room types look like one product (L)

Deal rooms have a dot tracker, a "Your turn" panel, and "All Deal Rooms" and "More" buttons. Mentorship rooms have a check-circle tracker, a single status line and "All rooms".

- Extract a shared `RoomHeader` (title, partner, tracker, next-step panel, back button) and use it in both rooms. Tab content is out of scope.
- The founder sidebar says "Deal Rooms" but also holds mentorship rooms. **Decision:** rename it to "Rooms", or keep it.

### F6. Match "user acquisition" to Distribution (S)

The `Distribution` alias in [collaboration.js:103](../../src/data/collaboration.js) doesn't cover the common wording.

- Add `user acquisition|customer acquisition|acquire (users|customers)|traction`.
- Add a unit test that the profile assistant suggests Distribution for "We need help with user acquisition".

### F7. Confirm every action the user takes (S)

No confirmation appeared after "Share preparation" or "Send introduction" (the mentorship request does get one). Add toasts, or confirm they exist and simply weren't visible, for: share preparation, send introduction, submit follow-up and confirm goal.

## Phase 3: UI polish against the UI rules

### P1. Spacing between cards (S)

`.page` ([styles.css:751](../../src/styles.css)) has no spacing between its children, so some sections touch: on Introductions, `SentMentorRequests` sits against `Introductions`; on your profile, "Your profile is live" sits against the identity panel. Add `.page > * + * { margin-top: var(--space-5) }`, or a flex column with a gap. Then compare screenshots of every page for doubled margins. In Session prep, group the file picker and upload button as one field so "Upload file" no longer touches "Deck".

### P2. One kind of control (M)

- **Dropdowns:** use `SelectField` instead of the 17 native selects, in MentorRequestForm (1), MentorshipRoom (5), RatingScale (1), OfficeHours (3), Payments (1), RequestsPage (1), OnboardingPage (2), MentorAdminSettings (1) and ModerationPage (2). Keep the native `required` validation (an existing browser test covers it for profile selects).
- **File upload:** add a `FilePicker` (a hidden input with a button and the chosen file name, like ProfilePhoto's "Upload photo"). Use it for session prep and milestone evidence.
- **Labels:** "Duration", "Private feedback (optional)", "Testimonial (optional)", "Prep file" and "Next format" sit outside `.field`, so they render dark and regular instead of bold. Wrap them, and write optional fields one way throughout.
- Date and time inputs stay native.

### P3. One primary action per view (S)

- **Notification rows:** use `btn small` instead of `btn primary small` ([NotificationRow.jsx:98](../../src/components/NotificationRow.jsx)).
- **Profile:** make "Edit profile" secondary while "Your profile is live" is showing.
- **Home:** remove the generic "Find your next collaborator" panel. "See all matches" in the strongest-matches card becomes the main action.

### P4. Remove repeated information (S)

- **Match details:**
  - Drop the "Match details" heading above the card, since the breadcrumb already says it.
  - Drop the score pill in the header, since "Why this match" shows it.
- **Match cards:** skip the "Offers what you need: X" line when the "You get" chips list the same tags.
- **Profile:** show industry, stage and team size once, either in the header or in "Startup at a glance".
- **Request form:** make "Who sees this request?" the only privacy line and drop the sentence above it.

### P5. Use the same arrows everywhere (S)

The profile assistant showed "Empty → …". The assistant was removed from Edit profile on November 24, 2026, so this item no longer applies.

### P6. Colour the request quality by score (S)

[MentorRequestForm.jsx:252](../../src/components/MentorRequestForm.jsx) shows 80/100 in an amber warning box. Use amber only below a threshold (for example 60) and a neutral style otherwise.

### P7. Clear stale unread notices (S/M)

"Request accepted" stayed unread after the tester had opened the room. When a room opens, mark its informational notices as read (accepted, goal confirmed, session held), using the existing `read-notifications` handler in [features.js:1680](../../server/features.js) with a room ID. Leave notices that need action unread.

### P8. Empty and decorative states (S)

- **Home:** replace the eight identical placeholder avatars with the matches' real avatars, or remove the strip. Hide count tiles that read 0, or replace them with one line of text.
- **Impact:** with no history, show one specific empty state ("Your impact appears after your first held session") instead of ten "Not enough data yet" tiles.

### P9. Consistent request and introduction rows (S)

On Introductions, a mentorship request is stacked with an outlined Withdraw button, while an introduction is laid out horizontally with a text-link Withdraw. Use the `introduction-row` layout and one Withdraw style for both.

### P10. Readable time zone (S)

Under Schedule, show "Philippine time (GMT+8)" from `Intl.DateTimeFormat(..., { timeZoneName: "long" })` instead of "Asia/Manila".

## Phase 4: Checks not covered by the review

- Phone-width pass (375 px) on Home, Matches, match details, both rooms and Requests.
- Dark-mode pass on the same pages, including contrast of muted text and the dashed "Prototype only" boxes.

## Order and verification

1. Phase 1 (M1–M6) in one change. This is the only work that must happen before a mentor evaluation.
2. F1, F2, F3, F4, F6 and F7, then F5 on its own, since it touches the most UI.
3. Phase 3 in one sweep, then Phase 4.

After each phase:

- Run `npm run test:unit`, `npm run test:e2e` and `npm run check:format`.
- Add a browser spec, "a mentor preview reaches Reviewed with the seeded request", next to the founder one in `tests/prototype.spec.js`.
- Repeat both five-minute walkthroughs on a new data file (`SYNERGY_DATA_FILE`) and update the README.

## Open decisions (recommended defaults in brackets)

- New name for the preview mentor [a name not used in the directory, shown as initials].
- F4: whether agreeing terms completes the first milestone, or the milestone is renamed [complete it].
- F5: rename "Deal Rooms" to "Rooms" in the founder sidebar [rename].
- Rating control on the review form: custom dropdown, or 1–5 buttons [custom dropdown, so dropdowns are consistent].
