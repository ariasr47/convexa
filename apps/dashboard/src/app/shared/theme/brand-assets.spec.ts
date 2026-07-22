/**
 * redesign-stage-2 §8-4 / §8-5 — the signature's static brand assets are REAL and token-true:
 *
 *   §8-4 — favicon assets exist at their contract sizes: `favicon.svg`; `apple-touch-icon.png`
 *          with an IHDR of exactly 180×180 (PNG header bytes parsed); `favicon.ico` whose
 *          ICONDIR carries BOTH a 16×16 and a 32×32 entry (ICO directory parsed); and
 *          `index.html` links the SVG icon + apple-touch icon (the .ico fallback link stays).
 *   §8-5 — NO GRADIENT anywhere in the mark/signature sources or the favicon (the gradient mark
 *          is dead — convexa-design ban list), and the favicon's literal hexes are BYTE-EXACT
 *          the token values {ink, gammaAmber} imported from tokens.ts (the blog-generator
 *          precedent: a static asset can't consume the theme, so the test pins it to the source
 *          of truth). Scans are mutation-guarded (house rule).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { gammaAmber, ink } from './tokens';

// Root-anchored raw GLOBs (not static imports — keeps @nx/enforce-module-boundaries happy).
const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const indexHtml = Object.values(INDEX_RAW)[0] ?? '';

/** The four signature sources §8-5 names (mark, primitive, moment, divider). */
const SIGNATURE_SOURCES = import.meta.glob(
  [
    '/src/app/shell/ConvexaMark.tsx',
    '/src/app/shared/ui/arc.ts',
    '/src/app/pages/landing/HeroCurve.tsx',
    '/src/app/shared/ui/ArcDivider.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

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
const pub = (f: string) => resolve(DASHBOARD_ROOT, 'public', f);

/** Pure checker (mutation-tested): any gradient construct in a text. */
function gradientTells(text: string): string[] {
  return ['gradient(', '<linearGradient', '<radialGradient'].filter((t) =>
    text.toLowerCase().includes(t.toLowerCase()),
  );
}

/** PNG IHDR dimensions (width/height big-endian u32 at offsets 16/20). */
function pngDims(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString('ascii'), 'PNG signature').toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** ICO directory entries: [{width, height}] (0 encodes 256). */
function icoEntries(ico: Buffer): Array<{ w: number; h: number }> {
  expect(ico.readUInt16LE(0), 'ICONDIR reserved').toBe(0);
  expect(ico.readUInt16LE(2), 'ICONDIR type (1 = icon)').toBe(1);
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => ({
    w: ico.readUInt8(6 + 16 * i) || 256,
    h: ico.readUInt8(6 + 16 * i + 1) || 256,
  }));
}

describe('§8-4 · favicon assets exist at their contract sizes', () => {
  it('favicon.svg exists (the arc-X monogram)', () => {
    expect(existsSync(pub('favicon.svg'))).toBe(true);
  });

  it('apple-touch-icon.png is a PNG with IHDR exactly 180×180', () => {
    const png = readFileSync(pub('apple-touch-icon.png'));
    expect(pngDims(png)).toEqual([180, 180]);
  });

  it('favicon.ico ICONDIR carries BOTH 16×16 and 32×32 entries', () => {
    const entries = icoEntries(readFileSync(pub('favicon.ico')));
    expect(entries).toContainEqual({ w: 16, h: 16 });
    expect(entries).toContainEqual({ w: 32, h: 32 });
  });

  it('index.html links the SVG icon + apple-touch icon and KEEPS the .ico fallback', () => {
    expect(indexHtml).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
    expect(indexHtml).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
    expect(indexHtml).toMatch(/<link rel="icon" type="image\/x-icon" href="\/favicon\.ico" \/>/);
  });
});

describe('§8-5 · no gradient in the mark/signature; favicon hexes pinned to tokens', () => {
  const faviconSvg = readFileSync(pub('favicon.svg'), 'utf-8');

  it('the signature-source glob is not vacuous (all four named files loaded)', () => {
    expect(Object.keys(SIGNATURE_SOURCES).sort()).toEqual([
      '/src/app/pages/landing/HeroCurve.tsx',
      '/src/app/shared/ui/ArcDivider.tsx',
      '/src/app/shared/ui/arc.ts',
      '/src/app/shell/ConvexaMark.tsx',
    ]);
  });

  it('MUTATION GUARD: the gradient checker flags each construct', () => {
    expect(gradientTells(`background: linear-gradient(90deg, a, b)`)).toContain('gradient(');
    expect(gradientTells(`<linearGradient id="g">`)).toContain('<linearGradient');
    expect(gradientTells(`<radialGradient id="g">`)).toContain('<radialGradient');
    expect(gradientTells(`stroke="currentColor"`)).toEqual([]);
  });

  it('ConvexaMark, arc.ts, HeroCurve, ArcDivider carry NO gradient construct', () => {
    for (const [file, src] of Object.entries(SIGNATURE_SOURCES)) {
      expect(gradientTells(src), file).toEqual([]);
    }
  });

  it('favicon.svg carries NO gradient construct', () => {
    expect(gradientTells(faviconSvg)).toEqual([]);
  });

  it('favicon.svg hexes are EXACTLY {ink, gammaAmber} — byte-compared to tokens.ts', () => {
    const hexes = new Set((faviconSvg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h));
    expect([...hexes].sort()).toEqual([ink, gammaAmber].sort());
  });
});
