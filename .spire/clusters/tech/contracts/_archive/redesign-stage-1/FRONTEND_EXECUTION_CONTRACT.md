# redesign-stage-1 — FRONTEND_EXECUTION_CONTRACT

> **Lane:** GATE V fast-path (UX → Frontend). **Backend lane: `NO_BACKEND_CHANGE`** — no
> INTERFACE_CONTRACT, no BACKEND_EXECUTION_CONTRACT; the **empty `apps/api` diff is itself an
> acceptance criterion** (§7 / §9).
>
> **Rule-of-record:** `.claude/skills/convexa-design/SKILL.md` (§Direction ACTIVE) +
> `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` **§3 = the token SOURCE OF TRUTH** (values are
> NOT re-derived or "improved" here; §6a rulings bind — Figma DS retired, `tokens.ts` is the single
> authority, theme-audit gaps fold in) + `.claude/DESIGN_RULES.md`.
>
> **What Stage 1 is:** the Curvature Terminal identity lands at the **TOKEN LAYER** —
> `tokens.ts`/`theme.ts` + fonts + the blog GENERATOR. Components already bind to tokens, so the
> swap propagates by construction. The component layer is deliberately (mostly) untouched; the
> ONLY component edits permitted are the **closed forced-rebind list in §3.3** (sites whose current
> theme-slot binding would produce a semantic inversion under the new slot values). Anything else
> is Stage 2/3 (§6).
>
> Sources: `BRIEF.md` (6 scope items — scope law) · `CONTEXT_PACK.md` · proposal §3/§5/§6a ·
> skill §Direction + banned-tells + enforcement table · `_archive/redesign-stage-0/` (contract
> shape + §8/§9 pattern).

---

## 1. Design front-half (DESIGN_RULES §1.1–§1.4, folded in — "Design tokens + signature")

**Brief pinned.**
- **Subject:** Convexa's token layer — the single surface every page inherits color and type from.
- **Audience:** solo retail options swing traders who live in dark broker terminals and distrust
  dashboards that lie; they revere the amber-phosphor terminal, not the code editor.
- **Single job of this pass:** stop wearing GitHub Dark's borrowed clothes at the layer every
  surface inherits from — land ink/panel/phosphor/steel/gammaAmber/signal + the Archivo/Plex trio
  in `tokens.ts`/`theme.ts`, with light parity **measured**, and make the retired identity
  **structurally unreachable** (hex-scan ban list).

**Structure before style.** No layout, no component structure, no new surfaces. The structural
moves are all substitutions: token values, MUI palette slots, font assets, the blog template's CSS
block, and the closed §3.3 rebind list.

**Token plan = proposal §3, verbatim (not re-derived).** Dark: `ink #0B0F17` · `panel #131A24` ·
`phosphor #E9E4D6` · `steel #8A9BB4` · `gammaAmber #F2A93B` (DOMINANT) · `signal #5E8BC4`
(deliberately quieter). Warning conflict resolved: burnt orange `#E07A3F` + icon ALWAYS. Light:
`paper #F6F6F3` · ink text `#17202B` · amber darkened `#C9821A`. Type: Archivo (display,
SemiExpanded/Expanded 600–800) + IBM Plex Sans (body/UI) + IBM Plex Mono (data, tabular). Scale:
display 44–56 · H2 28 · section labels 13 caps +6% tracking · body 15/1.65 · data 13–15 mono ·
chip floor 11px stands. Semantic P/L green/red **UNCHANGED and reserved**.

**Signature:** NONE lands here. The convex-arc signature (mark X, hero curve-draw, arc dividers)
is Stage 2. The wordmark goes amber *automatically* (ConvexaMark binds `primary.main`); the mark
geometry is untouched.

**Self-critique (recorded; proposal §4 carries the direction-level critique).** Stage-1-specific
risks, named: (1) **slot leakage** — the old theme used ONE amber (`warning`) for three different
meanings (stale/offline, flip line, coming-soon); a blind value swap would paint the flip line and
"coming soon" in burnt-orange alarm. The §3.3 rebind list is the mitigation: brand-amber meanings
move to `primary`, true warnings stay on `warning`. (2) **Amber sprinkling** — amber is now
`primary`, and `primary` is bound in many places (links, chips, borders, active nav). The
resolution: links/info rebind to `signal` at the slot level (`info`), and the render pass carries
an explicit "spent, not sprinkled" check (§8 review row). (3) **Bloomberg pastiche** — accepted
deliberately as heritage per proposal §4; differentiated by warm phosphor text (the curvature
grammar arrives in Stage 2). (4) The default failure mode for a token swap is to "improve" values
mid-flight — rejected: §3 values land byte-exact; every value NOT given by §3 is listed in §5/§10
as a **derived** value with its derivation rule and measurement gate, never silently invented.

---

## 2. Execution order (binding)

1. **Fonts first** (§4): vendor the three faces self-hosted + `@font-face` + preload; verify OFL
   licenses; swap `typographyTokens`. (Type lands before color so the render pass never reviews a
   half-identity.)
2. **`tokens.ts` + `theme.ts` swap** (§3 + §5): palette values, extras, brandGradient, secondary/
   contrastText/light-text.primary/dark-shadows gap closure, typography variant map.
3. **Forced rebinds** (§3.3, closed list) + `index.html` theme-color literal.
4. **Light derivations measured** (§5 contrast table) — a failing pairing bounces the value before
   anything merges.
5. **Blog generator re-skin** (§4.4) + regenerate both output copies via the script.
6. **Test additions** (§8) incl. the hex-scan ban list, then the GATE Q battery (§9).

Also: rewrite the `tokens.ts` doc header — it currently declares Figma sync authority
("regenerate with `node scripts/sync-figma-tokens.mjs`"). Per §6a-3 the Figma DS is RETIRED:
the header must state `tokens.ts` is the single authority; do NOT run the sync script against the
retired Figma file (leave the script in place, marked deprecated in its own header).

---

## 3. The token map (scope items 1–2 — old value → new value/role, EVERY entry in `tokens.ts`)

### 3.1 `palette` (MUI slots)

**Dark** (`palette.dark`):

| Entry | Old | New | Role under the new palette |
|---|---|---|---|
| `primary` | `#4f9cff` | **`#F2A93B` (gammaAmber)** | THE brand, dominant: wordmark (via ConvexaMark), primary/contained actions, active nav + active states, focus ring (inherited by the Stage-0 ring), the flip line (via §3.3-1) |
| `primary.contrastText` | (implicit) | **`#0B0F17` (ink)** — NEW, explicit | Text on amber fills (theme-audit gap: explicit contrastText; measured §5) |
| `secondary` | ABSENT (MUI purple `#9c27b0` leaked) | **`#8A9BB4` (steel)** + explicit contrastText `#0B0F17` | Quiet structural accent; kills the purple leak (theme-audit gap; a banned-tell class) |
| `success` | `#2ecc71` | **UNCHANGED `#2ecc71`** | Reserved: calls / positive gamma / +P&L direction ONLY |
| `error` | `#ff5c5c` | **UNCHANGED `#ff5c5c`** | Reserved: puts / negative gamma / −P&L direction ONLY |
| `warning` | `#ffa726` | **`#E07A3F` (burnt orange)** | TRUE warnings only (stale/offline, error strips, degraded states) + icon ALWAYS (§3.2). The old slot's flip-line + coming-soon meanings MOVE OUT (§3.3) |
| `info` | `#29b6f6` | **`#5E8BC4` (signal)** | Links / info / live status (live dot, live line, live chip) — deliberately quieter than amber so one color dominates |
| `text.primary` | `#e6edf3` | **`#E9E4D6` (phosphor)** | Primary text — warm terminal phosphor (≥13:1 on ink, measured §5) |
| `text.secondary` | `#8b949e` | **`#8A9BB4` (steel)** | Secondary text / quiet structure |
| `text.disabled` | `#5b6675` | **`rgba(138, 155, 180, 0.5)`** — DERIVED (steel @ 50%; not in §3 — recorded §10-3) | Disabled/tertiary text, "unavailable this cycle" muting |
| `background.default` | `#0e1117` | **`#0B0F17` (ink)** | Canvas |
| `background.paper` | `#161b22` | **`#131A24` (panel)** | Raised surface (keeps the shipped elevation/inset-well system) |

**Light** (`palette.light`) — §3-given values verbatim; everything marked DERIVED follows §5's
measurement gate:

| Entry | Old | New | Note |
|---|---|---|---|
| `primary` | `#1d6fe0` | **`#C9821A` (amberDeep — §3's light amber)** | Measured §5; the one at-risk pairing (§10-5) |
| `primary.contrastText` | (implicit) | **`#17202B`** — NEW, explicit | Ink text on light amber (measured §5) |
| `secondary` | ABSENT | DERIVED: steel darkened for light (candidate `#5A6B85`) + measured contrastText | Gap closure, parity with dark |
| `success` | `#1e9e57` | **UNCHANGED** | Reserved P/L direction |
| `error` | `#d23b3b` | **UNCHANGED** | Reserved P/L direction |
| `warning` | `#ed6c02` | DERIVED: burnt orange darkened until ≥4.5:1 text on paper AND white (candidate `#A65526`) | Same icon-always rule |
| `info` | `#0288d1` | DERIVED: signal darkened until ≥4.5:1 on paper AND white (candidate `#3D6DA5`) | Links are body text — 4.5:1 applies |
| `text.primary` | ABSENT (MUI default) | **`#17202B`** — NEW, explicit | Theme-audit gap: explicit light text.primary |
| `text.secondary` | `rgba(0,0,0,0.6)` | **UNCHANGED** | Neutral alpha, not a brand hex, passes contrast |
| `text.disabled` | `rgba(0,0,0,0.38)` | **UNCHANGED** | — |
| `background.default` | `#f5f6f8` | **`#F6F6F3` (paper)** | Neutral-warm, deliberately clear of the cream tell |
| `background.paper` | `#ffffff` | **UNCHANGED `#FFFFFF`** | DERIVED ruling: white stays the raised surface above paper |

### 3.2 `extras` / `extrasLight` / brand / chart / elevation

| Token | Old (dark / light) | New (dark / light) | Note |
|---|---|---|---|
| `extras.panelRaised` | `#1c2330` / `#eef1f5` | DERIVED: one elevation step above panel, hue-consistent with ink — candidate **`#1B2432`** / **`#ECECE7`** | Dialog/toolbar raised fills; render-pass judged |
| `extras.hatchAlt` | `#14181f` / `#f0f2f5` | DERIVED: just-off-canvas hatch stripe — candidate **`#101520`** / **`#EFEFEA`** | Coming-soon hatch (ComingSoonBox) |
| `extras.textSecondary` | `#8b949e` / `rgba(0,0,0,0.6)` | **`#8A9BB4`** / unchanged | Mirrors palette |
| `extras.textDisabled` | `#5b6675` / `rgba(0,0,0,0.38)` | **`rgba(138,155,180,0.5)`** / unchanged | Mirrors palette |
| `extras.accentViolet` | `#7b5cff` (both) | **REMOVED — key deleted** | Violet retired ENTIRELY. Consumers rebound (§3.3-2); `tsc` proves zero importers remain |
| `extras.buttonPrimaryBg` | `#1d6fe0` (both) | **REMOVED — key deleted** | Existed only because bright-blue primary needed a deep fill for white text. Amber primary + explicit ink contrastText makes MUI's default contained treatment correct → the `MuiButton` dark-mode override branch in `theme.ts` is DELETED with it |
| `brandGradient` | `linear-gradient(135deg, #4f9cff, #7b5cff)` | **`linear-gradient(135deg, gammaAmber, amberDeep)`** = `#F2A93B → #C9821A`, built from tokens | Still mode-invariant (logo-like). Consumers (avatar, AccountControl sign-up pill) untouched. The mark itself is rebuilt in Stage 2 |
| `chartCategorical.stages` (6 hues) | Tableau-10 subset | **UNCHANGED** | Deliberately NON-semantic, non-brand, colorblind-distinguishable operator series (`/_ops/metrics` only, off the trader path). The brand palette does not govern diagnostic series hues |
| `chartCategorical.singleLine` | `#4e79a7` | **UNCHANGED** | Same rationale |
| `chartCategorical.staleDot` | `#9e9e9e` | **UNCHANGED** | Neutral grey, non-semantic by design |
| `elevation` (dark + light ladders) | e1/e2/e4 rgba shadows | **UNCHANGED values**; ADDITIONALLY the dark theme gains an explicit MUI `shadows` array derived from the ladder | Theme-audit gap "dark `shadows`": stock MUI shadows are light-tuned; map slot 1→e1-class, 2–7→e2-class, 8+→e4-class (implementation latitude on interpolation; requirement: menus/popovers/dialogs visibly separate on `panel` in dark, render-pass judged) |
| `shape` | `{ borderRadius: 10 }` | **UNCHANGED** | — |

Structure note (allowed, recommended): export the named brand constants (`ink`, `panel`,
`phosphor`, `steel`, `gammaAmber`, `amberDeep`, `signal`, and the warning orange) once in
`tokens.ts` and have `palette`/`extras`/`brandGradient` reference them — the names are part of the
identity and keep the map legible. No component imports these directly; components keep binding
MUI slots / `extrasFor(theme)`.

**Degraded/offline tints — enumerated (semantics unchanged, `[live-vs-static-isolation]`):**
offline dim = 50% opacity (token-free, untouched) · `⏸ offline` / `⏸ last known` captions =
`text.secondary` → steel · `⚠ Live offline — reconnecting…` chip + stale session chip = `warning`
slot → burnt orange (glyph already present ✓ icon rule) · "Couldn't refresh" strip = warning Alert
(icon built-in) · "unavailable this cycle" family = `text.disabled` → steel-alpha · cold-load
skeletons = MUI Skeleton over `panel`. No degraded state re-derives a label or changes meaning —
they re-tint through the very tokens this feature swaps.

### 3.3 Forced rebinds — the CLOSED component-edit list (anything beyond this list is out of contract)

These are sites where the old one-amber-three-meanings slot (or retired violet) would invert
semantics under the new values. Each edit changes ONLY which theme slot a color binds to.

1. **`pages/ticker/widgets/gex-profile-chart/chart.tsx` — recolor via tokens ONLY; orientation/
   frame/geometry LOCKED (§6a-1).** Flip reference line + label: `warning.main` →
   **`primary.main`** (gammaAmber — "the flip line it already owns"). Spot reference line +
   label: `primary.main` → **`text.secondary`** (steel — quiet structural anchor; leaving it on
   primary would collide spot with flip in the same amber). Live line + label: stays
   **`info.main`** (now signal). Bars/walls stay `success`/`error`/`common.white` — untouched.
2. **`shared/ui/ValueCard.tsx`** (the two `accentViolet` sites): the top-edge gradient →
   `linear-gradient(90deg, primary.main, amberDeep-equivalent)` or solid `primary.main`; the icon
   tint blend → `alpha(primary.main, …)` only. No violet; no new hue.
3. **`features/trading/model/OpportunityTier.tsx`**: tier emphasis is an ACTIVE/brand state, not a
   warning — `warning.main` (actionable) → **`primary.main`**; `warning.dark` (prime) →
   **`primary.dark`**; the Prime banner keeps its icon but its `severity="warning"` coloring is
   re-bound to amber (sx override on the Alert, or a non-warning severity + amber sx — icon stays).
4. **Coming-soon amber accents** (brand-flavored, not warnings): `shared/ui/ComingSoonCard.tsx`
   badge, `pages/scanner/Scanner.tsx` badge + tints, `features/trading/positions/LiveTabPanel.tsx`
   note: `warning.main` → **`primary.main`**. (The `LiveTabPanel` zero-import lock is untouched.)
5. **`shared/theme/theme.ts`**: delete the `MuiButton` contained-primary dark override (rides out
   with `buttonPrimaryBg`); contained primary = amber + ink contrastText via the palette, both
   modes.
6. **`apps/dashboard/index.html:15`**: `<meta name="theme-color" content="#0e1117">` →
   `content="#0B0F17"` (the pre-React first-paint literal — outside `src/`, permitted as a
   literal, guarded by §8-4 to match `palette.dark.background.default` byte-exactly).

Everything else — every `primary`/`info`/`warning`/`text.*`/`extras` consumer not named above —
is **untouched** and inherits the swap by construction. Stale/offline chips, order stale strips,
degraded Alerts, pending captions, TintChip's `warning` tone, AiRec degraded text, Setups
conviction chips: all stay bound to `warning` and turn burnt orange (see §10-6 for the
conviction-chip semantics flag).

---

## 3b. Amber-vs-warning — the implementable rule (scope item 2)

**Rule (binding, from proposal §3):** brand amber `#F2A93B` is *filled/structural* — wordmark,
primary actions, active states, the flip line. Warnings are `#E07A3F` burnt orange and **ALWAYS
pair with a non-color signifier (icon or glyph)** — hue alone never carries "warning."

**Implementation:**
- `palette.warning` = `#E07A3F` (dark) / §3.1's measured light derivation. Warning surfaces do not
  otherwise change.
- **Components that show warnings today** (the icon-rule inventory — each already carries, and must
  keep, an icon/glyph):
  - MUI `<Alert severity="warning">` sites (icon is built-in — the structural rule is **no
    `icon={false}` on a warning Alert**, §8-9): `features/trading/TradeEntryDialog.tsx` (scenario
    strip, stale strip, inline error), `features/trading/positions/PortfolioPanel.tsx`
    (entry-failure toast), `features/trading/orders/OrderDetailDialog.tsx`,
    `pages/operator-metrics/operator-metrics.tsx` (degraded alert),
    `pages/ticker/TickerDashboard.tsx` ("Couldn't refresh" strip),
    `pages/ticker/widgets/ai-rec/AiRecPanel.tsx` (degraded/scripted strips),
    `pages/ticker/widgets/ai-rec/StateExportDrawer.tsx`, `features/auth/AuthDialog.tsx` (signup
    conflict), `features/auth/AiKeySection.tsx`, `features/auth/SignInPrompt.tsx` (degraded mode).
  - Non-Alert warning-toned sites carrying their own glyph/label:
    `pages/ticker/widgets/chrome/TickerHeader.tsx` session/offline chips (`⚠` / `⏸` in the label),
    `features/trading/orders/OrderRow.tsx` pending/armed captions (text labels),
    `features/trading/positions/CustomizationToolbar.tsx` caption,
    `pages/operator-metrics/LatencyTrend.tsx` restart/stale chip.
  - `features/trading/model/OpportunityTier.tsx`, `ComingSoonCard`, `Scanner`, `LiveTabPanel`,
    and the chart flip line are NOT warnings — they move to amber (§3.3-3/4/1).
- **Rule for new work** (carried in the tokens.ts header comment): a surface that means "warning"
  binds `warning.*` AND renders an icon/glyph; a surface that means "brand/active" binds
  `primary.*`. Never the old shared-amber ambiguity.

---

## 4. The type plan (scope item 3)

### 4.1 Faces — self-hosted, no CDN (deployed CSP / same-origin discipline)

| Role | Face | Weights/axes needed | License |
|---|---|---|---|
| Display | **Archivo** — SemiExpanded/Expanded, 600–800 | wght 600–800 + width axis (see §10-1) | OFL 1.1 — **verify** |
| Body/UI | **IBM Plex Sans** | 400 / 500 / 600 / 700 | OFL 1.1 — **verify** |
| Data/tape | **IBM Plex Mono** | 400 / 500 / 600 | OFL 1.1 — **verify** |

- **OFL license check step (required, recorded in the PR):** before vendoring, confirm each face's
  OFL 1.1 license text is present in the obtained package/download and **ship the license files
  alongside the assets** (e.g. `public/fonts/<face>/OFL.txt`). A face that cannot be confirmed OFL
  does not ship — bounce to §10.
- **Delivery:** `@fontsource`/`@fontsource-variable` packages OR first-party
  `apps/dashboard/public/fonts/` woff2 + authored `@font-face` (in `src/styles.css`, currently
  empty, or a dedicated fonts css linked from `index.html`). Requirements either way:
  1. **Same-origin only** — zero external font hosts (no fonts.googleapis/gstatic, no CDN URL
     anywhere in `@font-face`/`<link>`); enforced by §8-3.
  2. **`font-display: swap`** on every face.
  3. **Preload the critical faces** in `index.html`: `<link rel="preload" as="font"
     type="font/woff2" crossorigin>` for IBM Plex Sans 400 and IBM Plex Mono 400 (the
     first-paint body + data faces). Archivo may load on swap (display-only surfaces). If
     `@fontsource` hashed URLs make preload impractical, use the `public/fonts/` route (§10-1).
  4. Fallback stacks retain system faces (fallbacks are not "identity"; Inter is REMOVED from the
     stack entirely — it is the retired identity, not a fallback).

### 4.2 `typographyTokens` map

| Token | Old | New |
|---|---|---|
| `fontFamily` | `Inter, system-ui, Segoe UI, Roboto, sans-serif` | `'IBM Plex Sans', system-ui, 'Segoe UI', Roboto, sans-serif` |
| `monoFontFamily` | `"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — propagates to every data consumer (StatTile, PositionRow/Card, orders, charts' MONO, AiRec verdicts, PositionsPage, TrackRecord, …) with zero component edits |
| `displayFontFamily` | (new) | `'Archivo', 'IBM Plex Sans', system-ui, sans-serif` + the width treatment (semi-expanded; §10-1) |

### 4.3 MUI typography variant map (the proposal §3 scale)

- `h1`–`h4`: **Archivo** (display face), weight 700 (h1) / 600–700, SemiExpanded width. In-app
  sizes are STRUCTURAL and stay (h1 remains `1.6rem` — the ticker anchor; the 44–56px display
  scale is the LANDING hero's, which Stage 2 rebuilds; Stage 1 exports the display scale constants
  so Stage 2 consumes them, but rescales no shipped surface). `h2` = 28px (`1.75rem`) 700 per the
  proposal scale.
- `h5`/`h6`/`subtitle*`: **IBM Plex Sans**; `h6` keeps `1rem / 600 / 1.25` (widget titles).
- `overline` = the section-label spec: 13px (`0.8125rem`), 600, uppercase,
  `letterSpacing: '0.06em'`, Plex Sans.
- `body1` = 15px (`0.9375rem`) / lineHeight 1.65 · `body2` = 13px (`0.8125rem`).
- `caption` stays `0.75rem` (12px — above the 11px chip floor, which stands).
- `button`: Plex Sans 600, `textTransform: 'none'` (existing rule kept).
- **Mono-with-tabular-nums for every data variant:** `monoFontFamily` leads with Plex Mono
  (figures tabular by construction); belt-and-braces, the `MuiCssBaseline` override adds a global
  `fontVariantNumeric: 'tabular-nums'` at the root (Plex Sans supports `tnum`; aligned figures on
  a data terminal are a feature — render-pass judged, §8 review).

---

## 5. Light parity — a DERIVED artifact + the REQUIRED contrast table (scope item 4)

Light values are derived, never assumed. **Every pairing below is MEASURED with a real contrast
tool (not asserted from memory) and the measurements recorded in the PR/report. A failing pairing
bounces the VALUE (darken/lighten minimally until it passes), never ships — §3-given values that
fail get bounced too, with the bounce recorded in §10 and the report (never silently shipped, never
silently "fixed").** Thresholds: **≥4.5:1** body text · **≥3:1** large text (≥24px, or ≥18.66px
bold) and non-text UI (WCAG 1.4.11).

Required pairings (both the §3 values and the derived candidates):

| # | Foreground | Background | Class / threshold |
|---|---|---|---|
| D1 | phosphor `#E9E4D6` | ink `#0B0F17` | body ≥4.5 (proposal claims ≥13:1 — measure it) |
| D2 | phosphor | panel `#131A24` | body ≥4.5 |
| D3 | steel `#8A9BB4` | ink AND panel | body ≥4.5 (secondary text) |
| D4 | signal `#5E8BC4` | ink AND panel | body ≥4.5 (links are body text) |
| D5 | gammaAmber `#F2A93B` | ink AND panel | large/UI ≥3 (active states, flip label; ≥4.5 where amber renders body-size text) |
| D6 | ink `#0B0F17` (contrastText) | gammaAmber | body ≥4.5 (contained-button labels) |
| D7 | warning `#E07A3F` | ink AND panel | body ≥4.5 (warning captions are body-size) |
| D8 | success `#2ecc71` / error `#ff5c5c` | ink AND panel | UNCHANGED values — measure + record only (baseline documentation, no bounce without GATE Z: they are reserved and byte-locked) |
| L1 | ink text `#17202B` | paper `#F6F6F3` AND white | body ≥4.5 |
| L2 | light secondary text `rgba(0,0,0,0.6)` | paper AND white | body ≥4.5 |
| L3 | amberDeep `#C9821A` | paper AND white | **UI ≥3** (the known at-risk pairing, §10-5); ≥4.5 wherever it renders body text |
| L4 | light contrastText `#17202B` | amberDeep | body ≥4.5 (button labels) |
| L5 | light warning (candidate `#A65526`) | paper AND white | body ≥4.5 |
| L6 | light info/signal (candidate `#3D6DA5`) | paper AND white | body ≥4.5 (links) |
| L7 | light secondary (candidate `#5A6B85`) + its contrastText | paper / on-fill | UI ≥3; label ≥4.5 |
| L8 | light success `#1e9e57` / error `#d23b3b` | paper AND white | measure + record (byte-locked, as D8) |
| X1 | focus ring (primary) | ink (dark) and paper (light) | UI ≥3 (the ring must be visible on the new canvas) |

The full table (pairing → measured ratio → pass/bounce → final value) is a REQUIRED artifact of
the GATE Q report (§8 review row 1, §9-7).

---

## 4.4 The blog re-skin — via the GENERATOR only (scope item 6)

**Touchpoint: `docs/blog/build_html.py` (the TEMPLATE block) — NEVER the generated articles.**
The script is the sync step; it emits both `docs/blog/*.html` and
`apps/dashboard/public/blog/*.html`. Both copies are regenerated by running the script
(`py docs/blog/build_html.py`) and committed.

Template mapping (kills the literal slop-tell cream + Segoe):

| Template rule | Old | New |
|---|---|---|
| `color-scheme` | `light` | `dark` (the blog joins the terminal identity) |
| body background | `#F4F1EB` (BANNED) | ink `#0B0F17` |
| body color | `#23252B` | phosphor `#E9E4D6` |
| body font | `'Segoe UI', system-ui, …` | `'IBM Plex Sans', system-ui, 'Segoe UI', …` (self-hosted `@font-face` per §10-2; same-origin `/fonts/…` URLs only) |
| body line-height | 1.7 | 1.65 (proposal body scale; body size 15px) |
| h1/h2/h3 | inherited Segoe | Archivo (display face), h1 keeps its clamp behavior |
| `code` bg / font | `#E9E5DC` / Cascadia | panel `#131A24` / `'IBM Plex Mono', Consolas, Menlo, monospace` |
| links `a` | `#2E6F69` | signal `#5E8BC4` (≥4.5 on ink — D4 covers it) |
| blockquote border / text | `#B4562B` / `#3a3d45` | gammaAmber `#F2A93B` / steel `#8A9BB4` |
| `hr` / table borders | `#DAD5CC` | a steel-alpha divider (e.g. `rgba(138,155,180,0.25)`) |
| `th` bg | `#EDE9E0` | panel `#131A24` |
| figcaption | `#8A8170` | steel `#8A9BB4` |

The generator cannot import `tokens.ts` (Python); the template carries the values as literals
**with a comment naming `tokens.ts` as the source** — and §8-7 makes drift impossible: a spec
imports the real tokens and asserts the emitted HTML uses them (change tokens → the test forces a
regeneration).

---

## 6. NON-GOALS (explicit — touching these is out of contract)

- **No component restructuring** — Stage 3. The §3.3 closed list is the ONLY component surface.
- **No mark / arc / motion work** — Stage 2. ConvexaMark geometry, the landing hero, arc dividers,
  the staggered reveal: all untouched (the reveal + its 4 guard tests stay green; supersession is
  pre-approved FOR STAGE 3, not now).
- **No per-surface amber refinement beyond what the token layer gives** — Stage 3 owns the
  surface-by-surface amber-dominance sweep.
- **Chart orientation/frame untouched** — the vertical diverging GEX chart is LOCKED (§6a-1);
  §3.3-1 is a color-slot rebind only.
- **No durable-key change** — theme pref values `'dark'/'light'/'system'` and every `convexa.*`
  key/shape unchanged (`[loss-free-durable-migration]` not exercised).
- **No backend / API / wire change** — `apps/api` diff empty; `libs/api` untouched.
- **No copy changes** — Stage 0 landed the copy fixes; Stage 1 changes zero user-facing strings.
- **Landing hero visuals** (radial glow etc.) beyond what token inheritance changes — Stage 2.
- **Figma refresh / Code Connect** — explicitly optional later work (§6a-3), not part of done.

---

## 7. Binding invariants (restated for this feature)

- **`[theme-token-discipline]`** — THE mechanism; this feature is its biggest exercise. All color
  through `tokens.ts`/theme; mode-aware via `extrasFor(theme)`; zero hardcoded hex outside
  `shared/theme` (+ the accounted index.html first-paint literal and the generator template, both
  test-pinned to tokens); `hex-discipline.spec.ts` green throughout.
- **`[additive-keeps-score-byte-identical]`** — FE-only: `git diff main -- apps/api` empty at
  GATE Q; score/tier/`state_fingerprint` cannot move by construction.
- **Semantic P/L green/red UNCHANGED and reserved** — `success`/`error` byte-identical in both
  schemes (§8-5 pins them); no semantic tint on rates (existing className-identity tests stay
  green — outcome-ledger canon).
- **`[live-vs-static-isolation]`** — degraded-state tints re-derive from the swapped tokens with
  semantics unchanged (§3.2 enumeration); the existing degraded-state suite stays green untouched.
- **`[digested-labels-not-raw-dump]`** — closed lookups re-color, never re-derive: no label
  mapping (tones, tiers, session states) gains logic; only the slot values behind them change.
- **Vertical-GEX-chart lock** — §3.3-1 / §6.
- **`[loss-free-durable-migration]`** — expected NOT exercised; any accidental durable-shape touch
  is a STOP-and-flag.
- **convexa-design banned-tells UNREACHABLE** — the §8-1 ban list is the structural enforcement
  (structural-over-prose): GitHub neutrals, retired brand blues, violet, blog cream can never
  re-enter `src/`, `index.html`, or the blog output.

---

## 8. Tests to write (the requirement set — the FE implements these, never chooses them)

Risk rule (qa-verify §4): `test:` = invariants / negative space / silently-regressing behavior;
`review:` = visible/intentional, verified in the GATE Q render pass. No per-AC mirroring; the
existing suite baseline stays green throughout (zero deletions/weakenings of the degraded-state,
motion, className-identity, hex, focus suites).

| # | Kind | Case |
|---|---|---|
| 1 | `test:` | **Hex-scan ban list — the RETIRED identity is unreachable.** New spec (or an extension in `shared/theme/`): scan `src/app/**` (INCLUDING `shared/theme/` — unlike the existing scan), `/index.html`, and `apps/dashboard/public/blog/*.html` (all via `?raw` globs) for the banned hexes, case-insensitive: `#4f9cff`, `#1d6fe0`, `#7b5cff`, `#0d1117`, `#161b22`, `#8b949e`, `#e6edf3`, `#f4f1eb`, plus the outgoing canvas `#0e1117`. Zero exemptions. **MUTATION-GUARDED**: a fixture source containing a banned hex must fail the checker (a scan that can't fail is worthless); the spec holds the ban list in split/constructed form or relies on the spec-exclusion glob so it doesn't self-flag. Vacuity-guarded like the existing scan. |
| 2 | `test:` | **Token-map completeness — no orphan token.** Spec asserts the `tokens.ts` export shape: all §3.1/§3.2 keys present with the NEW values (the six §3 dark values byte-exact; `secondary`, explicit `contrastText`s, light `text.primary` present); removed keys (`accentViolet`, `buttonPrimaryBg`) ABSENT (`'accentViolet' in extras === false`); `brandGradient` composed only of gammaAmber/amberDeep. `tsc -b` (§9-1) proves no consumer still imports a removed key. |
| 3 | `test:` | **Fonts self-hosted — no external font URL.** Source-scan (`?raw`, mutation-guarded) over `index.html`, `src/styles.css` / the fonts css, and the blog TEMPLATE output (`public/blog/*.html`): every `@font-face`/`<link rel="preload" as="font">` URL is same-origin (no `http(s)://` font host, no `fonts.googleapis`, `fonts.gstatic`, `use.typekit`, `cdn`); `font-display: swap` present on every declared face; the preload links for Plex Sans 400 + Plex Mono 400 exist with `crossorigin`. Plus a filesystem assertion that the shipped license files (`OFL.txt` per face) exist beside the assets. |
| 4 | `test:` | **theme-color first-paint matches the new ink.** Spec imports `palette` from `tokens.ts` + reads `/index.html?raw`: the static `<meta name="theme-color">` content `===` `palette.dark.background.default` (byte-exact — guards §3.3-6 forever). The existing runtime ThemeProvider meta test stays green (dark→ink, light→paper via the live theme object). |
| 5 | `test:` | **P/L direction colors byte-identical before/after.** Pin spec: `palette.dark.success === '#2ecc71'`, `palette.dark.error === '#ff5c5c'`, `palette.light.success === '#1e9e57'`, `palette.light.error === '#d23b3b'` — literals pinned IN the spec (changing them requires editing the pin, i.e., a deliberate GATE Z act, never a side effect of a palette sweep). Existing rate/className-identity tests stay green. |
| 6 | `test:` | **Focus ring still visible on the new canvas.** The existing `focus-visible.spec.tsx` stays green unmodified (it binds to `primary.main` dynamically — the ring becomes amber by construction); add one assertion that the dark ring color now equals gammaAmber (guards against a future primary remap silently decoupling ring from brand). Visibility/contrast of ring-on-ink is X1 in the §5 table (review). |
| 7 | `test:` | **Blog generator output token-compliant.** Spec imports `tokens.ts` and reads `public/blog/*.html?raw`: emitted pages contain `palette.dark.background.default` (ink) as the body background and `#E9E4D6`/steel/signal values from tokens; contain NONE of the §8-1 banned hexes (cream especially); contain no external font URL (shares §8-3's checker); and `docs/blog/<slug>.html` ≡ `public/blog/<slug>.html` byte-identical where both are committed (the script IS the sync step — hand-edited drift fails). |
| 8 | `test:` | **Existing guard suites stay green, zero weakenings**: `hex-discipline.spec.ts` (unchanged scope — still zero hex outside `shared/theme` + the GoogleButton brand exemption, which contains no banned hex), degraded-state suites, reduced-motion/stagger guards, heading-semantics, 393px no-overflow, chip-floor, keyboard-operability (Stage 0 battery). The token swap must not require touching ANY of them — a needed edit there is a scope smell to report, not patch silently. |
| 9 | `test:` | **Warning-always-has-icon (structural half).** Source-scan (`?raw`, mutation-guarded): no `severity="warning"` Alert with `icon={false}` anywhere under `src/app/`. (The non-Alert warning sites' glyphs are review row 4 — presence of copy/glyphs is visible-intentional.) |
| 10 | `review:` | **The contrast table (§5)** — every pairing measured with a real tool, ratios recorded in the report, bounces (if any) listed with final values. A failing pairing that shipped = GATE Q FAIL. |
| 11 | `review:` | **Per-surface render sanity, both schemes** — the §9-6 Playwright pass: every major route, dark + light, 1440 + 393; self-critiqued per DESIGN_RULES §1.6 (spacing/hierarchy/contrast/crowding on the new canvas), with special attention to chart readability on ink (the BRIEF's named risk) and light-mode amber surfaces. |
| 12 | `review:` | **Amber dominance — spent, not sprinkled.** Eyes-on check that amber concentrates where the proposal spends it: the wordmark, contained/primary CTAs, active nav/states, the flip line — and that links/info/live now read signal-blue (quieter), warnings burnt orange with icons, and no surface shows the old even-sprinkle in a new color. |
| 13 | `review:` | **Blog before/after** — one article captured pre/post; the re-skin came exclusively from the generator (diff shows `build_html.py` + regenerated outputs only); typography/links/blockquote/code legible on ink. |
| 14 | `review:` | **Warning-site glyph walk** — the §3b inventory walked once: every warning surface shows its icon/glyph alongside the burnt orange; the §3.3 rebound amber sites (tiers, coming-soon, flip) no longer read as warnings. |
| 15 | `review:` | **Type render** — Archivo displays on h1/h2 (width treatment correct, no faux-stretch), Plex Sans body, Plex Mono tabular figures in StatTiles/positions rows; `font-display: swap` behavior sane on a throttled load; global `tabular-nums` produces no prose oddity. |

---

## 9. GATE Q battery (process riders, proposal §6a — all required)

1. `npx tsc -b` clean (also proves the removed-token keys have zero importers).
2. `nx build dashboard` green (fonts resolve, no external fetch at build).
3. `nx test @org/dashboard` — full suite green (Stage 0 baseline + the §8 additions), zero
   skipped/deleted guards.
4. Lint (module boundaries) green.
5. **Empty backend diff proof:** `git diff main -- apps/api` produces no output.
6. **Real-browser render pass (Playwright): 1440 AND 393, BOTH color schemes, ALL major routes** —
   `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings`, `/blog` + one generated article,
   and `/_ops/metrics` (its canvas changes too; `chartCategorical` series must stay legible on
   ink). Screenshots captured and self-critiqued per DESIGN_RULES §1.6 — or the explicit "not
   visually verified by eye" structural fallback note, never silently skipped. The pass explicitly
   walks: cold-load skeletons, offline degrade (kill the SSE source — burnt-orange chip + steel
   `⏸` captions on the new canvas), "unavailable this cycle" cells, the flip/spot/live reference
   lines, a contained-primary CTA in both modes, and the focus ring tabbed onto ink and paper.
7. **The contrast measurements** (§5 table) recorded in the report — Stage 1's addition to the
   battery; a missing or asserted-not-measured table is a FAIL.
8. Blog outputs regenerated via `py docs/blog/build_html.py` in the same PR (no hand-edited
   article diff).
9. Conformance specs: **n/a and correctly absent** — no FE↔BE surface changed.

---

## 10. Open questions (explicitly recorded — nothing silently decided)

1. **Archivo width-axis availability.** The display voice is Archivo SemiExpanded/Expanded
   600–800. Static `@fontsource/archivo` may not ship the width axis; the resolution is
   implementation latitude between (a) `@fontsource-variable/archivo` (wdth+wght variable) with
   `font-stretch`, or (b) the separate "Archivo SemiExpanded" static family files. **Never** a
   faux `transform: scaleX` stretch. If neither yields the width treatment self-hosted, ship
   Archivo normal-width 600–800 and flag the width treatment to the owner — not silently faked.
2. **Blog font embedding approach.** The template will reference the same-origin `/fonts/…`
   assets (blog pages are served from the same Pages origin). If asset pathing under
   `public/blog/*.html` proves brittle (e.g. hashed font filenames), the fallback is the system
   stack ONLY in the blog (`'IBM Plex Sans', system-ui, …` with Plex simply not loading) — flagged
   in the report, never an external CDN.
3. **`text.disabled` (dark) is not a §3 value.** Derived here as steel @ 50% alpha
   (`rgba(138,155,180,0.5)`). If the owner prefers a solid derived hex, it's a one-line change;
   the derivation (from steel, warm) is the binding part.
4. **Light-mode values not given by §3** (light warning, light info/signal, light secondary,
   `panelRaised`/`hatchAlt` both modes' new steps, light `background.paper` staying white): all
   are DERIVED candidates in §3/§5 with an explicit derivation rule + the measurement gate. The
   candidates are starting points, not §3 canon — measurement decides the final hex; results
   recorded in the §5 table.
5. **`#C9821A` (light amber) is the one at-risk §3 value**: rough math puts it near 2.9–3.1:1
   against white. It is measured, not pre-judged. If it fails its UI-≥3:1 pairings, the §5 bounce
   rule applies (minimal darken until passing) and the bounce is reported to the owner as a
   deviation from a §3-given value — pre-authorized by the "measured, never ships failing" rule,
   but never silent.
6. **TintChip `tone="warning"` on non-warning surfaces** (Setups high-conviction tags,
   off-exchange proximity chips): at Stage 1 they inherit burnt orange mechanically (the tone maps
   to the `warning` slot; labels carry the meaning, so the icon rule is not violated). Whether
   conviction/emphasis chips should move to an amber/neutral tone is Stage 3's per-surface
   amber-dominance sweep — flagged, not decided here.
7. **GEX chart spot/live line assignment** (§3.3-1): flip→amber is BRIEF-mandated; the
   spot→steel / live→signal split is this contract's call (keeps amber spent on the flip alone,
   keeps exactly one blue line). If the owner prefers spot on signal and live distinct another
   way, it's a two-line rebind — flagged for the render-pass review.
8. **Dark `shadows` array interpolation** (theme-audit gap closure): the contract requires an
   explicit dark-tuned `shadows` derived from the e1/e2/e4 ladder; the exact per-slot
   interpolation is implementation latitude, judged in the render pass (menus/popovers visibly
   separate on panel).
9. **`sync-figma-tokens.mjs`** is left in the repo, deprecated (per §6a-3 the Figma DS is
   retired). If the owner wants it deleted outright, say so — this contract only rewrites the
   authority statements in the file headers.
