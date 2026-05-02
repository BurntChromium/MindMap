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

export type DiscoveryState = {
  tagSummaries: TagSummary[];
  searchResults: DiscoveryNode[];
  searchHitIds: Set<string>;
};

let cachedTagSummaryNodes: DiscoveryNode[] | null = null;
let cachedTagSummaries: TagSummary[] = [];
let cachedSearchNodes: DiscoveryNode[] | null = null;
let cachedSearchQuery = '';
let cachedSearchTag: string | null = null;
let cachedSearchResults: DiscoveryNode[] = [];
let cachedSearchHitIds = new Set<string>();

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

export function createDiscoveryState(
  nodes: DiscoveryNode[],
  query: string,
  activeTag: string | null
): DiscoveryState {
  const normalizedQuery = normalizeQuery(query);
  const normalizedTag = activeTag ? normalizeTagName(activeTag) : null;

  if (cachedTagSummaryNodes !== nodes) {
    const tagCounts = new Map<string, number>();

    for (const node of nodes) {
      for (const tag of normalizeTagList(node.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    cachedTagSummaryNodes = nodes;
    cachedTagSummaries = Array.from(tagCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        color: getTagColor(name)
      }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  }

  if (
    cachedSearchNodes !== nodes ||
    cachedSearchQuery !== normalizedQuery ||
    cachedSearchTag !== normalizedTag
  ) {
    const searchResults: DiscoveryNode[] = [];
    const searchHitIds = new Set<string>();
    const shouldFilter = Boolean(normalizedQuery || normalizedTag);

    if (shouldFilter) {
      for (const node of nodes) {
        const normalizedTags = normalizeTagList(node.tags);
        const matchesKeyword = !normalizedQuery || nodeMatchesKeyword(node, normalizedQuery);
        const matchesTag = !normalizedTag || normalizedTags.includes(normalizedTag);

        if (matchesKeyword && matchesTag) {
          searchResults.push(node);
          searchHitIds.add(node.id);
        }
      }
    }

    cachedSearchNodes = nodes;
    cachedSearchQuery = normalizedQuery;
    cachedSearchTag = normalizedTag;
    cachedSearchResults = searchResults;
    cachedSearchHitIds = searchHitIds;
  }

  return {
    tagSummaries: cachedTagSummaries,
    searchResults: cachedSearchResults,
    searchHitIds: cachedSearchHitIds
  };
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
