import { expect, test } from '@playwright/test';
import {
	cleanupHelperArtifacts,
	resetDatabase,
	seedCanvas,
	seedNode,
} from './helpers';

test.afterAll(() => {
	cleanupHelperArtifacts();
});

test('creates and edits a node, then persists after reload', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-edit', name: 'Research' });

	await page.goto('/');

	await expect(
		page.getByTestId('sidebar-canvas-select-canvas-edit'),
	).toBeVisible();

	await page.getByTestId('canvas-add-node').click();
	await expect(page.getByRole('button', { name: 'Save node' })).toBeVisible();

	await page.getByLabel('Node title').fill('Research note');
	await page.getByLabel('Add tag').fill('strategy');
	await page.getByPlaceholder('Add body text').fill('Draft body for the note.');
	await page.getByRole('button', { name: 'Save node' }).click();

	await expect(page.getByText('Research note')).toBeVisible();
	const nodesResponse = await request.get('/api/nodes?canvasId=canvas-edit');
	const nodes = (await nodesResponse.json()) as Array<{
		id: string;
		title: string;
		body: string;
		tags: string[];
	}>;
	const createdNode = nodes.find((node) => node.title === 'Research note');

	expect(createdNode).toBeTruthy();

	expect(nodes).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				title: 'Research note',
				body: 'Draft body for the note.',
				tags: ['strategy'],
			}),
		]),
	);

	await page.reload();

	await expect(page.getByText('Research note')).toBeVisible();
	await expect(
		page.getByTestId(`node-tag-${createdNode!.id}-strategy`),
	).toBeVisible();
});

test('toggles the entity checkbox and persists the flag after reload', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-entity', name: 'Entities' });
	await seedNode(request, {
		id: 'node-entity',
		canvasId: 'canvas-entity',
		title: 'Aeon',
		body: 'A note about aeons.',
	});

	await page.goto('/');

	const nodeCard = page.getByTestId('node-card-node-entity');
	await expect(nodeCard).toBeVisible();
	await nodeCard.click();
	await page.getByRole('button', { name: 'Edit node' }).click();
	await expect(page.getByRole('button', { name: 'Save node' })).toBeVisible();

	const entityToggle = nodeCard.getByLabel('Treat as entity page');
	await expect(entityToggle).not.toBeChecked();
	await entityToggle.focus();
	await page.keyboard.press('Space');
	await expect(entityToggle).toBeChecked();

	await page.getByRole('button', { name: 'Save node' }).click();

	const nodesResponse = await request.get('/api/nodes?canvasId=canvas-entity');
	const nodes = (await nodesResponse.json()) as Array<{
		id: string;
		title: string;
		is_entity: number;
	}>;
	const updatedNode = nodes.find((node) => node.id === 'node-entity');

	expect(updatedNode).toMatchObject({
		title: 'Aeon',
		is_entity: 1,
	});

	await page.reload();

	await expect(nodeCard).toBeVisible();
	await nodeCard.click();
	await page.getByRole('button', { name: 'Edit node' }).click();
	await expect(nodeCard.getByLabel('Treat as entity page')).toBeChecked();
});

test('filters search results by keyword and tag, then focuses a match', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-search', name: 'Discovery' });
	await seedNode(request, {
		id: 'node-alpha',
		canvasId: 'canvas-search',
		title: 'Alpha node',
		body: 'The sun rises over the ridge.',
		tags: ['alpha'],
	});
	await seedNode(request, {
		id: 'node-beta',
		canvasId: 'canvas-search',
		title: 'Beta node',
		body: 'The sun sets beyond the river.',
		tags: ['beta'],
	});

	await page.goto('/');

	await page.getByTestId('panel-search-input').fill('sun');

	const alphaResult = page.getByTestId('search-result-node-alpha');
	const betaResult = page.getByTestId('search-result-node-beta');

	await expect(alphaResult).toBeVisible();
	await expect(betaResult).toBeVisible();

	await page.getByTestId('panel-tab-tags').click();
	await page.getByTestId('tag-filter-alpha').click();
	await page.getByTestId('panel-tab-search').click();

	await expect(alphaResult).toBeVisible();
	await expect(betaResult).toHaveCount(0);

	await alphaResult.click();

	await expect(page.locator('.canvas-hint--selection')).toHaveText(
		'1 selected',
	);
});

test('undoes and redoes a node title change', async ({ page, request }) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-history', name: 'History' });

	await page.goto('/');

	await page.getByTestId('canvas-add-node').click();
	await expect(page.getByRole('button', { name: 'Save node' })).toBeVisible();
	await page.getByLabel('Node title').fill('First title');
	await page.getByRole('button', { name: 'Save node' }).click();

	await page.getByRole('button', { name: 'Edit node' }).click();
	await page.getByLabel('Node title').fill('Second title');
	await page.getByRole('button', { name: 'Save node' }).click();

	await expect(page.getByText('Second title')).toBeVisible();

	await page.keyboard.press('Control+z');
	await expect(page.getByText('First title')).toBeVisible();
	await expect(page.getByText('Second title')).toHaveCount(0);

	await page.keyboard.press('Control+Shift+z');
	await expect(page.getByText('Second title')).toBeVisible();
});

test('exports and imports the database through the sidebar', async ({
	page,
	request,
}, testInfo) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-transfer', name: 'Transfer' });
	await seedNode(request, {
		id: 'node-transfer',
		canvasId: 'canvas-transfer',
		title: 'Transfer node',
		body: 'Round-trip this database.',
		tags: ['export'],
	});

	await page.addInitScript(() => {
		delete (window as any).showSaveFilePicker;
	});
	await page.goto('/');

	await page.getByTestId('sidebar-tab-database').click();
	const exportPath = testInfo.outputPath('mindmap.db');
	const downloadPromise = page.waitForEvent('download');
	await page.getByTestId('sidebar-export-db').click();
	const download = await downloadPromise;
	await download.saveAs(exportPath);

	await resetDatabase(request);

	await page.once('dialog', async (dialog) => {
		await dialog.accept();
	});

	await page.getByTestId('sidebar-import-input').setInputFiles(exportPath);

	await expect(page.getByText('Transfer node')).toBeVisible();
	await expect(page.getByTestId('node-tag-node-transfer-export')).toBeVisible();
});

test('creates and restores a backup through the sidebar', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-backup', name: 'Backups' });
	await seedNode(request, {
		id: 'node-backup',
		canvasId: 'canvas-backup',
		title: 'Backup node',
		body: 'This should come back after restore.',
	});

	await page.goto('/');

	await page.getByTestId('sidebar-tab-database').click();
	await page.getByTestId('sidebar-create-backup').click();
	await expect(page.getByTestId('sidebar-restore-backup')).toBeEnabled();

	await resetDatabase(request);

	await page.once('dialog', async (dialog) => {
		await dialog.accept();
	});

	await page.getByTestId('sidebar-restore-backup').click();

	await expect(page.getByText('Backup node')).toBeVisible();
});

test('switches between canvas and database tabs in the left sidebar', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-tabs', name: 'Tabs' });

	await page.goto('/');

	await expect(page.getByTestId('sidebar-tab-canvas')).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await expect(page.getByTestId('sidebar-create-canvas')).toBeVisible();
	await expect(page.getByTestId('sidebar-panel-canvas')).toBeVisible();

	await page.getByTestId('sidebar-tab-database').click();

	await expect(page.getByTestId('sidebar-tab-database')).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await expect(page.getByText('Automatic Backups')).toBeVisible();
	await expect(page.getByTestId('sidebar-save-database-file')).toBeVisible();
	await expect(page.getByTestId('sidebar-panel-database')).toBeVisible();
	await expect(page.getByTestId('sidebar-save-backup-settings')).toHaveCount(0);

	await page.getByTestId('sidebar-tab-canvas').click();

	await expect(page.getByTestId('sidebar-create-canvas')).toBeVisible();
	await expect(page.getByTestId('sidebar-panel-canvas')).toBeVisible();
});

test('autosaves backup interval and retention settings', async ({
	page,
	request,
}) => {
	await resetDatabase(request);
	await seedCanvas(request, { id: 'canvas-backup-settings', name: 'Settings' });

	await page.goto('/');

	await page.getByTestId('sidebar-tab-database').click();
	await expect(page.getByTestId('sidebar-choose-backup-folder')).toHaveCount(0);

	await page.getByLabel('Backup interval in minutes').fill('12');
	await page.getByLabel('Backup retention count').fill('4');
	await page.waitForTimeout(500);

	const backupSettingsResponse = await request.get('/api/database-backups');
	const backupSettingsPayload = (await backupSettingsResponse.json()) as {
		backupSettings: {
			backupDirectoryPath: string;
			backupIntervalMinutes: number;
			backupRetentionCount: number;
		};
	};

	expect(backupSettingsPayload.backupSettings).toEqual(
		expect.objectContaining({
			backupDirectoryPath: 'mindmap-backups',
			backupIntervalMinutes: 12,
			backupRetentionCount: 4,
		}),
	);
});
