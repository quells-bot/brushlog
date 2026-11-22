import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const core = vi.hoisted(() => ({ isTauri: vi.fn(() => false) }));
const haptics = vi.hoisted(() => ({
	impactFeedback: vi.fn(async () => ({ status: 'ok', data: null })),
	notificationFeedback: vi.fn(async () => ({ status: 'ok', data: null }))
}));

vi.mock('@tauri-apps/api/core', () => core);
vi.mock('@tauri-apps/plugin-haptics', () => haptics);

const { haptic } = await import('./platform.js');

beforeEach(() => {
	vi.clearAllMocks();
	core.isTauri.mockReturnValue(false);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('haptic (web)', () => {
	it('web zone haptic vibrates 120', async () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		await haptic('zone');
		expect(vibrate).toHaveBeenCalledWith(120);
	});

	it('web finish haptic vibrates [90, 60, 90]', async () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		await haptic('finish');
		expect(vibrate).toHaveBeenCalledWith([90, 60, 90]);
	});

	it('web haptic without vibrate API resolves', async () => {
		vi.stubGlobal('navigator', {});
		await expect(haptic('zone')).resolves.toBeUndefined();
	});
});

describe('haptic (tauri)', () => {
	beforeEach(() => core.isTauri.mockReturnValue(true));

	it('tauri zone haptic uses impactFeedback medium', async () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		await haptic('zone');
		expect(haptics.impactFeedback).toHaveBeenCalledWith('medium');
		expect(vibrate).not.toHaveBeenCalled();
	});

	it('tauri finish haptic uses notificationFeedback success', async () => {
		await haptic('finish');
		expect(haptics.notificationFeedback).toHaveBeenCalledWith('success');
	});

	it('haptic swallows plugin errors', async () => {
		haptics.impactFeedback.mockRejectedValueOnce(new Error('no taptic engine'));
		await expect(haptic('zone')).resolves.toBeUndefined();
	});
});
