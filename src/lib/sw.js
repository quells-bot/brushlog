/**
 * Service worker registration for the web (PWA) build.
 *
 * `@vite-pwa/sveltekit` generates `sw.js` but, in this app, nothing loaded its
 * registration script, so the PWA never cached itself for offline use. We
 * register explicitly instead of relying on `injectRegister`.
 */

/**
 * Register `<base>/sw.js` scoped to the app. Never rejects.
 *
 * Skipped where there is no Service Worker API, and inside the Tauri iOS app,
 * which bundles its assets and has no `sw.js`.
 *
 * @param {object} options
 * @param {string} options.base SvelteKit `base` path ('' or e.g. '/brushlog')
 * @param {any} [options.nav] navigator (injectable for tests)
 * @param {any} [options.win] window (injectable for tests)
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker({
	base,
	nav = globalThis.navigator,
	win = globalThis.window
}) {
	if (!nav?.serviceWorker) return null;
	if (win && '__TAURI_INTERNALS__' in win) return null;
	try {
		return await nav.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
	} catch (err) {
		console.warn('service worker registration failed', err);
		return null;
	}
}
