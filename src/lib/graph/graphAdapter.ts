import type { Node as AppNode } from '$lib/stores/nodeStore';

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

function handleNodeDragStop(event) {
  const { node } = event;

  nodeStore.updateNode({
    id: node.id,
    x: node.position.x,
    y: node.position.y
  });
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