/**
 * TickerHeader — the headline ANCHOR block (Figma `Ticker · Header`, node 149:96): a status-chip row
 * (regime + the stream-driven connection chip), the `TICKER · $price` h1 (NBBO mid when live, else the
 * bundle's static price) with the levels/expiration sub-line, and the display-only **last-trade**
 * readout beneath it.
 *
 * The last-trade is a live-derived sibling that degrades WITH the live tiles on a stream drop; it
 * NEVER feeds the anchor/levels/flip (`live-spot=NBBO-mid`, AC-LastTrade-5).
 *
 * CRITICAL: the connection chip is a **status indicator, NOT a user toggle** — derived from the SSE
 * payload-gap watchdog + the session classifier (`streamOffline` / `liveStatus(live)`). The offline
 * warning supersedes the session chip so a stale "live" can never contradict a dropped transport
 * (`[live-vs-static-isolation]`). The last-trade readout (`data-testid="last-trade"`, its 4 states) is
 * preserved byte-for-byte.
 */
import { Box, Typography, Tooltip, Skeleton, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { LiveUpdate, MarketState, Signals } from '@org/api';
import { LAST_TRADE_TOOLTIP, OFFLINE_CHIP_TOOLTIP } from './copy';

const REGIME_TIP =
  'Positive gamma: dealers dampen moves → range-bound, fade extremes. Negative gamma: dealers ' +
  "amplify moves → trending, don't fade.";

/** Tinted status chip (Figma: colored text on a subtle same-color tint). `neutral` = muted grey. */
function TintChip({ tone, label, tip }:
  { tone: 'success' | 'error' | 'info' | 'warning' | 'neutral'; label: string; tip?: string }) {
  const chip = (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-flex', alignItems: 'center', px: 1, py: '3px', borderRadius: '999px',
        fontSize: 11, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap',
        color: tone === 'neutral' ? t.palette.text.secondary : t.palette[tone].main,
        bgcolor: tone === 'neutral'
          ? alpha(t.palette.text.secondary, 0.14)
          : alpha(t.palette[tone].main, 0.16),
      })}
    >
      {label}
    </Box>
  );
  return tip ? <Tooltip arrow title={tip}>{chip}</Tooltip> : chip;
}

// ---- Live last-trade readout (AC-LastTrade-1..5) --------------------------------------------
// LIVE-DERIVED (rides SSE only). Cold → shimmer; default → `● Last trade $X`; live-empty → honest
// empty; offline → `⏸ Last trade $X` dimmed. Never the headline; never freezes a stale value.
export function LastTradeReadout({ live, streamOffline }:
  { live: LiveUpdate | null; streamOffline: boolean }) {
  if (live == null) {
    return <Skeleton variant="text" width={140} data-testid="last-trade-skeleton" sx={{ fontSize: '0.875rem' }} />;
  }
  const lt = live.last_trade;
  if (streamOffline) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography component="span" variant="body2" data-testid="last-trade"
          sx={{ color: 'text.secondary', opacity: 0.5 }}>
          {lt != null ? `⏸ Last trade $${lt.toFixed(2)}` : 'Last trade — no recent print'}
        </Typography>
      </Tooltip>
    );
  }
  if (lt == null) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }} data-testid="last-trade">
          Last trade — no recent print
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
      <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }} data-testid="last-trade">
        <Box component="span" sx={{ color: 'info.main' }}>●</Box> Last trade ${lt.toFixed(2)}
      </Typography>
    </Tooltip>
  );
}

// Session-aware live status: explains WHY there are (or aren't) live ticks. Stream-DRIVEN — drives
// the header's connection-status chip (NOT a user toggle).
export function liveStatus(live: LiveUpdate | null):
  { color: 'info' | 'warning' | 'default'; label: string; tip: string } | null {
  if (!live) return null;
  const last = live.mid != null ? ` · mid $${live.mid.toFixed(2)}` : '';
  if (live.live) {
    const s: Record<string, string> = { premarket: 'pre-market', regular: 'open',
      afterhours: 'after-hours', overnight: 'overnight' };
    return { color: 'info', label: `● live · ${s[live.market_session] ?? live.market_session} · $${live.mid?.toFixed(2)}`,
      tip: `Streaming live ${live.feed} ticks.` };
  }
  if (live.market_session === 'overnight') {
    return { color: 'warning', label: `○ overnight — no live data${last}`,
      tip: 'Massive covers 4 AM–8 PM ET only; the 8 PM–4 AM overnight session is not provided, so this is the last close. Overnight-capable platforms (e.g. Webull) will show a different, live price.' };
  }
  if (live.market_session === 'closed') {
    return { color: 'default', label: `○ market closed${last}`,
      tip: 'Market is closed (weekend/holiday). Showing the last completed session.' };
  }
  return { color: 'warning', label: `○ no live ticks${last}`,
    tip: 'In a covered session but no ticks are arriving — the feed may be lagging, or it is a market holiday.' };
}

interface TickerHeaderProps {
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  selected: string[] | null;
}

export function TickerHeader({ m, sig, live, isLive, streamOffline, selected }: TickerHeaderProps) {
  const ls = liveStatus(live);
  // Exactly one connection chip — the offline warning supersedes the session chip.
  const connTone: 'info' | 'warning' | 'neutral' = streamOffline ? 'warning'
    : ls?.color === 'info' ? 'info' : ls?.color === 'warning' ? 'warning' : 'neutral';
  const connLabel = streamOffline ? '⚠ Live offline — reconnecting…' : ls?.label ?? null;
  const connTip = streamOffline ? OFFLINE_CHIP_TOOLTIP : ls?.tip;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack spacing={1}>
        {/* Status row — regime + the stream-driven connection chip (Figma 149:96). */}
        {(sig?.regime || connLabel) && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
            {sig?.regime && (
              <TintChip
                tone={sig.regime === 'positive_gamma' ? 'success' : 'error'}
                label={sig.regime.replace('_', ' ')} tip={REGIME_TIP}
              />
            )}
            {connLabel && <TintChip tone={connTone} label={connLabel} tip={connTip} />}
          </Stack>
        )}

        {/* Headline ANCHOR (NBBO mid when live, else the static price). The last-trade readout below is
            DISPLAY-ONLY and NEVER feeds this anchor (`live-spot=NBBO-mid`, AC-LastTrade-5). */}
        <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.12 }}>
          {m.ticker} · ${(isLive ? live!.mid : m.price)?.toFixed(2)}
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1.25, fontWeight: 400 }}>
            (levels @ ${m.gex_spot?.toFixed(2)} · {selected === null ? 'all expirations' : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`})
          </Typography>
        </Typography>

        {/* SECONDARY last-trade line (AC-LastTrade-4) — subordinate to the h1 anchor; degrades WITH the
            live tiles on a stream drop. */}
        <LastTradeReadout live={live} streamOffline={streamOffline} />
      </Stack>
    </Box>
  );
}

export default TickerHeader;
