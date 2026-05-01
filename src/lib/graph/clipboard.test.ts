import { describe, expect, it } from 'vitest';
import { buildClipboardFragment, buildPastedGraph, getConnectedEdgeIds } from './clipboard';

describe('clipboard graph helpers', () => {
  it('captures only selected nodes and internal edges', () => {
    const fragment = buildClipboardFragment(
      [
        { id: 'node-1', canvas_id: 'canvas-1', title: 'A', body: 'Body A', tags: ['lore'], x: 10, y: 20, collapsed: 0 },
        { id: 'node-2', canvas_id: 'canvas-1', title: 'B', body: 'Body B', tags: ['npc'], x: 30, y: 40, collapsed: 1 },
        { id: 'node-3', canvas_id: 'canvas-1', title: 'C', body: 'Body C', tags: [], x: 50, y: 60, collapsed: 0 }
      ],
      [
        { id: 'edge-1', canvas_id: 'canvas-1', source_node_id: 'node-1', target_node_id: 'node-2' },
        { id: 'edge-2', canvas_id: 'canvas-1', source_node_id: 'node-2', target_node_id: 'node-3' }
      ],
      ['node-1', 'node-2'],
      'canvas-1'
    );

    expect(fragment).toEqual({
      version: 1,
      sourceCanvasId: 'canvas-1',
      nodes: [
        {
          id: 'node-1',
          title: 'A',
          body: 'Body A',
          tags: ['lore'],
          x: 10,
          y: 20,
          collapsed: 0
        },
        {
          id: 'node-2',
          title: 'B',
          body: 'Body B',
          tags: ['npc'],
          x: 30,
          y: 40,
          collapsed: 1
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-1',
          target_node_id: 'node-2'
        }
      ]
    });
  });

  it('creates remapped paste payloads with incremental offsets', () => {
    const fragment = {
      version: 1 as const,
      sourceCanvasId: 'canvas-1',
      nodes: [
        {
          id: 'node-1',
          title: 'A',
          body: 'Body A',
          tags: ['lore'],
          x: 10,
          y: 20,
          collapsed: 0
        },
        {
          id: 'node-2',
          title: 'B',
          body: 'Body B',
          tags: ['npc'],
          x: 50,
          y: 70,
          collapsed: 1
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-1',
          target_node_id: 'node-2'
        }
      ]
    };

    const firstPaste = buildPastedGraph(
      fragment,
      'canvas-2',
      0,
      (() => {
        const ids = ['copy-node-a', 'copy-node-b'];
        let index = 0;
        return () => ids[index++] ?? 'copy-node-z';
      })(),
      (() => {
        const ids = ['copy-edge-a'];
        let index = 0;
        return () => ids[index++] ?? 'copy-edge-z';
      })()
    );
    const secondPaste = buildPastedGraph(
      fragment,
      'canvas-2',
      1,
      (() => {
        const ids = ['copy-node-c', 'copy-node-d'];
        let index = 0;
        return () => ids[index++] ?? 'copy-node-z';
      })(),
      (() => {
        const ids = ['copy-edge-b'];
        let index = 0;
        return () => ids[index++] ?? 'copy-edge-z';
      })()
    );

    expect(firstPaste.nodes).toEqual([
      expect.objectContaining({
        id: 'copy-node-a',
        canvas_id: 'canvas-2',
        title: 'A',
        body: 'Body A',
        tags: ['lore'],
        x: 58,
        y: 68,
        collapsed: 0
      }),
      expect.objectContaining({
        id: 'copy-node-b',
        canvas_id: 'canvas-2',
        x: 98,
        y: 118
      })
    ]);

    expect(firstPaste.edges).toEqual([
      expect.objectContaining({
        id: 'copy-edge-a',
        canvas_id: 'canvas-2',
        source_node_id: 'copy-node-a',
        target_node_id: 'copy-node-b'
      })
    ]);

    expect(secondPaste.nodes[0]).toMatchObject({
      id: 'copy-node-c',
      x: 82,
      y: 92
    });
  });

  it('lists connected edge ids for cut operations', () => {
    expect(
      getConnectedEdgeIds(
        [
          { id: 'edge-1', canvas_id: 'canvas-1', source_node_id: 'node-1', target_node_id: 'node-2' },
          { id: 'edge-2', canvas_id: 'canvas-1', source_node_id: 'node-2', target_node_id: 'node-3' },
          { id: 'edge-3', canvas_id: 'canvas-1', source_node_id: 'node-4', target_node_id: 'node-5' }
        ],
        ['node-1', 'node-2']
      )
    ).toEqual(['edge-1', 'edge-2']);
  });
});
