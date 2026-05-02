import { describe, expect, it } from 'vitest';
import {
  buildBulkTagsBody,
  buildNodeCreateBody,
  toNumberOrNull
} from './mutationPayloads';

describe('mutationPayloads', () => {
  it('normalizes numeric and tag payloads', () => {
    expect(toNumberOrNull(12)).toBe(12);
    expect(toNumberOrNull('12')).toBeNull();

    expect(
      buildNodeCreateBody({
        id: 'node-1',
        canvasId: 'canvas-1',
        x: 10,
        y: 20,
        tags: ['#Lore', 'npc']
      })
    ).toMatchObject({
      id: 'node-1',
      canvasId: 'canvas-1',
      x: 10,
      y: 20,
      tags: ['lore', 'npc']
    });

    expect(
      buildBulkTagsBody([
        {
          id: 'node-1',
          tags: ['  Lore ', 'npc', 'npc']
        }
      ])
    ).toMatchObject({
      nodes: [
        {
          id: 'node-1',
          tags: ['lore', 'npc']
        }
      ]
    });
  });
});

