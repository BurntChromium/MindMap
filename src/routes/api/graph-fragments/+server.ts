import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { getNodeTitlesByCanvasId } from '$lib/server/graphData';
import { replaceNodeTags } from '$lib/server/nodeTags';
import { rebuildEntitiesForCanvasId } from '$lib/server/entities';
import { createNodeTitleAllocator } from '$lib/nodeTitles';
import { isString, toNumber, toStringList, toTagList } from '$lib/mutationPayloads';

type PastedNode = {
  id?: unknown;
  canvas_id?: unknown;
  title?: unknown;
  body?: unknown;
  is_entity?: unknown;
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
        title: typeof node?.title === 'string' ? node.title : '',
        body: typeof node?.body === 'string' ? node.body : '',
        is_entity: typeof node?.is_entity === 'number' ? node.is_entity : 0,
        tags: toTagList(node?.tags),
        x: toNumber(node?.x),
        y: toNumber(node?.y),
        collapsed: toNumber(node?.collapsed)
      }))
      .filter((node) => node.id.length > 0);

    const titleAllocator = createNodeTitleAllocator(getNodeTitlesByCanvasId(canvasId));
    const resolvedNodes = normalizedNodes.map((node) => ({
      ...node,
      title: titleAllocator.nextCopyTitle(node.title)
    }));

    const nodeIds = new Set(resolvedNodes.map((node) => node.id));

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
        id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEdge = db.prepare(`
      INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
      VALUES (?, ?, ?, ?)
    `);
    const timestamp = now();

    const tx = db.transaction(() => {
      for (const [index, node] of resolvedNodes.entries()) {
        const nodeTimestamp = timestamp + index;
        insertNode.run(
          node.id,
          canvasId,
          node.title,
          node.body,
          node.is_entity,
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

      rebuildEntitiesForCanvasId(canvasId);
    });

    tx();

    return json({
      success: true,
      insertedNodes: resolvedNodes,
      insertedEdges: normalizedEdges.length
    });
  }

  if (payload?.action === 'delete') {
    const nodeIds = Array.from(new Set(toStringList((payload as DeleteGraphPayload).nodeIds)));
    const edgeIds = Array.from(new Set(toStringList((payload as DeleteGraphPayload).edgeIds)));

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return json({ success: true });
    }

    const affectedCanvasIds = nodeIds.length
      ? Array.from(
          new Set(
            (
              db.prepare(
                `
                  SELECT DISTINCT canvas_id
                  FROM nodes
                  WHERE id IN (${nodeIds.map(() => '?').join(',')})
                `
              ).all(...nodeIds) as Array<{ canvas_id: string | null }>
            )
              .map((row) => row.canvas_id)
              .filter((canvasId): canvasId is string => Boolean(canvasId))
          )
        )
      : [];

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

      for (const canvasId of affectedCanvasIds) {
        rebuildEntitiesForCanvasId(canvasId);
      }
    });

    tx();

    return json({ success: true, removedNodes: nodeIds.length, removedEdges: edgeIds.length });
  }

  return json({ error: 'Unsupported action' }, { status: 400 });
}
