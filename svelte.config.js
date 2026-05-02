import adapter from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';

const desktopBuild = process.env.MINDMAP_DESKTOP_BUILD === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		paths: desktopBuild ? { relative: true } : undefined,
		adapter: desktopBuild
			? adapterStatic({
					pages: 'build/desktop',
					assets: 'build/desktop',
					strict: false
				})
			: adapter()
	}
};

export default config;
