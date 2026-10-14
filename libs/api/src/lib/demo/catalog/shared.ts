import { computeIndicators } from '../indicators';
import type { SupportedDemoSymbol } from '../mode';
import type { SampleBar, SampleResearchCase } from '../types';

export const SCENARIO_ID = 'portfolio-2026-10-07-v1' as const;
export const AS_OF = '2026-10-07T18:30:00Z' as const;
export const EXPIRIES = ['2026-10-09', '2026-10-16', '2026-11-20'] as const;
export const DTE: Record<(typeof EXPIRIES)[number], number> = {
  '2026-10-09': 2,
  '2026-10-16': 9,
  '2026-11-20': 44,
};
export interface ScenarioSymbol {
  symbol: SupportedDemoSymbol;
  base: number;
  step: number;
  phase: number;
  bars: SampleBar[];
  research: SampleResearchCase;
  variants: Record<
    string,
    {
      wall: number;
      flip: number;
      distance: number;
      setup: string;
      score: number;
      fingerprint: string;
    }
  >;
}

const researchNarratives: Record<
  SupportedDemoSymbol,
  {
    title: string;
    thesis: string;
    evidence: [string, string];
    risks: [string, string];
    invalidation: string;
  }
> = {
  SPY: {
    title: 'SPY breadth and balance case',
    thesis:
      'The synthetic SPY path rises gradually while alternating closes keep the example focused on broad-market balance.',
    evidence: [
      'The latest authored close anchors this broad-index example.',
      'The prior close shows the small step used in the synthetic breadth path.',
    ],
    risks: [
      'Index breadth is not represented by constituent data.',
      'The authored path is not an observed market session.',
    ],
    invalidation:
      'Revisit the balance thesis if the authored close path stops alternating around its gradual rise.',
  },
  QQQ: {
    title: 'QQQ growth-duration case',
    thesis:
      'The QQQ example gives growth-duration exposure a distinct rising path with a wider daily range than its neighboring close changes.',
    evidence: [
      'The final close is the scenario anchor for the growth-duration example.',
      'The latest high-low range supplies its authored daily-range context.',
    ],
    risks: [
      'A synthetic index path cannot represent constituent concentration.',
      'No current rates or earnings information is included.',
    ],
    invalidation:
      'Revisit the duration thesis if the authored path loses its higher-close sequence.',
  },
  AAPL: {
    title: 'AAPL single-name range case',
    thesis:
      'The AAPL case uses a compact single-name path to discuss how a close can sit inside a wider authored daily range.',
    evidence: [
      'The latest high and low define the displayed sample range.',
      'The previous close gives the reference for the latest synthetic bar.',
    ],
    risks: [
      'The bar does not model company-specific events.',
      'Sample option marks are not executable quotes.',
    ],
    invalidation:
      'Revisit the range thesis when a later authored bar closes outside the current range.',
  },
  MSFT: {
    title: 'MSFT steady-trend case',
    thesis:
      'The MSFT scenario emphasizes a steadier sequence of daily closes for a trend-versus-pause discussion.',
    evidence: [
      'The latest close anchors the steady-trend example.',
      'The 20-session EMA is sourced from the same synthetic closing series.',
    ],
    risks: [
      'The moving average is descriptive of authored bars only.',
      'The series contains no live company disclosures.',
    ],
    invalidation:
      'Revisit the steady-trend thesis if the authored close falls below its 20-session average.',
  },
  NVDA: {
    title: 'NVDA higher-variation case',
    thesis:
      'The NVDA example pairs a rising close path with visibly larger authored bars to frame a higher-variation scenario.',
    evidence: [
      'The final close is the price anchor for this higher-variation case.',
      'The latest bar high-low span supplies its authored range evidence.',
    ],
    risks: [
      'The synthetic range does not estimate real volatility.',
      'The example has no semiconductor supply-chain inputs.',
    ],
    invalidation:
      'Revisit the variation thesis if subsequent authored ranges contract across the same window.',
  },
  TSLA: {
    title: 'TSLA reversal and range case',
    thesis:
      'The TSLA case uses a more oscillating authored path to discuss range and reversal risk without implying direction.',
    evidence: [
      'The current sample close marks the endpoint of the oscillating path.',
      'The prior close provides the comparison for the latest move.',
    ],
    risks: [
      'Oscillation is authored and does not forecast reversal.',
      'No external company or delivery data is included.',
    ],
    invalidation:
      'Revisit the range thesis if later authored closes establish a sustained path beyond the current range.',
  },
};

export function assertCuratedVariants(symbol: string, variants: ScenarioSymbol['variants']): void {
  const keys = Object.keys(variants);
  const fullKey = EXPIRIES.join(',');
  const novemberKey = EXPIRIES[2];
  const full = variants[fullKey];
  const november = variants[novemberKey];
  if (
    keys.length !== 7 ||
    !full ||
    !november ||
    new Set(Object.values(variants).map((variant) => variant.fingerprint)).size !== 7
  ) {
    throw new Error(`${symbol} catalog must contain seven unique curated expiry patches.`);
  }
  if (
    ['wall', 'flip', 'distance', 'setup', 'score', 'fingerprint'].some(
      (field) => full[field as keyof typeof full] === november[field as keyof typeof november],
    )
  ) {
    throw new Error(`${symbol} November projection retained a full-chain dependent field.`);
  }
}

export function sampleContractMark(
  spot: number,
  strike: number,
  right: 'call' | 'put',
  dte: number,
): number {
  const intrinsic = right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  return Number(
    Math.max(0.2, intrinsic + Math.sqrt(dte) * 0.55 + (right === 'call' ? 0.2 : 0.1)).toFixed(2),
  );
}

export interface SampleOptionQuote {
  bid: number;
  ask: number;
  mid: number;
}

export function sampleContractQuote(
  spot: number,
  strike: number,
  right: 'call' | 'put',
  dte: number,
): SampleOptionQuote {
  const mid = sampleContractMark(spot, strike, right, dte);
  return {
    bid: Number((mid - 0.05).toFixed(2)),
    ask: Number((mid + 0.05).toFixed(2)),
    mid,
  };
}

/** Each symbol's score sits apart from the others' (one shared formula gave all six a 70 on the full
 *  expiry set). Full-set scores: NVDA 81, SPY 74, QQQ 70, AAPL 63, MSFT 52, TSLA 47. */
const SCORE_OFFSET: Record<SupportedDemoSymbol, number> = {
  NVDA: 11,
  SPY: 4,
  QQQ: 0,
  AAPL: -7,
  MSFT: -18,
  TSLA: -23,
};

export function makeScenario(
  symbol: SupportedDemoSymbol,
  base: number,
  step: number,
  phase: number,
): ScenarioSymbol {
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
    return {
      id: `${SCENARIO_ID}:${symbol}:${dateLabel}`,
      date: dateLabel,
      open: Number((close - spread * 0.28).toFixed(2)),
      high: Number((close + spread).toFixed(2)),
      low: Number((close - spread).toFixed(2)),
      close,
      volume: 35_000_000 + ((i * 7919 + phase * 1009) % 22_000_000),
    };
  });
  const variants: ScenarioSymbol['variants'] = {};
  for (let mask = 1; mask < 8; mask++) {
    const key = EXPIRIES.filter((_, i) => mask & (1 << i)).join(',');
    const shift = (mask - 7) * base * 0.003;
    const spot = bars.at(-1)!.close;
    const wall = Number((spot + shift + base * 0.02).toFixed(2));
    const flip = Number((spot + shift - base * 0.01).toFixed(2));
    variants[key] = {
      wall,
      flip,
      distance: Number(((flip - spot) / spot).toFixed(4)),
      setup: mask === 4 ? 'November calendar context' : 'Balanced structure',
      score: 42 + mask * 4 + SCORE_OFFSET[symbol],
      fingerprint: `${symbol.toLowerCase()}-synthetic-variant-${mask}-v1`,
    };
  }
  assertCuratedVariants(symbol, variants);
  const bar = bars.at(-1)!;
  const priorBar = bars.at(-2)!;
  const narrative = researchNarratives[symbol];
  const secondEvidence =
    symbol === 'QQQ' || symbol === 'NVDA'
      ? {
          text: `${narrative.evidence[1]} High ${bar.high.toFixed(2)} USD; low ${bar.low.toFixed(2)} USD on ${bar.date}.`,
          sourceIds: [bar.id],
        }
      : symbol === 'MSFT'
        ? (() => {
            const ema20 = computeIndicators(bars).ema20.at(-1);
            if (ema20?.state !== 'ready') throw new Error('The 60-bar sample must produce EMA20.');
            return {
              text: `${narrative.evidence[1]} EMA20 ${ema20.value.toFixed(4)} USD through ${bar.date}.`,
              sourceIds: bars.map((sourceBar) => sourceBar.id),
            };
          })()
        : {
            text: `${narrative.evidence[1]} Close: ${priorBar.close.toFixed(2)} USD on ${priorBar.date}.`,
            sourceIds: [priorBar.id],
          };
  return {
    symbol,
    base,
    step,
    phase,
    bars,
    variants,
    research: {
      symbol,
      scenarioId: SCENARIO_ID,
      snapshotAsOf: AS_OF,
      title: narrative.title,
      thesis: narrative.thesis,
      evidence: [
        {
          state: 'present',
          text: `${narrative.evidence[0]} Close: ${bar.close.toFixed(2)} USD on ${bar.date}.`,
          sourceIds: [bar.id],
        },
        { state: 'present', ...secondEvidence },
      ],
      catalysts: [{ state: 'uncurated', text: null }],
      risks: [...narrative.risks],
      invalidation: narrative.invalidation,
      assumptions: [
        'Daily OHLCV values are synthetic and authored for this scenario.',
        'No live provider, broker, or AI response is used.',
      ],
    },
  };
}
