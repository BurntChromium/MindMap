import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/utils';
import { getEdgesByCanvasId } from '$lib/server/graphData';
import { isString } from '$lib/mutationPayloads';

// GET /api/edges?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');
  return json(getEdgesByCanvasId(canvasId));
}

// POST /api/edges
export async function POST({ request }) {
  const payload = await request.json();
  const providedId = isString(payload?.id) ? payload.id : '';
  const canvasId = isString(payload?.canvasId) ? payload.canvasId : '';
  const source = isString(payload?.source) ? payload.source : '';
  const target = isString(payload?.target) ? payload.target : '';
  const id = providedId || `e-${source}-${target}`;

  if (!canvasId || !source || !target) {
    return json({ success: false, error: 'Missing edge endpoints' }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
    VALUES (?, ?, ?, ?)
  `).run(id, canvasId, source, target);

  return json({ success: true, id });
}

// DELETE /api/edges?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM edges WHERE id = ?`).run(id);

  return json({ success: true });
}
