<script>
	import { onMount } from 'svelte';
	import { BrushTimer } from '$lib/timer.svelte.js';
	import { TOTAL_SECONDS } from '$lib/zones.js';
	import { saveSession, getSessions, deleteSession } from '$lib/db.js';
	import { formatDuration } from '$lib/format.js';
	import TimerRing from '$lib/components/TimerRing.svelte';
	import ZoneDots from '$lib/components/ZoneDots.svelte';
	import History from '$lib/components/History.svelte';

	const timer = new BrushTimer();

	/** @type {import('$lib/db.js').BrushSession[]} */
	let sessions = $state([]);
	let saving = $state(false);
	// Guards against saving the same completed routine twice.
	let savedThisRun = $state(false);

	onMount(async () => {
		sessions = await getSessions();
	});

	// Persist automatically the moment a routine finishes naturally.
	$effect(() => {
		if (timer.status === 'done' && !savedThisRun) {
			savedThisRun = true;
			persist();
		}
		if (timer.status === 'running') {
			savedThisRun = false;
		}
	});

	async function persist() {
		saving = true;
		try {
			const record = timer.toSession();
			const id = await saveSession(record);
			sessions = [{ ...record, id }, ...sessions];
		} finally {
			saving = false;
		}
	}

	/** Save whatever has been brushed so far, then return to idle. */
	async function finishEarly() {
		if (timer.totalElapsed < 1) {
			timer.reset();
			return;
		}
		savedThisRun = true;
		await persist();
		timer.reset();
	}

	async function handleDelete(/** @type {number} */ id) {
		await deleteSession(id);
		sessions = sessions.filter((s) => s.id !== id);
	}

	function startOfDay(/** @type {number} */ ms) {
		// Local, throwaway Date for a pure timestamp calc — not reactive state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const d = new Date(ms);
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}

	// Number of completed sessions logged today.
	let todayCount = $derived(
		sessions.filter((s) => s.completed && startOfDay(s.startedAt) === startOfDay(Date.now())).length
	);

	// Current run of consecutive days with at least one completed session.
	let streak = $derived.by(() => {
		const days = new Set(sessions.filter((s) => s.completed).map((s) => startOfDay(s.startedAt)));
		if (days.size === 0) return 0;
		const DAY = 86_400_000;
		let cursor = startOfDay(Date.now());
		// Allow the streak to be "alive" if today hasn't been brushed yet.
		if (!days.has(cursor)) cursor -= DAY;
		let count = 0;
		while (days.has(cursor)) {
			count += 1;
			cursor -= DAY;
		}
		return count;
	});
</script>

<svelte:head>
	<title>BrushLog</title>
</svelte:head>

<main>
	<header>
		<h1>🦷 BrushLog</h1>
		<div class="stats">
			<div class="stat">
				<span class="num">{streak}</span>
				<span class="lbl">day streak</span>
			</div>
			<div class="stat">
				<span class="num">{todayCount}</span>
				<span class="lbl">today</span>
			</div>
		</div>
	</header>

	<section class="timer-card">
		{#if timer.status === 'idle'}
			<TimerRing progress={0} value={formatDuration(TOTAL_SECONDS)} caption="Ready to brush" />
			<ZoneDots activeIndex={0} perZone={timer.perZone} />
			<div class="controls">
				<button class="primary" onclick={() => timer.start()}>Start brushing</button>
			</div>
		{:else if timer.status === 'done'}
			<TimerRing progress={1} value="✓" caption="All done — great job!" />
			<ZoneDots activeIndex={timer.zoneIndex} perZone={timer.perZone} done />
			<p class="saved-note">
				{#if saving}Saving…{:else}Logged {formatDuration(timer.totalElapsed)} of brushing.{/if}
			</p>
			<div class="controls">
				<button class="primary" onclick={() => timer.start()}>Brush again</button>
			</div>
		{:else}
			<TimerRing
				progress={timer.zoneProgress}
				value={formatDuration(timer.zoneRemaining)}
				caption={`${timer.currentZone.arch} · ${timer.currentZone.label}`}
			/>
			<p class="hint">{timer.currentZone.hint}</p>
			<ZoneDots activeIndex={timer.zoneIndex} perZone={timer.perZone} />
			<div class="controls">
				<button class="primary" onclick={() => timer.toggle()}>
					{timer.status === 'running' ? 'Pause' : 'Resume'}
				</button>
				<button class="secondary" onclick={() => timer.skip()}>Skip zone</button>
				<button class="ghost" onclick={finishEarly}>Finish</button>
			</div>
		{/if}
	</section>

	<History {sessions} onDelete={handleDelete} />

	<footer>
		<p>Works offline · Saved on this device</p>
	</footer>
</main>

<style>
	main {
		max-width: 480px;
		margin: 0 auto;
		padding: 1.25rem 1.25rem 3rem;
		padding-top: calc(1.25rem + env(safe-area-inset-top));
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}
	h1 {
		font-size: 1.4rem;
		margin: 0;
		color: var(--ink, #134e4a);
	}
	.stats {
		display: flex;
		gap: 1rem;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.stat .num {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--accent, #0f766e);
		font-variant-numeric: tabular-nums;
	}
	.stat .lbl {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted, #5f7f7a);
	}
	.timer-card {
		background: white;
		border-radius: 1.5rem;
		padding: 1.75rem 1.25rem;
		box-shadow: 0 10px 30px rgba(15, 118, 110, 0.08);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.hint {
		text-align: center;
		color: var(--muted, #5f7f7a);
		font-size: 0.9rem;
		margin: -0.5rem 0 0;
	}
	.saved-note {
		text-align: center;
		color: var(--muted, #5f7f7a);
		font-size: 0.9rem;
		margin: 0;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
	}
	button {
		font: inherit;
		font-weight: 600;
		border-radius: 999px;
		border: none;
		padding: 0.8rem 1.4rem;
		cursor: pointer;
		transition:
			transform 0.05s ease,
			background 0.2s ease;
	}
	button:active {
		transform: scale(0.97);
	}
	.primary {
		background: var(--accent, #0f766e);
		color: white;
		flex: 1 1 auto;
		min-width: 10rem;
	}
	.secondary {
		background: rgba(15, 118, 110, 0.12);
		color: var(--accent, #0f766e);
	}
	.ghost {
		background: transparent;
		color: var(--muted, #5f7f7a);
	}
	footer {
		margin-top: 2rem;
		text-align: center;
	}
	footer p {
		font-size: 0.75rem;
		color: var(--muted, #5f7f7a);
	}
</style>
