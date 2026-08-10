/**
 * Live tape external store (§3.8 Phase C).
 *
 * SSE ticks publish here; only components that call `useLiveTape()` re-render.
 * Structure widgets stay on REST props + React.memo so a tick does not repaint walls/GEX/history.
 *
 * Lifecycle (open/close EventSource) is owned by `useTickerStreamConnection` — this module is
 * the snapshot + subscription seam only.
 */
import type { LiveUpdate } from '@convexa/api';
import { useSyncExternalStore } from 'react';

export interface LiveTapeSnapshot {
  live: LiveUpdate | null;
  streamOffline: boolean;
  /** Uppercase ticker the stream is bound to (for defensive consumers). */
  ticker: string;
}

const EMPTY: LiveTapeSnapshot = { live: null, streamOffline: false, ticker: '' };

let snapshot: LiveTapeSnapshot = EMPTY;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function subscribeLiveTape(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLiveTapeSnapshot(): LiveTapeSnapshot {
  return snapshot;
}

export function getLiveTapeVersion(): number {
  return version;
}

/** Imperative read (confirm handlers, order fill) — no subscription. */
export function readLiveTape(): LiveTapeSnapshot & { isLive: boolean } {
  const s = snapshot;
  return {
    ...s,
    isLive: (s.live?.live ?? false) && !s.streamOffline,
  };
}

export function publishLiveTape(next: Partial<LiveTapeSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  emit();
}

export function resetLiveTape(): void {
  snapshot = EMPTY;
  emit();
}

export type LiveTapeApi = LiveTapeSnapshot & {
  /** Payload says live AND transport is up. */
  isLive: boolean;
};

/**
 * Subscribe to live tape. Prefer this in LiveTape / CommandDeck / Orders / portfolio hosts —
 * not in the Ticker page root if you want structure widgets to skip ticks (pair with memo).
 */
export function useLiveTape(): LiveTapeApi {
  const s = useSyncExternalStore(subscribeLiveTape, getLiveTapeSnapshot, () => EMPTY);
  return {
    ...s,
    isLive: (s.live?.live ?? false) && !s.streamOffline,
  };
}
