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
 *      - `/ticker`           → index redirect to `/ticker/TSLA` (bare → default TSLA, AC-Route-3)
 *      - `/ticker/:symbol`   → <TickerDashboard/>   (relocated, unchanged; URL-addressable symbol)
 *      - `/positions`        → <PositionsPage/>     (relocated PortfolioPanel, standalone wrapper)
 *      - `/scanner`          → <Scanner/>           (static coming-soon)
 *
 * The live-SSE session stays page-scoped to the Ticker viewer (it owns its own subscription effect);
 * making the Ticker page a child route is what gives mount-on-enter / teardown-on-leave for free.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { OperatorMetrics } from './operator-metrics';
import { Landing } from './landing/Landing';
import { AppShell } from './shell/AppShell';
import { TickerDashboard } from './ticker/TickerDashboard';
import { PositionsPage } from './positions/PositionsPage';
import { Scanner } from './scanner/Scanner';
import { SettingsPage } from './auth/SettingsPage';
import { AuthProvider } from './auth/AuthContext';
import { AuthDialogProvider } from './auth/AuthDialogProvider';
import { AppThemeProvider } from './auth/ThemeProvider';

/** The route table only (ARCHITECTURE §1.2). Must render UNDER a Router + the auth/theme providers
 *  (supplied by <App/>). */
export function AppRoutes() {
  return (
    <Routes>
      {/* Operator-only readout — off the trader shell, unlinked. FIRST so `/*` never shadows it.
          This is the ONLY nav-less route (operator-vs-trader separation invariant). */}
      <Route path="/_ops/metrics" element={<OperatorMetrics />} />

      {/* The persistent shell group: the nav bar mounts once; pages swap in the <Outlet/>. */}
      <Route element={<AppShell />}>
        {/* Landing — OWNER DECISION (convexa-redesign): now the shell INDEX route so the persistent
            top nav shows on `/` too. Full-bleed below the bar (no width container). `/` is NEVER a
            redirect to a ticker. */}
        <Route index element={<Landing />} />
        {/* Bare `/ticker` → default TSLA (index redirect; `/` itself is never redirected). */}
        <Route path="/ticker" element={<Navigate to="/ticker/TSLA" replace />} />
        <Route path="/ticker/:ticker" element={<TickerDashboard />} />
        <Route path="/positions" element={<PositionsPage />} />
        <Route path="/scanner" element={<Scanner />} />
        {/* Settings — the 3 light prefs (account menu links here when signed in; viewable anonymously). */}
        <Route path="/settings" element={<SettingsPage />} />
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
