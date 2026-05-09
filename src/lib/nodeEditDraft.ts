import { normalizeNodeTitle } from '$lib/nodeTitles';
import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';

export type NodeEditBaseline = {
	title: string;
	body: string;
	tags: string[];
	isEntity: boolean;
};

export type NodeEditDraft = {
	title: string;
	body: string;
	tags: string[];
	tagInput: string;
	isEntity: boolean;
};

function tagKey(tags: string[]) {
	return normalizeTagList(tags).slice().sort().join('\u0000');
}

export function getCommittedNodeEditTags(
	draftTags: string[],
	draftTagInput: string,
) {
	return normalizeTagList([...draftTags, draftTagInput]);
}

export function isNodeEditDraftDirty(
	draft: NodeEditDraft,
	baseline: NodeEditBaseline,
) {
	const nextTitle = normalizeNodeTitle(draft.title || 'Untitled');
	const currentTitle = normalizeNodeTitle(baseline.title || 'Untitled');
	const nextTags = getCommittedNodeEditTags(draft.tags, draft.tagInput);
	const currentTags = normalizeTagList(baseline.tags);
	const nextTagInput = normalizeTagName(draft.tagInput);

	return (
		nextTitle !== currentTitle ||
		draft.body !== baseline.body ||
		tagKey(nextTags) !== tagKey(currentTags) ||
		draft.isEntity !== baseline.isEntity ||
		Boolean(nextTagInput && !currentTags.includes(nextTagInput))
	);
}
