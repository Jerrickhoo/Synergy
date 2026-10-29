# Synergy UX improvement roadmap

Prepared October 29, 2026. Status: implementation in progress.

Progress: **Phases 0–4 completed October 29, 2026.** See the [workflow review](docs/ux/PHASE-0-REVIEW.md), [visual reference](docs/ux/visual-reference.html), [Phase 1 delivery and verification](docs/ux/PHASE-1-DELIVERY.md), [Phase 2 delivery and verification](docs/ux/PHASE-2-DELIVERY.md), [Phase 3 delivery and verification](docs/ux/PHASE-3-DELIVERY.md), and [Phase 4 delivery and verification](docs/ux/PHASE-4-DELIVERY.md). Phases 5–6 remain planned.

## Outcome and scope

Make Synergy easier to understand at first glance, more consistent across screens, and appropriate for both founders and mentors. This plan covers all 18 feedback items, including the workflow review of the mentor side.

The original roadmap was based on source review. Phase 0 added browser baselines and a reciprocal founder/mentor walkthrough; Phase 1 implemented the shared UI changes; Phase 2 implemented discovery improvements, image avatars, and a varied demo directory; Phase 3 reorganized Match details, role-specific profiles, and Updates with stable event timing; Phase 4 delivered the calendar overview and a shared session planner with timezone-safe recurring schedules. Existing uncommitted work has been preserved. The specifications below remain the reference for subsequent phases.

Recommended sequence: review mentor workflows and establish visual rules; fix shared controls and feedback; improve discovery with realistic data; redesign details, profiles and updates; improve calendar and scheduling; complete mentor-specific workflows; verify both roles end to end.

## What the code establishes

| Finding                                                                                                                  | Implementation consequence                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `Avatar.jsx` renders initials only.                                                                                      | Photos require an image field in the profile/directory contract as well as a UI change.               |
| `server/demo-directory.js` contains six fictional profiles: three mentors and three startups.                            | Extend the existing demo system rather than introduce a second source of sample accounts.             |
| Suggested discovery currently requires at least 30% fit, excludes existing-room partners, and takes up to 12 candidates. | Keep low-fit candidates visible in Browse all; explicitly test suggestions versus directory behavior. |
| The introductory Matches banner is unconditional once people exist.                                                      | Replace it with contextual help or remove it for established users.                                   |
| The control beneath Suggested for you is a sort selector.                                                                | Distinguish sorting from the Suggested/Saved/Browse all tabs and from filters.                        |
| `AppContext.jsx` publishes a connection-error toast while `App.jsx` renders a connection banner.                         | Give outage feedback one owner; a cosmetic toast change alone will not fix duplication.               |
| `Topbar.jsx` already opens the profile from the account button.                                                          | Remove the redundant sidebar destination and check mobile access.                                     |
| The Settings icon has radial lines around a circle.                                                                      | Replace its geometry with a recognizable cog while preserving the existing icon API.                  |
| `WorkspaceCalendar.jsx` serves a month grid used by the calendar page and scheduling.                                    | Give overview and date-picker contexts separate presentation variants.                                |
| Updates have kinds and timestamps, but generated suggestions/reminders receive a current timestamp during preparation.   | Stable event timing is needed before reliable date grouping and relative-time labels.                 |

## Design direction

Use the current Synergy identity as the starting point. Make hierarchy come primarily from type, spacing, grouping, and surface contrast. Use shadows for overlays and selected elevated elements; adding shadows to every card will not solve the readability problem.

- A restrained page background, clear content surfaces, and a distinct treatment for primary actions.
- Consistent heading sizes, body text, metadata contrast, spacing, border radius, and control heights.
- Green as the brand/action accent; status icons and words communicate success, warning, and failure.
- A small set of reusable patterns: identity header, section panel, metadata row, action panel, update row, select control, toast, and empty state.
- Visible keyboard focus, adequate contrast, reduced-motion support, and readable layouts at desktop and mobile widths.

## Delivery phases

Estimates are planning ranges for one developer doing design and implementation, with timely feedback. They include focused verification but exclude major new backend integrations. Some discovery can overlap; do not add individual ticket estimates to these totals.

| Phase                                  | Effort   | Deliverable                                                                | Dependency                               |
| -------------------------------------- | -------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| 0. Baseline and mentor workflow review | 1–2 days | Screenshots, role journey map, mentor gap list, selected visual direction  | Start here                               |
| 1. Shared UI and immediate fixes       | 3–4 days | Logo assets, login treatment, controls, navigation, toast and outage fixes | Phase 0 direction                        |
| 2. Matches and demo coverage           | 3–5 days | Mixed avatars, varied directory, clearer discovery controls                | Shared controls and avatar contract      |
| 3. Details, Profile and Updates        | 4–6 days | Readable information hierarchy and consistent actions                      | Shared patterns; mentor field decisions  |
| 4. Calendar and scheduling             | 4–6 days | Proportioned calendar overview and focused session picker                  | Mentor scheduling rules; shared controls |
| 5. Mentor-specific implementation      | 4–6 days | Role-appropriate home, discovery, requests and mentorship lifecycle        | Phase 0 decisions; Phases 2–4 patterns   |
| 6. Integration and release review      | 2–3 days | Verified founder/mentor flows and completed acceptance checklist           | All phases                               |

Total: approximately 21–32 working days, or about 5–7 working weeks allowing for feedback. Re-estimate after Phase 0 if the mentor review calls for new availability, capacity, or session-state data models.

### Phase 0 — establish the baseline and mentor requirements

1. Walk through Founder and Mentor from login to discovery, introduction, room, scheduling, completion, and review.
2. Capture desktop and mobile baselines for every screen mentioned in the feedback.
3. Record hierarchy problems: unclear primary action, competing headings, excessive text, missing grouping, and disproportionate sections.
4. Produce founder-versus-mentor journey maps. Identify misleading copy, irrelevant fields, unsupported actions, and missing states.
5. Prepare a small visual reference sheet: logo applications, identity header, one match card, select, toast, calendar overview, and session picker.
6. Select the logo direction and mentor workflow before implementing the dependent screens. Keep these as focused design decisions, not separate approval gates for every small fix.

Exit criteria: every feedback item has a target behavior; mentor requirements are separated into existing-feature corrections and optional new capabilities.

### Phase 1 — shared UI and immediate fixes

**F01 — Finalize the logo.** Refine the existing linked mark and wordmark as the default direction. Check silhouette, spacing, optical alignment, and small-size legibility. Prepare full lockup, compact mark, monochrome and light/dark variants; align the favicon. Test at favicon, navigation, and login sizes. A replacement concept is appropriate only if refinement fails the identity review.

**F02 — Add a login background.** Use a restrained branded illustration or abstract connection motif with a quiet form surface. Keep sufficient contrast around inputs and errors. On small screens, simplify or crop the artwork so the form remains the focus. Decorative artwork must not intercept interaction or be announced as meaningful content. Prefer lightweight SVG/CSS for abstract shapes; use an optimized raster asset if the selected direction requires photography or illustration.

**F07 — Improve dropdowns throughout the app.** Inventory discovery, filters, profile forms, collaboration type, calendar, schedule, settings, and prototype-role controls. Standardize label spacing, height, border, chevron, selected value, disabled state, error state, and focus. Use styled native selects where platform behavior is desirable. If the opened desktop option list must be custom, use an accessible listbox/combobox implementation with arrow keys, Escape, type-ahead, focus return, and viewport-safe positioning. Do not build an ad hoc clickable list.

**F08 — Replace the toast's colored left border.** Use a neutral surface, uniform subtle border, restrained shadow, status icon, concise message, and close button. Status color may appear in the icon, without a colored edge stripe. Preserve hover/focus pause, error persistence, and appropriate alert/status announcements.

**F13 — Remove redundant Profile navigation.** Remove Profile from the sidebar navigation list. Keep the current top-right account button as the primary profile entry; the feedback mentions both top-left and top-right, so follow the existing location unless the shell is deliberately redesigned. Verify that the mobile account control remains visible and usable after the shared navigation list changes. Keep the profile route and direct links working.

**F16 — Use a gear for Settings.** Replace the radial icon with a recognizable cog using the same size and stroke style as neighboring icons. Apply it wherever Settings appears.

**F17 — Show one connection interruption notice.** Prefer one persistent banner while disconnected, because the condition remains relevant until recovery. Suppress the duplicate global outage toast. Deduplicate repeated polling failures and clear the banner on successful recovery. Keep operation-specific failures meaningful: a failed save can have an inline message, but must not create a second generic outage popup. Do not say an unsaved edit is safe or saved unless persistence is confirmed.

Acceptance: a simulated outage produces one global notice across repeated polls; reconnecting clears it; a subsequent separate outage can be reported again. Login, navigation, selects, and ordinary success/error feedback remain keyboard-operable.

Primary files: `src/components/Brand.jsx`, `Login.jsx`, `Sidebar.jsx`, `MobileMenu.jsx`, `Topbar.jsx`, `Icon.jsx`, `Toast.jsx`; `src/App.jsx`; `src/state/AppContext.jsx`; `src/state/feedback.js`; shared styles; `public/favicon.svg`.

### Phase 2 — Matches and realistic demo coverage

**F03 — Mix image avatars and letter fallbacks.** Extend the shared avatar to accept an image, name, fallback, and consistent size. Use fictional mentor portraits and startup marks for some samples; leave others image-free. Missing and failed images must fall back without broken-image icons or layout shift. Carry the image reference through demo data and directory serialization, then reuse it in cards and match details. Keep fallback behavior consistent in other identity surfaces. User-uploaded avatars can be a separate extension if needed; they are not required to demonstrate this feedback.

**F04 — Rework “Start with a profile.”** Remove the unconditional banner. For an incomplete profile, show a compact prompt identifying the missing information and a clear edit action. For a completed profile, use only the page introduction. If first-use guidance is retained, make it dismissible and explain the actual sequence: browse, introduce yourself, agree on a collaboration.

**F05 — Clarify discovery sorting.** Use a visible “Sort by” label with “Highest fit,” “Name,” and “Completed collaborations.” Keep Suggested/Saved/Browse all as list tabs and Filters as criteria. Make the selected sort clear, prevent long values from clipping, and preserve existing selection behavior across pagination.

**F09 — Improve “How the score works” hover.** Treat the icon and text as one button. Replace the underline with a soft background or restrained glow around the entire control. Provide an equally clear focus-visible state and a usable touch target. Avoid pulsing animation. Preserve the explanatory dialog.

**F10 — Expand demo accounts and match variety.** Target an initial directory of about 24 fictional profiles, for example 14 startups and 10 mentors. Include varied industries, stages, expertise, goals, and image availability. Choose fixture inputs that produce high, medium, low, and zero/near-zero fit for reference accounts using the real matching algorithm; do not hardcode display scores.

Create reference viewer scenarios for a founder with many suggestions, a founder with one or two, a founder with none, and a mentor with a sparse set. “Few/no matches” is interpreted as both low-fit directory candidates and viewers with few/no suggestions. Do not invent a public match-count badge without a separate product need.

Verify Browse all includes eligible low/zero-fit profiles; Suggested respects its threshold; minimum-fit filters still work; Saved remains usable. Seed only in the existing demo scope. Use stable IDs and a versioned refresh strategy for untouched fixtures: the current startup seeding skips existing IDs, so editing the fixture file alone will not update old sample accounts. Preserve user edits and existing references; do not reset the working database. Do not fabricate reviews or completed collaborations to make samples look credible.

**F11 — Simplify filter action text.** Set the button label to exactly **“Show matches”**. Retain useful result counts in the results header, outside this button. Verify apply, reset, cancel, reopening, and zero-result behavior.

Acceptance: both roles can demonstrate image and fallback avatars, useful suggestions, weak directory fit, no suggestions, no filter results, and pagination. Sorting and filtering remain separate and understandable.

Primary files: `DiscoverPage.jsx`, `MatchCard.jsx`, `Avatar.jsx`, `src/data/filters.js`, `src/data/model.js`, `server/demo-directory.js`, `server/workspace.js`, `src/discovery.css`, `src/match-overlays.css`.

### Phase 3 — readable Match details, Profile and Updates

**F06 — Match details.** Organize the page into an identity header, brief summary, relevant expertise/needs, experience and trust, fit explanation, and action panel. Give the person or startup name more prominence than the generic page title. On desktop, keep the primary action easy to find in a secondary column; on mobile, place it near the identity summary without covering content.

Summarize matching in plain language, with numerical factor details available in an expandable section. Keep provisional-fit caveats understandable and move internal algorithm-version information out of the main reading flow. Distinguish actual zero fit, missing information, and unavailable factor data; avoid generic fallback bars suggesting positive evidence. Preserve introduction, pending, incoming, saved, and existing-room states.

**F14 — Profile.** Separate profile viewing from editing. Use a clear identity header, meaningful completion guidance, and distinct About, Offers/Expertise, Needs/Goals, Availability, and History sections as appropriate to the role. In edit mode, group related fields, explain optional fields, and keep Save/Cancel easy to locate. Preserve existing draft behavior, field validation, and data on failed saves. Empty history should read as a new profile, not as an error.

Mentor profiles should lead with expertise, relevant experience, preferred startup stages/sectors, and availability. Founder profiles should lead with the startup, stage, current goals, and requested help. Avoid showing irrelevant fields merely to keep layouts identical.

**F15 — Updates.** Replace the undifferentiated text list with consistent rows: event icon or identity, concise primary text, secondary context, time, read state, and a relevant action. Add All/Unread filtering and date groups such as Today, Yesterday, and Earlier when timestamp semantics are reliable. Use an unread dot plus text/weight/surface treatment, so color is not the only distinction. Keep Mark all as read and individual read actions.

First fix stable timestamps for generated notifications: record first-seen/created time or derive a stable event time, and keep due/session time separate. Recomputing a notification must not make it appear newly created on every poll. Preserve read state through refresh and keep the header preview consistent with the full Updates page. Missing or inaccessible destinations need clear fallback behavior.

Acceptance: a quick scan identifies who the profile belongs to, what help is relevant, why the match was suggested, and the next action. Updates remain distinguishable with long messages, mixed kinds, and many unread items.

Primary files: `MatchDetailPage.jsx`, `ProfilePage.jsx`, `NotificationsPage.jsx`, `Topbar.jsx`, `TrustSummary.jsx`, `ProfileStats.jsx`, `server/features.js`, shared styles.

### Phase 4 — calendar and scheduling

**F12 — Use familiar calendar interaction patterns.** The workspace overview and session picker serve different tasks and should have different proportions.

For the workspace overview, use a compact toolbar with Today, previous/next, month/year, and collaboration filter. Remove or greatly reduce the large decorative hero so the calendar is visible earlier. Use seven equal columns, aligned weekday labels, stable rows, clearly different today/selected states, and compact event labels with overflow handling. Keep a selected-day agenda beside the grid on desktop and below it on mobile. Start with Month and Agenda; add a time-grid Week view only if the workflow review establishes a need.

For scheduling, use a focused date → time → confirmation sequence. Place the compact month picker beside the time list on wide screens and stack them on narrow screens. Show session duration, timezone, selected date/time, and meeting context before confirmation. Suggested times must not imply verified partner availability when no availability or conflict-checking system exists. Retain current recurring-session behavior and meeting-link workflow.

Google Calendar documents distinct day/week/month/schedule views, a useful reference for separating overview modes: [Google Calendar view guidance](https://support.google.com/calendar/answer/6110849?hl=en). Calendly's timezone guidance is useful for making the scheduling timezone explicit: [Calendly time zones overview](https://d35pdk54ela7r.cloudfront.net/help/time-zones-overview). These inform interaction structure; Synergy retains its own identity and local scheduling scope.

Acceptance: verify months with four, five, and six occupied weeks; month/year boundaries; today versus selection; empty and busy dates; multiple events; keyboard navigation; and small screens. Session times must remain correct across timezones, while date-only deadlines retain their defined semantics, including UTC milestone dates. Calendar event links must open the correct room and tab.

Primary files: `CalendarPage.jsx`, `WorkspaceCalendar.jsx`, `SchedulePanel.jsx`, `src/data/planning.js`, `src/planning.css`.

### Phase 5 — mentor experience rework

**F18 — Make mentorship a coherent role-specific workflow.** The following is the proposed direction, to be validated in Phase 0.

| Area            | Proposed mentor behavior                                                                              | Acceptance                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Home            | Prioritize introduction requests, upcoming sessions, active mentees, and follow-up actions.           | A mentor can identify the next task immediately, including when there is no activity.                    |
| Profile         | Lead with expertise, experience, startup interests, and availability.                                 | Mentor fields and completion guidance describe mentoring rather than startup exchange.                   |
| Matches         | Emphasize startup needs, stage, goals, and where mentor expertise applies.                            | Mentor discovery offers relevant startups and no invalid exchange actions.                               |
| Introductions   | Show the startup's request and goals, with accept, decline, and pending states.                       | Both parties see consistent state after acceptance, rejection, withdrawal, and refresh.                  |
| Mentorship room | Present agreed goals, preparation, sessions, actions, progress, and completion in a clear order.      | A mentor and founder can complete the process without irrelevant exchange instructions.                  |
| Calendar        | Surface sessions and preparation/follow-up deadlines.                                                 | Mentor empty states invite connecting with startups; they do not say “connect with a mentor.”            |
| Completion      | Use mentorship-appropriate completion wording and preserve existing shared confirmation/review rules. | Both accounts agree on completion; reviews remain private until the existing release conditions are met. |

Review onboarding, Home, Matches, details, Introductions, Rooms, Schedule, Calendar, Updates, Profile, and Settings for role-specific wording and actions. Test both founder-initiated and mentor-initiated connections where supported.

Potential extensions to scope separately after the review: mentoring capacity, structured availability, conflict detection, proposed/confirmed session states, rescheduling/cancellation, session notes, and recurring-session exceptions. Adopt only the capabilities required by the agreed journey. Keep personal notes private if introduced; do not silently treat them as shared room content.

Primary files: `HomePage.jsx`, `OnboardingPage.jsx`, `ProfilePage.jsx`, `DiscoverPage.jsx`, `MatchDetailPage.jsx`, `WaitingPage.jsx`, `RoomDetailPage.jsx`, `Introductions.jsx`, `SchedulePanel.jsx`, role selectors, `server/workspace.js`, and relevant collaboration templates.

### Phase 6 — integration and release review

Test complete journeys with separate Founder and Mentor sessions:

- Complete/edit profile → discover → filter/sort → inspect → save → introduce → accept → collaborate → schedule → complete → review.
- Many suggestions, sparse suggestions, no suggestions, and low-fit Browse all results.
- Photo, no image, failed image, long names, long descriptions, and empty optional fields.
- First use, returning user, unread/read updates, missing destinations, and pending introductions.
- Connection failure during background refresh and during a save; recovery; a second outage.
- Desktop, tablet, and narrow mobile layouts; keyboard focus; dialogs; dropdowns; reduced motion.

Add focused behavior tests to the existing suite for outage deduplication/recovery, real score distributions, avatar fallback, stable notification timing, date semantics, and mentor permissions/state transitions. Review cosmetic changes through screenshots and interaction checks rather than tests that merely assert CSS classes.

Run the relevant unit/browser tests during each phase. At integration, run the repository's format check, unit suite, browser suite, and production build. Record pre-existing failures separately from regressions. Review before/after screenshots at approximately 390px, 768px, and 1440px widths, plus a narrow-width overflow check.

## Feedback coverage and priority

P0: functional reliability. P1: core usability and role correctness. P2: identity and finishing work. Priority expresses impact; dependencies determine execution order.

| ID  | Original feedback                    | Priority | Phase                |
| --- | ------------------------------------ | -------- | -------------------- |
| F01 | Finalize logo                        | P2       | 0–1                  |
| F02 | Login background                     | P2       | 1                    |
| F03 | Images mixed with letter avatars     | P1       | 2                    |
| F04 | Remove/improve Start with a profile  | P1       | 2                    |
| F05 | Improve Suggested for you dropdown   | P1       | 1–2                  |
| F06 | Improve flat match details           | P1       | 3                    |
| F07 | Improve app dropdowns                | P1       | 1                    |
| F08 | Remove colored toast edge            | P1       | 1                    |
| F09 | Score-help hover includes icon       | P2       | 2                    |
| F10 | More dummy accounts, little/no fit   | P1       | 2                    |
| F11 | Filter action says Show matches      | P2       | 2                    |
| F12 | Calendar proportions and familiar UI | P1       | 4                    |
| F13 | Remove sidebar Profile               | P1       | 1                    |
| F14 | Improve Profile hierarchy            | P1       | 3                    |
| F15 | Improve Updates readability          | P1       | 3                    |
| F16 | Settings gear icon                   | P2       | 1                    |
| F17 | One interruption notice              | P0       | 1                    |
| F18 | Review/rework mentor side            | P1       | 0 and 5; informs 2–4 |

## Completion criteria

Every feedback item has implementation evidence and a passed acceptance check. Both roles complete their intended workflows. Shared components are consistent across screens, demo data demonstrates edge cases honestly, and navigation, feedback, dates, persistence, and accessibility remain reliable. Record unresolved design choices or optional extensions explicitly instead of presenting them as completed work.
