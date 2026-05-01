import type { DiscoveryNode, TagSummary } from '$lib/discovery';
import { formatTagLabel, normalizeTagName } from '$lib/tagUtils';

export function buildTagColorMap(tagSummaries: TagSummary[]): Record<string, string> {
  return Object.fromEntries(tagSummaries.map((tag) => [tag.name, tag.color])) as Record<
    string,
    string
  >;
}

export function getActiveFilterLabel(searchQuery: string, activeTag: string | null) {
  const filters: string[] = [];

  if (searchQuery.trim()) {
    filters.push(`"${searchQuery.trim()}"`);
  }

  if (activeTag) {
    filters.push(formatTagLabel(activeTag));
  }

  return filters.length ? filters.join(' + ') : 'none';
}

export function toggleActiveTagFilter(currentActiveTag: string | null, tag: string) {
  const normalizedTag = normalizeTagName(tag);

  return currentActiveTag === normalizedTag ? null : normalizedTag;
}

export function shouldClearFocusedNode(
  focusedNodeId: string | null,
  searchQuery: string,
  activeTag: string | null,
  searchHitIds: Set<string>
) {
  if (!focusedNodeId) {
    return false;
  }

  if (!(searchQuery.trim() || activeTag)) {
    return false;
  }

  return !searchHitIds.has(focusedNodeId);
}

export function shouldBlockCreateNodeShortcut(
  activeElement: Element | null,
  canvasShell: HTMLElement | undefined,
  bodyElement: HTMLElement | null = null
) {
  const isHTMLElementAvailable = typeof HTMLElement !== 'undefined';

  return (
    isHTMLElementAvailable &&
    activeElement instanceof HTMLElement &&
    !!canvasShell &&
    !canvasShell.contains(activeElement) &&
    activeElement !== bodyElement
  );
}

export function shouldCommitCanvasRename(relatedTarget: EventTarget | null) {
  const isHTMLElementAvailable = typeof HTMLElement !== 'undefined';

  return !(
    isHTMLElementAvailable &&
    relatedTarget instanceof HTMLElement &&
    relatedTarget.closest('.sidebar-row-actions') !== null
  );
}

export function getSearchHitIds(
  nodes: DiscoveryNode[],
  searchQuery: string,
  activeTag: string | null
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedTag = activeTag ? normalizeTagName(activeTag) : null;

  if (!normalizedQuery && !normalizedTag) {
    return new Set<string>();
  }

  const result = new Set<string>();

  for (const node of nodes) {
    const haystack = `${node.title} ${node.body}`.toLowerCase();
    const matchesKeyword = !normalizedQuery || haystack.includes(normalizedQuery);
    const matchesTag = !normalizedTag || node.tags.map(normalizeTagName).includes(normalizedTag);

    if (matchesKeyword && matchesTag) {
      result.add(node.id);
    }
  }

  return result;
}
