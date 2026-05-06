#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const viteCli = fileURLToPath(
	new URL('../node_modules/vite/bin/vite.js', import.meta.url),
);

function runViteBuild() {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [viteCli, 'build'], {
			env: {
				...process.env,
				MINDMAP_DESKTOP_BUILD: '1',
				VITE_DESKTOP_BUILD: '1',
			},
			stdio: 'inherit',
		});

		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`vite build exited with code ${code}`));
		});
	});
}

runViteBuild().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
