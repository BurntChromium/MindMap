import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/stores/nodeStore', () => ({
  nodeStore: {
    updateNode: vi.fn()
  }
}));

import { fromFlowPositionChange, toFlowNodes } from './graphAdapter';

describe('graphAdapter', () => {
  it('maps node positions from flow state', () => {
    expect(fromFlowPositionChange('a', { x: 12, y: 34 })).toEqual({
      id: 'a',
      x: 12,
      y: 34
    });
  });

  it('maps app nodes to flow nodes and locks the active editor node', () => {
    const onTagClick = vi.fn();
    const flowNodes = toFlowNodes(
      [
        {
          id: '1',
          canvas_id: 'canvas-1',
          title: 'First',
          body: 'Body',
          tags: ['lore'],
          x: 1,
          y: 2,
          collapsed: 0
        }
      ],
      {
        editingNodeId: '1',
        activeTag: null,
        searchHitIds: new Set<string>(),
        tagColors: {},
        onTagClick
      }
    );

    expect(flowNodes).toEqual([
      {
        id: '1',
        position: { x: 1, y: 2 },
        selected: false,
        data: {
          label: 'First',
          body: 'Body',
          tags: ['lore'],
          tagColors: {},
          activeTag: null,
          activeTagColor: null,
          onTagClick,
          isSearchHit: false,
          isFocused: false
        },
        type: 'custom',
        draggable: false
      }
    ]);
  });
});
