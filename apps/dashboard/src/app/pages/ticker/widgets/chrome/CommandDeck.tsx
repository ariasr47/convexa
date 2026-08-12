/**
 * CommandDeck — the Ticker page's unified **command deck** (ticker-command-deck plan). It replaces the
 * three chrome-less top zones (`TickerToolbar` + `TickerHeader` + `FreshnessLine`) with ONE deliberate
 * chrome panel that anchors the widget board below it. It is CHROME, not a widget — no drag/expand/
 * selection; it sits ABOVE the `WidgetSelectionProvider` board.
 *
 * Structure:
 *   1. Deck surface — paper + neutral top sheen + `elevationFor.e1` (same ladder as Widget frames).
 *      12px radius (matches widgets). Stage-3 §4.1: no amber wash on full-width chrome.
 *   2. Hero identity row (tier 1) — regime + connection chip, `TICKER · $price`, meta, CTA.
 *   3. Control strip (tier 2) — segmented `TickerToolbar`.
 *   4. Board hand-off — tight spacing only (no divider-fog gradient; elevation + gap carry the seam).
 *   5. Sticky condensed bar — pins after scroll-out; same e1/e2 material language.
 *
 * `[live-vs-static-isolation]`: sticky price + connection chip share hero inputs via `connectionChip`.
 */
import type { usePersona } from '@/features/personas/usePersona';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { elevationFor } from '@/shared/theme/tokens';
import type { Expiration, LiveUpdate, MarketState, Signals } from '@convexa/api';
import { Box, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { QuickSymbols } from './QuickSymbols';
import { TintChip as StatusChip, TickerHeader, connectionChip } from './TickerHeader';
import { TickerToolbar } from './TickerToolbar';

/** Shared with Widget frames — one elevation/radius language for deck ↔ board. */
const DECK_RADIUS = '12px';

interface CommandDeckProps {
  // Hero (TickerHeader) inputs.
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  selected: string[] | null;
  onOpenTrade: () => void;
  /** The durable positions store is faulted — refuses this CTA (AC-69). */
  storeFaulted?: boolean;
  /** Signed-out honesty: false → Refused UI instead of a live-looking sim CTA. */
  tradeAllowed?: boolean;
  onSignIn?: () => void;
  freshness: { snapshotIso: string | null; dataAgeSeconds: number | null; refreshing: boolean };
  /** index-first-defaults AC-4 — forwarded to the deck hero (`TickerHeader`): the single-name
   *  honesty caption. True ONLY for a confirmed non-universe symbol (AC-5). */
  singleNameCaveat?: boolean;
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
  /**
   * Route ticker (URL param) — drives Quick chip selected state (AC-4).
   * Distinct from `symbol` (the uncommitted input field).
   */
  routeSymbol: string;
  /** Chip click — parent navigates + syncs input (same path as submit). */
  onSelectQuickSymbol: (symbol: string) => void;
}

/** The slim condensed bar shown once the deck has scrolled out of view — restores mark · ticker ·
 *  $price · connection while the trader is deep in the board. Live-correct (freezes on a drop). */
function StickyCondensed({
  m,
  live,
  isLive,
  streamOffline,
  selected,
  reduced,
}: {
  m: MarketState;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
  selected: string[] | null;
  reduced: boolean;
}) {
  const conn = connectionChip(live, streamOffline, reduced);
  const price = (isLive && live ? live.mid : m.price)?.toFixed(2);
  const expLabel =
    selected === null
      ? 'All expirations'
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
        borderRadius: DECK_RADIUS,
        border: `1px solid ${t.palette.divider}`,
        // Same material ladder as the full deck + widgets (e2 while pinned above content).
        backgroundColor: t.palette.background.paper,
        backgroundImage:
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 70%)'
            : 'none',
        boxShadow: elevationFor(t).e2,
        backdropFilter: 'saturate(1.1) blur(6px)',
      })}
    >
      {/* `component="p"` (stage-3 §5.6): `TICKER · $price` is a DATA VALUE, not document
          structure — MUI subtitle2 defaults to <h6>; the page's one heading anchor is the hero h1. */}
      <Typography
        variant="subtitle2"
        component="p"
        sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', m: 0 }}
      >
        {m.ticker} · ${price}
      </Typography>
      {conn && (
        <StatusChip
          tone={conn.tone}
          label={conn.text}
          tip={conn.tip}
          dot={conn.dot}
          pulse={conn.pulse}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          ml: 'auto',
          whiteSpace: 'nowrap',
          display: { xs: 'none', sm: 'block' },
        }}
      >
        {expLabel}
      </Typography>
    </Box>
  );
}

export function CommandDeck(props: CommandDeckProps) {
  const {
    m,
    sig,
    live,
    isLive,
    streamOffline,
    selected,
    onOpenTrade,
    storeFaulted,
    tradeAllowed = true,
    onSignIn,
    freshness,
    singleNameCaveat,
    symbol,
    onSymbolChange,
    onSubmitSymbol,
    expirations,
    allDates,
    checked,
    onSelectExpirations,
    persona,
    onOpenCustomize,
    loading,
    routeSymbol,
    onSelectQuickSymbol,
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
    const io = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), {
      threshold: 0,
    });
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
            m={m}
            live={live}
            isLive={isLive}
            streamOffline={streamOffline}
            selected={selected}
            reduced={reduced}
          />
        )}
      </Box>

      {/* Deck surface — same elevation ladder + radius as Widget frames (NOT a third shadow dialect). */}
      <Box
        data-testid="command-deck"
        sx={(t) => ({
          position: 'relative',
          borderRadius: DECK_RADIUS,
          border: `1px solid ${t.palette.divider}`,
          // Stage-3 §4.1: neutral top sheen only (no amber wash). Light mode needs no sheen.
          backgroundColor: t.palette.background.paper,
          backgroundImage:
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 42%)'
              : 'none',
          boxShadow: elevationFor(t).e1,
          // Tight hand-off into the board: elevation + this margin only (no divider-fog gradient).
          mb: 1.5,
          p: { xs: 2, sm: 2.5 },
        })}
      >
        <Stack spacing={2}>
          {/* Tier 1 — hero identity row (regime + connection chips, anchor, meta line, CTA). */}
          <TickerHeader
            m={m}
            sig={sig}
            live={live}
            isLive={isLive}
            streamOffline={streamOffline}
            selected={selected}
            onOpenTrade={onOpenTrade}
            storeFaulted={storeFaulted}
            tradeAllowed={tradeAllowed}
            onSignIn={onSignIn}
            freshness={freshness}
            singleNameCaveat={singleNameCaveat}
          />

          {/* Tier 2 — the segmented control strip (one instrument panel). */}
          <TickerToolbar
            symbol={symbol}
            onSymbolChange={onSymbolChange}
            onSubmitSymbol={onSubmitSymbol}
            expirations={expirations}
            allDates={allDates}
            selected={selected}
            checked={checked}
            onSelectExpirations={onSelectExpirations}
            persona={persona}
            onOpenCustomize={onOpenCustomize}
            loading={loading}
            embedded
          />

          {/* Tier 3 — Quick symbols row (pins + durable recents). Not on sticky bar. */}
          <QuickSymbols currentSymbol={routeSymbol} onSelect={onSelectQuickSymbol} />
        </Stack>
      </Box>

      {/* Sentinel just below the deck — when it leaves the viewport the condensed bar reveals. */}
      <Box ref={sentinelRef} aria-hidden data-testid="deck-handoff" sx={{ height: 1 }} />
    </>
  );
}

export default CommandDeck;

export type { CommandDeckProps };
