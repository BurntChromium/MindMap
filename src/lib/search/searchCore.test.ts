import { describe, expect, it } from 'vitest';
import {
	createSearchHitIdSet,
	searchDocuments,
	tokenizeSearchQuery,
} from './searchCore';

describe('searchCore', () => {
	it('tokenizes queries into unique terms', () => {
		expect(tokenizeSearchQuery('Dragon  dragon! shire')).toEqual([
			'dragon',
			'shire',
		]);
	});

	it('filters by all query terms and ranks title, tag, then body matches', () => {
		const results = searchDocuments(
			[
				{
					id: 'title',
					title: 'Dragon keeper',
					body: 'A quiet note.',
					tags: ['npc'],
				},
				{
					id: 'tag',
					title: 'Index',
					body: 'Something else.',
					tags: ['npc', 'dragon'],
				},
				{
					id: 'body',
					title: 'Notes',
					body: 'The dragon sleeps below the mountain.',
					tags: ['npc'],
				},
				{
					id: 'miss',
					title: 'Guide',
					body: 'Nothing useful here.',
					tags: ['npc'],
				},
			],
			{ query: 'dragon', tag: 'npc' },
		);

		expect(results.map((node) => node.id)).toEqual(['title', 'tag', 'body']);
		expect(createSearchHitIdSet(results)).toEqual(
			new Set(['title', 'tag', 'body']),
		);
	});

	it('requires all terms to match', () => {
		const results = searchDocuments(
			[
				{
					id: 'match',
					title: 'Dragon in the shire',
					body: 'Travel notes.',
					tags: ['lore'],
				},
				{
					id: 'miss',
					title: 'Dragon only',
					body: 'Travel notes.',
					tags: ['lore'],
				},
			],
			{ query: 'dragon shire', tag: null },
		);

		expect(results.map((node) => node.id)).toEqual(['match']);
	});
});
