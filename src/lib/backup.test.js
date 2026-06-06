import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, mergeBackup, APP_TAG, BACKUP_VERSION } from './backup.js';

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
 * @param {string} day
 * @returns {import('./db.js').DailySummary}
 */
function summary(day) {
	return { day, completed: true, count: 1, totalSeconds: 160 };
}

describe('buildBackup', () => {
	it('stamps the app tag, version and an export timestamp', () => {
		const backup = buildBackup([], [], 1234);
		expect(backup.app).toBe(APP_TAG);
		expect(backup.version).toBe(BACKUP_VERSION);
		expect(backup.exportedAt).toBe(1234);
	});

	it('includes both stores', () => {
		const backup = buildBackup([session(1000)], [summary('2026-01-01')], 0);
		expect(backup.sessions).toHaveLength(1);
		expect(backup.summaries).toHaveLength(1);
	});

	it('strips the device-local session id', () => {
		const backup = buildBackup([session(1000, { id: 42 })], [], 0);
		expect(backup.sessions[0]).not.toHaveProperty('id');
		expect(backup.sessions[0].startedAt).toBe(1000);
	});
});

describe('parseBackup', () => {
	it('round-trips a built backup', () => {
		const text = JSON.stringify(buildBackup([session(1000)], [summary('2026-01-01')], 0));
		const parsed = parseBackup(text);
		expect(parsed.sessions).toHaveLength(1);
		expect(parsed.summaries).toHaveLength(1);
	});

	it('rejects malformed JSON', () => {
		expect(() => parseBackup('{ not json')).toThrow();
	});

	it('rejects a foreign app tag', () => {
		expect(() => parseBackup(JSON.stringify({ app: 'something-else' }))).toThrow();
	});

	it('rejects a newer schema version', () => {
		const text = JSON.stringify({
			app: APP_TAG,
			version: BACKUP_VERSION + 1,
			sessions: [],
			summaries: []
		});
		expect(() => parseBackup(text)).toThrow();
	});

	it('rejects non-array history fields', () => {
		const text = JSON.stringify({ app: APP_TAG, version: 1, sessions: {}, summaries: [] });
		expect(() => parseBackup(text)).toThrow();
	});

	it('rejects non-object payloads', () => {
		expect(() => parseBackup('[]')).toThrow();
		expect(() => parseBackup('null')).toThrow();
	});
});

describe('mergeBackup', () => {
	it('imports everything into empty stores', () => {
		const backup = buildBackup([session(1000), session(2000)], [summary('2026-01-01')], 0);
		const { sessionsToAdd, summariesToPut } = mergeBackup([], [], backup);
		expect(sessionsToAdd).toHaveLength(2);
		expect(summariesToPut).toHaveLength(1);
	});

	it('skips sessions already present by startedAt', () => {
		const backup = buildBackup([session(1000), session(2000)], [], 0);
		const { sessionsToAdd } = mergeBackup([session(1000, { id: 7 })], [], backup);
		expect(sessionsToAdd).toHaveLength(1);
		expect(sessionsToAdd[0].startedAt).toBe(2000);
	});

	it('dedupes sessions within the file', () => {
		const backup = buildBackup([session(1000), session(1000)], [], 0);
		const { sessionsToAdd } = mergeBackup([], [], backup);
		expect(sessionsToAdd).toHaveLength(1);
	});

	it('never overwrites a day the device already has', () => {
		const backup = buildBackup([], [summary('2026-01-01'), summary('2026-01-02')], 0);
		const { summariesToPut } = mergeBackup([], [summary('2026-01-01')], backup);
		expect(summariesToPut).toHaveLength(1);
		expect(summariesToPut[0].day).toBe('2026-01-02');
	});

	it('strips any id that slipped into the backup', () => {
		const backup = {
			app: APP_TAG,
			version: 1,
			exportedAt: 0,
			sessions: [session(1000, { id: 9 })],
			summaries: []
		};
		const { sessionsToAdd } = mergeBackup([], [], backup);
		expect(sessionsToAdd[0]).not.toHaveProperty('id');
	});

	it('round-trips a full export into an empty store', () => {
		const sessions = [session(1000, { id: 1 }), session(2000, { id: 2 })];
		const summaries = [summary('2026-01-01')];
		const backup = parseBackup(JSON.stringify(buildBackup(sessions, summaries, 0)));
		const { sessionsToAdd, summariesToPut } = mergeBackup([], [], backup);
		expect(sessionsToAdd).toHaveLength(2);
		expect(summariesToPut).toHaveLength(1);
		expect(sessionsToAdd.every((s) => !('id' in s))).toBe(true);
	});
});
