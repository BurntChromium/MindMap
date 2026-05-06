import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const appMode = process.env.PLAYWRIGHT_APP_MODE ?? 'built';
const tempDir = mkdtempSync(join(tmpdir(), 'mindmap-playwright-'));
const port = appMode === 'dev' ? 5184 : 4173;
const serverUrl = `http://127.0.0.1:${port}`;

process.env.MINDMAP_DB_PATH = join(tempDir, 'playwright.db');
process.env.PLAYWRIGHT_E2E_TMP_DIR = tempDir;

const serverCommand =
  appMode === 'dev'
    ? `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`
    : `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: serverUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: serverCommand,
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  globalTeardown: './tests/e2e/global-teardown.ts'
});
