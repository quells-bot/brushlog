/**
 * Pure date / streak / compaction logic for BrushLog history.
 *
 * This module imports nothing from `$app` or `idb` so it can run under Vitest
 * in a plain node environment. `src/lib/db.js` performs the IndexedDB I/O and
 * delegates the roll-up math here.
 *
 * @typedef {import('./db.js').BrushSession} BrushSession
 * @typedef {import('./db.js').DailySummary} DailySummary
 */

/**
 * Grace period after midnight that still counts toward the previous day. A
 * "brush day" runs from 3AM to 3AM, so a late-night session in the small hours
 * (e.g. brushing at 1AM before bed) logs against the day you just finished
 * rather than the new calendar date.
 */
const GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * Format a `Date` as a sortable local `YYYY-MM-DD` string.
 * @param {Date} d
 * @returns {string}
 */
function formatDay(d) {
	const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "Brush day" for a timestamp, as a sortable `YYYY-MM-DD` string. Times before
 * 3AM fall on the previous calendar day (see {@link GRACE_MS}).
 * @param {number} ms epoch milliseconds
 * @returns {string}
 */
export function dayKey(ms) {
	return formatDay(new Date(ms - GRACE_MS));
}

/**
 * Number of completed sessions started on the same brush day as `now`
 * (sessions in the post-midnight grace window count toward the prior day).
 * @param {BrushSession[]} sessions
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {number}
 */
export function computeTodayCount(sessions, now = Date.now()) {
	const today = dayKey(now);
	return sessions.filter((s) => s.completed && dayKey(s.startedAt) === today).length;
}

/**
 * Current run of consecutive brush days with at least one completed session,
 * unioning raw sessions with already-compacted day summaries. Walks backward
 * from today (or yesterday, if today is not yet brushed) using `Date.setDate`,
 * which is correct across DST transitions.
 *
 * @param {BrushSession[]} sessions
 * @param {DailySummary[]} summaries
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {number}
 */
export function computeStreak(sessions, summaries, now = Date.now()) {
	const days = new Set([
		...sessions.filter((s) => s.completed).map((s) => dayKey(s.startedAt)),
		...summaries.filter((s) => s.completed).map((s) => s.day)
	]);
	if (days.size === 0) return 0;

	// Walk in "brush day" space: shift by the grace period, then to midnight,
	// so a session logged at 1AM still lands on the day it belongs to.
	const cursor = new Date(now - GRACE_MS);
	cursor.setHours(0, 0, 0, 0);
	// Allow the streak to be "alive" if today hasn't been brushed yet.
	if (!days.has(formatDay(cursor))) cursor.setDate(cursor.getDate() - 1);

	let count = 0;
	while (days.has(formatDay(cursor))) {
		count += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return count;
}

/**
 * First instant (local midnight) of the oldest day that is still kept raw.
 * Sessions with `startedAt < cutoff` are eligible for compaction — i.e.
 * anything before the start of the day 30 days ago. Uses `Date.setDate` so the
 * boundary is a true calendar day even across DST.
 *
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {number}
 */
export function compactionCutoff(now = Date.now()) {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - 30);
	return d.getTime();
}

/**
 * Roll sessions older than 30 days up into per-day summaries.
 *
 * Pure: returns the summaries to write (merged with any existing ones for the
 * same day) and the ids of the raw sessions to delete. Performs no I/O and does
 * not mutate its inputs.
 *
 * @param {BrushSession[]} sessions all raw sessions
 * @param {DailySummary[]} existingSummaries summaries already stored
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {{ summaries: DailySummary[], deleteIds: number[] }}
 */
export function rollUpOldSessions(sessions, existingSummaries, now = Date.now()) {
	const cutoff = compactionCutoff(now);
	const existing = new Map(existingSummaries.map((s) => [s.day, s]));
	/** @type {Map<string, DailySummary>} */
	const touched = new Map();
	/** @type {number[]} */
	const deleteIds = [];

	for (const s of sessions) {
		if (s.startedAt >= cutoff) continue;
		const key = dayKey(s.startedAt);
		const base = touched.get(key) ??
			existing.get(key) ?? { day: key, completed: false, count: 0, totalSeconds: 0 };
		touched.set(key, {
			day: key,
			completed: base.completed || s.completed,
			count: base.count + 1,
			totalSeconds: base.totalSeconds + s.totalSeconds
		});
		deleteIds.push(/** @type {number} */ (s.id));
	}

	return { summaries: [...touched.values()], deleteIds };
}
