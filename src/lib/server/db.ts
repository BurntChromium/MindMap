import Database from 'better-sqlite3';
import { dev } from '$app/environment';
import path from 'path';

const dbPath = dev ? 'dev.db' : '/data/prod.db';

export const db = new Database(dbPath);

// Enable FK constraints
db.pragma('foreign_keys = ON');