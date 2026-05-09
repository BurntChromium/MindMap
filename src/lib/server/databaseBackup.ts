import Database from 'better-sqlite3';
import {
	copyFileSync,
	mkdtempSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createId, now } from './utils';
import {
	db,
	dbPath,
	getDatabaseBackupSettings,
	resolveConfiguredPath,
	closeDatabase,
	reopenDatabase,
} from './db';
import { initSchema } from './schema';

type SqliteDatabase = InstanceType<typeof Database>;

export type AppDataBackupSettings = {
	backupDirectoryPath: string;
	backupIntervalMinutes: number;
	backupRetentionCount: number;
};

export type AppDataBackupStatus = {
	latestBackupFileName: string | null;
	latestBackupCreatedAt: number | null;
	backupCount: number;
};

export type BackupSnapshotInfo = {
	fileName: string;
	filePath: string;
	createdAt: number;
	sizeBytes: number;
};

function getBackupDirectory() {
	const settings = getDatabaseBackupSettings();
	return resolveConfiguredPath(settings.backupDirectoryPath);
}

function getBackupFilePrefix() {
	return `mindmap-backup-`;
}

function getBackupFileName() {
	const timestamp = new Date(now()).toISOString().replace(/[:.]/g, '-');
	return `${getBackupFilePrefix()}${timestamp}-${createId()}.db`;
}

function getSnapshotInfo(fileName: string, filePath: string): BackupSnapshotInfo {
	const stats = statSync(filePath);

	return {
		fileName,
		filePath,
		createdAt: stats.mtimeMs,
		sizeBytes: stats.size,
	};
}

export function listBackupSnapshots() {
	const backupDirectory = getBackupDirectory();

	try {
		return readdirSync(backupDirectory, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isFile() &&
					entry.name.startsWith(getBackupFilePrefix()) &&
					entry.name.endsWith('.db'),
			)
			.map((entry) =>
				getSnapshotInfo(entry.name, join(backupDirectory, entry.name)),
			)
			.sort((left, right) => right.createdAt - left.createdAt);
	} catch {
		return [];
	}
}

export function getBackupStatus(): AppDataBackupStatus {
	const snapshots = listBackupSnapshots();
	const latest = snapshots[0] ?? null;

	return {
		latestBackupFileName: latest?.fileName ?? null,
		latestBackupCreatedAt: latest?.createdAt ?? null,
		backupCount: snapshots.length,
	};
}

async function backupDatabaseToPath(
	sourceDb: SqliteDatabase,
	backupPath: string,
) {
	await sourceDb.backup(backupPath);
}

async function pruneOldBackups(retentionCount: number) {
	const snapshots = listBackupSnapshots();
	const staleSnapshots = snapshots.slice(retentionCount);

	for (const snapshot of staleSnapshots) {
		rmSync(snapshot.filePath, { force: true });
	}
}

export async function createBackupSnapshot() {
	const settings = getDatabaseBackupSettings();
	const backupDirectory = getBackupDirectory();
	mkdirSync(backupDirectory, { recursive: true });
	const fileName = getBackupFileName();
	const filePath = join(backupDirectory, fileName);

	await backupDatabaseToPath(db, filePath);
	await pruneOldBackups(settings.backupRetentionCount);

	return getBackupStatus();
}

async function restoreCurrentDatabaseToTempBackup(tempDbPath: string) {
	await db.backup(tempDbPath);
}

export async function restoreLatestBackup() {
	const snapshots = listBackupSnapshots();
	const latest = snapshots[0];

	if (!latest) {
		throw new Error('No backup snapshots are available to restore.');
	}

	const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-restore-'));
	const currentBackupPath = join(tempDir, 'current.db');
	let restored = false;

	try {
		await restoreCurrentDatabaseToTempBackup(currentBackupPath);
		closeDatabase();
		copyFileSync(latest.filePath, dbPath);
		reopenDatabase();
		initSchema();
		restored = true;

		return getBackupStatus();
	} catch (error) {
		try {
			if (!restored) {
				closeDatabase();
				copyFileSync(currentBackupPath, dbPath);
				reopenDatabase();
				initSchema();
			}
		} catch {
			// Surface the original error below.
		}

		throw error instanceof Error
			? error
			: new Error('Failed to restore the latest backup.');
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}
