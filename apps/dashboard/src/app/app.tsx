/**
 * App root — the ROUTE TABLE ONLY (ARCHITECTURE §1.2, FRONTEND_EXECUTION_CONTRACT §2). It no longer is
 * the GEX dashboard: that relocated to `ticker/TickerDashboard.tsx`. The single `<BrowserRouter>` +
 * single `<ThemeProvider>`/`<CssBaseline>` live in `main.tsx` (unchanged) — this file nests neither
 * (AC-Inv-8).
 *
 * Route shape (the binding table):
 *  - `/_ops/metrics`         → <OperatorMetrics/>   OUTSIDE the shell, declared FIRST so `/*` can't
 *                                                    shadow it, own AppBar, NOT linked (AC-Inv-7).
 *  - `/_ops/research`        → <OperatorSessionArchive/> same first group (operator routes — metrics
 *                                                    + this surface). Off-shell, URL-only, NOT linked.
 *  - <AppShell/> (parent)    → persistent layout via <Outlet/> — mounts once, does not remount across
 *                              the in-shell pages (AC-Nav-4):
 *      - index (`/`)         → <Landing/>           OWNER DECISION (convexa-redesign): Landing now
 *                                                    renders INSIDE the shell so the persistent top nav
 *                                                    shows on every screen (matches the prototype). This
 *                                                    OVERRIDES the README "Landing full-bleed outside the
 *                                                    shell" line + the old AC-Route-1 / AC-Inv-8 wording.
 *                                                    `/` is still NEVER a redirect to a ticker; Landing
 *                                                    stays full-bleed below the bar (AppShell's <Outlet/>
 *                                                    adds no width container). FLAGGED for a GATE Z
 *                                                    contract/README amendment (see report).
 *      - `/ticker`           → <DefaultTickerRedirect/> — the EFFECTIVE default ticker: the stored
 *                              `default_ticker` pref wins (server-wins signed-in, client-local
 *                              anonymous); unset ⇒ SPY (index-first-defaults AC-1/AC-2; supersedes
 *                              the old static `/ticker/TSLA` redirect of AC-Route-3)
 *      - `/ticker/:symbol`   → <TickerDashboard/>   (relocated, unchanged; URL-addressable symbol)
 *      - `/positions`        → <PositionsPage/>     (relocated PortfolioPanel, standalone wrapper)
 *      - `/scanner`          → <Scanner/>           (static coming-soon)
 *
 * The live-SSE session stays page-scoped to the Ticker viewer (it owns its own subscription effect);
 * making the Ticker page a child route is what gives mount-on-enter / teardown-on-leave for free.
 *
 * CODE SPLITTING (tech-debt #16): every page except <Landing/> is a `React.lazy` route so each
 * page's JS ships as its own chunk. Landing stays EAGER — it is the `/` entry experience and must
 * paint synchronously with the shell. The <Suspense> boundary wraps each route ELEMENT (not the
 * route tree), so the persistent shell/nav never falls back during a page-chunk load (AC-Nav-4),
 * and the Ticker page's page-scoped SSE lifecycle is untouched: lazy() resolves the module ONCE
 * (module registry), then mount/unmount semantics are identical to the eager import.
 */
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AppThemeProvider } from '@/features/auth/ThemeProvider';
import { useSettings } from '@/features/auth/useSettings';
import { Landing } from '@/pages/landing/Landing';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { PageColumn } from '@/shared/ui/PageColumn';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { AppShell } from '@/shell/AppShell';
import { dataMode } from '@convexa/api';
import { Typography } from '@mui/material';
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

function DemoOperatorUnavailable() {
  return (
    <main role="status" style={{ padding: 32 }}>
      <Typography variant="h5">Unavailable in the public demo.</Typography>
    </main>
  );
}

// Lazy page chunks (named exports mapped to lazy's `default` shape).
const TickerDashboard = lazy(() =>
  import('@/pages/ticker/TickerDashboard').then((m) => ({ default: m.TickerDashboard })),
);
const TechnicalAnalysisView = lazy(() =>
  import('@/pages/ticker/technical-analysis/TechnicalAnalysisView').then((m) => ({
    default: m.TechnicalAnalysisView,
  })),
);
const ResearchView = lazy(() =>
  import('@/pages/ticker/research/ResearchView').then((m) => ({ default: m.ResearchView })),
);
const TechnicalAnalysisOff = lazy(() =>
  import('@/pages/ticker/technical-analysis/TechnicalAnalysisOff').then((m) => ({
    default: m.TechnicalAnalysisOff,
  })),
);
const NotesView = lazy(() =>
  import('@/pages/research/NotesView').then((m) => ({ default: m.NotesView })),
);
const ResearchIndexPage = lazy(() =>
  import('@/pages/research/ResearchIndexPage').then((m) => ({ default: m.ResearchIndexPage })),
);
const ScorecardPage = lazy(() =>
  import('@/pages/research/ScorecardPage').then((m) => ({ default: m.ScorecardPage })),
);
const MarketsPage = lazy(() =>
  import('@/pages/research/MarketsPage').then((m) => ({ default: m.MarketsPage })),
);
const FilingsPage = lazy(() =>
  import('@/pages/research/FilingsPage').then((m) => ({ default: m.FilingsPage })),
);
const PositionsPage = lazy(() =>
  import('@/pages/positions/PositionsPage').then((m) => ({ default: m.PositionsPage })),
);
const Scanner = lazy(() => import('@/pages/scanner/Scanner').then((m) => ({ default: m.Scanner })));
const BlogPage = lazy(() => import('@/pages/blog/BlogPage').then((m) => ({ default: m.BlogPage })));
const MethodologyPage = lazy(() =>
  import('@/pages/methodology/MethodologyPage').then((m) => ({ default: m.MethodologyPage })),
);
const AlertsPage = lazy(() =>
  import('@/pages/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/auth/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const OperatorMetrics = lazy(() =>
  import('@/pages/operator-metrics/operator-metrics').then((m) => ({ default: m.OperatorMetrics })),
);
const OperatorSessionArchive = lazy(() =>
  import('@/pages/operator-session-archive/OperatorSessionArchive').then((m) => ({
    default: m.OperatorSessionArchive,
  })),
);
const LabIndex = lazy(() => import('@/pages/lab/LabIndex').then((m) => ({ default: m.LabIndex })));
const StructureFieldLab = lazy(() =>
  import('@/pages/lab/StructureFieldLab').then((m) => ({ default: m.StructureFieldLab })),
);
const TapePulseLab = lazy(() =>
  import('@/pages/lab/demos/TapePulseLab').then((m) => ({ default: m.TapePulseLab })),
);
const WallMagnetLab = lazy(() =>
  import('@/pages/lab/demos/WallMagnetLab').then((m) => ({ default: m.WallMagnetLab })),
);
const TermHeatLab = lazy(() =>
  import('@/pages/lab/demos/TermHeatLab').then((m) => ({ default: m.TermHeatLab })),
);
const FlowRibbonsLab = lazy(() =>
  import('@/pages/lab/demos/FlowRibbonsLab').then((m) => ({ default: m.FlowRibbonsLab })),
);
const NotFound = lazy(() =>
  import('@/pages/not-found/NotFound').then((m) => ({ default: m.NotFound })),
);

/** Per-route Suspense + error boundary: loading fill never blanks the shell (AC-Nav-4);
 *  a throw in one page does not unmount nav chrome. */
const lazyRoute = (el: ReactElement) => (
  <ErrorBoundary variant="route">
    <Suspense fallback={<RouteFallback />}>{el}</Suspense>
  </ErrorBoundary>
);

/**
 * Bare `/ticker` → the EFFECTIVE default ticker (index-first-defaults AC-1/AC-2). The stored
 * `default_ticker` preference wins via useSettings' existing precedence (D7: server-wins signed in,
 * client-local anonymous); ONLY the unset fallback moved TSLA → SPY (`SETTINGS_DEFAULTS.ticker`).
 * Waits for the ONE non-blocking who-am-I read (`ready`) behind the quiet route fill so a signed-in
 * trader's server pref is honored on a cold entry; a who-am-I transport fault resolves `ready` AS
 * anonymous (AuthContext), so a degraded auth subsystem can never hang this redirect (AC-J1 spirit
 * intact — deep links `/ticker/:ticker` never pass through here and never wait).
 */
function DefaultTickerRedirect() {
  const { ready } = useAuth();
  const { effective } = useSettings();
  if (!ready) return <RouteFallback />;
  return <Navigate to={`/ticker/${encodeURIComponent(effective.defaultTicker)}`} replace />;
}

/** Indicators need daily bars: demo builds have sample bars; the live build has no bar feed. */
function TechnicalAnalysisRoute() {
  const { symbol = '' } = useParams();
  return (
    <PageColumn>
      {dataMode === 'demo' ? (
        <TechnicalAnalysisView symbol={symbol} />
      ) : (
        <TechnicalAnalysisOff symbol={symbol} />
      )}
    </PageColumn>
  );
}

/** Demo builds keep the authored sample note (its figures match the demo scenario); live builds show
 *  the owner's published notes from research/<TICKER>/*.md, which need no market data. A note's file
 *  name in the path (`/research/<slug>`) opens an earlier note. */
function ResearchRoute() {
  const { symbol = '', slug } = useParams();
  return dataMode === 'demo' ? (
    <PageColumn>
      <ResearchView symbol={symbol} />
    </PageColumn>
  ) : (
    <NotesView symbol={symbol} slug={slug} />
  );
}

/** The route table only (ARCHITECTURE §1.2). Must render UNDER a Router + the auth/theme providers
 *  (supplied by <App/>). */
export function AppRoutes() {
  return (
    <Routes>
      {/* Operator routes — off the trader shell, unlinked. FIRST so `/*` never shadows them. */}
      <Route
        path="/_ops/metrics"
        element={dataMode === 'demo' ? <DemoOperatorUnavailable /> : lazyRoute(<OperatorMetrics />)}
      />
      <Route
        path="/_ops/research"
        element={
          dataMode === 'demo' ? <DemoOperatorUnavailable /> : lazyRoute(<OperatorSessionArchive />)
        }
      />

      {/* The persistent shell group: the nav bar mounts once; pages swap in the <Outlet/>. */}
      <Route element={<AppShell />}>
        {/* Landing — OWNER DECISION (convexa-redesign): now the shell INDEX route so the persistent
            top nav shows on `/` too. Full-bleed below the bar (no width container). `/` is NEVER a
            redirect to a ticker. EAGER (the entry experience — no chunk wait on first paint).
            EAGER index — a BARE route ErrorBoundary, no Suspense: a Suspense here would reintroduce
            the chunk wait the eager route exists to avoid (SPEC §2.5). Today a throw inside Landing
            unmounts the whole React tree, because `main.tsx:16-26` adds no boundary above <App/>. */}
        <Route
          index
          element={
            <ErrorBoundary variant="route">
              <Landing />
            </ErrorBoundary>
          }
        />
        {/* Bare `/ticker` → the effective default (pref-wins; unset ⇒ SPY). `/` never redirects. */}
        <Route
          path="/ticker"
          element={
            <ErrorBoundary variant="route">
              <DefaultTickerRedirect />
            </ErrorBoundary>
          }
        />
        <Route path="/ticker/:ticker" element={lazyRoute(<TickerDashboard />)} />
        <Route
          path="/ticker/:symbol/technical-analysis"
          element={lazyRoute(<TechnicalAnalysisRoute />)}
        />
        <Route path="/ticker/:symbol/research" element={lazyRoute(<ResearchRoute />)} />
        <Route path="/ticker/:symbol/research/:slug" element={lazyRoute(<ResearchRoute />)} />
        {/* Research index — every ticker with published notes; public in both modes. */}
        <Route path="/research" element={lazyRoute(<ResearchIndexPage />)} />
        <Route path="/research/markets" element={lazyRoute(<MarketsPage />)} />
        <Route path="/research/filings" element={lazyRoute(<FilingsPage />)} />
        <Route path="/research/scorecard" element={lazyRoute(<ScorecardPage />)} />
        {/* OWNER LOCKDOWN 2026-08-06 — private testing. Positions + Scanner are behind a sign-in
            wall; Landing, /ticker/*, /blog and /settings stay PUBLIC by owner decision. The wall is
            UX only — /api/scan* and the positions write gate refuse signed-out callers server-side
            ([server-side-gate-enforcement]). Remove both wrappers to reopen. */}
        <Route
          path="/positions"
          element={
            <RequireAuth surface="your positions">{lazyRoute(<PositionsPage />)}</RequireAuth>
          }
        />
        <Route
          path="/scanner"
          element={<RequireAuth surface="the scanner">{lazyRoute(<Scanner />)}</RequireAuth>}
        />
        {/* Blog — static index (zero data work); each card is a full-document anchor to the
            standalone article HTML in `public/blog/` (static files win over the SPA fallback). */}
        <Route path="/blog" element={lazyRoute(<BlogPage />)} />
        {/* Methodology — product spine #7 trust surface (static; public). */}
        <Route path="/methodology" element={lazyRoute(<MethodologyPage />)} />
        {/* Alerts v1 — structure rules (level / tier / score); public, local durable. */}
        <Route path="/alerts" element={lazyRoute(<AlertsPage />)} />
        {/* Lab — public instrument demos (ticker candidates + shipped Structure Field). */}
        <Route path="/lab" element={lazyRoute(<LabIndex />)} />
        <Route path="/lab/structure-field" element={lazyRoute(<StructureFieldLab />)} />
        <Route path="/lab/tape-pulse" element={lazyRoute(<TapePulseLab />)} />
        <Route path="/lab/wall-magnet" element={lazyRoute(<WallMagnetLab />)} />
        <Route path="/lab/term-heat" element={lazyRoute(<TermHeatLab />)} />
        <Route path="/lab/flow-ribbons" element={lazyRoute(<FlowRibbonsLab />)} />
        {/* Settings — the 3 light prefs (account menu links here when signed in; viewable anonymously). */}
        <Route path="/settings" element={lazyRoute(<SettingsPage />)} />
        {/* Catch-all — LAST child of the shell group, so the 404 wears the nav AND the footer
            (SPEC §2.5). The two operator routes are declared before this group and match exactly,
            so they are unaffected; a MISTYPED operator URL falls through to this trader 404, which
            links nothing operator-shaped. Not a redirect: an address that once existed and no
            longer does gets the 404 and its offer — that is how a bookmark stops being a lie. */}
        <Route path="*" element={lazyRoute(<NotFound />)} />
      </Route>
    </Routes>
  );
}

/**
 * App — the route table wrapped in the auth + theme + sign-in-dialog providers. AuthProvider owns the
 * non-blocking who-am-I read; AppThemeProvider applies the effective theme (server-wins signed-in,
 * client-local anonymous); AuthDialogProvider owns the shared sign-in dialog. These compose INSIDE the
 * Router (supplied by main.tsx in prod / the test harness), so the whole app — and every test that
 * renders <App/> — gets a self-contained, anonymous-capable auth surface. who-am-I never blocks the
 * trader path (AC-J1).
 */
export function App() {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <AuthDialogProvider>
          <AppRoutes />
        </AuthDialogProvider>
      </AppThemeProvider>
    </AuthProvider>
  );
}

export default App;
