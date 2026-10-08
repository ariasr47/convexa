import type { SupportedDemoSymbol } from '../mode';
import { DTE, EXPIRIES } from './shared';
import { scenarioSeedAssets } from './assets';
import { fetchScenarioSeedAsset } from './asset-fetch';
import { createScenarioLoader } from './scenario-loader';
export * from './shared';
export const SYMBOLS = Object.keys(scenarioSeedAssets) as SupportedDemoSymbol[];
export interface TickerProjectionQuery { minDte?: number; maxDte?: number; expirations?: string[]; darkPool?: boolean }
export type ExpiryProjection = { state: 'ready'; dates: string[]; key: string } | { state: 'unsupported'; reason: 'unsupported_symbol' | 'unsupported_filter'; detail: string };
export function effectiveExpiries(query: TickerProjectionQuery): ExpiryProjection {
  if (query.darkPool === false) return { state: 'unsupported', reason: 'unsupported_filter', detail: 'This sample catalog does not include a dark-pool-disabled score variant.' };
  if ((query.minDte !== undefined && (!Number.isInteger(query.minDte) || query.minDte < 0 || query.minDte > 60)) ||
      (query.maxDte !== undefined && (!Number.isInteger(query.maxDte) || query.maxDte < 0 || query.maxDte > 60)) ||
      (query.minDte !== undefined && query.maxDte !== undefined && query.minDte > query.maxDte))
    return { state: 'unsupported', reason: 'unsupported_filter', detail: 'DTE bounds must be integers from 0 to 60 with minDte no greater than maxDte.' };
  const explicit = query.expirations?.length ? [...new Set(query.expirations)].sort() : [...EXPIRIES];
  if (explicit.some((date) => !(EXPIRIES as readonly string[]).includes(date))) return { state: 'unsupported', reason: 'unsupported_filter', detail: 'The requested expiry is not in this scenario.' };
  const dates = explicit.filter((date) => {
    const dte = DTE[date as keyof typeof DTE];
    return (query.minDte === undefined || dte >= query.minDte) && (query.maxDte === undefined || dte <= query.maxDte);
  });
  if (!dates.length) return { state: 'unsupported', reason: 'unsupported_filter', detail: 'No sample expiries match the requested filters.' };
  return { state: 'ready', dates, key: dates.join(',') };
}
export const loadScenario = createScenarioLoader(scenarioSeedAssets, fetchScenarioSeedAsset);
