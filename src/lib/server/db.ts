import { openDatabase } from './sqlite';

const dbPath = process.env.MINDMAP_DB_PATH ?? 'dev.db';

export const db = openDatabase(dbPath);
