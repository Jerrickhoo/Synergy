# Synergy — Full Feature Breakdown

A Matchmaking + Execution Platform for Early-Stage Startups

Nov 9, 2026 · @jerrickho

This is the current product specification. The [original brief](Synergy.md) is kept unchanged for provenance. The mentor side is being built in phases. See the [mentor roadmap](MENTOR-ROADMAP.md) for which sections are delivered.

## 1. The One-Sentence Pitch

An app that looks at what your startup has and what it needs, finds the startup or mentor who complements you — not just someone similar — and then gives you a shared workspace to actually get the work done, instead of the connection dying in a DM.

For mentors, Synergy is the easiest way to give back: they set how much time they have, receive only well-prepared requests that fit their expertise, and build a visible record of the founders they've helped.

## 2. The Problem, In Detail

Founders need many things to grow — beta testers, co-marketing partners, mentors, technical advice, warm intros — and all of it runs through the same broken pipeline.

### For founders

- **Discovery depends on your network.** If you don't already know the right person, you're stuck. This hurts newer founders, founders from smaller cities, and those outside existing founder circles — often the people who need help most.
- **Founders don't know how to describe what they need.** "We need help getting our product in front of people" could mean beta testers, a co-marketing partner, or a distribution mentor — three different needs with three different search strategies.
- **Manual search is exhausting and low-yield.** Scrolling LinkedIn, cold-messaging strangers, and posting in groups eats founder time with a low hit rate.
- **Even a good match usually goes nowhere.** Two people have one good call, say "let's stay in touch," and nothing happens. There's no shared to-do list, no deadline, and no record of who promised what.
- **There's no accountability or reputation system.** If someone flakes, there's no record of it for the next founder.

### For mentors

- **Too many vague requests.** Mentors get messages like "Can you mentor us?" or "Can we pick your brain?" with no context, so every request takes extra time just to understand.
- **No control over their time.** Saying yes to everyone leads to burnout; saying no feels bad. There's no easy way to set limits.
- **Requests outside their expertise.** A pricing expert gets asked about fundraising, and a UI/UX mentor gets asked about legal setup.
- **No feedback on their impact.** Mentors give advice and never find out if it was used, which is the main reason they stop mentoring.
- **No recognition.** Hours of mentoring leave no visible record that builds their professional reputation.

The app is designed to fix every one of these failure points for both sides, not just one.

## 3. Who Uses the App

### Startups

Founders or team members of an early-stage company. They can offer resources (an active audience, technical skill, a testing ground) and request resources (beta testers, marketing help, expert guidance).

### Mentors / Domain Experts

People with specific expertise — business strategy, product, marketing, fundraising, technical architecture, or industry knowledge — who give guidance to startups in an advisory role, not a full working partnership.

Target mentors, starting local and growing outward:

- University alumni and faculty with industry experience
- Local industry professionals and business owners
- Founders from more mature startups who want to give back
- Incubator and accelerator coaches
- Online mentors from anywhere, once the local base is established

A founder can also be a mentor in their area of strength.

#### Why mentors join

Mentors don't get a startup partnership out of the platform, so Synergy gives them other clear reasons to stay:

| What they get            | How the app delivers it                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Reputation               | A public Impact Profile showing sessions done, founders helped, ratings, and badges                 |
| Low effort               | They set their own limits; requests arrive pre-filtered, structured, and matched to their expertise |
| Visible impact           | Founder follow-ups show what founders actually did with their advice                                |
| Recognition              | Badges (Verified, Top Mentor) and downloadable certificates of mentoring hours                      |
| Early access to startups | Investor-type mentors see promising teams early                                                     |
| Paid sessions (future)   | v1.1 supports free and paid formats through Synergy checkout, with a 15% platform fee            |

### Platform Admin / Moderator (internal role)

Reviews new tags before they join the shared vocabulary, verifies mentor applications, handles disputes the mutual-confirmation flow can't resolve, and monitors for abuse or fake profiles.

## 4. Onboarding Flow, Step by Step

### Shared steps (all users)

1. **Sign-up and verification.** Users verify through a business email domain or a roster check (an accelerator, university program, or known founder community), so the platform stays a trusted space rather than an open marketplace.
2. **Choose your role.** Startup, mentor, or both.
3. **AI-assisted profile builder.** The user describes themselves in their own words, e.g. "We're a 6-person team building a budgeting app for students, 8 months in, looking for people to try it and tell us what's broken." The AI:
   - Extracts what the user offers and what they need
   - Suggests standardized tags from a shared, controlled vocabulary ("people to try our product" and "early adopters" both map to Beta Testers)
   - Flags anything that doesn't match an existing tag for admin review
4. **Structured details.** The user confirms or edits industry, stage (idea / pre-seed / seed / growth), team size, audience size, and goals.
5. **Profile goes live.** Startups begin receiving matches right away. Mentors go live after verification (below).

### Mentor-specific steps

Founders act on mentor advice, so a fake or unqualified mentor does more damage than a fake startup. Mentor onboarding is stricter:

1. **Stronger verification.** LinkedIn profile, work email, or an endorsement from a trusted organization (incubator, university, partner company), followed by admin approval.
2. **Expertise tags.** Chosen from the same controlled vocabulary startups use, so matching works both ways (e.g. SaaS Pricing, Fundraising, UI/UX, Go-to-Market).
3. **Experience summary.** Past roles, notable projects, and the kinds of problems they've solved.
4. **Capacity settings — the most important step:**
   - Maximum active mentees at once (e.g. 3)
   - Hours available per month (e.g. 4)
   - Response time they can commit to (e.g. within 3 days)
5. **Accepted formats.** Which engagement types they take: Quick Ask, Doc/Pitch Review, Single Session, Office Hours, Ongoing Advisory (see Section 10).
6. **Preferences.** Startup stages and industries they most want to help.
7. **Conflict-of-interest disclosure.** Companies they advise, work for, or invest in, so they aren't matched with direct competitors.
8. **Mentor guidelines agreement.** A short code of conduct: respect founder confidentiality, no equity or off-platform payment requests, show up to booked sessions.

## 5. The Matching Engine, In Detail

### What it looks for

The engine searches for people who complete you, not people who look like you. A startup with a strong audience but weak technical skills complements one with strong technical skills and no audience. A founder who needs fundraising guidance is better matched with a mentor who has raised capital than with another early-stage founder.

### Scoring factors

| Factor           | Applies to     | What it measures                                                   | Example                                                                      |
| ---------------- | -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Need Fit         | All matches    | Overlap between one side's needs and the other's offers            | Startup A needs beta testers; Startup B has 500 active users willing to test |
| Expertise Fit    | Mentor matches | Whether the mentor's specialty addresses the founder's actual goal | Goal: pricing strategy; mentor: SaaS pricing and monetization                |
| Industry Fit     | All matches    | Same or adjacent industries                                        | A fintech startup and a fintech-focused mentor score higher                  |
| Stage/Size Fit   | All matches    | Compatible stage or size                                           | Two startups with a 10x audience gap are down-weighted for an audience swap  |
| Goal Fit         | All matches    | Both sides want the same kind of outcome                           | One-time favor vs. ongoing partnership lowers the score                      |
| Availability Fit | Mentor matches | Whether the mentor has open capacity right now                     | A mentor at their mentee limit drops in the ranking                          |
| Format Fit       | Mentor matches | Whether the mentor accepts the format the founder wants            | Founder wants a call; mentor only does async reviews                         |

Each factor is weighted and combined into one compatibility score, always shown with a plain-language explanation:

> 85% Match — Strong need/offer overlap (beta testing), same growth stage, moderate industry overlap, clear goal alignment.

### How mentors see requests

Mentors see the same score from their side, plus a Request Quality signal. Detailed, well-prepared requests rank higher in the mentor's inbox, which rewards founders who do their homework.

> 88% Match — Question is about SaaS pricing (your top skill), same industry, wants a Single Session (a format you accept), detailed request.

### Match discovery

- A daily or weekly digest of new high-scoring matches
- A browse/search view with filters: startup vs. mentor, industry, engagement type, and (for mentors) availability and format
- A "why this match" breakdown on every suggestion
- Save/bookmark a match without committing yet
- Available now filter for mentors with open slots this week

## 6. From Match to Workspace

Startup-to-startup matches and mentor matches use different flows, because mentoring is one-sided: the mentor gives time and the founder receives help. Mentors use a request-and-accept flow, like booking a doctor, not mutual "likes."

### Startup ↔ Startup: Match to Deal Room

1. **Match suggested.** The app shows a potential partner with a score and explanation.
2. **Interest expressed.** When both sides express interest, a Deal Room is created automatically. A short intro message can be sent before both sides commit.
3. **Deal Room created from a template.** Based on engagement type (Beta Testing Exchange, Co-Marketing Swap), it comes pre-filled with milestones, fields, and a chat thread.
4. **Terms Agreed.** Both sides lock in scope, timeline, and expectations before work starts.
5. **In Progress.** Milestones are checked off as they're genuinely completed.
6. **Launched.** The core deliverable is done.
7. **Reviewed.** Both sides submit blind ratings; the deal is archived but stays in both histories.

### Startup → Mentor: Request to Mentorship Room

1. **Mentor recommended.** The founder sees ranked mentors, each with a score and "why this match."
2. **Mentorship Request drafted.** The founder fills in a short structured form:
   - What's the problem?
   - What have you already tried?
   - What specific question do you want answered?
   - Which format do you prefer?
3. **AI sharpens the request.** It turns vague asks into specific ones, e.g. "help us with marketing" becomes "How do we get our first 100 student users with no budget?"
4. **Request sent to the mentor's inbox.** The mentor can:
   - Accept — a Mentorship Room is created
   - Decline with a one-tap reason (outside my expertise, no slots this month)
   - Refer the request to another mentor who fits better
5. **Auto-expiry.** If the mentor doesn't respond within their stated response time, the request expires and the founder is shown similar available mentors. No founder waits forever.
6. **Mentorship Room stages:** Request Accepted → Goal Confirmed → Session Held → Action Items Logged → Founder Follow-up → Reviewed (details in Section 7).

For Office Hours, the flow is shorter: the mentor opens time slots, founders book a slot with a short request form, and the room opens at booking.

## 7. Deal Room & Mentorship Room Features

### Deal Room (startup ↔ startup)

- **Milestone checklist** — specific to the engagement type; major changes require both sides to re-agree.
- **Mutual confirmation** — a milestone isn't complete until both sides check it off.
- **Evidence attachments** — for key milestones (marked with * in Section 10), users attach a screenshot, document, or link as proof.
- **Dedicated chat** — scoped to that deal.
- **Deadlines** — optional target dates per milestone, with reminders.
- **Status badge** — Matched, Terms Agreed, In Progress, Launched, or Reviewed.
- **Dispute flag** — either side can flag a disputed milestone for admin review.
- **Archive and history** — completed rooms stay visible and feed each user's trust history.

### Mentorship Room (startup → mentor)

The Deal Room is built around trades; the Mentorship Room is built around goals and action items, so it's lighter.

- **Goal card** — the founder's specific question and desired outcome, confirmed by the mentor before the session.
- **Session scheduling** — the founder picks from the mentor's available slots; a video-call link is attached.
- **Prep checklist for founders** — share context (deck, metrics, links) at least 24 hours before the session so the mentor doesn't start from zero.
- **Shared session notes** — both sides can add notes during or after the call, so advice isn't lost.
- **Action items** — tasks assigned to the founder from the session (e.g. "Test 2 pricing tiers with 20 users").
- **Founder follow-up** — about two weeks later, the founder reports what they did and what happened. The mentor is notified, so they see the impact of their advice.
- **Mutual confirmation** — "Session Held" needs both sides to confirm, so no-shows can't be hidden.
- **Upgrade option** — after a Single Session, either side can propose continuing as Ongoing Advisory without starting a new request.
- **Status badge** — Requested, Accepted, Goal Confirmed, Session Held, Follow-up, or Reviewed.

No milestone ever requires the mentor to do extra admin work beyond confirming the session and leaving a rating.

## 8. The Mentor Experience

Mentors get their own dashboard built around one goal: help founders well without it taking over their week.

### Mentor dashboard screens

| Screen                  | What the mentor does there                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Requests Inbox          | Reviews incoming requests ranked by fit and request quality; accepts, declines, or refers           |
| Calendar / Office Hours | Opens time slots, sees booked sessions, syncs with their calendar                                   |
| Active Mentees          | Sees every open Mentorship Room and its current stage                                               |
| Impact Page             | Their public-facing stats: sessions, founders helped, ratings, badges, founder follow-up highlights |
| Settings                | Capacity limits, accepted formats, topics, response time, Pause Mode                                |

### Capacity controls

Mentor burnout is the main reason mentor platforms fail, so limits are built in and enforced automatically:

- **Mentee limit** — once reached, the mentor stops appearing as "available" and new requests are routed to similar mentors.
- **Monthly hours** — sessions booked count against the mentor's stated hours.
- **Pause Mode** — one tap to stop all new requests (e.g. during a busy work month) while keeping active mentees.
- **Request cooldown** — a founder can't send the same mentor a new request within 30 days of a decline.

### Impact Profile

Every mentor's public profile doubles as a portfolio of their expertise:

- Total sessions and founders helped
- Average rating and top-rated skills
- Follow-through rate (how often their founders completed action items)
- Short founder testimonials (opt-in)
- Badges and downloadable certificates of mentoring hours

### Mentor community (future)

- A mentor-only space to swap tips and refer founders to each other
- Group Office Hours, where one mentor answers several founders on a shared topic

## 9. Trust, Ratings & Safety Features

### Shared features

- **Blind, simultaneous ratings.** Both sides rate without seeing the other's response first, which prevents retaliation or rating-for-rating.
- **Trust history.** Completed engagements, average rating, and how often a user follows through versus how often engagements stall.
- **Verification badges.** Shown on every profile.
- **Reciprocity-inflation safeguards.** The platform flags patterns like a user who rates everyone 5 stars regardless of outcome.
- **Reporting and flagging.** For inappropriate behavior, ghosting, or bad faith, feeding into admin review.

### Two-way mentor ratings

Mentors and founders are rated on different things:

| Who rates        | Rates the other on                            |
| ---------------- | --------------------------------------------- |
| Founder → Mentor | Usefulness of advice, clarity, responsiveness |
| Mentor → Founder | Preparedness, follow-through on action items  |

### Mentor trust signals

- Response rate and average response time
- Sessions completed and no-show rate
- Follow-through rate — the percentage of their founders who completed action items. This is the strongest signal that a mentor's advice actually gets used.

### Badges

- **Mentors:** New Mentor → Verified Mentor → Top Mentor (based on sessions, ratings, and follow-through rate)
- **Founders:** Prepared Founder (consistently well-prepared and follows through), which helps them get accepted by busy mentors

### Mentor-specific safety rules

- **No-show policy.** Repeated no-shows by either side lower trust and can trigger temporary request limits.
- **Paid mentoring must use Synergy checkout. Equity requests are prohibited.** Prevents "I'll help you for 5% of your company" situations.
- **Confidentiality.** Mentors agree not to share founders' private information or ideas.
- **Conflict-of-interest checks.** Mentors are not matched with direct competitors of companies they disclosed.
- **Block and report** for both sides.

## 10. Types of Engagements, In Detail

Each engagement type is a reusable template (fields + milestone checklist + evidence requirements), not custom code, so new types can be added without rebuilding the app. Milestones marked * need evidence or mutual confirmation.

### Startup ↔ Startup engagements

**Beta Testing Exchange** — for startups that need real users to test their product.

Scope defined → Testers assigned → Testing round* → Feedback submitted* → Issues reviewed

Good fit when one side has an active user base and the other has a product ready for testing.

**Newsletter / Audience Co-Marketing Swap** — for startups that want to cross-promote to each other's audiences.

Assets shared → Draft approved → Send date locked → Swap executed → Results reported*

Includes an audience-size compatibility check, since 50,000 vs. 500 subscribers isn't a fair swap.

### Startup → Mentor engagements: the engagement ladder

Most mentors won't commit to ongoing advising with a stranger, so the platform offers small entry points that can grow over time. Each format is its own template:

| Format           | What it is                                                                    | Mentor effort   | Milestones                                                                             |
| ---------------- | ----------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| Quick Ask        | One specific question, answered in text within the mentor's response time     | 10–15 min       | Question sent → Answer delivered* → Founder marks helpful                              |
| Doc/Pitch Review | Founder uploads a deck, plan, or landing page; mentor leaves written feedback | 30–60 min       | Doc uploaded → Review delivered* → Revisions logged                                    |
| Single Session   | One 30–60 minute video call on a confirmed goal                               | About 1 hr      | Goal confirmed → Session held* → Action items logged → Follow-up*                      |
| Office Hours     | Mentor opens recurring slots; founders book them                              | Mentor's choice | Slot booked → Session held* → Action items logged                                      |
| Ongoing Advisory | Recurring check-ins over 1–3 months toward a bigger goal                      | Highest         | Goals defined → Check-ins held* (recurring) → Progress reviewed* → Engagement reviewed |

Trust builds gradually: a Quick Ask can lead to a Single Session, which can lead to Ongoing Advisory.

### Future engagement types (supported by the architecture)

- **Warm Intro Facilitation** — one side connects the other to a valuable contact.
- **Technical Collaboration** — shared technical work, like API integration testing.
- **Investor Prep / Mock Pitch** — a mentor runs a mock investor Q&A.
- **Paid Mentor Sessions** — mentors set a rate; the platform takes a fee.

## 11. Where AI Shows Up, In Detail

### 1. Onboarding Assistant

- Turns casual self-descriptions into clean profile data, for startups and mentors.
- Suggests tags from the existing vocabulary before proposing a new one.
- Asks for clarification on ambiguous input, e.g. "Did you mean you need funding advice or investor introductions? These are matched differently."
- Sends new tags to admin review before they join the shared vocabulary.

### 2. Mentorship Request Assistant

- Rewrites vague requests into specific questions a mentor can answer quickly.
- Prompts the founder for missing context (what they tried, relevant metrics, links).
- Suggests the right format, e.g. "This sounds like a Quick Ask, not a full session."

### 3. Session Summary Helper (optional)

- Turns shared session notes into a clean list of action items for the founder.
- The mentor reviews and edits the list before it's saved.

### 4. Smarter Matching Layer (added later, once there's real usage)

- Recognizes near-matches with different wording, e.g. "early adopters to try our product" and "beta testers."
- Introduced only after the rule-based system is stable, so early users always get transparent, explainable matches first.

### Where AI does not replace human judgment

Decisions to connect, accept a request, agree to terms, or complete an engagement are always made by the people involved. AI only helps describe needs, sharpen requests, and rank suggestions.

## 12. Notifications & Everyday Use

### For founders

- **New match alerts** — when a new high-scoring match appears.
- **Deal Room / Mentorship Room activity** — messages, milestone updates, confirmations needed.
- **Request updates** — accepted, declined, referred, or expired (with suggested alternatives).
- **Follow-up reminders** — a nudge to report progress on action items two weeks after a session.
- **Rating prompts** — once an engagement reaches Launched or Session Held.

### For mentors

- **New request alerts** — batched into a daily summary by default, so mentors aren't pinged constantly.
- **Session reminders** — 24 hours and 1 hour before a booked session, with the founder's prep materials attached.
- **Founder follow-up updates** — "Maria tested your pricing advice — here's what happened."
- **Expiring requests** — a heads-up before a request auto-expires.
- **Capacity alerts** — when they're close to their mentee or hours limit.

### For everyone

- **Digest mode** — a daily or weekly summary instead of individual notifications.

## 13. Example User Journeys (End to End)

### Journey A: Startup ↔ Startup

Maria runs a 4-person budgeting app startup, 8 months in, with almost no active users.

1. During onboarding she describes her situation casually. The AI tags her as needing Beta Testers and offering an active dev team and a completed MVP.
2. The next day she gets a match: Campus Grocer, with 600 active student users, looking to offer testing in exchange for early access to new tools. Score: 82% — strong need fit, same stage, overlapping student audience.
3. Both founders express interest, and a Beta Testing Exchange Deal Room is created.
4. In Terms Agreed, they set 50 testers, a 2-week window, and feedback through a shared form.
5. They mutually confirm milestones; "Testing round" gets a screenshot as proof.
6. After feedback is reviewed, both leave blind ratings. Maria's trust history now shows one completed, well-rated exchange.

### Journey B: Startup → Mentor

After the beta test, Maria's users like the app but she doesn't know how to price it.

1. Synergy recommends Ana, a former product manager at a local software company who now mentors on SaaS pricing. Score: 88% — exact expertise fit, same industry, Ana has 1 open slot this month.
2. Maria starts a request: "We need help with pricing." The AI asks what she's tried and sharpens it to: "Should we charge students ₱99/month or use a free tier with paid features? We have 50 beta users and no revenue yet." It suggests a Single Session.
3. Ana sees the request ranked high in her inbox (clear question, good fit) and accepts. A Mentorship Room opens.
4. Maria uploads her beta feedback summary 24 hours before the call, as the prep checklist asks.
5. In a 45-minute call, Ana recommends a free tier plus one paid plan, and testing two price points. Both add to the shared notes, and two action items are logged for Maria.
6. Both confirm "Session Held." Two weeks later, Maria posts her follow-up: 12 of 50 users chose the paid plan at the lower price. Ana gets notified.
7. Blind ratings: Maria rates Ana highly for usefulness; Ana rates Maria highly for preparedness. Maria earns progress toward a Prepared Founder badge, and Ana's follow-through rate goes up.
8. Ana proposes continuing as Ongoing Advisory for the launch, and Maria accepts — no new request needed.

## 14. What Makes This App Genuinely Different

Most comparable platforms do only one half of the problem:

- Some suggest connections but leave users to "take it from here," so promising matches quietly die.
- Others offer project-tracking tools but assume you already found the right person.
- Mentor platforms usually work like directories: founders cold-message mentors, mentors get flooded, and nobody tracks whether the advice helped.

Synergy owns the whole process. It finds the right complementary partner or mentor with a transparent score, then gives the connection real structure: milestones, mutual confirmation, evidence, and ratings for startup deals; structured requests, capacity limits, action items, and founder follow-ups for mentorship. It's designed so mentors want to stay, not just so founders can find them.

## 15. Quick Recap

- **Core idea:** Match startups with what they're missing — not who they resemble — then help them actually finish the collaboration.
- **Two match types, two flows:** startup ↔ startup uses mutual interest and a Deal Room; startup → mentor uses a structured request, accept/decline/refer, and a Mentorship Room.
- **Mentor side:** stricter verification, capacity controls and Pause Mode, an engagement ladder (Quick Ask, Doc/Pitch Review, Single Session, Office Hours, Ongoing Advisory), an Impact Profile, and founder follow-ups that show mentors their impact.
- **Key features:** AI-assisted onboarding and request sharpening, explainable multi-factor scoring, templated workspaces, mutual confirmation, evidence attachments, blind two-way ratings, and visible trust history.
- **Supported today:** Beta Testing Exchange, Co-Marketing Swap, and five mentor formats — with an architecture that supports adding more, including paid mentor sessions later.
- **Why it works:** It replaces "who do I happen to know" with an explainable system for finding the right fit, replaces "let's stay in touch" with a trackable plan, and gives mentors a reason to keep showing up.
