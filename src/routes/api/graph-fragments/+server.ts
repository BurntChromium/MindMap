import { json } from '@sveltejs/kit';
import { deleteGraphFragment, pasteGraphFragment } from '$lib/server/appData';
import { isString, toStringList } from '$lib/mutationPayloads';

// POST /api/graph-fragments
export async function POST({ request }) {
  const payload = await request.json();

  if (payload?.action === 'paste') {
    const canvasId = isString(payload.canvasId) ? payload.canvasId : '';

    if (!canvasId) {
      return json({ error: 'Missing canvasId' }, { status: 400 });
    }

    return json(
      pasteGraphFragment({
        canvasId,
        nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload.edges) ? payload.edges : []
      })
    );
  }

  if (payload?.action === 'delete') {
    const nodeIds = Array.from(new Set(toStringList(payload?.nodeIds)));
    const edgeIds = Array.from(new Set(toStringList(payload?.edgeIds)));

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return json({ success: true });
    }

    return json(deleteGraphFragment({ nodeIds, edgeIds }));
  }

  return json({ error: 'Unsupported action' }, { status: 400 });
}
