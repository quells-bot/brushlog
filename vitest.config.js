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
