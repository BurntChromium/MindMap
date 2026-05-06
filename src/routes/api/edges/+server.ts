import { json } from '@sveltejs/kit';
import {
	createEdge,
	deleteEdge,
	getEdgesByCanvasId,
} from '$lib/server/appData';
import { isString } from '$lib/mutationPayloads';

// GET /api/edges?canvasId=...
export function GET({ url }) {
	const canvasId = url.searchParams.get('canvasId');
	return json(getEdgesByCanvasId(canvasId));
}

// POST /api/edges
export async function POST({ request }) {
	const payload = await request.json();
	const providedId = isString(payload?.id) ? payload.id : '';
	const canvasId = isString(payload?.canvasId) ? payload.canvasId : '';
	const source = isString(payload?.source) ? payload.source : '';
	const target = isString(payload?.target) ? payload.target : '';

	if (!canvasId || !source || !target) {
		return json(
			{ success: false, error: 'Missing edge endpoints' },
			{ status: 400 },
		);
	}

	return json(
		createEdge({
			id: providedId || undefined,
			canvasId,
			source,
			target,
		}),
	);
}

// DELETE /api/edges?id=...
export async function DELETE({ url }) {
	const id = url.searchParams.get('id');
	return json(deleteEdge(id ?? ''));
}
