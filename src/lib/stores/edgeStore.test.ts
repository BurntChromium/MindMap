import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { edgeStore } from './edgeStore';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function snapshot() {
  let current: Map<string, any> = new Map();
  const unsubscribe = edgeStore.subscribe((value) => {
    current = value.edges;
  });
  unsubscribe();
  return current;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
  await edgeStore.load('reset');
  vi.unstubAllGlobals();
});

describe('edgeStore', () => {
  it('loads edges from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'edge-1',
          canvas_id: 'canvas-1',
          source_node_id: 'node-a',
          target_node_id: 'node-b'
        }
      ])
    );

    await edgeStore.load('canvas-1');

    expect(snapshot().get('edge-1')).toMatchObject({
      id: 'edge-1',
      source_node_id: 'node-a',
      target_node_id: 'node-b'
    });
  });

  it('optimistically creates an edge before POST completes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'e-node-a-node-b' }));

    await edgeStore.create('canvas-1', 'node-a', 'node-b');

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String((call[1] as RequestInit).body));

    expect(snapshot().get(body.id)).toMatchObject({
      id: body.id,
      canvas_id: 'canvas-1',
      source_node_id: 'node-a',
      target_node_id: 'node-b'
    });
    expect(body).toMatchObject({
      id: 'e-node-a-node-b',
      canvasId: 'canvas-1',
      source: 'node-a',
      target: 'node-b'
    });
  });
});
