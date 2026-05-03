import { openDatabase } from './sqlite';

const defaultDbPath = import.meta.env.DEV ? 'dev.db' : 'mindmap.db';

export const dbPath = process.env.MINDMAP_DB_PATH ?? defaultDbPath;

export let db = openDatabase(dbPath);

export function closeDatabase() {
  if (db.open) {
    db.close();
  }
}

export function reopenDatabase() {
  closeDatabase();
  db = openDatabase(dbPath);
  return db;
}
