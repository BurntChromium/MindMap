import { nodeStore, type Node as AppNode } from '$lib/stores/nodeStore';
import { type Edge as AppEdge } from '$lib/stores/edgeStore';

export function toFlowNodes(nodes: AppNode[]) {
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: {
      label: n.title || 'Untitled'
    },
    type: 'custom',
    draggable: true
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