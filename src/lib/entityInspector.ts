import type { DiscoveryNode } from '$lib/discovery';
import type { Entity, EntityMention } from '$lib/stores/entityStore';

export type EntityInspectorNodeRef = {
  id: string;
  title: string;
  mentionCount: number;
  firstReferenceText: string | null;
  isPrimary: boolean;
};

export type EntityInspectorEntry = {
  id: string;
  title: string;
  titleKey: string;
  mentionCount: number;
  sourceNodeCount: number;
  primaryNode: EntityInspectorNodeRef | null;
  childNodes: EntityInspectorNodeRef[];
  flatNodes: EntityInspectorNodeRef[];
};

function createNodeRef(
  node: DiscoveryNode,
  mentionCount: number,
  firstReferenceText: string | null,
  isPrimary: boolean
): EntityInspectorNodeRef {
  return {
    id: node.id,
    title: node.title,
    mentionCount,
    firstReferenceText,
    isPrimary
  };
}

export function buildEntityInspectorEntries(
  entities: Entity[],
  mentions: EntityMention[],
  nodes: DiscoveryNode[]
): EntityInspectorEntry[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mentionsByEntityId = new Map<string, EntityMention[]>();

  for (const mention of mentions) {
    const current = mentionsByEntityId.get(mention.entity_id) ?? [];
    current.push(mention);
    mentionsByEntityId.set(mention.entity_id, current);
  }

  return entities.map((entity) => {
    const entityMentions = mentionsByEntityId.get(entity.id) ?? [];
    const refsByNodeId = new Map<
      string,
      { mentionCount: number; firstReferenceText: string | null }
    >();

    for (const mention of entityMentions) {
      const current = refsByNodeId.get(mention.node_id) ?? {
        mentionCount: 0,
        firstReferenceText: null
      };

      refsByNodeId.set(mention.node_id, {
        mentionCount: current.mentionCount + 1,
        firstReferenceText: current.firstReferenceText ?? mention.reference_text
      });
    }

    const refs = Array.from(refsByNodeId.entries())
      .map(([nodeId, ref]) => {
        const node = nodeById.get(nodeId);

        if (!node) {
          return null;
        }

        return createNodeRef(node, ref.mentionCount, ref.firstReferenceText, false);
      })
      .filter((ref): ref is EntityInspectorNodeRef => Boolean(ref))
      .sort((left, right) => left.title.localeCompare(right.title));

    const primaryNode = entity.primary_node_id
      ? nodeById.get(entity.primary_node_id) ?? null
      : null;
    const primaryMentionInfo = entity.primary_node_id
      ? refsByNodeId.get(entity.primary_node_id) ?? { mentionCount: 0, firstReferenceText: null }
      : null;
    const primaryRef = primaryNode
      ? createNodeRef(
          primaryNode,
          primaryMentionInfo?.mentionCount ?? 0,
          primaryMentionInfo?.firstReferenceText ?? null,
          true
        )
      : null;
    const childNodes = primaryRef
      ? refs.filter((ref) => ref.id !== primaryRef.id)
      : [];
    const flatNodes = primaryRef ? [] : refs;

    return {
      id: entity.id,
      title: entity.title,
      titleKey: entity.title_key,
      mentionCount: entity.mention_count,
      sourceNodeCount: refs.length,
      primaryNode: primaryRef,
      childNodes,
      flatNodes
    };
  });
}
