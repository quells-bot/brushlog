# History cap & old-session compaction

**Date:** 2026-05-30
**Status:** Approved design

## Problem

BrushLog logs a session per brush. At twice-a-day use the `sessions` store
grows ~730 records/year, the History list renders every one of them, and the
streak derivation scans the whole store on each change. Two changes keep this
bounded:

1. **Display cap** — show only the 10 most recent sessions in History.
2. **Compaction** — roll sessions older than 30 days into one summary row per
   calendar day, preserving the streak and lifetime totals while dropping the
   raw per-session detail.

## Scope note (dev alpha)

The app is in a dev alpha phase, so breaking IndexedDB changes are acceptable —
clearing IndexedDB in browser dev tools is an accepted reset path. In practice
this change needs no data migration: it only _adds_ an object store; the
existing `sessions` store and its raw `startedAt` epoch-ms are untouched.

## Data model

Add a second object store, `dailySummaries`, alongside `sessions`. Bump
`DB_VERSION` from 1 to 2; the `upgrade` step creates the new store when absent.

```js
/**
 * One compacted calendar day. Created when sessions older than 30 days are
 * rolled up; feeds the streak and lifetime totals after the raw sessions for
 * that day are deleted.
 *
 * @typedef {Object} DailySummary
 * @property {string} day          Local calendar day, "YYYY-MM-DD" — primary key.
 * @property {boolean} completed   true if >=1 completed session that day (feeds streak).
 * @property {number} count        Number of sessions rolled up for that day.
 * @property {number} totalSeconds Total seconds brushed that day.
 */
```

`keyPath: 'day'`, no autoIncrement. ISO `YYYY-MM-DD` strings sort
lexicographically in chronological order, so the keyspace stays ordered without
a separate index.

### Why string day keys (not epoch ms)

- **Readable / unambiguous.** `"2026-05-30"` is self-documenting in dev tools;
  an epoch-at-local-midnight value is opaque and blurs "UTC vs local midnight."
- **Fixes a latent streak bug.** The current streak walk steps to the previous
  day with `cursor -= 86_400_000` (`+page.svelte`). A fixed 24h subtraction is
  wrong on DST-transition days, where consecutive local midnights are 23h/25h
  apart — twice a year the walk lands off-midnight, misses the day-set check,
  and breaks an otherwise-valid streak. String keys force stepping via
  `Date.setDate(n - 1)`, which is DST-correct by construction.

## `dayKey` helper

Replace the existing `startOfDay(ms) -> number` helper (in `+page.svelte`) with:

```js
function dayKey(/** @type {number} */ ms) {
	// Local, throwaway Date for a pure label calc — not reactive state.
	const d = new Date(ms);
	const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

## Compaction

New function in `src/lib/db.js`:

```
compactOldSessions() -> Promise<void>
```

Behaviour:

- Cutoff: sessions whose `startedAt` falls strictly before the start of the day
  30 days ago are "old." Compute the cutoff as the first ms of
  `dayKey(now − 30 days)` (i.e. compare by calendar day, not a raw ms offset).
- Read all old sessions, group them by `dayKey(startedAt)`.
- For each day: read any existing `dailySummaries` row for that day and **merge**
  — `count += n`, `totalSeconds += sum`, `completed ||= anyCompletedThatDay` —
  then `put` the summary and `delete` the raw sessions for that day.
- Performed within a single readwrite transaction spanning both stores.
- Idempotent: with no old sessions it does nothing.

Every old day with >=1 session becomes a summary, including partial-only days
(so lifetime totals stay accurate); a partial-only day has `completed: false`
and simply does not extend the streak.

### When it runs

Called once from `onMount` in `+page.svelte`, immediately after the initial
load, then both stores are re-read into reactive state. For an offline SPA the
app-load path is the only place this needs to run; recent sessions are never
eligible, so there is no need to re-compact after saving a new session.

## Streak & stats

`streak` and `todayCount` move from `startOfDay` (ms) to `dayKey` (string), and
the streak's day-set is the **union** of raw and summarized completed days:

```js
const days = new Set([
	...sessions.filter((s) => s.completed).map((s) => dayKey(s.startedAt)),
	...summaries.filter((s) => s.completed).map((s) => s.day)
]);
```

The backward walk becomes Date-based:

```js
if (days.size === 0) return 0;
// Local, throwaway Date — not reactive state.
const cursor = new Date();
cursor.setHours(0, 0, 0, 0);
if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
let count = 0;
while (days.has(dayKey(cursor.getTime()))) {
	count += 1;
	cursor.setDate(cursor.getDate() - 1);
}
return count;
```

`todayCount` keeps counting only completed sessions whose `dayKey` equals
today's; today is never compacted, so summaries never affect it.

`+page.svelte` gains a reactive `summaries` array loaded alongside `sessions` so
these derivations stay reactive.

## History display

`History.svelte`:

- Render only `sessions.slice(0, 10)`, each with its existing ✕ delete button
  and Complete/Partial badge (unchanged).
- Below the list, a muted note **"+N earlier sessions"** shown only when N > 0,
  where:

  ```
  N = max(0, sessions.length − 10) + Σ summary.count
  ```

  i.e. undisplayed recent raw sessions plus every rolled-up session. (The
  `max(0, …)` matters: with fewer than 10 raw sessions but some summaries — e.g.
  3 recent + 5 summarized — a bare `sessions.length − 10` would go negative.)
  The note is
  the only surface for summaries; summary rows are not individually listed or
  deletable from the UI.

Because the cap is the 10 newest and compaction starts at 30 days, in normal
twice-a-day use the listed entries are always recent raw sessions; summaries
exist only to feed the streak, the totals, and the "+N earlier" count.

## Out of scope

- Deleting or editing compacted summaries from the UI.
- A "show more" / pagination control for entries between the 10th-newest and the
  30-day boundary.
- Lifetime-stats display surfaces beyond the existing streak / today counters.
