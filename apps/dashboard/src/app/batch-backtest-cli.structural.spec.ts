/**
 * batch-backtest-cli F1 — NO_UI_CHANGE (AC-21, AC-22).
 *
 * Pages 404 `/api/_research` non-regression + no trader chrome for batch replay +
 * no dashboard / `@convexa/api` import of CLI, research-replay chrome, or capture browse.
 * No new trader page.
 *
 * Mutation-tested: a scan that cannot prove it bites is not enforcement
 * (`[structural-over-prose-enforcement]`).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** PLAN F1 + AC-21 closed CLI / research-replay chrome that must not leak onto trader routes. */
const TRADER_FORBIDDEN = [
  'batch-backtest',
  'batch_backtest',
  'BatchBacktest',
  'batchBacktest',
  'cmd_batch_backtest',
  'RESEARCH REPLAY — STORED SNAPSHOTS',
] as const;

/** Capture-browse / research HTTP surface must stay off the trader client. */
const CAPTURE_BROWSE_FORBIDDEN = ['/api/_research', 'chain-snapshots'] as const;

const CLIENT_FORBIDDEN = [...TRADER_FORBIDDEN, ...CAPTURE_BROWSE_FORBIDDEN] as const;

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
const API_LIB_SRC = resolve(ROOT, 'libs', 'api', 'src');
const DASHBOARD_APP = resolve(ROOT, 'apps', 'dashboard', 'src', 'app');

function hitsIn(src: string, needles: readonly string[] = TRADER_FORBIDDEN): string[] {
  return needles.filter((n) => src.includes(n));
}

/** INTERFACE standing rule 4 — trader-origin operator prefixes 404, token gate is not enough. */
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

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'generated') out.push(...collectTsFiles(p));
    else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(spec|test)\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('F1 · no trader chrome for batch-backtest (AC-21)', () => {
  it('anti-vacuity — dashboard sources load', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('trader sources do not mention batch-backtest / research replay chrome', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      for (const n of TRADER_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('trader sources do not import capture browse / research HTTP surface', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      for (const n of CAPTURE_BROWSE_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('does not add a trader page for batch replay or capture browse', () => {
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /batch-backtest|batch_backtest|research-replay|chain-snapshots|_research/.test(k),
    );
    expect(leakPaths).toEqual([]);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'batch-backtest'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'research-replay'))).toBe(false);
  });

  it('route table and nav stay free of batch-replay / capture-browse paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(appKey).toBeTruthy();
    expect(navKey).toBeTruthy();
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(hitsIn(appSrc, CLIENT_FORBIDDEN)).toEqual([]);
    expect(hitsIn(navSrc, CLIENT_FORBIDDEN)).toEqual([]);
    expect(appSrc).not.toMatch(/path=["']\/batch-backtest/);
    expect(appSrc).not.toMatch(/path=["']\/_research/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/batch-backtest/);
  });

  it('mutation — injecting batch-backtest into a fake source is detected', () => {
    expect('export const x = "batch-backtest"'.includes('batch-backtest')).toBe(true);
    const poison =
      'export const x = "batch-backtest"; const cmd = "cmd_batch_backtest"; // BatchBacktest RESEARCH REPLAY — STORED SNAPSHOTS';
    expect(hitsIn(poison)).toEqual(
      expect.arrayContaining([
        'batch-backtest',
        'batch_backtest',
        'BatchBacktest',
        'cmd_batch_backtest',
        'RESEARCH REPLAY — STORED SNAPSHOTS',
      ]),
    );
    expect(
      hitsIn("const url = '/api/_research/chain-snapshots/SPY'", CAPTURE_BROWSE_FORBIDDEN),
    ).toEqual(expect.arrayContaining(['/api/_research', 'chain-snapshots']));
  });
});

describe('F1 · Pages /api/_research 404 unchanged (AC-22)', () => {
  it('anti-vacuity — the Pages catch-all exists and already 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    const cond = extractOperator404Condition(src);
    expect(cond, 'operator 404 if-block missing').not.toBe('');
    expect(cond).toContain('/api/_metrics');
    expect(src).toContain("new Response('Not Found', { status: 404 })");
  });

  it('the same 404 branch covers /api/_research and /api/_research/*', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
  });

  it('the block list matches INTERFACE standing rule 4 (exact + prefix, both families)', () => {
    expect(isBlockedOnTraderOrigin('/api/_metrics')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/extra')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/chain-snapshots/SPY')).toBe(true);
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

describe('F1 · libs/api has no batch-backtest client', () => {
  it('convexa.ts does not grow a batch-backtest or _research replay helper', () => {
    expect(existsSync(CONVEXA_CLIENT), CONVEXA_CLIENT).toBe(true);
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(src.includes('batch-backtest')).toBe(false);
    expect(src.includes('batchBacktest')).toBe(false);
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
    expect(src).toContain("export const METRICS_ENDPOINT = '/api/_metrics'");
  });

  it('@convexa/api production sources do not import CLI / replay / capture browse', () => {
    const files = collectTsFiles(API_LIB_SRC);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const hits = hitsIn(src, CLIENT_FORBIDDEN);
      if (hits.length) offenders.push(`${file} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
