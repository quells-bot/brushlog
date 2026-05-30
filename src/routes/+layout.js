// Render to a static SPA: prerender the shell, no SSR (the app is
// client-only because it relies on IndexedDB and timers).
export const prerender = true;
export const ssr = false;
