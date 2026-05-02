import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`)
];

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve('src/lib')
    }
  },
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    target: 'node20',
    rollupOptions: {
      input: {
        main: resolve('electron/main.ts')
      },
      external: ['electron', 'better-sqlite3', ...nodeBuiltins],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
