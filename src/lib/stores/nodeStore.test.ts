import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeStore } from './nodeStore';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function snapshot() {
  let current: Map<string, any> = new Map();
  const unsubscribe = nodeStore.subscribe((value) => {
    current = value.nodes;
  });
  unsubscribe();
  return current;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
  await nodeStore.load('reset');
  vi.unstubAllGlobals();
});

describe('nodeStore', () => {
  it('loads nodes from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'node-1',
          canvas_id: 'canvas-1',
          title: 'Alpha',
          body: 'Body',
          tags: ['lore'],
          x: 10,
          y: 20,
          collapsed: 0
        }
      ])
    );

    await nodeStore.load('canvas-1');

    expect(snapshot().get('node-1')).toMatchObject({
      id: 'node-1',
      title: 'Alpha',
      body: 'Body',
      tags: ['lore']
    });
  });

  it('creates a node optimistically after POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'node-2' }));

    await nodeStore.create('canvas-1', 50, 75);

    expect(fetch).toHaveBeenCalledWith(
      '/api/nodes',
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(snapshot().get('node-2')).toMatchObject({
      id: 'node-2',
      canvas_id: 'canvas-1',
      title: 'New Node',
      tags: [],
      x: 50,
      y: 75
    });
  });

  it('optimistically updates a node and sends the same patch payload', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'node-3',
            canvas_id: 'canvas-1',
            title: 'Old',
            body: '',
            tags: [],
            x: 0,
            y: 0,
            collapsed: 0
          }
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await nodeStore.load('canvas-1');
    await nodeStore.updateNode({ id: 'node-3', title: 'New', tags: ['lore'] });

    expect(snapshot().get('node-3')).toMatchObject({
      title: 'New',
      tags: ['lore']
    });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/nodes',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ id: 'node-3', title: 'New', tags: ['lore'] })
      })
    );
  });
});
