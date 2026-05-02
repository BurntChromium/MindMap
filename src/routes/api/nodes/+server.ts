import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { getNodeTitlesByCanvasId, getNodesByCanvasId } from '$lib/server/graphData';
import { replaceNodeTags } from '$lib/server/nodeTags';
import { rebuildEntitiesForCanvasId, replaceEntityReferences } from '$lib/server/entities';
import {
  hasNodeTitleConflict,
  normalizeNodeTitle,
  resolveUniqueNodeTitle
} from '$lib/nodeTitles';
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
  const existingTitles = getNodeTitlesByCanvasId(canvasId);
  const title = resolveUniqueNodeTitle(
    existingTitles,
    typeof payload?.title === 'string' ? payload.title : ''
  );
  const body = typeof payload?.body === 'string' ? payload.body : '';
  const tags = toTagList(payload?.tags);
  const x = toNumber(payload?.x);
  const y = toNumber(payload?.y);
  const collapsed = toNumber(payload?.collapsed);

  if (!canvasId) {
    return json({ success: false, error: 'Missing canvasId' }, { status: 400 });
  }

  const timestamp = now();

  const insertNode = db.prepare(`
    INSERT INTO nodes (
      id, canvas_id, title, body, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertNode.run(
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

    rebuildEntitiesForCanvasId(canvasId);
  });

  tx();

  return json({ success: true, id, title });
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

  if (typeof title === 'string' && !normalizeNodeTitle(title)) {
    return json({ success: false, error: 'Node title cannot be empty.' }, { status: 400 });
  }

  const node = db
    .prepare('SELECT id, canvas_id, title, body FROM nodes WHERE id = ?')
    .get(id) as { id: string; canvas_id: string; title: string; body: string | null } | undefined;

  if (!node) {
    return json({ success: false, error: 'Missing id' }, { status: 404 });
  }

  if (title && hasNodeTitleConflict(getNodeTitlesByCanvasId(node.canvas_id), title, id)) {
    return json(
      { success: false, error: `A node titled "${title.trim()}" already exists in this canvas.` },
      { status: 409 }
    );
  }

  const hasTitleChange = typeof title === 'string' && normalizeNodeTitle(title) !== normalizeNodeTitle(node.title);
  const titleRewriteSource = node.title;
  const titleRewriteTarget = typeof title === 'string' ? title : node.title;
  const rewrittenCurrentBody = replaceEntityReferences(body ?? node.body ?? '', titleRewriteSource, titleRewriteTarget);
  const nextBody = body !== undefined || hasTitleChange ? rewrittenCurrentBody : undefined;
  const rewrittenBodyUpdates = db
    .prepare(
      `
        SELECT id, body
        FROM nodes
        WHERE canvas_id = ?
      `
    )
    .all(node.canvas_id) as Array<{ id: string; body: string | null }>;
  const bodyUpdates = rewrittenBodyUpdates
    .map((entry) => {
      const originalBody = entry.body ?? '';
      const nextEntryBody =
        entry.id === id
          ? rewrittenCurrentBody
          : hasTitleChange
            ? replaceEntityReferences(originalBody, titleRewriteSource, titleRewriteTarget)
            : originalBody;

      return nextEntryBody !== originalBody ? { id: entry.id, body: nextEntryBody } : null;
    })
    .filter((entry): entry is { id: string; body: string } => Boolean(entry));

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
    for (const entry of bodyUpdates) {
      db.prepare(
        `
          UPDATE nodes
          SET body = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(entry.body, now(), entry.id);
    }

    updateNode.run(title, nextBody, x, y, collapsed, now(), id);

    if (hasTags) {
      replaceNodeTags(id, tags);
    }

    rebuildEntitiesForCanvasId(node.canvas_id);
  });

  tx();

  return json({ success: true, id });
}

// DELETE /api/nodes?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');
  const node = id
    ? (db.prepare('SELECT id, canvas_id FROM nodes WHERE id = ?').get(id) as
        | { id: string; canvas_id: string }
        | undefined)
    : undefined;

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM nodes WHERE id = ?`).run(id);

    rebuildEntitiesForCanvasId(node?.canvas_id ?? null);
  });

  tx();

  return json({ success: true });
}
