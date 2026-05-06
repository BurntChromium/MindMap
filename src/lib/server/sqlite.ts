import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(dbPath: string) {
	mkdirSync(dirname(dbPath), { recursive: true });

	const database = new Database(dbPath);

	database.pragma('foreign_keys = ON');

	return database;
}
