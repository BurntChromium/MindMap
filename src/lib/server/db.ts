import Database from 'better-sqlite3';
import { dev } from '$app/environment';

const dbPath = process.env.MINDMAP_DB_PATH ?? (dev ? 'dev.db' : '/data/prod.db');

export const db = new Database(dbPath);

// Enable FK constraints
db.pragma('foreign_keys = ON');
