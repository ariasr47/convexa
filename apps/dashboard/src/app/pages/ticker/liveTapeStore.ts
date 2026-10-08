/**
 * Live tape external store (§3.8 Phase C).
 *
 * SSE ticks publish here; only components that call `useLiveTape()` re-render.
 * Structure widgets stay on REST props + React.memo so a tick does not repaint walls/GEX/history.
 *
 * Lifecycle (open/close EventSource) is owned by `useTickerStreamConnection` — this module is
 * the snapshot + subscription seam only.
 *
 * Session-tape: `isLive` is the genuine paid-live gate (`genuineIsLive`); `displayActive` may
 * move headline/tape numbers while fills/pulses stay off. `lastSessionPhase` survives a
 * payload-gap (`streamOffline` flip without clearing `live`).
 */
import type { DemoOrderFrame, LiveUpdate } from '@convexa/api';
import { useSyncExternalStore } from 'react';
import {
  displayActive as computeDisplayActive,
  genuineIsLive,
  sessionTapeOf,
  type SessionTapeOccupancy,
} from './sessionTapeStanding';

export interface LiveTapeSnapshot {
  live: LiveUpdate | null;
  demoOrderFrame: DemoOrderFrame | null;
  streamOffline: boolean;
  /** Uppercase ticker the stream is bound to (for defensive consumers). */
  ticker: string;
  /** Last vouched session_tape.phase — kept across payload-gap while live is retained. */
  lastSessionPhase: SessionTapeOccupancy['phase'] | null;
}

const EMPTY: LiveTapeSnapshot = {
  live: null,
  demoOrderFrame: null,
  streamOffline: false,
  ticker: '',
  lastSessionPhase: null,
};

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

function deriveApi(s: LiveTapeSnapshot) {
  return {
    ...s,
    isLive: genuineIsLive(s.live, s.streamOffline),
    displayActive: computeDisplayActive({
      live: s.live,
      routeSymbol: s.ticker,
      streamOffline: s.streamOffline,
    }),
  };
}

/** Imperative read (confirm handlers, order fill) — no subscription. */
export function readLiveTape(): LiveTapeSnapshot & { isLive: boolean; displayActive: boolean } {
  return deriveApi(snapshot);
}

export function publishLiveTape(
  next: Partial<Omit<LiveTapeSnapshot, 'lastSessionPhase'>> & {
    lastSessionPhase?: SessionTapeOccupancy['phase'] | null;
  },
): void {
  const merged: LiveTapeSnapshot = {
    ...snapshot,
    ...next,
    lastSessionPhase: snapshot.lastSessionPhase,
  };
  if (next.live !== undefined) {
    // New payload: adopt phase from occupancy, or clear when unset/S0.
    merged.lastSessionPhase = sessionTapeOf(next.live)?.phase ?? null;
  }
  if (next.lastSessionPhase !== undefined) {
    merged.lastSessionPhase = next.lastSessionPhase;
  }
  snapshot = merged;
  emit();
}

export function resetLiveTape(): void {
  snapshot = EMPTY;
  emit();
}

export type LiveTapeApi = LiveTapeSnapshot & {
  /** Genuine paid-live: construct unset · envelope live · not streamOffline. */
  isLive: boolean;
  /** Session-tape numbers may move (route match + playing|gap + delivering). */
  displayActive: boolean;
};

/**
 * Subscribe to live tape. Prefer this in LiveTape / CommandDeck / Orders / portfolio hosts —
 * not in the Ticker page root if you want structure widgets to skip ticks (pair with memo).
 */
export function useLiveTape(): LiveTapeApi {
  const s = useSyncExternalStore(subscribeLiveTape, getLiveTapeSnapshot, () => EMPTY);
  return deriveApi(s);
}
