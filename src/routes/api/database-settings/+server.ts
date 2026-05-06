import { json } from '@sveltejs/kit';
import { updateDatabaseFileName, type AppDataDatabaseSettings } from '$lib/server/appData';
import { getDatabaseFileName } from '$lib/server/db';

export function GET() {
  return json({ databaseFileName: getDatabaseFileName() } satisfies AppDataDatabaseSettings);
}

export async function PATCH({ request }) {
  const payload = (await request.json()) as Partial<AppDataDatabaseSettings>;
  const databaseFileName = typeof payload?.databaseFileName === 'string' ? payload.databaseFileName : '';

  if (!databaseFileName.trim()) {
    return json({ success: false, error: 'Database file name is required.' }, { status: 400 });
  }

  try {
    return json(await updateDatabaseFileName({ databaseFileName }));
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update the database file name.'
      },
      { status: 400 }
    );
  }
}
