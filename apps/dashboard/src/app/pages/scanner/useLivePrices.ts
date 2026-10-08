/**
 * useLivePrices — prices for the scanner's visible rows through the shared typed stream provider.
 * Structure remains polled; changed prices overlay it and survive connection gaps and playback end.
 */
import {
  dataMode,
  subscribeScannerPrices,
  type DemoClock,
  type MarketStreamEvent,
  type ScannerPrice,
} from '@convexa/api';
import { useEffect, useState } from 'react';

export interface LivePrice extends ScannerPrice {}

export interface LivePricesState {
  /** Symbol → latest changed price and its untouched server/scenario timestamp. */
  prices: Record<string, LivePrice>;
  /** Connection state only; local playback pause/end never claims network loss. */
  offline: boolean;
  /** True when prices are authored scenario samples, so consumers never call them live. */
  isSample: boolean;
  /** Actual local controller state; null in live mode. */
  playback: DemoClock['playback'] | null;
}

export function useLivePrices(symbols: string[]): LivePricesState {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [offline, setOffline] = useState(false);
  const [playback, setPlayback] = useState<DemoClock['playback'] | null>(null);

  // Sorted + deduplicated so order-only renders do not rebuild the shared subscription.
  const key = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].toSorted().join(',');
  useEffect(() => {
    if (!key) {
      setOffline(false);
      setPlayback(null);
      return;
    }
    const requestedSymbols = key.split(',');
    setOffline(false);
    setPlayback(dataMode === 'demo' ? 'running' : null);
    const unsubscribe = subscribeScannerPrices(requestedSymbols, (event: MarketStreamEvent) => {
      if (event.kind === 'scanner_prices') {
        setOffline(false);
        setPrices((previous) => ({ ...previous, ...event.prices }));
      } else if (event.kind === 'heartbeat') {
        // The provider emits this only for an actual delivered SSE message, never a comment frame.
        setOffline(false);
      } else if (event.kind === 'connection') {
        setOffline(event.state === 'offline');
      } else if (event.kind === 'playback') {
        setPlayback(event.state);
      }
    });

    // The provider owns the live 45-second receipt watchdog and reconnect lifecycle.
    return () => {
      unsubscribe();
    };
  }, [key]);

  return { prices, offline, isSample: dataMode === 'demo', playback };
}
