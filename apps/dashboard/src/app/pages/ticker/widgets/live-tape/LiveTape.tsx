/**
 * LiveTape — the 5 LIVE-DERIVED StatTiles (Net flow 5m · Spread · Gamma flip (live) · VWAP ·
 * Last trade). These ride the SSE stream, so on a payload-gap drop they **dim + caption `⏸ offline`**
 * ("paused, levels below stay current") — `[live-vs-static-isolation]`. The static DealerPositioning
 * tiles below never receive `offline`.
 *
 * Session-tape (S1): title `Session tape` from first occupancy; no LIVE_TAPE_SUBTITLE_*; gamma flip
 * never `(live)`; Widget `live={false}`; drop may dim — never `⏸ offline`. Numbers follow
 * `displayActive` (not genuine isLive).
 *
 * Note: VWAP is a static bundle field but lives in the live row visually (it is intraday/live-feel);
 * it carries NO `offline` (it never dims) — matching the pre-refactor behavior where VWAP had no
 * `offline` prop. Gamma flip (live) shows the static authoritative flip when not live, never a stale
 * live value.
 */
import { useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { Widget } from '@/shared/ui/Widget';
import type { LiveUpdate, MarketState } from '@convexa/api';
import Box from '@mui/material/Box';
import { useLiveTape } from '../../liveTapeStore';
import { consumeStanding, sessionTapeOf } from '../../sessionTapeStanding';
import {
  LIVE_TAPE_SUBTITLE_LIVE,
  LIVE_TAPE_SUBTITLE_OFFLINE,
  SESSION_TAPE_INFO,
  SESSION_TAPE_NET_FLOW_INFO_1X,
  SESSION_TAPE_NET_FLOW_INFO_FAST,
  SESSION_TAPE_SUBTITLE_ENDED,
  SESSION_TAPE_TITLE,
  humanSessionDate,
  sessionTapeNotThisTickerSubtitle,
  sessionTapeSubtitle,
} from '../_kit/copy';
import { distanceToLevel, levelSpot } from '../_kit/distanceToLevel';
import { StatTile } from '../_kit/StatTile';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 2,
} as const;

interface Props {
  m: MarketState;
  /** Optional overrides — defaults to liveTapeStore (§3.8). */
  live?: LiveUpdate | null;
  isLive?: boolean;
  displayActive?: boolean;
  streamOffline?: boolean;
}

export function LiveTape({
  m,
  live: liveProp,
  isLive: isLiveProp,
  displayActive: displayActiveProp,
  streamOffline: offlineProp,
}: Props) {
  const tape = useLiveTape();
  const live = liveProp !== undefined ? liveProp : tape.live;
  const isLive = isLiveProp !== undefined ? isLiveProp : tape.isLive;
  const streamOffline = offlineProp !== undefined ? offlineProp : tape.streamOffline;
  const displayActive = displayActiveProp !== undefined ? displayActiveProp : tape.displayActive;
  const st = sessionTapeOf(live);
  const standing = consumeStanding({
    live,
    streamOffline,
    routeSymbol: m.ticker,
    lastPhase: tape.lastSessionPhase,
  });

  // S0: numbers + pulse while genuinely live. S1: numbers while display-active; never Widget pulse.
  const numbersActive = st ? displayActive : isLive && !streamOffline;
  const widgetLive = st ? false : numbersActive;
  // Flash only on real prints while numbers are active (keep-alive does not change mid/spread).
  const flashActive = numbersActive && !streamOffline;

  const netFlow = numbersActive && live ? live.net_flow : null;
  const netFlowFlash = useFlashOnChange(netFlow, { active: flashActive });
  const spreadFlash = useFlashOnChange(numbersActive ? (live?.spread ?? null) : null, {
    active: flashActive,
    tone: 'neutral',
  });
  const flipFlash = useFlashOnChange(numbersActive ? (live?.gamma_flip ?? null) : null, {
    active: flashActive,
  });
  const flipValue = (numbersActive ? live?.gamma_flip : null) ?? m.gamma_flip;
  const flipSecondary = distanceToLevel(flipValue, levelSpot(m));

  // S1 drop may dim numbers — never StatTile `⏸ offline` caption.
  const tileOffline = st ? false : streamOffline;
  const dimSx = st && streamOffline ? { opacity: 0.5 } : undefined;

  let title = 'Live tape';
  let subtitle = numbersActive ? LIVE_TAPE_SUBTITLE_LIVE : LIVE_TAPE_SUBTITLE_OFFLINE;
  let info =
    'Live-derived reads off the trade tape + quote stream. These pause on a stream drop; the levels below stay current.';
  let netFlowLabel = `Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`;
  let netFlowInfo =
    'Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid.';
  let gammaLabel = isLive ? 'Gamma flip (live)' : 'Gamma flip';

  if (st) {
    title = SESSION_TAPE_TITLE;
    info = SESSION_TAPE_INFO;
    gammaLabel = 'Gamma flip';
    const human = humanSessionDate(st.et_date);
    const armed = st.symbol.toUpperCase();
    if (standing.kind === 'ended') {
      subtitle = SESSION_TAPE_SUBTITLE_ENDED;
    } else if (standing.kind === 'not-this-ticker') {
      subtitle = sessionTapeNotThisTickerSubtitle(armed, human);
    } else {
      const sym = m.ticker.toUpperCase() === armed ? m.ticker.toUpperCase() : armed;
      subtitle = sessionTapeSubtitle(sym, human);
    }
    if (st.pace === 4 || st.pace === 10) {
      netFlowLabel = 'Net flow';
      netFlowInfo = SESSION_TAPE_NET_FLOW_INFO_FAST;
    } else {
      netFlowLabel = `Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`;
      netFlowInfo = SESSION_TAPE_NET_FLOW_INFO_1X;
    }
  }

  return (
    <Widget
      id="live-tape"
      title={title}
      live={widgetLive}
      // Spine #4: name the basis (stream) and that structure is separate (`[live-vs-static-isolation]`).
      subtitle={subtitle}
      info={info}
      span={2}
      bodyVariant="inset"
    >
      <Box sx={{ ...GRID, ...dimSx }} data-testid="live-tape">
        <StatTile
          label={netFlowLabel}
          value={netFlow != null ? `${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString()}` : '—'}
          accent={netFlow == null ? 'neutral' : netFlow >= 0 ? 'up' : 'down'}
          offline={tileOffline}
          flash={netFlowFlash}
          info={netFlowInfo}
        />
        <StatTile
          label="Spread"
          value={numbersActive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'}
          accent="neutral"
          offline={tileOffline}
          flash={spreadFlash}
          info="Best ask minus best bid. Wider = a thinner, more volatile market."
        />
        <StatTile
          label={gammaLabel}
          value={`$${flipValue}`}
          accent="neutral"
          offline={tileOffline}
          flash={flipFlash}
          secondary={flipSecondary}
          info="Analytic net-GEX zero-crossing (where hedging flips from dampening to amplifying) — not the same as call/put walls, which pick peak vendor-gamma strikes. Above it → steadier/range-bound; below it → more volatile/trending. Secondary line is distance from gex_spot (or mid)."
        />
        <StatTile
          label="VWAP"
          value={m.vwap != null ? `$${m.vwap.toFixed(2)}` : '—'}
          accent="neutral"
          info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference."
        />
      </Box>
    </Widget>
  );
}

export default LiveTape;
