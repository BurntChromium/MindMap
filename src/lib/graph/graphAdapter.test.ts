import { describe, expect, it, vi } from 'vitest';
import { buildAssociativeFlowEdges } from './associativeEdges';

vi.mock('$lib/stores/nodeStore', () => ({
  nodeStore: {
    updateNode: vi.fn()
  }
}));

import { fromFlowPositionChange, toFlowEdges, toFlowNodes } from './graphAdapter';

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
          is_entity: 1,
          tags: ['lore'],
          x: 1,
          y: 2,
          collapsed: 0
        }
      ],
      {
        editingNodeId: '1',
        selectedNodeIds: ['1'],
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
        selected: true,
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

  it('builds associative flow edges with shared entity metadata', () => {
    const associativeEdges = buildAssociativeFlowEdges(
      [
        { id: 'node-a', title: 'A' },
        { id: 'node-b', title: 'B' },
        { id: 'node-c', title: 'C' }
      ],
      [
        {
          id: 'entity-smaug',
          title: 'Smaug',
          title_key: 'smaug',
          primary_node_id: 'node-a'
        },
        {
          id: 'entity-bilbo',
          title: 'Bilbo',
          title_key: 'bilbo',
          primary_node_id: 'node-b'
        }
      ],
      [
        { entity_id: 'entity-smaug', node_id: 'node-b' },
        { entity_id: 'entity-smaug', node_id: 'node-c' },
        { entity_id: 'entity-bilbo', node_id: 'node-a' }
      ]
    );

    expect(associativeEdges).toEqual([
      {
        id: 'assoc:node-a:node-b',
        source: 'node-a',
        target: 'node-b',
        type: 'smoothstep',
        selectable: false,
        deletable: false,
        focusable: false,
        zIndex: 0,
        style: 'stroke-dasharray: 6 5;',
        data: {
          kind: 'associative',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-b',
          sourceNodeTitle: 'A',
          targetNodeTitle: 'B',
          sharedEntities: [
            {
              id: 'entity-bilbo',
              title: 'Bilbo',
              titleKey: 'bilbo'
            },
            {
              id: 'entity-smaug',
              title: 'Smaug',
              titleKey: 'smaug'
            }
          ]
        }
      },
      {
        id: 'assoc:node-a:node-c',
        source: 'node-a',
        target: 'node-c',
        type: 'smoothstep',
        selectable: false,
        deletable: false,
        focusable: false,
        zIndex: 0,
        style: 'stroke-dasharray: 6 5;',
        data: {
          kind: 'associative',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-c',
          sourceNodeTitle: 'A',
          targetNodeTitle: 'C',
          sharedEntities: [
            {
              id: 'entity-smaug',
              title: 'Smaug',
              titleKey: 'smaug'
            }
          ]
        }
      },
      {
        id: 'assoc:node-b:node-c',
        source: 'node-b',
        target: 'node-c',
        type: 'smoothstep',
        selectable: false,
        deletable: false,
        focusable: false,
        zIndex: 0,
        style: 'stroke-dasharray: 6 5;',
        data: {
          kind: 'associative',
          sourceNodeId: 'node-b',
          targetNodeId: 'node-c',
          sourceNodeTitle: 'B',
          targetNodeTitle: 'C',
          sharedEntities: [
            {
              id: 'entity-smaug',
              title: 'Smaug',
              titleKey: 'smaug'
            }
          ]
        }
      }
    ]);
  });

  it('skips entities that do not connect more than one node', () => {
    const associativeEdges = buildAssociativeFlowEdges(
      [{ id: 'node-a', title: 'A' }],
      [
        {
          id: 'entity-smaug',
          title: 'Smaug',
          title_key: 'smaug',
          primary_node_id: 'node-a'
        }
      ],
      []
    );

    expect(associativeEdges).toEqual([]);
  });

  it('reuses unchanged flow nodes and edges across repeated projections', () => {
    const nodes = [
      {
        id: '1',
        canvas_id: 'canvas-1',
        title: 'First',
        body: 'Body',
        is_entity: 1,
        tags: ['lore'],
        x: 1,
        y: 2,
        collapsed: 0
      }
    ];
    const edges = [
      {
        id: 'edge-1',
        canvas_id: 'canvas-1',
        source_node_id: '1',
        target_node_id: '2'
      }
    ];
    const options = {
      editingNodeId: null,
      selectedNodeIds: [],
      activeTag: null,
      searchHitIds: new Set<string>(),
      tagColors: {},
      onTagClick: vi.fn()
    };

    const firstNodes = toFlowNodes(nodes, options);
    const secondNodes = toFlowNodes(nodes, options);
    const firstEdges = toFlowEdges(edges);
    const secondEdges = toFlowEdges(edges);

    expect(secondNodes[0]).toBe(firstNodes[0]);
    expect(secondEdges[0]).toBe(firstEdges[0]);
    expect(firstEdges[0]).toMatchObject({
      id: 'edge-1',
      source: '1',
      target: '2',
      zIndex: 1
    });
  });

  it('reuses associative flow edges across repeated projections', () => {
    const associativeEdges = buildAssociativeFlowEdges(
      [
        { id: 'node-a', title: 'A' },
        { id: 'node-b', title: 'B' }
      ],
      [
        {
          id: 'entity-smaug',
          title: 'Smaug',
          title_key: 'smaug',
          primary_node_id: 'node-a'
        }
      ],
      [{ entity_id: 'entity-smaug', node_id: 'node-b' }]
    );

    const firstEdges = toFlowEdges([], associativeEdges);
    const secondEdges = toFlowEdges([], associativeEdges);

    expect(secondEdges[0]).toBe(firstEdges[0]);
    expect(firstEdges[0]).toMatchObject({
      id: 'assoc:node-a:node-b',
      source: 'node-a',
      target: 'node-b',
      type: 'smoothstep',
      selectable: false,
      deletable: false,
      focusable: false
    });
  });
});
