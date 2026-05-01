import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { normalizeTagList } from '$lib/tagUtils';

function parseTags(rawTags: unknown) {
  if (typeof rawTags !== 'string' || !rawTags) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? normalizeTagList(parsed) : [];
  } catch {
    return [];
  }
}

function getOrCreateTagId(name: string) {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
    | { id: string }
    | undefined;

  if (existing) {
    return existing.id;
  }

  const id = createId();
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, null);
  return id;
}

function replaceNodeTags(nodeId: string, tags: string[]) {
  const deleteNodeTags = db.prepare('DELETE FROM node_tags WHERE node_id = ?');
  const insertNodeTag = db.prepare(
    'INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)'
  );

  deleteNodeTags.run(nodeId);

  for (const tag of tags) {
    const tagId = getOrCreateTagId(tag);
    insertNodeTag.run(nodeId, tagId);
  }
}

// GET /api/nodes?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');

  const nodes = (db
    .prepare(`
      SELECT
        n.*,
        COALESCE((
          SELECT json_group_array(tag_name)
          FROM (
            SELECT t.name AS tag_name
            FROM node_tags nt
            JOIN tags t ON t.id = nt.tag_id
            WHERE nt.node_id = n.id
            ORDER BY nt.rowid
          )
        ), '[]') AS tags
      FROM nodes n
      WHERE n.canvas_id = ?
      ORDER BY n.created_at ASC
    `)
    .all(canvasId) as Array<Record<string, unknown> & { tags?: unknown }>)
    .map((node) => ({
      ...node,
      tags: parseTags(node.tags)
    }));

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
