import { describe, expect, it } from 'vitest';
import { formatTagLabel, normalizeTagList, normalizeTagName } from './tagUtils';

describe('tagUtils', () => {
	it('normalizes tag names', () => {
		expect(normalizeTagName('  ##DnD Lore  ')).toBe('dnd lore');
	});

	it('dedupes and filters tag lists', () => {
		expect(normalizeTagList(['#Lore', ' lore ', 'NPC', '', 'npc'])).toEqual([
			'lore',
			'npc',
		]);
	});

	it('formats display labels with a leading hash', () => {
		expect(formatTagLabel('Lore')).toBe('#lore');
	});
});
