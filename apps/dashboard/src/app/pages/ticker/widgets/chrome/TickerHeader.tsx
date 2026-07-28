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
import { Refused, TickerFaultedNotice } from '@/features/trading/positions/FaultedBanner';
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Box, Button, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { LiveUpdate, MarketState, Signals } from '@org/api';
import { LAST_TRADE_TOOLTIP, OFFLINE_CHIP_TOOLTIP } from '../_kit/copy';
import { FreshnessLine } from './FreshnessLine';

const REGIME_TIP =
  'Positive gamma: dealers dampen moves → range-bound, fade extremes. Negative gamma: dealers ' +
  "amplify moves → trending, don't fade.";

/** Tinted status chip (Figma: colored text on a subtle same-color tint). `neutral` = muted grey.
 *  Optional leading `dot` (the ●/○ split out of the label) that **pulses** when `pulse` — the live
 *  breathing indicator (only in the genuine live state; static otherwise + under reduced motion). */
export function TintChip({
  tone,
  label,
  tip,
  dot,
  pulse,
}: {
  tone: 'success' | 'error' | 'info' | 'warning' | 'neutral';
  label: string;
  tip?: string;
  dot?: string;
  pulse?: boolean;
}) {
  const chip = (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 0.5 : 0,
        px: 1,
        py: '3px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        color: tone === 'neutral' ? t.palette.text.secondary : t.palette[tone].main,
        bgcolor:
          tone === 'neutral'
            ? alpha(t.palette.text.secondary, 0.14)
            : alpha(t.palette[tone].main, 0.16),
      })}
    >
      {dot && (
        <Box
          component="span"
          aria-hidden
          sx={
            pulse
              ? {
                  display: 'inline-block',
                  animation: 'liveDotPulse 1.6s ease-in-out infinite',
                  '@keyframes liveDotPulse': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.45, transform: 'scale(1.3)' },
                  },
                }
              : { display: 'inline-block' }
          }
        >
          {dot}
        </Box>
      )}
      {label}
    </Box>
  );
  return tip ? (
    <Tooltip arrow title={tip}>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

// ---- Live last-trade readout (AC-LastTrade-1..5) --------------------------------------------
// LIVE-DERIVED (rides SSE only). Cold → shimmer; default → `● Last trade $X`; live-empty → honest
// empty; offline → `⏸ Last trade $X` dimmed. Never the headline; never freezes a stale value.
export function LastTradeReadout({
  live,
  streamOffline,
}: {
  live: LiveUpdate | null;
  streamOffline: boolean;
}) {
  // Flash the live last-trade on a genuine print (live only; frozen when offline / not live).
  const ltActive = (live?.live ?? false) && !streamOffline;
  const ltFlash = useFlashOnChange(ltActive ? (live?.last_trade ?? null) : null, {
    active: ltActive,
  });
  if (live == null) {
    return (
      <Skeleton
        variant="text"
        width={140}
        data-testid="last-trade-skeleton"
        sx={{ fontSize: '0.875rem' }}
      />
    );
  }
  const lt = live.last_trade;
  if (streamOffline) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography
          component="span"
          variant="body2"
          data-testid="last-trade"
          sx={{ color: 'text.secondary', opacity: 0.5 }}
        >
          {lt != null ? `⏸ Last trade $${lt.toFixed(2)}` : 'Last trade — no recent print'}
        </Typography>
      </Tooltip>
    );
  }
  if (lt == null) {
    return (
      <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
        <Typography
          component="span"
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid="last-trade"
        >
          Last trade — no recent print
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Tooltip arrow title={LAST_TRADE_TOOLTIP}>
      <Typography
        component="span"
        variant="body2"
        sx={[{ color: 'text.secondary' }, flashColorSx(ltFlash)]}
        data-testid="last-trade"
      >
        <Box component="span" sx={{ color: 'info.main' }}>
          ●
        </Box>{' '}
        Last trade ${lt.toFixed(2)}
      </Typography>
    </Tooltip>
  );
}

// Session-aware live status: explains WHY there are (or aren't) live ticks. Stream-DRIVEN — drives
// the header's connection-status chip (NOT a user toggle).
export function liveStatus(
  live: LiveUpdate | null,
): { color: 'info' | 'warning' | 'default'; label: string; tip: string } | null {
  if (!live) return null;
  const last = live.mid != null ? ` · mid $${live.mid.toFixed(2)}` : '';
  if (live.live) {
    const s: Record<string, string> = {
      premarket: 'pre-market',
      regular: 'open',
      afterhours: 'after-hours',
      overnight: 'overnight',
    };
    return {
      color: 'info',
      label: `● live · ${s[live.market_session] ?? live.market_session} · $${live.mid?.toFixed(2)}`,
      tip: `Streaming live ${live.feed} ticks.`,
    };
  }
  if (live.market_session === 'overnight') {
    return {
      color: 'warning',
      label: `○ overnight — no live data${last}`,
      tip: 'Massive covers 4 AM–8 PM ET only; the 8 PM–4 AM overnight session is not provided, so this is the last close. Overnight-capable platforms (e.g. Webull) will show a different, live price.',
    };
  }
  if (live.market_session === 'closed') {
    return {
      color: 'default',
      label: `○ market closed${last}`,
      tip: 'Market is closed (weekend/holiday). Showing the last completed session.',
    };
  }
  return {
    color: 'warning',
    label: `○ no live ticks${last}`,
    tip: 'In a covered session but no ticks are arriving — the feed may be lagging, or it is a market holiday.',
  };
}

/**
 * connectionChip — resolves the SINGLE stream-driven connection chip from `live`/`streamOffline`.
 * The offline warning supersedes the session chip so a stale "live" can never contradict a dropped
 * transport (`[live-vs-static-isolation]`). Shared by the deck hero AND the sticky condensed bar so
 * both reflect the exact same live state. `reduced` gates the live-dot pulse (live only).
 */
export function connectionChip(
  live: LiveUpdate | null,
  streamOffline: boolean,
  reduced: boolean,
): {
  tone: 'info' | 'warning' | 'neutral';
  text: string;
  tip?: string;
  dot?: string;
  pulse: boolean;
} | null {
  const ls = liveStatus(live);
  const label = streamOffline ? '⚠ Live offline — reconnecting…' : (ls?.label ?? null);
  if (!label) return null;
  const tone: 'info' | 'warning' | 'neutral' = streamOffline
    ? 'warning'
    : ls?.color === 'info'
      ? 'info'
      : ls?.color === 'warning'
        ? 'warning'
        : 'neutral';
  const dot = label.startsWith('● ') || label.startsWith('○ ') ? label[0] : undefined;
  const text = dot ? label.slice(2) : label;
  const pulse = dot === '●' && tone === 'info' && !streamOffline && !reduced; // live only
  return { tone, text, tip: streamOffline ? OFFLINE_CHIP_TOOLTIP : ls?.tip, dot, pulse };
}

interface TickerHeaderProps {
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  selected: string[] | null;
  /** Persistent "+ Open simulated trade" CTA, right-aligned in the header (kept out of the analysis flow). */
  onOpenTrade?: () => void;
  /**
   * THE TICKER-PAGE DOOR (SPEC §2.9, §4, AC-69). The faulted state is NOT scoped to `/positions`:
   * this CTA opens the same shared dialog against the same book, so it carries the same refused
   * treatment and its own one-line notice. `aria-disabled` + focusable, never HTML `disabled`.
   */
  storeFaulted?: boolean;
  /** REST-bundle freshness — folded into the deck hero's meta line (relocated `FreshnessLine`). The
   *  freshness reflects the STATIC path only (never live/SSE) — `[live-vs-static-isolation]`. */
  freshness?: { snapshotIso: string | null; dataAgeSeconds: number | null; refreshing: boolean };
}

export function TickerHeader({
  m,
  sig,
  live,
  isLive,
  streamOffline,
  selected,
  onOpenTrade,
  storeFaulted = false,
  freshness,
}: TickerHeaderProps) {
  const reduced = useReducedMotion();
  const conn = connectionChip(live, streamOffline, reduced);
  // Headline price flash on a live NBBO-mid change (live only; inert when static/offline).
  const priceFlash = useFlashOnChange(isLive ? live!.mid : null, {
    active: isLive && !streamOffline,
  });

  return (
    <Box>
      {/* Stage 0 item 1 (the measured 580px offender): the hero row STACKS vertically below `sm` —
          chips/anchor/meta re-stack and the CTA drops under the anchor on its own left-aligned row.
          Nothing is removed; at `sm+` the row layout is unchanged. */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          {/* Status row — regime + the stream-driven connection chip (Figma 149:96). */}
          {(sig?.regime || conn) && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              {sig?.regime && (
                <TintChip
                  tone={sig.regime === 'positive_gamma' ? 'success' : 'error'}
                  label={sig.regime.replace('_', ' ')}
                  tip={REGIME_TIP}
                />
              )}
              {conn && (
                <TintChip
                  tone={conn.tone}
                  label={conn.text}
                  tip={conn.tip}
                  dot={conn.dot}
                  pulse={conn.pulse}
                />
              )}
            </Stack>
          )}

          {/* Headline ANCHOR (NBBO mid when live, else the static price). The last-trade readout below is
            DISPLAY-ONLY and NEVER feeds this anchor (`live-spot=NBBO-mid`, AC-LastTrade-5). Mono figure. */}
          <Typography variant="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.12 }}>
            <Box
              component="span"
              sx={[{ fontVariantNumeric: 'tabular-nums' }, flashColorSx(priceFlash)]}
            >
              {m.ticker} · ${(isLive ? live!.mid : m.price)?.toFixed(2)}
            </Box>
            <Typography
              component="span"
              variant="body2"
              sx={{ color: 'text.secondary', ml: 1.25, fontWeight: 400 }}
            >
              (levels @ ${m.gex_spot?.toFixed(2)} ·{' '}
              {selected === null
                ? 'all expirations'
                : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`}
              )
            </Typography>
          </Typography>

          {/* META line — folds the SECONDARY last-trade readout (AC-LastTrade-4) with the relocated
            REST-bundle freshness ("● Last trade $X · Updated Ns ago"). Both stay subordinate to the h1;
            last-trade degrades WITH the live tiles on a drop, freshness reflects the static path. */}
          <Stack
            direction="row"
            data-testid="deck-meta"
            sx={{ alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25 }}
          >
            <LastTradeReadout live={live} streamOffline={streamOffline} />
            {freshness && (
              <>
                <Typography
                  component="span"
                  variant="body2"
                  aria-hidden
                  sx={{ color: 'text.disabled' }}
                >
                  ·
                </Typography>
                <FreshnessLine
                  snapshotIso={freshness.snapshotIso}
                  dataAgeSeconds={freshness.dataAgeSeconds}
                  refreshing={freshness.refreshing}
                  inline
                />
              </>
            )}
          </Stack>
        </Stack>

        {/* Persistent trade CTA (right-aligned) — primary action kept in the header, out of the
            analysis flow. Opens the shipped simulated-trade entry dialog. */}
        {onOpenTrade && (
          <Stack
            sx={{
              flexShrink: 0,
              // `flex-end` (not `stretch`): without it the notice's width would drag the CTA out
              // into a full-width bar across the header — amber is spent exactly once on this page
              // and a 800px slab of it is not that one spend.
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
              alignSelf: { xs: 'flex-start', sm: 'auto' },
              maxWidth: 460,
            }}
          >
            {storeFaulted && <TickerFaultedNotice />}
            <Refused when={storeFaulted}>
              <Button
                variant="contained"
                size="small"
                onClick={onOpenTrade}
                data-testid="open-sim-trade"
                // At xs the CTA sits under the anchor on its own row (left-aligned, intrinsic width)
                // so its nowrap label can never force the viewport wider. Still THE one entry point
                // to the shared TradeEntryDialog (`[single-shared-sim-entry-dialog]`).
                sx={{ flexShrink: 0, whiteSpace: 'nowrap', mt: 0.5 }}
              >
                + Open simulated trade
              </Button>
            </Refused>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default TickerHeader;
