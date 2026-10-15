/**
 * What the demo's technical chart claims, worked out from its own series (canon P-10: a chart's title
 * states its finding only when it has data). A wrong count here is a false sentence over the chart,
 * so the arithmetic lives apart from the drawing and sampleTa.spec.ts pins it.
 */
import type { IndicatorPoint } from '@convexa/api';

/** Consecutive closes above the 20-day average, counted back from the last bar; 0 when the last
 *  close isn't above it, or the average is still warming up. */
export function sessionsAbove(closes: number[], ema20: IndicatorPoint[]): number {
  let k = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    const p = ema20[i];
    if (!p || p.state !== 'ready' || !(closes[i] > p.value)) break;
    k++;
  }
  return k;
}

const pct = (v: number) => {
  const s = Math.abs(v).toFixed(1);
  return v < 0 ? `−${s}%` : `+${s}%`;
};

/** The chart's title: where the last close sits against its averages, in the sample's own words. */
export function sampleTaFinding(
  symbol: string,
  closes: number[],
  ema20: IndicatorPoint[],
  ema50: IndicatorPoint[],
  lastDate: string,
): string {
  const n = closes.length;
  const last = closes[n - 1];
  const e50 = ema50[n - 1];
  const vs50 = e50?.state === 'ready' ? ((last - e50.value) / e50.value) * 100 : null;
  const above = sessionsAbove(closes, ema20);
  if (above > 0)
    return vs50 === null
      ? `In the sample, ${symbol} has closed above its 20-day average for ${above} ${above === 1 ? 'session' : 'sessions'}`
      : `In the sample, ${symbol} has closed above its 20-day average for ${above} ${above === 1 ? 'session' : 'sessions'} and sits ${Math.abs(vs50).toFixed(1)}% ${vs50 >= 0 ? 'above' : 'below'} the 50-day`;
  return vs50 === null
    ? `In the sample, ${symbol} closed at or below its 20-day average on ${lastDate}`
    : `In the sample, ${symbol} closed at or below its 20-day average on ${lastDate}, ${pct(vs50)} against the 50-day`;
}
