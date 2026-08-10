/**
 * useTickerStream — SSE live tape for one ticker + expiration filter.
 *
 * §3.8 Phase C: payloads publish to `liveTapeStore` (external). Components that need ticks
 * call `useLiveTape()`. Structure widgets should NOT call that hook — they stay on REST props
 * + React.memo so ticks do not repaint walls/history/context.
 *
 * Stream-drop watchdog flips `streamOffline` when no payload arrives within STREAM_OFFLINE_MS.
 * Static structure (REST bundle) is never written here.
 */
import { streamTicker } from '@convexa/api';
import { useEffect } from 'react';
import { publishLiveTape, resetLiveTape, useLiveTape, type LiveTapeApi } from './liveTapeStore';

export const STREAM_OFFLINE_MS = 15_000;

export type TickerStreamApi = LiveTapeApi;

/**
 * Open/close the page-scoped SSE and publish into the live tape store.
 * Does not re-render the caller on every tick (no React state for payloads).
 */
export function useTickerStreamConnection(
  ticker: string,
  /** null = all; [] = none (stream not opened); string[] = filter. */
  selected: string[] | null,
): void {
  useEffect(() => {
    const sym = ticker.toUpperCase();
    publishLiveTape({ live: null, streamOffline: false, ticker: sym });
    if (selected !== null && selected.length === 0) {
      return () => {
        resetLiveTape();
      };
    }

    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = streamTicker(sym, { expirations: selected ?? undefined }, (u) => {
      publishLiveTape({ live: u, streamOffline: false, ticker: sym });
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => {
        publishLiveTape({ streamOffline: true, ticker: sym });
      }, STREAM_OFFLINE_MS);
    });
    return () => {
      if (gapTimer) clearTimeout(gapTimer);
      unsub();
      resetLiveTape();
    };
  }, [ticker, selected]);
}

/**
 * Connection + subscription — for hosts that must re-render on ticks (portfolio, page glue).
 * Prefer `useTickerStreamConnection` + selective `useLiveTape()` for isolation.
 */
export function useTickerStream(ticker: string, selected: string[] | null): TickerStreamApi {
  useTickerStreamConnection(ticker, selected);
  return useLiveTape();
}
