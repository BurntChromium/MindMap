import { bench, describe } from 'vitest';
import { edgeStore } from '$lib/stores/edgeStore';
import { nodeStore } from '$lib/stores/nodeStore';
import { createBenchmarkFixture } from './fixtures';

const fixtures = [
  createBenchmarkFixture({
    canvasId: 'bench-hydrate-a',
    nodeCount: 1_000,
    edgeCount: 1_500,
    variant: 0
  }),
  createBenchmarkFixture({
    canvasId: 'bench-hydrate-b',
    nodeCount: 1_000,
    edgeCount: 1_500,
    variant: 1
  })
];
let index = 0;

describe('store hydration benchmarks', () => {
  bench('hydrate canvas state', () => {
    const fixture = fixtures[index++ % fixtures.length];
    nodeStore.hydrate(fixture.appNodes, fixture.canvasId);
    edgeStore.hydrate(fixture.appEdges, fixture.canvasId);
  });
});
