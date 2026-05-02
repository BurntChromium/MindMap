import { nodeStore, type Node as AppNode } from '$lib/stores/nodeStore';
import { type Edge as AppEdge } from '$lib/stores/edgeStore';
import { getTagColor } from '$lib/tagColors';

export type FlowNodeOptions = {
  editingNodeId: string | null;
  focusedNodeId?: string | null;
  selectedNodeIds?: string[];
  activeTag?: string | null;
  searchHitIds?: Set<string>;
  tagColors?: Record<string, string>;
  onTagClick?: (tag: string) => void;
};

type FlowNode = ReturnType<typeof buildFlowNode>;
type FlowEdge = ReturnType<typeof buildFlowEdge>;

type CachedFlowNode = {
  id: string;
  title: string;
  body: string;
  tagsKey: string;
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
  node: FlowNode;
};

type CachedFlowEdge = {
  source: string;
  target: string;
  edge: FlowEdge;
};

const flowNodeCache = new Map<string, CachedFlowNode>();
const flowEdgeCache = new Map<string, CachedFlowEdge>();

function buildFlowNode(
  n: AppNode,
  options: {
    selected: boolean;
    draggable: boolean;
    isFocused: boolean;
    isSearchHit: boolean;
    activeTag: string | null;
    activeTagColor: string | null;
    tagColors: Record<string, string>;
    onTagClick?: (tag: string) => void;
  }
) {
  return {
    id: n.id,
    position: { x: n.x, y: n.y },
    selected: options.selected,
    data: {
      label: n.title || 'Untitled',
      body: n.body ?? '',
      tags: n.tags ?? [],
      tagColors: options.tagColors,
      activeTag: options.activeTag,
      activeTagColor: options.activeTagColor,
      onTagClick: options.onTagClick,
      isSearchHit: options.isSearchHit,
      isFocused: options.isFocused
    },
    type: 'custom',
    draggable: options.draggable
  };
}

function buildFlowEdge(edge: AppEdge) {
  return {
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id
  };
}

export function toFlowNodes(nodes: AppNode[], options: FlowNodeOptions) {
  const {
    editingNodeId,
    focusedNodeId = null,
    selectedNodeIds = [],
    activeTag = null,
    searchHitIds = new Set<string>(),
    tagColors = {},
    onTagClick
  } = options;
  const hasSearchFilter = searchHitIds.size > 0;
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const activeTagColor = activeTag ? tagColors[activeTag] ?? getTagColor(activeTag) : null;
  const seenIds = new Set<string>();

  const flowNodes = nodes.map((n) => {
    seenIds.add(n.id);
    const selected = selectedNodeIdSet.has(n.id);
    const draggable = editingNodeId !== n.id;
    const isFocused = focusedNodeId === n.id;
    const isSearchHit = hasSearchFilter ? searchHitIds.has(n.id) : false;
    const tagsKey = (n.tags ?? []).join('\u0000');
    const cached = flowNodeCache.get(n.id);

    if (
      cached &&
      cached.id === n.id &&
      cached.title === n.title &&
      cached.body === (n.body ?? '') &&
      cached.tagsKey === tagsKey &&
      cached.x === n.x &&
      cached.y === n.y &&
      cached.selected === selected &&
      cached.draggable === draggable &&
      cached.isFocused === isFocused &&
      cached.isSearchHit === isSearchHit &&
      cached.activeTag === activeTag &&
      cached.activeTagColor === activeTagColor &&
      cached.tagColors === tagColors &&
      cached.onTagClick === onTagClick
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
      onTagClick
    });

    flowNodeCache.set(n.id, {
      id: n.id,
      title: n.title,
      body: n.body ?? '',
      tagsKey,
      x: n.x,
      y: n.y,
      selected,
      draggable,
      isFocused,
      isSearchHit,
      activeTag,
      activeTagColor,
      tagColors,
      onTagClick,
      node
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

export function toFlowEdges(edges: AppEdge[]) {
  const seenIds = new Set<string>();

  const flowEdges = edges.map((e) => {
    seenIds.add(e.id);
    const cached = flowEdgeCache.get(e.id);

    if (cached && cached.source === e.source_node_id && cached.target === e.target_node_id) {
      return cached.edge;
    }

    const edge = buildFlowEdge(e);

    flowEdgeCache.set(e.id, {
      source: e.source_node_id,
      target: e.target_node_id,
      edge
    });

    return edge;
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
  position: { x: number; y: number }
) {
  return {
    id,
    x: position.x,
    y: position.y
  };
}
