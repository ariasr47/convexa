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
import { PRESETS } from '@/features/personas/presets';
import { loadCustoms } from '@/features/personas/store';
import { subscribeOrders } from '@/features/trading/orders/store';
import { useOrderEngine } from '@/features/trading/orders/useOrderEngine';
import { TrackRecordSection } from '@/features/trading/outcomes/TrackRecordSection';
import { MarkFeedProvider, type MarkFeed } from '@/features/trading/positions/markFeed';
import { PortfolioPanel } from '@/features/trading/positions/PortfolioPanel';
import { allPositions } from '@/features/trading/positions/store';
import { usePortfolio } from '@/features/trading/positions/usePortfolio';
import { FigureCell } from '@/pages/ticker/widgets/_kit/FigureCell';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { isDeliveringLive } from '@/shared/liveness/liveClaim';
import { downText, upText } from '@/shared/theme/tokens';
import { PanelContainer } from '@/shared/ui/PanelContainer';
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
function netPlTintSx(tint: NetPlTint) {
  if (!tint) return {};
  return {
    '& [data-figure-register="mono"]': {
      color: tint === 'positive' ? upText : downText,
    },
  };
}

const POSITIONS_LEAD: Record<MarkFeed, string> = {
  sample:
    'Your simulated book, paper only. Saved in this browser’s demo workspace; marks come from the sample chain.',
  notLive:
    'Your simulated book, paper only, saved in this browser. Option marks need the options feed, which isn’t live on this site; records and user-entered prices still work.',
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

export function PositionsPage() {
  // The focused ticker is derived once on mount from the durable book (re-derives on remount, like a
  // reload). It drives the anchor bundle + the single page-scoped SSE.
  const ticker = useMemo(() => focusedTicker(), []);
  const [data, setData] = useState<TickerBundle | null>(null);
  const [live, setLive] = useState<LiveUpdate | null>(null);
  const [demoFrame, setDemoFrame] = useState<DemoOrderFrame | null>(null);
  const [streamOffline, setStreamOffline] = useState(false);

  const isLive = isDeliveringLive(live, streamOffline);

  // Anchor bundle: best-effort. A failure leaves `data` null — `usePortfolio` then degrades marks to
  // `tracking unavailable` / last-known per row, never blanking the records. Polls on the cache cadence.
  //
  // no-vendor-production-posture F4 ("positions pricing"): `GET /api/ticker` is a B2 route. A
  // `market_data_paused` fault is a STANDING fact, not a transient miss — once it lands, this effect
  // stops polling for the rest of this ticker's lifetime (mirrors the ticker desk's own
  // `usePollingResource`'s `haltOn`); a focused-ticker change (a new effect run) is the only thing
  // that asks again. Marks already degrade to their existing closed-vocabulary absent value with
  // `data` staying null — this only stops the silent, indefinite re-ask of a route that will never
  // answer differently.
  useEffect(() => {
    let cancelled = false;
    let halted = false;
    const load = () => {
      if (halted) return;
      getTicker(ticker)
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch((err: unknown) => {
          /* best-effort: leave prior data; per-row marks degrade, records persist */
          if (isMarketDataPaused(err)) halted = true;
        });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticker]);

  // ONE page-scoped SSE for the focused ticker (same lifecycle/teardown as the Ticker viewer). At most
  // one EventSource per ticker; closed on unmount. The watchdog flips `streamOffline` on a drop so live
  // marks degrade to ⏸ last known while durable records persist.
  useEffect(() => {
    setLive(null);
    setStreamOffline(false);
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
  }, [ticker]);

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
    return netPlStateOf({ views: pf.views, streamOffline, retainedTotal });
  }, [pf.views, streamOffline]);

  // Capital at risk (design/src/screens/positions.mjs:63) — the OPEN book's max-loss sum, STATIC
  // (never live-derived, so no offline arm; `capitalAtRisk.ts`'s own header). Reuses the SAME
  // `view.max_loss` every row/card cell already reads — not a second compute path.
  const capitalAtRisk = useMemo(() => capitalAtRiskStateOf({ views: pf.views }), [pf.views]);

  // Where marks come from (markFeed.tsx): the demo's sample chain, or no feed at all on a live build
  // whose server says `not_live` (records and user-entered prices still work; option marks can't).
  const marketData = useMarketDataMode();
  const markFeed: MarkFeed =
    dataMode === 'demo' ? 'sample' : marketData === 'not_live' ? 'notLive' : 'live';

  return (
    <MarkFeedProvider value={markFeed}>
      <Box sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px 24px',
            mb: '6px',
          }}
        >
          <Box>
            <Typography component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
              Positions
            </Typography>
            <Typography component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
              {POSITIONS_LEAD[markFeed]}
            </Typography>
          </Box>
          {/* The mast's stat cluster (design/src/screens/positions.mjs:62-65, `.pos-stats`): capital
            at risk beside the live Net P/L readout, right-aligned. Both render through `FigureCell`
            itself, per the panel-shaped exception SPEC §2.1/§2.3 carve out for this readout (council
            `decisions.md` §3 #0+#16; `council/R3-architect.md` #0 and #3 name it explicitly, having
            weighed the cross-page import against the app's own "pages never import sibling pages"
            rule at R1 and kept it narrow rather than promoting the whole card — a promotion
            `AccessibleHelp`'s own import would force, which FE-12 already owns for the frame's ⓘ).
            Each is wrapped in its own `PanelContainer` (`shared/ui/PanelContainer.tsx`) so the
            declared 20→17→15 step has a named ancestor to step against at all (§2.4's hazard) —
            without one, the step never fires at any viewport, with a green build. `minWidth`/
            `flexShrink: 0` counter a real rendered defect this task found and fixed:
            `container-type: inline-size` size-contains the box, so as a flex item with no floor it
            collapsed to a ZERO-width, effectively invisible column (caught by a real
            headless-browser pass, not by jsdom, which cannot evaluate container queries) — the SAME
            shape `ReadStrip.tsx:57`'s `minWidth: 140` already carries for its own nested
            `PanelContainer`s. */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
            <PanelContainer
              data-testid="positions-capital-at-risk"
              sx={{ maxWidth: 260, minWidth: 160, flexShrink: 0 }}
            >
              <FigureCell
                label="Capital at risk"
                register={capitalAtRisk.register}
                value={capitalAtRisk.value}
                caption={capitalAtRisk.caption}
                offline={null}
              />
            </PanelContainer>
            <PanelContainer
              data-testid="positions-net-pl"
              sx={{ maxWidth: 320, minWidth: 200, flexShrink: 0, ...netPlTintSx(netPl.tint) }}
            >
              <FigureCell
                label="Net P/L (open)"
                register={netPl.register}
                value={netPl.value}
                caption={netPl.caption}
                offline={netPl.offline}
              />
            </PanelContainer>
          </Box>
        </Box>
        <PortfolioPanel
          pf={pf}
          data={data}
          live={live}
          isLive={isLive}
          streamOffline={streamOffline}
          ticker={ticker}
          entryOpen={entryOpen}
          onEntryOpen={setEntryOpen}
        />
        {/* outcome-ledger: the reflective read UNDER the book. The book is what this page is for.
          ⚠ It is a STATIC historical read: it takes NO `data`/`live`/`isLive`/`streamOffline` prop
          and does not dim on a stream drop — unlike the Net P/L header above, which is a LIVE P&L.
          Do not "make it consistent" with that block (`[live-vs-static-isolation]`, AC-E17). */}
        <TrackRecordSection personaLabel={personaLabelOf} />
      </Box>
    </MarkFeedProvider>
  );
}

export default PositionsPage;
