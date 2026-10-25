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
 * Re-skin (convexa-redesign · Positions): a live **Net P/L (open)** readout (sum of the OPEN
 * positions' P/L, dimmed on a stream drop; `[live-vs-static-isolation]`), first beside the title and
 * now the middle cell of the figure strip below it. No data path / handler changes.
 *
 * Final board layout (fidelity audit 2026-10-25; owner NO-6 A): the page column (`pageColumnSx`),
 * the title, a full-width figure strip (capital at risk · Net P/L (open) · open · pending · closed),
 * the book with its one toolbar row, then the orders panel beside the Track record panel, then the
 * Track record's five families full width.
 */
import { PRESETS } from '@/features/personas/presets';
import { loadCustoms } from '@/features/personas/store';
import { subscribeOrders } from '@/features/trading/orders/store';
import { useOrderEngine } from '@/features/trading/orders/useOrderEngine';
import {
  TrackRecordFamilies,
  TrackRecordPanel,
  useTrackRecord,
} from '@/features/trading/outcomes/TrackRecordSection';
import {
  MarkFeedProvider,
  MarkNotLiveTag,
  type MarkFeed,
} from '@/features/trading/positions/markFeed';
import { PortfolioPanel } from '@/features/trading/positions/PortfolioPanel';
import { allPositions } from '@/features/trading/positions/store';
import { usePortfolio } from '@/features/trading/positions/usePortfolio';
import { FigureCell } from '@/pages/ticker/widgets/_kit/FigureCell';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { marketDataOff } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { usePollingResource } from '@/shared/hooks/usePollingResource';
import { isDeliveringLive } from '@/shared/liveness/liveClaim';
import { downText, extrasFor, upText } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { PanelContainer } from '@/shared/ui/PanelContainer';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import {
  dataMode,
  getTicker,
  isMarketDataPaused,
  LiveUpdate,
  subscribeTicker,
  TickerBundle,
  type DemoOrderFrame,
} from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { capitalAtRiskStateOf } from './capitalAtRisk';
import { netPlStateOf, type NetPlTint } from './netPl';

/**
 * Direction is permitted only where the readout carries a REAL computed sum over marked rows
 * (SPEC §4.3 table — never on `—`/`unavailable`, never mid-drop, both already `tint: null` from
 * `netPlStateOf`). `FigureCell` itself has no colour prop (its value glyph is always
 * `text.primary`), so this reaches the SAME rendered value glyph from outside the primitive via the
 * one stable, documented extension point every register-enforcement assertion in this phase already
 * keys on — the value glyph's own `data-figure-register` attribute — never by touching `FigureCell`
 * (out of this task's file ownership; it stays FE-1's).
 */
function netPlTint(tint: NetPlTint) {
  if (!tint) return undefined;
  return tint === 'positive' ? upText : downText;
}

/**
 * The figure strip (the Final board's `.ac-strip`, `design/src/screens/final/account-pages.mjs`):
 * three cells across the column, 1px apart on the line colour, radius 12; one column under 900px.
 * On the demo it is a sample frame (canon P-3, P-8): dashed in steel, the 8px hatch band at its head,
 * and its cells on the frame's own panel, so no rule shows between them.
 */
const stripSx = (sample: boolean) => (t: Theme) => ({
  position: 'relative' as const,
  display: 'grid',
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
  gap: '1px',
  bgcolor: sample ? 'background.paper' : 'divider',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
  ...(sample && {
    borderStyle: 'dashed',
    borderColor: extrasFor(t).textTertiary,
    '&::before': {
      content: '""',
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: 0,
      height: 8,
      pointerEvents: 'none' as const,
      zIndex: 1,
      background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
        t.palette.text.secondary,
        0.28,
      )} 6px 12px)`,
    },
  }),
});

/**
 * One strip cell: the figure, and its state tag at the head's right. `FigureCell` is a card; inside
 * the strip it is a flat cell (the board's `.ac-strip > div`: 14px 18px, the 24px mono value, a 12px
 * caption), restyled from outside the primitive, as `netPlTint`'s colour reaches its value glyph.
 */
const stripCellSx = (sample: boolean, figureColor?: (t: Theme) => string) => ({
  // One grid row: the figure spans the cell, and the tag sits over its top-right corner, level
  // with the label row, which keeps clear of it; the value and the caption take the full width.
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  minWidth: 0,
  '& > :first-child': { gridColumn: '1 / -1', gridRow: 1 },
  bgcolor: sample ? 'transparent' : 'background.paper',
  '& .MuiCard-root': {
    border: 0,
    borderRadius: 0,
    bgcolor: 'transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    transition: 'none',
    '&:hover': { transform: 'none', boxShadow: 'none' },
  },
  '& .MuiCardContent-root, & .MuiCardContent-root:last-child': {
    p: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  // The label row is the tag's height (22), as the board's label row holds its tag inline, and
  // keeps the tag's width clear on its right.
  '& .MuiCardContent-root > :first-child': { minHeight: 22, pr: '112px' },
  '& [data-figure-register="mono"]': {
    fontSize: 24,
    lineHeight: 1.2,
    ...(figureColor && { color: figureColor }),
  },
  // The caption keeps `FigureCell`'s own face (a page source names no font family, fonts.spec
  // N-1); only its size and leading follow the board's 12px line.
  '& [data-testid="stat-secondary"]': {
    fontSize: '0.75rem',
    lineHeight: 1.45,
    mt: 0,
  },
});

/** The cell's state tag (canon P-2), level with the figure's label. */
const stripTagSx = {
  gridColumn: 2,
  gridRow: 1,
  position: 'relative',
  zIndex: 1,
  pt: '14px',
  pr: '18px',
} as const;

/** The lead under the title. It follows /api/health, not just the mark source: `paused` takes the
 *  not-live treatment in its own word (a feed exists and an operator stopped it), and `unknown`
 *  (the health read failed) claims nothing either way, like the bar's UNKNOWN_COPY (review W1-59). */
type PositionsLead = MarkFeed | 'paused' | 'unknown';

const POSITIONS_LEAD: Record<PositionsLead, string> = {
  sample:
    'Your simulated book, paper only. Saved in this browser’s demo workspace; marks come from the sample chain.',
  notLive:
    'Your simulated book, paper only, saved in this browser. Option marks need the options feed, which isn’t live on this site; records and user-entered prices still work.',
  paused:
    'Your simulated book, paper only, saved in this browser. Live market data is paused on this site, so option marks wait for it; records and user-entered prices still work.',
  unknown:
    'Your simulated book, paper only, saved in this browser. Couldn’t check whether option marks are live right now; records and user-entered prices still work.',
  live: 'Your simulated book, paper only, saved in this browser. Marks follow the options feed and name their basis; records never drop.',
};

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
    // Single-underlying is enforced at construction, so leg 0 IS the position's ticker.
    const tk = p.legs[0]?.ticker;
    if (!tk) continue;
    counts.set(tk, (counts.get(tk) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [tk, n] of counts) {
    if (n > bestN) {
      best = tk;
      bestN = n;
    }
  }
  return best ?? DEFAULT_TICKER;
}

/**
 * outcome-ledger: the persona display name, INJECTED into the Track record section as a prop.
 * `features/trading/outcomes` may not import `features/personas` (not on the architect's allow-list),
 * so the page shell — which may import both — resolves the label. An id we no longer hold ⇒ null ⇒
 * the section renders its honest "Persona no longer saved" label, never a raw internal id.
 */
function personaLabelOf(id: string): string | null {
  return [...PRESETS, ...loadCustoms()].find((p) => p.id === id)?.name ?? null;
}

function PositionsBook({ markFeed, lead }: { markFeed: MarkFeed; lead: PositionsLead }) {
  // The focused ticker is derived once on mount from the durable book (re-derives on remount, like a
  // reload). It drives the anchor bundle + the single page-scoped SSE.
  const ticker = useMemo(() => focusedTicker(), []);
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [demoFrame, setDemoFrame] = useState<DemoOrderFrame | null>(null);
  const [streamOffline, setStreamOffline] = useState(false);

  const isLive = isDeliveringLive(live, streamOffline);

  // Anchor bundle: best-effort. A failure keeps the last bundle (null before the first one), and
  // `usePortfolio` degrades marks to `tracking unavailable` / last-known per row, never blanking the
  // records. Polls on the cache cadence; skips ticks while the tab is hidden.
  //
  // no-vendor-production-posture F4 ("positions pricing"): `GET /api/ticker` is a B2 route. A
  // `market_data_paused` fault is a STANDING fact, not a transient miss — once it lands, `haltOn`
  // stops polling for the rest of this ticker's lifetime, as on the ticker desk. Marks already
  // degrade to their existing closed-vocabulary absent value; this only stops the silent,
  // indefinite re-ask of a route that will never answer differently. With no options feed on this
  // site the route can only refuse, so it is never asked (`markFeed` is fixed for the page load).
  const { data } = usePollingResource<TickerBundle>(
    markFeed === 'notLive' ? null : ticker,
    (signal) => getTicker(ticker, {}, { signal }),
    { intervalMs: POLL_MS, haltOn: isMarketDataPaused },
  );

  // ONE page-scoped SSE for the focused ticker (same lifecycle/teardown as the Ticker viewer). At most
  // one EventSource per ticker; closed on unmount. The watchdog flips `streamOffline` on a drop so live
  // marks degrade to ⏸ last known while durable records persist.
  useEffect(() => {
    setLive(null);
    setStreamOffline(false);
    if (markFeed === 'notLive') return;
    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeTicker(ticker, {}, (event) => {
      if (event.kind === 'ticker_update') {
        setLive(event.update);
        setStreamOffline(false);
        if (gapTimer) clearTimeout(gapTimer);
        if (dataMode === 'live')
          gapTimer = setTimeout(() => setStreamOffline(true), STREAM_OFFLINE_MS);
      } else if (event.kind === 'demo_order_frame') {
        setDemoFrame(event.frame);
      }
    });
    return () => {
      if (gapTimer) clearTimeout(gapTimer);
      unsub();
    };
  }, [ticker, markFeed]);

  const pf = usePortfolio(ticker, data, live, isLive, streamOffline);
  const [entryOpen, setEntryOpen] = useState(false);

  // ai-rec-backtest-orders: the order engine rides THIS page's focused-ticker stream (arch §5 —
  // orders for other tickers simply render not-evaluated, D5). A fill writes a Position into the
  // shared durable store, so re-read the portfolio whenever the orders store mutates.
  useOrderEngine({ ticker, bundle: data, live, isLive, streamOffline, demoFrame });
  useEffect(() => {
    const unsubscribe = subscribeOrders(() => pf.refreshPositions());
    return () => {
      unsubscribe();
    };
  }, [pf.refreshPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Net P/L (open): five states over the SAME set the sum always walked (`netPl.ts`, SPEC §4.3) —
  // reusing the SAME derived P/L the rows show (`pf.views[*].pl_dollar`), NOT a new compute path.
  // `retainedTotal` is the marked-sum computed the SAME way the online arms compute it below; passing
  // it through rather than re-deriving it inside `netPlStateOf` is what makes the F4/F5 arms testable
  // without a page (see `netPl.ts`'s file header).
  const netPl = useMemo(() => {
    const open = pf.views.filter((v) => v.position.status === 'open');
    const marked = open.filter((v) => v.pl_dollar != null);
    const retainedTotal =
      marked.length > 0 ? marked.reduce((sum, v) => sum + (v.pl_dollar as number), 0) : null;
    return netPlStateOf({
      views: pf.views,
      streamOffline,
      retainedTotal,
      feedNotLive: markFeed === 'notLive',
    });
  }, [pf.views, streamOffline, markFeed]);

  // Capital at risk (design/src/screens/positions.mjs:63) — the OPEN book's max-loss sum, STATIC
  // (never live-derived, so no offline arm; `capitalAtRisk.ts`'s own header). Reuses the SAME
  // `view.max_loss` every row/card cell already reads — not a second compute path.
  const capitalAtRisk = useMemo(() => capitalAtRiskStateOf({ views: pf.views }), [pf.views]);

  // The book's counts, the strip's third cell (the Final board's `Open · pending · closed`): read
  // from the same durable records the toolbar's status pills count, no new store, no fetch.
  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, closed: 0 };
    for (const p of pf.positions) {
      if (p.status === 'open' || p.status === 'pending' || p.status === 'closed') c[p.status] += 1;
    }
    return c;
  }, [pf.positions]);

  // outcome-ledger: ONE read for the page's two Track record parts (owner, NO-6 A, 2026-10-25): its
  // head and archive in the panel beside the orders panel, its five families full width below.
  // ⚠ It is a STATIC historical read: it takes NO `data`/`live`/`isLive`/`streamOffline` input and
  // does not dim on a stream drop — unlike the Net P/L cell above it, which is a LIVE P&L. Do not
  // "make it consistent" with that cell (`[live-vs-static-isolation]`, AC-E17).
  const trackRecord = useTrackRecord(personaLabelOf);

  const sample = markFeed === 'sample';
  const netPlTag =
    markFeed === 'sample' ? (
      <DataStateTag state="sample" label="Sample mark" />
    ) : markFeed === 'notLive' ? (
      <MarkNotLiveTag />
    ) : null;

  return (
    <MarkFeedProvider value={markFeed}>
      {/* The one page column (`pageColumnSx`, the boards' `.wrap`; fidelity COL), with the page's
          own py, and the board's `.ap` rhythm: its sections 22px apart. */}
      <Box
        data-testid="positions-page"
        sx={{ ...pageColumnSx, py: 3, display: 'flex', flexDirection: 'column', gap: '22px' }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* The account pages' one title size (owner, NO-12 A, 2026-10-25), as the board's `.ap-h
              h1` draws it: 40px at 1440 (fidelity ACC-16). The theme's h1 variant carries the
              display face (Archivo, its stretch, 700): a page source names no font family. */}
          <Typography
            component="h1"
            variant="h1"
            sx={{
              fontSize: 'clamp(30px, 3vw, 40px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              m: 0,
            }}
          >
            Positions
          </Typography>
          <Typography
            component="p"
            sx={{
              fontSize: '0.90625rem',
              lineHeight: 1.55,
              color: 'text.secondary',
              m: '6px 0 0',
              maxWidth: '70ch',
            }}
          >
            {POSITIONS_LEAD[lead]}
          </Typography>
        </Box>

        {/* The figure strip (the Final board's `.ac-strip`; owner, NO-6 A, 2026-10-25): three cells
          across the column, capital at risk, the live Net P/L and the book's counts. Each figure
          renders through `FigureCell` itself, per the panel-shaped exception SPEC §2.1/§2.3 carve
          out for this readout (council `decisions.md` §3 #0+#16), restyled from outside the
          primitive into the strip's flat cells (`stripCellSx`). Each sits in its own
          `PanelContainer` (`shared/ui/PanelContainer.tsx`) so the declared 20→17→15 step has a
          named ancestor to step against at all (§2.4's hazard); `minWidth: 0` keeps a size-contained
          box from collapsing to zero width as a grid item. On the demo the strip is a sample
          frame: dashed, with the 8px hatch band (canon P-3, P-8). */}
        <Box
          data-testid="positions-strip"
          data-provenance={sample ? 'sample' : 'primary'}
          sx={stripSx(sample)}
        >
          <Box data-testid="positions-capital-at-risk" sx={stripCellSx(sample)}>
            <PanelContainer sx={{ minWidth: 0 }}>
              <FigureCell
                label="Capital at risk"
                register={capitalAtRisk.register}
                value={capitalAtRisk.value}
                caption={capitalAtRisk.caption}
                offline={null}
              />
            </PanelContainer>
            <Box sx={stripTagSx}>
              <DataStateTag state="computed" />
            </Box>
          </Box>
          <Box data-testid="positions-net-pl" sx={stripCellSx(sample, netPlTint(netPl.tint))}>
            <PanelContainer sx={{ minWidth: 0 }}>
              <FigureCell
                label="Net P/L (open)"
                register={netPl.register}
                value={netPl.value}
                caption={netPl.caption}
                offline={netPl.offline}
              />
            </PanelContainer>
            {netPlTag && <Box sx={stripTagSx}>{netPlTag}</Box>}
          </Box>
          <Box data-testid="positions-book-counts" sx={stripCellSx(sample)}>
            <PanelContainer sx={{ minWidth: 0 }}>
              <FigureCell
                label="Open · pending · closed"
                register="traced"
                value={`${counts.open} · ${counts.pending} · ${counts.closed}`}
                caption={
                  sample ? 'saved in this browser’s demo workspace' : 'saved in this browser'
                }
                offline={null}
              />
            </PanelContainer>
            <Box sx={stripTagSx}>
              <DataStateTag state="local" />
            </Box>
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <PortfolioPanel
            pf={pf}
            data={data}
            live={live}
            isLive={isLive}
            streamOffline={streamOffline}
            ticker={ticker}
            entryOpen={entryOpen}
            onEntryOpen={setEntryOpen}
            besideOrders={<TrackRecordPanel record={trackRecord} />}
          />
        </Box>
        <TrackRecordFamilies record={trackRecord} labelled />
      </Box>
    </MarkFeedProvider>
  );
}

/** Where marks come from (markFeed.tsx): the demo's sample chain, or, on a live build whose server
 *  says `not_live` or `paused`, no feed at all (records and user-entered prices still work; option
 *  marks can't, and the bundle, stream and contract routes are never asked: they can only refuse).
 *  An `unknown` health answer still asks, since the feed may be running. The health read is shared
 *  and answered once per page load; the book waits for it so no request starts on a guess. */
export function PositionsPage() {
  const marketData = useMarketDataMode();
  if (dataMode !== 'demo' && marketData === null) return <RouteFallback />;
  const markFeed: MarkFeed =
    dataMode === 'demo' ? 'sample' : marketDataOff(marketData) ? 'notLive' : 'live';
  const lead: PositionsLead =
    dataMode === 'demo'
      ? 'sample'
      : marketData === 'paused'
        ? 'paused'
        : marketData === 'unknown'
          ? 'unknown'
          : markFeed;
  return (
    <MarkFeedProvider value={markFeed}>
      <PositionsBook markFeed={markFeed} lead={lead} />
    </MarkFeedProvider>
  );
}

export default PositionsPage;
