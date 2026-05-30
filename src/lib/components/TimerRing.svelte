<script>
	// A circular progress ring with centred text.
	let {
		/** 0–1 progress of the current zone. */
		progress = 0,
		/** Big centre text (e.g. countdown). */
		value = '',
		/** Small caption under the value. */
		caption = ''
	} = $props();

	const SIZE = 240;
	const STROKE = 16;
	const R = (SIZE - STROKE) / 2;
	const C = 2 * Math.PI * R;

	let offset = $derived(C * (1 - Math.min(1, Math.max(0, progress))));
</script>

<div class="ring" style="--size: {SIZE}px">
	<svg viewBox="0 0 {SIZE} {SIZE}" width={SIZE} height={SIZE} aria-hidden="true">
		<circle class="track" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke-width={STROKE} />
		<circle
			class="progress"
			cx={SIZE / 2}
			cy={SIZE / 2}
			r={R}
			fill="none"
			stroke-width={STROKE}
			stroke-linecap="round"
			stroke-dasharray={C}
			stroke-dashoffset={offset}
			transform="rotate(-90 {SIZE / 2} {SIZE / 2})"
		/>
	</svg>
	<div class="label">
		<span class="value">{value}</span>
		{#if caption}<span class="caption">{caption}</span>{/if}
	</div>
</div>

<style>
	.ring {
		position: relative;
		width: var(--size);
		height: var(--size);
		max-width: 80vw;
		max-height: 80vw;
		margin: 0 auto;
	}
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
	.track {
		stroke: rgba(15, 118, 110, 0.15);
	}
	.progress {
		stroke: var(--accent, #0f766e);
		transition: stroke-dashoffset 0.15s linear;
	}
	.label {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
	}
	.value {
		font-size: clamp(2.5rem, 12vw, 3.5rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--ink, #134e4a);
	}
	.caption {
		font-size: 0.95rem;
		color: var(--muted, #5f7f7a);
		text-align: center;
		max-width: 70%;
	}
</style>
