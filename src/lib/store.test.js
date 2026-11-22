import { describe, it, expect } from 'vitest';
import { createStore } from './store.js';
import { buildBackup } from './backup.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 5, 15, 12).getTime();

/**
 * @param {number} startedAt
 * @param {Partial<import('./db.js').BrushSession>} [extra]
 * @returns {import('./db.js').BrushSession}
 */
function session(startedAt, extra = {}) {
	return {
		startedAt,
		endedAt: startedAt + 160000,
		totalSeconds: 160,
		completed: true,
		zones: [],
		...extra
	};
}

/**
 * In-memory StorageBackend that records every applyChanges call.
 * @param {import('./db.js').BrushSession[]} [sessions]
 * @param {import('./db.js').DailySummary[]} [summaries]
 */
function memoryBackend(sessions = [], summaries = []) {
	let nextId = 1;
	/** @type {import('./db.js').BrushSession[]} */
	let rows = sessions.map((s) => ({ ...s, id: s.id ?? nextId++ }));
	/** @type {Map<string, import('./db.js').DailySummary>} */
	const sums = new Map(summaries.map((s) => [s.day, s]));
	/** @type {import('./store.js').StorageChanges[]} */
	const changes = [];
	/** @type {import('./store.js').StorageBackend & { changes: typeof changes }} */
	const backend = {
		changes,
		async getAllSessions() {
			return [...rows].sort((a, b) => a.startedAt - b.startedAt);
		},
		async getAllSummaries() {
			return [...sums.values()];
		},
		async addSession(s) {
			const id = nextId++;
			rows.push({ ...s, id });
			return id;
		},
		async deleteSession(id) {
			rows = rows.filter((r) => r.id !== id);
		},
		async clearSessions() {
			rows = [];
		},
		async applyChanges(c) {
			changes.push(c);
			for (const s of c.addSessions ?? []) rows.push({ ...s, id: nextId++ });
			for (const s of c.putSummaries ?? []) sums.set(s.day, s);
			const del = new Set(c.deleteSessionIds ?? []);
			rows = rows.filter((r) => !del.has(/** @type {number} */ (r.id)));
		}
	};
	return backend;
}

describe('createStore', () => {
	it('getSessions returns most recent first', async () => {
		const store = createStore(memoryBackend([session(1), session(3), session(2)]));
		const got = await store.getSessions();
		expect(got.map((s) => s.startedAt)).toEqual([3, 2, 1]);
	});

	it('saveSession returns backend id', async () => {
		const store = createStore(memoryBackend([session(1)]));
		expect(await store.saveSession(session(5))).toBe(2);
	});

	it('compactOldSessions applies one atomic change', async () => {
		const backend = memoryBackend([session(NOW - 40 * DAY), session(NOW - DAY)]);
		const store = createStore(backend);
		await store.compactOldSessions(NOW);
		expect(backend.changes).toHaveLength(1);
		expect(backend.changes[0].deleteSessionIds).toEqual([1]);
		expect(backend.changes[0].putSummaries).toHaveLength(1);
	});

	it('compactOldSessions is a no-op when nothing is old', async () => {
		const backend = memoryBackend([session(NOW - DAY)]);
		await createStore(backend).compactOldSessions(NOW);
		expect(backend.changes).toHaveLength(0);
	});

	it('importBackup with nothing new does not write', async () => {
		const backend = memoryBackend(
			[session(NOW - DAY)],
			[{ day: '2026-01-01', completed: true, count: 1, totalSeconds: 160 }]
		);
		const store = createStore(backend);
		const backup = buildBackup(await backend.getAllSessions(), await backend.getAllSummaries());
		expect(await store.importBackup(backup)).toEqual({ addedSessions: 0, addedSummaries: 0 });
		expect(backend.changes).toHaveLength(0);
	});

	it('importBackup adds sessions without ids', async () => {
		const backend = memoryBackend();
		const store = createStore(backend);
		const backup = buildBackup([session(10, { id: 99 }), session(20, { id: 100 })], []);
		const result = await store.importBackup(backup);
		expect(result).toEqual({ addedSessions: 2, addedSummaries: 0 });
		expect(backend.changes).toHaveLength(1);
		expect(backend.changes[0].addSessions?.every((s) => !('id' in s))).toBe(true);
	});

	it('exportData strips ids', async () => {
		const store = createStore(memoryBackend([session(1), session(2)]));
		const backup = await store.exportData();
		expect(backup.sessions).toHaveLength(2);
		expect(backup.sessions.every((s) => !('id' in s))).toBe(true);
	});
});
