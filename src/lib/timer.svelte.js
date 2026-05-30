import { ZONES, TOTAL_SECONDS } from './zones.js';
import { beep, fanfare, vibrate } from './sound.js';

/** @typedef {'idle' | 'running' | 'paused' | 'done'} TimerStatus */

const TICK_MS = 100;

/**
 * Drives a guided brushing routine: counts time per zone, advances
 * automatically, and exposes reactive state for the UI. Time is measured
 * against the wall clock (not tick counts) so it stays accurate even if the
 * interval is throttled in a background tab.
 */
export class BrushTimer {
	/** @type {TimerStatus} */
	status = $state('idle');
	/** Index of the zone currently being brushed. */
	zoneIndex = $state(0);
	/** Seconds brushed so far in the current zone (float). */
	zoneElapsed = $state(0);
	/** Seconds brushed in each zone, by index. */
	perZone = $state(ZONES.map(() => 0));

	/** @type {number | null} */
	#intervalId = null;
	/** @type {number | null} Wall-clock ms of the previous tick. */
	#lastTick = null;
	/** Epoch ms when the routine first started. */
	#startedAt = 0;

	/** The zone object currently in focus. */
	get currentZone() {
		return ZONES[Math.min(this.zoneIndex, ZONES.length - 1)];
	}

	/** Seconds remaining in the current zone. */
	get zoneRemaining() {
		return Math.max(0, this.currentZone.seconds - this.zoneElapsed);
	}

	/** Fraction (0–1) of the current zone completed. */
	get zoneProgress() {
		return Math.min(1, this.zoneElapsed / this.currentZone.seconds);
	}

	/** Total seconds brushed across all zones. */
	get totalElapsed() {
		return this.perZone.reduce((a, b) => a + b, 0);
	}

	/** Fraction (0–1) of the whole routine completed. */
	get totalProgress() {
		return Math.min(1, this.totalElapsed / TOTAL_SECONDS);
	}

	start() {
		if (this.status === 'running') return;
		if (this.status === 'idle' || this.status === 'done') {
			this.#reset();
			this.#startedAt = Date.now();
		}
		this.status = 'running';
		this.#lastTick = performance.now();
		this.#intervalId = window.setInterval(() => this.#tick(), TICK_MS);
		// A quiet cue so the user knows it's live.
		beep(660, 0.1);
	}

	pause() {
		if (this.status !== 'running') return;
		this.#stopInterval();
		this.status = 'paused';
	}

	toggle() {
		if (this.status === 'running') this.pause();
		else this.start();
	}

	/** Skip the rest of the current zone and jump to the next. */
	skip() {
		if (this.status === 'idle' || this.status === 'done') return;
		this.#advanceZone();
	}

	/** Abandon the routine without saving. */
	reset() {
		this.#stopInterval();
		this.#reset();
		this.status = 'idle';
	}

	#reset() {
		this.zoneIndex = 0;
		this.zoneElapsed = 0;
		this.perZone = ZONES.map(() => 0);
		this.#startedAt = 0;
	}

	#stopInterval() {
		if (this.#intervalId !== null) {
			clearInterval(this.#intervalId);
			this.#intervalId = null;
		}
		this.#lastTick = null;
	}

	#tick() {
		const now = performance.now();
		const delta = (now - (this.#lastTick ?? now)) / 1000;
		this.#lastTick = now;

		this.zoneElapsed += delta;
		this.perZone[this.zoneIndex] = Math.min(
			this.currentZone.seconds,
			this.perZone[this.zoneIndex] + delta
		);

		if (this.zoneElapsed >= this.currentZone.seconds) {
			this.#advanceZone();
		}
	}

	#advanceZone() {
		// Lock the completed zone to its full target.
		this.perZone[this.zoneIndex] = this.currentZone.seconds;

		if (this.zoneIndex >= ZONES.length - 1) {
			this.#finish();
			return;
		}

		this.zoneIndex += 1;
		this.zoneElapsed = 0;
		beep(880, 0.12);
		vibrate(120);
	}

	#finish() {
		this.#stopInterval();
		this.status = 'done';
		fanfare();
		vibrate([90, 60, 90]);
	}

	/**
	 * Build a session record from the current state, ready to persist.
	 * @returns {import('./db.js').BrushSession}
	 */
	toSession() {
		const zones = ZONES.map((z, i) => ({
			id: z.id,
			label: z.label,
			seconds: Math.round(this.perZone[i]),
			completed: this.perZone[i] >= z.seconds
		}));
		return {
			startedAt: this.#startedAt || Date.now(),
			endedAt: Date.now(),
			totalSeconds: Math.round(this.totalElapsed),
			completed: zones.every((z) => z.completed),
			zones
		};
	}
}
