import { json } from '@sveltejs/kit';
import {
  createNode,
  deleteNode,
  getNodesByCanvasId,
  updateNode
} from '$lib/server/appData';
import { isString, toNumber, toTagList } from '$lib/mutationPayloads';

// GET /api/nodes?canvasId=...
export function GET({ url }) {
  const canvasId = url.searchParams.get('canvasId');
  return json(getNodesByCanvasId(canvasId));
}

// POST /api/nodes
export async function POST({ request }) {
  const payload = await request.json();

  if (!isString(payload?.canvasId)) {
    return json({ success: false, error: 'Missing canvasId' }, { status: 400 });
  }

  return json(
    createNode({
      id: isString(payload?.id) ? payload.id : undefined,
      canvasId: payload.canvasId,
      title: typeof payload?.title === 'string' ? payload.title : undefined,
      body: typeof payload?.body === 'string' ? payload.body : undefined,
      isEntity: typeof payload?.isEntity === 'boolean' ? payload.isEntity : undefined,
      tags: toTagList(payload?.tags),
      x: toNumber(payload?.x),
      y: toNumber(payload?.y),
      collapsed: toNumber(payload?.collapsed)
    })
  );
}

// PATCH /api/nodes
export async function PATCH({ request }) {
  const payload = await request.json();
  const id = isString(payload?.id) ? payload.id : '';
  const title = typeof payload?.title === 'string' ? payload.title : undefined;
  const body = typeof payload?.body === 'string' ? payload.body : undefined;
  const isEntity = typeof payload?.isEntity === 'boolean' ? payload.isEntity : undefined;
  const x = typeof payload?.x === 'number' ? payload.x : undefined;
  const y = typeof payload?.y === 'number' ? payload.y : undefined;
  const collapsed = typeof payload?.collapsed === 'number' ? payload.collapsed : undefined;
  const hasTags = Object.prototype.hasOwnProperty.call(payload, 'tags');
  const tags = hasTags ? toTagList(payload?.tags) : [];

  if (!id) {
    return json({ success: false, error: 'Missing id' }, { status: 400 });
  }

  const result = updateNode({
    id,
    title,
    body,
    isEntity,
    x,
    y,
    collapsed,
    tags: hasTags ? tags : undefined
  });

  if (!result.success) {
    const status =
      result.error === 'Missing id'
        ? 404
        : typeof result.error === 'string' && result.error.includes('already exists')
          ? 409
          : 400;

    return json(result, { status });
  }

  return json(result);
}

// DELETE /api/nodes?id=...
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');
  return json(deleteNode(id ?? ''));
}
