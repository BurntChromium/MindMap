import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';

// GET /api/nodes?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');

  const nodes = db
    .prepare('SELECT * FROM nodes WHERE canvas_id = ?')
    .all(canvasId);

  return json(nodes);
}

// POST /api/nodes
export async function POST({ request }) {
  const { canvasId, title, x, y } = await request.json();

  const id = createId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO nodes (
      id, canvas_id, title, body, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    canvasId,
    title ?? 'New Node',
    '',
    x ?? 0,
    y ?? 0,
    0,
    timestamp,
    timestamp
  );

  return json({ id });
}

// PATCH /api/nodes
export async function PATCH({ request }) {
  const { id, title, body, x, y, collapsed } = await request.json();

  db.prepare(`
    UPDATE nodes
    SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      x = COALESCE(?, x),
      y = COALESCE(?, y),
      collapsed = COALESCE(?, collapsed),
      updated_at = ?
    WHERE id = ?
  `).run(title, body, x, y, collapsed, now(), id);

  return json({ success: true });
}

// DELETE /api/nodes?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM nodes WHERE id = ?`).run(id);

  return json({ success: true });
}