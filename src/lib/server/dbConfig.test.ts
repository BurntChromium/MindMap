import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDirs: string[] = [];
let dbModule: typeof import('./db') | null = null;

async function loadDbWithEnv(env: Record<string, string | undefined>) {
	vi.resetModules();
	vi.unstubAllEnvs();

	const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-db-config-'));
	tempDirs.push(tempDir);
	vi.stubEnv('MINDMAP_DB_PATH', join(tempDir, 'test.db'));

	for (const [key, value] of Object.entries(env)) {
		if (value !== undefined) {
			vi.stubEnv(key, value);
		}
	}

	dbModule = await import('./db');
	return dbModule;
}

afterEach(() => {
	if (dbModule?.db.open) {
		dbModule.db.close();
	}

	dbModule = null;
	vi.unstubAllEnvs();
	vi.resetModules();

	for (const tempDir of tempDirs) {
		rmSync(tempDir, { recursive: true, force: true });
	}

	tempDirs = [];
});

describe('database backup configuration', () => {
	it('keeps backup directory configurable by default', async () => {
		const db = await loadDbWithEnv({});

		expect(db.isBackupDirectoryConfigurable()).toBe(true);
		expect(db.getDatabaseBackupSettings()).toEqual(
			expect.objectContaining({
				backupDirectoryPath: 'mindmap-backups',
			}),
		);
	});

	it('uses the deployment backup directory and disables UI configuration', async () => {
		const db = await loadDbWithEnv({
			MINDMAP_SERVER_MODE: '1',
			MINDMAP_BACKUP_DIRECTORY_PATH: '/srv/mindmap/backups',
		});

		expect(db.isBackupDirectoryConfigurable()).toBe(false);
		expect(db.getDatabaseBackupSettings()).toEqual(
			expect.objectContaining({
				backupDirectoryPath: '/srv/mindmap/backups',
			}),
		);

		await db.setBackupSettings({
			backupDirectoryPath: '/tmp/user-choice',
			backupIntervalMinutes: 15,
			backupRetentionCount: 6,
		});

		expect(db.getDatabaseBackupSettings()).toEqual({
			backupDirectoryPath: '/srv/mindmap/backups',
			backupIntervalMinutes: 15,
			backupRetentionCount: 6,
		});
	});

	it('uses the default backup directory in server mode without an override', async () => {
		const db = await loadDbWithEnv({
			MINDMAP_SERVER_MODE: '1',
		});

		await db.setBackupSettings({
			backupDirectoryPath: '/tmp/user-choice',
			backupIntervalMinutes: 20,
			backupRetentionCount: 7,
		});

		expect(db.isBackupDirectoryConfigurable()).toBe(false);
		expect(db.getDatabaseBackupSettings()).toEqual({
			backupDirectoryPath: 'mindmap-backups',
			backupIntervalMinutes: 20,
			backupRetentionCount: 7,
		});
	});
});
