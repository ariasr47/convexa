/**
 * LiveTape — the 5 LIVE-DERIVED StatTiles (Net flow 5m · Spread · Gamma flip · VWAP · Last trade).
 * These ride the SSE stream, so on a payload-gap drop the ones with a held value **dim + pause mark
 * + `offline · last known`**, and the ones with an empty latch dim + pause mark with no "last known"
 * words (SPEC §2.2, owner ruling 2's debt) — `[live-vs-static-isolation]`. The static
 * DealerPositioning tiles below never receive `offline`.
 *
 * Session-tape (S1): title `Session tape` from first occupancy; no LIVE_TAPE_SUBTITLE_*; gamma flip
 * label is `Gamma flip · session tape`; Widget `live={NOT_LIVE}`; drop may dim — never the pause
 * mark. Numbers follow `displayActive` (not genuine isLive).
 *
 * Note: VWAP is a static bundle field but lives in the live row visually (it is intraday/live-feel);
 * it carries NO `offline` (it never dims) — matching the pre-refactor behavior where VWAP had no
 * `offline` prop. Gamma flip's label names its DERIVATION (`· live` / `· session tape`), never the
 * connection state (SPEC §2.2, criterion 18) — the value itself comes from the retention latch, never
 * the bundle's `m.gamma_flip` (criterion 14).
 */
import { useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { andPresent, NOT_LIVE } from '@/shared/liveness/liveClaim';
import { Widget } from '@/shared/ui/Widget';
import type { LiveUpdate, MarketState } from '@convexa/api';
import Box from '@mui/material/Box';
import { useLiveTape } from '../../liveTapeStore';
import { consumeStanding, isDeliveringLive, sessionTapeOf } from '../../sessionTapeStanding';
import {
  humanSessionDate,
  LIVE_TAPE_SUBTITLE_LIVE,
  LIVE_TAPE_SUBTITLE_OFFLINE,
  LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY,
  SESSION_TAPE_INFO,
  SESSION_TAPE_NET_FLOW_INFO_1X,
  SESSION_TAPE_NET_FLOW_INFO_FAST,
  SESSION_TAPE_SUBTITLE_ENDED,
  SESSION_TAPE_TITLE,
  sessionTapeNotThisTickerSubtitle,
  sessionTapeSubtitle,
} from '../_kit/copy';
import { distanceToLevel, levelSpot } from '../_kit/distanceToLevel';
import { FigureCell } from '../_kit/FigureCell';
import { useStreamLatch } from '../_kit/useStreamLatch';

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

  // F6 (SPEC §4.1) — session replay never wears the label-row dot, structurally, not merely by data:
  // `FigureCell` already implements the F6 branch (mono full strength, no dot, no pause mark, no
  // `offline` caption) but no call site here ever set the prop, so it was unreachable (GATE Q bounce,
  // finding 1, case B). VWAP is excluded on purpose — it is a static bundle field, never a replay
  // artifact, so it stays in its ordinary default/F1 rendering at every standing.
  const replayFigure = Boolean(st);

  // The retention latch's reset token (SPEC §2.2, criteria 16a/16b): route symbol AND replay-armed
  // state, so a symbol change AND a replay arm both empty every latch this widget owns from one token.
  const resetToken = `${m.ticker.toUpperCase()}|${st ? 'replay' : 'live'}`;

  const netFlowStream = numbersActive && live ? live.net_flow : null;
  const netFlowLatch = useStreamLatch(netFlowStream, resetToken);
  const netFlowFlash = useFlashOnChange(netFlowStream, { active: flashActive });
  const spreadStream = numbersActive ? (live?.spread ?? null) : null;
  const spreadLatch = useStreamLatch(spreadStream, resetToken);
  const spreadFlash = useFlashOnChange(spreadStream, {
    active: flashActive,
    tone: 'neutral',
  });
  const flipStream = numbersActive ? (live?.gamma_flip ?? null) : null;
  const flipFlash = useFlashOnChange(flipStream, {
    active: flashActive,
  });
  // The latch owns BOTH halves (SPEC §2.2). `live?.gamma_flip` is the RAW STREAM value — the same one
  // fed to the flash hook above — never a `?? m.gamma_flip` composition (that produced criterion 14's
  // violation). The bundle's structure flip is the LADDER's row (FE-5) and is not adopted here.
  const flipLatch = useStreamLatch(flipStream, resetToken);
  const flipValue = flipLatch.value;
  const flipSecondary = distanceToLevel(flipValue, levelSpot(m));
  const anyLatchHeld = netFlowLatch.retained || spreadLatch.retained || flipLatch.retained;

  // S1 drop may dim numbers — never StatTile `⏸ offline` caption.
  const tileOffline = st ? false : streamOffline;
  const dimSx = st && streamOffline ? { opacity: 0.5 } : undefined;

  let title = 'Live tape';
  let subtitle = numbersActive
    ? LIVE_TAPE_SUBTITLE_LIVE
    : anyLatchHeld
      ? LIVE_TAPE_SUBTITLE_OFFLINE
      : LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY;
  let info =
    'Live-derived reads off the trade tape + quote stream. These pause on a stream drop; the levels below stay current.';
  let netFlowLabel = `Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`;
  let netFlowInfo =
    'Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid.';
  // (v2) The label names the DERIVATION, not the connection state (criterion 18). The old ternary
  // made the label byte-identical to the ladder's `Gamma flip` row on a drop, while the two cells
  // hold two different numbers — and the caption slot cannot carry the distinction, because
  // `FigureCell.tsx:251,260,269` OVERWRITES `effectiveCaption` to `offline · last known` / `offline`
  // in the offline arms, discarding sub-copy on exactly the drop where it is most needed. Both arms
  // name a derivation and neither changes with connection state — `· live` holds through live *and*
  // drop; the only switch is live-stream vs session-tape derivation.
  let gammaLabel = 'Gamma flip · live';

  if (st) {
    title = SESSION_TAPE_TITLE;
    info = SESSION_TAPE_INFO;
    gammaLabel = 'Gamma flip · session tape';
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
        {/* Net flow — the latch owns BOTH the rendered value and `retained` (SPEC §2.2), same
            discipline as gamma flip below. `live` is keyed on the RAW STREAM presence
            (`netFlowStream`), never the latched render value — a dot keyed on the latched value
            would claim the stream for a retained-but-stale number. */}
        <FigureCell
          register="traced"
          label={netFlowLabel}
          value={
            netFlowLatch.value != null
              ? `${netFlowLatch.value >= 0 ? '+' : ''}${netFlowLatch.value.toLocaleString()}`
              : '—'
          }
          live={andPresent(isDeliveringLiveNow, netFlowStream)}
          offline={tileOffline ? { retained: netFlowLatch.retained } : null}
          replay={replayFigure}
          flash={netFlowFlash}
          info={netFlowInfo}
        />
        {/* Spread — same latch discipline as Net flow / Gamma flip above. */}
        <FigureCell
          register="traced"
          label="Spread"
          value={spreadLatch.value != null ? `$${spreadLatch.value.toFixed(2)}` : '—'}
          live={andPresent(isDeliveringLiveNow, spreadStream)}
          offline={tileOffline ? { retained: spreadLatch.retained } : null}
          replay={replayFigure}
          flash={spreadFlash}
          info="Best ask minus best bid. Wider = a thinner, more volatile market."
        />
        {/* Gamma flip — the latch owns BOTH halves (SPEC §2.2, criterion 14). `live` is keyed on the
            RAW STREAM presence (`live?.gamma_flip`), deliberately NOT `flipValue != null` — a dot
            keyed on the rendered (possibly latched) value would claim the stream for a retained
            number. Neither the value nor the boolean reads `m.gamma_flip` — that fallback produced
            criterion 14's violation and is not adopted here. */}
        <FigureCell
          register="traced"
          label={gammaLabel}
          value={flipValue != null ? `$${flipValue}` : '—'}
          live={andPresent(isDeliveringLiveNow, live?.gamma_flip)}
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
          live={NOT_LIVE}
          info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference."
        />
      </Box>
    </Widget>
  );
}

export default LiveTape;
