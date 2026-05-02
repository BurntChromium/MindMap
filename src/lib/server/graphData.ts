import { db } from './db';
import { normalizeTagList, normalizeTagName } from '$lib/tagUtils';
import { getTagColor } from '$lib/tagColors';
import { getEntitiesByCanvasId, getEntityMentionsByCanvasId } from '$lib/server/entities';

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
  is_entity: number;
  tags: string[];
  x: number;
  y: number;
  collapsed: number;
  created_at: number;
  updated_at: number;
};

export type NodeTitleRow = {
  id: string;
  title: string;
};

export type TagRow = {
  id: string;
  name: string;
  color: string;
  node_count: number;
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

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
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

export function getNodeTitlesByCanvasId(canvasId: string | null) {
  if (!canvasId) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT id, title
        FROM nodes
        WHERE canvas_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(canvasId) as NodeTitleRow[];
}

export function getTagsByCanvasId(canvasId: string | null) {
  if (!canvasId) {
    return [];
  }

  return (db
    .prepare(`
      SELECT
        t.id,
        t.name,
        t.color AS color,
        COUNT(nt.node_id) AS node_count
      FROM tags t
      JOIN node_tags nt ON nt.tag_id = t.id
      JOIN nodes n ON n.id = nt.node_id
      WHERE n.canvas_id = ?
      GROUP BY t.id, t.name, t.color
      ORDER BY node_count DESC, t.name ASC
    `)
    .all(canvasId) as Array<Record<string, unknown>>).map((tag) => ({
      id: String(tag.id),
      name: String(tag.name),
      color: typeof tag.color === 'string' && tag.color ? tag.color : getTagColor(String(tag.name)),
      node_count: Number(tag.node_count ?? 0)
    })) as TagRow[];
}

export function searchNodesByCanvasId(
  canvasId: string | null,
  query: string,
  activeTag: string | null = null
) {
  if (!canvasId) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTag = activeTag ? normalizeTagName(activeTag) : '';

  if (!normalizedQuery && !normalizedTag) {
    return [];
  }

  const like = `%${escapeLike(normalizedQuery)}%`;

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
        AND (
          ? = ''
          OR LOWER(COALESCE(n.title, '')) LIKE ? ESCAPE '\\'
          OR LOWER(COALESCE(n.body, '')) LIKE ? ESCAPE '\\'
        )
        AND (
          ? = ''
          OR EXISTS (
            SELECT 1
            FROM node_tags nt
            JOIN tags t ON t.id = nt.tag_id
            WHERE nt.node_id = n.id
              AND t.name = ?
          )
        )
      ORDER BY n.created_at ASC
    `)
    .all(canvasId, normalizedQuery, like, like, normalizedTag, normalizedTag) as Array<
    Record<string, unknown> & { tags?: unknown }
  >)
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
    edges: getEdgesByCanvasId(activeCanvasId),
    tags: getTagsByCanvasId(activeCanvasId),
    entities: getEntitiesByCanvasId(activeCanvasId),
    entityMentions: getEntityMentionsByCanvasId(activeCanvasId)
  };
}
