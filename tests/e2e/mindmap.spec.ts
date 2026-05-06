import { expect, test } from '@playwright/test';
import { cleanupHelperArtifacts, resetDatabase, seedCanvas, seedNode } from './helpers';

test.afterAll(() => {
  cleanupHelperArtifacts();
});

test('creates and edits a node, then persists after reload', async ({ page, request }) => {
  await resetDatabase(request);
  await seedCanvas(request, { id: 'canvas-edit', name: 'Research' });

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add node' }).click();
  await page.getByRole('button', { name: 'Edit node' }).click();

  await page.getByLabel('Node title').fill('Research note');
  await page.getByLabel('Add tag').fill('strategy');
  await page.getByPlaceholder('Add body text').fill('Draft body for the note.');
  await page.getByRole('button', { name: 'Save node' }).click();

  await expect(page.getByText('Research note')).toBeVisible();
  const nodesResponse = await request.get('/api/nodes?canvasId=canvas-edit');
  const nodes = (await nodesResponse.json()) as Array<{
    title: string;
    body: string;
    tags: string[];
  }>;

  expect(nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Research note',
        body: 'Draft body for the note.',
        tags: ['strategy']
      })
    ])
  );

  await page.reload();

  await expect(page.getByText('Research note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter by #strategy' })).toBeVisible();
});

test('filters search results by keyword and tag, then focuses a match', async ({
  page,
  request
}) => {
  await resetDatabase(request);
  await seedCanvas(request, { id: 'canvas-search', name: 'Discovery' });
  await seedNode(request, {
    id: 'node-alpha',
    canvasId: 'canvas-search',
    title: 'Alpha node',
    body: 'The sun rises over the ridge.',
    tags: ['alpha']
  });
  await seedNode(request, {
    id: 'node-beta',
    canvasId: 'canvas-search',
    title: 'Beta node',
    body: 'The sun sets beyond the river.',
    tags: ['beta']
  });

  await page.goto('/');

  await page.getByLabel('Search nodes by keyword').fill('sun');

  const alphaResult = page.locator('.search-result').filter({ hasText: 'Alpha node' });
  const betaResult = page.locator('.search-result').filter({ hasText: 'Beta node' });

  await expect(alphaResult).toBeVisible();
  await expect(betaResult).toBeVisible();

  await page.getByRole('tab', { name: 'Tags' }).click();
  await page
    .locator('.panel-tabpanels .tag-filter-chip')
    .filter({ hasText: '#alpha' })
    .evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
  await page.getByRole('tab', { name: 'Search' }).click();

  await expect(alphaResult).toBeVisible();
  await expect(betaResult).toHaveCount(0);

  await alphaResult.click();

  await expect(page.locator('.canvas-hint--selection')).toHaveText('1 selected');
});

test('undoes and redoes a node title change', async ({ page, request }) => {
  await resetDatabase(request);
  await seedCanvas(request, { id: 'canvas-history', name: 'History' });

  await page.goto('/');

  await page.getByRole('button', { name: 'Add node' }).click();
  await page.getByRole('button', { name: 'Edit node' }).click();
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

test('exports and imports the database through the sidebar', async ({ page, request }, testInfo) => {
  await resetDatabase(request);
  await seedCanvas(request, { id: 'canvas-transfer', name: 'Transfer' });
  await seedNode(request, {
    id: 'node-transfer',
    canvasId: 'canvas-transfer',
    title: 'Transfer node',
    body: 'Round-trip this database.',
    tags: ['export']
  });

  await page.addInitScript(() => {
    delete (window as any).showSaveFilePicker;
  });
  await page.goto('/');

  const exportPath = testInfo.outputPath('mindmap.db');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export DB' }).click();
  const download = await downloadPromise;
  await download.saveAs(exportPath);

  await resetDatabase(request);

  await page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.locator('input[type="file"]').setInputFiles(exportPath);

  await expect(page.getByText('Transfer node')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter by #export' })).toBeVisible();
});
