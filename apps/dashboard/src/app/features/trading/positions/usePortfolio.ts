/**
 * usePortfolio — the portfolio brain. Owns the durable flat positions collection, the per-CONTRACT
 * tracked-contract fetch (de-duplicated across the whole portfolio) + the honest per-LEG mark
 * ladder (the EXISTING `computeMark`, untouched, run per leg), the `PositionView` projection every
 * presentational component reads, the resting-limit fill lifecycle (fills only on a LIVE cross at
 * the limit price, and only when EVERY leg is fresh), the decision log, the ephemeral per-position
 * trend + session delta, and the durable customization/saved-view state.
 *
 * THE STORE IS v3. `allPositions()` returns `SimPosition[]` directly — the transitional in-memory
 * lift is gone, and so is `DerivedRow`. Both pages read this one hook over the one book, and the
 * store's subscription seam propagates a write on either page to the other without a reload
 * (AC-70/AC-71).
 *
 * Everything is simulation-only — no code path places a real order (`[no-real-order-path]`). Positions
 * never feed signals/score/tier/fingerprint (`[additive-keeps-score-byte-identical]`). Per-row
 * failures + store failures degrade locally (`[best-effort-isolated-or-null]`). Live cells degrade on
 * an SSE drop while records/history/customization persist (`[live-vs-static-isolation]`).
 */
import { entryContextFor } from '@/features/trading/model/captureDigest';
import { resolveLegMark } from '@/features/trading/model/legMark';
import { MarkResult } from '@/features/trading/model/mark';
import { SCHEMA_VERSION as GT_SCHEMA } from '@/features/trading/model/types';
import { useTickerSpots } from '@/features/trading/model/useTickerSpots';
import {
  fetchTrackedContract,
  LiveUpdate,
  OptionRight,
  TickerBundle,
  TrackedContract,
} from '@convexa/api';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { compositeLimitWouldFill, legContractKey, netLimitDollarsFor } from './composeMark';
import { cloneConfig, configEqual, normalizeViewConfig } from './defaults';
import { LIMIT_FILL_BASIS, resolveManualFill } from './entry';
import {
  netEntryCost,
  plPctStateOf,
  positionPl,
  SIM_POSITION_SCHEMA_VERSION,
  type InstrumentKind,
  type Leg,
  type LegId,
  type LegSide,
  type SimPosition,
} from './leg';
import {
  allPositions,
  appendDecision,
  decisionsForPosition,
  dismissMergeNotice,
  getCustomization,
  getPosition,
  getPositionsVersion,
  newId,
  positionsHealth,
  putCustomization,
  putPosition,
  shouldShowMergeNotice,
  subscribePositions,
} from './store';
import {
  CustomizationState,
  DecisionRecord,
  EntryBasis,
  EntryMode,
  FilterState,
  PositionId,
  SavedView,
  StoreHealth,
  ViewConfig,
} from './types';
import { usePlTrends } from './useTrends';
import { buildPositionView, type PositionView } from './view';

/**
 * ONE drafted leg, as the shared entry dialog emits it. `price` is PER-UNIT and POSITIVE — direction
 * lives in `side` and nowhere else (SPEC §2.1's hard stands), and `multiplier` is set at
 * CONSTRUCTION (100 for a contract, 1 for equity) and stored, never re-derived downstream.
 *
 * `price: null` means the trader has not typed one yet. The dialog will not confirm in that state —
 * a partial net is never shown and never saved.
 */
export interface LegInput {
  kind: InstrumentKind;
  ticker: string;
  side: LegSide;
  qty: number;
  multiplier: number;
  price: number | null;
  expiration: string | null;
  strike: number | null;
  right: OptionRight | null;
}

/**
 * A SINGLE-LEG ENTRY IS A ONE-ELEMENT ARRAY, so there is exactly ONE open path — never a single-leg
 * path plus a multi-leg path (SPEC §2.7 *Entry input shape*). That is what keeps
 * `single-shared-sim-entry-dialog` a variant rather than a fork at the data boundary.
 */
export interface OpenPositionInput {
  legs: LegInput[];
  entryMode: EntryMode;
  /** limit: the PER-UNIT limit price. Single-leg only — see `composeMark.netLimitDollarsFor`. */
  limitPrice?: number;
  /** Pre-resolved fill (market mode, single leg) so the dialog's own fetch isn't repeated. */
  resolvedMark?: number;
  resolvedBasis?: EntryBasis;
  stop?: number | null;
  target?: number | null;
  /**
   * outcome-ledger (AC-E18): the AI-rec identity this entry was seeded from, carried onto the `open`
   * decision record so a direct Accept stays attributable and `not_attributable_by_path` stays 0.
   * Absent / null on a manual open — never a stale claim.
   */
  aiRecFingerprint?: string | null;
  /**
   * tradeable-rec-inputs (AC-82): whether a risk block was present AT ENTRY — the presence flag
   * ONLY, never an account-size value (AC-29a). Absent/null when the host could not resolve it this
   * cycle (anonymous / a faulted settings read) — never a fabricated `false`.
   */
  riskBlockPresent?: boolean | null;
}

/** Refusals `openPosition` can return. Each is SHOWN to the trader; none is ever swallowed. */
export const OPEN_REFUSED_MULTI_UNDERLYING =
  'Every leg of a position must be on the same underlying — no position was opened.';
export const OPEN_REFUSED_NO_LEGS = 'No legs to open — no position was opened.';
export const OPEN_REFUSED_NO_MARKET_FILL = "Couldn't fill at market — no position was opened.";
export const OPEN_REFUSED_STORE_FAULTED =
  "Convexa couldn't read your saved data and won't save anything new until that's sorted — no position was opened.";

export interface OpenResult {
  ok: boolean;
  reason?: string;
  position?: SimPosition;
}

/** One CONTRACT's per-cycle lookup result, shared by every leg that references it. */
interface ContractLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
}

export function usePortfolio(
  /**
   * The ticker the PAGE is focused on (its bundle + its SSE). It is NOT the book's ticker — the
   * book can span many underlyings — so it is used ONLY as the pre-bundle fallback for identifying
   * which symbol the stream belongs to. Every leg is priced off its own ticker (R8).
   */
  focusedTicker: string,
  data: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
) {
  // Defer mark recompute under bursty SSE so UI chrome stays responsive (§3.8 Phase C).
  const liveDeferred = useDeferredValue(live);
  const isLiveDeferred = useDeferredValue(isLive);
  const streamOfflineDeferred = useDeferredValue(streamOffline);
  const [positions, setPositions] = useState<SimPosition[]>(() => allPositions());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [custom, setCustom] = useState<CustomizationState>(() => getCustomization());
  const [contractLive, setContractLive] = useState<Record<string, ContractLive>>({});
  /** Keyed by `LegId` — the mark ladder resolves LEGS now, not positions. */
  const lastMarkRef = useRef<Map<LegId, number>>(new Map());
  const trends = usePlTrends();

  const refreshPositions = useCallback(() => {
    setPositions(allPositions());
    setCustom(getCustomization());
  }, []);

  // ONE BOOK, TWO PAGES (AC-70/AC-71). The store is an external store now: a write from the Ticker
  // page's hook instance bumps the version, every subscribed instance re-reads, and the other page
  // reflects it WITHOUT a reload. `model/store.ts` had no such seam — that is precisely why the two
  // surfaces could hold competing records of one trade.
  const storeVersion = useSyncExternalStore(subscribePositions, getPositionsVersion);
  useEffect(() => {
    refreshPositions();
  }, [storeVersion, refreshPositions]);

  const m = data?.market_state;
  const session = liveDeferred?.market_session ?? null;
  const tier = data?.signals.opportunity_tier ?? 'dormant';
  const servedAt = data?.meta.served_at;

  // The durable record IS the `SimPosition` now — no lift, no second shape, no bridge.
  const simPositions = positions;

  // ---- Per-CONTRACT tracked-contract fetch, de-duplicated across the WHOLE portfolio -----------
  // A condor plus a covered call on the same underlying must not issue duplicate lookups (SPEC
  // §2.5). Per-contract isolation is preserved: one contract's 404 marks ONLY the legs referencing
  // it and every other row keeps rendering. Resolution is per-leg at the FETCH layer even though
  // display is all-or-nothing, so a row renders while its slowest leg is still in flight.
  const contractKeys = useMemo(() => {
    const keys = new Map<
      string,
      { ticker: string; expiration: string; strike: number; right: OptionRight }
    >();
    for (const p of simPositions) {
      if (p.status !== 'open' && p.status !== 'pending') continue;
      for (const l of p.legs) {
        const key = legContractKey(l);
        if (key && !keys.has(key)) {
          keys.set(key, {
            ticker: l.ticker,
            expiration: l.expiration as string,
            strike: l.strike as number,
            right: l.right as OptionRight,
          });
        }
      }
    }
    return keys;
  }, [simPositions]);
  const trackKey = [...contractKeys.keys()].sort().join(',');

  useEffect(() => {
    let cancelled = false;
    contractKeys.forEach((c, key) => {
      fetchTrackedContract(c.ticker, {
        expiration: c.expiration,
        strike: c.strike,
        right: c.right,
      })
        .then((tc) => {
          if (cancelled) return;
          setContractLive((prev) => ({ ...prev, [key]: { tracked: tc, unavailable: tc == null } }));
        })
        .catch(() => {
          if (cancelled) return;
          setContractLive((prev) => ({ ...prev, [key]: { tracked: null, unavailable: true } }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, servedAt]);

  // ---- Per-UNDERLYING spot fan-out (R8) --------------------------------------------------------
  // The book is multi-ticker; the page is not. Every DISTINCT underlying in the open/pending book
  // gets its own spot — the focused one from the bundle already in hand, the rest fetched the same
  // way and on the same terms as the per-contract fan-out above. A leg is never priced off the
  // ticker that happens to be on screen (see `model/legMark.ts`).
  const legTickers = useMemo(() => {
    const set = new Set<string>();
    for (const p of simPositions) {
      if (p.status !== 'open' && p.status !== 'pending') continue;
      for (const l of p.legs) if (l.ticker) set.add(l.ticker.toUpperCase());
    }
    return [...set];
  }, [simPositions]);
  const spots = useTickerSpots(legTickers, data, liveDeferred, focusedTicker);

  // ---- Per-LEG mark (computed each render; last-good mark kept for offline) --------------------
  // ONE resolver, shared verbatim with the broker book's `useBrokerMarks` (`model/legMark.ts`), so
  // a broker leg and a sim leg with the same contract still price identically — now by
  // construction rather than by two copies that have to be edited in lockstep.
  const legMarkFor = useCallback(
    (l: Leg): MarkResult | null => {
      const key = l.kind === 'option' ? legContractKey(l) : null;
      return resolveLegMark({
        leg: l,
        spot: spots.spotOf(l.ticker),
        liveUnderlying: spots.liveUnderlyingOf(l.ticker),
        isLive: isLiveDeferred,
        marketSession: session,
        streamOffline: streamOfflineDeferred,
        lastMark: lastMarkRef.current.get(l.id) ?? null,
        tracked: key != null ? (contractLive[key]?.tracked ?? null) : null,
      });
    },
    [contractLive, spots, isLiveDeferred, session, streamOfflineDeferred],
  );

  const legMarksById = useMemo(() => {
    const out = new Map<PositionId, Map<LegId, MarkResult | null>>();
    for (const p of simPositions) {
      const marks = new Map<LegId, MarkResult | null>();
      for (const l of p.legs) marks.set(l.id, legMarkFor(l));
      out.set(p.id, marks);
    }
    return out;
  }, [simPositions, legMarkFor]);

  /** The nearest resolvable DTE across the position's option legs. */
  const dteFor = useCallback(
    (p: SimPosition): number | null => {
      let best: number | null = null;
      for (const l of p.legs) {
        const key = legContractKey(l);
        const dte = key ? (contractLive[key]?.tracked?.dte ?? null) : null;
        if (dte != null && (best == null || dte < best)) best = dte;
      }
      return best;
    },
    [contractLive],
  );

  /** THE projection every presentational component reads. Rebuilt per cycle, never persisted. */
  const views = useMemo<PositionView[]>(
    () =>
      simPositions.map((p) =>
        buildPositionView({
          position: p,
          legMarks: legMarksById.get(p.id) ?? new Map(),
          dte: dteFor(p),
        }),
      ),
    [simPositions, legMarksById, dteFor],
  );

  const viewById = useMemo(() => new Map(views.map((v) => [v.position.id, v] as const)), [views]);

  // The shipped per-position mark, re-sourced from the leg ladder so the row and the projection can
  // never disagree. A migrated single-contract record has exactly ONE leg, so this IS that leg's
  // mark and the close path stays byte-identical for it.
  const markFor = useCallback(
    (p: SimPosition): MarkResult | null => {
      const marks = legMarksById.get(p.id);
      if (!marks) return null;
      for (const res of marks.values()) return res;
      return null;
    },
    [legMarksById],
  );

  /**
   * The P/L a decision record carries, at a single per-unit price applied to every leg.
   *
   * BYTE-IDENTICAL to the shipped `model/mark.pl(mark, entry, qty)` for a single long option leg:
   * `positionPl` reduces to `(mark - entry) * 100 * qty`, and `plPctStateOf` reduces to
   * `((mark - entry) / entry) * 100`. That identity is what AC-25 and AC-73 rest on. Used only where
   * the shipped code used `pl(...)` — the open/limit/cancel records, whose price is the trader's own
   * per-unit fill.
   */
  const plAtUniformMark = useCallback(
    (p: SimPosition, perUnit: number | null): { dollar: number | null; pct: number | null } => {
      if (perUnit == null) return { dollar: null, pct: null };
      const dollar = positionPl(p, new Map(p.legs.map((l) => [l.id, perUnit] as const)));
      const st = plPctStateOf({
        plDollar: dollar,
        netEntryCost: netEntryCost(p),
        status: 'open',
        anyLegUnresolved: false,
      });
      return { dollar, pct: st.kind === 'value' ? st.value : null };
    },
    [],
  );

  /**
   * The EPHEMERAL session Δ per position — the one live-derived datum that is not on the projection,
   * because it is measured against an in-memory session anchor rather than the record. Exposed as a
   * lookup (the `trendFor` precedent) so `derive.ts` can sort on it without importing the hook and
   * without anything durable being involved. `null` while offline: a frozen number is not a delta.
   */
  const sessionDeltaFor = useCallback(
    (id: PositionId): number | null => {
      const view = viewById.get(id);
      if (!view || view.position.status !== 'open' || view.pl_dollar == null) return null;
      const anchor = trends.sessionAnchor(id);
      return anchor != null && !streamOfflineDeferred ? view.pl_dollar - anchor : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewById, streamOfflineDeferred, historyVersion],
  );

  // ---- Keep last-good mark + feed the trend/session ring buffers (live-derived, ephemeral) ----
  useEffect(() => {
    for (const view of views) {
      const p = view.position;
      if (p.status !== 'open') continue;
      const marks = legMarksById.get(p.id);
      const fresh =
        marks != null &&
        !view.mark.unavailable &&
        !view.mark.frozen &&
        view.mark.basis !== 'last_known';
      if (fresh && view.pl_dollar != null) {
        for (const [legId, res] of marks) {
          if (res?.mark != null) lastMarkRef.current.set(legId, res.mark);
        }
        trends.record(p.id, view.pl_dollar);
      } else if (streamOfflineDeferred) {
        trends.recordBreak(p.id); // gap = broken line (never 0/interpolated)
      }
    }
    // Deliberately the SHIPPED dependency shape (`contractLive` replaces `rowLive`): `trends.record`
    // bumps a version to re-render, so depending on `views` here would re-arm this effect from its
    // own write and spin. Deps decide WHEN it runs; the body always closes over the latest values.
    // `spots` (R8) joins them so a FOREIGN ticker's spot landing also refreshes the last-known
    // cache — it is a `useMemo`'d value, so it cannot re-arm this effect from its own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractLive, spots, liveDeferred?.mid, streamOfflineDeferred]);

  // ---- Resting-limit fill lifecycle (fills only on a LIVE cross at the limit price) -----------
  useEffect(() => {
    if (streamOfflineDeferred || !isLiveDeferred) return; // no fills off a non-live mark
    for (const view of views) {
      const sp = view.position;
      if (sp.status !== 'pending') continue;
      // The units conversion lives in ONE place and is the ONLY way to obtain the branded dollar
      // net (`composeMark.ts`). `null` = this position has no interpretable limit (none recorded,
      // or more than one leg), so it never fills off one.
      const netLimit = netLimitDollarsFor(sp);
      if (netLimit == null) continue;
      const marks = legMarksById.get(sp.id);
      if (!marks) continue;
      // The COMPOSITE rule: every leg must be live, non-frozen and non-`last_known`, so a structure
      // with one stale leg never fills (SPEC §2.5, AC-44).
      if (compositeLimitWouldFill(marks, sp, netLimit)) {
        fillLimit(sp);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractLive, spots, liveDeferred?.mid, streamOfflineDeferred, isLiveDeferred]);

  // ---- Decision records ----------------------------------------------------------------------
  /**
   * The contract facts a decision record carries. They come from the position's PRIMARY OPTION LEG —
   * for a migrated single-contract record that is the only leg, so the record is byte-identical to
   * what shipped. The log is a per-position audit spine, never a per-leg one: a multi-leg position
   * still produces exactly ONE record, or the outcome ledger's `N` would multiply.
   */
  const contractOf = useCallback((p: SimPosition): DecisionRecord['contract'] => {
    const head = p.legs.find((l) => l.kind === 'option') ?? p.legs[0];
    return {
      ticker: head?.ticker ?? '',
      expiration: head?.expiration ?? '',
      strike: head?.strike ?? 0,
      right: (head?.right ?? 'call') as OptionRight,
      qty: head?.qty ?? 0,
    };
  }, []);

  const recordDecision = useCallback(
    (
      partial: Pick<DecisionRecord, 'event_type'> & Partial<DecisionRecord>,
      p: SimPosition,
      markPrice: number | null,
      basis: string,
      plv: { dollar: number | null; pct: number | null },
      aiRecFingerprint: string | null = null,
      riskBlockPresent: boolean | null = null,
    ) => {
      const head = p.legs.find((l) => l.kind === 'option') ?? p.legs[0];
      const rec: DecisionRecord = {
        id: newId(),
        clock_time: new Date().toISOString(),
        trade_id: p.id,
        contract: contractOf(p),
        mark_price: markPrice ?? head?.entry_price ?? 0,
        mark_basis: basis as DecisionRecord['mark_basis'],
        underlying_spot: m?.price ?? 0,
        pl_dollar: plv.dollar ?? 0,
        pl_pct: plv.pct ?? 0,
        tier,
        position_fingerprint: data?.position_eval?.fingerprint ?? '',
        schema_version: GT_SCHEMA,
        // outcome-ledger capture: best-effort, decision-point events only, from the bundle already
        // in hand. Never gates or alters the position write.
        ...entryContextFor(partial.event_type, {
          bundle: data,
          aiRecFingerprint,
          riskBlockPresent,
        }),
        ...partial,
      } as DecisionRecord;
      appendDecision(rec);
      setHistoryVersion((v) => v + 1);
    },
    [m, tier, data, contractOf],
  );

  const decisionsFor = useCallback(
    (id: PositionId) => decisionsForPosition(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  // ---- Open a position — ONE code path for one leg and for six ------------------------------
  const openPosition = useCallback(
    (input: OpenPositionInput): OpenResult => {
      if (input.legs.length === 0) return { ok: false, reason: OPEN_REFUSED_NO_LEGS };

      // SINGLE-UNDERLYING IS ENFORCED AT CONSTRUCTION, NOT BY THE TYPE (SPEC §2.1): the schema is
      // permissive so a future broker import can be held verbatim; construction is narrow so this
      // app never mints a shape it cannot name, price or reason about.
      const tickers = new Set(input.legs.map((l) => l.ticker.toUpperCase()));
      if (tickers.size !== 1) return { ok: false, reason: OPEN_REFUSED_MULTI_UNDERLYING };
      const ticker = [...tickers][0];

      const now = new Date().toISOString();
      const isLimit = input.entryMode === 'limit';
      const limitPrice = input.limitPrice ?? input.legs[0]?.price ?? 0;

      // MARKET is single-leg by construction (the dialog resolves ONE contract's fill), so its
      // resolved mark applies to the one leg it resolved. A missing resolution NEVER opens.
      if (
        input.entryMode === 'market' &&
        (input.resolvedMark == null || input.resolvedBasis == null)
      )
        return { ok: false, reason: OPEN_REFUSED_NO_MARKET_FILL };

      const priceFor = (li: LegInput): { mark: number; basis: EntryBasis } => {
        if (input.entryMode === 'market')
          return { mark: input.resolvedMark as number, basis: input.resolvedBasis as EntryBasis };
        if (isLimit) return { mark: limitPrice, basis: LIMIT_FILL_BASIS };
        // MANUAL — the trader's own per-unit price for THIS leg. Never back-solved, never
        // apportioned from a net: that would fabricate an instrument fact in the same audit spine
        // where the lift refuses to backfill an invented entry_time.
        const fill = resolveManualFill(li.price ?? 0);
        return { mark: fill.mark, basis: fill.basis };
      };

      const legs: Leg[] = input.legs.map((li) => {
        const { mark, basis } = priceFor(li);
        return {
          id: newId(),
          kind: li.kind,
          ticker,
          side: li.side,
          qty: li.qty,
          // STORED at construction, never re-derived from `kind` downstream.
          multiplier: li.multiplier,
          entry_price: mark,
          entry_basis: basis,
          expiration: li.expiration,
          strike: li.strike,
          right: li.right,
        };
      });

      const head = legs[0];
      // The durable record IS the leg list now. There is no flat summary left to disagree with it.
      const p: SimPosition = {
        id: newId(),
        legs,
        opened_time: isLimit ? '' : now, // VERBATIM `''` on a resting limit — never backfilled
        status: isLimit ? 'pending' : 'open',
        entry_mode: input.entryMode,
        stop: input.stop ?? null,
        target: input.target ?? null,
        schema_version: SIM_POSITION_SCHEMA_VERSION,
        ...(isLimit ? { placed_time: now, limit_price: limitPrice } : {}),
      };

      // FROM the health flag, not from trying and failing: a faulted store refuses the write and the
      // trader is told, rather than the app accepting an input it will not keep (AC-61).
      if (!putPosition(p)) return { ok: false, reason: OPEN_REFUSED_STORE_FAULTED };
      refreshPositions();
      recordDecision(
        { event_type: isLimit ? 'limit_placed' : 'open' },
        p,
        head.entry_price,
        head.entry_basis,
        plAtUniformMark(p, head.entry_price),
        input.aiRecFingerprint ?? null,
        input.riskBlockPresent ?? null,
      );
      return { ok: true, position: p };
    },
    [recordDecision, refreshPositions, plAtUniformMark],
  );

  // ---- Resting-limit transitions -------------------------------------------------------------
  const fillLimit = useCallback(
    (p: SimPosition) => {
      const fillPrice = p.limit_price ?? p.legs[0]?.entry_price ?? 0;
      const filled: SimPosition = {
        ...p,
        status: 'open',
        // A resting limit is single-leg by construction (`netLimitDollarsFor` returns null for
        // more than one leg), so the fill price lands on the leg it was quoted against.
        legs: p.legs.map((l) => ({ ...l, entry_price: fillPrice, entry_basis: LIMIT_FILL_BASIS })),
        opened_time: new Date().toISOString(),
      };
      if (!putPosition(filled)) return;
      refreshPositions();
      recordDecision(
        { event_type: 'limit_filled' },
        filled,
        fillPrice,
        LIMIT_FILL_BASIS,
        plAtUniformMark(filled, fillPrice),
      );
    },
    [recordDecision, refreshPositions, plAtUniformMark],
  );

  const cancelLimit = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'pending') return;
      const cancelled: SimPosition = {
        ...p,
        status: 'cancelled',
        close_time: new Date().toISOString(),
      };
      if (!putPosition(cancelled)) return;
      refreshPositions();
      const at = p.limit_price ?? p.legs[0]?.entry_price ?? null;
      recordDecision(
        { event_type: 'limit_cancelled' },
        cancelled,
        at,
        LIMIT_FILL_BASIS,
        plAtUniformMark(cancelled, at),
      );
    },
    [recordDecision, refreshPositions, plAtUniformMark],
  );

  // ---- Close an open position ----------------------------------------------------------------
  const closePosition = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'open') return;
      const markRes = markFor(p);
      const head = p.legs.find((l) => l.kind === 'option') ?? p.legs[0];
      const markPrice = markRes?.mark ?? head?.entry_price ?? 0;
      // The realized figures come from the PROJECTION when it has every leg — the same all-or-
      // nothing composition the row rendered — and fall back to the uniform-mark reduction, which is
      // byte-identical to the shipped `pl()` for a single-leg record.
      const view = viewById.get(id);
      const composed =
        view != null && view.pl_dollar != null
          ? { dollar: view.pl_dollar, pct: view.pl_pct.kind === 'value' ? view.pl_pct.value : null }
          : plAtUniformMark(p, markPrice);
      const closed: SimPosition = {
        ...p,
        status: 'closed',
        close_time: new Date().toISOString(),
        realized_pl_dollar: composed.dollar ?? 0,
        realized_pl_pct: composed.pct ?? 0,
      };
      if (!putPosition(closed)) return;
      refreshPositions();
      recordDecision(
        { event_type: 'close' },
        p,
        markPrice,
        markRes?.basis ?? head?.entry_basis ?? 'manual',
        composed,
      );
    },
    [markFor, recordDecision, refreshPositions, viewById, plAtUniformMark],
  );

  // ---- Customization + saved views (durable, view-only) --------------------------------------
  /**
   * READ-TIME normalization of the stored working config — the PRODUCER of `staleViewName`.
   *
   * F14 built the stale-view notice and its `staleViewName` prop; nothing set it, so AC-54 was
   * unreachable in the running app no matter how correct the component was. This is the producer,
   * and it lives on the store read because that is where a pre-existing durable view arrives.
   *
   * READING A VIEW STILL MUST NOT WRITE (AC-54, AC-82). Normalization happens HERE, in memory, over
   * the stored bytes; the SAVED VIEWS are never rewritten — which is exactly why the notice says
   * *"Save the view to keep it this way"* rather than *"we fixed your view"*. The one thing that is
   * legitimately durable is `customization.working`, the view PREFERENCE, and it is written only
   * when the trader changes something.
   */
  const normalizedWorking = useMemo(() => normalizeViewConfig(custom.working), [custom.working]);
  const working = normalizedWorking.config;

  const setWorking = useCallback(
    (patch: Partial<ViewConfig>) => {
      setCustom((prev) => {
        const next = { ...prev, working: { ...working, ...patch } };
        putCustomization(next);
        return next;
      });
    },
    [working],
  );

  const setFilter = useCallback(
    (patch: Partial<FilterState>) => {
      setCustom((prev) => {
        const next = { ...prev, working: { ...working, filter: { ...working.filter, ...patch } } };
        putCustomization(next);
        return next;
      });
    },
    [working],
  );

  const activeView = useMemo(
    () => custom.views.find((v) => v.id === custom.activeViewId) ?? custom.views[0],
    [custom],
  );
  const hasUnsavedChanges = useMemo(
    // Both sides normalized: a pre-rename stored view must not report a PHANTOM unsaved change
    // against a view the trader never edited.
    () => !configEqual(working, normalizeViewConfig(activeView.config).config),
    [working, activeView],
  );

  /** AC-54 — the ACTIVE view degraded a stale filter for rendering. Its name, or null. */
  const staleViewName = normalizedWorking.adjusted ? activeView.name : null;

  const switchView = useCallback((id: string) => {
    setCustom((prev) => {
      const v = prev.views.find((x) => x.id === id);
      if (!v) return prev;
      const next = { ...prev, activeViewId: id, working: cloneConfig(v.config) };
      putCustomization(next);
      return next;
    });
  }, []);

  // SAVE is the one gesture that commits the normalization into a stored view — "Save the view to
  // keep it this way". Everything before it leaves the stored view exactly as the trader left it.
  const saveAsNewView = useCallback(
    (name: string) => {
      setCustom((prev) => {
        const v: SavedView = { id: newId(), name, config: cloneConfig(working) };
        const next = { ...prev, views: [...prev.views, v], activeViewId: v.id };
        putCustomization(next);
        return next;
      });
    },
    [working],
  );

  const saveChanges = useCallback(() => {
    setCustom((prev) => {
      const views = prev.views.map((v) =>
        v.id === prev.activeViewId ? { ...v, config: cloneConfig(working) } : v,
      );
      const next = { ...prev, views };
      putCustomization(next);
      return next;
    });
  }, [working]);

  const renameView = useCallback((id: string, name: string) => {
    setCustom((prev) => {
      const views = prev.views.map((v) => (v.id === id ? { ...v, name } : v));
      const next = { ...prev, views };
      putCustomization(next);
      return next;
    });
  }, []);

  const deleteView = useCallback((id: string) => {
    setCustom((prev) => {
      const target = prev.views.find((v) => v.id === id);
      if (!target || target.builtin) return prev; // the seeded default cannot be deleted
      const views = prev.views.filter((v) => v.id !== id);
      const activeViewId = prev.activeViewId === id ? views[0].id : prev.activeViewId;
      const working = prev.activeViewId === id ? cloneConfig(views[0].config) : prev.working;
      const next = { ...prev, views, activeViewId, working };
      putCustomization(next);
      return next;
    });
  }, []);

  const trendFor = useCallback((id: PositionId) => trends.series(id), [trends]);

  // Computed SYNCHRONOUSLY on every render (`localStorage` is synchronous, so this is free), which
  // is what guarantees no frame ever paints enabled affordances on a faulted store (SPEC §2.9).
  const health: StoreHealth = positionsHealth();

  // AC-51 — the one-time merge notice, owed ONLY to a trader who actually had items in both places.
  // Suppressed while faulted: a dismissal cannot be persisted in a store that refuses writes, and
  // the notice would be a false claim because the promote was aborted.
  const mergeNoticePending = !health.faulted && shouldShowMergeNotice();
  const dismissMerge = useCallback(() => {
    dismissMergeNotice();
    refreshPositions();
  }, [refreshPositions]);

  return {
    positions,
    views,
    health,
    decisionsFor,
    markFor,
    trendFor,
    sessionDeltaFor,
    openPosition,
    closePosition,
    cancelLimit,
    fillLimit,
    // notices
    mergeNoticePending,
    dismissMerge,
    staleViewName,
    // customization
    custom,
    working,
    activeView,
    hasUnsavedChanges,
    setWorking,
    setFilter,
    switchView,
    saveAsNewView,
    saveChanges,
    renameView,
    deleteView,
    refreshPositions,
  };
}
