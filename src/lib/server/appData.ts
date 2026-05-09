import Database from 'better-sqlite3';
import {
	db,
	getDatabaseBackupSettings,
	getDatabaseFileName,
	isBackupDirectoryConfigurable,
	setBackupSettings,
	setDatabaseFileName,
} from './db';
import { createId, now } from './utils';
import { getTagColor } from '$lib/tagColors';
import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';
import {
	canonicalizeNodeTitle,
	createNodeTitleAllocator,
	hasNodeTitleConflict,
	normalizeNodeTitle,
	resolveUniqueNodeTitle,
} from '$lib/nodeTitles';
import {
	parseInlineContent,
	type InlineContentSegment,
} from '$lib/inlineContent';
import {
	exportDatabaseSnapshot,
	importDatabaseSnapshot,
} from './databaseTransfer';
import {
	createBackupSnapshot,
	getBackupStatus,
	type AppDataBackupSettings,
	type AppDataBackupStatus,
	restoreLatestBackup,
} from './databaseBackup';
import { searchDocuments } from '$lib/search/searchCore';

export type AppDataCanvas = {
	id: string;
	name: string;
	created_at: number;
	updated_at: number;
};

export type AppDataNode = {
	id: string;
	canvas_id: string;
	title: string;
	body: string;
	is_entity: number;
	tags: string[];
	x: number;
	y: number;
	collapsed: number;
	created_at: number;
	updated_at: number;
};

export type AppDataEdge = {
	id: string;
	canvas_id: string;
	source_node_id: string;
	target_node_id: string;
};

export type AppDataEntity = {
	id: string;
	canvas_id: string;
	title: string;
	title_key: string;
	primary_node_id: string | null;
	mention_count: number;
	created_at: number;
	updated_at: number;
};

export type AppDataEntityMention = {
	id: string;
	canvas_id: string;
	entity_id: string;
	node_id: string;
	reference_text: string;
	title: string;
	title_key: string;
	start_index: number;
	end_index: number;
	created_at: number;
	updated_at: number;
};

export type AppDataPageData = {
	canvases: AppDataCanvas[];
	activeCanvasId: string | null;
	databaseFileName: string;
	backupSettings: AppDataBackupSettings;
	backupStatus: AppDataBackupStatus;
	backupDirectoryConfigurable: boolean;
	nodes: AppDataNode[];
	edges: AppDataEdge[];
	tags: Array<{ id: string; name: string; color: string; node_count: number }>;
	entities: AppDataEntity[];
	entityMentions: AppDataEntityMention[];
};

export type AppDataDatabaseSettings = {
	databaseFileName: string;
};

type NodeEntitySource = {
	id: string;
	canvas_id: string;
	title: string;
	body: string;
	is_entity: number | null;
};

type EntitySeed = {
	id: string;
	canvas_id: string;
	title: string;
	title_key: string;
	primary_node_id: string | null;
	created_at: number;
};

function parseTags(rawTags: unknown) {
	if (typeof rawTags !== 'string' || !rawTags) {
		return [];
	}

	try {
		const parsed = JSON.parse(rawTags);
		return Array.isArray(parsed) ? normalizeTagList(parsed) : [];
	} catch {
		return [];
	}
}

type SqliteDatabase = InstanceType<typeof Database>;

function getDb(database?: SqliteDatabase) {
	return database ?? db;
}

function rebuildEntitiesForCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);

	if (!canvasId) {
		return;
	}

	const timestamp = now();
	const nodes = currentDb
		.prepare(
			`
        SELECT id, canvas_id, title, body, is_entity
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      `,
		)
		.all(canvasId) as NodeEntitySource[];
	const existingEntities = currentDb
		.prepare(
			`
        SELECT id, title, title_key, primary_node_id, created_at
        FROM entities
        WHERE canvas_id = ?
      `,
		)
		.all(canvasId) as Array<{
		id: string;
		title: string;
		title_key: string;
		primary_node_id: string | null;
		created_at: number;
	}>;
	const existingEntitiesByKey = new Map(
		existingEntities.map((entity) => [entity.title_key, entity]),
	);
	const nodeTitlesByKey = new Map<string, NodeEntitySource>();
	const entitiesByKey = new Map<string, EntitySeed>();
	const referencesByNodeId = new Map<
		string,
		Array<{
			title: string;
			titleKey: string;
			referenceText: string;
			startIndex: number;
			endIndex: number;
		}>
	>();

	for (const node of nodes) {
		if (node.is_entity === 0) {
			continue;
		}

		const title = normalizeNodeTitle(node.title);

		if (!title) {
			continue;
		}

		const titleKey = canonicalizeNodeTitle(title);
		nodeTitlesByKey.set(titleKey, node);
		const existing = existingEntitiesByKey.get(titleKey);
		entitiesByKey.set(titleKey, {
			id: existing?.id ?? createId(),
			canvas_id: canvasId,
			title,
			title_key: titleKey,
			primary_node_id: node.id,
			created_at: existing?.created_at ?? timestamp,
		});
	}

	for (const node of nodes) {
		const references = parseInlineContent(node.body ?? '')
			.filter(
				(
					segment,
				): segment is Extract<InlineContentSegment, { type: 'entity' }> => {
					return segment.type === 'entity';
				},
			)
			.map((segment) => ({
				title: segment.title,
				titleKey: segment.titleKey,
				referenceText: segment.referenceText,
				startIndex: segment.startIndex,
				endIndex: segment.endIndex,
			}));

		referencesByNodeId.set(node.id, references);

		for (const reference of references) {
			if (!entitiesByKey.has(reference.titleKey)) {
				const existing = existingEntitiesByKey.get(reference.titleKey);
				entitiesByKey.set(reference.titleKey, {
					id: existing?.id ?? createId(),
					canvas_id: canvasId,
					title: reference.title,
					title_key: reference.titleKey,
					primary_node_id: nodeTitlesByKey.get(reference.titleKey)?.id ?? null,
					created_at: existing?.created_at ?? timestamp,
				});
			}
		}
	}

	const deleteMentions = currentDb.prepare(
		'DELETE FROM entity_mentions WHERE canvas_id = ?',
	);
	const deleteEntities = currentDb.prepare(
		'DELETE FROM entities WHERE canvas_id = ?',
	);
	const insertEntity = currentDb.prepare(`
    INSERT INTO entities (
      id, canvas_id, title, title_key, primary_node_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
	const insertMention = currentDb.prepare(`
    INSERT INTO entity_mentions (
      id, canvas_id, entity_id, node_id, reference_text, title, title_key,
      start_index, end_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	deleteMentions.run(canvasId);
	deleteEntities.run(canvasId);

	for (const entity of entitiesByKey.values()) {
		insertEntity.run(
			entity.id,
			entity.canvas_id,
			entity.title,
			entity.title_key,
			entity.primary_node_id,
			entity.created_at,
			timestamp,
		);
	}

	for (const node of nodes) {
		const references = referencesByNodeId.get(node.id) ?? [];

		for (const reference of references) {
			const entity = entitiesByKey.get(reference.titleKey);

			if (!entity) {
				continue;
			}

			insertMention.run(
				createId(),
				canvasId,
				entity.id,
				node.id,
				reference.referenceText,
				reference.title,
				reference.titleKey,
				reference.startIndex,
				reference.endIndex,
				timestamp,
				timestamp,
			);
		}
	}
}

export function getCanvases(database?: SqliteDatabase) {
	return getDb(database)
		.prepare('SELECT * FROM canvases ORDER BY updated_at DESC')
		.all() as AppDataCanvas[];
}

export function getNodesByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return (
		getDb(database)
			.prepare(
				`
      SELECT
        n.*,
        COALESCE((
          SELECT json_group_array(tag_name)
          FROM (
            SELECT t.name AS tag_name
            FROM node_tags nt
            JOIN tags t ON t.id = nt.tag_id
            WHERE nt.node_id = n.id
            ORDER BY nt.rowid
          )
        ), '[]') AS tags
      FROM nodes n
      WHERE n.canvas_id = ?
      ORDER BY n.created_at ASC
    `,
			)
			.all(canvasId) as Array<Record<string, unknown> & { tags?: unknown }>
	).map((node) => ({
		...node,
		tags: parseTags(node.tags),
	})) as AppDataNode[];
}

export function getNodeTitlesByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return getDb(database)
		.prepare(
			`
        SELECT id, title
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      `,
		)
		.all(canvasId) as Array<{ id: string; title: string }>;
}

export function getTagsByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return (
		getDb(database)
			.prepare(
				`
      SELECT
        t.id,
        t.name,
        t.color AS color,
        COUNT(nt.node_id) AS node_count
      FROM tags t
      JOIN node_tags nt ON nt.tag_id = t.id
      JOIN nodes n ON n.id = nt.node_id
      WHERE n.canvas_id = ?
      GROUP BY t.id, t.name, t.color
      ORDER BY node_count DESC, t.name ASC
    `,
			)
			.all(canvasId) as Array<Record<string, unknown>>
	).map((tag) => ({
		id: String(tag.id),
		name: String(tag.name),
		color:
			typeof tag.color === 'string' && tag.color
				? tag.color
				: getTagColor(String(tag.name)),
		node_count: Number(tag.node_count ?? 0),
	})) as Array<{ id: string; name: string; color: string; node_count: number }>;
}

export function searchNodesByCanvasId(
	canvasId: string | null,
	query: string,
	activeTag: string | null = null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	const normalizedQuery = query.trim().toLowerCase();
	const normalizedTag = activeTag ? normalizeTagName(activeTag) : '';

	if (!normalizedQuery && !normalizedTag) {
		return [];
	}

	const rows = (
		getDb(database)
			.prepare(
				`
      SELECT
        n.*,
        COALESCE((
          SELECT json_group_array(tag_name)
          FROM (
            SELECT t.name AS tag_name
            FROM node_tags nt
            JOIN tags t ON t.id = nt.tag_id
            WHERE nt.node_id = n.id
            ORDER BY nt.rowid
          )
        ), '[]') AS tags
      FROM nodes n
      WHERE n.canvas_id = ?
    `,
			)
			.all(canvasId) as Array<Record<string, unknown> & { tags?: unknown }>
	).map((node) => ({
		...node,
		tags: parseTags(node.tags),
	})) as AppDataNode[];

	return searchDocuments(rows, {
		query: normalizedQuery,
		tag: normalizedTag || null,
	}).map(({ score: _, ...node }) => node) as AppDataNode[];
}

export function getEdgesByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return getDb(database)
		.prepare('SELECT * FROM edges WHERE canvas_id = ?')
		.all(canvasId) as AppDataEdge[];
}

export function getEntitiesByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return getDb(database)
		.prepare(
			`
        SELECT
          e.id,
          e.canvas_id,
          e.title,
          e.title_key,
          e.primary_node_id,
          e.created_at,
          e.updated_at,
          COUNT(em.id) AS mention_count
        FROM entities e
        LEFT JOIN entity_mentions em ON em.entity_id = e.id
        WHERE e.canvas_id = ?
        GROUP BY
          e.id,
          e.canvas_id,
          e.title,
          e.title_key,
          e.primary_node_id,
          e.created_at,
          e.updated_at
        ORDER BY e.primary_node_id IS NULL, e.title_key ASC
      `,
		)
		.all(canvasId) as AppDataEntity[];
}

export function getEntityMentionsByCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return [];
	}

	return getDb(database)
		.prepare(
			`
        SELECT
          em.id,
          em.canvas_id,
          em.entity_id,
          em.node_id,
          em.reference_text,
          em.title,
          em.title_key,
          em.start_index,
          em.end_index,
          em.created_at,
          em.updated_at
        FROM entity_mentions em
        WHERE em.canvas_id = ?
        ORDER BY em.node_id ASC, em.start_index ASC
      `,
		)
		.all(canvasId) as AppDataEntityMention[];
}

export function getInitialPageData(database?: SqliteDatabase): AppDataPageData {
	const canvases = getCanvases(database);
	const activeCanvasId = canvases[0]?.id ?? null;
	const backupSettings = getDatabaseBackupSettings();
	const backupStatus = getBackupStatus();

	return {
		canvases,
		activeCanvasId,
		databaseFileName: getDatabaseFileName(),
		backupSettings,
		backupStatus,
		backupDirectoryConfigurable: isBackupDirectoryConfigurable(),
		nodes: getNodesByCanvasId(activeCanvasId, database),
		edges: getEdgesByCanvasId(activeCanvasId, database),
		tags: getTagsByCanvasId(activeCanvasId, database),
		entities: getEntitiesByCanvasId(activeCanvasId, database),
		entityMentions: getEntityMentionsByCanvasId(activeCanvasId, database),
	};
}

export async function updateDatabaseFileName(input: {
	databaseFileName: string;
}): Promise<AppDataDatabaseSettings> {
	return setDatabaseFileName(input.databaseFileName);
}

export async function updateBackupSettings(input: {
	backupDirectoryPath: string;
	backupIntervalMinutes: number;
	backupRetentionCount: number;
}): Promise<AppDataBackupSettings> {
	return setBackupSettings(input);
}

export function createCanvas(
	input: { id?: string; name?: string },
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const id = input.id && input.id.trim() ? input.id : createId();
	const name =
		typeof input.name === 'string' && input.name.trim()
			? input.name
			: 'New Canvas';
	const timestamp = now();

	currentDb
		.prepare(
			`
    INSERT INTO canvases (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `,
		)
		.run(id, name, timestamp, timestamp);

	return { success: true, id, name };
}

export function renameCanvas(
	input: { id: string; name: string },
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const trimmed = input.name.trim();
	const timestamp = now();

	currentDb
		.prepare(
			`
    UPDATE canvases
    SET name = ?, updated_at = ?
    WHERE id = ?
  `,
		)
		.run(trimmed, timestamp, input.id);

	return { success: true, id: input.id, name: trimmed, updated_at: timestamp };
}

export function deleteCanvas(id: string, database?: Database.Database) {
	getDb(database).prepare(`DELETE FROM canvases WHERE id = ?`).run(id);
	return { success: true };
}

function getOrCreateTagId(name: string, database?: Database.Database) {
	const currentDb = getDb(database);
	const existing = currentDb
		.prepare('SELECT id FROM tags WHERE name = ?')
		.get(name) as { id: string; color: string | null } | undefined;

	if (existing) {
		if (!existing.color) {
			currentDb
				.prepare('UPDATE tags SET color = ? WHERE id = ?')
				.run(getTagColor(name), existing.id);
		}

		return existing.id;
	}

	const id = createId();
	currentDb
		.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)')
		.run(id, name, getTagColor(name));
	return id;
}

function replaceNodeTags(
	nodeId: string,
	tags: string[],
	database?: Database.Database,
) {
	const currentDb = getDb(database);
	const deleteNodeTags = currentDb.prepare(
		'DELETE FROM node_tags WHERE node_id = ?',
	);
	const insertNodeTag = currentDb.prepare(
		'INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)',
	);

	deleteNodeTags.run(nodeId);

	for (const tag of tags) {
		const tagId = getOrCreateTagId(tag, database);
		insertNodeTag.run(nodeId, tagId);
	}
}

function replaceEntityReferences(
	body: string,
	fromTitle: string,
	toTitle: string,
) {
	const from = normalizeNodeTitle(fromTitle);
	const to = normalizeNodeTitle(toTitle);

	if (!body || !from || !to) {
		return body;
	}

	const pattern = new RegExp(
		`\\[\\[\\s*${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\]\\]`,
		'gi',
	);
	return body.replace(pattern, `[[${to}]]`);
}

export function createNode(
	input: {
		id?: string;
		canvasId: string;
		title?: string;
		body?: string;
		isEntity?: boolean;
		tags?: string[];
		x?: number;
		y?: number;
		collapsed?: number;
	},
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const id = input.id && input.id.trim() ? input.id : createId();
	const existingTitles = getNodeTitlesByCanvasId(input.canvasId, database);
	const title = resolveUniqueNodeTitle(existingTitles, input.title ?? '');
	const body = input.body ?? '';
	const isEntity = input.isEntity ?? false;
	const tags = normalizeTagList(input.tags ?? []);
	const x = typeof input.x === 'number' ? input.x : 0;
	const y = typeof input.y === 'number' ? input.y : 0;
	const collapsed = typeof input.collapsed === 'number' ? input.collapsed : 0;
	const timestamp = now();

	const insertNode = currentDb.prepare(`
    INSERT INTO nodes (
      id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	const tx = currentDb.transaction(() => {
		insertNode.run(
			id,
			input.canvasId,
			title,
			body,
			isEntity ? 1 : 0,
			x,
			y,
			collapsed,
			timestamp,
			timestamp,
		);

		if (tags.length > 0) {
			replaceNodeTags(id, tags, database);
		}

		rebuildEntitiesForCanvasId(input.canvasId, database);
	});

	tx();

	return { success: true, id, title };
}

export function updateNode(
	input: {
		id: string;
		title?: string;
		body?: string;
		isEntity?: boolean;
		x?: number;
		y?: number;
		collapsed?: number;
		tags?: string[] | null;
	},
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const node = currentDb
		.prepare('SELECT id, canvas_id, title, body FROM nodes WHERE id = ?')
		.get(input.id) as
		| { id: string; canvas_id: string; title: string; body: string | null }
		| undefined;

	if (!node) {
		return { success: false, error: 'Missing id' };
	}

	if (typeof input.title === 'string' && !normalizeNodeTitle(input.title)) {
		return { success: false, error: 'Node title cannot be empty.' };
	}

	if (
		typeof input.title === 'string' &&
		hasNodeTitleConflict(
			getNodeTitlesByCanvasId(node.canvas_id, database),
			input.title,
			input.id,
		)
	) {
		const nextTitle = normalizeNodeTitle(input.title);
		return {
			success: false,
			error: `A node titled "${nextTitle}" already exists in this canvas.`,
		};
	}

	const hasTitleChange =
		typeof input.title === 'string' &&
		normalizeNodeTitle(input.title) !== normalizeNodeTitle(node.title);
	const titleRewriteSource = node.title;
	const titleRewriteTarget =
		typeof input.title === 'string' ? input.title : node.title;
	const rewrittenCurrentBody = replaceEntityReferences(
		input.body ?? node.body ?? '',
		titleRewriteSource,
		titleRewriteTarget,
	);
	const nextBody =
		input.body !== undefined || hasTitleChange
			? rewrittenCurrentBody
			: undefined;
	const rewrittenBodyUpdates = currentDb
		.prepare(
			`
        SELECT id, body
        FROM nodes
        WHERE canvas_id = ?
      `,
		)
		.all(node.canvas_id) as Array<{ id: string; body: string | null }>;
	const bodyUpdates = rewrittenBodyUpdates
		.map((entry) => {
			const originalBody = entry.body ?? '';
			const nextEntryBody =
				entry.id === input.id
					? rewrittenCurrentBody
					: hasTitleChange
						? replaceEntityReferences(
								originalBody,
								titleRewriteSource,
								titleRewriteTarget,
							)
						: originalBody;

			return nextEntryBody !== originalBody
				? { id: entry.id, body: nextEntryBody }
				: null;
		})
		.filter((entry): entry is { id: string; body: string } => Boolean(entry));
	const updateNodeStmt = currentDb.prepare(`
    UPDATE nodes
    SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      is_entity = COALESCE(?, is_entity),
      x = COALESCE(?, x),
      y = COALESCE(?, y),
      collapsed = COALESCE(?, collapsed),
      updated_at = ?
    WHERE id = ?
  `);

	const tx = currentDb.transaction(() => {
		for (const entry of bodyUpdates) {
			currentDb
				.prepare(
					`
          UPDATE nodes
          SET body = ?, updated_at = ?
          WHERE id = ?
        `,
				)
				.run(entry.body, now(), entry.id);
		}

		updateNodeStmt.run(
			input.title,
			nextBody,
			typeof input.isEntity === 'boolean'
				? input.isEntity
					? 1
					: 0
				: undefined,
			input.x,
			input.y,
			input.collapsed,
			now(),
			input.id,
		);

		if (input.tags !== undefined) {
			replaceNodeTags(input.id, input.tags ?? [], database);
		}

		rebuildEntitiesForCanvasId(node.canvas_id, database);
	});

	tx();

	return { success: true, id: input.id };
}

export function deleteNode(id: string, database?: Database.Database) {
	const currentDb = getDb(database);
	const node = currentDb
		.prepare('SELECT id, canvas_id FROM nodes WHERE id = ?')
		.get(id) as { id: string; canvas_id: string } | undefined;

	const tx = currentDb.transaction(() => {
		currentDb.prepare(`DELETE FROM nodes WHERE id = ?`).run(id);
		rebuildEntitiesForCanvasId(node?.canvas_id ?? null, database);
	});

	tx();

	return { success: true };
}

export function bulkUpdateNodeTags(
	updates: Array<{ id: string; tags: string[] }>,
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const touchNode = currentDb.prepare(
		'UPDATE nodes SET updated_at = ? WHERE id = ?',
	);

	const tx = currentDb.transaction(() => {
		for (const update of updates) {
			touchNode.run(now(), update.id);
			replaceNodeTags(update.id, update.tags, database);
		}
	});

	tx();

	return { success: true, count: updates.length };
}

export function bulkUpdateNodePositions(
	updates: Array<{ id: string; x: number; y: number }>,
	database?: SqliteDatabase,
) {
	if (updates.length === 0) {
		return { success: true };
	}

	const currentDb = getDb(database);
	const updateNodeStmt = currentDb.prepare(
		'UPDATE nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?',
	);

	const tx = currentDb.transaction(() => {
		for (const update of updates) {
			updateNodeStmt.run(update.x, update.y, now(), update.id);
		}
	});

	tx();

	return { success: true, count: updates.length };
}

export function createEdge(
	input: { id?: string; canvasId: string; source: string; target: string },
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const id =
		input.id && input.id.trim()
			? input.id
			: `e-${input.source}-${input.target}`;

	currentDb
		.prepare(
			`
    INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
    VALUES (?, ?, ?, ?)
  `,
		)
		.run(id, input.canvasId, input.source, input.target);

	return { success: true, id };
}

export function deleteEdge(id: string, database?: Database.Database) {
	getDb(database).prepare(`DELETE FROM edges WHERE id = ?`).run(id);
	return { success: true };
}

export function pasteGraphFragment(
	input: {
		canvasId: string;
		nodes: Array<{
			id?: unknown;
			title?: unknown;
			body?: unknown;
			is_entity?: unknown;
			tags?: unknown;
			x?: unknown;
			y?: unknown;
			collapsed?: unknown;
		}>;
		edges: Array<{
			id?: unknown;
			source_node_id?: unknown;
			target_node_id?: unknown;
		}>;
	},
	database?: SqliteDatabase,
) {
	const currentDb = getDb(database);
	const normalizedNodes = input.nodes
		.map((node) => ({
			id: typeof node?.id === 'string' ? node.id : '',
			title: typeof node?.title === 'string' ? node.title : '',
			body: typeof node?.body === 'string' ? node.body : '',
			is_entity: typeof node?.is_entity === 'number' ? node.is_entity : 0,
			tags: normalizeTagList(
				Array.isArray(node?.tags) ? node.tags.map(String) : [],
			),
			x: typeof node?.x === 'number' ? node.x : 0,
			y: typeof node?.y === 'number' ? node.y : 0,
			collapsed: typeof node?.collapsed === 'number' ? node.collapsed : 0,
		}))
		.filter((node) => node.id.length > 0);

	const titleAllocator = createNodeTitleAllocator(
		getNodeTitlesByCanvasId(input.canvasId, database),
	);
	const resolvedNodes = normalizedNodes.map((node) => ({
		...node,
		title: titleAllocator.nextCopyTitle(node.title),
	}));
	const nodeIds = new Set(resolvedNodes.map((node) => node.id));
	const normalizedEdges = input.edges
		.map((edge) => ({
			id: typeof edge?.id === 'string' && edge.id ? edge.id : createId(),
			source_node_id:
				typeof edge?.source_node_id === 'string' ? edge.source_node_id : '',
			target_node_id:
				typeof edge?.target_node_id === 'string' ? edge.target_node_id : '',
		}))
		.filter(
			(edge) =>
				edge.id.length > 0 &&
				nodeIds.has(edge.source_node_id) &&
				nodeIds.has(edge.target_node_id),
		);
	const insertNode = currentDb.prepare(`
    INSERT INTO nodes (
      id, canvas_id, title, body, is_entity, x, y, collapsed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
	const insertEdge = currentDb.prepare(`
    INSERT INTO edges (id, canvas_id, source_node_id, target_node_id)
    VALUES (?, ?, ?, ?)
  `);
	const timestamp = now();

	const tx = currentDb.transaction(() => {
		for (const [index, node] of resolvedNodes.entries()) {
			const nodeTimestamp = timestamp + index;
			insertNode.run(
				node.id,
				input.canvasId,
				node.title,
				node.body,
				node.is_entity,
				node.x,
				node.y,
				node.collapsed,
				nodeTimestamp,
				nodeTimestamp,
			);
			replaceNodeTags(node.id, node.tags, database);
		}

		for (const edge of normalizedEdges) {
			insertEdge.run(
				edge.id,
				input.canvasId,
				edge.source_node_id,
				edge.target_node_id,
			);
		}

		rebuildEntitiesForCanvasId(input.canvasId, database);
	});

	tx();

	return {
		success: true,
		insertedNodes: resolvedNodes,
		insertedEdges: normalizedEdges.length,
	};
}

export async function exportDatabase() {
	return exportDatabaseSnapshot();
}

export async function importDatabase(
	input: Uint8Array | ArrayBuffer | ArrayBufferView,
) {
	return importDatabaseSnapshot(input);
}

export async function createBackupSnapshotNow() {
	return createBackupSnapshot();
}

export async function restoreLatestBackupNow() {
	return restoreLatestBackup();
}

export function deleteGraphFragment(
	input: { nodeIds: string[]; edgeIds: string[] },
	database?: Database.Database,
) {
	const currentDb = getDb(database);
	const nodeIds = Array.from(new Set(input.nodeIds));
	const edgeIds = Array.from(new Set(input.edgeIds));

	if (nodeIds.length === 0 && edgeIds.length === 0) {
		return { success: true, removedNodes: 0, removedEdges: 0 };
	}

	const affectedCanvasIds = nodeIds.length
		? Array.from(
				new Set(
					(
						currentDb
							.prepare(
								`
                SELECT DISTINCT canvas_id
                FROM nodes
                WHERE id IN (${nodeIds.map(() => '?').join(',')})
              `,
							)
							.all(...nodeIds) as Array<{ canvas_id: string | null }>
					)
						.map((row) => row.canvas_id)
						.filter((canvasId): canvasId is string => Boolean(canvasId)),
				),
			)
		: [];

	const deleteEdges = currentDb.prepare(
		'DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?',
	);
	const deleteExplicitEdge = currentDb.prepare(
		'DELETE FROM edges WHERE id = ?',
	);
	const deleteNodes = currentDb.prepare('DELETE FROM nodes WHERE id = ?');

	const tx = currentDb.transaction(() => {
		for (const nodeId of nodeIds) {
			deleteEdges.run(nodeId, nodeId);
		}

		for (const edgeId of edgeIds) {
			deleteExplicitEdge.run(edgeId);
		}

		for (const nodeId of nodeIds) {
			deleteNodes.run(nodeId);
		}

		for (const canvasId of affectedCanvasIds) {
			rebuildEntitiesForCanvasId(canvasId, database);
		}
	});

	tx();

	return {
		success: true,
		removedNodes: nodeIds.length,
		removedEdges: edgeIds.length,
	};
}

export function searchNodes(
	input: { canvasId: string | null; query: string; tag?: string | null },
	database?: Database.Database,
) {
	return searchNodesByCanvasId(
		input.canvasId,
		input.query,
		input.tag ?? null,
		database,
	);
}
