import { json } from '@sveltejs/kit';
import {
	createTopic,
	deleteTopic,
	getTopicsByCanvasId,
	updateTopic,
} from '$lib/server/appData';
import { isString, toNumber } from '$lib/mutationPayloads';

// GET /api/topics?canvasId=...
export function GET({ url }) {
	const canvasId = url.searchParams.get('canvasId');
	return json(getTopicsByCanvasId(canvasId));
}

// POST /api/topics
export async function POST({ request }) {
	const payload = await request.json();

	if (!isString(payload?.canvasId)) {
		return json({ success: false, error: 'Missing canvasId' }, { status: 400 });
	}

	return json(
		createTopic({
			id: isString(payload?.id) ? payload.id : undefined,
			canvasId: payload.canvasId,
			title: typeof payload?.title === 'string' ? payload.title : undefined,
			x: toNumber(payload?.x),
			y: toNumber(payload?.y),
			width: toNumber(payload?.width),
			height: toNumber(payload?.height),
		}),
	);
}

// PATCH /api/topics
export async function PATCH({ request }) {
	const payload = await request.json();
	const id = isString(payload?.id) ? payload.id : '';
	const title = typeof payload?.title === 'string' ? payload.title : undefined;
	const x = typeof payload?.x === 'number' ? payload.x : undefined;
	const y = typeof payload?.y === 'number' ? payload.y : undefined;
	const width = typeof payload?.width === 'number' ? payload.width : undefined;
	const height = typeof payload?.height === 'number' ? payload.height : undefined;

	if (!id) {
		return json({ success: false, error: 'Missing id' }, { status: 400 });
	}

	const result = updateTopic({
		id,
		title,
		x,
		y,
		width,
		height,
	});

	if (!result.success) {
		const status =
			result.error === 'Missing id'
				? 404
				: typeof result.error === 'string' &&
					  result.error.includes('already exists')
					? 409
					: 400;

		return json(result, { status });
	}

	return json(result);
}

// DELETE /api/topics?id=...
export async function DELETE({ url }) {
	const id = url.searchParams.get('id');
	return json(deleteTopic(id ?? ''));
}
