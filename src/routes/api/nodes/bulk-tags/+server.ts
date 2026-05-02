import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { now } from '$lib/server/utils';
import { replaceNodeTags } from '$lib/server/nodeTags';
import { isString, toTagList } from '$lib/mutationPayloads';

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
      id: isString(entry?.id) ? entry.id : '',
      tags: toTagList(entry?.tags)
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

  return json({ success: true, count: updates.length });
}
