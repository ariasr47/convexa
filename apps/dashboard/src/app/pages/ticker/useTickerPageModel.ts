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
import { useMemo } from 'react';
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
}

export function useTickerPageModel({
  ticker,
  selected,
  darkPool = true,
  positionQuery = null,
  takeDtePrefill,
}: UseTickerPageModelArgs): TickerPageModel {
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

  return {
    ticker,
    bundle,
    history,
    universeMembership,
    structureAgeSeconds,
    marketState: bundle.data?.market_state,
    signals: bundle.data?.signals,
  };
}
