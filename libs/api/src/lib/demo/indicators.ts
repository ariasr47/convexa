import type { IndicatorName, IndicatorPoint, SampleBar } from './types';

export type IndicatorSeries = Record<IndicatorName, IndicatorPoint[]>;
const warmup = (observedBars: number, requiredBars: number): IndicatorPoint => ({
  state: 'warmup',
  value: null,
  reason: 'insufficient_history',
  requiredBars,
  observedBars,
});
const ready = (
  value: number,
  sourceBarId: string,
  method: string,
  window: number,
  basis: string,
  unit: 'USD' | 'index',
): IndicatorPoint => ({ state: 'ready', value, sourceBarId, method, window, basis, unit });

export function computeIndicators(bars: readonly SampleBar[]): IndicatorSeries {
  const ema = (window: number): IndicatorPoint[] => {
    const result: IndicatorPoint[] = [];
    const alpha = 2 / (window + 1);
    let value = 0;
    for (let i = 0; i < bars.length; i++) {
      if (i < window - 1) result.push(warmup(i + 1, window));
      else {
        if (i === window - 1)
          value = bars.slice(0, window).reduce((sum, bar) => sum + bar.close, 0) / window;
        else value = alpha * bars[i].close + (1 - alpha) * value;
        result.push(ready(value, bars[i].id, 'EMA with SMA seed', window, 'daily close', 'USD'));
      }
    }
    return result;
  };
  const trs = bars.map((bar, i) =>
    i === 0
      ? bar.high - bar.low
      : Math.max(
          bar.high - bar.low,
          Math.abs(bar.high - bars[i - 1].close),
          Math.abs(bar.low - bars[i - 1].close),
        ),
  );
  const atr14: IndicatorPoint[] = [];
  for (let i = 0; i < bars.length; i++)
    atr14.push(
      i < 13
        ? warmup(i + 1, 14)
        : ready(
            trs.slice(i - 13, i + 1).reduce((a, b) => a + b, 0) / 14,
            bars[i].id,
            'simple mean true range',
            14,
            'daily OHLC',
            'USD',
          ),
    );

  const rsi14: IndicatorPoint[] = [];
  let avgGain = 0,
    avgLoss = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i < 14) {
      rsi14.push(warmup(i + 1, 15));
      continue;
    }
    if (i === 14) {
      for (let j = 1; j <= 14; j++) {
        const d = bars[j].close - bars[j - 1].close;
        avgGain += Math.max(d, 0) / 14;
        avgLoss += Math.max(-d, 0) / 14;
      }
    } else {
      const d = bars[i].close - bars[i - 1].close;
      avgGain = (avgGain * 13 + Math.max(d, 0)) / 14;
      avgLoss = (avgLoss * 13 + Math.max(-d, 0)) / 14;
    }
    const value =
      avgGain === 0 && avgLoss === 0
        ? 50
        : avgLoss === 0
          ? 100
          : 100 - 100 / (1 + avgGain / avgLoss);
    rsi14.push(ready(value, bars[i].id, 'Wilder RSI', 14, 'daily close', 'index'));
  }

  const adx14: IndicatorPoint[] = [];
  const plusDm = bars.map((bar, i) =>
    i === 0
      ? 0
      : Math.max(bar.high - bars[i - 1].high, 0) > Math.max(bars[i - 1].low - bar.low, 0)
        ? Math.max(bar.high - bars[i - 1].high, 0)
        : 0,
  );
  const minusDm = bars.map((bar, i) =>
    i === 0
      ? 0
      : Math.max(bars[i - 1].low - bar.low, 0) > Math.max(bar.high - bars[i - 1].high, 0)
        ? Math.max(bars[i - 1].low - bar.low, 0)
        : 0,
  );
  let smTr = 0,
    smPlus = 0,
    smMinus = 0,
    adx = 0;
  const dx: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < 13) {
      adx14.push(warmup(i + 1, 28));
      continue;
    }
    if (i === 13) {
      smTr = trs.slice(0, 14).reduce((a, b) => a + b, 0);
      smPlus = plusDm.slice(0, 14).reduce((a, b) => a + b, 0);
      smMinus = minusDm.slice(0, 14).reduce((a, b) => a + b, 0);
    } else {
      smTr = smTr - smTr / 14 + trs[i];
      smPlus = smPlus - smPlus / 14 + plusDm[i];
      smMinus = smMinus - smMinus / 14 + minusDm[i];
    }
    const pdi = smTr === 0 ? 0 : (100 * smPlus) / smTr;
    const mdi = smTr === 0 ? 0 : (100 * smMinus) / smTr;
    dx[i] = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
    if (i < 27) {
      adx14.push(warmup(i + 1, 28));
      continue;
    }
    if (i === 27) adx = dx.slice(14, 28).reduce((a, b) => a + b, 0) / 14;
    else adx = (adx * 13 + dx[i]) / 14;
    adx14.push(
      ready(adx, bars[i].id, 'Wilder ADX', 14, 'daily OHLC directional movement', 'index'),
    );
  }
  return { ema20: ema(20), ema50: ema(50), rsi14, adx14, atr14 };
}
