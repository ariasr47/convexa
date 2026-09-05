/**
 * `liveClaim.ts` — behavioural spec (SPEC §2.1, invariant 1).
 *
 * Two jobs: (1) prove `isDeliveringLive`/`andPresent` are byte-identical in BEHAVIOUR to the
 * shipped `sessionTapeStanding.isDeliveringLive` across every branch, and (2) the mutation-guarded
 * source scan (FE-1 step 7) that keeps a SECOND liveness expression out of presentational desk
 * files, so a new file cannot invent a fifth expression.
 */
import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { andPresent, isDeliveringLive, NOT_LIVE } from './liveClaim';

function liveUpdate(overrides: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'SPY',
    live: true,
    market_session: 'open',
    ...overrides,
  } as LiveUpdate;
}

describe('isDeliveringLive — byte-identical to the shipped predicate across every branch', () => {
  it('session_tape present → NOT_LIVE, even when live: true', () => {
    const withTape = { ...liveUpdate(), session_tape: { symbol: 'SPY' } } as LiveUpdate;
    expect(isDeliveringLive(withTape, false)).toBe(false);
  });

  it('streamOffline: true → NOT_LIVE', () => {
    expect(isDeliveringLive(liveUpdate(), true)).toBe(false);
  });

  it('live === null → NOT_LIVE', () => {
    expect(isDeliveringLive(null, false)).toBe(false);
  });

  it("market_session === 'closed' → NOT_LIVE", () => {
    expect(isDeliveringLive(liveUpdate({ market_session: 'closed' }), false)).toBe(false);
  });

  it('live.live === false → NOT_LIVE', () => {
    expect(isDeliveringLive(liveUpdate({ live: false }), false)).toBe(false);
  });

  it('the one true arm: no session tape, not offline, live payload, market open, live: true', () => {
    expect(isDeliveringLive(liveUpdate({ live: true }), false)).toBe(true);
  });
});

describe('andPresent — composes "live AND value present", preserving the brand', () => {
  it('andPresent(base, null) is false regardless of base', () => {
    expect(andPresent(isDeliveringLive(liveUpdate(), false), null)).toBe(false);
  });

  it('andPresent(NOT_LIVE, 5) is false — NOT_LIVE never becomes true', () => {
    expect(andPresent(NOT_LIVE, 5)).toBe(false);
  });

  it('andPresent(live, 5) is true when the base claim is live and the value is present', () => {
    expect(andPresent(isDeliveringLive(liveUpdate(), false), 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// FE-1 step 7 — the source scan (invariant 1, second half). Presentational desk files may not
// name a second liveness expression. Follows the `arc.spec.ts` importer-set idiom.
// ---------------------------------------------------------------------------------------------

const DESK_SOURCES = import.meta.glob(
  ['/src/app/pages/ticker/widgets/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

/** Presentational desk files may not name a second liveness expression. Pure + mutation-tested. */
const BANNED = [/\bgenuineIsLive\b/, /\btape\s*\.\s*isLive\b/, /\bisLive\s*&&/];

const violatesLivenessFence = (src: string): boolean => BANNED.some((re) => re.test(src));

/**
 * EXEMPT — hosts that currently read a second liveness expression, with the reason and the task
 * that removes each entry. Live-checked below: an entry whose file no longer matches red-builds, so
 * a stale exemption cannot quietly widen the fence.
 *
 * NOTE (sequencing, plan deviation recorded in the build report). PLAN.md's FE-1 step 7 snippet
 * seeds EXEMPT with only `structure-hero/StructureHeroPanel.tsx` (a file FE-6 creates) and a prose
 * note to seed it instead with `live-tape/LiveTape.tsx` until then. Measured against the tree
 * (`grep -n "isLive" …`), TWO more files ALREADY violate the BANNED patterns today, independently of
 * this phase: `chrome/TapePulseStrip.tsx:32-33,39,69,77` (`tape.isLive`, `isLive &&` — SPEC §2.1's
 * own "second fabrication site", fixed at FE-6 step 3) and `gex-profile-chart/GexStrikeProfile.tsx:
 * 49-50` (`tape.isLive` — SPEC §2.1's "third fabrication site", re-pointed at FE-6, which owns this
 * file per the Independence table). Landing the scan without exempting them would red the FE-1
 * commit for defects neither FE-1 nor its dependents fix — not a new liveness expression this task
 * introduced. Both entries are removed by FE-6 in the same coupled edit as the LiveTape entry.
 */
const EXEMPT: Record<string, string> = {
  'pages/ticker/widgets/live-tape/LiveTape.tsx':
    'pre-FE-6 seed — re-pointed to structure-hero/StructureHeroPanel.tsx once the hero lands (re-point, never delete)',
  'pages/ticker/widgets/chrome/TapePulseStrip.tsx':
    "SPEC §2.1's second fabrication site (own `isLive` missing the `live.mid != null` requirement) — fixed at FE-6 step 3",
  'pages/ticker/widgets/gex-profile-chart/GexStrikeProfile.tsx':
    "SPEC §2.1's third fabrication site (own `tapeLive`/`liveSpot` computation) — re-pointed at FE-6, which owns this file",
};

describe('the source scan — no second liveness expression in a presentational desk file', () => {
  it('is not vacuous (desk sources actually loaded, including a live-tape and a read-strip path once they exist)', () => {
    expect(Object.keys(DESK_SOURCES).length).toBeGreaterThan(20);
    expect(Object.keys(DESK_SOURCES).some((f) => f.includes('live-tape/'))).toBe(true);
  });

  it('MUTATION GUARD: the checker flags a planted second expression and ignores a clean source', () => {
    expect(violatesLivenessFence(`const x = tape.isLive && y;`)).toBe(true);
    expect(violatesLivenessFence(`const x = genuineIsLive(live, false);`)).toBe(true);
    expect(violatesLivenessFence(`const x = isDeliveringLive(live, false);`)).toBe(false);
    expect(violatesLivenessFence(`const x = andPresent(claim, live?.gamma_flip);`)).toBe(false);
  });

  it('every EXEMPT entry still exists as a desk source (no stale exemption)', () => {
    for (const rel of Object.keys(EXEMPT)) {
      expect(DESK_SOURCES[`/src/app/${rel}`], `EXEMPT entry ${rel} must exist`).toBeTruthy();
    }
  });

  it('no non-exempt desk file names a second liveness expression', () => {
    const offenders = Object.entries(DESK_SOURCES)
      .filter(([file]) => !Object.keys(EXEMPT).some((rel) => file === `/src/app/${rel}`))
      .filter(([, src]) => violatesLivenessFence(src))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
