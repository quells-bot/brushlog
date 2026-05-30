// Tiny Web Audio helper for zone-transition cues. Kept dependency-free and
// lazily initialised so we only touch AudioContext after a user gesture.

/** @type {AudioContext | null} */
let ctx = null;

function getCtx() {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
	}
	return ctx;
}

/**
 * Play a short beep.
 * @param {number} [frequency] Hz
 * @param {number} [duration] seconds
 */
export function beep(frequency = 880, duration = 0.15) {
	const c = getCtx();
	if (!c) return;
	if (c.state === 'suspended') c.resume();
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = 'sine';
	osc.frequency.value = frequency;
	gain.gain.setValueAtTime(0.0001, c.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
	osc.connect(gain).connect(c.destination);
	osc.start();
	osc.stop(c.currentTime + duration);
}

/** A celebratory little three-note flourish for a completed routine. */
export function fanfare() {
	beep(660, 0.15);
	setTimeout(() => beep(880, 0.15), 160);
	setTimeout(() => beep(1175, 0.25), 320);
}

/** Buzz the device if the Vibration API is available. */
export function vibrate(/** @type {number | number[]} */ pattern) {
	if (typeof navigator !== 'undefined' && navigator.vibrate) {
		navigator.vibrate(pattern);
	}
}
