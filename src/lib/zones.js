/**
 * The brushing routine, broken into zones. The classic dentist
 * recommendation is two minutes split evenly across the four quadrants of
 * the mouth (30 seconds each).
 *
 * @typedef {{ id: string, label: string, hint: string, seconds: number }} Zone
 */

/** @type {Zone[]} */
export const ZONES = [
	{ id: 'upper-right', label: 'Upper Right', hint: 'Outer, inner & chewing surfaces', seconds: 30 },
	{ id: 'upper-left', label: 'Upper Left', hint: 'Outer, inner & chewing surfaces', seconds: 30 },
	{ id: 'lower-left', label: 'Lower Left', hint: 'Outer, inner & chewing surfaces', seconds: 30 },
	{ id: 'lower-right', label: 'Lower Right', hint: 'Outer, inner & chewing surfaces', seconds: 30 }
];

/** Total target duration of a full routine, in seconds. */
export const TOTAL_SECONDS = ZONES.reduce((sum, z) => sum + z.seconds, 0);
