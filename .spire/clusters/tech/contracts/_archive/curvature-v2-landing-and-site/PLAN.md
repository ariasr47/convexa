# curvature-v2-landing-and-site — implementation plan

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/SPEC.md` (approved 2026-09-10, R4 pass 3;
owner rulings D-B = (A) static SVG isometric hero, D-A = (A) no draft slots)
**Interface:** `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/INTERFACE_CONTRACT.md` — `NO_BACKEND_CHANGE`
**Context pack:** `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/_context-pack.md`
**Branch:** `spire/curvature-v2-landing-and-site` (planned 2026-09-10 in a worktree; built in the main working tree)

---

## Goal

Rebuild Convexa's six public-facing surfaces — landing `/`, blog index `/blog`, methodology `/methodology`,
the route fallback + a new 404, the `RequireAuth` wall, and the footer — to Curvature Terminal v2, so an
anonymous visitor meets the product's own hero instrument, the primary action opens a free ticker instead of a
sign-in wall, and every product route has a v2 fallback.

## Architecture shape

Frontend only. After this change the six surfaces read from exactly two sources: **module-frozen literals**
compiled into the bundle (`pages/landing/samples.ts`, the blog array, `pages/methodology/copy.ts`, the 404 copy)
and **the theme** (`extrasFor(theme)` / palette slots). The one exception is the auth wall, which reads the
app-wide `useAuth()` the provider already fires once at `app.tsx:197`. Everything else is a **non-edge**: no
`fetch`, no `EventSource`, no store, no page-mounted provider, no `@convexa/api` import, no `features/trading`
import — enforced by a build-breaking ESLint deny-list plus the shipped strict-fetch harness. The footer moves
from `Landing.tsx` to a single `AppShell` mount; a catch-all route joins the shell group; `RouteFallback` moves
out of `app.tsx` into `shared/ui/`; `RequireAuth` gains a holding branch and a degraded branch.

## Stack this binds

React 19 + Vite 8 + MUI/Emotion 9 + react-router-dom 7, Nx 23 workspace, Vitest 4 (jsdom + a node-environment
arm for the disk-reading structural specs), Playwright 1.62 for e2e/a11y/visual, ESLint 9 flat config.
Node ≥ 24. No new runtime dependency is added by this feature — that is a build constraint (SPEC §2.3), and
§7 item 3 asserts it against `package.json`.

---

## Global Constraints

Both lanes inherit these. The `## Conformance spec` block below is copied **verbatim** from
`INTERFACE_CONTRACT.md` (GATE PLAN law) — it is the binding shape, not a paraphrase.

### Copied verbatim from `INTERFACE_CONTRACT.md`

> ## Conformance spec
>
> Machine-checkable against the live backend at G1. This is the **existing** contract of the endpoint the
> wall already consumes, restated here so `interface_conformance.mjs` has something real to check — an
> empty `endpoints` array exits 2 ("spec has no endpoints"), which is a configuration error, not evidence.
> No `auth` flag: the anonymous 200 is the property the wall depends on, and marking it `auth` would send
> a session to the one endpoint whose anonymous behaviour is the thing under test.
>
> ```json
> {
>   "endpoints": [
>     {
>       "method": "GET",
>       "path": "/api/auth/session",
>       "path_params": {},
>       "query": {},
>       "required": {
>         "authenticated": "boolean",
>         "google_available": "boolean",
>         "user": "object|null",
>         "settings": "object|null"
>       }
>     }
>   ]
> }
> ```
>
> **Reading the block.** `user` and `settings` are `object|null` because an anonymous session returns
> both as JSON `null` and a signed-in session returns objects; a *missing* key is a FAIL either way,
> which is the regression this pin exists to catch. `demo_seed` is deliberately omitted — it is optional
> in the schema and no surface in this feature reads it.

### Standing constraints

1. **`apps/api` diff stays 0.** `git diff --stat main -- apps/api` must print nothing at every commit.
   Reading `libs/quant-engine/src/signals.rs` and `apps/api/src/config.rs` from disk is a read, not an edit.
2. **`libs/quant-engine` diff stays 0** for the same reason (V-2 reads it; nothing writes it).
3. **`[theme-token-discipline]`** — every colour and type value from `tokens.ts` through palette slots or
   `extrasFor(theme)`; **zero hardcoded hex**, including inside the `<noscript>` block.
4. **`[single-motion-moment]`** — the `HeroCurve` draw stays the one orchestrated moment; **zero**
   data-signal keyframes on the six surfaces. `GammaSurfaceHero` uses no `keyframes`, no
   `requestAnimationFrame`, no `useEffect` (`single-motion-moment.spec.ts:152` pins emotion's `keyframes`
   helper to `HeroCurve` alone — a second consumer red-builds).
5. **`[structural-over-prose-enforcement]`** — every "must not" in the SPEC is paired with a named
   build-breaking mechanism, and **each must be proven to bite**: poison the thing it forbids in a fixture
   and the check must go red. A guard that cannot demonstrate it bites is not enforcement.
6. **`[live-vs-static-isolation]` / `[present-is-live-paid-only]`** — frozen samples carry no offline,
   pause, stale or `unavailable` treatment. Every landing figure passes `NOT_LIVE`
   (`@/shared/liveness/liveClaim:29`).
7. **`[no-real-order-path]`** — the AI-read sample renders a *picture* of a CTA: non-focusable
   `<span>`/`<div>`, never `<button>`/`<a>`, no `tabIndex`, no `href`, no `onClick`.
8. **Deliberate pin edits, never waivers.** Where this feature makes a shipped pin stale
   (`radius-scale.spec.ts` `PILL_SITES`, `landing-structure.spec.tsx`'s `VALUE_CARD_RAW` glob, the
   `dashboard-e2e` frozen inventory), the pin is **edited in the same commit with the reason in the diff**.
   Narrowing a scan or adding a waiver is a plan violation.
9. **No ticker file is edited.** `apps/dashboard/src/app/pages/ticker/**` is read-only for this feature
   (SPEC §2.2) — that is what keeps the desk visual baselines off this feature's account.
10. **Copy pins.** A string the SPEC **quotes** in §4 is pinned to those bytes (AC-C1). A string marked
    "verbatim from `<file>:<line>`" is pinned to the design source's bytes (AC-C1a) and is **copied**, never
    retyped. Where a quote deviates from the cited line, the quote governs.

---

## Standing facts this plan is built around (not re-litigated)

**SF-1 — the visual receipt flow cannot run on the build machine.**
`apps/dashboard-e2e/visual-review/schemas/authorization.schema.json:22` pins
`"platform": { "enum": ["win32", "linux"] }`. The build lanes run on darwin (macOS 26, Apple Silicon), so no
authorization receipt can be authored here and `browser:visual:update` cannot legally produce candidates.
Therefore: **`npm run browser:visual` is expected to FAIL locally on the `landing` scenario — and on any other
of the six whose pixels this change moves — and that failure is recorded as evidence, not fixed.** No lane may
write, overwrite, delete or regenerate a baseline PNG. Re-acceptance happens on the owner's Windows box through
the two-stage human receipt flow (`apps/dashboard-e2e/visual-review/README.md`).

**SF-2 — a repair lane is in flight on `main`.**
`fix/fidelity-repair-2` (review findings N1–N7) touches
`apps/dashboard/src/app/pages/ticker/**`, `apps/dashboard/src/app/shared/ui/Widget/**`,
`apps/dashboard/src/app/pages/ticker/widgets/_kit/**`, `apps/dashboard/src/app/features/trading/orders/**`
and `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`. Every task in this plan whose write paths or
read-couplings touch those trees carries `Depends on: fidelity-repair-2 merge` and is `Independent: no`.
Two tasks are affected: **F14** (reads `widgets/_kit/distanceToLevel.ts`) and **F15** (writes
`quality/fixtures/scenarios.ts`).

---

## Backend track — EMPTY BY CONTRACT

**There is no backend work in this feature, and none may be invented.**
`INTERFACE_CONTRACT.md` is `NO_BACKEND_CHANGE`: no endpoint is added, no request or response shape changes,
and no server code is touched. The one endpoint any surface here consumes — `GET /api/auth/session` — already
ships and is consumed unchanged through `getSession()` (`libs/api/src/lib/convexa.ts:1038-1042`). The wall's
new degraded branch reads `subsystemDegraded`, a flag `AuthContext.tsx:118` **already sets** and nothing reads
today; the `Try again` control calls the provider's existing `refresh()`.

The backend lane's contribution is therefore an **assertion, not a change**, and it lives in the verification
track as V-1: `git diff --stat main -- apps/api libs/quant-engine` prints nothing.

A lane that finds itself needing a field, an endpoint or a status this contract does not name **stops and
amends `INTERFACE_CONTRACT.md` first** (GATE Z, a visible file-level event) — it does not read an undeclared
field from a response.

---

## Frontend track

Every task carries its own cycle: **write the failing test → run it, watch it fail → implement minimally →
run it, watch it pass → commit.** Commit messages use `feat(landing):` / `fix(shell):` / `test(...)` prefixes.

Paths below are repo-relative from `/Users/rodrigoarias/dev/convexa-landing-wt`.
Dashboard sources are under `apps/dashboard/src/app/`; the `@/` alias maps to that directory.

---

### F1 — the import deny-list (lane prerequisite, runs first)

**Deliverable:** a build-breaking ESLint `no-restricted-imports` rule scoped to the four page folders, proven
to bite, plus the one mechanical import flip it forces.

**Why first:** every other frontend task writes under a folder this rule governs. Landing it after the pages
would let a banned import ship and be discovered at the gate.

**Files**
- `eslint.config.mjs` (repo root)
- `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx` (one line)
- `apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts` (new)

**Step 1 — write the failing probe.** Create
`apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts`:

```ts
/**
 * SPEC §2.1 — the four public-surface folders are barred from the transport. The ESLint rule is the
 * build-breaking half; this spec is the anti-vacuity half: it proves the rule EXISTS with the exact
 * specifier list, and that no shipped source under those folders already violates it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ROOT = workspaceRoot();
const ESLINT_CONFIG = readFileSync(resolve(ROOT, 'eslint.config.mjs'), 'utf8');

/** The specifiers the rule must name — alias AND relative form (the broker-option-grouping GATE Q
 *  finding: `patterns.group` entries are literal specifiers, not path-normalizing). */
const REQUIRED_SPECIFIERS = [
  '@convexa/api',
  '@/pages/*',
  '@/pages/*/**',
  '../*/**',
  '@/features/trading/*',
  '@/features/trading/*/**',
  '../../features/trading/*',
  '../../features/trading/*/**',
  '@/features/auth/AuthContext',
  '../../features/auth/AuthContext',
] as const;

const SURFACE_SOURCES = import.meta.glob(
  ['/src/app/pages/{landing,blog,methodology,not-found}/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('SPEC §2.1 — the public-surface import deny-list', () => {
  it('the rule block names the four surface folders', () => {
    expect(ESLINT_CONFIG).toContain('pages/landing/**');
    expect(ESLINT_CONFIG).toContain('pages/blog/**');
    expect(ESLINT_CONFIG).toContain('pages/methodology/**');
    expect(ESLINT_CONFIG).toContain('pages/not-found/**');
  });

  it('every banned specifier — alias AND relative — is listed', () => {
    for (const s of REQUIRED_SPECIFIERS) {
      expect(ESLINT_CONFIG, `${s} missing from the deny-list`).toContain(`'${s}'`);
    }
  });

  it('the two ALLOWED auth modules are NOT banned (SPEC §2.1 — capability, not folder)', () => {
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/copy'");
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/AuthDialogProvider'");
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/*'");
  });

  it('the glob is not vacuous and no shipped surface source imports a banned specifier', () => {
    expect(Object.keys(SURFACE_SOURCES).length).toBeGreaterThanOrEqual(3);
    const violations = Object.entries(SURFACE_SOURCES).filter(([, src]) =>
      /from\s+['"](?:@convexa\/api|@\/pages\/|@\/features\/trading\/|@\/features\/auth\/AuthContext)/.test(
        src,
      ),
    );
    expect(violations.map(([f]) => f)).toEqual([]);
  });
});
```

Run `npx nx test @convexa/dashboard -- curvature-v2-deny-list` — **all four cases fail** (no rule block yet,
and `MethodologyPage.tsx:6` still imports `@/pages/methodology/copy`).

**Step 2 — add the rule.** Append this object to the array exported from `eslint.config.mjs`, after the
existing broker-option-grouping blocks:

```js
  // ---- curvature-v2-landing-and-site · SPEC §2.1 — the public-surface deny-list ------------------
  // The four public surfaces are a ZERO-EDGE tree: no transport, no sibling page, no trading domain,
  // no auth TRANSPORT. `features/auth/copy` (a pure string module) and `features/auth/AuthDialogProvider`
  // (an opener) are DELIBERATELY allowed — the invariant is about a capability, not a folder, and the
  // landing's closed-signups sentence must render from the imported AUTH_COPY literal, not a retyped one.
  //
  // Both the alias form AND the relative form are listed: `patterns.group` entries are literal
  // specifiers, not path-normalizing (the broker-option-grouping GATE Q finding recorded above).
  // Intra-folder imports use RELATIVE paths (`./copy`), which is why `@/pages/*/**` can be banned whole.
  {
    files: [
      '**/pages/landing/**/*.{ts,tsx}',
      '**/pages/blog/**/*.{ts,tsx}',
      '**/pages/methodology/**/*.{ts,tsx}',
      '**/pages/not-found/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@convexa/api', '@convexa/api/*'],
              message:
                'SPEC §2.1: the six public surfaces are a zero-edge tree — no API client, ever. The landing/blog/methodology/404 make no request.',
            },
            {
              group: ['@/pages/*', '@/pages/*/**', '../*/**'],
              message:
                'SPEC §2.1 + repo rule: pages NEVER import sibling pages. Import your own folder relatively (./copy), or promote to shared/ on the 2nd consumer.',
            },
            {
              group: [
                '@/features/trading/*',
                '@/features/trading/*/**',
                '../../features/trading/*',
                '../../features/trading/*/**',
              ],
              message:
                'SPEC §2.1: no trading domain on a marketing surface ([no-real-order-path] — a picture of a CTA never becomes a mounted TradeEntryDialog).',
            },
            {
              group: ['@/features/auth/AuthContext', '../../features/auth/AuthContext'],
              message:
                "SPEC §2.1: AuthContext owns the TRANSPORT. `@/features/auth/copy` (strings) and `@/features/auth/AuthDialogProvider` (an opener) are allowed — this ban is the capability, not the folder.",
            },
          ],
        },
      ],
    },
  },
```

**Step 3 — the one flip the rule forces.** `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx`
line 6:

```diff
-import { METHOD_COPY } from '@/pages/methodology/copy';
+import { METHOD_COPY } from './copy';
```

**Step 4 — prove the rule bites (mutation probe, not committed).** Run each of these four and confirm
ESLint reports an error, then discard the fixture:

```bash
cd /Users/rodrigoarias/dev/convexa-landing-wt
printf "import { getTicker } from '@convexa/api';\nexport const x = getTicker;\n" \
  > apps/dashboard/src/app/pages/landing/__probe.ts
npx eslint apps/dashboard/src/app/pages/landing/__probe.ts ; echo "exit=$?"   # expect exit=1
printf "import { FigureCell } from '@/pages/ticker/widgets/_kit/FigureCell';\nexport const x = FigureCell;\n" \
  > apps/dashboard/src/app/pages/landing/__probe.ts
npx eslint apps/dashboard/src/app/pages/landing/__probe.ts ; echo "exit=$?"   # expect exit=1
printf "import { AUTH_COPY } from '@/features/auth/copy';\nexport const x = AUTH_COPY;\n" \
  > apps/dashboard/src/app/pages/landing/__probe.ts
npx eslint apps/dashboard/src/app/pages/landing/__probe.ts ; echo "exit=$?"   # expect exit=0 (ALLOWED)
rm apps/dashboard/src/app/pages/landing/__probe.ts
```

Record the three exit codes in the task's commit message. **Exit codes, not printed summaries** — a rule that
prints nothing and exits 0 on the first two probes has not landed.

**Step 5 — green + commit.** `npx nx test @convexa/dashboard -- curvature-v2-deny-list` → 4 passed.
`npx nx lint @convexa/dashboard` → 0 errors. Commit
`build(lint): deny the transport, sibling pages and the trading domain on the four public surfaces`.

**Reviewer probe:** does the third fixture really exit 0? If `@/features/auth/copy` is banned, the landing's
closed-signups sentence becomes a retyped literal and reopening sign-ups becomes three edits instead of one
(SPEC §8, last bullet).

---

### F2 — route table, the relocated `RouteFallback`, and the 404 page

**Deliverable:** `RouteFallback` moved byte-identically to `shared/ui/`; every route element in the shell group
boundary-wrapped; a catch-all `*` route rendering the new 404 inside the shell.

**Files**
- `apps/dashboard/src/app/shared/ui/RouteFallback.tsx` (new)
- `apps/dashboard/src/app/pages/not-found/**` (new: `NotFound.tsx`, `copy.ts`, `not-found.spec.tsx`)
- `apps/dashboard/src/app/app.tsx` (edits)
- `apps/dashboard/src/app/route-boundaries.structural.spec.ts` (new — §7 item 7)

**Step 1 — failing test.** `apps/dashboard/src/app/pages/not-found/not-found.spec.tsx`:

```tsx
import App from '@/app';
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const json = (b: unknown) =>
  new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (i: RequestInfo | URL) => {
      if (String(i).includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      throw new Error(`Unexpected fetch from the 404: ${String(i)}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('AC-N1/AC-N2/AC-N3/AC-N5 — the 404 composition inside the shell', () => {
  it('an unmatched address renders the 404 with the nav and the footer still present', async () => {
    renderAt('/this-address-does-not-exist');
    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Nothing at this address.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });

  it('the headline is the page h1 (outline starts at level 1 — AC-G1 has zero waivers)', async () => {
    const { container } = renderAt('/nope');
    await screen.findByTestId('not-found-page');
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Nothing at this address.');
  });

  it('both actions resolve: primary → /ticker, secondary → /', async () => {
    renderAt('/nope');
    await screen.findByTestId('not-found-page');
    expect(screen.getByTestId('not-found-primary')).toHaveAttribute('href', '/ticker');
    expect(screen.getByTestId('not-found-primary')).toHaveTextContent('Open the Ticker →');
    expect(screen.getByTestId('not-found-secondary')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('not-found-secondary')).toHaveTextContent('Home');
  });

  it('AC-N5 — a retired address renders the 404, never a redirect', async () => {
    renderAt('/dashboard');
    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
  });
});
```

Run it: **4 failures** (`not-found-page` never appears; today an unmatched address renders an empty body).

**Step 2 — the copy module.** `apps/dashboard/src/app/pages/not-found/copy.ts`:

```ts
/**
 * 404 copy — SPEC §4 "404", pinned bytes (AC-C1). The arrow on the primary action is deliberate:
 * it matches the shipped forward-action convention (`RequireAuth.tsx:106` — `Open free Ticker →`),
 * over the design list's arrowless form.
 */
export const NOT_FOUND_COPY = {
  code: '404',
  headline: 'Nothing at this address.',
  body: 'The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.',
  primary: 'Open the Ticker →',
  secondary: 'Home',
} as const;
```

**Step 3 — the page.** `apps/dashboard/src/app/pages/not-found/NotFound.tsx`:

```tsx
/**
 * `*` — the 404, INSIDE the shell group so the nav and the footer stay mounted (SPEC §2.5).
 * STATIC: no fetch, no SSE, no store, no session read. Tokens only — no hex.
 *
 * The headline is the page <h1>: it is an <h2> in the artboard only because it is nested under the
 * artboard's own <h1>, and shipping that verbatim gives a document whose outline starts at level 2 —
 * an accessibility-gate regression on a feature that requires zero waivers (SPEC §4).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { NOT_FOUND_COPY } from './copy';

export function NotFound() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Nothing at this address — Convexa';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <Box
      data-testid="not-found-page"
      sx={{ maxWidth: 640, mx: 'auto', px: 3, py: { xs: 6, md: 10 } }}
    >
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary', letterSpacing: '0.12em', m: 0 }}
        >
          {NOT_FOUND_COPY.code}
        </Typography>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.01em', m: 0 }}>
          {NOT_FOUND_COPY.headline}
        </Typography>
        <Typography component="p" variant="body1" sx={{ color: 'text.secondary', m: 0 }}>
          {NOT_FOUND_COPY.body}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1, width: '100%' }}>
          <Button
            component={RouterLink}
            to="/ticker"
            variant="contained"
            size="large"
            data-testid="not-found-primary"
            sx={{ minHeight: 44 }}
          >
            {NOT_FOUND_COPY.primary}
          </Button>
          <Button
            component={RouterLink}
            to="/"
            variant="outlined"
            size="large"
            data-testid="not-found-secondary"
            sx={{ minHeight: 44 }}
          >
            {NOT_FOUND_COPY.secondary}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default NotFound;
```

**Step 4 — move `RouteFallback` byte-identically.** New file
`apps/dashboard/src/app/shared/ui/RouteFallback.tsx`:

```tsx
/**
 * RouteFallback — the minimal page-chunk loading fill. MOVED here from `app.tsx:99-108`
 * BYTE-IDENTICALLY (SPEC §2.2 item 6): same markup, same `data-testid`, same `aria-label`.
 * It was module-private in `app.tsx`, and `app.tsx` imports `RequireAuth` — so importing it back
 * would be an upward import AND a cycle. One file move, two import edits, zero render change.
 *
 * Its only string is `aria-label="Loading page"`, which asserts NOTHING about the session — which
 * is exactly why `RequireAuth` may render it while the who-am-I read is in flight (SPEC §4).
 */
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/** Minimal page-chunk loading fill — theme tokens only (`[theme-token-discipline]`), centered,
 *  quiet. Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
export function RouteFallback() {
  return (
    <Box
      data-testid="route-fallback"
      sx={{ display: 'flex', justifyContent: 'center', py: 8, color: 'text.secondary' }}
    >
      <CircularProgress size={24} color="inherit" aria-label="Loading page" />
    </Box>
  );
}

export default RouteFallback;
```

Do **not** add it to `shared/ui/index.ts`; consumers import the module path. (The barrel's contents are
scanned by `arc.spec.ts:97-104`; leaving it untouched keeps that scan's soundness argument unchanged.)

**Step 5 — `app.tsx`.** Four edits:

```diff
@@ imports
 import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
+import { RouteFallback } from '@/shared/ui/RouteFallback';
 import { AppShell } from '@/shell/AppShell';
 import Box from '@mui/material/Box';
-import CircularProgress from '@mui/material/CircularProgress';
 import { lazy, Suspense, type ReactElement } from 'react';
```

```diff
@@ lazy chunk list (after LabIndex / the demos)
+const NotFound = lazy(() =>
+  import('@/pages/not-found/NotFound').then((m) => ({ default: m.NotFound })),
+);
```

```diff
-/** Minimal page-chunk loading fill — theme tokens only (`[theme-token-discipline]`), centered,
- *  quiet. Shown inside the shell's <Outlet/> region; the nav chrome stays interactive. */
-function RouteFallback() {
-  return (
-    <Box
-      data-testid="route-fallback"
-      sx={{ display: 'flex', justifyContent: 'center', py: 8, color: 'text.secondary' }}
-    >
-      <CircularProgress size={24} color="inherit" aria-label="Loading page" />
-    </Box>
-  );
-}
-
```

```diff
@@ the shell group
-        <Route index element={<Landing />} />
+        {/* EAGER index — a BARE route ErrorBoundary, no Suspense: a Suspense here would reintroduce
+            the chunk wait the eager route exists to avoid (SPEC §2.5). Today a throw inside Landing
+            unmounts the whole React tree, because `main.tsx:16-26` adds no boundary above <App/>. */}
+        <Route
+          index
+          element={
+            <ErrorBoundary variant="route">
+              <Landing />
+            </ErrorBoundary>
+          }
+        />
         {/* Bare `/ticker` → the effective default (pref-wins; unset ⇒ SPY). `/` never redirects. */}
-        <Route path="/ticker" element={<DefaultTickerRedirect />} />
+        <Route
+          path="/ticker"
+          element={
+            <ErrorBoundary variant="route">
+              <DefaultTickerRedirect />
+            </ErrorBoundary>
+          }
+        />
```

and, as the **last child of the shell group** (after `/settings`):

```diff
         <Route path="/settings" element={lazyRoute(<SettingsPage />)} />
+        {/* Catch-all — LAST child of the shell group, so the 404 wears the nav AND the footer
+            (SPEC §2.5). The two operator routes are declared before this group and match exactly,
+            so they are unaffected; a MISTYPED operator URL falls through to this trader 404, which
+            links nothing operator-shaped. Not a redirect: an address that once existed and no
+            longer does gets the 404 and its offer — that is how a bookmark stops being a lie. */}
+        <Route path="*" element={lazyRoute(<NotFound />)} />
       </Route>
```

`Box` stays imported (`DefaultTickerRedirect` no longer needs it, but nothing else in the file uses it —
**delete the `Box` import too** if `npx nx lint` reports it unused; check the exit code, do not assume).

**Step 6 — the boundary scan (§7 item 7).**
`apps/dashboard/src/app/route-boundaries.structural.spec.ts`:

```ts
/**
 * SPEC §2.5 / §7 item 7 — EVERY route element in the shell group is either `lazyRoute(...)` or
 * explicitly `ErrorBoundary`-wrapped, so a future route added without a boundary red-builds instead
 * of being noticed. Mutation-guarded: the checker is pure and is fed both fixtures.
 */
import { describe, expect, it } from 'vitest';

const APP_RAW = import.meta.glob(['/src/app/app.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Pure checker (mutation-tested): does this `element={…}` expression carry a boundary? */
export const elementIsBounded = (expr: string): boolean =>
  expr.includes('lazyRoute(') || expr.includes('<ErrorBoundary');

/** Every `element={ … }` on a <Route …> in the file, expression text only. */
function routeElements(src: string): string[] {
  return [...src.matchAll(/element=\{([\s\S]*?)\}\s*\/?>/g)].map((m) => m[1]);
}

describe('§7 item 7 — every route element is bounded', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(APP_RAW)).toHaveLength(1);
    expect(APP_RAW['/src/app/app.tsx']).toContain('<Routes>');
  });

  it('MUTATION GUARD: the checker flags an unbounded fixture and passes a bounded one', () => {
    expect(elementIsBounded('<Landing />')).toBe(false);
    expect(elementIsBounded('lazyRoute(<BlogPage />)')).toBe(true);
    expect(elementIsBounded('<ErrorBoundary variant="route"><Landing /></ErrorBoundary>')).toBe(true);
  });

  it('the route table declares at least 18 route elements and every one is bounded', () => {
    const elements = routeElements(APP_RAW['/src/app/app.tsx']);
    expect(elements.length).toBeGreaterThanOrEqual(18);
    expect(elements.filter((e) => !elementIsBounded(e))).toEqual([]);
  });

  it('the catch-all is the LAST route in the shell group', () => {
    const src = APP_RAW['/src/app/app.tsx'];
    const star = src.indexOf('path="*"');
    const settings = src.indexOf('path="/settings"');
    expect(star).toBeGreaterThan(settings);
    expect(src.slice(star).indexOf('</Route>')).toBeGreaterThan(0);
  });

  it('RouteFallback no longer lives in app.tsx', () => {
    expect(APP_RAW['/src/app/app.tsx']).not.toContain('function RouteFallback(');
    expect(APP_RAW['/src/app/app.tsx']).toContain("from '@/shared/ui/RouteFallback'");
  });
});
```

**Step 7 — green + commit.** `npx nx test @convexa/dashboard -- not-found route-boundaries` →
**4 + 5 = 9 passed.** Commit `feat(routes): a 404 inside the shell, a boundary on every route element`.

**Reviewer probe:** the `routeElements` regex is the plan's own arithmetic. If it captures fewer than 18
elements, it is under-matching (multi-line `element={…}` blocks) and the "every one is bounded" assertion is
vacuous — that is why the count floor is asserted first. Report a mismatch; do not lower the floor.

---

### F3 — the footer mounts once, in `AppShell`

**Deliverable:** `<Footer/>` renders on every in-shell route; `Footer.tsx` itself is unchanged.

**Files**
- `apps/dashboard/src/app/shell/AppShell.tsx`
- `apps/dashboard/src/app/shell/AppShell.footer.spec.tsx` (new)

**Step 1 — failing test.** `AppShell.footer.spec.tsx` renders `<App/>` at each of
`/`, `/blog`, `/methodology`, `/alerts`, `/settings`, `/lab`, `/nope` and asserts, per route, exactly one
`site-footer`, exactly one `main`, and the three footer links (AC-F1/F2/F3/F4):

```tsx
import App from '@/app';
import { theme } from '@/shared/theme/theme';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const json = (b: unknown) =>
  new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('EventSource', class { close() {} } as unknown as typeof EventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (i: RequestInfo | URL) => {
      if (String(i).includes('/api/auth/session'))
        return json({ authenticated: false, user: null, google_available: false, settings: null });
      return json(null);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ROUTES = ['/', '/blog', '/methodology', '/alerts', '/settings', '/lab', '/nope'] as const;

describe('AC-F1/F2/F3/F4 — one footer, one main, on every in-shell page', () => {
  for (const path of ROUTES) {
    it(`${path} renders exactly one footer and exactly one main`, async () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ThemeProvider>,
      );
      const footer = await screen.findByTestId('site-footer');
      expect(container.querySelectorAll('footer')).toHaveLength(1);
      expect(container.querySelectorAll('main')).toHaveLength(1);
      // The footer is chrome: OUTSIDE the main landmark, below the instrument.
      expect(container.querySelector('main')!.contains(footer)).toBe(false);
      expect(screen.getByTestId('footer-methodology-link')).toHaveAttribute('href', '/methodology');
      expect(screen.getByTestId('footer-blog-link')).toHaveAttribute('href', '/blog');
      expect(screen.getByTestId('footer-lab-link')).toHaveAttribute('href', '/lab');
      expect(screen.getByTestId('footer-disclaimer')).toHaveTextContent(/read-only/);
      expect(screen.getByTestId('footer-disclaimer')).toHaveTextContent(/Not investment advice/);
    });
  }

  it('AC-F3 — the top nav still carries only the four product links, no Blog and no Lab', async () => {
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const nav = await screen.findByTestId('app-shell');
    for (const id of ['nav-ticker', 'nav-scanner', 'nav-positions', 'nav-alerts']) {
      expect(nav.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
    expect(nav.querySelector('[data-testid="nav-blog"]')).toBeNull();
    expect(nav.querySelector('[data-testid="nav-lab"]')).toBeNull();
  });
});
```

Run: `/` fails on **two footers / two mains** (Landing renders its own until F7) and the other six routes fail
on **no footer at all**. That is the expected pre-state; F3 makes the six pass, F7 makes `/` pass.
**Skip nothing.** Preferred order: F3 → F7 → run this spec fully green.

**Step 2 — the mount.** `AppShell.tsx`, after the `<Box component="main">` block closes:

```diff
         <Outlet />
       </Box>
+      {/* Canon rule 19 — Lab and Blog live in the footer, so the footer must reach every full page.
+          ONE mount point is what makes "reachable from every in-shell page" STRUCTURAL instead of a
+          checklist someone forgets; a route allow-list re-introduces the list. It necessarily puts a
+          footer under the ticker desk — that cost is NAMED AND PAID (SPEC §8), not hidden by
+          narrowing the criterion. Chrome, outside the <main> landmark, below the instrument. */}
+      <Footer />
     </Box>
   );
 }
```

with `import { Footer } from './Footer';` added to the imports. `AppShell` imports `Footer`, **not**
`ArcDivider` — so `arc.spec.ts:106-110`'s seam pin (`ArcDivider` importers ==
`{TrackRecordSection.tsx, Footer.tsx}`) is untouched. Verify: `npx nx test @convexa/dashboard -- arc` → green.

**Step 3 — commit.** `feat(shell): mount the footer once, so canon rule 19 is structural`.

**Reviewer probe:** run `npx nx test @convexa/dashboard -- arc` and check the exit code. If `AppShell.tsx`
grew an `ArcDivider` import, the seam pin goes red and the fix is to import `Footer`, never to edit the pin.

---

### F4 — the head, the share text, and the `<noscript>`

**Deliverable:** three v1 strings leave `apps/dashboard/index.html`; the v2 title/description ship in all six
head slots; a `<noscript>` statement with a working anchor.

**Files**
- `apps/dashboard/index.html`
- `apps/dashboard/src/app/index-head.structural.spec.ts` (new — §7 item 8)

**Step 1 — failing test.** `apps/dashboard/src/app/index-head.structural.spec.ts`:

```ts
/**
 * AC-L10 / AC-L11 / AC-L11a — §7 item 8. Positive AND negative, so neither half can pass vacuously.
 * The three v1 strings are DIFFERENT strings at different sites: an absence check written against
 * the share hook alone was always green on <title>, which never contained it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const html = INDEX_RAW['/index.html'];

const TITLE = 'Convexa — See the dealer positioning behind the price.';
const DESCRIPTION =
  'Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup.';
const V1_TITLE = 'Convexa — AI dealer-gamma analytics for options traders';
const V1_SHARE_HOOK = 'Convexa — See the AI read on your real positioning';
const V1_LIVE_CLAIM = 'live order flow';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ARTICLE = resolve(
  workspaceRoot(),
  'apps/dashboard/public/blog/how-we-read-dealer-structure.html',
);

describe('AC-L10 — the served head reads the v2 promise', () => {
  it('the glob is not vacuous', () => {
    expect(html).toContain('<html lang="en">');
  });

  it('<title>, og:title and twitter:title EQUAL the hero sentence', () => {
    expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(TITLE);
    expect(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1]).toBe(TITLE);
    expect(html.match(/<meta name="twitter:title" content="([^"]*)"/)?.[1]).toBe(TITLE);
  });

  it('description, og:description and twitter:description EQUAL the hero summary sentence', () => {
    const descs = [...html.matchAll(/content="([^"]*)"\s*\/?>/g)].map((m) => m[1]);
    expect(descs.filter((d) => d === DESCRIPTION)).toHaveLength(3);
  });

  it('all three v1 strings are gone', () => {
    expect(html).not.toContain(V1_TITLE);
    expect(html).not.toContain(V1_SHARE_HOOK);
    expect(html).not.toContain(V1_LIVE_CLAIM);
  });
});

describe('AC-L11 / AC-L11a — the no-JavaScript path', () => {
  it('a <noscript> exists, names Convexa, and anchors at the standalone article', () => {
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    expect(block, 'index.html must carry a <noscript> block').toBeTruthy();
    expect(block).toContain('Convexa');
    expect(block).toContain('/blog/how-we-read-dealer-structure.html');
    expect(block).toContain(
      'How We Read Dealer Structure — a plain page that works without JavaScript.',
    );
  });

  it('the <noscript> carries no hardcoded hex (`[theme-token-discipline]`)', () => {
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('the target document exists on disk and needs no JavaScript', () => {
    expect(existsSync(ARTICLE)).toBe(true);
    const article = readFileSync(ARTICLE, 'utf8');
    expect(article).not.toContain('<script type="module">');
    expect(article).toContain('How We Read Dealer Structure');
  });
});
```

Run: **6 of 7 fail.**

**Step 2 — the head edits.** In `apps/dashboard/index.html`:

```diff
-    <title>Convexa — AI dealer-gamma analytics for options traders</title>
+    <title>Convexa — See the dealer positioning behind the price.</title>
     <meta
       name="description"
-      content="Convexa reads dealer gamma exposure — call/put walls, the gamma flip, live order flow — plus an AI read on your positioning. An analysis tool; trades are simulated."
+      content="Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup."
     />
```

```diff
-    <meta property="og:title" content="Convexa — See the AI read on your real positioning" />
+    <meta property="og:title" content="Convexa — See the dealer positioning behind the price." />
     <meta
       property="og:description"
-      content="Dealer gamma walls, the gamma flip, live order flow, and an AI read on your positioning. An analysis tool; trades are simulated."
+      content="Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup."
     />
```

```diff
-    <meta name="twitter:title" content="Convexa — See the AI read on your real positioning" />
+    <meta name="twitter:title" content="Convexa — See the dealer positioning behind the price." />
     <meta
       name="twitter:description"
-      content="Dealer gamma walls, the gamma flip, live order flow, and an AI read on your positioning. An analysis tool; trades are simulated."
+      content="Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup."
     />
```

The share **image** and its `alt` are out of scope and unchanged.
`<meta name="theme-color" content="#0B0F17">` is unchanged — `stage1-tokens.spec.ts:97-103` pins it byte-exact
to `palette.dark.background.default`, and the first-paint script already swaps it per scheme (AC-G5).

**Step 3 — the `<noscript>`.** In `<body>`, immediately before `<div id="root"></div>`:

```html
    <noscript>
      <p>
        Convexa needs JavaScript to run. It reads options dealer positioning — the call and put
        walls, the gamma flip, and where price is pulled.
      </p>
      <p>
        <a href="/blog/how-we-read-dealer-structure.html"
          >How We Read Dealer Structure — a plain page that works without JavaScript.</a
        >
      </p>
    </noscript>
```

Plain markup. **No `style` attribute, no class, no hex** — the hex specs already glob `index.html`
(`banned-hexes.spec.ts` covers `/index.html`), and a marketing flourish nobody can see is worse than none.

**Step 4 — green + commit.** `npx nx test @convexa/dashboard -- index-head` → **7 passed.**
Then the mutation proof (three ways, run and discard): restore each of the three v1 strings into
`index.html`, confirm the "all three v1 strings are gone" case goes red, revert. Record the three red runs.
Commit `feat(seo): the v2 promise in the head, a readable page without JavaScript`.

---

### F5 — `GammaSurfaceHero` — the one hero instrument

**Deliverable:** an inline `<svg>` port of `design/src/lib.mjs:383-425`'s `gammaSurface()`: 9 tenors ×
21 strikes, closed-form `z(i,j)`/`proj(i,j)`, path strings computed **once at module load**, prop-free,
`role="img"` with an accessible name. **No WebGL, no Canvas2D, no rAF, no `useEffect`, no new dependency.**

**Files**
- `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx` (new)
- `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.spec.tsx` (new)

**Step 1 — failing test.** `GammaSurfaceHero.spec.tsx`:

```tsx
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GammaSurfaceHero } from './GammaSurfaceHero';

afterEach(() => cleanup());

const HERO_RAW = import.meta.glob(['/src/app/pages/landing/GammaSurfaceHero.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function renderHero() {
  return render(
    <ThemeProvider theme={theme}>
      <GammaSurfaceHero />
    </ThemeProvider>,
  );
}

describe('AC-L4a — the hero instrument is the dealer-gamma surface over strike × tenor', () => {
  it('renders one <svg> with role=img and the accessible name', () => {
    renderHero();
    const svg = screen.getByRole('img', { name: 'Dealer gamma surface across strike and tenor' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('carries the wireframe (9 tenor rows + 21 strike columns) and the three named ridges', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('[data-testid="gs-wire"]')).toHaveLength(30);
    for (const id of ['gs-ridge-flip', 'gs-ridge-call-wall', 'gs-ridge-put-wall']) {
      expect(container.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
  });

  it('SPEC §2.3 — the SVG paints NO text at all, and no beam/pulse marker', () => {
    const { container } = renderHero();
    expect(container.querySelectorAll('text')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('573.12');
    expect(container.innerHTML).not.toContain('568.50');
    expect(container.querySelectorAll('.beam')).toHaveLength(0);
  });

  it('the radial glow is the camelCase SVG element, NOT the hyphenated CSS function', () => {
    const src = HERO_RAW['/src/app/pages/landing/GammaSurfaceHero.tsx'];
    expect(src).toContain('radialGradient');
    expect(src).not.toContain('radial-gradient'); // landing-structure.spec.tsx's earned scan
  });

  it('SPEC §7 item 3 — no runtime surface: no getContext, no rAF, no useEffect, no arc primitive', () => {
    const src = HERO_RAW['/src/app/pages/landing/GammaSurfaceHero.tsx'];
    expect(src).not.toContain('getContext(');
    expect(src).not.toContain('requestAnimationFrame');
    expect(src).not.toContain('useEffect');
    expect(src).not.toContain('<canvas');
    expect(src).not.toContain('WebGLRenderingContext');
    expect(src).not.toContain("from '@/shared/ui/arc'"); // the 4th importer red-builds arc.spec.ts
    expect(src).not.toContain('keyframes');
  });

  it('geometry is computed ONCE at module load — two renders produce identical path data', () => {
    const a = renderHero().container.innerHTML;
    cleanup();
    const b = renderHero().container.innerHTML;
    expect(a).toBe(b);
  });
});
```

Run: **6 failures** (module does not exist).

**Step 2 — the port.** `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx`:

```tsx
/**
 * GammaSurfaceHero — THE one hero instrument (canon `DESIGN_SYSTEM.md:52-53,113`; owner ruling
 * D-B = (A), 2026-09-10). A faithful inline-SVG port of `design/src/lib.mjs:383-425`'s
 * `gammaSurface()`: the dealer-gamma surface over strike × tenor, net gamma as height, drawn in
 * depth as an isometric wireframe, with the gamma-flip / call-wall / put-wall ridges.
 *
 * BUILD CONSTRAINT, not a device-conditional state (SPEC §2.3): prop-free, static from first paint,
 * geometry computed ONCE at module load from closed-form arithmetic. No WebGL, no Canvas2D, no
 * requestAnimationFrame, no useEffect, no new runtime dependency. The one real failure mode is a
 * JavaScript throw, and the route ErrorBoundary covers it (SPEC §5).
 *
 * THREE THINGS FROM THE DESIGN SOURCE MUST NOT TRAVEL HERE, and this is enforced, not remembered:
 *   - `class="beam"` on the spot marker (`lib.mjs:429`) — an ungated data-signal keyframe;
 *   - the `panel is-live` wrapper with its `chip live` + dot (`landing.mjs:51-52`);
 *   - the two mono figures painted INTO the SVG (`lib.mjs:430-431`, `mid 573.12` / `gamma flip
 *     568.50`) — mono is the traced register, and a specific mid painted into a marketing hero is an
 *     untraceable figure wearing it.
 * THIS SVG PAINTS NO TEXT AT ALL. Legend, eyebrow and the sample disclosure are DOM text beside the
 * picture (Landing.tsx), in the accessibility tree.
 *
 * The `<radialGradient>` below is the camelCase SVG ELEMENT — invisible to
 * `landing-structure.spec.tsx`'s earned `radial-gradient` scan (the hyphenated CSS function). The
 * port is designed to stay inside that scan; the guard must not be widened to "fix" it, and the CTA
 * band's `radial-gradient(…)` wash (`landing.mjs:116`) is DROPPED, not re-admitted.
 *
 * Tokens only — every colour is a palette slot / `extrasFor(theme)` value resolved in `sx`.
 */
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';

// ---- the sample structure, from `design/src/data/index.mjs` (illustrative, frozen) -------------
const SPOT = 573.12;
const CALL_WALL = 580;
const PUT_WALL = 560;
const FLIP = 568.5;

const WIDTH = 720;
const HEIGHT = 440;
const ROWS = 9; // tenors
const COLS = 21; // strikes

const OX = WIDTH * 0.5;
const OY = HEIGHT * 0.6;
const SX = WIDTH / 34;
const SY = WIDTH / 62;
const SZ = 78;

/** Net dealer gamma as height — `lib.mjs:387-394`, unchanged. */
function z(i: number, j: number): number {
  const k = 550 + (j * 50) / (COLS - 1);
  const tenor = i / (ROWS - 1);
  const d = k - FLIP - tenor * 4;
  const call = Math.exp(-((k - CALL_WALL - tenor * 3) ** 2) / 34);
  const put = -Math.exp(-((k - PUT_WALL + tenor * 2) ** 2) / 44);
  return (d >= 0 ? call : put) * (1 - tenor * 0.55) + Math.sign(d) * 0.08;
}

/** The isometric projection — `lib.mjs:395-399`, unchanged. Three axes in ONE projection: strike
 *  across `j`, tenor across `i`, net dealer gamma as height through `z(i, j)`. */
function proj(i: number, j: number): [number, number] {
  const u = j - (COLS - 1) / 2;
  const v = i - (ROWS - 1) / 2;
  return [OX + (u - v) * SX * 0.72, OY + (u + v) * SY * 0.5 - z(i, j) * SZ];
}

interface Wire {
  d: string;
  opacity: number;
}

/** Computed ONCE at module load — never per render, never per frame. */
const WIRES: Wire[] = (() => {
  const out: Wire[] = [];
  for (let i = 0; i < ROWS; i++) {
    let d = '';
    for (let j = 0; j < COLS; j++) {
      const [x, y] = proj(i, j);
      d += `${j ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out.push({ d, opacity: Number((0.25 + (1 - i / ROWS) * 0.55).toFixed(2)) });
  }
  for (let j = 0; j < COLS; j++) {
    let d = '';
    for (let i = 0; i < ROWS; i++) {
      const [x, y] = proj(i, j);
      d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out.push({ d, opacity: 0.22 });
  }
  return out;
})();

/** A ridge at a target strike — `lib.mjs:411-421`, minus the drop-shadow filter. */
function ridgePath(kTarget: number): string {
  let d = '';
  for (let i = 0; i < ROWS; i++) {
    const j = ((kTarget - 550) / 50) * (COLS - 1);
    const j0 = Math.floor(j);
    const t = j - j0;
    const [x0, y0] = proj(i, j0);
    const [x1, y1] = proj(i, Math.min(COLS - 1, j0 + 1));
    d += `${i ? 'L' : 'M'} ${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t).toFixed(1)} `;
  }
  return d;
}

const RIDGE_FLIP = ridgePath(FLIP);
const RIDGE_CALL = ridgePath(CALL_WALL);
const RIDGE_PUT = ridgePath(PUT_WALL);
/** The spot marker position — a quiet dot, NO `beam` class, NO pulse, NO painted figure. */
const [SPOT_X, SPOT_Y] = proj(0, ((SPOT - 550) / 50) * (COLS - 1));

export function GammaSurfaceHero() {
  return (
    <Box
      component="svg"
      role="img"
      aria-label="Dealer gamma surface across strike and tenor"
      aria-describedby="gs-sample-caption"
      data-testid="gamma-surface-hero"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="gs-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Box
        component="rect"
        width={WIDTH}
        height={HEIGHT}
        fill="url(#gs-glow)"
        sx={{ color: (t) => extrasFor(t).textAmber }}
      />
      {WIRES.map((w, n) => (
        <Box
          key={n}
          component="path"
          data-testid="gs-wire"
          d={w.d}
          fill="none"
          strokeWidth={1}
          strokeOpacity={w.opacity}
          sx={{ stroke: 'text.secondary' }}
        />
      ))}
      <Box
        component="path"
        data-testid="gs-ridge-put-wall"
        d={RIDGE_PUT}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        sx={{ stroke: (t) => t.palette.error.main }}
      />
      <Box
        component="path"
        data-testid="gs-ridge-call-wall"
        d={RIDGE_CALL}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        sx={{ stroke: (t) => t.palette.success.main }}
      />
      <Box
        component="path"
        data-testid="gs-ridge-flip"
        d={RIDGE_FLIP}
        fill="none"
        strokeWidth={2.25}
        strokeLinecap="round"
        sx={{ stroke: (t) => extrasFor(t).textAmber }}
      />
      <Box
        component="circle"
        data-testid="gs-spot"
        cx={SPOT_X.toFixed(1)}
        cy={SPOT_Y.toFixed(1)}
        r={5}
        sx={{ fill: 'primary.main' }}
      />
    </Box>
  );
}

export default GammaSurfaceHero;
```

**Step 3 — green + commit.** `npx nx test @convexa/dashboard -- GammaSurfaceHero` → **6 passed.**
Also run `npx nx test @convexa/dashboard -- arc single-motion-moment` → green (the hero adds no arc importer
and no emotion `keyframes` consumer). Commit
`feat(landing): the dealer-gamma surface as a static inline SVG isometric projection`.

**Reviewer probe:** `t.palette.error.main` / `success.main` stand in for the design's `--down` / `--up`.
Confirm against `shared/theme/tokens.ts` that those are the app's signed-direction slots — a wrong slot here
puts green on the put wall, which inverts the read. If they are not, use the level palette's own token keys
(`resolveLevelPalette`), and report the correction rather than hardcoding a colour.

---

### F6 — the landing's frozen samples and its three sample panels

**Deliverable:** `samples.ts` (module-level `as const` constants only — no function, no store, no
session-derived prop) plus the three landing-local sample compositions.

**Files**
- `apps/dashboard/src/app/pages/landing/samples.ts` (new)
- `apps/dashboard/src/app/pages/landing/ScoreStripSample.tsx` (new)
- `apps/dashboard/src/app/pages/landing/AiReadSample.tsx` (new)
- `apps/dashboard/src/app/pages/landing/StructureFieldSample.tsx` (new)
- `apps/dashboard/src/app/pages/landing/landing-samples.spec.tsx` (new)

**Step 0 — regenerate the frozen field profile and check it against this plan.** Run:

```bash
cd /Users/rodrigoarias/dev/convexa-landing-wt
node --input-type=module -e "import {gexProfile} from './design/src/lib.mjs'; console.log(JSON.stringify(gexProfile()));"
```

Expected output (21 pairs, `k` → `v`) — this is the plan's own arithmetic, stated so a mismatch is a
**reportable plan/tree conflict, not a silent correction**:

```
550→-61  552.5→-123  555→-233  557.5→-357  560→-430  562.5→-367  565→-235  567.5→-103
570→68   572.5→158   575→332   577.5→488   580→500   582.5→394   585→233   587.5→112
590→58   592.5→43    595→40    597.5→40    600→40
```

If the command's output differs, **use the command's output** and note the delta in the commit message.

**Step 1 — failing test.** `landing-samples.spec.tsx` (9 cases):

```tsx
import { NOT_LIVE } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiReadSample } from './AiReadSample';
import { FLIP_DISTANCE_LABEL, ScoreStripSample } from './ScoreStripSample';
import { LANDING_FIELD_MODEL } from './samples';
import { StructureFieldSample } from './StructureFieldSample';

afterEach(() => cleanup());
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('SPEC §2.2 — samples.ts is frozen literals only', () => {
  it('the field model carries the honesty flags the mount depends on', () => {
    expect(LANDING_FIELD_MODEL.live).toBe(false);
    expect(LANDING_FIELD_MODEL.liveMid).toBeNull();
    expect(LANDING_FIELD_MODEL.source).toBe('demo');
    expect(LANDING_FIELD_MODEL.asOfSec).toBeNull();
    expect(LANDING_FIELD_MODEL.samples).toHaveLength(21);
  });

  it('every landing figure passes NOT_LIVE — a frozen sample cannot render a live dot', () => {
    expect(NOT_LIVE.live).toBe(false);
  });
});

describe('AC-L5 / AC-L5a — the sample panels claim nothing they cannot support', () => {
  it('the score strip prints the derived flip distance, never a hand-typed one', () => {
    wrap(<ScoreStripSample />);
    expect(screen.getByTestId('sample-flip-distance')).toHaveTextContent(FLIP_DISTANCE_LABEL);
    expect(screen.queryByText('−0.81%')).toBeNull();
  });

  it('the score strip carries the shipped tier row and the caption, and NO ring gauge', () => {
    const { container } = wrap(<ScoreStripSample />);
    for (const t of ['Dormant', 'Watch', 'Actionable', 'Prime']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.getByText('0–100 triage score · not a trade signal')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(0); // no ring gauge, no icon geometry
  });

  it('AC-L4 — the CTA-shaped elements in the AI-read sample are NOT controls', () => {
    const { container } = wrap(<AiReadSample />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(screen.getByText('Review simulated trade')).toBeInTheDocument();
  });

  it('the AI-read sample keeps SIMULATED and the AI-stated · untraced caption', () => {
    wrap(<AiReadSample />);
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.getByText('AI-stated · untraced')).toBeInTheDocument();
  });

  it('the AI-read panel head carries its OWN sample literal, not the shared one', () => {
    wrap(<AiReadSample />);
    expect(screen.getByText('Illustrative sample — not a real model output.')).toBeInTheDocument();
  });

  it('SPEC §2.4 — the field mounts calm and embedded, with the frozen model', () => {
    const { container } = wrap(<StructureFieldSample />);
    expect(screen.getByText('Structure field')).toBeInTheDocument();
    expect(
      screen.getByText('Illustrative sample — not a live read and not a recorded session.'),
    ).toBeInTheDocument();
    // The suppressed canvas copy must not appear anywhere on `/`.
    for (const banned of ['demo as-of', 'synthetic demo', 'TAPE OFF']) {
      expect(container.textContent).not.toContain(banned);
    }
  });

  it('no as-of, no live chip, no pause mark on any sample panel', () => {
    const { container } = wrap(
      <>
        <ScoreStripSample />
        <AiReadSample />
      </>,
    );
    expect(container.querySelector('[data-testid="live-dot"]')).toBeNull();
    expect(container.querySelector('[data-testid="pause-mark"]')).toBeNull();
    expect(container.textContent).not.toContain('as-of');
  });
});
```

**Step 2 — `samples.ts`.**

```ts
/**
 * The frozen sample values every landing composition reads (SPEC §2.2 item 2).
 * MODULE-LEVEL `as const` CONSTANTS ONLY: no function, no store, no props derived from a session
 * read. `/` reads NO session fact at all, so nothing here can vary per visitor.
 *
 * The numbers are the design source's own illustrative SPY structure
 * (`design/src/data/index.mjs:2-8`) and its net-GEX profile (`design/src/lib.mjs:238-246`,
 * regenerated at build time and pasted here). They are ILLUSTRATIVE: every panel that shows them
 * carries a sample mark, and `[live-vs-static-isolation]` bars any offline/pause/stale treatment —
 * those literals mean "we tried and failed", and a frozen sample never tried.
 */
import type { StructureFieldModel } from '@/shared/charts/structure-field';

export const LANDING_SAMPLE = {
  symbol: 'SPY',
  spot: 573.12,
  callWall: 580,
  putWall: 560,
  gammaFlip: 568.5,
  score: 72,
  tier: 'Actionable',
  ivHv: '0.82',
  volOi: '0.61×',
} as const;

/** 21 strikes × net GEX — `design/src/lib.mjs:238-246` at `SPY.strikes`, rounded as that source
 *  rounds. Frozen: poison one value and the sample-figure equality spec must move (§7 item 14). */
export const LANDING_FIELD_SAMPLES = [
  { strike: 550, netGex: -61 },
  { strike: 552.5, netGex: -123 },
  { strike: 555, netGex: -233 },
  { strike: 557.5, netGex: -357 },
  { strike: 560, netGex: -430 },
  { strike: 562.5, netGex: -367 },
  { strike: 565, netGex: -235 },
  { strike: 567.5, netGex: -103 },
  { strike: 570, netGex: 68 },
  { strike: 572.5, netGex: 158 },
  { strike: 575, netGex: 332 },
  { strike: 577.5, netGex: 488 },
  { strike: 580, netGex: 500 },
  { strike: 582.5, netGex: 394 },
  { strike: 585, netGex: 233 },
  { strike: 587.5, netGex: 112 },
  { strike: 590, netGex: 58 },
  { strike: 592.5, netGex: 43 },
  { strike: 595, netGex: 40 },
  { strike: 597.5, netGex: 40 },
  { strike: 600, netGex: 40 },
] as const;

/**
 * The model the shipped canvas receives. THE FLAGS ARE NECESSARY BUT NOT SUFFICIENT (SPEC §2.4):
 * `paintStep.ts:850-858` drifts a phosphor grain off `now` under `if (!reduced && !calm)` with no
 * `m.live` term in the gate, and `calm` is DERIVED from `variant === 'ticker'`, not a prop. The
 * mount's `variant='ticker'` is the single lever that kills the grain AND suppresses the canvas's
 * own title strip, tape pill, `demo as-of`, `synthetic demo` and `TAPE OFF` copy.
 */
export const LANDING_FIELD_MODEL: StructureFieldModel = {
  symbol: LANDING_SAMPLE.symbol,
  samples: [...LANDING_FIELD_SAMPLES],
  spot: LANDING_SAMPLE.spot,
  callWall: LANDING_SAMPLE.callWall,
  putWall: LANDING_SAMPLE.putWall,
  gammaFlip: LANDING_SAMPLE.gammaFlip,
  maxPain: null,
  asOfSec: null,
  liveMid: null,
  live: false,
  source: 'demo',
};

/** The ONE shared sample literal on `/` — the hero panel and the field panel carry the same words,
 *  so the page has one vocabulary for one claim, not two. */
export const SAMPLE_MARK = 'Illustrative sample — not a live read and not a recorded session.' as const;
/** The AI-read panel's own mark: a DIFFERENT withdrawal (no model run happened, as against no live
 *  read). Two sample literals on `/`, and only two. */
export const AI_SAMPLE_MARK = 'Illustrative sample — not a real model output.' as const;
```

**Step 3 — `ScoreStripSample.tsx`.** Derive the flip distance **at module load** with the same pure
projection the desk uses. The desk's own module (`pages/ticker/widgets/_kit/distanceToLevel.ts`) may not be
imported — it is a sibling page, banned by F1 and by the repo's downward-only rule — so the projection is
mirrored here and **pinned by equality** in F14:

```tsx
/**
 * ScoreStripSample — a landing-local composition over `shared/figure` + `shared/ui`. Its CTA-shaped
 * elements are non-focusable presentational nodes: a picture of a control never enters the tab order.
 *
 * FLIP_DISTANCE_LABEL is DERIVED AT MODULE LOAD from `samples.ts`, never hand-typed: the design's own
 * artboard prints this sample distance as `−0.81%` (`landing.mjs:88`) and `−0.8%` (`landing.mjs:65`),
 * and the first is not what the shipped formatter produces from those constants. The projection is a
 * MIRROR of `pages/ticker/widgets/_kit/distanceToLevel.ts`'s `distancePercentOnly` — no ticker file may
 * be edited by this feature, and a page may not import a sibling page — and the two are pinned EQUAL by
 * `curvature-v2-landing-samples.structural.spec.ts` (SPEC §7 item 14). Poison a constant there and the
 * rendered string must move.
 */
import { MONO_FACE, SANS_FACE, UNTRACED_RULE } from '@/shared/figure';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LANDING_SAMPLE } from './samples';

/** The mirrored projection (see the docblock). Signed percentage only, one decimal, figure minus. */
function percentOnly(level: number, spot: number): string {
  const delta = level - spot;
  if (Math.abs(delta) < 1e-9) return 'at spot';
  const abs = Math.abs(delta);
  const pct = (abs / Math.abs(spot)) * 100;
  return `${delta > 0 ? '+' : '−'}${pct.toFixed(1)}%`;
}

export const FLIP_DISTANCE_LABEL = percentOnly(LANDING_SAMPLE.gammaFlip, LANDING_SAMPLE.spot);

const TIERS = ['Dormant', 'Watch', 'Actionable', 'Prime'] as const;

export function ScoreStripSample() { /* … panel chrome, four cells, the tier row, the caption … */ }
```

The four cells are `Opportunity` (`Actionable`, `near wall · IV cheap`), `IV / HV` (`0.82`,
`options look cheap`), `Flip dist` (`{FLIP_DISTANCE_LABEL}` with `data-testid="sample-flip-distance"`,
`mid above the flip`), `Vol / OI` (`0.61×`, `3 unusual strikes`) — figures in `MONO_FACE`, labels in
`SANS_FACE`. The tier row renders the four `TIERS` with the caption
`0–100 triage score · not a trade signal` (verbatim, `landing.mjs:90`). **No ring gauge** (§2 — no ring-gauge
component exists in `apps/dashboard`, and inventing one for the acquisition page only is a second illustration
under the canon's hard limit). **No `<svg>` at all in this file**, so §7 item 2's set-equality stays decidable.

**Step 4 — `AiReadSample.tsx`.** Panel head: an icon imported from `shared/` (never authored here),
`AI read · SPY`, the `SIMULATED` chip, and `AI_SAMPLE_MARK`. Body: the verdict block
(`Trade · Bullish`, `Bull call spread · 575 / 580 · Sep 18 · high`) and the four cells
(`Max risk $420 / 1.7% of account`, `Invalidation 568.50 / the gamma flip`, `Entry near 573 / pullback to
VWAP`, `Target 579.50 / AI-stated · untraced`). The first three render `MONO_FACE`; **`Target` renders
`SANS_FACE` + `UNTRACED_RULE`** — that is canon rules 13/23 surviving a black-and-white screenshot.
The two CTA-shaped elements render as `<Box component="span">` with no `tabIndex`, no `href`, no `onClick`.

**Step 5 — `StructureFieldSample.tsx`.**

```tsx
/**
 * StructureFieldSample — the mount wrapper supplying the canvas's props (SPEC §2.4).
 * `variant='ticker'` is THE lever: it sets `calm` (killing `paintStep.ts:850-858`'s phosphor grain,
 * which has no `m.live` term in its gate) AND `embedded` (suppressing the canvas's own title strip,
 * tape pill, `demo as-of`, `synthetic demo` and the warning-toned `TAPE OFF` pill — three
 * user-facing strings at once, including an offline assertion a frozen sample may never make).
 *
 * The panel header and the sample footnote are DOM copy OWNED BY THE LANDING, not canvas pixels.
 *
 * EAGER IMPORT — no React.lazy, no Suspense, no IntersectionObserver (SPEC §2.4). Every candidate
 * fallback is already forbidden: a spinner is a second moving element on a page whose motion budget
 * is the hero draw; a shimmer is a data-signal keyframe with no stream to gate it; a zero-height box
 * is layout shift directly under the H1. The measured 20 kB-gzipped trigger is the closer's (F16).
 */
import { StructureFieldCanvas } from '@/shared/charts/structure-field';
import { resolveLevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { LANDING_FIELD_MODEL, SAMPLE_MARK } from './samples';

export function StructureFieldSample() {
  const theme = useTheme();
  const palette = useMemo(() => resolveLevelPalette(theme), [theme]);
  const surfaces = useMemo(
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
  return (
    <Box data-testid="landing-field-panel" /* panel chrome, tokens only */>
      <Typography component="h3" variant="subtitle2">Structure field</Typography>
      <StructureFieldCanvas
        model={LANDING_FIELD_MODEL}
        height={240}
        variant="ticker"
        palette={palette}
        surfaces={surfaces}
      />
      <Typography variant="caption" data-testid="landing-field-caption" sx={{ color: 'text.secondary' }}>
        {SAMPLE_MARK}
      </Typography>
    </Box>
  );
}
```

**Step 6 — green + commit.** `npx nx test @convexa/dashboard -- landing-samples` → **9 passed.**
Commit `feat(landing): frozen samples and the three sample panels, calm and embedded`.

**Reviewer probe:** §7 item 5 says assert the **props**, not the DOM — canvas pixels are outside the reach of
both a Testing Library query and a CSS-keyframe scan. If a reviewer finds a test asserting the canvas's
painted output, that test is proving nothing; `paintStep.spec.ts:92-114` already mutation-proves the `m.live`
gates and stays as it is.

---

### F7 — the landing composition

**Deliverable:** `Landing.tsx` rewritten as the design's **six** sections, in the design's order —
hero · structure field · triage score · AI read · "Numbers say where they came from" · CTA band — and no
seventh. The waitlist block, the `ValueCard` grid, the `What works today` heading, the page-owned `<Footer/>`
and the nested `<main>` are deleted together.

**Files**
- `apps/dashboard/src/app/pages/landing/Landing.tsx` (rewrite)
- `apps/dashboard/src/app/pages/landing/copy.ts` (new)
- `apps/dashboard/src/app/pages/landing/landing.spec.tsx` (rewrite `:110-130`, `:148-164`, `:194-200`;
  **keep `:57-63` and `:137-141` VERBATIM**)
- `apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx` (rewrite `:56-69`, `:84`, `:87-100`;
  add §7 item 17's rendered half; keep the `radial-gradient` and `ConvexityMotif` scans)

**Step 1 — `copy.ts`, the pinned strings.** Every string below is quoted by SPEC §4 and is therefore pinned
to these bytes (AC-C1). **Apostrophes are U+2019 where shown curly.** The three feature bodies, the nine
bullets and the three trust-card bodies are **copied byte-for-byte from `design/src/screens/landing.mjs:104,
107-109, 126-128`** (AC-C1a; F13's item-16 spec proves it), with the one amendment §4 names:

- Chip `Dealer-gamma analytics · free ticker, no account`
- H1 `See the dealer positioning behind the price.`
- Sub `Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup. Practice the plan on a simulated book before you ever risk a dollar.`
- Spine `Scan → Ticker → Plan → Track`
- Footnote `Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool; every trade is simulated.`
- Hero primary `Open the Ticker →` → `/ticker` · hero secondary `How it’s built` → `/methodology`
- Hero panel eyebrow (caps) `Dealer gamma surface · strike × tenor`; legend `gamma flip` · `call wall` ·
  `put wall`; caption `{SAMPLE_MARK}` with `id="gs-sample-caption"` (the hero SVG's `aria-describedby` target)
- Eyebrows `Where is price pulled?` · `Is there an edge right now?` · `What would I risk?` · `Honest by design`
- H2s `Walls, the flip, the magnet — drawn as a field, not a table.` · `A triage score that is honest about
  what it is.` · `A risk-first read, on your own key, grounded in the structure.` ·
  `Numbers say where they came from.` · `Open any ticker. No account, no card.`
- Register body `Every surface carries its basis. If you can’t tell whether a figure is live, a snapshot, or the model’s own guess, we have failed — so the type itself tells you.`
- Honesty action `Read the methodology →` → `/methodology` (the one-click proof path AC-L9 checks; **not** via
  the footer)
- Trust cards, in order, titles quoted / bodies verbatim from `landing.mjs:107-109`:
  `Snapshot, never live` · `Simulated, always` · `Advisory, never an order`
- **The one amended bullet** (four words added to `landing.mjs:126`, no new claim):
  `On a ticker desk the mid is tape — it pulses only while the stream is genuinely live.`
- CTA band: heading `Open any ticker. No account, no card.`; body
  `The full structure desk is free. Sign up when you want the Scanner, a simulated book that persists, and AI reads on your own key.`
  (`landing.mjs:117` **minus** `across 69 tracked names` — the count is true today, but the landing never reads
  `universe.json`, so one owner edit plus a restart makes the page lie with no test to notice);
  primary `Open the Ticker →` → `/ticker`; secondary **imported** `AUTH_COPY.account.signIn`; and directly
  under the secondary, **imported** `AUTH_COPY.signup.signupsClosed`.

Import the two auth strings — never retype them:

```ts
import { AUTH_COPY } from '@/features/auth/copy'; // ALLOWED by the deny-list: strings, no transport
export const CTA_SECONDARY = AUTH_COPY.account.signIn;            // copy.ts:12
export const CTA_SIGNUPS_CLOSED = AUTH_COPY.signup.signupsClosed; // copy.ts:28
```

**Cut from the design source, and kept cut by a mechanism** (SPEC §4's cut table): `three.js surface · the
desk’s own model, drawn in depth` (`landing.mjs:56`) · the `structure as-of 42s` chip and the `chip live` +
dot (`:52`) · `rendered from the desk’s own bundle` (`:54`) · `7d → 90d tenors` (`:54`) · the CTA band's
`radial-gradient(…)` wash (`:116`) · the whole "desk right now" strip (`:61-67`) · the brokerage-connect
footnote (`:118`). F13 owns the source-half scan; this task owns the rendered half.

**Step 2 — the two verbatim blocks stay.** In `landing.spec.tsx`, `:57-63` (the strict fetch harness that
throws on any non-auth call) and `:137-141` (zero `EventSource`) are **kept byte-for-byte**. They are the
mechanism behind AC-L17, and rewriting them is how a zero-edge invariant quietly dies.

**Step 3 — rewrite `landing.spec.tsx`'s three blocks.** Replace `:110-130` (the waitlist inertness suite),
`:148-164` (the CTA href table) and `:194-200` (the "primary hits the sign-in wall" case) with:

```tsx
describe('AC-L1/L2/L3/L3a — the landing inventory', () => {
  it('exactly six sections, in the design order, and no seventh', () => {
    renderLanding();
    expect(screen.getAllByTestId('landing-section').map((s) => s.dataset.section)).toEqual([
      'hero', 'field', 'score', 'ai-read', 'register', 'cta',
    ]);
  });

  it('the three trust promises are content INSIDE the fifth section, not a section of their own', () => {
    renderLanding();
    const register = screen.getAllByTestId('landing-section')[4];
    for (const t of ['Snapshot, never live', 'Simulated, always', 'Advisory, never an order']) {
      expect(within(register).getByText(t)).toBeInTheDocument();
    }
  });

  it('the retired v1 surface is gone: no "What works today", no value-card grid, no waitlist', () => {
    const { container } = renderLanding();
    expect(screen.queryByText('What works today')).toBeNull();
    for (const id of ['vp-scanner', 'vp-ticker', 'vp-positions', 'vp-airec',
                      'brokerage-block', 'waitlist-button', 'waitlist-ack']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    for (const tense of ['is coming', 'coming soon', 'on the way', 'in the works']) {
      expect(container.textContent!.toLowerCase()).not.toContain(tense);
    }
  });
});

describe('AC-L6/AC-L15/AC-L16 — the one big action works without an account', () => {
  it('both `Open the Ticker` actions share a name AND a destination', () => {
    renderLanding();
    for (const id of ['cta-primary', 'cta-band-primary']) {
      expect(screen.getByTestId(id)).toHaveAttribute('href', '/ticker');
      expect(screen.getByTestId(id)).toHaveAccessibleName('Open the Ticker');
    }
  });

  it('the CTA band declares the closure BEFORE the visitor types anything', () => {
    renderLanding();
    const band = screen.getAllByTestId('landing-section')[5];
    expect(within(band).getByText(AUTH_COPY.signup.signupsClosed)).toBeInTheDocument();
    expect(within(band).getByTestId('cta-band-secondary')).toHaveTextContent(AUTH_COPY.account.signIn);
    expect(within(band).queryByRole('textbox')).toBeNull();
  });

  it('the primary CTA resolves into the public Ticker viewer, not a wall (real router)', async () => {
    /* widen the fetch mock exactly as `:166-192` does today, then: */
    renderApp('/');
    await userEvent.setup().click(screen.getByTestId('cta-primary'));
    expect(await screen.findByText('Call wall')).toBeInTheDocument();
    expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  });

  it('AC-L9 — the honesty section reaches methodology in ONE click, not via the footer', () => {
    renderLanding();
    const register = screen.getAllByTestId('landing-section')[4];
    expect(within(register).getByTestId('cta-methodology')).toHaveAttribute('href', '/methodology');
  });
});
```

**Step 4 — rewrite `landing-structure.spec.tsx`'s three blocks and add item 17's rendered half.**
`:56-69` and `:87-100` render `<Landing/>` standalone and query `site-footer` / `vp-*` / `brokerage-block`;
after F3 and this task those are hard red builds, which is the point. Re-home them onto an `<App/>` render at
`/` (shell + footer present) and re-point the card-title assertion. `:84` (`'What works today'` is the h2)
becomes the AC-L2 absence assertion. Add:

```tsx
describe('§7 item 17 (rendered half) — the three cut phrases never reach the page', () => {
  it('the landing textContent, hero caption and legend included, carries none of them', () => {
    const { container } = renderLandingInShell();
    for (const phrase of ['three.js', '7d → 90d', 'own bundle']) {
      expect(container.textContent).not.toContain(phrase);
    }
  });
});
```

**Keep the `§8-7` describe's two earned scans** (`hasRadialGradient` over `LANDING_SOURCES`, `referencesMotif`
over `APP_SOURCES`) and their mutation guard **byte-for-byte** — the port is designed to stay inside them.
**One deliberate pin edit inside that block:** the `VALUE_CARD_RAW` glob and its two references
(`:27-31`, `:106`, `:119-120`) are removed, because F12 deletes `ValueCard.tsx` and a glob over a deleted file
fails `toHaveLength(1)`. This narrows **nothing**: the file being scanned no longer exists. Record the reason
in the diff. See "Contradictions surfaced" below.

**Step 5 — write `Landing.tsx`.** Structure:

```tsx
export function Landing() {
  useEffect(() => scheduleLandingPrefetch(), []); // the one intentional non-data edge; touches no API
  return (
    <Box data-testid="landing" sx={{ bgcolor: 'background.default', color: 'text.primary' }}>
      {/* NO <main> here — AppShell.tsx:96 owns the app's ONE main landmark (AC-F4). */}
      {/* NO <Footer/> here — AppShell mounts it once for every in-shell page (AC-F1). */}
      <Box component="section" data-testid="landing-section" data-section="hero"> … </Box>
      <Box component="section" data-testid="landing-section" data-section="field"> … </Box>
      <Box component="section" data-testid="landing-section" data-section="score"> … </Box>
      <Box component="section" data-testid="landing-section" data-section="ai-read"> … </Box>
      <Box component="section" data-testid="landing-section" data-section="register"> … </Box>
      <Box component="section" data-testid="landing-section" data-section="cta"> … </Box>
    </Box>
  );
}
```

- `/` reads **no session fact**: no `useAuth`, no `ready` branch, no first-paint swap. Its `loading` state is
  n/a-by-construction.
- The hero keeps `<HeroCurve />` as `aria-hidden` background geometry (AC-L4a: it is *not* the hero
  instrument and gains no legend, axis, figure or accessible name) and mounts `<GammaSurfaceHero />` in the
  right-hand panel.
- **Keep the chip's `borderRadius: 999` in this file.** `radius-scale.spec.ts:25-30` lists
  `pages/landing/Landing.tsx` as a declared PILL site and `:62-70` fails with "no longer carries
  borderRadius: 999" if the v2 hero keeps no declared pill. If the implementation moves the chip out of this
  file, the `PILL_SITES` entry is **edited in the same commit** — never waived.
- Deleted with their now-unused imports: `ComingSoonCard`, `ValueCard`, `Snackbar`, `WAITLIST_TOAST`,
  `toastOpen`/`setToastOpen`, `useState`, the four `@mui/icons-material` imports, `Footer`, and
  `prefetchScannerRoute` (the primary action no longer points at `/scanner`).
- `Jargon` **stays available**: `pages/scanner/Scanner.tsx:19` is a second importer, so it does not become
  orphaned. (SPEC §8 cost 2's `[lane-check]`, checked at source — not assumed.)

**Step 6 — green + commit.** `npx nx test @convexa/dashboard -- landing` → the rewritten
`landing.spec.tsx` + `landing-structure.spec.tsx` pass, and `AppShell.footer.spec.tsx`'s `/` case flips green.
Commit `feat(landing): six sections, one hero instrument, a first click that is not a refusal`.

---

### F8 — the blog index

**Deliverable:** the v2 index composition over the one published read. **No draft slots** (D-A ruled (A),
2026-09-10). No `structureField` thumbnail.

**Files:** `apps/dashboard/src/app/pages/blog/BlogPage.tsx`, `apps/dashboard/src/app/pages/blog/copy.ts` (new),
`apps/dashboard/src/app/pages/blog/blog.spec.tsx`.

- The index stays a **flat array of published articles**. The `published | draft` discriminated union has no
  member to discriminate this phase and is **not built** — it is the mechanism SPEC §1's restoring condition
  names if a later ruling puts the slots back.
- Eyebrow `Blog`, heading `How we read structure`, and the intro sentence **verbatim from
  `design/src/screens/blog.mjs:15-17`**; the one card's dek **verbatim from `blog.mjs:22-23`**; the
  `Methodology` tag; the shipped action `Read the post →` (`BlogPage.tsx:74`), linking to
  `/blog/how-we-read-dealer-structure.html` as a **full-document anchor** (the articles are standalone HTML
  served by the static host; a `RouterLink` would try and fail to resolve them client-side).
- Extend the strict fetch harness (SPEC §7 item 4) to this page: copy `landing.spec.tsx:57-63`'s mock and
  assert zero non-auth calls and zero `EventSource`.
- Assertions (7): exactly one card; **zero** elements whose text contains `Draft` or `not yet published`; the
  anchor's `href` ends `.html`; the target file exists on disk (AC-B3 — no link anywhere leads to a blog
  document that does not exist); zero non-auth fetches; zero `EventSource`; the page's `<h1>` is
  `How we read structure`.

Commit `feat(blog): the v2 index over the one published read`.

---

### F9 — the methodology copy module

**Deliverable:** `METHOD_COPY.sections` becomes an **ordered array** (not an object plus a hand-maintained
order list in the component), each section carrying typed blocks, so the on-this-page index and the body are
generated from one list and cannot diverge.

**File:** `apps/dashboard/src/app/pages/methodology/copy.ts` (rewrite).

**Shape** — note the planning decision recorded below: the discriminated union is at the **block** level, not
the section level, because two of the ten sections carry prose *and* a table and the page must still present
exactly ten sections:

```ts
export type MethodBlock =
  | { readonly kind: 'prose'; readonly body: readonly string[]; readonly muted?: boolean }
  | {
      readonly kind: 'table';
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export interface MethodSection {
  /** The stable anchor a deep link resolves to (AC-M1). */
  readonly id: string;
  readonly h: string;
  readonly blocks: readonly MethodBlock[];
}
```

**The ten sections, in this order** (SPEC §4), each heading and each paragraph **copied byte-for-byte from
`design/src/screens/methodology.mjs:29-57`** — that file is the single source for this page and the shipped
v1 section strings are **replaced**, deliberately, so a lane cannot merge two wordings:

| # | `id` | heading (source line) |
|---|---|---|
| 1 | `two-data-speeds` | `Two data speeds — do not mix them` (`:29`) |
| 2 | `dealer-structure` | `Dealer structure — walls, flip, GEX` (`:33`) |
| 3 | `flip-vs-walls` | `Flip vs walls — different gamma bases` (`:37`) |
| 4 | `score-and-tier` | `Score and tier` (`:41`) |
| 5 | `advisory-reads` | `Advisory reads` (`:47`) |
| 6 | `ai-read-and-grounding` | `AI read and grounding` (`:49`) |
| 7 | `simulation` | `Simulation` (`:52`) |
| 8 | `where-the-read-is-weak` | `Where the read is weak` (`:54`) |
| 9 | `what-convexa-never-does` | `What Convexa never does` (`:56`) |
| 10 | `vocabulary` | `Vocabulary` (`:58`) |

The design's illustrative panel inside "Two data speeds" (`methodology.mjs:32`) does **not** ship — it carries
a `chip live` + dot and a `levels as-of 42s` chip, both banned on a page with no stream, and the state matrix
commissions no instrument on this page.

**The four deltas, each quoted so AC-C1 pins it:**

1. **Score section, introducing clause.** `methodology.mjs:42` ships verbatim up to
   `never re-derives the score from scan rows alone.`; its final clause `The score is a capped sum of plain
   components:` is **replaced** by:
   `The score is a sum of plain components, capped twice. The four base components below are summed and capped at 100; the dark-pool confluence bonus is added after that cap and capped again, so it can only lift a score that is still under 100 and no score ever exceeds 100:`
2. **AI section gains** `A "no trade" read is a complete, correct answer — not an error and not a failed request.`
3. **"What leaves the machine"**, replacing the trailing clause of `methodology.mjs:51`:
   `What leaves the machine, on demand, is the computed snapshot, the candidate contracts, your two risk numbers, the open-positions digest for the ticker, the persona prompt and the field glossary. You can read the exact payload before it is sent: open “What’s sent to the AI” from the full-analysis drawer on any ticker, or “View what's sent” in Settings → Risk inputs. No other ticker, no identity, no broker data and no key ever leave.`
   **The two quoted labels differ by apostrophe and both are reproduced exactly as they ship** —
   `What’s sent to the AI` (U+2019, `ai-rec/copy.ts:21`) and `View what's sent` (U+0027,
   `features/auth/copy.ts:210`). Renders as **text, never a route link**: there is no `/whats-sent` route and
   a link would 404 — the hazard AC-M5 reaches for. The cut stands only for `persona`, `flows`, `operator`.
4. **The vocabulary table** carries **every** member of the shipped closed union, each rendered **Plex Sans**,
   never mono and never as a figure. There is **no** "this is a selection" clause. Definitions exactly as SPEC
   §4 tables them, nine rows. Build the literal column from the imported union so a tenth member without a
   definition red-builds:

```ts
import { NOT_A_NUMBER, type NotANumber } from '@/shared/copy/notANumber';

const VOCABULARY: Readonly<Record<NotANumber, string>> = {
  '—': 'no value on this snapshot — a plain dash, never a fake zero',
  unavailable: 'an input failed or is missing this cycle',
  'not given': 'the read did not answer this field',
  'not set': 'you supplied no risk block — the one on this list you can clear yourself, by typing one',
  'size not suggested': 'the risk block is present; the model returned no size',
  unrecognized:
    'the read answered a conviction outside low / medium / high; Convexa will not repeat what it cannot place',
  'not recorded': 'the saved record never held this fact, so there is nothing to show',
  'not provided': 'the feed did not send this field — the source withheld it, not us',
  'no basis':
    'no cost basis is on file, so a cost-based figure cannot be derived; the dollar figure beside it is still real',
};
// Set-equality in BOTH directions is the point (§7 item 9): the union drives the rows.
const VOCAB_ROWS = NOT_A_NUMBER.map((lit) => [lit, VOCABULARY[lit]] as const);
```

**Score table** (section 4, block 2): head `['Component', 'Max', 'What it reads']`, rows exactly the five
`methodology.mjs:44` rows. The `Max` values `40 / 25 / 25 / 10 / 6` are pinned to the engine by F13's item-10
spec. *Do not state the proximity ramp* ("full at the level, zero at 3 % away") — stating it would require
pinning a sixth constant (`FAR_LEVEL_PCT`, `signals.rs:13`), and a number stated is a number pinned or it is
not stated. **Fallback, so the lane is never stuck:** if the disk-read mechanism is refused at build, the
`Max` column is **dropped** and each component is stated without a number — never five unchecked constants.

**Relocation a reviewer will look for:** the sim-P/L mark-ladder sentence moves out of "Where the read is
weak" (shipped `copy.ts:82-83`) into the new **Simulation** section (`methodology.mjs:53`) — the design
source's own placement. Nothing is dropped.

`title`, `subhead`, `disclaimer`, `ctaScanner`, `ctaTicker`, `ctaBack` are **byte-identical** between
`methodology.mjs:24-25,62-63` and shipped `METHOD_COPY` (`copy.ts:7-13,97-99`) and stay as they are.

Commit `feat(methodology): one copy source, ten sections, four named deltas`.

---

### F10 — the methodology page

**Deliverable:** the page renders the ordered array — on-this-page index, ten anchored sections, two tables,
no instrument panel.

**Files:** `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx`,
`apps/dashboard/src/app/pages/methodology/methodology.spec.tsx`.

- The index and the body are both generated from `METHOD_COPY.sections` — the same list, so they cannot
  diverge. Each section renders `<Box component="section" id={section.id} aria-labelledby={...}>` with an
  `<h2>`; each index entry is `<a href={'#' + section.id}>`. The nav carries
  `data-testid="methodology-toc"`.
- **The on-this-page index ships as a plain vertical `<nav aria-label="On this page">` list at every width**,
  sticky above `md` (mirroring `methodology.mjs:6`'s `.toc { position: sticky }`), a plain in-flow list below.
  **This is a planner decision, recorded** — SPEC §9 open question 2 left the phone treatment unchosen but
  made the outcome binding either way ("whatever ships must pass AC-G1 and AC-M6 at 393 with a tap path and a
  focus path; the six-band treatment above and below that width belongs to the successor"). A vertical list is
  discoverable, keyboard-reachable in DOM order, has 44 px rows, cannot overflow horizontally, and needs no
  invented affordance; the design's horizontal scroller at ≤899 px is a responsive-band treatment and
  `curvature-v2-responsive-sweep` owns the six bands. **Do not ship the horizontal scroller this phase.**
- Table blocks render `<table>` with a real `<thead>`/`<th scope="col">`. The vocabulary literal cell renders
  `SANS_FACE` (`@/shared/figure`) and carries `data-testid="vocab-literal"` — **never `MONO_FACE`**, never a
  figure: on the one page that defines the closed vocabulary, a literal wearing the traced register is the
  exact inversion rule 24 exists to prevent.
- Spec cases (7): ten sections in order; every `id` resolves to a rendered element (deep link); the index has
  exactly ten entries and its hrefs equal the section ids; the score section states the two-stage clamp and
  the "does not consume vol-normalized GEX or the IV-rank band" scope; the vocabulary table has exactly
  `NOT_A_NUMBER.length` rows and every literal cell's resolved `font-family` equals
  `SANS_FACE.fontFamily`; **every anchor on the page resolves to a route in the table or a static document
  under `public/`** (§7 item 11 — build the allowed set from `app.tsx`'s `path="…"` literals plus a disk
  check); the page mentions **no** persona, flows or operator screen (AC-M5b).

Commit `feat(methodology): ten sections generated from one ordered list`.

---

### F11 — the auth wall's two new branches and the dialog's declaration

**Deliverable:** `RequireAuth` gains a quiet holding branch and a degraded branch; the sign-in dialog declares
closed sign-ups **before** the visitor types.

**Files:** `apps/dashboard/src/app/features/auth/RequireAuth.tsx`,
`apps/dashboard/src/app/features/auth/copy.ts`, `apps/dashboard/src/app/features/auth/AuthDialog.tsx`,
`apps/dashboard/src/app/features/auth/RequireAuth.spec.tsx` (new).

**Step 1 — the copy additions.** In `AUTH_COPY.gate`, beside the shipped `unavailable`:

```ts
  gate: {
    // The "couldn't reach sign-in" copy on a gated action when the auth subsystem is degraded (503).
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
    // curvature-v2-landing-and-site SPEC §5 — the degraded wall. Degrading the ROUTE DECISION to
    // anonymous is correct; degrading the SENTENCE is not. With subsystemDegraded === true the
    // shipped wall today tells a trader who may well be signed in `Sign in to open the scanner` —
    // an assertion about identity built on a read that FAILED.
    sessionUnknown: "We couldn't check your session.",
    retry: 'Try again',
  },
```

**Step 2 — the three branches.** `RequireAuth`:

```tsx
  const { ready, authenticated, subsystemDegraded, refresh } = useAuth();
  // …
  // 1. The read is in flight → the shared QUIET FILL. Never the wall, never `null`, never a wall
  //    skeleton or a greyed `Sign in`. `null` is not a hold a person can perceive; the fallback's
  //    only string is aria-label="Loading page", which asserts nothing about the session. This is
  //    the codebase's own answer: `DefaultTickerRedirect` renders it on the identical fact.
  if (!ready) return <RouteFallback />;
  if (authenticated) return <>{children}</>;
```

and, inside the wall, the heading and the first body line branch on `subsystemDegraded`:

| slot | normal | degraded |
|---|---|---|
| heading | `Sign in to open {surface}` | `AUTH_COPY.gate.sessionUnknown` |
| line above the unlock sentence | — | `AUTH_COPY.gate.unavailable` |
| action beside `Sign in` | — | `AUTH_COPY.gate.retry`, whose click calls `refresh()` |
| unchanged in both | `wallCopy(surface).unlocks` · `.freePath` · the policy caption · `Sign in` · `Open free Ticker →` | same |

The policy caption stays in **every** branch — it is a statement about the product's access policy, true
whoever the visitor is; only the heading asserts identity. The `Sign in` button also stays: it is an **offer**,
not a claim about who the visitor is. **Retry is user-initiated only** — no effect, no timer, no automatic
retry, so a degraded auth subsystem is not polled by every visitor parked on `/scanner`.

**Step 3 — the dialog declares before the visitor types (AC-A4).** In `AuthDialog.tsx`, when
`mode === 'signup'`, render `AUTH_COPY.signup.signupsClosed` beneath the subtitle and **above the first
field**, with `data-testid="auth-signups-closed"`. The shipped post-submit `signups_closed` mapping at
`:115-118` is unchanged — it stays the refusal copy, deliberately **not** the "temporarily unavailable" copy,
which would read as a transient fault and invite a retry loop against a door that is closed on purpose.

**Step 4 — the negative half (§7 item 13).** A test that only checks the new sentence passes on a wall that
shows both. `RequireAuth.spec.tsx` (6 cases):

```tsx
it('degraded: the degraded literal is PRESENT and the identity heading is ABSENT', () => {
  renderWall({ ready: true, authenticated: false, subsystemDegraded: true });
  expect(screen.getByText(AUTH_COPY.gate.sessionUnknown)).toBeInTheDocument();
  expect(screen.getByText(AUTH_COPY.gate.unavailable)).toBeInTheDocument();
  expect(screen.queryByText('Sign in to open the scanner')).toBeNull();
  expect(screen.queryByText(/^Sign in to open /)).toBeNull();
  // The policy caption and the two offers survive the degradation.
  expect(screen.getByText(/Private testing — invited accounts only/)).toBeInTheDocument();
  expect(screen.getByTestId('require-auth-ticker')).toHaveAttribute('href', '/ticker');
});

it('AC-A9 — Try again retries ONLY when pressed', async () => {
  const refresh = vi.fn();
  renderWall({ ready: true, authenticated: false, subsystemDegraded: true, refresh });
  expect(refresh).not.toHaveBeenCalled();          // no effect, no timer
  await userEvent.setup().click(screen.getByTestId('require-auth-retry'));
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('AC-A2a — while !ready the gated route shows the quiet fill, never the wall, never null', () => {
  const { container } = renderWall({ ready: false, authenticated: false });
  expect(screen.getByTestId('route-fallback')).toBeInTheDocument();
  expect(screen.queryByTestId('require-auth-wall')).toBeNull();
  expect(container.textContent).not.toMatch(/sign(ed)? ?(in|out)/i);
});
```

plus: the wall never renders for an authenticated trader (AC-A2); AC-A8's reachability set is unchanged
(`/ticker`, `/`, `/blog`, `/methodology`, `/settings` public; `/scanner`, `/positions` gated); the dialog
shows `signupsClosed` in signup mode with zero prior typing (AC-A4).

Commit `feat(auth): a quiet hold and an honest degraded wall; the closed door is stated first`.

---

### F12 — retire `ValueCard`, park `ComingSoonCard`, rename the retired fixture

**Deliverable:** zero-importer cleanup with the pins edited deliberately.

**Files:** delete `apps/dashboard/src/app/shared/ui/ValueCard.tsx`; edit
`apps/dashboard/src/app/shared/ui/index.ts`; edit `apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx`.

- **`ValueCard` is deleted** with its `shared/ui/index.ts` export (`:23`) and the doc-comment mention at
  `ui-primitives.spec.tsx:10`. Prove zero importers first:
  `rg -n "ValueCard" apps/dashboard/src` must return only the file itself, the barrel and the spec comment.
- **`ComingSoonCard` is PARKED, not deleted.** Deleting it red-builds `radius-scale.spec.ts:27` and the spec's
  own import, and `TickerDashboard.tsx:62` still uses the sibling `ComingSoonBox`.
- **`ui-primitives.spec.tsx:61-82` is renamed off the retired product copy** in this same change, so the
  primitive's inertness proof stops carrying it and AC-G3c holds ("no test presses a brokerage-notify
  control"): `testId="brokerage-block"` → `testId="parked-block"`, title `Connect a real brokerage` →
  `A parked capability`, `data-testid="waitlist-button"` → `data-testid="parked-action"`, label
  `Notify me` → `Tell me more`. **The assertions are unchanged** — this is a fixture rename, not a weakening.
- **`Jargon` is NOT orphaned** — `pages/scanner/Scanner.tsx:19` imports it. Verified at source, not assumed.

Commit `chore(ui): retire ValueCard, park ComingSoonCard, rename the retired fixture`.

---

### F13 — the provenance pins (design source, engine constants, cut phrases)

**Deliverable:** one node-environment structural spec, homed **outside `pages/**`** — the precedent is
`apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts:50-63`, which already walks to the
workspace root and reads files outside `apps/dashboard`.

**File:** `apps/dashboard/src/app/curvature-v2-landing-and-site.structural.spec.ts` (new).

Three arms, each mutation-proved:

**Arm A — copy fidelity to the design source (AC-C1a, §7 item 16).** Read
`design/src/screens/{methodology,landing,blog}.mjs` from disk (a **read**, not a runtime import — the canon's
"nothing in the app imports from `design/` at runtime" stands) and assert **byte-for-byte presence** of:
the methodology module's ten headings and all their paragraphs; the landing's three feature bodies, nine
bullets and three trust-card bodies; the blog index's eyebrow, heading, intro and card dek.
**Named exclusions, and only these:** the four quoted deltas (F9), the one amended field bullet (F7), and the
vocabulary table, which §7 item 9 pins instead.

**Arm A′ — the negative half, and it is the half that bites.** None of the retired v1 fragments appears
anywhere under `pages/methodology/**`. Grep-safe forms, each contiguous in `copy.ts` today:

```
live tiles · the tile says · on the FE · The ticker always labels · The frontend maps them ·
the ticker shows a single-name caveat · about every few minutes · evidence favors ·
capped sum of plain components
```

Mutation-proved both ways: change one word of a paragraph and Arm A goes red; restore one retired fragment and
Arm A′ goes red.

**Arm B — engine constants (AC-M2, §7 item 10).** Read `libs/quant-engine/src/signals.rs` from disk and assert
the score table's five caps against `40` (`:482`), `25` (`:487`), `25` (`:488`), `10` (`:489`) and
`DARK_POOL_BONUS_CAP: i32 = 6` (`:24`, applied `:541`). Reading a frozen crate's source from disk is not
importing it, and the five caps live in `libs/quant-engine`, **not** in the frozen `apps/api`.
Mutation-proved by moving a constant in a fixture string. Assert the two-stage clamp is real:
`.min(100.0)` at `:490` applies to the four base components, and the dark-pool bonus is applied after it.

**Arm C — the cut phrases stay cut (§7 item 17, source half).** A `?raw` scan globbing
`pages/landing/**` **excluding `*.spec.*`**, asserting none of `three.js` · `7d → 90d` · `own bundle`
appears. The last two are the apostrophe-free fragments of `7d → 90d tenors` and `rendered from the desk’s own
bundle`, so swapping U+2019 for U+0027 cannot defeat the check. **The spec-file exclusion is what keeps F7's
rendered-half assertion literals from red-building this arm** — do not drop it.
Mutation-proved three ways: paste each phrase back into the hero panel in a fixture; the build must go red.

Commit `test(structural): pin the copy's provenance, the engine's caps and the cut phrases`.

---

### F14 — sample-figure equality (`Depends on: fidelity-repair-2 merge`)

**Deliverable:** the printed sample distance equals what the shipped desk projection produces from the same
`samples.ts` constants.

**File:** `apps/dashboard/src/app/curvature-v2-landing-samples.structural.spec.ts` (new).

```ts
import { FLIP_DISTANCE_LABEL } from '@/pages/landing/ScoreStripSample';
import { LANDING_SAMPLE } from '@/pages/landing/samples';
import { distancePercentOnly } from '@/pages/ticker/widgets/_kit/distanceToLevel';
import { describe, expect, it } from 'vitest';

describe('§7 item 14 — the landing sample is DERIVED, not hand-typed', () => {
  it('equals the shipped desk projection over the same constants', () => {
    expect(FLIP_DISTANCE_LABEL).toBe(
      distancePercentOnly(LANDING_SAMPLE.gammaFlip, LANDING_SAMPLE.spot),
    );
  });

  it('and it is neither of the artboard-printed values, which is the point', () => {
    expect(FLIP_DISTANCE_LABEL).toBe('−0.8%');
    expect(FLIP_DISTANCE_LABEL).not.toBe('−0.81%'); // `landing.mjs:88`
  });

  it('MUTATION GUARD: poison a constant and the rendered string must move', () => {
    expect(distancePercentOnly(568.5, 573.12)).toBe('−0.8%');
    expect(distancePercentOnly(560, 573.12)).not.toBe('−0.8%');
  });
});
```

**This spec lives outside `pages/**`** because the deny-list covers spec files inside those folders too, and
it imports the ticker's projection as a **read-only reference** — no ticker file is edited.

**Why this task is `Independent: no` and blocked on `fidelity-repair-2`:** the assertion is a live equality
against `pages/ticker/widgets/_kit/distanceToLevel.ts`, a file that lane is editing. If the repair changes the
formatter's rendering, this spec goes red through no fault of this feature, and the landing's mirrored
projection must move with it. Land it after the repair merges, then re-run and record the exit code.

Commit `test(structural): pin the landing sample to the desk's own projection`.

---

### F15 — e2e coverage and the frozen inventory (`Depends on: fidelity-repair-2 merge`)

**Deliverable:** overflow coverage for the three new public paths at every checked width in both schemes
(AC-G3b), axe coverage for the three new surfaces (AC-G1), the A11Y-B2 rewrite (AC-G3c), and the frozen
quality inventory edited deliberately to match.

**Files**
- `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` (extend `ROUTES`, do not rewrite the file)
- `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts` (three new `accessibilityScenarios` entries)
- `apps/dashboard-e2e/src/quality/accessibility.spec.ts` (`A11Y-B2` new subject, **same id**)
- `apps/dashboard-e2e/src/quality/manifest.ts`, `apps/dashboard-e2e/src/quality/manifest.json`
- `apps/dashboard-e2e/tools/lib/manifest.mjs` (the frozen counts + the scan-id regex)

**Step 1 — `ROUTES` gains three entries**, each with a ready marker (the suite's own vacuity-guard idiom):

```ts
  { path: '/blog', ready: async (p) => void (await expect(p.getByTestId('blog-page')).toBeAttached()) },
  {
    path: '/methodology',
    ready: async (p) => {
      await expect(p.getByTestId('methodology-page')).toBeAttached();
      // VACUITY GUARD — all ten sections actually rendered before we measure.
      await expect(p.getByTestId('methodology-section')).toHaveCount(10);
    },
  },
  {
    // AC-G3b — an address that matches no route. Deliberately not a near-miss of a real path.
    path: '/this-address-does-not-exist',
    ready: async (p) => void (await expect(p.getByTestId('not-found-page')).toBeAttached()),
  },
```

**Arithmetic, stated so a reviewer can check it:** `ROUTES` is iterated by **six** loops —
`393px … dark`, `393px … light` (`:989`), the three `WIDE_VIEWPORTS` bands 834/900/1280 (`:1183`), and
`lg 1280 … light` (`:1245`). Three new routes × six loops = **+18 Chromium tests**, 108 → **126**.
That is added coverage, not a breach of AC-G3: **"the journeys are unchanged" means PASS, not COUNT.**
A count constraint here would mean shipping three new public surfaces with no overflow coverage.

**Step 2 — three new axe scans.** Append to `accessibilityScenarios` in `scenarios.ts`:

```ts
  base('A11Y-10', '/blog', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="blog-page"]' },
    { selector: '[data-testid="site-footer"]' },
  ]),
  base('A11Y-11', '/methodology', 'anonymous', { width: 393, height: 852 }, 'dark', [
    { selector: '[data-testid="methodology-page"]' },
    { selector: '[data-testid="methodology-toc"]' },
  ]),
  base('A11Y-12', '/this-address-does-not-exist', 'anonymous', { width: 1280, height: 900 }, 'dark', [
    { selector: '[data-testid="not-found-page"]' },
    { selector: '[data-testid="site-footer"]' },
  ]),
```

The existing `A11Y-1` / `A11Y-2` already scan `/` in dark and light and pick up the landing rewrite and the
footer mount; every other scan picks up the footer for free. **Zero waivers** — `a11y-waivers.json` gains no
entry. If axe reports a finding on the new surfaces, the surface is fixed, never waived.

**Step 3 — `A11Y-B2` keeps its id, gains a new subject.** `accessibility.spec.ts:115-125` today presses
`waitlist-button` and asserts a polite toast. `manifest.ts:23` / `manifest.json` pin behaviour ids, so a
**rename breaks the manifest gate rather than the assertion** — keep `A11Y-B2`. New subject: *CTA actions are
native, keyboard-reachable, and name their destination.*

```ts
  test('A11Y-B2 native CTA actions, keyboard-reachable, naming their destination', async ({ page }) => {
    const requestState = await installScenario(page, accessibilityScenarios[0]);
    expect(() => requestState.releaseInitialStream()).toThrow(/not armed/);
    await page.goto('/');
    for (const id of ['cta-primary', 'cta-band-primary']) {
      const a = page.getByTestId(id);
      await expect(a).toHaveAttribute('href', '/ticker');
      await expect(a).toHaveAccessibleName('Open the Ticker');
      expect(await a.evaluate((n) => n.tagName)).toBe('A');
      await a.focus();
      await expect.poll(() => a.evaluate((n) => n.matches(':focus-visible'))).toBe(true);
    }
    const secondary = page.getByTestId('cta-band-secondary');
    expect(await secondary.evaluate((n) => n.tagName)).toBe('BUTTON');
    await expect(secondary).toHaveAccessibleName('Sign in');
    await expect(page.getByText('New sign-ups are closed while Convexa is in private testing.')).toBeVisible();
    await secondary.press('Enter');
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
    // NO [aria-live] region is asserted, because none is mounted (the waitlist toast is gone).
  });
```

**Step 4 — edit the frozen inventory, deliberately.** `apps/dashboard-e2e/tools/lib/manifest.mjs` hard-codes
the inventory and **rejects a tenth a11y scan by regex**:

```diff
-    value.full_chromium?.inventory_id !== 'curvature-v2-surfaces-108-v1' ||
+    // (curvature-v2-landing-and-site F15) bumped 108 → 126: `no-overflow.spec.ts`'s ROUTES table
+    // gained /blog, /methodology and one unmatched path (AC-G3b), and ROUTES is iterated by six
+    // loops — 393 dark, 393 light, tablet 834, md 900, lg 1280, and the lg-1280 light walk.
+    // 3 routes × 6 loops = 18 net-new Chromium tests. Added coverage, not a breach of AC-G3.
+    value.full_chromium?.inventory_id !== 'curvature-v2-landing-and-site-126-v1' ||
     !Array.isArray(tests) ||
-    tests.length !== 108
+    tests.length !== 126
   )
-    fail('full Chromium inventory must contain 108 tests');
+    fail('full Chromium inventory must contain 126 tests');
```

```diff
-    scans.length !== 9 ||
+    // (curvature-v2-landing-and-site F15) 9 → 12: AC-G1 requires the accessibility gate to cover the
+    // six surfaces, and /blog, /methodology and the 404 had no scan. The id regex is widened with the
+    // count — `A11Y-[1-9]` structurally rejected a tenth scan, which is why both move together.
+    scans.length !== 12 ||
```

```diff
-        !/^A11Y-[1-9]$/.test(x.id) ||
+        !/^A11Y-(?:[1-9]|1[0-2])$/.test(x.id) ||
```

and the matching id/route/ready/forbidden records in `manifest.json` plus the three new ids in
`manifest.ts`'s `accessibility.scans` array. **This is a deliberate pin edit in the same change — never a
waiver, never a narrowed validator.** The `visual.scenarios.length !== 6` check is **unchanged**: this
feature adds no visual scenario.

**Step 5 — run and record.** `npm run browser:chromium` → 126 passed. `npm run browser:a11y` → 12 scans +
7 behaviours, zero waivers. `node --test apps/dashboard-e2e/tools/manifest.spec.mjs` → the validator's own
tests pass against the new numbers.

Commit `test(e2e): overflow and axe coverage for the three new public surfaces`.

**Why this task is `Independent: no`:** it writes outside `frontend.dir` (`apps/dashboard-e2e/**`,
which PLAN_METHOD puts on one lane as `no`) **and** it writes
`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`, which `fix/fidelity-repair-2` is editing. Land it
after that lane merges; rebase, re-run, record exit codes.

---

### F16 — frontend closer (visual state, bundle measurement, lane receipt)

`Independent: no`, `Depends on` **every** other frontend task. The closer does **not** re-implement worker
paths. It owns exactly three leftovers plus the receipt.

**1 — the production entry-chunk measurement (SPEC §8 cost 6).** The 20 kB-gzipped figure in §2.4 is a
*decision rule*, not a measurement anyone has made. Take both numbers:

```bash
cd /Users/rodrigoarias/dev/convexa-landing-wt
git worktree add /tmp/convexa-base 4ca9edc7      # the pre-feature base
(cd /tmp/convexa-base && npm ci && npx nx build @convexa/dashboard --configuration=production \
   && node tools/check-dashboard-bundle.mjs --json > /tmp/base-bundle.json)
npx nx build @convexa/dashboard --configuration=production
node tools/check-dashboard-bundle.mjs --json > /tmp/head-bundle.json
```

Record **both** `entry-index` gzip figures and both brotli figures verbatim in the lane receipt.

- **If the gzip delta attributable to `shared/charts/structure-field` exceeds 20 kB**, land the split — and
  land it **only** as the pair `<ErrorBoundary variant="section"><Suspense fallback={quiet panel}>`: a
  reserved-height panel carrying the section title and the sample footnote, **no spinner, no shimmer, no
  height collapse**, and the one line `The structure field sample didn't load.` on rejection. A chunk
  rejection throws during render and would otherwise replace the whole acquisition page.
- **Below the threshold: no boundary, no `loading` row, no Suspense.**
- **`node tools/check-dashboard-bundle.mjs` also gates `entry-index` at 22 KB brotli** (observed ~11 KB).
  If `npm run check:bundle` fails on `entry-index` while the gzip delta is **under** 20 kB, the SPEC's §2.4
  rule does not license the split and the budget pin is not this lane's to raise: **STOP and report it as a
  GATE Z question.** Do not raise the pin, do not waive, do not narrow the budget.

**2 — the visual gate, compare-only (SF-1).** Run:

```bash
npm run browser:visual ; echo "exit=$?"
```

**Expected: a non-zero exit with `landing` failing**, and any other of the six whose pixels moved. Record, per
scenario, the id and the expected/actual/diff artefact paths from
`apps/dashboard-e2e/test-output/playwright/visual/`. **Do not** run `npm run browser:visual:update`; **do
not** write, delete or regenerate any PNG under `apps/dashboard-e2e/src/quality/__screenshots__/`. The
authorization schema pins `platform` to `win32|linux`
(`visual-review/schemas/authorization.schema.json:22`) — no receipt can be authored on darwin, and a baseline
written without one is an unapproved re-baseline wearing a passing test's clothes. The owner re-accepts on the
Windows box through the two-stage human receipt flow.

**3 — the whole-suite sweep and the receipt.** Run the verification track end to end (below), capture exit
codes, and write the lane receipt with: the pass counts, the two bundle numbers, the visual FAIL list with
evidence paths, the deny-list probe exit codes, and the mutation-proof runs.

---

## Verification track

Run from the repo root (`/Users/rodrigoarias/dev/convexa`, the branch checked out in the main working tree — the planning worktree is gone). **Check exit codes, not printed summaries.**

| id | command | expected |
|---|---|---|
| **V-1** | `git diff --stat main -- apps/api libs/quant-engine` | **prints nothing**, exit 0. `NO_BACKEND_CHANGE` is asserted as an empty diff (SPEC §8). |
| **V-2** | `npx nx lint @convexa/dashboard` | `exit=0`, 0 errors. The deny-list is active and no surface source violates it. |
| **V-3** | `npm run lint` | `exit=0` across `@convexa/dashboard`, `@convexa/api`, `dashboard-e2e`. |
| **V-4** | `npx nx typecheck @convexa/dashboard` | `exit=0`, 0 errors. |
| **V-5** | `npx nx test @convexa/dashboard` | `exit=0`, **0 failed**, 0 skipped. Baseline count is captured at F1 start (`npx nx test @convexa/dashboard 2>&1 \| tail -5`) and the closer asserts `after ≥ before`. Net-new cases this feature adds: F1 4 · F2 9 · F3 8 · F4 7 · F5 6 · F6 9 · F8 7 · F10 7 · F11 6 · F13 ≥9 · F14 3. |
| **V-6** | `npx nx test @convexa/dashboard -- arc radius-scale single-motion-moment hex-discipline banned-hexes stage1-tokens` | `exit=0`. The earned pins survive: `arc.ts` importers still `{HeroCurve, ArcDivider, ConvexaMark}`; `ArcDivider` importers still `{TrackRecordSection, Footer}`; every declared PILL site still carries `borderRadius: 999`; emotion `keyframes` still consumed only by `HeroCurve`; zero hardcoded hex including `index.html`. |
| **V-7** | `npx nx build @convexa/dashboard --configuration=production` | `exit=0`. Record the `index-*.js` gzip line. |
| **V-8** | `npm run check:bundle` | `exit=0`. `entry-index` under 22 KB brotli. A failure here routes to F16 item 1's decision rule, and to a GATE Z stop if it lands in the gap. |
| **V-9** | `npm run browser:chromium` | `exit=0`, **126 passed** (108 + 18 from three routes × six `ROUTES` loops). PASS, not COUNT — the count is expected to rise. |
| **V-10** | `npm run browser:a11y` | `exit=0`, **12 scans + 7 behaviours**, **zero waivers** (`a11y-waivers.json` gains no entry). |
| **V-11** | `npm run browser:compat` | `exit=0`, 5 journeys × {chromium, firefox, webkit}. `compatibility.spec.ts:23-29` clicks `nav-ticker` and is **not touched** by this feature. |
| **V-12** | `node --test apps/dashboard-e2e/tools/manifest.spec.mjs apps/dashboard-e2e/tools/visual-review.spec.mjs apps/dashboard-e2e/tools/visual-update.spec.mjs` | `exit=0`. The edited validator is itself still tested. |
| **V-13** | `npm run browser:visual` | **EXPECTED FAIL — non-zero exit.** `landing` fails against its committed baseline (`scenarios.ts:525-527`, 393×852 dark) because this feature replaces the whole composition. Any other of the six that moves fails with it. **This is recorded as evidence, not fixed.** No lane writes a baseline. |
| **V-14** | `node .claude/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/curvature-v2-landing-and-site/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/curvature-v2-landing-and-site/conformance-receipt.json` | `exit=0`, **1/1 endpoint PASS**. Start the backend first: `npx nx serve api` (port 8000). No `--auth-signup`, no `--auth-cookie`: the **anonymous 200** is the property the wall depends on, and sending a session would test the wrong thing. A missing `user` or `settings` key is a FAIL either way — that is the regression this pin exists to catch. |
| **V-15** | `npm run format:check` | `exit=0`. |

**V-13 in words, for the report the owner reads.** The visual-baseline receipt flow is **win32/linux-only by
schema** and cannot run on the Mac these lanes use. The plan therefore does **not** ask any lane to write,
update or accept a baseline. The expected local result is a red `browser:visual` run whose evidence — the
scenario id and the expected/actual/diff paths — is captured verbatim in the lane receipt and handed to the
owner for re-acceptance on the Windows box. A green `browser:visual` on this branch would mean the landing did
not change, which would itself be the bug.

**Mutation proofs the closer must have on record** (each is "poison it and the build goes red"):
F1's three ESLint probe exit codes · F2's unbounded-route fixture · F4's three restored v1 strings ·
F5's `radial-gradient` / `getContext` / `requestAnimationFrame` fixtures · F13 Arm A (one changed word),
Arm A′ (one restored retired fragment), Arm B (one moved constant), Arm C (each of the three phrases pasted
back) · F14's poisoned constant.

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| F1 | frontend | `eslint.config.mjs`, `apps/dashboard/src/app/curvature-v2-deny-list.structural.spec.ts`, `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx` | — | no |
| F2 | frontend | `apps/dashboard/src/app/pages/not-found/**`, `apps/dashboard/src/app/shared/ui/RouteFallback.tsx`, `apps/dashboard/src/app/app.tsx`, `apps/dashboard/src/app/route-boundaries.structural.spec.ts` | F1 | yes |
| F3 | frontend | `apps/dashboard/src/app/shell/AppShell.tsx`, `apps/dashboard/src/app/shell/AppShell.footer.spec.tsx` | F1 | yes |
| F4 | frontend | `apps/dashboard/index.html`, `apps/dashboard/src/app/index-head.structural.spec.ts` | F1 | yes |
| F5 | frontend | `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx`, `apps/dashboard/src/app/pages/landing/GammaSurfaceHero.spec.tsx` | F1 | yes |
| F6 | frontend | `apps/dashboard/src/app/pages/landing/samples.ts`, `apps/dashboard/src/app/pages/landing/ScoreStripSample.tsx`, `apps/dashboard/src/app/pages/landing/AiReadSample.tsx`, `apps/dashboard/src/app/pages/landing/StructureFieldSample.tsx`, `apps/dashboard/src/app/pages/landing/landing-samples.spec.tsx` | F1 | yes |
| F7 | frontend | `apps/dashboard/src/app/pages/landing/Landing.tsx`, `apps/dashboard/src/app/pages/landing/copy.ts`, `apps/dashboard/src/app/pages/landing/landing.spec.tsx`, `apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx` | F1, F3, F5, F6 | yes |
| F8 | frontend | `apps/dashboard/src/app/pages/blog/BlogPage.tsx`, `apps/dashboard/src/app/pages/blog/copy.ts`, `apps/dashboard/src/app/pages/blog/blog.spec.tsx` | F1 | yes |
| F9 | frontend | `apps/dashboard/src/app/pages/methodology/copy.ts` | F1 | yes |
| F10 | frontend | `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx`, `apps/dashboard/src/app/pages/methodology/methodology.spec.tsx` | F1, F9 | yes |
| F11 | frontend | `apps/dashboard/src/app/features/auth/RequireAuth.tsx`, `apps/dashboard/src/app/features/auth/copy.ts`, `apps/dashboard/src/app/features/auth/AuthDialog.tsx`, `apps/dashboard/src/app/features/auth/RequireAuth.spec.tsx` | F1, F2 | yes |
| F12 | frontend | `apps/dashboard/src/app/shared/ui/ValueCard.tsx`, `apps/dashboard/src/app/shared/ui/index.ts`, `apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx` | F1, F7 | yes |
| F13 | frontend | `apps/dashboard/src/app/curvature-v2-landing-and-site.structural.spec.ts` | F1, F7, F8, F9 | yes |
| F14 | frontend | `apps/dashboard/src/app/curvature-v2-landing-samples.structural.spec.ts` | F6, fidelity-repair-2 merge | no |
| F15 | frontend | `apps/dashboard-e2e/**` | F1, F2, F3, F7, F8, F10, fidelity-repair-2 merge | no |
| F16 | frontend | `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/lane-receipt.json` | F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15 | no |

**Backend lane: no rows. The backend track is empty by contract (`NO_BACKEND_CHANGE`)** — there is nothing to
spawn and nothing to close. The empty `apps/api` diff is asserted in the verification track as V-1.

### Notes on the table

- **Closer:** **F16** is the frontend lane's single closer (`Independent: no`, depends on every other frontend
  row). It owns leftover visual/serve state only — the compare-only visual run, the production bundle
  measurement and its §2.4 decision, and the lane receipt. It re-implements no worker path.
- **Prefix rule, checked.** No two `Independent: yes` rows share a write path. F2's single `/**` path
  (`pages/not-found/**`) prefixes nothing else. F5, F6 and F7 all sit under `pages/landing/` but name
  **disjoint files**, never the directory. F9 and F10 split `pages/methodology/` by file.
- **F1 overlaps F10 on `MethodologyPage.tsx` deliberately.** F1 is `Independent: no` and is the lane's serial
  prerequisite (every `yes` row depends on it), so the overlap is sequenced, not concurrent — the one-line
  import flip is what lets the deny-list ban `@/pages/**` wholesale instead of relying on an exception form
  the recorded GATE Q finding says misbehaves on this ESLint version.
- **`Independent: yes` and file naming.** SPEC §4 names the file surface for F4 (`apps/dashboard/index.html`),
  F7 (`Landing.tsx` via the cut table and the CTA-band table), F8 (`BlogPage.tsx:74`), F9
  (`pages/methodology/copy.ts`), F10 (the ten sections and both tables) and F11 (`RequireAuth.tsx:37-52,80-107`,
  `copy.ts:12,28,197`; `AuthDialog.tsx:232-237` in §5). F2, F5 and F6 are named by SPEC §2.2 items 1–6 and
  §2.5, which §4's state matrix references by component name. F3's mount site is named at §2.5
  (`AppShell.tsx:96-109`). F12's files are named at §8 cost 2, F13's mechanisms at §7 items 10/16/17 and F14's
  at §7 item 14.
- **F14 and F15 are the two `fidelity-repair-2` rows.** F15 **writes**
  `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`, a file that lane edits. F14 does not write a repair
  path but **reads** `pages/ticker/widgets/_kit/distanceToLevel.ts` as a live equality reference, which is the
  same hazard one step removed; it is marked `no` and blocked for the same reason rather than shipping a
  green-today/red-tomorrow pin.
- **Nothing in this plan writes** `apps/dashboard/src/app/pages/ticker/**`, `shared/ui/Widget/**`,
  `pages/ticker/widgets/_kit/**` or `features/trading/orders/**`. SPEC §2.2 is explicit: no ticker file is
  edited, which is what keeps the desk visual baselines off this feature's account.
- **Verdict:** the lane splits. Twelve of sixteen rows are `Independent: yes`; the four `no` rows are the
  serial prerequisite (F1), the two externally-blocked rows (F14, F15) and the closer (F16).

---

## Costs priced now, not discovered at the gate

Carried from SPEC §8, plus three this plan measured against the tree.

1. **`radius-scale.spec.ts:25-30`'s `PILL_SITES`** lists `pages/landing/Landing.tsx`, whose only
   `borderRadius: 999` is the "Dealer-gamma analytics" chip at `Landing.tsx:74`. F7 **keeps a declared pill in
   that file** so the pin stays green; if the implementation moves it, the entry is edited in the same commit —
   never waived.
2. **`ValueCard` goes zero-importer and is deleted; `ComingSoonCard` is parked** (deleting it red-builds
   `radius-scale.spec.ts:27` and the spec's own import, and `TickerDashboard.tsx:62` still uses
   `ComingSoonBox`). `ui-primitives.spec.tsx:61-82`'s fixture is renamed off the retired product copy.
   **`Jargon` is NOT orphaned** — `pages/scanner/Scanner.tsx:19` is a second importer (SPEC §8's `[lane-check]`,
   now checked at source).
3. **Two visual baselines move** — the committed `landing` scenario and whichever desk scenarios the footer
   mount reaches. Re-accepted through the receipt flow on both platforms, **never overwritten by a lane** (SF-1).
4. **`Landing.tsx:61` nests a second `<main>` inside `AppShell.tsx:97`'s** — fixed by the F7 rewrite (AC-F4).
5. **`apps/dashboard/index.html` carries three distinct v1 strings, not one** — F4 names each, because a guard
   written against one passes on the others.
6. **Both production entry-chunk numbers are recorded by F16.** The 20 kB gzipped figure is a decision rule,
   not a measurement anyone has made.
7. **The Chromium journey count rises 108 → 126.** Added coverage, not a breach of AC-G3.
8. **§7 items 16 and 17 couple the dashboard suite to `design/src/screens/*.mjs`.** That is the point — it is
   what makes "verbatim from the design source" and "cut, with cause" pins rather than intentions — but a later
   edit to those authored files red-builds the app until the pages move with them. Resolve as a deliberate edit
   in the same change: never a waiver, never a narrowed scan.
9. **NEW — the frozen browser-quality inventory must be edited** (F15 step 4). `tools/lib/manifest.mjs`
   hard-codes `inventory_id`, `tests.length !== 108`, `scans.length !== 9` **and a scan-id regex
   `/^A11Y-[1-9]$/` that structurally rejects a tenth scan.** AC-G1's "across the six surfaces" cannot be met
   without new scans, so the count and the regex move together, as a deliberate pin edit with the reason in the
   diff. The SPEC priced the count rise but not this validator.
10. **NEW — `tools/check-dashboard-bundle.mjs` gates `entry-index` at 22 KB brotli** (observed ~11 KB). The
    eager `StructureFieldCanvas` import spends that headroom. See the GATE Z conditional below.
11. **NEW — `landing-structure.spec.tsx`'s `VALUE_CARD_RAW` glob** (`:27-31`, `:106`, `:119-120`) sits inside
    the `:103-131` block SPEC §7 says to keep unchanged, and points at the file SPEC §8 cost 2 deletes. See
    "Contradictions surfaced".

---

## Planning-level decisions a reviewer should know

- **D1 — the methodology union is at the block level, not the section level.** SPEC §2.6 says each entry is
  `{kind:'prose'}` or `{kind:'table'}`. Two of the ten sections (Score and tier, Vocabulary) carry prose *and*
  a table, and the page must present exactly ten sections with a ten-entry index. A section-level union cannot
  express that without producing eleven or twelve index rows. Resolution: `MethodSection = {id, h, blocks}`
  with the discriminated union on `blocks`. The invariant §2.6 asks for is preserved — a table block cannot
  render as prose.
- **D2 — the on-this-page index is a plain vertical list at every width.** SPEC §9 open question 2 delegated
  the phone treatment with a binding constraint (AC-G1 and AC-M6 at 393, with a tap path and a focus path). A
  vertical list satisfies both, invents no affordance, cannot overflow, and leaves the six-band treatment to
  the successor. The design's horizontal scroller does **not** ship this phase.
- **D3 — the landing mirrors the desk's distance projection rather than importing it.** A page may not import
  a sibling page (repo rule and F1's deny-list) and no ticker file may be edited (SPEC §2.2), so
  `distancePercentOnly` is mirrored at module scope in `ScoreStripSample.tsx` and **pinned equal** by F14.
  That is exactly the mechanism §7 item 14 commissions.
- **D4 — `DefaultTickerRedirect` gets a route boundary too.** SPEC §2.5's first bullet states the invariant as
  "every route element in the table is wrapped in an `ErrorBoundary`", and §7 item 7 makes it build-breaking.
  `/ticker` is bare today, so the scan cannot go green without it. Boundary mount only; no behaviour change
  except on throw.
- **D5 — `RouteFallback` is imported by module path, not re-exported from `shared/ui/index.ts`.** The barrel's
  contents carry `arc.spec.ts:97-104`'s soundness argument; leaving it untouched keeps that scan's reasoning
  intact and costs nothing.
- **D6 — three new a11y scans, at 393 dark for the two documents and 1280 dark for the 404.** This mirrors the
  shipped convention (dense surfaces scanned at 393, wide states at 1280) and is the smallest set that makes
  AC-G1's "across the six surfaces" true. The landing's own dark/light pair (A11Y-1/A11Y-2) already exists and
  picks up the rewrite.

---

## Contradictions surfaced (resolved by the SPEC's own rule, not by narrowing)

**C1 — `landing-structure.spec.tsx:103-131` vs SPEC §8 cost 2.** §7 says "keep `:103-131` unchanged — the
`radial-gradient` and `ConvexityMotif` scans are earned negative space". That block also contains the
`VALUE_CARD_RAW` glob (`:27-31` declaration, `:106` `toHaveLength(1)`, `:119-120` the scanned entries), and
§8 cost 2 **deletes `ValueCard.tsx`**. Once the file is gone the glob is empty and `:106` fails. The two
sentences collide only on the literal word "unchanged"; the *intent* — do not weaken the two negative-space
scans — is unambiguous.

**Resolution the plan takes:** the two scans and their mutation guard are kept **byte-for-byte**; the
`VALUE_CARD_RAW` glob and its two references are removed as a **deliberate pin edit in the same change** (the
rule SPEC §8 costs 1 and 8 establish for exactly this class), with the reason in the diff. This narrows
nothing: the scanned file no longer exists. **Flagged for the conductor** — if the owner reads §7's "keep
unchanged" as literal, the alternative is to park `ValueCard` beside `ComingSoonCard` instead of deleting it,
which contradicts §8 cost 2 and leaves a zero-importer component in `shared/`. The plan takes the pin edit.

**C2 — a conditional GATE Z stop, not a live one.** `tools/check-dashboard-bundle.mjs` fails the build if
`entry-index` exceeds **22 KB brotli** (observed ~11 KB, so ~11 KB brotli of headroom ≈ 12–13 KB gzip).
SPEC §2.4 licenses the `Suspense` split only above **20 kB gzipped**. If the measured entry-chunk growth from
the eager `StructureFieldCanvas` import lands **between** those two thresholds, `check:bundle` fails while the
SPEC's own escape hatch is not yet open. **F16 must STOP and report rather than raise the budget pin or
waive** — raising a measured budget is an owner decision, not a lane call. This is conditional on a
measurement nobody has taken; it is not a reason to hold the plan.

---

## What a reviewer should probe, per area

- **F1:** the three ESLint probe **exit codes**. A rule that prints nothing and exits 0 on the banned fixtures
  has not landed, and the whole zero-edge argument rests on it.
- **F2:** the `routeElements` regex's match count. Under-matching makes "every one is bounded" vacuous — that
  is why an 18-element floor is asserted first.
- **F5:** whether `error.main` / `success.main` are really the app's signed-direction slots. A wrong slot puts
  green on the put wall.
- **F6 step 0:** the regenerated `gexProfile()` output against this plan's 21 pairs. A mismatch is the plan's
  arithmetic being wrong; report it, use the tool's numbers.
- **F9/F13:** that the ten headings and their paragraphs were **copied**, not retyped. A retyped approximation
  is a defect, and Arm A is the only thing that can tell the difference.
- **F15:** that the manifest edit *raised* the counts to match reality and did not *loosen* any other check —
  `visual.scenarios.length !== 6` and `behaviors.length !== 7` stay exactly as they are.
- **F16:** that `browser:visual` was run **compare-only** and that no PNG under
  `apps/dashboard-e2e/src/quality/__screenshots__/` changed. `git status --porcelain -- apps/dashboard-e2e/src/quality`
  must show nothing after the run.
