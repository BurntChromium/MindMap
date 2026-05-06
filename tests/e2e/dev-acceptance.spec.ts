import { expect, test } from '@playwright/test';
import { cleanupHelperArtifacts, resetDatabase, seedCanvas, seedNode } from './helpers';

test.afterAll(() => {
  cleanupHelperArtifacts();
});

test('loads the seeded canvas and supports a basic search', async ({ page, request }) => {
  await resetDatabase(request);
  await seedCanvas(request, { id: 'canvas-dev', name: 'Discovery' });
  await seedNode(request, {
    id: 'node-alpha',
    canvasId: 'canvas-dev',
    title: 'Alpha node',
    body: 'The sun rises over the ridge.',
    tags: ['alpha']
  });
  await seedNode(request, {
    id: 'node-beta',
    canvasId: 'canvas-dev',
    title: 'Beta node',
    body: 'The sun sets beyond the river.',
    tags: ['beta']
  });

  await page.goto('/');

  await expect(page.getByTestId('sidebar-canvas-select-canvas-dev')).toBeVisible();
  await page.getByTestId('panel-search-input').fill('sun');

  await expect(page.getByTestId('search-result-node-beta')).toBeVisible();
});
