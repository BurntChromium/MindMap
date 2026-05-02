import { openDatabase } from './sqlite';

export const dbPath = process.env.MINDMAP_DB_PATH ?? 'dev.db';

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
