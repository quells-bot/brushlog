import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
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
		})
	],
	build: {
		rollupOptions: {
			output: {
				// Single-screen PWA: all chunks are needed, so merge them into one.
				manualChunks: () => 'chunks'
			}
		}
	}
});
