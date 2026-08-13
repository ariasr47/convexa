# R3 — architect responses: tradeable-rec-inputs

> One capped exchange. Binding on R4 synthesis.
> **Vocabulary note (applies to this whole file):** where I write a token in backticks I am naming a
> **member of a closed set**, not a wire spelling. Field names and literal spellings belong to the
> interface contract (R4) and to UX. I own the members, the states, and the rules that produce them.

---

## 3f64a61d

**ACCEPT** — both halves of PM's proposal, because the two together make the mismatch impossible by
construction rather than by budget discipline. PM offered "either candidates carry at least 2 tenors
… or the expected-move block sent to the model narrows to the tenors it has contracts for". I take
both; the first raises the floor, the second is the invariant that holds even when the floor moves.

**Binding wording**

1. **Prompt candidate budget is raised from 1 tenor to 2.** ≤ **2 tenors × 2 rights × 5 strikes = 20
   records** for the in-app single-turn prompt (the nearest in-window tenor plus the tenor bracketing
   the far end of the active DTE window — the same selection rule the expected-move tenors use). The
   dedicated-read budget is unchanged at ≤ 4 tenors × 2 rights × 8 strikes = 64.
2. **The cap is now two ceilings, not one, and whichever binds first wins:** a record count **and** a
   serialized-byte ceiling on the assembled block. A record cap alone is not a bound on prompt size
   once per-record content is negotiable. Both live in the candidate-set constructor (§2.2's total
   function), so an implementer cannot emit a violation and compile.
3. **Consistency invariant (the load-bearing half):** in any artifact that carries both blocks,
   `tenors(expected-move block) ⊆ tenors(candidate block)`. The model is never handed a move for an
   expiration it was handed no contracts for. Vacuously true on the bundle, which carries no candidate
   block. Enforced by one shared restriction function used by all three assembly points (prompt
   assembler, dedicated read when it carries moves, hand-off export), not by three local filters.
4. **Named mechanism, because this is the part I could otherwise hand-wave.** Today
   `apps/api/src/services/llm.rs:137` forwards `market_state` **wholesale**
   (`"market_state": bundle.get("market_state")`). If expected move rides on `market_state` — my §2.1
   ruling — the model receives all three tenors automatically. The narrowing therefore requires the
   assembler to forward a **pruned clone** of `market_state` with the expected-move member restricted
   to the candidate tenors. That is a context-assembly filter, not an instruction rewrite, and it costs
   one clone of an object the `json!` context already materializes.
5. **My §5 non-goal is amended accordingly** and this is the amendment, stated once: *"No prompt
   rewrite beyond inserting the named blocks"* now reads **no rewrite of the instruction text beyond
   the named blocks and the named schema fields (see 7d618628); the assembler MAY prune the forwarded
   `market_state` where pruning is what keeps two blocks mutually consistent.*
6. **Counts as-sent are payload content, not a UI derivation:** every assembled artifact carries how
   many contracts across which expirations it actually contains, and whether that artifact was **sent
   to the model** or **computed for display only**. The export drawer renders those numbers by lookup;
   it never subtracts two counts in the browser.
7. **Poison test (non-vacuity asserted):** construct expected move with 3 tenors and candidates with 2;
   assert the assembled prompt carries exactly 2 moves. Widen the restriction in a test build and prove
   the assertion can fail.
8. **Measurement, per PM's "settle it against a measurement".** The prompt-size measurement runs in the
   same pre-commit pass as the quote-fill check (see Asks). **Pre-committed fallback so the design does
   not wait on the number:** if the measured total (current prompt + 20 candidate records + risk block +
   positions digest) exceeds the budget, I cut **strikes per (tenor, right)** first — 2 × 2 × 4, then
   2 × 2 × 3 — and only escalate to the owner if 2 tenors × 2 rights × 3 strikes still does not fit.
   I do **not** fall back to one tenor: the intersection invariant in (3) is what keeps AC-2 a real
   fabrication guard rather than a routine false positive, and one tenor makes the model's honest
   answer look like a fabrication.

---

## 7d618628

**ACCEPT** UX's option (ii). First, two ground-truth corrections the wording has to sit on.

**Correction A — this is not a forced-tool-use contract.** There is no tool schema and no
structured-output enforcement anywhere in the rec path. `build_rec_prompts`
(`apps/api/src/services/llm.rs:120-147`) states the schema as **prose inside the system prompt**
("Respond ONLY with a single JSON object … matching this schema"), and `parse_strategy_json`
(`llm.rs:341-390`) is a **tolerant whitelist re-projection**: it copies exactly the named keys and
silently drops everything else. Consequence: any field we add is **best-effort** — the model may omit
it, and the parser will hand us `null`. Every consumer rule below is written for the null-dominant case.

**Correction B — the schema carries two of the three identity fields, not three.** `strikes` is
`number[]` and `expiration` is `string|null` (llm.rs:125), and **no right token exists** — the call/put
side is inferable only from the free-text `structure` and the `bias` enum. UX's option (i) is therefore
false. So option (ii) applies.

**Binding wording**

1. **A right token is added to the rec response schema and is in scope for this feature.** Members:
   `call` / `put` / **absent**. Cost, named exactly: one clause in the schema string
   (`llm.rs:124-131`) and one coerced projection in `parse_strategy_json` (`llm.rs:372-389`), modelled
   on the existing `bias` coercion at `llm.rs:364-371` — **with one deliberate difference: it must not
   have a default.** `bias` defaults to `"neutral"` when absent; an unrecognised or absent right stays
   absent. A defaulted right is exactly the confidently-wrong match this conflict exists to prevent.
2. **This is a schema field, not grounding enforcement**, and it does not pull `ai-rec-grounding`
   forward. Nothing verifies that the named contract is good; we only make it *identifiable*.
3. **Partial-key matching is structurally impossible.** A cited contract exists only when the parsed
   rec yields **exactly one** (expiration, strike, right) triple — i.e. `strikes` has length 1 **and**
   expiration is present **and** right is present. The match function takes a key type with no
   constructor from a partial input; there is no "match on strike + expiration and pick a side".
4. **Every other case is one closed state, not a guess:** multi-strike structure (a spread's identity
   is per-leg and the schema carries no per-leg right), right absent, or expiration absent ⇒ **no
   cited contract** ⇒ no per-contract quote line at all, falling back to the off-set / undetermined
   literal UX already designed. AC-2/AC-3/U-20 survive with their trigger narrowed to the single-leg
   case; they are not withdrawn.
5. **Per-leg identity for spreads is explicitly OUT of v1.** A `legs[]` array with a right per leg is
   the correct long-run shape and is a materially larger prompt-contract change; it is future-dated.
   v1 buys the single-leg guard, which is the case the cited-contract fact line was designed for.
6. **The local rule-based fallback never produces a cited contract** — `local_strategy_from_bundle`
   (`recommendation.rs:524-541, 561-578`) emits `strikes: []` and `expiration: null` on both branches,
   so it carries no right either and lands in state (4) by construction. Worth recording: the offline/CI
   path cannot fabricate a quote.
7. **Typed size — plain answer, since it was asked.** `position_size` is `string|null` (llm.rs:127) and
   the local fallback returns the literal prose `"small (rule-based local rec; not LLM)"`
   (`recommendation.rs:570`). There is **no typed size today.** Adding a typed contract-quantity field
   costs the same two edits as the right token. My ruling: **add it only if PM's 54314ed9 answer keeps
   the numeric pre-fill** — the field is the *only* mechanism I will supply for it. If PM takes the drop
   -the-pre-fill branch, no size field is added. **Either way, zero free-text parsing of
   `position_size` ships, on either side of the wire.** The `max_risk` dollar parse is a separate,
   single, server-side function (see Asks, cap verdict).

---

## 5e7c21d3

**ACCEPT** UX's proposal as written: up to 3 tenors on the wire, **exactly one rendered by default —
the nearest in-window tenor, per AC-22** — extras reachable in the export drawer and named in the
tooltip. Rendering and placement are UX's call and I do not contest them. Three content rulings make
their objection ("each tenor carries its own null cause … partial states no lane has specified")
disappear rather than get deferred.

**Binding wording**

1. **The payload names its own primary.** The expected-move member carries the tenor list **plus an
   explicit designation of which tenor is the default render**, chosen server-side by the same
   nearest-in-window rule that selects candidate tenors. The FE never picks by array order and never
   re-derives "nearest" by comparing DTEs — that is client inference of a fact the server already knows.
2. **Sparse tenors are omitted, never emitted null.** A tenor that cannot be computed is **absent from
   the list**; the reason lives once at set level with the drop counts. There is no per-tenor null-cause
   matrix to design, because there are no per-tenor nulls. If **no** tenor resolves, the whole member is
   null with its reason — the single failure state UX already designed for.
3. **The primary tenor is always present in the candidate block** (both are selected by the same
   nearest-in-window rule), so the rendered reading and the contracts the model was sent never disagree.
4. **Reconciling this with 3f64a61d:** the wire carries up to 3; the **prompt** carries only the tenors
   the candidate block covers (≤ 2). The third tenor is **display/export/hand-off content, not prompt
   content** — justified by two named consumers: the hand-off export runs the 64-record budget (4
   tenors), and a rec may name an expiration outside the prompt's two, in which case the trader needs
   that expiration's move to check the claim. This is a refinement of UX's stated rationale ("carry up
   to 3 on the wire for the model"), not of their ruling; their operative sentence — render exactly one
   — is accepted verbatim.
5. **The artifact distinguishes sent from shown.** Because the wire now carries more than the prompt
   did, every block records whether it was sent to the model or computed for display only. Without that
   flag the drawer's "what actually left the machine" claim becomes false the first time these two
   budgets differ — which is now, by design.

---

## Asks answered

### PM-1 — the evening quote-fill pre-commit check

**Yes, it is a pre-commit gate on SPEC — and I cannot run it.** I have no Bash and no vendor key by
design; asserting I would run it is the exact failure mode my lane is warned about. It must be run by
the lane that holds the shell and `MASSIVE_API_KEY`. What I owe is a procedure precise enough that the
result is not a judgement call, and a design that has already committed to each outcome:

**Procedure.** One **evening** snapshot (post-16:00 ET, ideally 20:00–23:00 ET) and one RTH snapshot
for contrast, on **SPY** and on one thin single-name from `apps/api/config/universe.json`. For each,
count: total rows; rows with both sides present; rows with exactly one side; the same three restricted
to the ±15% band ∩ the 7–45 DTE window; and the same three restricted to the **64-record candidate
set**. **The candidate-set fill rate is the number that decides anything** — ranking by nearness to the
anchor concentrates the set on the liquid part of the chain, so a whole-chain fill rate understates it.

**Two measurement traps that will otherwise corrupt the result.**
(a) `normalize_contract` filters `bid`/`ask` with `> 0.0` (`rest.rs:823-824`), so a legitimate
zero bid is indistinguishable from vendor-absent — the measurement is **biased toward "no quote"** and
must count vendor-null separately from filtered-zero off the raw rows, not off `Contract`.
(b) The same pass answers 90073ec3: inspect one raw vendor chain row for a **quote timestamp**.
`RawLastQuote` (`rest.rs:737-747`) deserializes only `bid`/`ask`/`p`/`P`; whether the vendor sends a
timestamp we discard is unverified and decides whether quote age is a per-contract or a set-level fact.

**Pre-committed design responses.** (i) Candidate-set fill healthy at night ⇒ ship as designed.
(ii) Near-zero at night, healthy in RTH ⇒ the straddle basis falls to the IV-derived enum after hours
and most candidate rows carry the no-NBBO presence state; the design is unchanged and honest, but the
AC set **must** carry an evening fixture and PM gets a scope fact: at night the candidate set is a
stated-empty liquidity picture, not a liquidity picture. (iii) Near-zero in RTH too ⇒ item 1's
liquidity half is not deliverable on this vendor tier and that is a scope escalation **before** SPEC.
Run the prompt-size measurement (3f64a61d.8) in the same pass.

### PM-2 — does the produced rec pin the risk-block values it was sent

**Yes — and the mechanism already exists on that envelope.** The rec response is built in
`recommendation.rs:432-448` and already pins snapshot state: `as_of` (line 436) and
`pinned_fingerprint` (line 437). The as-sent risk inputs are pinned **the same way, on the same
envelope, at the same moment the block is read for prompt assembly**. Rules:

1. The echo carries: the per-trade cap **as entered** with its unit; the **derived effective dollar
   cap** with its derivation states (settled: derived once server-side, closed not-derivable members);
   the cap **verdict token** (below); and a short **digest of the whole risk block** for change
   detection. Response-only. **Never persisted server-side** — my §5 non-goal now names the risk block
   explicitly alongside candidates, expected move, and the digest.
2. **Because the verdict is pinned, no consumer ever recomputes it** — this is what makes the settled
   "computed once, passed down as a rendered result" true across a later re-render, not just at first
   paint. U-19's superseded strip fires by comparing the pinned **digest** to the currently stored
   block; it does not need the raw values to detect a change.
3. **The account equity is echoed on the response but is not part of what a persisted rec artifact may
   carry.** If the client stores the rec in the outcome ledger, it stores the digest, the cap as
   entered and the effective cap — **not** the account size. The ledger is exportable, and a shipped
   export sentence promises no account data leaves; a pinned equity figure would falsify it through the
   ledger's own export path rather than through this feature's.

### UX-1 — per-field reason token (model-left-blank vs input-missing)

**Yes, and the split is computed server-side, not asked of the model.** Asking the model why it left a
field blank is self-report on an unenforced schema, and the tolerant parser (`llm.rs:341-390`) would
hand us a default for it. Mechanism instead: **the assembler knows exactly which blocks it inserted**,
so for each of the four fields we fix, at design time, in one place, the set of inputs that field
depends on:

- risk figure ⇐ the risk block (effective dollar cap / account equity)
- suggested size ⇐ the risk block **and** candidate quotes
- exit target ⇐ the expected-move reading
- exit stop ⇐ market-state levels only, which are always present

Then per field: **value present** ⇒ no reason. **Null and every required input was present in the
prompt** ⇒ `not given` (the model declined). **Null and at least one required input was in an
absent/not-set/not-derivable state** ⇒ `unavailable`, **with the missing input named** by a token so
the copy can say which one. Deterministic, testable, no model cooperation.

**The limitation UX's wording must survive, stated plainly:** this is a claim about *what Convexa
supplied*, not about the model's reasoning. It can be wrong in exactly one direction — the model may
have had everything and still declined while an unrelated required input was missing, and we would
label that `unavailable`. So the literal should read as a statement about our inputs ("an input this
needed was missing this cycle"), never as a claim about the model's capability. Words are yours.

### UX-2 — explicit session-basis token per quote and on the straddle reading

**Set level: yes, and the mechanism is already in the tree.** `MarketPhase::classify`
(`apps/api/src/domain/market.rs:20-47`) is a closed three-member enum (`rth` / `after_close` /
`closed_pre`) already used to choose the GEX spot — so the session token is *consistent with how the
anchor itself was chosen*, which is the strongest reason to reuse it rather than invent one. Three
rulings:

1. **Classify the snapshot's `as_of`, not `now`.** The token then describes the data, not the request.
   It ships alongside the snapshot age R1 already requires.
2. **The straddle reading carries the same token and the same `as_of`**, because it derives from the
   same snapshot. It is a set-level datum, so UX gets its lookup with no new derivation.
3. **Use one classifier.** A second, differently-membered classifier exists —
   `market_session()` in `routes/stream.rs:61-80` (`premarket|regular|afterhours|overnight|closed`).
   That one is live-lane SSE metadata and must **not** be conflated with this token. **Known
   imprecision, stated as an assumption rather than papered over:** `MarketPhase::classify` has no
   holiday calendar (it excludes weekends only), so on a market holiday a weekday-hours snapshot
   classifies as `rth`. The snapshot age riding beside it is what lets a reader catch that; adding a
   holiday calendar is out of scope for this feature.

**Per quote: no — not derivable, and I will not fabricate it.** `RawLastQuote` (`rest.rs:737-747`)
deserializes `bid`/`ask`/`p`/`P` and reads no timestamp; nothing downstream knows when an individual
contract's NBBO was struck. So per contract the closed vocabulary is **presence, not age**: `quoted in
this snapshot` / `no NBBO in this snapshot`. **Quote age is `unknown`, carried once at set level**, not
repeated on every row. If the PM-1 raw-row inspection finds a vendor quote timestamp, age becomes a
per-contract fact and this collapses into the three-state form I proposed in 90073ec3; until then, two
states per contract plus one set-level flag. **A per-quote session label derived from the snapshot's
`as_of` is forbidden** — it would label a contract last quoted three sessions ago as live because the
snapshot happened to be taken at 10:30.

**One more content rule that belongs here.** `normalize_contract` coerces IV to `0.0` when greeks are
absent (`rest.rs:813-817`), so `implied_volatility == 0.0` is a **sentinel for unpriced**, not a real
IV. A candidate record must therefore carry an `unpriced` state and **never ship `0.0` as an IV or a
greek**. That is `[absent-is-not-none]` applied to a coercion that already exists upstream of us.

### UX-3 — where the cap comparison runs, and the verdict vocabulary

**Where:** in the rec assembly path (`apps/api/src/services/recommendation.rs`), at the same point the
risk block is read for prompt assembly, emitted on the rec envelope beside `pinned_fingerprint`, and
pinned there (PM-2.2). **Never in the FE. Never inside the entry dialog** — settled; the dialog receives
the verdict token and the two numbers as already-rendered props. The copy answer is unambiguous:
**Convexa performed the comparison**, on a figure **the AI asserted**. Both facts are on the payload —
the model's raw prose *and* the parsed dollar value — so the sentence can attribute each half correctly.

**Verdict vocabulary — your four members confirmed, with triggers pinned so two implementations cannot
disagree:**

- `within` — a dollar figure was read unambiguously and it is **≤** the effective dollar cap.
  **Equality is `within`.** (Stated because an undefined boundary is how two implementations diverge.)
- `above` — read unambiguously and **strictly greater** than the effective dollar cap.
- `not_checkable` — an effective dollar cap exists, but the rec's risk figure could not be read as an
  unambiguous dollar amount. **Includes the null case.** Never a pass by default.
- `no_cap` — no effective dollar cap: nothing entered, **or** percent-with-no-account-size. Both
  collapse to this one verdict; **the reason is read off the cap field's own not-derivable state**, not
  off a fifth verdict member. Two closed lookups compose the sentence; the browser does no arithmetic.

**One parse, one place.** The `max_risk` string (`llm.rs:127`, `string|null`) is parsed by exactly
**one** server-side function with a closed output — parsed-dollars or not-parseable — and that same
function feeds the verdict and anything else that ever needs a number out of that string. Two
heuristics for one figure will disagree the first time either changes.

### UX-4 — closed drop-reason vocabulary for cap/band omissions

Five members, one per excluded contract:

1. **outside the DTE/expiration window** — expiration outside the caller's active window.
2. **outside the strike band** — strike outside ±15% of the anchor.
3. **no interest** — zero open interest **and** zero session volume (excluded from candidacy per §2.2's
   ranking rule).
4. **expiration cap** — the expiration was in-window but beyond the tenor cap.
5. **strike cap** — that (tenor, right) already held its N nearest strikes.

**Three rules that make the vocabulary implementable rather than decorative:**

- **Fixed evaluation order 1 → 2 → 3 → 4 → 5, and each contract is counted exactly once**, under the
  first reason that applies. Without a fixed order the counts double-count and nothing the browser
  renders reconciles. "No interest" deliberately precedes the caps so a junk contract is never
  attributed to the cap, which would make the cap look more aggressive than it is.
- **Sum invariant, asserted in a test:** included + Σ dropped = total rows scanned.
- **A contract with no NBBO is NOT dropped.** It is included, carrying the no-NBBO presence state — a
  no-quote at-the-money contract is a liquidity fact worth sending. There is no sixth member for it,
  and nobody should add one.

**Set-level shape (content, not spelling):** the included count, the expirations actually included,
the count of expirations omitted by the cap, and one count per drop reason. AC-8 is then a **lookup**,
never a subtraction in the browser.

### Not mine to answer this round

The anonymous-reachability ask (UX-6 / PM's AC-39) is addressed to pm + architect jointly and turns on
a product call about the auth-outermost rec path; the two drawer-budget and superseded-value asks I
raised in R2 are addressed to pm and ux. I am not pre-empting any of them here.
