import { streamTicker, type LiveUpdate, type TickerQuery } from '../convexa';
import { effectiveExpiries, loadScenario } from './catalog';
import { dataMode, type SupportedDemoSymbol } from './mode';
import {
  subscribeDemoClock,
  subscribeDemoOrderFrames,
  type DemoClock,
  type DemoOrderFrame,
  type Unsubscribe,
} from './workspace';

export type ScannerPrice = { price: number; ts: number };
const noopUnsubscribe: Unsubscribe = () => undefined;
export type MarketStreamEvent =
  | { kind: 'ticker_update'; update: LiveUpdate }
  | { kind: 'scanner_prices'; prices: Record<string, ScannerPrice> }
  | { kind: 'heartbeat'; receivedAtMs: number }
  | {
      kind: 'connection';
      state: 'connected' | 'offline';
      reason: 'open' | 'message' | 'error' | 'silence_45s';
    }
  | { kind: 'playback'; state: DemoClock['playback']; scenarioTimeMs: number }
  | { kind: 'demo_order_frame'; frame: DemoOrderFrame };

export function subscribeTicker(
  symbol: string,
  query: TickerQuery,
  onEvent: (event: MarketStreamEvent) => void,
): Unsubscribe {
  if (dataMode === 'live')
    return streamTicker(symbol, query, (update) => onEvent({ kind: 'ticker_update', update }));
  const normalized = symbol.toUpperCase() as SupportedDemoSymbol;
  const projection = effectiveExpiries(query);
  const selectedKey = projection.state === 'ready' ? projection.key : null;
  let alive = true;
  let selectedFlip: number | null = null;
  let baseBuyVolume = 1_250;
  let baseSellVolume = 875;
  const latestClock = subscribeDemoClock((clock) => {
    onEvent({ kind: 'playback', state: clock.playback, scenarioTimeMs: clock.nowMs });
  });
  void loadScenario(normalized).then((scenario) => {
    if (!alive || !scenario || !selectedKey) return;
    const variant = scenario.variants[selectedKey];
    if (!variant) return;
    selectedFlip = variant.flip;
    const mid = scenario.bars.at(-1)!.close;
    baseBuyVolume = 1_250 + scenario.phase * 17;
    baseSellVolume = 875 + scenario.phase * 9;
    const buyVol = baseBuyVolume;
    const sellVol = baseSellVolume;
    const bid = Number((mid - 0.02).toFixed(2));
    const ask = Number((mid + 0.02).toFixed(2));
    const update: LiveUpdate = {
      ticker: normalized,
      live: false,
      market_session: 'sample',
      ts: Date.parse('2026-10-07T18:30:00Z'),
      spot_ts: Date.parse('2026-10-07T18:30:00Z'),
      mid,
      last_trade: mid,
      bid,
      ask,
      spread: ask - bid,
      buy_vol: buyVol,
      sell_vol: sellVol,
      net_flow: buyVol - sellVol,
      gamma_flip: selectedFlip,
      flow_window_s: 60,
      feed: 'synthetic_scenario',
      session_tape: null,
    };
    onEvent({ kind: 'ticker_update', update });
  });
  const stopFrames = subscribeDemoOrderFrames((frame) => {
    if (!alive || frame.symbol !== normalized || selectedFlip == null) return;
    const elapsedMinutes = Math.floor(
      (frame.scenarioTimeMs - Date.parse('2026-10-07T18:30:00Z')) / 60_000,
    );
    const buyVol = baseBuyVolume + elapsedMinutes * 25;
    const sellVol = baseSellVolume + elapsedMinutes * 10;
    const bid = Number((frame.underlyingMid - 0.02).toFixed(2));
    const ask = Number((frame.underlyingMid + 0.02).toFixed(2));
    const update: LiveUpdate = {
      ticker: normalized,
      live: false,
      market_session: 'sample',
      ts: frame.scenarioTimeMs,
      spot_ts: frame.scenarioTimeMs,
      mid: frame.underlyingMid,
      last_trade: frame.underlyingMid,
      bid,
      ask,
      spread: Number((ask - bid).toFixed(2)),
      buy_vol: buyVol,
      sell_vol: sellVol,
      net_flow: buyVol - sellVol,
      gamma_flip: selectedFlip,
      flow_window_s: 60,
      feed: 'synthetic_scenario',
      session_tape: null,
    };
    onEvent({ kind: 'ticker_update', update });
    onEvent({ kind: 'demo_order_frame', frame });
  });
  return () => {
    alive = false;
    latestClock();
    stopFrames();
  };
}

export function subscribeScannerPrices(
  symbols: string[],
  onEvent: (event: MarketStreamEvent) => void,
): Unsubscribe {
  if (dataMode === 'live') {
    const normalized = [
      ...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
    ].sort();
    if (normalized.length === 0) return noopUnsubscribe;
    let source: EventSource;
    try {
      source = new EventSource(
        `/api/stream/prices?symbols=${encodeURIComponent(normalized.join(','))}`,
      );
    } catch {
      onEvent({ kind: 'connection', state: 'offline', reason: 'error' });
      return noopUnsubscribe;
    }
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let lastMessage = Date.now();
    const reset = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(
        () => onEvent({ kind: 'connection', state: 'offline', reason: 'silence_45s' }),
        45_000,
      );
    };
    source.onopen = () => onEvent({ kind: 'connection', state: 'connected', reason: 'open' });
    source.onmessage = (message) => {
      lastMessage = Date.now();
      reset();
      try {
        const raw = JSON.parse(message.data) as { prices?: Record<string, ScannerPrice> };
        const prices: Record<string, ScannerPrice> = {};
        for (const [symbol, price] of Object.entries(raw.prices ?? {})) {
          const key = symbol.toUpperCase();
          if (
            normalized.includes(key) &&
            price &&
            Number.isFinite(price.price) &&
            Number.isFinite(price.ts)
          )
            prices[key] = { price: price.price, ts: price.ts };
        }
        if (Object.keys(prices).length) onEvent({ kind: 'scanner_prices', prices });
        onEvent({ kind: 'heartbeat', receivedAtMs: lastMessage });
        onEvent({ kind: 'connection', state: 'connected', reason: 'message' });
      } catch {
        /* malformed events do not refresh price state */
      }
    };
    source.onerror = () => onEvent({ kind: 'connection', state: 'offline', reason: 'error' });
    reset();
    return () => {
      if (watchdog) clearTimeout(watchdog);
      source.close();
    };
  }
  let alive = true;
  const unsub = subscribeDemoOrderFrames(async (frame) => {
    if (!alive || !symbols.includes(frame.symbol)) return;
    onEvent({
      kind: 'scanner_prices',
      prices: { [frame.symbol]: { price: frame.underlyingMid, ts: frame.scenarioTimeMs } },
    });
  });
  const stopClock = subscribeDemoClock((clock) =>
    onEvent({ kind: 'playback', state: clock.playback, scenarioTimeMs: clock.nowMs }),
  );
  return () => {
    alive = false;
    unsub();
    stopClock();
  };
}
