import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    benchmark: {
      include: ['src/**/*.bench.ts']
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,js,mjs}', 'scripts/**/*.{test,spec}.{ts,js,mjs}'],
      clearMocks: true,
      restoreMocks: true
    }
  })
);
