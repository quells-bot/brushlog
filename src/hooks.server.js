// Runs while the SPA shell is prerendered at build time. The Tauri build has no
// PWA plugin, so the web manifest doesn't exist: drop the block marked
// <!--pwa--> … <!--/pwa--> in app.html, or prerendering fails on the 404.
// The web build keeps the block and just loses the marker comments.
const isTauri = !!process.env.TAURI_ENV_PLATFORM;
const PWA_BLOCK = /<!--pwa-->[\s\S]*?<!--\/pwa-->/g;
const PWA_MARKER = /<!--\/?pwa-->/g;

/** @type {import('@sveltejs/kit').Handle} */
export function handle({ event, resolve }) {
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace(isTauri ? PWA_BLOCK : PWA_MARKER, '')
	});
}
