/**
 * LiveTape — the 5 LIVE-DERIVED StatTiles (Net flow 5m · Spread · Gamma flip (live) · VWAP ·
 * Last trade). These ride the SSE stream, so on a payload-gap drop they **dim + caption `⏸ offline`**
 * ("paused, levels below stay current") — `[live-vs-static-isolation]`. The static DealerPositioning
 * tiles below never receive `offline`.
 *
 * Note: VWAP is a static bundle field but lives in the live row visually (it is intraday/live-feel);
 * it carries NO `offline` (it never dims) — matching the pre-refactor behavior where VWAP had no
 * `offline` prop. Gamma flip (live) shows the static authoritative flip when not live, never a stale
 * live value.
 */
import { useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { Widget } from '@/shared/ui/Widget';
import type { LiveUpdate, MarketState } from '@convexa/api';
import { Box } from '@mui/material';
import { useLiveTape } from '../../liveTapeStore';
import { LIVE_TAPE_SUBTITLE_LIVE, LIVE_TAPE_SUBTITLE_OFFLINE } from '../_kit/copy';
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
  streamOffline?: boolean;
}

export function LiveTape({
  m,
  live: liveProp,
  isLive: isLiveProp,
  streamOffline: offlineProp,
}: Props) {
  const tape = useLiveTape();
  const live = liveProp !== undefined ? liveProp : tape.live;
  const isLive = isLiveProp !== undefined ? isLiveProp : tape.isLive;
  const streamOffline = offlineProp !== undefined ? offlineProp : tape.streamOffline;
  // Live value-flash on SSE updates — ONLY while genuinely live (frozen on an SSE drop, never a stale
  // flash) `[live-vs-static-isolation]`. VWAP is a static bundle field (no offline, no flash).
  const active = isLive && !streamOffline;
  // Narrowed live read: non-null exactly when the stream is genuinely live (isLive ⇒ live != null).
  const netFlow = isLive && live ? live.net_flow : null;
  const netFlowFlash = useFlashOnChange(netFlow, { active });
  const spreadFlash = useFlashOnChange(isLive ? (live?.spread ?? null) : null, {
    active,
    tone: 'neutral',
  });
  const flipFlash = useFlashOnChange(isLive ? (live?.gamma_flip ?? null) : null, { active });
  const flipValue = (isLive ? live?.gamma_flip : null) ?? m.gamma_flip;
  const flipSecondary = distanceToLevel(flipValue, levelSpot(m));
  return (
    <Widget
      id="live-tape"
      title="Live tape"
      live={active}
      // Spine #4: name the basis (stream) and that structure is separate (`[live-vs-static-isolation]`).
      subtitle={active ? LIVE_TAPE_SUBTITLE_LIVE : LIVE_TAPE_SUBTITLE_OFFLINE}
      info="Live-derived reads off the trade tape + quote stream. These pause on a stream drop; the levels below stay current."
      span={2}
      bodyVariant="inset"
    >
      <Box sx={GRID} data-testid="live-tape">
        <StatTile
          label={`Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`}
          value={netFlow != null ? `${netFlow >= 0 ? '+' : ''}${netFlow.toLocaleString()}` : '—'}
          accent={netFlow == null ? 'neutral' : netFlow >= 0 ? 'up' : 'down'}
          offline={streamOffline}
          flash={netFlowFlash}
          info="Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid."
        />
        <StatTile
          label="Spread"
          value={isLive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'}
          accent="neutral"
          offline={streamOffline}
          flash={spreadFlash}
          info="Best ask minus best bid. Wider = a thinner, more volatile market."
        />
        <StatTile
          label={isLive ? 'Gamma flip (live)' : 'Gamma flip'}
          value={`$${flipValue}`}
          accent="neutral"
          offline={streamOffline}
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
