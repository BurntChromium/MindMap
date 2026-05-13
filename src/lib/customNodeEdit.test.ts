import { describe, expect, it } from 'vitest';
import { getNextEditField, parsePastedTags } from './customNodeEdit';

describe('customNodeEdit', () => {
	it('cycles through the expected edit fields', () => {
		expect(getNextEditField('title', true)).toBe('tag');
		expect(getNextEditField('title', false)).toBe('body');
		expect(getNextEditField('tag', true)).toBe('body');
		expect(getNextEditField('body', true)).toBe('title');
	});

	it('normalizes pasted tags', () => {
		expect(parsePastedTags(' NPC,  Lore\n#Guide ')).toEqual([
			'npc',
			'lore',
			'guide',
		]);
	});
});
