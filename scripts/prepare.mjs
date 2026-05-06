#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const svelteKitCli = fileURLToPath(
	new URL('../node_modules/@sveltejs/kit/svelte-kit.js', import.meta.url),
);

function runSvelteKitSync() {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [svelteKitCli, 'sync'], {
			stdio: 'inherit',
		});

		child.on('error', () => {
			resolve();
		});

		child.on('exit', () => {
			resolve();
		});
	});
}

runSvelteKitSync().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
