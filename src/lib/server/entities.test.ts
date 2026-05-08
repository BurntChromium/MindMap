import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { initSchema } from './schema';
import {
	extractEntityReferences,
	rebuildEntitiesForCanvasId,
	replaceEntityReferences,
} from './entities';

type SqliteDatabase = InstanceType<typeof Database>;

function insertNode(
	db: SqliteDatabase,
	input: {
		id: string;
		canvasId: string;
		title: string;
		body: string;
		isEntity: number;
		createdAt: number;
	},
) {
	db.prepare(
		`
    INSERT INTO nodes (
      id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
	).run(
		input.id,
		input.canvasId,
		input.title,
		input.body,
		input.isEntity,
		0,
		0,
		0,
		input.createdAt,
		input.createdAt,
	);
}

describe('entities', () => {
	it('extracts mention spans and canonical titles from body text', () => {
		expect(
			extractEntityReferences('Meet [[Smaug]] and [[Bilbo]] again.'),
		).toEqual([
			{
				title: 'Smaug',
				titleKey: 'smaug',
				referenceText: '[[Smaug]]',
				startIndex: 5,
				endIndex: 14,
			},
			{
				title: 'Bilbo',
				titleKey: 'bilbo',
				referenceText: '[[Bilbo]]',
				startIndex: 19,
				endIndex: 28,
			},
		]);
	});

	it('extracts entity references through markdown-lite formatting', () => {
		expect(extractEntityReferences('**[[Smaug]]** and *[[Bilbo]]*')).toEqual([
			{
				title: 'Smaug',
				titleKey: 'smaug',
				referenceText: '[[Smaug]]',
				startIndex: 2,
				endIndex: 11,
			},
			{
				title: 'Bilbo',
				titleKey: 'bilbo',
				referenceText: '[[Bilbo]]',
				startIndex: 19,
				endIndex: 28,
			},
		]);
	});

	it('rewrites matching entity references case-insensitively', () => {
		expect(
			replaceEntityReferences('[[smaug]] meets [[Smaug]]', 'Smaug', 'Dragon'),
		).toBe('[[Dragon]] meets [[Dragon]]');
	});

	it('rebuilds entities from node bodies and primary entity flags', () => {
		const db = new Database(':memory:');
		initSchema(db);

		db.prepare(
			`
      INSERT INTO canvases (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
		).run('canvas-1', 'Canvas', 1, 1);

		insertNode(db, {
			id: 'node-aeon',
			canvasId: 'canvas-1',
			title: 'Aeon',
			body: '',
			isEntity: 1,
			createdAt: 1,
		});
		insertNode(db, {
			id: 'node-valentinism',
			canvasId: 'canvas-1',
			title: 'Valentinism',
			body: 'School of [[Aeon]].',
			isEntity: 1,
			createdAt: 2,
		});

		rebuildEntitiesForCanvasId('canvas-1', db);

		expect(
			db
				.prepare(
					`
          SELECT title, title_key, primary_node_id
          FROM entities
          ORDER BY title_key
        `,
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: 'node-aeon',
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: 'node-valentinism',
			}),
		]);

		expect(
			db
				.prepare(
					`
          SELECT title, title_key, node_id, reference_text
          FROM entity_mentions
          ORDER BY node_id, start_index
        `,
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				node_id: 'node-valentinism',
				reference_text: '[[Aeon]]',
			}),
		]);

		db.prepare('UPDATE nodes SET is_entity = 0 WHERE id = ?').run('node-aeon');
		rebuildEntitiesForCanvasId('canvas-1', db);

		expect(
			db
				.prepare(
					`
          SELECT title, title_key, primary_node_id
          FROM entities
          ORDER BY title_key
        `,
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: null,
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: 'node-valentinism',
			}),
		]);

		db.prepare('UPDATE nodes SET is_entity = 1 WHERE id = ?').run('node-aeon');
		rebuildEntitiesForCanvasId('canvas-1', db);

		expect(
			db
				.prepare(
					`
          SELECT title, title_key, primary_node_id
          FROM entities
          ORDER BY title_key
        `,
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				title: 'Aeon',
				title_key: 'aeon',
				primary_node_id: 'node-aeon',
			}),
			expect.objectContaining({
				title: 'Valentinism',
				title_key: 'valentinism',
				primary_node_id: 'node-valentinism',
			}),
		]);

		db.close();
	});
});
