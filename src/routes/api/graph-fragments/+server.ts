import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { replaceNodeTags } from '$lib/server/nodeTags';
import { isString, toNumber, toStringList, toTagList } from '$lib/mutationPayloads';

type PastedNode = {
  id?: unknown;
  canvas_id?: unknown;
  title?: unknown;
  body?: unknown;
  tags?: unknown;
  x?: unknown;
  y?: unknown;
  collapsed?: unknown;
};

type PastedEdge = {
  id?: unknown;
  canvas_id?: unknown;
  source_node_id?: unknown;
  target_node_id?: unknown;
};

type DeleteGraphPayload = {
  nodeIds?: unknown;
  edgeIds?: unknown;
};

// POST /api/graph-fragments
export async function POST({ request }) {
  const payload = await request.json();

  if (payload?.action === 'paste') {
    const canvasId = isString(payload.canvasId) ? payload.canvasId : '';
    const nodes = Array.isArray(payload.nodes) ? (payload.nodes as PastedNode[]) : [];
    const edges = Array.isArray(payload.edges) ? (payload.edges as PastedEdge[]) : [];

    if (!canvasId) {
      return json({ error: 'Missing canvasId' }, { status: 400 });
    }

    const normalizedNodes = nodes
      .map((node) => ({
        id: isString(node?.id) ? node.id : '',
        title: typeof node?.title === 'string' ? node.title : 'New Node',
        body: typeof node?.body === 'string' ? node.body : '',
        tags: toTagList(node?.tags),
        x: toNumber(node?.x),
        y: toNumber(node?.y),
        collapsed: toNumber(node?.collapsed)
      }))
      .filter((node) => node.id.length > 0);

    const nodeIds = new Set(normalizedNodes.map((node) => node.id));

    const normalizedEdges = edges
      .map((edge) => ({
        id: isString(edge?.id) ? edge.id : createId(),
        source_node_id: isString(edge?.source_node_id) ? edge.source_node_id : '',
        target_node_id: isString(edge?.target_node_id) ? edge.target_node_id : ''
      }))
      .filter(
        (edge) =>
          edge.id.length > 0 &&
          nodeIds.has(edge.source_node_id) &&
          nodeIds.has(edge.target_node_id)
      );

    const insertNode = db.prepare(`
      INSERT INTO nodes (
        id, canvas_id, title, body, x, y, collapsed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEdge = db.prepare(`
      INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
      VALUES (?, ?, ?, ?)
    `);
    const timestamp = now();

    const tx = db.transaction(() => {
      for (const [index, node] of normalizedNodes.entries()) {
        const nodeTimestamp = timestamp + index;
        insertNode.run(
          node.id,
          canvasId,
          node.title,
          node.body,
          node.x,
          node.y,
          node.collapsed,
          nodeTimestamp,
          nodeTimestamp
        );
        replaceNodeTags(node.id, node.tags);
      }

      for (const edge of normalizedEdges) {
        insertEdge.run(edge.id, canvasId, edge.source_node_id, edge.target_node_id);
      }
    });

    tx();

    return json({ success: true, insertedNodes: normalizedNodes.length, insertedEdges: normalizedEdges.length });
  }

  if (payload?.action === 'delete') {
    const nodeIds = Array.from(new Set(toStringList((payload as DeleteGraphPayload).nodeIds)));
    const edgeIds = Array.from(new Set(toStringList((payload as DeleteGraphPayload).edgeIds)));

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return json({ success: true });
    }

    const deleteEdges = db.prepare(
      'DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?'
    );
    const deleteExplicitEdge = db.prepare('DELETE FROM edges WHERE id = ?');
    const deleteNodes = db.prepare('DELETE FROM nodes WHERE id = ?');

    const tx = db.transaction(() => {
      for (const nodeId of nodeIds) {
        deleteEdges.run(nodeId, nodeId);
      }

      for (const edgeId of edgeIds) {
        deleteExplicitEdge.run(edgeId);
      }

      for (const nodeId of nodeIds) {
        deleteNodes.run(nodeId);
      }
    });

    tx();

    return json({ success: true, removedNodes: nodeIds.length, removedEdges: edgeIds.length });
  }

  return json({ error: 'Unsupported action' }, { status: 400 });
}
