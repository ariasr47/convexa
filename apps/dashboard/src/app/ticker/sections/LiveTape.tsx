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
import { Box } from '@mui/material';
import type { LiveUpdate, MarketState } from '@org/api';
import { StatTile } from './StatTile';
import { useFlashOnChange } from './useFlashOnChange';
import { Widget } from './Widget';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 } as const;

interface Props {
  m: MarketState;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
}

export function LiveTape({ m, live, isLive, streamOffline }: Props) {
  // Live value-flash on SSE updates — ONLY while genuinely live (frozen on an SSE drop, never a stale
  // flash) `[live-vs-static-isolation]`. VWAP is a static bundle field (no offline, no flash).
  const active = isLive && !streamOffline;
  const netFlowFlash = useFlashOnChange(isLive ? live!.net_flow : null, { active });
  const spreadFlash = useFlashOnChange(isLive ? live?.spread ?? null : null, { active, tone: 'neutral' });
  const flipFlash = useFlashOnChange(isLive ? live?.gamma_flip ?? null : null, { active });
  return (
    <Widget
      id="live-tape" title="Live tape" live={active}
      info="Live-derived reads off the trade tape + quote stream. These pause on a stream drop; the levels below stay current."
      span={2} bodyVariant="inset"
    >
      <Box sx={GRID} data-testid="live-tape">
      <StatTile
        label={`Net flow (${live ? Math.round(live.flow_window_s / 60) : 5}m)`}
        value={isLive ? `${live!.net_flow >= 0 ? '+' : ''}${live!.net_flow.toLocaleString()}` : '—'}
        accent={!isLive ? 'neutral' : live!.net_flow >= 0 ? 'up' : 'down'}
        offline={streamOffline} flash={netFlowFlash}
        info="Aggressive buys minus sells over the last few minutes, from the live trade tape. Positive = buyers lifting the ask; negative = sellers hitting the bid." />
      <StatTile label="Spread" value={isLive && live?.spread != null ? `$${live.spread.toFixed(2)}` : '—'} accent="neutral"
        offline={streamOffline} flash={spreadFlash}
        info="Best ask minus best bid. Wider = a thinner, more volatile market." />
      <StatTile
        label={isLive ? 'Gamma flip (live)' : 'Gamma flip'}
        value={`$${(isLive ? live?.gamma_flip : null) ?? m.gamma_flip}`} accent="neutral"
        offline={streamOffline} flash={flipFlash}
        info="The price where dealer hedging switches from calming moves to amplifying them. Above it → steadier/range-bound; below it → more volatile/trending." />
      <StatTile label="VWAP" value={m.vwap != null ? `$${m.vwap.toFixed(2)}` : '—'} accent="neutral"
        info="Volume-weighted average price for the session — a common intraday fair-value / mean-reversion reference." />
      </Box>
    </Widget>
  );
}

export default LiveTape;
