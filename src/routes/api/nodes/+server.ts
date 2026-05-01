import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { normalizeTagList } from '$lib/tagUtils';
import { getNodesByCanvasId } from '$lib/server/graphData';
import { replaceNodeTags } from '$lib/server/nodeTags';

// GET /api/nodes?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');
  return json(getNodesByCanvasId(canvasId));
}

// POST /api/nodes
export async function POST({ request }) {
  const { id: providedId, canvasId, title, x, y } = await request.json();

  const id = typeof providedId === 'string' && providedId ? providedId : createId();
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
  const payload = await request.json();
  const { id, title, body, x, y, collapsed } = payload;
  const hasTags = Object.prototype.hasOwnProperty.call(payload, 'tags');
  const tags = hasTags && Array.isArray(payload.tags) ? normalizeTagList(payload.tags) : [];

  const updateNode = db.prepare(`
    UPDATE nodes
    SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      x = COALESCE(?, x),
      y = COALESCE(?, y),
      collapsed = COALESCE(?, collapsed),
      updated_at = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    updateNode.run(title, body, x, y, collapsed, now(), id);

    if (hasTags) {
      replaceNodeTags(id, tags);
    }
  });

  tx();

  return json({ success: true });
}

// DELETE /api/nodes?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM nodes WHERE id = ?`).run(id);

  return json({ success: true });
}
