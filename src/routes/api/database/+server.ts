import { json } from '@sveltejs/kit';
import {
	exportDatabaseSnapshot,
	importDatabaseSnapshot,
} from '$lib/server/databaseTransfer';

export async function GET() {
	const bytes = await exportDatabaseSnapshot();

	return new Response(bytes, {
		headers: {
			'Content-Type': 'application/x-sqlite3',
			'Content-Disposition': 'attachment; filename="mindmap.db"',
		},
	});
}

export async function POST({ request }) {
	const bytes = new Uint8Array(await request.arrayBuffer());
	const result = await importDatabaseSnapshot(bytes);

	if (!result.success) {
		return json(result, { status: 400 });
	}

	return json(result);
}
