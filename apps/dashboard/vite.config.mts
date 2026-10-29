/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';
// Build tooling, not app source: the config loads the research-notes plugin at build time only.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { convexaResearch } from '../../tools/research-notes/vite-plugin.mjs';

/** Set ANALYZE=1 for a production build that writes dist/stats.html (treemap). */
const analyze = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';

/** SemVer 2.0.0, from semver.org: the pattern design/src/screens/final/changelog.mjs checks too. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** The root package.json: its "version" is Convexa's one product version (e20082aa). */
const ROOT_PACKAGE_JSON = path.resolve(import.meta.dirname, '../../package.json');

/**
 * Convexa's one product version: the root package.json "version" (e20082aa), not this app's own
 * workspace version. `define` hands it to the app as `__CONVEXA_VERSION__` (declared in
 * src/app/shared/lib/version.ts): inlined in the build, and a global that the dev server's client
 * and Vitest set before any app module runs. The footer shows it. That field is a build and test
 * input (apps/dashboard/package.json), so a version bump misses their Nx cache, and a running dev
 * server restarts when the file changes (the convexa-version-restart plugin below).
 */
function readConvexaVersion(): string {
  const { version } = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8')) as {
    version?: unknown;
  };
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error(
      `Invalid version ${JSON.stringify(version)} in ${ROOT_PACKAGE_JSON}; expected SemVer`,
    );
  }
  return version;
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const explicitMode = process.env.VITE_DATA_MODE;
  const dataMode = explicitMode ?? 'live';
  if (dataMode !== 'demo' && dataMode !== 'live') {
    throw new Error(`Invalid VITE_DATA_MODE ${JSON.stringify(dataMode)}; expected demo or live`);
  }

  const serializedMode = JSON.stringify(dataMode);
  const bootstrapSource = `(function(){var mode=${serializedMode};var boot={mode:mode,key:function(k){return mode==='demo'?'convexa.demo.v1.'+k:k;}};window.__CONVEXA_BOOT__=boot;var DARK='#0B0F17',LIGHT='#F6F6F3',theme='dark';try{var cached=localStorage.getItem(boot.key('convexa.theme-paint'));if(cached==='light'||cached==='dark')theme=cached;else{var raw=localStorage.getItem(boot.key('convexa.uiprefs.v1'))||(mode==='live'?localStorage.getItem('gammaflow.uiprefs.v1'):null);var pref=raw?JSON.parse(raw).theme:'dark';if(pref==='light')theme='light';else if(pref==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)theme='light';}}catch(e){}document.documentElement.setAttribute('data-theme',theme);var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='light'?LIGHT:DARK);})();`;
  const bootstrapHash = createHash('sha256').update(bootstrapSource).digest('hex').slice(0, 16);
  let bootstrapFileName: string;
  let bootstrapUrl: string;
  let isBuild = false;
  let appGraphBase = '/';

  const plugins: PluginOption[] = [
    react(),
    // research/<TICKER>/*.md → `virtual:convexa-research` (the owner's notes; works with data paused).
    convexaResearch({ researchDir: path.resolve(import.meta.dirname, '../../research') }),
    {
      name: 'convexa-build-bootstrap',
      configResolved(config) {
        isBuild = config.command === 'build';
        bootstrapFileName = path.posix.join(
          config.build.assetsDir,
          `convexa-bootstrap-${bootstrapHash}.js`,
        );
        bootstrapUrl = `${config.base}${bootstrapFileName}`;
      },
      buildStart() {
        if (isBuild) {
          // Mode is part of the content hash, so demo/live cannot reuse each other's CDN cache.
          this.emitFile({ type: 'asset', fileName: bootstrapFileName, source: bootstrapSource });
        }
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== bootstrapUrl) return next();
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(bootstrapSource);
        });
      },
      transformIndexHtml: {
        order: 'post',
        handler() {
          return [
            {
              tag: 'script',
              attrs: { src: bootstrapUrl },
              // A same-origin classic script satisfies script-src 'self'. It blocks parsing before
              // </head>, after the theme-color meta and before module execution / first body paint.
              injectTo: 'head',
            },
          ];
        },
      },
    },
    {
      // The app graph's chunks are a second wave: main.tsx imports ./mountApp only after the entry
      // has run, so on a phone the 28 chunks behind it started at 2.5 s and nothing painted until
      // 4.5 s (site audit 2026-10-25, PERF-01; injecting these links measured 3980 -> 3392 ms LCP).
      // One <link rel="modulepreload"> per chunk of mountApp's static graph lets the browser fetch
      // them with the entry. modulepreload fetches and compiles but never evaluates, so main.tsx's
      // rule holds: no app module runs before the build-selected workspace is initialised.
      name: 'convexa-preload-app-graph',
      configResolved(config) {
        appGraphBase = config.base;
      },
      transformIndexHtml: {
        order: 'post',
        handler(_html, ctx) {
          const bundle = ctx.bundle;
          if (!bundle) return; // dev server: modules load on demand
          const chunks = new Map(
            Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [[c.fileName, c]] : [])),
          );
          const app = [...chunks.values()].find((c) =>
            c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/mountApp.tsx'),
          );
          if (!app) {
            throw new Error('[convexa-preload-app-graph] no output chunk for src/mountApp.tsx');
          }
          // Everything the entry already loads statically is in the HTML (Vite's own preloads).
          const staticGraph = (fileName: string, seen = new Set<string>()) => {
            if (seen.has(fileName)) return seen;
            seen.add(fileName);
            for (const dep of chunks.get(fileName)?.imports ?? []) staticGraph(dep, seen);
            return seen;
          };
          const loaded = ctx.chunk ? staticGraph(ctx.chunk.fileName) : new Set<string>();
          return [...staticGraph(app.fileName)]
            .filter((fileName) => !loaded.has(fileName))
            .map((fileName) => ({
              tag: 'link',
              attrs: {
                rel: 'modulepreload',
                crossorigin: true,
                href: `${appGraphBase}${fileName}`,
              },
              injectTo: 'head' as const,
            }));
        },
      },
    },
    {
      // readConvexaVersion() runs when this config loads. Vite restarts a dev server when this file,
      // a module it imports or an .env file changes; the root package.json is read, not imported,
      // so a running dev server kept the old version after a bump: still 1.0.0 with the file at
      // 1.0.1 (review of 8edf043d). Watch the file and restart on any change to it; the restart
      // loads this config again and the open page reloads. A version that isn't SemVer fails the
      // restart, and the server keeps the old one. Builds and Vitest load the config afresh each
      // run, and under Vitest (a "serve" too) the plugin stays off.
      name: 'convexa-version-restart',
      apply: (_config, { command }) => command === 'serve' && !process.env.VITEST,
      configureServer(server) {
        server.watcher.add(ROOT_PACKAGE_JSON);
        server.watcher.on('change', (file) => {
          if (path.resolve(file) !== ROOT_PACKAGE_JSON) return;
          const { logger } = server.config;
          logger.info(`${path.relative(process.cwd(), file)} changed, restarting server...`, {
            timestamp: true,
          });
          server.restart().catch((error: unknown) => logger.error(String(error)));
        });
      },
    },
  ];
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
    // A JSON string literal: `define` replaces the identifier with this expression, verbatim.
    define: { __CONVEXA_VERSION__: JSON.stringify(readConvexaVersion()) },
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
      // Production: minified, **hidden** sourcemaps (files emitted, no sourceMappingURL in JS so
      // browsers never fetch them). tools/archive-sourcemaps.mjs then moves *.map out of dist so
      // CF Pages / Docker public roots never ship them (§4.6 private debug).
      // Development mode builds keep linked sourcemaps.
      // Vite 8 uses Rolldown/oxc minify — do not set esbuild options (deprecated).
      // Prod perf claims: only after `nx build … --configuration=production` + `nx preview`
      // (or CF Pages). Never claim prod perf from `vite` HMR or development-mode builds.
      target: 'es2022',
      minify: isProd,
      cssMinify: isProd,
      sourcemap: isProd ? 'hidden' : true,
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
              // Rolldown accepts function manualChunks only. Order matters: match React before
              // any chart helper that might share a path fragment. Do NOT force d3/react-smooth
              // into "charts" — that previously swallowed React into the charts chunk and made
              // every route import charts just for useState.
              manualChunks(id) {
                const n = id.replace(/\\/g, '/');
                if (!n.includes('/node_modules/')) return;

                // Last real package segment after node_modules (skips `.pnpm` nests).
                const segs = [...n.matchAll(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].map(
                  (m) => m[1],
                );
                const pkg =
                  [...segs].reverse().find((p) => p && p !== '.pnpm' && !p.startsWith('.')) ?? '';

                if (
                  pkg === 'react' ||
                  pkg === 'react-dom' ||
                  pkg === 'scheduler' ||
                  pkg === 'react-is'
                ) {
                  return 'react';
                }
                if (
                  pkg === 'react-router' ||
                  pkg === 'react-router-dom' ||
                  pkg === '@remix-run/router'
                ) {
                  return 'router';
                }
                if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) {
                  return 'mui';
                }
                // Do NOT force-name a "charts" chunk under Rolldown: co-locating recharts with a
                // mis-resolved react copy made every route import `charts-*.js` just for useState.
                // recharts stays with its lazy importers (Ticker GEX/term, ops LatencyTrend).
                return;
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
