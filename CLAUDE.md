# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BrushLog is an offline-first PWA: a guided teeth-brushing timer that logs each session to IndexedDB. SvelteKit (Svelte 5) built as a fully static SPA, deployed to GitHub Pages.

## Commands

This project uses **pnpm** (pinned via the `packageManager` field in `package.json`; run `corepack enable` once so the right version is selected).

- `pnpm dev` — Vite dev server (PWA disabled in dev).
- `pnpm build` — static build to `./build/`.
- `pnpm check` — type-check (`svelte-kit sync && svelte-check`).
- `pnpm test` — Vitest unit tests for pure logic in `src/lib/` (`*.test.js`). Runs with `TZ=America/New_York` so DST-sensitive date tests are deterministic.
- `pnpm lint` — ESLint (flat config, `eslint-plugin-svelte`).
- `pnpm format` — Prettier (tabs, single quotes, Svelte plugin).

## Conventions

- **JavaScript only, no TypeScript** — types come from JSDoc comments, checked via `jsconfig.json` (`checkJs`, `strict`). Keep types in JSDoc; don't introduce `.ts` files.
- Svelte 5 runes (`$state`, etc.); timer logic lives in `src/lib/timer.svelte.js`.
- Style: tabs, single quotes (enforced by Prettier).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, …).

## Gotchas

- There is no automated deploy; building/publishing is manual. Work on branches and use PRs unless told otherwise.
- The build supports serving from a subpath via `BASE_PATH` (e.g. `BASE_PATH=/<repo> pnpm build` for a GitHub Pages project site). Locally `BASE_PATH` defaults to `''`. Don't hardcode absolute paths — use SvelteKit's `base` from `$app/paths`.
- `src/lib/db.js` is client-only and throws if run during SSR; the app is SPA mode (`ssr = false`) with a `404.html` fallback so it boots offline from any URL.
- The session data model (the `Session` / `ZoneResult` typedefs) is defined in `src/lib/db.js`. Brushing zones are defined in `src/lib/zones.js`.
