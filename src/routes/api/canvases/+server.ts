import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';
import { getCanvases } from '$lib/server/graphData';
import { isString } from '$lib/mutationPayloads';

// GET /api/canvases
export function GET() {
  return json(getCanvases());
}

// POST /api/canvases
export async function POST({ request }) {
  const payload = await request.json();
  const providedId = isString(payload?.id) ? payload.id : '';
  const name = typeof payload?.name === 'string' ? payload.name : 'New Canvas';
  const id = providedId || createId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO canvases (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, name, timestamp, timestamp);

  return json({ success: true, id, name });
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

  const timestamp = now();

  db.prepare(`
    UPDATE canvases
    SET name = ?, updated_at = ?
    WHERE id = ?
  `).run(trimmed, timestamp, id);

  return json({ success: true, id, name: trimmed, updated_at: timestamp });
}

// DELETE /api/canvases/:id
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM canvases WHERE id = ?`).run(id);

  return json({ success: true });
}
