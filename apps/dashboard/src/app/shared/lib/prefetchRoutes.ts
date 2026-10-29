/**
 * Route-chunk prefetch helpers (§3.8 Phase B).
 *
 * Call on CTA hover/focus or requestIdleCallback so the first navigation to a heavy lazy
 * route does not wait on the full download+parse. Safe to call repeatedly — promises are
 * memoized. Never throws into the UI.
 *
 * Which desk: the demo build runs the full desk (TickerDashboard); the live build mounts the public
 * desk, because production has no options feed (canon P-1; /api/health says `not_live`, and app.tsx's
 * TickerDeskRoute picks PublicDesk then). Prefetching the full desk there fetched about 100 KB the
 * landing's visitor never ran, and the click to /ticker still waited on the public desk (site audit
 * 2026-10-25, PERF-06). If production turns a feed on, the full desk is the one to prefetch again.
 * `isDemoBuild` reads the bootstrap global, so this module keeps the landing's zero-edge tree: no API
 * client (SPEC §2.1).
 */
import { isDemoBuild } from '@/shared/lib/demoSite';

let tickerP: Promise<unknown> | null = null;
let scannerP: Promise<unknown> | null = null;
let positionsP: Promise<unknown> | null = null;

/** Prefetch the ticker desk's lazy chunk (and its static graph): the full desk on the demo build,
 *  the public desk on the live build. */
export function prefetchTickerRoute(): Promise<unknown> {
  if (!tickerP) {
    const desk = isDemoBuild()
      ? import('@/pages/ticker/TickerDashboard')
      : import('@/pages/ticker/public-desk/PublicDesk');
    tickerP = desk.catch(() => {
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

/** Idle-time prefetch for landing: ticker first (public free path), then, on the demo build, the
 *  scanner. The live build's /scanner is a sign-in wall for a signed-out visitor (app.tsx), so the
 *  landing leaves its chunk for the nav's hover to warm. */
export function scheduleLandingPrefetch(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    void prefetchTickerRoute();
    if (isDemoBuild()) void prefetchScannerRoute();
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
