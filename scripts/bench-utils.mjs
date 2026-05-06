import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_BASELINE_PATH = 'benchmarks/baseline.json';
const DEFAULT_BUDGET = 35;
const DIAGNOSTIC_BENCHMARK_PATTERNS = [/cached repeat/i, /cold canvas/i];

function normalizePath(filePath, rootDir = process.cwd()) {
	return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function pickBenchmarkStats(benchmark) {
	return {
		name: benchmark.name,
		hz: benchmark.hz,
		mean: benchmark.mean,
		min: benchmark.min,
		max: benchmark.max,
		median: benchmark.median,
		p99: benchmark.p99,
		p995: benchmark.p995,
		p999: benchmark.p999,
		rme: benchmark.rme,
		sampleCount: benchmark.sampleCount,
	};
}

export function normalizeBenchmarkReport(report, rootDir = process.cwd()) {
	return {
		version: 1,
		files: (report.files ?? []).map((file) => ({
			filepath: normalizePath(file.filepath, rootDir),
			groups: (file.groups ?? []).map((group) => ({
				name: group.fullName ?? group.name ?? '',
				benchmarks: (group.benchmarks ?? []).map(pickBenchmarkStats),
			})),
		})),
	};
}

function entryKey(entry) {
	return `${entry.filepath}::${entry.groupName}::${entry.name}`;
}

function isDiagnosticBenchmark(entry) {
	return DIAGNOSTIC_BENCHMARK_PATTERNS.some((pattern) =>
		pattern.test(entry.name),
	);
}

function flattenReport(report) {
	const entries = [];

	for (const file of report.files ?? []) {
		for (const group of file.groups ?? []) {
			for (const benchmark of group.benchmarks ?? []) {
				entries.push({
					filepath: file.filepath,
					groupName: group.name,
					...pickBenchmarkStats(benchmark),
				});
			}
		}
	}

	return entries;
}

export function compareBenchmarkReports(
	baselineReport,
	currentReport,
	budgetPct = DEFAULT_BUDGET,
) {
	const baselineEntries = flattenReport(baselineReport);
	const currentEntries = flattenReport(currentReport);
	const baselineMap = new Map(
		baselineEntries
			.filter((entry) => !isDiagnosticBenchmark(entry))
			.map((entry) => [entryKey(entry), entry]),
	);
	const currentMap = new Map(
		currentEntries
			.filter((entry) => !isDiagnosticBenchmark(entry))
			.map((entry) => [entryKey(entry), entry]),
	);
	const allKeys = Array.from(
		new Set([...baselineMap.keys(), ...currentMap.keys()]),
	).sort();
	const regressions = [];
	const missing = [];
	const extra = [];

	for (const key of allKeys) {
		const baseline = baselineMap.get(key);
		const current = currentMap.get(key);

		if (!baseline) {
			extra.push(current);
			continue;
		}

		if (!current) {
			missing.push(baseline);
			continue;
		}

		const hzDeltaPct =
			baseline.hz === 0 ? 0 : ((current.hz - baseline.hz) / baseline.hz) * 100;

		if (hzDeltaPct < -budgetPct) {
			regressions.push({
				...current,
				baselineHz: baseline.hz,
				hzDeltaPct,
			});
		}
	}

	return {
		regressions,
		missing,
		extra,
		passed:
			regressions.length === 0 && missing.length === 0 && extra.length === 0,
	};
}

export async function readBenchmarkReport(filePath) {
	const raw = await fs.readFile(filePath, 'utf8');
	return JSON.parse(raw);
}

export async function writeBenchmarkReport(filePath, report) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

export async function loadAndNormalizeBenchmarkReport(
	filePath,
	rootDir = process.cwd(),
) {
	const report = await readBenchmarkReport(filePath);
	return normalizeBenchmarkReport(report, rootDir);
}

export function getDefaultBaselinePath() {
	return DEFAULT_BASELINE_PATH;
}

export function getDefaultBudget() {
	return DEFAULT_BUDGET;
}

export function parseBenchmarkArgs(argv) {
	const result = {
		command: argv[2] ?? 'help',
		baselinePath: DEFAULT_BASELINE_PATH,
		budgetPct: DEFAULT_BUDGET,
	};

	for (let index = 3; index < argv.length; index += 1) {
		const value = argv[index];

		if (value === '--baseline') {
			result.baselinePath = argv[++index] ?? result.baselinePath;
			continue;
		}

		if (value.startsWith('--baseline=')) {
			result.baselinePath =
				value.slice('--baseline='.length) || result.baselinePath;
			continue;
		}

		if (value === '--budget') {
			const next = Number(argv[++index]);
			if (!Number.isNaN(next)) {
				result.budgetPct = next;
			}
			continue;
		}

		if (value.startsWith('--budget=')) {
			const next = Number(value.slice('--budget='.length));
			if (!Number.isNaN(next)) {
				result.budgetPct = next;
			}
		}
	}

	return result;
}
