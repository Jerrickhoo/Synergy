# Synergy UI and interaction roadmap

Copy this entire document into an AI coding agent with access to the Synergy repository. It is an implementation prompt: complete the work, not just another plan.

## Objective and execution instructions

Implement every requirement below in one continuous implementation pass, including frontend behavior, necessary server changes, persistence, verification, and delivery notes. Work through the phases in order without asking for approval between phases. Make reasonable design decisions using the defaults in this document. Ask for clarification only if a genuine blocker prevents safe progress; continue independent work meanwhile.

Inspect the current code and applicable repository instructions first. Some requested features already partially exist. Verify their behavior and improve or reuse them instead of creating duplicate components or flows. Preserve unrelated work and existing account isolation, collaboration rules, and data. Do not deploy or reset databases as part of this task.

Use the existing React/Vite architecture, shared components, and stylesheet ownership. Maintain Synergy's visual identity while improving spacing, hierarchy, consistency, and accessibility. Implement complete working interactions rather than placeholder buttons. Cover both Founder and Mentor profiles wherever applicable.

Interpretation defaults:

- “Acting room” means the **Active rooms** summary on Home.
- “Night mode” means **Dark mode**; Light is the default for a user with no saved preference.
- “Move unread to the right” means the **Unread status indicator inside each update row**, not moving unread updates into another column or changing their chronological order.
- Custom minimum fit uses whole percentages from **0 to 100 in 1% increments**.
- Danger zone is a collapsed disclosure/accordion with GitHub-inspired visual treatment, not a floating action menu.
- Prototype acceptance simulates a fictional collaborator accepting a pending introduction. It must never accept on behalf of a real account.

## Phase 1 — Shared appearance and themes

### R1. Light and Dark modes

- Introduce or consolidate semantic color tokens for backgrounds, surfaces, text, borders, inputs, overlays, and interaction/status colors.
- Add a clearly labeled Light/Dark preference in Settings. Default to Light on first use even if the operating system prefers dark. Persist explicit selection across refreshes and subsequent visits in the same browser.
- Apply the preference before the first visible render where practical to prevent a flash of the wrong theme.
- Cover the complete app, including authentication, navigation, cards, dialogs, popovers, dropdowns, calendar, and empty/error/disabled states.
- Keep text readable and controls distinguishable in both modes. Normal text should meet 4.5:1 contrast; large text and meaningful UI boundaries/indicators should meet 3:1 where applicable. Status must not depend on color alone.

**Acceptance:** A fresh browser opens in Light. A saved Dark preference survives refresh. Neither mode leaves unreadable text, unthemed surfaces, or invisible focus indicators.

## Phase 2 — Profiles, Settings, and sign-out

### R2. Collapsible Danger zone

- Convert the Settings Danger zone into one collapsed-by-default section with a clear title, chevron, restrained red border/accent, and short explanation.
- Expand actions inline with compact rows, descriptions, and clear buttons. Preserve existing confirmation requirements and the consequences of each action.
- Support keyboard activation, correct expanded state, and visible focus. Opening the section must not trigger an action.

### R3. One location for profile visibility

- Keep profile visibility controls and their explanatory status together inside Danger zone only. Remove the separate visibility settings card and duplicate controls elsewhere.
- Support both hiding/pausing discovery and showing/resuming discovery from this same location.
- Describe the actual existing behavior accurately, including effects on pending introductions. Preserve confirmations where appropriate.

### R4. Confirm active-profile switching

- Selecting another profile in Settings opens a confirmation dialog naming the current and target profiles.
- Do not change the active profile, navigation context, or saved data before confirmation.
- Cancel, Escape, or dismiss leaves the original profile selected. Selecting the already-active profile does not open a dialog.
- Preserve separate drafts for each profile and explain that unsaved edits remain unpublished. Never implicitly save a draft while switching.

### R5. Explicit Save profile behavior

- Audit all profile-editing entry points, including any fields exposed through Settings. Typing, blur, and Enter in a text input must not publish profile changes.
- Keep changes in a draft until the user explicitly activates **Save profile**. Mouse/touch activation and keyboard activation of the focused Save profile button must work.
- Enter in a multiline field inserts a newline. Enter may add an offer/need item to the draft where that is the intended editor behavior, but must not save the whole profile.
- Preserve unpublished drafts according to the existing per-tab/per-role model; distinguish local draft retention from saving the public profile.
- Give clear dirty, saving, success, validation-error, and failure states. A failed save retains the draft for retry. Cancel restores the saved values.

### R6. Change profile picture

- Add an accessible **Change photo** control with local file selection, preview, replacement, and removal back to the existing initials/default avatar.
- Treat the selected image as part of the profile draft: persist it only when Save profile succeeds. Cancel restores the original image.
- Accept JPEG, PNG, and WebP up to 5 MB; validate type, size, and decodability and show useful inline errors. Validate uploads on the server as well.
- Follow the existing profile image ownership model. Store uploaded images using the existing storage infrastructure or a compatible extension; do not rely on temporary object URLs after refresh.
- Update every surface that represents the edited profile after saving, including the header, profile, and relevant match/room displays. Preserve a usable fallback for missing or broken images.

### R7. Clean whitespace-only profile content

- Trim leading/trailing whitespace in **What I offer**, **What I need**, and **About me** when validating/saving.
- Discard empty offer/need entries, including spaces, tabs, or line breaks. Do not render empty chips or count blank content toward profile completeness or matching.
- Treat whitespace-only About me as empty. Apply existing required-field rules; do not invent new required fields.
- Preserve meaningful internal spaces and paragraph breaks. Enforce normalization on the server as well as the client, and render legacy blank content gracefully without an unrelated bulk data rewrite.

### R8. Improve the sign-out dialog

- Refine typography, width, padding, icon treatment if useful, and button hierarchy. Use **Cancel** and **Sign out**, with a clear explanation of the existing draft-clearing behavior.
- Reuse the shared dialog system for focus trapping, initial focus on Cancel, Escape handling, and focus restoration.
- Show progress, prevent duplicate submission, and keep the dialog usable if sign-out fails.

**Acceptance:** No public profile change occurs until Save profile is explicitly activated. Photo changes persist after a successful save and refresh. Blank entries disappear. Profile switching and sign-out have predictable cancel/confirm behavior. Visibility is managed in exactly one location.

## Phase 3 — Home and Calendar

### R9. Fill the Home header with useful content

- Improve the welcome area with a compact, contextual next-step summary and primary action using real app state.
- Prioritize a pending response/action, then an upcoming collaboration/session, then profile completion, then finding matches. Reuse existing selectors and destinations where possible.
- Keep the header concise and avoid repeating an identical action panel directly underneath it. Do not invent activity or add decorative filler to occupy space.
- Adapt copy and actions to Founder and Mentor workflows and stack content cleanly on mobile.

### R10. Improve Home summary cards

- Redesign **Active rooms**, **Introductions**, and **Saved matches** with consistent dimensions, spacing, count emphasis, concise supporting text, and useful icons where appropriate.
- Make the cards clearly interactive with hover/focus states and generous click targets.
- Preserve accurate role-specific counts and correct destinations. Saved matches must open the Saved tab. Zero-count states should still explain what the user can do next.

### R11. Simplify the calendar empty state

- Remove only the decorative calendar icon above **No events on this day**. Keep the message and any relevant action, then rebalance the spacing.
- Preserve calendar navigation controls and icons used for actual functions.

**Acceptance:** Home provides a useful next action without artificial data; summary cards remain aligned and navigate correctly. The selected-day empty state no longer includes the redundant icon.

## Phase 4 — Updates and notification preview

### R12. Improve update cards and actions

- Refine the shared update row so event type, title, context, timestamp, and actions have a clear reading order.
- Give **View match** or the corresponding destination action a clear primary treatment and **Mark as read** a compact secondary treatment. Keep spacing and button sizing consistent.
- Ensure actions remain independent: marking an item read must not navigate. Retain correct destinations for different notification types.
- Handle long content, missing destinations, empty lists, loading, and request failures without broken layouts or false success states.

### R13. Make unread status prominent and right-aligned

- Use a contrasting unread badge/dot and subtle row treatment that are distinct from read items in both themes.
- Position the **Unread** indicator at the right side of the row's heading area; keep it visibly associated with the same row on narrow screens.
- Preserve chronological ordering, filters, counters, and persistence. Marking read must consistently update the row, page count, and header badge.

### R14. Improve notification popout placement and layout

- Inspect and retain the existing measured placement logic where it already works. Anchor the popout below the header with a small gap so it never covers the profile/avatar controls.
- Constrain width and height to the viewport; scroll the body independently when needed. Recalculate placement when the header size or viewport changes, including zoom and mobile layouts.
- Use the same update-row design in a compact variant, with a clear heading, close control, and route to all updates.
- Preserve outside-click dismissal, Escape dismissal, predictable focus restoration, and sensible interaction with other open menus.

**Acceptance:** Read/unread states are unmistakable. Actions work in both the full page and preview. The popout stays below the header without covering profile controls or overflowing the viewport.

## Phase 5 — Matches and safety

### R15. Distinguish saved and unsaved states

- Give **Saved for later** a clearly different active appearance from **Save for later**: use a contrasting background/border, filled bookmark, and changed text where space permits.
- Apply the same state language to card bookmarks and match details, including accessible labels and pressed state.
- Keep saved state synchronized across Matches, match details, Saved, and Home, and persist it after refresh.

### R16. Allow exact minimum-fit percentages

- Add an accessible numeric field allowing any whole percentage from 0 to 100, with step 1. Existing presets can remain as shortcuts if they stay synchronized.
- Use the current filter draft and Apply/Reset behavior. Reset returns to no minimum restriction; an empty value means no minimum.
- Show validation for out-of-range or non-integer values and prevent invalid filter application. Explain that the threshold includes matches at or above the chosen percentage.
- Keep scoring and existing Suggested/Browse eligibility rules intact; a filter narrows the current result set rather than changing how matching works.

### R17. Align match cards and clamp descriptions

- Use a consistent card structure so cards in a grid row align and primary actions share a baseline despite variable names, tags, and descriptions.
- Limit the summary description to two lines with an ellipsis when truncated. Handle long words without horizontal overflow.
- Keep the full original description available through **View match**; do not truncate stored content or the detail page.
- Verify Founder and Mentor cards and the Suggested, Browse, and Saved views at desktop and mobile sizes.

### R18. Prototype-only acceptance simulation

- Add a clearly labeled **Simulate acceptance** button for a pending outgoing introduction to a fictional prototype collaborator, visible in the relevant match/introduction waiting state.
- Explain briefly that this is a prototype action. Enable it only for server-verified demo/prototype accounts and fictional counterpart records.
- Reuse or extract the normal acceptance transition so the pending introduction is resolved and exactly one appropriate collaboration room becomes available, with coherent Home, Matches, Introductions, and Updates state.
- Prevent duplicate rooms on repeated clicks/retries and persist the result after refresh. Respect withdrawn, blocked, hidden, or already-resolved states as appropriate to existing rules.
- Enforce eligibility and account ownership on the server. Hiding a client button is insufficient. Normal accounts must be unable to invoke simulated acceptance, including through direct API requests.
- Limit the new simulation to introduction acceptance; do not bypass agreements, milestones, reviews, or other partner confirmations. Update README wording that currently says partner confirmations cannot be simulated to document this narrow exception accurately.

### R19. Improve Safety and privacy and verify reporting

- Make the expanded **Safety and privacy** section compact and useful. Remove the excessive gap before **Block this collaborator** and avoid fixed/minimum heights that create empty space.
- Add brief, accurate text describing available safety actions. Preserve the existing block confirmation and behavior.
- Audit the existing reporting UI, server handling, and moderation flow. Ensure **Report collaborator** is easy to find here; reuse the current implementation if one exists.
- If reporting is missing or inaccessible, implement a working dialog with a required reason, optional details, submit/cancel controls, pending/success/error feedback, and validation. Save the report through the existing moderation infrastructure with the correct reporter and reported profile/account identifiers.
- Keep reporting and blocking separate actions. A report must not silently block someone, and cancel must not create a report.

**Acceptance:** Saved state is obvious, arbitrary whole-number thresholds work, cards align with two-line summaries, prototype acceptance creates one valid room without weakening real-account authorization, and both report and block are discoverable and functional.

## Phase 6 — Verification and delivery

Track R1–R19 through implementation and mark each complete only after verification. Add focused regression coverage for behavior and state changes; avoid brittle tests that merely mirror CSS implementation.

Verify at minimum:

- First-visit Light mode and persisted Dark mode; responsive layouts in both themes.
- Profile editing without autosave, text-input Enter behavior, explicit keyboard/button saving, failed-save draft retention, cancel, and separate role drafts.
- Valid/invalid avatar uploads, persistence, fallback, and cancellation; whitespace-only values and completion/matching behavior.
- Confirmed/canceled profile switching, Danger zone disclosure, both visibility directions, and sign-out behavior.
- Notification positioning at narrow widths and zoom, read-state synchronization, and working destination/read actions.
- Exact fit thresholds at 0, 1, 49, 99, and 100; invalid values; Apply/Reset; equal-threshold inclusion.
- Two-line descriptions, aligned card actions, and complete descriptions in match details.
- Demo acceptance success, refresh persistence, duplicate requests, ineligible states, and rejection for real accounts or real counterpart profiles.
- Report submission/cancellation/errors and preserved block behavior.
- Keyboard navigation, dialog focus handling, accessible names, and no horizontal overflow at approximately 375 px, 768 px, and 1440 px widths.

Run the repository's relevant checks, using isolated test data:

```sh
npm run check:references
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Use `npm.cmd` on Windows if PowerShell execution policy blocks `npm`. Fix issues introduced by this work. Distinguish unrelated pre-existing failures and environmental blockers from regressions; never claim unrun checks passed. Inspect the rendered UI in a real browser, including both roles and themes, and retain representative screenshots if the environment supports them.

Deliver the implemented changes and a concise completion report mapping R1–R19 to results, naming the checks run and any remaining limitations. Update relevant operating/prototype documentation for changed behavior. Do not stop after a plan, partial mockup, or the first phase; continue until all requirements are complete or a specific external blocker is documented.

## Repository starting points

These are navigation hints, not a restriction on necessary changes. Verify current implementations before editing.

- Home: `src/pages/HomePage.jsx`, `src/components/MentorHome.jsx`, `src/components/PageHeader.jsx`.
- Profiles and Settings: `src/pages/ProfilePage.jsx`, `src/pages/SettingsPage.jsx`, `src/components/Avatar.jsx`, `src/state/useDraft.js`, `src/state/validation.js`.
- Shared dialogs and header: `src/components/Overlay.jsx`, `src/components/Confirmation.jsx`, `src/components/SignOutDialog.jsx`, `src/components/Topbar.jsx`.
- Updates: `src/pages/NotificationsPage.jsx`, `src/components/NotificationRow.jsx`, `src/components/NotificationPreview.jsx`.
- Matches and safety: `src/pages/DiscoverPage.jsx`, `src/pages/MatchDetailPage.jsx`, `src/components/MatchCard.jsx`, `src/components/BlockCollaborator.jsx`, `src/components/Introductions.jsx`.
- Calendar: `src/pages/CalendarPage.jsx`, `src/components/WorkspaceCalendar.jsx`.
- State and backend: `src/state/AppContext.jsx`, `src/state/transitions.js`, `server/api.js`, `server/workspace.js`, `server/features.js`, `server/accounts.js`, `server/files.js`, `server/demo-directory.js`.
- Styles and checks: `docs/maintenance/SOURCE-LAYOUT.md`, `src/styles.css`, feature stylesheets, `tests/`, `package.json`, `README.md`.
