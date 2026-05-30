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

<section class="history">
	<h2>History</h2>
	{#if sessions.length === 0}
		<p class="empty">No sessions yet. Your first brush will show up here.</p>
	{:else}
		<ul>
			{#each shown as s (s.id)}
				<li class:incomplete={!s.completed}>
					<div class="meta">
						<span class="when">{formatDateTime(s.startedAt)}</span>
						<span class="detail">
							{formatDuration(s.totalSeconds)}
							{#if s.completed}
								<span class="badge done">Complete</span>
							{:else}
								<span class="badge partial">Partial</span>
							{/if}
						</span>
					</div>
					<button
						class="delete"
						aria-label="Delete session"
						onclick={() => onDelete?.(/** @type {number} */ (s.id))}
					>
						✕
					</button>
				</li>
			{/each}
		</ul>
		{#if earlier > 0}
			<p class="earlier">+{earlier} earlier session{earlier === 1 ? '' : 's'}</p>
		{/if}
	{/if}
</section>

<style>
	.history {
		margin-top: 2rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: var(--ink, #134e4a);
	}
	.empty {
		color: var(--muted, #5f7f7a);
		font-size: 0.9rem;
	}
	.earlier {
		color: var(--muted, #5f7f7a);
		font-size: 0.8rem;
		margin: 0.5rem 0 0;
		text-align: center;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: white;
		border: 1px solid rgba(15, 118, 110, 0.12);
		border-radius: 0.75rem;
		padding: 0.7rem 0.9rem;
	}
	li.incomplete {
		border-style: dashed;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.when {
		font-weight: 600;
		color: var(--ink, #134e4a);
		font-size: 0.9rem;
	}
	.detail {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted, #5f7f7a);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
	.badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
	}
	.badge.done {
		background: rgba(15, 118, 110, 0.15);
		color: #0f766e;
	}
	.badge.partial {
		background: rgba(202, 138, 4, 0.15);
		color: #a16207;
	}
	.delete {
		border: none;
		background: transparent;
		color: var(--muted, #5f7f7a);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: 0.5rem;
		line-height: 1;
	}
	.delete:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #b91c1c;
	}
</style>
