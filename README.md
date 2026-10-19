# Synergy

The original Synergy prototype, converted to React and Vite. The design, content, responsive breakpoints, animations, inline SVG assets, and founder/mentor demo workflows are preserved.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if the execution policy blocks the npm PowerShell scripts.

## Build and preview

```sh
npm run build
npm run preview
```

Production files are generated in `dist/`. Deploy that directory to a static host. The relative asset base supports hosting under a subdirectory.

## Browser checks

```sh
npx playwright install chromium
npm run test:e2e
```

The tests cover sign-in and sign-out, password visibility, notifications, search and filters, bookmarks and keyboard tabs, introductions, terms locking, chat, milestone evidence and disputes, private reviews, profile editing, mentor rooms and scheduling, both onboarding roles, and mobile navigation.

## Source layout

- `src/App.jsx`: application shell, page selection, loading transitions, and focus management.
- `src/components/`: shared navigation, headers, match cards, avatars, tags, SVG icons, notifications, and room panels.
- `src/pages/`: dashboard, authentication, onboarding, matches, waiting, rooms, reviews, and profiles.
- `src/state/`: React context and immutable reducer transitions, form fields, and timer effects.
- `src/data/`: the original demo records, model helpers, and match filtering.
- `src/styles.css`: the original page styles, including mobile layouts and reduced-motion support.

This remains a browser-only prototype. Sign-in accepts any valid email and a password of at least four characters; Google sign-in is simulated. Demo controls switch roles and simulate partner actions. Email verification, story analysis, messaging, reviews, and profile updates use in-memory demo state, which resets on refresh. No backend or real authentication has been added. The original supporting Markdown, PDF, and PNG files remain untouched.
