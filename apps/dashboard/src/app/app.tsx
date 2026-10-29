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
 *                                                    Not declared by a live build on a Pages host,
 *                                                    whose proxy refuses /api/_metrics: the 404 there.
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
import { OwnerGateBoundary, RequireAuth } from '@/features/auth/RequireAuth';
import { AppThemeProvider } from '@/features/auth/ThemeProvider';
import { useSettings } from '@/features/auth/useSettings';
import { Landing } from '@/pages/landing/Landing';
import { DemoOperatorUnavailable } from '@/pages/operator-metrics/DemoOperatorUnavailable';
import { documentHostIsPages } from '@/pages/operator-session-archive/sittingBase';
import { marketDataOff } from '@/shared/dataState/marketData';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { PageColumn } from '@/shared/ui/PageColumn';
import { RouteFallback } from '@/shared/ui/RouteFallback';
import { AppShell } from '@/shell/AppShell';
import { dataMode } from '@convexa/api';
import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

/**
 * One loader per lazy page module. Each `lazy()` below calls its loader and `preloadRoutes` calls the
 * same one, so a preloaded module is the module the route renders. A spec that mounts <App/> preloads
 * the pages it opens in `beforeAll`; otherwise a page's first import runs inside the spec's first
 * `findBy` wait and flakes under load (docs/testing/2026-10-22/TEST_PLAN.md section 6.1, batch 1).
 */
export const routeLoaders = {
  TickerDashboard: () => import('@/pages/ticker/TickerDashboard'),
  PublicDesk: () => import('@/pages/ticker/public-desk/PublicDesk'),
  DemoSymbolMissing: () => import('@/pages/ticker/DemoSymbolMissing'),
  TechnicalAnalysisView: () => import('@/pages/ticker/technical-analysis/TechnicalAnalysisView'),
  ResearchView: () => import('@/pages/ticker/research/ResearchView'),
  TechnicalAnalysisLive: () => import('@/pages/ticker/technical-analysis/TechnicalAnalysisLive'),
  NotesView: () => import('@/pages/research/NotesView'),
  ResearchIndexPage: () => import('@/pages/research/ResearchIndexPage'),
  ScorecardPage: () => import('@/pages/research/ScorecardPage'),
  MarketsPage: () => import('@/pages/research/MarketsPage'),
  FilingsPage: () => import('@/pages/research/FilingsPage'),
  PositionsPage: () => import('@/pages/positions/PositionsPage'),
  Scanner: () => import('@/pages/scanner/Scanner'),
  ScannerNotLive: () => import('@/pages/scanner/ScannerNotLive'),
  BlogPage: () => import('@/pages/blog/BlogPage'),
  BlogPostPage: () => import('@/pages/blog/BlogPostPage'),
  MethodologyPage: () => import('@/pages/methodology/MethodologyPage'),
  AlertsPage: () => import('@/pages/alerts/AlertsPage'),
  SettingsPage: () => import('@/features/auth/SettingsPage'),
  OperatorMetrics: () => import('@/pages/operator-metrics/operator-metrics'),
  OperatorSessionArchive: () => import('@/pages/operator-session-archive/OperatorSessionArchive'),
  CreditsPage: () => import('@/pages/trust/CreditsPage'),
  PrivacyPage: () => import('@/pages/trust/PrivacyPage'),
  TermsPage: () => import('@/pages/trust/TermsPage'),
  NotFound: () => import('@/pages/not-found/NotFound'),
};

export type RouteModule = keyof typeof routeLoaders;

/** Imports the named page modules ahead of a render and resolves once all are loaded. It resolves to
 *  nothing, so a `beforeAll(() => preloadRoutes([...]))` is never read as a teardown function. */
export async function preloadRoutes(names: readonly RouteModule[]): Promise<void> {
  await Promise.all(names.map((name) => routeLoaders[name]()));
}

// Lazy page chunks (named exports mapped to lazy's `default` shape).
const TickerDashboard = lazy(() =>
  routeLoaders.TickerDashboard().then((m) => ({ default: m.TickerDashboard })),
);
const PublicDesk = lazy(() => routeLoaders.PublicDesk().then((m) => ({ default: m.PublicDesk })));
const DemoSymbolMissing = lazy(() =>
  routeLoaders.DemoSymbolMissing().then((m) => ({ default: m.DemoSymbolMissing })),
);
const TechnicalAnalysisView = lazy(() =>
  routeLoaders.TechnicalAnalysisView().then((m) => ({ default: m.TechnicalAnalysisView })),
);
const ResearchView = lazy(() =>
  routeLoaders.ResearchView().then((m) => ({ default: m.ResearchView })),
);
const TechnicalAnalysisLive = lazy(() =>
  routeLoaders.TechnicalAnalysisLive().then((m) => ({ default: m.TechnicalAnalysisLive })),
);
const NotesView = lazy(() => routeLoaders.NotesView().then((m) => ({ default: m.NotesView })));
const ResearchIndexPage = lazy(() =>
  routeLoaders.ResearchIndexPage().then((m) => ({ default: m.ResearchIndexPage })),
);
const ScorecardPage = lazy(() =>
  routeLoaders.ScorecardPage().then((m) => ({ default: m.ScorecardPage })),
);
const MarketsPage = lazy(() =>
  routeLoaders.MarketsPage().then((m) => ({ default: m.MarketsPage })),
);
const FilingsPage = lazy(() =>
  routeLoaders.FilingsPage().then((m) => ({ default: m.FilingsPage })),
);
const PositionsPage = lazy(() =>
  routeLoaders.PositionsPage().then((m) => ({ default: m.PositionsPage })),
);
const Scanner = lazy(() => routeLoaders.Scanner().then((m) => ({ default: m.Scanner })));
const ScannerNotLive = lazy(() =>
  routeLoaders.ScannerNotLive().then((m) => ({ default: m.ScannerNotLive })),
);
const BlogPage = lazy(() => routeLoaders.BlogPage().then((m) => ({ default: m.BlogPage })));
const BlogPostPage = lazy(() =>
  routeLoaders.BlogPostPage().then((m) => ({ default: m.BlogPostPage })),
);
const MethodologyPage = lazy(() =>
  routeLoaders.MethodologyPage().then((m) => ({ default: m.MethodologyPage })),
);
const AlertsPage = lazy(() => routeLoaders.AlertsPage().then((m) => ({ default: m.AlertsPage })));
const SettingsPage = lazy(() =>
  routeLoaders.SettingsPage().then((m) => ({ default: m.SettingsPage })),
);
const OperatorMetrics = lazy(() =>
  routeLoaders.OperatorMetrics().then((m) => ({ default: m.OperatorMetrics })),
);
const OperatorSessionArchive = lazy(() =>
  routeLoaders.OperatorSessionArchive().then((m) => ({ default: m.OperatorSessionArchive })),
);
const CreditsPage = lazy(() =>
  routeLoaders.CreditsPage().then((m) => ({ default: m.CreditsPage })),
);
const PrivacyPage = lazy(() =>
  routeLoaders.PrivacyPage().then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() => routeLoaders.TermsPage().then((m) => ({ default: m.TermsPage })));
const NotFound = lazy(() => routeLoaders.NotFound().then((m) => ({ default: m.NotFound })));

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
 *  cover says so instead of failing to load. On a live build every route the full desk reads is
 *  behind the owner gate, so the desk gives way to its wall once the gate refuses this session:
 *  the sign-in wall signed out, the owner's wall for any other account (`OwnerGateBoundary`). */
function TickerDeskRoute() {
  const { ticker = '' } = useParams();
  const mode = useMarketDataMode();
  const symbol = ticker.toUpperCase();
  // The route's one title, set before any branch (spec 2026-10-21/02, part (e)).
  useDocumentTitle(`${symbol} — Convexa`);
  const demoCovers = (STAGING_DEMO_SYMBOLS as readonly string[]).includes(symbol);
  if (dataMode === 'demo')
    return demoCovers ? <TickerDashboard /> : <DemoSymbolMissing ticker={ticker} />;
  if (mode === null) return <RouteFallback />;
  if (marketDataOff(mode)) return <PublicDesk feed={mode === 'paused' ? 'paused' : 'not_live'} />;
  return (
    <OwnerGateBoundary
      surface={`the ${symbol} desk`}
      demoPath={demoCovers ? `/ticker/${symbol}` : '/ticker'}
      freePath={{
        to: `/ticker/${encodeURIComponent(symbol)}/research`,
        label: `Read ${symbol} research`,
      }}
    >
      <TickerDashboard />
    </OwnerGateBoundary>
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
  useDocumentTitle(`${symbol.toUpperCase()} technical — Convexa`);
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

/**
 * Whether this origin can serve `/_ops/metrics`. The page polls a same-origin GET /api/_metrics,
 * which the Pages proxy answers 404 on every Pages host, by design (functions/api/[[path]].ts: the
 * operator reads the API's own address). There the live build doesn't declare the route, so the
 * address gets the site's 404 instead of a page that can only fail and log a 404 every five seconds
 * (site audit 2026-10-25, SEC-7). The demo's notice stays; a dev server or a local stack, whose /api
 * reaches the API itself, keeps the page.
 */
const OPS_METRICS_SERVED =
  dataMode === 'demo' ||
  !documentHostIsPages(typeof window === 'undefined' ? '' : window.location.host);

/** The route table only (ARCHITECTURE §1.2). Must render UNDER a Router + the auth/theme providers
 *  (supplied by <App/>). */
export function AppRoutes() {
  return (
    <Routes>
      {/* Operator routes — off the trader shell, unlinked. FIRST so `/*` never shadows them. */}
      {OPS_METRICS_SERVED && (
        <Route
          path="/_ops/metrics"
          element={
            dataMode === 'demo' ? <DemoOperatorUnavailable /> : lazyRoute(<OperatorMetrics />)
          }
        />
      )}
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
            <RequireAuth
              surface="your positions"
              demoPath="/positions"
              docTitle="Positions — Convexa"
            >
              {lazyRoute(<PositionsPage />)}
            </RequireAuth>
          }
        />
        <Route
          path="/scanner"
          element={
            <RequireAuth surface="the scanner" demoPath="/scanner" docTitle="Scanner — Convexa">
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
