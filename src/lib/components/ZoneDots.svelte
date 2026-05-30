<script>
	import { ZONES } from '$lib/zones.js';

	let {
		/** Index of the active zone. */
		activeIndex = 0,
		/** Seconds brushed per zone. */
		perZone = ZONES.map(() => 0),
		/** Whether the routine is finished. */
		done = false
	} = $props();

	/** @param {number} i */
	function state(i) {
		if (perZone[i] >= ZONES[i].seconds) return 'complete';
		if (i === activeIndex && !done) return 'active';
		return 'pending';
	}
</script>

<ol class="dots">
	{#each ZONES as zone, i (zone.id)}
		<li class="dot {state(i)}">
			<span class="marker" aria-hidden="true"></span>
			<span class="name">{zone.label}</span>
		</li>
	{/each}
</ol>

<style>
	.dots {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.dot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		color: var(--muted, #5f7f7a);
		text-align: center;
	}
	.marker {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: rgba(15, 118, 110, 0.2);
		transition: all 0.2s ease;
	}
	.dot.active .marker {
		background: var(--accent, #0f766e);
		box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.18);
	}
	.dot.active .name {
		color: var(--ink, #134e4a);
		font-weight: 600;
	}
	.dot.complete .marker {
		background: var(--accent, #0f766e);
	}
	.dot.complete .name {
		color: var(--ink, #134e4a);
	}
</style>
