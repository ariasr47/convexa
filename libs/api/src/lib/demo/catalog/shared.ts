import type { SampleBar, SampleResearchCase } from '../types';
import type { SupportedDemoSymbol } from '../mode';

export const SCENARIO_ID = 'portfolio-2026-10-07-v1' as const;
export const AS_OF = '2026-10-07T18:30:00Z' as const;
export const EXPIRIES = ['2026-10-09', '2026-10-16', '2026-11-20'] as const;
export const DTE: Record<(typeof EXPIRIES)[number], number> = { '2026-10-09': 2, '2026-10-16': 9, '2026-11-20': 44 };
export interface ScenarioSymbol {
  symbol: SupportedDemoSymbol; base: number; step: number; phase: number;
  bars: SampleBar[]; research: SampleResearchCase;
  variants: Record<string, { wall: number; flip: number; distance: number; setup: string; score: number; fingerprint: string }>;
}

export function assertCuratedVariants(symbol: string, variants: ScenarioSymbol['variants']): void {
  const keys = Object.keys(variants);
  const fullKey = EXPIRIES.join(',');
  const novemberKey = EXPIRIES[2];
  const full = variants[fullKey];
  const november = variants[novemberKey];
  if (keys.length !== 7 || !full || !november || new Set(Object.values(variants).map((variant) => variant.fingerprint)).size !== 7) {
    throw new Error(`${symbol} catalog must contain seven unique curated expiry patches.`);
  }
  if (['wall', 'flip', 'distance', 'setup', 'score', 'fingerprint'].some((field) => full[field as keyof typeof full] === november[field as keyof typeof november])) {
    throw new Error(`${symbol} November projection retained a full-chain dependent field.`);
  }
}

export function sampleContractMark(spot: number, strike: number, right: 'call' | 'put', dte: number): number {
  const intrinsic = right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  return Number((Math.max(0.2, intrinsic + Math.sqrt(dte) * 0.55 + (right === 'call' ? 0.2 : 0.1))).toFixed(2));
}

export function makeScenario(symbol: SupportedDemoSymbol, base: number, step: number, phase: number): ScenarioSymbol {
  const dates: string[] = [];
  const date = new Date('2026-10-07T12:00:00Z');
  while (dates.length < 60) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) dates.unshift(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() - 1);
  }
  const bars = dates.map((dateLabel, i) => {
    const close = Number((base + i * step + Math.sin((i + phase) / 4) * base * 0.004).toFixed(2));
    const spread = Number((base * 0.009 + (i % 4) * base * 0.0004).toFixed(2));
    return { id: `${SCENARIO_ID}:${symbol}:${dateLabel}`, date: dateLabel, open: Number((close - spread * 0.28).toFixed(2)), high: Number((close + spread).toFixed(2)), low: Number((close - spread).toFixed(2)), close, volume: 35_000_000 + ((i * 7919 + phase * 1009) % 22_000_000) };
  });
  const variants: ScenarioSymbol['variants'] = {};
  for (let mask = 1; mask < 8; mask++) {
    const key = EXPIRIES.filter((_, i) => mask & (1 << i)).join(',');
    const shift = (mask - 7) * base * 0.003;
    const spot = bars.at(-1)!.close;
    const wall = Number((spot + shift + base * 0.02).toFixed(2));
    const flip = Number((spot + shift - base * 0.01).toFixed(2));
    variants[key] = { wall, flip, distance: Number(((flip - spot) / spot).toFixed(4)), setup: mask === 4 ? 'November calendar context' : 'Balanced structure', score: 42 + mask * 4, fingerprint: `${symbol.toLowerCase()}-synthetic-variant-${mask}-v1` };
  }
  assertCuratedVariants(symbol, variants);
  const bar = bars.at(-1)!;
  return {
    symbol, base, step, phase, bars, variants,
    research: {
      symbol, scenarioId: SCENARIO_ID, snapshotAsOf: AS_OF,
      title: `${symbol} sample structure review`,
      thesis: `Synthetic scenario context for ${symbol}; this is an authored educational example, not a market observation or forecast.`,
      evidence: [{ state: 'present', text: 'The closing sample bar is the price context for this scenario.', sourceIds: [bar.id] }],
      catalysts: [{ state: 'uncurated', text: null }],
      risks: ['Synthetic bars do not represent executable prices.', 'The sample has no external news or earnings feed.'],
      invalidation: 'Revisit the thesis if the scenario structure changes; no price target is implied.',
      assumptions: ['Daily OHLCV values are synthetic and authored for this scenario.', 'No live provider, broker, or AI response is used.'],
    },
  };
}
