/**
 * redesign-stage-1 §8-3 — fonts are SELF-HOSTED, same-origin only (deploy CSP / no-external-host
 * discipline):
 *   - zero external font URLs in index.html, src/styles.css, or the generated blog output
 *     (no fonts.googleapis / fonts.gstatic / use.typekit / any http(s) host / any CDN);
 *   - `font-display: swap` on EVERY declared face;
 *   - the first-paint preloads (Plex Sans 400 + Plex Mono 400) exist with `crossorigin`;
 *   - the shipped woff2 assets AND their OFL.txt license files exist on disk beside each face;
 *   - (skill enforcement rider, Stage 1 "face allowlist") no component names a retired-identity
 *     face literal — components bind `typographyTokens`, never a face string.
 * Source scans are MUTATION-GUARDED per the house rule (a scan that can't fail is worthless).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Root-anchored raw GLOB (not a static import — keeps @nx/enforce-module-boundaries happy).
const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const indexHtml = Object.values(INDEX_RAW)[0] ?? '';

const BLOG_PAGES = import.meta.glob(['/public/blog/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** apps/dashboard root, resolved by walking up from the test cwd to the Nx workspace root. */
function dashboardRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return resolve(dir, 'apps', 'dashboard');
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const DASHBOARD_ROOT = dashboardRoot();

// NOTE: a `?raw` import of CSS yields '' under Vitest's css pipeline (caught by the vacuity
// guard below) — the stylesheet is read from disk instead.
const stylesCss = readFileSync(resolve(DASHBOARD_ROOT, 'src', 'styles.css'), 'utf-8');

/** Pure checker (mutation-tested): external/CDN font-host references in a text. */
function externalFontHosts(text: string): string[] {
  const tells = [
    'fonts.googleapis',
    'fonts.gstatic',
    'use.typekit',
    'fontawesome',
    'cdn.jsdelivr',
    'unpkg.com',
  ];
  const hits = tells.filter((t) => text.includes(t));
  // Any absolute http(s) URL inside a @font-face src or a font preload is also a violation.
  const fontUrl =
    /(?:@font-face[^}]*src\s*:[^};]*url\(\s*['"]?(https?:\/\/[^'")]+))|(?:<link[^>]*as="font"[^>]*href="(https?:\/\/[^"]+))/gi;
  for (const m of text.matchAll(fontUrl)) hits.push(m[1] ?? m[2]);
  return hits;
}

/** Pure checker (mutation-tested): @font-face blocks missing `font-display: swap`. */
function facesMissingSwap(text: string): string[] {
  const blocks = text.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  return blocks.filter((b) => !/font-display\s*:\s*swap/.test(b));
}

describe('§8-3 · fonts self-hosted, same-origin only', () => {
  it('globs/raws are not vacuous', () => {
    expect(indexHtml.length).toBeGreaterThan(100);
    expect(stylesCss).toContain('@font-face');
    expect(Object.keys(BLOG_PAGES).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: the external-host checker fails on a Google-Fonts fixture', () => {
    expect(
      externalFontHosts(
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`,
      ),
    ).toContain('fonts.googleapis');
    expect(
      externalFontHosts(`@font-face { src: url('https://evil.example/f.woff2') format('woff2'); }`),
    ).toContain('https://evil.example/f.woff2');
    expect(externalFontHosts(`@font-face { src: url('/fonts/x/y.woff2'); }`)).toEqual([]);
  });

  it('MUTATION GUARD: the swap checker fails on a face without font-display: swap', () => {
    expect(facesMissingSwap(`@font-face { font-family: 'X'; src: url('/f.woff2'); }`)).toHaveLength(
      1,
    );
    expect(
      facesMissingSwap(
        `@font-face { font-family: 'X'; font-display: swap; src: url('/f.woff2'); }`,
      ),
    ).toEqual([]);
  });

  it('index.html + styles.css + blog output carry ZERO external font hosts', () => {
    expect(externalFontHosts(indexHtml)).toEqual([]);
    expect(externalFontHosts(stylesCss)).toEqual([]);
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      expect(externalFontHosts(html), file).toEqual([]);
    }
  });

  it('every declared face carries font-display: swap (app css + blog template output)', () => {
    expect(facesMissingSwap(stylesCss)).toEqual([]);
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      expect(facesMissingSwap(html), file).toEqual([]);
      expect(html, `${file} must declare its faces`).toContain('@font-face');
    }
  });

  it('the first-paint preloads exist with crossorigin (Plex Sans 400 + Plex Mono 400)', () => {
    const preloads = indexHtml.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    const sans = preloads.find((l) => l.includes('ibm-plex-sans-latin-400-normal.woff2'));
    const mono = preloads.find((l) => l.includes('ibm-plex-mono-latin-400-normal.woff2'));
    expect(sans, 'Plex Sans 400 preload').toBeTruthy();
    expect(mono, 'Plex Mono 400 preload').toBeTruthy();
    expect(sans).toContain('crossorigin');
    expect(mono).toContain('crossorigin');
    expect(sans).toContain('type="font/woff2"');
  });

  it('the shipped assets + OFL license files exist beside each face', () => {
    const files = [
      'public/fonts/archivo/archivo-latin-standard-normal.woff2',
      'public/fonts/archivo/OFL.txt',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-700-normal.woff2',
      'public/fonts/ibm-plex-sans/OFL.txt',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2',
      'public/fonts/ibm-plex-mono/OFL.txt',
    ];
    for (const f of files) {
      expect(existsSync(resolve(DASHBOARD_ROOT, f)), `${f} must be shipped`).toBe(true);
    }
  });
});

describe('face allowlist rider · no retired-identity face literal in components', () => {
  const RETIRED_FACES = /['"](Inter|Roboto Mono|Cascadia Code)['"]/;

  it('MUTATION GUARD: the face scan fails on an Inter literal', () => {
    expect(RETIRED_FACES.test(`fontFamily: 'Inter, sans-serif'`)).toBe(false); // stack strings differ
    expect(RETIRED_FACES.test(`fontFamily: 'Inter'`)).toBe(true);
    expect(RETIRED_FACES.test(`fontFamily: "Roboto Mono"`)).toBe(true);
  });

  it('no component source names a retired face (components bind typographyTokens)', () => {
    const violations = Object.keys(APP_SOURCES).filter((f) => RETIRED_FACES.test(APP_SOURCES[f]));
    expect(violations).toEqual([]);
  });
});
