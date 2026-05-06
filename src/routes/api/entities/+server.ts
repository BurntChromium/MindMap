import { json } from '@sveltejs/kit';
import {
	getEntitiesByCanvasId,
	getEntityMentionsByCanvasId,
} from '$lib/server/appData';

// GET /api/entities?canvasId=...
export function GET({ url }) {
	const canvasId = url.searchParams.get('canvasId');

	return json({
		entities: getEntitiesByCanvasId(canvasId),
		mentions: getEntityMentionsByCanvasId(canvasId),
	});
}
