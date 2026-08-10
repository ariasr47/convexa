/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';

/** Set ANALYZE=1 for a production build that writes dist/stats.html (treemap). */
const analyze = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  const plugins: PluginOption[] = [react()];
  if (analyze) {
    plugins.push(
      visualizer({
        filename: path.resolve(import.meta.dirname, 'dist/stats.html'),
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption,
    );
  }

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/dashboard',
    // `@/*` → the app-code root (src/app). Keeps cross-folder imports depth-independent.
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/app') } },
    server: {
      port: 4200,
      host: 'localhost',
      // Proxy API calls to apps/api (Axum) so the browser stays same-origin (no CORS).
      proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
    preview: {
      port: 4200,
      host: 'localhost',
    },
    plugins,
    build: {
      outDir: './dist',
      emptyOutDir: true,
      // Production: minified, no sourcemaps, hashed assets, size report.
      // Development mode builds keep readable output + sourcemaps.
      // Vite 8 uses Rolldown/oxc minify — do not set esbuild options (deprecated).
      // Prod perf claims: only after `nx build … --configuration=production` + `nx preview`
      // (or CF Pages). Never claim prod perf from `vite` HMR or development-mode builds.
      target: 'es2022',
      minify: isProd,
      cssMinify: isProd,
      sourcemap: isProd ? false : true,
      reportCompressedSize: isProd,
      // Soft Vite warning; hard gzip budgets live in tools/check-dashboard-bundle.mjs (§3.8).
      chunkSizeWarningLimit: 600,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: isProd
        ? {
            output: {
              // Stable vendor splits for long-cache CDN deploys (Cloudflare Pages).
              manualChunks(id) {
                if (!id.includes('node_modules')) return;
                if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
                if (id.includes('recharts') || id.includes('d3-')) return 'charts';
                if (id.includes('react-router')) return 'router';
                if (id.includes('react-dom') || id.includes('/react/')) return 'react';
                return 'vendor';
              },
            },
          }
        : undefined,
    },
    test: {
      name: '@convexa/dashboard',
      watch: false,
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      testTimeout: 15000,
      server: { deps: { inline: [/@mui\//, 'react-transition-group'] } },
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: './test-output/vitest/coverage',
        provider: 'v8' as const,
      },
    },
  };
});
