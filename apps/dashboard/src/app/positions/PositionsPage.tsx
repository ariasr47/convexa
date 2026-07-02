/**
 * Standalone Positions page (ARCHITECTURE §4.3 / Q2). The RELOCATED `PortfolioPanel` was previously a
 * child of the Ticker viewer, which supplied it with `data`/`live`/`isLive`/`streamOffline` from the
 * Ticker page's bundle + SSE. On `/positions` there is no Ticker-page parent, so this thin wrapper
 * sources those itself using the EXISTING mechanisms (NO backend change):
 *
 *  - `usePortfolio` already does per-row mark sourcing via `GET /api/contract` (`fetchTrackedContract`)
 *    per OPEN/PENDING row — that is unchanged and is the primary mark source (AC-PosLive-1..4).
 *  - To give `computeMark` an anchor spot + a live underlying, this wrapper polls `GET /api/ticker`
 *    for the book's focused ticker and opens ONE page-scoped SSE via `streamTicker` (the same
 *    page-scoped lifecycle as the Ticker viewer: at most one SSE per ticker, torn down on unmount).
 *  - All sourcing is best-effort: a bundle/stream failure degrades marks (last-known / unavailable /
 *    no-live-quote) but NEVER blanks or drops a durable record (`[live-vs-static-isolation]`).
 *
 * The durable store + `usePortfolio` durability logic are UNCHANGED — this file adds no durable
 * page/shell state. The LOCKED Live tab and SIMULATED posture are untouched (`[no-real-order-path]`).
 *
 * Re-skin (convexa-redesign · Positions): the page header is now a flex row — the title/subtitle on the
 * left, a live **Net P/L (open)** readout on the right (sum of the OPEN positions' P/L, dimmed on a
 * stream drop; `[live-vs-static-isolation]`). The 1240px centered content column replaces the MUI
 * `Container maxWidth="lg"`. No data path / handler changes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { getTicker, streamTicker, TickerBundle, LiveUpdate } from '@org/api';
import { usePortfolio } from './usePortfolio';
import { PortfolioPanel } from './PortfolioPanel';
import { allPositions } from './store';
import { useOrderEngine } from '../orders/useOrderEngine';
import { subscribeOrders } from '../orders/store';
import { typographyTokens } from '../tokens';

const POLL_MS = 60_000; // matches the backend cache TTL (same cadence as the Ticker viewer)
const STREAM_OFFLINE_MS = 15_000; // payload-gap watchdog → live-mark degrade (mirrors the Ticker page)
const DEFAULT_TICKER = 'TSLA';

/** Pick the focused ticker for the anchor bundle + SSE: the most-represented open/pending ticker in
 *  the durable book, falling back to the default. Per-row marks still resolve per their own ticker
 *  via `GET /api/contract`; this only sources the anchor spot + the live underlying for the stream. */
function focusedTicker(): string {
  const counts = new Map<string, number>();
  for (const p of allPositions()) {
    if (p.status !== 'open' && p.status !== 'pending') continue;
    counts.set(p.ticker, (counts.get(p.ticker) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [tk, n] of counts) {
    if (n > bestN) { best = tk; bestN = n; }
  }
  return best ?? DEFAULT_TICKER;
}

/** Net P/L (open): `(+$|−$){abs.toLocaleString()}` with a real minus sign. */
function formatNetPl(v: number): string {
  return `${v >= 0 ? '+$' : '−$'}${Math.abs(Math.round(v)).toLocaleString()}`;
}

export function PositionsPage() {
  // The focused ticker is derived once on mount from the durable book (re-derives on remount, like a
  // reload). It drives the anchor bundle + the single page-scoped SSE.
  const ticker = useMemo(() => focusedTicker(), []);
  const [data, setData] = useState<TickerBundle | null>(null);
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [streamOffline, setStreamOffline] = useState(false);

  const isLive = (live?.live ?? false) && !streamOffline;

  // Anchor bundle: best-effort. A failure leaves `data` null — `usePortfolio` then degrades marks to
  // `tracking unavailable` / last-known per row, never blanking the records. Polls on the cache cadence.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getTicker(ticker)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { /* best-effort: leave prior data; per-row marks degrade, records persist */ });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [ticker]);

  // ONE page-scoped SSE for the focused ticker (same lifecycle/teardown as the Ticker viewer). At most
  // one EventSource per ticker; closed on unmount. The watchdog flips `streamOffline` on a drop so live
  // marks degrade to ⏸ last known while durable records persist.
  useEffect(() => {
    setLive(null);
    setStreamOffline(false);
    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = streamTicker(ticker, {}, (u) => {
      setLive(u);
      setStreamOffline(false);
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => setStreamOffline(true), STREAM_OFFLINE_MS);
    });
    return () => { if (gapTimer) clearTimeout(gapTimer); unsub(); };
  }, [ticker]);

  const pf = usePortfolio(ticker, data, live, isLive, streamOffline);
  const [entryOpen, setEntryOpen] = useState(false);

  // ai-rec-backtest-orders: the order engine rides THIS page's focused-ticker stream (arch §5 —
  // orders for other tickers simply render not-evaluated, D5). A fill writes a Position into the
  // shared durable store, so re-read the portfolio whenever the orders store mutates.
  useOrderEngine({ ticker, bundle: data, live, isLive, streamOffline });
  useEffect(() => {
    const unsubscribe = subscribeOrders(() => pf.refreshPositions());
    return () => { unsubscribe(); };
  }, [pf.refreshPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Net P/L (open): the sum of the OPEN positions' $ P/L — reusing the SAME derived P/L the rows show
  // (`pf.rows[*].metrics.plDollar`), NOT a new compute path. A row whose live P/L is unavailable this
  // cycle contributes nothing (null is skipped), exactly as the per-group subtotal does.
  const netPl = useMemo(
    () => pf.rows.reduce((sum, r) => (
      r.position.status === 'open' && r.metrics.plDollar != null ? sum + r.metrics.plDollar : sum
    ), 0),
    [pf.rows],
  );

  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
      <Box
        sx={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px', mb: '6px',
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
            Positions
          </Typography>
          <Typography component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
            Your simulated book — paper-only, persisted in this browser. Live marks degrade gracefully; records never drop.
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography component="div" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
            Net P/L (open)
          </Typography>
          <Typography
            component="div"
            data-testid="positions-net-pl"
            sx={{
              fontFamily: typographyTokens.monoFontFamily, fontVariantNumeric: 'tabular-nums',
              fontSize: '1.5rem', fontWeight: 700,
              color: netPl >= 0 ? 'success.main' : 'error.main',
              opacity: streamOffline ? 0.5 : 1,
            }}
          >
            {formatNetPl(netPl)}
          </Typography>
        </Box>
      </Box>
      <PortfolioPanel
        pf={pf} data={data} live={live} isLive={isLive} streamOffline={streamOffline}
        ticker={ticker} entryOpen={entryOpen} onEntryOpen={setEntryOpen}
      />
    </Box>
  );
}

export default PositionsPage;
