# Phase 4 — Calendar and scheduling

Completed October 29, 2026, following the [Phase 3 delivery](PHASE-3-DELIVERY.md).

## Delivered

| Area                       | Result                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar overview          | Removed the decorative hero and separate promotional/upcoming sections. Compact controls provide Month/Agenda, collaboration filtering, previous/next month, month/year and Today. Seven equal columns, complete week rows, event labels and an overflow count keep the month readable. Mobile uses per-day event counts and a full agenda below the grid. |
| Selected day               | A side agenda appears beside the month on wide screens and below it on narrow screens. It includes session time/duration, task and UTC milestone labels, collaborator context and links to the correct room tab. Today and selection have distinct treatments, including when both apply to one date.                                                      |
| Agenda view                | Groups the displayed month's events by date and preserves the collaboration filter. Month navigation and Today remain available. Empty months have a useful explanation. A filter whose collaboration closes automatically falls back to All collaborations.                                                                                               |
| Calendar keyboard behavior | One date per grid is in the Tab sequence. Arrow keys move by day/week; Home/End move within a Monday–Sunday week; Page Up/Down move by month; Shift+Page Up/Down move by year. Enter/Space select a date. Focus follows keyboard movement across months and years; picker navigation respects the minimum date.                                            |
| Focused session planner    | Both the Schedule tab and session milestone action open the same planner. A compact date picker sits beside starting-time suggestions, a custom time input, duration and recurrence on desktop, with stacked controls on mobile. The picker retains six rows while the overview uses the month's actual four/five/six occupied weeks.                      |
| Review before saving       | A separate review step shows the first session, timezone/UTC offset, duration, recurrence and meeting context. A disclosure lists every date in a weekly series. Review makes no save request; Back preserves selections. The final action shares the schedule. Failed saves preserve the review for retry.                                                |
| Honest availability        | Suggested times are explicitly starting points; partner availability and conflicts are not checked. Chat remains the place to agree on availability and a meeting link. No external booking/calendar provider or availability model was introduced.                                                                                                        |
| Saved and closed states    | Saved sessions show actual timestamps in the viewer's timezone and their recorded duration. Legacy records without duration say “Duration not specified.” Replacing a series clearly explains that the entire series is replaced and both session confirmations are cleared. Closed collaborations retain saved history but disable scheduling.            |

## Time and persistence rules

New schedules use the device timezone. Editing an existing series retains its recorded IANA timezone and clock time; the form submits that explicit timezone. A collaborator in another timezone sees a note explaining the difference, while the saved-session list continues to show their local equivalents. This prevents an unchanged save from shifting later weekly sessions when the viewer's daylight-saving rules differ from the series' rules.

Weekly recurrence advances calendar dates in the series timezone, retaining the intended local clock time. Session instants are converted for display in the viewer's timezone. Date-only task deadlines remain assigned dates; milestone dates retain their UTC semantics. Calendar views never shift those deadline strings into a different date.

`durationMinutes` is an optional schedule field, accepted at 15, 30, 45, 60, 90 or 120 minutes. It is copied to every weekly occurrence and mirrored to both collaborators. Older API callers can omit it; their schedule shape remains compatible. The planner offers an explicit duration before review instead of inventing duration for old saved history.

Timezone conversion now checks that the resulting instant maps back to the requested local date and time. Nonexistent clock-change times are rejected, including gaps later in a weekly series. Past times, invalid dates, unsupported durations and counts outside 1–12 are rejected before saving. The review includes the resolved UTC offset; this phase does not add a separate chooser for both occurrences of an ambiguous repeated clock time.

The active room tab is scrolled horizontally into view on small screens, including when a calendar link opens Schedule or Task board. This does not scroll the page vertically or cover content.

## Verification

- All 68 unit tests passed. Five new planning checks cover aligned four/five/six-week month grids, fixed picker height, keyboard/leap/year boundaries, recurring times and durations across daylight-saving transitions, invalid clock gaps/durations/counts, and local session dates versus unchanged deadlines in Manila and Los Angeles. Existing shared-scheduling tests now verify duration across both participants.
- All 76 existing browser scenarios passed across Chromium, Firefox, WebKit and the prototype project. The mobile scheduling scenario now exercises the single planner, duration, review, save and rescheduling before checking Updates read state.
- After the room-tab and timezone refinements, nine collaboration/scheduling/accessibility scenarios and six further scheduling/accessibility scenarios passed across all three engines.
- Playwright CLI exercised a real six-event day, overflow counts, Month/Agenda switching, collaboration filters, four- and six-week month navigation, Today versus selection, a single grid tab stop, keyboard movement across month/year boundaries and event links to Tasks, Milestones and Schedule.
- Planner checks covered disabled past dates, six-row date picking, keyboard date selection, date-change time reset, suggested/custom times, duration, recurring-date preview, focus on review, no save request before confirmation, Back preserving values, interrupted save and retry, persistence to both collaborators, clearing both confirmations, and the Chat meeting-link entry.
- Separate Manila and Los Angeles browser contexts showed the same session on the correct local date and kept task/milestone dates unchanged. Los Angeles displayed the correct local offsets before/after its clock change. Saving the unchanged series from that context left all persisted occurrence dates, times, durations and timezone identical.
- A live closed-room check verified filter recovery, read-only scheduling and a mentor empty state that invites connection with a founder. Reduced-motion and forced-colors focus checks passed.
- Reviewed layouts at 360, 390, 768 and 1440px with no horizontal page overflow. Selected room tabs remain visible on narrow screens; saved-session rows retain readable space for dates and times.
- Automated axe checks reported zero WCAG 2 A/AA and 2.1 AA violations on Month, Agenda, date/time selection and review after correcting contrast for adjacent-month dates and saved-session status text.
- Format check, production build and `git diff --check` passed.

## Main implementation locations

- `src/pages/CalendarPage.jsx`: Month/Agenda, collaboration scope, selected-day agenda and event destinations.
- `src/components/WorkspaceCalendar.jsx`: overview/picker variants, complete weeks, accessible grid, roving focus and month controls.
- `src/components/SchedulePanel.jsx`: session selection/review, recurrence preview, saved states and original-series timezone preservation.
- `src/components/MilestonesPanel.jsx`, `RoomDetailPage.jsx`: one scheduling entry point and visible active tabs.
- `src/data/planning.js`, `selectors.js`: date/grid/recurrence helpers, event preparation and timezone round-trip checks.
- `src/state/validation.js`, `transitions.js`, `AppContext.jsx`: duration validation/persistence, weekly schedules and explicit series timezone submission.
- `src/planning.css`: calendar/planner variants and responsive layouts; task-board styles and responsive behavior retained.
- `tests/planning.test.js`, `features.test.js`, `features.spec.js`: date/time behavior and the updated mobile workflow.

Ignored review artifacts and CLI scripts are in `output/playwright/phase4`. Useful captures: [desktop calendar](../../output/playwright/phase4/calendar-1440.png), [mobile calendar](../../output/playwright/phase4/calendar-390.png), [Agenda](../../output/playwright/phase4/agenda-desktop.png), [four-week month](../../output/playwright/phase4/calendar-four-weeks.png), [six-week month](../../output/playwright/phase4/calendar-six-weeks.png), [desktop planner](../../output/playwright/phase4/planner-1440.png), [mobile planner](../../output/playwright/phase4/planner-390.png), [review](../../output/playwright/phase4/schedule-review-desktop.png), [interrupted save](../../output/playwright/phase4/schedule-failed-save.png), [cross-timezone review](../../output/playwright/phase4/cross-timezone-review.png), and [mentor empty state](../../output/playwright/phase4/mentor-empty-calendar.png).

Restart an already-running backend to load the schedule validation/persistence changes. Review work used a separate disposable database; existing working-tree changes and the working database were preserved. Month and Agenda meet the reviewed workflow; a time-grid Week view and verified availability remain outside this phase. Subsequent work was completed October 30 in [Phase 5](PHASE-5-DELIVERY.md) and [Phase 6](PHASE-6-DELIVERY.md).
