import { describe, expect, it } from 'vitest';
import { buildEntityInspectorEntries } from './entityInspector';

describe('entity inspector', () => {
  it('groups a primary node with child referents', () => {
    const entries = buildEntityInspectorEntries(
      [
        {
          id: 'entity-smaug',
          canvas_id: 'canvas-1',
          title: 'Smaug',
          title_key: 'smaug',
          primary_node_id: 'node-smaug',
          mention_count: 3,
          created_at: 1,
          updated_at: 1
        }
      ],
      [
        {
          id: 'mention-1',
          canvas_id: 'canvas-1',
          entity_id: 'entity-smaug',
          node_id: 'node-note',
          reference_text: '[[Smaug]]',
          title: 'Smaug',
          title_key: 'smaug',
          start_index: 0,
          end_index: 9,
          created_at: 1,
          updated_at: 1
        },
        {
          id: 'mention-2',
          canvas_id: 'canvas-1',
          entity_id: 'entity-smaug',
          node_id: 'node-guide',
          reference_text: '[[Smaug]]',
          title: 'Smaug',
          title_key: 'smaug',
          start_index: 4,
          end_index: 13,
          created_at: 1,
          updated_at: 1
        },
        {
          id: 'mention-3',
          canvas_id: 'canvas-1',
          entity_id: 'entity-smaug',
          node_id: 'node-note',
          reference_text: '[[Smaug]]',
          title: 'Smaug',
          title_key: 'smaug',
          start_index: 18,
          end_index: 27,
          created_at: 1,
          updated_at: 1
        }
      ],
      [
        { id: 'node-smaug', title: 'Smaug', body: '', tags: [] },
        { id: 'node-guide', title: 'Guide', body: '', tags: [] },
        { id: 'node-note', title: 'Note', body: '', tags: [] }
      ]
    );

    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'entity-smaug',
        title: 'Smaug',
        mentionCount: 3,
        sourceNodeCount: 2,
        primaryNode: expect.objectContaining({
          id: 'node-smaug',
          title: 'Smaug',
          isPrimary: true,
          mentionCount: 0
        })
      })
    );

    expect(entries[0].childNodes.map((node) => node.id)).toEqual(['node-guide', 'node-note']);
    expect(entries[0].flatNodes).toEqual([]);
  });

  it('falls back to a flat list when no primary node exists', () => {
    const entries = buildEntityInspectorEntries(
      [
        {
          id: 'entity-bilbo',
          canvas_id: 'canvas-1',
          title: 'Bilbo',
          title_key: 'bilbo',
          primary_node_id: null,
          mention_count: 2,
          created_at: 1,
          updated_at: 1
        }
      ],
      [
        {
          id: 'mention-1',
          canvas_id: 'canvas-1',
          entity_id: 'entity-bilbo',
          node_id: 'node-note',
          reference_text: '[[Bilbo]]',
          title: 'Bilbo',
          title_key: 'bilbo',
          start_index: 0,
          end_index: 9,
          created_at: 1,
          updated_at: 1
        },
        {
          id: 'mention-2',
          canvas_id: 'canvas-1',
          entity_id: 'entity-bilbo',
          node_id: 'node-guide',
          reference_text: '[[Bilbo]]',
          title: 'Bilbo',
          title_key: 'bilbo',
          start_index: 17,
          end_index: 26,
          created_at: 1,
          updated_at: 1
        }
      ],
      [
        { id: 'node-guide', title: 'Guide', body: '', tags: [] },
        { id: 'node-note', title: 'Note', body: '', tags: [] }
      ]
    );

    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'entity-bilbo',
        primaryNode: null,
        sourceNodeCount: 2
      })
    );
    expect(entries[0].flatNodes.map((node) => node.id)).toEqual(['node-guide', 'node-note']);
    expect(entries[0].childNodes).toEqual([]);
  });
});
