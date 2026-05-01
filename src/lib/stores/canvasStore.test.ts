import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasStore } from './canvasStore';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function snapshot() {
  let current: any;
  const unsubscribe = canvasStore.subscribe((value) => {
    current = value;
  });
  unsubscribe();
  return current;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
  await canvasStore.load();
  vi.unstubAllGlobals();
});

describe('canvasStore', () => {
  it('loads canvases from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'canvas-1',
          name: 'World',
          created_at: 1,
          updated_at: 2
        }
      ])
    );

    await canvasStore.load();

    expect(snapshot()).toMatchObject({
      canvases: [
        {
          id: 'canvas-1',
          name: 'World'
        }
      ],
      activeCanvasId: 'canvas-1'
    });
  });

  it('optimistically renames a canvas and sends the patch payload', async () => {
    canvasStore.hydrate(
      [
        {
          id: 'canvas-1',
          name: 'Old Name',
          created_at: 1,
          updated_at: 2
        }
      ],
      'canvas-1'
    );

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true }));

    await canvasStore.rename('canvas-1', '  New Name  ');

    expect(snapshot()).toMatchObject({
      canvases: [
        {
          id: 'canvas-1',
          name: 'New Name'
        }
      ],
      activeCanvasId: 'canvas-1'
    });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/canvases',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ id: 'canvas-1', name: 'New Name' })
      })
    );
  });
});
