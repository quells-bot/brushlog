<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { base } from '$app/paths';
	import { registerServiceWorker } from '$lib/sw.js';

	let { children } = $props();

	// The PWA plugin is disabled in dev, so there is no sw.js to register there.
	onMount(() => {
		if (!dev) registerServiceWorker({ base });
	});
</script>

{@render children()}
