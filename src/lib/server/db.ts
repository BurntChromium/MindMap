import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { openDatabase } from './sqlite';

const defaultDbFileName = import.meta.env.DEV ? 'dev.db' : 'mindmap.db';
const defaultDbPath = process.env.MINDMAP_DB_PATH ?? defaultDbFileName;
const databaseDirectory = dirname(defaultDbPath);
const databaseSettingsPath = join(databaseDirectory, 'mindmap.config.json');

type DatabaseSettings = {
  databaseFileName?: unknown;
};

function isValidDatabaseFileName(fileName: string) {
  const trimmed = fileName.trim();

  return (
    trimmed.length > 0 &&
    trimmed !== '.' &&
    trimmed !== '..' &&
    basename(trimmed) === trimmed &&
    !trimmed.includes('\0')
  );
}

function readDatabaseFileNameFromSettings() {
  if (!existsSync(databaseSettingsPath)) {
    return defaultDbFileName;
  }

  try {
    const parsed = JSON.parse(readFileSync(databaseSettingsPath, 'utf8')) as DatabaseSettings;
    const candidate =
      typeof parsed.databaseFileName === 'string' ? parsed.databaseFileName.trim() : '';

    if (isValidDatabaseFileName(candidate)) {
      return candidate;
    }
  } catch {
    // Fall back to the default file name if the settings file is missing or invalid.
  }

  return defaultDbFileName;
}

function persistDatabaseFileName(fileName: string) {
  writeFileSync(databaseSettingsPath, `${JSON.stringify({ databaseFileName: fileName }, null, 2)}\n`);
}

const initialDatabasePath = process.env.MINDMAP_DB_PATH
  ? process.env.MINDMAP_DB_PATH
  : join(databaseDirectory, readDatabaseFileNameFromSettings());

export let dbPath = initialDatabasePath;

export let db = openDatabase(dbPath);

export function getDatabaseFileName() {
  return basename(dbPath);
}

export function getDatabaseSettingsPath() {
  return databaseSettingsPath;
}

export async function setDatabaseFileName(fileName: string) {
  const normalized = fileName.trim();

  if (!isValidDatabaseFileName(normalized)) {
    throw new Error('Database file name must be a simple file name.');
  }

  const currentPath = dbPath;
  const nextPath = join(databaseDirectory, normalized);

  if (currentPath === nextPath) {
    persistDatabaseFileName(normalized);
    return { databaseFileName: normalized };
  }

  if (existsSync(nextPath)) {
    throw new Error(`Database file "${normalized}" already exists.`);
  }

  const currentExisted = existsSync(currentPath);
  closeDatabase();

  let moved = false;

  try {
    if (currentExisted) {
      renameSync(currentPath, nextPath);
      moved = true;
    }

    dbPath = nextPath;
    db = openDatabase(dbPath);

    const { initSchema } = await import('./schema');
    initSchema(db);

    persistDatabaseFileName(normalized);

    return { databaseFileName: normalized };
  } catch (error) {
    try {
      if (moved && existsSync(nextPath) && !existsSync(currentPath)) {
        renameSync(nextPath, currentPath);
      }
    } catch {
      // Keep the original error if rollback fails.
    }

    try {
      dbPath = currentPath;
      db = openDatabase(dbPath);
    } catch {
      // Keep the original error if reopening fails.
    }

    throw error instanceof Error ? error : new Error('Failed to update the database file name.');
  }
}

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
