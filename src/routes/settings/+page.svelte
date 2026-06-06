<script>
	import { resolve } from '$app/paths';
	import { exportData, importBackup } from '$lib/db.js';
	import { parseBackup } from '$lib/backup.js';
	import { dayKey } from '$lib/history.js';

	/** @type {HTMLInputElement} */
	let fileInput;
	let busy = $state(false);
	/** @type {{ kind: 'ok' | 'error', text: string } | null} */
	let status = $state(null);

	async function handleExport() {
		busy = true;
		status = null;
		try {
			const backup = await exportData();
			const json = JSON.stringify(backup, null, '\t');
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `brushlog-backup-${dayKey(Date.now())}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			const total = backup.sessions.length + backup.summaries.length;
			status = { kind: 'ok', text: `Exported ${total} record${total === 1 ? '' : 's'}.` };
		} catch (err) {
			status = { kind: 'error', text: 'Could not export your history.' };
			console.error(err);
		} finally {
			busy = false;
		}
	}

	async function handleFile(/** @type {Event} */ event) {
		const input = /** @type {HTMLInputElement} */ (event.target);
		const file = input.files?.[0];
		// Allow re-importing the same file by clearing the selection.
		input.value = '';
		if (!file) return;

		busy = true;
		status = null;
		try {
			const text = await file.text();
			const backup = parseBackup(text);
			const { addedSessions, addedSummaries } = await importBackup(backup);
			const added = addedSessions + addedSummaries;
			status = {
				kind: 'ok',
				text:
					added === 0
						? 'Already up to date — nothing new to import.'
						: `Imported ${addedSessions} session${addedSessions === 1 ? '' : 's'}` +
							(addedSummaries
								? ` and ${addedSummaries} day${addedSummaries === 1 ? '' : 's'}`
								: '') +
							'.'
			};
		} catch (err) {
			status = {
				kind: 'error',
				text: err instanceof Error ? err.message : 'Could not read that file.'
			};
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Settings · BrushLog</title>
</svelte:head>

<main>
	<header>
		<a class="back" href={resolve('/')}>← BrushLog</a>
	</header>

	<section class="card">
		<h2>Backup &amp; restore</h2>
		<p class="lead">
			Your brushing history is stored only on this device. Export it to a file you can keep, then
			import it after reinstalling to recover your streak.
		</p>

		<div class="controls">
			<button class="primary" onclick={handleExport} disabled={busy}>Export history</button>
			<button class="secondary" onclick={() => fileInput.click()} disabled={busy}>
				Import history
			</button>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			onchange={handleFile}
			hidden
		/>

		{#if status}
			<p class="status" class:error={status.kind === 'error'} role="status">{status.text}</p>
		{/if}

		<p class="note">Importing merges the file with what's already here and skips duplicates.</p>
	</section>
</main>

<style>
	main {
		max-width: 480px;
		margin: 0 auto;
		padding: 1.25rem 1.25rem 3rem;
		padding-top: calc(1.25rem + env(safe-area-inset-top));
	}
	header {
		margin-bottom: 1.25rem;
	}
	.back {
		color: var(--accent, #0f766e);
		text-decoration: none;
		font-weight: 600;
	}
	.card {
		background: white;
		border-radius: 1.5rem;
		padding: 1.75rem 1.25rem;
		box-shadow: 0 10px 30px rgba(15, 118, 110, 0.08);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	h2 {
		font-size: 1.2rem;
		margin: 0;
		color: var(--ink, #134e4a);
	}
	.lead {
		margin: 0;
		color: var(--muted, #5f7f7a);
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
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
	button:disabled {
		opacity: 0.5;
		cursor: default;
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
		flex: 1 1 auto;
		min-width: 10rem;
	}
	.status {
		margin: 0;
		font-size: 0.9rem;
		color: var(--accent, #0f766e);
	}
	.status.error {
		color: #b91c1c;
	}
	.note {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted, #5f7f7a);
	}
</style>
