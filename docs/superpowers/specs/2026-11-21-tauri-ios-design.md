# BrushLog as a Tauri iOS app

**Date:** 2026-11-21
**Status:** Approved design
**Branch:** `tauri` → PR into `main`

## Why

The iOS home-screen PWA doesn't give truly offline launches: Safari still
reaches out to the origin even when every asset is cached, so the app can stall
or fail without network. BrushLog is a timer you use in the bathroom at 7am —
it must open instantly, every time, with no network involved.

A Tauri 2 iOS app bundles the built SPA inside the app and serves it from a
local `tauri://` origin, so there is no server round-trip at all.

## Goals

- BrushLog installs on the owner's iPhone as a native app (signed with their
  paid Apple Developer account) and launches and works fully offline.
- Distributed via TestFlight (90-day builds) or direct device install from
  Xcode.
- The GitHub Pages PWA keeps working and deploying exactly as today, from the
  same code.
- Zone-change cues produce real iPhone haptics (today `navigator.vibrate` is a
  no-op on iOS).
- History export works in the app (today's blob + `a.download` does not work in
  WKWebView).
- The app icon is a layered iOS 27 icon built with **Icon Composer** (`.icon`
  file), so it gets Liquid Glass / light / dark / tinted variants.
- Signing set up with a guided walkthrough — the owner needs help with
  certificates, profiles, and the first TestFlight upload.

## Non-goals (v1)

- SQLite storage. v1 keeps IndexedDB, but adds the seam that makes SQLite a
  drop-in later (see Storage).
- Android, macOS/Windows/Linux desktop targets.
- CI builds / signing in GitHub Actions.
- Public App Store release (review, privacy labels, screenshots).
- Beeps that play when the ring/silent switch is on; keep-screen-awake.
- Migrating the PWA's existing Safari IndexedDB data automatically. The owner
  moves history once via the existing export → import.

## Anti-goals

- **Any network dependency at launch in the Tauri build.** No remote
  `devUrl`/`frontendDist` URLs in release builds, no service worker, no CDN
  assets.
- **A long-lived divergent Tauri branch.** Platform differences live behind
  small seams in one codebase so fixes land once.
- Breaking the web build or the Pages deploy.

## Constraints

- JavaScript + JSDoc only, no TypeScript (`CLAUDE.md`). The Rust side is the
  minimal Tauri shell only.
- pnpm; Prettier (tabs, single quotes); Conventional Commits.
- Toolchain on the dev Mac today: Xcode 27.2 (with Icon Composer) is installed
  but `xcode-select` points at CommandLineTools — owner must run
  `sudo xcode-select -s /Applications/Xcode.app` (needs their password).
  Rust is not installed — install via rustup plus iOS targets
  (`aarch64-apple-ios`, `aarch64-apple-ios-sim`). CocoaPods is not required by
  Tauri 2.
- Bundle identifier: **`me.kaiwells.brushlog`** (fixed after first upload).
- Product name: BrushLog.

## Approaches considered

1. **Tauri 2 in this repo, one codebase for both targets — chosen.**
   `src-tauri/` beside `src/`; runtime `isTauri` detection for native
   features; build-time switch disables the PWA plugin for Tauri. Every fix
   reaches both targets; costs a small platform layer and a Rust toolchain.
2. Tauri only, drop the PWA. Simpler, but loses the web fallback and non-iOS
   access to save ~30 lines. Rejected.
3. Capacitor instead of Tauri. More mature iOS plugins, no Rust, same offline
   result. Rejected because the owner wants Tauri and the app's native needs
   are small.

On branching: the owner was open to a parallel Tauri branch for drastic
changes (e.g. SQLite). Decided instead: one branch, with storage and platform
seams; cut a branch later only if something truly can't share code.

## Design

### Project layout

```
src-tauri/
  Cargo.toml, build.rs, src/lib.rs, src/main.rs
  tauri.conf.json
  capabilities/default.json
  icons/                     # `tauri icon` output (required by Tauri config)
  gen/apple/                 # from `tauri ios init`; committed
    project.yml              # XcodeGen spec — edited to wire in BrushLog.icon
    BrushLog.icon/           # Icon Composer document
```

### Build configuration

- `tauri.conf.json`: `identifier: me.kaiwells.brushlog`,
  `build.frontendDist: ../build`, `build.devUrl: http://localhost:5173`,
  `beforeBuildCommand: pnpm build`, `beforeDevCommand: pnpm dev`.
  `bundle.iOS.developmentTeam` set to the owner's Team ID.
- `vite.config.js`: when `process.env.TAURI_ENV_PLATFORM` is set, omit
  `SvelteKitPWA` entirely (no service worker, no manifest registration).
- `svelte.config.js`: when `TAURI_ENV_PLATFORM` is set, force `base: ''`
  regardless of `BASE_PATH`. Keep `fallback: '404.html'` (harmless) — Tauri
  serves `index.html` at `/`, and the app is SPA mode.
- iOS dev against the Vite server needs the server reachable from the device:
  use `TAURI_DEV_HOST` for `server.host` per Tauri's SvelteKit guide.
- `package.json` scripts: `tauri` (`tauri`), `ios:dev` (`tauri ios dev`),
  `ios:build` (`tauri ios build`). Add `@tauri-apps/cli` and
  `@tauri-apps/api` plus plugin JS packages.
- `.gitignore`: `src-tauri/target/`, Xcode user data / build dirs under
  `gen/apple` per Tauri's generated ignore files.

### Platform seam — `src/lib/platform.js`

Single module the rest of the app imports for anything platform-specific:

- `isTauri` — `'__TAURI_INTERNALS__' in window` (or `isTauri()` from
  `@tauri-apps/api/core`).
- `haptic(kind)` — on Tauri, `@tauri-apps/plugin-haptics`
  (`impactFeedback` for zone changes, `notificationFeedback('success')` for
  completion); on web, falls back to `navigator.vibrate` with today's
  patterns. `sound.js`'s `vibrate` is replaced by / delegates to this;
  `timer.svelte.js` call sites keep their meaning (zone change vs finish).
- `exportFile(filename, text)` — on web, today's blob + `a.download`. On
  Tauri, try in this order and ship the first that works on the iOS
  Simulator (decided with the owner):
  1. **Web Share API** — `navigator.share({ files: [new File([text], filename,
     { type: 'application/json' })] })`, guarded by `navigator.canShare`.
     Shows the native share sheet with no native code. Spike this first.
  2. **Documents folder + Files app** — write the JSON into the app's
     Documents dir (`@tauri-apps/plugin-fs`, `BaseDirectory.Document`) and set
     `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` in the iOS
     Info.plist so it appears under On My iPhone → BrushLog. Show a message
     telling the user where the file went.
  3. **Small Swift Tauri plugin** in `src-tauri` wrapping
     `UIActivityViewController` for a real share sheet. Allowed only if 1 and
     2 both fail; this is the one sanctioned exception to "minimal Rust/native
     shell".
- Tauri plugin JS is loaded with dynamic `import()` inside the Tauri branch so
  the web bundle never needs Tauri APIs at runtime.

Import keeps the existing `<input type="file">` — WKWebView presents the
native document picker, so it works unchanged. Builder verifies on device.

### Storage seam — `src/lib/db.js`

v1 behaviour is unchanged (IndexedDB via `idb`). Restructure so the exported
functions (`saveSession`, history queries, export/import helpers, compaction)
call through a backend object with the same shape, selected at startup.
Only an IndexedDB backend ships in v1. The `Session`/`ZoneResult` typedefs
stay in `db.js`. Pure logic in `history.js` / `backup.js` is untouched and its
tests keep passing.

IndexedDB inside a non-browser app's WKWebView is not subject to Safari's
7-day script-storage eviction, so v1 storage is durable on device.

### App icon — Icon Composer

- Build `src-tauri/gen/apple/BrushLog.icon` from the existing artwork
  (`static/icons/icon.svg`): background layer = the teal `#0f766e` fill (an
  Icon Composer fill, not a baked rounded rect — the system applies the
  shape); foreground layer = the white tooth glyph as its own SVG.
- Builder drafts the `.icon` (layer SVG + `icon.json`); the owner opens it in
  Icon Composer to tune glass/specular/shadow and check light, dark, and
  tinted appearances. The look is the owner's call.
- Wire it into the Xcode project via `project.yml`: add the `.icon` to the app
  target's sources and set `ASSETCATALOG_COMPILER_APPICON_NAME: BrushLog`.
  Remove/ignore the generated `AppIcon` asset-catalog set so there's one
  source of truth.
- Still run `tauri icon` from the SVG to fill `src-tauri/icons/` because Tauri
  config validation expects those files; they're not used for the iOS icon.
- Caveat: re-running `tauri ios init` regenerates `gen/apple` and would drop
  these edits. Document this in the README; don't re-init casually.

### Signing & distribution walkthrough (doc deliverable)

Add `docs/ios.md` covering, step by step:

1. One-time toolchain: rustup, iOS Rust targets, `xcode-select -s`.
2. Xcode → Settings → Accounts: sign in with the developer Apple ID; find the
   Team ID; put it in `tauri.conf.json`.
3. Automatic signing: Xcode creates the Apple Development / Apple
   Distribution certificates and provisioning profiles for
   `me.kaiwells.brushlog`. Register the iPhone (Developer Mode on device).
4. Run on device: `pnpm ios:dev` (live reload) and a release install.
5. App Store Connect: create the app record for `me.kaiwells.brushlog`
   (required for TestFlight), `pnpm ios:build --export-method app-store-connect`,
   upload via Xcode Organizer or `xcrun altool` with an App Store Connect API
   key; add self as internal tester.
6. Moving history from the PWA: Export in Safari PWA → Import in app.

The agent can't click through Xcode or Apple's web portals for the owner or
enter credentials; the doc and live guidance cover those steps.

## Verification

- `pnpm test`, `pnpm check`, `pnpm lint` pass.
- Web: `pnpm build` output still contains the service worker and manifest;
  `BASE_PATH=/brushlog pnpm build` still works (Pages unaffected).
- Tauri build output contains no service worker registration.
- iOS Simulator: app launches with the Mac's network disabled; a full brushing
  session logs and appears in History; export produces a share sheet; import
  round-trips a backup.
- On device (owner): haptics fire on zone change and completion; icon renders
  in light/dark/tinted.

## Left to the builder

- Haptic intensities/types mapping to the two existing cues.
- Whether `sound.js` keeps a `vibrate` export delegating to `platform.js` or
  call sites switch to `haptic()`.
- Internal shape of the storage backend object.
- Pinning Tauri crate / npm package versions (latest stable 2.x).
