import { createStore } from './store.js';
import { createIdbBackend } from './storage/idb.js';

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

// All history I/O goes through a swappable backend (see store.js). Only the
// IndexedDB backend exists today; a SQLite backend for the iOS app can be
// selected here later without touching callers.
const store = createStore(createIdbBackend());

export const {
	getSessions,
	getSummaries,
	saveSession,
	deleteSession,
	clearSessions,
	compactOldSessions,
	exportData,
	importBackup
} = store;
