import { createClientId } from '$lib/clientId';
import type { Edge } from '$lib/stores/edgeStore';
import type { Node } from '$lib/stores/nodeStore';
import { normalizeTagList } from '$lib/tagUtils';

export type ClipboardNode = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  x: number;
  y: number;
  collapsed: number;
};

export type ClipboardEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
};

export type ClipboardFragmentV1 = {
  version: 1;
  sourceCanvasId: string | null;
  nodes: ClipboardNode[];
  edges: ClipboardEdge[];
};

export type PastedNode = ClipboardNode & {
  canvas_id: string;
};

export type PastedEdge = ClipboardEdge & {
  canvas_id: string;
};

export type PastedGraph = {
  nodes: PastedNode[];
  edges: PastedEdge[];
};

function cloneTags(tags: string[]) {
  return normalizeTagList(tags);
}

export function buildClipboardFragment(
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
  sourceCanvasId: string | null
): ClipboardFragmentV1 | null {
  const selectedIds = new Set(selectedNodeIds);

  if (selectedIds.size === 0) {
    return null;
  }

  const selectedNodes = nodes
    .filter((node) => selectedIds.has(node.id))
    .map((node) => ({
      id: node.id,
      title: node.title,
      body: node.body,
      tags: cloneTags(node.tags),
      x: node.x,
      y: node.y,
      collapsed: node.collapsed
    }));

  if (selectedNodes.length === 0) {
    return null;
  }

  return {
    version: 1,
    sourceCanvasId,
    nodes: selectedNodes,
    edges: edges
      .filter((edge) => selectedIds.has(edge.source_node_id) && selectedIds.has(edge.target_node_id))
      .map((edge) => ({
        id: edge.id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id
      }))
  };
}

export function buildPastedGraph(
  fragment: ClipboardFragmentV1,
  canvasId: string,
  pasteIndex: number,
  createNodeId: () => string = () => createClientId('node'),
  createEdgeId: () => string = () => createClientId('edge')
): PastedGraph {
  const offset = 48 + Math.max(0, pasteIndex) * 24;
  const nodeIdMap = new Map<string, string>();

  const nodes = fragment.nodes.map((node) => {
    const id = createNodeId();
    nodeIdMap.set(node.id, id);

    return {
      id,
      canvas_id: canvasId,
      title: node.title,
      body: node.body,
      tags: cloneTags(node.tags),
      x: node.x + offset,
      y: node.y + offset,
      collapsed: node.collapsed
    };
  });

  const edges = fragment.edges
    .map((edge) => {
      const source_node_id = nodeIdMap.get(edge.source_node_id);
      const target_node_id = nodeIdMap.get(edge.target_node_id);

      if (!source_node_id || !target_node_id) {
        return null;
      }

      return {
        id: createEdgeId(),
        canvas_id: canvasId,
        source_node_id,
        target_node_id
      };
    })
    .filter((edge): edge is PastedEdge => edge !== null);

  return { nodes, edges };
}

export function getConnectedEdgeIds(edges: Edge[], selectedNodeIds: string[]) {
  const selectedIds = new Set(selectedNodeIds);

  return edges
    .filter((edge) => selectedIds.has(edge.source_node_id) || selectedIds.has(edge.target_node_id))
    .map((edge) => edge.id);
}

