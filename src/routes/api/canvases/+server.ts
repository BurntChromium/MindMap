import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createId, now } from '$lib/server/utils';

// GET /api/canvases
export function GET() {
  const canvases = db
    .prepare('SELECT * FROM canvases ORDER BY updated_at DESC')
    .all();

  return json(canvases);
}

// POST /api/canvases
export async function POST({ request }) {
  const { name } = await request.json();

  const id = createId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO canvases (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, name, timestamp, timestamp);

  return json({ id, name });
}

// DELETE /api/canvases/:id
export async function DELETE({ url }) {
  const id = url.searchParams.get('id');

  db.prepare(`DELETE FROM canvases WHERE id = ?`).run(id);

  return json({ success: true });
}