import { db } from './db';
import { createId } from './utils';
import { getTagColor } from '$lib/tagColors';

export function getOrCreateTagId(name: string) {
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

export function replaceNodeTags(nodeId: string, tags: string[]) {
  const deleteNodeTags = db.prepare('DELETE FROM node_tags WHERE node_id = ?');
  const insertNodeTag = db.prepare('INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)');

  deleteNodeTags.run(nodeId);

  for (const tag of tags) {
    const tagId = getOrCreateTagId(tag);
    insertNodeTag.run(nodeId, tagId);
  }
}
