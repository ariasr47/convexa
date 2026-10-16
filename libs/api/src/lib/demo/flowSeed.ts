/**
 * Per-symbol flow figures for the demo's ticker bundle (site check D-22).
 *
 * The demo used one set of constants for every symbol, so Net DEX ($11.0M), the chain's Vol/OI
 * (0.43×), the IV skew (+2.0 pts) and the off-exchange share (28%) read the same on SPY and NVDA.
 * Each figure is now derived, deterministically, from the symbol's own authored data: its 60 sample
 * bars (catalog/shared.ts makeScenario) and the at-the-money IV the transport authors for it. These
 * are sample values shaped like the real figures, never observations; nothing here is fetched.
 *
 * - Net DEX uses the API's own formula (libs/quant-engine/src/gex.rs: delta × open interest × 100 ×
 *   spot, summed over the chain), with a Black-Scholes call delta on the symbol's authored IV.
 * - Vol/OI scales the chain's volume by how far the last 20 sessions moved, in implied standard
 *   deviations: a bigger move than the options priced draws more volume against open interest.
 * - The IV skew (25Δ put over call, in IV points) steepens after a fall and flattens after a rise.
 * - The off-exchange share sits between 32% and 48% of the window's shares, set by where the last
 *   close sits in its 10-session range: a sample value that differs by symbol, not a model of where
 *   shares print.
 */
import type { SampleBar } from './types';

/** Sessions in a trading year, for annualising. */
const YEAR_SESSIONS = 252;
/** The window the drift uses: about a month of sessions. */
const WINDOW = 20;
/** The window the range position uses: two weeks of sessions. */
const RANGE_WINDOW = 10;

export interface FlowSeedInput {
  bars: ReadonlyArray<Pick<SampleBar, 'close'>>;
  /** The authored at-the-money IV, in percent (the transport's `atm_iv`). */
  atmIvPct: number;
}

export interface FlowSeed {
  /** Close-to-close return over the last 20 sessions. */
  drift: number;
  /** That return in implied standard deviations over the same window (signed). */
  driftZ: number;
  /** Where the last close sits in its 10-session close range, 0 (low) to 1 (high). */
  rangePosition: number;
  /** Multiplier on the chain's same-day volume (1 = the authored base). */
  volumeMultiplier: number;
  /** 25Δ put IV minus call IV, in IV points. Positive: downside is bid. */
  skewPts: number;
  /** Off-exchange shares as a share of the window's shares, 0–1. */
  offExchangeShare: number;
}

const round = (value: number, places: number) => Number(value.toFixed(places));
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * The flow figures for one symbol. Throws on fewer than 21 bars or a non-positive IV: the catalog
 * always authors 60 bars, so either is a broken seed, not a state to render.
 */
export function flowSeed({ bars, atmIvPct }: FlowSeedInput): FlowSeed {
  if (bars.length < WINDOW + 1) throw new Error(`flowSeed needs ${WINDOW + 1} bars or more.`);
  if (!(atmIvPct > 0)) throw new Error('flowSeed needs a positive at-the-money IV.');
  const last = bars[bars.length - 1];
  const start = bars[bars.length - 1 - WINDOW];
  const drift = last.close / start.close - 1;
  const sigmaWindow = (atmIvPct / 100) * Math.sqrt(WINDOW / YEAR_SESSIONS);
  const driftZ = drift / sigmaWindow;
  const closes = bars.slice(-RANGE_WINDOW).map((bar) => bar.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const rangePosition = hi > lo ? (last.close - lo) / (hi - lo) : 0.5;
  return {
    drift: round(drift, 6),
    driftZ: round(driftZ, 4),
    rangePosition: round(rangePosition, 4),
    volumeMultiplier: round(1 + Math.min(Math.abs(driftZ), 1), 4),
    skewPts: round(clamp(0.08 * atmIvPct * (1 - 0.5 * driftZ), 0.4, 4), 2),
    offExchangeShare: round(0.32 + 0.16 * (1 - rangePosition), 4),
  };
}

/** Standard normal CDF (Abramowitz and Stegun 26.2.17, error under 7.5e-8). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const density = Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - tail : tail;
}

/** Black-Scholes call delta, N(d1), with no rates or dividends. The put delta is this minus one. */
export function callDelta(spot: number, strike: number, ivPct: number, dte: number): number {
  const sigma = ivPct / 100;
  const t = Math.max(dte, 1) / 365;
  const d1 = (Math.log(spot / strike) + 0.5 * sigma * sigma * t) / (sigma * Math.sqrt(t));
  return normalCdf(d1);
}
