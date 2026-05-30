# 🦷 BrushLog

A guided teeth-brushing timer, built as an installable, offline-first PWA.
It walks you through the four mouth quadrants (30s each, two minutes total),
counts the time you actually brush, and automatically logs every session —
duration and completion — to **IndexedDB** on your device.

Built with **Vite + SvelteKit** and shipped as a fully **static site**.

## Features

- ⏱️ **Per-zone timer** — Upper Right, Upper Left, Lower Left, Lower Right,
  with automatic advance, a progress ring, audible cues, and haptics.
- 💾 **Automatic logging** — each finished routine is saved to IndexedDB with
  its per-zone breakdown, total duration, and completion status. No server,
  no account; everything stays on the device.
- 📈 **History & streaks** — review past sessions, see today's count and your
  current day streak.
- 📲 **Installable PWA** — works offline, installs to the home screen, with a
  service worker that auto-updates.

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # produce the static site in ./build
npm run preview  # preview the production build
npm run check    # type-check with svelte-check
```

## Tech

- [SvelteKit](https://svelte.dev/docs/kit) with
  [`@sveltejs/adapter-static`](https://svelte.dev/docs/kit/adapter-static)
  (SPA mode: `ssr = false`, prerendered shell, `404.html` fallback).
- [`@vite-pwa/sveltekit`](https://vite-pwa-org.netlify.app/frameworks/sveltekit.html)
  for the manifest and service worker.
- [`idb`](https://github.com/jakearchibald/idb) for ergonomic IndexedDB access.

## Data model

Sessions are stored in the `sessions` object store of the `brushlog`
database:

```ts
{
  id: number,            // auto-increment key
  startedAt: number,     // epoch ms
  endedAt: number,       // epoch ms
  totalSeconds: number,  // total time brushed
  completed: boolean,    // every zone hit its target?
  zones: Array<{ id, label, seconds, completed }>
}
```

## Deploy

Pushes to `main` are built and published to **GitHub Pages** by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The build
honours a `BASE_PATH` env var so it can be served from a project subpath
(e.g. `/brushlog/`). Enable Pages with the "GitHub Actions" source in the
repository settings.

## License

MIT
