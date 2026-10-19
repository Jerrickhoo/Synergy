# Synergy

Synergy is a React/Vite prototype for connecting startups and mentors and organizing collaborations in shared rooms.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://localhost:5173. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if the execution policy blocks the PowerShell scripts.

## Fresh workspace

Accounts start with a blank profile and no matches, saved profiles, introductions, rooms, messages, reviews, ratings, or activity. The application ships with an empty directory; fictional records are confined to unit-test fixtures in `tests/fixtures.js`.

The main navigation has four destinations: Home, Matches, Rooms, and Profile. Home offers one next step: set up your profile. Matches and Rooms show helpful empty states. Profile combines the editable details and a collapsed collaboration history. Pending introductions are accessible from Rooms when present.

Signup asks for a name, email, password, and founder or mentor role in one form. It opens the workspace immediately; there is no simulated email verification or generated profile information. You can also enter any valid email and a password of at least four characters on the sign-in screen. Different emails start separate empty local sessions. Creating an account always clears the previous workspace state.

This is a local, memory-only prototype. Authentication is not connected to a service; passwords are not retained or sent. Refreshing resets the workspace and requires signing in again. No backend, live directory, or persistent online accounts have been added.

## Checks and build

```sh
npx playwright install chromium
npm run check:format
npm run test:unit
npm run test:e2e
npm run build
```

Unit tests verify empty initial state, account isolation, signup, room safety, validation, milestones, evidence, scheduling, and review rules. Browser tests cover the fresh workspace, profile editing and validation, both signup roles, account isolation, history navigation, and mobile/tablet/desktop layouts.

Production files are generated in `dist/`. Use `npm run preview` to preview the build. The relative asset base supports hosting under a subdirectory.

## Source layout

- `src/App.jsx`: application shell, page selection, and focus management.
- `src/components/`: shared navigation, headers, forms, and room panels.
- `src/pages/`: Home, Matches, Rooms, Profile, authentication, and collaboration screens.
- `src/state/`: context, state transitions, routing, validation, and form helpers.
- `src/data/`: empty initial state, model helpers, filters, and selectors.
- `src/styles.css`: design tokens, component styles, and responsive layouts.
- `tests/fixtures.js`: explicit fictional data used only in unit tests.

See [AUDIT.md](AUDIT.md) for earlier prototype findings and the production roadmap. Its descriptions of seeded dashboards and simulated onboarding precede the fresh-account update described here. Original supporting documents and images remain untouched.
