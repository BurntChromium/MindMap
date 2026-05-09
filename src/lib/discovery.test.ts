import { describe, expect, it } from 'vitest';
import {
	collectTagSummaries,
	createDiscoveryState,
	filterDiscoveryNodes,
} from './discovery';

describe('discovery helpers', () => {
	const nodes = [
		{
			id: '1',
			title: 'Smaug',
			body: 'Dragon in the mountain',
			tags: ['lore', 'npc'],
		},
		{
			id: '2',
			title: 'Bilbo',
			body: 'Thief and traveler',
			tags: ['npc'],
		},
	];

	it('summarizes tags with counts and colors', () => {
		const tags = collectTagSummaries(nodes);

		expect(tags).toEqual([
			expect.objectContaining({
				name: 'npc',
				count: 2,
				color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			}),
			expect.objectContaining({
				name: 'lore',
				count: 1,
				color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
			}),
		]);
	});

	it('filters nodes by keyword and tag together', () => {
		expect(
			filterDiscoveryNodes(nodes, 'dragon', null).map((node) => node.id),
		).toEqual(['1']);
		expect(
			filterDiscoveryNodes(nodes, '', 'npc').map((node) => node.id),
		).toEqual(['2', '1']);
		expect(
			filterDiscoveryNodes(nodes, 'dragon', 'npc').map((node) => node.id),
		).toEqual(['1']);
		expect(filterDiscoveryNodes(nodes, '', null)).toEqual([]);
	});

	it('derives tag summaries and search hits in a single pass', () => {
		const state = createDiscoveryState(nodes, 'dragon', 'npc');

		expect(state.tagSummaries).toEqual([
			expect.objectContaining({
				name: 'npc',
				count: 2,
				color: expect.any(String),
			}),
			expect.objectContaining({
				name: 'lore',
				count: 1,
				color: expect.any(String),
			}),
		]);
		expect(state.searchResults.map((node) => node.id)).toEqual(['1']);
		expect(Array.from(state.searchHitIds)).toEqual(['1']);
	});
});
