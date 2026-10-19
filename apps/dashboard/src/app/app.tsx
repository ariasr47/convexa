/**
 * App root — the ROUTE TABLE ONLY (ARCHITECTURE §1.2, FRONTEND_EXECUTION_CONTRACT §2). It no longer is
 * the GEX dashboard: that relocated to `ticker/TickerDashboard.tsx`. The single `<BrowserRouter>`
 * lives in `mountApp.tsx`, and the single `<ThemeProvider>`/`<CssBaseline>` in
 * `features/auth/ThemeProvider.tsx` (`AppThemeProvider`, below) — this file nests neither directly
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
 *      - `/ticker/:symbol`   → <TickerDeskRoute/>   (the full desk, or the public desk on a live build
 *                              whose options feed is off; URL-addressable symbol)
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
import { DemoOperatorUnavailable } from '@/pages/operator-metrics/DemoOperatorUnavailable';
import { marketDataOff } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { PageColumn } from '@/shared/ui/PageColumn';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { AppShell } from '@/shell/AppShell';
import { dataMode } from '@convexa/api';
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

// Lazy page chunks (named exports mapped to lazy's `default` shape).
const TickerDashboard = lazy(() =>
  import('@/pages/ticker/TickerDashboard').then((m) => ({ default: m.TickerDashboard })),
);
const PublicDesk = lazy(() =>
  import('@/pages/ticker/public-desk/PublicDesk').then((m) => ({ default: m.PublicDesk })),
);
const DemoSymbolMissing = lazy(() =>
  import('@/pages/ticker/DemoSymbolMissing').then((m) => ({ default: m.DemoSymbolMissing })),
);
const TechnicalAnalysisView = lazy(() =>
  import('@/pages/ticker/technical-analysis/TechnicalAnalysisView').then((m) => ({
    default: m.TechnicalAnalysisView,
  })),
);
const ResearchView = lazy(() =>
  import('@/pages/ticker/research/ResearchView').then((m) => ({ default: m.ResearchView })),
);
const TechnicalAnalysisLive = lazy(() =>
  import('@/pages/ticker/technical-analysis/TechnicalAnalysisLive').then((m) => ({
    default: m.TechnicalAnalysisLive,
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
const ScannerNotLive = lazy(() =>
  import('@/pages/scanner/ScannerNotLive').then((m) => ({ default: m.ScannerNotLive })),
);
const BlogPage = lazy(() => import('@/pages/blog/BlogPage').then((m) => ({ default: m.BlogPage })));
const BlogPostPage = lazy(() =>
  import('@/pages/blog/BlogPostPage').then((m) => ({ default: m.BlogPostPage })),
);
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
const CreditsPage = lazy(() =>
  import('@/pages/trust/CreditsPage').then((m) => ({ default: m.CreditsPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/trust/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import('@/pages/trust/TermsPage').then((m) => ({ default: m.TermsPage })),
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

/** The ticker desk. A live build whose options feed is off (/api/health says `not_live` or
 *  `paused`) mounts the public desk instead, which never calls the endpoints that need the feed;
 *  waiting for the health read is what keeps the full desk's requests from starting. Demo builds and
 *  a live feed (or an unknown answer) keep the full desk; on the demo, a symbol its scenario doesn't
 *  cover says so instead of failing to load. */
function TickerDeskRoute() {
  const { ticker = '' } = useParams();
  const mode = useMarketDataMode();
  if (dataMode === 'demo')
    return (STAGING_DEMO_SYMBOLS as readonly string[]).includes(ticker.toUpperCase()) ? (
      <TickerDashboard />
    ) : (
      <DemoSymbolMissing ticker={ticker} />
    );
  if (mode === null) return <RouteFallback />;
  return marketDataOff(mode) ? (
    <PublicDesk feed={mode === 'paused' ? 'paused' : 'not_live'} />
  ) : (
    <TickerDashboard />
  );
}

/** The scanner, signed in. A live build with no options feed (`not_live`) mounts the explain page,
 *  which never calls /api/scan*: every column reads the options chain. A paused feed keeps the
 *  scanner and its last board under the paused banner; demo builds always run the sample scan. */
function ScannerRoute() {
  const mode = useMarketDataMode();
  if (dataMode === 'demo') return <Scanner />;
  if (mode === null) return <RouteFallback />;
  return mode === 'not_live' ? <ScannerNotLive /> : <Scanner />;
}

/** Indicators need daily bars: demo builds compute them from sample bars; the live build shows
 *  TradingView's chart, since it has no bar feed licensed for public display. */
function TechnicalAnalysisRoute() {
  const { symbol = '' } = useParams();
  return (
    <PageColumn>
      {dataMode === 'demo' ? (
        <TechnicalAnalysisView symbol={symbol} />
      ) : (
        <TechnicalAnalysisLive symbol={symbol} />
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

/** A post inside the shell at `/blog/<slug>.html`; anything else under /blog/ is the site's 404
 *  (pages never import each other, so the route table hands it over). */
function BlogPostRoute() {
  const { file = '' } = useParams();
  return <BlogPostPage file={file} notFound={<NotFound />} />;
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
            the chunk wait the eager route exists to avoid (SPEC §2.5). A throw that escapes this
            boundary lands in `mountApp.tsx`'s `RootErrorBoundary`, never a blank page. */}
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
        <Route path="/ticker/:ticker" element={lazyRoute(<TickerDeskRoute />)} />
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
            <RequireAuth surface="your positions" demoPath="/positions">
              {lazyRoute(<PositionsPage />)}
            </RequireAuth>
          }
        />
        <Route
          path="/scanner"
          element={
            <RequireAuth surface="the scanner" demoPath="/scanner">
              {lazyRoute(<ScannerRoute />)}
            </RequireAuth>
          }
        />
        {/* Blog — static index and posts (zero data work), both inside the shell. A post's text is
            docs/blog/<slug>.md; the plain no-JavaScript copy is the static /blog/plain/<slug>.html. */}
        <Route path="/blog" element={lazyRoute(<BlogPage />)} />
        <Route path="/blog/:file" element={lazyRoute(<BlogPostRoute />)} />
        {/* Methodology — product spine #7 trust surface (static; public). */}
        <Route path="/methodology" element={lazyRoute(<MethodologyPage />)} />
        {/* The trust pages: sources and credits, privacy, terms (design/src/screens/final/trust.mjs). */}
        <Route path="/credits" element={lazyRoute(<CreditsPage />)} />
        <Route path="/privacy" element={lazyRoute(<PrivacyPage />)} />
        <Route path="/terms" element={lazyRoute(<TermsPage />)} />
        {/* Alerts v1 — structure rules (level / tier / score); public, local durable. */}
        <Route path="/alerts" element={lazyRoute(<AlertsPage />)} />
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
