import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { getNodesByCanvasId } from '$lib/server/graphData';
import { replaceNodeTags } from '$lib/server/nodeTags';
import { isString, toNumber, toTagList } from '$lib/mutationPayloads';

// GET /api/nodes?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');
  return json(getNodesByCanvasId(canvasId));
}

// POST /api/nodes
export async function POST({ request }) {
  const payload = await request.json();
  const providedId = isString(payload?.id) ? payload.id : '';
  const canvasId = isString(payload?.canvasId) ? payload.canvasId : '';
  const id = providedId || createId();
  const title = typeof payload?.title === 'string' ? payload.title : 'New Node';
  const body = typeof payload?.body === 'string' ? payload.body : '';
  const tags = toTagList(payload?.tags);
  const x = toNumber(payload?.x);
  const y = toNumber(payload?.y);
  const collapsed = toNumber(payload?.collapsed);

  if (!canvasId) {
    return json({ success: false, error: 'Missing canvasId' }, { status: 400 });
  }

  const timestamp = now();

  db.prepare(`
    INSERT INTO nodes (
      id, canvas_id, title, body, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    canvasId,
    title,
    body,
    x,
    y,
    collapsed,
    timestamp,
    timestamp
  );

  if (tags.length > 0) {
    replaceNodeTags(id, tags);
  }

  return json({ success: true, id });
}

// PATCH /api/nodes
export async function PATCH({ request }) {
  const payload = await request.json();
  const id = isString(payload?.id) ? payload.id : '';
  const title = typeof payload?.title === 'string' ? payload.title : undefined;
  const body = typeof payload?.body === 'string' ? payload.body : undefined;
  const x = typeof payload?.x === 'number' ? payload.x : undefined;
  const y = typeof payload?.y === 'number' ? payload.y : undefined;
  const collapsed = typeof payload?.collapsed === 'number' ? payload.collapsed : undefined;
  const hasTags = Object.prototype.hasOwnProperty.call(payload, 'tags');
  const tags = hasTags ? toTagList(payload?.tags) : [];

  if (!id) {
    return json({ success: false, error: 'Missing id' }, { status: 400 });
  }

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

  return json({ success: true, id });
}

// DELETE /api/nodes?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM nodes WHERE id = ?`).run(id);

  return json({ success: true });
}
