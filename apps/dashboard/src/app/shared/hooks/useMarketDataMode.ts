import { getMarketDataMode, type MarketDataMode } from '@convexa/api';
import { useEffect, useState } from 'react';

// One health read per page load: the server's mode is fixed at its boot, so every consumer shares it.
let pending: Promise<MarketDataMode> | null = null;

/** The server's market-data mode (`live` / `paused` / `unknown`), or null until the first read lands. */
export function useMarketDataMode(): MarketDataMode | null {
  const [mode, setMode] = useState<MarketDataMode | null>(null);
  useEffect(() => {
    let alive = true;
    pending ??= getMarketDataMode();
    void pending.then((value) => {
      if (alive) setMode(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}
