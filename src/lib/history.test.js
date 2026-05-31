import { describe, it, expect } from 'vitest';
import { dayKey, computeTodayCount, computeStreak, rollUpOldSessions } from './history.js';

/**
 * @typedef {Object} Session
 * @property {number} startedAt
 * @property {boolean} completed
 * @property {number} [id]
 * @property {number} [totalSeconds]
 * @property {number} [endedAt]
 * @property {import('./db.js').ZoneResult[]} [zones]
 */

describe('dayKey', () => {
	it('formats a timestamp as local YYYY-MM-DD', () => {
		expect(dayKey(new Date(2026, 4, 30, 12, 0).getTime())).toBe('2026-05-30');
	});

	it('zero-pads month and day', () => {
		expect(dayKey(new Date(2026, 0, 5, 12, 0).getTime())).toBe('2026-01-05');
	});

	it('uses local midnight boundaries (late-evening stays same day)', () => {
		expect(dayKey(new Date(2026, 4, 30, 23, 59).getTime())).toBe('2026-05-30');
	});

	it('counts post-midnight brushing before 3AM as the previous day', () => {
		expect(dayKey(new Date(2026, 4, 31, 0, 30).getTime())).toBe('2026-05-30');
		expect(dayKey(new Date(2026, 4, 31, 2, 59).getTime())).toBe('2026-05-30');
	});

	it('starts a new day at 3AM', () => {
		expect(dayKey(new Date(2026, 4, 31, 3, 0).getTime())).toBe('2026-05-31');
	});
});

describe('computeTodayCount', () => {
	const now = new Date(2026, 4, 30, 20, 0).getTime();

	it('counts only completed sessions started today', () => {
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: new Date(2026, 4, 30, 8, 0).getTime(), completed: true },
			{ startedAt: new Date(2026, 4, 30, 21, 0).getTime(), completed: true },
			{ startedAt: new Date(2026, 4, 30, 9, 0).getTime(), completed: false },
			{ startedAt: new Date(2026, 4, 29, 8, 0).getTime(), completed: true }
		];
		expect(
			computeTodayCount(/** @type {import('./history.js').BrushSession[]} */ (sessions), now)
		).toBe(2);
	});

	it('returns 0 with no sessions', () => {
		expect(computeTodayCount([], now)).toBe(0);
	});

	it('counts a pre-3AM session toward the prior day', () => {
		// "now" is 1AM on the 31st, still the 30th's brush day.
		const lateNight = new Date(2026, 4, 31, 1, 0).getTime();
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: new Date(2026, 4, 30, 21, 0).getTime(), completed: true },
			{ startedAt: new Date(2026, 4, 31, 0, 45).getTime(), completed: true }
		];
		expect(
			computeTodayCount(/** @type {import('./history.js').BrushSession[]} */ (sessions), lateNight)
		).toBe(2);
	});
});

describe('computeStreak', () => {
	/** @param {number} y @param {number} m @param {number} d */
	const day = (y, m, d) => new Date(y, m, d, 9, 0).getTime();

	it('returns 0 when there are no completed days', () => {
		expect(computeStreak([], [], day(2026, 4, 30))).toBe(0);
	});

	it('counts consecutive completed days ending today', () => {
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: day(2026, 4, 28), completed: true },
			{ startedAt: day(2026, 4, 29), completed: true },
			{ startedAt: day(2026, 4, 30), completed: true }
		];
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				[],
				day(2026, 4, 30)
			)
		).toBe(3);
	});

	it('keeps the streak alive when today is not yet brushed', () => {
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: day(2026, 4, 28), completed: true },
			{ startedAt: day(2026, 4, 29), completed: true }
		];
		// now = the 30th, nothing logged yet today -> streak still 2 (through the 29th)
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				[],
				day(2026, 4, 30)
			)
		).toBe(2);
	});

	it('ignores incomplete sessions', () => {
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: day(2026, 4, 29), completed: false },
			{ startedAt: day(2026, 4, 30), completed: true }
		];
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				[],
				day(2026, 4, 30)
			)
		).toBe(1);
	});

	it('unions summary days with raw session days', () => {
		/** @type {Session[]} */
		const sessions = [{ startedAt: day(2026, 4, 30), completed: true }];
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				/** @type {import('./history.js').DailySummary[]} */ ([
					{ day: '2026-05-28', completed: true, count: 2, totalSeconds: 320 },
					{ day: '2026-05-29', completed: true, count: 1, totalSeconds: 160 }
				]),
				day(2026, 4, 30)
			)
		).toBe(3);
	});

	it('keeps the streak alive for a session brushed after midnight', () => {
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: day(2026, 4, 29), completed: true },
			// brushed at 1AM on the 31st — counts as the 30th's brush day
			{ startedAt: new Date(2026, 4, 31, 1, 0).getTime(), completed: true }
		];
		// now = 2AM on the 31st, still the 30th's brush day -> streak of 2
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				[],
				new Date(2026, 4, 31, 2, 0).getTime()
			)
		).toBe(2);
	});

	it('does not miscount across a DST spring-forward boundary', () => {
		// US/Eastern springs forward on 2026-03-08 (a 23-hour local day).
		// A fixed 24h step would skip the 8th; setDate-based stepping does not.
		/** @type {Session[]} */
		const sessions = [
			{ startedAt: day(2026, 2, 7), completed: true },
			{ startedAt: day(2026, 2, 8), completed: true },
			{ startedAt: day(2026, 2, 9), completed: true }
		];
		expect(
			computeStreak(
				/** @type {import('./history.js').BrushSession[]} */ (sessions),
				[],
				day(2026, 2, 9)
			)
		).toBe(3);
	});
});

describe('rollUpOldSessions', () => {
	const now = new Date(2026, 4, 30, 12, 0).getTime();
	const DAY = 86_400_000;

	it('leaves recent sessions untouched', () => {
		/** @type {Session[]} */
		const sessions = [{ id: 1, startedAt: now - 5 * DAY, totalSeconds: 160, completed: true }];
		const result = rollUpOldSessions(
			/** @type {import('./history.js').BrushSession[]} */ (sessions),
			[],
			now
		);
		expect(result.deleteIds).toEqual([]);
		expect(result.summaries).toEqual([]);
	});

	it('rolls up sessions older than 30 days into one summary per day', () => {
		const old = new Date(2026, 3, 1, 8, 0).getTime(); // 2026-04-01, ~59 days old
		/** @type {Session[]} */
		const sessions = [
			{ id: 1, startedAt: old, totalSeconds: 160, completed: true },
			{ id: 2, startedAt: old + 3 * 3600_000, totalSeconds: 90, completed: false },
			{ id: 3, startedAt: now - 2 * DAY, totalSeconds: 160, completed: true }
		];
		const result = rollUpOldSessions(
			/** @type {import('./history.js').BrushSession[]} */ (sessions),
			[],
			now
		);
		expect(result.deleteIds).toEqual([1, 2]);
		expect(result.summaries).toEqual([
			{ day: '2026-04-01', completed: true, count: 2, totalSeconds: 250 }
		]);
	});

	it('merges into an existing summary for the same day', () => {
		const old = new Date(2026, 3, 1, 8, 0).getTime();
		/** @type {Session[]} */
		const sessions = [{ id: 7, startedAt: old, totalSeconds: 100, completed: false }];
		const result = rollUpOldSessions(
			/** @type {import('./history.js').BrushSession[]} */ (sessions),
			/** @type {import('./history.js').DailySummary[]} */ ([
				{ day: '2026-04-01', completed: true, count: 1, totalSeconds: 160 }
			]),
			now
		);
		expect(result.deleteIds).toEqual([7]);
		expect(result.summaries).toEqual([
			{ day: '2026-04-01', completed: true, count: 2, totalSeconds: 260 }
		]);
	});

	it('does not mutate the input summaries', () => {
		const old = new Date(2026, 3, 1, 8, 0).getTime();
		const existing = [{ day: '2026-04-01', completed: false, count: 1, totalSeconds: 160 }];
		const snapshot = JSON.parse(JSON.stringify(existing));
		rollUpOldSessions(
			/** @type {import('./history.js').BrushSession[]} */ ([
				{ id: 7, startedAt: old, totalSeconds: 100, completed: true }
			]),
			/** @type {import('./history.js').DailySummary[]} */ (existing),
			now
		);
		expect(existing).toEqual(snapshot);
	});
});
