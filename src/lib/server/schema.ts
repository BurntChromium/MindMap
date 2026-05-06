import { db } from './db';

export function initSchema(database = db) {
	database.exec(`
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
      is_entity INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      title TEXT NOT NULL,
      title_key TEXT NOT NULL,
      primary_node_id TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
      FOREIGN KEY(primary_node_id) REFERENCES nodes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS entity_mentions (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      reference_text TEXT NOT NULL,
      title TEXT NOT NULL,
      title_key TEXT NOT NULL,
      start_index INTEGER NOT NULL,
      end_index INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER,
      FOREIGN KEY(canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
      FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
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

    CREATE INDEX IF NOT EXISTS idx_node_tags_tag_id
      ON node_tags(tag_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_canvas_title_key
      ON entities(canvas_id, title_key);

    CREATE INDEX IF NOT EXISTS idx_entities_canvas_id
      ON entities(canvas_id);

    CREATE INDEX IF NOT EXISTS idx_entities_primary_node_id
      ON entities(primary_node_id);

    CREATE INDEX IF NOT EXISTS idx_entity_mentions_canvas_id
      ON entity_mentions(canvas_id);

    CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id
      ON entity_mentions(entity_id);

    CREATE INDEX IF NOT EXISTS idx_entity_mentions_node_id
      ON entity_mentions(node_id);
  `);

	const nodeColumns = database
		.prepare(`PRAGMA table_info(nodes)`)
		.all() as Array<{ name: string }>;
	const hasEntityColumn = nodeColumns.some(
		(column) => column.name === 'is_entity',
	);

	if (!hasEntityColumn) {
		database.exec(`
      ALTER TABLE nodes ADD COLUMN is_entity INTEGER DEFAULT 0;
    `);
	}
}
