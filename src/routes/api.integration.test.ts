import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-tests-'));
const dbPath = join(tempDir, 'test.db');

vi.stubEnv('MINDMAP_DB_PATH', dbPath);

let canvasesApi: typeof import('./api/canvases/+server');
let nodesApi: typeof import('./api/nodes/+server');
let bulkTagsApi: typeof import('./api/nodes/bulk-tags/+server');
let graphFragmentsApi: typeof import('./api/graph-fragments/+server');
let edgesApi: typeof import('./api/edges/+server');
let searchApi: typeof import('./api/search/+server');
let db: any;

beforeAll(async () => {
  const schema = await import('$lib/server/schema');
  schema.initSchema();

  canvasesApi = await import('./api/canvases/+server');
  nodesApi = await import('./api/nodes/+server');
  bulkTagsApi = await import('./api/nodes/bulk-tags/+server');
  graphFragmentsApi = await import('./api/graph-fragments/+server');
  edgesApi = await import('./api/edges/+server');
  searchApi = await import('./api/search/+server');
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
      request: request({ id: 'canvas-1', name: 'World' })
    } as any);
    const createdJson = await created.json();

    const listed = await canvasesApi.GET();
    const canvases = await listed.json();

    expect(createdJson.id).toBe('canvas-1');
    expect(createdJson.name).toBe('World');
    expect(canvases).toHaveLength(1);
    expect(canvases[0].id).toBe('canvas-1');
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
      request: request({ id: 'canvas-1', name: 'Campaign' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const createdNode = await nodesApi.POST({
      request: request({ id: 'node-1', canvasId, x: 10, y: 20 })
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
      id: 'node-1',
      title: 'NPC',
      body: 'The guide in town.',
      tags: ['lore', 'npc']
    });

    const tagRows = db.prepare('SELECT name FROM tags ORDER BY name').all();
    const nodeTagRows = db.prepare('SELECT node_id, tag_id FROM node_tags').all();

    expect(tagRows.map((row: { name: string }) => row.name)).toEqual(['lore', 'npc']);
    expect(nodeTagRows).toHaveLength(2);

    const tagColors = db.prepare('SELECT name, color FROM tags ORDER BY name').all();

    expect(tagColors).toEqual([
      expect.objectContaining({ name: 'lore', color: expect.stringMatching(/^#[0-9a-f]{6}$/i) }),
      expect.objectContaining({ name: 'npc', color: expect.stringMatching(/^#[0-9a-f]{6}$/i) })
    ]);
  });

  it('bulk-updates tags transactionally across selected nodes', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ id: 'canvas-1', name: 'Bulk Tags' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const firstNode = await nodesApi.POST({
      request: request({ id: 'node-1', canvasId, x: 0, y: 0 })
    } as any);
    const secondNode = await nodesApi.POST({
      request: request({ id: 'node-2', canvasId, x: 120, y: 120 })
    } as any);

    const { id: firstNodeId } = await firstNode.json();
    const { id: secondNodeId } = await secondNode.json();

    await nodesApi.PATCH({
      request: request({
        id: firstNodeId,
        title: 'Alpha',
        tags: ['lore']
      })
    } as any);

    await nodesApi.PATCH({
      request: request({
        id: secondNodeId,
        title: 'Beta',
        tags: ['npc']
      })
    } as any);

    await bulkTagsApi.POST({
      request: request({
        nodes: [
          { id: firstNodeId, tags: ['lore', 'npc'] },
          { id: secondNodeId, tags: ['npc'] }
        ]
      })
    } as any);

    const listed = await nodesApi.GET({
      url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`)
    } as any);
    const nodes = await listed.json();

    expect(nodes).toEqual([
      expect.objectContaining({
        id: firstNodeId,
        tags: ['lore', 'npc']
      }),
      expect.objectContaining({
        id: secondNodeId,
        tags: ['npc']
      })
    ]);

    const tagRows = db.prepare('SELECT name FROM tags ORDER BY name').all();
    expect(tagRows.map((row: { name: string }) => row.name)).toEqual(['lore', 'npc']);
  });

  it('pastes copied graph fragments transactionally', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ id: 'canvas-1', name: 'Clipboard' })
    } as any);
    const { id: canvasId } = await canvas.json();

    await graphFragmentsApi.POST({
      request: request({
        action: 'paste',
        canvasId,
        nodes: [
          {
            id: 'copy-node-1',
            title: 'Alpha',
            body: 'Body',
            tags: ['lore', 'lore'],
            x: 10,
            y: 20,
            collapsed: 0
          },
          {
            id: 'copy-node-2',
            title: 'Beta',
            body: '',
            tags: ['npc'],
            x: 100,
            y: 120,
            collapsed: 1
          }
        ],
        edges: [
          {
            id: 'copy-edge-1',
            source_node_id: 'copy-node-1',
            target_node_id: 'copy-node-2'
          }
        ]
      })
    } as any);

    const listed = await nodesApi.GET({
      url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`)
    } as any);
    const nodes = await listed.json();

    const edgesListed = await edgesApi.GET({
      url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`)
    } as any);
    const edges = await edgesListed.json();

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: 'copy-node-1',
      title: 'Alpha',
      tags: ['lore']
    });
    expect(nodes[1]).toMatchObject({
      id: 'copy-node-2',
      title: 'Beta',
      tags: ['npc']
    });
    expect(edges).toEqual([
      expect.objectContaining({
        id: 'copy-edge-1',
        source_node_id: 'copy-node-1',
        target_node_id: 'copy-node-2'
      })
    ]);
  });

  it('deletes nodes and attached edges in one transaction', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ id: 'canvas-1', name: 'Delete Graph' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const firstNode = await nodesApi.POST({
      request: request({ id: 'node-1', canvasId, x: 0, y: 0 })
    } as any);
    const secondNode = await nodesApi.POST({
      request: request({ id: 'node-2', canvasId, x: 120, y: 120 })
    } as any);

    const { id: firstNodeId } = await firstNode.json();
    const { id: secondNodeId } = await secondNode.json();

    await edgesApi.POST({
      request: request({
        id: 'edge-1',
        canvasId,
        source: firstNodeId,
        target: secondNodeId
      })
    } as any);

    await graphFragmentsApi.POST({
      request: request({
        action: 'delete',
        nodeIds: [firstNodeId]
      })
    } as any);

    const listedNodes = await nodesApi.GET({
      url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`)
    } as any);
    const nodes = await listedNodes.json();

    const listedEdges = await edgesApi.GET({
      url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`)
    } as any);
    const edges = await listedEdges.json();

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(secondNodeId);
    expect(edges).toHaveLength(0);
  });

  it('searches nodes by keyword and tag', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ id: 'canvas-1', name: 'Searchable' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const firstNode = await nodesApi.POST({
      request: request({ id: 'node-1', canvasId, x: 0, y: 0 })
    } as any);
    const secondNode = await nodesApi.POST({
      request: request({ id: 'node-2', canvasId, x: 120, y: 120 })
    } as any);

    const { id: firstNodeId } = await firstNode.json();
    const { id: secondNodeId } = await secondNode.json();

    await nodesApi.PATCH({
      request: request({
        id: firstNodeId,
        title: 'Smaug',
        body: 'The dragon keeps the treasure.',
        tags: ['lore']
      })
    } as any);

    await nodesApi.PATCH({
      request: request({
        id: secondNodeId,
        title: 'Guide',
        body: 'A helpful NPC for the player.',
        tags: ['npc']
      })
    } as any);

    const keywordMatch = await searchApi.GET({
      url: new URL(`http://localhost/api/search?canvasId=${canvasId}&query=dragon`)
    } as any);
    const keywordNodes = await keywordMatch.json();

    expect(keywordNodes).toHaveLength(1);
    expect(keywordNodes[0]).toMatchObject({
      id: firstNodeId,
      title: 'Smaug'
    });

    const tagMatch = await searchApi.GET({
      url: new URL(`http://localhost/api/search?canvasId=${canvasId}&tag=npc`)
    } as any);
    const tagNodes = await tagMatch.json();

    expect(tagNodes).toHaveLength(1);
    expect(tagNodes[0]).toMatchObject({
      id: secondNodeId,
      title: 'Guide',
      tags: ['npc']
    });
  });

  it('creates and lists edges', async () => {
    const canvas = await canvasesApi.POST({
      request: request({ id: 'canvas-1', name: 'Connections' })
    } as any);
    const { id: canvasId } = await canvas.json();

    const sourceNode = await nodesApi.POST({
      request: request({ id: 'node-1', canvasId, x: 0, y: 0 })
    } as any);
    const targetNode = await nodesApi.POST({
      request: request({ id: 'node-2', canvasId, x: 100, y: 100 })
    } as any);

    const { id: source } = await sourceNode.json();
    const { id: target } = await targetNode.json();

    const edgeCreated = await edgesApi.POST({
      request: request({ id: 'e-node-1-node-2', canvasId, source, target })
    } as any);
    const { id: edgeId } = await edgeCreated.json();

    expect(edgeId).toBe('e-node-1-node-2');

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
