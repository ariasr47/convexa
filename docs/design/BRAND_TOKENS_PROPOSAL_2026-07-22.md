# Convexa — brand + token proposal & staged redesign plan (2026-07-22)

> Companion to `DESIGN_REVIEW_2026-07-22.md` (the evidence) — produced per `.claude/DESIGN_RULES.md`
> (kit v0.6.0): brief pinned → token plan → self-critique recorded → staged plan. **This is a
> PROPOSAL awaiting the owner's decision (queue item Q4).** Nothing here is built.

---

## 1. The brief, pinned

- **Subject:** Convexa — dealer-gamma positioning analytics. Its world: *convexity* (the payoff
  curvature the company is named for), walls and magnets, the gamma flip, the tape, dealer flow.
- **Audience:** solo retail options swing traders who live in dark broker terminals, cross-check every
  number, and are allergic to dashboards that lie to them.
- **The single job:** make dealer positioning legible and honest enough to act on.

**The review's verdict this answers:** competent-but-generic — an elite discipline chassis (tokens,
parity, honesty states, gated motion) wearing borrowed clothes: GitHub Dark's exact neutrals, Inter
everywhere, the median SaaS blue→violet gradient mark, and **no signature element anywhere**
(review G-1, G-2, G-4, §2).

## 2. The direction — "The Curvature Terminal"

Two moves, both from the subject's own world:

1. **Terminal heritage, not dev-tool heritage.** Trading's native visual vernacular is the
   amber-phosphor terminal — dense, warm-on-dark, monospace figures. Convexa currently dresses like a
   code editor (GitHub's palette); it should dress like the instrument its users actually revere.
2. **Curvature as the structural language.** Convexity is a *drawable, ownable geometry* no generic
   fintech template has. Today it's wallpaper (two béziers at 16% opacity on one page). It becomes the
   signature: the mark, one orchestrated moment, and the section grammar.

## 3. The token plan

### Color (dark canon — 6 named values; semantic P/L green/red UNCHANGED and reserved)

| Token | Hex | Role |
|---|---|---|
| `ink` | `#0B0F17` | Canvas — deeper and warmer than GitHub's `#0d1117`; measurably not-GitHub |
| `panel` | `#131A24` | Raised surface (keeps the shipped elevation/inset-well system) |
| `phosphor` | `#E9E4D6` | Primary text — **warm** off-white (terminal phosphor; the single cheapest differentiator vs the current cool `#e6edf3`; ≥13:1 on ink) |
| `steel` | `#8A9BB4` | Secondary text / quiet structure |
| `gammaAmber` | `#F2A93B` | **THE brand color, dominant** — wordmark, primary actions, the signature curve, active states, and the flip line it already owns |
| `signal` | `#5E8BC4` | Links/info only — deliberately quieter than amber so one color dominates |

- **Retired:** `#4f9cff`/`#1d6fe0` as brand (the median fintech blue), `accentViolet #7b5cff` and the
  gradient mark entirely (review G-4).
- **Named conflict + resolution:** brand amber vs MUI `warning`. Rule: brand amber is *filled/
  structural*; warnings shift to burnt orange `#E07A3F` and **always pair with an icon** — hue alone
  never carries "warning."
- **Light mode:** parity-derived in Stage 1 (paper `#F6F6F3` — neutral-warm, deliberately clear of the
  cream tell — ink text `#17202B`, amber darkened to `#C9821A` for contrast), measured before merge.
  The parity machinery (`extrasFor`, the hex scan) is the migration rail — this is why the swap is
  contained.

### Type (3 roles — Inter retired as identity; review G-1)

| Role | Face | Why |
|---|---|---|
| Display | **Archivo** (SemiExpanded/Expanded, 600–800) | Width-forward solidity — "walls" as a type voice; the CONVEXA wordmark in Expanded caps |
| Body/UI | **IBM Plex Sans** | Technical-heritage grotesk with quiet character; not Inter, not the Space-Grotesk default |
| Data/tape | **IBM Plex Mono** (tabular) | True terminal DNA; upgrades the existing mono-for-figures strength (currently Roboto Mono) |

Scale: display 44–56px Archivo 700 SemiExpanded; H2 28; section labels 13px caps +6% tracking; body
15/1.65; data 13–15 mono; **chip floor 11px** (kills the measured 9px fail).

### Layout concept (one sentence)

*A terminal, not a website: dense, quiet panels on ink, with curvature as the only ornament — and
amber spent solely on brand moments and the one line that matters.*

### The signature — the convex arc, spent in exactly three places

1. **The mark:** CONVEXA in Archivo Expanded caps, the X cut from two convex arcs — geometric,
   ownable, no gradient.
2. **One orchestrated moment:** the landing hero's payoff curve **draws itself** on load and settles
   into the baseline (replacing the generic radial glow blob; static curve under reduced-motion).
   This replaces the five-family micro-interaction scatter as *the* motion identity.
3. **Arc dividers:** shallow convex arcs replace straight rules at section boundaries, app-wide.

*Restraint applied at plan level:* a fourth idea (a curved data-frame edge on the GEX chart) was cut —
the chart keeps its clean frame. Boldness lives in the three places above and nowhere else.

## 4. Self-critique against the default (recorded, per DESIGN_RULES §1)

The default I would produce for "dark fintech dashboard" is **exactly what exists today** — dark slate
+ evenly-sprinkled blue + Inter + bento. Every axis was therefore moved deliberately: neutrals
(GitHub → warm ink/phosphor), accent (median blue → terminal amber, dominant), type (one-family Inter
→ Archivo/Plex trio), mark (SaaS gradient → geometric arc), signature (none → the convex arc
language). **The one named risk:** amber-on-dark evokes Bloomberg — accepted deliberately as heritage,
differentiated by the warm phosphor text and the curvature grammar (Bloomberg is dense chrome with no
geometric language). **Tell-check:** not cream+serif+terracotta; not near-black+single-acid-accent
(amber ≠ acid, two-accent structure, warm text); no purple gradient (violet retired); no broadsheet.

## 5. The staged plan (each stage = a GATE V program under the DESIGN_RULES loop)

**Stage 0 — Quality-floor repair. DO THIS REGARDLESS of the rebrand decision.** The review's hard
fails are correctness, not aesthetics: mobile overflow (`scrollWidth 580` vs 393 viewport) with no
mobile nav — **fold in the parked `feat/responsive-layout` branch** (it already has the
hamburger/drawer + card layouts; 12 commits behind, needs a rebase); `:focus-visible` rings app-wide
(currently zero rules); semantic repair on `/ticker` (~25 stat values rendered as `<h6>`, no `<main>`
landmark, heading order); touch targets ≥44px; chip type ≥11px; the copy fixes (the false "Saved to
your account." for anonymous users, the "last last" typo, and the hero honestly reframed — it
currently sells the unbuilt brokerage connect). *Effort M.*

**Stage 1 — The token swap.** New palette + type into `tokens.ts`/`theme.ts` behind the existing
discipline (the hex scan and `extrasFor` make this contained by construction); amber-vs-warning
resolution; light parity derived + contrast-measured; **the blog static template re-skinned onto the
system** — it currently wears the literal slop-tell cream (`#f4f1eb` + Segoe) and is the identity's
worst break, on a brand asset. *Effort M.*

**Stage 2 — The signature.** Mark rebuild; the landing hero rework (the curve-draw moment + honest
copy + the H1→H6 hierarchy fix); arc dividers; a remove-one-accessory pass on the landing. *Effort M.*

**Stage 3 — The surface sweep.** Ticker/Positions/Settings refined to the new system (amber-dominance
check per surface — no even sprinkling); final quality-floor re-audit; the five motion families
consolidated around the one orchestrated moment. *Effort M–L.*

**What survives untouched (the review §6 keep-list, verified):** the zero-hex token discipline and its
scan, LOADING≠EMPTY≠OFFLINE honesty states, gated motion (`useReducedMotion` consumption verified),
the elevation/inset system, mono-for-figures, the "unavailable this cycle" copy family, light parity.
**Invariant watch:** `theme-token-discipline` (the mechanism IS the migration), light parity,
reduced-motion, `additive-keeps-score-byte-identical` (presentation only, score/tier/fingerprint
byte-identical throughout).

## 6. The decision (queue Q4)

- **(a) Approve the direction + all four stages** — sequenced Stage 0 → 3, each shipped through
  GATE V with the DESIGN_RULES loop.
- **(b) Approve Stage 0 only now** (the floor repair is unarguable), decide the identity later.
- **(c) Request alternative directions** — I'll produce two contrasting token plans (e.g. a
  cool/mono-chrome "print terminal" and a field/flow-based direction from review §8.5) before you pick.
