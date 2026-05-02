import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { now } from '$lib/server/utils';

type BulkPositionNodeInput = {
  id?: unknown;
  x?: unknown;
  y?: unknown;
};

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// POST /api/nodes/bulk-position
export async function POST({ request }) {
  const payload = await request.json();
  const nodes = Array.isArray(payload?.nodes) ? (payload.nodes as BulkPositionNodeInput[]) : [];

  const updates = nodes
    .map((entry) => ({
      id: typeof entry?.id === 'string' ? entry.id : '',
      x: toNumber(entry?.x),
      y: toNumber(entry?.y)
    }))
    .filter((entry): entry is { id: string; x: number; y: number } => {
      return Boolean(entry.id) && entry.x !== null && entry.y !== null;
    });

  if (updates.length === 0) {
    return json({ success: true });
  }

  const updateNode = db.prepare('UPDATE nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const update of updates) {
      updateNode.run(update.x, update.y, now(), update.id);
    }
  });

  tx();

  return json({ success: true });
}
