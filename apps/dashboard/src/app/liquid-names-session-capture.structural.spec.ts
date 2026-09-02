/**
 * liquid-names-session-capture F1+F2 — NO_UI_CHANGE (AC-18, AC-19, AC-25).
 *
 * F1: Pages trader origin 404s `/api/_research` like `/api/_metrics`.
 * F2: no lab-name / session-capture / warm-cache-ensure chrome on trader sources;
 *     libs/api gains no `/api/_research/session-books` helper; no authorizes/session-book
 *     redistribution affordance on trader UI.
 *
 * Mutation-tested (`[structural-over-prose-enforcement]`).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOperatorSessionArchiveSource } from '../testing/operatorSessionArchiveAllowlist';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** AC-18 closed needles — ensure / lab-name / session-capture must not leak to trader UI. */
const TRADER_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'liquid-names-session-capture',
  'liquid_session_ensure',
  'LIQUID_SESSION_ENSURE',
  'lab names',
  'warm-cache ensure',
  'session capture',
  'RESEARCH READ — SESSION BOOK',
  'no session book for',
  'authorizes: "nothing"',
  "authorizes: 'nothing'",
] as const;

const CLIENT_FORBIDDEN = ['/api/_research', 'session-books', 'liquid_session_ensure'] as const;

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

describe('F1 · Pages 404 /api/_research (AC-19)', () => {
  it('anti-vacuity — Pages catch-all exists and 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(extractOperator404Condition(src)).toContain('/api/_metrics');
    expect(src).toContain("new Response('Not Found', { status: 404 })");
  });

  it('same 404 branch covers /api/_research and session-books subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/QQQ/book')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/IWM')).toBe(true);
  });

  it('the block list matches INTERFACE standing rule 4 (exact + prefix, both families)', () => {
    expect(isBlockedOnTraderOrigin('/api/_metrics')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/extra')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/QQQ/book')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/IWM')).toBe(true);
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

describe('F2 · no liquid-ensure trader chrome (AC-18 / AC-25)', () => {
  it('anti-vacuity — glob sees pages/features/shell', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
  });

  it('dashboard production sources carry none of the ensure / lab-name needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (isOperatorSessionArchiveSource(path)) continue;
      const hits = hitsIn(src);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('allowlist skip is not vacuous — trader TopNav is still scanned', () => {
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(navKey).toBeTruthy();
    expect(isOperatorSessionArchiveSource(navKey as string)).toBe(false);
  });

  it('no new trader page/route for session capture or lab names', () => {
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /liquid-names|session-capture|lab-names|session-books|_research/.test(k),
    );
    expect(leakPaths).toEqual([]);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'liquid-names'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'session-books'))).toBe(false);
  });

  it('route table and nav stay free of ensure / research-browse paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(appKey && navKey).toBeTruthy();
    expect(hitsIn(DASHBOARD_SOURCES[appKey as string])).toEqual([]);
    expect(hitsIn(DASHBOARD_SOURCES[navKey as string])).toEqual([]);
  });

  it('libs/api has no session-books / ensure research helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
  });

  it('@convexa/api production sources do not grow a session-books / ensure helper', () => {
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

  it('mutation — scanner fires on poisoned trader source', () => {
    const poison = [
      "fetch('/api/_research/session-books/SPY')",
      '// lab names',
      '// warm-cache ensure',
      '// RESEARCH READ — SESSION BOOK',
      'authorizes: "nothing"',
    ].join('\n');
    expect(hitsIn(poison).length).toBeGreaterThan(3);
    expect(hitsIn(poison)).toEqual(
      expect.arrayContaining([
        '/api/_research',
        'session-books',
        'lab names',
        'warm-cache ensure',
        'RESEARCH READ — SESSION BOOK',
        'authorizes: "nothing"',
      ]),
    );
  });

  it('carve-out — ordinary SPY/QQQ/IWM ticker mentions are not ensure chrome', () => {
    expect(hitsIn('getTicker("SPY"); streamTicker("QQQ"); IWM')).toEqual([]);
  });
});
