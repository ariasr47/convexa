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
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useRef, useState } from 'react';
import { ConnectionChip } from '../../connection/ConnectionChip';
import { connectionStateFor } from '../../connection/connectionState';
import { LivenessAnnouncer } from '../../connection/LivenessAnnouncer';
import type { SessionTapeOccupancy } from '../../sessionTapeStanding';
import { QuickSymbols } from './QuickSymbols';
import { TickerHeader } from './TickerHeader';
import { TickerToolbar } from './TickerToolbar';

/** Shared with Widget frames — one elevation/radius language for deck ↔ board. */
const DECK_RADIUS = '12px';

interface CommandDeckProps {
  // Hero (TickerHeader) inputs.
  m: MarketState;
  sig: Signals | undefined;
  live: LiveUpdate | null;
  /** Genuine paid-live (fills / pulses). */
  isLive: boolean;
  /** Session-tape headline/tape numbers may follow mid. */
  displayActive?: boolean;
  streamOffline: boolean;
  lastSessionPhase?: SessionTapeOccupancy['phase'] | null;
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
  /** Ticker fidelity repair, change 3 (F3) — the quick row's trailing `Universe member · N tracked
   *  names` note (`useUniverseMembership`'s `size`, pre-formatted by the caller); `null` for a
   *  nonmember/unknown symbol or before the universe read resolves (no invented count). */
  universeMemberNote?: string | null;
}

/** The slim condensed bar shown once the deck has scrolled out of view — restores mark · ticker ·
 *  $price · connection while the trader is deep in the board. Live-correct (freezes on a drop). */
function StickyCondensed({
  m,
  live,
  isLive,
  displayActive,
  streamOffline,
  lastSessionPhase,
  selected,
  reduced,
}: {
  m: MarketState;
  live: LiveUpdate | null;
  isLive: boolean;
  displayActive: boolean;
  streamOffline: boolean;
  lastSessionPhase: SessionTapeOccupancy['phase'] | null;
  selected: string[] | null;
  reduced: boolean;
}) {
  const connState = connectionStateFor({
    live,
    streamOffline,
    routeSymbol: m.ticker,
    lastSessionPhase,
  });
  const numbersActive = displayActive || isLive;
  const price = (numbersActive && live ? live.mid : m.price)?.toFixed(2);
  const expLabel =
    selected === null
      ? 'All expirations'
      : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`;
  return (
    <Box
      data-testid="deck-sticky"
      sx={(t) => ({
        // `position: sticky` lives on the PARENT (`deck-sticky-reveal`) now — see its comment.
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
      <ConnectionChip state={connState} live={live} routeSymbol={m.ticker} reduced={reduced} />
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
    displayActive = false,
    streamOffline,
    lastSessionPhase = null,
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
    universeMemberNote,
  } = props;

  const reduced = useReducedMotion();
  const theme = useTheme();
  // PASS 2 change 9 — the masthead's controls join the headline row at ≥ laptop (1100), the SAME
  // breakpoint authority `TickerHeader.tsx`'s own `xs: column / sm: row` hero-row switch already
  // uses (`theme.breakpoints`), generalized to the next named token up (`theme.ts`'s `laptop: 1100`
  // — the same token `TickerDashboard.tsx`'s context-band grid already keys off). Below 1100, keep
  // today's stacked order (tier 1 → tier 2 → tier 3) unchanged. `useMediaQuery` degrades to `false`
  // when `window.matchMedia` is absent (jsdom, most unit tests — `ai-rec/ReadSheet.tsx`'s own
  // established idiom for this exact kind of width-driven placement switch) — every pre-existing
  // CommandDeck/TickerHeader test keeps exercising the below-1100 (today's) arrangement unless it
  // explicitly stubs `matchMedia`.
  const controlsJoinHeadline = useMediaQuery(theme.breakpoints.up('laptop'));
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

  const connState = connectionStateFor({
    live,
    streamOffline,
    routeSymbol: m.ticker,
    lastSessionPhase,
  });

  // PASS 2 change 9 — ONE `TickerToolbar` element; its `inline` prop and its MOUNT POINT below are
  // both keyed off `controlsJoinHeadline`, so it is never mounted twice (no duplicate ids/testids)
  // — exactly one of the two slots (inside `TickerHeader`, or tier 2 on its own) ever renders it.
  const toolbar = (
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
      inline={controlsJoinHeadline}
    />
  );

  return (
    <>
      {/* The ONE page-scoped `aria-live` region (SPEC §2.4) — mounted ONCE and ALWAYS, above BOTH
          chip renderers below, so it never announces twice while `condensed` keeps both mounted,
          and its EMPTY initial mount (text arrives via a later state update) is what makes the
          announcement fire reliably. Neither chip renderer owns its own region. */}
      <LivenessAnnouncer state={connState} live={live} />

      {/* The condensed bar lives above the deck so it pins to the top of the scroll container. It is
          revealed (opacity/height) only after the deck scrolls past; reduced-motion → instant.
          `position: sticky` lives HERE, not on `StickyCondensed`'s own root, on purpose: a sticky
          element can never render outside its CONTAINING BLOCK's own box (MDN "position: sticky" —
          "confined to its containing block"). This wrapper's containing block is the tall,
          page-length `<Box>` `TickerDashboard.tsx` renders it inside (deck + the full widget bento
          board) — plenty of room for the sticky range to span the whole scroll. Its OLD home (the
          inner `deck-sticky` Box, still just below) sits inside a wrapper whose OWN unstuck box is
          at most ~64px tall once condensed, positioned right above the (much taller) deck — by the
          time a real scroll had gone far enough for the hand-off sentinel to fire, that ~64px box
          had already scrolled fully out of view, so the "sticky" child had no containing block left
          to render within and silently rendered off-screen at its stale in-flow position — a real,
          measured defect (curvature-v2-foundations AC-1a; confirmed via a live-browser geometry probe,
          not asserted). */}
      <Box
        aria-hidden={!condensed}
        data-testid="deck-sticky-reveal"
        data-reduced={reduced ? 'true' : 'false'}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
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
            displayActive={displayActive}
            streamOffline={streamOffline}
            lastSessionPhase={lastSessionPhase}
            selected={selected}
            reduced={reduced}
          />
        )}
      </Box>

      {/* Deck surface — ticker fidelity repair, change 3 (F3): the masthead is BARE ON THE INK
          (`design/src/screens/desk.mjs:255-288`'s `.mast`), not a raised panel — no border, no
          paper fill, no elevation, no radius (that chrome used to make it 273px tall on its own,
          `FIDELITY_AUDIT.md` F3). Vertical padding only (matches `.mast`'s own 20px/12px); the
          outer page `Container` already supplies the horizontal gutter every other section on this
          page shares, so this deck adds no horizontal padding of its own. `StickyCondensed` above
          keeps its OWN raised-panel treatment on purpose — it is a pinned overlay, not the masthead. */}
      <Box
        data-testid="command-deck"
        sx={{
          position: 'relative',
          mb: 1.5,
          pt: 2.5,
          pb: 1.5,
        }}
      >
        {/* Ticker fidelity repair, change 3 (F3) close-out: `spacing={2}` (16px) between all three
            tiers — 32px of pure gap — was sized for THIS masthead's own visual grouping, not the
            design's (`.mast-row` merges tier 1+2 into one row, `desk.mjs:256-274`, so the design has
            only ONE such gap, before `.quick`). Tightened, not removed — the tiers stay three
            visually distinct groups. */}
        <Stack spacing={1.5}>
          {/* Tier 1 — hero identity row (regime + connection chips, anchor, meta line, controls +
              CTA at ≥ laptop — PASS 2 change 9 — CTA alone below it). */}
          <TickerHeader
            m={m}
            sig={sig}
            live={live}
            isLive={isLive}
            displayActive={displayActive}
            streamOffline={streamOffline}
            lastSessionPhase={lastSessionPhase}
            selected={selected}
            onOpenTrade={onOpenTrade}
            storeFaulted={storeFaulted}
            tradeAllowed={tradeAllowed}
            onSignIn={onSignIn}
            freshness={freshness}
            singleNameCaveat={singleNameCaveat}
            inlineControls={controlsJoinHeadline ? toolbar : null}
          />

          {/* Tier 2 — the segmented control strip (one instrument panel), below 1100 only; at
              ≥ laptop the SAME `toolbar` element (see above `const`) renders inside `TickerHeader`
              instead — never both, `controlsJoinHeadline` gates each slot exclusively. */}
          {!controlsJoinHeadline && toolbar}

          {/* Tier 3 — Quick symbols row (pins + durable recents). Not on sticky bar. */}
          <QuickSymbols
            currentSymbol={routeSymbol}
            onSelect={onSelectQuickSymbol}
            note={universeMemberNote}
          />
        </Stack>
      </Box>

      {/* Sentinel just below the deck — when it leaves the viewport the condensed bar reveals. */}
      <Box ref={sentinelRef} aria-hidden data-testid="deck-handoff" sx={{ height: 1 }} />
    </>
  );
}

export default CommandDeck;

export type { CommandDeckProps };
