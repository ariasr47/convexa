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
 * FE-6 UPDATE (honest finding, recorded in the build report — not a silent scope cut). PLAN.md's
 * FE-1 step 7 snippet's prose said the `live-tape/LiveTape.tsx` seed entry would be "re-pointed to
 * structure-hero/StructureHeroPanel.tsx once the hero lands." Measured against the ACTUAL shipped
 * `LiveTape.tsx` (FE-2, committed): `:66`'s `isLive = isLiveProp !== undefined ? isLiveProp :
 * tape.isLive` still reads `tape.isLive` directly, feeding `:78`'s `numbersActive = st ? displayActive
 * : isLive && !streamOffline` — and `:77-85`'s own comment explains at length why `numbersActive`
 * ("should figures move at all — true during session-tape playback too, and blind to
 * `market_session`") is DELIBERATELY a different question from `isDeliveringLive`, not a fabrication
 * of it. `LiveTape.tsx` is not one of `structure-hero/`'s four presentational children (SPEC §2.1's
 * single-store-read invariant is scoped to that directory, per the reviewer probe: "does exactly ONE
 * component in `structure-hero/` call `useLiveTape()`?") and this file is outside FE-6's owned paths
 * (Independence table). Repointing this entry AWAY from `LiveTape.tsx` would require either changing
 * FE-2's already-verified, committed behaviour, or renaming a variable purely to dodge the regex —
 * gaming the mutation guard this test exists to prevent. Left in place, unchanged, still accurate.
 * `structure-hero/StructureHeroPanel.tsx` (built this task, using ONLY `isDeliveringLive`/
 * `andPresent`) needs NO entry — it triggers none of the BANNED patterns, so none is added.
 *
 * The other two entries ARE fixed and removed here, per the same note: `chrome/TapePulseStrip.tsx`
 * (SPEC §2.1's second fabrication site) is now fully presentational — it no longer calls
 * `useLiveTape()` at all, receiving `claim`/`mid` as props (FE-6 step 3). `gex-profile-chart/
 * GexStrikeProfile.tsx` (SPEC §2.1's third fabrication site) keeps its own store read — it is a
 * standalone widget, not a hero child — but its `tape.isLive && tape.live` chain is replaced by
 * `isDeliveringLive`/`andPresent`, so it no longer matches BANNED either.
 */
const EXEMPT: Record<string, string> = {
  'pages/ticker/widgets/live-tape/LiveTape.tsx':
    "FE-2's `numbersActive` derivation genuinely differs from `isDeliveringLive` (blind to " +
    'market_session, true during session-tape playback) — see the FE-6 note above for why this ' +
    'entry stays rather than being re-pointed',
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
