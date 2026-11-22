import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const core = vi.hoisted(() => ({ isTauri: vi.fn(() => false) }));
const haptics = vi.hoisted(() => ({
	impactFeedback: vi.fn(async () => ({ status: 'ok', data: null })),
	notificationFeedback: vi.fn(async () => ({ status: 'ok', data: null }))
}));

vi.mock('@tauri-apps/api/core', () => core);
vi.mock('@tauri-apps/plugin-haptics', () => haptics);

const { haptic, exportFile } = await import('./platform.js');

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

describe('exportFile (web)', () => {
	it('web export downloads', async () => {
		/** @type {any} */
		const anchor = { click: vi.fn(), remove: vi.fn() };
		vi.stubGlobal('document', {
			createElement: vi.fn(() => anchor),
			body: { appendChild: vi.fn() }
		});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
		const result = await exportFile('backup.json', '{}');
		expect(result).toBe('downloaded');
		expect(anchor.download).toBe('backup.json');
		expect(anchor.click).toHaveBeenCalled();
	});
});

describe('exportFile (tauri)', () => {
	beforeEach(() => core.isTauri.mockReturnValue(true));

	it('tauri export shares file', async () => {
		const share = vi.fn(async () => {});
		vi.stubGlobal('navigator', { canShare: () => true, share });
		const result = await exportFile('backup.json', '{"a":1}');
		expect(result).toBe('shared');
		const [{ files }] = /** @type {any} */ (share.mock.calls[0]);
		expect(files).toHaveLength(1);
		expect(files[0].name).toBe('backup.json');
		expect(files[0].type).toBe('application/json');
		expect(await files[0].text()).toBe('{"a":1}');
	});

	it('cancelled share is not an error', async () => {
		const share = vi.fn(async () => {
			throw new DOMException('dismissed', 'AbortError');
		});
		vi.stubGlobal('navigator', { canShare: () => true, share });
		await expect(exportFile('backup.json', '{}')).resolves.toBe('cancelled');
	});

	it('non-abort share errors reject', async () => {
		const share = vi.fn(async () => {
			throw new DOMException('nope', 'NotAllowedError');
		});
		vi.stubGlobal('navigator', { canShare: () => true, share });
		await expect(exportFile('backup.json', '{}')).rejects.toThrow('nope');
	});

	it('rejects when files cannot be shared', async () => {
		vi.stubGlobal('navigator', {});
		await expect(exportFile('backup.json', '{}')).rejects.toThrow();
		vi.stubGlobal('navigator', { canShare: () => false, share: vi.fn() });
		await expect(exportFile('backup.json', '{}')).rejects.toThrow();
	});
});
