import { json } from '@sveltejs/kit';
import {
	createBackupSnapshotNow,
	restoreLatestBackupNow,
	updateBackupSettings,
} from '$lib/server/appData';
import { getDatabaseBackupSettings } from '$lib/server/db';
import { getBackupStatus } from '$lib/server/databaseBackup';

export function GET() {
	return json({
		backupSettings: getDatabaseBackupSettings(),
		backupStatus: getBackupStatus(),
	});
}

export async function PATCH({ request }) {
	const payload = (await request.json()) as Partial<{
		backupDirectoryPath: string;
		backupIntervalMinutes: number;
		backupRetentionCount: number;
	}>;

	const backupDirectoryPath =
		typeof payload?.backupDirectoryPath === 'string'
			? payload.backupDirectoryPath
			: '';
	const backupIntervalMinutes =
		typeof payload?.backupIntervalMinutes === 'number'
			? payload.backupIntervalMinutes
			: Number.NaN;
	const backupRetentionCount =
		typeof payload?.backupRetentionCount === 'number'
			? payload.backupRetentionCount
			: Number.NaN;

	if (!backupDirectoryPath.trim()) {
		return json(
			{ success: false, error: 'Backup folder path is required.' },
			{ status: 400 },
		);
	}

	try {
		return json(
			await updateBackupSettings({
				backupDirectoryPath,
				backupIntervalMinutes,
				backupRetentionCount,
			}),
		);
	} catch (error) {
		return json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to update backup settings.',
			},
			{ status: 400 },
		);
	}
}

export async function POST({ request }) {
	const payload = (await request.json().catch(() => null)) as
		| { action?: string }
		| null;

	if (payload?.action === 'snapshot') {
		try {
			return json(await createBackupSnapshotNow());
		} catch (error) {
			return json(
				{
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Failed to create backup snapshot.',
				},
				{ status: 400 },
			);
		}
	}

	if (payload?.action === 'restore-latest') {
		try {
			return json(await restoreLatestBackupNow());
		} catch (error) {
			return json(
				{
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Failed to restore the latest backup.',
				},
				{ status: 400 },
			);
		}
	}

	return json(
		{ success: false, error: 'Unknown backup action.' },
		{ status: 400 },
	);
}
