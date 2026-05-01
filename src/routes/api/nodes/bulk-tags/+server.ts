import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { now } from '$lib/server/utils';
import { normalizeTagList } from '$lib/tagUtils';
import { replaceNodeTags } from '$lib/server/nodeTags';

type BulkTagNodeInput = {
  id?: unknown;
  tags?: unknown;
};

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
