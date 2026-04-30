import { nodeStore, type Node as AppNode } from '$lib/stores/nodeStore';

export function toFlowNodes(nodes: AppNode[]) {
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: {
      label: n.title || 'Untitled'
    },
    type: 'default',
    draggable: true
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