/**
 * Format a number of seconds as `m:ss`.
 * @param {number} totalSeconds
 */
export function formatDuration(totalSeconds) {
	const s = Math.max(0, Math.round(totalSeconds));
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return `${m}:${rem.toString().padStart(2, '0')}`;
}

/**
 * Format an epoch-ms timestamp as a friendly date + time.
 * @param {number} epochMs
 */
export function formatDateTime(epochMs) {
	return new Date(epochMs).toLocaleString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}
