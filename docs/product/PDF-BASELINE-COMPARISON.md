# Synergy: changes since the course project PDF

Compared on 23 November 2026. Baseline: [Synergy.pdf](Synergy.pdf) (CIT 213 course project, dated September 2026, committed 30 October 2026 in `2082b8e`). Current system: the working tree on branch `fix/founder-second-run`, including uncommitted changes.

## Contents

1. [Purpose and method](#purpose-and-method)
2. [Summary](#summary)
3. [Technology and platform](#1-technology-and-platform)
4. [Sign-in, accounts and roles](#2-sign-in-accounts-and-roles)
5. [Founder onboarding and profile](#3-founder-onboarding-and-profile)
6. [Verification](#4-verification)
7. [Matching and discovery](#5-matching-and-discovery)
8. [Introductions](#6-introductions-from-match-to-room)
9. [Deal Rooms](#7-deal-rooms-founder-to-founder-exchanges)
10. [Reviews and trust](#8-reviews-and-trust)
11. [Mentorship](#9-mentorship)
12. [Payments](#10-payments)
13. [Notifications and email](#11-notifications-and-email)
14. [Moderation and administration](#12-moderation-and-administration)
15. [Settings, privacy and safety](#13-settings-privacy-and-safety)
16. [Navigation and visual shell](#14-navigation-and-visual-shell)
17. [Operations and quality](#15-operations-and-quality)
18. [PDF items not carried forward](#pdf-items-not-carried-forward)
19. [Limits of this comparison](#limits-of-this-comparison)
20. [Appendix A: PDF page map](#appendix-a-pdf-page-map)
21. [Appendix B: server action inventory](#appendix-b-server-action-inventory)

## Purpose and method

This document lists every feature, workflow, screen, integration and behavior that was added or materially changed after the PDF. Items that match the PDF are left out.

**The baseline is a design document, not a release.** The PDF describes a proposed concept and shows Figma prototype screens. "Previous version" therefore means what the PDF proposed or showed, not code that shipped.

**Page references are PDF page numbers out of 10.** Section numbers printed on the pages are offset from these in places (for example, p.7 is §5 Features). See [Appendix A](#appendix-a-pdf-page-map).

**"Undocumented in PDF"** means the item exists now, but the PDF doesn't say whether it existed or was planned. The longer written brief, [Synergy.md](Synergy.md), is a separate document and was not used as the baseline. Items described only there are marked undocumented here.

**How the current system was checked.** By reading source code, configuration and the README. The app was not run. Claims taken only from the README are flagged in [Limits of this comparison](#limits-of-this-comparison).

Each table row gives:

- **Previous (PDF):** what the PDF says, with a page reference, or "Undocumented in PDF".
- **Current:** what the system does today, with a link to the evidence.
- **Change:** what was added or modified, and what it means for users or administrators.

## Summary

- **The scope grew from one workflow to three.** The PDF covers founder-to-founder matching and a Deal Room. The system now adds a full mentorship product (application, five formats, requests, rooms, Office Hours, calendar, impact), simulated payments, and an administration and moderation area.
- **Most of the planned technology changed.** PostgreSQL became SQLite; Firebase became local accounts plus a demo sign-in; Socket.io became 1.5-second polling; Hugging Face/OpenAI became rule-based logic in the browser; Tailwind became plain CSS; Render or Railway became Netlify plus Render.
- **Verification moved from automated to moderator-reviewed.** It is configurable, and when on, it gates sending introductions rather than appearing in matches.
- **Matching was formalized.** Explicit weights, scoring in both directions, a cap for uneven audience swaps, two extra mentor factors, and moderator-editable, versioned weights.
- **The prototype screens were restructured.** The two-step AI onboarding wizard is now an assistant inside Edit profile. Introductions has its own page. Deal Rooms gained a task board, renegotiation, disputes and closing. The default theme changed from dark to light.
- **Trust and safety grew substantially.** Review windows, small-sample guards, reporting, blocking, message screening, account export and deletion, and moderator queues with audit logs.

## 1. Technology and platform

PDF reference: p.8, "Resources and Technologies".

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Frontend | React + Tailwind | React 19 + Vite with plain CSS files; no Tailwind dependency ([package.json](../../package.json)) | Styling stack replaced |
| Backend | Node.js/Express or Django REST | Node 24's built-in `node:http` server; Vite middleware during development; no Express ([server/start.js](../../server/start.js), [server/api.js](../../server/api.js)) | No framework. Almost all behavior goes through one `/api/action` endpoint |
| Database | PostgreSQL | SQLite through `node:sqlite` in WAL mode, with a one-time import from an older JSON file ([server/storage.js](../../server/storage.js)) | Different database. A move to Supabase is planned but not built ([SUPABASE-MIGRATION-ROADMAP.md](../architecture/SUPABASE-MIGRATION-ROADMAP.md)) |
| Authentication | Firebase | Local accounts with scrypt-hashed passwords, plus a demo-mode sign-in (on by default) that accepts any email and password. Sessions are scoped to a browser tab ([server/config.js](../../server/config.js)) | No external identity provider |
| AI / LLM | Hugging Face / OpenAI | None. The profile assistant is rule-based and runs in the browser ([src/data/profile-assistant.js:31](../../src/data/profile-assistant.js#L31)) | No model or API call. "AI" features are deterministic rules |
| Real-time communication | Socket.io | The client polls the server every 1.5 seconds ([src/state/AppContext.jsx:547](../../src/state/AppContext.jsx#L547)) | No websockets. Chat and updates arrive on the next poll |
| Hosting | Render or Railway | Netlify serves the frontend and forwards `/api/*` to a Render service in Singapore with a 1 GB persistent disk ([netlify.toml](../../netlify.toml), [render.yaml](../../render.yaml)) | Split hosting. Netlify also sets security headers, including a Content Security Policy |
| Supporting services | Undocumented in PDF | Sharp image processing; Brevo email (stub by default); simulated payments; Playwright and axe tests; GitHub Actions CI; backup script; health endpoint; benchmark script | New operational tooling (see [section 15](#15-operations-and-quality)) |

## 2. Sign-in, accounts and roles

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Sign-up and sign-in screen | p.9 "Sign In Page": Sign up / Sign in tabs; first and last name, email, phone with country code; Gmail and Google sign-in buttons | In demo mode: a "Prototype role" choice (Founder or Mentor), email and password ([src/components/Login.jsx](../../src/components/Login.jsx)). Otherwise: first and last name, email, password and role ([src/pages/SignupPage.jsx](../../src/pages/SignupPage.jsx)) | Phone field and social sign-in removed; password sign-in added. Signing in again with the same email and password reopens the same account; a different password for a used email is refused |
| Choosing a role | p.9 "Choose Roles": Startup / Mentor / Both cards | "Founder" or "Mentor". "Both: founder and mentor" is offered only in non-demo sign-up and creates two profiles the user can switch between | "Startup" renamed to "Founder". "Both" is limited to non-demo mode |
| Role switching | Undocumented in PDF | Switching roles asks for confirmation because other open tabs switch too. A room that belongs to the other role offers "Switch to founder" or "Switch to mentor" | New |
| First-run choice | Undocumented in PDF | A new founder chooses "Set up my startup" (opens Edit profile with an empty description) or "Explore with a sample startup" (loads Maria Santos's sample company) ([src/components/FirstRunChoice.jsx](../../src/components/FirstRunChoice.jsx)) | New starting path |
| Demo mode | Undocumented in PDF | `SYNERGY_DEMO_MODE` (on by default) enables role-preview sign-in. Preview accounts can simulate a fictional partner's responses and never get moderator rights ([server/config.js](../../server/config.js)) | Lets the prototype be demonstrated without real accounts |

## 3. Founder onboarding and profile

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| AI profile builder | p.7 (AI-Assisted Onboarding), p.8 (AI Tag-Extraction Engine), p.9 "AI Profile Builder": step 1 of 2, free-text description, **Analyze** button | Inside Edit profile: "Describe your startup in your own words" → **Suggest profile details** → tick the suggestions to keep → **Apply suggestions** ([src/components/ProfileAssistant.jsx](../../src/components/ProfileAssistant.jsx)) | No longer a separate onboarding step. Rule-based; nothing is applied without review; the text never leaves the browser |
| Profile signals (confirm or edit) | p.9 "Profile Signals": offer and need tags, a "Pending Review" tag, industry, stage, team size, goals, **Confirm & Continue** | The same fields are edited in the profile editor. Unsaved drafts are kept per account, role and tab until **Save profile** or **Cancel** ([src/state/useDraft.js](../../src/state/useDraft.js)) | Not a wizard step. Drafts survive refreshes and are never published by typing or pressing Enter |
| New-tag proposals | p.8 (Tag Taxonomy: "standardized, governed list"); p.9 shows a "Pending Review" tag | Founders can propose a tag ([src/components/TagProposal.jsx](../../src/components/TagProposal.jsx), new uncommitted file). Moderators approve or reject proposals under "Tag proposals" ([src/pages/ModerationPage.jsx:197](../../src/pages/ModerationPage.jsx#L197)) | The governance half of the taxonomy now exists |
| Profile page | p.10 "Profile Page": name, role pill, company and industry, offer and need, trust history, **Edit Profile** | Separate founder and mentor layouts, one completion ring and a checklist of required details ([src/components/ProfileStats.jsx](../../src/components/ProfileStats.jsx), [src/pages/ProfilePage.jsx](../../src/pages/ProfilePage.jsx)) | Redesigned per role; shows what is missing |
| Profile photo | Undocumented in PDF (initials only on pp.9–10) | Upload JPEG, PNG or WebP up to 5 MB, with preview, replace and remove. The server validates the image with Sharp, strips metadata, stores it as WebP and serves it only to permitted viewers ([server/api.js](../../server/api.js)) | New |

## 4. Verification

PDF references: p.7 (verification under Trust and Reputation System), p.8 (Verification System).

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Method | p.8: **automated** checks, either a roster match or a business-email domain | A moderator reviews affiliation evidence. Accelerator, university, founder-community or referral evidence is accepted without a business domain ([src/components/Verification.jsx:66](../../src/components/Verification.jsx#L66)) | Automated → manual review |
| What verification gates | p.8: required before a profile can **appear in matches** | When enabled, required to **send or accept introductions**. Browsing, search, profile editing and saving matches stay available | Narrower gate; unverified profiles can still be discovered |
| Enforcement | p.8: always | Controlled by `SYNERGY_REQUIRE_VERIFICATION`: off locally, on in the Render deployment; preview accounts are exempt ([server/config.js:25](../../server/config.js#L25), [render.yaml](../../render.yaml)) | Configurable per environment |
| Display | pp.9–10: a check mark beside verified names | "Verified: {organization}" badge, or "Not verified yet" on detailed views ([src/components/TrustSummary.jsx](../../src/components/TrustSummary.jsx)) | Names the organization that vouches for the user |
| Review deadlines | Undocumented in PDF | Moderation queues and escalated disputes show a due date three weekdays out, and overdue status (per the README) | Sets an expectation for review turnaround |

## 5. Matching and discovery

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Scoring factors | p.7: five factors (need, expertise, industry, stage, goals). p.8: "compares tags between startups and scores compatibility by stage and size". p.10 "Deal Room Page 1" shows four factor bars (need, industry, stage, goal) | Founder-to-founder pairs use five weights `[0.5, 0, 0.2, 0.15, 0.15]`, so expertise has no weight. Founder-to-mentor pairs use **seven factors**, adding Availability fit and Format fit ([src/data/matching.js](../../src/data/matching.js)) | Two new mentor factors; weights are explicit |
| How need fit is measured | p.8: tag comparison | Compares both words and controlled tags, so "people to try our product" and "beta testers" count as the same need. Exchanges score need coverage **in both directions** and combine them with a geometric mean. An audience swap more than 10× uneven is capped at 40%. The algorithm is labelled `reciprocal-v3` ([server/workspace.js:171-355](../../server/workspace.js#L171-L355)) | Two-way scoring and the uneven-swap cap are new; missing inputs earn no positive score |
| Versioning and tuning | Undocumented in PDF | Moderators edit weights; each save creates a new version. A "Matching evaluation" report groups rooms by score band and shows completion, usefulness and goal outcomes. Saved rooms keep the algorithm and version they were scored with ([src/components/EngagementSettings.jsx:80](../../src/components/EngagementSettings.jsx#L80), [src/data/matching.js](../../src/data/matching.js)) | Administrators can tune matching and measure whether higher scores lead to better outcomes |
| Matches page | p.9 "Matches Page": "Your matches this week"; New Matches / Saved / Browse All tabs; score ring, star, **View match**, **Update Profile** | Suggested / Saved / Browse all tabs ([src/pages/DiscoverPage.jsx:213](../../src/pages/DiscoverPage.jsx#L213)); a minimum-fit filter from 0 to 100 that is remembered ([src/state/useMatchFilterMemory.js](../../src/state/useMatchFilterMemory.js)); "Get notified when someone offers {need}" when no suggestion covers a stated need | Filtering and alerts for unmet needs are new. Per the README, Suggested shows profiles with at least 30% fit that also offer one of your needs; Browse all includes weak and zero-fit profiles |
| Match detail | p.10 "Deal Room Page 1": score ring and factor bars first; "Next step" panel with **Express Interest** and **Save for later** | Leads with identity, what each side gets ("They get") and an action panel. "See the factor breakdown" is opt-in. Adds collaboration goals, experience and trust, and a "Safety and privacy" section with Report ([src/pages/MatchDetailPage.jsx](../../src/pages/MatchDetailPage.jsx)) | Fit numbers moved behind a disclosure; reporting added |
| Sample directory | p.9: three sample matches (Campus Grocer, NoteNest, LoopLocal) | 33 fictional collaborators (19 startups and 14 mentors), with every standard tag offered by at least two of them ([server/demo-directory.js](../../server/demo-directory.js)) | Larger, more realistic demo data |

## 6. Introductions (from match to room)

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Expressing interest | p.10 "Deal Room Page 2": "Interest sent", "Waiting for Campus Grocer", "Pending response", **Review proposed terms** | **Send introduction** from a match, then a dedicated **Introductions** page where users send, cancel, accept or decline. Declining asks for confirmation ([src/pages/WaitingPage.jsx](../../src/pages/WaitingPage.jsx), [src/components/DeclineIntroduction.jsx](../../src/components/DeclineIntroduction.jsx)) | A separate inbox for pending introductions in both directions |
| Conflict-of-interest block | Undocumented in PDF | An introduction is refused when a mentor has declared a conflict with that founder ([server/workspace.js:1008](../../server/workspace.js#L1008)) | Prevents conflicted mentorships |
| Simulated partner | Undocumented in PDF | Preview accounts can **Simulate acceptance** with fictional partners in demo mode only. Real accounts always need the other person ([src/components/SimulateAcceptance.jsx](../../src/components/SimulateAcceptance.jsx)) | Demo-only behavior for walkthroughs |

## 7. Deal Rooms (founder-to-founder exchanges)

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Room tabs | p.10 "Deal Room Page 3": Terms / Milestones / Chat | Terms (renamed "Agreement" once locked) / Milestones / Chat, plus Schedule in mentorship rooms and a Task board reached from Milestones ([src/pages/RoomDetailPage.jsx:364](../../src/pages/RoomDetailPage.jsx#L364)) | More sections |
| Terms | p.10 "Deal Room Page 3": scope, timeline and feedback method; both sides agree; **Lock Terms & Start** | Lock and accept terms, plus **reopen terms**, which the partner accepts or declines ([server/mentorship-rooms.js:58](../../server/mentorship-rooms.js#L58)) | Locked terms can be renegotiated |
| Milestones | p.7 (mutual confirmation, evidence); p.10 "Deal Room Page 4": numbered milestones, file evidence, asterisks, **Confirm Testers Assigned** | Adds target dates, proposed milestone changes the partner accepts or declines ([src/components/MilestoneRevision.jsx](../../src/components/MilestoneRevision.jsx)), "send back", nudging the partner, and undoing a launch | More ways to edit and recover |
| Disputes | Undocumented in PDF | Either side can dispute a milestone, then resolve, withdraw or escalate it to a moderator | New |
| Task board | Undocumented in PDF | Cards with priority, linked milestone and deadline; fully keyboard-operable ([src/components/TaskBoard.jsx](../../src/components/TaskBoard.jsx)) | Day-to-day work tracking inside the room |
| Evidence files | p.7: "evidence attachments" | Private uploads tied to a room and milestone, served only to room members ([server/files.js](../../server/files.js)) | Access control defined |
| Closing a room | Undocumented in PDF | "Close this collaboration" dialog, "Report a concern" in the room, and blocking, which closes unfinished rooms ([src/components/CloseRoomDialog.jsx](../../src/components/CloseRoomDialog.jsx)) | Rooms can end without being completed |
| Co-Marketing Swap | Undocumented in PDF (p.10 shows only a Beta Testing Exchange) | Five milestones plus audience-size, send-date and asset fields ([src/data/engagement-templates.json](../../src/data/engagement-templates.json)) | A second exchange type |
| Template editing | p.8 (Deal-Type Template Engine): new types "can be added later without rebuilding the app" | Moderators edit reusable engagement templates in the UI ([src/components/EngagementSettings.jsx:11](../../src/components/EngagementSettings.jsx#L11)) | The concept is built, with an admin screen |

## 8. Reviews and trust

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Blind ratings | p.7: "blind, simultaneous ratings". p.10 "Deal Room Page 5": 5 stars, text feedback, hidden until the partner submits | Same, plus a **14-day review window**: feedback is released when both submit or the window closes ([src/data/mentor-rules.js:55](../../src/data/mentor-rules.js#L55)). Exchange reviews also ask whether the collaboration was useful and whether the shared goal was achieved, partly achieved or not achieved ([server/workspace.js:2454](../../server/workspace.js#L2454)) | A deadline stops one side from holding feedback back; outcome questions feed matching evaluation |
| Mentorship reviews | Undocumented in PDF | Separate 1–5 categories. Founders rate usefulness, clarity, responsiveness and, when paid, value for money. Mentors rate preparedness and follow-through. Uncommitted changes move these into a shared `reviewCategories` list with a new `RatingScale` component and delete `RatingStars.jsx` ([src/pages/ReviewPage.jsx](../../src/pages/ReviewPage.jsx)) | New, and still being changed |
| Trust history | p.10 "Profile Page": completed deals 1, average rating 4.8/5, follow-through rate 100%, history entry | Completed count; average rating with the number of reviewers and a "small sample" note under 3; follow-through shown as counts until 3 collaborations have finished; rooms closed early; rooms quiet for 14+ days; mutual closures and partner no-shows excluded; repeat partners counted once; a note when a rating pattern looks unusual ([src/components/TrustSummary.jsx](../../src/components/TrustSummary.jsx)) | Guards against a single event looking like a pattern |
| Trust score on Home | p.9 "Home Dashboard": a "4.8/5 Trust score" tile | Home tiles are Active Deal Rooms, Introductions to answer and Saved matches ([src/components/HomeMetrics.jsx](../../src/components/HomeMetrics.jsx)) | Trust score removed from Home |
| Mentor badges | Undocumented in PDF | Verified Mentor, Top Mentor and Prepared Founder badges ([src/data/mentor-impact.js:270](../../src/data/mentor-impact.js#L270)) | New recognition signals |

## 9. Mentorship

The PDF names industry and domain experts as target users (p.3, p.6), includes Expertise Fit in matching (p.7), uses a fraud-prevention specialist in the persona scenario (p.4), and shows a Mentor card on the Choose Roles screen (p.9). It documents no mentor workflow or screen. **Every row below is undocumented in the PDF.**

| Item | Current | Change for users and administrators |
|---|---|---|
| Mentor application | Eight steps: verification, expertise, capacity and time zone, formats, conflicts of interest, mentor guidelines, experience, preferences. A moderator then approves or rejects the application ([src/data/mentor-onboarding.js](../../src/data/mentor-onboarding.js), [src/pages/OnboardingPage.jsx](../../src/pages/OnboardingPage.jsx)) | Mentors are vetted before founders can find them |
| Mentoring formats | Quick Ask, Doc/Pitch Review, Single Session, Office Hours and Ongoing Advisory (four check-ins over eight weeks by default). Each has its own milestones and can be upgraded to a bigger format ([src/data/mentor-formats.js](../../src/data/mentor-formats.js)) | Mentors choose how much time to commit; founders pick the right size of help |
| Structured request | Founders describe the problem, what they tried, their question and the outcome they want, with quality hints ([src/data/request-assistant.js](../../src/data/request-assistant.js)). Mentors accept, decline or refer to another mentor; founders can withdraw ([server/mentor-requests.js](../../server/mentor-requests.js)) | Replaces mutual "interest" for mentorship; mentors get better-prepared requests |
| Mentor workspace | Separate navigation: Home (ranked requests, today's sessions, attendance and follow-ups, capacity, active mentees), Requests, Mentees (grouped by stage), Calendar and Impact ([src/components/Sidebar.jsx:15](../../src/components/Sidebar.jsx#L15), [src/components/MentorHome.jsx](../../src/components/MentorHome.jsx)) | Mentors work from requests and sessions rather than a match feed |
| Mentorship room | Goal confirmation, session prep, scheduling, check-in times, attendance reports, rescheduling and cancelling, session disputes, written answers and revisions, follow-up, format upgrades, ending a mentorship, advisory cycles with a Continue or Finish decision, and public testimonials ([server/mentorship-rooms.js:35](../../server/mentorship-rooms.js#L35)) | A workflow tailored to each format |
| Office Hours and calendar | Recurring slots, preferred times, skipped dates, booking and rebooking, conflict and capacity checks, times shown in the viewer's time zone, `.ics` download and a private calendar subscription feed ([server/office-hours.js](../../server/office-hours.js), [server/api.js:90](../../server/api.js#L90), [src/pages/CalendarPage.jsx](../../src/pages/CalendarPage.jsx)) | Self-service scheduling that works with external calendars |
| Capacity controls | Pause Mode returns pending requests to founders with similar mentors suggested, without hurting the mentor's response rate. Also: capacity, formats offered, conflicts of interest and guidelines ([src/components/MentoringSettings.jsx](../../src/components/MentoringSettings.jsx)) | Protects mentors from overload |
| Impact | Mentoring stats, badges, testimonials, follow-up highlights, and a certificate with volunteer and paid hours at `#/impact/certificate` ([src/pages/ImpactPage.jsx](../../src/pages/ImpactPage.jsx), [src/components/MentorImpact.jsx](../../src/components/MentorImpact.jsx)) | Recognition mentors can share |
| Safety | Messages are screened for equity requests and off-platform payment ([src/data/safety-rules.js](../../src/data/safety-rules.js)). Attendance limits apply after no-shows. Moderators can lift limits and suspend or reinstate mentors ([server/mentor-safety.js](../../server/mentor-safety.js)) | Protects founders from exploitative arrangements |

## 10. Payments

**Undocumented in the PDF.** Added as "v1.1" ([V1.1-IMPLEMENTATION.md](V1.1-IMPLEMENTATION.md)).

| Item | Current | Change for users and administrators |
|---|---|---|
| Paid mentoring | Simulated provider only; the server refuses to start with any other provider ([server/config.js:11](../../server/config.js#L11)). Prices are in PHP, from ₱300 to ₱10,000, with a 15% platform fee ([src/data/pricing.js](../../src/data/pricing.js)) | Mentors can charge for formats; no real money moves |
| Payment flows | Payout setup, per-format prices, checkout with success, failure and expiry controls, delivery confirmation, refunds, payment disputes, advisory-cycle installments, paid rescheduling, moderator pricing settings, and a signed webhook ([server/mentor-payments.js](../../server/mentor-payments.js), [src/components/Payments.jsx](../../src/components/Payments.jsx)) | A complete lifecycle, ready for a live provider later |

## 11. Notifications and email

**Undocumented in the PDF.** The only related element is the count tiles on p.9 "Home Dashboard".

| Item | Current | Change for users and administrators |
|---|---|---|
| Updates page | All and Unread filters, grouping by date, relative times, and the same rows in a preview under the header. Generated updates keep their first-seen time across polling and server restarts ([src/pages/NotificationsPage.jsx](../../src/pages/NotificationsPage.jsx)) | One in-app inbox for everything that needs attention |
| Digests and alerts | Daily or weekly digest; match alerts for unmet needs; notification preferences ([src/pages/SettingsPage.jsx:223](../../src/pages/SettingsPage.jsx#L223)) | Fewer interruptions |
| Email | A durable outbox; stub by default, Brevo optional. New-request emails go out as a daily digest at 08:00 in the mentor's time zone, or instantly if chosen. Includes unsubscribe links, a delivery webhook and a suppression list ([server/mentor-email.js](../../server/mentor-email.js), [server/delivery.js](../../server/delivery.js)) | Mentors hear about requests outside the app |

## 12. Moderation and administration

**Undocumented in the PDF.** The PDF defines no administrator or moderator role.

| Item | Current | Change for users and administrators |
|---|---|---|
| Access | Granted to the emails in `SYNERGY_ADMIN_EMAILS`. Preview accounts never receive it. A Moderation item appears in the sidebar for moderators ([server/config.js](../../server/config.js), [src/components/Sidebar.jsx](../../src/components/Sidebar.jsx)) | A defined admin role |
| Queues | Reports, affiliation requests, tag proposals, account access and suspension, session disputes, mentor approvals, mentorship safety (reported patterns, rating flags, attendance limits), the mentorship queue and payment disputes ([src/pages/ModerationPage.jsx](../../src/pages/ModerationPage.jsx)) | Human oversight of trust-sensitive decisions |
| Configuration | Mentoring settings and launch metrics ([src/components/MentorAdminSettings.jsx](../../src/components/MentorAdminSettings.jsx)), engagement templates and matching weights ([src/components/EngagementSettings.jsx](../../src/components/EngagementSettings.jsx)), and pricing ([src/components/Payments.jsx](../../src/components/Payments.jsx)) | The platform can be tuned without code changes |
| Audit log | Moderation decisions are recorded, and the latest 100 are shown ([server/features.js](../../server/features.js)) | Decisions can be traced |

## 13. Settings, privacy and safety

**Undocumented in the PDF.**

| Item | Current | Change for users and administrators |
|---|---|---|
| Settings page | Appearance (light or dark), notifications, a mentoring survey, active-profile switching with confirmation, blocked collaborators, sign-in sessions, and a collapsed Danger zone with profile visibility, revoking other sessions and deleting the account ([src/pages/SettingsPage.jsx](../../src/pages/SettingsPage.jsx)) | Users control their account in one place |
| Data rights | Account data export (`/api/account/export`). Deletion removes private details, revokes sessions and anonymizes the user's name in shared history, while agreements, evidence, messages and released reviews remain for collaborators ([server/accounts.js](../../server/accounts.js)) | Privacy rights without breaking partners' records |
| Profile visibility | Hiding a profile pauses discovery and pending introductions ([server/accounts.js](../../server/accounts.js)) | Users can step away temporarily |
| Reporting and blocking | A report requires a reason, accepts optional details and goes to the moderator queue; it does not block. Blocking is a separate confirmed action that withdraws introductions, closes unfinished rooms and stops chat ([src/components/ReportCollaborator.jsx](../../src/components/ReportCollaborator.jsx), [src/components/BlockCollaborator.jsx](../../src/components/BlockCollaborator.jsx)) | Separate tools for flagging and for cutting contact |
| Sign-out | Voluntary sign-out asks for confirmation; a failed request keeps the session and drafts ([src/components/SignOutDialog.jsx](../../src/components/SignOutDialog.jsx)) | No accidental loss of work |
| Invitations | "Copy invitation link" ([src/components/InviteCollaborator.jsx](../../src/components/InviteCollaborator.jsx)) | Users can bring partners onto the platform |

## 14. Navigation and visual shell

| Item | Previous (PDF) | Current | Change |
|---|---|---|---|
| Navigation | pp.9–10: top bar with Home / Matches / Deal Rooms / Profile and an avatar | Founder sidebar: Home, Matches, Introductions, Deal Rooms, then Updates and Settings. Mentors get Home, Requests, Mentees, Calendar and Impact. Moderators see Moderation. Profile opens from the avatar in the top bar; phones use a drawer ([src/components/Sidebar.jsx](../../src/components/Sidebar.jsx), [src/components/Topbar.jsx](../../src/components/Topbar.jsx), [src/components/MobileMenu.jsx](../../src/components/MobileMenu.jsx)) | Different navigation for each role |
| Theme | pp.9–10: dark interface | Light by default on first visit, regardless of the operating system setting. Dark is available in Settings and applied before the page renders ([src/state/theme.js](../../src/state/theme.js), [public/theme-init.js](../../public/theme-init.js)) | Default flipped from dark to light |
| Home | p.9 "Home Dashboard": "Welcome back, Maria", three count tiles, an active collaboration with progress, a "Profile signal" card and recommended matches | A "next step" card, workspace tiles and top matches for founders; a separate Mentor Home ([src/components/HomeWelcome.jsx](../../src/components/HomeWelcome.jsx), [src/components/HomeTopMatches.jsx](../../src/components/HomeTopMatches.jsx)) | Built around the single next action |
| Routing | Undocumented in PDF | Shareable hash routes for every page, including individual matches, rooms, reviews and the impact certificate; unknown routes show a not-found page ([src/state/routes.js](../../src/state/routes.js)) | Links can be opened in new tabs and shared |

## 15. Operations and quality

**Undocumented in the PDF.**

| Item | Current | Change for users and administrators |
|---|---|---|
| Storage safety | Transactional writes; one application writer per database; uploads stored beside the database ([server/storage.js](../../server/storage.js)) | Fewer corrupted saves |
| Backups and readiness | `npm run backup` takes consistent snapshots; a health endpoint and storage-readiness checks ([server/backup.js](../../server/backup.js), [server/operations.js](../../server/operations.js), [DEPLOYMENT.md](../operations/DEPLOYMENT.md)) | Operators can recover data |
| Automated checks | GitHub Actions runs reference checks, formatting, unit tests, the build, and browser tests in Chromium, Firefox and WebKit, including accessibility checks with axe ([.github/workflows/checks.yml](../../.github/workflows/checks.yml), [playwright.config.js](../../playwright.config.js)) | Regressions are caught before release |
| Load check | `npm run benchmark` runs a synthetic local concurrency test ([server/benchmark.js](../../server/benchmark.js)) | Rough capacity estimate |

## PDF items not carried forward

These are shown or specified in the PDF and are absent or replaced in the current system.

| PDF item | Page | Status now |
|---|---|---|
| Phone number at sign-up | p.9 | Removed |
| Gmail and Google sign-in | p.9 | Removed; email and password only |
| Firebase authentication | p.8 | Replaced by local accounts and demo sign-in |
| PostgreSQL | p.8 | Replaced by SQLite; Supabase planned |
| Hugging Face / OpenAI | p.8 | Replaced by rule-based logic in the browser |
| Socket.io real-time | p.8 | Replaced by 1.5-second polling |
| Tailwind | p.8 | Replaced by plain CSS |
| Automated roster or business-email verification | p.8 | Replaced by moderator review of submitted evidence |
| Verification required to appear in matches | p.8 | Now required only to send or accept introductions, and only when enabled |
| Two-step onboarding wizard (Analyze → Confirm & Continue) | p.9 | Folded into the profile editor |
| "Both" role on the main sign-in | p.9 | Available only in non-demo sign-up |
| Trust score tile on Home | p.9 | Removed |
| Factor bars shown first on match detail | p.10 | Moved behind "See the factor breakdown" |
| Dark interface | pp.9–10 | Light by default; dark optional |

## Limits of this comparison

- **The app was not run.** All findings come from reading source code, configuration and documentation. No tests were executed for this comparison.
- **Some details come only from the README** and were not traced in code: the 30% threshold for Suggested matches, the three-weekday moderation due dates, the exact anonymization on account deletion, and the 15 startup / 14 mentor split in the directory.
- **Deployments were not checked.** Whether the Netlify and Render instances are live and running this code is unknown.
- **Integrations are partly untested.** Brevo email delivery was not tested. Payments are simulated only; no live provider exists.
- **The working tree has uncommitted changes.** 66 files are modified and 7 are untracked (including `RatingScale.jsx`, `TagProposal.jsx`, `LimitedTextarea.jsx`, `LinkedText.jsx`, `dates.js` and `links.js`). Rows that depend on them may change before they are committed.
- **The PDF's text could not be extracted cleanly.** Pages 2–8 have overlapping text layers, so every page was read from rendered images. Small labels in the prototype screenshots may be slightly misread.
- **Some PDF items can't be checked from the repository.** Figma (prototyping tool) and GitHub and Google Drive (collaboration tools) on p.8 are excluded.
- **Silence in the PDF isn't evidence of absence.** "Undocumented in PDF" does not mean the item was rejected or not planned; the separate brief [Synergy.md](Synergy.md) describes some of these items, such as Co-Marketing Swap, digests and an admin role.

## Appendix A: PDF page map

| PDF page | Printed section | Content |
|---|---|---|
| 1 | — | Cover: title, team, course, September 2026 |
| 2 | — | Table of contents |
| 3 | 1 | Background of the study; target users; references |
| 4 | 2 | User persona (Juan Mohi), needs, pain points, goals, scenario, POV and "how might we" statements |
| 5 | 3 | Problem statement; three proposed solutions (Collab Board, Synergy, Embeddable Collab Cards) |
| 6 | 4 | Selected concept (Synergy); why Synergy; target users |
| 7 | 5 | Features: Complementary Matching Engine, Deal Room Execution Framework, AI-Assisted Onboarding, Trust and Reputation System |
| 8 | 6 | Concept requirements (tag taxonomy, matching logic, verification, template engine, AI tag extraction); resources and technologies |
| 9 | 7 | Prototypes: Sign In Page, Choose Roles, AI Profile Builder, Profile Signals, Home Dashboard, Matches Page |
| 10 | 8 | Prototypes: Deal Room Pages 1–5, Profile Page |

## Appendix B: server action inventory

The current API handles almost all behavior through `/api/action`. Actions grouped by the module that owns them, as evidence for the sections above.

| Module | Actions and forms | Section |
|---|---|---|
| [server/workspace.js](../../server/workspace.js) | `first-run-choice`, `interest`, `cancel-interest`, `accept-interest`, `decline-interest`, `simulate-acceptance`, `save`, `lock-terms`, `accept-terms`, `confirm-milestone`, `dispute`, `resolve-dispute`, `launch-room`; forms `profile-form`, `terms-form`, `chat-form`, `evidence`, `schedule`, `review-form`, `report-form` | 2, 3, 6, 7, 8 |
| [server/features.js](../../server/features.js) | `reopen-terms`, `accept-reopen`, `decline-reopen`, `close-room`, `read-notifications`, `withdraw-dispute`, `escalate-dispute`, `send-back`, `nudge-partner`, `undo-launch`, `cycle-decision`; forms `task-create`, `task-update`, `task-delete`, `milestone-date`, `milestone-proposal`, `milestone-decision`, `tag-proposal`, `affiliation-request`, `moderation`, `engagement-template`, `matching-config`, `notification-preferences`, `match-alert`, `mentor-config`, `mentorship-survey`, `cycle-details`, `cycle-review`, `mentor-capacity`, `set-mentor-pause`, `mentor-conflicts`, `accept-guidelines` | 3, 4, 5, 7, 11, 12 |
| [server/mentor-requests.js](../../server/mentor-requests.js) | `send-request`, `accept-request`, `decline-request`, `refer-request`, `withdraw-request` | 9 |
| [server/mentorship-rooms.js](../../server/mentorship-rooms.js) | `confirm-goal`, `simulate-goal-confirmation`, `confirm-check-in-time`, `report-attendance`, `reschedule-session`, `cancel-session`, `resolve-session-dispute`, `deliver-answer`, `rate-answer`, `log-revision`, `submit-followup`, `propose-upgrade`, `accept-upgrade`, `decline-upgrade`, `end-mentorship`, `set-testimonial-public`; forms `session-note`, `prep-checklist`, `propose-check-in-time` | 9 |
| [server/office-hours.js](../../server/office-hours.js) | `open-office-slot`, `set-office-preferred-time`, `close-office-slot`, `skip-office-date`, `book-office-hours`, `rebook-office-slot`, `calendar-link` | 9 |
| [server/mentor-onboarding.js](../../server/mentor-onboarding.js) | `mentor-onboarding-save`, `mentor-onboarding-back`, `approve-mentor`, `reject-mentor` | 9, 12 |
| [server/mentor-safety.js](../../server/mentor-safety.js) | `lift-limit`, `suspend-mentor`, `reinstate-mentor` | 9, 12 |
| [server/mentor-payments.js](../../server/mentor-payments.js) | `set-format-price`, `start-payout-setup`, `pay`, `simulate-payment`, `confirm-delivery`, `open-payment-dispute`, `resolve-payment-dispute`, `pricing-config`, `accept-paid-reschedule`, `decline-paid-reschedule` | 10 |
| [server/api.js](../../server/api.js) (dedicated endpoints) | `/api/login`, `/api/signup`, `/api/demo`, `/api/logout`, `/api/profile`, `/api/upload`, `/api/state`, `/api/account/visibility`, `/api/account/block`, `/api/account/sessions/revoke`, `/api/account/delete`, `/api/account/export`, `/api/calendar/{token}.ics`, `/api/payments/webhook`, `/api/email/brevo-webhook`, `/api/email/unsubscribe`, `/api/health`, `/api/capabilities` | 2, 3, 9, 10, 11, 13, 15 |
