#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...extraEnv
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  const preloadSource = resolve('electron/preload.cjs');
  const preloadTarget = resolve('dist-electron/preload.cjs');
  const nodeGypDevDir = resolve('.cache/node-gyp');
  const electronPackageJson = JSON.parse(
    await readFile(resolve('node_modules/electron/package.json'), 'utf8')
  );
  const electronVersion = electronPackageJson.version;

  await run('npm', ['run', 'build'], {
    MINDMAP_DESKTOP_BUILD: '1',
    VITE_DESKTOP_BUILD: '1'
  });
  await run('npm', ['run', 'build:electron']);
  await run('npm', [
    'exec',
    '--',
    'electron-rebuild',
    '--version',
    electronVersion,
    '--module-dir',
    '.',
    '--force',
    '--which-module',
    'better-sqlite3'
  ], {
    npm_config_devdir: nodeGypDevDir
  });
  await mkdir(dirname(preloadTarget), { recursive: true });
  await copyFile(preloadSource, preloadTarget);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
