import { describe, expect, it } from 'vitest';
import { getTagColor } from './tagColors';

describe('tagColors', () => {
  it('keeps colors stable for the same tag', () => {
    expect(getTagColor('Lore')).toBe(getTagColor('lore'));
  });

  it('spreads common tags across visibly different pastel colors', () => {
    const tags = [
      'lore',
      'npc',
      'quest',
      'combat',
      'faction',
      'location',
      'item',
      'story'
    ];

    const colors = new Set(tags.map((tag) => getTagColor(tag)));

    expect(colors.size).toBeGreaterThanOrEqual(6);
  });
});

