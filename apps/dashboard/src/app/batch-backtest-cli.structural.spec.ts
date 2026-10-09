/**
 * batch-backtest-cli F1 — NO_UI_CHANGE (AC-21, AC-22).
 *
 * Pages 404 `/api/_research` non-regression + no trader chrome for batch replay +
 * no dashboard / `@convexa/api` import of CLI, research-replay chrome, or capture browse.
 * No new trader page.
 *
 * Mutation-tested: a scan that cannot prove it bites is not enforcement
 * (`[structural-over-prose-enforcement]`).
 *
 * F2 (mainline-integration-2026-09, GATE Z item 5): the capture-browse scan below allowlists
 * exactly `pages/operator-session-archive/` — the research-lab-surface SPEC §2 "Structural
 * scanners" row names that folder an explicit allowlist for this scanner. The skip is
 * file-exact, never a needle deletion; every other trader source, including a poisoned
 * shell/TopNav.tsx, is still scanned.
 *
 * Lean tests 2026-10: this file is the ONE carrier of the operator-vs-trader scan. The
 * per-feature copies (chain-archive-object-store, chain-snapshot-capture,
 * liquid-names-session-capture, massive-flat-file-keep, replay-outcome-join,
 * session-chain-archive, session-day-tape-capture) were deleted; their identifier and URL
 * needles live on as `FOLDED_TRADER_FORBIDDEN` rows below. Their prose-copy needles were dropped.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOperatorSessionArchiveSource } from '../testing/operatorSessionArchiveAllowlist';

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

/**
 * Identifier / URL needles folded in from the deleted per-feature specs (one row per feature;
 * the comment on a shared row names every spec it came from).
 * `/api/_research` and `chain-snapshots` are already CAPTURE_BROWSE_FORBIDDEN above. Each row is
 * scanned over trader sources AND `@convexa/api` production sources. `skipOperatorFolder` keeps
 * the source spec's own scope: rows whose spec allowlisted `pages/operator-session-archive/`
 * still skip it (that folder legitimately calls `/api/_research/session-books`); the others
 * scan every trader source.
 */
const FOLDED_TRADER_FORBIDDEN: ReadonlyArray<{
  feature: string;
  needles: readonly string[];
  skipOperatorFolder: boolean;
}> = [
  {
    // chain-archive-object-store, session-chain-archive, liquid-names-session-capture
    feature: 'session-archive',
    needles: ['session-books', 'session_chain_archive', 'SESSION_CHAIN_ARCHIVE_BODY_ROOT'],
    skipOperatorFolder: true,
  },
  {
    // chain-archive-object-store, liquid-names-session-capture (AC-24 research envelope)
    feature: 'research-envelope',
    needles: ['authorizes: "nothing"', "authorizes: 'nothing'"],
    skipOperatorFolder: true,
  },
  {
    feature: 'liquid-names-session-capture',
    needles: ['liquid-names-session-capture', 'liquid_session_ensure', 'LIQUID_SESSION_ENSURE'],
    skipOperatorFolder: true,
  },
  {
    feature: 'massive-flat-file-keep',
    needles: [
      'files.massive.com',
      'massive_flat_files',
      'MASSIVE_FLAT_FILES',
      '/api/_research/flat-files',
    ],
    skipOperatorFolder: false,
  },
  {
    feature: 'replay-outcome-join',
    needles: [
      'replay-outcome-join',
      'replay_outcome_join',
      'ReplayOutcomeJoin',
      'replayOutcomeJoin',
      'cmd_replay_outcome_join',
    ],
    skipOperatorFolder: true,
  },
  {
    feature: 'session-day-tape-capture',
    needles: ['session-day-tape', 'session_day_tape', 'sessionDayTape'],
    skipOperatorFolder: false,
  },
  {
    // day-replay-mock-adapter, session-day-replay isolation (the operator replay route)
    feature: 'session-day-replay',
    needles: ['/_ops/replay', 'opsReplay', 'sessionDayReplay'],
    skipOperatorFolder: false,
  },
];

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
const API_LIB_SRC = resolve(ROOT, 'libs', 'api', 'src');

function hitsIn(src: string, needles: readonly string[] = TRADER_FORBIDDEN): string[] {
  return needles.filter((n) => src.includes(n));
}

/** `path: needle` for every needle in a trader source, optionally skipping the operator folder. */
function scanTraderSources(
  sources: Record<string, string>,
  needles: readonly string[],
  skipOperatorFolder: boolean,
): string[] {
  const hits: string[] = [];
  for (const [path, src] of Object.entries(sources)) {
    if (skipOperatorFolder && isOperatorSessionArchiveSource(path)) continue;
    for (const n of needles) {
      if (src.includes(n)) hits.push(`${path}: ${n}`);
    }
  }
  return hits;
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
      // F2 (mainline-integration-2026-09, GATE Z item 5): operator-session-archive is an
      // EXPLICIT allowlist for this scan (research-lab-surface SPEC §2) — file-exact skip,
      // never a needle deletion. CAPTURE_BROWSE_FORBIDDEN itself is unchanged.
      if (isOperatorSessionArchiveSource(path)) continue;
      for (const n of CAPTURE_BROWSE_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
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

describe('F2 · operator-session-archive allowlist is explicit and non-vacuous (mainline-integration-2026-09 GATE Z item 5)', () => {
  /** Same skip the production test above applies, exercised against synthetic sources so the
   *  allowlist's precision is provable without editing any real file on disk. */
  function scanCaptureBrowse(sources: Record<string, string>): string[] {
    const hits: string[] = [];
    for (const [path, src] of Object.entries(sources)) {
      if (isOperatorSessionArchiveSource(path)) continue;
      for (const n of CAPTURE_BROWSE_FORBIDDEN) {
        if (src.includes(n)) hits.push(`${path}: ${n}`);
      }
    }
    return hits;
  }

  it('anti-vacuity — a poisoned shell/TopNav.tsx-style source is still reported', () => {
    const poisoned: Record<string, string> = {
      '/src/app/shell/TopNav.tsx': "fetch('/api/_research/session-books/SPY')",
    };
    expect(scanCaptureBrowse(poisoned)).toEqual(['/src/app/shell/TopNav.tsx: /api/_research']);
  });

  it('anti-vacuity — a source path under the allowlisted operator folder is skipped', () => {
    const allowlisted: Record<string, string> = {
      '/src/app/pages/operator-session-archive/researchClient.ts':
        "const url = '/api/_research/chain-snapshots/SPY';",
    };
    expect(scanCaptureBrowse(allowlisted)).toEqual([]);
  });

  it('the skip is not vacuous against the real tree — the operator folder legitimately trips CAPTURE_BROWSE_FORBIDDEN today', () => {
    const skipped = Object.keys(DASHBOARD_SOURCES).filter((k) => isOperatorSessionArchiveSource(k));
    expect(skipped.length).toBeGreaterThan(0);
    const wouldHaveHit = skipped.some((k) =>
      CAPTURE_BROWSE_FORBIDDEN.some((n) => DASHBOARD_SOURCES[k].includes(n)),
    );
    expect(wouldHaveHit).toBe(true);
  });

  it('the allowlist is folder-exact — a lookalike path is not covered', () => {
    expect(
      isOperatorSessionArchiveSource('/src/app/pages/operator-session-archive-extra/evil.ts'),
    ).toBe(false);
    expect(
      isOperatorSessionArchiveSource('/src/app/pages/not-operator-session-archive/evil.ts'),
    ).toBe(false);
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

describe('folded operator-separation needles from the deleted per-feature specs', () => {
  it.each(FOLDED_TRADER_FORBIDDEN)(
    'trader sources and @convexa/api carry no $feature identifiers or URLs',
    ({ needles, skipOperatorFolder }) => {
      // The scan bites: every needle is reported from a poisoned trader TopNav.
      const poisoned = { '/src/app/shell/TopNav.tsx': needles.join('\n') };
      expect(scanTraderSources(poisoned, needles, skipOperatorFolder)).toEqual(
        needles.map((n) => `/src/app/shell/TopNav.tsx: ${n}`),
      );
      expect(scanTraderSources(DASHBOARD_SOURCES, needles, skipOperatorFolder)).toEqual([]);
      const libOffenders = collectTsFiles(API_LIB_SRC).flatMap((file) =>
        hitsIn(readFileSync(file, 'utf8'), needles).map((n) => `${file}: ${n}`),
      );
      expect(libOffenders).toEqual([]);
    },
  );
});
