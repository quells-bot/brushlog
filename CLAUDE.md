# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BrushLog is an offline-first PWA: a guided teeth-brushing timer that logs each session to IndexedDB. SvelteKit (Svelte 5) built as a fully static SPA, deployed to GitHub Pages.

## Commands

- `npm run dev` — Vite dev server (PWA disabled in dev).
- `npm run build` — static build to `./build/`.
- `npm run check` — type-check (`svelte-kit sync && svelte-check`). No unit tests exist; `check` + `lint` are the verification steps.
- `npm run lint` — ESLint (flat config, `eslint-plugin-svelte`).
- `npm run format` — Prettier (tabs, single quotes, Svelte plugin).

## Conventions

- **JavaScript only, no TypeScript** — types come from JSDoc comments, checked via `jsconfig.json` (`checkJs`, `strict`). Keep types in JSDoc; don't introduce `.ts` files.
- Svelte 5 runes (`$state`, etc.); timer logic lives in `src/lib/timer.svelte.js`.
- Style: tabs, single quotes (enforced by Prettier).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, …).

## Gotchas

- **Push to `main` auto-deploys** to GitHub Pages via `.github/workflows/deploy.yml`. Work on branches and use PRs unless told otherwise.
- CI builds with `BASE_PATH=/<repo-name>` so the app can be served from a subpath (project Pages site). Locally `BASE_PATH` defaults to `''`. Don't hardcode absolute paths — use SvelteKit's `base` from `$app/paths`.
- `src/lib/db.js` is client-only and throws if run during SSR; the app is SPA mode (`ssr = false`) with a `404.html` fallback so it boots offline from any URL.
- The session data model (the `Session` / `ZoneResult` typedefs) is defined in `src/lib/db.js`. Brushing zones are defined in `src/lib/zones.js`.
