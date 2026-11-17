# Mentor-side roadmap

Status, 18 November 2026: **final.** Phase 0 delivered. Phases 1 to 8 make up the v1 MVP (volunteer-only). Paid mentorship is v1.1 and has its own section at the end.

This roadmap brings the mentor side in line with the [current product spec](SYNERGY-SPEC.md). Each phase can be shipped and tested on its own. Every rule below is a decision, not a suggestion. Where a number appears, it is the default value, and it lives in config so admins can tune it without a code change.

## Context

The updated Synergy spec (Nov 9, 2026) treats mentors as a separate product: structured requests, enforced capacity, five engagement formats, a lighter Mentorship Room, an Impact Profile, and stricter onboarding. Before this roadmap, the mentor side was mostly the founder flow with different labels:

- **No mentor request object.** A request is the generic introduction (`introductionMetaByRole = {sentAt, note, name}`). The only mentor-specific branch is `HomePage.jsx` → `MentorHome`.
- **Two formats, not five.** "Format" is `one-off | ongoing` (`engagement-templates.json` mentorship v3). Rooms use the generic Deal Room stage line (`RoomDetailPage.jsx`).
- **Missing entirely:** capacity, Pause Mode, refer, office hours, impact stats, badges, conflict of interest (COI) and the guidelines agreement.

### Release plan

| Release | Contents | Money |
| --- | --- | --- |
| **v1 (MVP)** | Phases 0–8 | None. All mentoring is free. This matches spec §3 ("Version 1 is volunteer-only") and §9 ("No equity or payment requests inside the platform in version 1"). |
| **v1.1** | Paid mentorship (phases P1 and P2 at the end of this document) | Mentors may charge per format. Starts only when the v1.1 entry gates in Phase 8 are met. |

**Why paid moved to v1.1.** The reason mentors stay is the impact loop: request, session, action items, founder follow-up. That loop needs no money, and it has to be proven first. Payments are the largest and riskiest piece of work: provider, payouts, refunds, disputes, tax and regulation. Shipping them first would delay the core product. Adding a price from day one would also split mentors into a "free" and a "paid" class before there is any reputation to justify a price.

**What v1 does to stay ready for v1.1.** Every offered format stores `price: 0` from Phase 1. The request saves the price on the server. Room stages, the attendance model and the dispute queue are built so that payments plug in without migrating rooms again.

### Final decisions

| Topic | Decision |
| --- | --- |
| Paid mentorship | v1.1. Volunteer-only in v1. |
| Room model | Extend the existing room, mirroring, blind-review and 8-week cycle machinery. No new room model. |
| Launch market and currency | Philippines, PHP (₱). One currency. |
| Who sets prices (v1.1) | The mentor, per format, between `minPrice` ₱300 and `maxPrice` ₱10,000. |
| Platform fee (v1.1) | 15% of the price. The founder pays the listed price. The mentor receives 85%. Synergy pays the provider's processing fees out of its 15%. |
| Payment provider (v1.1) | A marketplace product where **the provider holds funds and pays out to verified sub-accounts**, so Synergy never holds client money: Xendit xenPlatform first choice, PayMongo as fallback. Built behind an adapter, with a simulated provider first. |
| Refunds and disputes (v1.1) | See P1 "Refunds, reschedules and disputes". |
| Business model | v1 is free for everyone, to build mentor supply and trust data. v1.1 brings the 15% fee on paid sessions. Partner programmes (accelerators and universities paying for cohorts) come after v1.1 (see Future). |

## Principles that apply to every phase

**Where the code goes**

- One action path. New mentor actions go through `POST /api/action` → `features.act()` (the allow-list in `server/features.js`). The rules live in `src/state/transitions.js` so client and server share them.
- New role data is stored per role, like the existing maps (`xxxByRole` in `src/data/model.js`). Mentor settings live on `profiles.mentor`.
- **The server is the source of truth** for capacity, expiry, attendance, cooldowns and (in v1.1) money. The client shows these values and never decides them.
- All tunable numbers live in one config object, `mentorConfig` in `src/data/mentorship.js`, exported so both server and client read it. Admins edit it from the Phase 8 admin settings. No magic numbers in components.

**Time**

- Every timestamp is stored in UTC ISO 8601. Every schedule entry and office-hours slot also stores `timeZone` (IANA, e.g. `Asia/Manila`) and is shown in the viewer's own zone.
- "This month" for capacity means the calendar month in the **mentor's** time zone (`profiles.mentor.timeZone`, default `Asia/Manila`).

**Privacy**

- Request content (problem, what was tried, question, links) is visible only to the founder and the mentor it is addressed to. Nobody else sees it, including referred mentors, until the founder agrees.
- When a request is declined, expires or is returned, the mentor's copy of the content is deleted after `requestContentRetentionDays` (30). History keeps only id, name, status, reason and dates.
- This is how the product meets the Philippine Data Privacy Act (RA 10173) for request content: the founder knows who sees it, and it is not kept longer than needed.

**Migration**

- Each schema change adds a backfill in `prepare()`/`sweep()`, as the existing cycle backfill does in `server/workspace.js`.
- Bump `demoDirectoryVersion` (`server/demo-directory.js`) whenever demo mentors gain new fields.
- Every migration is idempotent and has a unit test that runs it twice.

**UI**

- Follow the global UI rules. Use tokens only from `src/theme.css`, add no new hex values, and put mentor styles in `src/mentorship.css`.
- Use the single existing icon set (`Icon.jsx`) and tabular numbers for all stats, counts, times and dates.
- Every async button shows a loading state, and pages load with skeletons.
- Every rule that blocks the user (capacity, cooldown, pending limit, overdue follow-up) shows **why** and **what to do next** in plain language, never only a disabled button.

**AI**

- The request assistant reuses the pattern in `src/data/profile-assistant.js`: rule-based, runs in the browser, and the person always reviews its output.

**Notifications ship with the phase that needs them**

- Each phase adds its own notification kinds in `server/features.js` and `src/data/notifications.js`. Phase 8 adds only the digest, preferences and email delivery on top.

**Tests and docs**

- Each phase adds unit tests (`tests/*.test.js`) and one Playwright spec, including the existing axe and layout checks.
- Each phase updates `docs/testing/TEST-CASE-RUNTHROUGH.md`.
- Each phase ends with the "Done when" checklist in its section. A phase is not finished until every box is true.

### `mentorConfig` defaults (single source, `src/data/mentorship.js`)

```js
export const mentorConfig = {
  // Capacity
  defaultMaxMentees: 3,
  defaultMonthlyHours: 4,
  defaultResponseDays: 3,        // allowed values: 1, 2, 3, 5, 7
  defaultMaxOpenAsync: 3,        // open Quick Asks + Doc Reviews at once
  pendingPerOpenSlot: 2,         // pending requests allowed = max(2, slots × this)
  // Requests
  founderMaxPending: 3,          // pending mentor requests per founder
  founderLimitedPending: 1,      // the same, while overdue on a follow-up or under a no-show limit
  maxReferrals: 3,               // mentors one referral can suggest
  alternativesCount: 3,          // similar mentors offered on decline, expiry, return or a 409
  cooldownDays: { "not-a-fit": 30, "outside-expertise": 30, other: 7, "no-slots": 0 },
  requestContentRetentionDays: 30,
  qualityBonusMax: 5,            // max points request quality adds to inbox rank
  preparedFounderBonus: 3,
  // Sessions
  attendanceAutoConfirmHours: 72,
  asyncAutoCompleteDays: 5,
  revisionWindowDays: 14,        // Doc Review: time to log revisions
  upgradeProposalDays: 7,        // an upgrade proposal stays open this long
  freeReschedulesPerSide: 1,
  lateNoticeHours: 24,
  bookingMinLeadHours: 1,        // Office Hours: earliest booking before a slot
  bookingMaxAheadDays: 30,       // Office Hours: furthest booking ahead
  followupAfterDays: 14,
  followupRemindDays: [14, 17, 21],
  followupOverdueDays: 21,
  // Ongoing Advisory
  cycleWeeks: 8,                 // replaces the hard-coded 8 weeks in ensureCycle
  checkInsPerCycle: 4,           // one every 2 weeks; fixed when each cycle starts
  checkInMinutes: 45,
  // Reviews and impact
  reviewWindowDays: 14,
  minDataPoints: 3,              // a stat or rating shows only from this many data points
  // Trust and safety
  noShowLimit: 2,                // no-shows in 90 days before a limit applies
  noShowWindowDays: 90,
  noShowLimitDays: 30,
  flaggedMessageLimit: 3,        // flagged messages before automatic moderation review
  flaggedMessageWindowDays: 30,
  // Notifications
  digestHour: 8,                 // daily request digest, in the mentor's time zone
  // Badges
  badges: {
    verifiedMentor: { sessions: 3, avgRating: 4.0 },
    topMentor: { sessions: 15, avgRating: 4.5, followThrough: 0.6, responseRate: 0.8 },
    preparedFounder: { engagements: 2, preparedness: 4.0, followupRate: 0.75 },
  },
  // Onboarding
  approvalTargetBusinessDays: 2,
  guidelinesVersion: 1,
  guidelinesGraceDays: 14,
};
```

---

## Phase 0 — Spec, vocabulary and mentor navigation (delivered)

1. [`docs/product/SYNERGY-SPEC.md`](SYNERGY-SPEC.md) is the current spec. The original brief, `Synergy.md`, stays unchanged for provenance, as `docs/maintenance/CLEANUP-MANIFEST.md` requires.
2. `src/data/mentor-formats.js` is the single source for the five formats: `{ id, label, summary, effort, effortMinutes, sync, milestones[], upgradeTo[] }`. The ids are `quick-ask`, `doc-review`, `single-session`, `office-hours` and `ongoing-advisory`.
3. Mentor-only navigation in `Sidebar.jsx` (`mentorNavigation`) and `MobileMenu.jsx`: Home, Requests, Mentees, Calendar, Impact (Phase 5), Updates, Settings. Until the dedicated pages exist, Requests opens `#/waiting` and Mentees opens `#/rooms`. Matches stays reachable from Requests ("Browse startups").
4. Removed the dead `DashboardUI.jsx` and `NextStep.jsx`.

## Phase 1 — Mentor profile, capacity, Pause Mode, COI and guidelines

COI and the guidelines agreement are here, not in onboarding, because Phase 2 lets founders send requests and mentors accept them. Neither may happen without them.

### Data

Add to `profiles.mentor` (`src/data/model.js`):

```js
timeZone: "Asia/Manila",
capacity: {
  maxMentees: 3,       // active sync engagements (see "What uses capacity")
  monthlyHours: 4,     // committed hours per calendar month
  responseDays: 3,     // 1 | 2 | 3 | 5 | 7
  maxOpenAsync: 3,     // open Quick Asks + Doc Reviews
},
formats: [             // each offered format carries its price
  { id: "quick-ask", price: 0 },
  { id: "single-session", price: 0 },
],                     // price in minor units (centavos); always 0 in v1
topics: [],            // controlled vocabulary (canonicalTags in collaboration.js)
stages: [],
industries: [],
paused: false,
pausedAt: null,
pausedUntil: null,     // optional automatic resume date
conflicts: [],         // { company, relation, industry? }
guidelinesAcceptedAt: null,
guidelinesVersion: null,
```

- `normalizeMentorFormats` (`mentor-formats.js`) accepts both the object form and a plain list of ids. A plain id gets `price: 0`. In v1 the server forces every `price` to 0 whatever the client sends.
- `conflicts[].relation` is one of `advisor`, `employee`, `investor`, `founder`, `other`.
- Backfill: existing mentors get the defaults above, `formats` taken from the old `one-off`/`ongoing` values (`one-off` → `single-session`, `ongoing` → `ongoing-advisory`), `topics` parsed from the old comma `expertise` text through `canonicalTags`, and free-text `availability` copied into `bio` notes so nothing is lost.

### What uses capacity

This is the rule that every later phase follows. It lives in one function, `capacityUsage(mentorAccount, now)` in `server/workspace.js`, and returns `{ activeMentees, openAsync, pendingRequests, minutesCommitted, openSlots, hoursLeft, available, availableFormats[], reason }`.

| Format | Uses a mentee slot | Uses an async slot | Minutes counted against `monthlyHours` |
| --- | --- | --- | --- |
| Quick Ask | No | Yes, from accept until answered | `effortMinutes` (15), in the month accepted |
| Doc/Pitch Review | No | Yes, from accept until review delivered | `effortMinutes` (60), in the month accepted |
| Single Session | Yes, from accept until "Session held" is resolved | No | the session's `durationMinutes` (default 60), in the month it is scheduled |
| Office Hours | Yes, from booking until "Session held" is resolved | No | the slot's `durationMinutes`, in the month of the slot |
| Ongoing Advisory | Yes, from accept until the engagement ends (Phase 3, "Ending an engagement") | No | the cycle's planned minutes (`checkInsPerCycle` × `checkInMinutes`), **reserved at accept** and at each new cycle, spread over the months the check-ins fall in |

- A format is **available** only if the mentor is not paused, has accepted the current guidelines, and has room in the slot type and the hours that format needs. `availableFormats[]` lists them.
- `available` is true when at least one format is available.
- `reason` is one of `paused`, `guidelines`, `mentee-limit`, `async-limit`, `hours-limit`, `inbox-full` or `null`. The UI turns it into a sentence.

### Settings

Add a "Mentoring" section to `SettingsPage.jsx`, in this order:

1. **Pause Mode**: a one-tap toggle, with an optional "Resume on" date. Copy: "Stop new requests. Your current mentees are not affected."
2. **Capacity**: steppers for mentees (1–10), hours per month (1–40) and open quick asks/reviews (1–10), plus a response-time select (1, 2, 3, 5 or 7 days). Under the steppers, a live line: "You're using 2 of 3 mentee slots and 2.5 of 4 hours this month."
3. **Formats**: a checkbox per format, showing its summary and effort. At least one must stay selected.
4. **Time zone**: a select, prefilled from the browser.
5. **Conflicts of interest**: a list of company + relation (+ optional industry) with add and remove. "I have no conflicts" is an explicit choice, so an empty list is never ambiguous.
6. **Mentor guidelines**: the current version, its accepted date, or an "Accept guidelines" action.

Pause Mode is separate from the account-wide "Pause discovery". It stops new requests but keeps active mentees and their rooms.

### Lowering capacity below current use

- A mentor can always lower a limit, even below what they're using now. Current engagements, booked sessions and pending requests continue unchanged. Nothing is cancelled or returned.
- Until usage drops under the new limit, the affected formats are unavailable with the usual `reason` (`mentee-limit`, `async-limit` or `hours-limit`). The Settings line explains it: "You have 3 active mentees and a limit of 1. New requests for sessions resume when you're under the limit."
- Lowering `monthlyHours` below the minutes already in open, **unbooked** Office Hours slots for a month is refused with the slots to close first ("Close 2 slots in December to lower your hours to 2"). Booked slots are never touched.

### Pause Mode rules

- New action `set-mentor-pause {paused, pausedUntil?}`.
- When pausing, every pending request to this mentor is **returned**: it leaves the inbox, the founder's history records `status: "returned"` with `reason: "mentor-paused"` and `alternatives[]`, and the founder is notified. Returned requests do **not** count against the mentor's response rate.
- `sweep()` clears the pause automatically on `pausedUntil`.
- Paused mentors still appear in Discover, with a "Not taking requests" label and no request button. They can still be saved.

### Guidelines agreement

- The guidelines text lives in `docs/product/MENTOR-GUIDELINES.md` and in `src/data/mentor-guidelines.js` as `{ version, sections[] }`. Version 1 covers: keep founders' information confidential, no equity or payment requests (v1), show up to booked sessions or cancel at least 24 hours ahead, disclose conflicts, give honest and specific feedback, and report misconduct.
- New action `accept-guidelines {version}` stores `guidelinesAcceptedAt` and `guidelinesVersion`.
- **Existing mentors** get a grace period of `guidelinesGraceDays` (14) from the day Phase 1 ships. They see a banner on Home ("Accept the mentor guidelines by 2 Dec to keep receiving requests"). After the grace period they stay visible but `available` is false with `reason: "guidelines"` until they accept.
- When `guidelinesVersion` in config is raised, the same 14-day grace applies to everyone.

### Conflict of interest

- `conflictWith(mentor, founder)` in `src/data/mentorship.js` returns `"block"`, `"warn"` or `null`:
  - `block`: the founder's `startupName` matches a disclosed company (case-insensitive, punctuation and "Inc"/"Corp"/"Ltd" stripped), or the mentor and the founder are the same person (role "both").
  - `warn`: the founder's industry equals the `industry` of a conflict where the relation is `employee`, `investor` or `founder`.
- `scoreProfile` excludes `block` pairs from both directions. `warn` pairs stay in the ranking, and the mentor sees "Possible conflict: you disclosed an investment in a fintech company" on the request.
- The server rejects `interest` and every request action with 409 `conflict` for a `block` pair, so direct requests from Discover or a shared link are blocked too.
- Users with the "both" role automatically get their own startup as a conflict (`relation: "founder"`). It is not removable.

### Profile

In `ProfilePage.jsx`, expertise becomes vocabulary tags instead of comma text, and free-text `availability` is replaced by the structured capacity ("Usually replies within 3 days · 1 mentee slot open").

### Server enforcement (`server/workspace.js`)

- `person()` exposes `available`, `availableFormats`, `openSlots`, `hoursLeftThisMonth`, `formats` (with prices), `responseDays` and `reason`. It never exposes the mentor's conflict list.
- `interest` with `engagementType: "mentorship"` returns 409 with `{ reason, alternatives[] }` when the requested format is not available, or the mentor is at the pending limit (Phase 2).

### Matching

In `scoreProfile`, add two factors: **Availability Fit** and **Format Fit**. Weights go in `src/data/matching.js` (`mentor` weights, extended from 5 to 7 entries, summing to 100). Factor colours and copy go in `ScoreGuide.jsx` and `--factor-*` tokens.

- Availability Fit: 100 if a format is available, 50 if the mentor has hours but no slot type left, 0 if paused or out of hours.
- Format Fit: the share of the founder's preferred formats that the mentor offers. It checks offered formats only, never price. In Phase 1 founders have no stated preference, so every founder counts as "any" and Format Fit is 100 for any mentor with at least one available format. Phase 2 adds `request-assistant`, which infers preferred formats from the founder's need text, and Format Fit starts using them then.

### Discover

Add an "Available now" filter (`DiscoverPage.jsx`) for founders. It shows only mentors where `available` is true.

### Notifications added in this phase

- `guidelines-required` (mentor): when the grace period starts, and 3 days before it ends.
- `capacity` (mentor): when a limit is reached ("You've reached 3 of 3 mentees. New requests are paused until a slot opens.").

### Done when

- [ ] A mentor at the mentee limit can still receive Quick Asks if they offer them and have async slots and hours.
- [ ] Pausing returns every pending request with alternatives, and the response rate is unchanged.
- [ ] A founder whose startup matches a disclosed conflict cannot see or request that mentor, by any path.
- [ ] A "both" user never sees themselves in Matches.
- [ ] Existing mentors are migrated, and the migration runs twice without changes.

## Phase 2 — Structured requests and the Requests Inbox

### Request object

Extend `introductionMetaByRole[role][id]` for mentor requests:

```js
{
  kind: "mentor-request",
  problem, tried, question,          // required, 20–1000 characters each
  format,                            // one of the mentor's availableFormats
  price,                             // copied by the SERVER from the mentor's profile
  links: [],                         // up to 5 URLs
  quality, qualityReasons: [],
  sharpenedFrom: null,               // original question if the assistant rewrote it
  sentAt, expiresAt,
  referredFrom: null,                // mentor account id when this came from a referral
  consentAt,                         // when the founder confirmed who sees the request
}
```

- **The server writes `price`, `expiresAt` and `quality`.** It ignores those fields from the client. `price` comes from the mentor's `formats` at send time, and pending requests keep it if the mentor later changes prices.
- `note` stays for founder ↔ founder introductions.

### Requests already pending when Phase 2 ships

- The backfill marks every pending founder → mentor introduction as `kind: "legacy-note"`. It keeps its `note` and its original 14-day expiry. It is not converted, because the founder never answered the three questions.
- Legacy requests appear in the mentor's inbox with the note in place of the three answers, labelled "Sent before structured requests". Accept, decline and refer work as for new requests. Accepting opens a `single-session` room with the note as the goal.
- They count towards both pending limits, and expire, decline or are returned under the new rules, with alternatives.
- No new legacy requests can be created. They disappear naturally within 14 days of the release.

### Founder request form

`MatchDetailPage.jsx` shows a new `MentorRequestForm.jsx` in place of the intro note when the target is a mentor:

1. What's the problem?
2. What have you already tried?
3. What specific question do you want answered?
4. Which format do you prefer? Only the mentor's `availableFormats` are listed, each with its effort and "Free". Unavailable formats are listed below as disabled, each with its reason.
5. Links (optional).

Under the button: "Only Ana will see this request." Sending stores `consentAt`.

If the mentor is not available, the form is replaced by the reason and up to `alternativesCount` (3) similar available mentors.

### Request assistant

Add `src/data/request-assistant.js`, modelled on `profile-assistant.js`. It:

- flags vague asks ("help with marketing") and proposes a sharper question template
- prompts for missing context (what was tried, metrics, links)
- suggests a format, e.g. "This sounds like a Quick Ask"
- shows the quality score and its reasons **before** sending, so the founder can improve the request

The founder accepts or edits each suggestion. Nothing is changed without the founder's action.

### Request quality and inbox ranking

- `requestQuality(meta)` in `src/data/mentorship.js` returns `{ score: 0–100, reasons[] }` from field completeness, question specificity (a question mark, numbers, a named decision), links and context.
- **Inbox rank = match score + quality bonus + Prepared Founder bonus**, where the quality bonus is `round(quality / 100 × qualityBonusMax)` (at most +5) and the Prepared Founder bonus is +3 (Phase 5). Quality refines the order. It never buries a well-matched founder who writes less polished English.

### Pending limit

- A mentor can hold at most `max(2, openSlots × pendingPerOpenSlot)` pending requests, where `openSlots` counts mentee slots and async slots for the formats they offer.
- At the limit, `available` is false with `reason: "inbox-full"`. Founders see "Ana has several requests waiting. Try again in a few days, or ask one of these mentors." with alternatives.

### Founder request limits

- A founder can have at most `founderMaxPending` (3) pending mentor requests at once.
- A founder cannot send a second pending request to the same mentor.
- A founder with an overdue follow-up (Phase 3) can have at most `founderLimitedPending` (1) pending request until they submit it.

### Inbox

Add `src/pages/RequestsPage.jsx` (mentor, `#/requests`), replacing the Phase 0 link to `#/waiting`. Each card shows:

- the "why this match" line (e.g. "88% Match — SaaS pricing (your top skill)…")
- the founder's three answers and links
- the chosen format and its effort
- the time left before expiry
- a conflict warning, when `conflictWith` returns `warn`
- the founder's track record, once they have one: follow-up rate, average preparedness rating, and no-shows (Phase 5). New founders show "First mentorship request".

### Actions

- **Accept** (`accept-request`). The server re-checks capacity for the requested format at the moment of accepting. If it no longer fits, it returns 409 with the reason, and the card says "Accepting this would go over your 4 hours this month. Raise your limit or decline." On success, the room opens pre-filled with the request's goal and format.
- **Decline** (`decline-request {reason, message?}`). A one-tap reason sheet extending `DeclineIntroduction.jsx`, with the reason codes `outside-expertise`, `no-slots`, `not-a-fit` and `other`, plus an optional short message to the founder. The cooldown for this founder–mentor pair comes from `cooldownDays` by reason: 30 days for `not-a-fit` and `outside-expertise`, 7 for `other`, none for `no-slots`.
- **Refer** (`refer-request {mentorIds[]}`). The mentor picks up to `maxReferrals` (3) mentors from `similarMentors(founder, excludeId, 5)`, which lists only available mentors with no conflict. The request is **not** forwarded. The founder is notified with the suggestions, and their request form opens pre-filled for any of them, with `referredFrom` set. The original request closes as `status: "referred"`. A referral counts as a response for the mentor's response rate.

### Expiry

- Replace the fixed 14-day `introLimitMs` (`server/workspace.js`) for mentor requests with `expiresAt = sentAt + mentor.capacity.responseDays`. Founder ↔ founder introductions keep 14 days.
- On expiry, the founder's history entry includes `alternatives[]` (the top `alternativesCount` similar available mentors), and the founder is notified.
- Reminder to the mentor: at 1 day before expiry when `responseDays` is 3 or more, otherwise at half the window. This replaces the day-7 reminder in `features.js` for mentor requests.
- Expiries count against the mentor's response rate. Returns caused by Pause Mode or by blocking (Phase 7) do not.

### Founder view of sent requests

Founders already follow sent introductions on `WaitingPage.jsx` (`#/waiting`, "Introductions"). Phase 2 extends it for mentor requests:

- One card per mentor request, newest first, showing the mentor, the format, the status and the time left before expiry.
- Statuses and what each card offers:

  | Status | Card shows |
  | --- | --- |
  | `pending` | Time left, and "Withdraw" (`withdraw-request`: frees a founder request slot, removes it from the mentor's inbox, and doesn't count against the mentor's response rate) |
  | `accepted` | "Open mentorship room" |
  | `declined` | The reason in plain words, the mentor's optional message, the cooldown end date if any, and the alternatives |
  | `expired`, `returned` | Why, and the alternatives |
  | `referred` | The suggested mentors, each with "Ask" opening a pre-filled request form |

- Alternatives on a card are recalculated when the page loads, so a mentor who has since become unavailable is not offered.
- The header states what needs action, e.g. "2 requests waiting · 1 mentor suggested others for you".
- Every notification from this phase links to its card here.

### Shared helper

Add `similarMentors(founder, excludeId, n)` to `server/workspace.js`. It returns available, non-conflicting mentors ranked by `scoreProfile` against the founder, and is used by refer, expiry, pause returns and every 409 response.

### Notifications added in this phase

- `request` (mentor): a new request. Instant in v1; Phase 8 adds the daily digest option.
- `request-expiring` (mentor)
- `declined`, `expired`, `referred`, `returned` (founder), each with alternatives
- `accepted` (founder), linking to the room

### Done when

- [ ] The client cannot set `price`, `expiresAt` or `quality`. A test posts them and checks they are ignored.
- [ ] A mentor with 1 open slot never has more than 2 pending requests.
- [ ] Accept re-checks capacity, and two accepts racing for the last slot result in one success and one 409.
- [ ] Refer never shares the request content with another mentor.
- [ ] Declining with `no-slots` does not block the founder from asking again.
- [ ] Each blocked state shows its reason and alternatives.
- [ ] A request pending before the release is still answerable and expires on its original date.
- [ ] A founder can see every sent mentor request and its status on `#/waiting`, and withdraw a pending one.

## Phase 3 — Format ladder and Mentorship Room rework

### Templates

Change the mentorship entry in `engagement-templates.json` from v3 to v4. It becomes one template per format, with milestones taken from `mentor-formats.js`:

| Format           | Milestones (* = needs evidence or mutual confirmation)                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Quick Ask        | question → answer* → marked helpful                                                      |
| Doc/Pitch Review | doc uploaded → review delivered* → revisions logged                                      |
| Single Session   | goal confirmed → session held* → action items logged → follow-up*                        |
| Office Hours     | slot booked → session held* → action items logged                                        |
| Ongoing Advisory | goals defined → check-ins* (reuses the existing `cycle`) → progress reviewed* → reviewed |

**Migration of existing rooms:** `one-off` becomes `single-session`, and `ongoing` becomes `ongoing-advisory`. `ongoingMentorship()` (`collaboration.js`) checks `format === "ongoing-advisory"`. Completed milestones map to the new ids by position. Existing rooms are free (`price: 0`).

### Stage line

`RoomDetailPage.jsx` shows one stage line per format, following its milestones:

| Format | Stages |
| --- | --- |
| Quick Ask, Doc/Pitch Review | Requested → Accepted → Delivered → Reviewed |
| Single Session | Requested → Accepted → Goal Confirmed → Session Held → Follow-up → Reviewed |
| Office Hours | Booked → Session Held → Reviewed. There is no accept step and no follow-up. |
| Ongoing Advisory | Requested → Accepted → Goals Defined → Check-ins (e.g. "2 of 4") → Progress Reviewed → Reviewed. Each new cycle restarts at Check-ins. |

A room upgraded to another format (see "Upgrade") keeps its history and continues at the new format's first stage after Accepted, so it never shows Requested again.

The stages come from a new `mentorshipStage(room)` in `src/data/mentorship.js`, which replaces the generic `roomStatusLabel` for mentorship. `RoomsPage` and `NowBar` use the same helper. The function takes an optional `payment` state, unused in v1, so v1.1 can add "Awaiting payment" without changing callers.

### Room contents (mentorship tabs)

- **Goal card** (`GoalCard.jsx`). The founder's question and desired outcome, shown at the top of the room with the format. The mentor confirms the goal with one tap (`confirm-goal`), which completes the `goal` milestone, or asks a clarifying question in chat. This replaces the `mentorship-brief` card on the Terms tab. For mentorship rooms the Terms tab is removed: there are no terms to negotiate, and compensation is not offered in v1.
- **Where format and goal are stored.** They stay in `room.terms.draft.format` and `room.terms.draft.goal`, where `ongoingMentorship`, `ensureCycle`, `MentorHome`, `SchedulePanel`, `RoomsPage`, `ReviewPage` and `home.js` already read them. Only the tab goes away. For mentorship rooms the server writes these fields: from the request on accept or booking, from `confirm-goal` (the goal), and from `accept-upgrade` (the format). The generic terms actions (propose, counter, accept terms) return 409 for mentorship rooms.
- **Prep checklist** (`PrepChecklist.jsx`). For the founder: deck, metrics and links, due 24 hours before the session. Uploads use the existing `/api/upload` and evidence items. The mentor sees "Prep shared" or "Prep not shared yet".
- **Shared notes** (`SessionNotes.jsx`). Add `room.notes[] {id, authorRole, text, at, sessionIndex}`, mirrored by `mirror()` (`server/workspace.js`), and a new form `session-note`. Notes are editable by their author for 24 hours.
- **Action items.** These reuse TaskBoard tasks with a new `kind: "action"`, the founder as assignee and an optional due date. The "Action items logged" milestone completes once there is at least one. Only the mentor or founder can add them. Only the founder can mark them done.

### Attendance (replaces "both sides say held")

Each `schedules[]` entry gets:

```js
durationMinutes: 60,
timeZone: "Asia/Manila",
attendance: {                     // keyed by ROLE, not me/partner, so mirroring needs no flipping
  mentor:  null | "held" | "partner-absent" | "i-missed",
  founder: null | "held" | "partner-absent" | "i-missed",
  at: { mentor: null, founder: null },
},
outcome: null | "held" | "no-show-mentor" | "no-show-founder" | "no-show-both" | "disputed",
reschedules: { mentor: 0, founder: 0 },
cancelledBy: null, cancelledAt: null, lateCancel: false,
```

The action `report-attendance {scheduleIndex, status}` is available from the session's start time. `resolveAttendance(schedule, now)` in `src/data/mentorship.js` sets `outcome`.

Each report is first read as a claim about who missed the session:

| Report | Mentor reports it | Founder reports it |
| --- | --- | --- |
| `held` | held | held |
| `partner-absent` | founder missed | mentor missed |
| `i-missed` | mentor missed (an admission) | founder missed (an admission) |

The claims then decide the outcome. "Silent" means no report within `attendanceAutoConfirmHours` (72 h) of the session end.

| Claims | Outcome |
| --- | --- |
| Both say held, or one says held and the other is silent, or both are silent | `held`. Nobody reported a problem. |
| Both name the same person as missing | `no-show-mentor` or `no-show-founder`. Both agree, so it is final. |
| One side admits it missed (`i-missed`) and the other is silent | That side's no-show. An admission is final. |
| One side says the other missed, and the other is silent | The accused side's no-show. The accused side has 72 h from that report to answer "held", which makes it `disputed`. |
| One says held and the other names someone as missing | `disputed` |
| Each says the other missed | `disputed` |
| Each admits it missed (both report `i-missed`) | `no-show-both`. Final. It counts as a no-show for each side. |

- `sweep()` applies the 72-hour rules.
- `disputed` goes to the moderation queue (`ModerationPage.jsx`) as a "Session dispute" with both statements. The moderator chooses `held`, `no-show-mentor`, `no-show-founder` or `no-show-both` (`resolve-session-dispute`, admin only). In v1 this affects only trust stats. In v1.1 it also decides the money.
- The "Session held" milestone completes when `outcome` is `held`. A no-show outcome offers "Reschedule" or "Close room".

### Reschedules and cancellations

- Action `reschedule-session {scheduleIndex, date, time}`. Each side has `freeReschedulesPerSide` (1) per session with at least `lateNoticeHours` (24) notice.
- A reschedule with less than 24 hours' notice, or a second reschedule by the same side, is recorded as a **late cancellation** by that side and appears in trust (Phase 5).
- Action `cancel-session {scheduleIndex, reason}`. With 24 or more hours' notice it is a normal cancellation. Later it is a late cancellation. The partner is notified. A cancelled Single Session frees the mentee slot and the minutes.

### Founder follow-up

- Follow-ups apply to **Single Session** only, the one format with a `follow-up*` milestone (spec §10). Office Hours ends at "Action items logged". Ongoing Advisory tracks progress through its check-ins and "progress reviewed" instead. Quick Ask and Doc Review use Helpful / Not helpful and revisions.
- `followupAfterDays` (14) after a Single Session outcome is `held`, a `followup` prompt asks the founder, for each action item: **Done**, **In progress** or **Didn't do**, plus an optional one-line "What happened?". One screen, one submit (`submit-followup`).
- Reminders at days 14, 17 and 21. After day 21 the follow-up is **overdue**: the milestone records "No follow-up", the founder's follow-up rate drops, and the founder is limited to `founderLimitedPending` (1) pending mentor request until they submit it (Phase 2). A late submission still counts and lifts the limit.
- Submitting notifies the mentor with the outcomes ("Maria tested your pricing advice: 12 of 50 users chose the paid plan").

### Quick Ask and Doc Review

- No scheduling. The mentor answers with an "Answer" or "Review" composer (`deliver-answer`), attached as evidence. This completes the `answer` or `review` milestone and frees the async slot.
- The founder marks it **Helpful** or **Not helpful** (`rate-answer`). Without an answer, it completes automatically after `asyncAutoCompleteDays` (5) as neither.
- Doc Review: the founder can log revisions within `revisionWindowDays` (14) (`log-revision`), which completes `revisions`.

### Upgrade to Ongoing Advisory or Single Session

- After Single Session, Quick Ask, Doc Review or Office Hours, either side can `propose-upgrade {format}` to a format in that format's `upgradeTo`. The other side answers with `accept-upgrade` or `decline-upgrade`.
- **Accepting re-checks the mentor's capacity** for the new format, exactly like Phase 2 accept. If it doesn't fit, the mentor sees the reason and the proposal stays open for `upgradeProposalDays` (7).
- On success the template switches, `ensureCycle` starts for Ongoing Advisory, and history is kept. There is no new request.

### Ongoing Advisory check-ins

- A cycle lasts `cycleWeeks` (8) and has `checkInsPerCycle` (4) check-ins of `checkInMinutes` (45), one every 2 weeks. `ensureCycle` reads these from `mentorConfig` instead of its hard-coded 8 weeks.
- At "Goals Defined", the founder proposes a regular time (weekday and time, in their time zone) and the mentor confirms it (`confirm-check-in-time`). That creates the cycle's check-ins as normal `schedules[]` entries, with the same attendance, reschedule and cancellation rules as any session.
- Capacity: the cycle's planned minutes are reserved at accept, and again when a cycle continues. They are spread over the months the check-ins fall in, so a mentor can't overbook before the check-ins are on the calendar. Accepting, upgrading or continuing is refused if the reservation doesn't fit.
- The number of check-ins is fixed when each cycle starts. A missed or cancelled check-in can be rescheduled within the same cycle, but no extra check-ins are added. The stage line shows held check-ins against that number ("2 of 4").

### Ending an engagement

- **One-off formats** (Quick Ask, Doc/Pitch Review, Single Session, Office Hours) end on their own when the review is done or its window closes. The room becomes read-only.
- **Ongoing Advisory** ends when either side chooses Finish at the end of a cycle (the existing `resolveCycleDecisions`), or when either side uses **End mentorship** (`end-mentorship {reason}`) at any time. Ending early cancels the remaining check-ins under the normal cancellation rules (late if a check-in is less than `lateNoticeHours` away) and opens the cycle review straight away.
- Either side can end an engagement on its own: v1 is volunteer work, so no agreement is needed. Moderators can close any room. The existing `close-room` action does this for mentorship rooms, and behaves the same as End mentorship.
- When an engagement ends, the mentee slot and any reserved hours not yet used are freed straight away. Minutes already used still count for their month.
- The other side is notified with the reason. Ending early is not counted against either side's trust, except for any late cancellations it causes.

### Mentor admin limit

Remove the generic Deal Room pieces from mentorship rooms: the per-milestone dispute flag, the evidence requirement on non-* milestones, the Terms tab and the "Launched" wording. Disagreements go through the attendance dispute only. The rule "the mentor's only required admin is to confirm the goal (and, for Ongoing Advisory, the check-in time), report attendance and rate" is checked by a unit test that lists every action the mentor must take to finish each format.

### Notifications added in this phase

- `session-reminder`: at 24 hours and at 1 hour, with links to the prep materials
- `prep-missing` (founder): 26 hours before the session, if prep is not shared
- `attendance-needed` (both): at session end, and again at 48 hours if not answered
- `session-disputed` (both and moderators)
- `rescheduled` and `cancelled` (partner)
- `followup-due` (founder): days 14, 17 and 21
- `followup-update` (mentor): "Maria tested your pricing advice — here's what happened"
- `upgrade-proposed`, `upgrade-accepted` and `upgrade-declined`
- `check-in-time` (mentor): the founder proposed a regular check-in time
- `engagement-ended` (partner): with the reason

### Done when

- [ ] Every v3 mentorship room migrates to v4 with milestones preserved.
- [ ] Silence from both sides 72 hours after a session resolves to `held`, and one-sided "partner-absent" becomes a no-show unless answered.
- [ ] A second reschedule by the same side is recorded as a late cancellation.
- [ ] An overdue follow-up limits the founder to 1 pending request, and submitting lifts it.
- [ ] An upgrade that would go over capacity is refused with a reason.
- [ ] The unit test for the mentor admin limit passes for all five formats.
- [ ] Accepting Ongoing Advisory reserves the cycle's minutes, and is refused when they don't fit.
- [ ] Ending an Ongoing Advisory early cancels the remaining check-ins and frees the slot and unused hours at once.

## Phase 4 — Office Hours and Calendar

### Slots

- Add `profiles.mentor.officeHours[] {id, weekday | date, time, durationMinutes (15|30|45|60), timeZone, recurring, closedDates[]}`.
- Slots are managed on `CalendarPage.jsx`: open, close, repeat weekly, and skip one date.
- **Opening a slot checks capacity.** The server refuses a new slot when the total minutes of open slots in any month would go over `monthlyHours` minus minutes already committed. The page explains it: "These slots would add 3 h in December, but you have 1.5 h left."
- Office Hours appear on the profile only if the mentor offers the `office-hours` format.

### Booking

- Founders book from the mentor's profile or Match Detail: pick a slot, fill in the short request form (problem and question, no format choice), and the room opens straight away with the `office-hours` template. There's no accept step, because the mentor already opened the slot.
- Booking re-checks COI, the founder's request limits and the mentor's capacity. A booked slot disappears for everyone else.
- Bookings count against monthly hours and the mentee limit from booking until attendance is resolved.
- Slots can be booked from `bookingMinLeadHours` (1) to `bookingMaxAheadDays` (30) ahead.
- Cancellations and reschedules follow the Phase 3 rules. When a mentor closes a slot that is already booked, it counts as a mentor cancellation, and the founder is offered the mentor's next free slots.

### Scheduling with availability

- `SchedulePanel.jsx` suggests times from the mentor's open office-hours slots and preferred hours instead of a fixed 09:00–15:00.
- Conflicts with any booked session of either side are checked on the server, which removes the note "Partner availability… not checked".
- All times are shown in the viewer's time zone, with the other side's zone in brackets when it is different.

### Calendar sync

- An `.ics` download for each session, plus a private ICS feed URL per account (`/api/calendar/{token}.ics`) with a "Reset link" action. The feed includes only the account's own sessions and never request content.
- Full two-way Google sync is out of scope for v1.

### Notifications added in this phase

- `booking` (mentor): a new office-hours booking
- `slot-closed` (founder): with the next free slots

### Done when

- [ ] A mentor cannot open more slot time in a month than their hours allow.
- [ ] Two founders racing for one slot result in one booking and one clear "Just taken" message.
- [ ] Times are correct for a mentor in Asia/Manila and a founder in another time zone.

## Phase 5 — Mentor Home, Active Mentees and Impact Profile

### Mentor Home

Rework `MentorHome.jsx` as the dashboard:

- the headline states the count, e.g. "3 requests waiting · 1 expires today"
- top-ranked requests come first and are the main feature, with Accept and Decline on each
- then today's sessions, prep status, attendance waiting for the mentor, and new follow-up outcomes
- the capacity meter (mentees, async and hours used against the limits), linking to Settings
- banners only when there's something to do: guidelines to accept, approval pending (Phase 6), Pause Mode on

### Mentees page

Add `src/pages/MenteesPage.jsx` (`#/mentees`), which groups active rooms by `mentorshipStage`. It reuses the identity and progress parts of the current MentorHome card. Each row shows the next thing the mentor has to do, or "Nothing needed from you".

### Impact

Add `src/pages/ImpactPage.jsx` (`#/impact`) and public profile sections. Stats come from an extended `trustSummary` (`collaboration.js`). Exact definitions, so they are computed the same way everywhere:

| Stat | Definition |
| --- | --- |
| Sessions held | Schedule entries with `outcome: "held"`, plus delivered Quick Asks and Doc Reviews |
| Founders helped | Distinct founders with at least one held session or delivered answer |
| Average rating | Mean of founder → mentor ratings. Shown only after `minDataPoints` (3) ratings. |
| Top-rated skills | The topics of the 3 highest-rated engagements |
| Follow-through rate | Action items marked Done ÷ action items with a submitted follow-up |
| Response rate | (Accepted + declined + referred) ÷ (all requests − returns caused by Pause Mode or blocking − requests the founder withdrew) |
| Average response time | Median hours from `sentAt` to the mentor's response |
| No-show rate | `no-show-mentor` and `no-show-both` outcomes ÷ resolved sessions (shown to the mentor and to admins; publicly only as "Reliable" when below 5%) |
| Late cancellations | Count in the last 90 days (mentor and admins only) |
| Testimonials | Opt-in: a new review field `testimonial` plus `testimonialPublic`, shown only when both the author and the mentor agree |
| Follow-up highlights | The latest 3 founder outcomes the founder marked shareable |

Shown on `ProfilePage` (public view) and on `MatchDetailPage` for founders. Each stat shows "Not enough data yet" until it has at least `minDataPoints` (3) data points.

### Founder track record (for mentors)

The same `trustSummary` gives founders: follow-up rate, average preparedness rating, no-shows and late cancellations. Mentors see it on request cards (Phase 2). Founders see their own on their profile, with tips to improve it.

### Two-way ratings

`ReviewPage.jsx` and the `review-form` reducer (`transitions.js`) ask different questions depending on who is rating:

- founder → mentor: usefulness, clarity, responsiveness (1–5 each), plus the optional testimonial
- mentor → founder: preparedness, follow-through (1–5 each)

Reviews stay blind, using the existing `response()` in `server/workspace.js`. Each window closes after `reviewWindowDays` (14). When a review opens depends on the format:

| Format | Reviews | Window opens |
| --- | --- | --- |
| Quick Ask, Doc/Pitch Review | One per room | When the answer or review is delivered |
| Single Session | One per room | When the session outcome is `held` |
| Office Hours | One per booking (each booking is its own room) | When the session outcome is `held` |
| Ongoing Advisory | One per 8-week cycle, using the existing `cycle.reviews` | When the cycle ends. It is the same review the cycle's Continue / Finish decision already asks for, with the questions above. There is no review per check-in. |

Each review counts once in the rating stats. A cycle review counts as one rating, however many check-ins the cycle had.

### Badges

Add a pure function `badgesFor(trust)` with thresholds from `mentorConfig.badges`:

- Mentors: **New Mentor** (approved, fewer than 3 sessions) → **Verified Mentor** (3 sessions, average 4.0 or higher) → **Top Mentor** (15 sessions, average 4.5 or higher, follow-through 60% or higher, response rate 80% or higher).
- Founders: **Prepared Founder** (2 engagements, preparedness 4.0 or higher, follow-up rate 75% or higher).

Badges appear wherever verification badges show. A badge is recalculated on every read, so it is lost when the numbers drop. Prepared Founder adds `preparedFounderBonus` (+3) to request ranking.

### Certificate

A printable `#/impact/certificate` view (print CSS) listing the mentor's name, period, sessions held, founders helped and total mentoring hours (sum of `durationMinutes` for held sessions plus `effortMinutes` for delivered async formats). In v1 every hour is volunteer time. There's no PDF dependency.

### Notifications added in this phase

- `review-open` (both): when the review window opens, and 3 days before it closes
- `badge` (both): when a badge is earned

### Done when

- [ ] Every stat matches its definition in a unit test with a fixed fixture.
- [ ] Stats with fewer than 3 data points show "Not enough data yet".
- [ ] A private testimonial never appears in a public view.

## Phase 6 — Stricter mentor onboarding and approval

### Signup

After the role step, mentors (and "both") go through a mentor flow built on the unused onboarding machine in `transitions.js`. Steps marked **required** must be done before submitting for approval. The rest can be finished later from Settings and Profile, and they raise profile completeness.

1. **Verification** (required): LinkedIn URL, work email, or an endorsing organisation. This extends `Verification.jsx`.
2. **Expertise tags** (required, at least 3 from the vocabulary).
3. **Capacity and time zone** (required, prefilled with the defaults).
4. **Formats** (required, at least one).
5. **Conflict-of-interest disclosure** (required: a list, or "I have no conflicts").
6. **Guidelines agreement** (required).
7. Experience summary (optional).
8. Preferences: stages and industries (optional).

Progress is saved after every step, so a mentor can leave and come back.

### Going live

- A new mentor profile is hidden from discovery until a moderator approves it. Approval reuses the verification queue in `ModerationPage.jsx`, with actions `approve-mentor` and `reject-mentor {reason}` (admin only), and records `mentorApprovedAt` and `mentorApprovedBy`.
- The queue is sorted oldest first and shows the waiting time. The target is `approvalTargetBusinessDays` (2), and entries older than that are highlighted.
- While pending, the mentor sees on Home: "Your profile is with our team. Most approvals take up to 2 business days. You can finish your profile meanwhile."
- A rejected mentor sees the reason and can edit and resubmit once.
- **Existing mentors are not locked out.** When this phase ships, every mentor with an existing mentor profile is backfilled as approved (`mentorApprovedBy: "migration"`). Demo mentors are approved.

### "Both" role

- A "both" user has two separate profiles, capacities and trust histories. Switching roles uses the existing role switch in `Sidebar.jsx`.
- The mentor profile goes live only after approval, while the founder profile works immediately.
- A user never sees, requests, refers or rates themselves, and their own startup is an automatic conflict (Phase 1).

### Notifications added in this phase

- `mentor-approved` and `mentor-rejected` (mentor)
- `approval-queue` (moderators): a daily summary when entries are past the target

### Done when

- [ ] A new mentor cannot receive requests before approval.
- [ ] Existing mentors keep working on the day this ships.
- [ ] Leaving signup half-way and coming back resumes at the same step.

## Phase 7 — Mentor safety rules

### No-shows and late cancellations

- Counted from Phase 3 attendance outcomes and shown in trust (Phase 5).
- `noShowLimit` (2) no-shows within `noShowWindowDays` (90) triggers a limit for `noShowLimitDays` (30):
  - founders: `founderLimitedPending` (1) pending mentor request at a time and no office-hours bookings
  - mentors: Pause Mode is switched on with `pausedUntil` set, and the mentor is told why
- Admins can lift a limit early from `ModerationPage.jsx` (`lift-limit`). Every limit and lift is logged.
- Disputed outcomes don't count until a moderator resolves them.

### No equity, and no payment requests

In v1 no payment of any kind is allowed between founders and mentors (spec §9).

- Add `src/data/safety-rules.js` with a rule-based check, `flagMessage(text)`, run on chat messages, request text and session notes. It flags:
  - equity asks ("% of your company", "equity", "shares", "advisory shares", "vesting")
  - payment asks ("pay me", "my rate", "fee", "GCash", "Maya", "bank account", "PayPal", payment links)
  - moving off the platform to arrange payment ("let's settle this outside", "message me on Viber/WhatsApp to pay")
- A flagged message is still sent, but the sender first sees a soft warning: "Synergy mentorship is free in this version. Asking for payment or equity breaks the mentor guidelines." The recipient sees a "Report" shortcut on the message.
- `flaggedMessageLimit` (3) flagged messages from one account within `flaggedMessageWindowDays` (30) put the account in the moderation queue automatically.
- Sharing contact details in general is not flagged. Only payment and equity asks are.

### Suspending a mentor

- New admin-only actions `suspend-mentor {reason, until?}` and `reinstate-mentor`, in `ModerationPage.jsx`. Both are logged with who, when and why. A suspension with no `until` is a permanent removal.
- Suspension is always a moderator's decision, usually after a report. Nothing triggers it automatically.
- While suspended:
  - the mentor is hidden from Discover and Matches, and `available` is false with `reason: "suspended"`
  - pending requests are returned to founders with alternatives, with no effect on the response rate
  - future booked sessions are cancelled and counted as mentor cancellations, and each founder is offered alternatives
  - active rooms close, and their founders are told to find another mentor, with alternatives
- The mentor is told the reason and, for a timed suspension, the end date. They can appeal once through the existing `report-form`.
- `sweep()` lifts a timed suspension on `until`. Reinstating does not reopen closed rooms.
- Notifications: `mentor-suspended` and `mentor-reinstated` (mentor), `mentor-unavailable` (affected founders, with alternatives). None are batched into the digest.

### Ratings

Inflation flagging reuses `ratingPattern` (`trustSummary`) and puts flags in the moderation queue. Examples: only 5-star ratings exchanged between the same two accounts, or reviews submitted within seconds of the window opening.

### Reporting

Confidentiality and block/report reuse the existing `report-form` and blocked collaborators. Both entry points appear in mentorship rooms, on request cards and on the mentor profile. Blocking a mentor or founder returns pending requests between them with no penalty to either side: the return does not count against the mentor's response rate.

### Done when

- [ ] Each flagged phrase in a fixture list is caught, and a list of normal sentences produces no flags.
- [ ] A second no-show within 90 days applies the limit, and an admin can lift it.
- [ ] Blocking from a request card works and returns the request.
- [ ] Suspending a mentor hides them, returns their requests, cancels their booked sessions and closes their rooms, with every affected founder notified.

## Phase 8 — Notification delivery, admin settings and launch readiness

This is what turns the MVP into something real users can rely on.

### Notification preferences and digest

- `SettingsPage` notifications section, mentor defaults: new requests as a **daily digest at `digestHour` (08:00)** in the mentor's time zone (switchable to instant), everything else instant.
- Never batched into the digest: session reminders, attendance, disputes, approvals and safety notices.
- `notificationDestination` (`src/data/notifications.js`) stops always saying "Open Deal Room" and labels the link by room type and target page ("Open request", "Open mentorship room", "Add your follow-up").

### Email delivery

- Replace `stubSender` in `server/delivery.js` with a real sender behind `EMAIL_PROVIDER` and its keys in `server/config.js` and `.env.example`. Keep the stub as the default for the demo and tests.
- Emails go out for: the request digest or instant requests, `accepted`, `session-reminder` (24 h), `attendance-needed`, `followup-due`, `mentor-approved` and `guidelines-required`. Each email has an unsubscribe link per kind.
- Emails never include request content, only "Maria sent you a mentorship request" and a link.

### Admin settings

- Add a "Mentoring" section to the admin area in `ModerationPage.jsx` to edit `mentorConfig`, with validation (for example `freeReschedulesPerSide` 0–3) and a change log (who, when, old and new value).
- The moderation queue gains filters for: mentor approvals, session disputes, safety flags, rating flags and active limits.

### Privacy and data

- A scheduled job in `sweep()` deletes request content after `requestContentRetentionDays` as described in "Principles".
- Account deletion removes mentor profile data, office hours, notes the user wrote and unshared request content. Trust stats are kept anonymised so the other side's history stays correct.
- A short privacy notice for mentorship in `docs/product/MENTOR-GUIDELINES.md` and in the request form ("Who sees this").

### Metrics and the v1.1 gate

Add a small admin metrics view (in `ModerationPage.jsx`) computed from existing data:

| Metric | v1.1 entry gate |
| --- | --- |
| Approved mentors who accepted at least 1 request in the last 30 days | 20 or more |
| Mentor 60-day retention (active 60 days after approval) | 50% or more |
| Request response rate (all mentors) | 70% or more |
| Sessions held without dispute | 90% or more |
| Founder follow-up submission rate | 50% or more |
| Mentors who said in a survey they would charge for at least one format | 30% or more |

v1.1 starts when every gate is met for 4 weeks in a row. Until then, the team improves the free product. The survey is one optional question in the mentor Settings page ("Would you charge for any format if Synergy handled payments?").

### Done when

- [ ] Real email delivery works in staging and the stub still works in tests.
- [ ] A config change shows in the change log and takes effect without a deploy.
- [ ] Deleting an account removes the data listed above.
- [ ] The metrics view matches hand-computed numbers on a fixture.

---

## Future (after v1.1)

- **Partner programmes**: accelerators, universities and companies pay for a cohort space where their mentors and founders are matched, with impact reports for the organisation. This builds on the "endorsing organisation" step of Phase 6 and the certificate in Phase 5.
- Mentor community space, Group Office Hours (free or paid), session bundles and subscriptions, multi-currency pricing, smarter matching with embeddings, and two-way calendar sync.

---

## v1.1 — Paid mentorship

Starts only when the Phase 8 gates are met. Phase P1 ships with the simulated provider. Phase P2 connects the real provider and has its own release gate. When v1.1 starts, update spec §3 ("Why mentors join") and §9 (the v1 rule on payment requests) and the mentor guidelines to version 2.

## How paid mentorship works

- Mentors can offer each format **free or paid**. A price of 0 means free, and volunteering stays fully supported.
- **Founders buy a format, not a mentor.** A mentor might offer a free Quick Ask and a paid Single Session. A free Quick Ask that goes well can lead to a paid upgrade.
- **Request, accept, then pay.** The mentor still accepts or declines every request. The founder pays only after the mentor accepts. Office Hours are the exception: the founder pays when booking, because the mentor already opened the slot.
- **The provider holds the payment** and releases it to the mentor's sub-account, minus the platform fee, once the session outcome is `held`. Synergy instructs the provider and never holds the money itself.
- **Fit decides ranking.** Price is shown on every mentor, but it never changes the match score, so free mentors are not pushed down.

## Phase P1 — Payments with the simulated provider

### Pricing

- The "Mentoring" settings section gains a price for each offered format: Free, or an amount between `minPrice` (₱300) and `maxPrice` (₱10,000).
- Limits live in a new `src/data/pricing.js`, editable from the admin settings:

  ```js
  { currency: "PHP", platformFeeRate: 0.15, minPrice: 30000, maxPrice: 1000000,
    paymentWindowHours: 48, paymentReminderHours: 12, slotHoldMinutes: 15,
    cycleRemainderReleaseDays: 7, paymentDisputeBusinessDays: 5 }
  ```

- A mentor can set a price above 0 only after payout setup is complete (see "Payouts").
- Price changes apply only to new requests and new cycles. Pending requests, unpaid rooms and running cycles keep their saved price.
- Changes to the server rule from v1: `normalizeMentorFormats` now accepts prices within the limits and still forces 0 for mentors without payout setup.

### Fee and payout math (`src/data/pricing.js`)

All amounts are integers in centavos. `split(price, rate)` returns `{ amount: price, fee: Math.round(price × rate), payout: price − fee }`. The fee is rounded to the nearest centavo, and the payout absorbs any rounding so `fee + payout === amount` always. Unit tests cover every format's minimum and maximum price.

### Showing prices

- The price appears on `MatchCard`, `MatchDetailPage`, the request form, the Requests Inbox and the Goal card, as "Free" or the formatted amount ("₱1,500").
- `DiscoverPage.jsx` adds a "Free only" filter and a maximum-price filter.
- Ranking is unchanged: price never enters `scoreProfile`. A unit test checks that changing a price never changes a score.

### Checkout

- When a mentor accepts a paid request, the room opens with `payment.status: "due"`. The founder sees a payment panel (`CheckoutPanel.jsx`). The mentor sees "Waiting for payment".
- Accepting reserves the mentor's capacity, so a slot can't be taken twice.
- The founder has `paymentWindowHours` (48) to pay, with a reminder 12 hours before the end. If they don't pay, `sweep()` closes the room as `cancelled` with the reason `payment-lapsed`, frees the capacity and notifies both sides.
- A lapsed payment counts like a late cancellation in the founder's trust. Two lapses in 90 days apply the founder no-show limit from Phase 7.
- `mentorshipStage` shows "Awaiting payment" right after Accepted, or after Booked for Office Hours.
- Free formats skip all of this and work exactly as in v1.

### Payment record

Add to the room:

```js
payment: {
  status: "due" | "held" | "released" | "refunded" | "partially-refunded" | "disputed" | "lapsed",
  amount, fee, payout, currency,
  providerRef, checkoutRef,
  dueBy, paidAt, releasedAt, refundedAt,
  refundAmount, releaseAmount,
  history: [ { at, from, to, by, reason } ],
}
```

- The server computes `amount`, `fee` and `payout` from the price saved with the request. The client never sends an amount.
- Every status change is appended to `payment.history`, recorded in the room history and mirrored to both sides.
- A payment changes status only on the server, inside `act()`, `sweep()` or a verified provider webhook. Each change is idempotent, keyed by `providerRef` and the target status.

### When the payment is released

| Format | Release |
| --- | --- |
| Single Session, Office Hours | When the session `outcome` becomes `held` (Phase 3 attendance, including the 72-hour automatic confirmation) |
| Quick Ask, Doc/Pitch Review | When the founder marks the answer Helpful, or automatically `asyncAutoCompleteDays` (5) after delivery if the founder hasn't rated it. When the founder marks it Not helpful, the payment stays held for another `asyncAutoCompleteDays` (5), during which the founder can open a dispute. If no dispute is opened, it is then released. |
| Ongoing Advisory | Priced per 8-week cycle and charged when each cycle starts (in `ensureCycle`, and on Continue in `resolveCycleDecisions`, which shows the current price before the founder chooses Continue). The cycle amount is split evenly across the cycle's `checkInsPerCycle` check-ins (fixed when the cycle starts) and released per check-in with outcome `held`. Anything left is released `cycleRemainderReleaseDays` (7) after the cycle ends, unless a dispute is open. Choosing Finish stops further charges. |

### Refunds, reschedules and disputes

| Situation | Result |
| --- | --- |
| Mentor no-show (`no-show-mentor`) | Full refund to the founder |
| Both sides missed (`no-show-both`) | Full refund to the founder. The mentor did not deliver the session. |
| Ongoing Advisory ended early (End mentorship, close or suspension) | The share for check-ins not held is refunded to the founder, except check-ins the founder cancelled late, which the mentor is paid for |
| Mentor cancels, at any time | Full refund |
| Mentor never delivers a Quick Ask or Doc Review within `responseDays` after payment | Full refund, and the room closes |
| Founder cancels 24 hours or more before the session | Full refund |
| Founder cancels less than 24 hours before, or doesn't show (`no-show-founder`) | The mentor is paid in full |
| Free reschedule (1 per side, 24 hours' notice or more) | No money changes. The payment stays held. |
| Late or second reschedule by the founder | Treated as a late founder cancellation: the mentor is paid. The founder may book again by paying again. |
| Late or second reschedule by the mentor | Treated as a mentor cancellation: full refund, unless the founder accepts the new time |
| Attendance `disputed`, or a founder dispute on an async format | `payment.status: "disputed"`. A moderator releases it, refunds it, or splits it (`resolve-payment-dispute {release, refund}` in centavos, summing to the amount) within `paymentDisputeBusinessDays` (5) |

- Each paid room has a single payment dispute, which replaces the per-milestone dispute removed in Phase 3.
- Refunds of the platform fee: on a full refund the founder gets the full amount back and Synergy absorbs any provider fee. On a split, the fee is taken only from the released part.

### Provider adapter

Add `server/payments.js`, an adapter with these operations:

```js
{ createCheckout, getCheckout, release, refund,
  startPayoutSetup, payoutStatus, verifyWebhook }
```

- `simulated` is the default for the demo and tests. Its checkout page says "Simulated payment. No money moves." and has buttons for success, failure and expiry, so every path can be tested.
- Checkout is hosted by the provider, so card and e-wallet details never reach Synergy's servers.
- Provider webhooks arrive at `POST /api/payments/webhook`, are verified with `verifyWebhook` before anything changes, are stored with their event id, and are ignored when repeated.

### Payouts

- A "Payouts" section in Settings (`PayoutSettings.jsx`) shows the mentor's payout setup status, the amount currently held, the total released and the payout history.
- Earnings stay private and never appear on the public Impact Profile.
- Founders get a downloadable receipt for each payment, showing the amount, the platform fee and the mentor's name.

### Upgrades

When `accept-upgrade` (Phase 3) targets a paid format, it creates a payment for that format. The template switches once the payment is held. If the payment lapses, the room stays on the old format.

### Impact and certificate changes

- Free and paid engagements count the same towards every stat, and earnings are never shown.
- The certificate lists volunteer (free) hours and paid hours separately, and the volunteer total counts free hours only.
- Founder → mentor ratings add "value for money" in paid rooms.

### Safety changes

- Mentor guidelines version 2: payment is allowed **only** through Synergy's checkout.
- `flagMessage` keeps flagging equity asks and off-platform payment asks (bank or e-wallet details, "pay me directly", outside payment links), now with the copy "Payments for mentorship must go through Synergy so both sides are protected."

### New actions

Added to the `features.act()` allow-list: `set-format-price`, `pay`, `confirm-delivery`, `open-payment-dispute` and `resolve-payment-dispute` (admin only). Plus the webhook route.

### Notifications added in this phase

- `payment-due` (founder), with a reminder 12 hours before the window closes
- `payment-lapsed` (both)
- `payment-received` and `payout-released` (mentor)
- `refund` (founder)
- `payment-dispute` (both and moderators)

Payment notifications are never batched into the digest, and each one is also sent by email.

### Done when

- [ ] Every row of the release and refund tables has a unit test with the simulated provider.
- [ ] `fee + payout === amount` for every price from `minPrice` to `maxPrice` in a property test.
- [ ] Replaying a webhook does not change anything a second time.
- [ ] Price never changes `scoreProfile`.
- [ ] The full paid journey passes in Playwright: request → accept → pay → session held → payout released, plus a mentor no-show refund and a moderator split.

## Phase P2 — Real provider (separate release)

Release gate. Every item must be true before any real money moves:

- [ ] Provider contract signed for a marketplace product where the provider holds funds and pays out to sub-accounts (Xendit xenPlatform first choice, PayMongo as fallback). Confirmed in writing that Synergy does not need its own e-money or escrow licence for this setup.
- [ ] A Philippine lawyer has reviewed the payment flow, the refund policy and the terms of service.
- [ ] An accountant has confirmed the tax treatment of the 15% platform fee, the official receipts Synergy must issue for it, and what mentors are told about declaring their income.
- [ ] Mentor identity verification (KYC) for payouts is handled by the provider during `startPayoutSetup`.
- [ ] Terms of service and the refund policy are published and accepted by both sides before their first paid engagement.
- [ ] `PAYMENTS_PROVIDER` and its keys are set in `server/config.js` and `.env.example`. Production keys live only in the host's secret store.
- [ ] Webhook signature verification has been tested against the provider's sandbox, including replay and out-of-order events.
- [ ] A reconciliation job compares Synergy's payment records with the provider's report every day and alerts admins on any difference.
- [ ] One full end-to-end transaction with real GCash and card payments in the provider's live mode, refunded afterwards.

---

## Critical files

**Server**

- `server/workspace.js`: `capacityUsage`, `similarMentors`, scoring, `person()`, `act`, `sweep`, `mirror`, migrations
- `server/features.js`: new actions and forms, notifications
- `server/delivery.js`: real email sender (Phase 8)
- `server/demo-directory.js`: demo mentors with capacity, formats, conflicts, office hours and impact history (a mix of free and, from v1.1, paid)
- `server/config.js` and `.env.example`: email provider (Phase 8), payment provider (v1.1)
- new in v1.1: `server/payments.js`

**Data**

- `src/data/model.js`, `src/data/mentorship.js` (`mentorConfig`, `mentorshipStage`, `requestQuality`, `resolveAttendance`, `conflictWith`, `badgesFor`), `src/data/collaboration.js`
- `src/data/matching.js`, `src/data/engagement-templates.json`, `src/data/mentor-formats.js`, `src/data/notifications.js`
- new: `src/data/request-assistant.js`, `src/data/mentor-guidelines.js`, `src/data/safety-rules.js`, and in v1.1 `src/data/pricing.js`

**State**

- `src/state/transitions.js`, `src/state/routes.js`, `src/state/AppContext.jsx` (`remoteActions`)

**Pages and components**

- `src/pages/RoomDetailPage.jsx`, `MatchDetailPage.jsx`, `WaitingPage.jsx`, `SettingsPage.jsx`, `ProfilePage.jsx`, `CalendarPage.jsx`, `ReviewPage.jsx`, `DiscoverPage.jsx`, `ModerationPage.jsx`, `SignupPage.jsx`, `OnboardingPage.jsx`
- new pages: `RequestsPage`, `MenteesPage`, `ImpactPage`
- `src/components/MentorHome.jsx`, `MatchCard.jsx`, `Sidebar.jsx`, `MobileMenu.jsx`, `SchedulePanel.jsx`, `TaskBoard.jsx`, `DeclineIntroduction.jsx`, `Verification.jsx`, `ChatPanel.jsx`
- new components: `MentorRequestForm`, `GoalCard`, `PrepChecklist`, `SessionNotes`, `AttendancePanel`, `FollowupForm`, and in v1.1 `CheckoutPanel`, `PayoutSettings`

**Docs:** `docs/product/MENTOR-GUIDELINES.md` (new), `docs/testing/TEST-CASE-RUNTHROUGH.md`, `README.md`

**Styles:** `src/mentorship.css` and `src/theme.css` (factor tokens only)

## Order and size

| Phase | Name | Depends on | Size | Release |
| --- | --- | --- | --- | --- |
| 0 | Foundation | — | S | v1 (done) |
| 1 | Profile, capacity, Pause Mode, COI, guidelines | 0 | M | v1 |
| 2 | Requests and inbox | 1 | L | v1 |
| 3 | Format ladder, room, attendance, follow-up | 2 | L | v1 |
| 4 | Office Hours and Calendar | 1, 3 | M | v1 |
| 5 | Home, Mentees, Impact, ratings, badges | 3 | M | v1 |
| 6 | Mentor onboarding and approval | 1 | M | v1 |
| 7 | Safety rules | 3, 5 | S | v1 |
| 8 | Delivery, admin settings, launch readiness | 2–7 | M | v1 |
| P1 | Paid mentorship, simulated provider | 8 and the v1.1 gates | L | v1.1 |
| P2 | Real payment provider | P1 and the release gate | M | v1.1 |

- Build 1 → 2 → 3 in order. They form the core loop.
- After Phase 3, Phases 4, 5 and 6 can run alongside each other. Phase 7 follows Phase 5. Phase 8 comes last in v1.
- v1 can go to real users after Phase 8. Phases 4 and 5 are part of the MVP, because Office Hours and the Impact Profile are what the spec promises mentors.

## Verification (for each phase)

- `npm run test:unit` covers reducers and helpers:
  - `capacityUsage` for every row of the "What uses capacity" table, `requestQuality`, `similarMentors`, `conflictWith`, `mentorshipStage`, `resolveAttendance` for every row of the attendance table, `badgesFor`, `flagMessage`
  - pending limits, founder request limits, cooldown by decline reason, expiry by `responseDays`, Pause Mode returns
  - format migration from v3 to v4, and plain format lists normalized to `{id, price: 0}`
  - the mentor admin limit for all five formats
  - every server-owned field ignored when sent by the client
  - v1.1: fee and payout math, the saved price, each release trigger, each refund rule, payment lapse, upgrades to a paid format, webhook replay, and that price never changes `scoreProfile`
- `npx playwright test tests/mentorship.spec.js` plus a new spec per phase: `mentor-capacity.spec.js`, `mentor-requests.spec.js`, `mentor-room.spec.js`, `office-hours.spec.js`, `mentor-impact.spec.js`, `mentor-onboarding.spec.js`, `mentor-safety.spec.js`, and in v1.1 `mentor-payments.spec.js`. Each runs both directions (founder starts, mentor starts), axe checks, and the 4-width layout check.
- Existing suites must stay green: `tests/founder-completion.*`, `workspace.test.js`, `features.*`, `mentor-formats.test.js`.
- Manual run with the `run` skill:
  1. Open the demo as a mentor: `POST /api/demo {role:"mentor"}`.
  2. Walk Journey B from the spec end to end: request → sharpen → accept → prep → session held (both report) → action items → follow-up → blind ratings → upgrade to Ongoing Advisory.
  3. Check the edge paths: Pause Mode returning requests, a decline with `no-slots`, a referral, an expiry with alternatives, a one-sided no-show, a dispute resolved by a moderator, a late reschedule, an overdue follow-up.
  4. v1.1: walk it again with a paid format and the simulated provider: request → accept → pay → session held → payout released. Then check a mentor no-show (full refund), a payment lapse and a disputed session split by a moderator.
- Update `docs/testing/TEST-CASE-RUNTHROUGH.md` with a test case for each new flow, including the missing ones for ongoing cycles and expiry, and update the `README.md` feature list.
