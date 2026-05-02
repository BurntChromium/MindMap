#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

function runDocker(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('docker', args, {
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`docker ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  const projectDir = process.cwd();
  const cacheDir = resolve(homedir(), '.cache');

  await runDocker([
    'run',
    '--rm',
    '-it',
    '--platform',
    'linux/amd64',
    '-v',
    `${projectDir}:/project`,
    '-v',
    `${resolve(projectDir, 'node_modules')}:/project/node_modules`,
    '-v',
    `${resolve(cacheDir, 'electron')}:/root/.cache/electron`,
    '-v',
    `${resolve(cacheDir, 'electron-builder')}:/root/.cache/electron-builder`,
    '-w',
    '/project',
    'electronuserland/builder:wine',
    '/bin/bash',
    '-lc',
    'npm run build:desktop && npx electron-builder --win'
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
