import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';

export type CustomNodeEditField = 'title' | 'tag' | 'body';

export function getNextEditField(
	current: CustomNodeEditField,
	hasTagInput: boolean,
) {
	if (current === 'title') {
		return hasTagInput ? 'tag' : 'body';
	}

	if (current === 'tag') {
		return 'body';
	}

	return 'title';
}

export function parsePastedTags(pasted: string) {
	return normalizeTagList(
		pasted
			.split(/[\n,]+/)
			.map((tag) => normalizeTagName(tag))
			.filter(Boolean),
	);
}
