import { describe, expect, it } from 'vitest';
import { createSyncSearchProvider } from './searchProvider';

describe('searchProvider', () => {
	it('indexes corpus updates and applies incremental changes', async () => {
		const provider = createSyncSearchProvider();

		await provider.replaceCorpus({
			canvasId: 'canvas-1',
			revision: 1,
			documents: [
				{
					id: 'title',
					title: 'Dragon keeper',
					body: 'A quiet note.',
					tags: ['npc'],
				},
				{
					id: 'body',
					title: 'Notes',
					body: 'The dragon sleeps below the mountain.',
					tags: ['npc'],
				},
			],
		});

		const first = await provider.search({
			requestId: 1,
			canvasId: 'canvas-1',
			corpusRevision: 1,
			query: 'dragon',
			tag: 'npc',
		});

		expect(first).toMatchObject({
			requestId: 1,
			canvasId: 'canvas-1',
			corpusRevision: 1,
		});
		expect(first.results.map((node) => node.id)).toEqual(['title', 'body']);

		await provider.applyChanges([
			{
				type: 'upsert',
				document: {
					id: 'tag',
					title: 'Index',
					body: 'Something else.',
					tags: ['npc', 'dragon'],
				},
			},
			{
				type: 'delete',
				id: 'body',
			},
		]);

		const second = await provider.search({
			requestId: 2,
			canvasId: 'canvas-1',
			corpusRevision: 1,
			query: 'dragon',
			tag: 'npc',
		});

		expect(second.results.map((node) => node.id)).toEqual(['title', 'tag']);
	});
});
