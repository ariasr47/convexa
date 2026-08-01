/**
 * App root — the ROUTE TABLE ONLY (ARCHITECTURE §1.2, FRONTEND_EXECUTION_CONTRACT §2). It no longer is
 * the GEX dashboard: that relocated to `ticker/TickerDashboard.tsx`. The single `<BrowserRouter>` +
 * single `<ThemeProvider>`/`<CssBaseline>` live in `main.tsx` (unchanged) — this file nests neither
 * (AC-Inv-8).
 *
 * Route shape (the binding table):
 *  - `/_ops/metrics`         → <OperatorMetrics/>   OUTSIDE the shell, declared FIRST so `/*` can't
 *                                                    shadow it, own AppBar, NOT linked (AC-Inv-7). This
 *                                                    is now the ONLY nav-less route — the operator-vs-
 *                                                    trader separation invariant lives here alone.
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
import { lazy, Suspense, type ReactElement } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { AppThemeProvider } from '@/features/auth/ThemeProvider';
import { useSettings } from '@/features/auth/useSettings';
import { Landing } from '@/pages/landing/Landing';
import { AppShell } from '@/shell/AppShell';

// Lazy page chunks (named exports mapped to lazy's `default` shape).
const TickerDashboard = lazy(() =>
  import('@/pages/ticker/TickerDashboard').then((m) => ({ default: m.TickerDashboard })),
);
const PositionsPage = lazy(() =>
  import('@/pages/positions/PositionsPage').then((m) => ({ default: m.PositionsPage })),
);
const Scanner = lazy(() => import('@/pages/scanner/Scanner').then((m) => ({ default: m.Scanner })));
const BlogPage = lazy(() => import('@/pages/blog/BlogPage').then((m) => ({ default: m.BlogPage })));
const SettingsPage = lazy(() =>
  import('@/features/auth/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const OperatorMetrics = lazy(() =>
  import('@/pages/operator-metrics/operator-metrics').then((m) => ({ default: m.OperatorMetrics })),
);

/** Minimal page-chunk loading fill — theme tokens only (`[theme-token-discipline]`), centered,
 *  quiet. Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
function RouteFallback() {
  return (
    <Box
      data-testid="route-fallback"
      sx={{ display: 'flex', justifyContent: 'center', py: 8, color: 'text.secondary' }}
    >
      <CircularProgress size={24} color="inherit" aria-label="Loading page" />
    </Box>
  );
}

/** Per-route Suspense: the boundary lives on the route ELEMENT so a loading page never unmounts
 *  or blanks the persistent shell (AC-Nav-4). */
const lazyRoute = (el: ReactElement) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

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

/** The route table only (ARCHITECTURE §1.2). Must render UNDER a Router + the auth/theme providers
 *  (supplied by <App/>). */
export function AppRoutes() {
  return (
    <Routes>
      {/* Operator-only readout — off the trader shell, unlinked. FIRST so `/*` never shadows it.
          This is the ONLY nav-less route (operator-vs-trader separation invariant). */}
      <Route path="/_ops/metrics" element={lazyRoute(<OperatorMetrics />)} />

      {/* The persistent shell group: the nav bar mounts once; pages swap in the <Outlet/>. */}
      <Route element={<AppShell />}>
        {/* Landing — OWNER DECISION (convexa-redesign): now the shell INDEX route so the persistent
            top nav shows on `/` too. Full-bleed below the bar (no width container). `/` is NEVER a
            redirect to a ticker. EAGER (the entry experience — no chunk wait on first paint). */}
        <Route index element={<Landing />} />
        {/* Bare `/ticker` → the effective default (pref-wins; unset ⇒ SPY). `/` never redirects. */}
        <Route path="/ticker" element={<DefaultTickerRedirect />} />
        <Route path="/ticker/:ticker" element={lazyRoute(<TickerDashboard />)} />
        <Route path="/positions" element={lazyRoute(<PositionsPage />)} />
        <Route path="/scanner" element={lazyRoute(<Scanner />)} />
        {/* Blog — static index (zero data work); each card is a full-document anchor to the
            standalone article HTML in `public/blog/` (static files win over the SPA fallback). */}
        <Route path="/blog" element={lazyRoute(<BlogPage />)} />
        {/* Settings — the 3 light prefs (account menu links here when signed in; viewable anonymously). */}
        <Route path="/settings" element={lazyRoute(<SettingsPage />)} />
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
