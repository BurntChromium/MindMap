import { afterAll, beforeAll, bench, describe } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchmarkFixture } from './fixtures';

const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-bench-'));
const dbPath = join(tempDir, 'bench.db');
const previousDbPath = process.env.MINDMAP_DB_PATH;
const fixture = createBenchmarkFixture({
	canvasId: 'bench-server',
	nodeCount: 1_000,
	edgeCount: 1_500,
});

process.env.MINDMAP_DB_PATH = dbPath;

let graphData: typeof import('$lib/server/graphData');
let db: any;

function seedDatabase() {
	const insertCanvas = db.prepare(
		'INSERT INTO canvases (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
	);
	const insertNode = db.prepare(
		'INSERT INTO nodes (id, canvas_id, title, body, x, y, collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
	);
	const insertEdge = db.prepare(
		'INSERT INTO edges (id, canvas_id, source_node_id, target_node_id) VALUES (?, ?, ?, ?)',
	);
	const insertTag = db.prepare(
		'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
	);
	const insertNodeTag = db.prepare(
		'INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)',
	);

	const tx = db.transaction(() => {
		insertCanvas.run(
			fixture.canvasId,
			'Benchmark Canvas',
			1_700_000_000_000,
			1_700_000_000_000,
		);

		for (const tag of fixture.serverTags) {
			insertTag.run(tag.id, tag.name, tag.color);
		}

		for (const node of fixture.serverNodes) {
			insertNode.run(
				node.id,
				node.canvas_id,
				node.title,
				node.body,
				node.x,
				node.y,
				node.collapsed,
				node.created_at,
				node.updated_at,
			);
		}

		for (const edge of fixture.serverEdges) {
			insertEdge.run(
				edge.id,
				edge.canvas_id,
				edge.source_node_id,
				edge.target_node_id,
			);
		}

		for (const link of fixture.serverTagLinks) {
			insertNodeTag.run(link.node_id, link.tag_id);
		}
	});

	tx();
}

beforeAll(async () => {
	const schema = await import('$lib/server/schema');
	schema.initSchema();

	graphData = await import('$lib/server/graphData');
	db = (await import('$lib/server/db')).db;
	seedDatabase();
});

afterAll(() => {
	db?.close();
	process.env.MINDMAP_DB_PATH = previousDbPath;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('server query benchmarks', () => {
	bench('load active canvas data', () => {
		graphData.getNodesByCanvasId(fixture.canvasId);
		graphData.getEdgesByCanvasId(fixture.canvasId);
		graphData.getTagsByCanvasId(fixture.canvasId);
	});

	bench('search active canvas by keyword', () => {
		graphData.searchNodesByCanvasId(
			fixture.canvasId,
			fixture.searchQuery,
			null,
		);
	});

	bench('search active canvas by tag', () => {
		graphData.searchNodesByCanvasId(fixture.canvasId, '', fixture.activeTag);
	});
});
