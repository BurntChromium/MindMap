import { describe, expect, it } from 'vitest';
import { buildAssociativeFlowEdges } from './associativeEdges';

describe('associativeEdges', () => {
	it('marks direct, indirect, and mixed associative relations', () => {
		const edges = buildAssociativeFlowEdges(
			[
				{ id: 'node-a', title: 'A' },
				{ id: 'node-b', title: 'B' },
			],
			[
				{
					id: 'entity-direct',
					title: 'Alpha',
					title_key: 'alpha',
					primary_node_id: 'node-a',
				},
				{
					id: 'entity-indirect',
					title: 'Beta',
					title_key: 'beta',
					primary_node_id: null,
				},
			],
			[
				{ entity_id: 'entity-direct', node_id: 'node-b' },
				{ entity_id: 'entity-indirect', node_id: 'node-a' },
				{ entity_id: 'entity-indirect', node_id: 'node-b' },
			],
		);

		expect(edges).toEqual([
			{
				id: 'assoc:node-a:node-b',
				source: 'node-a',
				target: 'node-b',
				sourceHandle: 'source-bottom',
				targetHandle: 'target-top',
				selectable: false,
				deletable: false,
				focusable: false,
				zIndex: 1.5,
				data: {
					kind: 'associative',
					relation: 'mixed',
					sourceNodeId: 'node-a',
					targetNodeId: 'node-b',
					sourceNodeTitle: 'A',
					targetNodeTitle: 'B',
					sharedEntities: [
						{
							id: 'entity-direct',
							title: 'Alpha',
							titleKey: 'alpha',
						},
						{
							id: 'entity-indirect',
							title: 'Beta',
							titleKey: 'beta',
						},
					],
				},
			},
		]);
	});
});
