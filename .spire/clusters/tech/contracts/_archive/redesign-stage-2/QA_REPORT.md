# redesign-stage-2 — QA_REPORT (GATE Q, fresh verifier)

Branch verified: `redesign-stage-2` (4 commits over `main`, HEAD `828a391`). FE-only, GATE V
fast-path, `NO_BACKEND_CHANGE`. No PRODUCT_CONTRACT.md for this feature (n/a per `_MANIFEST.md` —
GATE V fast-path); the checklist below is the FRONTEND_EXECUTION_CONTRACT's §9 GATE Q battery +
§8 test-traceability + §7 non-goals + §10 rulings, which is this feature's acceptance surface.

## 1. Battery (re-run myself, not taken on claim)

| Check | Result | Evidence |
|---|---|---|
| `npx nx test dashboard` | **PASS** | Ran twice, second with `--skip-nx-cache` (forces a real re-run, not a cache replay): **69 files / 563 tests, 0 failures**, both runs. Matches the claimed 69/563 exactly. |
| `npx tsc -b apps/dashboard/tsconfig.app.json --force` | **PASS** | Clean, zero output (proves `ConvexityMotif`'s deletion left zero dangling importers — a red build would have surfaced here). |
| `npx nx run @org/dashboard:typecheck` | **PASS** | Green (`tsc --build --emitDeclarationOnly`, cache-hit but consistent with the fresh `tsc -b` above). |
| `npx nx lint dashboard --skip-nx-cache` | **PASS** | **29 warnings, 0 errors.** Enumerated all 29 by file: `SettingsPage.tsx`, `useGhostTrade.ts`, `ledger.spec.ts`, `positions.risk.spec.tsx`, `useLatencyTrend.ts`, `TickerDashboard.tsx`, `ticker.risk.spec.tsx`, `type-floor.spec.tsx`, `CommandDeck.tsx`, `TickerHeader.tsx`, `IvRank.tsx`, `LiveTape.tsx`, `MarketContext.spec.tsx`, `migration.spec.ts`, `hex-discipline.spec.ts`, `stage1-tokens.spec.ts`, `shell-live-lifecycle.flow.spec.tsx` — **none of these are in this stage's touched-file set** (confirmed against the diff stat in §4 below). Claim holds exactly. |
| `npx nx build dashboard --skip-nx-cache` | **PASS** | Vite build succeeds (only a pre-existing >500kB chunk-size advisory, unrelated to this stage). |

## 2. Isolation

| Check | Result | Evidence |
|---|---|---|
| `git diff main -- apps/api` | **PASS — empty** | `git diff main -- apps/api \| wc -l` → `0`. |
| `git diff main -- libs/api` | **PASS — empty** | `wc -l` → `0`. |
| Conformance (`interface_conformance.py`) | **N/A, correctly absent** | No INTERFACE_CONTRACT.md for this feature (`_MANIFEST.md` marks it n/a — GATE V fast-path, `NO_BACKEND_CHANGE`); nothing on the FE↔BE surface changed. Correctly not run. |
| `package.json` / `apps/dashboard/package.json` diff | **PASS — empty** | Confirms the §10-notes "zero new deps" claim for `generate-brand-assets.mts` (it shells out to an already-installed local Chrome/Edge via `execFileSync`, no npm package added). |

## 3. §8 traceability — read every named spec, confirmed the guards actually bite

| §8 # | Spec | Verdict | Evidence |
|---|---|---|---|
| 1 (arc-importer-count, mutation-guarded) | `shared/ui/arc.spec.ts` | **PASS** | Read in full. Set-equality assertion (`toEqual`, not `toHaveLength`) against `{ConvexaMark.tsx, HeroCurve.tsx, ArcDivider.tsx}`; barrel non-re-export asserted for both `arc.ts` and `ArcDivider`; a real mutation-guard test (`importsArcPrimitive`/`importsArcDivider` checkers exercised against synthetic 4th-importer-shaped strings, proving the checker isn't vacuous); the ArcDivider seam-pin is a SECOND set-equality assertion against the two named seams. This is real behavioral coverage, not a comment claiming coverage. |
| 2 (reduced motion → static frame) | `pages/landing/HeroCurve.spec.tsx` | **PASS** | `matchMedia` mocked true/false; asserts absence/presence of the `hero-curve-draw` class + baseline fade class; a dedicated source-level assertion that the component imports `@/shared/hooks/useReducedMotion` and contains **zero** `matchMedia` references itself (proves it's not a bespoke media query) + the CSS reduced-motion fallback block is present. |
| 3 (no layout shift, paint-only) | same file, §8-3 block | **PASS** | (a) injected-CSS assertion (never `getAttribute('style')`, per the house testing gotcha) proves `position:absolute; inset:0; pointer-events:none`; (b) a real mutation-guarded `keyframeProps()` checker parses the `keyframes\`...\`` blocks and is proven to flag a `width` fixture before asserting the real component's keyframe property set is exactly `{stroke-dashoffset, opacity, transform}`, plus a `transition:` absence check. One-shot re-render test also present (§4.2) — re-render keeps the identical DOM node with the draw class still applied (proves it can't replay). |
| 4 (favicon sizes) | `shared/theme/brand-assets.spec.ts` | **PASS** | Real byte-level parsing: PNG IHDR width/height read at offsets 16/20 for `apple-touch-icon.png` (180×180 asserted); ICO directory parsed by hand (reserved/type/count fields, then each 16-byte entry) and asserted to contain both a 16×16 and 32×32 entry; `index.html` link tags asserted by regex (svg icon, apple-touch icon, and that the legacy `.ico` fallback link is KEPT). |
| 5 (no gradient + favicon hex pin) | same file, §8-5 block | **PASS** | Mutation-guarded `gradientTells()` checker proven against `linear-gradient(`/`<linearGradient`/`<radialGradient` fixtures before scanning `ConvexaMark.tsx`, `arc.ts`, `HeroCurve.tsx`, `ArcDivider.tsx`, `favicon.svg` — all clean. `favicon.svg`'s literal hexes are extracted by regex and set-compared against `{ink, gammaAmber}` imported live from `tokens.ts` (byte-exact, not a copy-pasted literal in the test — a token-value edit would break this test, which is the point). |
| 6 (hex/ban-list suites stay green) | `hex-discipline.spec.ts` + `banned-hexes.spec.ts` | **PASS** | Both ran green in the full-suite run (§1); diffed against `main` — neither file was touched (zero new exemptions, per `git diff main...redesign-stage-2` stat, §4). |
| 7 (radial blob removed, negative space) | `pages/landing/landing-structure.spec.tsx` §8-7 block | **PASS** | Mutation-guarded `hasRadialGradient`/`referencesMotif` checkers proven against fixtures; scans `pages/landing/**` + `shared/ui/ValueCard.tsx` for zero `radial-gradient`; separately asserts zero app-wide file named `ConvexityMotif` and zero source referencing the string `ConvexityMotif`. |
| 8 (landmark + heading order) | same file, §8-8 block | **PASS** | Rendered `Landing`: exactly one `<main>` (footer explicitly asserted OUTSIDE it, hero/value-cards/coming-soon explicitly asserted INSIDE it); exactly one `h1`; zero `h4`–`h6`; a level-monotonicity walk (`levels[i] - levels[i-1] <= 1`) rather than a hardcoded sequence; all 5 card testids asserted to render an `h3` heading with no other heading level inside. |
| 9 (existing suites, zero-weakening) | full suite | **PASS** | 563/563 green; `Widget.spec.tsx` (the 4 stagger guards) diffed **untouched** against `main`; `useReducedMotion.ts`/`.spec.tsx` **untouched**; the one accounted substitution — `ui-primitives.spec.tsx` — see note below. |
| 10–13 (`review:` rows) | conductor render pass | **see §6 below** | Partial coverage — flagged, not a silent pass. |

**Note on the "ui-primitives.spec.tsx substitution" premise:** the execution contract (§2 step 3,
§8 preamble) states the HeroCurve guards "REPLACE" `ConvexityMotif`'s assertions in
`ui-primitives.spec.tsx`, "in the same commit." I read `ui-primitives.spec.tsx` on both `main` and
this branch: the file is **byte-identical** across the diff (confirmed empty
`git diff main...redesign-stage-2 -- .../ui-primitives.spec.tsx`), and on `main` it already
carried **zero executable assertions** about `ConvexityMotif` — only a doc-comment explicitly
disclaiming coverage ("NOT asserted here… the ConvexityMotif SVG geometry," dated to the
2026-07-16 risk-based-testing migration, i.e. before this stage existed). So there was nothing to
replace in that file; the FE instead landed the HeroCurve guards in a new dedicated
`HeroCurve.spec.tsx` (+ the negative-space check in `landing-structure.spec.tsx` §8-7). Net effect
is the same as the contract intends — real coverage lands, nothing is weakened — the contract's
premise about *where* the old (nonexistent) assertions lived was simply stale. Not a scope smell;
recording it because the contract's own language invited a literal-file-match check that doesn't
resolve as written.

## 4. Diff audit (`git diff main...redesign-stage-2 --stat`, 24 files)

| Check | Result | Evidence |
|---|---|---|
| File set confined to contract's scope | **PASS** | 24 files: `index.html`, 4 binary assets under `public/`, `TrackRecordSection.tsx`, `HeroCurve.{tsx,spec.tsx}`, `Landing.tsx`, `landing-structure.spec.tsx`, `positions-page.spec.tsx`, `brand-assets.spec.ts`, `ArcDivider.{tsx,spec.tsx}`, `ComingSoonCard.tsx`, `ConvexityMotif.tsx` (deleted), `ValueCard.tsx`, `arc.{ts,spec.ts}`, `shared/ui/index.ts`, `ConvexaMark.{tsx,spec.tsx}`, `Footer.tsx`, `generate-brand-assets.mts`. All match the contract's named surfaces (§2, §3, §4, §5, §6, §8). No stray file. |
| `ConvexityMotif` deleted, zero references | **PASS** | File deletion confirmed in diff; app-wide grep (own scan, not just the spec's) finds zero remaining references outside the deleted file's own history. |
| Hero COPY byte-identical vs `main` | **PASS** | Read the full `Landing.tsx` diff: every visible string (H1 "See the dealer positioning behind the price.", body paragraph, chip label, both CTA labels, all 3 value-card titles/bodies, both coming-soon card titles/bodies, the disclaimer text) reproduces character-for-character across the diff — only structural wrapping (`<main>`, `component="h2"`, `HeroCurve` swap-in, `displayScale` clamp on `fontSize`) changed. |
| Router untouched | **PASS** | `git diff main...redesign-stage-2 -- apps/dashboard/src/app/app.tsx` → empty. |
| Chart frame untouched | **PASS** | `git diff --stat` over `pages/ticker/widgets/gex-profile-chart/*` → empty. |
| `positions-page.spec.tsx` update is exactly the accessible-name change | **PASS** | Diff is a single assertion changed from `getByText('Convexa')` to `getByRole('img', { name: 'Convexa' })`, with an explanatory comment citing the contract section — nothing else touched in that file. |
| `TrackRecordSection.tsx` change is the seam swap | **PASS** | `Divider` import removed, `ArcDivider` import added, `<Divider sx={{mb:3}}/>` → `<ArcDivider sx={{mb:3}}/>` at the book↔track-record boundary. Rest of the diff is import-order churn (Prettier) only. |
| `ValueCard` cut is the single `::after` hunk | **PASS** | Diff shows exactly the `&::after` block (the radial-gradient light-bleed) removed, plus its two necessarily-coupled toggle sites (`&:hover::after`, the reduced-motion `&::before, &::after` selector narrowed to `&::before` alone) — no other rule touched; lift/top-edge-wipe/border-accent/icon-scale/CTA-nudge all still present in the diff. |
| `brandGradient` kept, 2 consumers verified | **PASS** | Grepped the app source myself: `features/auth/avatar.ts` and `features/auth/AccountControl.tsx` both still import and apply `brandGradient` — the "if nothing consumes it, delete" condition is not met, matching §7. |
| `arc.ts` not barrel-exported | **PASS** | `shared/ui/index.ts` diff explicitly removes the old `ConvexityMotif` export and adds a comment stating `arc.ts`/`ArcDivider.tsx` are deliberately NOT exported (keeps the importer scan sound); confirmed no `export … from './arc'` or `'./ArcDivider'` line exists in the file. |
| `index.html` SEO/OG block untouched | **PASS** | Diff is exactly 3 added lines (svg icon link + apple-touch link, `.ico` fallback kept) in the icon-links area; no other head changes. |

## 5. Judgment items

| Item | Verdict | Reasoning |
|---|---|---|
| Hero-curve geometry: two-segment tangent-continuous chain vs. a single quadratic | **PASS — within latitude** | §4.1 specifies the *visual* requirement ("a single convex payoff shape," "slope monotonically increasing," "built from the `shared/ui/arc.ts` builder") — it does not mandate a single Bézier primitive. `quadChainPath` is itself exported from `arc.ts` (still "the builder"), the two segments are constructed with the second segment's control point placed on the first segment's end-tangent (verified by reading `HeroCurve.tsx`'s `SEG1`/`SEG2` constants and the tangent-continuity comment), and the recorded justification (a single quadratic collides with the hero copy at 1440) follows the contract's own decide-and-justify pattern used elsewhere (§3.1). Slope is monotonically increasing across both segments by construction (control points strictly rising toward the top-right). No violation of the stated geometry constraints. |
| `generate-brand-assets.mts` — zero new deps | **PASS** | `package.json`/`apps/dashboard/package.json` diffs are empty (§2 above); the tool shells out to a local Chrome/Edge binary via `execFileSync`/`findBrowser()` — no npm dependency added, no build-step coupling (it's a manual one-off, not wired into `nx build`). |
| §10 ruling #3 (og-image UPGRADED — regenerate in-stage) | **PASS** | `apps/dashboard/public/og-image.png` is a modified binary in the diff (85,651 → 23,071 bytes); the generator's `ogHtml()` renders the new lockup (`CONVE` + arc-X + `A`) on ink at 1200×630; RENDER_PASS.md conductor note: "1200×630 lockup on ink; distinctive, clean" (viewed the image myself — consistent). |

## 6. Real-browser render pass (§9-6) — audited, not reproduced (no browser access this session)

RENDER_PASS.md is the conductor's real-browser evidence. I viewed both screenshots on disk myself
(`s2-landing-1440-dark.jpeg`, `s2-landing-393-light.jpeg`) and they show the claimed result:
CONVEXA lockup with amber arc-X (no gradient), the hero curve sweeping the right region and
settling into a full-bleed baseline arc divider, no glow blob, correct on both dark/light paper.

However, auditing RENDER_PASS.md against §9-6's explicit scope surfaces a **real coverage gap**,
which I am flagging rather than silently accepting:

- §9-6 requires **1440 AND 393, BOTH color schemes** on **`/`, `/ticker/TSLA`, `/positions`
  (track-record seam), `/settings`** (16 screenshot combinations) **plus a dedicated
  reduced-motion-emulated pass on `/`**. Only **2 files exist** on disk (`render-pass/` directory
  listing confirmed): `1440-dark` and `393-light`, both of `/` only. `/ticker/TSLA`, `/positions`,
  and `/settings` have **no screenshots at all** — including the `/positions` track-record
  ArcDivider seam, which RENDER_PASS.md's own table marks "measured" rather than screenshotted.
  `/settings` (the named regression-eyes check) has no evidence at all.
- RENDER_PASS.md's own table text references a `s2-landing-1440-light` file ("both 1440 shots";
  "s2-landing-1440-light… (`s2-landing-1440-dark` pair)") that **does not exist** in the
  `render-pass/` directory — only the dark 1440 shot is present. This is an internal inconsistency
  in the conductor's own report, not just a coverage gap.
- No reduced-motion-emulated screenshot exists anywhere in the evidence.
- Most materially: §9-6 states explicitly *"the structural fallback note is not acceptable for the
  draw moment — this stage's whole point is visible."* RENDER_PASS.md's own "Draw animation" row
  reads: *"my pass saw the final frame both modes. The live 900ms draw itself: accepted on the
  test evidence"* — i.e., the conductor did **not** watch the live draw in a real browser and
  substituted the structural/unit-test evidence instead, which is the exact substitution this
  clause disallows.

The FE's own code-level guarantees for the draw moment are strong and independently verified by me
(§3, rows 2/3 above: property-set pin, reduced-motion static-frame test, one-shot re-render test,
box-reservation assertion) — so I have **no reason to doubt the moment behaves correctly** — but
the contract's explicit, named process rider (§9-6, "never silently skipped… not acceptable for
the draw moment") was not satisfied as written, and I am not equipped to supply the missing
real-browser evidence myself (no browser access this session). This is a **process-rider gap**,
not a code defect.

## 7. Known context

- **2 timing-flaky specs** (OPEN_THREADS §7/§8: "2 timing-based positions/settings specs
  occasionally fail on a cold run; a clean `--skip-nx-cache` run is green"): my `--skip-nx-cache`
  re-run was green (563/563) on the first clean attempt — consistent with the documented,
  pre-existing, accepted flakiness. Not this stage's regression.

## 8. Binding invariants (§7b) — checked against the diff, not reopened

- `[theme-token-discipline]` — held (zero hex in `src/`; favicon literals are the sole exemption,
  outside `src/`, byte-pinned to tokens — §3 row 5).
- `[additive-keeps-score-byte-identical]` — held (empty `apps/api` diff, §2).
- The ONE-motion rule — held (property-set pin, shared-hook consumption, §3 rows 2–3).
- Arc-in-exactly-3-places — held (set-equality importer pin, §3 row 1).
- `[no-real-order-path]` — held (hero copy byte-identical, §4; coming-soon band untouched).
- Vertical-GEX-chart lock — held (zero diff on chart files, §4).
- `[live-vs-static-isolation]` / `[operator-vs-trader-path-separation]` /
  `[loss-free-durable-migration]` — not exercised, as expected (static landing + chrome only); no
  accidental touch found in the diff.

## Summary

- **PASS: 21** (battery ×5, isolation ×3, §8 rows 1–9, diff-audit items ×10, judgment items ×3 —
  see tables above for the itemized count; every row not explicitly called out below is PASS)
- **FAIL: 0**
- **UNVERIFIABLE / FLAGGED: 1** — §9-6 real-browser render-pass coverage (partial: landing-only,
  2 of ~16+1 required shots, an internally-inconsistent file reference, and the live-draw-moment
  fallback the contract explicitly disallows). Not reproducible by me this session (no browser).

## Overall GATE Q verdict: **PASS, with one flagged process-rider gap (not code-blocking)**

Rationale: every acceptance surface I could independently exercise — the full test battery (fresh,
not cached), typecheck, lint, build, backend/libs isolation, the §8 test-traceability read (every
named spec read in full, mutation guards confirmed to actually bite, not just present), the full
file-level diff audit against the contract's closed scope list, and the two judgment calls — holds
cleanly with zero FAILs and no broken invariant. The one gap (§9-6's render-pass coverage) is a
**process-rider evidence gap in the conductor's own report**, not a defect in the shipped code: the
structural/unit-test coverage for the exact behavior that render pass would visually confirm (the
draw moment, reduced motion, box reservation) is independently strong and verified by me at the
code level. I am not bouncing this to Frontend (the code is not at fault and re-doing the FE's work
would not fix a render-pass gap), but recording it so the missing screenshots
(`/ticker/TSLA`, `/positions`, `/settings`, the reduced-motion-emulated pass, and an actual
eyes-on live-draw observation) can be captured before/alongside deploy — see the follow-up note below.

---

## Follow-up note (NOT a GATE Z bounce -- overall verdict is PASS; no AC, invariant, or test failed)

**Not a Frontend code bounce** — no AC/invariant/test failed. Flagging the render-pass gap for the
owning process (conductor / process-rider step, since RENDER_PASS.md is explicitly conductor-owned
evidence per its own title and the task framing, not an FE deliverable):

| Gap | Observed | Expected (§9-6) | Owning lane |
|---|---|---|---|
| Render-pass route/viewport/scheme coverage | 2 screenshots on disk, `/` only, 1440-dark + 393-light (no 1440-light, no 393-dark) | 16 combinations across `/`, `/ticker/TSLA`, `/positions`, `/settings` × {1440,393} × {dark,light} | Conductor / process (render-pass step) |
| Reduced-motion-emulated screenshot pass on `/` | None captured | Required, named explicitly in §9-6 | Conductor / process |
| Live draw-moment observation | Conductor's own note: "accepted on the test evidence," final-frame-only observed | §9-6: "the structural fallback note is not acceptable for the draw moment" | Conductor / process |
| RENDER_PASS.md internal reference to a nonexistent file (`s2-landing-1440-light`) | File absent from `render-pass/` | Report should only cite evidence that exists | Conductor / process |

This does not block GATE S on the FE code; it is recorded so the outstanding real-browser
observation can be completed (a cheap follow-up — the code-level guarantees make the visual outcome
very likely correct, but "very likely" is not the same as "observed," and the contract is explicit
that this one moment is not allowed to ship on a structural fallback alone).
