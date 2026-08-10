/**
 * Route-chunk prefetch helpers (§3.8 Phase B).
 *
 * Call on CTA hover/focus or requestIdleCallback so the first navigation to a heavy lazy
 * route does not wait on the full download+parse. Safe to call repeatedly — promises are
 * memoized. Never throws into the UI.
 */

let tickerP: Promise<unknown> | null = null;
let scannerP: Promise<unknown> | null = null;
let positionsP: Promise<unknown> | null = null;
let structureFieldLabP: Promise<unknown> | null = null;

/** Prefetch the TickerDashboard lazy chunk (and its static graph). */
export function prefetchTickerRoute(): Promise<unknown> {
  if (!tickerP) {
    tickerP = import('@/pages/ticker/TickerDashboard').catch(() => {
      tickerP = null;
    });
  }
  return tickerP;
}

/** Prefetch the Scanner lazy chunk. */
export function prefetchScannerRoute(): Promise<unknown> {
  if (!scannerP) {
    scannerP = import('@/pages/scanner/Scanner').catch(() => {
      scannerP = null;
    });
  }
  return scannerP;
}

/** Prefetch the Positions page lazy chunk. */
export function prefetchPositionsRoute(): Promise<unknown> {
  if (!positionsP) {
    positionsP = import('@/pages/positions/PositionsPage').catch(() => {
      positionsP = null;
    });
  }
  return positionsP;
}

/** Prefetch the Structure Field lab lazy chunk (Canvas instrument). */
export function prefetchStructureFieldLabRoute(): Promise<unknown> {
  if (!structureFieldLabP) {
    structureFieldLabP = import('@/pages/lab/StructureFieldLab').catch(() => {
      structureFieldLabP = null;
    });
  }
  return structureFieldLabP;
}

/** Idle-time prefetch for landing: ticker first (public free path), then scanner. */
export function scheduleLandingPrefetch(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    void prefetchTickerRoute();
    void prefetchScannerRoute();
  };

  // Prefer idle; fall back to a short timeout so mobile Safari still warms the path.
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    idleId = ric(run, { timeout: 2500 });
  } else {
    timeoutId = setTimeout(run, 1200);
  }

  return () => {
    cancelled = true;
    if (idleId != null && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
    if (timeoutId != null) clearTimeout(timeoutId);
  };
}
