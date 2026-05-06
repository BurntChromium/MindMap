import { rmSync } from 'node:fs';

export default async function globalTeardown() {
  const tempDir = process.env.PLAYWRIGHT_E2E_TMP_DIR;

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
