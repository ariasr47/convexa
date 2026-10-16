import { loadScenario } from './catalog';
import { computeIndicators } from './indicators';
import { dataMode, scenarioProvenance, type SupportedDemoSymbol } from './mode';
import type { SampleResearchCase } from './types';

export type { IndicatorName, IndicatorPoint, SampleBar, SampleResearchCase } from './types';
export interface SampleBarsView {
  symbol: SupportedDemoSymbol;
  interval: '1d';
  priceUnit: 'USD';
  bars: import('./types').SampleBar[];
  indicators: ReturnType<typeof computeIndicators>;
}
export type LocalOutcome<T> =
  | { state: 'ready'; value: T; provenance: NonNullable<ReturnType<typeof scenarioProvenance>> }
  | { state: 'unsupported'; reason: 'unsupported_symbol' | 'unsupported_filter'; detail: string }
  | {
      state: 'unavailable';
      reason: 'live_provider_missing' | 'uncurated' | 'capability_absent';
      detail: string;
    }
  | { state: 'error'; reason: 'load_failed' | 'invalid_sample'; detail: string };

export async function loadSampleBars(symbol: string): Promise<LocalOutcome<SampleBarsView>> {
  if (dataMode === 'live')
    return {
      state: 'unavailable',
      reason: 'live_provider_missing',
      detail: 'Daily sample bars are not available from the live provider.',
    };
  try {
    const scenario = await loadScenario(symbol);
    if (!scenario)
      return {
        state: 'unsupported',
        reason: 'unsupported_symbol',
        detail: `No sample bars are authored for ${symbol.toUpperCase()}.`,
      };
    const bars = scenario.bars;
    if (
      bars.length !== 60 ||
      bars.at(-1)?.date !== '2026-10-07' ||
      bars.some((bar, i) => i > 0 && bars[i - 1].date >= bar.date)
    )
      return {
        state: 'error',
        reason: 'invalid_sample',
        detail: 'The authored bar series failed its scenario checks.',
      };
    return {
      state: 'ready',
      value: {
        symbol: scenario.symbol,
        interval: '1d',
        priceUnit: 'USD',
        bars,
        indicators: computeIndicators(bars),
      },
      provenance: scenarioProvenance()!,
    };
  } catch {
    return { state: 'error', reason: 'load_failed', detail: 'Sample bars could not be loaded.' };
  }
}

/** The scenario's quote for the masthead: the authored last close and the prior session's close. */
export interface SampleQuote {
  symbol: SupportedDemoSymbol;
  /** The scenario snapshot's close (the desk's `market_state.price`). */
  last: number;
  /** The prior session's close, the reference for the day's change. */
  priorClose: number;
  /** The prior session's date, YYYY-MM-DD. */
  priorDate: string;
}

/** The demo's quote for one symbol (site check D-22). A live build has no prior close to offer:
 *  `market_state` carries none, so the masthead shows no change there rather than a made-up one. */
export async function loadSampleQuote(symbol: string): Promise<LocalOutcome<SampleQuote>> {
  if (dataMode === 'live')
    return {
      state: 'unavailable',
      reason: 'live_provider_missing',
      detail: 'A prior close is not part of the live ticker bundle.',
    };
  try {
    const scenario = await loadScenario(symbol);
    if (!scenario)
      return {
        state: 'unsupported',
        reason: 'unsupported_symbol',
        detail: `No sample quote is authored for ${symbol.toUpperCase()}.`,
      };
    const prior = scenario.bars.at(-2);
    const last = scenario.bars.at(-1);
    if (!prior || !last || prior.close !== scenario.priorClose)
      return {
        state: 'error',
        reason: 'invalid_sample',
        detail: 'The authored prior close does not match its bar.',
      };
    return {
      state: 'ready',
      value: {
        symbol: scenario.symbol,
        last: last.close,
        priorClose: scenario.priorClose,
        priorDate: prior.date,
      },
      provenance: scenarioProvenance()!,
    };
  } catch {
    return {
      state: 'error',
      reason: 'load_failed',
      detail: 'The sample quote could not be loaded.',
    };
  }
}

/**
 * The day's change from a prior close, for the masthead. `null` when either side is missing or the
 * prior close is not a positive number: the masthead then shows no change at all, never a zero.
 * `direction` is the sign as a word so the caller carries it in text (▲/▼ and +/−), not hue alone
 * (canon P-11).
 */
export function dayChange(
  price: number | null | undefined,
  priorClose: number | null | undefined,
): { change: number; pct: number; direction: 'up' | 'down' | 'flat' } | null {
  if (price == null || priorClose == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(priorClose) || priorClose <= 0) return null;
  const change = Number((price - priorClose).toFixed(2));
  const pct = Number(((100 * (price - priorClose)) / priorClose).toFixed(2));
  return { change, pct, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
}

export type { SampleForecast, SampleLedger, SampleSignalGrade } from './research-ledger';

/** The demo's forecast ledger and sample signal grades (research-ledger.ts), loaded on demand so the
 *  live build never fetches it. */
export async function loadSampleLedger(): Promise<
  LocalOutcome<import('./research-ledger').SampleLedger>
> {
  if (dataMode === 'live')
    return {
      state: 'unavailable',
      reason: 'live_provider_missing',
      detail: 'The sample forecast ledger is not a live provider capability.',
    };
  try {
    const { sampleLedger } = await import('./research-ledger');
    return { state: 'ready', value: sampleLedger(), provenance: scenarioProvenance()! };
  } catch {
    return {
      state: 'error',
      reason: 'load_failed',
      detail: 'The sample ledger could not be loaded.',
    };
  }
}

export async function loadSampleResearch(
  symbol: string,
): Promise<LocalOutcome<SampleResearchCase>> {
  if (dataMode === 'live')
    return {
      state: 'unavailable',
      reason: 'live_provider_missing',
      detail: 'Sample research is not a live provider capability.',
    };
  try {
    const scenario = await loadScenario(symbol);
    if (!scenario)
      return {
        state: 'unsupported',
        reason: 'unsupported_symbol',
        detail: `No sample research is authored for ${symbol.toUpperCase()}.`,
      };
    const ids = new Set(scenario.bars.map((bar) => bar.id));
    const facts = [...scenario.research.evidence, ...scenario.research.catalysts];
    const evidenceIds = scenario.research.evidence.flatMap((fact) =>
      fact.state === 'present' ? fact.sourceIds : [],
    );
    if (
      scenario.research.symbol !== scenario.symbol ||
      scenario.research.scenarioId !== 'portfolio-2026-10-07-v1' ||
      scenario.research.snapshotAsOf !== '2026-10-07T18:30:00Z' ||
      scenario.research.evidence.filter((fact) => fact.state === 'present').length < 2 ||
      evidenceIds.length < 2 ||
      !facts.every((fact) => fact.state !== 'present' || fact.sourceIds.every((id) => ids.has(id)))
    )
      return {
        state: 'error',
        reason: 'invalid_sample',
        detail: 'A research source does not resolve to this scenario.',
      };
    return { state: 'ready', value: scenario.research, provenance: scenarioProvenance()! };
  } catch {
    return {
      state: 'error',
      reason: 'load_failed',
      detail: 'Sample research could not be loaded.',
    };
  }
}
