import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { normalizeTagList } from '$lib/tagUtils';
import { getTagColor } from '$lib/tagColors';

type BulkTagNodeInput = {
  id?: unknown;
  tags?: unknown;
};

function getOrCreateTagId(name: string) {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
    | { id: string; color: string | null }
    | undefined;

  if (existing) {
    if (!existing.color) {
      db.prepare('UPDATE tags SET color = ? WHERE id = ?').run(getTagColor(name), existing.id);
    }

    return existing.id;
  }

  const id = createId();
  db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
    id,
    name,
    getTagColor(name)
  );
  return id;
}

function replaceNodeTags(nodeId: string, tags: string[]) {
  const deleteNodeTags = db.prepare('DELETE FROM node_tags WHERE node_id = ?');
  const insertNodeTag = db.prepare('INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)');

  deleteNodeTags.run(nodeId);

  for (const tag of tags) {
    const tagId = getOrCreateTagId(tag);
    insertNodeTag.run(nodeId, tagId);
  }
}

// POST /api/nodes/bulk-tags
export async function POST({ request }) {
  const payload = await request.json();
  const nodes = Array.isArray(payload?.nodes) ? (payload.nodes as BulkTagNodeInput[]) : [];

  const updates = nodes
    .map((entry) => ({
      id: typeof entry?.id === 'string' ? entry.id : '',
      tags: Array.isArray(entry?.tags) ? normalizeTagList(entry.tags) : []
    }))
    .filter((entry): entry is { id: string; tags: string[] } => Boolean(entry.id));

  const touchNode = db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const update of updates) {
      touchNode.run(now(), update.id);
      replaceNodeTags(update.id, update.tags);
    }
  });

  tx();

  return json({ success: true });
}
