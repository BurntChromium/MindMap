import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { db, dbPath, closeDatabase, reopenDatabase } from './db';
import { initSchema } from './schema';

type SqliteDatabase = InstanceType<typeof Database>;

function toBytes(input: Uint8Array | ArrayBuffer | ArrayBufferView) {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

export async function exportDatabaseSnapshot() {
  const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-export-'));
  const exportPath = join(tempDir, 'mindmap.db');

  try {
    await db.backup(exportPath);
    const snapshot = readFileSync(exportPath);
    return snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function importDatabaseSnapshot(input: Uint8Array | ArrayBuffer | ArrayBufferView) {
  const bytes = toBytes(input);

  if (bytes.byteLength === 0) {
    return { success: false, error: 'Imported database file is empty.' };
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-import-'));
  const candidatePath = join(tempDir, 'candidate.db');
  const backupPath = join(tempDir, 'current.db');
  let importedDb: SqliteDatabase | null = null;
  let needsRestore = false;

  try {
    writeFileSync(candidatePath, bytes);

    importedDb = new Database(candidatePath, { readonly: true });
    importedDb.prepare('SELECT name FROM sqlite_master LIMIT 1').get();

    await db.backup(backupPath);
    closeDatabase();
    needsRestore = true;

    copyFileSync(candidatePath, dbPath);
    reopenDatabase();
    initSchema();
    needsRestore = false;

    return { success: true };
  } catch (error) {
    try {
      if (needsRestore) {
        closeDatabase();
        copyFileSync(backupPath, dbPath);
        reopenDatabase();
        initSchema();
        needsRestore = false;
      }
    } catch {
      // If restore fails, surface the original error below.
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import database.'
    };
  } finally {
    if (importedDb?.open) {
      importedDb.close();
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
}
