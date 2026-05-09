import type { Entity, EntityMention } from '$lib/stores/entityStore';
import type { Node } from '$lib/stores/nodeStore';

export type AssociativeEdgeEntity = {
	id: string;
	title: string;
	titleKey: string;
};

export type AssociativeEdgeData = {
	kind: 'associative';
	relation: AssociativeEdgeRelation;
	sourceNodeId: string;
	targetNodeId: string;
	sourceNodeTitle: string;
	targetNodeTitle: string;
	sharedEntities: AssociativeEdgeEntity[];
};

export type AssociativeEdgeRelation = 'direct' | 'indirect' | 'mixed';

export type AssociativeFlowEdge = {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
	selectable: false;
	deletable: false;
	focusable: false;
	zIndex: number;
	style?: string;
	data: AssociativeEdgeData;
};

type NodeLike = Pick<Node, 'id' | 'title'>;
type EntityLike = Pick<
	Entity,
	'id' | 'title' | 'title_key' | 'primary_node_id'
>;
type MentionLike = Pick<EntityMention, 'entity_id' | 'node_id'>;

function pairKey(left: string, right: string) {
	return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function sortEntities(
	left: AssociativeEdgeEntity,
	right: AssociativeEdgeEntity,
) {
	if (left.titleKey !== right.titleKey) {
		return left.titleKey.localeCompare(right.titleKey);
	}

	return left.title.localeCompare(right.title);
}

function resolveAssociativeEdgeRelation(
	hasDirect: boolean,
	hasIndirect: boolean,
): AssociativeEdgeRelation {
	if (hasDirect && hasIndirect) {
		return 'mixed';
	}

	return hasDirect ? 'direct' : 'indirect';
}

export function getAssociativeEdgeStyle(relation: AssociativeEdgeRelation) {
	return relation === 'indirect'
		? 'stroke-dasharray: 1 6; stroke-linecap: round;'
		: 'stroke-dasharray: 6 5;';
}

export function buildAssociativeFlowEdges(
	nodes: NodeLike[],
	entities: EntityLike[],
	mentions: MentionLike[],
): AssociativeFlowEdge[] {
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const mentionsByEntityId = new Map<string, Set<string>>();

	for (const mention of mentions) {
		if (!nodeById.has(mention.node_id)) {
			continue;
		}

		const current =
			mentionsByEntityId.get(mention.entity_id) ?? new Set<string>();
		current.add(mention.node_id);
		mentionsByEntityId.set(mention.entity_id, current);
	}

	const edgesByPair = new Map<
		string,
		{
			source: string;
			target: string;
			sharedEntities: AssociativeEdgeEntity[];
			hasDirect: boolean;
			hasIndirect: boolean;
		}
	>();

	for (const entity of entities) {
		const involvedNodeIds = new Set<string>(
			mentionsByEntityId.get(entity.id) ?? [],
		);

		if (entity.primary_node_id && nodeById.has(entity.primary_node_id)) {
			involvedNodeIds.add(entity.primary_node_id);
		}

		const nodeIds = Array.from(involvedNodeIds).sort();

		if (nodeIds.length < 2) {
			continue;
		}

		const entitySummary: AssociativeEdgeEntity = {
			id: entity.id,
			title: entity.title,
			titleKey: entity.title_key,
		};

		for (let leftIndex = 0; leftIndex < nodeIds.length - 1; leftIndex += 1) {
			for (
				let rightIndex = leftIndex + 1;
				rightIndex < nodeIds.length;
				rightIndex += 1
			) {
				const source = nodeIds[leftIndex];
				const target = nodeIds[rightIndex];
				const key = pairKey(source, target);
				const current = edgesByPair.get(key) ?? {
					source,
					target,
					sharedEntities: [],
					hasDirect: false,
					hasIndirect: false,
				};
				const isDirect = Boolean(
					entity.primary_node_id &&
					(entity.primary_node_id === source ||
						entity.primary_node_id === target),
				);

				current.sharedEntities.push(entitySummary);
				current.hasDirect ||= isDirect;
				current.hasIndirect ||= !isDirect;
				edgesByPair.set(key, current);
			}
		}
	}

	return Array.from(edgesByPair.values())
		.map((edge) => {
			const sourceNode = nodeById.get(edge.source);
			const targetNode = nodeById.get(edge.target);
			const sharedEntities = [...edge.sharedEntities].sort(sortEntities);
			const relation = resolveAssociativeEdgeRelation(
				edge.hasDirect,
				edge.hasIndirect,
			);

			return {
				id: `assoc:${edge.source}:${edge.target}`,
				source: edge.source,
				target: edge.target,
				sourceHandle: 'source-bottom',
				targetHandle: 'target-top',
				selectable: false as const,
				deletable: false as const,
				focusable: false as const,
				zIndex: 999,
				data: {
					kind: 'associative' as const,
					relation,
					sourceNodeId: edge.source,
					targetNodeId: edge.target,
					sourceNodeTitle: sourceNode?.title || 'Untitled',
					targetNodeTitle: targetNode?.title || 'Untitled',
					sharedEntities,
				},
			};
		})
		.sort((left, right) => {
			if (left.source !== right.source) {
				return left.source.localeCompare(right.source);
			}

			return left.target.localeCompare(right.target);
		});
}
