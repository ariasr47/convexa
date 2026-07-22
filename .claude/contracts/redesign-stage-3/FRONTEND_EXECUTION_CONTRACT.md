# redesign-stage-3 — FRONTEND_EXECUTION_CONTRACT

> **Lane:** GATE V fast-path (UX → Frontend). **Backend lane: `NO_BACKEND_CHANGE`** — no
> INTERFACE_CONTRACT, no BACKEND_EXECUTION_CONTRACT; the **empty `apps/api` diff is itself an
> acceptance criterion** (§9-5). `libs/api` untouched.
>
> **Rule-of-record:** `.claude/skills/convexa-design/SKILL.md` (Direction ACTIVE; the
> single-motion-moment + arc-in-exactly-3-places rules bind hard; **amber SPENT, not sprinkled, is
> THE grading criterion of this stage**) + `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` §5
> Stage 3 + §6a rulings (esp. §6a-2: stagger supersession PRE-APPROVED — guards REPLACED, never
> deleted-because-red) · `.claude/DESIGN_RULES.md`.
>
> **What Stage 3 is:** the SURFACE SWEEP — the finale of the Curvature Terminal program. Four
> scope areas: (1) the per-surface amber-dominance sweep (§4), (2) motion consolidation around the
> hero curve-draw as THE identity moment (§3), (3) every accumulated flag explicitly dispositioned
> — none carried forward (§5), (4) the closing quality-floor re-audit — the program ends where it
> began, with the floor proven (§8B).
>
> Sources: `BRIEF.md` (scope law) · `CONTEXT_PACK.md` · proposal §5 Stage 3 + §6a · skill
> §Direction/§Banned/§Enforcement · `_archive/redesign-stage-2/FRONTEND_EXECUTION_CONTRACT.md`
> (shape + the Stage-2 leftovers: brandGradient consumers §7/§10-2, ArcDivider constant §5.1) ·
> `_archive/redesign-stage-0/FRONTEND_EXECUTION_CONTRACT.md` §8 (the quality-floor checks §8B
> re-runs) · `_archive/redesign-stage-1/` §3.3/§5/§10 (slot semantics, contrast method, the
> §10-6 TintChip flag).

---

## 1. Design front-half (DESIGN_RULES §1.1–§1.4, folded in — "Design tokens + signature")

**Brief pinned.**
- **Subject:** the finished Curvature Terminal — every trader surface refined onto the system:
  warm ink/phosphor, amber spent solely on brand moments and the one line that matters, ONE
  orchestrated motion moment, honesty states intact.
- **Audience:** solo retail options swing traders in dark broker terminals; they read motion as
  *information* (a tick, a live feed) and read decoration as noise.
- **Single job of this pass:** make the whole app read as one instrument — amber concentrated,
  motion consolidated to data signals + the one moment, the floor re-proven on the final colors.

**Structure before style.** No new surfaces, no layout changes, no new routes. The structural
moves are all *removals and rebinds*: (a) the stagger-reveal machinery deleted from the Widget
shell (the hero curve-draw, shipped Stage 2, is already THE moment — this stage removes its
competitor); (b) the GEX mount bar-grow retired (animation props only — chart geometry LOCKED);
(c) link-class amber text rebinds to `info` (the token layer's own rule, finally applied at the
component layer); (d) one new TintChip tone (`emphasis`) so conviction/proximity stop borrowing
semantic tones; (e) one new text-grade token (`textAmber`) closing the light-mode body-amber
contrast flag; (f) `brandGradient` deleted (zero-importer proof) — its two consumers go flat
token amber; (g) the blog illustration ASSETS recomposed on ink via the generator pipeline.
Dependency direction unchanged throughout; `_kit`/`shared` boundaries untouched.

**Token plan (small, closed — everything else binds existing slots):**
- **NEW `extras.textAmber` / `extrasLight.textAmber`** (resolved via `extrasFor(theme)` — never
  bare `extras.`): the *text-grade* amber for body/label-size amber text. Dark value =
  `gammaAmber #F2A93B` **unchanged** (measured ≥4.5 on ink AND panel — pin it; dark renders
  byte-identical). Light value candidate **`#8F5C0F`** with a hard measurement gate (§5.2) —
  ≥4.5:1 on paper `#F6F6F3`, on white, AND on the 8–16% amber-alpha tint fills it sits on.
  `primary.main` stays the FILL/UI amber (buttons, bars, borders, icons — the ≥3:1 class).
- **DELETED: `brandGradient`** (§5.1) — the last gradient-brand survivor. Its two consumers
  rebind to flat `primary.main` + `primary.contrastText`.
- **ArcDivider bow constant deepened** (§5.4): control offset 4 → **8** (apex ≈ 2px → ≈ 4px on
  the 20px box). One constant in one file; stroke stays `divider` @ 1px — no amber, no new token.
- **Blog artwork palette = the shipped tokens, no new values** (§5.5): illustration fields on
  ink/panel/panelRaised, text phosphor/steel, accents gammaAmber (≤1 accent family per figure)
  + signal, warningOrange only where a figure *depicts* a fault/bounce. Cream family dies.
- Zero other token changes. `tokens.ts` values (palette, type, elevation) are otherwise
  read-only this stage.

**Self-critique (recorded).** Default failure modes, each rejected: (1) **mechanical recolor** —
sweeping every `primary.main` to neutral by regex; refused: the census (§4) is site-by-site with
a stated meaning per site (active state vs link vs brand moment vs sprinkle), and KEEPs outnumber
MOVEs where amber genuinely marks the line that matters. (2) **motion prohibition theater** —
retiring the *data* signals along with the spectacle; refused: flash-on-tick and the live pulses
are DATA SIGNALS, exempt **by decision** (§3, recorded — `[live-vs-static-isolation]` makes them
honesty machinery, not decor). (3) **deleting red tests** — the stagger guards go through the
§6a-2 REPLACEMENT discipline, same-commit, named spec for named spec (§3.3). (4) **a new wow to
mark the finale** — no new motion families, no fourth arc, nothing added; the finale is
subtraction. (5) **fixing the blog by hand-editing output** — banned; assets + generator only,
byte-identical dual-copy proof stays. (6) **quietly widening scope via the re-audit** — §8B
re-RUNS Stage 0's checks; the only repairs it authorizes are named in §5.6/§8B (data-value
headings, a walk break on final states), anything else found = report, don't patch.

---

## 2. Execution order (binding)

1. **Motion consolidation** (§3): stagger machinery out (Widget + 12 board call sites + guard
   replacement same-commit), bar-grow off, conic spin static, hover border-tint neutralized.
2. **Tokens** (§5.1/§5.2): delete `brandGradient` (+ rebind avatar/pill), add `textAmber` (+ the
   measurement gate), update the stage1-token pins deliberately (named pin edits, §8-6).
3. **TintChip `emphasis`** (§5.3) + the two call-site rebinds.
4. **The amber sweep** (§4): the closed per-surface edit lists (link-class → info, deck washes →
   neutral, textAmber bindings).
5. **Heading repairs** (§5.6): `component="p"` on the named sites.
6. **ArcDivider depth** (§5.4).
7. **Blog artwork** (§5.5): recompose the 7 SVG assets, regenerate via `py docs/blog/build_html.py`.
8. **Tests** (§8A) + the closing quality-floor re-audit (§8B), then the GATE Q battery (§9).

---

## 3. Motion consolidation — the five families

**The binding frame (recorded as the decision):** motion serving **DATA LEGIBILITY** — a change
just happened, this datum is live — is a **data signal**, part of the live-vs-static honesty
machinery, and is **exempt from consolidation BY DECISION**. Motion as **spectacle** (mount
choreography, ambient loops) competes with the hero curve-draw — the one orchestrated moment
(skill §5) — and is retired or tamed. Interaction *feedback* (hover, expand morph, toolbar
reveal) is neither: it fires only on user intent, stays, and is not a "motion family."

### 3.1 The disposition table (all five + one census discovery)

| # | Family (source) | Disposition | Why (one line) |
|---|---|---|---|
| 1 | **Staggered section reveal** — `shared/ui/Widget/Widget.tsx` `widgetRise` keyframes + `--widget-reveal-delay` + `revealIndex` prop, fed by the board (`pages/ticker/TickerDashboard.tsx`) | **RETIRE** | Mount choreography = the exact spectacle class the hero curve-draw supersedes; §6a-2 pre-approved. Guards REPLACED (§3.3), never deleted-red. |
| 2 | **Flash-on-tick** — `pages/ticker/widgets/_kit/useFlashOnChange.ts` + consumers `LiveTape.tsx` (net flow / spread / live flip), `chrome/TickerHeader.tsx` (mid + last-trade), via `StatTile.flash` | **KEEP as data signal** | Fires only on a genuine live change while `active` (`isLive && !streamOffline`), inert offline/reduced — it IS `[live-vs-static-isolation]` made visible. Exempt by decision. |
| 3 | **Hover-lifts** — `Widget.tsx` frame hover (translateY/shadow/border) + `_kit/StatTile.tsx` tile hover | **TAME** | The lift (transform/shadow, intent-gated, reduced-motion-guarded) stays — feedback, not spectacle. The **amber hover border-tint goes neutral**: `Widget.tsx:344`'s `color-mix(… primary-main 40% …)` hover borderColor → the neutral `text.disabled` idiom StatTile already uses (hover must not sprinkle amber across every widget — §4 census). |
| 4 | **GEX bar-grow** — `gex-profile-chart/chart.tsx:76–83, 203–205` mount-only recharts animation | **RETIRE** | A per-mount flourish that *delays* data legibility ~650ms and, with the stagger gone, would become a second mount moment competing with the hero. `isAnimationActive={false}` pinned; the `animateBars` ref/effect machinery deleted. **Animation props ONLY — geometry/orientation/series LOCKED** (§6a-1). |
| 5 | **Pulsing live indicators** — `chrome/TickerHeader.tsx` `liveDotPulse` (the ● dot), `Widget.tsx` `widgetLivePulse` (live accent edge), `orders/OrderRow.tsx` `ordersWatchPulse` (Watching dot) | **KEEP as data signal** | A pulse = "this is a live feed, right now" — the anti-frozen-price honesty cue; all three already fire only when genuinely live and are reduced-motion-gated. Exempt by decision. |
| 6 | *(census discovery — outside the BRIEF's five, recorded §10-3)* **Selected-widget conic border spin** — `Widget.tsx` `widgetAngleSpin` (`@property --angle`, 4s infinite) | **TAME** | An infinite ambient loop is the purest spectacle in the app post-stagger; the selected ring keeps its static conic-gradient border (the visual survives), the spin + `@property --angle` registration go. |

Untouched (not motion families; named so nothing is "cleaned up" by drift): the expand/peek View-
Transition morph + Fade fallback, toolbar/grip hover reveals, StatTile offline-dim opacity
transition, MUI ripples/transitions, the landing `ValueCard` hover set (Stage-2 settled),
`HeroCurve` itself (THE moment — zero edits here).

### 3.2 Retirement mechanics (stagger)

- `Widget.tsx`: delete the `revealIndex` prop, the inline `--widget-reveal-delay` style, and the
  `@media (prefers-reduced-motion: no-preference)` `widgetRise` block (lines ~73–76, ~313–317,
  ~407–421). Widgets render at rest; no replacement mount animation of any kind.
- Board ripple (prop removal, `tsc -b` proves completeness): `TickerDashboard.tsx` +
  `revealIndex` pass-through in `AiRecPanel.tsx`, `DealerFlowProjection.tsx`, `IvRank.tsx`,
  `TermStructure.tsx`, `Setups.tsx`, `OffExchangeBlocks.tsx`, `MarketContext.tsx`,
  `LiveTape.tsx`, `GexStrikeProfile.tsx`, `FreshPositioning.tsx`, `DealerPositioning.tsx`,
  `features/trading/orders/OrdersWidget.tsx`.
- The `Widget.tsx` doc-header bullet describing the reveal is rewritten (docs lie otherwise).

### 3.3 Guard REPLACEMENT plan (§6a-2 — supersede, never delete-red; same commit)

**Superseded spec, by exact name:** `shared/ui/Widget/Widget.spec.tsx` →
`describe('Widget — staggered mount reveal wiring')` → the single surviving stagger case
`it('the reveal delay increases with board position and is one-shot (stable across re-render)')`
(the risk-based migration already folded the original 4-test stagger contract down to this one
case + the header contract note — the other three `Widget.spec` describes [selection, expand
both paths, reduced-motion-expand] are NOT stagger guards and stay green untouched).

**Replaced, in the same commit, by:**
1. In `Widget.spec.tsx`: `describe('Widget — motion negative space (stage 3: reveal retired)')`
   — (a) source-scan (`?raw`, mutation-guarded) of `Widget.tsx`: `widgetRise`,
   `--widget-reveal-delay`, `revealIndex`, `widgetAngleSpin`, `@property --angle` ALL absent;
   `widgetLivePulse` still PRESENT (the kept data signal can't be swept away silently); (b) the
   rendered frame's injected CSS carries no mount `animationName`.
2. NEW `shared/theme/single-motion-moment.spec.ts` — the skill's one-moment rule, structural:
   app-wide `?raw` scan (spec files excluded, mutation-guarded): (a) `stroke-dashoffset`
   keyframes exist ONLY in `pages/landing/HeroCurve.tsx`; (b) `widgetRise` exists nowhere;
   (c) `gex-profile-chart/chart.tsx` contains `isAnimationActive={false}` and no
   `animationDuration`; (d) the app's `@keyframes` inventory is set-equal to the allowlist
   `{flash-* (useFlashOnChange), liveDotPulse, widgetLivePulse, ordersWatchPulse, HeroCurve's
   draw/fade}` — a new keyframe anywhere is a red build, not a review comment.
3. The **hero curve-draw guards** (`pages/landing/HeroCurve.spec.tsx` — reduced-motion static
   frame, paint-only property set, one-shot on mount, shared-hook consumption) are the new
   moment's standing guard set: **stay green, zero edits** — named here as the replacement's
   other half.

`useFlashOnChange.spec.tsx` (all 5 cases) and `useReducedMotion.spec.tsx` stay green untouched —
they guard the KEPT families.

---

## 4. The amber census + target (per surface — closed edit lists)

**Target, stated once:** amber lands on (a) brand moments (mark, coming-soon brand flavor,
Prime/actionable tier), (b) THE line that matters (gamma flip; the verdict), (c) active states
(nav, tabs, selected toggles/pills), (d) primary/contained CTAs. Amber does NOT land on: links
(→ `info`), ambient washes (→ neutral), hover chrome (→ neutral), warnings (→ `warning` + icon,
unchanged). Everything below is the exhaustive `primary`-slot census of the sweep surfaces;
anything not listed is already clean (verified by grep; e.g. LiveTape, MarketContext, IvRank,
FreshPositioning, TickerHeader bind no `primary`).

### 4.1 Ticker (`pages/ticker/**`)

| Site | Today | Disposition |
|---|---|---|
| `gex-profile-chart/chart.tsx:187–189` flip line + label | amber | **KEEP** — THE line that matters (named amber owner since Stage 1 §3.3-1). |
| `chrome/CommandDeck.tsx:96` sticky-bar bg `color-mix(paper 88%, primary 4%)` | ambient amber wash | **MOVE → neutral**: drop the primary component (plain `background.paper`; the neutral white sheen + shadow stay). An even wash across full-width chrome is the definition of sprinkled. |
| `chrome/CommandDeck.tsx:214–215` deck bg mix 5% + amber top-light gradient 9% | ambient amber wash | **MOVE → neutral** (same rule; keep the mode-aware neutral sheen). |
| `chrome/CommandDeck.tsx:262` condensed-bar amber gradient 6% | ambient amber wash | **MOVE → neutral**. |
| `ai-rec/AiRecPanel.tsx:221` "View what's sent" header action | amber text button | **MOVE → `info`** — link-class action text (the token rule: links/info bind `info`). |
| `ai-rec/AiRecPanel.tsx:1103` Trade-verdict hero icon | `color="primary"` | **KEEP** — the verdict IS the surface's one line that matters (its no-trade sibling stays `info` — the asymmetry is the meaning). |
| `ai-rec/StateExportDrawer.tsx:198` COPY buttons (11px) | amber text | **KEEP amber, bind `textAmber`** via `extrasFor` (action affordance, brand-flavored; light-mode contrast closed by §5.2). |
| `_kit/TintChip` call sites | see §5.3 | Setups HIGH → `emphasis`; off-exchange proximity → `neutral`. |
| Get-AI-read / contained buttons | MUI contained primary | **KEEP** — primary actions. |

### 4.2 Positions (`features/trading/positions/**` + `orders/**` + `model/OpportunityTier.tsx`)

| Site | Today | Disposition |
|---|---|---|
| `PortfolioPanel.tsx:101,116` active tab color + underline | amber | **KEEP** — active state. |
| `CustomizationToolbar.tsx:172` active status pills (filled) | amber fill + contrastText | **KEEP** — active state. |
| `CustomizationToolbar.tsx:337` "+ Open simulated position" CTA | amber fill | **KEEP** — the surface's primary action. |
| `CustomizationToolbar.tsx:383` "History" (0.78rem) | amber text | **MOVE → `info`** — link-class. |
| `PositionsView.tsx:69` empty-state open CTA | amber fill | **KEEP** — primary action. |
| `PositionsView.tsx:84` "clear filter" link (0.82rem) | amber text | **MOVE → `info`** — link-class. |
| `PositionRow.tsx:526` "view order →" backlink span | amber text | **MOVE → `info`** — link-class provenance link. |
| `orders/OrdersWidget.tsx:113` "All orders" action | amber text | **MOVE → `info`** — link-class (matches the AiRec export action). |
| `LiveTabPanel.tsx:65–67` LOCKED chip (11px) | amber text + tint | **KEEP, bind `textAmber`** — coming-soon is brand-flavored (Stage-1 §3.3-4 ruling); the ZERO-IMPORT LOCK holds: `tokens.ts` is a static value module, `extrasFor` comes with it — no new import class. |
| `model/OpportunityTier.tsx:31–33,59–62` actionable/prime word + Prime banner | amber | **KEEP** — tier emphasis is the brand/active state (Stage-1 §3.3-3); word + banner text bind `textAmber` where body-size (light-mode gate §5.2). |
| `TradeEntryDialog.tsx:467` provenance chip (outlined primary) | amber label | **KEEP, bind `textAmber`** for the label (13px text-class). |

### 4.3 Settings / auth (`features/auth/**` incl. `SettingsPage`)

| Site | Today | Disposition |
|---|---|---|
| `SettingsPage.tsx:298–306` selected theme ToggleButton | amber text/border/tint | **KEEP** — active state; the selected *label* binds `textAmber` (light-mode body-size gate). |
| `AccountControl.tsx:59,66` Sign-up pill | `brandGradient` + **white** label | **brandGradient RETIRED** (§5.1): flat contained-primary pill (`primary.main` fill + `primary.contrastText` label — fixes the measured-broken white-on-amber label ~2:1). Keeps radius/hover lift/glow (glow already binds primary-alpha). |
| `avatar.ts:32` gradient avatar (+ `color: common.white`) | `brandGradient` | **brandGradient RETIRED** (§5.1): flat `primary.main` disc + `primary.contrastText` initial (9.6:1 dark). Mode-aware by construction now (token slots) — acceptable: the "logo-like invariance" rationale died with the gradient. |
| AuthDialog / Settings contained buttons | MUI contained primary | **KEEP** — primary actions. |
| `GoogleButton` | brand exemption | untouched. |

### 4.4 Scanner (`pages/scanner/`)

| Site | Today | Disposition |
|---|---|---|
| `Scanner.tsx:41` 48px magnifier glyph | amber | **KEEP** — the surface's one brand accent (UI-size icon, ≥3:1 class). |
| `Scanner.tsx:86–89` "coming soon" pill (11px) | amber text + tint | **KEEP, bind `textAmber`** — brand-flavored coming-soon. |
| `Scanner.tsx:102` "Go to the Ticker viewer →" (0.88rem `Link`) | amber link | **MOVE → `info`** — it is literally a `Link`; links bind `info`. |

### 4.5 TopNav / shell (`shell/TopNav.tsx`, `ConvexaMark`)

| Site | Today | Disposition |
|---|---|---|
| `TopNav.tsx:146–153` active nav entry (color/border/soft glow) + `:222,231` drawer selected | amber | **KEEP** — active states, the proposal's named spend. |
| `ConvexaMark` arc-X glyph | amber | **KEEP** — the mark (untouched; arc set-equality LOCKED §7). |
| Sign-up pill | — | see §4.3. |

**Per-surface before/after judgment** (the BRIEF's "not a mechanical recolor"): §8-R2 records a
screenshot pair per surface with a one-paragraph judgment against the target statement above.

---

## 5. Flag dispositions (every accumulated flag — none carried forward)

### 5.1 `brandGradient` — **RETIRE both usages + DELETE the token** (decided)

Options were: redefine amber-only for the 2 consumers (it already IS amber-only:
`gammaAmber → amberDeep`, pinned by `stage1-tokens.spec.ts:70`) or retire + delete. **Delete,
because:** (1) the skill bans the gradient-brand vocabulary — "the gradient mark is dead"; after
the Stage-2 mark rebuild (no gradient anywhere in the mark), the avatar + pill are the last
gradient survivors of the retired identity's grammar; (2) both call sites are *already broken on
contrast* — `color: common.white` on a gammaAmber-led fill ≈ 2:1 — so both must be edited
regardless; flat `primary.main` + `primary.contrastText` fixes contrast, restores mode-awareness,
and matches the app-wide contained treatment with the same brand weight; (3) a token with zero
consumers is a standing invitation to re-sprinkle. Mechanics: rebind `features/auth/avatar.ts`
(GRADIENT_AVATAR_SX → theme-callback sx: `bgcolor: 'primary.main'`, `color:
'primary.contrastText'`; rename to `AVATAR_SX`-class identifier + doc fix — the file's header
still says "blue→violet") and `features/auth/AccountControl.tsx:59/66`; delete the export from
`tokens.ts`; `tsc -b` + grep prove zero importers. **Deliberate pin edits** (§8-6):
`stage1-tokens.spec.ts:70` composition pin → an ABSENT assertion (`'brandGradient'` not exported
— the `accentViolet` precedent); the stale comment in `hex-discipline.spec.ts:46` updated.

### 5.2 Light-amber body text — **Option A: the `textAmber` token, with the measurement gate** (decided)

The flag: light-mode `amberDeep #C57F19` measures ~3.0–3.3:1 on paper/white — legal for UI
(≥3:1) but a WCAG failure wherever amber renders **body/label-size text** (<18px). Option B
(restrict amber to ≥UI-size) was rejected: it would strip the coming-soon pills, tier words, and
chip labels of brand flavor entirely — more churn, worse identity. **Chosen:** new
`extras.textAmber` / `extrasLight.textAmber` (§1 token plan): dark = `gammaAmber` (byte-identical
dark render; pin its measured ≥4.5 on ink AND panel), light candidate `#8F5C0F` behind a HARD
gate — **measured ≥4.5:1 on paper `#F6F6F3`, on `#FFFFFF`, and on the 8–16% amber-alpha tint
fills it sits over (composited)**; a failing candidate gets the pre-authorized minimal darken
(the Stage-1 §10-5 pattern), final value recorded in the stage report. **Closed consumer list**
(every site keeping amber text < 18px): `Scanner.tsx` pill · `LiveTabPanel.tsx` lock chip ·
`SettingsPage.tsx` selected-toggle labels · `OpportunityTier.tsx` word + Prime banner text ·
`StateExportDrawer.tsx` COPY buttons · `TradeEntryDialog.tsx:467` provenance chip label ·
`TintChip` `emphasis` tone text (§5.3). All via `extrasFor(theme)` in sx callbacks. Sites that
MOVED to `info` (§4) need nothing — `lightInfo` measured 4.94 at Stage 1. UI-size amber (fills,
borders, icons, the flip line, contained buttons) stays on `primary.*` untouched.

### 5.3 TintChip emphasis tone — **new `tone="emphasis"`; closed site list** (decided)

Add `'emphasis'` to the `Tone` union in `pages/ticker/widgets/_kit/TintChip.tsx`: text =
`extrasFor(t).textAmber`, tint = `alpha(t.palette.primary.main, 0.16)` — conviction/emphasis
rendered in BRAND amber, structurally distinct from `warning` (which stays burnt-orange and is
used only where a glyph/label carries true warning semantics — the icon rule untouched).
**Closed site list:** (1) `setups/Setups.tsx:16–19` `convictionTone`: `high` → `'emphasis'`
(today `'warning'` — the mechanical burnt-orange inheritance the flag names; a high-conviction
setup is the "one line that matters" spend, and the census stays honest: one HIGH chip per setup
card at most). (2) `off-exchange-blocks/OffExchangeBlocks.tsx:73` proximity chip → **`'neutral'`**
— NOT emphasis. **Premise correction, recorded:** the flag said proximity "inherits warning
burnt-orange"; in source it is `tone="success"` — a *worse* violation (green on a datum whose own
subtitle says "no side or direction" trips the green/red reservation). Neutral is the honest
disposition: the widget's copy declares it context-not-signal, and amber on every block row would
re-sprinkle inside the sweep that exists to stop that. One-line swap to `emphasis` if the owner
overrules (§10-1). No other `TintChip` call site changes: TickerHeader regime chip
(success/error = gamma direction — reserved-correct) and session/offline chips
(warning + ⚠/⏸ glyphs = true warnings) stay.

### 5.4 ArcDivider depth — **deepen: control offset 4 → 8 (apex ≈ 4px), justified** (decided)

The Stage-2 constant (apex ≈ 2px over a full-width `preserveAspectRatio="none"` stretch) renders
sub-perceptual at 1440 — a signature nobody can see is absence, not restraint. Doubling the bow
(apex ≈ 4px ≈ 20% of the 20px box) makes the curvature legible at reading distance while staying
"a breath, not a hill." One constant in `shared/ui/ArcDivider.tsx:20` (`bowedArcPath([0,17],
[1200,17], 8)` — implementation latitude on endpoint y to keep the arc inside the box). Stroke =
`divider` @ 1px, height 20 reserved, both seams unchanged — no amber, no layout shift, importer
set untouched. Judged eyes-on at §8-R4 (1440 + 393, dark + light, both seams); ±latitude 6–10 on
the offset, finalized there.

### 5.5 Blog inline-SVG artwork — **closed list, recomposed on ink via the pipeline** (decided)

**The closed illustration list (all 7, all embedded in `building-a-team-of-ai-roles`;
`system-analysis` embeds none):** `docs/blog/img/before-after.svg` · `role-relay.svg` ·
`orchestrated-pipeline.svg` · `context-engine.svg` · `gateways-routing.svg` ·
`the-next-hires.svg` · `evolution-flywheel.svg`. Each currently paints cream/terracotta/teal
cards (`#FAF8F4`/`#E7E2D8` fields, `#F3E3D9`/`#B4562B`, `#DCEBE8`/`#2E6F69`, etc.) — the slop-
tell palette on a dark template. **Recomposition rule (assets only, prose untouched):** fields →
ink/panel/`panelRaised`; strokes/rules → steel at reduced alpha; text → phosphor/steel; accents →
`gammaAmber` (≤1 amber accent family per figure — the element that matters) + `signal` for
secondary categories; `warningOrange` permitted solely where a figure *depicts* a fault/bounce
path (e.g. the amendment bounce, the security-review flag); green/red stay out (reserved).
Values are the `tokens.ts` literals (static assets can't consume the theme) — **test-pinned**
(§8-9). **Pipeline law:** edit the 7 `.svg` sources, then `py docs/blog/build_html.py`
regenerates BOTH output copies (docs/blog + public/blog, byte-identical — the existing
`blog-tokens.spec.ts` sync check enforces it). Never a hand edit to `.html`. Markdown/article
prose: zero changes.

### 5.6 subtitle→h6 transients — **`component="p"` on the named sites** (decided)

MUI `subtitle1/subtitle2` default to `<h6>`. Closed edit list — styling byte-identical, element
only: **ai-rec (the flag's scope):** `AiRecPanel.tsx:421` (loading title) · `:642` (unavailable
title) · `:694` (BYO-key CTA titles) · `:1078` (no-trade verdict) · `:1104` (Trade·bias verdict —
a verdict is data/copy, not document structure). **Personas half of the flag: EMPTY** —
`features/personas/` contains zero `subtitle*`/`h6` usage (verified by scan; recorded, nothing to
edit). **Plus two skill-mandated repairs surfaced by the §8B heading re-audit (skill rule 6 — a
data value is never a heading; in-scope via BRIEF item 4):** `chrome/CommandDeck.tsx:108` (the
condensed bar's `TICKER · $price` — a data-value `<h6>` today) · `orders/OrdersWidget.tsx:36`
(store-fault transient title). Remaining `<h6>`-by-default subtitle sites elsewhere
(TradeEntryDialog, AiKeySection, outcomes, OrdersPanel/OrderDetailDialog, operator page) are
FLAGGED, not swept (§10-2).

---

## 6. (reserved — no interface work; fast-path, `NO_BACKEND_CHANGE`)

No FE↔BE surface changes; conformance specs n/a and correctly absent (§9-7).

---

## 7. NON-GOALS (explicit — touching these is out of contract)

- **No new arcs.** The arc importer **set-equality is untouched**: exactly
  `{shell/ConvexaMark.tsx, pages/landing/HeroCurve.tsx, shared/ui/ArcDivider.tsx}`; the
  ArcDivider seam pin stays `{shell/Footer.tsx, features/trading/outcomes/TrackRecordSection.tsx}`.
  §5.4 changes a constant INSIDE ArcDivider — zero new arc surfaces, zero new seams.
- **No copy changes.** Zero user-facing strings change anywhere (tones/elements/colors only;
  `component="p"` swaps keep text byte-identical). Blog prose untouched.
- **No router/backend change.** `app.tsx` routes untouched; `apps/api` diff empty; `libs/api`
  untouched; no wire field consumed or added.
- **Chart geometry LOCKED.** `chart.tsx` edits are the two animation props + the dead
  `animateBars` machinery ONLY — orientation (vertical diverging), series, axes, reference
  lines, tooltips, windowing all byte-identical (§6a-1).
- **No new motion families**, no edits to `HeroCurve` (THE moment), no re-choreography of the
  kept signals; interaction feedback (expand morph, hover reveals) stays as-is beyond the §3.1
  named tames.
- **`/_ops/metrics` untouched** (operator path separation; `chartCategorical` stays non-brand).
- **No durable-key/shape change** (`[loss-free-durable-migration]` not exercised); no
  `LiveTabPanel` import-class change (MUI + labels + tokens — the zero-import lock holds).
- **No landing sweep** — Stage 2 finished it (ValueCard hover set, hero, dividers stay).
- **og-image.png** stays as-is (still flagged, §10-5 — asset work outside the BRIEF's scope law).

---

## 7b. Binding invariants (restated for this feature)

- **`[theme-token-discipline]`** — every edit binds theme slots / `extrasFor(theme)`; zero new
  hex in `src/` (`textAmber` lives in `tokens.ts`; blog SVG literals live outside `src/` and are
  test-pinned §8-9); `hex-discipline` + `banned-hexes` green, zero new exemptions.
- **`[additive-keeps-score-byte-identical]`** — FE-only; empty `apps/api` diff at GATE Q.
- **Single-motion-moment** (skill §5) — this consolidation IS the key's second instance: after
  this stage the app has ONE orchestrated moment (hero curve-draw), data signals, and interaction
  feedback — nothing else; enforced structurally by `single-motion-moment.spec.ts` (§3.3-2).
- **Arc-in-exactly-3-places** — set-equality spec stays green byte-identical (§7).
- **`[live-vs-static-isolation]`** — the kept flash/pulse/dim semantics are the invariant's UI;
  the degraded-state suites stay green untouched; retiring the spectacle families touches no
  offline/dim path.
- **Semantic P/L green/red RESERVED** — the proximity-chip fix (§5.3) *strengthens* it (removes
  a green on a no-side datum); rate/className-identity tests stay green; no tint on rates.
- **Vertical-GEX-chart lock** — §7.
- **`[no-real-order-path]` / `[operator-vs-trader-path-separation]` /
  `[server-side-gate-enforcement]`** — not exercised; any accidental touch is STOP-and-flag.
- **Stagger guards REPLACED never deleted** (§6a-2) — §3.3 is the execution of that ruling.

---

## 8. Tests to write (the requirement set — the FE implements these, never chooses them)

Risk rule (qa-verify §4): `test:` = invariants / negative space / silently-regressing behavior;
`review:` = visible/intentional (copy, presence, ordering), verified in the GATE Q render pass.
No per-AC mirroring. Existing-suite law: baseline stays green throughout with EXACTLY the
accounted substitutions/pin-edits named in §3.3 and §8-6 — any other guard edit is a scope smell
to report, not patch.

### 8A. The matrix

| # | Kind | Case |
|---|---|---|
| 1 | `test:` | **Replacement motion guards** — §3.3 verbatim: the `Widget.spec.tsx` negative-space describe (stagger tokens absent, `widgetLivePulse` present, mutation-guarded) lands in the SAME commit that deletes the stagger; `HeroCurve.spec.tsx` (all cases) green, zero edits. |
| 2 | `test:` | **Single-motion-moment pin** — new `shared/theme/single-motion-moment.spec.ts` (§3.3-2): dash-draw only in HeroCurve; `widgetRise` nowhere; `chart.tsx` pins `isAnimationActive={false}` + no `animationDuration`; app-wide `@keyframes` inventory set-equal to the kept allowlist. Mutation-guarded (`?raw` idiom); a new keyframe = red build. |
| 3 | `test:` | **Amber-census scan (the mechanizable half)** — new spec, closed-file `?raw` scan, mutation-guarded: (a) NO `primary` token (slot string or `--mui-palette-primary`) inside any `'&:hover'` block of `Widget.tsx`, `_kit/StatTile.tsx`, `PositionRow.tsx`, `PositionCard.tsx`, `orders/OrderRow.tsx`, `PositionsView.tsx` (the "no amber on hover chrome" rule made structural); (b) `CommandDeck.tsx` contains zero `primary` references (the washes are gone; the deck has no legitimate amber); (c) the six MOVE→info sites (§4 lists: `AiRecPanel.tsx:221`, `OrdersWidget.tsx:113`, `CustomizationToolbar.tsx` History, `PositionsView.tsx` clear-link, `PositionRow.tsx` view-order, `Scanner.tsx` ticker link) bind `info`, not `primary`. The judged/visible remainder of the census is review row R2 — an app-wide "amber count" scan would be vacuous or brittle and is deliberately NOT attempted. |
| 4 | `test:` | **TintChip tone mapping** — `emphasis` renders `textAmber` text + primary-alpha tint (className/injected-CSS assertion — never `getAttribute('style')`); `warning` tone renders the warning slot unchanged; `Setups.tsx` maps `high → emphasis` (and NOT `warning` — negative half); `OffExchangeBlocks.tsx` proximity chip renders `neutral` and carries NO success/error class (className-identity — the green-reservation fix can't silently regress). Type-floor spec (`type-floor.spec.tsx`) extended to the new tone (11px floor holds). |
| 5 | `test:` | **brandGradient disposition** — `tokens.ts` does NOT export `brandGradient` (`'brandGradient' in tokens === false` pattern); app-wide `?raw` scan: zero `brandGradient` references and zero `linear-gradient(135deg` brand-pair occurrences in `features/auth/**`; avatar + pill render `primary.main` bg with `primary.contrastText` (className/innerHTML assertion) — the white-on-amber label is structurally unreproducible. |
| 6 | `test:` | **Deliberate pin edits, named** (the ONLY spec edits beyond §3.3): `stage1-tokens.spec.ts` — the `:70` composition pin becomes the ABSENT assertion (§5.1) + a new `textAmber` presence/value pin (dark === gammaAmber; light === the final measured value); `hex-discipline.spec.ts:46` comment refresh. Everything else in the stage-1 token spec stays byte-identical. |
| 7 | `test:` | **textAmber contrast pin** — spec computes WCAG ratios (a small luminance helper IN the spec): dark `textAmber` ≥4.5 on ink AND panel; light `textAmber` ≥4.5 on paper, on white, AND composited over `alpha(amberDeep, 0.16)` on white (the worst tint fill it sits on). A future token darken/lighten below the floor is a red build, not a design opinion. |
| 8 | `test:` | **textAmber consumption (structural)** — `?raw` scan over the §5.2 closed consumer list: each file resolves amber text via `extrasFor(` (never bare `extras.`, never `primary.main` for <18px text at those sites); mutation-guarded. |
| 9 | `test:` | **Blog output scan extension** — extend the blog suite: (a) `banned-hexes.spec.ts` ban list grows the illustration cream-family tells (`FAF8F4`, `E7E2D8`, `F3E3D9`, `F6EEDD` — split-constructed like the existing list) — app sources AND blog output can never re-grow them; (b) new assertion in `blog-tokens.spec.ts`: every 6-digit hex inside inline `<svg>` blocks of the emitted pages ∈ the token allowlist `{ink, panel, panelRaised, phosphor, steel, gammaAmber, signal, warningOrange}` (imported from `tokens.ts` — byte-bound, the generator precedent), mutation-guarded against a fixture SVG carrying a stray hex; (c) the existing docs↔public byte-identity check stays green (proves the pipeline, not hand edits, produced the output). |
| 10 | `test:` | **Heading elements on the named sites** — rendered assertions: the §5.6 sites produce NO `h1–h6` element (loading/unavailable/BYO-key/verdict ai-rec states; the CommandDeck condensed bar; the OrdersWidget fault state); extend the Stage-0 heading guard's data-value pattern so `TICKER · $…` headings match it (regression-proof, not just fixed once). |
| 11 | `test:` | **Existing suites zero-weakening** — degraded-state suites (LOADING≠EMPTY≠OFFLINE, offline-dim, offline-supersedes-live), `useFlashOnChange.spec` (all 5), reduced-motion suites, arc set-equality + seam pin, hex/banned-hex, P/L byte-pins, rate className-identity, focus-visible, chip floor, keyboard operability, nav-drawer safety, `blog.spec`, funnel/copy pins: ALL green with zero edits beyond §3.3 + §8-6. |
| R1 | `review:` | **Motion walk, real browser** — `/ticker/TSLA` cold: widgets appear AT REST (no cascade), chart bars render instantly at full height; live ticks still flash; the dot/edge pulses only while live; kill SSE → pulses stop, dim + ⏸ appear; select a widget → static conic ring (no spin); hover → lift with NEUTRAL border. `/` untouched: the curve still draws once. OS reduced-motion ON → everything inert, expand still works. |
| R2 | `review:` | **Per-surface amber before/after** (the BRIEF's judgment requirement): screenshot pairs for Ticker / Positions / Settings+auth / Scanner / TopNav, dark + light, 1440 + 393, each with a recorded one-paragraph judgment against §4's target statement — amber concentrates (flip, verdict, active states, CTAs, tier, coming-soon), links read signal-blue, chrome washes gone, warnings stay burnt-orange+icon. **This is the stage's grading criterion — spent, not sprinkled.** |
| R3 | `review:` | **textAmber legibility eyes-on** — light mode: Scanner pill, LOCKED chip, selected toggle, provenance chip, COPY buttons, HIGH chip — readable, still unmistakably amber, no muddy-brown drift; final measured values recorded in the stage report. |
| R4 | `review:` | **ArcDivider depth judged** — both seams, 1440 + 393, dark + light: the arc now *reads* as an arc at arm's length; still quiet (divider stroke, no amber); no layout shift vs the 20px box. Constant finalized within the §5.4 latitude. |
| R5 | `review:` | **Blog artwork before/after** — each of the 7 figures captured pre/post inside the dark article: cards sit on ink/panel (no cream card-on-dark collision), text legible (phosphor/steel), ≤1 amber accent family per figure, the diff shows ONLY `docs/blog/img/*.svg` + `build_html.py`-regenerated outputs. |

### 8B. The CLOSING QUALITY-FLOOR RE-AUDIT (Stage 0's checks re-run on the finished system)

The program ends where it began. Each row re-RUNS the Stage-0 §8 check against the FINAL system
— colors, motion set, and this stage's edits included. A row that fails = GATE Q FAIL (repair
in-scope only per §5.6/§1-crit-6; anything structural → report).

| # | Kind | Re-audit row |
|---|---|---|
| B1 | `test:` | **393 no-overflow, all routes + new states**: the existing `mobile-no-overflow` e2e re-run green on `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings` at 393×852, dark AND light — explicitly re-walked WITH: ai-rec transient states rendered, the emphasis/neutral chips, the flat sign-up pill, the deepened dividers, positions card view. `documentElement.scrollWidth ≤ innerWidth`. |
| B2 | `test:` + `review:` | **Focus-visible on final colors**: the Stage-0 focus spec green (ring binds `primary.main` — amber by construction; Widget's in-component ring intact); PLUS the ring-contrast pin: **ring color vs the surfaces it draws over ≥3:1** — computed in-spec: gammaAmber vs ink/panel/`panelRaised` (dark), amberDeep vs paper/white/`#ECECE7` (light — amberDeep measured 3.02 on paper at Stage 1; re-pin ≥3.0 and eyes-on that the 2px ring reads); tab-walk eyes-on across TopNav → deck → widgets → positions toolbar on final surfaces. |
| B3 | `test:` + `review:` | **Heading walk**: Stage-0 heading guard green + §8-10; a11y-tree walk on `/ticker` (with ai-rec states forced) and `/positions`: exactly one h1 per route, widget titles h2, no skipped levels, no data-value headings, no heading that mounts/unmounts with a transient state. |
| B4 | `test:` | **11px / 44px floors**: chip-floor spec + `type-floor.spec.tsx` (incl. the new `emphasis` tone) green; source-scan floor (no `fontSize` < 11 outside the chart-tick exemption list) green with zero new exemptions; 393 coarse-pointer spot-check of touch targets (nav, deck controls, row actions, the re-skinned pill) ≥44px effective. |
| B5 | `test:` + `review:` | **Reduced-motion**: all `useReducedMotion` consumption tests green (fewer consumers now — the scans in §8-1/2 prove the retired ones are GONE, not un-gated); eyes-on with OS reduce ON: zero animation anywhere except none (the moment renders static per HeroCurve guards), function preserved (expand, tooltips, dialogs). |
| B6 | `test:` | **theme-color + parity spot re-run**: the theme-color-follows-mode specs green; light-mode render pass of every swept surface (R2 covers eyes; this row pins the suites). |

---

## 9. GATE Q battery (process riders, proposal §6a — all required)

1. `npx tsc -b` clean (also proves: zero `brandGradient`/`revealIndex` stragglers).
2. `nx build dashboard` green.
3. `nx test @org/dashboard` — full suite green; zero skipped/deleted guards beyond the §3.3
   substitution + §8-6 pin edits (both named, both same-commit with their replacements).
4. Lint (module boundaries) green.
5. **Empty backend diff proof:** `git diff main -- apps/api` produces no output.
6. **Real-browser render pass (Playwright): 1440 AND 393, BOTH color schemes** on `/`,
   `/ticker/TSLA`, `/positions`, `/scanner`, `/settings`, PLUS the blog article page, PLUS a
   reduced-motion pass — capturing the §8 R1–R5 evidence and the §8B eyes-on rows. Never
   silently skipped: this stage's whole point is visible.
7. Conformance specs: **n/a and correctly absent** — no FE↔BE surface changed.
8. `py docs/blog/build_html.py` run as the LAST blog step; `git status` shows only
   `docs/blog/img/*.svg`, the two regenerated HTML copies (×2 locations), and no hand edits.

---

## 10. Open questions (explicitly recorded — nothing silently decided)

1. **Proximity-chip premise correction** (§5.3): the flag said the off-exchange proximity chips
   inherit *warning*; in source they are `tone="success"` — a green/red-reservation violation on
   a no-side datum. Dispositioned to `neutral` (context-not-signal, per the widget's own copy).
   If the owner intended amber emphasis on proximity, it is a one-line tone swap + a §8-4
   assertion flip.
2. **Sibling `<h6>`-by-default subtitle sites** outside the flag's scope were found and left:
   `TradeEntryDialog.tsx:452/910`, `AiKeySection.tsx:226`, `outcomes/ArchiveBlock.tsx:138` +
   `TrackRecordSection.tsx:163`, `OrdersPanel.tsx:102`, `OrderDetailDialog.tsx:97`, operator
   page (off the trader path). Dialog-internal and section-label `<h6>`s don't break the route
   walks today (B3 verifies); a follow-up `component="p"` sweep is a cheap owner call.
3. **The selected-widget conic spin** was NOT one of the BRIEF's five families; §3.1-6 tames it
   (static ring stays, infinite spin goes) under the consolidation's "retire spectacle" mandate.
   Restoring the spin is a one-hunk revert if the owner wants it back — flagged for the R1 walk.
4. **CommandDeck amber washes → neutral** (§4.1) is this contract's judgment call under
   "spent, not sprinkled" (an even chrome wash = sprinkle). The R2 before/after records it; the
   revert is three `color-mix` values.
5. **`og-image.png` still pre-signature** (carried from Stage 2 §10-3): the OG card wears the
   old identity; regenerating it is cheap asset work awaiting the owner — still not in scope.
6. **textAmber light value** (§5.2) and **ArcDivider offset** (§5.4) ship as candidates behind
   gates (measured ≥4.5; render-pass judgment within 6–10) — recorded so the pass judges a named
   intent; finals go in the stage report.
7. **Blog amber budget** (≤1 amber accent family per figure) is enforced by review R5, not by
   scan (the §8-9 scan enforces the palette allowlist; counting "accent families" mechanically
   would be false precision).
8. **Additive landing arc seams** (Stage-2 §10-1) remain deliberately un-added — the set-equality
   non-goal (§7) keeps the finale additions-free; still a two-line follow-up if the owner wants
   the landing sections articulated.
