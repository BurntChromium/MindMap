import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-tests-'));
const dbPath = join(tempDir, 'test.db');

vi.stubEnv('MINDMAP_DB_PATH', dbPath);

let canvasesApi: typeof import('./api/canvases/+server');
let nodesApi: typeof import('./api/nodes/+server');
let edgesApi: typeof import('./api/edges/+server');
let db: any;

beforeAll(async () => {
  const schema = await import('$lib/server/schema');
  schema.initSchema();

  canvasesApi = await import('./api/canvases/+server');
  nodesApi = await import('./api/nodes/+server');
  edgesApi = await import('./api/edges/+server');
  db = (await import('$lib/server/db')).db;
});

beforeEach(() => {
  if (!db) {
    return;
  }

  db.prepare('DELETE FROM node_tags').run();
  db.prepare('DELETE FROM edges').run();
  db.prepare('DELETE FROM nodes').run();
  db.prepare('DELETE FROM canvases').run();
  db.prepare('DELETE FROM tags').run();
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

function request(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('API integration', () => {
  it('creates canvases and lists them back', async () => {
    const created = await canvasesApi.POST({
      request: request({ name: 'World' })
    } as any);
    const createdJson = await created.json();

    const listed = await canvasesApi.GET();
    const canvases = await listed.json();

    expect(createdJson.name).toBe('World');
    expect(canvases).toHaveLength(1);
    expect(canvases[0].name).toBe('World');
  });

  it('renames canvases through patch', async () => {
    const created = await canvasesApi.POST({
      request: request({ name: 'Draft' })
    } as any);
    const { id: canvasId } = await created.json();

    await canvasesApi.PATCH({
      request: request({ id: canvasId, name: 'Final Draft' })
    } as any);

    const listed = await canvasesApi.GET();
    const canvases = await listed.json();

    expect(canvases[0]).toMatchObject({
      id: canvasId,
      name: 'Final Draft'
    });
  });

  it('persists node tags through patch and fetch', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ name: 'Campaign' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const createdNode = await nodesApi.POST({
      request: request({ canvasId, x: 10, y: 20 })
    } as any);
    const { id: nodeId } = await createdNode.json();

    await nodesApi.PATCH({
      request: request({
        id: nodeId,
        title: 'NPC',
        body: 'The guide in town.',
        tags: ['#lore', 'npc', 'npc']
      })
    } as any);

    const listed = await nodesApi.GET({
      url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`)
    } as any);
    const nodes = await listed.json();

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: nodeId,
      title: 'NPC',
      body: 'The guide in town.',
      tags: ['lore', 'npc']
    });

    const tagRows = db.prepare('SELECT name FROM tags ORDER BY name').all();
    const nodeTagRows = db.prepare('SELECT node_id, tag_id FROM node_tags').all();

    expect(tagRows.map((row: { name: string }) => row.name)).toEqual(['lore', 'npc']);
    expect(nodeTagRows).toHaveLength(2);
  });

  it('creates and lists edges', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ name: 'Connections' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const sourceNode = await nodesApi.POST({
      request: request({ canvasId, x: 0, y: 0 })
    } as any);
    const targetNode = await nodesApi.POST({
      request: request({ canvasId, x: 100, y: 100 })
    } as any);

    const { id: source } = await sourceNode.json();
    const { id: target } = await targetNode.json();

    const edgeCreated = await edgesApi.POST({
      request: request({ canvasId, source, target })
    } as any);
    const { id: edgeId } = await edgeCreated.json();

    const listed = await edgesApi.GET({
      url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`)
    } as any);
    const edges = await listed.json();

    expect(edges).toEqual([
      {
        id: edgeId,
        canvas_id: canvasId,
        source_node_id: source,
        target_node_id: target
      }
    ]);
  });
});
