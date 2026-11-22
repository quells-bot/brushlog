import { openDB } from 'idb';
import { browser } from '$app/environment';

const DB_NAME = 'brushlog';
const DB_VERSION = 2;
const STORE = 'sessions';
const SUMMARY_STORE = 'dailySummaries';

/**
 * IndexedDB-backed {@link import('../store.js').StorageBackend}. The database is
 * opened lazily on first use, so importing this module during SSR is safe;
 * calling a method outside the browser throws.
 *
 * @typedef {import('../db.js').BrushSession} BrushSession
 * @typedef {import('../db.js').DailySummary} DailySummary
 *
 * @returns {import('../store.js').StorageBackend}
 */
export function createIdbBackend() {
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

	return {
		async getAllSessions() {
			const db = await getDB();
			return /** @type {BrushSession[]} */ (await db.getAllFromIndex(STORE, 'startedAt'));
		},
		async getAllSummaries() {
			const db = await getDB();
			return /** @type {DailySummary[]} */ (await db.getAll(SUMMARY_STORE));
		},
		async addSession(session) {
			const db = await getDB();
			return /** @type {number} */ (await db.add(STORE, session));
		},
		async deleteSession(id) {
			const db = await getDB();
			await db.delete(STORE, id);
		},
		async clearSessions() {
			const db = await getDB();
			await db.clear(STORE);
		},
		async applyChanges({ addSessions = [], putSummaries = [], deleteSessionIds = [] }) {
			const db = await getDB();
			const tx = db.transaction([STORE, SUMMARY_STORE], 'readwrite');
			await Promise.all([
				...addSessions.map((s) => tx.objectStore(STORE).add(s)),
				...putSummaries.map((s) => tx.objectStore(SUMMARY_STORE).put(s)),
				...deleteSessionIds.map((id) => tx.objectStore(STORE).delete(id)),
				tx.done
			]);
		}
	};
}
