# R3 — architect ⇄ ux technical resolution (ux side): broker-option-grouping

Six conflicts. **Five CONVERGED, one CONCEDED, zero UNRESOLVED.** Nothing here needs an owner ruling;
the two product questions already routed to the owner (reassessment placement, mobile `unrecognized`
parity) are untouched by this exchange.

Two of the six were already withdrawn by me in R2 (#2, #3) and one was already withdrawn by the
architect in R2 (#5). I state their landings so the synthesizer has one place to read them, and I do
not reopen them.

---

## C1 — the netted entry must not come from `buildPositionView`

**Raised by:** architect · **Verdict: CONVERGED.**

**Resolution.** The grouping layer computes the group net by calling the pure leg helpers over the
union of the members' mapped legs — `brokerLegsOf` per member, then `Σ legCost` — and never calls
`buildPositionView`, never constructs a `SimPosition`, and never imports `positions/structure.ts`.
My R2 `agree` list already conceded the mechanism ("No merged `SimPosition`, no `buildPositionView`
call from the grouping layer"); this confirms it and closes the reachability question the dispatch
asked me to answer.

**Nothing is starved.** I walked every state in my §4 table against the helper set and checked each
input is reachable without the composer:

| State | What the copy needs | Reachable from | Verdict |
|---|---|---|---|
| default (collapsed) | the net figure | `Σ legCost` over the union — `legCost = sideSign × entry_price × multiplier × qty` (`positions/leg.ts:74-76`), identical term-for-term to `netEntryCost` (`:87-89`) over a merged position | OK — numerically identical, confirmed |
| default | the direction word (`debit`/`credit`) | sign of that same sum; `net_entry_basis` is only `netEntryCost > 0 ? debit : credit` | OK |
| default | leg count | `Σ member.broker.legs.length` | OK |
| default | modeled P/L, all-or-nothing | `legPl` (`leg.ts:82-84`) in the same early-return loop as `positionPl` (`:97-108`) | OK |
| stale (book snapshot) | `modeled_label: 'dual'` | `isStale(book, nowMs)` (`brokerView.ts:229-239`) — never came from `buildPositionView` | OK |
| offline (mark stream) | `streamOffline` | a component prop; not data at all | OK |
| withheld — never supplied | which literal, and the count | `member.broker.legs[i].cost_basis.state` (raw `BrokerPosition` is carried at `brokerView.ts:128`, `:257`) | OK |
| withheld — unparseable | same | same field, `state === 'unparseable'` | OK |
| withheld — no contract size | same | `member.broker.legs[i].multiplier != null`, the per-leg form of `brokerView.ts:198` | OK |
| empty | no option legs ⇒ no groups | structural | OK |

The only things `buildPositionView` would have added are `structure`, `structure_label`, the three
`structure_line` variants, `max_loss`, a scalar `qty` and `eval_subject` — **every one of which this
feature bans or omits.** The composer is strictly a liability here, not a source of anything my copy
reads. The architect's Risk about `structure.ts:153` going quiet the day `/trade/instrument` lands is
the decisive argument and I accept it: a ban enforced by "the renderer happens not to read the field"
is not a ban.

**Two conditions my degraded-state copy depends on** (both are consequences of the helper approach,
not new asks):

1. **The literal is chosen by the gate, never by inspecting the sum.** `brokerLegsOf` writes
   `entry_price: 0` for a non-supplied cost basis (`brokerView.ts:95`) and `multiplier: NaN` for an
   omitted multiplier (`:94`). So `Σ legCost` over a degraded union is a plausible-looking `0` or a
   `NaN`. The withheld branch must be selected from the per-leg cause states **before** any number
   reaches a formatter, exactly as the shipped cascade does at `brokerView.ts:207-216`. A `$0.00` or
   `$NaN` in the Net entry cell is the precise failure this feature exists to prevent.
   → *Verify by:* `test` (invariant; unreachable on the captured book, so a reviewer cannot see it).
2. **The shared literal-selection function must be the corrected cascade** — see C6, which is where
   the correction lives.

---

## C2 — deduping byte-identical fidelity notes across grouped legs

**Raised by:** architect · **Verdict: CONCEDED** (and already self-withdrawn by me in R2).

**What I withdraw:** my §6.6 dedup rule in full. Member rows keep their own `fidelity_notes`
verbatim on expand, unchanged in content and count, so PM AC-5 holds as written and no new prop
reaches `BrokerPositionRow` / `BrokerPositionCard`.

**One thing the architect left open, and I am ruling it — their option (b), not (a).** There is
**no group-level fidelity-note line either.** Option (a) ("render the shared note once at group
level as an ADDITIONAL line") is worse than the dedup it replaces, for a reason C4 makes concrete:
the note that would be hoisted is `_NOTE_MULTIPLIER_RECONSTRUCTED` ("contract multiplier not
supplied — reproduced exactly from Webull's own total_cost", `webull_adapter.py:231-232`), and
hoisting it restates **as a group-level assertion** exactly the provenance claim I am dropping in
C4. It would also require the FE to string-match backend copy to decide whether to hoist. Neither is
acceptable.

**Collapsed-state disclosure, since the notes are now behind the chevron by default.** The
disclosure at collapsed density is the basis label (`netted by Convexa`) plus its tooltip, and the
expander names what is behind it:

- Expander accessible name, collapsed: **`Show TSLA's 3 option legs`**
- Expander accessible name, expanded: **`Hide TSLA's 3 option legs`**

→ *Verify by:* `review` (visible, intentional copy) for the accessible names; `test` for the
negative — no group-level element renders any string from `fidelity_notes` (negative space, and it
is the seam that would silently reopen).

The density problem stands as recorded: **"repeated fidelity notes inside a large expanded group"**
is a future-dated read-density item, revisited if a group ever exceeds four legs on the real book.

---

## C3 — "a copy and placement change only" (group-level reassessment)

**Raised by:** architect · **Verdict: CONCEDED** (and already self-withdrawn by me in R2).

**What I withdraw:** the sentence quoted, and option (c) entirely. The architect's fact is correct
and load-bearing — `buildBrokerReassessment` takes a `BrokerPositionView`, a group is not one, so
option (c) needs a synthesized merged view carrying `structure` / `structure_line` into an AI
payload. That is my own Risk 6 mechanism, and I proposed it.

**Copy consequence, so the synthesizer does not have to infer it:** the group header's right rail
carries the combined modeled P/L **and nothing else** — no reassessment affordance at group level
under either owner ruling. The R3 owner question is the PM's two-option wording (stays on the
expanded leg row / removed from broker option rows entirely), with the architect's structural fact
attached as context rather than as a third option. My density observation ("five identical
`Build reassessment` buttons inside one expanded group") survives only as a future-dated item if the
owner picks "stays".

→ *Verify by:* `test` (negative space — no reassessment control renders on a group header).

---

## C4 — the ×100 provenance ⟨the one I said I cared most about⟩

**Raised by:** me · **Verdict: CONVERGED — I drop the provenance clause from all group-level copy.**
Unconditional. Final strings below.

### The fact, verified at source

I asked the architect to answer at adapter granularity: *does `/account/positions` ever yield a
broker-stated contract size for an option leg?* I went and read the branch rather than wait, and the
answer is **SOMETIMES — by construction, with no code change required to flip it**:

```python
# apps/api/src/broker/webull_adapter.py:310-316
mult_ok, supplied_mult = _parse_number(entry.get("contract_multiplier"))
multiplier = supplied_mult if mult_ok else None
if multiplier is None:
    # Broker-supplied FIRST; reconstruction only as a fallback; withhold if neither.
    multiplier = _derive_multiplier(entry, qty)
    notes.append(_NOTE_MULTIPLIER_RECONSTRUCTED if multiplier is not None
                 else _NOTE_MULTIPLIER_WITHHELD)
```

Three facts follow, and together they settle it:

1. A broker-supplied `contract_multiplier` is read **first**; reconstruction is only the fallback.
   On that branch **no note is appended at all**, and with contract detail present the position is
   `exact` with an empty `fidelity_notes` (`:324`).
2. `contract_multiplier` is not among the 13 capture-confirmed payload keys (`:236-239`), so on the
   owner's book **today** the reconstruction fires on all 9 option rows. "Never" is true of today's
   feed and only of today's feed.
3. The adapter is deliberately built so that changes silently: *"Contract facts are read
   conditionally rather than assumed absent... a feed that one day DOES carry them maps to a full,
   `exact` leg with no notes and **no code change**"* (`:289-291`).

**My R2 question was badly posed and I own that.** I asked what the feed carries today; the copy's
lifetime is longer than today's feed shape. A hardcoded group-level sentence saying "Convexa
reconstructed this" would go stale on a **zero-line diff** — no failing test, no review trigger,
nothing to notice. That is my lane's defining failure mode arriving by the back door.

The architect's Risk 9 is also right at the level the FE actually consumes: `BrokerLeg.multiplier` is
a bare `number?` (`libs/api/src/lib/broker.ts:79`) and `multiplier_known` is a boolean
(`brokerView.ts:139`). The only FE-reachable provenance signal is string-matching `fidelity_notes`
against Python string constants that are not a contract enum — a coupling that breaks on a backend
copy edit, silently, in the direction of a false claim. **I will not build copy on it.**

### What is NOT lost

Provenance is still disclosed, and disclosed better: `_NOTE_MULTIPLIER_RECONSTRUCTED` is the
backend's own vouched sentence, appears **only** on the legs it is true of, is correct under both
feed shapes, and — by my C2 concession and PM AC-5 — renders verbatim on every member row on expand.
The party that knows the provenance states it, on the rows it applies to. That is a stronger
`model-read-carries-its-assumptions` posture than the group-level sentence I was defending.

### Final strings — group level

**Basis label**, beneath the group's Net entry figure, same treatment as the child rows' basis label:

> **`netted by Convexa`**

Unchanged from my §6.3 — the label never carried the provenance claim; the tooltip and the expanded
sentence did.

**Tooltip on that label** — replaces my §6.3 tooltip in full:

> **`Convexa added these legs up: for each one, per-contract cost × contract size × number of
> contracts, with money received counted against money paid. Webull doesn't publish a combined cost
> for legs it reports separately, so this is Convexa's arithmetic, not a Webull figure — expand the
> group for each leg's own numbers and notes.`**

**Sentence in the expanded disclosure panel** (`leg-max-loss-note` slot) — replaces my §6.3
expanded sentence in full:

> **`Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory
> context, not a broker figure.`**

Withdrawn from all three: *"it doesn't send an option's contract size either, so Convexa
reconstructed that from Webull's own totals"*, *"at a reconstructed contract size of ×100"*, and
*"a size Convexa worked out from Webull's own totals, not one Webull stated"*.

Also deliberately **absent**: any tolerance figure. The 0.5% round-trip bound is a backend guard
constant (`webull_adapter.py:174, 211-214`); the FE cannot vouch it and it would be the same class of
error one layer down. The tooltip names the mechanism ("Convexa's arithmetic, not a Webull figure"),
which is the whole of what the FE knows.

### Consequence for PM's ACs — a restatement of the same obligation, not a scope change

- **AC-9** currently requires the label to name *"what it rests on (a contract size Convexa
  reconstructed, not one Webull supplied)"*. Restate as: *the group's net-entry figure carries a
  visible basis label naming **who computed it**, and the label's tooltip names the **composition**
  (per-contract cost × contract size × contracts, signed).* → `review`.
- **AC-10** currently requires disclosure of the reconstruction gap. Restate as: *the copy discloses
  that the group net is Convexa's own arithmetic and may not match a total Webull displays.*
  → `review`.
- **New, and the one that has to be a test:** *no group-level string — label, tooltip, expanded
  sentence, accessible name — asserts where the contract size came from.* → `test` (negative space;
  a review pass cannot see a claim that is only wrong on a future feed shape). This is the same shape
  as the shipped `not recorded` and `unrealized_pl` scans.

---

## C5 — `no basis` and a group-level percent

**Raised by:** me · **Verdict: CONVERGED**, by the architect's own R2 self-revision. Recorded, not
reopened.

**Resolution.** `BrokerGroup` carries no `pl_pct`. The grouping layer computes no percentage, calls
no `plPctStateOf`, and holds no denominator, so **`no basis` is unreachable at group level by
absence rather than by rule** — which is the enforcement I wanted and the architect's own framing.
`no basis` remains reachable on leg rows exactly as today. My §5 note stands as a forward reservation
only: if a group percent is ever added, `no basis` is its literal for a near-zero net, and nothing
else is.

→ *Verify by:* `test` (source scan: the grouping module names neither `plPctStateOf` nor
`NET_BASIS_EPS`; negative space, silently regressing).

**One residue the withdrawal exposes, which is mine to rule.** With `plPctStateOf` uncalled,
`NET_BASIS_EPS` never applies at group level, so a group whose legs cancel renders its net as a
dollar figure — and the shipped direction word derives from `netEntryCost > 0 ? 'debit' : 'credit'`,
which makes an exact zero render as **`$0.00 credit`**. That is a false claim about direction on a
figure that has none. This case is live on this book's shape (a balanced debit/credit pair).

**Rule:** at group level, when the formatted magnitude is `0.00`, render **`$0.00`** with **no
direction word**. The direction of a zero net is not a fact. Child rows are untouched — this is a
group-level formatting rule only, and it does not alter the shipped per-row grammar.

→ *Verify by:* `test` (not present on the captured book; a reviewer would never encounter it).

---

## C6 — booleans cannot carry the withheld-net copy

**Raised by:** me · **Verdict: CONVERGED** — the architect accepted this in their R2 `agree` list and
added `legs_missing_basis`, `legs_unparseable_basis`, `legs_missing_multiplier` as integers alongside
the booleans. Nothing left to argue on the struct; below is the copy those integers drive, plus one
correction the group level forces.

### The correction: the shipped literal cascade has the precedence backwards, and grouping is what
### makes it reachable

The architect's note that it should be **one function called at both levels** is right, but the
function cannot be the shipped cascade as written. `brokerView.ts:207-216` reads:

```ts
const net_entry_text = !multiplier_known
  ? NOT_PROVIDED
  : withheldEntry
    ? anyUnparseableBasis ? UNAVAILABLE : NOT_PROVIDED
    : /* the figure */
```

On a **mixed** input — one leg's basis never supplied, another's unparseable — that returns
`unavailable`, i.e. **transient beats permanent**, the opposite of my §5 rule and of the architect's
§6.2. It has never mattered because every Webull position maps to exactly one leg, so the mixed case
is unreachable at position level. **A group of ≥2 legs makes it reachable for the first time**, and
it is the case where the wrong literal does real harm: `unavailable` sells the trader a refresh that
cannot work.

**Rule (the shared function, corrected):**

1. any leg's multiplier absent → **`not provided`**
2. else any leg's cost basis `not_supplied` → **`not provided`**
3. else any leg's cost basis `unparseable` → **`unavailable`**
4. else the figure

Applied at leg level this is **byte-identical to today's output** (steps 2 and 3 cannot both fire at
N=1), so adopting it as the shared function is a no-op on every shipped single-leg row and a
correction only where grouping newly reaches.

→ *Verify by:* `test` (invariant, unreachable on the owner's book, and it silently regresses if the
cascade is copied verbatim from `brokerView.ts` — which is the likeliest way it goes wrong).

### Final strings — withheld net

The rendered literal is the **highest-precedence** cause. The explanation line names **every**
non-zero cause count, in precedence order, so a two-cause group is not described as a one-cause
group. `{n}` is the cause count, `{m}` is `leg_count`. Never a leg's identity — "the short leg" is a
guess.

**`not provided` tooltip — cost basis never supplied** (replaces the shipped `notProvidedTip`, which
says "this position" and is wrong for a group):

> **`Webull's feed doesn't carry a cost for {n} of these {m} legs. Convexa won't show a partial
> total — each leg's own cost is below.`**

**`not provided` tooltip — contract size missing:**

> **`Convexa doesn't have a contract size for {n} of these {m} legs, so it can't turn their
> per-contract costs into dollars — and it won't guess one.`**

**`unavailable` tooltip:**

> **`Convexa couldn't read the cost Webull sent for {n} of these {m} legs, so it won't net them this
> cycle. Refresh for another read — each leg's own cost is shown below.`**

**Visible reason line inside the expanded panel** (replaces the C4 basis sentence whenever the figure
is withheld) — one clause per non-zero cause, precedence order, joined with a semicolon:

> **`Net entry needs all {m} legs. {n} has no cost in Webull's feed.`**
> **`Net entry needs all {m} legs. {n} has no contract size.`**
> **`Net entry needs all {m} legs. {n} couldn't be read this cycle.`**

Pluralization: `{n} has` / `{n} have`; `{m} legs` is always plural (a group is ≥2 by definition).

**PM AC-17** ("states how many of its legs are missing the fact") is satisfied by the count in the
rendered line, and the answer to my own R2 ask to PM is now fixed here: the **third cause is
`not provided`**, and its count says *contract size*, not *cost*.

→ *Verify by:* `test` for the count arithmetic and the cause-to-literal mapping (invariant, not
observable on the owner's book — my R1 assumption 9 stands: a `review` marking on these cases means
they are effectively unverified). `review` for the sentence wording itself.

---

## Summary for the synthesizer

| # | Verdict | One-line landing |
|---|---|---|
| C1 | CONVERGED | Group net = `Σ legCost` over the union of members' mapped legs; no `buildPositionView`, no `SimPosition`, no `structure.ts` import. No UX state is starved. The withheld literal is chosen by the per-leg gate before any number is formatted. |
| C2 | CONCEDED | Dedup withdrawn; member notes verbatim on expand; **and no group-level note line either** (architect's option b, not a). Expander accessible name carries what is behind the chevron. |
| C3 | CONCEDED | Option (c) withdrawn; group header's right rail carries the combined modeled P/L and nothing else; owner question is two options. |
| C4 | CONVERGED | Provenance clause **dropped** from all group-level copy — the adapter reads a broker-supplied `contract_multiplier` first (`webull_adapter.py:310-311`) and switches with no code change. Three final strings above; provenance survives in the per-leg backend notes. AC-9/AC-10 restated to composition-only; a new `test` AC bans the claim. |
| C5 | CONVERGED | No `pl_pct` on the group; `no basis` unreachable by absence. Residue ruled: a group net formatting to `0.00` renders **`$0.00`** with no direction word. |
| C6 | CONVERGED | Counts accepted by the architect. Plus: the shared literal cascade must be **corrected** — permanent beats transient — because a group makes the mixed case reachable for the first time; a no-op at leg level. Final withheld strings above. |

**No conflict in this pair is a product call in disguise.** C4's AC restatement is a wording change
to two ACs that keeps the same obligation and does not move scope; if PM reads it as a scope move,
that is a PM ⇄ UX matter, not an architect ⇄ UX one.
