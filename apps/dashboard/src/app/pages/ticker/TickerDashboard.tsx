/**
 * Ticker viewer — recomposed from reusable section components (convexa-redesign Ticker re-skin +
 * componentize). The monolith's stat-tile grid, headline, toolbar, term-structure card, fresh
 * positioning, off-exchange blocks, setups, and GEX chart are now the `ticker/widgets/*` components
 * (FigureCell (was StatTile, curvature-v2-foundations) · TickerToolbar · TickerHeader · LiveTape ·
 * StructureHeroPanel · ReadStrip (curvature-v2-desk-and-read FE-8: replaces the old dealer
 * positioning widget, now deleted) · GexStrikeProfile · TermStructureCard · FreshPositioning ·
 * OffExchangeBlocks · Setups).
 * This file is the COMPOSITION + data wiring only.
 *
 * Product spine #3 — hierarchy, not equal weight: Structure → Tape & plan → Supporting context.
 *
 * RE-SKIN + COMPONENTIZE, NOT a logic rewrite (FRONTEND_EXECUTION_CONTRACT hard rules): the bundle
 * poll (~60s), the page-scoped SSE subscription + payload-gap watchdog, the AI-rec hook, the
 * ghost-trade/portfolio/persona wiring, the skeleton-first load, the four-metric nullability, and the
 * scoring readout are all UNCHANGED. The connection state is a STREAM-DRIVEN status indicator (NOT a
 * "Connection (demo)" toggle). Invariants honored: `[live-vs-static-isolation]`,
 * `[best-effort-isolated-or-null]`, `[additive-keeps-score-byte-identical]`, `[no-real-order-path]`,
 * `[operator-vs-trader-path-separation]`.
 */
import { useAlerts } from '@/features/alerts/useAlerts';
import { useAuth } from '@/features/auth/AuthContext';
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import { PersonaCustomizeForm } from '@/features/personas/components';
import { usePersona } from '@/features/personas/usePersona';
import {
  TradeEntryDialog,
  type OrderEntrySubmit,
  type TradeEntrySubmit,
} from '@/features/trading/TradeEntryDialog';
import { OrdersWidget } from '@/features/trading/orders/OrdersWidget';
import { useOrderEngine } from '@/features/trading/orders/useOrderEngine';
import { buildOpenPositionsDigest } from '@/features/trading/positions/digest';
import { tickerEvalSubject } from '@/features/trading/positions/evalSubject';
import { allPositions, positionsFaulted } from '@/features/trading/positions/store';
import { usePortfolio, type OpenPositionInput } from '@/features/trading/positions/usePortfolio';
import { AiRecPanel, useReadPersonas } from '@/pages/ticker/widgets/ai-rec/AiRecPanel';
import { CapAnnotation } from '@/pages/ticker/widgets/ai-rec/CapAnnotation';
import { StateExportDrawer } from '@/pages/ticker/widgets/ai-rec/StateExportDrawer';
import { useAiRecommendation } from '@/pages/ticker/widgets/ai-rec/useAiRecommendation';
import { PrimeBanner, tierMeta } from '@/pages/ticker/widgets/opportunity-tier';
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { isDeliveringLive } from '@/shared/liveness/liveClaim';
import { extrasFor } from '@/shared/theme/tokens';
import { OptionRight } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Fade from '@mui/material/Fade';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ComingSoonBox } from '@/shared/ui/ComingSoonBox';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { WidgetChromeProvider, WidgetSelectionProvider } from '@/shared/ui/Widget';
import { useLiveTape } from './liveTapeStore';
import { selectTickerSymbol } from './recentTickers/selectTickerSymbol';
import { recordVisit } from './recentTickers/store';
import { useTickerPageModel } from './useTickerPageModel';
import { useTickerTradeFlows } from './useTickerTradeFlows';
import {
  DealerFlowProjection,
  FreshPositioning,
  GexStrikeProfile,
  IvRank,
  LiveTape,
  MarketContext,
  OffExchangeBlocks,
  PositionBrief,
  Setups,
  StraddleMove,
  TermStructureCard,
} from './widgets';
import { humanAge, StatSkeleton } from './widgets/_kit';
import { CommandDeck, LastTradeReadout, TapePulseStrip, TickerToolbar } from './widgets/chrome';
import { buildReadStrip, ReadStrip } from './widgets/read-strip';
import { StructureHeroPanel } from './widgets/structure-hero';

// The cold-load stat grid: the full tile structure as shimmer (AC-Skel-1).
function StatGridSkeleton() {
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <StatSkeleton key={i} />
      ))}
    </Box>
  );
}

/**
 * Board zone label — visual hierarchy only (product spine #3).
 * Renders as `<p>`, never a heading: widget titles remain the only h2s on the page
 * (`ticker-semantics.spec.tsx`). Full-row span so the two-column bento cannot sandwich
 * a label beside a widget.
 */
function BoardZoneLabel({
  zone,
  first,
  children,
}: {
  zone: 'structure' | 'plan' | 'context';
  first?: boolean;
  children: ReactNode;
}) {
  // First zone sits under the deck — no top rule, quieter type so identity → structure is tight.
  // Later zones keep a soft divider as section breaks.
  return (
    <Typography
      component="p"
      data-testid={`board-zone-${zone}`}
      sx={{
        gridColumn: '1 / -1',
        m: 0,
        mt: first ? 0 : zone === 'context' ? 0.5 : 1,
        pt: first ? 0 : 0.75,
        pb: first ? 0.25 : 0,
        fontSize: '0.7rem', // ≥11px type floor (0.7rem ≈ 11.2)
        fontWeight: first ? 600 : 700,
        letterSpacing: first ? '0.06em' : '0.08em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        opacity: first ? 0.8 : 1,
        borderTop: first ? 'none' : '1px solid',
        borderColor: 'divider',
      }}
    >
      {children}
    </Typography>
  );
}

export function TickerDashboard() {
  // The route always supplies `:ticker`; the fallback is defensive only and tracks the app default
  // (index-first-defaults AC-1: TSLA → SPY everywhere an unset fallback existed).
  const { ticker = 'SPY' } = useParams();
  const navigate = useNavigate();
  // tradeable-rec-inputs (AC-82): read-only, for the entry-time risk-block-presence flag captured
  // onto the decision record. `null` (never a fabricated `false`) when unresolved (anonymous / a
  // faulted settings read) — the SAME source the Settings panel and the rec panel already read.
  const auth = useAuth();
  const riskBlockPresent = auth.settings?.risk_inputs
    ? auth.settings.risk_inputs.state === 'set'
    : null;
  const [symbol, setSymbol] = useState(ticker);
  // Keep input + durable recents aligned with the route param (chip / submit / deep link).
  // While the trader types an uncommitted symbol, `ticker` is unchanged so this does not stomp.
  useEffect(() => {
    const s = (ticker ?? 'SPY').toUpperCase();
    setSymbol(s);
    recordVisit(s);
  }, [ticker]);
  // Expiration filter: null = all (no filter), [] = none selected, else an explicit subset.
  const [selected, setSelected] = useState<string[] | null>(null);
  // Dark-pool (off-exchange) context: fixed ON (the toolbar toggle was removed to match the Figma).
  const darkPool = true;

  // Reset the filter to "all" whenever the ticker changes.
  useEffect(() => {
    setSelected(null);
  }, [ticker]);

  // Persona DTE pre-fill (one-shot, explicit-navigation only) — consumed by the bundle hook.
  const [dtePrefill, setDtePrefill] = useState<{
    min: number;
    max: number;
    persona: string;
  } | null>(null);
  const pendingPrefill = useRef<{ min: number; max: number } | null>(null);
  const takeDtePrefill = useCallback(() => {
    const d = pendingPrefill.current;
    pendingPrefill.current = null;
    return d;
  }, []);

  // Position-context query re-keys the bundle once open legs exist (same as pre-split behavior).
  // Seeded null → first fetch without pos_*; updates after portfolio hydrates.
  const [positionQuery, setPositionQuery] = useState<{
    expiration: string;
    strike: number;
    right: OptionRight;
  } | null>(null);

  // Data plane container — REST + history + membership; SSE lifecycle only (ticks → liveTapeStore).
  const page = useTickerPageModel({
    ticker,
    selected,
    darkPool,
    positionQuery,
    takeDtePrefill,
  });
  // Live tape subscription — portfolio / orders / deck need ticks. Structure widgets are memoized
  // on REST props so they skip re-render when only the tape changes (§3.8 Phase C).
  const { live, streamOffline, isLive, displayActive, lastSessionPhase } = useLiveTape();
  const { data, loading, error, refresh: load } = page.bundle;
  const structHist = page.history;
  const universeMembership = page.universeMembership;
  const structureAgeSeconds = page.structureAgeSeconds;

  // ONE BOOK — same portfolio hook as Positions (AC-72).
  const pf = usePortfolio(ticker, data, live, isLive, streamOffline);
  const evalSel = tickerEvalSubject(pf.positions, ticker);
  useEffect(() => {
    const next = evalSel.queryLeg
      ? {
          expiration: evalSel.queryLeg.expiration ?? '',
          strike: evalSel.queryLeg.strike ?? 0,
          right: (evalSel.queryLeg.right ?? 'call') as OptionRight,
        }
      : null;
    setPositionQuery((prev) => {
      if (
        prev?.expiration === next?.expiration &&
        prev?.strike === next?.strike &&
        prev?.right === next?.right
      ) {
        return prev;
      }
      return next;
    });
  }, [evalSel.queryLeg]);

  const persona = usePersona();

  // AI recommendation (independently-nullable sibling card).
  const { personas: readPersonas } = useReadPersonas(persona.personas);
  const [readPersonaId, setReadPersonaId] = useState('default');
  useEffect(() => {
    setReadPersonaId(persona.activeId);
  }, [persona.activeId]);
  const aiRec = useAiRecommendation(ticker, data, {
    personaId: persona.activeId === 'default' ? null : persona.activeId,
    personaName: persona.active.name,
    dteMin: data?.market_state.dte_min ?? null,
    dteMax: data?.market_state.dte_max ?? null,
    darkPool,
    // tradeable-rec-inputs (F10): read the durable store FRESH at request time (never a stale
    // render-time snapshot) — a faulted store resolves to `unavailable`, never `none_open`.
    openPositions: () =>
      buildOpenPositionsDigest({ ticker, positions: allPositions(), faulted: positionsFaulted() }),
  });
  const [exportDrawer, setExportDrawer] = useState<{ open: boolean; personaId: string | null }>({
    open: false,
    personaId: null,
  });
  const openExport = useCallback(
    (personaId: string | null) => setExportDrawer({ open: true, personaId }),
    [],
  );

  const theme = useTheme();
  // Minimal, surgical fix (curvature-v2-desk-and-read FE-6): `TapePulseStrip` became presentational
  // (SPEC §2.1's second fabrication site removed — it no longer calls `useLiveTape()` itself), so
  // this OLD standalone mount below (`TapePulseStrip structureMid={...}`, pre-FE-11's reading-order
  // rewrite) now computes the SAME claim/mid/palette/surfaces the new `structure-hero/` composition
  // computes, through the SAME canon composers — never a second, hand-rolled expression. This page
  // file is outside `pages/ticker/widgets/**` and was already calling `useLiveTape()` directly
  // (`live`/`isLive`/`streamOffline` above), so it is a legitimate, pre-existing standalone reader,
  // not a new fabrication site.
  const tapePulsePalette = useMemo(() => resolveLevelPalette(theme), [theme]);
  const tapePulseSurfaces = useMemo(
    () => ({
      ink: theme.palette.background.default,
      panel: theme.palette.background.paper,
      raised: extrasFor(theme).panelRaised,
      phosphor: theme.palette.text.primary,
      steel: theme.palette.text.secondary,
      warning: theme.palette.warning.main,
    }),
    [theme],
  );
  const tapePulseClaim = isDeliveringLive(live, streamOffline);
  const tapePulseMid = tapePulseClaim ? (live?.mid ?? null) : null;
  const m = data?.market_state ?? page.marketState;
  const fresh = data?.meta.freshness;
  const sig = data?.signals ?? page.signals;
  // Alerts v1 — evaluate structure snap on each successful REST poll (not SSE).
  const { evaluateSnap } = useAlerts();
  useEffect(() => {
    if (!data || !m) return;
    evaluateSnap({
      symbol: ticker,
      price: m.price ?? null,
      score: sig?.opportunity_score ?? null,
      tier: sig?.opportunity_tier ?? null,
      call_wall: m.call_wall ?? null,
      put_wall: m.put_wall ?? null,
      gamma_flip: m.gamma_flip ?? null,
      as_of: fresh?.data_age_seconds != null ? Date.now() / 1000 : null,
    });
  }, [
    data,
    m,
    sig?.opportunity_score,
    sig?.opportunity_tier,
    m?.price,
    m?.call_wall,
    m?.put_wall,
    m?.gamma_flip,
    ticker,
    evaluateSnap,
    fresh?.data_age_seconds,
  ]);

  // Vol/OI "Fresh positioning": strikes at/above the cutoff, ranked desc, short top-N (full-chain).
  const volOiThreshold = m?.vol_oi_unusual_threshold ?? 1;
  const unusualStrikes = (data?.strike_profile.strikes ?? [])
    .filter((s) => s.vol_oi_ratio != null && s.vol_oi_ratio >= volOiThreshold)
    .toSorted((a, b) => (b.vol_oi_ratio as number) - (a.vol_oi_ratio as number))
    .slice(0, 8);

  const allDates = data?.expirations.map((e) => e.date) ?? [];
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? allDates; // dates shown ticked in the menu
  // Product spine #4 — structure age/basis from page model (REST path only, never SSE).
  const expWindowLabel =
    selected === null
      ? 'all expirations'
      : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`;
  // Product spine #5 — open sim book on THIS ticker for the position brief (between structure & plan).
  const openBookViews = useMemo(
    () =>
      pf.views.filter(
        (v) => v.position.status === 'open' && v.ticker.toUpperCase() === ticker.toUpperCase(),
      ),
    [pf.views, ticker],
  );

  // Synchronous — `localStorage` is synchronous, so this is free, and it is what guarantees the
  // refusal is present on the FIRST paint rather than after an effect (AC-64).
  const storeFaulted = positionsFaulted();
  const tradeOpen = evalSel.position != null;

  // Sim-order engine evaluates THIS ticker's orders off THIS page's stream (arch §5 — no extra ES).
  useOrderEngine({ ticker, bundle: data, live, isLive, streamOffline });

  // Entry / Prime / Act / order confirm — extracted (§3.8 Phase D).
  const {
    orderGate,
    entryOpen,
    setEntryOpen,
    entryPrefill,
    entryRecFingerprint,
    entryError,
    setEntryError,
    showPrimeBanner,
    setShowPrimeBanner,
    openEntry,
    onAcceptRec,
    onActRec,
    actState,
    setActState,
    orderError,
    setOrderError,
    onConfirmOrder,
    GATE_SIGN_IN,
  } = useTickerTradeFlows({
    ticker,
    data,
    live,
    isLive,
    aiRec,
    opportunityTier: sig?.opportunity_tier,
    primeEligible: sig?.prime_prompt_eligible,
    structurePrice: m?.price,
  });
  const strikeList = Array.from(
    new Set((data?.strike_profile.strikes ?? []).map((s) => s.strike)),
  ).toSorted((a, b) => a - b);
  const tm = tierMeta(theme, sig?.opportunity_tier ?? 'dormant');

  // Persona customize dialog (the hand-off viewer was removed to match the Figma toolbar).
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Offer the active persona's DTE preference as a staged pre-fill — ONLY when the user hasn't set an
  // explicit expiration window. Setting it touches no fetch; applied to the next nav via the one-shot.
  useEffect(() => {
    if (selected !== null) {
      setDtePrefill(null);
      return;
    } // user picked expirations → their window wins
    const pref = persona.active.dte_pref;
    setDtePrefill(
      pref ? { min: pref.min_dte, max: pref.max_dte, persona: persona.active.name } : null,
    );
  }, [persona.active, selected]);

  const onSubmitSymbol = () => {
    // Apply the staged DTE pre-fill to THIS explicit navigation only (one-shot).
    if (dtePrefill) pendingPrefill.current = { min: dtePrefill.min, max: dtePrefill.max };
    navigate(`/ticker/${symbol}`);
  };

  const onSelectQuickSymbol = useCallback(
    (s: string) => {
      if (dtePrefill) pendingPrefill.current = { min: dtePrefill.min, max: dtePrefill.max };
      selectTickerSymbol({ symbol: s, navigate, setSymbol });
    },
    [dtePrefill, navigate],
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Whenever the full deck is NOT shown (cold-load / cold-start error / none-selected) the deck
          hero has no market state to anchor, so only the control strip renders standalone — the trader
          can still change ticker/expirations. Once `m` is present AND some expirations are selected,
          the full CommandDeck (hero + strip + sticky) renders in its place, below. */}
      {!(m && !noneSelected) && (
        <Box sx={{ mb: 2 }}>
          <TickerToolbar
            symbol={symbol}
            onSymbolChange={setSymbol}
            onSubmitSymbol={onSubmitSymbol}
            expirations={data?.expirations ?? []}
            allDates={allDates}
            selected={selected}
            checked={checked}
            onSelectExpirations={setSelected}
            persona={persona}
            onOpenCustomize={() => setCustomizeOpen(true)}
            loading={loading}
          />
        </Box>
      )}

      {/* In-context sign-in prompt for a gated Act (D8-6/D10 — the standard gated-write pattern):
          a 403 at confirm aborts the flow with ZERO order stored and surfaces this. */}
      <SignInPrompt
        text={orderGate.promptText}
        onSignIn={() => orderGate.signIn(orderGate.promptText ?? GATE_SIGN_IN)}
        testid="orders-signin-prompt"
      />

      {/* Cold-start failure (no bundle ever loaded) is the ONLY blank/error screen: red error + Retry.
          A poll failure AFTER a prior success keeps the whole bundle on screen behind a soft warning. */}
      {error && !data && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => load({ force: true })}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {error && data && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't refresh — showing data from {humanAge(fresh?.data_age_seconds ?? null)} ago.
          Retrying automatically.
        </Alert>
      )}

      {/* COLD-LOAD skeleton (AC-Skel-1): structure paints as shimmer; the last-trade line fills on the
          first SSE payload, the rest on the REST bundle. Skeleton class never appears post-load. */}
      {!data && !error && !noneSelected && (
        <Box data-testid="cold-load">
          <Box sx={{ mb: 1 }}>
            <Skeleton variant="text" width={280} sx={{ fontSize: '3rem' }} />
            <LastTradeReadout />
          </Box>
          <StatGridSkeleton />
        </Box>
      )}

      {noneSelected && (
        <Alert severity="info">
          No expirations selected — pick one or more above, or click <strong>All</strong>.
        </Alert>
      )}

      {!noneSelected && m && (
        <Fade in appear timeout={250}>
          <Box>
            {showPrimeBanner && !tradeOpen && (
              <PrimeBanner
                allowed={orderGate.allowed}
                onSimulate={() => openEntry()}
                onDismiss={() => setShowPrimeBanner(false)}
                onSignIn={() => orderGate.signIn(GATE_SIGN_IN)}
              />
            )}

            {/* The unified COMMAND DECK — chrome (NOT a widget): the hero identity row (regime +
              connection chips, the anchor, the meta line folding last-trade + the relocated freshness,
              the "+ Open simulated trade" CTA), the segmented control strip, a downward hand-off
              gradient, and a scroll-out sticky condensed bar. Sits above the widget board. */}
            <CommandDeck
              m={m}
              sig={sig}
              live={live}
              isLive={isLive}
              displayActive={displayActive}
              streamOffline={streamOffline}
              lastSessionPhase={lastSessionPhase}
              selected={selected}
              onOpenTrade={() => openEntry()}
              // The faulted state follows the STORE, not the route (SPEC §2.9). Computed
              // synchronously on every render, so no frame paints an enabled CTA on a faulted book.
              storeFaulted={storeFaulted}
              tradeAllowed={orderGate.allowed}
              onSignIn={() => orderGate.signIn(GATE_SIGN_IN)}
              freshness={{
                snapshotIso: fresh?.snapshot_iso ?? null,
                dataAgeSeconds: fresh?.data_age_seconds ?? null,
                refreshing: loading,
              }}
              singleNameCaveat={universeMembership === 'nonmember'}
              symbol={symbol}
              onSymbolChange={setSymbol}
              onSubmitSymbol={onSubmitSymbol}
              expirations={data?.expirations ?? []}
              allDates={allDates}
              checked={checked}
              onSelectExpirations={setSelected}
              persona={persona}
              onOpenCustomize={() => setCustomizeOpen(true)}
              loading={loading}
              routeSymbol={ticker}
              onSelectQuickSymbol={onSelectQuickSymbol}
            />

            {/* Tape Pulse — thin dual-clock strip (structure mid vs live mid). Not a full bento cell. */}
            <TapePulseStrip
              structureMid={m.gex_spot ?? m.price}
              claim={tapePulseClaim}
              mid={tapePulseMid}
              lastTrade={tapePulseClaim && live?.last_trade != null ? live.last_trade : null}
              palette={tapePulsePalette}
              surfaces={tapePulseSurfaces}
            />

            {/* The widget BENTO board — product spine #3: NOT equal weight.
                Reading order matches Scan → Ticker → Plan:
                  1. Structure  — walls / flip / GEX (why this name)
                  2. Tape & plan — live tape, AI read, sim orders (act → watch)
                  3. Context    — supporting advisory reads (never score inputs)
                Zone labels are non-headings (`<p>`) so widget titles stay the only h2s
                (heading-semantics guard). One selection provider; two-column grid; container
                queries still size each cell. Widgets mount AT REST (stage-3 §3.1-1). */}
            <WidgetSelectionProvider>
              <Box
                data-testid="widget-bento"
                sx={{
                  // Deck owns hand-off margin (e1 + mb); keep bento tight so Structure sits close.
                  mt: 0.5,
                  display: 'grid',
                  // `minmax(0, 1fr)` at EVERY breakpoint: a bare `1fr` track is minmax(auto, 1fr),
                  // so one widget's min-content could force the track (and the page) wider than a
                  // 393px viewport — the measured Stage 0 offender. With a 0 floor the widgets'
                  // own responsive internals (auto-fill tile grids, wrapping headers) re-stack.
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                  gridAutoRows: 'minmax(0, auto)',
                  gap: 2,
                  alignItems: 'stretch',
                }}
              >
                {/* ── 1. STRUCTURE (primary) ───────────────────────────────────────── */}
                <BoardZoneLabel zone="structure" first>
                  Structure
                </BoardZoneLabel>

                {/* Minimal, surgical fix (curvature-v2-desk-and-read FE-8, mirroring FE-6's own
                    TapePulseStrip precedent above): the old dealer positioning widget (twelve
                    static tiles + the Field/Magnet toggle) is deleted whole — its twelve cells
                    decompose with zero orphans into `StructureHeroPanel` (walls, max pain via the
                    ladder + ladder foot, the Field/Magnet toggle) and `ReadStrip` (the other seven +
                    opportunity). Mounted HERE, in that widget's own former slot, so the
                    "Call wall" readiness anchor and every re-pointed spec assertion still resolve —
                    this is NOT FE-11's "reading order" rewrite (masthead → hero → strip → AI → quiet
                    band): `GexStrikeProfile`, `PositionBrief` and everything below stay exactly where
                    they were. FE-11 removes this comment when it does that full rewrite (its own
                    Step 1 explicitly supersedes `GexStrikeProfile` with this same `StructureHeroPanel`
                    — the two canvases coexisting between here and FE-11's commit is a KNOWN, NAMED,
                    temporary condition, not a silent regression; see the FE-8 build report. */}
                <ErrorBoundary variant="widget" label="Structure hero">
                  <StructureHeroPanel
                    symbol={ticker}
                    m={m}
                    strikes={data?.strike_profile.strikes ?? []}
                    structureAgeSeconds={structureAgeSeconds}
                    pathSamples={structHist.samples}
                    pathLoading={structHist.loading}
                    pathError={structHist.error}
                    pathBasis={structHist.basis}
                  />
                </ErrorBoundary>
                <ErrorBoundary variant="widget" label="Read strip">
                  <ReadStrip
                    cells={buildReadStrip({
                      m,
                      offExchange: data?.off_exchange,
                      volOiThreshold,
                      unusualCount: unusualStrikes.length,
                      tierWord: tm.word,
                      opportunityScore: sig?.opportunity_score ?? 0,
                      ivRank: m.iv_rank ?? null,
                    })}
                  />
                </ErrorBoundary>

                {/* GEX strike profile — structure centerpiece + embedded session path strip. */}
                {data?.strike_profile && (
                  <ErrorBoundary variant="widget" label="GEX profile">
                    <GexStrikeProfile
                      strikes={data.strike_profile.strikes}
                      spot={m.gex_spot ?? m.price}
                      callWall={m.call_wall}
                      putWall={m.put_wall}
                      gammaFlip={m.gamma_flip}
                      expLabel={expWindowLabel}
                      structureAgeSeconds={structureAgeSeconds}
                      symbol={ticker}
                      pathSamples={structHist.samples}
                      pathLoading={structHist.loading}
                      pathError={structHist.error}
                      pathBasis={structHist.basis}
                    />
                  </ErrorBoundary>
                )}

                {/* Product spine #5 — position brief bridges structure → plan (your book on this name). */}
                <PositionBrief
                  ticker={ticker}
                  openViews={openBookViews}
                  storeFaulted={storeFaulted}
                  entryBlocked={storeFaulted || tradeOpen}
                  onOpenTrade={() => openEntry()}
                  tradeAllowed={orderGate.allowed}
                  onSignIn={() => orderGate.signIn(GATE_SIGN_IN)}
                />

                {/* ── 2. TAPE & PLAN ───────────────────────────────────────────────── */}
                <BoardZoneLabel zone="plan">Tape & plan</BoardZoneLabel>

                {/* LIVE-DERIVED tiles — dim on an SSE drop (span 2). */}
                <ErrorBoundary variant="widget" label="Live tape">
                  <LiveTape m={m} />
                </ErrorBoundary>

                {/* Act → watch as one motion (UX §4.4): AI-rec paired with sim orders. */}
                <AiRecPanel
                  ticker={ticker}
                  bundle={data}
                  ai={aiRec}
                  personas={readPersonas}
                  activePersonaId={persona.activeId}
                  dataAge={fresh ? humanAge(fresh.data_age_seconds) : null}
                  onAccept={onAcceptRec}
                  onAct={onActRec}
                  onViewExport={openExport}
                  readPersonaId={readPersonaId}
                  onChangeReadPersona={setReadPersonaId}
                  fillHeight
                />
                <OrdersWidget ticker={ticker} />

                {/* ── 3. SUPPORTING CONTEXT (tertiary — quieter Widget chrome) ──────── */}
                <BoardZoneLabel zone="context">Supporting context</BoardZoneLabel>

                <WidgetChromeProvider value="quiet">
                  {/* STATIC dealer-flow projection — bound to `m.dealer_flow_projection` only
                    (`[live-vs-static-isolation]`). */}
                  <DealerFlowProjection dfp={m.dealer_flow_projection} />

                  {/* STATIC market context pack — `m.market_context ?? null` only. */}
                  <MarketContext pack={m.market_context ?? null} />

                  {/* Compact pair: IV rank ‖ term structure (both advisory, span 1). Straddle-implied
                      move (tradeable-rec-inputs) lands immediately after IV rank — no twelfth bento
                      widget for one scalar; it is a compact widget in the existing quiet zone. */}
                  <IvRank read={m.iv_rank ?? null} />
                  <StraddleMove move={m.straddle_move} />
                  <TermStructureCard
                    termStructure={m.term_structure}
                    structureAgeSeconds={structureAgeSeconds}
                  />

                  {/* Fresh positioning ‖ Off-exchange blocks. Off-exchange is REST-only; with
                    Dark pool off, Fresh takes the full remaining row. */}
                  <FreshPositioning
                    chainVolOiRatio={m.chain_vol_oi_ratio}
                    volOiThreshold={volOiThreshold}
                    unusualStrikes={unusualStrikes}
                    structureAgeSeconds={structureAgeSeconds}
                  />
                  {darkPool && (
                    <OffExchangeBlocks
                      offExchange={data?.off_exchange}
                      structureAgeSeconds={structureAgeSeconds}
                    />
                  )}

                  <Setups setups={sig?.setups} structureAgeSeconds={structureAgeSeconds} />

                  {/* Inert "+ Add widget" ghost slot — affordance-only (coming soon). */}
                  <Tooltip arrow title="Add widget — coming soon">
                    <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
                      <ComingSoonBox
                        data-testid="add-widget-slot"
                        aria-disabled
                        sx={{
                          cursor: 'not-allowed',
                          minHeight: 64,
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.85,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.disabled', fontWeight: 500 }}
                        >
                          + Add widget
                        </Typography>
                      </ComingSoonBox>
                    </Box>
                  </Tooltip>
                </WidgetChromeProvider>
              </Box>
            </WidgetSelectionProvider>
          </Box>
        </Fade>
      )}

      {/* Entry — the SHARED sim-entry dialog (`trading/TradeEntryDialog`), now writing into the ONE
          book through `usePortfolio.openPosition`. `useGhostTrade` is gone: the Ticker page no
          longer offers a position concept separate from the portfolio (AC-72). The dialog stays
          single-leg here (no `multiLeg`, no `restingLimit`) — that is a variant of the one shared
          dialog, never a fork — so `s.legs` is a one-element array and there is exactly ONE open
          path for one leg and for six. */}
      <TradeEntryDialog
        open={entryOpen && !tradeOpen && !storeFaulted}
        ticker={ticker}
        expirations={allDates}
        strikes={strikeList}
        spot={m?.price ?? 0}
        prefill={entryPrefill}
        capAnnotation={
          entryRecFingerprint && aiRec.rec?.pinned_fingerprint === entryRecFingerprint ? (
            <CapAnnotation capCheck={aiRec.rec.cap_check} />
          ) : undefined
        }
        onClose={() => setEntryOpen(false)}
        onConfirm={(s: TradeEntrySubmit) => {
          // MANUAL and LIMIT both open immediately at the typed price here — this page has no
          // resting-limit lifecycle, which is the shipped single-trade behaviour, so the price rides
          // the leg and the mode stays `manual`. MARKET carries its resolved fill through.
          const typed = s.entryMode === 'limit' ? s.limitPrice : (s.legs[0].price ?? 0);
          const input: OpenPositionInput = {
            legs: [{ ...s.legs[0], ticker, price: typed }],
            entryMode: s.entryMode === 'market' ? 'market' : 'manual',
            ...(s.entryMode === 'market'
              ? { resolvedMark: s.resolvedMark, resolvedBasis: s.resolvedBasis }
              : {}),
            stop: s.stop,
            target: s.target,
            aiRecFingerprint: entryRecFingerprint,
            riskBlockPresent,
          };
          const res = pf.openPosition(input);
          setEntryError(!res.ok && res.reason ? res.reason : null);
          setEntryOpen(false);
        }}
      />

      {/* ai-rec-backtest-orders: the SAME shared dialog in its additive ORDER VARIANT (never a
          fork). A separate instance from the ghost-trade one so Act works even while a ghost trade
          is open; the ghost path above is untouched (AC-47). The already-met notice re-evaluates
          LIVE against the current mid via `orderPlan.liveMid`. */}
      {actState.plan && (
        <TradeEntryDialog
          open={actState.open}
          ticker={ticker}
          expirations={allDates}
          strikes={strikeList}
          spot={m?.price ?? 0}
          prefill={actState.prefill}
          orderPlan={{ ...actState.plan, liveMid: isLive ? (live?.mid ?? null) : null }}
          orderError={orderError}
          onConfirmOrder={(s: OrderEntrySubmit) => {
            void onConfirmOrder(s);
          }}
          onClose={() => {
            setActState({ open: false });
            setOrderError(null);
          }}
          onConfirm={() => {
            /* order variant confirms via onConfirmOrder */
          }}
        />
      )}

      {/* Persona customize — presentation-only, off the compute path. */}
      <PersonaCustomizeForm
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        persona={persona}
      />

      <Snackbar open={!!entryError} autoHideDuration={6000} onClose={() => setEntryError(null)}>
        <Alert
          severity="warning"
          onClose={() => setEntryError(null)}
          data-testid="entry-failure-toast"
        >
          {entryError}
        </Alert>
      </Snackbar>

      {/* The structured-state export floor — reachable from the rec panel ("View what's sent"). */}
      <StateExportDrawer
        open={exportDrawer.open}
        ticker={ticker}
        personaId={exportDrawer.personaId}
        onClose={() => setExportDrawer((s) => ({ ...s, open: false }))}
        hasRecOnScreen={aiRec.rec != null && aiRec.rec.status === 'produced'}
        asSentCandidates={aiRec.rec?.sent?.candidates ?? undefined}
        asSentRiskInputs={aiRec.rec?.sent?.risk_inputs ?? undefined}
      />
    </Container>
  );
}

export default TickerDashboard;
