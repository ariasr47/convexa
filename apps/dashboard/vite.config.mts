/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

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
    plugins: [react()],
    build: {
      outDir: './dist',
      emptyOutDir: true,
      // Production: minified, no sourcemaps, hashed assets, size report.
      // Development mode builds keep readable output + sourcemaps.
      // Vite 8 uses Rolldown/oxc minify — do not set esbuild options (deprecated).
      target: 'es2022',
      minify: isProd,
      cssMinify: isProd,
      sourcemap: isProd ? false : true,
      reportCompressedSize: isProd,
      chunkSizeWarningLimit: 900,
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
