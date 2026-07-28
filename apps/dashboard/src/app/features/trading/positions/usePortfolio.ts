/**
 * usePortfolio — the portfolio brain. Owns the durable flat positions collection, the per-CONTRACT
 * tracked-contract fetch (de-duplicated across the whole portfolio) + the honest per-LEG mark
 * ladder (the EXISTING `computeMark`, untouched, run per leg), the `PositionView` projection every
 * presentational component reads, the resting-limit fill lifecycle (fills only on a LIVE cross at
 * the limit price, and only when EVERY leg is fresh), the decision log, the ephemeral per-position
 * trend + session delta, and the durable customization/saved-view state.
 *
 * TRANSITIONAL: the durable store is still v2. Legacy records are lifted IN MEMORY through the same
 * `liftLegacyRecord` the real migration uses, so the render path is proven on the new shape before
 * anything writes in it. `convexa.positions.v3` is written NOWHERE until the F18 cutover.
 *
 * Everything is simulation-only — no code path places a real order (`[no-real-order-path]`). Positions
 * never feed signals/score/tier/fingerprint (`[additive-keeps-score-byte-identical]`). Per-row
 * failures + store failures degrade locally (`[best-effort-isolated-or-null]`). Live cells degrade on
 * an SSE drop while records/history/customization persist (`[live-vs-static-isolation]`).
 */
import { entryContextFor } from '@/features/trading/model/captureDigest';
import { computeMark, MarkResult, pl } from '@/features/trading/model/mark';
import { SCHEMA_VERSION as GT_SCHEMA } from '@/features/trading/model/types';
import {
  fetchTrackedContract,
  LiveUpdate,
  OptionRight,
  TickerBundle,
  TrackedContract,
} from '@org/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compositeLimitWouldFill, legContractKey } from './composeMark';
import { cloneConfig, configEqual } from './defaults';
import { DerivedRow, RowMetrics } from './derive';
import { LIMIT_FILL_BASIS, resolveManualFill } from './entry';
import { legValue, type Leg, type LegId, type SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import {
  allPositions,
  appendDecision,
  decisionsForPosition,
  getCustomization,
  getPosition,
  newId,
  positionsFaulted,
  putCustomization,
  putPosition,
} from './store';
import {
  CustomizationState,
  DecisionRecord,
  EntryBasis,
  EntryMode,
  FilterState,
  PORTFOLIO_SCHEMA_VERSION,
  Position,
  PositionId,
  SavedView,
  StoreHealth,
  ViewConfig,
} from './types';
import { usePlTrends } from './useTrends';
import { buildPositionView, type PositionView } from './view';

export interface OpenPositionInput {
  ticker: string;
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
  entryMode: EntryMode;
  /** manual: the typed price. market: ignored (resolved). limit: the limit price. */
  price?: number;
  limitPrice?: number;
  /** Pre-resolved fill (market mode) so the dialog's own fetch isn't repeated. */
  resolvedMark?: number;
  resolvedBasis?: EntryBasis;
  stop?: number | null;
  target?: number | null;
}

export interface OpenResult {
  ok: boolean;
  reason?: string;
  position?: Position;
}

/** One CONTRACT's per-cycle lookup result, shared by every leg that references it. */
interface ContractLive {
  tracked: TrackedContract | null;
  unavailable: boolean;
}

/**
 * TRANSITIONAL UNITS BRIDGE. A durable record's `limit_price` is a PER-UNIT price (SPEC §4 *Copy*:
 * `Fills at your limit $8.40 · Net debit $840`), while `composePositionMark.net_mark` is a DOLLAR
 * net. Handing the per-unit number straight to `compositeLimitWouldFill` would compare $840 of mark
 * against a $8.40 limit and silently stop every shipped resting limit from ever filling — so the
 * limit is converted to its net-dollar equivalent through the SAME leg arithmetic the mark uses.
 * For the shipped single-leg long option this reduces to `mark <= limit`, byte-identically.
 */
function netLimitOf(p: SimPosition, limitPrice: number): number {
  return p.legs.reduce((sum, l) => sum + legValue(l, limitPrice), 0);
}

export function usePortfolio(
  focusedTicker: string,
  data: TickerBundle | null,
  live: LiveUpdate | null,
  isLive: boolean,
  streamOffline: boolean,
) {
  const [positions, setPositions] = useState<Position[]>(() => allPositions());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [custom, setCustom] = useState<CustomizationState>(() => getCustomization());
  const [contractLive, setContractLive] = useState<Record<string, ContractLive>>({});
  /** Keyed by `LegId` — the mark ladder resolves LEGS now, not positions. */
  const lastMarkRef = useRef<Map<LegId, number>>(new Map());
  const trends = usePlTrends();

  const refreshPositions = useCallback(() => setPositions(allPositions()), []);

  const m = data?.market_state;
  const session = live?.market_session ?? null;
  const tier = data?.signals.opportunity_tier ?? 'dormant';
  const servedAt = data?.meta.served_at;

  // ---- The render path, on `PositionView` (the store is STILL v2) ------------------------------
  // TRANSITIONAL (removed at the F18 cutover): legacy v2 records are lifted IN MEMORY through the
  // SAME `liftLegacyRecord` the real migration uses, so the whole render path is exercised against
  // the new shape before a single byte is written in it. NOTHING DURABLE CHANGES HERE.
  const simPositions = useMemo(
    () => positions.map((p) => liftLegacyRecord(p)).filter((p): p is SimPosition => p != null),
    [positions],
  );
  const positionById = useMemo(
    () => new Map(positions.map((p) => [p.id, p] as const)),
    [positions],
  );

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

  // ---- Per-LEG mark (computed each render; last-good mark kept for offline) --------------------
  const legMarkFor = useCallback(
    (l: Leg): MarkResult | null => {
      if (!m) return null;
      // EQUITY BYPASSES THE LADDER ENTIRELY (SPEC §2.5): its mark is the live underlying mid (the
      // bundle price when not live), multiplier 1, and it NEVER issues a contract lookup. This
      // branch lives here in the resolver, NOT inside `computeMark`.
      if (l.kind === 'equity') {
        if (streamOffline) {
          // A dimmed but PRESENT number — a stream drop must never blank a loaded read.
          return {
            mark: lastMarkRef.current.get(l.id) ?? m.price,
            basis: 'last_known',
            frozen: false,
          };
        }
        const closed = session === 'overnight' || session === 'closed';
        return {
          mark: isLive ? (live?.mid ?? m.price) : m.price,
          basis: 'snapshot',
          frozen: closed && !isLive,
        };
      }
      const key = legContractKey(l);
      if (key == null) return null; // a malformed record: never priceable, in any cycle
      const cl = contractLive[key];
      if (!cl || !cl.tracked) return null;
      return computeMark({
        tracked: cl.tracked,
        strike: l.strike as number,
        right: l.right as OptionRight,
        anchorSpot: m.price,
        liveUnderlying: live?.mid ?? null,
        isLive,
        marketSession: session,
        streamOffline,
        lastMark: lastMarkRef.current.get(l.id) ?? null,
      });
    },
    [contractLive, m, live?.mid, isLive, session, streamOffline],
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

  // The shipped per-position mark, re-sourced from the leg ladder so the row and the projection can
  // never disagree. A lifted legacy record has exactly ONE leg, so this IS that leg's mark.
  const markFor = useCallback(
    (p: Position): MarkResult | null => {
      const marks = legMarksById.get(p.id);
      if (!marks) return null;
      for (const res of marks.values()) return res;
      return null;
    },
    [legMarksById],
  );

  // Build the row metrics for every position (the live-derived view).
  const rows = useMemo<DerivedRow[]>(() => {
    const out: DerivedRow[] = [];
    for (const view of views) {
      const p = positionById.get(view.position.id);
      if (!p) continue;
      const unavailable = (p.status === 'open' || p.status === 'pending') && view.mark.unavailable;
      const plDollar = p.status === 'open' && !unavailable ? view.pl_dollar : null;
      const plPct =
        p.status === 'open' && !unavailable && view.pl_pct.kind === 'value'
          ? view.pl_pct.value
          : null;
      const sessAnchor = trends.sessionAnchor(p.id);
      const sessionDelta =
        plDollar != null && sessAnchor != null && !streamOffline ? plDollar - sessAnchor : null;
      const metrics: RowMetrics = {
        id: p.id,
        plDollar,
        plPct,
        unavailable,
        deltaEntry: plDollar,
        sessionDelta,
        dte: view.dte,
      };
      out.push({ position: p, metrics, structure: view.structure, view });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, positionById, streamOffline, historyVersion]);

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
      } else if (streamOffline) {
        trends.recordBreak(p.id); // gap = broken line (never 0/interpolated)
      }
    }
    // Deliberately the SHIPPED dependency shape (`contractLive` replaces `rowLive`): `trends.record`
    // bumps a version to re-render, so depending on `views` here would re-arm this effect from its
    // own write and spin. Deps decide WHEN it runs; the body always closes over the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractLive, live?.mid, streamOffline]);

  // ---- Resting-limit fill lifecycle (fills only on a LIVE cross at the limit price) -----------
  useEffect(() => {
    if (streamOffline || !isLive) return; // no fills off a non-live mark
    for (const view of views) {
      const sp = view.position;
      if (sp.status !== 'pending' || sp.limit_price == null) continue;
      const marks = legMarksById.get(sp.id);
      const legacy = positionById.get(sp.id);
      if (!marks || !legacy) continue;
      // The COMPOSITE rule: every leg must be live, non-frozen and non-`last_known`, so a structure
      // with one stale leg never fills (SPEC §2.5, AC-44).
      if (compositeLimitWouldFill(marks, sp, netLimitOf(sp, sp.limit_price))) {
        fillLimit(legacy);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractLive, live?.mid, streamOffline, isLive]);

  // ---- Decision records ----------------------------------------------------------------------
  const recordDecision = useCallback(
    (
      partial: Pick<DecisionRecord, 'event_type'> & Partial<DecisionRecord>,
      p: Position,
      markPrice: number | null,
      basis: string,
      aiRecFingerprint: string | null = null,
    ) => {
      const plv = pl(markPrice, p.entry_mark, p.qty);
      const rec: DecisionRecord = {
        id: newId(),
        clock_time: new Date().toISOString(),
        trade_id: p.id,
        contract: {
          ticker: p.ticker,
          expiration: p.expiration,
          strike: p.strike,
          right: p.right,
          qty: p.qty,
        },
        mark_price: markPrice ?? p.entry_mark,
        mark_basis: basis as DecisionRecord['mark_basis'],
        underlying_spot: m?.price ?? 0,
        pl_dollar: plv.dollar ?? 0,
        pl_pct: plv.pct ?? 0,
        tier,
        position_fingerprint: data?.position_eval?.fingerprint ?? '',
        schema_version: GT_SCHEMA,
        // outcome-ledger capture: best-effort, decision-point events only, from the bundle already
        // in hand. Never gates or alters the position write.
        ...entryContextFor(partial.event_type, { bundle: data, aiRecFingerprint }),
        ...partial,
      } as DecisionRecord;
      appendDecision(rec);
      setHistoryVersion((v) => v + 1);
    },
    [m, tier, data],
  );

  const decisionsFor = useCallback(
    (id: PositionId) => decisionsForPosition(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyVersion],
  );

  // ---- Open a position (the 3 entry modes) ---------------------------------------------------
  const openPosition = useCallback(
    (input: OpenPositionInput): OpenResult => {
      const ticker = input.ticker.toUpperCase();
      const base = {
        id: newId(),
        ticker,
        expiration: input.expiration,
        strike: input.strike,
        right: input.right,
        side: 'long' as const,
        qty: input.qty,
        stop: input.stop ?? null,
        target: input.target ?? null,
        schema_version: PORTFOLIO_SCHEMA_VERSION,
        entry_mode: input.entryMode,
      };

      if (input.entryMode === 'manual') {
        const fill = resolveManualFill(input.price ?? 0);
        const p: Position = {
          ...base,
          entry_mark: fill.mark,
          entry_basis: fill.basis,
          entry_time: new Date().toISOString(),
          status: 'open',
        };
        putPosition(p);
        refreshPositions();
        recordDecision({ event_type: 'open' }, p, fill.mark, fill.basis);
        return { ok: true, position: p };
      }

      if (input.entryMode === 'market') {
        // The dialog already resolved the market fill (or signalled it cannot fill).
        if (input.resolvedMark == null || input.resolvedBasis == null) {
          return { ok: false, reason: "Couldn't fill at market — no position was opened." };
        }
        const p: Position = {
          ...base,
          entry_mark: input.resolvedMark,
          entry_basis: input.resolvedBasis,
          entry_time: new Date().toISOString(),
          status: 'open',
        };
        putPosition(p);
        refreshPositions();
        recordDecision({ event_type: 'open' }, p, input.resolvedMark, input.resolvedBasis);
        return { ok: true, position: p };
      }

      // limit — rests pending; fills later on a live cross.
      const limitPrice = input.limitPrice ?? input.price ?? 0;
      const p: Position = {
        ...base,
        entry_mark: limitPrice,
        entry_basis: LIMIT_FILL_BASIS,
        entry_time: '',
        placed_time: new Date().toISOString(),
        status: 'pending',
        limit_price: limitPrice,
      };
      putPosition(p);
      refreshPositions();
      recordDecision({ event_type: 'limit_placed' }, p, limitPrice, LIMIT_FILL_BASIS);
      return { ok: true, position: p };
    },
    [recordDecision, refreshPositions],
  );

  // ---- Resting-limit transitions -------------------------------------------------------------
  const fillLimit = useCallback(
    (p: Position) => {
      const filled: Position = {
        ...p,
        status: 'open',
        entry_mark: p.limit_price ?? p.entry_mark,
        entry_basis: LIMIT_FILL_BASIS,
        entry_time: new Date().toISOString(),
      };
      putPosition(filled);
      refreshPositions();
      recordDecision({ event_type: 'limit_filled' }, filled, filled.entry_mark, LIMIT_FILL_BASIS);
    },
    [recordDecision, refreshPositions],
  );

  const cancelLimit = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'pending') return;
      const cancelled: Position = {
        ...p,
        status: 'cancelled',
        close_time: new Date().toISOString(),
      };
      putPosition(cancelled);
      refreshPositions();
      recordDecision(
        { event_type: 'limit_cancelled' },
        cancelled,
        p.limit_price ?? p.entry_mark,
        LIMIT_FILL_BASIS,
      );
    },
    [recordDecision, refreshPositions],
  );

  // ---- Close an open position ----------------------------------------------------------------
  const closePosition = useCallback(
    (id: PositionId) => {
      const p = getPosition(id);
      if (!p || p.status !== 'open') return;
      const markRes = markFor(p);
      const markPrice = markRes?.mark ?? p.entry_mark;
      const plv = pl(markPrice, p.entry_mark, p.qty);
      const closed: Position = {
        ...p,
        status: 'closed',
        close_time: new Date().toISOString(),
        realized_pl_dollar: plv.dollar ?? 0,
        realized_pl_pct: plv.pct ?? 0,
      };
      putPosition(closed);
      refreshPositions();
      recordDecision({ event_type: 'close' }, p, markPrice, markRes?.basis ?? p.entry_basis);
    },
    [markFor, recordDecision, refreshPositions],
  );

  // ---- Customization + saved views (durable, view-only) --------------------------------------
  const setWorking = useCallback((patch: Partial<ViewConfig>) => {
    setCustom((prev) => {
      const next = { ...prev, working: { ...prev.working, ...patch } };
      putCustomization(next);
      return next;
    });
  }, []);

  const setFilter = useCallback((patch: Partial<FilterState>) => {
    setCustom((prev) => {
      const working = { ...prev.working, filter: { ...prev.working.filter, ...patch } };
      const next = { ...prev, working };
      putCustomization(next);
      return next;
    });
  }, []);

  const activeView = useMemo(
    () => custom.views.find((v) => v.id === custom.activeViewId) ?? custom.views[0],
    [custom],
  );
  const hasUnsavedChanges = useMemo(
    () => !configEqual(custom.working, activeView.config),
    [custom.working, activeView],
  );

  const switchView = useCallback((id: string) => {
    setCustom((prev) => {
      const v = prev.views.find((x) => x.id === id);
      if (!v) return prev;
      const next = { ...prev, activeViewId: id, working: cloneConfig(v.config) };
      putCustomization(next);
      return next;
    });
  }, []);

  const saveAsNewView = useCallback((name: string) => {
    setCustom((prev) => {
      const v: SavedView = { id: newId(), name, config: cloneConfig(prev.working) };
      const next = { ...prev, views: [...prev.views, v], activeViewId: v.id };
      putCustomization(next);
      return next;
    });
  }, []);

  const saveChanges = useCallback(() => {
    setCustom((prev) => {
      const views = prev.views.map((v) =>
        v.id === prev.activeViewId ? { ...v, config: cloneConfig(prev.working) } : v,
      );
      const next = { ...prev, views };
      putCustomization(next);
      return next;
    });
  }, []);

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
  const health: StoreHealth = { faulted: positionsFaulted(), unread_sources: [] };

  return {
    positions,
    rows,
    views,
    health,
    decisionsFor,
    markFor,
    trendFor,
    openPosition,
    closePosition,
    cancelLimit,
    fillLimit,
    // customization
    custom,
    working: custom.working,
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
