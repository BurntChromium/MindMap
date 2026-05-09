import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { openDatabase } from './sqlite';
import { initSchema } from './schema';

const defaultDbFileName = import.meta.env.DEV ? 'dev.db' : 'mindmap.db';
const defaultDbPath = process.env.MINDMAP_DB_PATH ?? defaultDbFileName;
const databaseDirectory = dirname(defaultDbPath);
const databaseSettingsPath = join(databaseDirectory, 'mindmap.config.json');
const defaultBackupDirectoryPath = 'mindmap-backups';
const defaultBackupIntervalMinutes = 10;
const defaultBackupRetentionCount = 2;
const configuredBackupDirectoryPath =
	typeof process.env.MINDMAP_BACKUP_DIRECTORY_PATH === 'string'
		? process.env.MINDMAP_BACKUP_DIRECTORY_PATH.trim()
		: '';
const serverMode = process.env.MINDMAP_SERVER_MODE === '1';

type DatabaseSettings = {
	databaseFileName?: unknown;
	backupDirectoryPath?: unknown;
	backupIntervalMinutes?: unknown;
	backupRetentionCount?: unknown;
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

function isValidBackupDirectoryPath(path: string) {
	return path.trim().length > 0 && !path.includes('\0');
}

function normalizeBackupDirectoryPath(value: unknown) {
	const candidate = typeof value === 'string' ? value.trim() : '';

	return isValidBackupDirectoryPath(candidate)
		? candidate
		: defaultBackupDirectoryPath;
}

function getConfiguredBackupDirectoryPath(settingsBackupDirectoryPath: string) {
	if (isValidBackupDirectoryPath(configuredBackupDirectoryPath)) {
		return configuredBackupDirectoryPath;
	}

	return serverMode ? defaultBackupDirectoryPath : settingsBackupDirectoryPath;
}

function normalizePositiveInteger(
	value: unknown,
	fallback: number,
	minimum: number,
) {
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		return fallback;
	}

	return Math.max(minimum, value);
}

function readDatabaseSettingsFromFile() {
	const fallback = {
		databaseFileName: defaultDbFileName,
		backupDirectoryPath: defaultBackupDirectoryPath,
		backupIntervalMinutes: defaultBackupIntervalMinutes,
		backupRetentionCount: defaultBackupRetentionCount,
	};

	if (!existsSync(databaseSettingsPath)) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(
			readFileSync(databaseSettingsPath, 'utf8'),
		) as DatabaseSettings;
		const fileName =
			typeof parsed.databaseFileName === 'string'
				? parsed.databaseFileName.trim()
				: '';

		return {
			databaseFileName: isValidDatabaseFileName(fileName)
				? fileName
				: fallback.databaseFileName,
			backupDirectoryPath: normalizeBackupDirectoryPath(
				parsed.backupDirectoryPath,
			),
			backupIntervalMinutes: normalizePositiveInteger(
				parsed.backupIntervalMinutes,
				fallback.backupIntervalMinutes,
				1,
			),
			backupRetentionCount: normalizePositiveInteger(
				parsed.backupRetentionCount,
				fallback.backupRetentionCount,
				1,
			),
		};
	} catch {
		// Fall back to the default file name if the settings file is missing or invalid.
	}

	return fallback;
}

function persistDatabaseSettings(settings: {
	databaseFileName: string;
	backupDirectoryPath: string;
	backupIntervalMinutes: number;
	backupRetentionCount: number;
}) {
	writeFileSync(databaseSettingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

const initialDatabaseSettings = readDatabaseSettingsFromFile();

const initialDatabasePath = process.env.MINDMAP_DB_PATH
	? process.env.MINDMAP_DB_PATH
	: join(databaseDirectory, initialDatabaseSettings.databaseFileName);

export let dbPath = initialDatabasePath;

export let db = openDatabase(dbPath);

export function getDatabaseFileName() {
	return basename(dbPath);
}

export function getDatabaseSettings() {
	return readDatabaseSettingsFromFile();
}

export function getDatabaseBackupSettings() {
	const settings = readDatabaseSettingsFromFile();

	return {
		backupDirectoryPath: getConfiguredBackupDirectoryPath(
			settings.backupDirectoryPath,
		),
		backupIntervalMinutes: settings.backupIntervalMinutes,
		backupRetentionCount: settings.backupRetentionCount,
	};
}

export function isBackupDirectoryConfigurable() {
	return (
		!serverMode && !isValidBackupDirectoryPath(configuredBackupDirectoryPath)
	);
}

export function getDatabaseSettingsPath() {
	return databaseSettingsPath;
}

export function resolveConfiguredPath(configuredPath: string) {
	return isAbsolute(configuredPath)
		? configuredPath
		: join(databaseDirectory, configuredPath);
}

export async function setDatabaseFileName(fileName: string) {
	const normalized = fileName.trim();

	if (!isValidDatabaseFileName(normalized)) {
		throw new Error('Database file name must be a simple file name.');
	}

	const currentPath = dbPath;
	const nextPath = join(databaseDirectory, normalized);

	if (currentPath === nextPath) {
		const settings = readDatabaseSettingsFromFile();
		persistDatabaseSettings({
			...settings,
			databaseFileName: normalized,
		});
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
		initSchema(db);

		const settings = readDatabaseSettingsFromFile();
		persistDatabaseSettings({
			...settings,
			databaseFileName: normalized,
		});

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

		throw error instanceof Error
			? error
			: new Error('Failed to update the database file name.');
	}
}

export async function setBackupSettings(input: {
	backupDirectoryPath: string;
	backupIntervalMinutes: number;
	backupRetentionCount: number;
}) {
	const settings = readDatabaseSettingsFromFile();
	const directoryConfigurable = isBackupDirectoryConfigurable();
	const directoryPath = directoryConfigurable
		? input.backupDirectoryPath.trim()
		: getConfiguredBackupDirectoryPath(settings.backupDirectoryPath).trim();

	if (!isValidBackupDirectoryPath(directoryPath)) {
		throw new Error('Backup folder path is required.');
	}

	if (
		!Number.isInteger(input.backupIntervalMinutes) ||
		input.backupIntervalMinutes < 1
	) {
		throw new Error('Backup interval must be at least 1 minute.');
	}

	if (
		!Number.isInteger(input.backupRetentionCount) ||
		input.backupRetentionCount < 1
	) {
		throw new Error('Backup retention must be at least 1 snapshot.');
	}

	persistDatabaseSettings({
		...settings,
		backupDirectoryPath: directoryConfigurable
			? directoryPath
			: settings.backupDirectoryPath,
		backupIntervalMinutes: input.backupIntervalMinutes,
		backupRetentionCount: input.backupRetentionCount,
	});

	return {
		backupDirectoryPath: directoryPath,
		backupIntervalMinutes: input.backupIntervalMinutes,
		backupRetentionCount: input.backupRetentionCount,
	};
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
