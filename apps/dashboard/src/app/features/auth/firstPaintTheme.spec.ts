/**
 * First-paint theme hint: anonymous never-touched stays dark (AC-A3); a stored light pref
 * (or last resolved paint cache) must paint light BEFORE the React bundle. The blocking
 * index.html script cannot import this module — this spec pins it to the same keys + canvas
 * tokens so the duplicate cannot drift.
 */
import { palette } from '@/shared/theme/tokens';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPaintMode, THEME_PAINT_KEY } from './firstPaintTheme';
import { UIPREFS_KEY, UIPREFS_LEGACY_KEY } from './localPrefs';

const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const indexHtml = Object.values(INDEX_RAW)[0] ?? '';

// `?raw` on CSS yields '' under Vitest's css pipeline (fonts.spec.ts same trap).
function dashboardRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'src', 'styles.css')) && existsSync(resolve(dir, 'index.html'))) {
      return dir;
    }
    if (existsSync(resolve(dir, 'nx.json'))) return resolve(dir, 'apps', 'dashboard');
    dir = resolve(dir, '..');
  }
  throw new Error('dashboard root not found from ' + process.cwd());
}
const stylesCss = readFileSync(resolve(dashboardRoot(), 'src', 'styles.css'), 'utf-8');
async function generatedBootstrap(mode: 'demo' | 'live' = 'live') {
  const previous = process.env.VITE_DATA_MODE;
  process.env.VITE_DATA_MODE = mode;
  const server = await createServer({
    configFile: resolve(dashboardRoot(), 'vite.config.mts'),
    root: dashboardRoot(),
    mode: 'production',
    appType: 'custom',
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server.listen();
    const html = await server.transformIndexHtml('/', indexHtml);
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const script = parsed.querySelector('script[src*="convexa-bootstrap-"]');
    const src = script?.getAttribute('src');
    if (!script || !src) throw new Error('missing external blocking bootstrap script');
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('missing Vite server address');
    const response = await fetch(`http://127.0.0.1:${address.port}${src}`);
    if (!response.ok) throw new Error(`bootstrap request failed: ${response.status}`);
    expect(response.headers.get('content-type')).toContain('javascript');
    return { html, script, src, body: await response.text() };
  } finally {
    await server.close();
    if (previous == null) delete process.env.VITE_DATA_MODE;
    else process.env.VITE_DATA_MODE = previous;
  }
}

const INK = palette.dark.background.default;
const PAPER = palette.light.background.default;

describe('applyPaintMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('writes data-theme, color-scheme, theme-color, and the paint cache', () => {
    applyPaintMode(document, 'light', PAPER);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(PAPER);
    expect(localStorage.getItem(THEME_PAINT_KEY)).toBe('light');
  });
});

describe('index.html blocking script is pinned to the module', () => {
  it('the static theme-color meta stays the dark canvas (no-JS / AC-A3)', () => {
    const m = indexHtml.match(/<meta name="theme-color" content="([^"]+)"/);
    if (!m) throw new Error('index.html must carry the static theme-color meta');
    expect(m[1]).toBe(INK);
  });

  it('a Vite-generated blocking bootstrap runs BEFORE the React bundle and names the same keys + canvases', async () => {
    const { html, script, src, body } = await generatedBootstrap('live');
    expect(script.hasAttribute('type')).toBe(false);
    expect(script.hasAttribute('async')).toBe(false);
    expect(script.hasAttribute('defer')).toBe(false);
    expect(script.textContent).toBe('');
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);
    expect(src).toBe(`/assets/convexa-bootstrap-${hash}.js`);
    expect((await generatedBootstrap('demo')).src).not.toBe(src);
    expect(html).not.toContain('__CONVEXA_BOOT__');
    expect(body).toContain(THEME_PAINT_KEY);
    expect(body).toContain(UIPREFS_KEY);
    expect(body).toContain(UIPREFS_LEGACY_KEY);
    expect(body).toContain(INK);
    expect(body).toContain(PAPER);
    expect(body).toContain('data-theme');
    expect(body).toContain('__CONVEXA_BOOT__');
    const blockingIdx = html.indexOf(script.outerHTML);
    expect(blockingIdx).toBeGreaterThan(html.indexOf('<meta name="theme-color"'));
    expect(blockingIdx).toBeLessThan(html.indexOf('</head>'));
    expect(html).toContain('type="module"');
  });
});

describe('index.html blocking script actually paints (jsdom eval)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', INK);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function runBoot(mode: 'demo' | 'live' = 'live'): Promise<void> {
    const { body } = await generatedBootstrap(mode);
    // The boot IIFE is first-paint code; eval is the only way to exercise the duplicate.
    eval(body);
  }

  it('light uiprefs → data-theme=light and the paper theme-color', async () => {
    localStorage.setItem(UIPREFS_KEY, JSON.stringify({ schema_version: 1, theme: 'light' }));
    await runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(PAPER);
  });

  it('no storage → stays dark (does not rewrite the static meta to light)', async () => {
    await runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(INK);
  });

  it('system + prefers-color-scheme: light → light', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((q: string) => ({
        matches: q.includes('prefers-color-scheme: light'),
        media: q,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      })),
    );
    localStorage.setItem(UIPREFS_KEY, JSON.stringify({ theme: 'system' }));
    await runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('demo first paint reads the demo namespace and ignores conflicting live preferences', async () => {
    localStorage.setItem('convexa.demo.v1.convexa.uiprefs.v1', JSON.stringify({ theme: 'light' }));
    localStorage.setItem('convexa.uiprefs.v1', JSON.stringify({ theme: 'dark' }));
    await runBoot('demo');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('convexa.theme-paint')).toBeNull();
  });
});

describe('styles.css first-paint canvases match the palette tokens', () => {
  it('default html/body is ink; [data-theme=light] is paper', () => {
    const compact = stylesCss.replace(/\s+/g, '').toLowerCase();
    expect(compact).toContain(`background-color:${INK.toLowerCase()}`);
    expect(compact).toContain(`html[data-theme='light']`);
    expect(compact).toContain(`background-color:${PAPER.toLowerCase()}`);
  });
});
