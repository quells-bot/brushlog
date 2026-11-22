/**
 * Storage logic for BrushLog history, independent of where the data lives.
 *
 * `createStore` wraps a {@link StorageBackend} (IndexedDB today; SQLite on iOS
 * later) with the app-level operations: ordering, compaction, export, import.
 * Like `history.js` and `backup.js`, this module imports nothing from `$app` or
 * `idb`, so it runs under Vitest in plain node.
 *
 * @typedef {import('./db.js').BrushSession} BrushSession
 * @typedef {import('./db.js').DailySummary} DailySummary
 *
 * @typedef {Object} StorageChanges
 * @property {BrushSession[]} [addSessions]     Sessions to insert (backend assigns ids).
 * @property {DailySummary[]} [putSummaries]    Summaries to upsert by `day`.
 * @property {number[]} [deleteSessionIds]      Session ids to remove.
 *
 * @typedef {Object} StorageBackend
 * @property {() => Promise<BrushSession[]>} getAllSessions   Ascending by `startedAt`.
 * @property {() => Promise<DailySummary[]>} getAllSummaries
 * @property {(session: BrushSession) => Promise<number>} addSession  Returns the new id.
 * @property {(id: number) => Promise<void>} deleteSession
 * @property {() => Promise<void>} clearSessions
 * @property {(changes: StorageChanges) => Promise<void>} applyChanges  Atomic.
 */

import { rollUpOldSessions } from './history.js';
import { buildBackup, mergeBackup } from './backup.js';

/**
 * @param {StorageBackend} backend
 */
export function createStore(backend) {
	/** @returns {Promise<BrushSession[]>} most recent first */
	async function getSessions() {
		return (await backend.getAllSessions()).reverse();
	}

	/** @returns {Promise<DailySummary[]>} */
	function getSummaries() {
		return backend.getAllSummaries();
	}

	/**
	 * Roll sessions older than 30 days into per-day summaries, then delete the
	 * raw rows. Idempotent: a no-op when nothing is old enough.
	 * @param {number} [now] epoch milliseconds (defaults to Date.now())
	 * @returns {Promise<void>}
	 */
	async function compactOldSessions(now = Date.now()) {
		const [sessions, summaries] = await Promise.all([
			backend.getAllSessions(),
			backend.getAllSummaries()
		]);
		const { summaries: putSummaries, deleteIds } = rollUpOldSessions(sessions, summaries, now);
		if (deleteIds.length === 0) return;
		await backend.applyChanges({ putSummaries, deleteSessionIds: deleteIds });
	}

	/**
	 * Persist a brushing session.
	 * @param {BrushSession} session
	 * @returns {Promise<number>} the new record's id
	 */
	function saveSession(session) {
		return backend.addSession(session);
	}

	/** Delete a single session by id. */
	function deleteSession(/** @type {number} */ id) {
		return backend.deleteSession(id);
	}

	/** Remove every stored session. */
	function clearSessions() {
		return backend.clearSessions();
	}

	/**
	 * Snapshot both history stores as a portable, versioned backup object.
	 * @returns {Promise<import('./backup.js').Backup>}
	 */
	async function exportData() {
		const [sessions, summaries] = await Promise.all([getSessions(), getSummaries()]);
		return buildBackup(sessions, summaries);
	}

	/**
	 * Merge a backup into the local stores, skipping anything already present.
	 * Imported sessions are added without an `id` so the backend assigns fresh keys.
	 * @param {import('./backup.js').Backup} backup
	 * @returns {Promise<{ addedSessions: number, addedSummaries: number }>}
	 */
	async function importBackup(backup) {
		const [sessions, summaries] = await Promise.all([
			backend.getAllSessions(),
			backend.getAllSummaries()
		]);
		const { sessionsToAdd, summariesToPut } = mergeBackup(sessions, summaries, backup);
		if (sessionsToAdd.length === 0 && summariesToPut.length === 0) {
			return { addedSessions: 0, addedSummaries: 0 };
		}
		await backend.applyChanges({ addSessions: sessionsToAdd, putSummaries: summariesToPut });
		return { addedSessions: sessionsToAdd.length, addedSummaries: summariesToPut.length };
	}

	return {
		getSessions,
		getSummaries,
		saveSession,
		deleteSession,
		clearSessions,
		compactOldSessions,
		exportData,
		importBackup
	};
}
