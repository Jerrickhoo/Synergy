# Mentor-side roadmap

Status, 9 November 2026: Phase 0 delivered. Phases 1 to 8 planned.

This roadmap brings the mentor side in line with the [current product spec](SYNERGY-SPEC.md). Each phase can be shipped and tested on its own.

## Context

The updated Synergy spec (Nov 9, 2026) treats mentors as a separate product: structured requests, enforced capacity, five engagement formats, a lighter Mentorship Room, an Impact Profile, and stricter onboarding. Today the mentor side is mostly the founder flow with different labels:

- **No mentor request object.** A request is the generic introduction (`introductionMetaByRole = {sentAt, note, name}`). The only mentor-specific branch is `HomePage.jsx:18` → `MentorHome`.
- **Two formats, not five.** "Format" is `one-off | ongoing` (`engagement-templates.json` mentorship v3). Rooms use the generic Deal Room stage line (`RoomDetailPage.jsx:99-115`).
- **Missing entirely:** capacity, Pause Mode, refer, office hours, impact stats, badges, conflict of interest (COI) and the guidelines agreement.

**Decisions already made:**

- Extend the existing room, mirroring, blind-review and 8-week cycle machinery. No new room model.
- Build on the current uncommitted working tree (`MentorshipCycle.jsx`, cycle logic in `features.js`, `founder-*` tests).
- Deliver a phased roadmap. Each phase can be shipped and tested on its own.

## Principles that apply to every phase

**Where the code goes**

- One action path. New mentor actions go through `POST /api/action` → `features.act()` (`server/features.js:396-426` allow-list). The rules live in `src/state/transitions.js` so client and server share them.
- New role data is stored per role, like the existing maps (`xxxByRole` in `src/data/model.js:297-302`). Mentor settings live on `profiles.mentor`.

**Migration**

- Each schema change adds a backfill in `prepare()`/`sweep()` (as the existing cycle backfill does at `workspace.js:312-318`).
- Bump `demoDirectoryVersion` (`server/demo-directory.js:100`) when demo mentors gain new fields.

**UI**

- Follow the global UI rules. Use tokens only from `src/theme.css`, add no new hex values, and put mentor styles in `src/mentorship.css`.
- Use the single existing icon set (`Icon.jsx`) and tabular numbers for all stats.
- Every async button shows a loading state, and pages load with skeletons.

**AI**

- The request assistant reuses the pattern in `src/data/profile-assistant.js`: rule-based, runs in the browser, and the person always reviews its output.

**Tests and docs**

- Each phase adds unit tests (`tests/*.test.js`) and one Playwright spec, including the existing axe and layout checks.
- Each phase updates `docs/testing/TEST-CASE-RUNTHROUGH.md`.

---

## Phase 0 — Spec, vocabulary and mentor navigation (foundation)

1. Add the new document as [`docs/product/SYNERGY-SPEC.md`](SYNERGY-SPEC.md), the current spec. The original brief, `Synergy.md`, stays unchanged for provenance, as `docs/maintenance/CLEANUP-MANIFEST.md` requires.
2. Add `src/data/mentor-formats.js`, the single source for the five formats:

   ```
   { id, label, effort, sync: bool, defaultMinutes,
     milestones[], evidence[], upgradeTo? }
   ```

   The ids are `quick-ask`, `doc-review`, `single-session`, `office-hours` and `ongoing-advisory`.

3. Add mentor-only navigation. `Sidebar.jsx` and `MobileMenu.jsx` switch item arrays when `state.role === "mentor"`:
   - Home
   - Requests (replaces Matches and Introductions)
   - Mentees (the rooms filtered to mentorship)
   - Calendar (now in the nav)
   - Impact (added in Phase 5)
   - Updates
   - Settings

   Until Phases 2 and 5 add dedicated pages, Requests opens the existing Introductions page (`#/waiting`) and Mentees opens the rooms list (`#/rooms`). Both have mentor titles. Phase 2 adds `#/requests` and Phase 5 adds `#/mentees` and `#/impact`. Matches stays reachable from Requests ("Browse startups"), so mentors can still find founders. The founder navigation is unchanged.

4. Remove the dead `DashboardUI.jsx` and `NextStep.jsx`, which nothing imports.

## Phase 1 — Mentor profile, capacity and Pause Mode

**Data.** Add to `profiles.mentor` (`model.js:261-269`):

```
capacity: { maxMentees: 3, monthlyHours: 4, responseDays: 3 },
formats: ["quick-ask", "single-session"],
topics: [...],           // controlled vocabulary tags (reuse canonicalTags in collaboration.js)
stages: [...],
industries: [...],
paused: false,
pausedAt
```

**Settings.** Add a "Mentoring" section to `SettingsPage.jsx` with:

- capacity steppers
- format checkboxes, each showing the format's effort
- a response-time select
- a one-tap Pause Mode toggle

Pause Mode is separate from the account-wide "Pause discovery": it stops new requests but keeps active mentees.

**Profile.** In `ProfilePage.jsx`, expertise becomes vocabulary tags, not comma text. Free-text `availability` is replaced by the structured capacity.

**Server enforcement** (`server/workspace.js`):

- `person()` (:511-576) exposes `available`, `openSlots`, `hoursLeftThisMonth`, `formats` and `responseDays`.
- `interest` with `engagementType: "mentorship"` returns 409 when the mentor is paused, at their mentee limit, or out of hours. The founder is then shown similar mentors.
- A 30-day cooldown after a decline is checked against `introHistoryByRole`.
- Monthly hours = the sum of `durationMinutes` of scheduled sessions in the current month.

**Matching.** In `scoreProfile` (`workspace.js:101-285`), add two new factors: **Availability Fit** and **Format Fit**. Weights go in `src/data/matching.js` (`mentor` weights, extended from 5 to 7 entries). Factor colours and copy go in `ScoreGuide.jsx` and `--factor-*` tokens.

**Discover.** Add an "Available now" filter (`DiscoverPage.jsx`) for founders, showing only mentors with open slots this week.

## Phase 2 — Structured requests and the Requests Inbox

**Request object.** Extend `introductionMetaByRole[role][id]` with:

```
{ problem, tried, question, format, links[], quality, qualityReasons[], sharpenedFrom?, expiresAt }
```

`note` stays for founder ↔ founder introductions.

**Founder request form.** `MatchDetailPage.jsx` shows a new `MentorRequestForm.jsx` in place of the intro note when the target is a mentor. It asks:

1. What's the problem?
2. What have you already tried?
3. What specific question do you want answered?
4. Which format do you prefer? Only the mentor's accepted formats are offered.

**Request assistant.** Add `src/data/request-assistant.js`, modelled on `profile-assistant.js`. It:

- flags vague asks ("help with marketing") and proposes a sharper question template
- prompts for missing context (what was tried, metrics, links)
- suggests a format, e.g. "This sounds like a Quick Ask"

The founder accepts or edits each suggestion.

**Request quality.** Add `requestQuality(meta)`, a 0–100 score from field completeness, question specificity, links and context, returned with plain-language reasons. Shared in `src/data/mentorship.js`.

**Inbox.** Add `src/pages/RequestsPage.jsx` (mentor). Requests are ranked by `score × quality` and each card shows:

- the "why this match" line (e.g. "88% Match — SaaS pricing (your top skill)…")
- the founder's three answers
- the remaining time before expiry

Actions:

- **Accept** opens the room, pre-filled with the request's goal and format.
- **Decline** opens a one-tap reason sheet. It extends `DeclineIntroduction.jsx` with reason codes: `outside-expertise`, `no-slots`, `not-a-fit`, `other`.
- **Refer** is a new action, `refer-request`. The mentor picks from similar mentors (ranked by `scoreProfile` against the founder). The request moves to that mentor's inbox, history records `status: "referred"`, and the founder is notified.

**Expiry.** Replace the fixed 14-day `introLimitMs` (`workspace.js:420`) for mentor requests with `mentor.capacity.responseDays`. On expiry, the founder's history entry includes `alternatives[]` (the top 3 similar available mentors). The day-7 reminder (`features.js:192-206`) becomes "1 day before expiry".

**Shared helper.** Add `similarMentors(founder, excludeId, n)` to `server/workspace.js`. It is used by refer, by expiry, and by the at-capacity 409 response.

## Phase 3 — Format ladder and Mentorship Room rework

**Templates.** Change `engagement-templates.json` mentorship from v3 to v4. It becomes one template per format, with milestones taken from `mentor-formats.js`:

| Format           | Milestones (* = needs evidence or mutual confirmation)                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Quick Ask        | question → answer* → marked helpful                                                      |
| Doc/Pitch Review | doc uploaded → review delivered* → revisions logged                                      |
| Single Session   | goal confirmed → session held* → action items logged → follow-up*                        |
| Office Hours     | slot booked → session held* → action items                                               |
| Ongoing Advisory | goals defined → check-ins* (reuses the existing `cycle`) → progress reviewed* → reviewed |

**Migration of existing rooms:** `one-off` becomes `single-session`, and `ongoing` becomes `ongoing-advisory`. `ongoingMentorship()` (`collaboration.js:2-3`) checks `format === "ongoing-advisory"`.

**Stage line.** `RoomDetailPage.jsx` shows the mentorship stages: Requested → Accepted → Goal Confirmed → Session Held → Follow-up → Reviewed. They come from a new `mentorshipStage(room)` in `src/data/mentorship.js`, which replaces the generic `roomStatusLabel` for mentorship. `RoomsPage` and `NowBar` use the same helper.

**Room contents (mentorship tabs).**

- **Goal card** (`GoalCard.jsx`). The founder's question and desired outcome, shown at the top of the room. The mentor confirms it with one tap, which completes the `goal-confirmed` milestone. This replaces the `mentorship-brief` card that sits on the Terms tab. Terms are slimmed down for mentorship: there's no compensation field, because volunteering is the only option in v1.
- **Prep checklist** (`PrepChecklist.jsx`). For the founder: deck, metrics and links, due 24 hours before the session. Uploads use the existing `/api/upload` and evidence items. The mentor sees "Prep shared ✓/✗".
- **Shared notes** (`SessionNotes.jsx`). Add `room.notes[] {authorAccountId, text, at, sessionIndex}`, mirrored by `mirror()` (`workspace.js:909-998`), and a new form `session-note`.
- **Action items.** These reuse TaskBoard tasks with a new `kind: "action"` and the founder as assignee. The "Action items logged" milestone completes once there is at least one.
- **Session held** needs both sides to confirm. Each `schedules[]` entry gets `heldBy {me, partner}`. A no-show is recorded when one side says "didn't happen".
- **Founder follow-up.** 14 days after the session is held, a `followup` prompt asks the founder what they did and what happened, and records the result for each action item. Submitting notifies the mentor and counts towards follow-through.
- **Upgrade to Ongoing Advisory.** After Single Session or Quick Ask, the action `propose-upgrade` / `accept-upgrade` (`features.js`) switches the template to `ongoing-advisory` and starts `ensureCycle`. There's no new request, and history is kept.
- **Remove the generic Deal Room pieces from mentorship rooms:** the dispute flag, the evidence requirement on non-* milestones and the "Launched" wording. The rule "the mentor's only admin is to confirm the session and rate" is checked by a unit test.

**Format-specific UI.**

- Quick Ask and Doc Review have no scheduling. They use an "Answer" or "Review" composer, attached as evidence.
- Session formats keep `SchedulePanel.jsx`.

## Phase 4 — Office Hours and Calendar

**Slots.** Add `profiles.mentor.officeHours[] {id, weekday|date, time, durationMinutes, timeZone, recurring}`. Slots are managed on `CalendarPage.jsx`: open, close and repeat weekly.

**Booking.** Founders book from the mentor's profile or Match Detail: pick a slot, fill in the short request form, and the room opens straight away with the `office-hours` template. There's no accept step. Bookings count against monthly hours and the mentee limit.

**Scheduling with availability.** `SchedulePanel.jsx` suggests times from the mentor's open slots instead of fixed 09:00–15:00. Conflicts with booked sessions are checked, which removes the note "Partner availability… not checked".

**Calendar sync.** An `.ics` download for each session, plus an ICS feed URL. Full two-way Google sync is out of scope for v1 and listed as future work.

## Phase 5 — Mentor Home, Active Mentees and Impact Profile

**Mentor Home.** Rework `MentorHome.jsx` as the dashboard:

- the headline states the count, e.g. "3 requests waiting · 1 expires today"
- top-ranked requests come first and are the main feature
- then today's sessions, prep status and the capacity meter (mentees and hours used/limit)

**Mentees page.** Add `src/pages/MenteesPage.jsx`, which groups active rooms by `mentorshipStage`. It reuses the identity and progress parts of the current MentorHome card.

**Impact.** Add `src/pages/ImpactPage.jsx` and public profile sections. Stats come from an extended `trustSummary` (`collaboration.js:129-188`):

- sessions held and founders helped
- average rating and top-rated skills
- follow-through rate (completed action items ÷ assigned)
- response rate and average response time
- no-show rate
- opt-in testimonials, a new review field `testimonial` plus `testimonialPublic`
- follow-up highlights (latest founder outcomes)

Shown on `ProfilePage` (public view) and on `MatchDetailPage` for founders.

**Two-way ratings.** `ReviewPage.jsx` and the `review-form` reducer (`transitions.js:235-257`) ask different questions depending on who is rating:

- founder → mentor: usefulness, clarity, responsiveness
- mentor → founder: preparedness, follow-through

Reviews stay blind, using the existing `response()` (`workspace.js:680-700`).

**Badges.** Add a pure function `badgesFor(trust)`:

- Mentors: New Mentor → Verified Mentor → Top Mentor, with thresholds in `matching.js` config so admins can tune them.
- Founders: Prepared Founder.

Badges appear wherever verification badges show. Prepared Founder adds a small boost to request ranking.

**Certificate.** A printable `/impact/certificate` view (print CSS) listing mentoring hours and sessions. There's no PDF dependency in v1.

## Phase 6 — Stricter mentor onboarding

**Signup.** After the role step, mentors (and "both") go through a mentor flow that brings the unused 5-step onboarding machine in `transitions.js:613-687` to life:

1. Verification: LinkedIn URL, work email, or an endorsing organisation. This extends `Verification.jsx`.
2. Expertise tags (vocabulary).
3. Experience summary.
4. Capacity (Phase 1 fields).
5. Formats.
6. Preferences: stages and industries.
7. COI disclosure.
8. Guidelines agreement.

**Going live.** A mentor profile is hidden from discovery until a moderator approves it. Approval reuses the verification queue in `ModerationPage.jsx` and records `mentorApprovedAt`. Until then the mentor sees a pending state on Home.

**COI.** `profiles.mentor.conflicts[] {company, relation}`. `scoreProfile` excludes founders whose company or sector matches a disclosed conflict.

**Guidelines.** Store `guidelinesAcceptedAt` and the guidelines version. Accepting requests is blocked until they are accepted.

## Phase 7 — Mentor notifications

Extend `server/features.js:72-190` and `src/data/notifications.js` with these new kinds:

- `request`: a daily batched summary by default
- `request-expiring`
- `session-reminder`: at 24 hours and 1 hour, with links to prep materials
- `followup-update`: "Maria tested your pricing advice — here's what happened"
- `capacity`: close to the mentee or hours limit
- `referred`, `declined` and `expired` for founders, with alternatives

`notificationDestination` (:16-63) stops always saying "Open Deal Room" and labels the link by room type and target page. Mentor notification defaults go in the `SettingsPage` notifications section: digest on.

## Phase 8 — Mentor safety rules

**No-shows.** Counted from Phase 3's `heldBy` and shown in trust. Repeated no-shows (a threshold in config) trigger a temporary request limit for founders, or pause new requests for mentors. Both are reversible by an admin.

**No equity or payment.** Remove the compensation option from mentorship terms. Add a rule-based check in chat and request text for equity or payment asks, with a soft warning and a report shortcut.

**Ratings.** Inflation flagging reuses `ratingPattern` (`trustSummary`) and puts flags in the moderation queue.

**Reporting.** Confidentiality and block/report reuse the existing `report-form` and blocked collaborators. Make sure both entry points appear in mentorship rooms.

## Future (not in this roadmap)

Mentor community space, Group Office Hours, paid sessions with a platform fee, smarter matching with embeddings, and two-way calendar sync.

---

## Critical files

**Server**

- `server/workspace.js`: scoring, `person()`, `act`, `sweep`, `mirror`, migrations
- `server/features.js`: new actions and forms, notifications
- `server/demo-directory.js`: demo mentors with capacity, formats, office hours and impact history

**Data**

- `src/data/model.js`, `src/data/mentorship.js`, `src/data/collaboration.js`
- `src/data/matching.js`, `src/data/engagement-templates.json`
- new: `src/data/mentor-formats.js`, `src/data/request-assistant.js`

**State**

- `src/state/transitions.js`, `src/state/routes.js`, `src/state/AppContext.jsx` (`remoteActions`)

**Pages and components**

- `src/pages/RoomDetailPage.jsx`, `MatchDetailPage.jsx`, `SettingsPage.jsx`, `ProfilePage.jsx`, `CalendarPage.jsx`, `ReviewPage.jsx`, `DiscoverPage.jsx`
- new pages: `RequestsPage`, `MenteesPage`, `ImpactPage`
- `src/components/MentorHome.jsx`, `Sidebar.jsx`, `MobileMenu.jsx`, `SchedulePanel.jsx`, `TaskBoard.jsx`, `DeclineIntroduction.jsx`, `Verification.jsx`
- new components: `MentorRequestForm`, `GoalCard`, `PrepChecklist`, `SessionNotes`

**Styles:** `src/mentorship.css` and `src/theme.css` (factor tokens only)

## Recommended order and size

| Phase | Depends on | Size |
| ----- | ---------- | ---- |
| 0     | —          | S    |
| 1     | 0          | M    |
| 2     | 1          | L    |
| 3     | 0, 2       | L    |
| 4     | 1, 3       | M    |
| 5     | 3          | M    |
| 6     | 1          | M    |
| 7     | 2, 3       | S    |
| 8     | 3, 5       | S    |

Phases 6 and 7 can run alongside Phase 4 and 5 work.

## Verification (for each phase)

- `npm run test:unit` covers reducers and helpers:
  - `requestQuality`, `similarMentors`, `mentorshipStage`, `badgesFor`
  - capacity enforcement and cooldown
  - format migration from v3 to v4
  - mentor admin limited to confirming and rating
- `npx playwright test tests/mentorship.spec.js` plus a new spec per phase, e.g. `tests/mentor-requests.spec.js`, `mentor-capacity.spec.js`, `mentor-room.spec.js`, `office-hours.spec.js`, `mentor-impact.spec.js`. Each runs both directions (founder starts, mentor starts), axe checks, and the 4-width layout check.
- Existing suites must stay green: `tests/founder-completion.*`, `workspace.test.js`, `features.*`.
- Manual run with the `run` skill:
  1. Open the demo as a mentor: `POST /api/demo {role:"mentor"}`.
  2. Walk Journey B from the spec end to end: request → sharpen → accept → prep → session held (both confirm) → action items → follow-up → blind ratings → upgrade to Ongoing Advisory.
- Update `docs/testing/TEST-CASE-RUNTHROUGH.md` with a test case for each new flow, including the missing ones for ongoing cycles and expiry. Update the `README.md` feature list.
