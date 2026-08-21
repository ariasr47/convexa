/**
 * chain-archive-object-store F1+F2 — NO_UI_CHANGE structural enforcement (AC-15, AC-16, AC-24).
 *
 * F1: Pages trader origin 404s `/api/_research` like `/api/_metrics` (AC-16).
 * F2: no object-store / session-archive / storage-backend chrome on trader sources (AC-15);
 *     libs/api has no session-books / body-root helper; research `authorizes: "nothing"`
 *     envelope does not leak onto trader UI (AC-24).
 *
 * Mutation-tested (`[structural-over-prose-enforcement]`).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/**
 * PLAN F2 floor + SPEC §4 storage-backend ban + AC-24 envelope leak.
 * Bare `S3` is omitted: it collides with shipped broker render-state `S3_ok`.
 * Storage-S3 chrome is the closed phrases below.
 */
const TRADER_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'session_chain_archive',
  'SESSION_CHAIN_ARCHIVE_BODY_ROOT',
  'object store',
  'object-store',
  'Railway volume',
  'BYTEA',
  'session bodies moved',
  'loaded from S3',
  'stored in S3',
  'S3 book',
  'authorizes: "nothing"',
  "authorizes: 'nothing'",
] as const;

const CLIENT_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'SESSION_CHAIN_ARCHIVE_BODY_ROOT',
  'session_chain_archive',
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
const API_LIB_SRC = resolve(ROOT, 'libs', 'api', 'src');
const DASHBOARD_APP = resolve(ROOT, 'apps', 'dashboard', 'src', 'app');

function hitsIn(src: string, needles: readonly string[] = TRADER_FORBIDDEN): string[] {
  return needles.filter((n) => src.includes(n));
}

/** INTERFACE standing rule 5 — trader-origin operator prefixes 404, token gate is not enough. */
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
    if (ent.isDirectory()) out.push(...collectTsFiles(p));
    else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(spec|test)\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('F1 · Pages 404 /api/_research (AC-16)', () => {
  it('anti-vacuity — Pages catch-all exists and 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(extractOperator404Condition(src)).toContain('/api/_metrics');
    expect(src).toContain("new Response('Not Found', { status: 404 })");
  });

  it('same 404 branch covers /api/_research and session-books subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY/book')).toBe(true);
  });

  it('the block list matches INTERFACE standing rule 5 (exact + prefix, both families)', () => {
    expect(isBlockedOnTraderOrigin('/api/_metrics')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/extra')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY/book')).toBe(true);
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

describe('F2 · no storage / session-archive chrome on trader sources (AC-15, AC-24)', () => {
  it('anti-vacuity — glob sees pages/features/shell', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('dashboard production sources carry none of the forbidden needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      const hits = hitsIn(src);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('does not add trader pages for object-store / session-archive browse', () => {
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /chain-archive-object-store|session-chain-archive|session_chain_archive|session-books|_research/.test(
        k,
      ),
    );
    expect(leakPaths).toEqual([]);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'chain-archive-object-store'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'session-books'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'session-archive'))).toBe(false);
  });

  it('route table and nav stay free of object-store / research-browse paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(appKey).toBeTruthy();
    expect(navKey).toBeTruthy();
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(hitsIn(appSrc)).toEqual([]);
    expect(hitsIn(navSrc)).toEqual([]);
    expect(appSrc).not.toMatch(/path=["']\/session/);
    expect(appSrc).not.toMatch(/path=["']\/_research/);
    expect(appSrc).not.toMatch(/path=["']\/chain-archive/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/session/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/_research/);
  });

  it('Settings, Ask-AI, Ticker, Scanner, Positions, /_ops stay free of storage chrome', () => {
    const named = Object.keys(DASHBOARD_SOURCES).filter(
      (k) =>
        k.endsWith('/SettingsPage.tsx') ||
        k.includes('/widgets/ai-rec/') ||
        k.includes('/pages/ticker/') ||
        k.includes('/pages/scanner/') ||
        k.includes('/pages/positions/') ||
        k.includes('/features/trading/positions/') ||
        k.includes('/pages/operator-metrics/'),
    );
    expect(named.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const path of named) {
      const found = hitsIn(DASHBOARD_SOURCES[path]);
      if (found.length) hits.push(`${path} → ${found.join(', ')}`);
    }
    expect(hits).toEqual([]);
  });

  it('libs/api has no session-books / body-root helper', () => {
    expect(existsSync(CONVEXA_CLIENT), CONVEXA_CLIENT).toBe(true);
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
    expect(src).toContain("export const METRICS_ENDPOINT = '/api/_metrics'");
  });

  it('@convexa/api production sources do not grow a session-books / body-root helper', () => {
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

  it('mutation — scanner fires on poisoned trader source (BYTEA / S3 / volume / authorizes)', () => {
    const poison = [
      "fetch('/api/_research/session-books/SPY')",
      '// session_chain_archive',
      '// SESSION_CHAIN_ARCHIVE_BODY_ROOT',
      '// object store',
      '// object-store',
      '// Railway volume',
      '// BYTEA',
      '// session bodies moved',
      '// loaded from S3',
      '// stored in S3',
      '// S3 book',
      'authorizes: "nothing"',
      "authorizes: 'nothing'",
    ].join('\n');
    expect(hitsIn(poison)).toEqual([...TRADER_FORBIDDEN]);
  });

  it('carve-out — broker render-state S3_ok is not storage chrome', () => {
    expect(hitsIn("state: 'S3_ok'")).toEqual([]);
    expect(hitsIn('S3/S4/S6')).toEqual([]);
    expect(hitsIn('Landing ticker positions scanner settings Ask AI')).toEqual([]);
  });
});
