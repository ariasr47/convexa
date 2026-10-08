/**
 * useTickerPageModel — container hook for the Ticker page data plane.
 *
 * Owns stream **connection** (SSE lifecycle → liveTapeStore), REST bundle, structure history,
 * universe membership, structure age. Live **payloads** are read via `useLiveTape()` in
 * consumers that need ticks (§3.8 Phase C) — not re-exported here as React state, so the page
 * model does not re-render the whole board on every tape update.
 *
 * Does NOT own: portfolio book, AI rec, trade dialogs, persona state (host still owns those
 * because they couple to entry/gate UI).
 */
import {
  dataMode,
  demoClock,
  scenarioProvenance,
  subscribeDemoClock,
  type DemoClock,
} from '@convexa/api';
import { useEffect, useMemo, useState } from 'react';
import { useStructureHistory } from './useStructureHistory';
import {
  useTickerBundle,
  type PositionQueryLeg,
  type TickerBundleApi,
  type UseTickerBundleArgs,
} from './useTickerBundle';
import { useTickerStreamConnection } from './useTickerStream';
import { useUniverseMembership } from './useUniverseMembership';

export interface UseTickerPageModelArgs {
  ticker: string;
  selected: string[] | null;
  darkPool?: boolean;
  positionQuery?: PositionQueryLeg | null;
  takeDtePrefill?: UseTickerBundleArgs['takeDtePrefill'];
}

export interface TickerPageModel {
  ticker: string;
  bundle: TickerBundleApi;
  history: ReturnType<typeof useStructureHistory>;
  universeMembership: ReturnType<typeof useUniverseMembership>;
  /** REST structure age in seconds (never from SSE). */
  structureAgeSeconds: number | null;
  marketState: NonNullable<TickerBundleApi['data']>['market_state'] | undefined;
  signals: NonNullable<TickerBundleApi['data']>['signals'] | undefined;
  /** Sorted expiry set returned with the displayed bundle; never inferred from a newer pending filter. */
  selectedExpiryKey: string | null;
  /** Provenance is a separate local capability; never inferred from a generated bundle field. */
  sourceBasis: ReturnType<typeof scenarioProvenance>;
  /** The sample facade deliberately returns null; consumers must name this as unavailable. */
  positionEval: NonNullable<TickerBundleApi['data']>['position_eval'] | null;
  optionalAbsences: {
    dealerFlowProjection: boolean;
    ivRank: boolean;
    ivSkew: boolean;
    marketContext: boolean;
    offExchange: boolean;
    straddleMove: boolean;
    termStructure: boolean;
    volNormalizedGex: boolean;
  };
  playback: DemoClock['playback'] | null;
}

export function useTickerPageModel({
  ticker,
  selected,
  darkPool = true,
  positionQuery = null,
  takeDtePrefill,
}: UseTickerPageModelArgs): TickerPageModel {
  const [playback, setPlayback] = useState<DemoClock['playback'] | null>(
    () => demoClock()?.playback ?? null,
  );
  useEffect(() => {
    if (dataMode !== 'demo') return;
    return subscribeDemoClock((clock) => setPlayback(clock.playback));
  }, []);
  // SSE lifecycle only — ticks go to liveTapeStore; this hook does not re-render on payloads.
  useTickerStreamConnection(ticker, selected);
  const bundle = useTickerBundle({
    ticker,
    selected,
    darkPool,
    positionQuery,
    takeDtePrefill,
  });
  const history = useStructureHistory(ticker);
  const universeMembership = useUniverseMembership(ticker);

  const structureAgeSeconds = useMemo(
    () => bundle.data?.meta.freshness?.data_age_seconds ?? null,
    [bundle.data?.meta.freshness?.data_age_seconds],
  );
  const selectedExpiryKey = useMemo(() => {
    if (selected?.length === 0) return 'none';
    if (!bundle.data) return null;
    return (
      bundle.data.expirations
        .map((expiry) => expiry.date)
        .sort()
        .join(',') || 'none'
    );
  }, [bundle.data, selected]);
  // The optional projections are nested under the returned market_state; off_exchange is exposed
  // at bundle level. Null/absent means unavailable; valid stateful values (including no-quote
  // states and numeric zeroes) remain present.
  const optionalAbsences = useMemo(
    () => ({
      dealerFlowProjection: bundle.data?.market_state.dealer_flow_projection == null,
      ivRank: bundle.data?.market_state.iv_rank == null,
      ivSkew: bundle.data?.market_state.iv_skew == null,
      marketContext: bundle.data?.market_state.market_context == null,
      offExchange: bundle.data?.off_exchange == null,
      straddleMove: bundle.data?.market_state.straddle_move == null,
      termStructure: bundle.data?.market_state.term_structure == null,
      volNormalizedGex: bundle.data?.market_state.vol_normalized_gex == null,
    }),
    [bundle.data],
  );

  return {
    ticker,
    bundle,
    history,
    universeMembership,
    structureAgeSeconds,
    marketState: bundle.data?.market_state,
    signals: bundle.data?.signals,
    selectedExpiryKey,
    sourceBasis: dataMode === 'demo' ? scenarioProvenance() : null,
    positionEval: bundle.data?.position_eval ?? null,
    optionalAbsences,
    playback,
  };
}
