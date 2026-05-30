import { openDB } from 'idb';
import { browser } from '$app/environment';

const DB_NAME = 'brushlog';
const DB_VERSION = 1;
const STORE = 'sessions';

/**
 * A single completed (or abandoned) brushing session.
 *
 * @typedef {Object} ZoneResult
 * @property {string} id        Zone id (see lib/zones).
 * @property {string} label     Human-readable zone name.
 * @property {number} seconds   Seconds actually brushed in this zone.
 * @property {boolean} completed Whether the zone reached its target time.
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
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE)) {
					const store = db.createObjectStore(STORE, {
						keyPath: 'id',
						autoIncrement: true
					});
					store.createIndex('startedAt', 'startedAt');
				}
			}
		});
	}
	return dbPromise;
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
