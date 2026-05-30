# History Cap & Old-Session Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap the History list to the 10 newest sessions and roll up sessions older than 30 days into one summary-per-day, preserving the streak and lifetime totals.

**Architecture:** Extract all date/streak/roll-up logic into a new pure module `src/lib/history.js` (no SvelteKit/browser imports) so it can be unit-tested with Vitest. `src/lib/db.js` stays a thin IndexedDB wrapper that calls the pure roll-up and applies the resulting puts/deletes. `+page.svelte` runs compaction on mount and derives streak/today-count from the pure functions; `History.svelte` slices to 10 and shows a "+N earlier" note.

**Tech Stack:** SvelteKit (Svelte 5 runes), `idb`, Vitest (new), JavaScript + JSDoc (no TypeScript).

Spec: `docs/superpowers/specs/2026-05-30-history-cap-and-compaction-design.md`

---

## File Structure

- **Create** `src/lib/history.js` — pure logic: `dayKey`, `compactionCutoff`, `computeStreak`, `computeTodayCount`, `rollUpOldSessions`. No imports from `$app`/`idb`; types via JSDoc only.
- **Create** `src/lib/history.test.js` — Vitest unit tests for the above.
- **Create** `vitest.config.js` — node-environment test config (does not load the SvelteKit/PWA plugins).
- **Modify** `package.json` — add `vitest` devDep + `test` script.
- **Modify** `src/lib/db.js` — `DB_VERSION` → 2, create `dailySummaries` store, add `getSummaries()` and `compactOldSessions()`.
- **Modify** `src/routes/+page.svelte` — load summaries, run compaction on mount, derive streak/today-count from `history.js`, drop local `startOfDay`.
- **Modify** `src/lib/components/History.svelte` — slice to 10, add "+N earlier sessions" note.
- **Modify** `CLAUDE.md` — note that unit tests now exist (`npm test`).

---

## Task 1: Set up Vitest

**Files:**

- Create: `vitest.config.js`
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Install Vitest**

Run:

```bash
npm install -D vitest
```

Expected: `vitest` added under `devDependencies`, install completes. Peer-dependency warnings about the Vite version are acceptable (dev alpha).

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

// Standalone config so the SvelteKit + PWA plugins don't load during unit tests.
// TZ is pinned in the npm script (see package.json) so DST-sensitive tests are
// deterministic regardless of the machine timezone.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.js']
	}
});
```

- [ ] **Step 3: Add the test script**

In `package.json`, add to `"scripts"` (after `"dev"`):

```json
		"test": "TZ=America/New_York vitest run",
```

- [ ] **Step 4: Verify Vitest runs**

Run:

```bash
npm test -- --passWithNoTests
```

Expected: exits 0, output like "No test files found" / "passed" — confirms Vitest is wired up.

- [ ] **Step 5: Update CLAUDE.md**

In `CLAUDE.md`, under `## Commands`, change the `check` bullet so it no longer claims tests are absent, and add a `test` bullet. Replace:

```
- `npm run check` — type-check (`svelte-kit sync && svelte-check`). No unit tests exist; `check` + `lint` are the verification steps.
```

with:

```
- `npm run check` — type-check (`svelte-kit sync && svelte-check`).
- `npm test` — Vitest unit tests for pure logic in `src/lib/` (`*.test.js`). Runs with `TZ=America/New_York` so DST-sensitive date tests are deterministic.
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js CLAUDE.md
git commit -m "chore: add Vitest for pure-logic unit tests"
```

---

## Task 2: `dayKey()` — local calendar-day label

**Files:**

- Create: `src/lib/history.js`
- Test: `src/lib/history.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/history.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { dayKey } from './history.js';

describe('dayKey', () => {
	it('formats a timestamp as local YYYY-MM-DD', () => {
		expect(dayKey(new Date(2026, 4, 30, 12, 0).getTime())).toBe('2026-05-30');
	});

	it('zero-pads month and day', () => {
		expect(dayKey(new Date(2026, 0, 5, 0, 0).getTime())).toBe('2026-01-05');
	});

	it('uses local midnight boundaries (late-evening stays same day)', () => {
		expect(dayKey(new Date(2026, 4, 30, 23, 59).getTime())).toBe('2026-05-30');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `dayKey` is not exported / module missing.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/history.js`:

```js
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
 * Local calendar day for a timestamp, as a sortable `YYYY-MM-DD` string.
 * @param {number} ms epoch milliseconds
 * @returns {string}
 */
export function dayKey(ms) {
	const d = new Date(ms);
	const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.js src/lib/history.test.js
git commit -m "feat: add dayKey helper for local calendar-day labels"
```

---

## Task 3: `computeTodayCount()`

**Files:**

- Modify: `src/lib/history.js`
- Test: `src/lib/history.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/history.test.js`:

```js
import { computeTodayCount } from './history.js';

describe('computeTodayCount', () => {
	const now = new Date(2026, 4, 30, 20, 0).getTime();

	it('counts only completed sessions started today', () => {
		const sessions = [
			{ startedAt: new Date(2026, 4, 30, 8, 0).getTime(), completed: true },
			{ startedAt: new Date(2026, 4, 30, 21, 0).getTime(), completed: true },
			{ startedAt: new Date(2026, 4, 30, 9, 0).getTime(), completed: false },
			{ startedAt: new Date(2026, 4, 29, 8, 0).getTime(), completed: true }
		];
		expect(computeTodayCount(sessions, now)).toBe(2);
	});

	it('returns 0 with no sessions', () => {
		expect(computeTodayCount([], now)).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `computeTodayCount` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/history.js`:

```js
/**
 * Number of completed sessions started on the same local day as `now`.
 * @param {BrushSession[]} sessions
 * @param {number} [now] epoch milliseconds (defaults to Date.now())
 * @returns {number}
 */
export function computeTodayCount(sessions, now = Date.now()) {
	const today = dayKey(now);
	return sessions.filter((s) => s.completed && dayKey(s.startedAt) === today).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.js src/lib/history.test.js
git commit -m "feat: add computeTodayCount"
```

---

## Task 4: `computeStreak()` — DST-correct backward walk

**Files:**

- Modify: `src/lib/history.js`
- Test: `src/lib/history.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/history.test.js`:

```js
import { computeStreak } from './history.js';

describe('computeStreak', () => {
	const day = (y, m, d) => new Date(y, m, d, 9, 0).getTime();

	it('returns 0 when there are no completed days', () => {
		expect(computeStreak([], [], day(2026, 4, 30))).toBe(0);
	});

	it('counts consecutive completed days ending today', () => {
		const sessions = [
			{ startedAt: day(2026, 4, 28), completed: true },
			{ startedAt: day(2026, 4, 29), completed: true },
			{ startedAt: day(2026, 4, 30), completed: true }
		];
		expect(computeStreak(sessions, [], day(2026, 4, 30))).toBe(3);
	});

	it('keeps the streak alive when today is not yet brushed', () => {
		const sessions = [
			{ startedAt: day(2026, 4, 28), completed: true },
			{ startedAt: day(2026, 4, 29), completed: true }
		];
		// now = the 30th, nothing logged yet today -> streak still 2 (through the 29th)
		expect(computeStreak(sessions, [], day(2026, 4, 30))).toBe(2);
	});

	it('ignores incomplete sessions', () => {
		const sessions = [
			{ startedAt: day(2026, 4, 29), completed: false },
			{ startedAt: day(2026, 4, 30), completed: true }
		];
		expect(computeStreak(sessions, [], day(2026, 4, 30))).toBe(1);
	});

	it('unions summary days with raw session days', () => {
		const summaries = [
			{ day: '2026-05-28', completed: true, count: 2, totalSeconds: 320 },
			{ day: '2026-05-29', completed: true, count: 1, totalSeconds: 160 }
		];
		const sessions = [{ startedAt: day(2026, 4, 30), completed: true }];
		expect(computeStreak(sessions, summaries, day(2026, 4, 30))).toBe(3);
	});

	it('does not miscount across a DST spring-forward boundary', () => {
		// US/Eastern springs forward on 2026-03-08 (a 23-hour local day).
		// A fixed 24h step would skip the 8th; setDate-based stepping does not.
		const sessions = [
			{ startedAt: day(2026, 2, 7), completed: true },
			{ startedAt: day(2026, 2, 8), completed: true },
			{ startedAt: day(2026, 2, 9), completed: true }
		];
		expect(computeStreak(sessions, [], day(2026, 2, 9))).toBe(3);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `computeStreak` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/history.js`:

```js
/**
 * Current run of consecutive local days with at least one completed session,
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

	const cursor = new Date(now);
	cursor.setHours(0, 0, 0, 0);
	// Allow the streak to be "alive" if today hasn't been brushed yet.
	if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);

	let count = 0;
	while (days.has(dayKey(cursor.getTime()))) {
		count += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all green, including the DST case).

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.js src/lib/history.test.js
git commit -m "feat: add DST-correct computeStreak over sessions + summaries"
```

---

## Task 5: `rollUpOldSessions()` + `compactionCutoff()`

**Files:**

- Modify: `src/lib/history.js`
- Test: `src/lib/history.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/history.test.js`:

```js
import { rollUpOldSessions } from './history.js';

describe('rollUpOldSessions', () => {
	const now = new Date(2026, 4, 30, 12, 0).getTime();
	const DAY = 86_400_000;

	it('leaves recent sessions untouched', () => {
		const sessions = [{ id: 1, startedAt: now - 5 * DAY, totalSeconds: 160, completed: true }];
		const result = rollUpOldSessions(sessions, [], now);
		expect(result.deleteIds).toEqual([]);
		expect(result.summaries).toEqual([]);
	});

	it('rolls up sessions older than 30 days into one summary per day', () => {
		const old = new Date(2026, 3, 1, 8, 0).getTime(); // 2026-04-01, ~59 days old
		const sessions = [
			{ id: 1, startedAt: old, totalSeconds: 160, completed: true },
			{ id: 2, startedAt: old + 3 * 3600_000, totalSeconds: 90, completed: false },
			{ id: 3, startedAt: now - 2 * DAY, totalSeconds: 160, completed: true }
		];
		const result = rollUpOldSessions(sessions, [], now);
		expect(result.deleteIds).toEqual([1, 2]);
		expect(result.summaries).toEqual([
			{ day: '2026-04-01', completed: true, count: 2, totalSeconds: 250 }
		]);
	});

	it('merges into an existing summary for the same day', () => {
		const old = new Date(2026, 3, 1, 8, 0).getTime();
		const sessions = [{ id: 7, startedAt: old, totalSeconds: 100, completed: false }];
		const existing = [{ day: '2026-04-01', completed: true, count: 1, totalSeconds: 160 }];
		const result = rollUpOldSessions(sessions, existing, now);
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
			[{ id: 7, startedAt: old, totalSeconds: 100, completed: true }],
			existing,
			now
		);
		expect(existing).toEqual(snapshot);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `rollUpOldSessions` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/history.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all green).

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errors. (`DailySummary` is referenced via JSDoc here; it is defined in `db.js` in Task 6. If `check` is run before Task 6 it will report an unresolved type — that is expected until Task 6 lands. Run order matters: do not commit a broken `check`; if you need a green `check` now, do Task 6 next before running it.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/history.js src/lib/history.test.js
git commit -m "feat: add rollUpOldSessions + compactionCutoff"
```

---

## Task 6: IndexedDB store + compaction wiring in `db.js`

**Files:**

- Modify: `src/lib/db.js`

No unit test (IndexedDB I/O); verified by `npm run check`, `npm run lint`, and the manual browser check in Task 7.

- [ ] **Step 1: Add the `DailySummary` typedef**

In `src/lib/db.js`, inside the existing top JSDoc block, after the `ZoneResult` typedef and before `BrushSession`, add:

```js
/**
 * @typedef {Object} DailySummary
 * @property {string} day           Local calendar day, "YYYY-MM-DD" — primary key.
 * @property {boolean} completed    true if >=1 completed session that day (feeds streak).
 * @property {number} count         Number of sessions rolled up for that day.
 * @property {number} totalSeconds  Total seconds brushed that day.
 */
```

- [ ] **Step 2: Bump version, name the new store, import the roll-up**

In `src/lib/db.js`, add the import near the top (after the existing imports):

```js
import { rollUpOldSessions } from './history.js';
```

Change the version constant and add the summary store name:

```js
const DB_VERSION = 2;
const STORE = 'sessions';
const SUMMARY_STORE = 'dailySummaries';
```

- [ ] **Step 3: Create the store in `upgrade`**

In `getDB()`, replace the existing `upgrade(db) { ... }` with a version-aware one:

```js
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
```

- [ ] **Step 4: Add `getSummaries()` and `compactOldSessions()`**

In `src/lib/db.js`, after `getSessions()`, add:

```js
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
```

- [ ] **Step 5: Verify check and lint pass**

Run: `npm run check && npm run lint`
Expected: 0 type errors, 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.js
git commit -m "feat: add dailySummaries store and compactOldSessions"
```

---

## Task 7: Wire compaction + pure derivations into `+page.svelte`

**Files:**

- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Update imports**

In `src/routes/+page.svelte`, change the db import line and add the history import:

```js
import {
	saveSession,
	getSessions,
	deleteSession,
	getSummaries,
	compactOldSessions
} from '$lib/db.js';
import { computeStreak, computeTodayCount } from '$lib/history.js';
```

- [ ] **Step 2: Add reactive summaries state**

After the existing `let sessions = $state([]);` line, add:

```js
/** @type {import('$lib/db.js').DailySummary[]} */
let summaries = $state([]);
```

- [ ] **Step 3: Run compaction on mount, then load both stores**

Replace the existing `onMount` block:

```js
onMount(async () => {
	sessions = await getSessions();
});
```

with:

```js
onMount(async () => {
	await compactOldSessions();
	[sessions, summaries] = await Promise.all([getSessions(), getSummaries()]);
});
```

- [ ] **Step 4: Replace `startOfDay`, `todayCount`, and `streak`**

Delete the local `startOfDay` function and both derivations (the `function startOfDay(...) {...}` block, `let todayCount = $derived(...)`, and `let streak = $derived.by(...)` — lines 61–88 in the current file). Replace all of it with:

```js
// Completed sessions logged today.
let todayCount = $derived(computeTodayCount(sessions));

// Current run of consecutive days with a completed session (raw + compacted).
let streak = $derived(computeStreak(sessions, summaries));
```

- [ ] **Step 5: Verify check and lint pass**

Run: `npm run check && npm run lint`
Expected: 0 type errors, 0 lint errors. (No more `startOfDay`, no unused imports.)

- [ ] **Step 6: Manual browser verification of compaction**

Run: `npm run dev`, open the app, and in the tab's DevTools console seed two old sessions:

```js
const open = indexedDB.open('brushlog');
open.onsuccess = () => {
	const db = open.result;
	const tx = db.transaction('sessions', 'readwrite');
	const store = tx.objectStore('sessions');
	const now = Date.now();
	const DAY = 86_400_000;
	store.add({
		startedAt: now - 40 * DAY,
		endedAt: now - 40 * DAY + 160_000,
		totalSeconds: 160,
		completed: true,
		zones: []
	});
	store.add({
		startedAt: now - 40 * DAY + 3_600_000,
		endedAt: now - 40 * DAY + 3_760_000,
		totalSeconds: 160,
		completed: true,
		zones: []
	});
	tx.oncomplete = () => location.reload();
};
```

Expected after reload: in DevTools → Application → IndexedDB → `brushlog`, the two raw rows are gone from `sessions`, and `dailySummaries` has one row for that day with `count: 2`, `totalSeconds: 320`, `completed: true`. The two sessions do **not** appear in the on-screen History list.

- [ ] **Step 7: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: run compaction on mount and derive streak/today from history.js"
```

---

## Task 8: Cap History to 10 with a "+N earlier" note

**Files:**

- Modify: `src/lib/components/History.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Pass summaries into History**

In `src/routes/+page.svelte`, update the `History` usage:

```svelte
<History {sessions} {summaries} onDelete={handleDelete} />
```

- [ ] **Step 2: Accept summaries and derive the shown list + count**

In `src/lib/components/History.svelte`, replace the `<script>` block contents with:

```svelte
<script>
	import { formatDuration, formatDateTime } from '$lib/format.js';

	let {
		/** @type {import('$lib/db.js').BrushSession[]} */
		sessions = [],
		/** @type {import('$lib/db.js').DailySummary[]} */
		summaries = [],
		/** @type {(id: number) => void} */
		onDelete
	} = $props();

	// Only the 10 newest raw sessions are listed.
	let shown = $derived(sessions.slice(0, 10));

	// Everything not listed: undisplayed recent sessions + every compacted session.
	let earlier = $derived(
		Math.max(0, sessions.length - 10) + summaries.reduce((n, s) => n + s.count, 0)
	);
</script>
```

- [ ] **Step 3: Render the capped list + note**

In the same file, change the `{#each sessions as s (s.id)}` to iterate `shown`, and add the note after the `</ul>`. Replace the markup block:

```svelte
		<ul>
			{#each sessions as s (s.id)}
```

with:

```svelte
		<ul>
			{#each shown as s (s.id)}
```

Then, immediately after the closing `</ul>` and before the `{/if}`, add:

```svelte
{#if earlier > 0}
	<p class="earlier">+{earlier} earlier session{earlier === 1 ? '' : 's'}</p>
{/if}
```

- [ ] **Step 4: Add the note style**

In the `<style>` block of `History.svelte`, after the `.empty` rule, add:

```css
.earlier {
	color: var(--muted, #5f7f7a);
	font-size: 0.8rem;
	margin: 0.5rem 0 0;
	text-align: center;
}
```

- [ ] **Step 5: Verify check and lint pass**

Run: `npm run check && npm run lint`
Expected: 0 type errors, 0 lint errors.

- [ ] **Step 6: Manual browser verification of the cap**

With `npm run dev` running and the two compacted sessions from Task 7 still present, seed 11 recent sessions in the console:

```js
const open = indexedDB.open('brushlog');
open.onsuccess = () => {
	const db = open.result;
	const tx = db.transaction('sessions', 'readwrite');
	const store = tx.objectStore('sessions');
	const now = Date.now();
	for (let i = 0; i < 11; i++) {
		store.add({
			startedAt: now - i * 3_600_000,
			endedAt: now - i * 3_600_000 + 160_000,
			totalSeconds: 160,
			completed: true,
			zones: []
		});
	}
	tx.oncomplete = () => location.reload();
};
```

Expected after reload: History lists exactly 10 sessions, and the note reads **"+3 earlier sessions"** (1 undisplayed recent + 2 from the compacted day). Deleting a listed session via ✕ removes it and the note recalculates.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/History.svelte src/routes/+page.svelte
git commit -m "feat: cap history to 10 entries with a +N earlier note"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test + type-check + lint + build**

Run:

```bash
npm test && npm run check && npm run lint && npm run build
```

Expected: tests pass, 0 type errors, 0 lint errors, static build to `./build/` succeeds.

- [ ] **Step 2: Confirm clean tree**

Run: `git status`
Expected: clean (all changes committed across Tasks 1–8).

---

## Self-Review Notes

- **Spec coverage:** `dailySummaries` store + `DailySummary` typedef (Task 6); string `YYYY-MM-DD` keys + `dayKey` (Task 2); `compactOldSessions` with 30-day calendar cutoff and per-day merge incl. partials (Tasks 5–6); on-mount trigger (Task 7); DST-correct streak union + `todayCount` (Tasks 3–4, 7); History cap at 10 + `max(0, …)` "+N earlier" note (Task 8). Out-of-scope items (summary editing/deletion, "show more", extra stat surfaces) are intentionally absent.
- **No placeholders:** every code/command step is concrete.
- **Type consistency:** `DailySummary {day, completed, count, totalSeconds}` and `rollUpOldSessions → {summaries, deleteIds}` are used identically across `history.js`, its tests, and `db.js`.
