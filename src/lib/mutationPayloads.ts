import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';

export function isString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function toString(value: unknown, fallback = '') {
	return typeof value === 'string' ? value : fallback;
}

export function toNumber(value: unknown, fallback = 0) {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function toNumberOrNull(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function toTagList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return normalizeTagList(value.map((tag) => normalizeTagName(String(tag))));
}

export function toStringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(
		(entry): entry is string =>
			typeof entry === 'string' && entry.trim().length > 0,
	);
}

export function buildCanvasCreateBody(input: { id: string; name: string }) {
	return {
		id: input.id,
		name: input.name,
	};
}

export function buildCanvasPatchBody(input: { id: string; name: string }) {
	return {
		id: input.id,
		name: input.name,
	};
}

export function buildNodeCreateBody(input: {
	id: string;
	canvasId: string;
	x: number;
	y: number;
	title?: string;
	body?: string;
	isEntity?: boolean;
	is_entity?: boolean | number;
	tags?: string[];
	collapsed?: number;
}) {
	const isEntity =
		typeof input.isEntity === 'boolean' ? input.isEntity : input.is_entity;
	const normalizedIsEntity =
		typeof isEntity === 'boolean'
			? isEntity
			: typeof isEntity === 'number'
				? isEntity !== 0
				: false;

	return {
		id: input.id,
		canvasId: input.canvasId,
		title: input.title ?? 'New Node',
		body: input.body ?? '',
		isEntity: normalizedIsEntity,
		tags: Array.isArray(input.tags) ? normalizeTagList(input.tags) : [],
		x: input.x,
		y: input.y,
		collapsed: typeof input.collapsed === 'number' ? input.collapsed : 0,
	};
}

export function buildNodePatchBody(input: {
	id: string;
	title?: string;
	body?: string;
	isEntity?: boolean;
	is_entity?: boolean | number;
	x?: number;
	y?: number;
	collapsed?: number;
	tags?: string[];
}) {
	const isEntity =
		typeof input.isEntity === 'boolean' ? input.isEntity : input.is_entity;
	const normalizedIsEntity =
		typeof isEntity === 'boolean'
			? isEntity
			: typeof isEntity === 'number'
				? isEntity !== 0
				: undefined;

	return {
		id: input.id,
		title: input.title,
		body: input.body,
		isEntity: normalizedIsEntity,
		x: input.x,
		y: input.y,
		collapsed: input.collapsed,
		tags: Array.isArray(input.tags) ? normalizeTagList(input.tags) : undefined,
	};
}

export function buildEdgeCreateBody(input: {
	id?: string;
	canvasId: string;
	source: string;
	target: string;
}) {
	return {
		id: input.id,
		canvasId: input.canvasId,
		source: input.source,
		target: input.target,
	};
}

export function buildBulkTagsBody(
	nodes: Array<{ id: string; tags: string[] }>,
) {
	return {
		nodes: nodes.map((node) => ({
			id: node.id,
			tags: normalizeTagList(node.tags),
		})),
	};
}

export function buildBulkPositionsBody(
	nodes: Array<{ id: string; x: number; y: number }>,
) {
	return {
		nodes: nodes.map((node) => ({
			id: node.id,
			x: node.x,
			y: node.y,
		})),
	};
}

export function buildGraphFragmentBody(input: {
	action: 'paste' | 'delete';
	canvasId?: string;
	nodes?: Array<Record<string, unknown>>;
	edges?: Array<Record<string, unknown>>;
	nodeIds?: string[];
	edgeIds?: string[];
}) {
	return {
		action: input.action,
		canvasId: input.canvasId,
		nodes: input.nodes,
		edges: input.edges,
		nodeIds: input.nodeIds,
		edgeIds: input.edgeIds,
	};
}
