import { describe, expect, it } from 'vitest';
import {
	formatEntitySummary,
	formatSharedEntitySummary,
	truncatePreviewText,
} from './panelDisplay';

describe('panelDisplay', () => {
	it('summarizes entity entries', () => {
		expect(
			formatEntitySummary({
				primaryNode: {},
				sourceNodeCount: 0,
				mentionCount: 3,
			}),
		).toBe('Canonical node');

		expect(
			formatEntitySummary({
				primaryNode: null,
				sourceNodeCount: 1,
				mentionCount: 2,
			}),
		).toBe('2 mentions across 1 node');
	});

	it('summarizes associative edge shared entity counts', () => {
		expect(formatSharedEntitySummary(1)).toBe('1 shared entity');
		expect(formatSharedEntitySummary(3)).toBe('3 shared entities');
	});

	it('truncates long preview text', () => {
		expect(truncatePreviewText('short')).toBe('short');
		expect(truncatePreviewText('a'.repeat(97))).toBe(`${'a'.repeat(96)}…`);
	});
});
