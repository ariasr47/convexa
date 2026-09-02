/**
 * session-day-tape-capture F1 — NO_UI_CHANGE structural enforcement
 * (AC-44, AC-45, AC-46, AC-47, AC-48, AC-49, AC-51, AC-52).
 *
 * Pages trader origin 404s `/api/_research` like `/api/_metrics`; trader dashboard
 * sources and `libs/api` convexa.ts carry no session-day-tape chrome; OperatorMetrics
 * `STAGES` stays the closed six-name latency set.
 *
 * Needles deliberately omit `LiveTape` and bare `tape` (PLAN carry-forward).
 * Mutation-tested: a scan that cannot prove it bites is not enforcement
 * (`[structural-over-prose-enforcement]`).
 *
 * F2 (mainline-integration-2026-09, GATE Z item 5): the day-replay-mock-adapter SPEC §4 later
 * shipped `session day tape` / `Path-A ticks` copy verbatim on the LiveTape widget S1 subtitle
 * and the S1 chip tooltips. `sessionTapeStanding.ts` and `widgets/_kit/copy.ts` are allowlisted
 * for exactly those two copy needles — file-exact + needle-exact, never a folder skip and never
 * a needle deletion. Every other needle (URL / identifier / framing) stays forbidden
 * everywhere, including inside those two files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** PLAN F1 floor — session day tape chrome that must not leak onto trader routes. */
const TRADER_FORBIDDEN = [
  '/api/_research/session-day-tape',
  'session-day-tape',
  'session day tape',
  'session_day_tape',
  'Path-A ticks',
  'Path-B snapshots',
  'saved Tuesday',
  'RESEARCH READ — SESSION DAY TAPE',
] as const;

const CLIENT_FORBIDDEN = ['/api/_research/session-day-tape', 'session-day-tape'] as const;

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

/**
 * F2 (mainline-integration-2026-09, GATE Z item 5) — reconciliation with the LATER-approved
 * day-replay-mock-adapter SPEC §4. Allowlist is exactly these two files, exactly these two
 * COPY needles. All other TRADER_FORBIDDEN needles (URL / identifier / framing) stay
 * forbidden in these files too — see the mutation tests below.
 */
const SESSION_DAY_TAPE_COPY_ALLOWLIST_FILES = [
  '/src/app/pages/ticker/sessionTapeStanding.ts',
  '/src/app/pages/ticker/widgets/_kit/copy.ts',
] as const;

const SESSION_DAY_TAPE_COPY_ALLOWLIST_NEEDLES = ['session day tape', 'Path-A ticks'] as const;

function isSessionDayTapeCopyAllowlisted(path: string, needle: string): boolean {
  return (
    (SESSION_DAY_TAPE_COPY_ALLOWLIST_FILES as readonly string[]).includes(path) &&
    (SESSION_DAY_TAPE_COPY_ALLOWLIST_NEEDLES as readonly string[]).includes(needle)
  );
}

/**
 * Path-aware TRADER_FORBIDDEN scan. Used by the production assertion below AND by the mutation
 * tests, which pass a synthetic `sources` map so the allowlist's precision is provable without
 * ever editing sessionTapeStanding.ts or widgets/_kit/copy.ts on disk.
 */
function scanSessionDayTapeNeedles(sources: Record<string, string>): string[] {
  const offenders: string[] = [];
  for (const [path, src] of Object.entries(sources)) {
    const hits = TRADER_FORBIDDEN.filter(
      (n) => src.includes(n) && !isSessionDayTapeCopyAllowlisted(path, n),
    );
    if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
  }
  return offenders;
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

describe('F1 · Pages 404 /api/_research (AC-46, AC-49)', () => {
  it('anti-vacuity — the Pages catch-all exists and already 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    const cond = extractOperator404Condition(src);
    expect(cond, 'operator 404 if-block missing').not.toBe('');
    expect(cond).toContain('/api/_metrics');
    expect(src).toContain("new Response('Not Found', { status: 404 })");
  });

  it('same 404 branch covers /api/_research and session-day-tape subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-day-tape/SPY/day')).toBe(true);
  });

  it('the block list matches INTERFACE standing rule 3 (exact + prefix, both families)', () => {
    expect(isBlockedOnTraderOrigin('/api/_metrics')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_metrics/extra')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-day-tape/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-day-tape/SPY/day')).toBe(true);
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

describe('F1 · no session-day-tape chrome on trader sources (AC-44, AC-45, AC-51, AC-52)', () => {
  it('anti-vacuity — glob sees a real trader tree (pages / features / shell)', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/shell/TopNav.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/app.tsx'))).toBe(true);
  });

  it('dashboard production sources carry none of the session-day-tape needles (F2 allowlist applied)', () => {
    expect(scanSessionDayTapeNeedles(DASHBOARD_SOURCES)).toEqual([]);
  });

  it('mutation — scanner fires on a poisoned trader source', () => {
    const poison = [
      "fetch('/api/_research/session-day-tape/SPY')",
      '// session-day-tape',
      '// session day tape',
      '// session_day_tape',
      '// Path-A ticks',
      '// Path-B snapshots',
      '// saved Tuesday',
      '// RESEARCH READ — SESSION DAY TAPE',
    ].join('\n');
    expect(hitsIn(poison)).toEqual([...TRADER_FORBIDDEN]);
  });

  it('carve-out — LiveTape / bare tape identifiers are not false positives', () => {
    expect(hitsIn('LiveTape stream; isLive && !streamOffline')).toEqual([]);
    expect(hitsIn('const tape = rows; // bare tape mention')).toEqual([]);
  });
});

describe('F2 · session-day-tape copy allowlist is explicit, narrow, and non-vacuous (mainline-integration-2026-09 GATE Z item 5)', () => {
  it('anti-vacuity — both allowlisted files exist and are seen by the real glob', () => {
    for (const file of SESSION_DAY_TAPE_COPY_ALLOWLIST_FILES) {
      expect(Object.keys(DASHBOARD_SOURCES), file).toContain(file);
    }
  });

  it('the allowlist is not vacuous — both files legitimately carry the allowlisted copy needles today', () => {
    const standing = DASHBOARD_SOURCES['/src/app/pages/ticker/sessionTapeStanding.ts'];
    const copyKit = DASHBOARD_SOURCES['/src/app/pages/ticker/widgets/_kit/copy.ts'];
    expect(standing).toContain('session day tape');
    expect(standing).toContain('Path-A ticks');
    expect(copyKit).toContain('session day tape');
  });

  it('mutation — sessionTapeStanding.ts still fails when poisoned with the forbidden URL/identifier needles', () => {
    const file = '/src/app/pages/ticker/sessionTapeStanding.ts';
    const poisoned: Record<string, string> = {
      [file]: `${DASHBOARD_SOURCES[file]}\n// poison: fetch('/api/_research/session-day-tape/SPY')`,
    };
    expect(scanSessionDayTapeNeedles(poisoned)).toEqual([
      `${file} → /api/_research/session-day-tape, session-day-tape`,
    ]);
  });

  it('mutation — widgets/_kit/copy.ts still fails when poisoned with the bare session-day-tape identifier', () => {
    const file = '/src/app/pages/ticker/widgets/_kit/copy.ts';
    const poisoned: Record<string, string> = {
      [file]: `${DASHBOARD_SOURCES[file]}\n// poison: session-day-tape`,
    };
    expect(scanSessionDayTapeNeedles(poisoned)).toEqual([`${file} → session-day-tape`]);
  });

  it('mutation — both allowlisted files still fail on the other identifier needles (RESEARCH READ / saved Tuesday / Path-B snapshots)', () => {
    const standingFile = '/src/app/pages/ticker/sessionTapeStanding.ts';
    const copyFile = '/src/app/pages/ticker/widgets/_kit/copy.ts';
    const poisoned: Record<string, string> = {
      [standingFile]: `${DASHBOARD_SOURCES[standingFile]}\n// poison: RESEARCH READ — SESSION DAY TAPE`,
      [copyFile]: `${DASHBOARD_SOURCES[copyFile]}\n// poison: saved Tuesday · Path-B snapshots`,
    };
    const offenders = scanSessionDayTapeNeedles(poisoned);
    expect(offenders).toContain(`${standingFile} → RESEARCH READ — SESSION DAY TAPE`);
    expect(offenders).toContain(`${copyFile} → Path-B snapshots, saved Tuesday`);
  });

  it('mutation — any other trader source containing the allowlisted copy needles still fails (allowlist is file-exact)', () => {
    const poisoned: Record<string, string> = {
      '/src/app/shell/TopNav.tsx': '// session day tape and Path-A ticks',
    };
    expect(scanSessionDayTapeNeedles(poisoned)).toEqual([
      '/src/app/shell/TopNav.tsx → session day tape, Path-A ticks',
    ]);
  });
});

describe('F1 · libs/api has no session-day-tape client (AC-48)', () => {
  it('convexa.ts has no session-day-tape research helper (schema.ts excluded)', () => {
    expect(existsSync(CONVEXA_CLIENT), CONVEXA_CLIENT).toBe(true);
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
    expect(src).toContain("export const METRICS_ENDPOINT = '/api/_metrics'");
  });

  it('mutation — CLIENT_FORBIDDEN fires on a poisoned client facade', () => {
    const poison = "export const TAPE = '/api/_research/session-day-tape'; // session-day-tape";
    expect(hitsIn(poison, CLIENT_FORBIDDEN)).toEqual([...CLIENT_FORBIDDEN]);
  });
});

describe('F1 · OperatorMetrics STAGES closed set (AC-47)', () => {
  it('anti-vacuity — useLatencyTrend.ts exists and declares STAGES', () => {
    expect(existsSync(LATENCY_TREND), LATENCY_TREND).toBe(true);
    const src = readFileSync(LATENCY_TREND, 'utf8');
    expect(extractStages(src)).not.toBeNull();
  });

  it('STAGES set-equality remains the six latency names', () => {
    const src = readFileSync(LATENCY_TREND, 'utf8');
    expect(extractStages(src)).toEqual([...EXPECTED_STAGES]);
  });

  it('mutation — an extra tape stage breaks set-equality', () => {
    const poisoned = `
      export const STAGES = [
        'vendor_fetch',
        'engine_build',
        'off_exchange',
        'signals',
        'persist',
        'serialize_wrap',
        'session_day_tape',
      ] as const;
    `;
    expect(extractStages(poisoned)).not.toEqual([...EXPECTED_STAGES]);
    expect(extractStages(poisoned)).toEqual([...EXPECTED_STAGES, 'session_day_tape']);
  });
});
