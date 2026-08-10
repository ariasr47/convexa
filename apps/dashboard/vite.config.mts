/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/dashboard',
  // `@/*` → the app-code root (src/app). Keeps cross-folder imports depth-independent
  // so folder moves during the restructure don't churn import paths.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/app') } },
  server: {
    port: 4200,
    host: 'localhost',
    // Proxy API calls to api-rust (Axum) so the browser stays same-origin (no CORS).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@org/dashboard',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // Headroom over the 5s default: with asyncUtilTimeout at 5s (test-setup.ts), a slow-but-passing
    // test on a loaded CI runner can legitimately exceed 5s of wall clock.
    testTimeout: 15000,
    // MUI's ESM build imports react-transition-group via a directory import that Node's native ESM
    // loader can't resolve when these packages are externalized. Inline them so Vite transforms the
    // modules and resolves those imports itself.
    server: { deps: { inline: [/@mui\//, 'react-transition-group'] } },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
