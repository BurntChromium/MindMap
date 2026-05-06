#!/usr/bin/env node

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
	compareBenchmarkReports,
	getDefaultBaselinePath,
	getDefaultBudget,
	loadAndNormalizeBenchmarkReport,
	normalizeBenchmarkReport,
	parseBenchmarkArgs,
	readBenchmarkReport,
	writeBenchmarkReport,
} from './bench-utils.mjs';

function runVitestBench(outputJsonPath) {
	return new Promise((resolve, reject) => {
		const child = spawn('vitest', ['bench', '--outputJson', outputJsonPath], {
			stdio: 'inherit',
			shell: process.platform === 'win32',
		});

		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`vitest bench exited with code ${code}`));
		});
	});
}

async function main() {
	const { command, baselinePath, budgetPct } = parseBenchmarkArgs(process.argv);
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mindmap-bench-'));
	const rawOutputPath = path.join(tmpDir, 'bench.json');

	try {
		if (command === 'baseline') {
			await runVitestBench(rawOutputPath);
			const normalized = await loadAndNormalizeBenchmarkReport(rawOutputPath);
			await writeBenchmarkReport(baselinePath, normalized);
			console.log(`Baseline written to ${baselinePath}`);
			return;
		}

		if (command === 'compare') {
			const baselineReport = await readBenchmarkReport(baselinePath);
			await runVitestBench(rawOutputPath);
			const currentReport = normalizeBenchmarkReport(
				await readBenchmarkReport(rawOutputPath),
			);
			const comparison = compareBenchmarkReports(
				baselineReport,
				currentReport,
				budgetPct,
			);

			if (
				comparison.regressions.length ||
				comparison.missing.length ||
				comparison.extra.length
			) {
				console.error(`Benchmark comparison against ${baselinePath} failed.`);

				for (const regression of comparison.regressions) {
					console.error(
						[
							`Regression: ${regression.filepath} > ${regression.groupName} > ${regression.name}`,
							`baseline hz=${regression.baselineHz.toFixed(2)}`,
							`current hz=${regression.hz.toFixed(2)}`,
							`delta=${regression.hzDeltaPct.toFixed(2)}%`,
						].join(' | '),
					);
				}

				for (const entry of comparison.missing) {
					console.error(
						`Missing benchmark: ${entry.filepath} > ${entry.groupName} > ${entry.name}`,
					);
				}

				for (const entry of comparison.extra) {
					console.error(
						`New benchmark: ${entry.filepath} > ${entry.groupName} > ${entry.name}`,
					);
				}

				process.exitCode = 1;
				return;
			}

			console.log(
				`Benchmark comparison passed against ${baselinePath} with a ${budgetPct}% regression budget.`,
			);
			return;
		}

		if (command === 'help' || command === '--help' || command === '-h') {
			console.log(`Usage:
  npm run bench:baseline [-- --baseline ${getDefaultBaselinePath()}]
  npm run bench:compare [-- --baseline ${getDefaultBaselinePath()} --budget ${getDefaultBudget()}]

Commands:
  baseline  Run the suite and write a normalized baseline JSON.
  compare   Run the suite and compare against the saved baseline.`);
			return;
		}

		throw new Error(`Unknown command: ${command}`);
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
