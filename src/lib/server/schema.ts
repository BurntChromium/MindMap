import { db } from './db';

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      canvas_id TEXT,
      title TEXT,
      body TEXT,
      x REAL,
      y REAL,
      collapsed INTEGER,
      color TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      canvas_id TEXT,
      source_node_id TEXT,
      target_node_id TEXT,
      FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS node_tags (
      node_id TEXT,
      tag_id TEXT,
      PRIMARY KEY (node_id, tag_id),
      FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_canvas_created_at
      ON nodes(canvas_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_edges_canvas_id
      ON edges(canvas_id);
  `);
}
