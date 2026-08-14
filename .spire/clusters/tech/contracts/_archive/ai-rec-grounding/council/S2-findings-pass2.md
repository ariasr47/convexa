# S2 — skeptic findings, pass 2: ai-rec-grounding

Verification pass only. Re-read `SPEC.md` (915 lines, was 730) and `INTERFACE_CONTRACT.md` (392 lines, was
303) in full against my own pass-1 findings, not re-reviewed from scratch. Checked: the Critical's new
guard against the `score-lab-signal-comparison` bar directly; each of the 8 Important findings against
the revised text (not the coordinator's summary); the 3 Minors; the 28 conflict-resolution markers and the
folding receipt (both counted, both intact — 28 inline `<!-- spire:council-resolution -->` tags, 28
`conflict_id` entries in the JSON receipt); and re-grepped both files for banned words.

## Overall verdict: **PASS** — no Critical remains.

---

## The Critical — AC-50 / guard 8 (resolution-boundary pin)

**CLOSED.** Attacked directly against the `score-lab-signal-comparison` bar (name without behaviour).

- **Does it bite on a rule that still exists but has been loosened?** Yes, and by a mechanism, not an
  assertion. The fixture set's edge values are pinned as *literal numbers* rather than derived from
  `GROUNDING_TOL_PCT` (SPEC.md:317-318: "The boundary points are written as literal numbers, never
  computed from `GROUNDING_TOL_PCT`. That is the whole of the anti-laundering property: a fixture that
  derives its own edges from the constant moves with the constant and proves nothing."). This is the
  correct fix for the specific gap I raised: a fixture with a *fixed* edge will fall on the wrong side of
  a shifted boundary the moment the boundary moves, regardless of *which* code path caused the shift —
  tolerance widened, cent floor deleted, or containment window opened. That means the mechanism generalizes
  beyond the four explicitly-named poison arms (see residual below).
- **Is the non-vacuity argument sound?** Two independent claims, both real: (a) literal-not-derived edges,
  checked above; (b) a self-asserted diversity check — "for each checked field the fixture set must
  contain at least one arm resolving `traced` **and** at least one resolving `untraced`" (SPEC.md:322-324)
  — which guards against the fixture set silently drifting to a single outcome over time (the actual
  historical `score-lab-signal-comparison` failure was a scan that stayed green because the thing it was
  supposed to catch was never exercised; this is a direct structural counter to that specific shape).
  Guard 8 also explicitly asserts through `envelope_extras`, "the real serialization path, not the leaf's
  internal function, so a sibling file that bypasses the leaf cannot stay green" (SPEC.md:306-308) —
  naming the precedent and building against it rather than merely citing it.
- **Could all four named poison arms pass while a real defect ships?** I tried to construct one. A
  *wholesale* removal (constant `Traced`) is caught immediately by the non-vacuity check itself (every
  untraced arm would now fail). A *shift* of the tolerance/floor/containment boundary is caught by the
  fixed-edge property as long as the shift moves the boundary past the fixture's literal edge point — this
  holds for defects beyond the four named ones too (e.g., an unlisted fudge factor added to
  `ExitTarget`'s window would still be caught by the "just outside either endpoint" arm, since that arm's
  literal value doesn't move with the fudge factor). The one class this doesn't reach: a *new, additional*
  path to `traced` that the fixture set never exercises (e.g., a rogue special case unrelated to the
  boundary being tested) — but that is the general limitation of any example-based fixture set, not a
  defect specific to this guard's design, and it is not what AC-50 was written to catch.
- **Residual, not blocking:** the guard's real-world *precision* (how small a constant-widening it catches)
  depends on how tightly an implementer places "just inside" / "just outside" relative to the true
  boundary — the spec correctly leaves this as an implementation detail, but it means the poison-arm
  verification exercise (presumably run once, with an obviously large mutation, to prove the mechanism
  alive) doesn't itself establish the fixture's sensitivity to a small, deliberately subtle widening. This
  is a legitimate but minor residual, not a reopening of the Critical.

AC-50 itself was reworded to name the mechanism directly (SPEC.md:454) rather than asserting an outcome
with no described path to it. The guard-to-criterion table (SPEC.md:271-281) now maps every ship-blocking
structural AC to a named guard with no gaps, including the new AC-50/AC-54 → guard 8 and AC-61 → guard 9
pairings.

---

## The 8 Important findings (the coordinator's message says "7" but lists and numbers 8; my own pass-1
file also has 8 bullets under Important — noting this only because precision was asked for; the SPEC's own
header at line 5 also says "7 Important," so the miscount is shared, cosmetic, and not something I'm
raising as a new defect)

1. **AC-35 vs. tooltip contradiction — CLOSED.** AC-35 reworded (SPEC.md:439) to "claims coverage for
   exactly the figures this feature checks... names no figure as checked that the feature does not check,
   any figure it names as *not* checked is genuinely unchecked." A new paragraph is inserted directly after
   the tooltip stating the intent explicitly: "naming the suggested size **as not checked** is the point of
   that clause... AC-35 forbids claiming coverage the feature lacks, never forbids disclaiming it"
   (SPEC.md:629-632). The tooltip text is unchanged and is now consistent with the AC governing it. Verified
   by re-reading both passages side by side — no residual contradiction.

2. **Composition / line budget — CLOSED.** New §4 subsection "The line budget — a bound, not an
   aspiration" (SPEC.md:502-524) states the same six-line accounting I derived by hand in pass 1 (card-level
   + 3 clauses + `CitedContractLine` + `CapAnnotation`) and commits to it explicitly: "This feature adds at
   most four of those six... checked on the rendered card (AC-62), not a wording aspiration." AC-62
   (SPEC.md:466, test, counted on the rendered card not the source) and AC-63 (SPEC.md:467, review,
   verdict+risk-tile above the fold at 393px) give it teeth. This is exactly what I asked for: a concrete,
   testable bound instead of restraint-by-wording alone.

3. **Halo effect on the four excluded fields — PARTIALLY CLOSED, correctly so.** New paragraph "This
   paragraph is an allowlist, and the allowlist is the halo mitigation" (SPEC.md:617-626), a new review-tier
   AC-65 that specifically reviews a card showing clauses beside bare fields (SPEC.md:469), and an honest
   new Open Question 5 (SPEC.md:901-905) that names the residual explicitly: "A trader who sees clauses on
   three fields may still generalize 'no clause means checked' onto the four fields left bare... the
   residual is the honest cost of D6's cut." I mark this partially closed rather than closed on purpose —
   a reader-generalization risk cannot be fully closed by spec text (it would need user research or closing
   `rec-absence-literals-hole` itself), and the revision does the right thing by strengthening the
   mitigation and then *booking the remainder as open* instead of claiming a false full close. That is the
   correct disposition for this finding, not a shortfall in the fix.

4. **`basis`↔`RecField` structural guard — CLOSED.** New guard 9 (SPEC.md:325-330), new AC-61
   (SPEC.md:465), and a new "Legal `(field, basis)` pairs" table in `INTERFACE_CONTRACT.md` (lines
   152-161) with an explicit poison arm ("make `exit_stop` return `inside_range`... and the build reds").
   Complete, no residual — this was a clean gap and got a clean fix.

5. **`score_identity.rs` "must not be updated" — CLOSED.** Guard 6 is now two-armed (SPEC.md:294-300):
   arm (a) the shipped assertions stay green, arm (b) "the pin file's own diff is empty," recorded via
   `git diff --stat -- apps/api/tests/score_identity.rs` in the GATE Q receipt, with the laundering failure
   mode named explicitly ("arm (a) can be 'fixed' by editing the golden constants instead of the code...
   a non-empty diff there is a regression to be explained, never a fix") and a precedent cited
   (`outcome-ledger`). AC-48 carries the second arm (SPEC.md:452). This is a concrete, checkable mechanism
   where before there was only a policy sentence. Light residual: the spec describes this as something "the
   build lane records... in its receipt at GATE Q," which reads slightly more like a checklist step than a
   hard CI gate that blocks a merge on its own — worth confirming at implementation time that arm (b) is
   machine-enforced and not just human-recorded, but this doesn't rise to reopening the finding given the
   explicit precedent and the AC's `test` (not `review`) verification tier.

6. **`anchor_kind` display labels — CLOSED.** All eleven members plus the fallback are now tabulated in
   SPEC.md §4 (lines 584-597), with `INTERFACE_CONTRACT.md` pointing at it rather than duplicating it
   (line 139-140, consistent with the file's own stated copy-ownership split, line 11-13). The one
   judgement call flagged by the coordinator — `gex_spot` → `levels spot`, not `spot` — is present and
   justified in the table itself ("not `spot` — the levels anchor is not the live display price, and the
   card must not blur them"), which is a legitimate, disclosed product decision, not a new defect.

7. **POST endpoint outside the conformance block — PARTIALLY CLOSED, correctly so.** New
   `INTERFACE_CONTRACT.md` §1a (lines 228-294) gives the three-layer plan I asked for: layer 1 (in-process,
   ship-blocking, already existed as arms 1-3, now named as such), layer 2 (AC-66, a captured live response
   walked against an explicit ~38-path required-path list, review, key-gated), layer 3 (the existing GET
   runner block). Critically, the named gap is now stated as a gap rather than papered over with the old
   "same carve-out as `tradeable-rec-inputs`" line alone: "With no resolvable provider key, layer 2 cannot
   run and nothing observes the live HTTP body... The receipt records the check as **not-run with that
   reason**; it is never recorded as a pass" (§1a, and restated at SPEC.md §7 and Open Question 6,
   SPEC.md:906-910). I mark this partially closed, not closed, because the underlying gap — no live-HTTP
   verification of this feature's own payload without a provider key — is a real environmental constraint
   no amount of spec text can close; what the revision fixes is exactly the two things that *were* fixable:
   there is now a genuine verification mechanism for when a key is available, and the gap can no longer be
   silently passed. That is the correct and honest disposition, not a failure to close.

8. **`local_rules`/`gamma_flip` dependency — CLOSED.** The exact scenario I traced by hand (gamma_flip
   null → stop/invalidation null → `checked == 0` → `not_applicable` preempts `local_rules`, no line at
   all) is now named, explained and reasoned about explicitly in §2.4 (SPEC.md:212-222: "**`not_applicable`
   preempts `local_rules`, deliberately, and here is the case it covers.**"), tested (new AC-64,
   SPEC.md:468), reflected in the Component-states table, the Error-handling table (§5, new row), and §7's
   live-arm testing note. T9 (the enum order) is explicitly **not reopened** — SPEC.md:219 ("The order is
   settled at T9 and is not reopened here") and a new "Not buildable" bullet forecloses "fixing" it by
   reordering (SPEC.md:376-377). Open Question 4 is correctly narrowed rather than closed outright: "What
   remains open is only whether the hoist itself behaves as read" (SPEC.md:899-900) — the behavior is now
   specified, only the untested-in-practice env-read hoist remains genuinely open, which is honest and
   proportionate.

---

## The 3 Minors

1. **`local_rules` miscategorized under "error / degraded"** — **CLOSED.** The Component-states table now
   states the calm treatment in the *default* column ("On a **local-rules** source that member is the calm
   caption one — no warning colour, no icon, nothing is wrong on that card," SPEC.md:529) and the
   error/degraded column now explicitly says "**These two are the only degraded members**," excluding
   `local_rules` by name. No residual.

2. **Per-field branch order not given the same formality** — **CLOSED.** §2.3 now states "Within each rule
   the branch order is itself fixed and first-match-wins, with the same `DO NOT REORDER` discipline as the
   two headline enums" (SPEC.md:145-146), gives a reason for the specific `ExitTarget` ordering (no-citation
   checked before move-availability, "evaluated first, because... the reader's actionable fact is the
   missing citation," INTERFACE_CONTRACT.md:148), and `INTERFACE_CONTRACT.md` rule 6 is reworded to cover
   "the two headline enums **and inside each per-field rule**." No residual.

3. **`counts.not_checkable` composition only inferable** — **CLOSED.** `INTERFACE_CONTRACT.md` line 79 now
   states the composition directly ("entries whose `state = not_checkable` **excluding** every
   `structurally_unchecked` one, **plus** the cited contract when its state is `right_undetermined`"),
   matched by SPEC.md:232-234 and restated again at INTERFACE_CONTRACT.md:192-194. No residual.

---

## Regression check — no new defect found

- **All 28 conflict-resolution markers survive**, unchanged in placement and ID, plus the folding-receipt
  JSON at the bottom of `SPEC.md` (28 `conflict_id` entries, verified by count, not by eye).
- **Nothing in `council/decisions.md` was reopened to close a finding.** T9 (card-enum order) is the one
  settled item directly adjacent to a fix in this pass, and the revision explicitly declines to touch it,
  citing it by name twice (§2.4 and the "Not buildable" list) rather than quietly reordering the enum to
  make the `gamma_flip`-null case "nicer." D7's ladder is strengthened, not altered — guard 8 is described
  as what makes the ladder's existing "never a tolerance widening" clause enforceable rather than promised
  (SPEC.md:825-827), which is a tightening in the same direction D7 already ruled, not a new decision.
- **Rows 61-67 checked against the existing 60 for collisions.** AC-67 ("the suggested size and the dollar
  risk figure render their values exactly as they do on `main`... it only withholds a clause") is new and
  was not explicitly requested by any of my findings, but it is complementary to AC-26 (clause-suppression)
  rather than duplicating or contradicting it — AC-26 governs the absence of a clause, AC-67 governs the
  unchanged value/format/placement underneath it. No collision found among 61-67 or against 1-60.
- **Re-grepped both files for the ten banned words** (`verified`, `confirmed`, `validated`, `approved`,
  `safe`, `trusted`, `grounding`, `hallucinated`, `suspect`, `invalid`). All hits are meta-discussion (the
  naming rule itself, testing-strategy prose, open questions) — none appear inside a copy table or a
  user-facing literal, including the new anchor-label table, the new line-budget prose, and the new §1a
  text. No new violation introduced.
- **Status lines updated consistently**: both files now read "Status: draft — skeptic-reviewed (R4 pass
  2)," and `SPEC.md` line 5 self-reports finding disposition (with the 7-vs-8 Important miscount noted
  above as cosmetic only).

## What is still genuinely open, for the owner rather than another loop

Two residuals are correctly booked as open rather than closed, and neither is blocking:

- **§9 item 5 — the halo-effect residual** on `Structure` / `Strike(s)` / `Expiration` / `Entry trigger`.
  Mitigated by copy and by absence, reviewed rather than measured against a real reader. Genuinely closes
  only if/when `rec-absence-literals-hole` ships.
- **§9 item 6 — the live-HTTP verification gap** on `POST /api/recommendation/{ticker}` when no provider
  key is available at GATE Q. A verification plan and an honest not-run recording now exist where before
  there was only an asserted carve-out; the underlying environmental gap (no key ⇒ no live-body check) is
  not something a spec revision can close.

Both are named, tested where testable, and explicitly not silently passed — which is the standard I judged
the rest of this pass against.
