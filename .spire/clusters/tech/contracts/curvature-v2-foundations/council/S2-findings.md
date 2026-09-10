# S2 — skeptic findings: curvature-v2-foundations

Method: `.claude/council/S2-skeptic.md` + skill `spire-tech-adversarial-spec-review`. All six checks run,
in the mandated order (dropped conflicts first). Every load-bearing source citation the task named was
re-read at source this session, not taken on report. No fixes proposed below — findings only.

## Critical (blocks — must loop back to R4)

None found. I went in expecting to find at least one — R3 is unusually well fact-checked (see "Checked
and clean" for what I independently re-verified at source) — and I held the bar at the skill's own
definition (dropped conflict / guardrail-text breach / an **unobservable SB-marked** AC) rather than
inflating an Important finding to Critical for effect. The findings below are real gaps; none of them
is on a ship-blocking (SB) row, and none contradicts written guardrail text — they are omissions and
weak-verification rows, which the skill's own rubric places at Important.

## Important (should fix)

- **The ⌘K palette has no specified state for the window between "dialog open" and "the one-shot scan
  read resolves."** §2.6: *"A **one-shot `getScan()` read on open**, cached for the dialog's lifetime."*
  P1–P6 (§4.4) name closed / empty-query / typing / no-results / keyboard-only / dismissed — none of
  them is "fetch pending." AC-29's own evidence column is *"Palette state test, one arm per status
  value"* — the four arms are the **wire's** `ok | stale | building | error`, all of which presuppose
  the fetch already resolved. AC-30 covers the fetch **failing**, not the fetch being **in flight**.
  Nothing names what tier/score render for the tracked-universe rows in that window, even though AC-29
  itself states the invariant that window must not violate: *"Never a blank where a score goes, never a
  `0`."* This isn't hypothetical latency: `getScan()` is a real network round-trip, and the shipped
  precedent for the identical call already treats it as a first-class state —
  `apps/dashboard/src/app/pages/scanner/useScan.ts:76-78`: *"`loading` ⇒ the FIRST read is still in
  flight ⇒ the skeleton. Never re-entered after the first resolution."* The palette reuses `getScan()`
  (§2.6, INTERFACE_CONTRACT.md) but never gives its own fetch a named state or an AC. Unlike AC-9 (see
  below), there is no other pre-existing test suite covering this brand-new component that would catch
  a bad render here incidentally.
  — evidence: SPEC.md §2.6, §4.4 (P1–P6), AC-29/AC-29b/AC-30 rows; `apps/dashboard/src/app/pages/scanner/useScan.ts:76-78`.

- **AC-10 repeats, undeclared, the exact defect shape Ruling 1 was written to fix for AC-9.** The
  conflict that produced Ruling 1 (`450285a7ae8203799b39710dfe7aa5bda0e654a9f282615b2f92c00863f05471`,
  ux) says in terms: *"an AC whose observable is 'nothing is on the page' passes identically when the
  resolver is correct, when it throws, and when the stream never opened."* The fix landed as a
  **positive** observable on AC-9: *"Cold-load test asserting the placeholder is **present** (a positive
  observable)…"* AC-10 is the same shape, unfixed: *"On a surface not fed by a stream — scanner,
  positions, settings, alerts, landing — no connection chip, live dot or pulse appears anywhere. | test |
  Per-surface negative-space test + importer set-equality on the resolver module."* There is no
  companion positive assertion that each of those five surfaces actually rendered its own content — a
  page that crashed or rendered blank on any one of them would pass AC-10 by construction. (In practice
  each of those five pages carries its own large pre-existing, unrelated test suite that would likely
  catch a genuinely blank page first — which is why I rank this Important rather than Critical — but
  that safety net is incidental to this AC, not built into it the way AC-9's rewrite requires.)
  — evidence: SPEC.md AC-9 vs AC-10 (§3.A); `council/conflicts.json` conflict `450285a7ae8203799b39710dfe7aa5bda0e654a9f282615b2f92c00863f05471`.

- **The conformance block's prose promises a pin the JSON doesn't contain.** INTERFACE_CONTRACT.md:
  *"`sweep.sweep_last_completed` plus `rows[].as_of` are the freshness facts the palette renders beside a
  score…"* and *"Pinning them costs nothing and turns three acceptance criteria (AC-1c, AC-29, **AC-29b**)
  from assumptions into checked ones."* The actual `required` block for `/api/scan` is:
  `{"rows": "array", "rows[].symbol": "string", "rows[].status": "string", "rows[].tier": "string|null",
  "rows[].score": "number|null", "rows[].as_of": "number", "sweep": "object|null", "view": "object"}` —
  `sweep` is pinned only as a bare `object|null`, with no nested `sweep.sweep_last_completed` key. The
  same JSON block proves the schema *can* express nested dotted paths — the `/api/ticker/{ticker}` entry
  does exactly that for `market_state.price`, `market_state.call_wall`, etc. — so this isn't a format
  limitation, it's a specific omission on the one field the prose singles out for AC-29b. As written,
  `interface_conformance.mjs` cannot catch a silent rename or removal of `sweep_last_completed`, which
  is precisely the silent-wire-change risk this whole block exists to close.
  — evidence: INTERFACE_CONTRACT.md "Field notes" + "Why a block at all" paragraphs, and the `/api/scan` `required` object in the same file.

- **AC-7's "can never return to the placeholder" clause has no test distinct from the six-kind
  enumeration.** AC-7 (SB): *"…yields one of exactly **six** `kind`s and never a seventh; **after the
  first stream fact the chip can never return to the placeholder**."* Its only named evidence:
  *"Exhaustive-input enumeration asserting the produced `kind` set equals the six; recorded mutation
  proof that a planted seventh `kind` fails to compile / red-builds."* That evidence verifies the
  six-kind claim; it says nothing about re-feeding a transient gap/undefined input **after** a fact has
  already landed and asserting the placeholder does not reappear. §2.4 states the property twice as
  load-bearing — *"The latch is **monotonic and structural** — the union makes re-entry into the
  placeholder after a payload **unrepresentable**, not merely unlikely. A re-derivation that could
  re-enter it is a defect, not a state"* — but "unrepresentable" is a claim about the `ConnectionState`
  union's six members; the actual re-entry risk lives in whatever wrapper decides *whether a
  `ConnectionState` exists yet at all* (a `hasLatched` boolean or equivalent), which sits outside that
  union and is exactly the kind of runtime logic a compile-time exhaustiveness check cannot see. No row
  in §3.A names a test that holds a latched chip, feeds it a subsequent gap, and asserts the placeholder
  does not return.
  — evidence: SPEC.md AC-7 (§3.A) and §2.4 "Pre-first-fact (ruling 1)" paragraph.

- **AC-26 justifies downgrading a testable interaction with a cross-reference that doesn't hold.** AC-26:
  *"Clicking the scrim closes the palette. | review | Reviewer note; **AC-25 already covers the
  dismissal mechanism**."* AC-25's own text and evidence are specifically about the **Escape** path:
  *"Escape closes the palette and returns focus to the element that held it before opening… | test |
  Focus-return assertion in the same flow test."* SPEC §2.6 is explicit that this palette is **not**
  built on a ready-made command-palette library — it is hand-assembled on MUI `Dialog` with a
  document-level `keydown` listener written for this feature (*"the shortcut listener, roving focus and
  `aria-activedescendant` are written here"*) — so Escape and backdrop-click are not guaranteed to share
  an implementation path merely because both are "dismissal." As written, AC-25's test provides no actual
  coverage of scrim-click, and AC-26 cites it as if it does.
  — evidence: SPEC.md AC-25, AC-26 (§3.C); §2.6 "Built on the MUI `Dialog`…" paragraph.

- **AC-41's verification mechanism cannot detect the specific failure its own text names.** AC-41 (SB):
  *"Each of the seven new token names resolves to a defined value in **both** schemes; **none falls back
  to its dark value in light mode**."* Verify by: *"Runtime key-set twin over `extras`/`extrasLight`
  plus a set-equality assertion over the two palette objects' key sets…"* A key-set twin
  (`Object.keys(extras).sort()` deep-equals `Object.keys(extrasLight).sort()`, per §2.1) proves only that
  both maps declare the same seven keys — it is structurally blind to `extrasLight.glass` being set to
  the **same** value as `extras.glass`, which is exactly the fallback the AC's own words forbid. Nothing
  else in the AC table (AC-42's contrast measurement is scoped to `steel2` only; AC-43 checks layout, not
  value distinctness) closes this gap.
  — evidence: SPEC.md AC-41 (§3.F) and §2.1 "Parity is compile-enforced but not test-enforced" paragraph.

## Minor / advisory

- **AC-21's claim is wider than its test.** *"No figure value is a heading element **on any screen**. |
  test | Page-outline test on **ticker and positions**."* The words cover all six screens; the named
  evidence covers two. This may be an existing pre-v2 invariant test whose scope was never widened
  rather than a new gap (the Banned table lists "Stat values as heading elements" as carried-forward,
  not `(v2)`), but as written inside this SPEC the claim and its evidence disagree.
  — evidence: SPEC.md AC-21 (§3.B).

- **`register` is `required, no default` even when `value` is a `NotANumber` member**, where AC-19
  requires the literal to render in Sans *"never in the mono figure register"* regardless of what
  `register` says. The SPEC doesn't state whether `register` is validated/ignored on that branch, which
  is a small ambiguity for whoever implements the prop contract.
  — evidence: SPEC.md §2.3 prop contract (`register` bullet) vs. AC-19 (§3.B).

- **Small wording tension on where the chip resolver "lives."** §2.4: *"The resolver moves **out of**
  `TickerHeader.tsx` into its own ticker-local module…"* R3-ux.md's mechanism note (which SPEC §2.4
  otherwise follows closely) calls the pinned importer set `{TickerHeader.tsx (definition),
  CommandDeck.tsx}` — the parenthetical reads as if `TickerHeader.tsx` still hosts the definition. Almost
  certainly resolves fine either way in the build (both files end up importing the new module), but the
  two documents don't say the same thing about which file defines it.
  — evidence: SPEC.md §2.4 "One resolver, one module…" paragraph vs. `council/R3-ux.md` §3 "What the spec should say."

## Checked and clean

1. **Dropped conflicts (highest-priority check).** Extracted all 32 `conflict_id` values from
   `council/conflicts.json` and every `spire:council-resolution:v1 <id> folded` marker plus the closing
   `spire:council-folding:v1` JSON in `SPEC.md`, and diffed the two sets directly rather than by eye —
   all 32 are present with `disposition: "folded"`; zero omissions, zero orphans. Beyond ID-presence, I
   read the actual resolution text against the SPEC body for the substantive ones and confirmed the
   *content* is reflected, not just stub-referenced: the 2-importer/16-site accent-bar count (§1, AC-13a,
   AC-22a/b), `FigureCell`'s narrowing to 16 sites plus the four-widget exemption list (§2.3, AC-22c),
   the replay chip's six-states-with-`standing` design (§2.4, §4.2, AC-6/7/8), the AC-1 three-scope split
   (AC-1a/1b/1c), the container-query AC-20 split with its UNVERIFIABLE flag (AC-20a/20b), the 44px-audit
   narrowing (AC-34/34b), the hover-only-ⓘ ruling (scope bullet, AC-35), the `NotANumber` nine-member
   caller-picks-the-member design (§2.3, AC-19), and the single-announcer aria-live design (§2.4, AC-12b).

2. **The six owner rulings in `decisions.md`** — checked each one's "What binds the build" bullets
   against SPEC line-by-line for both implementation and non-contradiction: Ruling 1 (pre-first-fact) →
   §2.4 + AC-9 (my one finding on this ruling is a *test-coverage gap* on AC-7's separate "never
   returns" clause, reported above, not a contradiction of the ruling itself). Ruling 2 (offline
   retention) → out-of-scope bullet, Future section, AC-17a/b/c, independently confirmed the cited
   `useFlashOnChange.ts:44` mechanism at source. Ruling 3 (nine-member vocabulary) → §2.3 + AC-19;
   independently confirmed the SPEC correctly treats the canon-file amendment as still owed (§9 item 3a
   says "to be filed at close"), consistent with `DESIGN_SYSTEM.md` rule 24 still listing six members
   with no matching Amendments-table row — the SPEC does not overclaim an amendment that hasn't landed.
   Ruling 4 (radius in / spacing fenced) → §2.2 + AC-45b/45c; independently verified `tokens.ts:83`
   (`shape.borderRadius: 10`) and the `createUnaryUnit` multiplier mechanism at
   `node_modules/@mui/system/borders/borders.js:41-49`. Ruling 5 (44px scoped) → AC-34/34b; independently
   verified the narrow selector list at `theme.ts:97-101`. Ruling 6 (six ⓘ sites fixed) → scope bullet,
   AC-35, AC-22c; independently verified all six cited line numbers in `IvRank.tsx` (`:91,:120,:229`),
   `MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77`, and the
   `AccessibleHelp.tsx` pattern shape. No ruling is narrowed, widened, or contradicted anywhere.

3. **Load-bearing codebase claims named in the task, spot-checked at source (not taken on report):** the
   2-importer/16-render-site count — exact (`LiveTape.tsx:35,138,146,154,163`;
   `DealerPositioning.tsx:25` + 12 JSX call sites at the cited lines). The three live-dot-eligible cells
   (Net flow, Spread, Gamma flip) and VWAP's exclusion — exact, confirmed against the actual gating
   expressions (`LiveTape.tsx:78,87,148,163-168`; VWAP passes no `offline` prop at all). `Widget.tsx:157`
   — exact, `containerType: 'inline-size'` with no `containerName` anywhere in the file.
   `type-floor.spec.tsx:39` — exact, the `.split()` reader structurally returns only the first rule
   bearing the class and cannot see a second (`@container`) block. `useFlashOnChange.ts:44` — exact,
   `prev.current = value` executes one line before the null guard at `:46`. The MUI
   `borderRadius: n` × `shape.borderRadius` multiplier — confirmed in
   `node_modules/@mui/system/borders/borders.js:41-49` (`createUnaryUnit(props.theme,
   'shape.borderRadius', 4, 'borderRadius')`) against `tokens.ts:83`'s current value of 10.
   `sessionTapeStanding.ts:46-54` — exact, the eight-member `ConsumeStanding` union with `s0` as the
   no-session-tape arm. No false citation found among these seven.

4. **The empty-diff invariant (`[additive-keeps-score-byte-identical]`).** Read `INTERFACE_CONTRACT.md`
   end-to-end plus SPEC §1/§6/§8: every consumed endpoint (`/api/ticker/{ticker}`, `/api/scan`,
   `/api/stream`) is described as unchanged, every field the FE reads is claimed to already ship, and
   AC-51's mechanism is a build-step diff check, not a self-assessment. Nothing in the SPEC body asks for
   a new backend field, endpoint, parameter, or behavior.

5. **Scope drift against the BRIEF's "no screen is re-laid-out."** Cross-checked every §2 touchpoint
   (tokens, the four scales, `FigureCell`, the chip, nav/palette, container queries) against
   "composition change" vs. "token/value/affordance change." The only touch inside an existing screen's
   markup beyond token rebinding is Ruling 6's six ⓘ swaps, which the SPEC itself flags in the same
   language as the ruling — *"a mechanical swap onto an existing component, not a re-layout… recorded as
   a deliberate exception so it is not read as precedent"* — and I found no other composition change
   anywhere in §2 or §4.

6. **Unspecified component states, general sweep.** F1–F9 (`FigureCell`, §4.1), the six chip states plus
   the pre-fact placeholder (§4.2), and N1–N8 (nav, §4.3) each carry a described row with no gap. The one
   missing-state defect found (the palette's fetch-pending window) is reported under Important, not here.

7. **Interface mismatch, beyond the one gap reported under Important.** Every other field the SPEC's §2/§4
   body cites — `market_state.vwap`, `.gamma_flip`, `.max_pain`, `.call_wall`, `.put_wall`, `.net_gex`,
   `.net_dex`, `signals.opportunity_score`, `signals.opportunity_tier`, `rows[].status/tier/score/as_of`,
   `view` — is present in the conformance JSON's `required` block; no field the UI in §4 consumes is left
   unpromised by the block.
