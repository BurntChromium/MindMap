import { json } from '@sveltejs/kit';
import { bulkUpdateNodeTags } from '$lib/server/appData';
import { isString, toTagList } from '$lib/mutationPayloads';

type BulkTagNodeInput = {
	id?: unknown;
	tags?: unknown;
};

// POST /api/nodes/bulk-tags
export async function POST({ request }) {
	const payload = await request.json();
	const nodes = Array.isArray(payload?.nodes)
		? (payload.nodes as BulkTagNodeInput[])
		: [];

	const updates = nodes
		.map((entry) => ({
			id: isString(entry?.id) ? entry.id : '',
			tags: toTagList(entry?.tags),
		}))
		.filter((entry): entry is { id: string; tags: string[] } =>
			Boolean(entry.id),
		);

	return json(bulkUpdateNodeTags(updates));
}
