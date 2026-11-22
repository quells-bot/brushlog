import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// Set by the Tauri CLI while it runs `beforeDevCommand` / `beforeBuildCommand`.
// The iOS app bundles every asset locally, so it gets no service worker or
// manifest — only the web (GitHub Pages) build is a PWA.
const isTauri = !!process.env.TAURI_ENV_PLATFORM;
// LAN address of this Mac when `tauri ios dev` targets a physical device.
const host = process.env.TAURI_DEV_HOST;

const pwa = SvelteKitPWA({
	registerType: 'autoUpdate',
	// Registered explicitly in src/routes/+layout.svelte (src/lib/sw.js).
	injectRegister: false,
	manifest: {
		name: 'BrushLog',
		short_name: 'BrushLog',
		description: 'Guided teeth-brushing timer that logs every session.',
		theme_color: '#0f766e',
		background_color: '#ecfdf5',
		display: 'standalone',
		orientation: 'portrait',
		start_url: '.',
		scope: '.',
		icons: [
			{
				src: 'icons/icon.svg',
				sizes: 'any',
				type: 'image/svg+xml'
			},
			{
				src: 'icons/icon-maskable.svg',
				sizes: 'any',
				type: 'image/svg+xml',
				purpose: 'maskable'
			}
		]
	},
	workbox: {
		globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
		inlineWorkboxRuntime: true
	},
	devOptions: {
		enabled: false
	}
});

export default defineConfig({
	plugins: [sveltekit(), ...(isTauri ? [] : [pwa])],
	clearScreen: false,
	server: {
		port: 5173,
		strictPort: true,
		host: host || false,
		hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
		watch: { ignored: ['**/src-tauri/**'] }
	},
	build: {
		rollupOptions: {
			output: {
				// Single-screen PWA: all chunks are needed, so merge them into one.
				manualChunks: () => 'chunks'
			}
		}
	}
});
