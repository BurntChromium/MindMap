import { json } from '@sveltejs/kit';
import { bulkUpdateNodePositions } from '$lib/server/appData';
import { isString, toNumberOrNull } from '$lib/mutationPayloads';

type BulkPositionNodeInput = {
  id?: unknown;
  x?: unknown;
  y?: unknown;
};

// POST /api/nodes/bulk-position
export async function POST({ request }) {
  const payload = await request.json();
  const nodes = Array.isArray(payload?.nodes) ? (payload.nodes as BulkPositionNodeInput[]) : [];

  const updates = nodes
      .map((entry) => ({
        id: isString(entry?.id) ? entry.id : '',
        x: toNumberOrNull(entry?.x),
        y: toNumberOrNull(entry?.y)
      }))
    .filter((entry): entry is { id: string; x: number; y: number } => {
      return Boolean(entry.id) && entry.x !== null && entry.y !== null;
    });

  if (updates.length === 0) {
    return json({ success: true });
  }

  return json(bulkUpdateNodePositions(updates));
}
