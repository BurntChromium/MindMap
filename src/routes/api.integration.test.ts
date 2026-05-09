import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-tests-'));
const dbPath = join(tempDir, 'test.db');

vi.stubEnv('MINDMAP_DB_PATH', dbPath);

let canvasesApi: typeof import('./api/canvases/+server');
let nodesApi: typeof import('./api/nodes/+server');
let bulkTagsApi: typeof import('./api/nodes/bulk-tags/+server');
let bulkPositionApi: typeof import('./api/nodes/bulk-position/+server');
let graphFragmentsApi: typeof import('./api/graph-fragments/+server');
let entitiesApi: typeof import('./api/entities/+server');
let edgesApi: typeof import('./api/edges/+server');
let searchApi: typeof import('./api/search/+server');
let databaseApi: typeof import('./api/database/+server');
let databaseSettingsApi: typeof import('./api/database-settings/+server');
let databaseBackupsApi: typeof import('./api/database-backups/+server');
let dbModule: typeof import('$lib/server/db');

beforeAll(async () => {
	const schema = await import('$lib/server/schema');
	schema.initSchema();

	canvasesApi = await import('./api/canvases/+server');
	nodesApi = await import('./api/nodes/+server');
	bulkTagsApi = await import('./api/nodes/bulk-tags/+server');
	bulkPositionApi = await import('./api/nodes/bulk-position/+server');
	graphFragmentsApi = await import('./api/graph-fragments/+server');
	entitiesApi = await import('./api/entities/+server');
	edgesApi = await import('./api/edges/+server');
	searchApi = await import('./api/search/+server');
	databaseApi = await import('./api/database/+server');
	databaseSettingsApi = await import('./api/database-settings/+server');
	databaseBackupsApi = await import('./api/database-backups/+server');
	dbModule = await import('$lib/server/db');
});

beforeEach(() => {
	if (!dbModule) {
		return;
	}

	dbModule.db.prepare('DELETE FROM node_tags').run();
	dbModule.db.prepare('DELETE FROM edges').run();
	dbModule.db.prepare('DELETE FROM nodes').run();
	dbModule.db.prepare('DELETE FROM entity_mentions').run();
	dbModule.db.prepare('DELETE FROM entities').run();
	dbModule.db.prepare('DELETE FROM canvases').run();
	dbModule.db.prepare('DELETE FROM tags').run();
});

afterAll(() => {
	if (dbModule?.db.open) {
		dbModule.db.close();
	}
	vi.unstubAllEnvs();
	rmSync(tempDir, { recursive: true, force: true });
});

function request(body: unknown) {
	return new Request('http://localhost', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('API integration', () => {
	it('creates the node_tags tag lookup index', () => {
		const index = dbModule.db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
			)
			.get('idx_node_tags_tag_id');

		expect(index).toEqual(
			expect.objectContaining({ name: 'idx_node_tags_tag_id' }),
		);
	});

	it('exports a valid SQLite snapshot', async () => {
		await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Exported' }),
		} as any);

		const response = await databaseApi.GET();
		const bytes = new Uint8Array(await response.arrayBuffer());
		const snapshotPath = join(tempDir, 'exported.db');

		writeFileSync(snapshotPath, bytes);

		const exportedDb = new Database(snapshotPath, { readonly: true });
		const canvases = exportedDb
			.prepare('SELECT id, name FROM canvases ORDER BY name')
			.all();

		expect(response.headers.get('content-type')).toContain(
			'application/x-sqlite3',
		);
		expect(canvases).toEqual([
			expect.objectContaining({
				id: 'canvas-1',
				name: 'Exported',
			}),
		]);

		exportedDb.close();
	});

	it('reports and updates the configured database file name', async () => {
		const pageData = await (
			await (await import('./api/page-data/+server')).GET()
		).json();

		expect(pageData.databaseFileName).toBe('test.db');

		const response = await databaseSettingsApi.PATCH({
			request: new Request('http://localhost/api/database-settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ databaseFileName: 'renamed.db' }),
			}),
		} as any);
		const payload = await response.json();

		expect(payload).toEqual({ databaseFileName: 'renamed.db' });
		expect(dbModule.dbPath).toBe(join(tempDir, 'renamed.db'));
		expect(
			dbModule.db
				.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
				.all(),
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ name: 'canvases' })]),
		);
	});

	it('reports backup settings and status in initial page data', async () => {
		const pageData = await (
			await (await import('./api/page-data/+server')).GET()
		).json();

		expect(pageData.backupSettings).toEqual(
			expect.objectContaining({
				backupDirectoryPath: 'mindmap-backups',
				backupIntervalMinutes: 10,
				backupRetentionCount: 2,
			}),
		);
		expect(pageData.backupStatus).toEqual(
			expect.objectContaining({
				backupCount: 0,
				latestBackupFileName: null,
				latestBackupCreatedAt: null,
			}),
		);
		expect(pageData.backupDirectoryConfigurable).toBe(true);
	});

	it('creates and restores the latest backup snapshot', async () => {
		await canvasesApi.POST({
			request: request({ id: 'canvas-backup', name: 'Backups' }),
		} as any);

		const settingsResponse = await databaseBackupsApi.PATCH({
			request: new Request('http://localhost/api/database-backups', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					backupDirectoryPath: 'mindmap-backups',
					backupIntervalMinutes: 5,
					backupRetentionCount: 3,
				}),
			}),
		} as any);
		const settingsPayload = await settingsResponse.json();

		expect(settingsPayload).toEqual(
			expect.objectContaining({
				backupDirectoryPath: 'mindmap-backups',
				backupIntervalMinutes: 5,
				backupRetentionCount: 3,
			}),
		);

		const snapshotResponse = await databaseBackupsApi.POST({
			request: new Request('http://localhost/api/database-backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'snapshot' }),
			}),
		} as any);
		const snapshotPayload = await snapshotResponse.json();

		expect(snapshotPayload.backupCount).toBe(1);
		expect(snapshotPayload.latestBackupFileName).toMatch(
			/^mindmap-backup-.*\.db$/,
		);

		dbModule.db.prepare('DELETE FROM canvases').run();

		const restoreResponse = await databaseBackupsApi.POST({
			request: new Request('http://localhost/api/database-backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore-latest' }),
			}),
		} as any);
		const restorePayload = await restoreResponse.json();

		expect(restorePayload.backupCount).toBe(1);

		const canvases = dbModule.db
			.prepare('SELECT id, name FROM canvases ORDER BY name')
			.all();

		expect(canvases).toEqual([
			expect.objectContaining({
				id: 'canvas-backup',
				name: 'Backups',
			}),
		]);

		rmSync(join(tempDir, 'mindmap-backups'), {
			recursive: true,
			force: true,
		});
	});

	it('rejects restoring the latest backup when none exist', async () => {
		await canvasesApi.POST({
			request: request({ id: 'canvas-backup-missing', name: 'Missing' }),
		} as any);

		const response = await databaseBackupsApi.POST({
			request: new Request('http://localhost/api/database-backups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore-latest' }),
			}),
		} as any);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);

		const canvases = dbModule.db
			.prepare('SELECT id, name FROM canvases ORDER BY name')
			.all();

		expect(canvases).toEqual([
			expect.objectContaining({
				id: 'canvas-backup-missing',
				name: 'Missing',
			}),
		]);
	});

	it('replaces the current database when importing a valid snapshot', async () => {
		await canvasesApi.POST({
			request: request({ id: 'canvas-original', name: 'Original' }),
		} as any);

		const sourcePath = join(tempDir, 'import-source.db');
		const sourceDb = new Database(sourcePath);
		const schema = await import('$lib/server/schema');

		schema.initSchema(sourceDb);

		sourceDb
			.prepare(
				`
        INSERT INTO canvases (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
			)
			.run('canvas-imported', 'Imported', 1, 1);
		sourceDb
			.prepare(
				`
        INSERT INTO nodes (
          id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
			)
			.run(
				'node-imported',
				'canvas-imported',
				'Imported Node',
				'Imported body',
				0,
				12,
				34,
				0,
				2,
				2,
			);
		sourceDb.close();

		const response = await databaseApi.POST({
			request: new Request('http://localhost/api/database', {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: readFileSync(sourcePath),
			}),
		} as any);
		const payload = await response.json();

		expect(payload).toEqual({ success: true });

		const canvases = dbModule.db
			.prepare('SELECT id, name FROM canvases ORDER BY name')
			.all();
		const nodes = dbModule.db
			.prepare('SELECT id, title FROM nodes ORDER BY title')
			.all();

		expect(canvases).toEqual([
			expect.objectContaining({
				id: 'canvas-imported',
				name: 'Imported',
			}),
		]);
		expect(nodes).toEqual([
			expect.objectContaining({
				id: 'node-imported',
				title: 'Imported Node',
			}),
		]);
	});

	it('rejects invalid database files without replacing the current db', async () => {
		await canvasesApi.POST({
			request: request({ id: 'canvas-original', name: 'Original' }),
		} as any);

		const response = await databaseApi.POST({
			request: new Request('http://localhost/api/database', {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: 'not-a-sqlite-file',
			}),
		} as any);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);

		const canvases = dbModule.db
			.prepare('SELECT id, name FROM canvases ORDER BY name')
			.all();
		expect(canvases).toEqual([
			expect.objectContaining({
				id: 'canvas-original',
				name: 'Original',
			}),
		]);
	});

	it('creates canvases and lists them back', async () => {
		const created = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'World' }),
		} as any);
		const createdJson = await created.json();

		const listed = await canvasesApi.GET();
		const canvases = await listed.json();

		expect(createdJson.id).toBe('canvas-1');
		expect(createdJson.name).toBe('World');
		expect(canvases).toHaveLength(1);
		expect(canvases[0].id).toBe('canvas-1');
		expect(canvases[0].name).toBe('World');
	});

	it('renames canvases through patch', async () => {
		const created = await canvasesApi.POST({
			request: request({ name: 'Draft' }),
		} as any);
		const { id: canvasId } = await created.json();

		await canvasesApi.PATCH({
			request: request({ id: canvasId, name: 'Final Draft' }),
		} as any);

		const listed = await canvasesApi.GET();
		const canvases = await listed.json();

		expect(canvases[0]).toMatchObject({
			id: canvasId,
			name: 'Final Draft',
		});
	});

	it('persists node tags through patch and fetch', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Campaign' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const createdNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 10, y: 20 }),
		} as any);
		const { id: nodeId } = await createdNode.json();

		await nodesApi.PATCH({
			request: request({
				id: nodeId,
				title: 'NPC',
				body: 'The guide in town.',
				tags: ['#lore', 'npc', 'npc'],
			}),
		} as any);

		const listed = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listed.json();

		expect(nodes).toHaveLength(1);
		expect(nodes[0]).toMatchObject({
			id: 'node-1',
			title: 'NPC',
			body: 'The guide in town.',
			tags: ['lore', 'npc'],
		});

		const tagRows = dbModule.db
			.prepare('SELECT name FROM tags ORDER BY name')
			.all() as Array<{
			name: string;
		}>;
		const nodeTagRows = dbModule.db
			.prepare('SELECT node_id, tag_id FROM node_tags')
			.all();

		expect(tagRows.map((row) => row.name)).toEqual(['lore', 'npc']);
		expect(nodeTagRows).toHaveLength(2);

		const tagColors = dbModule.db
			.prepare('SELECT name, color FROM tags ORDER BY name')
			.all();

		expect(tagColors).toEqual([
			expect.objectContaining({
				name: 'lore',
				color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			}),
			expect.objectContaining({
				name: 'npc',
				color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			}),
		]);
	});

	it('creates nodes with enumerated default titles', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Numbered' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const created = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 10, y: 20 }),
		} as any);
		const createdJson = await created.json();

		expect(createdJson.title).toBe('Node 1');
	});

	it('rebuilds entity rows and mentions from node bodies', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Entities' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const smaug = await nodesApi.POST({
			request: request({
				id: 'node-1',
				canvasId,
				x: 0,
				y: 0,
				title: 'Smaug',
				isEntity: true,
			}),
		} as any);
		const guide = await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Guide',
				isEntity: true,
			}),
		} as any);

		const { id: smaugId } = await smaug.json();
		const { id: guideId } = await guide.json();

		await nodesApi.PATCH({
			request: request({
				id: guideId,
				body: '[[Smaug]] [[Bilbo]] [[Smaug]]',
			}),
		} as any);

		const entityRows = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRows).toEqual([
			expect.objectContaining({
				title: 'Bilbo',
				title_key: 'bilbo',
				primary_node_id: null,
			}),
			expect.objectContaining({
				title: 'Guide',
				title_key: 'guide',
				primary_node_id: guideId,
			}),
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				primary_node_id: smaugId,
			}),
		]);

		const mentionRows = dbModule.db
			.prepare(
				`
      SELECT title, title_key, node_id, reference_text, start_index, end_index
      FROM entity_mentions
      ORDER BY node_id, start_index
    `,
			)
			.all();

		expect(mentionRows).toEqual([
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				node_id: guideId,
				reference_text: '[[Smaug]]',
				start_index: 0,
				end_index: 9,
			}),
			expect.objectContaining({
				title: 'Bilbo',
				title_key: 'bilbo',
				node_id: guideId,
				reference_text: '[[Bilbo]]',
				start_index: 10,
				end_index: 19,
			}),
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				node_id: guideId,
				reference_text: '[[Smaug]]',
				start_index: 20,
				end_index: 29,
			}),
		]);
	});

	it('lets a node opt out of being the primary entity page', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Entity Toggle' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const entityNode = await nodesApi.POST({
			request: request({
				id: 'node-1',
				canvasId,
				x: 0,
				y: 0,
				title: 'Smaug',
				isEntity: true,
			}),
		} as any);
		const noteNode = await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Note',
				isEntity: true,
				body: '[[Smaug]]',
			}),
		} as any);

		const { id: entityNodeId } = await entityNode.json();
		const { id: noteNodeId } = await noteNode.json();

		await nodesApi.PATCH({
			request: request({
				id: entityNodeId,
				isEntity: false,
			}),
		} as any);

		const entityRows = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRows).toEqual([
			expect.objectContaining({
				title: 'Note',
				title_key: 'note',
				primary_node_id: noteNodeId,
			}),
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				primary_node_id: null,
			}),
		]);
	});

	it('keeps entity primary-node links stable when toggling isEntity on and off', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Entity Toggle Round Trip' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const aeon = await nodesApi.POST({
			request: request({
				id: 'node-1',
				canvasId,
				x: 0,
				y: 0,
				title: 'Aeon',
				isEntity: true,
			}),
		} as any);
		const valentinism = await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Valentinism',
				isEntity: true,
				body: 'School of [[Aeon]].',
			}),
		} as any);

		const { id: aeonId } = await aeon.json();
		const { id: valentinismId } = await valentinism.json();

		const listedBeforeToggle = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodesBeforeToggle = await listedBeforeToggle.json();

		expect(
			nodesBeforeToggle.find((node: { id: string }) => node.id === aeonId),
		).toMatchObject({
			id: aeonId,
			is_entity: 1,
		});

		const entityRowsBeforeToggle = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRowsBeforeToggle).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: aeonId,
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: valentinismId,
			}),
		]);

		await nodesApi.PATCH({
			request: request({
				id: aeonId,
				isEntity: false,
			}),
		} as any);

		const listedAfterDisable = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodesAfterDisable = await listedAfterDisable.json();

		expect(
			nodesAfterDisable.find((node: { id: string }) => node.id === aeonId),
		).toMatchObject({
			id: aeonId,
			is_entity: 0,
		});

		const entityRowsAfterDisable = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRowsAfterDisable).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: null,
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: valentinismId,
			}),
		]);

		const mentionRowsAfterDisable = dbModule.db
			.prepare(
				`
      SELECT title, title_key, node_id, reference_text
      FROM entity_mentions
      ORDER BY node_id, start_index
    `,
			)
			.all();

		expect(mentionRowsAfterDisable).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				node_id: valentinismId,
				reference_text: '[[Aeon]]',
			}),
		]);

		await nodesApi.PATCH({
			request: request({
				id: aeonId,
				isEntity: true,
			}),
		} as any);

		const listedAfterEnable = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodesAfterEnable = await listedAfterEnable.json();

		expect(
			nodesAfterEnable.find((node: { id: string }) => node.id === aeonId),
		).toMatchObject({
			id: aeonId,
			is_entity: 1,
		});

		const entityRowsAfterEnable = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRowsAfterEnable).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: aeonId,
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: valentinismId,
			}),
		]);
	});

	it('returns entity rows and mentions through the entities api', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Entities API' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		await nodesApi.POST({
			request: request({
				id: 'node-1',
				canvasId,
				x: 0,
				y: 0,
				title: 'Smaug',
				isEntity: true,
			}),
		} as any);
		await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Note',
				isEntity: true,
				body: '[[Smaug]] in the mountain.',
			}),
		} as any);

		const response = await entitiesApi.GET({
			url: new URL(`http://localhost/api/entities?canvasId=${canvasId}`),
		} as any);
		const payload = await response.json();

		expect(payload.entities).toEqual([
			expect.objectContaining({
				title: 'Note',
				title_key: 'note',
				primary_node_id: 'node-2',
				mention_count: 0,
			}),
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				primary_node_id: 'node-1',
				mention_count: 1,
			}),
		]);

		expect(payload.mentions).toEqual([
			expect.objectContaining({
				title: 'Smaug',
				title_key: 'smaug',
				node_id: 'node-2',
				reference_text: '[[Smaug]]',
				start_index: 0,
				end_index: 9,
			}),
		]);
	});

	it('cascades title renames through matching entity references', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Rename Cascade' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const smaug = await nodesApi.POST({
			request: request({
				id: 'node-1',
				canvasId,
				x: 0,
				y: 0,
				title: 'Smaug',
				isEntity: true,
			}),
		} as any);
		const note = await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Note',
				isEntity: true,
			}),
		} as any);

		const { id: smaugId } = await smaug.json();
		const { id: noteId } = await note.json();

		await nodesApi.PATCH({
			request: request({
				id: noteId,
				body: '[[Smaug]] watches the gate.',
			}),
		} as any);

		await nodesApi.PATCH({
			request: request({
				id: smaugId,
				title: 'Dragon',
			}),
		} as any);

		const listed = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listed.json();

		expect(
			nodes.find((node: { id: string }) => node.id === noteId),
		).toMatchObject({
			id: noteId,
			body: '[[Dragon]] watches the gate.',
		});

		const entityRows = dbModule.db
			.prepare(
				`
      SELECT title, title_key, primary_node_id
      FROM entities
      ORDER BY title_key
    `,
			)
			.all();

		expect(entityRows).toEqual([
			expect.objectContaining({
				title: 'Dragon',
				title_key: 'dragon',
				primary_node_id: smaugId,
			}),
			expect.objectContaining({
				title: 'Note',
				title_key: 'note',
				primary_node_id: noteId,
			}),
		]);

		const mentionRows = dbModule.db
			.prepare(
				`
      SELECT title, title_key, node_id, reference_text
      FROM entity_mentions
      ORDER BY node_id, start_index
    `,
			)
			.all();

		expect(mentionRows).toEqual([
			expect.objectContaining({
				title: 'Dragon',
				title_key: 'dragon',
				node_id: noteId,
				reference_text: '[[Dragon]]',
			}),
		]);
	});

	it('bulk-updates tags transactionally across selected nodes', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Bulk Tags' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const firstNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0 }),
		} as any);
		const secondNode = await nodesApi.POST({
			request: request({ id: 'node-2', canvasId, x: 120, y: 120 }),
		} as any);

		const { id: firstNodeId } = await firstNode.json();
		const { id: secondNodeId } = await secondNode.json();

		await nodesApi.PATCH({
			request: request({
				id: firstNodeId,
				title: 'Alpha',
				tags: ['lore'],
			}),
		} as any);

		await nodesApi.PATCH({
			request: request({
				id: secondNodeId,
				title: 'Beta',
				tags: ['npc'],
			}),
		} as any);

		await bulkTagsApi.POST({
			request: request({
				nodes: [
					{ id: firstNodeId, tags: ['lore', 'npc'] },
					{ id: secondNodeId, tags: ['npc'] },
				],
			}),
		} as any);

		const listed = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listed.json();

		expect(nodes).toEqual([
			expect.objectContaining({
				id: firstNodeId,
				tags: ['lore', 'npc'],
			}),
			expect.objectContaining({
				id: secondNodeId,
				tags: ['npc'],
			}),
		]);

		const tagRows = dbModule.db
			.prepare('SELECT name FROM tags ORDER BY name')
			.all() as Array<{
			name: string;
		}>;
		expect(tagRows.map((row) => row.name)).toEqual(['lore', 'npc']);
	});

	it('rejects duplicate titles on patch', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Duplicate Titles' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0, title: 'Alpha' }),
		} as any);
		const secondNode = await nodesApi.POST({
			request: request({
				id: 'node-2',
				canvasId,
				x: 120,
				y: 120,
				title: 'Beta',
			}),
		} as any);

		const { id: secondNodeId } = await secondNode.json();

		const response = await nodesApi.PATCH({
			request: request({
				id: secondNodeId,
				title: 'alpha',
			}),
		} as any);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload).toMatchObject({
			success: false,
			error: 'A node titled "alpha" already exists in this canvas.',
		});
	});

	it('bulk-updates node positions transactionally across selected nodes', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Bulk Positions' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const firstNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0 }),
		} as any);
		const secondNode = await nodesApi.POST({
			request: request({ id: 'node-2', canvasId, x: 120, y: 120 }),
		} as any);

		const { id: firstNodeId } = await firstNode.json();
		const { id: secondNodeId } = await secondNode.json();

		await bulkPositionApi.POST({
			request: request({
				nodes: [
					{ id: firstNodeId, x: 48, y: 64 },
					{ id: secondNodeId, x: 96, y: 128 },
				],
			}),
		} as any);

		const listed = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listed.json();

		expect(nodes).toEqual([
			expect.objectContaining({
				id: firstNodeId,
				x: 48,
				y: 64,
			}),
			expect.objectContaining({
				id: secondNodeId,
				x: 96,
				y: 128,
			}),
		]);
	});

	it('pastes copied graph fragments transactionally', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Clipboard' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		await nodesApi.POST({
			request: request({
				id: 'existing-node',
				canvasId,
				x: 0,
				y: 0,
				title: 'Alpha',
			}),
		} as any);

		await graphFragmentsApi.POST({
			request: request({
				action: 'paste',
				canvasId,
				nodes: [
					{
						id: 'copy-node-1',
						title: 'Alpha',
						body: 'Body',
						tags: ['lore', 'lore'],
						x: 10,
						y: 20,
						collapsed: 0,
					},
					{
						id: 'copy-node-2',
						title: 'Alpha',
						body: '',
						tags: ['npc'],
						x: 100,
						y: 120,
						collapsed: 1,
					},
				],
				edges: [
					{
						id: 'copy-edge-1',
						source_node_id: 'copy-node-1',
						target_node_id: 'copy-node-2',
					},
				],
			}),
		} as any);

		const listed = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listed.json();

		const edgesListed = await edgesApi.GET({
			url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`),
		} as any);
		const edges = await edgesListed.json();

		expect(nodes).toHaveLength(3);
		expect(
			nodes.find((node: { id: string }) => node.id === 'existing-node'),
		).toMatchObject({
			id: 'existing-node',
			title: 'Alpha',
		});
		expect(
			nodes.find((node: { id: string }) => node.id === 'copy-node-1'),
		).toMatchObject({
			id: 'copy-node-1',
			title: 'Alpha (1)',
			tags: ['lore'],
		});
		expect(
			nodes.find((node: { id: string }) => node.id === 'copy-node-2'),
		).toMatchObject({
			id: 'copy-node-2',
			title: 'Alpha (2)',
			tags: ['npc'],
		});
		expect(edges).toEqual([
			expect.objectContaining({
				id: 'copy-edge-1',
				source_node_id: 'copy-node-1',
				target_node_id: 'copy-node-2',
			}),
		]);
	});

	it('deletes nodes and attached edges in one transaction', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Delete Graph' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const firstNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0 }),
		} as any);
		const secondNode = await nodesApi.POST({
			request: request({ id: 'node-2', canvasId, x: 120, y: 120 }),
		} as any);

		const { id: firstNodeId } = await firstNode.json();
		const { id: secondNodeId } = await secondNode.json();

		await edgesApi.POST({
			request: request({
				id: 'edge-1',
				canvasId,
				source: firstNodeId,
				target: secondNodeId,
			}),
		} as any);

		await graphFragmentsApi.POST({
			request: request({
				action: 'delete',
				nodeIds: [firstNodeId],
			}),
		} as any);

		const listedNodes = await nodesApi.GET({
			url: new URL(`http://localhost/api/nodes?canvasId=${canvasId}`),
		} as any);
		const nodes = await listedNodes.json();

		const listedEdges = await edgesApi.GET({
			url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`),
		} as any);
		const edges = await listedEdges.json();

		expect(nodes).toHaveLength(1);
		expect(nodes[0].id).toBe(secondNodeId);
		expect(edges).toHaveLength(0);
	});

	it('searches nodes by keyword and tag', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Searchable' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const firstNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0 }),
		} as any);
		const secondNode = await nodesApi.POST({
			request: request({ id: 'node-2', canvasId, x: 120, y: 120 }),
		} as any);

		const { id: firstNodeId } = await firstNode.json();
		const { id: secondNodeId } = await secondNode.json();

		await nodesApi.PATCH({
			request: request({
				id: firstNodeId,
				title: 'Smaug',
				body: 'The dragon keeps the treasure.',
				tags: ['lore'],
			}),
		} as any);

		await nodesApi.PATCH({
			request: request({
				id: secondNodeId,
				title: 'Guide',
				body: 'A helpful NPC for the player.',
				tags: ['npc'],
			}),
		} as any);

		const keywordMatch = await searchApi.GET({
			url: new URL(
				`http://localhost/api/search?canvasId=${canvasId}&query=dragon`,
			),
		} as any);
		const keywordNodes = await keywordMatch.json();

		expect(keywordNodes).toHaveLength(1);
		expect(keywordNodes[0]).toMatchObject({
			id: firstNodeId,
			title: 'Smaug',
		});

		const tagMatch = await searchApi.GET({
			url: new URL(`http://localhost/api/search?canvasId=${canvasId}&tag=npc`),
		} as any);
		const tagNodes = await tagMatch.json();

		expect(tagNodes).toHaveLength(1);
		expect(tagNodes[0]).toMatchObject({
			id: secondNodeId,
			title: 'Guide',
			tags: ['npc'],
		});
	});

	it('ranks title matches ahead of tag and body matches', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-rank', name: 'Ranked Search' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const titleNode = await nodesApi.POST({
			request: request({ id: 'node-title', canvasId, x: 0, y: 0 }),
		} as any);
		const tagNode = await nodesApi.POST({
			request: request({ id: 'node-tag', canvasId, x: 120, y: 120 }),
		} as any);
		const bodyNode = await nodesApi.POST({
			request: request({ id: 'node-body', canvasId, x: 240, y: 240 }),
		} as any);

		const { id: titleNodeId } = await titleNode.json();
		const { id: tagNodeId } = await tagNode.json();
		const { id: bodyNodeId } = await bodyNode.json();

		await nodesApi.PATCH({
			request: request({
				id: titleNodeId,
				title: 'Dragon keeper',
				body: 'A quiet note.',
				tags: ['npc'],
			}),
		} as any);

		await nodesApi.PATCH({
			request: request({
				id: tagNodeId,
				title: 'Index',
				body: 'Something else entirely.',
				tags: ['npc', 'dragon'],
			}),
		} as any);

		await nodesApi.PATCH({
			request: request({
				id: bodyNodeId,
				title: 'Notes',
				body: 'The dragon sleeps below the mountain.',
				tags: ['npc'],
			}),
		} as any);

		const response = await searchApi.GET({
			url: new URL(
				`http://localhost/api/search?canvasId=${canvasId}&query=dragon&tag=npc`,
			),
		} as any);
		const results = await response.json();

		expect(results.map((node: { id: string }) => node.id)).toEqual([
			titleNodeId,
			tagNodeId,
			bodyNodeId,
		]);
	});

	it('creates and lists edges', async () => {
		const canvas = await canvasesApi.POST({
			request: request({ id: 'canvas-1', name: 'Connections' }),
		} as any);
		const { id: canvasId } = await canvas.json();

		const sourceNode = await nodesApi.POST({
			request: request({ id: 'node-1', canvasId, x: 0, y: 0 }),
		} as any);
		const targetNode = await nodesApi.POST({
			request: request({ id: 'node-2', canvasId, x: 100, y: 100 }),
		} as any);

		const { id: source } = await sourceNode.json();
		const { id: target } = await targetNode.json();

		const edgeCreated = await edgesApi.POST({
			request: request({ id: 'e-node-1-node-2', canvasId, source, target }),
		} as any);
		const { id: edgeId } = await edgeCreated.json();

		expect(edgeId).toBe('e-node-1-node-2');

		const listed = await edgesApi.GET({
			url: new URL(`http://localhost/api/edges?canvasId=${canvasId}`),
		} as any);
		const edges = await listed.json();

		expect(edges).toEqual([
			{
				id: edgeId,
				canvas_id: canvasId,
				source_node_id: source,
				target_node_id: target,
			},
		]);
	});
});
