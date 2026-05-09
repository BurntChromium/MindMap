import type { DiscoveryNode, TagSummary } from '$lib/discovery';
import {
	formatTagLabel,
	normalizeTagList,
	normalizeTagName,
} from '$lib/tagUtils';
import { searchDocuments } from '$lib/search/searchCore';

export type BulkTagMutation = {
	id: string;
	tags: string[];
};

export function buildTagColorMap(
	tagSummaries: TagSummary[],
): Record<string, string> {
	return Object.fromEntries(
		tagSummaries.map((tag) => [tag.name, tag.color]),
	) as Record<string, string>;
}

export function getActiveFilterLabel(
	searchQuery: string,
	activeTag: string | null,
) {
	const filters: string[] = [];

	if (searchQuery.trim()) {
		filters.push(`"${searchQuery.trim()}"`);
	}

	if (activeTag) {
		filters.push(formatTagLabel(activeTag));
	}

	return filters.length ? filters.join(' + ') : 'none';
}

export function toggleActiveTagFilter(
	currentActiveTag: string | null,
	tag: string,
) {
	const normalizedTag = normalizeTagName(tag);

	return currentActiveTag === normalizedTag ? null : normalizedTag;
}

export function shouldClearFocusedNode(
	focusedNodeId: string | null,
	searchQuery: string,
	activeTag: string | null,
	searchHitIds: Set<string>,
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
	bodyElement: HTMLElement | null = null,
) {
	return shouldBlockCanvasInteractionShortcut(
		activeElement,
		canvasShell,
		bodyElement,
	);
}

export function shouldBlockCanvasInteractionShortcut(
	activeElement: Element | null,
	canvasShell: HTMLElement | undefined,
	bodyElement: HTMLElement | null = null,
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
	activeTag: string | null,
) {
	return new Set(
		searchDocuments(nodes, {
			query: searchQuery,
			tag: activeTag,
		}).map((node) => node.id),
	);
}

export function buildBulkTagMutations(
	nodes: Pick<DiscoveryNode, 'id' | 'tags'>[],
	selectedNodeIds: string[],
	tag: string,
	mode: 'add' | 'remove',
) {
	const normalizedTag = normalizeTagName(tag);

	if (!normalizedTag || selectedNodeIds.length === 0) {
		return [];
	}

	const selectedIds = new Set(selectedNodeIds);
	const mutations: BulkTagMutation[] = [];

	for (const node of nodes) {
		if (!selectedIds.has(node.id)) {
			continue;
		}

		const currentTags = normalizeTagList(node.tags);
		const nextTags =
			mode === 'add'
				? normalizeTagList([...currentTags, normalizedTag])
				: currentTags.filter((currentTag) => currentTag !== normalizedTag);

		if (currentTags.join('\u0000') !== nextTags.join('\u0000')) {
			mutations.push({
				id: node.id,
				tags: nextTags,
			});
		}
	}

	return mutations;
}
