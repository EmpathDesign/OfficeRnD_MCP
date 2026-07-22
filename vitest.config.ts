import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.{test,spec}.ts', 'packages/*/test/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/vscode/**', '**/*.test.ts', '**/index.ts'],
    },
  },
});
