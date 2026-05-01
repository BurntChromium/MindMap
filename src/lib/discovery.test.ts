import { describe, expect, it } from 'vitest';
import { collectTagSummaries, filterDiscoveryNodes } from './discovery';

describe('discovery helpers', () => {
  const nodes = [
    {
      id: '1',
      title: 'Smaug',
      body: 'Dragon in the mountain',
      tags: ['lore', 'npc']
    },
    {
      id: '2',
      title: 'Bilbo',
      body: 'Thief and traveler',
      tags: ['npc']
    }
  ];

  it('summarizes tags with counts and colors', () => {
    const tags = collectTagSummaries(nodes);

    expect(tags).toEqual([
      expect.objectContaining({ name: 'npc', count: 2, color: expect.stringMatching(/^#[0-9a-f]{6}$/i) }),
      expect.objectContaining({
        name: 'lore',
        count: 1,
        color: expect.stringMatching(/^#[0-9a-f]{6}$/i)
      })
    ]);
  });

  it('filters nodes by keyword and tag together', () => {
    expect(filterDiscoveryNodes(nodes, 'dragon', null).map((node) => node.id)).toEqual(['1']);
    expect(filterDiscoveryNodes(nodes, '', 'npc').map((node) => node.id)).toEqual(['1', '2']);
    expect(filterDiscoveryNodes(nodes, 'dragon', 'npc').map((node) => node.id)).toEqual(['1']);
    expect(filterDiscoveryNodes(nodes, '', null)).toEqual([]);
  });
});

