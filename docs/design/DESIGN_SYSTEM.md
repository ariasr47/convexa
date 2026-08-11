# Convexa Design System — component reference

> **Part 1: Identity & Signature** (generated from source 2026-07-23, post redesign-stage-3;
> authority table updated 2026-08-10).
> This is the **component catalog** — what the shipped pieces are, their props/states/a11y, and how
> to use them without breaking canon. It complements, never overrides, the Spire design canon:
>
> | Layer | Lives in | Answers |
> |---|---|---|
> | **Rules (sole)** | `.spire/clusters/tech/context/DESIGN_SYSTEM.md` | what you may/may not do |
> | **Values** | `apps/dashboard/src/app/shared/theme/tokens.ts` | the exact hexes/type |
> | **Decisions** | `.spire/clusters/tech/contracts/_archive/redesign-stage-{0..3}/` (migrated; was under `.claude/contracts/`) | why it is this way |
> | **Components** | *this file* | what exists + how to consume it |
>
> The former `.claude/skills/convexa-design` skill is **retired**. Do not reintroduce it.
>
> Scope note (per the design-system "coverage over perfection" principle): this Part documents the
> four **signature** pieces + the token **foundations** they rest on. The data primitives
> (`StatTile`, `TintChip`, `useFlashOnChange`, `Widget`) and cards (`ValueCard`, `ComingSoon*`,
> `Jargon`) are listed under [Not yet documented](#not-yet-documented) for a later pass.

---

## Foundations (tokens)

**The identity in one line:** *The Curvature Terminal* — warm ink canvas, phosphor text, **one
dominant brand amber**, terminal type (Archivo display + IBM Plex Sans/Mono), and a convex-arc
signature spent in exactly three places. Everything below is single-sourced in `tokens.ts`;
components bind MUI palette slots or `extrasFor(theme)` — **never a hardcoded hex** (enforced by
`hex-discipline.spec.ts` + `banned-hexes.spec.ts`).

### Palette

| Token | Dark | Light | Role |
|---|---|---|---|
| `ink` | `#0B0F17` | — | canvas (`background.default` dark) |
| `panel` | `#131A24` | — | raised surface (`background.paper` dark) |
| `paper` | — | `#F6F6F3` | light canvas (clear of the cream slop-tell) |
| `phosphor` | `#E9E4D6` | — | primary text dark (warm, 15.10:1 on ink) |
| `inkText` | — | `#17202B` | primary text light + contrastText on amber fills |
| `steel` | `#8A9BB4` | `rgba(0,0,0,.6)` | secondary text / quiet structure |
| **`gammaAmber`** | **`#F2A93B`** | **`#C57F19`** (`amberDeep`) | **THE brand color — dominant** |
| `signal` | `#5E8BC4` | `#3D6DA5` | links / info / **live** status (quieter than amber) |
| `warningOrange` | `#E07A3F` | `#A65526` | **true warnings only, + icon always** |
| `success` | `#2ecc71` | `#1e9e57` | **RESERVED** — *gamma/GEX surfaces:* calls / +gamma. *Position + P&L surfaces:* **signed-P&L direction ONLY** (+P&L) — never call-vs-put, never position side |
| `error` | `#ff5c5c` | `#d23b3b` | **RESERVED** — *gamma/GEX surfaces:* puts / −gamma. *Position + P&L surfaces:* **signed-P&L direction ONLY** (−P&L) — never call-vs-put, never position side |

**Three binding rules that live in the palette:**

1. **Amber vs warning.** Brand amber (`primary.*`) is *filled/structural* — wordmark, primary
   actions, active states, the gamma-flip line. A "warning" surface binds `warning.*` (burnt
   orange) **and renders an icon** — hue alone never carries meaning. Never the old shared-amber
   ambiguity.
2. **Green/red are reserved for *direction*** (P/L, flow, gamma sign) — never decoration, and
   **never on a rate or a no-side datum** (the outcome-ledger + dark-pool-context-only canon; the
   Stage-3 sweep caught a proximity chip violating this and fixed it).
3. **Amber is spent, not sprinkled.** `signal` (blue) is deliberately quieter so one color
   dominates. A surface that means "brand/active" earns amber; everything else does not.

### The two amber grades (do not confuse)

- **`primary.main`** = the **fill/UI** amber (buttons, bars, borders, icons — the WCAG ≥3:1 class).
- **`extrasFor(theme).textAmber`** = the **text-grade** amber for body/label-size (<18px) amber
  *text*. Dark = `gammaAmber` byte-identical; **light = `#8F5C0F`** (a darker grade that passes
  ≥4.5:1 as text — `amberDeep` alone fails as body text). Reach for `textAmber` whenever amber is
  the *ink*, not the *fill*.

### Type

Three self-hosted faces (OFL 1.1, under `/public/fonts`; Inter is **retired**, not a fallback):

| `typographyTokens` key | Face | Use |
|---|---|---|
| `displayFontFamily` | **Archivo** (`wdth` axis, `displayFontStretch: 112.5%` — a real width, never a faux `scaleX`) | display / the wordmark |
| `fontFamily` | **IBM Plex Sans** | body / UI |
| `monoFontFamily` | **IBM Plex Mono** (tabular by construction) | **all data / figures** |

`displayScale` (`44–56px`, weight `700`) is the landing display scale, consumed by `HeroCurve`'s
neighbours. Every numeric value renders mono with `tabular-nums`; stat *values* are never headings.

### Mode-aware extras & elevation

Presentation values with no `--mui-*` var resolve through a `theme` callback, **never the bare
object** (binding bare `extras` dark-locks the surface — the light-mode parity bug):

```ts
sx={{ color: (theme) => extrasFor(theme).textAmber,
      boxShadow: (theme) => elevationFor(theme).e2 }}
```

`extras`/`extrasLight` carry `panelRaised`, `hatchAlt`, `textSecondary`, `textDisabled`,
`textAmber`. `elevation` is a 3-step named ladder (`e1` resting · `e2` raised · `e4` overlay) —
depth in dark UI is luminance-first, shadow is the supporting cue.

### Enforcement (what breaks the build)

| Invariant | Guard |
|---|---|
| zero hardcoded hex; retired hexes unreachable | `hex-discipline.spec.ts` · `banned-hexes.spec.ts` (mutation-guarded) |
| the arc lives in exactly 3 places | `arc.spec.ts` (importer **set-equality**) |
| exactly one orchestrated motion moment | `single-motion-moment.spec.ts` (keyframe-inventory set-equality) |
| fonts self-hosted, `swap`, no CDN | `fonts.spec.ts` |
| warnings always carry an icon | `warning-icon.spec.ts` |
| favicon/og hexes ≡ tokens | `brand-assets.spec.ts` |

---

## Component: `ConvexaMark`

`shell/ConvexaMark.tsx` — signature #1. The **only** place the visible wordmark renders (TopNav
bar + drawer, Footer). Carries no data, no fetch.

**Composition:** `[CONVE] · [arc-X glyph] · [A]` — one word, Archivo Expanded caps (real `wdth`
125%). The X is the only custom geometry: an inline SVG cut from two convex arcs, single-sourced
from `arc.ts`. The glyph is the **one amber element** (`primary.main`); the letters inherit the
mounting context's `color`. **No gradient anywhere.**

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `fontSize` | `string \| number` | `'1.15rem'` | wordmark size; the arc-X scales in `em` against cap height |
| `size` | `number` | — | legacy call-site prop (nav ≈18, footer 16); the lockup now scales purely with `fontSize` — kept for zero call-site churn |

### States

Presentational — no interactive states. The lockup is typically wrapped in the nav's home `<Link>`,
which supplies hover/`:focus-visible` (the amber ring) at the anchor level.

### Accessibility

- **Role:** `role="img"` on the wrapper + `aria-label="Convexa"` (stable accessible name) — the
  split `CONVE`/`A` text nodes would otherwise read "CONVE A". Every inner node is `aria-hidden`.
- The arc-X is decorative (`aria-hidden`), sized in `em` so a pre-Archivo fallback render may
  reflow slightly on font swap but never collides.

### Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Render it for every wordmark instance | Hand-roll a second "Convexa" wordmark elsewhere — this is the one lockup |
| Let the amber X be the only amber in the mark | Add a gradient, glow, or second accent color |
| Scale via `fontSize` | Faux-stretch the letters with `transform: scaleX` (the width is a real axis) |

### Usage

```tsx
import { ConvexaMark } from '@/shell/ConvexaMark';

// TopNav home link — amber X, letters inherit text.primary from the link
<Link to="/" aria-label="Convexa home">
  <ConvexaMark fontSize="1.15rem" />
</Link>
```

---

## Component: `ArcDivider`

`shared/ui/ArcDivider.tsx` — signature #3. A full-width **shallow convex arc** replacing a straight
`<Divider/>` at section boundaries. The signature is the **shape**, not a new amber spend.

**Bound to two seams (set-pinned):** `shell/Footer.tsx` and
`features/trading/outcomes/TrackRecordSection.tsx`. Deliberately **not** exported from the
`shared/ui` barrel — import the module path directly so the importer scan stays sound.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `sx` | `SxProps<Theme>` | — | margin/spacing carried over from the replaced `<Divider/>` call site |

### Anatomy (fixed, do not tune casually)

- Height `20px` (**box reserved** — zero layout shift vs the `<hr>` it replaces).
- Stroke = the `divider` palette slot at `strokeWidth 1`, `vectorEffect="non-scaling-stroke"` (the
  `preserveAspectRatio="none"` stretch must not fatten the rule).
- Bow: control offset `8` (apex rise ≈4px ≈20% of the box) — **deepened at Stage 3** from the
  Stage-2 `2px` apex, which rendered sub-perceptual at 1440 ("a signature nobody can see is
  absence, not restraint"). Latitude 6–10.

### Accessibility

- **Role:** `role="separator"` + `aria-orientation="horizontal"` (it replaces an `<hr>`); the SVG
  itself is `aria-hidden`.

### Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Use it where a section rule genuinely separates content | Sprinkle it as decoration — it is 1 of 3 arc placements; a 4th `arc.ts` import **fails the build** |
| Keep the stroke on `divider` | Recolor it to amber (the shape carries the brand, not the color) |
| Pass spacing via `sx` | Change `HEIGHT` per call site (breaks the reserved-box guarantee) |

### Usage

```tsx
import { ArcDivider } from '@/shared/ui/ArcDivider';

<ArcDivider sx={{ mb: 3 }} />
```

---

## Component: `HeroCurve`

`pages/landing/HeroCurve.tsx` — signature #2, **the one orchestrated motion moment**. The landing
hero's payoff curve draws itself on mount and settles onto its baseline. Landing-only (lives on the
page per the dependency direction). Owned geometry — a convex payoff silhouette, never charted from
data; no numbers, no axis labels.

### Props

None. It is a fixed, self-contained hero overlay.

### Behavior & states

| State | Behavior |
|---|---|
| Default (mount) | Baseline (`text.secondary`, low opacity) fades in ~200ms; the curve (`primary.main`) draws via `stroke-dashoffset` ~900ms `cubic-bezier(0.16,1,0.3,1)` after a 150ms delay; `forwards` pins the final frame |
| One-shot | The draw class is applied once on mount and never toggled — it **does not replay** on re-render |
| Reduced motion | The shared `useReducedMotion` hook renders the **static final frame** (full stroke, at rest); a `@media (prefers-reduced-motion: reduce)` block is the belt-and-braces fallback |

**Motion contract (the ONE-motion rule):** keyframes animate **only**
`{stroke-dashoffset, opacity, transform}` (pinned by test). Paint-only — the wrapper is an absolute
`inset-0` overlay behind hero copy sized by its content, so the animation **cannot shift layout by
construction**. No fill, no glow, no radial gradient (the old glow blob was deleted; a scan hunts
for its return).

### Accessibility

- **`aria-hidden`** — decorative geometry, announced as nothing.

### Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Treat this as *the* motion identity | Add a second "wow" animation anywhere — motion consolidates here (`single-motion-moment.spec.ts` set-equality) |
| Keep it paint-only (dash/opacity/transform) | Animate width/height/layout properties |
| Rely on the shared `useReducedMotion` | Roll a bespoke `matchMedia` — use the shared hook |

### Usage

```tsx
import { HeroCurve } from './HeroCurve';

// Inside the hero section (position: relative); content sizes the box, curve overlays.
<Box sx={{ position: 'relative' }}>
  <HeroCurve />
  {/* hero copy + CTAs */}
</Box>
```

---

## Primitive: `arc.ts`

`shared/ui/arc.ts` — **the** convex-arc geometry primitive. Pure geometry: quadratic-arc path
builders + the arc-X glyph constants. No React, no theme, no color — consumers bind their own token
slots.

> **Binding — exactly three importers.** `ConvexaMark` · `HeroCurve` · `ArcDivider`, enforced by
> **set equality** in `arc.spec.ts`. A fourth importer is a violation, not a flourish — it fails
> the build. Not re-exported from the `shared/ui` barrel (a re-export would blind the scan).

### API

| Export | Signature | Purpose |
|---|---|---|
| `quadArcPath(from, control, to)` | `(Pt, Pt, Pt) → string` | one quadratic arc `M…Q…` |
| `bowedControl(from, to, bow)` | `(Pt, Pt, number) → Pt` | control for a chord bowed `bow` units perpendicular (apex at `bow/2`) |
| `bowedArcPath(from, to, bow)` | `(Pt, Pt, number) → string` | convex arc over a chord (ArcDivider's builder) |
| `quadChainPath(from, ...segs)` | `(Pt, …[Pt,Pt]) → string` | multi-segment tangent-continuous chain (HeroCurve's silhouette) |
| `quadArcLength(from, control, to, steps?)` | `→ number` | deterministic polyline-sum length (pins HeroCurve's dash constants) |
| `ARC_X_VIEWBOX` / `ARC_X_PATHS` / `ARC_X_STROKE` | constants | the arc-X glyph (two convex strokes crossing below optical center) |
| `ARC_X_FAVICON_STROKE` | `21` | heavier small-size master so the X survives a 16px tab (never a naive scale-down) |

The glyph geometry is **single-sourced**: `ConvexaMark` renders `ARC_X_PATHS` live; the
favicon / apple-touch / og assets are generated from the same constants by
`apps/dashboard/tools/generate-brand-assets.mts` (committed binaries are the contract).

### Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Reuse these builders inside the 3 sanctioned consumers | Import `arc.ts` into a 4th module (build fails) |
| Bind color at the consumer via token slots | Add color/theme to this module — it stays pure geometry |

---

## Not yet documented

A later `/design-system document` pass should append these shipped pieces (Part 2):

- **Data primitives** — `StatTile` (`pages/ticker/widgets/_kit/`), `TintChip` (tones:
  `neutral`/`emphasis`/`warning`/`success`/`info` — note `emphasis` binds `textAmber`, added at
  Stage 3), `useFlashOnChange` (the permitted data-signal flash).
- **Layout** — `Widget` (the bento frame + `WidgetSelectionContext`; the theme-layer
  `:focus-visible` ring lives here + globally).
- **Cards / inline** — `ValueCard`, `ComingSoonBox` / `ComingSoonCard` / `ComingSoonBadge`,
  `Jargon` (inline glossary term).

These are the workhorses the **Scanner v1** table will consume (`StatTile`, `TintChip`,
`useFlashOnChange`, `Widget`) — documenting them is a natural companion to that build.
