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
- `pnpm ios:dev` / `pnpm ios:build` — Tauri 2 iOS app (see `docs/ios.md`; needs Rust, Xcode, CocoaPods).

## Conventions

- **JavaScript only, no TypeScript** — types come from JSDoc comments, checked via `jsconfig.json` (`checkJs`, `strict`). Keep types in JSDoc; don't introduce `.ts` files.
- Svelte 5 runes (`$state`, etc.); timer logic lives in `src/lib/timer.svelte.js`.
- Style: tabs, single quotes (enforced by Prettier).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, …).

## Gotchas

- The site is auto-deployed to GitHub Pages on merge to `main` (`.github/workflows/deploy.yml`). Work on branches and use PRs unless told otherwise.
- The build supports serving from a subpath via `BASE_PATH` (e.g. `BASE_PATH=/<repo> pnpm build` for a GitHub Pages project site). Locally `BASE_PATH` defaults to `''`. Don't hardcode absolute paths — use SvelteKit's `base` from `$app/paths`.
- `src/lib/db.js` is client-only and throws if run during SSR; the app is SPA mode (`ssr = false`) with a `404.html` fallback so it boots offline from any URL.
- The session data model (the `Session` / `ZoneResult` typedefs) is defined in `src/lib/db.js`. Brushing zones are defined in `src/lib/zones.js`.
- iOS app (Tauri): when `TAURI_ENV_PLATFORM` is set, the build drops the PWA plugin and manifest link (`src/hooks.server.js`) and forces `base` to `''`.
- Put web-vs-iOS differences in `src/lib/platform.js`; storage I/O goes through `src/lib/store.js` backends (`src/lib/storage/`), never straight to IndexedDB.
- Don't re-run `tauri ios init`: `src-tauri/gen/apple/project.yml` is hand-edited (Icon Composer `BrushLog.icon`). After editing `project.yml`, run `xcodegen generate` in `src-tauri/gen/apple`.
