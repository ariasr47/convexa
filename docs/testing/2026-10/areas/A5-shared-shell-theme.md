```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/shell/AppShell.footer.spec.tsx","A5-shared-shell-theme","11","A page ships without the standing 'read-only / not investment advice' disclaimer, or with two footers or mains.","","TRIM","structure","read :1-93; keep route loop :53-75 for /, /ticker/SPY, /scanner, /nope (disclaimer :72-73); remove AC-F3 nav case :77-92 and 6 more routes (one-footer-in-AppShell is structure; signed-out wall also at app.risk.spec.tsx:232-243)","none","9c57e082 2026-09-10"
"apps/dashboard/src/app/shell/AppShell.keyboard.spec.tsx","A5-shared-shell-theme","3","A keyboard user cannot skip the nav, or the Cmd-K palette shifts the first tab stop.","","TRIM","duplicate","read :1-103; remove case 2 :44-65 (its first-focusable assertion is repeated at :94 and :101); keep skip-target contract :19-42 and AC-27 :67-102","none","3d57a232 2026-08-09"
"apps/dashboard/src/app/shell/ConvexaMark.spec.tsx","A5-shared-shell-theme","4","The wordmark reads wrongly to a screen reader or uses a faux stretch.","","RETIRE","structure","read :1-70; accessible name, SVG attributes and a source-text scan for scaleX are markup/styling; a regression is visible on screen and costs no data or money","none","828a3916 2026-07-22"
"apps/dashboard/src/app/shell/TopNav.spec.tsx","A5-shared-shell-theme","12","A nav or drawer link to the operator /_ops route leaks onto the trader shell.","invariant:operator-vs-trader-path-separation","RETIRE","duplicate","read :1-128; /_ops absence :53-66 is covered by app.risk.spec.tsx:171-174 and :218 (every shell route walked); the rest is link presence, aria-current, burger/icon markup and an onOpenPalette mock = structure","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shell/shell-live-lifecycle.flow.spec.tsx","A5-shared-shell-theme","2","Leaving the ticker leaves its live feed open or a revisit double-subscribes, so a user sees stale or doubled live data and the browser leaks streams.","smoke","KEEP","","read :1-240; real App tree, network-only mocks; counts EventSource constructions across land->ticker->positions->ticker->scanner (:175-216) and symbol change (:218-239)","none","e8f8c062 2026-06-24"
"apps/dashboard/src/app/shared/a11y/modalFocusHandoff.spec.tsx","A5-shared-shell-theme","8","Keyboard and screen-reader users lose focus when a dialog or menu opens or closes (focus left inside an aria-hidden background).","repro","TRIM","structure","read :1-298; keep mutation guard :168-184, dialog/autoFocus/menu behaviour :190-260 and wiring scans :266-290; remove idempotent-install case :292-297 (private helper)","none","64fa428c 2026-08-05"
"apps/dashboard/src/app/shared/copy/disclaimer.spec.tsx","A5-shared-shell-theme","5","The standing disclaimer drifts to claim 'no brokerage connection' (now false) or loses 'read-only / never places an order / not advice'.","invariant:no-real-order-path","TRIM","structure","read :1-58; keep :25-34 (text claims) and :41-44 (rendered == plain text); remove :36-39 (strong emphasis) and :46-57 (footer renders the source; dup AppShell.footer.spec.tsx:72-73)","none","5fd1853f 2026-08-04"
"apps/dashboard/src/app/shared/figure/figureState.spec.ts","A5-shared-shell-theme","17","A figure renders as live, retained or traced when it is offline, unknown or model-asserted, or an absent value looks like a number.","invariant:absent-is-not-none","TRIM","structure","read :1-217; keep F1-F9 table :28-152 and caption precedence :154-188; remove brand case :190-196 (dup liveClaim.typeproof.spec.ts:15-28) and 3 face-binding cases :198-216 (token identity / style)","none","2cace383 2026-09-07"
"apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.tsx","A5-shared-shell-theme","7","A live price flash fires on stale or offline data or under reduced motion, or never clears.","invariant:single-motion-moment","KEEP","","read :1-169; behavioural gating (inactive, reduced motion, mid-flash gate flip, clear after duration) under fake timers; the second half of the motion-mechanism enforcement","none","6c2ccdd1 2026-07-26 superpowers-plan"
"apps/dashboard/src/app/shared/hooks/usePollingResource.spec.tsx","A5-shared-shell-theme","7","A late response for the previous ticker overwrites the new ticker's data, or polling keeps hammering after a fatal market-data-paused fault.","guard","TRIM","structure","read :1-174 and usePollingResource.ts:1-155; keep key-change abort :33-60, hidden tab :62-84, keepOnError :86-102, haltOn :104-155, null key :157-173; remove fetch-on-mount happy path :22-31","none","85d4af23 2026-08-10"
"apps/dashboard/src/app/shared/hooks/useReducedMotion.spec.tsx","A5-shared-shell-theme","2","Motion plays for a user who asked for reduced motion.","invariant:single-motion-moment","KEEP","","read :1-26; the shared hook every motion gate consumes (matchMedia absent -> false, reduce matches -> true)","none","43bcbe57 2026-07-14"
"apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts","A5-shared-shell-theme","13","A desk figure shows a live dot or pulse while the stream is dropped, market closed, tape replay or offline; a second liveness expression creeps into a desk file.","invariant:live-vs-static-isolation","KEEP","","read :1-153; every branch of isDeliveringLive/andPresent :22-61 plus mutation-guarded fenced source scan with live exemption check :126-152","none","6d7116e1 2026-09-05"
"apps/dashboard/src/app/shared/liveness/liveClaim.typeproof.spec.ts","A5-shared-shell-theme","1","A hand-written boolean is accepted as a liveness claim after the brand is removed, with no runtime test failing.","invariant:structural-over-prose-enforcement","KEEP","","read :1-29; @ts-expect-error pair that only goes red under npm run typecheck (TS2578); zero runtime cost","none","6d7116e1 2026-09-05"
"apps/dashboard/src/app/shared/theme/banned-hexes.spec.ts","A5-shared-shell-theme","5","A retired brand colour re-enters the app, index.html or the blog output.","","RETIRE","structure","read :1-98; brand-palette taboo list = styling, cosmetic and visible in any screenshot; zero hex in components is already enforced by hex-discipline.spec.ts:241-266","none","7c9e3fb0 2026-07-22"
"apps/dashboard/src/app/shared/theme/banned-literals.spec.ts","A5-shared-shell-theme","4","A component pastes a token colour value instead of binding the theme token, breaking the other colour scheme.","invariant:theme-token-discipline","RETIRE","duplicate","read :1-119; subset of hex-discipline.spec.ts:208-266 (hex + rgb(a) scan, per-value exemptions, liveness) and token-parity.spec.ts:53-61 (distinct light values); its stated gap (rgba) was closed in hex-discipline","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/blog-tokens.spec.ts","A5-shared-shell-theme","4","A hand-edited blog page drifts from the generator output and token colours.","","RETIRE","risk-gone","read :1-116; tests the docs/blog build_html.py output and a docs-vs-public byte sync for one static post; no data, money or security at stake","none","7c9e3fb0 2026-07-22"
"apps/dashboard/src/app/shared/theme/brand-assets.spec.ts","A5-shared-shell-theme","9","Favicon or touch-icon files are missing, wrongly sized or carry a gradient.","","RETIRE","structure","read :1-131; file existence, PNG/ICO header sizes, favicon hexes and a gradient source scan = assets/pixels; visible in the browser tab","none","828a3916 2026-07-22"
"apps/dashboard/src/app/shared/theme/focus-visible.spec.tsx","A5-shared-shell-theme","6","Keyboard users get no visible focus ring (global ring dropped, or a component sets outline none with no replacement).","guard","TRIM","structure","read :1-124; keep global ring both modes :44-75 and outline-none scan with mutation guard :101-117; remove Widget accounted-case source-text check :119-123","none","357b07d6 2026-07-22"
"apps/dashboard/src/app/shared/theme/font-glyph-coverage.spec.ts","A5-shared-shell-theme","7","A bundled font subset loses a glyph so the host system font renders it and visual baselines shift.","","RETIRE","structure","read :1-314; hand-rolled WOFF2/cmap decoder asserting glyph presence and file existence; cosmetic, covered by the visual-baseline gate","none","ad858c83 2026-09-09"
"apps/dashboard/src/app/shared/theme/fonts.spec.ts","A5-shared-shell-theme","14","A figure literal such as 'not recorded' or a dash renders in the Mono figure register, or a component binds a font face itself, blurring unknown vs a number.","invariant:absent-is-not-none","TRIM","structure","read :1-327; keep N-1 describe :269-326 (5 cases, own mutation guards); remove 9 cases :76-167 (external font hosts, font-display swap, preloads, woff2/OFL existence, retired face literals)","none","7c9e3fb0 2026-07-22"
"apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts","A5-shared-shell-theme","4","A hardcoded colour renders right in one scheme and silently breaks the other (light mode unreadable).","invariant:theme-token-discipline","KEEP","","read :1-297; glob scan of pages/features/shell/shared-ui/charts for hex and rgb(a) with per-value exemptions and liveness checks :231-296; the strongest enforcement of the invariant","none","05702e92 2026-07-16 superpowers-plan"
"apps/dashboard/src/app/shared/theme/radius-scale.spec.ts","A5-shared-shell-theme","8","Panel, dialog or control corner radii drift from the declared scale.","","RETIRE","structure","read :1-138; radius values and a borderRadius regex scan = styling, visible immediately","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/scales.spec.ts","A5-shared-shell-theme","5","z-index rungs or breakpoint values shift and layering or responsive layout changes.","","RETIRE","structure","read :1-58; z-index values, breakpoint values and a breakpoints.only/not source scan = layout, visible and covered by the e2e no-overflow checks","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts","A5-shared-shell-theme","12","A new animation family or an ungated live pulse ships, so decorative or fake-live motion appears on a stale or dropped stream.","invariant:single-motion-moment","KEEP","","read :1-291; keyframe inventory set-equality :135-146, dynamic/emotion homes :148-154, class predicate with real-source mutation proofs :171-290","none","3464a0a8 2026-07-22 superpowers-plan"
"apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts","A5-shared-shell-theme","4","Off-ladder spacing multipliers creep into components.","","RETIRE","structure","read :1-125; 4-pt rhythm fence with a 25-file exemption list and burn-down bookkeeping = styling","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/stage1-tokens.spec.ts","A5-shared-shell-theme","11","A palette sweep changes brand or P/L direction colours, or removed tokens return.","","RETIRE","structure","read :1-129; byte-pins of palette hexes, removed keys, font names and theme-color meta; ring colour dup of focus-visible.spec.tsx:44-75; contrast is in the contrast specs; mirror drift is design/src/verify-tokens.mjs","none","7c9e3fb0 2026-07-22"
"apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts","A5-shared-shell-theme","17","Amber text or the focus ring falls below WCAG contrast in a scheme, or a text-amber consumer dark-locks its colour via bare extras.","invariant:theme-token-discipline","TRIM","structure","read :1-363; keep contrast §8-7 :85-109, ring contrast §8B-2 :111-137 and extrasFor consumption §8-8 :341-362 (8 cases); remove brandGradient disposition :139-205 (5) and amber census :281-322 (4)","none","a3a8fbaf 2026-07-22 superpowers-plan"
"apps/dashboard/src/app/shared/theme/steel2-contrast.spec.ts","A5-shared-shell-theme","6","Tertiary text drops below WCAG AA contrast in dark or light mode.","guard","CONSOLIDATE","duplicate","read :1-150; merge into one table-driven token-contrast spec with text-dim, text-info and stage3-amber §8-7 (one copy of the WCAG helper instead of four); drop :119-124 (asserts a known gap); keep raised2 liveness :126-149","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/text-dim-contrast.spec.ts","A5-shared-shell-theme","4","Dimmed (offline) text drops below WCAG AA contrast in dark or light mode.","guard","CONSOLIDATE","duplicate","read :1-81; fold into the token-contrast table; drop :64-69 (design intent, not a floor) and :78-80 (dup token-parity.spec.ts:53-61)","none","b7425507 2026-09-09"
"apps/dashboard/src/app/shared/theme/text-info-contrast.spec.ts","A5-shared-shell-theme","6","Info-toned live labels drop below WCAG AA contrast on their tinted chip fills.","guard","CONSOLIDATE","duplicate","read :1-116; fold into the token-contrast table; drop :84-97 (documents that raw info fails; premise, not a floor) and :113-115 (dup token-parity.spec.ts:53-61)","none","b7425507 2026-09-09"
"apps/dashboard/src/app/shared/theme/token-parity.spec.ts","A5-shared-shell-theme","5","A light-mode token silently falls back to its dark value.","invariant:theme-token-discipline","TRIM","duplicate","read :1-70; keep (b) palette key-set :48-51 and (c) distinct values :53-61; remove (a) :37-39 (extrasLight is typed Record<keyof extras> at tokens.ts:204, tsc enforces), (a2) :41-46, (c2) :63-69 (exemption map is empty)","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/theme/warning-icon.spec.ts","A5-shared-shell-theme","3","A warning is conveyed by colour alone because a warning Alert suppresses its icon.","guard","KEEP","","read :1-72; mutation-guarded source scan :41-71 (attributes in either order, multiline); accessibility rule, 0.005 s","none","7c9e3fb0 2026-07-22"
"apps/dashboard/src/app/shared/ui/ArcDivider.spec.tsx","A5-shared-shell-theme","3","The decorative arc seam loses its separator role or reserved height.","","RETIRE","structure","read :1-74; role/aria attributes, injected-CSS height and sx pass-through = markup and styling","none","828a3916 2026-07-22"
"apps/dashboard/src/app/shared/ui/ErrorBoundary.spec.tsx","A5-shared-shell-theme","3","One widget or route exception white-screens the desk with no retry.","","KEEP","","read :1-55; catch + retry for route and widget variants; used at app.tsx:102,143,152 and TickerDashboard.tsx:925-1015; variants could be one it.each","none","4821e67f 2026-08-10"
"apps/dashboard/src/app/shared/ui/Refused.spec.tsx","A5-shared-shell-theme","1","The signed-out refused affordance omits its reason or sign-in button.","","RETIRE","structure","read :1-25; asserts label/reason markup and an onSignIn mock receiving the click = structure; the write gate is enforced server-side","none","4821e67f 2026-08-10"
"apps/dashboard/src/app/shared/ui/arc.spec.ts","A5-shared-shell-theme","9","A fourth importer of the decorative arc motif appears, or arc geometry changes.","","RETIRE","structure","read :1-112; quadratic-arc geometry and a 3-importer set-equality pin of a design motif (arc budget of three); no data, money or security","none","828a3916 2026-07-22 superpowers-plan"
"apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx","A5-shared-shell-theme","3","A coming-soon placeholder gains a link or button of its own, opening a path toward a not-yet-built real surface.","invariant:no-real-order-path","KEEP","","read :1-82; structural inertness of ComingSoonBox/ComingSoonCard on every surface that composes them","none","43bcbe57 2026-07-14"
"apps/dashboard/src/app/shell/CommandPalette/CommandPalette.spec.tsx","A5-shared-shell-theme","14","The palette states 'no tracked symbol matches' while the scan read is still loading or has failed, hiding that the data is unknown.","invariant:absent-is-not-none","TRIM","structure","read :1-238; keep :104-115, :170-180, :193-209 (4 cases); remove 10 render-state cases (building dash/freshness dup format.spec.ts:73-77,:91-99)","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shell/CommandPalette/format.spec.ts","A5-shared-shell-theme","14","The palette shows a fabricated score or an invented freshness age for a building or errored scan row, or mis-ranks symbol matches.","invariant:absent-is-not-none","CONSOLIDATE","duplicate","read :1-139 and format.ts:1-80; matchSymbols x5 :26-52 -> 1 table; isPlausibleTicker x2 :56-67 -> 1; as_of:0 sentinel x2 :106-132 -> 1 parameterised on now; keep ok/stale/building/error/unknown-status","none","404f8144 2026-09-04 superpowers-plan(basename only)"
"apps/dashboard/src/app/shell/CommandPalette/palette.flow.spec.tsx","A5-shared-shell-theme","5","Cmd-K cannot reach Scanner, Ticker, Positions or Alerts by keyboard, the headline navigation path.","smoke","TRIM","duplicate","read :1-281; keep AC-24 walk :180-209 (fold Positions :211-222 into it); remove AC-25 :225-241 (dup modalFocusHandoff.spec.tsx:204-207,:231-232), AC-26 :243-267, AC-28 :269-281 (dup app.risk.spec.tsx:232-243)","none","404f8144 2026-09-04"
"apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.spec.tsx","A5-shared-shell-theme","3","The structure field paints a hardcoded colour that ignores the active scheme, or the hover readout shows the wrong strike or net GEX.","invariant:theme-token-discipline","TRIM","structure","read :1-199; keep hover probe :44-102 and paints-only-from-props :110-160; remove accessible-name/summary case :168-198 (markup)","none","a5a6955a 2026-08-15"
"apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.spec.ts","A5-shared-shell-theme","11","Wall, flip or mid level colours resolve wrongly or are not scheme-aware.","","RETIRE","structure","read :1-124; token-key table shape, resolver mapping, withAlpha unit and a canvas hex scan :106-123 (dup hex-discipline.spec.ts:27 charts glob); props-driven colours covered by StructureFieldCanvas.spec.tsx:110-160","none","84651e8d 2026-09-05"
"apps/dashboard/src/app/shared/charts/structure-field/markerLayout.spec.ts","A5-shared-shell-theme","8","Chart marker labels overlap or clip, and a buffer key changes with the live tape.","","RETIRE","structure","read :1-162; label-box geometry and a perf-cache key check = layout/pixels; the wall values remain readable in the ladder text","none","a5a6955a 2026-08-15"
"apps/dashboard/src/app/shared/charts/structure-field/paintStep.spec.ts","A5-shared-shell-theme","7","After a stream drop the structure field keeps animating trail, drift and particles (fake liveness), or reduced-motion users still get sweep and particles.","invariant:live-vs-static-isolation","TRIM","structure","read :1-205; keep criterion-20 recording-context cases :91-157 and driftAmplitude :174-186; remove chooseStrikeStep axis-tick layout :160-172 (2 cases)","none","b5251aa1 2026-09-05"
"apps/dashboard/src/app/shared/lib/durable/migration.spec.ts","A5-shared-shell-theme","23","A user's open positions, closed P/L, decisions, personas or prefs vanish or are overwritten after the gammaflow->convexa key/version migration, with no server backup.","invariant:loss-free-durable-migration","KEEP","","read :1-537; 4-store x (promote, idempotent, corrupt) matrix :196-224, fidelity :229-354, v1/v2 chain and union :359-447, new-only and both-present :452-536","none","43bcbe57 2026-07-14"
"apps/dashboard/src/app/shared/lib/durable/resolveDurable.spec.ts","A5-shared-shell-theme","8","A migrate-on-read helper deletes, mutates or throws on a user's legacy blob.","invariant:loss-free-durable-migration","KEEP","","read :1-77 and resolveDurable.ts:1-61; new-wins, promote-forward, never-delete, idempotent, never-throw, byte-exact promote","none","43bcbe57 2026-07-14"
"apps/dashboard/src/app/shared/ui/Widget/Widget.spec.tsx","A5-shared-shell-theme","19","Widgets keep motion for users who asked for reduced motion.","invariant:single-motion-moment","TRIM","structure","read :1-375; keep reduced-motion case :128-152; remove 18 (selection, expand/peek, source-text variants, retired-token scans dup single-motion-moment.spec.ts:119-121,:135-146, hideHeader/titleBadge/titleWrap layout)","none","43bcbe57 2026-07-14"
```

## NOTES

**TRIM and CONSOLIDATE: exact cases (before -> after)**

- **AppShell.footer.spec.tsx (11 -> 4).** Remove the route cases `/blog`, `/methodology`, `/alerts`, `/settings`, `/lab` and `/positions`. Remove "AC-F3 — the top nav still carries only the four product links, no Blog and no Lab". Keep `/`, `/ticker/SPY`, `/scanner`, `/nope`.
- **AppShell.keyboard.spec.tsx (3 -> 2).** Remove "skip link is the first focusable element in the shell (before nav)".
- **modalFocusHandoff.spec.tsx (8 -> 7).** Remove "installation is idempotent — a second call does not double-wrap".
- **disclaimer.spec.tsx (5 -> 3).** Remove "keeps <strong>simulated</strong> emphasized in the rendered form". Remove "the FOOTER renders that one source (not its own copy of the words)".
- **figureState.spec.ts (17 -> 13).** Remove these four:
  - "accepts a minted claim; a raw `true` is a TYPE error, not a runtime one"
  - "resolves the two faces from `typographyTokens`, never from a literal"
  - "the mono face carries the tabular numerals; the untraced rule is the shipped dotted rule"
  - "THE LADDER DOES NOT TRAVEL (§2.1) — no face object carries a size"
- **usePollingResource.spec.tsx (7 -> 6).** Remove "fetches on mount and exposes data".
- **focus-visible.spec.tsx (6 -> 5).** Remove "the Widget frame stays the accounted case: outline none FOR MOUSE + its own &:focus-visible ring".
- **fonts.spec.ts (14 -> 5).** Remove these nine. Keep only the five N-1 cases.
  - "globs/raws are not vacuous"
  - "MUTATION GUARD: the external-host checker fails on a Google-Fonts fixture"
  - "MUTATION GUARD: the swap checker fails on a face without font-display: swap"
  - "index.html + styles.css + blog output carry ZERO external font hosts"
  - "every declared face carries font-display: swap (app css + blog template output)"
  - "the first-paint preloads exist with crossorigin (Plex Sans 400 + Plex Mono 400)"
  - "the shipped assets + OFL license files exist beside each face"
  - "MUTATION GUARD: the face scan fails on an Inter literal"
  - "no component source names a retired face (components bind typographyTokens)"
- **stage3-amber.spec.ts (17 -> 8).** Remove these nine.
  - brandGradient disposition (5):
    - "MUTATION GUARD: the checkers flag real references and ignore comment mentions"
    - "zero brandGradient references anywhere (comment mentions stripped)"
    - "zero 135deg gradient-brand pairs under features/auth (the pill/avatar cannot regrow one)"
    - "the avatar disc renders flat primary.main + primary.contrastText (white-on-amber unreproducible)"
    - "the Sign-up pill is a flat contained-primary button (no gradient, no common.white label)"
  - amber census (4):
    - "MUTATION GUARD: the hover extractor finds nested blocks and flags amber inside them"
    - "(a) NO primary token inside any &:hover block of the census files (hover chrome is neutral)"
    - "(b) CommandDeck contains ZERO primary references — the washes are gone, the deck has no legitimate amber"
    - "(c) the MOVE→info sites bind `info`, not `primary` (link-class text is signal-blue)"
- **token-parity.spec.ts (5 -> 2).** Remove "(a) extras and extrasLight declare the identical key set". The type `Record<keyof typeof extras, string>` at tokens.ts:204 already makes tsc enforce it. Remove "(a2) every v2 extras name is present in both maps". Remove "(c2) every SAME_IN_BOTH_SCHEMES entry is LIVE — a listed name must still exist" (the map is empty, so it is vacuous).
- **CommandPalette.spec.tsx (14 -> 4).**
  - Remove these ten:
    - "no dialog in the DOM when open=false"
    - "skeleton rows are present…"
    - "once resolved, the loading form is absent…"
    - "renders every row once resolved"
    - "the footer helper row advertises exactly move/open/close (AC-33b)"
    - "filters to matching symbols and points aria-activedescendant at the first"
    - "a query that is NOT a plausible ticker shows the empty line with no 'open anyway'"
    - "renders no name-shaped text (only the ticker symbol itself)"
    - "every rendered row carries a freshness caption"
    - "a building row renders the bare dash, never a fabricated score"
  - Keep these four:
    - "a typed plausible symbol offers 'open anyway' even before the read resolves"
    - "shows the tracked-universe copy plus 'open anyway' for a plausible symbol"
    - "the ranked section shows an honest unavailable state; surfaces still navigate"
    - "a plausible symbol still offers 'open anyway' when the ranked read is unavailable"
- **palette.flow.spec.tsx (5 -> 1).** Remove "reaches Positions via the keyboard (signed in…)", but fold the Positions step into the first test. Remove "focus returns to the pre-open element; nothing behind the palette changed". Remove "clicking the backdrop closes the dialog and clears the typed query on next open". Remove "choosing Positions signed-out shows require-auth-wall…". Keep "opens on ⌘K from the ticker page and reaches Scanner, Ticker, Alerts via the keyboard only", extended with Positions.
- **StructureFieldCanvas.spec.tsx (3 -> 2).** Remove the `role="img"` / `aria-label` / `aria-describedby` summary case.
- **paintStep.spec.ts (7 -> 5).** Remove "picks the smallest round step (1/2.5/5/10/25) that keeps 8 or fewer ticks". Remove "never returns a step coarser than the largest rung even for a huge window".
- **Widget.spec.tsx (19 -> 1).** Keep "expand STILL opens; the VT morph is bypassed (motion inert, function preserved)". Remove the other 18:
  - selection (2)
  - expand/peek (2)
  - body variants (1)
  - motion negative space (3)
  - hideHeader (4)
  - titleBadge (4)
  - titleWrap (2)
  - If you want one UX smoke here, the FALLBACK expand case is the one to restore.
- **format.spec.ts (14 -> 8), CONSOLIDATE.**
  - matchSymbols: 5 cases -> 1 table.
  - isPlausibleTicker: 2 cases -> 1.
  - The `as_of: 0` sentinel pair (:106-132) -> 1 case parameterised over `now` (2000 and real).
  - Keep the ok, stale, building, error and unknown-status cases untouched.
- **steel2-contrast, text-dim-contrast, text-info-contrast and stage3-amber §8-7/§8B-2: CONSOLIDATE into one `token-contrast.spec.ts`.**
  - Today the same WCAG helper is copied four times: stage3-amber.spec.ts:46-74, steel2-contrast.spec.ts:41-85, text-dim-contrast.spec.ts:19-48, text-info-contrast.spec.ts:24-64.
  - Table rows are token x scheme x surfaces/fills x floor.
  - Drop steel2 :119-124, text-dim :64-69 and :78-80, and text-info :84-97 and :113-115. They assert documentation or duplicate token-parity.
  - Keep the raised2 liveness guard and the helper sanity check.
  - Before: steel2 6 + text-dim 4 + text-info 6 + stage3 contrast 6 = 22. After: about 12 rows.
  - The case count above is not final. Steel2, text-dim and text-info are credited only for the cases dropped, so the totals line understates the saving.

**UNSURE.** None. One owner question, not blocking: is the footer disclaimer a per-page legal requirement? If yes, restore all 10 routes in AppShell.footer.spec.tsx. That is about 0.4 s.

**NEW-BEHAVIOR-TEST (one proposed addition).**
- **Behaviour:** `theme-token-discipline` says bare `extras.` or `extrasLight.` is dark-only and must go through `extrasFor(theme)`. Today only 5 named files are checked (stage3-amber §8-8).
- **Proposed test:** no source under pages/features/shell/shared-ui/charts reads `extras.` or `extrasLight.` bare. A grep finds 0 current offenders, so it would go in green.
- **File:** `hex-discipline.spec.ts`, as one more scan reusing its existing glob and comment stripper.

**Not covered by this area.** `a11y-gate-scans-both-schemes-and-overlays` is enforced by `apps/dashboard-e2e/src/quality/accessibility.spec.ts` and `tools/a11y-policy.spec.mjs`, not by any file in this list. The contrast specs are token-level complements to that gate, not the gate itself.

**Duplicates inside this area.**
- theme-token-discipline:
  - Strongest: hex-discipline.spec.ts:231-296.
  - banned-literals.spec.ts is a subset of it. levelStrokes.spec.ts:106-123 repeats it for one file.
  - token-parity.spec.ts is kept for the parity half only.
- operator-vs-trader-path-separation: TopNav.spec.tsx:53-66 is covered by app.risk.spec.tsx:171-174 and :218.
- single-motion-moment:
  - Strongest: single-motion-moment.spec.ts:135-154.
  - Widget.spec.tsx:162-193 repeats part of it. useFlashOnChange, paintStep and useReducedMotion each cover a different half and are kept.

**Flaky or timing-based**
- usePollingResource.spec.tsx:63, :105, :140 use `vi.useFakeTimers({ shouldAdvanceTime: true })`, which mixes real and fake clocks. :157-173 asserts a negative after a single microtask flush.
- modalFocusHandoff.spec.tsx:205-207, :231-232 and :252-253 use default 1 s `waitFor` on MUI exit transitions. :77-109 monkeypatches `Element.prototype.setAttribute`, `removeAttribute` and `HTMLElement.prototype.focus` globally. It restores them in `finally`, but a hard abort could leak the patch.
- shell-live-lifecycle.flow.spec.tsx:216 and :239 carry 20 s timeouts.
- AppShell.keyboard.spec.tsx:99 uses `waitFor` after Escape.
- CommandPalette.spec.tsx:29 and :51 use `Date.now()`-relative fixtures, and format.spec.ts:124 uses the real clock. Both are deterministic as written.

**Slow kept tests**
- **shell-live-lifecycle.flow.spec.tsx, 4.18 s.** Cold import of the whole App graph, mounted twice. No safe cut without weakening the journey. Leave it.
- **palette.flow.spec.tsx, 5.25 s.** Drops to about 1.5-2 s after the TRIM, from 5 App mounts to 1.
- **Widget.spec.tsx, 1.49 s.** Drops to about 0.1 s after the TRIM.
- **modalFocusHandoff.spec.tsx, 1.02 s.** Real MUI transitions. Do not zero them, because the bug is the exit-fade ordering (:27-30).
- **CommandPalette.spec.tsx, 0.98 s.** Drops to about 0.3 s after the TRIM.
- **AppShell.footer.spec.tsx, 0.79 s.** Drops to about 0.3 s after the TRIM.

**Two further notes**
- About 14 specs each re-import the whole app source tree via `import.meta.glob(?raw)`. After the retirements, 6-8 remain.
- `design/src/verify-tokens.mjs` (DESIGN_SYSTEM.md:202) is not wired into CI. Retiring stage1-tokens, banned-hexes and brand-assets leaves token-value drift guarded only by that script plus the contrast and parity specs. I judged that cosmetic, not silent-and-costly.

**Totals:** KEEP 12 | RETIRE 16 | TRIM 15 | CONSOLIDATE 4 | UNSURE 0 | NEW-BEHAVIOR-TEST 0 (1 addition proposed above). Of 357 cases, 105 go with whole-file retirements, 73 go by TRIM and 11 by CONSOLIDATE, leaving 168.
