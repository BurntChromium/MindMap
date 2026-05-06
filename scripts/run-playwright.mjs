import { spawn } from 'node:child_process';

const mode = process.argv[2] ?? 'built';
const forwardedArgs = process.argv.slice(3);
const testArgs =
	mode === 'dev'
		? ['test', 'tests/e2e/dev-acceptance.spec.ts', ...forwardedArgs]
		: ['test', ...forwardedArgs];

const child = spawn('playwright', testArgs, {
	stdio: 'inherit',
	env: {
		...process.env,
		PLAYWRIGHT_APP_MODE: mode,
	},
});

child.on('exit', (code) => {
	process.exit(code ?? 1);
});
