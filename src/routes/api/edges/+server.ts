import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/utils';

// GET /api/edges?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');

  const edges = db
    .prepare('SELECT * FROM edges WHERE canvas_id = ?')
    .all(canvasId);

  return json(edges);
}

// POST /api/edges
export async function POST({ request }) {
  const { canvasId, source, target } = await request.json();

  const id = `e-${source}-${target}`;

  db.prepare(`
    INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
    VALUES (?, ?, ?, ?)
  `).run(id, canvasId, source, target);

  return json({ id });
}

// DELETE /api/edges?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM edges WHERE id = ?`).run(id);

  return json({ success: true });
}
