/**
 * Everything that differs between the web (PWA) build and the Tauri iOS app.
 *
 * Tauri plugin modules are loaded with dynamic `import()` inside the Tauri
 * branches, so the web bundle never executes them.
 */
import { isTauri } from '@tauri-apps/api/core';

export { isTauri };

/** @typedef {'zone' | 'finish'} HapticKind */

/** Vibration API patterns used on the web, per cue. */
/** @type {Record<HapticKind, VibratePattern>} */
const WEB_PATTERNS = { zone: 120, finish: [90, 60, 90] };

/**
 * Physical feedback for a timer cue. Never rejects: haptics are a nicety and
 * must not interrupt the timer.
 * @param {HapticKind} kind `zone` for a zone change, `finish` for a completed routine
 * @returns {Promise<void>}
 */
export async function haptic(kind) {
	try {
		if (isTauri()) {
			const { impactFeedback, notificationFeedback } = await import('@tauri-apps/plugin-haptics');
			// The plugin resolves `{ status: 'error' }` (e.g. permission denied)
			// rather than rejecting, so check the result.
			const result =
				kind === 'zone' ? await impactFeedback('medium') : await notificationFeedback('success');
			if (result?.status === 'error') console.warn('haptic failed', result.error);
			return;
		}
		if (typeof navigator !== 'undefined' && navigator.vibrate) {
			navigator.vibrate(WEB_PATTERNS[kind]);
		}
	} catch (err) {
		console.warn('haptic failed', err);
	}
}

/**
 * @typedef {'downloaded' | 'shared' | 'cancelled'} ExportResult
 */

/**
 * Hand a text file to the user.
 *
 * - Web: triggers a browser download.
 * - Tauri (iOS): opens the native share sheet (Save to Files, AirDrop, …) via
 *   the Web Share API, which WKWebView supports for files. Dismissing the sheet
 *   resolves to `'cancelled'` rather than rejecting.
 *
 * @param {string} filename
 * @param {string} text JSON contents
 * @returns {Promise<ExportResult>}
 */
export async function exportFile(filename, text) {
	if (!isTauri()) {
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		return 'downloaded';
	}

	const file = new File([text], filename, { type: 'application/json' });
	if (!navigator.canShare?.({ files: [file] })) {
		throw new Error('Sharing files is not supported on this device');
	}
	try {
		await navigator.share({ files: [file] });
		return 'shared';
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
		throw err;
	}
}
