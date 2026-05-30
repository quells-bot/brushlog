import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Fully static output. The root route is prerendered to index.html;
		// 404.html is emitted as an SPA fallback (also what GitHub Pages
		// serves for unknown paths) so the PWA boots from any URL offline.
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			// Set via env so the app can be hosted from a subpath (e.g. GitHub
			// Pages project sites) without code changes.
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
