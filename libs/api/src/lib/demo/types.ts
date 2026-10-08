export interface SampleBar { id: string; date: string; open: number; high: number; low: number; close: number; volume: number }
export type IndicatorName = 'ema20' | 'ema50' | 'rsi14' | 'adx14' | 'atr14';
export type IndicatorPoint =
  | { state: 'ready'; value: number; sourceBarId: string; method: string; window: number; basis: string; unit: 'USD' | 'index' }
  | { state: 'warmup'; value: null; reason: 'insufficient_history'; requiredBars: number; observedBars: number };
export interface SampleResearchCase {
  symbol: string; scenarioId: 'portfolio-2026-10-07-v1'; snapshotAsOf: '2026-10-07T18:30:00Z';
  title: string; thesis: string; evidence: ({ state: 'present'; text: string; sourceIds: string[] } | { state: 'checked_none'; text: string } | { state: 'uncurated'; text: null })[];
  catalysts: ({ state: 'present'; text: string; sourceIds: string[] } | { state: 'checked_none'; text: string } | { state: 'uncurated'; text: null })[];
  risks: string[]; invalidation: string; assumptions: string[];
}
