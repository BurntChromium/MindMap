import { nodeStore, type Node as AppNode } from '$lib/stores/nodeStore';
import { type Edge as AppEdge } from '$lib/stores/edgeStore';
import type { AssociativeFlowEdge } from '$lib/graph/associativeEdges';
import { getTagColor } from '$lib/tagColors';

export type FlowNodeOptions = {
	editingNodeId: string | null;
	focusedNodeId?: string | null;
	selectedNodeIds?: string[];
	activeTag?: string | null;
	searchHitIds?: Set<string>;
	tagColors?: Record<string, string>;
	positionOverrides?: Record<string, Pick<AppNode, 'x' | 'y'>>;
	onTagClick?: (tag: string) => void;
	onEntityClick?: (title: string) => void;
};

type FlowNode = ReturnType<typeof buildFlowNode>;
type FlowEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string | null;
	targetHandle?: string | null;
	type?: string;
	selectable?: boolean;
	deletable?: boolean;
	focusable?: boolean;
	zIndex?: number;
	style?: string;
	data?: Record<string, unknown>;
};

type CachedFlowNode = {
	id: string;
	title: string;
	body: string;
	tagsKey: string;
	isEntity: number;
	x: number;
	y: number;
	selected: boolean;
	draggable: boolean;
	isFocused: boolean;
	isSearchHit: boolean;
	activeTag: string | null;
	activeTagColor: string | null;
	tagColors: Record<string, string>;
	onTagClick?: (tag: string) => void;
	onEntityClick?: (title: string) => void;
	node: FlowNode;
};

type CachedFlowEdge = {
	signature: string;
	edge: FlowEdge;
};

const flowNodeCache = new Map<string, CachedFlowNode>();
const flowEdgeCache = new Map<string, CachedFlowEdge>();

function buildFlowNode(
	n: AppNode,
	options: {
		positionOverrides?: Record<string, Pick<AppNode, 'x' | 'y'>>;
		selected: boolean;
		draggable: boolean;
		isFocused: boolean;
		isSearchHit: boolean;
		activeTag: string | null;
		activeTagColor: string | null;
		tagColors: Record<string, string>;
		onTagClick?: (tag: string) => void;
		onEntityClick?: (title: string) => void;
	},
) {
	const position = options.positionOverrides?.[n.id] ?? n;

	return {
		id: n.id,
		position: { x: position.x, y: position.y },
		selected: options.selected,
		data: {
			label: n.title || 'Untitled',
			body: n.body ?? '',
			tags: n.tags ?? [],
			is_entity: n.is_entity,
			tagColors: options.tagColors,
			activeTag: options.activeTag,
			activeTagColor: options.activeTagColor,
			onTagClick: options.onTagClick,
			onEntityClick: options.onEntityClick,
			isSearchHit: options.isSearchHit,
			isFocused: options.isFocused,
		},
		type: 'custom',
		draggable: options.draggable,
	};
}

type FlowEdgeInput = AppEdge | AssociativeFlowEdge;

function buildFlowEdge(edge: FlowEdgeInput): FlowEdge {
	if ('data' in edge) {
		return {
			...edge,
		};
	}

	return {
		id: edge.id,
		source: edge.source_node_id,
		target: edge.target_node_id,
		sourceHandle: 'source-bottom',
		targetHandle: 'target-top',
		zIndex: 1,
	};
}

function buildFlowEdgeSignature(edge: FlowEdge) {
	return JSON.stringify({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		sourceHandle: edge.sourceHandle ?? null,
		targetHandle: edge.targetHandle ?? null,
		type: edge.type ?? null,
		selectable: edge.selectable ?? null,
		deletable: edge.deletable ?? null,
		focusable: edge.focusable ?? null,
		zIndex: edge.zIndex ?? null,
		style: edge.style ?? null,
		data: edge.data ?? null,
	});
}

export function toFlowNodes(nodes: AppNode[], options: FlowNodeOptions) {
	const {
		editingNodeId,
		focusedNodeId = null,
		selectedNodeIds = [],
		activeTag = null,
		searchHitIds = new Set<string>(),
		tagColors = {},
		positionOverrides = {},
		onTagClick,
		onEntityClick,
	} = options;
	const hasSearchFilter = searchHitIds.size > 0;
	const selectedNodeIdSet = new Set(selectedNodeIds);
	const activeTagColor = activeTag
		? (tagColors[activeTag] ?? getTagColor(activeTag))
		: null;
	const seenIds = new Set<string>();

	const flowNodes = nodes.map((n) => {
		seenIds.add(n.id);
		const selected = selectedNodeIdSet.has(n.id);
		const draggable = editingNodeId !== n.id;
		const isFocused = focusedNodeId === n.id;
		const isSearchHit = hasSearchFilter ? searchHitIds.has(n.id) : false;
		const tagsKey = (n.tags ?? []).join('\u0000');
		const resolvedPosition = positionOverrides[n.id] ?? n;
		const cached = flowNodeCache.get(n.id);

		if (
			cached &&
			cached.id === n.id &&
			cached.title === n.title &&
			cached.body === (n.body ?? '') &&
			cached.tagsKey === tagsKey &&
			cached.isEntity === n.is_entity &&
			cached.x === resolvedPosition.x &&
			cached.y === resolvedPosition.y &&
			cached.selected === selected &&
			cached.draggable === draggable &&
			cached.isFocused === isFocused &&
			cached.isSearchHit === isSearchHit &&
			cached.activeTag === activeTag &&
			cached.activeTagColor === activeTagColor &&
			cached.tagColors === tagColors &&
			cached.onTagClick === onTagClick &&
			cached.onEntityClick === onEntityClick
		) {
			return cached.node;
		}

		const node = buildFlowNode(n, {
			selected,
			draggable,
			isFocused,
			isSearchHit,
			activeTag,
			activeTagColor,
			tagColors,
			positionOverrides,
			onTagClick,
			onEntityClick,
		});

		flowNodeCache.set(n.id, {
			id: n.id,
			title: n.title,
			body: n.body ?? '',
			tagsKey,
			isEntity: n.is_entity,
			x: resolvedPosition.x,
			y: resolvedPosition.y,
			selected,
			draggable,
			isFocused,
			isSearchHit,
			activeTag,
			activeTagColor,
			tagColors,
			onTagClick,
			onEntityClick,
			node,
		});

		return node;
	});

	for (const id of flowNodeCache.keys()) {
		if (!seenIds.has(id)) {
			flowNodeCache.delete(id);
		}
	}

	return flowNodes;
}

export function toFlowEdges(
	edges: AppEdge[],
	associativeEdges: AssociativeFlowEdge[] = [],
) {
	const seenIds = new Set<string>();
	const combinedEdges: FlowEdgeInput[] = [...edges, ...associativeEdges];

	const flowEdges = combinedEdges.map((edge) => {
		seenIds.add(edge.id);
		const flowEdge = buildFlowEdge(edge);
		const signature = buildFlowEdgeSignature(flowEdge);
		const cached = flowEdgeCache.get(edge.id);

		if (cached && cached.signature === signature) {
			return cached.edge;
		}

		flowEdgeCache.set(edge.id, {
			signature,
			edge: flowEdge,
		});

		return flowEdge;
	});

	for (const id of flowEdgeCache.keys()) {
		if (!seenIds.has(id)) {
			flowEdgeCache.delete(id);
		}
	}

	return flowEdges;
}

export function handleNodeDragStop(...args: any[]) {
	const [{ targetNode }] = args;
	const node = targetNode;
	const update = fromFlowPositionChange(node.id, node.position);
	nodeStore.updateNode(update);
}

export function fromFlowPositionChange(
	id: string,
	position: { x: number; y: number },
) {
	return {
		id,
		x: position.x,
		y: position.y,
	};
}
