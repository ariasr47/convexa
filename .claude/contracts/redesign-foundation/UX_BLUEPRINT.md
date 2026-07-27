# redesign-foundation — UX BLUEPRINT

> Role: Delivery UX / Tech-Writer (GATE U·X). Translates the canonical `DESIGN_HANDOFF.md` (+ the
> AMENDED `ARCHITECTURE_CONTRACT.md` and the 27-AC `PRODUCT_CONTRACT.md`) into component states +
> user-facing copy for the IN-SCOPE surfaces only: **Landing (`/`)** + **AppShell nav** (+ the shared
> theme foundation). Ticker / Positions / Scanner page internals / Settings-auth / operator / the new
> `/auth` route are OUT (deferred to features 2–4). Self-contained against `PROJECT_CONTEXT.md` (§7) +
> the inbound contracts; no chat-history dependency.
>
> This feature is a **purely visual reskin** + the theme foundation. The AC→component-state map in §6
> IS the required-tests matrix; the FRONTEND_EXECUTION_CONTRACT "Tests to write" note enumerates it so
> the FE *implements* (never *chooses*) the requirement set. NO_BACKEND_CHANGE — see INTERFACE_CONTRACT.

---

## 0. Canonical-order resolution + the one binding copy rule

Read order (authority descending): `DESIGN_HANDOFF.md` (wins on look + token VALUES + copy) →
`ARCHITECTURE_CONTRACT.md` (technical shape: reuse `theme.ts`, extras in `sx`, the accent note that
supersedes PM D4) → `PRODUCT_CONTRACT.md` (the 27 ACs) → `01-landing.png` / `02-ticker.png` (visual aid;
where a screenshot differs from `DESIGN_HANDOFF.md` the README wins on token values).

**Binding copy rule (preservation > fidelity).** `PRODUCT_CONTRACT` §6.1 + `ARCHITECTURE_CONTRACT` §3.4
make every **test-asserted** string immutable: the existing Vitest suite (`app.spec.tsx`,
`brand.spec.tsx`) queries exact strings + `data-testid`s. Where `DESIGN_HANDOFF.md` proposes copy that a
test currently asserts differently, **the test-asserted string is preserved** and the handoff copy is a
non-binding visual target (fidelity never licenses changing asserted copy — PM D1, AC-Inv-1). The copy in
§3/§4 below is the authoritative final copy; each string is tagged **[ASSERTED]** (a test reads it — must
not change), **[NEW-OK]** (no test reads it — may adopt handoff wording), or **[VISUAL]** (decorative,
non-text or aria-hidden). Deviations from the handoff are noted inline as **[DEVIATION]**.

---

## 1. The shared theme foundation (what Landing + AppShell consume; features 2–4 inherit)

The foundation is the EXISTING `theme.ts` reused unchanged in role + value, plus ONE additive Roboto Mono
numeric handle, plus the `sx`-level extras pattern. This section is the datum-surface map for the theme.

### 1.1 Tokens consumed by role (kept; never hard-coded, never re-based)

| Design role | Theme reference (by role) | Value (kept) | Where it surfaces on the in-scope surfaces |
|---|---|---|---|
| page background | `background.default` | `#0e1117` | Landing root `<Box>`; behind the shell pages |
| cards / panels | `background.paper` | `#161b22` | value cards, coming-soon cards, footer band; nav bar base |
| CTAs / links / active nav / brand | `primary.main` | `#4f9cff` | hero contained CTA, value-card text-links, scanner-cta, active nav underline, ConvexaMark arc, eyebrow pill, waitlist-ack text |
| calls / +gamma / +P&L | `success.main` | `#2ecc71` | (no Landing/nav use; preserved for inherited surfaces — AC-Inv-2) |
| puts / −gamma / −P&L | `error.main` | `#ff5c5c` | (no Landing/nav use; preserved for inherited surfaces — AC-Inv-2) |
| LIVE status / dot / live line | `info.main` (cyan ~`#29b6f6`) | MUI dark default | (no Landing/nav use; the LIVE role for feature 2 — preserved) |
| gamma-flip / stale / offline / **coming soon** | `warning.main` (amber) | MUI dark default | the **"coming soon"** chip accent on the brokerage + Scanner blocks |
| borders / tile baseline | `divider` | subtle slate | card outlines, nav bottom divider, footer divider |
| card radius | `shape.borderRadius` | `10` | all cards |
| UI body font | `typography.fontFamily` | `Inter, system-ui, …` | all text |
| **numeric mono handle** (additive) | one named theme handle (mono family / `monoFontFamily`) | self-hosted **Roboto Mono**, 600 | no numeric readout on Landing/nav, but the handle is ESTABLISHED here for features 2–4 |

### 1.2 Prototype-only extras — `sx` literals ONLY, never new theme keys (ARCHITECTURE §1.4, binding)

| Extra | Value | Surfaces (this feature) |
|---|---|---|
| panel-raised | `#1c2330` | optional raised surface above `background.paper` (e.g. a hover-raise on a value card) — `sx` only |
| text-secondary | `#8b949e` | sub-hook, value-card body, coming-soon body, footer caption (may also use `text.secondary` role) |
| text-disabled | ~`#5b6675` | inert "coming soon" affordance copy where a quieter-than-secondary tone is wanted |
| hatched "coming soon" fill | `repeating-linear-gradient(135deg, <paper> 0 18–20px, #14181f 18–20px 36–40px)` + dashed border | the brokerage block + Scanner block backgrounds (reads as inert) |
| nav translucent + blur | `background.paper` @ ~82% + `backdrop-filter: blur(12px)` | the AppShell bar |
| signed-in avatar gradient | `linear-gradient(primary.main → #7b5cff)` | the 32px gradient avatar (signed-in nav) — `#7b5cff` violet appears ONLY here (accent note) |

**Accent note (FIXED — supersedes PM D4; ARCHITECTURE GATE-Z).** cyan = `info.main` = the LIVE role
(features 2–4). Violet `#7b5cff` appears ONLY as the signed-in avatar gradient on the AppShell — it is
NOT a general "AI accent" and NOT a new theme key. On the in-scope surfaces, the only violet use is that
avatar gradient (and it is `sx`-level, gated to the signed-in state).

### 1.3 Both themes resolve (HARD — AC-Theme-1/2, AC-F4)

`theme` (dark default + anonymous baseline), `lightTheme`, and `themeForPref('light'|'dark'|'system')`
all keep constructing + resolving; the structure stays the `COMMON`-shared two-export shape (+ the
additive mono handle). `app.spec.tsx`'s direct `import { theme }` + render must keep working. Light mode
stays legible (D2) — any `sx`-level extra used on Landing/nav must have a legible light counterpart or be
gated to dark; nothing leaks dark-on-dark or dark-on-light.

### 1.4 Font fail-soft (AC-Type-2). A font asset that fails to load degrades to the system fallback stack
(`Inter → system-ui → Segoe UI → Roboto → sans-serif`; mono → `monospace`) — never a blank/broken/error
surface. No async, no fetch in theme construction.

---

## 2. AppShell nav — component states + copy

The persistent top chrome for the in-shell pages (Ticker/Positions/Scanner). **Structure unchanged**:
parent route rendering `<Outlet/>`, mounts once, does not remount across in-shell pages. The reskin is
visual: translucent blur bar (`sx`), gradient avatar (signed-in), tighter type. No new nav entry; NO
operator link, ever.

### 2.1 Bar (chrome) states

| State | Trigger | Visual | Copy / data |
|---|---|---|---|
| **default** | any in-shell page | sticky 60px bar, `background.paper` @ ~82% + `backdrop-filter: blur(12px)`, 1px bottom `divider`, max-width 1240 centered, 24px gutters | wordmark + Ticker · Positions · Scanner + account control |
| **page-error isolation** | a page-level error inside the outlet | the bar **persists unchanged**; the error renders inside the page area, never blanks the bar (AC-Inv pre-existing) | — |

The bar owns no feature data, makes no fetch, opens no SSE. It does not have loading/stale/offline/empty
states of its own — those belong to the page beneath the outlet (out of scope). The ONE async concern the
bar reflects is the account control's who-am-I read (§2.3), which is non-blocking.

### 2.2 Nav entries (Ticker · Positions · Scanner)

| State | Trigger | Visual | Copy [tag] |
|---|---|---|---|
| **inactive** | entry's `active(path)` false | `text.secondary` label, transparent 2px bottom border | `Ticker` / `Positions` / `Scanner` [ASSERTED — `data-testid` + label] |
| **active** | entry's `active(path)` true | `primary.main` label + 2px `primary.main` bottom border + `aria-current="page"` | same labels [ASSERTED] |
| **hover (inactive)** | pointer over an inactive entry | label brightens to `text.primary`; no layout shift | — [VISUAL] |
| **hover (active)** | pointer over the active entry | stays `primary.main` | — [VISUAL] |

Active rules (unchanged): Ticker = `path.startsWith('/ticker')`; Positions = `=== '/positions'` or
`startsWith('/positions/')`; Scanner = `=== '/scanner'` or `startsWith('/scanner/')`. Exactly one entry
is active per in-shell route. `data-testid`s `nav-ticker` / `nav-positions` / `nav-scanner` preserved.

### 2.3 Brand wordmark + account control (right side)

| Element | State | Visual | Copy [tag] |
|---|---|---|---|
| **wordmark** (`shell-brand`) | always | ConvexaMark (convex arc in `primary.main` + "Convexa" 700, −0.01em); links to `/` | `Convexa` [ASSERTED — `brand.spec` + `app.spec` assert the literal text; never "GammaFlow"] |
| **account — loading** | `auth.ready === false` | a neutral 88×32 rounded skeleton placeholder; the rest of the app renders (no blocking spinner) | — `data-testid="account-loading"` |
| **account — signed out** (incl. auth-degraded) | `auth.ready && !auth.authenticated` | outlined "Sign in" pill, person icon (`AccountCircleIcon`), `white-space:nowrap`; opens the AuthDialog | `AUTH_COPY.account.signIn` (existing — "Sign in") `data-testid="account-signin"` [ASSERTED via existing copy module — DO NOT change] |
| **account — signed in** | `auth.ready && auth.authenticated` | the display-name/email button + a **32px gradient avatar** (`linear-gradient(primary.main → #7b5cff)`); menu → Settings / Log out | name = `display_name ?? email ?? 'Account'`; menu copy from `AUTH_COPY.account.*` (existing) `data-testid`s `account-menu-button` / `account-email` / `account-settings` / `account-logout` [ASSERTED] |

**Reskin delta for AccountControl (visual only).** The handoff §1 calls for the signed-in **gradient
avatar** (`primary → #7b5cff`, 32px, links to Settings) + the signed-out **outlined "Sign in" pill** with
`white-space:nowrap`. AccountControl internals are otherwise a deferred surface (feature 4); this feature
adds ONLY the avatar-gradient + pill `sx` styling, preserving every existing `data-testid`, copy string,
menu behavior, and the auth-degraded→"signed out" treatment. **[DEVIATION]** the handoff shows the email
text beside the avatar at all times; the existing AccountControl shows the email inside the menu — keep
the existing structure (preservation wins); the avatar gradient is the in-scope visual change.

---

## 3. Landing (`/`) — component states + copy

Full-bleed, OUTSIDE the shell (renders NO trader nav). **Static**: rendering `/` issues no
trader/bundle/analysis fetch and opens no stream (the one-time non-blocking who-am-I read is excluded).
Single dark marketing surface. The whole page is one component with sub-sections; there is no
loading/stale/offline state (nothing fetches) — its "states" are the resting/acknowledged toggle on the
waitlist + hover affordances. The screenshot (`01-landing.png`) confirms: eyebrow pill, left-aligned
hero, 3-col value cards with tinted icon squares, a 2fr/1fr hatched coming-soon band, footer.

### 3.1 Hero (AC-Land-1)

| Element | Visual | Copy [tag] |
|---|---|---|
| convexity motif (`hero-motif`) | two bezier paths at ~0.12–0.16 opacity in `primary.main` + soft radial primary glow top-right; `aria-hidden` | — [VISUAL] keep both paths `M0 380 C 300 360, 600 240, 1200 30` + `M0 400 C 360 390, 700 300, 1200 90` |
| eyebrow pill | small pill, `primary.main` accent (tinted bg + primary text), pill radius | `Dealer-gamma analytics` [NEW-OK — no test reads it; screenshot shows it uppercased via styling] |
| brand mark | ConvexaMark at hero scale (size ~40) | `Convexa` [ASSERTED — `getAllByText('Convexa')` ≥ 1] |
| H1 headline | 700, −0.02em, line-height ~1.08–1.15, ~50px desktop | `See the AI read on your real positioning.` [ASSERTED — exact string, multiple tests] |
| sub-hook | `text.secondary`, max-width ~620, with a dotted "dealer gamma" tooltip | `Connect your positions and get an AI read on your real risk — grounded in live ` + **dealer gamma** (tooltip) + `, not vibes.` [ASSERTED-adjacent — keep existing sub-hook; the dotted "dealer gamma" tooltip token must stay present] |
| primary CTA (`cta-primary`) | contained, `primary.main`, size large | `Open the Ticker viewer →` [ASSERTED — `data-testid="cta-primary"`; navigates `/ticker`] |
| secondary CTA (optional) | outlined, `→ /ticker` | `See a live example` [NEW-OK — handoff §2 adds it; not test-asserted. **[DEVIATION]** today's Landing has no secondary CTA — adding it is OPTIONAL fidelity; if added it must navigate `/ticker` (no dead-end) and carry no new test-asserted `data-testid` beyond what FE chooses] |

Tooltip glossary text (kept verbatim — present on hover, `cursor: help`, dotted underline):
- **dealer gamma / Dealer gamma** → `How options dealers are positioned — it tells you where price tends
  to get pulled toward or pushed away from, and whether the market is likely to calm down or speed up.`
- **SIMULATED** → `Practice mode — positions and P/L are tracked for you, but nothing is sent to a broker
  and no real money moves.`

### 3.2 "What works today" value cards (AC-Land-2, AC-Land-8)

Eyebrow label above a 3-col grid of `background.paper` outlined cards. Each card: a tinted 40px rounded
icon square (primary-blue MUI glyph), title (700), `text.secondary` body (with jargon tooltips), and a
`primary.main` text-link CTA. Icons per handoff §Assets: `BarChart` (Ticker), `AccountBalanceWallet`
(Positions), `AutoAwesome` (AI). Card hover: border brightens toward `primary.main` / optional
panel-raise — no layout shift, ≤180ms.

| Card (`data-testid`) | Title [ASSERTED] | Body [ASSERTED-adjacent] | CTA label [ASSERTED via `data-testid`] | CTA → |
|---|---|---|---|---|
| `vp-ticker` | `Ticker / GEX analysis` | dealer-gamma walls/flip/flow copy with **Dealer gamma** tooltip | `Analyze a ticker →` (`vp-ticker-cta`) | `/ticker` |
| `vp-positions` | `Simulated positions portfolio` | paper-only copy with **SIMULATED** tooltip | `Open Positions →` (`vp-positions-cta`) | `/positions` |
| `vp-airec` | `AI recommendations` | risk-first/persona/advisory copy | `See it on a ticker →` (`vp-airec-cta`) | `/ticker` |

**[DEVIATION]** the handoff §2 proposes CTA labels `Open the Ticker viewer →` / shorter card copy; the
existing card CTA labels (`Analyze a ticker →`, etc.) are not test-asserted by string but the
`data-testid`s ARE asserted. Keep the existing labels (they read well + avoid churn) OR adopt the handoff
labels — either is acceptable since no test asserts the value-card CTA *text*; the FE keeps each
`data-testid` and each destination. The titles ARE test-asserted and are immutable.

### 3.3 Honesty band — coming soon (AC-Land-3, AC-H1, AC-H2)

2fr/1fr grid; both cards use the **hatched fill + dashed border** so they read as inert (must NOT look
like a working/primary control). Amber "coming soon" chip on each.

**Brokerage block (`brokerage-block`)** — the non-navigating waitlist affordance:

| State | Trigger | Visual | Copy [tag] |
|---|---|---|---|
| header | always | 🔒 (`aria-hidden`) + title + amber "coming soon" chip | title `Connect a real brokerage` [ASSERTED-adjacent]; chip `coming soon` [ASSERTED — `getByText('coming soon')` within the block] |
| body | always | `text.secondary`, hatched card | `Connect your real brokerage positions — get the same AI reads on the risk you're actually carrying. ` + **`Coming soon.`** (bold) [NEW-OK copy; keep "coming soon" marker queryable] |
| **resting** | `!waitlisted` | outlined small button (NOT contained/primary — honesty) | `Notify me — coming soon` `data-testid="waitlist-button"` [ASSERTED via testid] |
| **acknowledged** | after click → `waitlisted` | in-place text replacing the button; `primary.main`; NO navigation, NO network call, stays on Landing | `Thanks — we'll let you know when brokerage connect is live.` `data-testid="waitlist-ack"` [ASSERTED via testid] |

**Scanner block (`scanner-block`)** — coming-soon, links only to the honest placeholder:

| Element | Visual | Copy [tag] |
|---|---|---|
| header | title + amber "coming soon" chip | title `Scanner`; chip `coming soon` [ASSERTED — `getByText('coming soon')` within the block] |
| body | `text.secondary`, hatched card | `A multi-ticker scanner to surface the best setups across names. ` + **`Coming soon.`** [NEW-OK] |
| CTA (`scanner-cta`) | `primary.main` text-link → `/scanner` (the honest placeholder page; never a "working scanner") | `Preview the Scanner →` [ASSERTED via `data-testid="scanner-cta"`] |

### 3.4 Footer (AC-Land-4, AC-H3)

`Divider` then a footer band: small ConvexaMark (size ~16) + the disclaimer caption (`text.secondary`).

| Element | Copy [tag] |
|---|---|
| wordmark | `Convexa` [ASSERTED — contributes to `getAllByText('Convexa')`] |
| disclaimer (`footer-disclaimer`) | `Convexa is an analysis tool. All positions and trades shown are ` + **`simulated`** + ` (paper). Not investment advice. No brokerage connection.` [ASSERTED via `data-testid="footer-disclaimer"`; the "simulated" framing is honesty-floor — must stay] |

---

## 4. Degraded / honest-state wording (exact strings — the honesty floor under the new skin)

These are the only "degraded/honest" surfaces in this feature's scope (the Landing/nav have no
loading/stale/offline/empty data states because nothing fetches). They are preserved verbatim:

- **Coming-soon marker** (brokerage + Scanner blocks): the visible text **`coming soon`** (in the chip) +
  **`Coming soon.`** (in the body) — amber accent + hatched inert card. Must stay queryable + must not be
  restyled into a primary/working CTA.
- **Waitlist acknowledged**: **`Thanks — we'll let you know when brokerage connect is live.`** — in place,
  no nav, no network.
- **Footer simulated disclaimer**: the **`simulated`**/not-investment-advice/no-brokerage-connection
  string above.
- **Account loading**: a neutral muted skeleton (no copy) — non-blocking; the rest of the app renders.
- **Account auth-degraded**: treated as **signed out** → shows the "Sign in" control; the "couldn't reach
  sign-in" copy surfaces only on a gated action / submit (out of scope), never on the trader path.
- **Inherited surfaces (out of scope to reskin, in scope to NOT regress — AC-Inv-3/AC-Theme-3)**: the
  live-offline degrade stays **dimmed (`opacity: 0.5`) + `⏸ offline` caption, never blanked**; the
  `⚠ Live offline` chip stays amber/legible; SIMULATED labels stay. The new role mapping (info=live,
  warning=stale/offline/coming-soon, primary kept, success=calls/error=puts kept) must keep these
  visually distinguishable.

---

## 5. Microcopy / glossary / tooltip inventory (authoritative)

| Where | Text | Tag |
|---|---|---|
| hero H1 | See the AI read on your real positioning. | ASSERTED |
| hero eyebrow pill | Dealer-gamma analytics | NEW-OK |
| hero CTA | Open the Ticker viewer → | ASSERTED (testid) |
| "dealer gamma" tooltip | (full gloss above) | preserve verbatim |
| "SIMULATED" tooltip | (full gloss above) | preserve verbatim |
| vp titles | Ticker / GEX analysis · Simulated positions portfolio · AI recommendations | ASSERTED |
| coming-soon chip | coming soon | ASSERTED (within block) |
| waitlist button | Notify me — coming soon | ASSERTED (testid) |
| waitlist ack | Thanks — we'll let you know when brokerage connect is live. | ASSERTED (testid) |
| scanner CTA | Preview the Scanner → | ASSERTED (testid) |
| footer disclaimer | Convexa is an analysis tool. … No brokerage connection. | ASSERTED (testid) |
| wordmark | Convexa | ASSERTED |
| account sign-in | (existing `AUTH_COPY.account.signIn`) | ASSERTED — do not change |

---

## 6. AC → component-state map (THIS MAPPING IS THE REQUIRED-TESTS MATRIX)

Every in-scope PM AC maps to the component state(s) that satisfy it. The FE FRONTEND_EXECUTION_CONTRACT
"Tests to write" note enumerates each (AC × state × edge/invariant) so the FE implements — never chooses —
the set. QA traces AC↔test at GATE Q.

| AC | Component state(s) it pins | Named test (see FE contract §"Tests to write") |
|---|---|---|
| **AC-Land-1** | Hero default: motif + eyebrow + ConvexaMark + H1 + sub-hook + primary CTA, dark skin | `landing-hero-renders-redesigned` |
| **AC-Land-2** | Value cards default: three cards, titles present, card-row layout | `landing-value-cards-present` |
| **AC-Land-3** | Honesty band default: brokerage + Scanner both render, each "coming soon" | `landing-coming-soon-band-present` |
| **AC-Land-4** | Footer default: disclaimer present | `landing-footer-disclaimer-present` |
| **AC-Land-5** | Whole-page default vs `01-landing.png` (reviewer/visual) | `landing-matches-export` (reviewer note; assert hero+cards+band+footer structure all present) |
| **AC-Land-6** | Landing static: rendering `/` → no trader/bundle/analysis fetch, no EventSource (who-am-I excluded) | `landing-static-no-network` |
| **AC-Land-7** | Hero CTA active → navigates `/ticker` (default TSLA) into the shell | `landing-primary-cta-enters-ticker` |
| **AC-Land-8** | Value-card CTAs active → Positions→`/positions`, Ticker/AI→`/ticker`; no dead-end | `landing-value-cta-navigate-no-deadend` |
| **AC-H1** | Brokerage resting → acknowledged: "coming soon" marker; click → in-place ack, no nav, no network; not a primary control | `brokerage-coming-soon-non-navigating` |
| **AC-H2** | Scanner block: "coming soon" marker + `scanner-cta` → `/scanner` placeholder; never a working scanner | `scanner-block-coming-soon` |
| **AC-H3** | Footer simulated disclaimer present + honest under new skin | `simulated-labelling-preserved` (covered by footer test + brand/honesty assertions) |
| **AC-Nav-1** | Bar default + nav entries + wordmark "Convexa" (never "GammaFlow"); reskinned chrome | `nav-reskinned-persistent-wordmark` |
| **AC-Nav-2** | Bar persists across Ticker↔Positions↔Scanner (same DOM node, no remount) | `nav-persists-across-pages` |
| **AC-Nav-3** | Nav active state: current entry `aria-current="page"`; others not | `nav-active-tab-indication` |
| **AC-Nav-4** | Wordmark links to `/` (Landing), not operator | `wordmark-links-to-landing` |
| **AC-Nav-5** | On `/` the AppShell is NOT rendered | `landing-has-no-trader-nav` |
| **AC-Type-1** | Numeric mono handle established; Inter for body (foundation assertion — handle exists/loaded) | `mono-numeric-handle-established` |
| **AC-Type-2** | Font-fail → legible system fallback, no blank/error surface | `font-fail-degrades-legibly` |
| **AC-Theme-1** | `theme` (dark) constructs + the anonymous/never-touched render is dark, no theming error; direct `{ theme }` import renders | `dark-default-resolves` |
| **AC-Theme-2** | `lightTheme` + `themeForPref('light'\|'dark'\|'system')` resolve to a legible light palette | `light-theme-resolves-legible` |
| **AC-Theme-3** | Offline-dim stays distinguishable from normal + "unavailable this cycle" under the new role mapping | `offline-dim-distinguishable` (theme-level: assert info≠warning, dim opacity distinct) |
| **AC-Inv-1** | Every in-scope `data-testid` + asserted copy + role preserved; suite green | `testids-and-copy-preserved` (the existing `app.spec`/`brand.spec` stay green) |
| **AC-Inv-2** | Theme preserves green=calls/red=puts + blue/cyan/violet accent meanings | `accent-and-callput-meanings-preserved` |
| **AC-Inv-3** | Degraded + honesty visuals survive reskin (dim+offline never blanked; coming-soon honest) | covered by AC-H1/H2/H3 + AC-Theme-3 named tests |
| **AC-Inv-4** | NO_BACKEND_CHANGE; no theme/font is a scoring input; `apps/api` untouched | `no-backend-change-scoring-untouched` (assert no `/api/*` non-auth fetch from in-scope surfaces) |
| **AC-Inv-5** | No localStorage key/value change; keys stay `convexa.*` | `durable-keys-unchanged` |
| **AC-Inv-6** | No nav/Landing link reaches `/_ops/metrics`; operator off-shell | `operator-separation-preserved` |
| **AC-Inv-7** | No second ThemeProvider/Router; one theme + one router work for deep-link/nav/theming | `single-theme-single-router` |

Edge/invariant cases folded into the matrix above (each becomes a named test or an assertion within one):
static-no-network (AC-Land-6), non-navigating + no-network waitlist (AC-H1), Scanner links only to
placeholder (AC-H2), no-remount (AC-Nav-2), auth-degraded→signed-out (AccountControl), font-fail fallback
(AC-Type-2), light-mode legible (AC-Theme-2), offline-dim distinguishable (AC-Theme-3), operator
separation (AC-Inv-6), durable-key stability (AC-Inv-5), single provider/router (AC-Inv-7).

---

## 7. Fields the UI consumes (naming only — no payload/endpoint decisions; see INTERFACE_CONTRACT)

- **Landing**: consumes NO server field. Static. The waitlist toggle + the value-card destinations are
  client-local.
- **AppShell / AccountControl**: consumes the existing **who-am-I** read via `AuthContext` (the
  `/api/auth/session` read, non-blocking, fired app-wide on mount). The fields the nav surfaces from it:
  `auth.ready` (loading vs resolved), `auth.authenticated` (signed-out pill vs signed-in avatar),
  `auth.user.display_name` / `auth.user.email` (the name + menu email). **No new field, no new endpoint,
  no changed request** — these are existing reads, consumed unchanged. Full FE↔BE truth in
  INTERFACE_CONTRACT.md.
