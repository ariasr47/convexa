/**
 * replay-outcome-join F1 — NO_UI_CHANGE (AC-20, AC-21, AC-29).
 *
 * Pages 404 `/api/_research` non-regression + no trader chrome for join measurement +
 * no dashboard / `@convexa/api` import of CLI, research-join chrome, or capture browse.
 * No new trader page.
 *
 * Mutation-tested: a scan that cannot prove it bites is not enforcement
 * (`[structural-over-prose-enforcement]`).
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOperatorSessionArchiveSource } from '../testing/operatorSessionArchiveAllowlist';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** PLAN F1 + AC-20/29 closed CLI / join-measurement chrome that must not leak onto trader routes. */
const TRADER_FORBIDDEN = [
  'replay-outcome-join',
  'replay_outcome_join',
  'ReplayOutcomeJoin',
  'replayOutcomeJoin',
  'cmd_replay_outcome_join',
  'RESEARCH JOIN — REPLAYED SCORES',
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
    if (ent.isDirectory() && ent.name !== 'generated') out.push(...collectTsFiles(p));
    else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(spec|test)\.(ts|tsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('F1 · no trader chrome for replay-outcome-join (AC-20/29)', () => {
  it('anti-vacuity — dashboard sources load', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('trader sources do not mention replay-outcome-join chrome', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (isOperatorSessionArchiveSource(path)) continue;
      for (const n of TRADER_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('trader sources do not import capture browse / research HTTP surface', () => {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (isOperatorSessionArchiveSource(path)) continue;
      for (const n of CAPTURE_BROWSE_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('allowlist skip is not vacuous — trader TopNav is still scanned', () => {
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(navKey).toBeTruthy();
    expect(isOperatorSessionArchiveSource(navKey as string)).toBe(false);
  });

  it('does not add a trader page for join measurement', () => {
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'replay-outcome-join'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'research-join'))).toBe(false);
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /replay-outcome-join|replay_outcome_join|_research|chain-snapshots/.test(k),
    );
    expect(leakPaths).toEqual([]);
  });

  it('route table and nav stay free of join paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(appKey).toBeTruthy();
    expect(navKey).toBeTruthy();
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(hitsIn(appSrc, CLIENT_FORBIDDEN)).toEqual([]);
    expect(hitsIn(navSrc, CLIENT_FORBIDDEN)).toEqual([]);
    expect(appSrc).not.toMatch(/path=["']\/replay-outcome-join/);
    expect(appSrc).not.toMatch(/path=["']\/_research/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/replay-outcome-join/);
  });

  it('Settings, Ask-AI, Ticker, Scanner, Positions stay free of join copy', () => {
    const named = Object.keys(DASHBOARD_SOURCES).filter(
      (k) =>
        k.endsWith('/SettingsPage.tsx') ||
        k.includes('/widgets/ai-rec/') ||
        k.includes('/pages/ticker/') ||
        k.includes('/pages/scanner/') ||
        k.includes('/pages/positions/') ||
        k.includes('/features/trading/positions/'),
    );
    expect(named.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const path of named) {
      const src = DASHBOARD_SOURCES[path];
      for (const n of CLIENT_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('mutation — injecting join chrome into a fake source is detected', () => {
    const poison =
      'export const x = "replay-outcome-join"; const cmd = "cmd_replay_outcome_join"; const camel = "replayOutcomeJoin"; // ReplayOutcomeJoin RESEARCH JOIN — REPLAYED SCORES';
    expect(hitsIn(poison)).toEqual(
      expect.arrayContaining([
        'replay-outcome-join',
        'replay_outcome_join',
        'cmd_replay_outcome_join',
        'ReplayOutcomeJoin',
        'replayOutcomeJoin',
        'RESEARCH JOIN — REPLAYED SCORES',
      ]),
    );
    expect(
      hitsIn("const url = '/api/_research/chain-snapshots/SPY'", CAPTURE_BROWSE_FORBIDDEN),
    ).toEqual(expect.arrayContaining(['/api/_research', 'chain-snapshots']));
  });

  it('mutation — a poisoned dashboard source file is detected by the fs walk', () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'replay-outcome-join-'));
    const poisonPath = resolve(fixtureRoot, '_mutation_poison_replay_outcome_join.ts');
    try {
      writeFileSync(poisonPath, 'export const leak = "replay-outcome-join";\n', 'utf8');
      const files = collectTsFiles(fixtureRoot);
      expect(files.some((f) => f === poisonPath)).toBe(true);
      const hits: string[] = [];
      for (const file of files) {
        const src = readFileSync(file, 'utf8');
        for (const n of TRADER_FORBIDDEN) {
          if (src.includes(n)) hits.push(`${file}: ${n}`);
        }
      }
      expect(hits.some((h) => h.includes('replay-outcome-join'))).toBe(true);
    } finally {
      if (existsSync(poisonPath)) unlinkSync(poisonPath);
      rmdirSync(fixtureRoot);
    }
  });
});

describe('F1 · Pages /api/_research 404 unchanged (AC-21)', () => {
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

  it('block list matches INTERFACE standing rule (exact + prefix)', () => {
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

describe('F1 · libs/api has no replay-outcome-join client', () => {
  it('convexa.ts does not grow a join or _research helper', () => {
    expect(existsSync(CONVEXA_CLIENT), CONVEXA_CLIENT).toBe(true);
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(src.includes('replay-outcome-join')).toBe(false);
    expect(src.includes('replayOutcomeJoin')).toBe(false);
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
    expect(src).toContain("export const METRICS_ENDPOINT = '/api/_metrics'");
  });

  it('@convexa/api production sources do not import CLI / join / capture browse', () => {
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
