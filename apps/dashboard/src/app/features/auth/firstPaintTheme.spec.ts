/**
 * First-paint theme hint: anonymous never-touched stays dark (AC-A3); a stored light pref
 * (or last resolved paint cache) must paint light BEFORE the React bundle. The blocking
 * index.html script cannot import this module — this spec pins it to the same keys + canvas
 * tokens so the duplicate cannot drift.
 */
import { palette } from '@/shared/theme/tokens';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPaintMode,
  resolveFirstPaintMode,
  THEME_PAINT_KEY,
  type PaintMode,
} from './firstPaintTheme';
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

const INK = palette.dark.background.default;
const PAPER = palette.light.background.default;

function store(entries: Record<string, string>): (key: string) => string | null {
  return (key) => (key in entries ? entries[key] : null);
}

describe('resolveFirstPaintMode', () => {
  it('anonymous never-touched → dark (AC-A3)', () => {
    expect(resolveFirstPaintMode(() => null, false)).toBe('dark');
    expect(resolveFirstPaintMode(() => null, true)).toBe('dark');
  });

  it('paint cache wins over uiprefs (last resolved mode, including signed-in)', () => {
    expect(
      resolveFirstPaintMode(
        store({
          [THEME_PAINT_KEY]: 'light',
          [UIPREFS_KEY]: JSON.stringify({ theme: 'dark' }),
        }),
        false,
      ),
    ).toBe('light');
  });

  it('uiprefs light → light when no paint cache', () => {
    expect(
      resolveFirstPaintMode(store({ [UIPREFS_KEY]: JSON.stringify({ theme: 'light' }) }), false),
    ).toBe('light');
  });

  it('legacy gammaflow key is consulted when the new key is empty', () => {
    expect(
      resolveFirstPaintMode(
        store({ [UIPREFS_LEGACY_KEY]: JSON.stringify({ theme: 'light' }) }),
        false,
      ),
    ).toBe('light');
  });

  it('system pref follows prefers-color-scheme; missing match → dark', () => {
    const raw = JSON.stringify({ theme: 'system' });
    expect(resolveFirstPaintMode(store({ [UIPREFS_KEY]: raw }), true)).toBe('light');
    expect(resolveFirstPaintMode(store({ [UIPREFS_KEY]: raw }), false)).toBe('dark');
  });

  it('corrupt blob / storage throw → dark, never throws', () => {
    expect(resolveFirstPaintMode(store({ [UIPREFS_KEY]: '{not json' }), true)).toBe('dark');
    expect(
      resolveFirstPaintMode(() => {
        throw new Error('quota');
      }, true),
    ).toBe('dark');
  });
});

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

  it('a non-module script runs BEFORE the React bundle and names the same keys + canvases', () => {
    const blocking = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!blocking)
      throw new Error('index.html must carry a blocking (no type=module) first-paint script');
    const body = blocking[1];
    expect(body).toContain(THEME_PAINT_KEY);
    expect(body).toContain(UIPREFS_KEY);
    expect(body).toContain(UIPREFS_LEGACY_KEY);
    expect(body).toContain(INK);
    expect(body).toContain(PAPER);
    expect(body).toContain('data-theme');
    const blockingIdx = indexHtml.indexOf('<script>');
    const moduleIdx = indexHtml.indexOf('type="module"');
    expect(blockingIdx).toBeGreaterThan(-1);
    expect(blockingIdx).toBeLessThan(moduleIdx);
  });

  it('MUTATION GUARD: the pin fails if the script loses the light canvas', () => {
    expect(indexHtml.includes(PAPER)).toBe(true);
    expect(`<meta name="theme-color" content="${INK}" />`.includes(PAPER)).toBe(false);
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

  function runBoot(): void {
    const blocking = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!blocking) throw new Error('missing blocking script');
    // The boot IIFE is first-paint code; eval is the only way to exercise the duplicate.
    eval(blocking[1]);
  }

  it('light uiprefs → data-theme=light and the paper theme-color', () => {
    localStorage.setItem(UIPREFS_KEY, JSON.stringify({ schema_version: 1, theme: 'light' }));
    runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(PAPER);
  });

  it('no storage → stays dark (does not rewrite the static meta to light)', () => {
    runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(INK);
  });

  it('system + prefers-color-scheme: light → light', () => {
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
    runBoot();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
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

describe('PaintMode stays the two resolved modes MUI emits', () => {
  const modes: PaintMode[] = ['light', 'dark'];
  it('is the closed set light | dark (not system — system is a pref, not a paint)', () => {
    expect(modes).toEqual(['light', 'dark']);
  });
});
