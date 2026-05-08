import Database from 'better-sqlite3';
import { db } from './db';
import { createId, now } from './utils';
import { canonicalizeNodeTitle, normalizeNodeTitle } from '$lib/nodeTitles';
import {
	parseInlineContent,
	type InlineContentSegment,
} from '$lib/inlineContent';

export type EntityRow = {
	id: string;
	canvas_id: string;
	title: string;
	title_key: string;
	primary_node_id: string | null;
	mention_count: number;
	created_at: number;
	updated_at: number;
};

export type EntityMentionRow = {
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

export type EntityReference = {
	title: string;
	titleKey: string;
	referenceText: string;
	startIndex: number;
	endIndex: number;
};

export type EntitySeed = {
	id: string;
	canvas_id: string;
	title: string;
	title_key: string;
	primary_node_id: string | null;
	created_at: number;
};

export type NodeEntitySource = {
	id: string;
	canvas_id: string;
	title: string;
	body: string;
	is_entity: number | null;
};

type SqliteDatabase = InstanceType<typeof Database>;

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeEntityTitle(rawTitle: string) {
	return normalizeNodeTitle(rawTitle);
}

export function canonicalizeEntityTitle(rawTitle: string) {
	return canonicalizeNodeTitle(rawTitle);
}

export function extractEntityReferences(body: string): EntityReference[] {
	return parseInlineContent(body)
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
}

export function replaceEntityReferences(
	body: string,
	fromTitle: string,
	toTitle: string,
) {
	const from = normalizeEntityTitle(fromTitle);
	const to = normalizeEntityTitle(toTitle);

	if (!body || !from || !to) {
		return body;
	}

	const pattern = new RegExp(`\\[\\[\\s*${escapeRegExp(from)}\\s*\\]\\]`, 'gi');
	return body.replace(pattern, `[[${to}]]`);
}

function getDb(database?: SqliteDatabase) {
	return database ?? db;
}

function parseNodes(canvasId: string, database?: SqliteDatabase) {
	return getDb(database)
		.prepare(
			`
        SELECT id, canvas_id, title, body, is_entity
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      `,
		)
		.all(canvasId) as NodeEntitySource[];
}

export function rebuildEntitiesForCanvasId(
	canvasId: string | null,
	database?: SqliteDatabase,
) {
	if (!canvasId) {
		return;
	}

	const currentDb = getDb(database);
	const timestamp = now();
	const nodes = parseNodes(canvasId, database);
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
	const referencesByNodeId = new Map<string, EntityReference[]>();

	for (const node of nodes) {
		if (node.is_entity === 0) {
			continue;
		}

		const title = normalizeEntityTitle(node.title);

		if (!title) {
			continue;
		}

		const titleKey = canonicalizeEntityTitle(title);
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
		const references = extractEntityReferences(node.body ?? '');
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
	const deleteEntities = currentDb.prepare('DELETE FROM entities WHERE canvas_id = ?');
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

export function getEntitiesByCanvasId(canvasId: string | null) {
	if (!canvasId) {
		return [];
	}

	return db
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
		.all(canvasId) as EntityRow[];
}

export function getEntityMentionsByCanvasId(canvasId: string | null) {
	if (!canvasId) {
		return [];
	}

	return db
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
		.all(canvasId) as EntityMentionRow[];
}
