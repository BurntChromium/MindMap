#!/usr/bin/env node

import { spawn } from 'node:child_process';

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
  await run('npm', ['run', 'build'], {
    MINDMAP_DESKTOP_BUILD: '1',
    VITE_DESKTOP_BUILD: '1'
  });
  await run('npm', ['run', 'build:electron']);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
