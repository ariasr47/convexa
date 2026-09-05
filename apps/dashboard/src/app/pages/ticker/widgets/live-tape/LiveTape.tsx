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
import { consumeStanding, isDeliveringLive, sessionTapeOf } from '../../sessionTapeStanding';
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
import { FigureCell } from '../_kit/FigureCell';

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
  // GATE Q bounce (curvature-v2-foundations, finding 1) — [live-vs-static-isolation]: the label-row
  // dot, the widget pulse and the tick flash answer "is THIS the delivering live stream right now?",
  // which is NOT what `numbersActive` answers ("should numbers move at all" — true during session-
  // tape playback too, and blind to `market_session` on the S0 path). The chip
  // (`connection/connectionState.ts`) and these three figures now share the ONE predicate,
  // `isDeliveringLive`, computed straight from the raw `live` payload + `streamOffline` — never
  // re-derived from `numbersActive`/`isLive`/`displayActive` a second way.
  const isDeliveringLiveNow = isDeliveringLive(live, streamOffline);
  const widgetLive = isDeliveringLiveNow;
  // Flash only on a print from the genuinely live, delivering stream (AC-11: tick flash stops in
  // every one of the five non-live chip states, replay included — a replayed tape print is not one).
  const flashActive = isDeliveringLiveNow;

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
  // F6 (SPEC §4.1) — session replay never wears the label-row dot, structurally, not merely by data:
  // `FigureCell` already implements the F6 branch (mono full strength, no dot, no pause mark, no
  // `offline` caption) but no call site here ever set the prop, so it was unreachable (GATE Q bounce,
  // finding 1, case B). VWAP is excluded on purpose — it is a static bundle field, never a replay
  // artifact, so it stays in its ordinary default/F1 rendering at every standing.
  const replayFigure = Boolean(st);

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
        {/* Net flow — AC-1c: live = isDeliveringLiveNow && netFlow != null. GATE Q bounce finding 1:
            `netFlow != null` ALONE is not the delivering-stream predicate — it is also true while a
            session tape plays back a real number, which must NOT wear a dot. F5-only this phase
            (no retention latch on LiveTape — ruling 2; phase 2 owes it). */}
        <FigureCell
          register="traced"
          label={netFlowLabel}
          value={netFlow != null ? `${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString()}` : '—'}
          live={isDeliveringLiveNow && netFlow != null}
          offline={tileOffline ? { retained: false } : null}
          replay={replayFigure}
          flash={netFlowFlash}
          info={netFlowInfo}
        />
        {/* Spread — AC-1c: live = isDeliveringLiveNow && live?.spread != null (GATE Q bounce finding 1
            — see the Net flow comment above for why `numbersActive` alone is the wrong gate). */}
        <FigureCell
          register="traced"
          label="Spread"
          value={numbersActive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'}
          live={isDeliveringLiveNow && live?.spread != null}
          offline={tileOffline ? { retained: false } : null}
          replay={replayFigure}
          flash={spreadFlash}
          info="Best ask minus best bid. Wider = a thinner, more volatile market."
        />
        {/* Gamma flip — AC-1c: live = isDeliveringLiveNow && live?.gamma_flip != null, deliberately
            NOT `flipValue != null` (pre-conversion :87 falls back to the bundle's m.gamma_flip, so a
            dot keyed on the rendered value would claim the stream for a static number). The
            rendered value already falls back to the bundle on a drop, so its offline arm is
            RETAINED whenever a fallback exists (matches the shipped dim+caption behaviour), and
            degrades honestly to the bare literal only if even the bundle has none. */}
        <FigureCell
          register="traced"
          label={gammaLabel}
          value={flipValue != null ? `$${flipValue}` : '—'}
          live={isDeliveringLiveNow && live?.gamma_flip != null}
          offline={tileOffline ? { retained: flipValue != null } : null}
          replay={replayFigure}
          flash={flipFlash}
          caption={flipSecondary}
          info="Analytic net-GEX zero-crossing (where hedging flips from dampening to amplifying) — not the same as call/put walls, which pick peak vendor-gamma strikes. Above it → steadier/range-bound; below it → more volatile/trending. Secondary line is distance from gex_spot (or mid)."
        />
        {/* VWAP — AC-1c: ALWAYS dotless. `market_state.vwap` is a bundle field (never on the
            stream), so it NEVER wears a live dot and NEVER dims on an SSE drop (pre-conversion:
            no `offline` prop at all). */}
        <FigureCell
          register="traced"
          label="VWAP"
          value={m.vwap != null ? `$${m.vwap.toFixed(2)}` : '—'}
          live={false}
          info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference."
        />
      </Box>
    </Widget>
  );
}

export default LiveTape;
