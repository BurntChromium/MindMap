import { json } from '@sveltejs/kit';
import { searchNodesByCanvasId } from '$lib/server/appData';

// GET /api/search?canvasId=...&query=...&tag=...
export function GET({ url }) {
	const canvasId = url.searchParams.get('canvasId');
	const query = url.searchParams.get('query') ?? '';
	const tag = url.searchParams.get('tag');

	return json(searchNodesByCanvasId(canvasId, query, tag));
}
