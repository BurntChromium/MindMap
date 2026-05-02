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

  it('restores a cached canvas snapshot before the fetch resolves', async () => {
    nodeStore.hydrate(
      [
        {
          id: 'node-a',
          canvas_id: 'canvas-1',
          title: 'Cached',
          body: '',
          tags: ['lore'],
          x: 1,
          y: 2,
          collapsed: 0
        }
      ],
      'canvas-1'
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'node-b',
          canvas_id: 'canvas-2',
          title: 'Fresh',
          body: '',
          tags: [],
          x: 10,
          y: 20,
          collapsed: 0
        }
      ])
    );

    await nodeStore.load('canvas-2');

    let resolveFetch: (value: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const pending = nodeStore.load('canvas-1');

    expect(snapshot().get('node-a')).toMatchObject({
      id: 'node-a',
      title: 'Cached',
      tags: ['lore']
    });

    resolveFetch(
      jsonResponse([
        {
          id: 'node-a',
          canvas_id: 'canvas-1',
          title: 'Cached',
          body: '',
          tags: ['lore'],
          x: 1,
          y: 2,
          collapsed: 0
        }
      ])
    );

    await pending;
  });

  it('creates a node optimistically after POST', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'node-2' }));

    await nodeStore.create('canvas-1', 50, 75);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String((call[1] as RequestInit).body));

    expect(fetch).toHaveBeenCalledWith(
      '/api/nodes',
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(snapshot().get(body.id)).toMatchObject({
      id: body.id,
      canvas_id: 'canvas-1',
      title: 'Node 1',
      tags: [],
      x: 50,
      y: 75
    });
    expect(body).toMatchObject({
      id: expect.any(String),
      canvasId: 'canvas-1',
      title: 'Node 1',
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

  it('blocks duplicate titles before sending a patch request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'node-3',
          canvas_id: 'canvas-1',
          title: 'Alpha',
          body: '',
          tags: [],
          x: 0,
          y: 0,
          collapsed: 0
        },
        {
          id: 'node-4',
          canvas_id: 'canvas-1',
          title: 'Beta',
          body: '',
          tags: [],
          x: 0,
          y: 0,
          collapsed: 0
        }
      ])
    );

    await nodeStore.load('canvas-1');
    const success = await nodeStore.updateNode({ id: 'node-4', title: 'alpha' });

    expect(success).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(snapshot().get('node-4')).toMatchObject({
      title: 'Beta'
    });
  });

  it('bulk-updates node tags through the batch endpoint', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'node-4',
            canvas_id: 'canvas-1',
            title: 'Old',
            body: '',
            tags: ['lore'],
            x: 0,
            y: 0,
            collapsed: 0
          },
          {
            id: 'node-5',
            canvas_id: 'canvas-1',
            title: 'Other',
            body: '',
            tags: ['npc'],
            x: 10,
            y: 20,
            collapsed: 0
          }
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await nodeStore.load('canvas-1');
    await nodeStore.updateNodeTags([
      { id: 'node-4', tags: ['lore', 'npc'] },
      { id: 'node-5', tags: ['npc'] }
    ]);

    expect(snapshot().get('node-4')).toMatchObject({
      tags: ['lore', 'npc']
    });
    expect(snapshot().get('node-5')).toMatchObject({
      tags: ['npc']
    });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/nodes/bulk-tags',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          nodes: [
            { id: 'node-4', tags: ['lore', 'npc'] },
            { id: 'node-5', tags: ['npc'] }
          ]
        })
      })
    );
  });

  it('bulk-updates node positions through the batch endpoint', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'node-6',
            canvas_id: 'canvas-1',
            title: 'Mover',
            body: '',
            tags: [],
            x: 0,
            y: 0,
            collapsed: 0
          },
          {
            id: 'node-7',
            canvas_id: 'canvas-1',
            title: 'Other',
            body: '',
            tags: [],
            x: 10,
            y: 20,
            collapsed: 0
          }
        ])
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await nodeStore.load('canvas-1');
    await nodeStore.updateNodePositions([
      { id: 'node-6', x: 48, y: 64 },
      { id: 'node-7', x: 96, y: 128 }
    ]);

    expect(snapshot().get('node-6')).toMatchObject({
      x: 48,
      y: 64
    });
    expect(snapshot().get('node-7')).toMatchObject({
      x: 96,
      y: 128
    });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/nodes/bulk-position',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          nodes: [
            { id: 'node-6', x: 48, y: 64 },
            { id: 'node-7', x: 96, y: 128 }
          ]
        })
      })
    );
  });
});
