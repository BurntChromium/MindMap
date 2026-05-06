#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function getPackageVersion() {
  const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return typeof packageJson.version === 'string' ? packageJson.version : null;
}

function parseArgs(argv) {
  const result = {
    version: null,
    ref: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--version' || arg === '-v') {
      result.version = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (arg.startsWith('--version=')) {
      result.version = arg.slice('--version='.length);
      continue;
    }

    if (arg === '--ref') {
      result.ref = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (arg.startsWith('--ref=')) {
      result.ref = arg.slice('--ref='.length);
    }
  }

  return result;
}

const { version, ref } = parseArgs(process.argv.slice(2));
const fallbackVersion = getPackageVersion();
const resolvedVersion = version ?? fallbackVersion;

if (!resolvedVersion) {
  console.error('Missing version. Use `npm run release -- --version 0.1.0`.');
  process.exit(1);
}

const workflowArgs = ['workflow', 'run', 'release.yml', '--field', `version=${resolvedVersion}`];

if (ref) {
  workflowArgs.push('--ref', ref);
}

const child = spawn('gh', workflowArgs, {
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
