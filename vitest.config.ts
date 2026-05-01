import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,js}'],
      clearMocks: true,
      restoreMocks: true
    }
  })
);
