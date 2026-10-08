import { computeIndicators } from './indicators';
import { dataMode, scenarioProvenance, type SupportedDemoSymbol } from './mode';
import { loadScenario } from './catalog';
import type { SampleResearchCase } from './types';

export type { SampleBar, SampleResearchCase, IndicatorName, IndicatorPoint } from './types';
export interface SampleBarsView {
  symbol: SupportedDemoSymbol; interval: '1d'; priceUnit: 'USD';
  bars: import('./types').SampleBar[];
  indicators: ReturnType<typeof computeIndicators>;
}
export type LocalOutcome<T> =
  | { state: 'ready'; value: T; provenance: NonNullable<ReturnType<typeof scenarioProvenance>> }
  | { state: 'unsupported'; reason: 'unsupported_symbol' | 'unsupported_filter'; detail: string }
  | { state: 'unavailable'; reason: 'live_provider_missing' | 'uncurated' | 'capability_absent'; detail: string }
  | { state: 'error'; reason: 'load_failed' | 'invalid_sample'; detail: string };

export async function loadSampleBars(symbol: string): Promise<LocalOutcome<SampleBarsView>> {
  if (dataMode === 'live') return { state: 'unavailable', reason: 'live_provider_missing', detail: 'Daily sample bars are not available from the live provider.' };
  try {
    const scenario = await loadScenario(symbol);
    if (!scenario) return { state: 'unsupported', reason: 'unsupported_symbol', detail: `No sample bars are authored for ${symbol.toUpperCase()}.` };
    const bars = scenario.bars;
    if (bars.length !== 60 || bars.at(-1)?.date !== '2026-10-07' || bars.some((bar, i) => i > 0 && bars[i - 1].date >= bar.date))
      return { state: 'error', reason: 'invalid_sample', detail: 'The authored bar series failed its scenario checks.' };
    return { state: 'ready', value: { symbol: scenario.symbol, interval: '1d', priceUnit: 'USD', bars, indicators: computeIndicators(bars) }, provenance: scenarioProvenance()! };
  } catch { return { state: 'error', reason: 'load_failed', detail: 'Sample bars could not be loaded.' }; }
}

export async function loadSampleResearch(symbol: string): Promise<LocalOutcome<SampleResearchCase>> {
  if (dataMode === 'live') return { state: 'unavailable', reason: 'live_provider_missing', detail: 'Sample research is not a live provider capability.' };
  try {
    const scenario = await loadScenario(symbol);
    if (!scenario) return { state: 'unsupported', reason: 'unsupported_symbol', detail: `No sample research is authored for ${symbol.toUpperCase()}.` };
    const ids = new Set(scenario.bars.map((bar) => bar.id));
    if (!scenario.research.evidence.every((fact) => fact.state !== 'present' || fact.sourceIds.every((id) => ids.has(id))))
      return { state: 'error', reason: 'invalid_sample', detail: 'A research source does not resolve to this scenario.' };
    return { state: 'ready', value: scenario.research, provenance: scenarioProvenance()! };
  } catch { return { state: 'error', reason: 'load_failed', detail: 'Sample research could not be loaded.' }; }
}
