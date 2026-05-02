#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

function getTarget() {
  const targetIndex = process.argv.indexOf('--target');

  if (targetIndex !== -1) {
    return process.argv[targetIndex + 1] ?? 'nsis';
  }

  return process.env.MINDMAP_WIN_TARGET ?? 'nsis';
}

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
  const nodeModulesVolume = 'mindmap-win-node-modules';
  const target = getTarget();
  const envArgs = [];

  if (process.env.DEBUG) {
    envArgs.push('-e', `DEBUG=${process.env.DEBUG}`);
  }

  if (process.env.npm_config_loglevel) {
    envArgs.push('-e', `npm_config_loglevel=${process.env.npm_config_loglevel}`);
  }

  await runDocker([
    'run',
    '--rm',
    '-it',
    '--platform',
    'linux/amd64',
    '-v',
    `${projectDir}:/project`,
    '-v',
    `${nodeModulesVolume}:/project/node_modules`,
    '-v',
    `${resolve(cacheDir, 'electron')}:/root/.cache/electron`,
    '-v',
    `${resolve(cacheDir, 'electron-builder')}:/root/.cache/electron-builder`,
    ...envArgs,
    '-w',
    '/project',
    'electronuserland/builder:wine',
    '/bin/bash',
    '-lc',
    `npm ci && npm run build:desktop && npx electron-builder --win ${target === 'nsis' ? '' : target}`.trim()
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
