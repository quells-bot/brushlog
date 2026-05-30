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

	// Group zones by arch so 16 markers stay legible — one row per arch,
	// keeping each zone's original index for state lookup.
	const arches = [...new Set(ZONES.map((z) => z.arch))].map((arch) => ({
		arch,
		zones: ZONES.map((z, i) => ({ z, i })).filter(({ z }) => z.arch === arch)
	}));
</script>

<div class="zones">
	{#each arches as group (group.arch)}
		<div class="arch">
			<span class="arch-label">{group.arch}</span>
			<ol class="dots">
				{#each group.zones as { z, i } (z.id)}
					<li class="dot {state(i)}" title={z.label}>
						<span class="marker" aria-hidden="true"></span>
						<span class="sr-only">{group.arch} {z.label}</span>
					</li>
				{/each}
			</ol>
		</div>
	{/each}
</div>

<style>
	.zones {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.arch {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.arch-label {
		flex: 0 0 3rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted, #5f7f7a);
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.marker {
		display: block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: rgba(15, 118, 110, 0.2);
		transition: all 0.2s ease;
	}
	.dot.active .marker {
		background: var(--accent, #0f766e);
		box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.18);
		transform: scale(1.15);
	}
	.dot.complete .marker {
		background: var(--accent, #0f766e);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
