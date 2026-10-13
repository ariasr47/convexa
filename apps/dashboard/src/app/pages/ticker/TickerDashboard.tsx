/**
 * Ticker viewer — recomposed from reusable section components (convexa-redesign Ticker re-skin +
 * componentize). The monolith's stat-tile grid, headline, toolbar, term-structure card, fresh
 * positioning, off-exchange blocks, setups, and GEX chart are now the `ticker/widgets/*` components
 * (FigureCell (was StatTile, curvature-v2-foundations) · TickerToolbar · TickerHeader · LiveTape ·
 * StructureHeroPanel · ReadStrip (curvature-v2-desk-and-read FE-8: replaces the old dealer
 * positioning widget, now deleted) · TermStructureCard · FreshPositioning · OffExchangeBlocks ·
 * Setups). `GexStrikeProfile` (curvature-v2-desk-and-read FE-11) is deleted — it is fully superseded
 * by `StructureHeroPanel`, the desk's ONE structure instrument; see that widget's own module doc and
 * `gex-profile-chart/chart.tsx`'s.
 * This file is the COMPOSITION + data wiring only.
 *
 * Product spine #3 — hierarchy, not equal weight: Structure → Tape & plan → Supporting context
 * (curvature-v2-desk-and-read FE-11 reading order: masthead → structure-hero → read-strip → the
 * plan group [LiveTape / PositionBrief / AiRecPanel wide / OrdersWidget] → the quiet context band).
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
import { dataMode, getTicker, OptionRight, type Expiration } from '@convexa/api';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import type { BoxProps } from '@mui/material/Box';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Fade from '@mui/material/Fade';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme, type Theme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { elevationFor, extrasFor, typographyTokens } from '@/shared/theme/tokens';
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
  LiveTape,
  MarketContext,
  OffExchangeBlocks,
  PositionBrief,
  Setups,
  StraddleMove,
  TermStructureCard,
} from './widgets';
import { humanAge, StatSkeleton, universeMemberNote } from './widgets/_kit';
import { CommandDeck, LastTradeReadout, TickerToolbar } from './widgets/chrome';
import { buildReadStrip, ReadStrip } from './widgets/read-strip';
import { StructureHeroPanel } from './widgets/structure-hero';

// ---- Cold-load skeleton (AC-46 · fidelity repair 2, N1) ---------------------------------------
// The retired v1 skeleton (`StatGridSkeleton`, twelve identical tiles in a five-column fluid grid,
// under a 280px title shimmer) never matched the v2 desk it preceded — the page visibly reshaped
// itself the moment the bundle arrived (`FIDELITY_REPAIR_2_TASK.md` N1). AC-46 (SB) requires the
// "final shape": masthead (chip row · headline · meta line · quick row) → structure hero (field
// beside a five-row ladder, ladder BELOW the field under a 1000px `panel` container — exactly
// `StructureHeroPanel`'s own `theme.containerQueries('panel')` switch, mirrored one-for-one below,
// never a viewport media query) → read strip (eight cells, a rail below 1000, `1.35fr repeat(7,
// minmax(0,1fr))` at/above — `ReadStrip`'s own switch, mirrored the same way) → the work grid
// (AI-brief wide beside three side cards, `ticker-work`'s own 8fr/4fr switch at 1000) → the context
// band's own header. Shimmer only: every leaf here is an MUI `Skeleton` (no `children`, so no text
// node — foundations F2, "no text, no —, no Loading…"). `StatSkeleton` (below, unchanged) keeps
// carrying `cold-skeleton` byte-for-byte — the absence-after-load assertions
// (`ticker.risk.spec.tsx`) key on that testid and must keep passing unmodified.
//
// The design's own "Cold load" frame (`design/src/screens/desk-states.mjs`) is a narrower,
// illustrative mini-frame (a states CATALOG page, not the desk at a real width) — its note is the
// binding instruction ("skeletons take the exact final shape … so the first bundle lands without a
// jump"), not its own condensed markup. This shape instead mirrors the REAL, already-built v2 desk's
// own regions and their own container-query breakpoints, which is what makes the shimmer occupy
// (near enough) the same space the real widgets fill in once they mount.
const panelChromeSx = (t: Theme) => ({
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  boxShadow: elevationFor(t).e1,
  // `Widget.tsx`'s own body establishes this name (SPEC §2.5) — WITHOUT it, `HeroSkeleton`'s and
  // `StripSkeleton`'s own `theme.containerQueries('panel')` rules query a container that does not
  // exist anywhere in the ancestor chain, so the condition never matches at ANY width (a real-browser
  // regression a jsdom test cannot see — jsdom never lays out `@container` at all; caught here by
  // measuring the cold-load capture in a real browser at 390px, where the hero read 483px instead of
  // the intended 968px).
  containerType: 'inline-size' as const,
  containerName: 'panel',
});

/** `.panel` chrome (`Widget.tsx`'s own frame — radius/fill/hairline/e1) with no header: cold-load
 *  has no title text to show yet. */
function SkeletonPanel({ children, sx, ...rest }: BoxProps) {
  return (
    <Box {...rest} sx={[panelChromeSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      {children}
    </Box>
  );
}

/** One shimmer pill — no text, matches the design's rounded `.skel` chip shape. */
function ChipSkeleton({ width }: { width: number }) {
  return (
    <Skeleton
      data-testid="cold-skeleton"
      variant="rounded"
      width={width}
      height={22}
      sx={{ borderRadius: 999 }}
    />
  );
}

/** A zone-label-shaped shimmer bar — stands in for `BoardZoneLabel`'s text, which cold-load never
 *  shows (shimmer only). */
function ZoneLabelSkeleton() {
  return (
    <Skeleton
      data-testid="cold-skeleton"
      variant="text"
      width={120}
      sx={{ fontSize: '0.7rem', mt: 1 }}
    />
  );
}

// Masthead — bare on the ink (no raised toolbar panel): chip row, headline, meta line, quick row —
// `CommandDeck`'s own tier-1/tier-3 shape, which today has no stand-in at all before `m` resolves.
// The functional `TickerToolbar` (TICKER/EXPIRATIONS/PERSONA) renders separately, ABOVE this block
// (unchanged by this task — it already stays usable during load), so tier 2 is deliberately absent
// here. `LastTradeReadout` is the SAME live-derived component the loaded masthead's chip row uses —
// its own `live == null` branch already renders a `Skeleton` (no text) — kept here so the last-trade
// line keeps filling from the first SSE payload during cold load, exactly as before this change.
function MastheadSkeleton() {
  return (
    // minHeight 215 — the widget's own measured final height (review: `command-deck` 215px at
    // 1280), the same "pin to the final height" pattern the hero (483) and strip (131) skeletons
    // below use, verified against a real browser capture (measured 189px unpinned — ~12% short,
    // outside the task's ±10% band).
    <Box data-testid="cold-load-masthead" sx={{ pt: 2.5, pb: 1.5, mb: 1.5, minHeight: 215 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <ChipSkeleton width={96} />
          <ChipSkeleton width={72} />
          <LastTradeReadout />
        </Stack>
        <Skeleton
          data-testid="cold-skeleton"
          variant="text"
          width={220}
          sx={{ fontSize: '2rem' }}
        />
        <Skeleton
          data-testid="cold-skeleton"
          variant="text"
          width={300}
          sx={{ fontSize: '0.875rem' }}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ChipSkeleton key={i} width={60} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

// Structure hero — field region beside a five-row ladder column, `StructureHeroPanel`'s own
// `theme.containerQueries('panel')` switch (`minmax(0,1fr) 300px` at/above a 1000px container, one
// column — ladder BELOW the field in DOM order — under it). `minHeight` is pinned to the widget's
// own measured final heights (review: 483px at 1280, 968px at 390) so the page does not grow once
// the real hero mounts — the concrete point of AC-46's "final shape, so the first bundle lands
// without a jump".
function HeroSkeleton() {
  const theme = useTheme();
  return (
    // NOTE: the responsive rules live on the INNER `Box` below, never on `SkeletonPanel` itself —
    // `SkeletonPanel` is what ESTABLISHES the `panel` container name (`panelChromeSx`), and a
    // container cannot query the container it establishes (the same rule `ticker-work-container`'s
    // own comment names); a query placed here would never match at any width. Caught by measuring a
    // real browser capture at 390px (the hero read 483px instead of 968 before this was fixed).
    <SkeletonPanel data-testid="cold-load-hero">
      <Box
        data-testid="cold-load-hero-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          minHeight: 483,
          [theme.containerQueries('panel').down(1000)]: {
            gridTemplateColumns: '1fr',
            minHeight: 968,
          },
        }}
      >
        <Box data-testid="cold-load-hero-field" sx={{ minWidth: 0, padding: '10px 6px 0' }}>
          <Skeleton
            data-testid="cold-skeleton"
            variant="rounded"
            height={300}
            sx={{ borderRadius: '8px' }}
          />
          <Skeleton data-testid="cold-skeleton" variant="text" width="55%" sx={{ mt: 1.5 }} />
          <Skeleton data-testid="cold-skeleton" variant="text" width="35%" />
        </Box>
        <Box
          data-testid="cold-load-hero-ladder"
          sx={{
            borderLeft: '1px solid',
            borderColor: 'divider',
            padding: '12px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1, // on the 4-pt ladder (AC-45c) — 8px between the five ladder skeleton rows.
            [theme.containerQueries('panel').down(1000)]: {
              borderLeft: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              padding: '12px 14px',
            },
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} data-testid="cold-skeleton" variant="text" sx={{ fontSize: 14 }} />
          ))}
        </Box>
      </Box>
    </SkeletonPanel>
  );
}

// Read strip — eight cells, a rail below a 1000px `panel` container, `1.35fr repeat(7,
// minmax(0,1fr))` at/above it: `ReadStrip`'s own switch, mirrored one-for-one.
function StripSkeleton() {
  const theme = useTheme();
  return (
    // Same rule as `HeroSkeleton` above — the rail/grid switch lives on the inner `Box`, never on
    // `SkeletonPanel` (the `panel`-container-establishing element itself).
    <SkeletonPanel data-testid="cold-load-strip" sx={{ minHeight: 131 }}>
      <Box
        data-testid="cold-load-strip-rail"
        sx={{
          display: 'flex',
          overflow: 'hidden',
          [theme.containerQueries('panel').up(1000)]: {
            display: 'grid',
            gridTemplateColumns: '1.35fr repeat(7, minmax(0, 1fr))',
          },
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Box
            key={i}
            data-testid="cold-load-strip-cell"
            sx={{
              flex: i === 0 ? '0 0 220px' : '0 0 170px',
              minWidth: 0,
              py: 1.5,
              px: 1.5,
              borderRight: '1px solid',
              borderColor: 'divider',
              [theme.containerQueries('panel').up(1000)]: { flex: 'unset' },
            }}
          >
            <Skeleton
              data-testid="cold-skeleton"
              variant="text"
              width="60%"
              sx={{ fontSize: 11 }}
            />
            <Skeleton
              data-testid="cold-skeleton"
              variant="text"
              width="70%"
              sx={{ fontSize: 18 }}
            />
          </Box>
        ))}
      </Box>
    </SkeletonPanel>
  );
}

// Work grid — an AI-brief block wide beside three side cards (Live tape / Position brief / Sim
// orders), `ticker-work`'s own 8fr/4fr switch at a 1000px container, mirrored one-for-one. The three
// side cards reuse `StatSkeleton` unchanged (same `cold-skeleton` testid, same card shape).
function WorkGridSkeleton() {
  const theme = useTheme();
  return (
    <Box
      data-testid="cold-load-work"
      sx={{ containerType: 'inline-size', containerName: 'ticker-work', minWidth: 0 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '14px',
          [theme.containerQueries('ticker-work').up(1000)]: {
            gridTemplateColumns: 'minmax(0, 8fr) minmax(0, 4fr)',
          },
        }}
      >
        <SkeletonPanel sx={{ minHeight: 320, p: 2 }}>
          <Skeleton data-testid="cold-skeleton" variant="text" width="40%" sx={{ fontSize: 14 }} />
          <Skeleton
            data-testid="cold-skeleton"
            variant="text"
            width="90%"
            sx={{ fontSize: 20, mt: 1 }}
          />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="cold-skeleton"
              variant="text"
              sx={{ fontSize: 14, mt: 1 }}
            />
          ))}
        </SkeletonPanel>
        <Stack spacing={1.75}>
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </Stack>
      </Box>
    </Box>
  );
}

/** The whole `cold-load` subtree — masthead, hero, strip, work grid, band header — every band the
 *  loaded desk itself renders, as shimmer, at (near enough) its final height. */
function ColdLoadSkeleton() {
  return (
    <Box>
      <MastheadSkeleton />
      <Stack spacing={2}>
        <ZoneLabelSkeleton />
        <HeroSkeleton />
        <StripSkeleton />
        <ZoneLabelSkeleton />
        <WorkGridSkeleton />
        <ZoneLabelSkeleton />
      </Stack>
    </Box>
  );
}

/**
 * Board zone label — visual hierarchy only (product spine #3).
 * Renders as `<p>`, never a heading: widget titles remain the only h2s on the page.
 * Full-row span so the two-column bento cannot sandwich
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

/**
 * Fidelity repair 2, N7 — a DISPLAY-ONLY parse of the client's own error message, never a second
 * status authority. `libs/api/src/lib/convexa.ts:1338` builds the message from the response status
 * alone (`API error ${status}`, `Rate limited (${status})`, or a 404's status-less prose) — this
 * reads the SAME text back out for the Mono detail line ("nothing is hidden") without touching that
 * builder (other consumers assert on it; the "must not change" list keeps `libs/api` at a zero
 * diff). `null` when the message carries no status-shaped number (the 404 case has none at all) —
 * the detail line is simply omitted then, never a fabricated status.
 */
function httpStatusFromMessage(message: string | null): string | null {
  return message?.match(/\b(\d{3})\b/)?.[1] ?? null;
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
  const [demoExpiryOptions, setDemoExpiryOptions] = useState<{
    symbol: string;
    expirations: Expiration[];
  } | null>(null);
  // The SAME "all expirations" / "N expirations" phrase `TickerHeader` states beside the headline
  // (structure hero repair task item 6's subtitle) — never a second, independent computation.
  const expirationsLabel =
    selected === null
      ? 'all expirations'
      : `${selected.length} expiration${selected.length === 1 ? '' : 's'}`;
  // Dark-pool (off-exchange) context: fixed ON (the toolbar toggle was removed to match the Figma).
  const darkPool = true;

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
  // Reset the filter to "all" whenever the ticker changes.
  useEffect(() => {
    setSelected(null);
  }, [ticker]);
  // Live tape subscription — portfolio / orders / deck need ticks. Structure widgets are memoized
  // on REST props so they skip re-render when only the tape changes (§3.8 Phase C).
  const { live, demoOrderFrame, streamOffline, isLive, displayActive, lastSessionPhase } =
    useLiveTape();
  const { data, loading, error, paused: marketDataPaused, refresh: load } = page.bundle;
  useEffect(() => {
    if (dataMode !== 'demo') return;
    const symbol = ticker.toUpperCase();
    let active = true;
    getTicker(symbol, { darkPool: true })
      .then((bundle) => {
        if (active && bundle.market_state?.ticker?.toUpperCase() === symbol) {
          setDemoExpiryOptions({ symbol, expirations: bundle.expirations });
        }
      })
      .catch(() => {
        // The active ticker bundle owns its own cold-load/retry state; keep this picker metadata
        // optional until the same static provider facade can supply a full-chain response.
      });
    return () => {
      active = false;
    };
  }, [ticker, Boolean(data)]);
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
  const [exportDrawer, setExportDrawer] = useState<{
    open: boolean;
    personaId: string | null;
    sampleFingerprint: string | null;
  }>({ open: false, personaId: null, sampleFingerprint: null });
  const openExport = useCallback(
    (personaId: string | null, sampleFingerprint?: string | null) =>
      setExportDrawer({ open: true, personaId, sampleFingerprint: sampleFingerprint ?? null }),
    [],
  );

  const theme = useTheme();
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
  const selectableExpirations =
    (page.sourceBasis && demoExpiryOptions?.symbol === ticker.toUpperCase()
      ? demoExpiryOptions.expirations
      : data?.expirations) ?? [];
  const selectableDates = selectableExpirations.map((e) => e.date);
  const noneSelected = selected !== null && selected.length === 0;
  const checked = selected ?? selectableDates; // dates shown ticked in the menu
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
  useOrderEngine({ ticker, bundle: data, live, isLive, streamOffline, demoFrame: demoOrderFrame });

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
            expirations={selectableExpirations}
            allDates={selectableDates}
            selected={selected}
            checked={checked}
            onSelectExpirations={setSelected}
            persona={persona}
            onOpenCustomize={() => setCustomizeOpen(true)}
            loading={loading}
          />
        </Box>
      )}

      <Tabs
        value="overview"
        aria-label={`${ticker.toUpperCase()} ticker views`}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          minHeight: 44,
          '& .MuiTab-root': { minHeight: 44, minWidth: 112 },
          '& .MuiTab-root.Mui-selected': {
            color: (theme) => extrasFor(theme).textAmber,
          },
        }}
      >
        <Tab
          component={RouterLink}
          to={`/ticker/${encodeURIComponent(ticker)}`}
          value="overview"
          label="Overview"
        />
        <Tab
          component={RouterLink}
          to={`/ticker/${encodeURIComponent(ticker)}/technical-analysis`}
          value="technical"
          label="Technical analysis"
        />
        <Tab
          component={RouterLink}
          to={`/ticker/${encodeURIComponent(ticker)}/research`}
          value="research"
          label="Research"
        />
      </Tabs>

      {page.sourceBasis && (
        <Stack
          spacing={0.5}
          sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
          data-testid="ticker-sample-basis"
          data-selected-expiry-key={page.selectedExpiryKey ?? ''}
          data-state-fingerprint={data?.ai_eval.state_fingerprint ?? ''}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {page.sourceBasis.label} · Authored scenario · October 7, 2026 · no market feed
            connected
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Structure and related signals use the selected expiry set:{' '}
            {page.selectedExpiryKey ?? 'awaiting sample snapshot'}. Full-chain context keeps its
            labeled full-chain basis. Sample analysis is authored for this scenario.
          </Typography>
          {page.positionEval == null && (
            <Typography variant="caption" color="text.secondary">
              Position evaluation unavailable for this sample.
            </Typography>
          )}
          {Object.entries({
            'Dealer-flow projection': page.optionalAbsences.dealerFlowProjection,
            'IV rank': page.optionalAbsences.ivRank,
            'IV skew': page.optionalAbsences.ivSkew,
            'Market context': page.optionalAbsences.marketContext,
            'Off-exchange context': page.optionalAbsences.offExchange,
            'Straddle move': page.optionalAbsences.straddleMove,
            'Term structure': page.optionalAbsences.termStructure,
            'Vol-normalized GEX': page.optionalAbsences.volNormalizedGex,
          })
            .filter(([, absent]) => absent)
            .map(([label]) => (
              <Typography key={label} variant="caption" color="text.secondary">
                {label} unavailable for this sample.
              </Typography>
            ))}
        </Stack>
      )}

      {/* In-context sign-in prompt for a gated Act (D8-6/D10 — the standard gated-write pattern):
          a 403 at confirm aborts the flow with ZERO order stored and surfaces this. */}
      <SignInPrompt
        text={orderGate.promptText}
        onSignIn={() => orderGate.signIn(orderGate.promptText ?? GATE_SIGN_IN)}
        testid="orders-signin-prompt"
      />

      {/* Cold-start failure (no bundle ever loaded) is the ONLY blank/error screen — the design's
          own sentence (fidelity repair 2, N7), never the raw client status string; the status
          itself stays, as a Mono detail line, so nothing is hidden. A poll failure AFTER a prior
          success keeps the whole bundle on screen behind a soft warning (the other branch, below —
          untouched; same code path ONLY when `error && !data`, never `error && data`).

          no-vendor-production-posture F2: a PAUSED cold-start is not a transient failure — it is a
          standing, honest fact (`docs/mockups/2026-09-23-market-data-paused.html`). It gets its own
          info-toned panel with NO Retry and NO HTTP line (retrying cannot change the answer); every
          OTHER cold-start error keeps today's warning panel byte-for-byte (AC-8). F2b: the fetch
          behind `error` has already stopped polling by the time this renders (`useTickerBundle`'s
          `haltOn: isMarketDataPaused`) — changing the ticker is the only thing that asks again. */}
      {error && !data && marketDataPaused && (
        <Alert severity="info" icon={<PauseCircleOutlinedIcon />} role="status">
          <AlertTitle>Market data is paused.</AlertTitle>
          <Typography variant="body2">
            Convexa isn’t connected to a market-data feed right now, so this desk can’t load prices
            or dealer structure. Nothing is broken, and retrying won’t change it.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1, rowGap: 0.5, flexWrap: 'wrap' }}>
            {/* `info.main` is the deliberately-quiet FILL-grade blue (`[theme-token-discipline]`'s
                own top-of-file note) — too quiet as small link TEXT (AC-10 caught it: 'color-contrast'
                serious on light at 1280, this exact site). `extrasFor(theme).textInfo` is the
                measured TEXT-GRADE companion `ConnectionChip`/`StructureHeroPanel`/`AuthDialog`
                already use for the same reason. */}
            <Link
              component={RouterLink}
              to="/methodology"
              variant="body2"
              underline="always"
              sx={{ color: (theme) => extrasFor(theme).textInfo }}
            >
              How the desk reads structure →
            </Link>
            {/* Production keeps research and links to the hosted all-sample demo (staging). */}
            <Link
              component={RouterLink}
              to={`/ticker/${encodeURIComponent(ticker.toUpperCase())}/research`}
              variant="body2"
              underline="always"
              sx={{ color: (theme) => extrasFor(theme).textInfo }}
            >
              Read {ticker.toUpperCase()} research →
            </Link>
            <Link
              href={STAGING_DEMO_URL}
              variant="body2"
              underline="always"
              sx={{ color: (theme) => extrasFor(theme).textInfo }}
            >
              Try the full demo →
            </Link>
          </Stack>
        </Alert>
      )}
      {error && !data && !marketDataPaused && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => load({ force: true })}>
              Retry
            </Button>
          }
        >
          <AlertTitle>{`Couldn't load ${ticker.toUpperCase()}.`}</AlertTitle>
          <Typography variant="body2">
            The structure request failed before any snapshot arrived. Nothing is cached for this
            desk yet.
          </Typography>
          {httpStatusFromMessage(error) && (
            <Typography
              component="div"
              sx={{
                mt: 0.5,
                fontFamily: typographyTokens.monoFontFamily,
                fontSize: 11,
                color: 'text.secondary',
              }}
            >
              {`HTTP ${httpStatusFromMessage(error)}`}
            </Typography>
          )}
        </Alert>
      )}
      {error && data && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't refresh — showing data from {humanAge(fresh?.data_age_seconds ?? null)} ago.
          Retrying automatically.
        </Alert>
      )}

      {/* COLD-LOAD skeleton (AC-46, "final shape"): every band the loaded desk itself renders paints
          as shimmer, at (near enough) its final height — masthead, hero, strip, work grid, band
          header (`ColdLoadSkeleton`, fidelity repair 2 N1). The last-trade line fills on the first
          SSE payload (`LastTradeReadout`, inside `MastheadSkeleton`'s chip row), the rest on the REST
          bundle. The skeleton class (`cold-skeleton`) never appears post-load. */}
      {!data && !error && !noneSelected && (
        <Box data-testid="cold-load">
          <ColdLoadSkeleton />
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
              singleNameCaveat={universeMembership.membership === 'nonmember'}
              // Ticker fidelity repair, change 3 (F3) — the masthead's `Universe member · N tracked
              // names` note (`quick-note`, `design/src/screens/desk.mjs:285`); `size` stays `null`
              // (never a fabricated 0) until a well-formed, non-empty universe read resolves.
              universeMemberNote={
                universeMembership.membership === 'member' && universeMembership.size != null
                  ? universeMemberNote(universeMembership.size)
                  : null
              }
              symbol={symbol}
              onSymbolChange={setSymbol}
              onSubmitSymbol={onSubmitSymbol}
              expirations={selectableExpirations}
              allDates={selectableDates}
              checked={checked}
              onSelectExpirations={setSelected}
              persona={persona}
              onOpenCustomize={() => setCustomizeOpen(true)}
              loading={loading}
              routeSymbol={ticker}
              onSelectQuickSymbol={onSelectQuickSymbol}
            />

            {/* The widget BENTO board — product spine #3: NOT equal weight.
                Reading order (curvature-v2-desk-and-read FE-11, SPEC §1/§4):
                  masthead (CommandDeck + TickerToolbar, above, unchanged)
                    → structure-hero (the field, the ladder, the tape trail, the structure path — ONE
                      instrument; the standalone `TapePulseStrip` masthead fragment and the standalone
                      `GexStrikeProfile` widget that used to duplicate parts of it are both GONE, not
                      merely hidden — see `structure-hero/` and `gex-profile-chart/chart.tsx`'s own
                      module docs)
                    → read-strip
                    → AiRecPanel (wide) beside LiveTape / PositionBrief / OrdersWidget
                    → quiet context band
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

                {/* FE-11's OWN reading-order rewrite: `StructureHeroPanel` is the desk's ONE structure
                    instrument (field + ladder + tape trail + structure path). The standalone
                    `GexStrikeProfile` widget that used to render directly below it — a second,
                    overlapping GEX-wall renderer, disclosed as a KNOWN, NAMED, TEMPORARY condition at
                    FE-6/FE-8 — is DELETED, not merely unmounted (see `gex-profile-chart/chart.tsx`'s
                    own module doc: every capability it had — the field canvas, the walls/flip/mid, the
                    embedded session path strip — is already present here, so nothing it drew is lost). */}
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
                    expirationsLabel={expirationsLabel}
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
                      setupsCount: sig?.setups?.length ?? null,
                    })}
                    ringScore={sig?.opportunity_score ?? 0}
                  />
                </ErrorBoundary>

                {/* ── 2. TAPE & PLAN ───────────────────────────────────────────────── */}
                <BoardZoneLabel zone="plan">Tape & plan</BoardZoneLabel>

                {/* Ticker fidelity repair, change 1 (F1) — the design's `.work` grid
                    (`design/src/screens/desk.mjs:32`, `DESK_CSS`): `minmax(0,8fr) minmax(0,4fr)` at
                    a ≥1000px CONTAINER (never viewport — canon 21, "panels are containers", the same
                    authority the hero repair used). Two grid children only, exactly like the design's
                    markup: the AI read wide on the left, and a `side` column stacking Live tape /
                    Position brief / Sim orders on the right. Below 1000 the container collapses to one
                    column, so DOM order alone decides the stack: read → tape → position → orders
                    (tape before brief, as before). The
                    outer `containerType` lives on a plain wrapper (never the styled grid element
                    itself — an element cannot query the container IT establishes). */}
                <Box
                  data-testid="ticker-work-container"
                  sx={{
                    gridColumn: { xs: '1 / -1', md: 'span 2' },
                    containerType: 'inline-size',
                    containerName: 'ticker-work',
                    minWidth: 0,
                  }}
                >
                  <Box
                    data-testid="ticker-work"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: '14px',
                      alignItems: 'stretch',
                      [theme.containerQueries('ticker-work').up(1000)]: {
                        gridTemplateColumns: 'minmax(0, 8fr) minmax(0, 4fr)',
                      },
                    }}
                  >
                    {/* Act → watch as one motion (UX §4.4): AI-rec paired with sim orders — both
                        live in this work group, the AI read wide on the left. */}
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
                    <Box
                      data-testid="ticker-work-side"
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        minWidth: 0,
                      }}
                    >
                      {/* LIVE-DERIVED tiles — dim on an SSE drop. */}
                      <ErrorBoundary variant="widget" label="Live tape">
                        <LiveTape m={m} />
                      </ErrorBoundary>

                      {/* Product spine #5 — position brief bridges structure → plan (your book on
                          this name). FE-11 moved it INTO the plan zone, beside
                          LiveTape/AiRecPanel/OrdersWidget (SPEC §1's flow: "AI read brief wide beside
                          tape / position / orders"); the ticker fidelity repair (F1) absorbs it as
                          the side column's position card instead of a full-width bar ahead of the
                          group — `stripSx` no longer spans `1 / -1` (`position-brief` module). */}
                      <PositionBrief
                        ticker={ticker}
                        openViews={openBookViews}
                        storeFaulted={storeFaulted}
                        entryBlocked={storeFaulted || tradeOpen}
                        onOpenTrade={() => openEntry()}
                        tradeAllowed={orderGate.allowed}
                        onSignIn={() => orderGate.signIn(GATE_SIGN_IN)}
                      />

                      <OrdersWidget ticker={ticker} />
                    </Box>
                  </Box>
                </Box>

                {/* ── 3. SUPPORTING CONTEXT (tertiary — quieter Widget chrome) ──────── */}
                <BoardZoneLabel zone="context">Supporting context</BoardZoneLabel>

                {/* Ticker fidelity repair, change 2 (F2) — the design's `ctx-head` + `ctx-grid`
                    (`design/src/screens/desk.mjs:43`): a `Context` header carrying a presentational
                    `All · Flow · Vol · Positioning` filter (only `All` is wired — the band carries no
                    categories yet, so Flow/Vol/Positioning are disabled + "coming soon", never a
                    fake-functional filter — `Widget.tsx`'s own affordance-only convention), then a
                    `repeat(3, minmax(0,1fr))` quiet grid at the design's density. This wrapper spans
                    the full bento row, same pattern as the `ticker-work` grid change 1 added above. */}
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
                  <Box
                    data-testid="context-band-head"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                      mb: 1.5,
                    }}
                  >
                    <Typography
                      component="p"
                      sx={{
                        m: 0,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'text.primary',
                      }}
                    >
                      Context
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
                    >
                      Advisory reads that never feed the score · snapshot, never live · refreshes
                      with the data load
                    </Typography>
                    <Box
                      aria-hidden
                      sx={{ flex: '1 1 40px', minWidth: 40, height: '1px', bgcolor: 'divider' }}
                    />
                    <ToggleButtonGroup
                      value="all"
                      exclusive
                      size="small"
                      aria-label="Filter the context band"
                      data-testid="context-band-filter"
                    >
                      <ToggleButton value="all" sx={{ textTransform: 'none' }}>
                        All
                      </ToggleButton>
                      {(['Flow', 'Vol', 'Positioning'] as const).map((label) => (
                        <Tooltip key={label} arrow title="Filter by category — coming soon">
                          <span>
                            <ToggleButton
                              value={label.toLowerCase()}
                              disabled
                              sx={{ textTransform: 'none' }}
                            >
                              {label}
                            </ToggleButton>
                          </span>
                        </Tooltip>
                      ))}
                    </ToggleButtonGroup>
                  </Box>

                  <WidgetChromeProvider value="quiet">
                    <Box
                      data-testid="ticker-context-grid"
                      sx={{
                        display: 'grid',
                        // Ticker fidelity repair residual close-out: the design's own `.ctx-grid`
                        // responsive table (`design/src/screens/responsive-spec.mjs`'s "Context
                        // band" row) — 1 col below `tablet`(768), 2 from `tablet` (768–1099,
                        // covering the design's separate tablet/small-laptop rows, both 2-col), 3
                        // from `laptop` (1100–1599, covering laptop/desktop, both 3-col), 4 from
                        // `wide`(1600+). The bare `repeat(3, minmax(0,1fr))` this replaces never
                        // reflowed below laptop width — at 390 it squeezed all nine ctx-grid cards
                        // into three ~110px columns, the dominant driver of the phone page-height
                        // overflow. `Widget`'s own `span={2}` (`gridColumn: { xs: '1 / -1', md:
                        // 'span 2' }`, `Widget.tsx:353`) already degrades correctly against every
                        // column count here — `1 / -1` is column-count-agnostic — so Setups needs
                        // no matching change.
                        gridTemplateColumns: {
                          xs: '1fr',
                          tablet: 'repeat(2, minmax(0, 1fr))',
                          laptop: 'repeat(3, minmax(0, 1fr))',
                          wide: 'repeat(4, minmax(0, 1fr))',
                        },
                        gap: 2,
                        // Quiet cards vary a lot in natural height (a compact tenor ribbon beside a
                        // 2×2 stat card); CSS grid's default `stretch` was inflating the shorter
                        // siblings to match the tallest one in the row instead of sitting at their
                        // own content height, matching neither this band's own density goal nor the
                        // design's rendered result (`desk.mjs`'s `.ctx-grid` has no `align-items`
                        // override either — its cards simply don't vary enough for stretch to show).
                        alignItems: 'start',
                      }}
                    >
                      {/* STATIC dealer-flow projection — bound to `m.dealer_flow_projection` only
                        (`[live-vs-static-isolation]`). */}
                      <DealerFlowProjection dfp={m.dealer_flow_projection} />

                      {/* STATIC market context pack — `m.market_context ?? null` only. */}
                      <MarketContext pack={m.market_context ?? null} />

                      <TermStructureCard
                        termStructure={m.term_structure}
                        structureAgeSeconds={structureAgeSeconds}
                      />

                      {/* PASS 2 change 8 (owner ruling, `context/DECISION_LEDGER.md` key
                          `context-band-is-the-designs-card-list`, 2026-09-08 "Do all four"):
                          `IvRank` is unmounted from the band — it is not in the design's
                          enumerated ctx-grid card list (`desk.mjs:395-421`) and it repeats the
                          read strip's `IV rank` cell (one fact, one place). The component and its
                          spec stay (it covers only `ivRankStripFigure`) — this is an unmount, not a
                          deletion; `quiet-band.register.spec.tsx` scans the source file by path and
                          is correctly unaffected. See `TICKER_FIDELITY_REPAIR_REPORT.md` (Pass 2,
                          change 8) for the e2e/unit assertion edits this required. */}
                      <StraddleMove move={m.straddle_move} />

                      {/* Fresh positioning ‖ Off-exchange blocks. Off-exchange is REST-only; with
                        Dark pool off, Fresh takes its own single column. */}
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

                      {/* Inert "+ Add widget" ghost slot — affordance-only (coming soon). Single
                          column (design: `desk.mjs:419` carries no `ctx-span2`) — it sits beside
                          Setups' 2-col span in the same row, exactly filling the 3-col grid. */}
                      <Tooltip arrow title="Add widget — coming soon">
                        <Box>
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
                    </Box>
                  </WidgetChromeProvider>
                </Box>
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
        sampleFingerprint={exportDrawer.sampleFingerprint}
        onClose={() => setExportDrawer((s) => ({ ...s, open: false }))}
        hasRecOnScreen={aiRec.rec != null && aiRec.rec.status === 'produced'}
        asSentCandidates={aiRec.rec?.sent?.candidates ?? undefined}
        asSentRiskInputs={aiRec.rec?.sent?.risk_inputs ?? undefined}
      />
    </Container>
  );
}

export default TickerDashboard;
