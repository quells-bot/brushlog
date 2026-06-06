import { openDB } from 'idb';
import { browser } from '$app/environment';
import { rollUpOldSessions } from './history.js';
import { buildBackup, mergeBackup } from './backup.js';

const DB_NAME = 'brushlog';
const DB_VERSION = 2;
const STORE = 'sessions';
const SUMMARY_STORE = 'dailySummaries';

/**
 * A single completed (or abandoned) brushing session.
 *
 * @typedef {Object} ZoneResult
 * @property {string} id        Zone id (see lib/zones).
 * @property {string} label     Human-readable zone name.
 * @property {number} seconds   Seconds actually brushed in this zone.
 * @property {boolean} completed Whether the zone reached its target time.
 *
 * @typedef {Object} DailySummary
 * @property {string} day           Local calendar day, "YYYY-MM-DD" — primary key.
 * @property {boolean} completed    true if >=1 completed session that day (feeds streak).
 * @property {number} count         Number of sessions rolled up for that day.
 * @property {number} totalSeconds  Total seconds brushed that day.
 *
 * @typedef {Object} BrushSession
 * @property {number} [id]          Auto-incremented primary key.
 * @property {number} startedAt     Epoch ms when brushing began.
 * @property {number} endedAt       Epoch ms when the session was saved.
 * @property {number} totalSeconds  Total seconds brushed across all zones.
 * @property {boolean} completed    Whether every zone was completed.
 * @property {ZoneResult[]} zones   Per-zone breakdown.
 */

/** @type {Promise<import('idb').IDBPDatabase> | null} */
let dbPromise = null;

function getDB() {
	if (!browser) {
		throw new Error('IndexedDB is only available in the browser');
	}
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					const store = db.createObjectStore(STORE, {
						keyPath: 'id',
						autoIncrement: true
					});
					store.createIndex('startedAt', 'startedAt');
				}
				if (oldVersion < 2) {
					db.createObjectStore(SUMMARY_STORE, { keyPath: 'day' });
				}
			}
		});
	}
	return dbPromise;
}

/**
 * Fetch all per-day summaries (ascending by day key).
 * @returns {Promise<DailySummary[]>}
 */
export async function getSummaries() {
	const db = await getDB();
	return /** @type {DailySummary[]} */ (await db.getAll(SUMMARY_STORE));
}

/**
 * Roll sessions older than 30 days into per-day summaries, then delete the raw
 * rows. Idempotent: a no-op when nothing is old enough.
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {Promise<void>}
 */
export async function compactOldSessions(now = Date.now()) {
	const db = await getDB();
	const [sessions, summaries] = await Promise.all([
		/** @type {Promise<BrushSession[]>} */ (db.getAll(STORE)),
		getSummaries()
	]);
	const { summaries: toPut, deleteIds } = rollUpOldSessions(sessions, summaries, now);
	if (deleteIds.length === 0) return;

	const tx = db.transaction([STORE, SUMMARY_STORE], 'readwrite');
	await Promise.all([
		...toPut.map((s) => tx.objectStore(SUMMARY_STORE).put(s)),
		...deleteIds.map((id) => tx.objectStore(STORE).delete(id)),
		tx.done
	]);
}

/**
 * Persist a brushing session.
 * @param {BrushSession} session
 * @returns {Promise<number>} the new record's id
 */
export async function saveSession(session) {
	const db = await getDB();
	return /** @type {number} */ (await db.add(STORE, session));
}

/**
 * Fetch all sessions, most recent first.
 * @returns {Promise<BrushSession[]>}
 */
export async function getSessions() {
	const db = await getDB();
	const all = await db.getAllFromIndex(STORE, 'startedAt');
	return all.reverse();
}

/** Delete a single session by id. */
export async function deleteSession(/** @type {number} */ id) {
	const db = await getDB();
	await db.delete(STORE, id);
}

/** Remove every stored session. */
export async function clearSessions() {
	const db = await getDB();
	await db.clear(STORE);
}

/**
 * Snapshot both history stores as a portable, versioned backup object.
 * @returns {Promise<import('./backup.js').Backup>}
 */
export async function exportData() {
	const [sessions, summaries] = await Promise.all([getSessions(), getSummaries()]);
	return buildBackup(sessions, summaries);
}

/**
 * Merge a backup into the local stores, skipping anything already present.
 * Imported sessions are added without an `id` so IndexedDB assigns fresh keys.
 * @param {import('./backup.js').Backup} backup
 * @returns {Promise<{ addedSessions: number, addedSummaries: number }>}
 */
export async function importBackup(backup) {
	const db = await getDB();
	const [sessions, summaries] = await Promise.all([
		/** @type {Promise<BrushSession[]>} */ (db.getAll(STORE)),
		getSummaries()
	]);
	const { sessionsToAdd, summariesToPut } = mergeBackup(sessions, summaries, backup);
	if (sessionsToAdd.length === 0 && summariesToPut.length === 0) {
		return { addedSessions: 0, addedSummaries: 0 };
	}

	const tx = db.transaction([STORE, SUMMARY_STORE], 'readwrite');
	await Promise.all([
		...sessionsToAdd.map((s) => tx.objectStore(STORE).add(s)),
		...summariesToPut.map((s) => tx.objectStore(SUMMARY_STORE).put(s)),
		tx.done
	]);
	return { addedSessions: sessionsToAdd.length, addedSummaries: summariesToPut.length };
}
