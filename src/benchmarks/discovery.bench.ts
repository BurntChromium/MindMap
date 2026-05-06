import { bench, describe } from 'vitest';
import { createDiscoveryState } from '$lib/discovery';
import { createBenchmarkFixture } from './fixtures';

const baseFixture = createBenchmarkFixture({
	canvasId: 'bench-discovery',
	nodeCount: 1_000,
	edgeCount: 1_200,
});
const coldFixtures = Array.from({ length: 8 }, (_, index) =>
	createBenchmarkFixture({
		canvasId: `bench-discovery-cold-${index}`,
		nodeCount: 1_000,
		edgeCount: 1_200,
		variant: index,
	}),
);
const searchQueries = ['dragon', 'treasure', 'tag-01', 'node'];
let queryIndex = 0;
let coldIndex = 0;

describe('discovery benchmarks', () => {
	bench('createDiscoveryState cached repeat', () => {
		createDiscoveryState(
			baseFixture.appNodes,
			baseFixture.searchQuery,
			baseFixture.activeTag,
		);
	});

	bench('createDiscoveryState query churn', () => {
		const query = searchQueries[queryIndex++ % searchQueries.length];
		createDiscoveryState(baseFixture.appNodes, query, baseFixture.activeTag);
	});

	bench('createDiscoveryState cold canvas', () => {
		const fixture = coldFixtures[coldIndex++ % coldFixtures.length];
		createDiscoveryState(
			fixture.appNodes,
			fixture.searchQuery,
			fixture.activeTag,
		);
	});
});
