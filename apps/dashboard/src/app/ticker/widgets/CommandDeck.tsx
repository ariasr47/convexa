/**
 * CommandDeck — the Ticker page's unified **command deck** (ticker-command-deck plan). It replaces the
 * three chrome-less top zones (`TickerToolbar` + `TickerHeader` + `FreshnessLine`) with ONE deliberate
 * chrome panel that anchors the widget board below it and flows into it. It is CHROME, not a widget —
 * no drag/expand/selection; it sits ABOVE the `WidgetSelectionProvider` board.
 *
 * Structure:
 *   1. Deck surface — a subtle top-lit panel: a faint `primary`-tint → transparent gradient, a 1px
 *      `divider` hairline, 16px radius, a soft inset top highlight. Token-only (color-mix off
 *      `--mui-palette-*` + neutral rgba light/shadow — ZERO hardcoded hex).
 *   2. Hero identity row (tier 1) — the regime + single connection chip, the big `TICKER · $price`
 *      anchor + muted levels sub-line, the meta line (last-trade + relocated freshness), and the
 *      right-aligned `+ Open simulated trade` CTA. (Delegated to `TickerHeader`, now the deck hero.)
 *   3. Control strip (tier 2) — the segmented `TickerToolbar` (one instrument panel).
 *   4. Hand-off — a short downward `primary`-tint gradient below the deck so it leads into the first
 *      widget; the chrome↔board seam is gone.
 *   5. Sticky condensed bar — as the deck scrolls out, a slim pinned bar shows mark · ticker · $price ·
 *      connection chip · a compact Expirations/Persona, restoring context. Progressive +
 *      `prefers-reduced-motion`-aware (no motion → it simply pins, no transition).
 *
 * `[live-vs-static-isolation]`: the sticky bar's price + connection chip derive from the SAME
 * `isLive`/`streamOffline`/`live` inputs as the hero (via `connectionChip`), so they freeze/dim on an
 * SSE drop and NEVER show a stale "live".
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { Expiration, LiveUpdate, MarketState, Signals } from '@org/api';
import type { usePersona } from '../../personas/usePersona';
import { TickerToolbar } from './TickerToolbar';
import { TickerHeader, TintChip as StatusChip, connectionChip } from './TickerHeader';
import { useReducedMotion } from './useReducedMotion';

interface CommandDeckProps {
  // Hero (TickerHeader) inputs.
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  selected: string[] | null;
  onOpenTrade: () => void;
  freshness: { snapshotIso: string | null; dataAgeSeconds: number | null; refreshing: boolean };
  // Control strip (TickerToolbar) inputs.
  symbol: string;
  onSymbolChange: (v: string) => void;
  onSubmitSymbol: () => void;
  expirations: Expiration[];
  allDates: string[];
  checked: string[];
  onSelectExpirations: (v: string[] | null) => void;
  persona: ReturnType<typeof usePersona>;
  onOpenCustomize: () => void;
  loading: boolean;
}

/** The slim condensed bar shown once the deck has scrolled out of view — restores mark · ticker ·
 *  $price · connection while the trader is deep in the board. Live-correct (freezes on a drop). */
function StickyCondensed({
  m, live, isLive, streamOffline, selected, reduced,
}: {
  m: MarketState; live: LiveUpdate | null; isLive: boolean; streamOffline: boolean;
  selected: string[] | null; reduced: boolean;
}) {
  const conn = connectionChip(live, streamOffline, reduced);
  const price = (isLive ? live!.mid : m.price)?.toFixed(2);
  const expLabel = selected === null ? 'All expirations'
    : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`;
  return (
    <Box
      data-testid="deck-sticky"
      sx={(t) => ({
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 2,
        py: 1,
        mb: 1,
        borderRadius: '12px',
        border: `1px solid ${t.palette.divider}`,
        // Same deck material, denser: a faint primary top-light over the paper, token-bound.
        // Mode-aware chrome: the white sheen + deep shadow are dark-scheme idioms.
        backgroundColor: `color-mix(in srgb, ${t.palette.background.paper} 88%, ${t.palette.primary.main} 4%)`,
        backgroundImage:
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 70%)'
            : 'none',
        boxShadow:
          t.palette.mode === 'dark'
            ? '0 2px 8px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 2px 8px -4px rgba(16,24,40,0.18)',
        backdropFilter: 'saturate(1.1) blur(6px)',
      })}
    >
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {m.ticker} · ${price}
      </Typography>
      {conn && (
        <StatusChip tone={conn.tone} label={conn.text} tip={conn.tip} dot={conn.dot} pulse={conn.pulse} />
      )}
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', ml: 'auto', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}
      >
        {expLabel}
      </Typography>
    </Box>
  );
}

export function CommandDeck(props: CommandDeckProps) {
  const {
    m, sig, live, isLive, streamOffline, selected, onOpenTrade, freshness,
    symbol, onSymbolChange, onSubmitSymbol, expirations, allDates, checked,
    onSelectExpirations, persona, onOpenCustomize, loading,
  } = props;

  const reduced = useReducedMotion();
  // Reveal the condensed bar only once the full deck has scrolled out of view. IntersectionObserver is
  // the progressive toggle; when unavailable (older/jsdom) OR reduced-motion, the bar simply never
  // fades — it just pins when present. We keep it MOUNTED-but-hidden vs unmounted to avoid layout jump.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* The condensed bar lives above the deck so it pins to the top of the scroll container. It is
          revealed (opacity/height) only after the deck scrolls past; reduced-motion → instant. */}
      <Box
        aria-hidden={!condensed}
        data-testid="deck-sticky-reveal"
        data-reduced={reduced ? 'true' : 'false'}
        sx={{
          overflow: 'hidden',
          maxHeight: condensed ? 64 : 0,
          opacity: condensed ? 1 : 0,
          pointerEvents: condensed ? 'auto' : 'none',
          transition: reduced ? 'none' : 'max-height 220ms ease, opacity 220ms ease',
        }}
      >
        {/* Rendered ONLY when condensed — so the deck hero's single connection chip is never duplicated
            in the DOM while the deck itself is on screen (`[single connection chip]`). */}
        {condensed && (
          <StickyCondensed
            m={m} live={live} isLive={isLive} streamOffline={streamOffline} selected={selected} reduced={reduced}
          />
        )}
      </Box>

      {/* The deck surface — subtle top-lit chrome panel (NOT a widget frame). Token-only tints. */}
      <Box
        data-testid="command-deck"
        sx={(t) => ({
          position: 'relative',
          borderRadius: '16px',
          border: `1px solid ${t.palette.divider}`,
          // Faint primary top-light fading to transparent → the "lit deck" look; token-bound color-mix.
          backgroundColor: `color-mix(in srgb, ${t.palette.background.paper} 82%, ${t.palette.primary.main} 5%)`,
          backgroundImage:
            `linear-gradient(180deg, color-mix(in srgb, ${t.palette.primary.main} 9%, transparent), transparent 42%)`,
          boxShadow:
            t.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.3)'
              : '0 1px 2px rgba(16,24,40,0.08)',
          p: { xs: 2, sm: 2.5 },
        })}
      >
        <Stack spacing={2}>
          {/* Tier 1 — hero identity row (regime + connection chips, anchor, meta line, CTA). */}
          <TickerHeader
            m={m} sig={sig} live={live} isLive={isLive} streamOffline={streamOffline} selected={selected}
            onOpenTrade={onOpenTrade} freshness={freshness}
          />

          {/* Tier 2 — the segmented control strip (one instrument panel). */}
          <TickerToolbar
            symbol={symbol} onSymbolChange={onSymbolChange} onSubmitSymbol={onSubmitSymbol}
            expirations={expirations} allDates={allDates} selected={selected}
            checked={checked} onSelectExpirations={onSelectExpirations}
            persona={persona} onOpenCustomize={onOpenCustomize} loading={loading}
          />
        </Stack>
      </Box>

      {/* Hand-off — a short downward primary-tint gradient below the deck so the chrome leads visually
          into the first widget; the seam between chrome and board disappears. Purely decorative. */}
      <Box
        aria-hidden
        data-testid="deck-handoff"
        sx={(t) => ({
          height: 24,
          mt: -0.5,
          mb: 1,
          background:
            `linear-gradient(180deg, color-mix(in srgb, ${t.palette.primary.main} 6%, transparent), transparent)`,
          pointerEvents: 'none',
        })}
      />

      {/* Sentinel just below the deck — when it leaves the viewport the condensed bar reveals. */}
      <Box ref={sentinelRef} aria-hidden sx={{ height: 1, mt: -1 }} />
    </>
  );
}

export default CommandDeck;

export type { CommandDeckProps };
