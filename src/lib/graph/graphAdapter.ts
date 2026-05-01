import { nodeStore, type Node as AppNode } from '$lib/stores/nodeStore';
import { type Edge as AppEdge } from '$lib/stores/edgeStore';
import { getTagColor } from '$lib/tagColors';

export type FlowNodeOptions = {
  editingNodeId: string | null;
  focusedNodeId?: string | null;
  activeTag?: string | null;
  searchHitIds?: Set<string>;
  tagColors?: Record<string, string>;
};

export function toFlowNodes(nodes: AppNode[], options: FlowNodeOptions) {
  const {
    editingNodeId,
    focusedNodeId = null,
    activeTag = null,
    searchHitIds = new Set<string>(),
    tagColors = {}
  } = options;
  const hasSearchFilter = searchHitIds.size > 0;
  const activeTagColor = activeTag ? tagColors[activeTag] ?? getTagColor(activeTag) : null;

  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    selected: focusedNodeId === n.id,
    data: {
      label: n.title || 'Untitled',
      body: n.body ?? '',
      tags: n.tags ?? [],
      tagColors,
      activeTag,
      activeTagColor,
      isSearchHit: hasSearchFilter ? searchHitIds.has(n.id) : false,
      isFocused: focusedNodeId === n.id
    },
    type: 'custom',
    draggable: editingNodeId !== n.id
  }));
}

export function toFlowEdges(edges: AppEdge[]) {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id
  }));
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
