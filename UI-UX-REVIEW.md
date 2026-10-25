# UI and UX review

Reviewed and improved on October 25, 2026.

## Findings and changes

| Area                  | Finding                                                                                                                                                    | Improvement implemented                                                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | A large setup panel dominated the page, with little context about the workspace.                                                                           | Added live counts for active rooms, pending introductions and saved profiles. Each count opens the corresponding destination. Reduced the setup panel's footprint and placed an actionable collaboration path alongside it on desktop.                                                              |
| Navigation            | Introductions, updates and settings required indirect navigation. The top bar always said “Your workspace.”                                                | Added a separate workspace-tools navigation on desktop and included these destinations in the mobile drawer. The top bar now shows the current page. Active desktop navigation has an additional visual marker.                                                                                     |
| First-time experience | Empty matches and rooms explained the absence of content without showing the overall process.                                                              | Added short, illustrated steps and clearer actions for inviting collaborators and opening Matches. Invitation-link guidance mentions local access only when the app is running on a loopback address.                                                                                               |
| Discovery             | An empty suggestions list could imply that the directory was empty.                                                                                        | Added a distinct “No suggestions yet” state explaining the profile-fit threshold, with a direct action to browse all profiles. Filtered searches and empty shortlists retain their own messages.                                                                                                    |
| Profile setup         | A completion percentage did not explain which information was missing.                                                                                     | Added a list of the missing required profile details, calculated separately for founders and mentors from the same required fields used by profile completeness.                                                                                                                                    |
| Rooms                 | Active and historical collaborations appeared together without a way to narrow the list. Room rows had transparent backgrounds and inherited card shadows. | Added All rooms, In progress, Completed and Closed filters, active-first ordering, live result counts and a recovery action for empty filtered views. Room cards now use the same white surfaces, borders and spacing as the rest of the workspace. Progress bars have accessible names and values. |
| Notifications         | Conflicting CSS gave a numeric unread badge the dimensions of a seven-pixel dot. Read and unread previews looked alike.                                    | Corrected badge sizing, capped the visual count at 99+ and marked unread previews. The accessible button name retains the full unread count.                                                                                                                                                        |
| Sign-in               | Password recovery was separated from the password field and lengthened the form.                                                                           | Moved password recovery alongside the password label while preserving field guidance, visibility controls and validation.                                                                                                                                                                           |
| Responsive layout     | New overview content needed to remain useful on small screens.                                                                                             | Used compact three-column metrics on phones and stacked the primary action and collaboration path. Kept supporting descriptions on larger screens.                                                                                                                                                  |

## Verification

Home also opens the agreement for a newly connected room, and opens milestones once both collaborators have agreed to the terms. Its collaboration path marks the agreement step complete only after mutual agreement.

- Production build passed.
- Repository formatting check passed.
- All 74 existing unit/backend tests passed.
- All 90 existing browser tests passed across Chromium, Firefox and WebKit, including authentication, profile editing, collaboration workflows, settings, mobile navigation and accessibility checks.
- A final targeted rerun of six Chromium tests passed after the visual and accessibility refinements.
- Additional browser inspection covered empty and populated Home, Matches and Rooms, profile setup, notification previews and room filtering. Review accounts and rooms were created only in an isolated database with a fake email provider.
- Additional axe WCAG A/AA scans of the new Home and Rooms content at 320px and 390px reported no violations or horizontal overflow. An invalid ARIA label on the new step indicators was corrected during this check.

These findings come from source inspection, browser interaction, visual review and automated checks. They do not substitute for observing founders and mentors use the product.

## Visual evidence

Screenshots are local review artifacts in `output/playwright/`:

- [Home before](output/playwright/before-home.png)
- [Home after, desktop](output/playwright/after-home-desktop.png)
- [Home after, mobile](output/playwright/after-home-mobile.png)
- [Rooms after, mobile](output/playwright/after-rooms-mobile.png)
- [Populated matches, mobile](output/playwright/after-matches-mobile.png)

The changes build on the workspace's existing uncommitted work. Existing backend behavior and account data were preserved.
