/**
 * `resolveLegMark` — THE one per-leg mark resolver, shared by the sim book (`usePortfolio`) and the
 * broker book (`useBrokerMarks`).
 *
 * WHY IT IS SHARED RATHER THAN MIRRORED. The two hooks carried byte-identical copies of this
 * branch on purpose — "so a broker leg and a sim leg with the same contract price identically".
 * A mirror is only as good as its next edit: R8 found a real-money bug living in BOTH copies, and
 * fixing either alone would have broken the very invariant the duplication existed to protect. One
 * function cannot drift from itself.
 *
 * THE R8 RULE (the bug this module exists to kill): **a leg is priced off ITS OWN underlying,
 * never off whichever ticker the page happens to be focused on.** The old branch read the focused
 * bundle's `market_state.price` / `live.mid` for EVERY equity leg with no check that the leg's own
 * symbol matched — so on a two-ticker book viewed at `/ticker/TSLA` (price 250, live mid 252) an
 * AAPL 100sh @200 position rendered `$25200 mark · +$5200 · +26.0%`: a fabricated number sitting in
 * the same column as a correct one. The option branch was contaminated the same way through
 * `anchorSpot`/`liveUnderlying`, which push the focused ticker's intraday move through a foreign
 * contract's delta/gamma.
 *
 * WHEN THIS LEG'S OWN SPOT IS NOT RESOLVED the mark is `null`. `positionPl` is all-or-nothing, so
 * the position's figure is WITHHELD and the shipped withheld-literal path renders — never a wrong
 * number, never a silent 0. That is the whole trade: a missing figure is recoverable, a confident
 * wrong figure is not.
 *
 * Pure module: no store access, no React, no fetch, no clock.
 */
import type { OptionRight, TrackedContract } from '@convexa/api';
import { computeMark, type MarkResult } from './mark';

/**
 * The structural subset of a leg this resolver needs. Deliberately NOT an import of
 * `positions/leg`'s `Leg` — `positions/` imports `model/`, and the model layer stays the leaf.
 * `Leg` is structurally assignable to it, so both call sites pass their leg straight through.
 */
export interface MarkableLeg {
  id: string;
  kind: 'option' | 'equity';
  /** THIS leg's own underlying — the field the pre-R8 equity branch never consulted. */
  ticker: string;
  strike: number | null;
  right: OptionRight | null;
}

export interface LegMarkInputs {
  leg: MarkableLeg;
  /**
   * THIS leg's own underlying spot. `null` when it has not resolved (a foreign ticker still in
   * flight, a bundle that never loaded, a symbol with no chain) — which withholds, never defaults.
   */
  spot: number | null;
  /** THIS leg's own live underlying mid. Only the streamed ticker ever has one; `null` otherwise. */
  liveUnderlying: number | null;
  isLive: boolean;
  /** `premarket|regular|afterhours|overnight|closed` — a market-wide fact, not a per-symbol one. */
  marketSession: string | null;
  streamOffline: boolean;
  /** Last good mark for THIS leg id (⏸ last-known on a stream drop). */
  lastMark: number | null;
  /** The resolved contract for an OPTION leg; `null` ⇒ unresolved ⇒ withheld. Ignored for equity. */
  tracked: TrackedContract | null;
}

export function resolveLegMark(i: LegMarkInputs): MarkResult | null {
  // EQUITY BYPASSES THE LADDER ENTIRELY (SPEC §2.5): its mark is its own live underlying mid (its
  // own spot when not live), multiplier 1, and it never issues a contract lookup.
  if (i.leg.kind === 'equity') {
    if (i.streamOffline) {
      // A dimmed but PRESENT number — a stream drop must never blank a loaded read. The last-known
      // cache is keyed by leg id and (post-R8) can only ever have been written from this leg's own
      // ticker, so the fallback below cannot resurrect a foreign price.
      const mark = i.lastMark ?? i.spot;
      return mark == null ? null : { mark, basis: 'last_known', frozen: false };
    }
    const mark = i.isLive ? (i.liveUnderlying ?? i.spot) : i.spot;
    if (mark == null) return null;
    const closed = i.marketSession === 'overnight' || i.marketSession === 'closed';
    return { mark, basis: 'snapshot', frozen: closed && !i.isLive };
  }

  // OPTION: the existing ladder, unchanged — but anchored to this leg's OWN underlying. A malformed
  // record (no strike/right/expiration) never resolves a contract, so `tracked` is null here.
  if (i.tracked == null || i.spot == null) return null;
  return computeMark({
    tracked: i.tracked,
    strike: i.leg.strike as number,
    right: i.leg.right as OptionRight,
    anchorSpot: i.spot,
    liveUnderlying: i.liveUnderlying,
    isLive: i.isLive,
    marketSession: i.marketSession,
    streamOffline: i.streamOffline,
    lastMark: i.lastMark,
  });
}
