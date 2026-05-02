import { json } from '@sveltejs/kit';
import {
  createCanvas,
  deleteCanvas,
  getCanvases,
  renameCanvas
} from '$lib/server/appData';
import { isString } from '$lib/mutationPayloads';

// GET /api/canvases
export function GET() {
  return json(getCanvases());
}

// POST /api/canvases
export async function POST({ request }) {
  const payload = await request.json();
  const result = createCanvas({
    id: isString(payload?.id) ? payload.id : undefined,
    name: typeof payload?.name === 'string' ? payload.name : undefined
  });

  return json(result);
}

// PATCH /api/canvases
export async function PATCH({ request }) {
  const payload = await request.json();
  const id = isString(payload?.id) ? payload.id : '';
  const name = typeof payload?.name === 'string' ? payload.name : '';
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (!id || !trimmed) {
    return json({ success: false }, { status: 400 });
  }

  return json(renameCanvas({ id, name: trimmed }));
}

// DELETE /api/canvases/:id
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');
  return json(deleteCanvas(id ?? ''));
}
