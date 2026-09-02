/**
 * massive-flat-file-keep F1 — NO_UI_CHANGE structural enforcement
 * (AC-42, AC-43, AC-44, AC-45, AC-46, AC-48).
 *
 * Pages trader origin 404s `/api/_research` like `/api/_metrics`; trader dashboard
 * sources and `libs/api` convexa.ts carry no flat-files keep chrome; OperatorMetrics
 * `STAGES` stays the closed six-name latency set; `/_ops` keep matrix stays absent.
 *
 * Needles deliberately omit `LiveTape` and bare `tape` (PLAN carry-forward).
 * Mutation-tested: a scan that cannot prove it bites is not enforcement
 * (`[structural-over-prose-enforcement]`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** PLAN F1 floor — flat-files keep chrome that must not leak onto trader routes. */
const TRADER_FORBIDDEN = [
  '/api/_research/flat-files',
  'flat-files keep',
  'MASSIVE FLAT FILES',
  'files.massive.com',
  'next-day CSV',
  'massive_flat_files',
  'MASSIVE_FLAT_FILES',
  'flat files keep',
] as const;

const CLIENT_FORBIDDEN = ['/api/_research/flat-files', 'flat-files keep'] as const;

const OPS_FORBIDDEN = ['flat-files keep', 'keep matrix'] as const;

const EXPECTED_STAGES = [
  'vendor_fetch',
  'engine_build',
  'off_exchange',
  'signals',
  'persist',
  'serialize_wrap',
] as const;

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}

const ROOT = workspaceRoot();
const PAGES_FN = resolve(ROOT, 'functions', 'api', '[[path]].ts');
const CONVEXA_CLIENT = resolve(ROOT, 'libs', 'api', 'src', 'lib', 'convexa.ts');
const LATENCY_TREND = resolve(
  ROOT,
  'apps',
  'dashboard',
  'src',
  'app',
  'pages',
  'operator-metrics',
  'useLatencyTrend.ts',
);

function hitsIn(src: string, needles: readonly string[] = TRADER_FORBIDDEN): string[] {
  return needles.filter((n) => src.includes(n));
}

/** INTERFACE standing rule 3 — trader-origin operator prefixes 404, token gate is not enough. */
function isBlockedOnTraderOrigin(pathname: string): boolean {
  return (
    pathname === '/api/_metrics' ||
    pathname.startsWith('/api/_metrics/') ||
    pathname === '/api/_research' ||
    pathname.startsWith('/api/_research/')
  );
}

function extractOperator404Condition(src: string): string {
  const match = src.match(
    /if\s*\(([\s\S]*?)\)\s*\{\s*return new Response\(\s*['"]Not Found['"]\s*,\s*\{\s*status:\s*404\s*\}\s*\)/,
  );
  return match?.[1] ?? '';
}

function pagesSourceBlocksResearch(src: string): boolean {
  const cond = extractOperator404Condition(src);
  return (
    /pathname\s*===\s*['"]\/api\/_research['"]/.test(cond) &&
    /pathname\.startsWith\(\s*['"]\/api\/_research\/['"]\s*\)/.test(cond) &&
    /pathname\s*===\s*['"]\/api\/_metrics['"]/.test(cond) &&
    /pathname\.startsWith\(\s*['"]\/api\/_metrics\/['"]\s*\)/.test(cond)
  );
}

/** Parse `export const STAGES = […] as const` — null when the declaration is missing. */
function extractStages(src: string): string[] | null {
  const match = src.match(/export const STAGES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!match) return null;
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

describe('F1 · Pages 404 /api/_research (AC-44, AC-46)', () => {
  it('anti-vacuity — the Pages catch-all exists and already 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    const cond = extractOperator404Condition(src);
    expect(cond, 'operator 404 if-block missing').not.toBe('');
    expect(cond).toContain('/api/_metrics');
    expect(src).toContain("new Response('Not Found', { status: 404 })");
  });

  it('same 404 branch covers /api/_research and flat-files extract subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/flat-files/SPY/extract')).toBe(true);
  });

  it('the block list matches INTERFACE standing rule 3 (exact + prefix, both families)', () => {
    expect(isBlockedOnTraderOrigin('/api/_metrics')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/extra')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/flat-files/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/flat-files/SPY/extract')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/ticker/SPY')).toBe(false);
    expect(isBlockedOnTraderOrigin('/api/research')).toBe(false);
    expect(isBlockedOnTraderOrigin('/api/_researching')).toBe(false);
  });

  it('mutation — omitting _research from the 404 if makes the guard fail', () => {
    const metricsOnly = `
      if (url.pathname === '/api/_metrics' || url.pathname.startsWith('/api/_metrics/')) {
        return new Response('Not Found', { status: 404 });
      }
    `;
    expect(pagesSourceBlocksResearch(metricsOnly)).toBe(false);
    const both = `
      if (
        url.pathname === '/api/_metrics' ||
        url.pathname.startsWith('/api/_metrics/') ||
        url.pathname === '/api/_research' ||
        url.pathname.startsWith('/api/_research/')
      ) {
        return new Response('Not Found', { status: 404 });
      }
    `;
    expect(pagesSourceBlocksResearch(both)).toBe(true);
  });
});

describe('F1 · no flat-files keep chrome on trader sources (AC-42, AC-43)', () => {
  it('anti-vacuity — glob sees a real trader tree (pages / features / shell)', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('mutation — empty dashboard glob fails anti-vacuity', () => {
    const empty: Record<string, string> = {};
    expect(Object.keys(empty).length).toBe(0);
    expect(Object.keys(empty).length).not.toBeGreaterThan(40);
  });

  it('dashboard production sources carry none of the flat-files keep needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      const hits = hitsIn(src);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('mutation — scanner fires on a poisoned trader source', () => {
    const poison = [
      "fetch('/api/_research/flat-files/SPY')",
      '// flat-files keep',
      '// MASSIVE FLAT FILES',
      '// files.massive.com',
      '// next-day CSV',
      '// massive_flat_files',
      '// MASSIVE_FLAT_FILES',
      '// flat files keep',
    ].join('\n');
    expect(hitsIn(poison)).toEqual([...TRADER_FORBIDDEN]);
  });

  it('carve-out — LiveTape / bare tape identifiers are not false positives', () => {
    expect(hitsIn('LiveTape stream; isLive && !streamOffline')).toEqual([]);
    expect(hitsIn('const tape = rows; // bare tape mention')).toEqual([]);
  });
});

describe('F1 · libs/api has no flat-files keep client (AC-48)', () => {
  it('convexa.ts has no flat-files research helper (schema.ts excluded)', () => {
    expect(existsSync(CONVEXA_CLIENT), CONVEXA_CLIENT).toBe(true);
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
    expect(src).toContain("export const METRICS_ENDPOINT = '/api/_metrics'");
  });

  it('mutation — CLIENT_FORBIDDEN fires on a poisoned client facade', () => {
    const poison = "export const KEEP = '/api/_research/flat-files'; // flat-files keep";
    expect(hitsIn(poison, CLIENT_FORBIDDEN)).toEqual([...CLIENT_FORBIDDEN]);
  });
});

describe('F1 · OperatorMetrics STAGES closed set + no keep matrix (AC-45)', () => {
  it('anti-vacuity — useLatencyTrend.ts exists and declares STAGES', () => {
    expect(existsSync(LATENCY_TREND), LATENCY_TREND).toBe(true);
    const src = readFileSync(LATENCY_TREND, 'utf8');
    expect(extractStages(src)).not.toBeNull();
  });

  it('STAGES set-equality remains the six latency names', () => {
    const src = readFileSync(LATENCY_TREND, 'utf8');
    expect(extractStages(src)).toEqual([...EXPECTED_STAGES]);
  });

  it('operator-metrics product sources contain none of flat-files keep / keep matrix', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (!path.includes('/operator-metrics/')) continue;
      const hits = hitsIn(src, OPS_FORBIDDEN);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('mutation — an extra keep stage breaks set-equality', () => {
    const poisoned = `
      export const STAGES = [
        'vendor_fetch',
        'engine_build',
        'off_exchange',
        'signals',
        'persist',
        'serialize_wrap',
        'flat_files_keep',
      ] as const;
    `;
    expect(extractStages(poisoned)).not.toEqual([...EXPECTED_STAGES]);
    expect(extractStages(poisoned)).toEqual([...EXPECTED_STAGES, 'flat_files_keep']);
  });

  it('mutation — OPS_FORBIDDEN fires on a poisoned ops source', () => {
    const poison = '// flat-files keep · keep matrix';
    expect(hitsIn(poison, OPS_FORBIDDEN)).toEqual([...OPS_FORBIDDEN]);
  });
});
