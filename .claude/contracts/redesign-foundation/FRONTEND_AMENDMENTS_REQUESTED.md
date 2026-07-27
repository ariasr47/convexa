# redesign-foundation — amendments bounced to FRONTEND (owner preview gate · 2026-06-29)

## Trigger
The **owner local-preview gate** (before GATE Q) found the built Landing does NOT match the
canonical design (`DESIGN_HANDOFF.md` + the standalone/`Convexa.dc.html` reference + the owner's
reference screenshot).

## The gap — Landing is MISSING its top navigation bar
The canonical design renders the Landing **with a top nav bar**:
`Convexa` wordmark (links `/`) · **Ticker · Positions · Scanner** links · right-aligned **Sign in**
pill (signed-out) / gradient avatar (signed-in). The current build renders the Landing with only the
in-hero wordmark and **no top nav** — the hero/value-cards/coming-soon/footer are otherwise correct.

**Why it slipped:** the inbound contracts framed the Landing as "full-bleed, outside the shell
(unchanged routing)" (the OLD app-shell-landing decision, where the landing had no nav), so the
reskin kept it nav-less. The new design puts the nav on the landing. The canonical `DESIGN_HANDOFF.md`
screenshot WINS — the landing must show the nav.

## The fix (Frontend lane)
- ADD the top nav to the Landing, **visually identical to the reskinned AppShell nav** (sticky,
  translucent `background.paper` @ ~82% + `backdrop-filter: blur(12px)`, max-width 1240, ~60px).
- **Reuse, don't duplicate:** extract a shared nav component (e.g. `shell/TopNav.tsx`) consumed by
  BOTH `AppShell` and `Landing`, so the two can never drift. (AppShell keeps its `<Outlet/>`; the
  Landing renders the shared nav above its full-bleed hero.)
- **Routing UNCHANGED:** the Landing stays at `/` OUTSIDE the AppShell `<Outlet/>` (do NOT move the
  route into the shell). The nav appears because the landing renders the shared nav component, not
  because routing changed. SSE page-scoping is unaffected (the landing still does NO fetch).
- Nav behavior on the Landing = same as the shell: wordmark → `/`; Ticker/Positions/Scanner navigate
  in-app; right side = the existing `AccountControl` (signed-out "Sign in" pill → auth modal in
  `signup` mode; signed-in → the `primary→#7b5cff` gradient avatar → Settings).

## Preserve (unchanged)
Every existing Landing `data-testid` / copy / behavior (hero, value cards + CTA destinations,
non-navigating waitlist, footer disclaimer); `apps/api` untouched (NO_BACKEND_CHANGE, score
byte-identical); both themes resolve; honesty surfaces stay honest.

## Tests + re-verify
- Add Landing-nav tests: the Landing renders the wordmark + the 3 nav links + the Sign-in control;
  the links navigate; Sign-in opens the auth modal. Keep the full suite green.
- Re-run `nx test dashboard` + `nx lint dashboard` + `nx build dashboard` + boot, then report.
- The conductor RE-PREVIEWS (owner gate) before GATE Q.
