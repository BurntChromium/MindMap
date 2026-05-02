import type { Edge } from '$lib/stores/edgeStore';
import type { Node } from '$lib/stores/nodeStore';
import { getTagColor } from '$lib/tagColors';

export type BenchmarkFixture = {
  canvasId: string;
  appNodes: Node[];
  appEdges: Edge[];
  selectedNodeIds: string[];
  focusedNodeId: string | null;
  editingNodeId: string | null;
  activeTag: string | null;
  searchQuery: string;
  searchHitIds: Set<string>;
  tagColors: Record<string, string>;
  serverNodes: Array<{
    id: string;
    canvas_id: string;
    title: string;
    body: string;
    tags: string[];
    x: number;
    y: number;
    collapsed: number;
    created_at: number;
    updated_at: number;
  }>;
  serverEdges: Array<{
    id: string;
    canvas_id: string;
    source_node_id: string;
    target_node_id: string;
  }>;
  serverTags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  serverTagLinks: Array<{
    node_id: string;
    tag_id: string;
  }>;
};

type FixtureOptions = {
  canvasId: string;
  nodeCount: number;
  edgeCount: number;
  tagPoolSize?: number;
  variant?: number;
};

function tagName(index: number) {
  return `tag-${String(index).padStart(2, '0')}`;
}

function buildTags(tagPoolSize: number) {
  return Array.from({ length: tagPoolSize }, (_, index) => tagName(index));
}

function buildAppNodes(canvasId: string, nodeCount: number, tags: string[], variant: number) {
  return Array.from({ length: nodeCount }, (_, index) => {
    const primaryTag = tags[(index + variant) % tags.length];
    const secondaryTag = tags[(index + 7 + variant) % tags.length];
    const isKeywordHit = index % 17 === 0;
    const nodeId = `${canvasId}-node-${index}`;

    return {
      id: nodeId,
      canvas_id: canvasId,
      title: isKeywordHit ? `Dragon Node ${index}` : `Node ${index}`,
      body: isKeywordHit
        ? `The dragon keeps the treasure for node ${index}.`
        : `Body ${index} referencing ${primaryTag} and ${secondaryTag}.`,
      is_entity: 1,
      tags: [primaryTag, secondaryTag],
      x: index * 12,
      y: index * 8,
      collapsed: index % 4 === 0 ? 1 : 0
    };
  });
}

function buildAppEdges(canvasId: string, nodeCount: number, edgeCount: number) {
  return Array.from({ length: edgeCount }, (_, index) => ({
    id: `${canvasId}-edge-${index}`,
    canvas_id: canvasId,
    source_node_id: `${canvasId}-node-${index % nodeCount}`,
    target_node_id: `${canvasId}-node-${(index + 1) % nodeCount}`
  }));
}

function buildServerNodes(appNodes: ReturnType<typeof buildAppNodes>) {
  return appNodes.map((node, index) => ({
    ...node,
    created_at: 1_700_000_000_000 + index,
    updated_at: 1_700_000_000_000 + index
  }));
}

function buildServerTags(tags: string[]) {
  return tags.map((name, index) => ({
    id: `tag-${String(index).padStart(2, '0')}`,
    name,
    color: getTagColor(name)
  }));
}

function buildServerTagLinks(nodes: ReturnType<typeof buildAppNodes>, tags: string[]) {
  const tagIdByName = new Map(tags.map((name, index) => [name, `tag-${String(index).padStart(2, '0')}`]));
  const links: BenchmarkFixture['serverTagLinks'] = [];

  for (const node of nodes) {
    for (const tag of node.tags) {
      const tagId = tagIdByName.get(tag);

      if (tagId) {
        links.push({
          node_id: node.id,
          tag_id: tagId
        });
      }
    }
  }

  return links;
}

function buildTagColors(tags: string[]) {
  return Object.fromEntries(tags.map((name) => [name, getTagColor(name)])) as Record<string, string>;
}

export function createBenchmarkFixture({
  canvasId,
  nodeCount,
  edgeCount,
  tagPoolSize = 24,
  variant = 0
}: FixtureOptions): BenchmarkFixture {
  const tags = buildTags(tagPoolSize);
  const appNodes = buildAppNodes(canvasId, nodeCount, tags, variant);
  const appEdges = buildAppEdges(canvasId, nodeCount, edgeCount);
  const focusedNodeId = appNodes[Math.floor(nodeCount / 3)]?.id ?? null;
  const editingNodeId = appNodes[Math.floor(nodeCount / 5)]?.id ?? null;
  const activeTag = tags[(variant + 3) % tags.length] ?? null;
  const searchQuery = 'dragon';
  const selectedNodeIds = appNodes
    .filter((_, index) => index % 9 === 0)
    .slice(0, Math.max(1, Math.floor(nodeCount / 12)))
    .map((node) => node.id);
  const searchHitIds = new Set(
    appNodes
      .filter((node) => node.title.toLowerCase().includes(searchQuery) && node.tags.includes(activeTag ?? ''))
      .map((node) => node.id)
  );

  return {
    canvasId,
    appNodes,
    appEdges,
    selectedNodeIds,
    focusedNodeId,
    editingNodeId,
    activeTag,
    searchQuery,
    searchHitIds,
    tagColors: buildTagColors(tags),
    serverNodes: buildServerNodes(appNodes),
    serverEdges: appEdges.map((edge) => ({ ...edge })),
    serverTags: buildServerTags(tags),
    serverTagLinks: buildServerTagLinks(appNodes, tags)
  };
}
