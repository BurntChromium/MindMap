import type { Node } from '$lib/stores/nodeStore';

export type Direction = 'left' | 'right' | 'up' | 'down';

export type NodePoint = Pick<Node, 'id' | 'x' | 'y'>;
type Point = {
  x: number;
  y: number;
};

type CandidateScore = {
  primary: number;
  perpendicular: number;
  distance: number;
};

function getScore(origin: Point, candidate: Point, direction: Direction): CandidateScore | null {
  const dx = candidate.x - origin.x;
  const dy = candidate.y - origin.y;

  switch (direction) {
    case 'left':
      if (dx >= 0) return null;
      return {
        primary: Math.abs(dx),
        perpendicular: Math.abs(dy),
        distance: dx * dx + dy * dy
      };
    case 'right':
      if (dx <= 0) return null;
      return {
        primary: dx,
        perpendicular: Math.abs(dy),
        distance: dx * dx + dy * dy
      };
    case 'up':
      if (dy >= 0) return null;
      return {
        primary: Math.abs(dy),
        perpendicular: Math.abs(dx),
        distance: dx * dx + dy * dy
      };
    case 'down':
      if (dy <= 0) return null;
      return {
        primary: dy,
        perpendicular: Math.abs(dx),
        distance: dx * dx + dy * dy
      };
  }
}

export function getNearestNodeInDirection(
  nodes: NodePoint[],
  originNodeId: string,
  direction: Direction
) {
  const origin = nodes.find((node) => node.id === originNodeId);

  if (!origin) {
    return null;
  }

  let bestNode: NodePoint | null = null;
  let bestScore: CandidateScore | null = null;

  for (const candidate of nodes) {
    if (candidate.id === originNodeId) {
      continue;
    }

    const score = getScore(origin, candidate, direction);

    if (!score) {
      continue;
    }

    if (
      !bestScore ||
      score.primary < bestScore.primary ||
      (score.primary === bestScore.primary && score.perpendicular < bestScore.perpendicular) ||
      (score.primary === bestScore.primary &&
        score.perpendicular === bestScore.perpendicular &&
        score.distance < bestScore.distance)
    ) {
      bestNode = candidate;
      bestScore = score;
    }
  }

  return bestNode?.id ?? null;
}
