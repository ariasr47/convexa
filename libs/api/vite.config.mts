import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/api',
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  test: {
    name: '@org/api',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // The lib has no specs yet; don't fail CI on "no test files" until they're added.
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
