import { db } from './db';
import { normalizeTagList } from '$lib/tagUtils';

export type CanvasRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

export type NodeRow = {
  id: string;
  canvas_id: string;
  title: string;
  body: string;
  tags: string[];
  x: number;
  y: number;
  collapsed: number;
  created_at: number;
  updated_at: number;
};

export type EdgeRow = {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
};

function parseTags(rawTags: unknown) {
  if (typeof rawTags !== 'string' || !rawTags) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? normalizeTagList(parsed) : [];
  } catch {
    return [];
  }
}

export function getCanvases() {
  return db
    .prepare('SELECT * FROM canvases ORDER BY updated_at DESC')
    .all() as CanvasRow[];
}

export function getNodesByCanvasId(canvasId: string | null) {
  if (!canvasId) {
    return [];
  }

  return (db
    .prepare(`
      SELECT
        n.*,
        COALESCE((
          SELECT json_group_array(tag_name)
          FROM (
            SELECT t.name AS tag_name
            FROM node_tags nt
            JOIN tags t ON t.id = nt.tag_id
            WHERE nt.node_id = n.id
            ORDER BY nt.rowid
          )
        ), '[]') AS tags
      FROM nodes n
      WHERE n.canvas_id = ?
      ORDER BY n.created_at ASC
    `)
    .all(canvasId) as Array<Record<string, unknown> & { tags?: unknown }>)
    .map((node) => ({
      ...node,
      tags: parseTags(node.tags)
    })) as NodeRow[];
}

export function getEdgesByCanvasId(canvasId: string | null) {
  if (!canvasId) {
    return [];
  }

  return db
    .prepare('SELECT * FROM edges WHERE canvas_id = ?')
    .all(canvasId) as EdgeRow[];
}

export function getInitialPageData() {
  const canvases = getCanvases();
  const activeCanvasId = canvases[0]?.id ?? null;

  return {
    canvases,
    activeCanvasId,
    nodes: getNodesByCanvasId(activeCanvasId),
    edges: getEdgesByCanvasId(activeCanvasId)
  };
}
