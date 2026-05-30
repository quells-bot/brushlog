/**
 * The brushing routine, broken into fine-grained zones.
 *
 * Each zone is brushed for {@link ZONE_SECONDS} seconds. The routine walks
 * both arches; for each arch it covers the outer and inner surfaces in three
 * sections (right / front / left) and then the biting (chewing) surfaces of
 * the molars on each side. Front teeth have no biting surface, so biting is
 * only left + right per arch.
 *
 *   2 arches × (3 outer + 3 inner) + 2 arches × 2 biting = 16 zones
 *   16 zones × 10s = 160s = 2:40 total
 *
 * @typedef {'Upper' | 'Lower'} Arch
 * @typedef {'Outer' | 'Inner' | 'Biting'} Surface
 * @typedef {{ id: string, arch: Arch, surface: Surface, label: string, hint: string, seconds: number }} Zone
 */

/** How long each zone is brushed, in seconds. */
export const ZONE_SECONDS = 10;

/** @type {Omit<Zone, 'seconds'>[]} */
const layout = [
	// Upper arch — outer, then inner (sweeping back the other way), then biting.
	{ id: 'u-out-r', arch: 'Upper', surface: 'Outer', label: 'Outer right', hint: 'Cheek side of your upper right teeth' },
	{ id: 'u-out-f', arch: 'Upper', surface: 'Outer', label: 'Outer front', hint: 'Cheek side of your upper front teeth' },
	{ id: 'u-out-l', arch: 'Upper', surface: 'Outer', label: 'Outer left', hint: 'Cheek side of your upper left teeth' },
	{ id: 'u-in-l', arch: 'Upper', surface: 'Inner', label: 'Inner left', hint: 'Palate side of your upper left teeth' },
	{ id: 'u-in-f', arch: 'Upper', surface: 'Inner', label: 'Inner front', hint: 'Palate side of your upper front teeth' },
	{ id: 'u-in-r', arch: 'Upper', surface: 'Inner', label: 'Inner right', hint: 'Palate side of your upper right teeth' },
	{ id: 'u-bite-r', arch: 'Upper', surface: 'Biting', label: 'Biting right', hint: 'Chewing surfaces of your upper right molars' },
	{ id: 'u-bite-l', arch: 'Upper', surface: 'Biting', label: 'Biting left', hint: 'Chewing surfaces of your upper left molars' },

	// Lower arch — mirror the path so the brush flows naturally between arches.
	{ id: 'l-out-l', arch: 'Lower', surface: 'Outer', label: 'Outer left', hint: 'Cheek side of your lower left teeth' },
	{ id: 'l-out-f', arch: 'Lower', surface: 'Outer', label: 'Outer front', hint: 'Cheek side of your lower front teeth' },
	{ id: 'l-out-r', arch: 'Lower', surface: 'Outer', label: 'Outer right', hint: 'Cheek side of your lower right teeth' },
	{ id: 'l-in-r', arch: 'Lower', surface: 'Inner', label: 'Inner right', hint: 'Tongue side of your lower right teeth' },
	{ id: 'l-in-f', arch: 'Lower', surface: 'Inner', label: 'Inner front', hint: 'Tongue side of your lower front teeth' },
	{ id: 'l-in-l', arch: 'Lower', surface: 'Inner', label: 'Inner left', hint: 'Tongue side of your lower left teeth' },
	{ id: 'l-bite-l', arch: 'Lower', surface: 'Biting', label: 'Biting left', hint: 'Chewing surfaces of your lower left molars' },
	{ id: 'l-bite-r', arch: 'Lower', surface: 'Biting', label: 'Biting right', hint: 'Chewing surfaces of your lower right molars' }
];

/** @type {Zone[]} */
export const ZONES = layout.map((z) => ({ ...z, seconds: ZONE_SECONDS }));

/** Total target duration of a full routine, in seconds. */
export const TOTAL_SECONDS = ZONES.reduce((sum, z) => sum + z.seconds, 0);
