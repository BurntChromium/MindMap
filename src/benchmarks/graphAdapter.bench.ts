import { bench, describe } from 'vitest';
import { toFlowEdges, toFlowNodes } from '$lib/graph/graphAdapter';
import { createBenchmarkFixture } from './fixtures';

const stableFixture = createBenchmarkFixture({
	canvasId: 'bench-graph',
	nodeCount: 1_000,
	edgeCount: 1_500,
});
const coldFixtures = Array.from({ length: 8 }, (_, index) =>
	createBenchmarkFixture({
		canvasId: `bench-graph-cold-${index}`,
		nodeCount: 1_000,
		edgeCount: 1_500,
		variant: index,
	}),
);
const updateFixtures = Array.from({ length: 8 }, (_, index) =>
	stableFixture.appNodes.map((node, nodeIndex) =>
		nodeIndex === index
			? {
					...node,
					x: node.x + 1,
					y: node.y + 1,
				}
			: node,
	),
);
let coldIndex = 0;
let updateIndex = 0;

describe('graph adapter benchmarks', () => {
	const baseOptions = {
		editingNodeId: stableFixture.editingNodeId,
		focusedNodeId: stableFixture.focusedNodeId,
		selectedNodeIds: stableFixture.selectedNodeIds,
		activeTag: stableFixture.activeTag,
		searchHitIds: stableFixture.searchHitIds,
		tagColors: stableFixture.tagColors,
		onTagClick: () => undefined,
	};

	bench('toFlowNodes warm projection', () => {
		toFlowNodes(stableFixture.appNodes, baseOptions);
	});

	bench('toFlowNodes single-node update', () => {
		const nodes = updateFixtures[updateIndex++ % updateFixtures.length];
		toFlowNodes(nodes, baseOptions);
	});

	bench('toFlowNodes cold canvas', () => {
		const fixture = coldFixtures[coldIndex++ % coldFixtures.length];
		toFlowNodes(fixture.appNodes, {
			...baseOptions,
			focusedNodeId: fixture.focusedNodeId,
			editingNodeId: fixture.editingNodeId,
			selectedNodeIds: fixture.selectedNodeIds,
			activeTag: fixture.activeTag,
			searchHitIds: fixture.searchHitIds,
			tagColors: fixture.tagColors,
		});
	});

	bench('toFlowEdges warm projection', () => {
		toFlowEdges(stableFixture.appEdges);
	});
});
