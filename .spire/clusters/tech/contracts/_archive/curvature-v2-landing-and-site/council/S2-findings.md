# S2 — skeptic findings: curvature-v2-landing-and-site (pass 2 of 2)

**Pass-1 status:** the methodology copy-source Critical is **closed** (verified against the design
source and the shipped file below); the AC-L10 `<title>` Important is **closed**; the arc-wording Minor
is **closed**. The 3D-hero-instrument Critical is **NOT closed** — the repair strengthens one half of
the argument but does not survive counter-evidence inside the same design source it cites as authority,
detailed below. It is reopened as this pass's lead Critical.

## Critical (blocks — must loop back to R4)

- **The §2.3 "3D" reconciliation quotes its own strongest counter-evidence in §9 and never returns to
  refute it — the design source itself commits Three.js to the landing hero, in a foundations document,
  not a decorative caption.** §2.3's load-bearing sentence is: *"design/ contains no WebGL and no
  three.js implementation anywhere — the only three.js bytes in the whole design source are two prose
  lines (§9). So no reading of '3D' as a runtime renderer is available from the canon's own source."*
  That claim is false on its own terms. `design/src/screens/components-sheet.mjs:173` — inside
  `Components.dc.html`, captioned in its own file header "foundations, controls, data primitives,
  chrome, **motion spec**" — reads, verbatim, inside the same "Motion & liveness" section whose
  `motionRows` table supplies the "Hero curve-draw | landing only | … THE one orchestrated moment" row
  that DESIGN_SYSTEM.md's own Motion rule is drawn from (`:165`): *"The structure field stays Canvas2D
  on the desk (shipped, hover probe, reduced-motion aware). The WebGL2 twin already in `/lab` is the
  upgrade path for the heat field and particles — same model, same honesty captions. **Three.js earns
  its place only on the landing surface (below), not on the desk.**"* That is not the "false claim about
  our own work" §2.3 dismisses (that dismissal is reserved for `landing.mjs:56`'s caption, a *separate*
  line) — it is a GPU-path decision entry in the formal component/motion catalog, and it says the
  opposite of what §2.3 needs it to say: Three.js is *reserved for* the landing, specifically because the
  desk does not get it. Read together with `landing.mjs:56`'s adjacent hero-panel caption — `three.js
  surface · the desk's own model, drawn in depth`, sitting directly under the very `gammaSurface()` SVG
  §2.3 cites as proof the instrument was "always" an SVG projection — this is **two independent
  documents**, not one dismissible caption, both naming the landing hero as the Three.js surface. I
  grepped `context/design-session/rebaseline-2026-09-03.md` for `three.js`, `WebGL` and `3D`: **zero
  matches**. The owner's 2026-09-03 ruling that DESIGN_SYSTEM.md cites as its authority never touched
  the rendering-technology question at all — so this was never actually adjudicated, and the BRIEF's own
  framing ("the council reconciles canon, canvas and code, and **the owner rules if they disagree**")
  is exactly the case that applies: two artifacts inside the canon's own cited evidence base
  (`design/src/**`, named explicitly at `DESIGN_SYSTEM.md:243`) disagree with the SVG-projection reading,
  and no owner ruling exists to break the tie. §9's "Not here, and why" paragraph cites this precise
  `components-sheet.mjs:173` line — as item 1(c), among design-source lines "this change makes stale" —
  but frames it only as a documentation-hygiene question ("does this feature edit design artefacts
  outside its own six surfaces") and never asks whether the line falsifies §2.3's central claim that
  "no reading of 3D as a runtime renderer is available." It does. Pass-1's second Critical is therefore
  not genuinely closed: the repair added real, useful machinery (AC-L4a, the SVG build-constraint tests,
  the Amendments clarification text) on top of an evidentiary claim that a five-minute grep of the same
  source tree the repair itself cites disproves. — evidence: `design/src/screens/components-sheet.mjs:165-173`
  (also mirrored at `design/canvas/Components.dc.html:281` and `design/site/components-sheet.html:191`);
  `design/src/screens/landing.mjs:52-56`; SPEC.md §2.3 ("no reading of '3D' as a runtime renderer is
  available") and §9 item 1(c); `.spire/clusters/tech/context/DESIGN_SYSTEM.md:52-53,113,243`; zero
  matches for `three.js`/`WebGL`/`3D` in `context/design-session/rebaseline-2026-09-03.md`.

## Important (should fix)

- **§1's "Future" restoring condition and §2.6's rejected-approaches ruling name the same file as
  evidence for opposite purposes, and neither states which of the landing's two visual instruments a
  future "runtime-rendered 3-D hero" would actually render.** §1: *"a runtime-rendered 3-D hero
  (WebGL/three.js, a moving camera, depth resolved per frame …) — the capability already exists in the
  app as a lab instrument (`pages/lab/StructureFieldWebGL.tsx`, WebGL2), and it is barred from the
  landing by two settled rules … the page deny-list bans sibling-page imports."* §2.6, "Not buildable /
  rejected approaches": *"A WebGL or three.js hero, including reusing the lab's shipped WebGL2 twin
  (`pages/lab/StructureFieldWebGL.tsx`) — it is a sibling page the deny-list bans (§2.1), **it is a
  different instrument (the field, not the strike × tenor surface)**."* I read the file: its own
  docblock confirms §2.6's characterization — *"Structure Field — WebGL2 dual-clock instrument (lab
  comparison twin of Canvas2D)"* (`StructureFieldWebGL.tsx:1-2`) — it renders the structure field, not
  the gamma surface. So §1's feasibility citation for the deferred "runtime-rendered 3-D **hero**" points
  at a WebGL2 implementation of the *other* instrument (the one AC-L4a explicitly says is not the hero:
  "The payoff-curve silhouette is not it… the field is not it" per §2.2/§2.6's own set-equality logic).
  A future lane reading §1's restoring condition in isolation has no way to know whether "the capability
  already exists" means "reuse `StructureFieldWebGL.tsx` as-is" (wrong instrument, per §2.6's own
  ruling) or "build an equivalent WebGL treatment of `gammaSurface()`" (the actual hero, which has no
  WebGL twin anywhere in the codebase). This is exactly the kind of ambiguity the successor phase is
  supposed to inherit resolved, not rediscover. — evidence: SPEC.md §1 ("the capability already exists
  … `StructureFieldWebGL.tsx`") vs §2.6 ("a different instrument (the field, not the strike × tenor
  surface)"); `apps/dashboard/src/app/pages/lab/StructureFieldWebGL.tsx:1-9`.

- **Three of §4's four "Cut from the design source, with cause" hero-panel phrases have no named
  build-breaking mechanism in §7, breaching `[structural-over-prose-enforcement]` by the SPEC's own
  definition.** §4 lists four phrases cut from the ported hero panel: the `three.js surface …` caption,
  the `structure as-of 42s` chip + live dot, `rendered from the desk's own bundle`, and `7d → 90d
  tenors`. §7's tests cover the chip-and-dot pair (AC-L5's structural negative-space scan for live
  chips/dots) and the hero component's own runtime surface (item 3: no `getContext(`, no
  `requestAnimationFrame`, no `useEffect` inside `GammaSurfaceHero.tsx`), but nothing in §7 scans the
  *page text around* the hero for the other three literal phrases — `three.js surface`, `rendered from
  the desk's own bundle`, `7d → 90d tenors` — surviving into the shipped panel caption/legend. §8's own
  guardrail states: *"every 'must not' in this spec is paired with a named build-breaking mechanism in
  §7, and each must be proven to bite."* These three "must not"s are not. Given this pass's finding above
  — that the "three.js" phrase is not obviously a typo but may reflect genuine (if unadjudicated) design
  intent — leaving its absence to review only, rather than to a build-breaking check, is the weakest
  possible enforcement of the exact claim under dispute. — evidence: SPEC.md §4 "Cut from the design
  source, with cause" list; §7 items 1–3 (coverage gap); §8 `[structural-over-prose-enforcement]`.

## Minor / advisory

- **AC-C1a — the acceptance row invented specifically to close pass-1's methodology-drift Critical — is
  not on the ship-blocking list, while its sibling AC-C1 (the general copy-fidelity row it shares a
  mechanism with) is treated identically (also absent).** SPEC.md §3's ship-blocking list is: `AC-L1,
  AC-L3, AC-L4, AC-L4a, AC-L5, AC-L6, AC-L7, AC-L12, AC-M2, AC-M4, AC-N1, AC-A1, AC-A2a, AC-A4, AC-A9,
  AC-F1, AC-G1, AC-G3`. Neither AC-C1 nor AC-C1a appears. AC-C1a is `test` (automated, per its own row)
  so it likely runs in CI regardless of the tag, but the tag itself is what pass-1's finding turned on —
  "no acceptance row that would catch the drift" was the defect, and the repair's fix sits one list away
  from the rows the SPEC calls out as unwaivable. Worth a one-line addition if ship-blocking is meant to
  be exhaustive over "what a lane cannot quietly skip."

## Checked and clean

- **Check 1 (dropped conflicts), re-verified this pass.** Compared `council/conflicts.json`'s 31
  `conflict_id`s against the `spire:council-folding:v1` JSON block at `SPEC.md:1114-1116`: 31 resolution
  objects, one per conflict id, 1:1 by id, all `"disposition":"folded"`. Unchanged from pass 1 (the
  repair touched only prose sections named in the task brief, not the folding block or
  `conflicts.json`). No id present in one file and absent from the other.
- **Check 1, content-level (the two repaired Criticals specifically).** Read
  `design/src/screens/methodology.mjs:29-57` and `apps/dashboard/src/app/pages/methodology/copy.ts:1-100`
  side by side against every row of §4's "retired v1 fragment" table: `live tiles dim and say offline`
  (`copy.ts:53`) vs `live cells dim and say offline` (`methodology.mjs:31`); `the tile says unavailable`
  (`copy.ts:43-44`) vs `the cell says unavailable` (`:40`); `The ticker always labels`/`The frontend maps
  them`/`the ticker shows a single-name caveat` (`copy.ts:24,60,77`) vs `The desk always labels`/`The desk
  maps them`/`the desk shows a single-name caveat` (`:35,42,55`); `about every few minutes` (`copy.ts:51`)
  vs the three-clause cadence sentence (`:30`); `on the FE` (`copy.ts:21`) vs `on the front end` (`:34`);
  `favors` (`copy.ts:27`) vs `favours` (`:36`). Every quoted pair is byte-accurate in both directions, and
  the sim-P/L mark-ladder relocation (`copy.ts:82-83` → `methodology.mjs:53`, the new Simulation section)
  is confirmed: the sentence is present verbatim in "Simulation" and **absent** from "Where the read is
  weak" in the design source, so the rebuild-from-one-list mechanism (not a patch) structurally forecloses
  the sentence surviving in both places at once. §7 item 16's nine grep-safe negative forms
  (`live tiles`, `the tile says`, `on the FE`, `The ticker always labels`, `The frontend maps them`, `the
  ticker shows a single-name caveat`, `about every few minutes`, `evidence favors`, `capped sum of plain
  components`) are each a verified contiguous substring of the shipped `copy.ts` today. This Critical is
  closed.
- **Check 1, AC-L10.** Re-read `apps/dashboard/index.html:9,12,52,55,65,68` directly. §7 item 8 now
  asserts `<title>`, `og:title` and `twitter:title` each **equal** the new hero literal (positive) in
  addition to the negative absence checks for both v1 strings, and states explicitly why the old
  absence-only phrasing was vacuous on `<title>`. Closed.
- **Check 2 (unobservable ACs).** Read all 71 rows in §3 (up from 69: AC-L4a and AC-C1a are the two new
  rows, matching the task's stated row-count delta). No row beyond the findings above requires reading
  implementation source outside "a browser, the design source and the repo," the SPEC's own
  observability bar.
- **Check 3 (component states).** No change from pass 1's clean result — re-skimmed §4's state matrix,
  still no blank cell across the six required surfaces; the repair did not touch this table.
- **Check 4 (interface mismatch).** Re-read `INTERFACE_CONTRACT.md` in full: the conformance block
  (`authenticated`, `google_available`, `user`, `settings`) still matches every field the wall's UI and
  `AuthContext.tsx` consume; `subsystemDegraded` is still correctly kept client-side and out of the
  schema block. Untouched by the repair (task brief confirms `INTERFACE_CONTRACT.md` was not edited).
  Clean.
- **Check 5 (internal contradiction).** Traced the three contradictions the task named specifically:
  (i) §1's Future WebGL item vs §2.6's WebGL rejection — reported above as Important (an ambiguity about
  *which instrument*, not a flat contradiction: both sections agree the current-phase build stays SVG,
  they disagree on what a future build would resurrect). (ii) The two-pin copy rule (§4 opening) vs the
  byte-exact literals elsewhere — read every "verbatim from `<file>:<line>`" citation against
  `design/src/screens/{landing,methodology,blog}.mjs` (H1/sub/spine/footnote/primary/secondary, the
  register body, the three trust-card titles, the CTA-band heading, the blog eyebrow/heading/intro) and
  found every one matches the cited source bytes exactly, and every place a quoted string *deviates* from
  its cited line (the CTA band's dropped tracked-names count, the field bullet's four added words, the
  four methodology deltas) is explicitly named as a deviation per the stated rule. No violation of the
  rule found. (iii) AC-M2a's two-stage-clamp clause vs the R3 clause it supersedes — the superseded
  clause (`The components can total more than 100; the score is capped at 100.`) appears nowhere as
  shipping text; it is named once, explicitly as withdrawn, and the negative-space grep list at §7 item 16
  separately bans its sibling v1 phrase (`capped sum of plain components`, which is *also* still the
  wording at `methodology.mjs:42` in the unedited design source — itself one of the four deltas). No
  contradiction found in any of the three.
- **Check 6 (guardrail breach).** Re-traced `apps/api` diff-0, `[theme-token-discipline]`, and the
  one-hero-instrument set-equality mechanism — unchanged from pass 1's clean result. Found the new
  `[structural-over-prose-enforcement]` gap reported as Important above (the three unguarded "cut, with
  cause" hero phrases).

## Answering the task's specific questions

- **Is §9's "Not here, and why" paragraph a defensible fold or an owner call in disguise?** **The
  latter.** It asserts "they agree" as settled fact, but the agreement is manufactured by citing only
  `design/src/lib.mjs` and dismissing the two prose lines that disagree — one of which
  (`components-sheet.mjs:173`) is not a marketing caption but a foundations-document GPU-path spec entry,
  the same category of document the canon's Motion rule itself cites as authority. The BRIEF's own
  condition for owner arbitration — "the owner rules if [canon, canvas and code] disagree" — is met: two
  documents inside the canon's own cited evidence tree disagree with each other, and the owner's
  2026-09-03 ruling never touched the question (verified by grep of the rebaseline session record: zero
  hits for "three.js," "WebGL," or "3D"). The paragraph should not be folded into "Not here, and why";
  it belongs back in the numbered open-questions list, or the ship should carry an explicit
  owner sign-off line before build starts, exactly as its own final sentence half-concedes ("say so
  before the build lane starts, not after") — except that sentence puts the burden on the owner to notice
  and object, rather than on the SPEC to flag the ambiguity as live.
