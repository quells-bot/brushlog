/**
 * Pure serialization / merge logic for exporting and importing brushing
 * history.
 *
 * Like `history.js`, this module imports nothing from `$app` or `idb` so it can
 * run under Vitest in a plain node environment. `src/lib/db.js` performs the
 * IndexedDB I/O and delegates the JSON shaping and de-duplication here.
 *
 * @typedef {import('./db.js').BrushSession} BrushSession
 * @typedef {import('./db.js').DailySummary} DailySummary
 *
 * @typedef {Object} Backup
 * @property {string} app           App tag identifying the file ({@link APP_TAG}).
 * @property {number} version       Backup schema version ({@link BACKUP_VERSION}).
 * @property {number} exportedAt    Epoch ms the backup was produced.
 * @property {BrushSession[]} sessions   Raw sessions (without device-local ids).
 * @property {DailySummary[]} summaries  Rolled-up per-day summaries.
 */

/** Tag stamped into every backup so we can reject foreign JSON files. */
export const APP_TAG = 'brushlog-backup';

/** Current backup schema version. Bump when the shape changes. */
export const BACKUP_VERSION = 1;

/**
 * Build a backup object from the two history stores.
 *
 * Session `id`s are auto-increment primary keys that are only meaningful on the
 * device that created them, so we strip them: on import IndexedDB reassigns
 * fresh ids, avoiding collisions with sessions logged after the backup.
 *
 * @param {BrushSession[]} sessions
 * @param {DailySummary[]} summaries
 * @param {number} [exportedAt] epoch milliseconds (defaults to Date.now())
 * @returns {Backup}
 */
export function buildBackup(sessions, summaries, exportedAt = Date.now()) {
	return {
		app: APP_TAG,
		version: BACKUP_VERSION,
		exportedAt,
		sessions: sessions.map(stripId),
		summaries: summaries.map((s) => ({ ...s }))
	};
}

/**
 * Copy a session without its device-local auto-increment id.
 * @param {BrushSession} session
 * @returns {BrushSession}
 */
function stripId(session) {
	const copy = { ...session };
	delete copy.id;
	return copy;
}

/**
 * Parse and validate the text of a backup file.
 * @param {string} text raw file contents
 * @returns {Backup}
 * @throws {Error} if the text is not a recognizable, supported backup
 */
export function parseBackup(text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error("That file isn't valid JSON.");
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error("That file isn't a BrushLog backup.");
	}
	if (data.app !== APP_TAG) {
		throw new Error("That file isn't a BrushLog backup.");
	}
	if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
		throw new Error('That backup was made by a newer version of BrushLog.');
	}
	if (!Array.isArray(data.sessions) || !Array.isArray(data.summaries)) {
		throw new Error('That backup file is missing its history data.');
	}
	return /** @type {Backup} */ (data);
}

/**
 * Plan a merge of a backup into the current stores, skipping duplicates.
 *
 * Sessions are de-duplicated by `startedAt` (against existing data and within
 * the file itself); summaries are keyed by their `day`, and existing days win
 * so we never clobber a day the device has already counted.
 *
 * @param {BrushSession[]} existingSessions
 * @param {DailySummary[]} existingSummaries
 * @param {Backup} backup
 * @returns {{ sessionsToAdd: BrushSession[], summariesToPut: DailySummary[] }}
 */
export function mergeBackup(existingSessions, existingSummaries, backup) {
	const seenStartedAt = new Set(existingSessions.map((s) => s.startedAt));
	/** @type {BrushSession[]} */
	const sessionsToAdd = [];
	for (const session of backup.sessions) {
		if (seenStartedAt.has(session.startedAt)) continue;
		seenStartedAt.add(session.startedAt);
		// Drop any id that slipped through so IndexedDB assigns a fresh one.
		sessionsToAdd.push(stripId(session));
	}

	const existingDays = new Set(existingSummaries.map((s) => s.day));
	const seenDays = new Set(existingDays);
	/** @type {DailySummary[]} */
	const summariesToPut = [];
	for (const summary of backup.summaries) {
		if (seenDays.has(summary.day)) continue;
		seenDays.add(summary.day);
		summariesToPut.push({ ...summary });
	}

	return { sessionsToAdd, summariesToPut };
}
