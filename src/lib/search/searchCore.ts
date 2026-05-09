import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';

export type SearchDocument = {
	id: string;
	title: string;
	body: string;
	tags: string[];
	created_at?: number;
	updated_at?: number;
};

export type SearchResult = SearchDocument & {
	score: number;
};

export type SearchQuery = {
	query: string;
	tag: string | null;
	limit?: number;
};

export type SearchCorpusSnapshot = {
	canvasId: string;
	revision: number;
	documents: SearchDocument[];
};

const tokenPattern = /[\p{L}\p{N}]+/gu;

function tokenize(value: string) {
	return Array.from(value.toLowerCase().matchAll(tokenPattern), (match) => {
		return match[0];
	});
}

function normalizeQuery(query: string) {
	return query.trim().toLowerCase();
}

function uniqueTokens(tokens: string[]) {
	return Array.from(new Set(tokens));
}

function compareResults(left: SearchResult, right: SearchResult) {
	if (right.score !== left.score) {
		return right.score - left.score;
	}

	const leftCreatedAt =
		typeof left.created_at === 'number' ? left.created_at : null;
	const rightCreatedAt =
		typeof right.created_at === 'number' ? right.created_at : null;

	if (
		leftCreatedAt !== null &&
		rightCreatedAt !== null &&
		leftCreatedAt !== rightCreatedAt
	) {
		return leftCreatedAt - rightCreatedAt;
	}

	const titleComparison = left.title.localeCompare(right.title);

	if (titleComparison !== 0) {
		return titleComparison;
	}

	return left.id.localeCompare(right.id);
}

export function normalizeSearchDocumentTags(tags: string[]) {
	return normalizeTagList(tags);
}

export function tokenizeSearchQuery(query: string) {
	return uniqueTokens(tokenize(normalizeQuery(query)));
}

function buildDocumentTokens(document: SearchDocument) {
	const titleTokens = new Set(tokenize(document.title ?? ''));
	const bodyTokens = new Set(tokenize(document.body ?? ''));
	const tags = normalizeSearchDocumentTags(document.tags ?? []);
	const tagTokens = new Set(tags.flatMap((tag) => tokenize(tag)));
	const allTokens = new Set([...titleTokens, ...bodyTokens, ...tagTokens]);

	return {
		titleTokens,
		bodyTokens,
		tagTokens,
		allTokens,
		normalizedTags: tags,
	};
}

export function searchDocuments(
	documents: SearchDocument[],
	query: SearchQuery,
): SearchResult[] {
	const queryTokens = tokenizeSearchQuery(query.query);
	const normalizedTag = query.tag ? normalizeTagName(query.tag) : '';

	if (!queryTokens.length && !normalizedTag) {
		return [];
	}

	const results: SearchResult[] = [];

	for (const document of documents) {
		const tokens = buildDocumentTokens(document);

		if (normalizedTag && !tokens.normalizedTags.includes(normalizedTag)) {
			continue;
		}

		if (queryTokens.some((token) => !tokens.allTokens.has(token))) {
			continue;
		}

		let score = 0;

		for (const token of queryTokens) {
			if (tokens.titleTokens.has(token)) {
				score += 300;
			} else if (tokens.tagTokens.has(token)) {
				score += 200;
			} else if (tokens.bodyTokens.has(token)) {
				score += 100;
			}
		}

		if (normalizedTag) {
			score += 25;
		}

		if (queryTokens.every((token) => tokens.titleTokens.has(token))) {
			score += 50;
		}

		results.push({
			...document,
			tags: tokens.normalizedTags,
			score,
		});
	}

	results.sort(compareResults);

	if (typeof query.limit === 'number' && query.limit >= 0) {
		return results.slice(0, query.limit);
	}

	return results;
}

export function createSearchHitIdSet(results: SearchResult[]) {
	return new Set(results.map((result) => result.id));
}
