# S2 — skeptic findings: curvature-v2-landing-and-site

## Critical  (blocks — must loop back to R4)

- **Methodology's copy source contradicts itself between §1 and §4, and the contradiction lands on
  content §4 never actually quotes, so AC-C1 cannot be checked against it.** §1's in-scope bullet says
  the methodology page's ten sections are "beginning with the two data speeds; **four of them are new
  copy** (advisory reads · AI read and grounding · simulation · vocabulary)" — implying the other six
  keep the already-shipped `METHOD_COPY` strings. §4 instead says "Headings and paragraphs **verbatim
  from `methodology.mjs:29-57`**" (the design source) for the whole section, naming only "three
  additions and one correction" as deltas — none of which touch the six existing sections' prose. But
  the design source's wording for those six sections is **not** what is currently shipped: compare
  `design/src/screens/methodology.mjs:30-31` ("live **cells** dim and say offline... refreshes on a
  slower poll (about a minute on a ticker desk, about every three minutes across the scanner...)")
  against the shipped `apps/dashboard/src/app/pages/methodology/copy.ts:53-54` ("live **tiles** dim
  and say offline... refreshes on a slower poll (about every few minutes...)"); `methodology.mjs:35`
  "not from inventing direction on the **front end**" vs `copy.ts:21` "not from inventing direction on
  the **FE**"; `methodology.mjs:35` "**The desk** always labels that basis" vs `copy.ts:24` "**The
  ticker** always labels that basis"; `methodology.mjs:36` "Independent evidence **favours**" (British)
  vs `copy.ts:27` "Independent evidence **favors**" (American); `methodology.mjs:42` "**The desk**
  maps them through closed labels" vs `copy.ts:60` "**The frontend** maps them through closed labels";
  `methodology.mjs:55` "**the desk** shows a single-name caveat" vs `copy.ts:77` "**the ticker** shows
  a single-name caveat." The design source has also relocated the sim-P/L mark-ladder sentence out of
  "Where the read is weak" (`copy.ts:82-83`) into the new "Simulation" section
  (`methodology.mjs:53`) — a content move neither §1 nor §4 names. A build lane that follows §4's
  literal instruction ("verbatim from methodology.mjs") will silently rewrite six already-reviewed
  sentences on the site's trust page — some with claims that are less accurate here ("desk" names no
  component on this page; "ticker" and "frontend" do) — with no acceptance row that would catch the
  drift, since §4 never quotes the six bodies for AC-C1 to check byte-for-byte. A lane that instead
  follows §1's "four are new copy" will leave the six as-is and simply not read `methodology.mjs` for
  them — the opposite instruction. — evidence: SPEC.md §1 ("four of them are new copy") vs SPEC.md §4
  ("Headings and paragraphs verbatim from `methodology.mjs:29-57`"); `design/src/screens/methodology.mjs:29-57`;
  `apps/dashboard/src/app/pages/methodology/copy.ts:15-94`.

- **The outranking canon defines the sole permitted hero instrument as three-dimensional, and the SPEC
  bans exactly that rendering technology without ever amending the canon language that asserts it.**
  `DESIGN_SYSTEM.md:52-53`: "The landing has exactly **one hero instrument** — **the 3D dealer-gamma
  surface** (strike × tenor), the product's own model **drawn in depth**, not a decorative
  illustration," repeated at `:113`: "exactly one hero instrument: **the 3D dealer-gamma surface** on
  the landing." SPEC §2.3 instead makes it a hard build constraint that the instrument is "**No WebGL,
  no Canvas2D**, no `requestAnimationFrame`, no new runtime dependency" and ships a deterministic 2-D
  isometric SVG projection. SPEC's own "Design authority" clause states DESIGN_SYSTEM.md "outranks
  every other document cited here... by its own precedence clause" (§4). The BRIEF itself flagged this
  exact tension as an open item: "the hero instrument — `DESIGN_SYSTEM.md:52,113` declares it as 'the
  3D dealer-gamma surface (strike × tenor)'... and the app ships a 2-D `HeroCurve` — the council
  reconciles canon, canvas and code, and the owner rules if they disagree" (BRIEF.md, "Feasibility:").
  `council/decisions.md` §0 declares "open item (1) **dissolves** — canon, canvas and code agree," but
  the fact it cites in support ("the canvas landing leads with the dealer gamma surface... not the
  structure field") answers a **different** question (which section leads) than the one the BRIEF
  raised (3D rendering technology vs. the 2-D `HeroCurve` payoff-curve component, which is not even the
  gamma surface). SPEC's own "Design-canon amendments this feature owes" list (end of §4: the
  sample-provenance label, the `RequireAuth` degraded-branch copy, a rule-24 glossary clarification)
  does not include an amendment to the "3D... drawn in depth" sentence. No test, copy, or Amendments
  entry anywhere reconciles the canon's literal "3D" language against the shipped flat SVG. — evidence:
  `.spire/clusters/tech/context/DESIGN_SYSTEM.md:52-53,113`; SPEC.md §2.3 (no WebGL/Canvas2D) and §4
  "Design authority" + the amendments list; BRIEF.md "Feasibility:" paragraph, open item (1);
  `council/decisions.md` §0, row 2.

## Important  (should fix)

- **AC-L10's structural guard (§7 item 8) is negative-space only and does not bite on the `<title>`
  tag, which carries a *different* stale string than the one the guard scans for.**
  `apps/dashboard/index.html:9` is `<title>Convexa — AI dealer-gamma analytics for options
  traders</title>` — it does **not** contain "See the AI read on your real positioning" (that phrase
  only appears at `index.html:52,65`, the OG/Twitter tags, confirmed by direct read). SPEC §8 item 5
  names only "`index.html:52,65`" as carrying "the v1 hook," and §7 item 8's test is phrased as an
  absence check — "neither the title nor the OG/Twitter titles still carry the v1 hook" — rather than a
  positive assertion that `<title>` equals the new hero literal (`Convexa — See the dealer positioning
  behind the price.`). Because `<title>`'s current text was never the banned phrase, a lane could ship
  `<title>` completely unchanged and this guard would still pass — the "prose wearing a test's clothes"
  failure §7's own preamble warns against ("Every structural guard below must be proven non-vacuous —
  poison the thing it forbids and the build must go red"). Reverting only the OG/Twitter tags would not
  turn the `<title>` half of this guard red, because it was never green against that string to begin
  with. — evidence: `apps/dashboard/index.html:9,52,65`; SPEC.md §7 item 8, §8 item 5, AC-L10.

## Minor / advisory

- The "Arc budget (rule 2)" bullet (§4) states the landing spends the arc "twice — the hero draw and
  the footer `ArcDivider` — plus the wordmark X," but `HeroCurve.tsx`'s own header comment already
  documents itself, pre-feature, as "One of `shared/ui/arc.ts`'s exactly-three importers"
  (`HeroCurve.tsx:4-5`) — so the importer-count guard this feature must not break is unaffected by this
  feature (stays at three: `HeroCurve`, `Footer`, and the desk's `TrackRecordSection`). The SPEC's own
  wording risks being read as "the budget is two now," which is a different number from the guard's
  actual invariant; a one-line disambiguation between "visual arc spends on `/`" (what SPEC means) and
  "`arc.ts` import-site count" (unchanged) would remove the ambiguity before a build lane poison-tests
  the wrong number.

## Checked and clean

- **Check 1 (dropped conflicts).** Enumerated all 31 conflicts across `R2-architect.md` (9),
  `R2-pm.md` (9), `R2-ux.md` (13) against `council/conflicts.json`'s 31 `conflict_id`s and the 31
  `<!-- spire:council-resolution:v1 … folded -->` markers embedded in `SPEC.md`. Every id appears
  exactly once as a marker; `council/decisions.md` traces each to a self-revision, an R3-exchange
  convergence, or the D-A product call, with zero left only in an "ask." No conflict is missing from
  both the SPEC body and §9. Spot-verified content-level fidelity (not just id presence, given the
  task's note that ids were regenerated) for: the motion/canvas CSS-vs-props split (`804a6fc0`), the
  footer single-mount resolution (`939f095f`/`0d322f71`/`0b1ff840`), the AC-L1 six-section count
  (`7f26ee4c`/`ff779bdd`), the hero device-conditional-to-build-constraint conversion (`01d33a0b`), the
  nine-member vocabulary table (`d1a94c99`), the score-caps source-reading test (`5b3ba168`), and the
  waitlist deletion (`0dd564b1`/`96c5f81b`/`78ecd37d`) — all match their conflict's proposal text and
  the corresponding code (`StructureFieldCanvas.tsx:81-83`, `paintStep.ts:823-858`,
  `AppShell.tsx:96-109`, `signals.rs:482,487-489,24,541`, `shared/copy/notANumber.ts`).
- **Check 2 (unobservable ACs).** Read all 69 rows in §3. Besides the Critical/Important findings
  above, found no other row that requires reading implementation source beyond "a browser, the design
  source and the repo" — the SPEC's own observability bar, which explicitly permits repo reads, so
  AC-M2's engine-constant read and AC-G4's tense check are both in-bounds and not findings.
- **Check 3 (component states).** Verified the §4 state matrix covers default / loading / empty /
  error / offline-stale for all six required surfaces (landing, blog, methodology, 404, auth wall,
  footer) with no blank cell. Cross-checked the new "holding" and "degraded" wall states against the
  current `RequireAuth.tsx` (`:63` today returns `null` on `!ready`, confirming the exact gap the SPEC
  closes) and `AuthContext.tsx` (`subsystemDegraded: true` is reachable together with `ready: true,
  authenticated: false`, confirming the new branch's guard condition is satisfiable).
- **Check 4 (interface mismatch).** Compared `INTERFACE_CONTRACT.md`'s conformance block
  (`authenticated`, `google_available`, `user`, `settings`) against every field the wall's UI (§4/§5)
  and `AuthContext.tsx` actually consume (`ready`, `authenticated`, `subsystemDegraded`, `refresh`) —
  no field is claimed by the UI that the block doesn't cover, and the client-derived `subsystemDegraded`
  flag is correctly kept out of the server-schema block since it is not a response field.
- **Check 5 (internal contradiction).** Re-verified the six-vs-seven section count is stated once and
  consistently (§3 "One count, stated once"), resolved against both the PM's and UX's independent
  seven-counts. The eager-import-vs-lazy-boundary language in §2.4/§4/§7 is internally consistent
  (eager by default, lazy only behind the named 20 kB trigger, with the same fallback shape described
  in both places). The "two sample literals" claim (§4) matches an actual count of exactly two distinct
  `Illustrative sample — …` strings used on `/`. The waitlist-deleted-everywhere claim is consistent
  with the footer's present-tense disclaimer standing (different literal, different guardrail —
  `[no-real-order-path]` vs the AC-L3/AC-L3b split) — confirmed against the current
  `Landing.tsx:45-51,213-234,240-247` (the exact waitlist mechanism named for deletion) and
  `Footer.tsx:66` (`<DisclaimerCopy />`, the mechanism named to stay). Found the methodology-copy-source
  contradiction reported as Critical above.
- **Check 6 (guardrail breach).** Traced `apps/api` diff-0 (no citation in SPEC touches `apps/api`,
  only a disk read of `libs/quant-engine`), `[theme-token-discipline]` (no hardcoded hex claimed
  anywhere; spot-checked `HeroCurve.tsx` and `Footer.tsx`, both theme-token-only), the
  one-hero-instrument set-equality mechanism (`HeroCurve.tsx` is currently the *only* `viewBox` under
  `pages/landing/**`, confirmed by grep, so adding `GammaSurfaceHero.tsx` makes exactly two, matching
  the scan's target set), the no-live-claim-on-a-snapshot-surface guardrail (`paintStep.ts:823-858`
  confirmed `variant='ticker'` → `embedded=true, calm=true` suppresses both the `TAPE OFF` pill/`demo
  as-of` block and the phosphor-grain drift exactly as the SPEC claims), and canon rule 24's
  nine-member widening (`DESIGN_SYSTEM.md:258` confirms the 2026-09-03 change to nine, matching
  `shared/copy/notANumber.ts`'s already-shipped nine-member union, so the vocabulary table's import is
  well-founded). Found the 3D-canon-vs-2D-build breach reported as Critical above.
