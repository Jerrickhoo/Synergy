# Mentor side UI/UX review — 2026-11-25

Walked through as `mentor@gmail.com` (dev account) at 1440px desktop: Home, Requests, Startups, Mentees, Calendar, Impact, Updates, Settings, accepting a Quick Ask and opening the Mentorship room. Mobile widths were not checked.

Overall: the flows work and the copy is clear, but most pages are a stack of same-weight white cards. The thing the mentor came to do (answer a request, deliver an answer, see their next session) rarely gets the most size, position or the primary button.

## P1 — Flow and hierarchy

1. **Home after accepting turns into an empty calendar.** With one mentee waiting on "Deliver your answer", Home shows a full-size empty month grid and a tiny "Your tasks" list. Lead with the task as a card with a primary "Write answer" button that opens the room on the Answer field. Collapse the calendar to "Next 7 days" or hide it when it has no events.
2. **The Mentorship room hides its main action.** "Your turn: Deliver your answer" is a plain banner, not a link. The Answer box sits below the whole goal recap, and "Deliver response" is a full-width pale tint that looks disabled. Make the banner jump to and focus the answer field, and put Answer beside or straight after the founder's question. Style "Deliver response" as the one primary button, at normal width.
3. **The request card has no hierarchy.** Seven lines of the same weight ("Quick Ask · 10–15 min · Expires in 3 days", "78% match · Strong fit", "First mentorship request", and so on). Group them as format + expiry (expiry in the accent colour when ≤3 days) and fit, then the founder's four answers, then actions. "View profile" runs straight on from "FinTech" with no separator.
4. **Safety controls sit inline with Accept/Decline.** "Report ▶ Block this collaborator" is a text triangle and a bare disclosure under the main actions. Move both into a "⋯" overflow menu on the card, using the shared icon set.
5. **Home duplicates Requests.** With one request, Home shows the full request card, a full-width "View all requests" button and an "Introductions to answer: 1" metric tile for the same request. Keep one compact request preview on Home and drop the duplicate tile. Show "View all" only when there are more requests than shown. Use "requests" everywhere. Mentors never see "introductions" elsewhere (Updates also says "Respond to introductions").
6. **The Startups card ignores an existing request.** Dev Startup's card says "Wants to connect with you · View match to reply", but the request is already in Requests. Link straight to the request ("Sent you a Quick Ask · Reply").
7. **The Calendar page leads with the Office Hours form.** The date/time form and "Create calendar link" take the first screen, and the calendar starts below the fold. Put the month/agenda view first. Move "Open slot" into a dialog or side panel opened by an "Open office hours" button, and move the subscription into a smaller section or Settings.
8. **Office Hours closed has no fix.** "Closed to founders right now: Office Hours (no open slots)" appears in brown on Home and Settings with no action. Add "Open a slot", linking to the Calendar form.

## P2 — Empty states and redundancy (CLAUDE.md rules 1, 2, 6, 9)

9. **Mentees empty state** is a single sentence, and "Room history" is the only button. Say what's waiting ("1 request waiting — review it") with a primary button to Requests.
10. **Impact empty state.** The "New Mentor" pill is a filler badge (rule 1). "Mentoring impact" repeats the page title (rule 2). "View volunteer certificate" is offered with 0 sessions. Hide the certificate button until there is something to certify. Show the empty state as the three tiles it will become (Sessions 0, Founders helped 0, Hours 0) with one line on how to fill them.
11. **Updates.** "Badge earned: You earned the New Mentor badge" is noise, so remove that notification type for the default badge. "Mark all as read" looks enabled with 0 unread, so disable it.
12. **Startups cards.** The small "Startup" eyebrow above every name on a page called Startups is redundant (rule 2). "Strong needs and offers fit" repeats the % ring. The "Needs help you offer" label wraps onto 2 lines and misaligns the chips, so shorten it to "Needs you cover". The "4" count pill next to "Suggested for you" adds nothing.
13. **Mentees card.** The "Accepted" heading is vague. Show the status as the next step ("Your turn: deliver answer") in the accent colour, and make "Open room" the primary button.
14. **The room header is generic.** "Mentorship room", with the breadcrumb "Workspace / Mentorship room", while the sidebar highlights Mentees. Title it "Dev Startup" with "Quick Ask" as the subtitle, and change the breadcrumb to "Mentees / Dev Startup".
15. **The calendar side panel.** The "Selected day" label is redundant. "Wednesday · 2026 · 0 events" is an odd format. "Plan a session — Browse startups" is a generic upsell in a mentor's calendar. Replace it with "Open an office-hours slot on this day".
16. **The top bar is mostly empty and repeats the user.** The 64px header holds only a bell and an avatar that duplicates the sidebar footer (rule 2). Either put the page title and breadcrumb there on every page, or drop the avatar and let the bar hold just the bell.

## P3 — Settings

17. **One very long page with no section nav**, covering Mentoring, Conflicts, Guidelines, Payouts, Appearance, Notifications, Survey, Profiles, Blocked and Account. Add a sticky in-page section list, or split it into tabs (Mentoring · Payouts · Notifications · Account).
18. **Payouts has 5 separate "Save price" buttons**, all for prices the mentor can't charge until payout setup is done. Use one price table with a single save. While setup is incomplete, show only the setup CTA.
19. **Notifications** lists 16 email checkboxes in one block. Group them (Requests, Sessions, Payments) and cut the list. The "View calendar" link inside Notifications is out of place.
20. **"Mentoring survey"** is research, not a setting. Move it to a one-time prompt on Updates or Impact.
21. **"Mentoring" section** has an empty gap between its heading and description, and "Pause Mode" is title-cased while other headings are sentence case.

## P4 — Design-system hygiene (rules 5, 12, 13, 15, 18)

22. `src/mentorship.css` uses raw px for margins and gaps (24px, 6px 0 12px, 14px, 28px, 13px font). Replace them with `--space-*` and `--text-*` tokens. 14px and 28px have no matching token, so snap them to `--space-3`/`--space-4` and `--space-6`.
23. `.workspace-label` in `src/styles.css:403` hard-codes `#a9c8c9` and an uppercase caption with letter-spacing, so it needs a token. Home's "Recent activity" also uses a tiny uppercase "REQUESTS" category label. Use sentence case at caption size.
24. Small grey captions ("Founders see", "Formats you offer", the calendar footer notes, "Wednesday · 2026 · 0 events") look under 4.5:1 on white. Verify them in light and dark mode.
25. Counts and metrics need `tabular-nums`: "0 of 3", "0 of 4 h", match %, calendar day numbers, ₱ amounts.
26. Pair "View your profile" (an outline button) with "Change availability" (a bare link) using the same style, with a gap between them.
27. The blue dot before "Deliver your answer" in Home's task list carries no meaning on its own. Either make it a status colour with a legend or remove it.

---

## Paste-ready prompt

> Fix the mentor-side UI/UX issues listed in `docs/testing/MENTOR-UX-REVIEW.md`, in priority order P1 → P4. Follow the UI rules in my global CLAUDE.md for every change, using the existing tokens in `src/theme.css` with no new hex values or magic numbers.
>
> Scope: `src/components/MentorHome.jsx`, `MentorImpact.jsx`, `MentoringSettings.jsx`, `MentorshipRoom.jsx`, `HomeMetrics.jsx`, `Sidebar.jsx`/`Topbar.jsx` (only for item 16), `src/pages/RequestsPage.jsx`, `MenteesPage.jsx`, `CalendarPage.jsx`, `ImpactPage.jsx`, `NotificationsPage.jsx`, `SettingsPage.jsx`, `DiscoverPage.jsx`/`MatchCard.jsx` (mentor view only), `src/mentorship.css`, `src/styles.css`. Don't change founder-side behaviour. Where a component is shared, branch on role.
>
> Rules:
> - The main action on each mentor page (reply to a request, deliver an answer, open the next session) gets the most size and the single primary button.
> - Keep server/API behaviour unchanged. This is presentation and navigation only, except removing the "New Mentor" badge notification (item 11).
> - Keep every existing Prototype-only control working.
> - Update or add Playwright specs in `tests/mentor-*.spec.js` for changed text and selectors. Run `npm run test:unit` and the mentor e2e specs, and `npm run check:format`.
> - After each priority group, run the app (`npm run dev`), sign in as `mentor@gmail.com`, and check the changed pages at 1440px and 390px in light and dark mode before moving on.
> - Commit once per priority group with a short message naming the items fixed.
