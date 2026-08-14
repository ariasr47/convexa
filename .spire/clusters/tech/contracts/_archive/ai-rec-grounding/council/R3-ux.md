# R3 — ux resolutions: ai-rec-grounding

One pass. Every technical conflict where I am `raised_by: ux` or `source: ux` is answered below with
exactly one of CONVERGED / CONCEDED / UNRESOLVED — PROMOTE TO PRODUCT. Nothing here is a SPEC; §11 is
the closed literal set the synthesizer copies verbatim.

---

## T1 — my A8: the scripted `AI_REC_SCENARIOS_ENABLED` scenario · **CONCEDED**

The architect read the tree; the flag and the registry are Python-era and do not exist here. A8 is
withdrawn.

**Replaces it.** UX-16 is reachable from a **hand-written response fixture in the dashboard spec** —
no LLM call, no network, no backend scenario registry. The state-matrix row
`scripted scenario (hallucinating provider)` becomes **`fabricated-rec fixture`**, and its
`shipped scripted chip + strip` clause is withdrawn outright: that chrome will not mount, and copy
describing chrome that cannot render is exactly the class of claim I exist to refuse. The live
browser arm is the local-rules card (T17), which is a *different* card-level member and proves a
different thing. Nothing else in my matrix moves.

---

## T5 — my A7: `cap_not_derivable_reason` explains UX-20 · **CONCEDED**

The architect is right and the verification is decisive: that token is read from the **owner's** risk
block and is null in exactly the state UX-20 wanted explained (`auth/risk.rs:67-86`; a null cap value
short-circuits to `NoCap`, so `NotCheckable` never coexists with a non-null reason). A lookup keyed on
it would print nothing, or print a cap-side reason as if it were a figure-side one.

**Withdrawn:** A7 as the basis for UX-20, and any render of `cap_not_derivable_reason` anywhere in
this feature. **Replaces it:** UX-20's reason clause renders by closed lookup on the **new closed
max-risk refusal token** carried beside `cap_check.verdict` (`no_figure | multiple_figures`). The
literals — appended as a second sentence to the shipped `CAP_COULD_NOT_CHECK`, which is unchanged:

| refusal token | rendered line |
| --- | --- |
| `no_figure` | `Couldn't check against your cap. Convexa couldn't read a dollar amount in the risk figure.` |
| `multiple_figures` | `Couldn't check against your cap. The read named more than one dollar amount.` |
| absent / unrecognized | `Couldn't check against your cap.` (shipped literal alone — never a guess) |

Both sentences describe **Convexa's reading**, never the model's intent — that is what keeps them true
across all four causes the discriminant folds (absent text, no `$` figure, a bare number).

---

## T9 — `wasn't checked` cannot be a server token · **CONVERGED**

I take the architect's split, with one amendment that his proposal predates (my R2 self-revision
dropped the `nothing to check` **literal**).

**Settled rule.** The card-level line is chosen by **closed lookup on one server-folded card token
whenever the grounding block is present**; the **total absence of the block is the only thing the
browser decides**, and it renders `This read wasn't checked against Convexa's numbers.` The browser
never counts, compares, or folds per-field tokens into a card verdict. The card token carries six
members: five that render a literal, plus `not_applicable` (the `no_trade` branch) which **renders
nothing at all** — wire totality is preserved without a literal announcing that there is nothing to
announce.

I also concede two causes I wrote in R1: the local fallback and the stub provider **do** carry the
block (both return through the `base` closure), so `wasn't checked` has exactly one cause — a client
talking to a pre-feature server (a tab open across a deploy). It stays in the set: on this repo
push = deploy, so a stale tab is real, and it is testable from a fixture with the block omitted. The
`unavailable_envelope` branch renders no rec body, so no card-level line renders there; my matrix row
`no grounding surface (no rec body exists)` already covers it and the SPEC should name it as known
and uncovered rather than discover it.

---

## T17 — `wasn't checked` on the local rule-based rec · **CONCEDED**

PM is right: on a local-fallback rec that sentence is false and falsely alarming, and it spends amber
on the most trustworthy card in the app. Trained-to-discount-the-amber is a worse outcome than any
missing caveat.

**The calm member I need**, server-emitted, quiet caption idiom, no icon, no warning chrome:

> `No AI read here — these figures come from Convexa's own rules.`

Card token member: `convexa_rules`. It is true by construction on that branch (Convexa computed every
figure) and it says the one thing that changes the reader's behaviour. `This read wasn't checked
against Convexa's numbers.` keeps its warning chrome and now fires on exactly one cause (T9).

My copy does not depend on the open product ruling about whether per-field clauses are suppressed on
that card: if they render, they render `traces to Convexa's gamma flip (…)` and `couldn't check this`
truthfully and add no caveat; if PM suppresses them, the card-level member alone carries the claim.
Either ruling leaves this literal correct.

---

## T19 — rendering `exit_plan.stop` as attributed quotation · **CONVERGED**

PM withdrew the relocation in R2 ("I withdraw the literal relocation") and kept `the AI's own number`
in visible text. The remaining question — does "the model's voice" survive — is settled as **a
type-register distinction, not as copy**.

**Settled rule.** No untraced numeric figure is ever rendered inside quotation marks or as attributed
speech; there is no wording to quote, because `exit_plan.stop` / `exit_plan.target` /
`invalidation_level` are numeric schema fields. The figure renders **in place, in its slot**, in the
**body/sans register**, with `the AI's own number` in visible text directly beneath it. Convexa-traced
values render in the IBM Plex Mono data register. **Verbatim quotation is reserved for the one honest
class: a stated figure the app cannot read as a number at all** — the max-risk prose string and
`position_size` — where the model's literal characters *are* the payload and already render verbatim
today.

**I commit to PM's (ii).** The register split is promoted from my §5.4 optional candidate to
**REQUIRED**, and I raise it as a **DESIGN_SYSTEM Amendment** (mono = Convexa computed · body = model
asserted) for the human to rule, appended by the synthesizer/conductor after the ruling — not restated
in SPEC §4 and not a second system. Binding a11y condition: the register **never carries the state
alone**; the clause is always in visible text, so the distinction survives a screen reader, a
monochrome screenshot and a coarse pointer.

---

## T20 — `position_size`'s permanently constant state · **CONVERGED**

I accept the engineering fact in full: `position_size` is structurally not-checkable in v1 and the
wire keeps its total four-member per-field vocabulary. PM's ask answered directly — **no, my quiet
caption does not hold at that rate, and I would rather cut the clause.**

**Settled rule.** A per-field grounding clause renders **only on fields whose grounding state can vary
between recs** — `exit_plan.stop`, `exit_plan.target`, `invalidation_level`. `position_size` carries
the wire member `not_checkable` and renders **no clause, ever**; `max_risk` renders no grounding
clause at all (T22). The exclusion is stated **once**, in the card-level definition tooltip (§11.4).
That is one permanent true statement instead of two caveats on every card forever — the literal shape
of the `tradeable-rec-inputs` Critical, avoided.

**Withdrawn:** my R1 tooltip sentence `Convexa checks the stop, target, suggested size, invalidation
level and the contract named.` — it named a field we structurally never check. **PM's AC-1 needs the
carve-out sentence**: it binds fields whose state varies; the structurally-constant class is covered
once by the tooltip and by the shipped cap line, and still never renders a value with no covering
surface.

---

## T22 — cap-anchored `traced` for `max_risk` · **CONVERGED**

Both peers now state the same fact: the effective cap is a number the **owner typed**, not something
Convexa computed from the chain, and a fabricated figure that happens to sit under it would pass. PM's
revised AC-32 keeps the half that settles it ("being under the cap alone never renders as traced"), so
the architect's option (a) is off the table.

**Settled rule.** `max_risk` never resolves to traced on the strength of the cap, and **the card
renders no grounding clause on Max risk at all** — the shipped `CapAnnotation` remains the single
statement about that fact (PM AC-22/AC-34), now carrying the refusal reason from T5. Enforced
structurally at the copy layer: the traced literal's source is rendered from a **closed `anchor_kind`
token by total lookup**, and there is no member for the cap — so the string
`traces to Convexa's risk cap (…)` is **unrenderable by construction**, not merely unwritten.

---

## T23 — `grounding unavailable for this recommendation` · **CONVERGED**

A literal swap, no behaviour change. `grounding` is the internal feature name and never reaches a
user; `unavailable` is a settled absence literal meaning *the value is missing* and must not acquire a
second meaning four inches up the card (PM's own AC-17 and assumption 16).

**Settled rule.** Neither trigger renders either word:

- **every checked figure on this rec resolved not-checkable** → server member `couldnt_check` →
  `Convexa couldn't check these figures this cycle.`
- **no grounding block reached the browser** (pre-feature server) → client branch →
  `This read wasn't checked against Convexa's numbers.`

Whichever way the architect's AC-21 conflict lands on reachability, both triggers are covered and no
user-facing string in this feature contains `grounding` or reuses a shipped absence literal.

---

## T24 — the bare-`—` hole · **CONCEDED (to PM's ruling)**

I accept PM's cut. Given the ruling, this is exactly what I render:

- **`Invalidation` moves onto the shipped `fieldLiteral` closed set** — `—` / `not set` /
  `unavailable` / `not given` / value — **before** any grounding clause attaches to it. UX-19 narrows
  from five fields to this one.
- **`Structure`, `Strike(s)`, `Expiration`, `Entry trigger` render exactly as they do on `main`** —
  unchanged, untouched by this feature. Because their absence is still mis-stated, **no grounding
  clause, marker, chip, tint or tooltip may attach to any of them in v1.** That prohibition is the
  cheap half of my original ask and it is the half that matters: the feature does not ground a lie.
- The **named-levels row (§3c) does not ship**, as PM notes was already my stated trade; the
  prose-is-not-checked statement sits with the reasoning (PM AC-24), not in the tooltip.
- One sentence the SPEC should carry: on a trade rec that omits Structure or Entry trigger, the card
  still prints a `—` that the closed set defines as *not applicable* — a named, backlogged defect
  (`rec-absence-literals-hole`) this feature neither creates nor worsens and does not fix.

---

## T25 — the tolerance clause · **CONVERGED**

PM's AC-3 premise stands; only the disclosure mechanics were contested, and the literal reading put
`within 0.1%` on every traced clause, which is a percentage claim no short clause can defend and four
overflow risks at 393px. The fix is **a third traced literal, not a percentage** — and it needs no
client comparison, because the wire carries the match basis.

**Settled rule.** The traced member carries a closed `basis` discriminator with three members, and the
clause states the anchor's **name and its own value** so the reader sees the actual gap:

| basis | literal | when |
| --- | --- | --- |
| `exact` | `traces to Convexa's {anchor} ({value})` | asserted figure equals the anchor |
| `near` | `near Convexa's {anchor} ({value})` | differs, inside the match window |
| `inside_range` | `inside Convexa's implied move for {expiration} ({low}–{high})` | containment |

So the honest answer to "asserted 412.4, put wall 412" is **`near Convexa's put wall (412)`** — both
numbers visible, no percentage, and the verb does not assert an equality the server did not find.
**The threshold is stated exactly once**, in the card-level definition tooltip, composed from the
payload-stated constant: `{TOL_PCT}% of the level, never less than a cent`. If that constant is not on
the wire, the parenthesis is **omitted entirely** and I hardcode nothing — `near` plus the two visible
numbers still carries the claim honestly.

**Answering the architect's containment ask:** copy names the **two range endpoints and the cited
expiration**; it does **not** name `anchor_spot` in the clause — a third number the reader cannot act
on. The basis is stated once in the tooltip: `The implied-move range is measured from the snapshot's
spot at that expiration.` That discharges AC-3's "states the range and the anchor it was measured
from" without spending a line per field.

---

## §11 — The final closed literal set

Nothing renders that the wire does not name; nothing on the wire renders ambiguously.

### 11.1 Card level — one member, on a produced **trade** verdict only

| # | wire member (card token) | literal (verbatim) | chrome |
| --- | --- | --- | --- |
| 1 | `all_traced` | `Every checked figure traces to a Convexa number.` | caption · `text.secondary` · no icon |
| 2 | `some_untraced` | `{traced} of {checked} checked figures trace to a Convexa number — each exception says so below.` | caption · `text.secondary` · no icon |
| 3 | `none_traced` | `No figure here traces to a Convexa number.` | `warning.main` + `WarningAmberIcon` |
| 4 | `couldnt_check` | `Convexa couldn't check these figures this cycle.` | `warning.main` + icon |
| 5 | `convexa_rules` | `No AI read here — these figures come from Convexa's own rules.` | caption · `text.secondary` · no icon |
| 6 | `not_applicable` | *(nothing renders — `no_trade`)* | — |
| 7 | *block absent* (client-selected, the only one) | `This read wasn't checked against Convexa's numbers.` | `warning.main` + icon |

Member 2 is the count form **iff** the card token carries the two integers; if the architect cannot
emit them, the literal is the qualitative fallback `Some figures here are the AI's own — each one says
so below.` and nothing else changes. I concede the count on the copy layer — PM's "one of four vs
three of four is opposite advice" is concrete, and the denominator is the **checkable set on this
rec** (PM's revised AC-13), never all five fields.

### 11.2 Per-field — on `exit_plan.stop`, `exit_plan.target`, `invalidation_level` only

| wire member | literal (verbatim) | tooltip |
| --- | --- | --- |
| `verified` · basis `exact` | `traces to Convexa's {anchor} ({value})` | *(none)* |
| `verified` · basis `near` | `near Convexa's {anchor} ({value})` | *(none)* |
| `verified` · basis `inside_range` | `inside Convexa's implied move for {expiration} ({low}–{high})` | *(none)* |
| `unverified` | `the AI's own number` | `Convexa compared this against the levels and quotes it computed and didn't find it. That doesn't make it wrong — it means Convexa can't vouch for it.` |
| `not_checkable` | `couldn't check this` | `{missing-input clause}. The figure above is the AI's, unchanged.` |
| `not_applicable` | *(nothing renders)* | — |

A clause renders **only** on the `value` member of `fieldLiteral`. `position_size` and `max_risk`
render no clause (T20/T22). `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` render no clause
(T24).

`{anchor}` is a **total lookup over the closed `anchor_kind` token**, never a server-composed string.
An unrecognized token renders `traces to a Convexa level ({value})` / `near a Convexa level
({value})` — honest, still carries the number, never a badge and never a raw wire string.

### 11.3 `{missing-input clause}` — answering the architect's second ask

Extend the **one** existing closed enum rather than shipping a second that drifts. `RiskBlock` is not
reachable on these three fields; I need `NamedLevels` and `CitedExpiration` added, `StraddleMove` and
`CandidateQuotes` reused:

| member | clause |
| --- | --- |
| `named_levels` | `Convexa had no named levels for this snapshot` |
| `straddle_move` | `Convexa had no implied move for that expiration` |
| `cited_expiration` | `The read didn't name an expiration to measure against` |
| `candidate_quotes` | `Convexa had no two-sided quote for that contract` |

### 11.4 The definition tooltip — on the card-level line, once

> `Traced` means the figure lines up with a number Convexa computed from the option chain — not a
> judgement that the trade is good. Convexa checks the stop, the target and the invalidation level. It
> doesn't check the suggested size; the contract named and your risk cap each have their own line.
> `Near` means the figure sits inside Convexa's match window for that level ({TOL_PCT}% of the level,
> never less than a cent). The implied-move range is measured from the snapshot's spot at that
> expiration.

Every claim withdrawal in this feature lives in that paragraph and in PM's AC-24 statement beside the
reasoning. Both must survive editing.

### 11.5 Cap surface (shipped `CapAnnotation`, improved) — T5 table above. Unchanged otherwise.

### 11.6 Wire members I need

1. **Card token**, server-folded, six members (11.1); optionally two integers `traced` / `checked`.
2. **Per-field**: four-member state; on `verified`, a `basis` discriminator (`exact | near |
   inside_range`), a closed `anchor_kind` token, and the anchor's **server-formatted display value**
   (or `low` / `high` + the cited expiration label for `inside_range`).
3. **On `not_checkable`**: the closed missing-input member (11.3).
4. **`TOL_PCT`** as a plain number on the payload — optional; copy degrades honestly without it.
5. **Max-risk refusal token** beside `cap_check.verdict` (`no_figure | multiple_figures`).
6. **Not needed:** any render of `cap_not_derivable_reason`; any free-text source label; any
   scenario-registry field.

---

## §12 — Acceptance criteria changed by this round

`test` = invariant / negative space / silently-regressing. `review` = visible and intentional.

| # | Criterion (revised or new) | Verify by |
| --- | --- | --- |
| UX-2 (rev) | The card-level member is chosen by closed lookup on the server card token when the block is present; block absence is the ONLY branch the browser selects; the browser never counts, compares or folds per-field tokens | test |
| UX-6 (rev) | Block absent ⇒ `This read wasn't checked against Convexa's numbers.` — never silence, never a traced member | test |
| UX-8 (rev) | Every traced literal names its anchor **and** carries a number (value, or both range endpoints); a traced clause with no number is a defect | test |
| UX-9 (rev) | Verbatim copy of the seven card-level rows and five per-field rows matches §11 | review |
| UX-16 (rev) | A hand-written fabricated-rec wire fixture renders card-level `No figure here traces to a Convexa number.` and per-field `the AI's own number` on every value-bearing checked field — no registry, no LLM, no network | test |
| UX-19 (narrowed) | `Invalidation` renders through the closed `fieldLiteral` set (no bare `'—'`); `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` are unchanged and carry no grounding clause, marker, tint or tooltip | test |
| UX-20 (rev) | `CAP_COULD_NOT_CHECK` carries its reason sentence by closed lookup on the max-risk refusal token; nothing renders off `cap_not_derivable_reason`; never composed client-side | test |
| UX-25 (new) | A value's type register is set by its grounding state (mono = Convexa computed · body = model asserted), never by which field it is; the register never carries a state alone | test |
| UX-26 (new) | The anchor name renders through a total lookup on the closed `anchor_kind` token; an unknown token renders the level-class fallback, never a raw wire string | test |
| UX-27 (new) | No untraced numeric figure renders in quotation marks or as attributed speech; verbatim quotation only for a stated figure the app cannot read as a number | test |
| UX-28 (new) | `position_size` and `max_risk` carry no per-field grounding clause; the exclusion is stated once in the definition tooltip | test |
| UX-29 (new) | The `convexa_rules` card member renders in the quiet caption idiom with no warning chrome | review |
