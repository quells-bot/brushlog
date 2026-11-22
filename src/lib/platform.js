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
			if (kind === 'zone') await impactFeedback('medium');
			else await notificationFeedback('success');
			return;
		}
		if (typeof navigator !== 'undefined' && navigator.vibrate) {
			navigator.vibrate(WEB_PATTERNS[kind]);
		}
	} catch (err) {
		console.warn('haptic failed', err);
	}
}
