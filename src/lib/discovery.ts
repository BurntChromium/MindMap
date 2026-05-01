import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';
import { getTagColor } from '$lib/tagColors';

export type DiscoveryNode = {
  id: string;
  title: string;
  body: string;
  tags: string[];
};

export type TagSummary = {
  name: string;
  color: string;
  count: number;
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function nodeMatchesKeyword(node: DiscoveryNode, query: string) {
  if (!query) {
    return true;
  }

  const haystack = `${node.title} ${node.body}`.toLowerCase();
  return haystack.includes(query);
}

function nodeMatchesTag(node: DiscoveryNode, tag: string | null) {
  if (!tag) {
    return true;
  }

  return normalizeTagList(node.tags).includes(normalizeTagName(tag));
}

export function collectTagSummaries(nodes: DiscoveryNode[]) {
  const tagCounts = new Map<string, number>();

  for (const node of nodes) {
    for (const tag of normalizeTagList(node.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      color: getTagColor(name)
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function filterDiscoveryNodes(
  nodes: DiscoveryNode[],
  query: string,
  activeTag: string | null
) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedTag = activeTag ? normalizeTagName(activeTag) : null;

  if (!normalizedQuery && !normalizedTag) {
    return [];
  }

  return nodes.filter(
    (node) => nodeMatchesKeyword(node, normalizedQuery) && nodeMatchesTag(node, normalizedTag)
  );
}

export function discoveryMatchesNode(
  node: DiscoveryNode,
  query: string,
  activeTag: string | null
) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedTag = activeTag ? normalizeTagName(activeTag) : null;

  if (!normalizedQuery && !normalizedTag) {
    return false;
  }

  return nodeMatchesKeyword(node, normalizedQuery) && nodeMatchesTag(node, normalizedTag);
}

