import { describe, it, expect, vi } from 'vitest';
import { registerServiceWorker } from './sw.js';

function fakeNavigator() {
	const registration = { scope: 'x' };
	return {
		registration,
		nav: { serviceWorker: { register: vi.fn(async () => registration) } }
	};
}

describe('registerServiceWorker', () => {
	it('registers sw.js at the site root', async () => {
		const { nav, registration } = fakeNavigator();
		const result = await registerServiceWorker({ base: '', nav, win: {} });
		expect(nav.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
		expect(result).toBe(registration);
	});

	it('registers under the GitHub Pages base path', async () => {
		const { nav } = fakeNavigator();
		await registerServiceWorker({ base: '/brushlog', nav, win: {} });
		expect(nav.serviceWorker.register).toHaveBeenCalledWith('/brushlog/sw.js', {
			scope: '/brushlog/'
		});
	});

	it('does nothing without service worker support', async () => {
		expect(await registerServiceWorker({ base: '', nav: {}, win: {} })).toBeNull();
	});

	it('does nothing inside the Tauri app', async () => {
		const { nav } = fakeNavigator();
		const result = await registerServiceWorker({
			base: '',
			nav,
			win: { __TAURI_INTERNALS__: {} }
		});
		expect(result).toBeNull();
		expect(nav.serviceWorker.register).not.toHaveBeenCalled();
	});

	it('resolves null when registration fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nav = { serviceWorker: { register: vi.fn(async () => Promise.reject(new Error('no'))) } };
		expect(await registerServiceWorker({ base: '', nav, win: {} })).toBeNull();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
