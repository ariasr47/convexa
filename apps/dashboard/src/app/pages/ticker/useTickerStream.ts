/**
 * useTickerStream — SSE live tape for one ticker + expiration filter.
 *
 * Stream-drop watchdog flips `streamOffline` when no payload arrives within
 * STREAM_OFFLINE_MS. Static structure (REST bundle) is never touched here.
 */
import { streamTicker, type LiveUpdate } from '@convexa/api';
import { useEffect, useState } from 'react';

export const STREAM_OFFLINE_MS = 15_000;

export interface TickerStreamApi {
  live: LiveUpdate | null;
  streamOffline: boolean;
  /** Live mid usable for marks (payload says live AND transport is up). */
  isLive: boolean;
}

export function useTickerStream(
  ticker: string,
  /** null = all; [] = none (stream not opened); string[] = filter. */
  selected: string[] | null,
): TickerStreamApi {
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [streamOffline, setStreamOffline] = useState(false);

  useEffect(() => {
    setLive(null);
    setStreamOffline(false);
    if (selected !== null && selected.length === 0) return;

    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = streamTicker(ticker, { expirations: selected ?? undefined }, (u) => {
      setLive(u);
      setStreamOffline(false);
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => setStreamOffline(true), STREAM_OFFLINE_MS);
    });
    return () => {
      if (gapTimer) clearTimeout(gapTimer);
      unsub();
    };
  }, [ticker, selected]);

  const isLive = (live?.live ?? false) && !streamOffline;
  return { live, streamOffline, isLive };
}
