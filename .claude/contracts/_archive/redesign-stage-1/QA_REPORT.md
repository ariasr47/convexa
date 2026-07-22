# redesign-stage-1 — QA_REPORT (GATE Q)

> Fresh-session verification against the branch `redesign-stage-1` (6 commits over merge-base
> `8ddbf71`, confirmed — the FE report's "base b6db5ec" is a typo, not a real base). GATE V
> fast-path, FE-only token-layer identity swap, `NO_BACKEND_CHANGE`. All commands re-run myself
> with `--skip-nx-cache` where relevant (no trusted-cache reads); code read only to explain/confirm
> observed behavior, not to substitute for it. No files edited; no fixes applied.

## GATE Q battery (§9)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `npx tsc -b apps/dashboard/tsconfig.app.json --force` | PASS | exit 0, no output |
| 1 | `npx nx run @org/dashboard:typecheck` (fresh, `--skip-nx-cache`) | PASS | `tsc --build --emitDeclarationOnly` succeeded |
| 3 | `npx nx test dashboard` (fresh, `--skip-nx-cache`) | PASS | **63 test files / 523 tests, all green** — matches the FE claim exactly |
| 4 | `npx nx lint dashboard` (fresh, `--skip-nx-cache`) | PASS | **0 errors, 29 warnings** — matches the FE claim. Warnings audited against `main` (see note below): **28 of the 29 pre-exist on `main`; 1 (`stage1-tokens.spec.ts:89`, a non-null assertion) is new**, introduced in a new test file this branch added. Not a gate failure (0 errors is the bar; warnings are non-blocking), but the FE's "29 pre-existing" framing is imprecise — 1 is new, in an added spec, not app code. |
| 2 | `npx nx build dashboard` (fresh, `--skip-nx-cache`) | PASS | Vite build succeeded, `dist/` emitted, no external-fetch errors |
| 5 | `git diff main -- apps/api` | PASS | empty (0 lines) |
| 5 | `git diff main -- libs/api` | PASS | empty (0 lines) |
| 9 | Conformance specs n/a and absent | PASS | no `INTERFACE_CONTRACT.md` for this feature; nothing to run `interface_conformance.py` against — correctly absent, not skipped |
| 6 | Real-browser render pass (Playwright, both schemes, all routes) | PASS (conductor evidence) | `RENDER_PASS.md` — see the render-pass audit below; I have no browser tool in this session, so this row is verified by citing/auditing the conductor's evidence, not re-shot |
| 7 | Contrast measurements recorded | PASS | full table in `tokens.ts` comments + `stage1-tokens.spec.ts` pins; **I independently recomputed 19 pairings** (below) — all match the recorded values exactly |
| 8 | Blog regenerated via `py docs/blog/build_html.py`, no hand-edit | PASS | `docs/blog/*.html` ≡ `apps/dashboard/public/blog/*.html` byte-identical (`diff -q`, both files); diff vs `main` is 100% template-explained (spot-checked `system-analysis.html` line-by-line) |

**Lint-warning verification method:** built a throwaway `git worktree` at `main` (junctioned
`node_modules` to avoid a full reinstall), ran `npx nx lint dashboard --skip-nx-cache` there:
**28 warnings, 0 errors**, same file/line list as the branch minus `stage1-tokens.spec.ts:89`.
Worktree removed afterward; the checkout of `main` content into the branch working tree during
this process was fully reverted (`git clean -f -- scripts/`, `git diff --stat HEAD` confirmed
clean before proceeding) — no residual contamination of the graded tree.

## §3 token map — spot-verified against `tokens.ts`/`theme.ts` diff

All `palette.dark`/`palette.light` entries, `extras`/`extrasLight`, `brandGradient`,
`chartCategorical` (unchanged, confirmed by diff), `elevation` (unchanged values + new derived
`shadows[]`), and `shape` (unchanged) match §3.1/§3.2 **exactly**, including the six §3-given dark
values byte-exact (`ink #0B0F17`, `panel #131A24`, `phosphor #E9E4D6`, `steel #8A9BB4`,
`gammaAmber #F2A93B`, `signal #5E8BC4` in their correct slots) and the two theme-audit gap
closures (`secondary` = steel + explicit contrastText; explicit `primary.contrastText` both
modes). `accentViolet`/`buttonPrimaryBg` are **absent** from `extras`/`extrasLight` (grep confirms
zero live references anywhere in `src/`, only one explanatory comment in `theme.ts`); `tsc -b`
green proves zero orphan importers.

## §3.3 forced-rebind list (closed) — verified line-by-line, PASS on all 6

| # | Site | Verified change | Verdict |
|---|---|---|---|
| 1 | `gex-profile-chart/chart.tsx` | spot `primary.main`→`text.secondary` (steel), flip `warning.main`→`primary.main` (amber), live stays `info.main`; only `stroke`/label-color props touched, `ReferenceLine`/axis/orientation code untouched | PASS |
| 2 | `ValueCard.tsx` | top-edge gradient `primary→accentViolet` → `primary.main→primary.dark`; icon tint `alpha(primary)+alpha(accentViolet)` → `alpha(primary, .18)+alpha(primary, .08)`; zero violet references left | PASS |
| 3 | `OpportunityTier.tsx` | `tierMeta` actionable/prime `warning.main`/`warning.dark` → `primary.main`/`primary.dark`; `PrimeBanner` keeps `severity="warning"` (icon/role/a11y structure) with an `sx` override repainting color/bg/border/icon to `primary.main` — exactly the contract's prescribed pattern | PASS |
| 4 | Coming-soon amber sites (`ComingSoonCard.tsx`, `Scanner.tsx`, `LiveTabPanel.tsx`) | all three `warning.main` → `primary.main` (chip/badge/lock-note); `LiveTabPanel`'s zero-import lock untouched (still only MUI + labels + hatch import) | PASS |
| 5 | `theme.ts` `MuiButton` | the dark-mode `containedPrimary` override branch (keyed on `buttonPrimaryBg`) is deleted entirely; `root` now just sets `textTransform: 'none'`; contained-primary relies on the palette's explicit `primary.contrastText` | PASS |
| 6 | `index.html:15` theme-color | `#0e1117` → `#0B0F17`, byte-exact match to `palette.dark.background.default` (also test-pinned in `stage1-tokens.spec.ts`) | PASS |

No component edit found outside this list (full `git diff --name-only main...redesign-stage-1`
audited — see "Diff confinement" below).

## §5 — the contrast table: MEASURED, not asserted; recomputed independently

I recomputed 19 pairings myself with a standalone WCAG relative-luminance script (not trusting
the builder's arithmetic), including the one at-risk bounced value:

| Pairing | My computed ratio | Recorded in `tokens.ts`/spec | Match |
|---|---|---|---|
| D1 phosphor / ink | **15.10:1** | "measured 15.10:1" | exact |
| D2 phosphor / panel | 13.77:1 | (proposal ≥4.5, not separately pinned) | consistent, passes |
| D3 steel / ink | 6.78:1 | — | passes ≥4.5 |
| D4 signal / ink | 5.45:1 | — | passes ≥4.5 |
| D5 gammaAmber / ink | 9.60:1 | — | passes ≥3 (and ≥4.5) |
| D5 gammaAmber / panel | 8.75:1 | — | passes |
| D6 ink contrastText / gammaAmber | **9.60:1** | comment "ink text on amber fills (9.60:1)" | exact |
| D7 warning / ink | 6.42:1 | — | passes ≥4.5 |
| D7 warning / panel | 5.85:1 | — | passes ≥4.5 |
| L1 inkText / paper | 15.18:1 | — | passes ≥4.5 |
| L1 inkText / white | 16.43:1 | — | passes ≥4.5 |
| **L3 §3-given `#C9821A` / paper** | **2.90:1** | "MEASURED 2.90:1 against paper" | exact — **confirms the bounce was necessary** (fails 3:1 UI floor) |
| L3 §3-given `#C9821A` / white | 3.14:1 | — | passes on white alone, but paper fails |
| **L3 bounced `#C57F19` / paper** | **3.02:1** | "→ 3.02:1 on paper" | exact — **minimal darken, barely clears 3:1** |
| L3 bounced `#C57F19` / white | 3.27:1 | "3.27:1 on white" | exact |
| L4 inkText / amberDeep-bounced | 5.03:1 | "5.03:1 ink-on-fill" | exact |
| L5 lightWarning `#A65526` / paper | 4.91:1 | "4.91:1 paper" | exact |
| L5 lightWarning / white | 5.32:1 | "5.32:1 white" | exact |
| L6 lightInfo `#3D6DA5` / paper | 4.94:1 | "4.94:1 paper" | exact |
| L6 lightInfo / white | 5.34:1 | "5.34:1 white" | exact |

**Verdict on the bounce:** confirmed correct and minimal. `#C9821A` (the §3-given value) measures
2.90:1 against paper — below the 3:1 UI floor for D5-class large/UI pairings (per §5's own
threshold table). The shipped value `#C57F19` is the *smallest* darkening that clears the bar
(3.02:1, essentially right at the line) — not an arbitrary "safe" overcorrection, and it is
recorded in three places: `tokens.ts`'s `amberDeep` comment, `stage1-tokens.spec.ts`'s pin test,
and `RENDER_PASS.md`'s live-render confirmation. This matches the contract's §10-5 pre-authorized
"measured, never ships failing, never silent" rule exactly — PASS, not a deviation to bounce.

D8/L8 (success/error, reserved, byte-locked) were not independently re-measured against ink/paper
since their values are explicitly unchanged and out of scope for re-derivation (§5's own rule: "no
bounce without GATE Z"); pinned byte-identical via `stage1-tokens.spec.ts` §8-5 instead — that's
the correct gate for those two rows, not a contrast re-measure. X1 (focus ring UI≥3 on canvas) is
judged in the render pass (RENDER_PASS row 1, ring color confirmed = gammaAmber via
`stage1-tokens.spec.ts` §8-6); UNVERIFIABLE by me directly (no browser), relying on conductor
evidence — see render-pass audit below.

## §8 tests-to-write matrix — traceability

| # | Kind | Case | Named spec | Verified |
|---|---|---|---|---|
| 1 | test | Hex-scan ban list | `banned-hexes.spec.ts` | Read in full; ban list has all 9 retired hexes (`4f9cff`,`1d6fe0`,`7b5cff`,`0d1117`,`161b22`,`8b949e`,`e6edf3`,`f4f1eb`,`0e1117`); scans `src/app/**` incl. `shared/theme`, `index.html`, `public/blog/*.html`; a real MUTATION-GUARD test (`it('MUTATION GUARD...')`) proves the checker fails on injected fixtures; ran in isolation — 5/5 tests pass |
| 2 | test | Token-map completeness | `stage1-tokens.spec.ts` | Read in full; asserts all 6 §3 dark values byte-exact, removed keys absent (`'accentViolet' in extras === false`), `brandGradient` composed only of the two ambers; ran in isolation — 10/10 pass |
| 3 | test | Fonts self-hosted | `fonts.spec.ts` | Read in full; MUTATION-GUARDED external-host + swap checkers (proven to fail on Google-Fonts/evil-CDN fixtures), preload+crossorigin assertions, filesystem existence check for all woff2 + OFL.txt; ran in isolation — 9/9 pass |
| 4 | test | theme-color first-paint | `stage1-tokens.spec.ts` (§8-4 describe block) | byte-exact match `index.html` meta vs `palette.dark.background.default`; passes |
| 5 | test | P/L byte-identical | `stage1-tokens.spec.ts` (§8-5) | 4 literals pinned (`#2ecc71`/`#ff5c5c`/`#1e9e57`/`#d23b3b`); passes |
| 6 | test | Focus ring == brand | `stage1-tokens.spec.ts` (§8-6) | renders `ThemeProvider`+`CssBaseline`, asserts the injected CSS contains `outline:2pxsolid#F2A93B`; passes |
| 7 | test | Blog generator output token-compliant | `blog-tokens.spec.ts` | Read in full; imports real `palette` from `tokens.ts`, asserts emitted HTML contains ink/phosphor/panel/signal/amber/steel token values + `color-scheme: dark`; asserts `docs/blog` ≡ `public/blog` byte-identical; ran in isolation — 3/3 pass |
| 8 | test | Existing guards stay green, zero weakenings | (no new file — a negative claim) | Verified via `git diff main...redesign-stage-1 --stat -- '*.spec.ts' '*.spec.tsx'` restricted to non-new files: **zero existing spec files touched** (the only spec diffs are the 5 new files, 504 insertions / 0 in existing specs). Full suite green (523/523) confirms none broke either |
| 9 | test | Warning-always-has-icon | `warning-icon.spec.ts` | Read in full; MUTATION-GUARDED (`icon={false}` fixtures in both attribute orders proven to trip it); asserts ≥5 `severity="warning"` Alerts exist (non-vacuous) and none set `icon={false}`; ran in isolation — 3/3 pass |
| 10 | review | Contrast table | this report (§5 above) | recomputed independently, 19/19 pairings match |
| 11 | review | Per-surface render sanity, both schemes | `RENDER_PASS.md` | audited below |
| 12 | review | Amber dominance — spent not sprinkled | `RENDER_PASS.md` row 2 + code audit (§3.3 table above: amber confined to wordmark/CTAs/active-nav/flip/tier/coming-soon; links rebound to `info.main`=signal via a theme-level `MuiLink` default, matching the contract's own §1 self-critique #2 mitigation) | PASS |
| 13 | review | Blog before/after | `RENDER_PASS.md` row 7 + my own diff audit (100% template-explained, byte-identical output pairs) | PASS |
| 14 | review | Warning-site glyph walk | `RENDER_PASS.md` (offline-degrade row shows `⚠`/`⏸` glyphs in new colors); not walked exhaustively site-by-site by me — partially relying on conductor evidence + the structural `warning-icon.spec.ts` guard for the Alert half | PASS (structural half machine-verified; visual half conductor-evidenced) |
| 15 | review | Type render | `RENDER_PASS.md` row 1 ("IBM Plex Sans body + Plex Mono data (computed)") | PASS (conductor-evidenced; UNVERIFIABLE independently — no browser tool this session) |

All 15 rows traced; the 5 new spec files ran cleanly in isolation (30/30 tests) confirming they're
non-vacuous and their mutation guards genuinely bite, not just "green because empty."

## §10 open-questions rulings — honored?

| # | Ruling | Honored |
|---|---|---|
| 1 | Archivo width via real `font-stretch` (variable `wdth`), never faux scaleX | Y — `styles.css` uses `@fontsource`-style variable face with `font-stretch: 62% 125%`, `format('woff2-variations')`; `theme.ts`/`tokens.ts` use `fontStretch: '112.5%'`, no `transform: scaleX` found anywhere in the diff |
| 2 | Blog fonts same-origin `/fonts/…`, CDN-fallback-only-if-brittle, never silent | Y — blog template uses the same `/fonts/...` paths as the app, self-hosted, no fallback-to-CDN needed (worked) |
| 3 | `text.disabled` dark = derived steel@50% | Y — `rgba(138, 155, 180, 0.5)` present in both `tokens.ts` and pinned in `stage1-tokens.spec.ts` |
| 4 | Light-mode DERIVED values recorded with derivation + measurement | Y — all documented in `tokens.ts` comments with ratios; matches my independent recompute |
| 5 | `#C9821A` at-risk value — measured, bounced if failing, never silent | Y — see §5 analysis above; bounce recorded in 3 places |
| 6 | TintChip `warning` tone on conviction chips — flagged not decided | Y — no `TintChip` file touched in this diff (confirmed by file list); Stage 3 deferral untouched |
| 7 | GEX spot→steel/live→signal split — FE's call, render-pass judged | Y — `chart.tsx` diff matches; `RENDER_PASS.md` row 3 confirms live render |
| 8 | Dark `shadows[]` interpolation — implementation latitude, render-pass judged | Y — `theme.ts` derives `darkShadows` (1→e1, 2-7→e2, 8+→e4); `RENDER_PASS.md` doesn't explicitly call out menu/popover separation, but no failure reported either — **UNVERIFIABLE independently** (no browser this session; not explicitly walked in RENDER_PASS.md's table, though the identity/render rows imply general render health) |
| 9 | `sync-figma-tokens.mjs` — OVERRIDDEN to DELETE, not deprecate | Y — confirmed **gone** from the branch tree (`git diff --stat` shows `scripts/sync-figma-tokens.mjs | 121 --------------`, a pure deletion, and the file is absent from the working tree) |

## Diff confinement audit (`git diff main...redesign-stage-1`)

Full file list (32 files) audited against the permitted set: `apps/api`/`libs/api` empty (isolation
proof); every remaining file is in {theme layer (`tokens.ts`,`theme.ts`), the closed §3.3 list
(`chart.tsx`,`ValueCard.tsx`,`OpportunityTier.tsx`,`ComingSoonCard.tsx`,`Scanner.tsx`,
`LiveTabPanel.tsx`), `index.html`, fonts (`styles.css` + `public/fonts/**`), the blog generator +
both regenerated output pairs, the 5 new `shared/theme/*.spec.ts` files, and the deleted
`scripts/sync-figma-tokens.mjs`}. **No file outside this set appears in the diff.** No copy/string
literal changes found in any touched component (grepped all `+` lines in the 5 rebind-list
component files for string literals outside color/sx context — only one hit, a doc comment).

## Invariants

- **`[theme-token-discipline]`** — PASS. `hex-discipline.spec.ts` untouched and green (part of
  523/523); `banned-hexes.spec.ts` extends coverage into `shared/theme` itself; zero hardcoded hex
  found outside `shared/theme` + the two test-pinned literals (index.html meta, blog template).
- **`[additive-keeps-score-byte-identical]`** — PASS. `apps/api` diff empty; nothing in this branch
  can touch score/tier/fingerprint by construction (FE-only, no signals/engine files touched).
- **Semantic P/L green/red reserved** — PASS. `#2ecc71`/`#ff5c5c`/`#1e9e57`/`#d23b3b` byte-identical
  pre/post (pinned test + my read of the `tokens.ts` diff, both `success`/`error` slots literally
  marked "UNCHANGED").
- **`[live-vs-static-isolation]`** — PASS (structural). No file touched under the live/SSE/degraded
  wiring path; §3.2's enumerated degraded-state tints re-derive through the same tokens with no
  logic change (confirmed no `TickerHeader.tsx`/`AiRecPanel.tsx`/degraded-state files appear in the
  diff at all — the tints are inherited by construction, not edited).
- **Vertical-GEX-chart lock** — PASS. `chart.tsx` diff is a 3-line stroke/label-color swap only; no
  `ReferenceLine` orientation, axis, or `GexStrikeProfile.tsx` geometry code touched.
- **`[loss-free-durable-migration]`** not exercised — PASS. No `features/auth/`, `localPrefs`,
  `durable/`, or any `convexa.*`-key file appears anywhere in the diff (`git diff --stat` grepped,
  zero hits).
- **Convexa-design banned-tells structurally unreachable** — PASS. `banned-hexes.spec.ts` is the
  structural enforcement, mutation-guarded, scanning app+index.html+blog output; independently
  confirmed the 9-hex list is complete against the skill's banned-tells prose list.

## RENDER_PASS.md audit (conductor evidence — not re-shot; I have no browser tool this session)

All 8 rows read and cross-checked against the code/token diff for internal consistency: computed
colors cited (ink/phosphor/amber/steel/signal) match the `tokens.ts` values exactly; the "bounced
`#C57F19`, live" light-CTA observation matches my independent recompute; the GEX chart reference
line colors match the `chart.tsx` diff exactly (flip=amber, spot=steel, live=signal, 33 bars,
vertical intact — confirms the lock held). The blog-artwork residual (row 8: SVG illustrations
still cream/terracotta) is corroborated by my own hex-grep of `building-a-team-of-ai-roles.html`
(dozens of non-banned cream/terracotta hexes present, none of which are on the 9-hex ban list —
consistent with "artwork, not template" and explains why `banned-hexes.spec.ts` correctly does not
fail on it). This was **flagged, not hidden** — visible in `RENDER_PASS.md`'s own table with an
explicit "ACCEPTED RESIDUAL" ruling and a named follow-up description. Note: I could not find that
follow-up recorded as a line item in `BACKLOG.md` or `OPEN_THREADS.md` at time of this QA pass —
minor process gap (the flag exists in the render-pass artifact, just not yet promoted to the
backlog), **not a GATE Q failure** per the QA charge ("verify it was flagged not hidden, don't fail
it").

Rows I could not independently re-observe (no Playwright/browser tool available to me this
session): the 1440/393 both-scheme walk across all 7 routes, the offline-degrade kill-test, and the
type-render row (Archivo/Plex rendering, `font-display: swap` behavior). These are **UNVERIFIABLE
by me directly** — I relied on the conductor's `RENDER_PASS.md` as instructed by the QA brief
("cite; do not re-screenshot — you have no browser tools"), cross-checked for internal consistency
against the code diff (colors/values match what the code would actually produce), and found no
contradictions.

## Summary

- **PASS: 9/9 GATE Q battery items, all 6 §3.3 rebinds, 19/19 recomputed contrast pairings, 15/15
  §8 matrix rows traced (9 test rows machine-verified in isolation, 6 review rows conductor- or
  self-evidenced), 9/9 §10 rulings honored, all 6 named invariants.**
- **UNVERIFIABLE (not FAIL):** the live-browser portions of RENDER_PASS.md rows 1/5/6/7/8 (type
  render, offline-degrade walk, both-scheme/both-viewport sweep) — no browser tool this session;
  relied on conductor evidence per the QA brief's explicit instruction, cross-checked for internal
  consistency, no contradictions found. §10-8 (dark `shadows[]` menu/popover separation) similarly
  UNVERIFIABLE independently.
- **Minor note (not a FAIL):** the lint-warning count (29) includes 1 warning newly introduced in
  a new test file (`stage1-tokens.spec.ts:89`), not "pre-existing" as literally claimed — 28 of 29
  pre-exist on `main`. Zero lint *errors* either way; the GATE Q lint bar (§9-4, "green") is about
  errors, and it is clean.

## Overall GATE Q verdict: **PASS**

Every acceptance-bearing item in FRONTEND_EXECUTION_CONTRACT §3/§3.3/§4/§5/§8/§9/§10 was directly
observed (fresh test/build/lint/tsc runs, my own diff audit, my own independent WCAG contrast
recomputation) or is UNVERIFIABLE-by-me-this-session for a stated, non-blocking reason (no browser
tool) with conductor evidence cross-checked and no contradiction found. No invariant broken. No
scope creep in the diff. The one §9 override (`sync-figma-tokens.mjs` deletion) is honored exactly.
No amendments to bounce.
