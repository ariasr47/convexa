# outcome-ledger — PRODUCT_CONTRACT

> GATE B deliverable, targeted at the **UX/Tech-Writer**. Product layer ONLY: stories, scope,
> product behavior, acceptance criteria, copy intent. **NO code, no math derivations, no data
> structures, no endpoints, no payload/field names, no UI layout.** Self-contained against
> `.claude/PROJECT_CONTEXT.md` + `.claude/contracts/outcome-ledger/ARCHITECTURE_CONTRACT.md` —
> assume no chat history. The Architect ran first; its technical shape is **given** and is not
> re-scoped here. Every §9 open question is resolved in §4, in order.
>
> **⚠ AMENDED AT GATE Z ROUND 2 (2026-07-16) — one narrow ruling, targeted at the FRONTEND
> executioner** (who applies the Architect's A3 join fix + this ruling together). The amendment is
> confined to: **§4 "§11.6 — the ROLL ruling"** (new, the ruling of record) · **§4.6** (one exclusion
> reason's required content) · **§3 Out** (one line) · **AC-13** (extended) · **AC-E10** (extended
> cross-ref) · **AC-E19 / AC-E20 / AC-E21** (new) · **§7.19–§7.20** (new constraints) · **§9**. Every
> other decision, AC and constraint below is **unchanged and still locked**. **No pin was reopened; no
> amendment was bounced; the ruling needs ZERO architecture change.**

---

## 1. Goal (derived from the ARCHITECTURE_CONTRACT — not re-scoped)

Give the trader an **honest, self-describing readout of how their own recorded simulated decisions
actually turned out** — hit rate + per-trade return by tier, and (as it accumulates) by setup /
AI-rec / IV-rank band / persona — each with its **sample count, its uncertainty, its window, and its
basis** visible. It answers the one question the app cannot answer today: *is the opportunity score
any good?*

The product exists to make a **future, deliberate, human** score change possible
(`[score-change-is-deliberate-and-measured]`). **This feature never makes one, never suggests one,
and never speaks as if the app tunes itself.** It reads; it does not write into the score, does not
reach the server, and does not ride the AI.

**The primary product risk is not "no data" — it is a confident-looking number over 3 trades.** Every
decision below is subordinated to that.

---

## 2. Users & stories

Single user type: **the trader** (this app's owner, using the paper sim). Not an operator. Not a
diagnostician.

- **S1 — Trust a tier.** *As the trader, before I act on a Prime tier, I want to see how my Prime
  entries have actually closed, so I know whether "Prime" has earned my size.*
- **S2 — Trust an AI rec.** *As the trader, I want to see how the recs I took have closed, so I know
  whether "the AI said so" is worth anything.*
- **S3 — Trust a setup.** *As the trader, I want to see whether "pin confluence" (and each other
  setup) has paid, so I stop treating all setups as equal.*
- **S4 — Know when I don't know.** *As the trader, I want the readout to refuse to give me a number
  it cannot support, so I never mistake a lucky 3-for-3 for an edge.*
- **S5 — Know what wasn't counted.** *As the trader, I want to see what was left out and why, so the
  rate I'm shown is not quietly flattered by a filter I can't see.*
- **S6 — Not lose the history.** *As the trader, I want a complete backup of my trading history that
  I can actually restore, because this data only gets more valuable and lives in one browser.*
- **S7 — Know it's pretend.** *As the trader, I want to be told plainly that these are simulated
  fills, so I never read sim P&L as measured edge.*
- **S8 — Not be able to talk myself out of a loss.** *As the trader, I want a trade I rolled to count
  as the outcome it was, so "I didn't lose, I rolled" cannot quietly leave my record.* (Added at GATE
  Z round 2; it is the story the §11.6 ruling serves.)

---

## 3. Scope

### In (v1)

1. A **track-record readout** hosted on the Positions route, covering the user's own recorded,
   closed, simulated outcomes.
2. **Five cell families**: tier · AI-rec · setup · IV-rank band · persona (order per §4.2).
3. Per counted cell: **hit rate + its plain-language range + N + mean per-trade % return + its
   dispersion + the window dates + the basis class** — as one inseparable read.
4. The **`building` state** ("N of 20") for every cell below the floor — **no number**.
5. A **coverage statement** (counted vs recorded) always readable, with a **by-reason exclusion
   breakdown on demand**.
6. The **capture-epoch statement** ("we started recording entry context on {date}").
7. The **SIMULATED provenance + the sim-≠-real-fills disclosure** as part of the read.
8. The **advisory framing** + the multiplicity caution.
9. The **archive**: export (one file, all three stores) + a merge-only, confirm-gated, non-destructive
   import with a mandatory result report.

### Out (v1) — decided, not deferred by omission

- **Any suggestion, recommendation, or hint to change the score, the weights, or the gate
  threshold.** Not a button, not a copy line, not a "your Prime tier underperforms" nudge. The
  readout reports; the human decides; a separate feature changes the score.
- **A `modeled`-basis secondary cohort** (§4.4).
- **A "stale open" flag** (§4.3).
- **A window selector** (§4.11).
- **⚠ Any roll cohort, roll rate, roll exclusion, or roll count** — no "rolls only", no "rolls
  excluded", no per-cell "X of these were rolls", no roll reason in the breakdown (§4.17, the §11.6
  ruling). A roll is a **close**, not a category.
- **"Would the rec I rejected have worked?"** — a rejected rec produces no position, therefore no
  outcome. There is no counterfactual to measure. Rejections are **not** an outcome cohort and must
  not be presented as one.
- **A ticker-page widget.** The Ticker is a live decision surface; a static all-time history read
  there invites tick-by-tick misreading and duplicates the surface.
- **A new top-level nav destination** (§4.1).
- **Any operator/diagnostic framing.** Not on `/_ops/metrics`.
- Anything in the Architect's §8 non-goals 1–17 — inherited verbatim, not restated item by item.

### Future-dated (named seams — must not be precluded, must not be built here)

- **Partition by scoring-basis version** once one exists. Until then the all-time window mixes
  pre- and post-change outcomes — see the binding constraint in §7.4.
- **A per-tier hint on the Ticker page**, only once that cell is out of `building`.
- **A `modeled` cohort**, only if a product reason ever outweighs the confusion cost.
- **A rolling / selectable window**, only once cells survive being cut.
- **Direct-Accept AI-rec attribution**, if the shared-dialog prefill seam can carry the rec identity
  (§4.16).
- **Counting the rolled-INTO leg** — requires the roll to become a capture event (a write-side change
  that fixes only future records). Named, priced, and **explicitly not v1** (§4.17-B).
- **Feeding a digest of the ledger to the AI** — a separate feature, governed by
  `[digested-labels-not-raw-dump]`. Not v1.

---

## 4. Product decisions made here

Answering the ARCHITECTURE_CONTRACT §9, in order. Each is a decision, not a deferral. **§4.17
answers the ARCHITECTURE_CONTRACT §11.6** (bounced to me at GATE Z round 2).

**§9.1 — Where the readout lives.**
**The Positions route (`/positions`) hosts it, as its own named in-page view ("Track record"),
alongside the existing Simulated / Live tabs — not as a third broker-scoped tab, and not as a new
nav destination.** Rationale: the readout's spine is the user's closed sim history, which the
Positions page already owns; a new nav item advertises an answer that, on day one, is mostly
"building". **Not on the Ticker page. Not on `/_ops/metrics`.** The archive lives with it (it is the
same data's durability story). Exact placement/layout inside the route is the UX/Tech-Writer's call.
Reachable and fully readable **anonymously** (no auth gate — §4.13).

**§9.2 — Which cells ship in v1, and in what order.**
**All five ship**, in this priority order: **tier → AI-rec → setup → IV-rank band → persona.**
Tier leads because it is the BRIEF's question and the only family with retroactive data. The other
four ship in `building` from day one **on purpose** — an honest "we started counting on {date}" is a
product feature (it is the iv-rank precedent), and hiding them until they fill would hide the epoch.
Setup cells fan out per setup name (closed vocabulary).

**§9.3 — "Open / not yet counted", "never filled", "stale open".**
**Surface "open — not yet counted" and "never filled" as plain counts** inside the coverage
statement. They are counts, never rates, never a cohort. **No "stale open" flag** — "stale" has no
enforced definition in this product (nothing closes a position automatically), and inventing a
threshold here would be a fabricated judgment on the Positions page's data from a readout that is
supposed to only report.

**§9.4 — The `modeled` secondary cohort.**
**Not surfaced in v1.** A second set of rates that look identical to the headline but mean something
weaker is precisely the confusion this feature exists to prevent, and with thin volume it would
double the surface while halving the clarity. `modeled` outcomes are **counted and named in the
exclusion breakdown under their own reason** ("re-priced, not quoted"), never merged, never silently
dropped. Named future seam.

**§9.5 — The exclusion ledger's presentation.**
**A coverage statement is readable without interaction** (counted N of M recorded closed positions,
plus the open / never-filled counts). **The full by-reason breakdown is available on demand.**
Never fully hidden; never a silent drop. Silent exclusion is itself an honesty failure.

**§9.6 — Copy for the honest states (required content; UX may refine phrasing, may not drop a fact).**

| State | Must convey | Example wording |
|---|---|---|
| `building` | the count, the floor, that **no rate exists yet**, and why | "Building history — 7 of 20 closed trades. No hit rate yet: fewer than 20 outcomes can't tell luck from edge." |
| counted cell | rate + range + N + mean return + dispersion + window + basis, as one read | "Prime · 58% hit rate — plausibly 36–78% · 24 closed trades · avg +12% per trade (spread ±31pts) · Mar 4 – Jul 15 · quoted fills only" |
| range | a **plain range**, never a bare ± | "plausibly 36–78%" (the term "95% confidence interval" may appear secondary/on demand, never as the headline) |
| range still wide | that the answer is not yet decisive | "still wide — not a conclusion yet" |
| SIMULATED | that these are **simulated fills, not real ones**, with the named facts: no slippage, no partial fills, no queue position, no assignment, no commissions or fees, and a limit "fills" instantly at any size on a live cross | "Simulated fills. The sim has no slippage, no partial fills, no queue, no assignment and no fees, and a limit order fills instantly at any size. Sim P&L is not what a broker would have given you." |
| advisory framing | context, not a guarantee, not a forecast, not a scored signal; it does not and will not change the score | "Advisory context from your own recorded sim decisions. Not a guarantee, not a forecast, and not an input to the opportunity score." |
| multiplicity caution | many cells over few trades will throw up extreme-looking rates | "Across this many cells and this few trades, some cell will look extreme by chance. Read the range, not the headline." |
| hit definition | that a hit realized more than zero, that zero is not a hit and stays in the denominator, **and that a position closed by ROLLING is a closed position whose booked result counts like any other** (§4.17-A) | "A hit is a closed sim trade that realized more than zero. Zero isn't a hit — it stays in the count. Closing by rolling is closing: the leg you rolled out of counts as whatever it booked." |
| exclusion reasons | plain, non-accusatory, each distinct | **no entry record → must convey that there is no record of HOW THE POSITION WAS ENTERED — true of both the demo seed and a rolled-into leg. ⚠ It may NOT say "no decision was recorded": for a rolled-into leg a decision WAS recorded, it just was not an entry (§4.17-B). UX owns the words; this is the fact floor.** · not closed → "still open" · never filled → "order never filled" · unpriced basis → "entry or exit price was typed or modeled, not quoted" · modeled basis → "re-priced between quotes, not quoted" · scenario-sourced → "scripted test scenario — not a real decision" · unresolved join → "couldn't link to its decision — not counted" · malformed → "unreadable record — not counted" |
| pre-capture | the epoch, and that those outcomes still count for tier | "Recorded before {date}, when we started capturing entry context. These still count for tier; they have no setup / persona / IV-band / score context." |
| unavailable that cycle | that capture ran but the source was genuinely absent | "not available at entry" |
| storage disclosure | browser-local, no server backup | "Stored in this browser only — not tied to your account. Export an archive to back it up." |

**§9.7 — Expressing the Wilson interval to a non-statistician.**
**As a plain range around the rate, always adjacent to the rate, never as a bare ±, never hidden
behind an interaction.** Statistical vocabulary ("95% confidence interval") is permitted only as
secondary/on-demand detail. Additional product rule: **whenever the emitted range is wider than 20
percentage points, the cell carries a "still wide — not a conclusion yet" qualifier.** (This reads the
range the Architect already emits; it adds no math.) The rate must **never** be tinted, colored, or
iconified in a way that reads as good/bad — the range is the verdict, not the hue.

**§9.8 — "unknown (pre-capture)" vs "unavailable that cycle".**
**Two distinct labels, and neither is ever a cohort with a rate.** Pre-capture outcomes are reported
as a **coverage count per cell family** ("of your 34 counted outcomes, 30 predate capture"), tied to
the capture-start date. Captured-but-null reads as "not available at entry" on that outcome. An
"unknown" bucket must **never** be rendered as a cell with a hit rate — it is not a cohort, it is
missing context, and a rate over it would be meaningless.

**§9.9 — `N_min = 20`. ACCEPTED (with an additive product rule).**
The floor stays 20. The honesty at N=20 is carried by the **range**, not by the floor — at 20 trades
a 58% rate reads "plausibly 36–78%", which is self-evidently not a conclusion. Raising the floor
would leave the feature a pure counter for a year (thin sim volume) and would give the app **two
different N_min concepts**, when the user already reads "building history — N of 20" on the iv-rank
widget. One floor concept, one mental model. **Additive product rule:** the >20pp "still wide"
qualifier of §4.7 — so a barely-cleared floor never reads as a verdict.

**§9.10 — Hit = `realized_pl_dollar > 0`, strictly. ACCEPTED. No scratch band.**
A scratch band would require inventing a "near zero" threshold with no basis in this product (an exact
$0.00 realized P&L on a long option is a curiosity, not a category), and it would make the hit rate
non-comparable to any hit rate the trader has ever seen elsewhere. Zero is not a win; it stays in the
denominator. **Binding product consequence:** because a hit rate alone is trivially gamed by many
small wins and few large losses, **the hit rate may never be presented without its mean per-trade
return and dispersion**. A hit-rate-only read is a defect.

**§9.11 — All-time, non-rolling window. ACCEPTED. No selector in v1.**
Thin volume makes a rolling window starve every cell, and a selector would let the trader shop for
the window that flatters — the exact meta-decision failure this feature exists to fix. **The window
is stated, never silently applied**: every counted cell shows its first and last counted dates. A
selectable window is future-dated behind sample volume.

**§9.12 — The archive's product shape.**
- **Export:** user-initiated from the track-record surface. **Always available, including with zero
  records** (an empty archive is a valid archive and says so). One file, all three stores, stated as
  the complete backup. Filename stem follows the house convention: `convexa-archive-{YYYY-MM-DD}`.
- **Import:** user-initiated file pick, then a **mandatory confirm** that states, *before* anything is
  written: import **only adds** — it never deletes, never overwrites, and never replaces; re-importing
  the same file changes nothing.
- **Result report (mandatory, after every import attempt):** how many records were added, how many
  were skipped as already-present, how many collided and were **kept as-is**, and — on a declined file
  — the reason plus the explicit statement **"your existing data was not changed."**
- **No restore/replace mode. Ever, in v1.** A destructive restore is the one operation
  `[loss-free-durable-migration]` exists to forbid.

**§9.13 — Is the archive import gated? UNGATED in v1.**
There is no server surface here, so there is **no boundary at which a gate could be enforced**; an
FE-only gate would be decorative and is forbidden (`[server-side-gate-enforcement]`). The import
writes only into the user's own browser, creates no position, costs nothing, and reaches no server —
there is nothing state- or cost-bearing to gate. The honest options were a real server gate (which
would require the server store this feature deliberately declines) or none; **none** is correct. The
readout and the archive are therefore fully available anonymously, carrying the house browser-local
disclosure (§9.6).

**§9.14 (beyond the Architect's list) — Cell Ns are not additive.**
One closed trade can appear in several cells at once (its tier *and* its setups *and* its persona).
The readout must **never** show a total that sums cell Ns, and must state that a trade appears in
every cell it qualifies for.

**§9.15 (beyond the list) — The demo seed's exclusion is not a special case.**
The fabricated closed position with no decision record appears in the breakdown under the
no-entry-record reason, like any other record with no entry decision. No special copy, no mention of
seeding, no accusation. It simply never reaches a rate.

**§9.16 (beyond the list) — AI-rec attribution coverage must be stated if partial.**
If the direct-Accept path cannot thread the rec identity through the shared entry dialog (the
Architect's order-path-only fallback), the AI-rec family must carry a visible coverage statement:
recs taken as sim **orders** are attributed; recs accepted straight into an entry are **not counted
here**. An honest coverage statement, never a silent gap. If the seam *can* be threaded, the
statement is unnecessary and must be dropped.

---

**§9.17 / ARCH §11.6 — GATE Z ROUND 2 RULING (2026-07-16): what a ROLL means for the track record.**

**BOTH of the Architect's implemented defaults STAND. Nothing in §3.4 or §11.5 changes. No new
exclusion reason is created — the pre-named slot after `scenario_sourced` stays EMPTY and must not be
filled. No amendment is bounced back. This ruling costs the architecture zero.**

**A — the rolled-OUT leg (the leg that closed): COUNTED, as a plain outcome. Default STANDS.**
A rolled-out leg is a **real outcome**, not a continuation. The trader entered on a read, the position
resolved, a P&L was booked. The cell is keyed on the **entry**, and the cell's question is *"did
entering on this read pay?"* — a question the booked result answers regardless of what the trader did
with the proceeds afterwards.

Three reasons this is a ruling and not a shrug:
1. **"It's a continuation, not a loss" is the exact sentence this feature exists to refuse.** It is
   the most common self-flattering story in options trading — *I didn't lose, I rolled* — and a track
   record that accepts it is worthless at its one job. **S8.**
2. **The direction test.** Rolls happen under duress, so rolled-out legs skew to losses. Excluding
   them removes real losses from the denominator: the **flattering** direction. When in doubt, this
   feature does not flatter. (The Architect identified this; I am adopting it as the product rule, not
   merely deferring to it.)
3. **⚠ The decisive one, which the technical shape forces and which no one may undo without
   re-opening this ruling: the "continuation" has nowhere to land.** If leg A were excluded as a
   continuation, the continuation would have to be counted *somewhere* — but leg B is not counted
   either (B below), and cannot be. So a rolled entry would be **excluded on the way out and absent on
   the way in: it would vanish from the record entirely**, and selectively so, since rolls skew to
   losses. That is not a continuation. **It is a disappearance, and it disappears the worst trades.**
   Excluding leg A is only defensible in a product where the continuation is picked up; this is not
   that product.

**A2 — no roll category, in either direction.** Having ruled a roll is an outcome, it must be an
outcome *without an asterisk*. There is **no roll cohort, no roll exclusion reason, no per-cell "X of
these were rolls" count, and no roll filter** (ARCH §8 non-goal 15 already forbids the filter; this
extends the same logic to the count). A count of rolls beside a rate is a sub-cohort in everything but
name, and it hands the reader the mental subtraction — *"58%, but 5 of those were rolls, so really…"* —
that the ruling just refused. **Surfacing the roll count "for transparency" is the failure mode here,
not the safeguard.** The basis obligation (`[model-read-carries-its-assumptions]`) is discharged by
the **hit DEFINITION** (§4.6, AC-13): the read states that closing by rolling is closing, so the reader
knows what a hit counted. A definition, not a count.

**B — the rolled-INTO leg (the replacement), once it closes: NOT COUNTED. Default STANDS.**
It lands under the no-entry-record reason, as today.
- **I would rule this way even if it were free.** Leg B's entry is **not a scored decision** — it is a
  mechanical consequence of the roll, not a fresh judgment made against a score/tier read. This feature
  measures *entries made on a read*. Leg B is not one, so it is not evidence about the score. The
  technical price merely agrees with the product answer; it does not produce it.
- **The price, for the record, is why this is not reopened later on a whim:** admitting the roll as an
  entry event would make every historical rolled-into leg report as "predates capture" when capture in
  fact ran — **silently corrupting the very count A2 exists to make honest, unrepairably** (no
  backfill, ARCH §8 non-goal 6). Future-dated in §3, priced, not deferred by omission.
- **⚠ The one thing that MUST change is the WORDING, and it is a fact, not a preference.** Leg B's
  reason label currently reads *"no decision recorded"*. **For leg B that is false** — a roll decision
  *was* recorded; it simply is not an *entry*. The reason's own predicate is already "no **entry**
  decision record", so the label is under-describing its own rule: **a copy fix, needing no new reason,
  no new count, and no architecture change.** Required content is now in §4.6; **UX owns the words and
  must revisit this label.** This is the same species of defect UX already caught between AC-E1 and
  AC-E5 (telling a user with 400 trades "nothing has closed yet" because a store failed to read).

**B2 — the gap the user WILL notice, named so no one is surprised by it.** A rolled position shows up
as **one counted outcome (leg A)**, and then leg B — once it closes — shows up in the **exclusion
breakdown**. That is a visible, reported, by-reason outcome, **not a silent drop**, so §7.17 is
satisfied and the coverage statement needs **no new sentence about rolls**. But it has a consequence
the FE and UX must not misread: **the no-entry-record bucket is a LIVE, GROWING bucket driven by
ordinary user activity — not a rare demo-seed curiosity.** AC-E10 frames it around the seed; that
framing is now incomplete, and treating the bucket as near-always-zero would be wrong. **No
double-count exists** (leg A counted once; leg B never counted).

**Case-matrix delta for the FE** (against ARCH §11.5's enumerated list): **case 2 STANDS as written**
(roll close ⇒ counted) · **case 10 STANDS as written** (rolled-into leg ⇒ no-entry-record). The
Architect's fixtures are correct as pinned and **must not be edited**. What the ruling ADDS is the
negative space and the wording: **AC-E19 / AC-E20 / AC-E21** below. `unresolved_join` is unaffected.

---

## 5. Product behavior (summary)

- **Static, historical, always-on.** The readout does not move with the market, does not dim, does not
  refresh on a tick. It changes only when a position closes or an archive is imported.
- **A cell is either `building` (a count and no number) or counted (a number that arrives inseparable
  from its range, N, window and basis).** There is no third state and no bare number anywhere.
- **The readout always answers "what wasn't counted?"** before the user has to ask.
- **Closing by rolling is closing.** A rolled-out leg is an outcome like any other, with no asterisk
  and no separate count; the replacement leg is not an outcome, and its exclusion says so truthfully.
- **The readout never proposes an action.** It has no Accept, no Apply, no "suggested threshold", no
  score-tuning affordance of any kind.
- **The archive only ever adds.**

---

## 6. Acceptance criteria

Every AC is one observable behavior, checkable without reading code. QA traces each. Verification
method is per the risk-based rule (`.claude/agents/qa-verify.md` §4): an automated test where a silent
regression is plausible and invisible to review (the invariants, the negative space, the honest
states); review/QA where the behavior is visible and any change to it would be intentional (copy,
presence, ordering).

### Placement & framing

- **AC-1** — The track record is reachable from the Positions route and is fully readable there. It
  does not appear on `/_ops/metrics`, does not appear on the Ticker route, and adds no new top-level
  nav destination.
- **AC-2** — The readout is fully readable while signed out, and states that the data is stored in
  this browser only and is not tied to the account.
- **AC-3** — The readout carries the advisory framing: context from the user's own recorded sim
  decisions, not a guarantee, not a forecast, and not an input to the opportunity score.
- **AC-4** — The readout carries the SIMULATED disclosure naming all six facts: no slippage, no
  partial fills, no queue position, no assignment, no commissions/fees, and limit fills that are
  instant and unlimited in size on a live cross.
- **AC-5** — The readout carries the multiplicity caution (many cells over few trades will produce
  extreme-looking rates; read the range).
- **AC-6** — Nowhere in the readout is there a control, button, suggestion, or copy line that
  proposes changing the opportunity score, its weights, or the gate threshold.

### The counted read

- **AC-7** — A cell with at least 20 counted outcomes shows, together and without interaction: the hit
  rate, its plain-language range, N, the mean per-trade % return, its dispersion, the window's first
  and last dates, and that only quoted fills are counted.
- **AC-8** — No hit rate appears anywhere without its N, its range, its window and its basis.
- **AC-9** — No hit rate appears anywhere without its mean per-trade % return and dispersion beside
  it.
- **AC-10** — The per-trade return is labeled as a **mean per-trade percent return, size-unweighted**,
  and is never labeled or captioned as dollar expectancy.
- **AC-11** — The range is expressed as a plain range around the rate ("plausibly 36–78%"), not as a
  bare ±, and is not hidden behind an interaction.
- **AC-12** — A counted cell whose range is wider than 20 percentage points carries the "still wide —
  not a conclusion yet" qualifier.
- **AC-13** — The readout states the hit definition: a hit is a closed sim position that realized more
  than zero; a zero result is not a hit and stays in the denominator. **The stated definition also
  covers rolling: a position closed by rolling is a closed position, and its booked result counts as a
  hit or a miss like any other** (§4.17-A).
- **AC-14** — No rate is tinted, colored, or iconified in a way that reads as good/bad.
- **AC-15** — The five cell families are present in order: tier, AI-rec, setup, IV-rank band, persona.
- **AC-16** — The readout states that one closed trade appears in every cell it qualifies for, and
  shows no total that sums cell Ns.

### Coverage & honesty

- **AC-17** — A coverage statement is readable without interaction: how many closed positions were
  counted out of how many recorded, plus the "open — not yet counted" count and the "never filled"
  count.
- **AC-18** — The full exclusion breakdown by reason is available on demand, with each reason named in
  plain language.
- **AC-19** — The readout states the capture-start date and explains that outcomes recorded before it
  have no setup / persona / IV-band / score context.

### Archive

- **AC-20** — Export produces a single file covering all three stores, stated as the complete backup,
  with a `convexa-archive-{YYYY-MM-DD}` filename stem.
- **AC-21** — Export is available and succeeds when there is no history at all, and the result says
  the archive is empty.
- **AC-22** — Import requires an explicit confirm that states, before any write, that import only adds
  — never deletes, never overwrites, never replaces.
- **AC-23** — Every import attempt produces a result report: records added, records skipped as already
  present, collisions kept as-is.
- **AC-24** — Re-importing the same file reports zero added and leaves the readout's counted N, its
  rates and its coverage statement unchanged.
- **AC-25** — Import is not gated: a signed-out user can complete an import.

### Edge / degraded — each its own case

- **AC-E1** — **No history at all:** the readout renders an honest empty state explaining what it will
  answer once trades close. No error, no blank page, no zero-rate.
- **AC-E2** — **Below the floor:** a cell with 1–19 counted outcomes shows "N of 20" and **no rate, no
  range, no mean return** — nothing numeric that could be read as a result.
- **AC-E3** — **The 3-for-3 trap:** a cell whose only three counted outcomes are all winners shows the
  `building` state. The strings "100%" and "3 of 3 won" do not appear for that cell.
- **AC-E4** — **Day one (every cell building):** the readout still explains what it will answer, shows
  each cell's count against the floor, and contains no rate anywhere.
- **AC-E5** — **Corrupt / unreadable history:** the readout renders empty (or partial) with a stated
  reason. No thrown error, no broken page, the rest of the app unaffected, and the underlying stored
  data is not destroyed or rewritten.
- **AC-E6** — **One malformed record:** every other outcome is still counted, and the malformed one
  appears in the breakdown as an unreadable record. One bad record does not cost the other 99.
- **AC-E7** — **Typed or theoretical price:** an outcome whose entry or exit price was user-typed,
  theoretical, or last-known is excluded, appears in the breakdown under its own reason, and never
  contributes to any rate.
- **AC-E8** — **Re-priced (modeled) outcome:** excluded from every rate, named in the breakdown under
  its own distinct reason, and **not** presented as a cohort anywhere.
- **AC-E9** — **Scripted scenario outcome:** excluded from every rate and named in the breakdown as a
  scripted test scenario.
- **AC-E10** — **Closed position with no entry record** (including the dev/demo seed's fabricated
  winner): excluded, counted in the breakdown under the no-entry-record reason, never contributing to
  any rate — with no special-case copy about seeding. **This bucket is not seed-only: see AC-E20.**
- **AC-E11** — **Open position:** not counted in any rate; appears only in the "open — not yet
  counted" count. Its unrealized mark never moves a rate.
- **AC-E12** — **Cancelled / expired / never-filled order:** produces no outcome; appears only in the
  "never filled" count.
- **AC-E13** — **Pre-capture outcome:** counted in its tier cell, reported as pre-capture in the
  coverage of the setup / persona / IV-band / score families, and never rendered as an "unknown" cell
  with a rate.
- **AC-E14** — **Captured-but-unavailable:** an outcome where capture ran but a source was absent
  reads "not available at entry" — visibly distinct from pre-capture.
- **AC-E15** — **Declined import** (corrupt, unreadable, or wrong version): the file is not imported,
  the reason is reported, the report explicitly says existing data was not changed, and the readout's
  counted N and rates are identical before and after.
- **AC-E16** — **Import conflict:** a record in the file that collides with a differing existing
  record does not overwrite it; the existing record wins, the conflict is counted, and the report says
  so.
- **AC-E17** — **Stream drop:** on an SSE drop the readout renders **unchanged and un-dimmed** — no
  offline chip, no dimming, no stale treatment. It is a static read.
- **AC-E18** — **AI-rec partial attribution:** if rec identity cannot be threaded through the direct
  Accept path, the AI-rec family carries the coverage statement that only recs taken as sim orders are
  attributed. If it can be threaded, that statement is absent.
- **AC-E19** — **Rolled-OUT leg (the leg that closed):** a position closed by rolling, with a recorded
  entry and a quoted basis, **is counted like any other closed outcome** — it contributes to its cells'
  rates, it appears in no exclusion reason, and it carries no roll marker, badge, footnote or asterisk
  anywhere in the read. (§4.17-A)
- **AC-E20** — **Rolled-INTO leg (the replacement), once closed:** a closed position whose only
  decision record is the roll that opened it **is not counted in any rate**; it appears in the
  exclusion breakdown under the no-entry-record reason, **and that reason's wording is true of it — it
  conveys the absence of a record of how the position was entered, and does not claim that no decision
  was recorded.** (§4.17-B)
- **AC-E21** — **No roll category (negative space):** the readout contains no roll cell, no roll rate,
  no roll-specific exclusion reason, no per-cell or readout-level count of how many outcomes were
  rolls, and no roll filter or toggle. The only place a roll is named is the hit definition (AC-13) and
  the truthful exclusion wording (AC-E20). (§4.17-A2)

---

## 7. Constraints the next role (the FRONTEND executioner) must not violate

**Inherited promoted canon** (`PROJECT_CONTEXT.md` §5 — reopen only via GATE Z):

1. **`[model-read-carries-its-assumptions]` — the load-bearing one here.** A hit rate over 12 trades
   *is* a model read. **No number is renderable without its sample count, range, window and basis.**
   UX must not design a state, a summary, a hero, a tooltip, a chip, or a compact view that shows a
   rate alone. The Architect enforces this in the type (the `building` variant has no rate field);
   **do not design around it.**
2. **`[score-change-is-deliberate-and-measured]` — this feature is the ENABLER, never the exerciser.**
   No copy, control, or affordance may imply the app tunes itself or propose a score/threshold change.
3. **`[no-real-order-path]` — SIMULATED is part of the read, not a footnote.** The six named sim facts
   are a product-truth requirement. Do not shrink them into a "learn more".
4. **The all-time window will silently mix scoring bases the first time the score changes.** No
   scoring-basis version exists yet (Architect §8 non-goal 14). **Binding on the future score-changing
   feature, recorded here so it is not lost:** when the score/tier/gate changes, the tier cells become
   a mix of two bases and must be partitioned (or the window reset) at that time. v1 must not pretend
   otherwise, and must not invent a version.
5. **`[loss-free-durable-migration]` — the archive only ever adds.** No restore, no replace, no clear,
   no "start fresh". A declined import leaves the stores untouched and says so.
6. **`[server-side-gate-enforcement]` — no FE-only gate on the import.** A decorative gate is
   forbidden. Ungated is the decision.
7. **`[live-vs-static-isolation]` — static family.** Un-dimmed on a stream drop; no live inputs, no
   offline chip, no freshness treatment.
8. **`[best-effort-isolated-or-null]`** — corrupt/absent history yields an empty readout, never an
   error, never a broken page, never a disturbed bundle/SSE path.
9. **`[operator-vs-trader-path-separation]` — this is a TRADER surface.** Not a diagnostic. Not on
   `/_ops/metrics`. It nonetheless inherits that rule's read-only, side-effect-free discipline.
10. **`[digested-labels-not-raw-dump]`** — labels come from the authoritative wire enums through a
    closed lookup; never re-derived from an underlying scalar, and no raw series in the UI.
11. **`[theme-token-discipline]`** — theme/token-bound, zero hardcoded hex, dark/light parity is part
    of done. Note the interaction with **AC-14**: no semantic tinting of a rate.
12. **`[single-shared-sim-entry-dialog]` (SIM-ONLY)** — the AI-rec attribution wiring must not fork the
    shared entry dialog; the honest order-path-only fallback (AC-E18) is preferred to a fork.
13. **`[additive-keeps-score-byte-identical]` (HARD)** + **`NO_BACKEND_CHANGE`** — the `apps/api` diff
    must be empty.

**Product-level constraints originating here:**

14. **A hit rate never appears without its mean per-trade return and dispersion** (§4.10).
15. **"Unknown" is never a cohort.** Missing context is coverage, not a cell (§4.8).
16. **Cell Ns are never summed** (§4.14).
17. **No silent exclusion.** Every excluded record is reported by reason (§4.5).
18. **Copy facts in §4.6 are a floor.** UX may refine phrasing; it may not drop a fact or bury one
    behind an interaction that the table marks as non-interactive.
19. **⚠ A roll is a CLOSE, not a category** (§4.17, AC-E19/E21). The rolled-out leg counts as a plain
    outcome. Do **not** create a roll cohort, a roll exclusion reason, a roll badge, or a roll count —
    including "for transparency". The pre-named exclusion slot after `scenario_sourced` **stays
    empty**. The basis obligation is discharged by the hit **definition** (AC-13), not by a count.
20. **⚠ The no-entry-record reason's wording must stay true of the rolled-INTO leg** (§4.17-B,
    AC-E20): it conveys "no record of how this position was **entered**", never "no decision was
    recorded" (false for that leg). **FLAGGED FOR UX — UX owns the final words; this is the fact
    floor, not the copy.** Related: that bucket is **live and growing** from ordinary rolls, not a
    demo-seed curiosity — do not treat it as near-always-zero.

---

## 8. Amendments bounced to Architect

**Round 1 (GATE P·X) — two, both RESOLVED/ACCEPTED at GATE Z; retained for provenance only.** Neither
reopened a pin — the three GATE-Z-bounceable pins (`N_min = 20`, hit `> 0`, all-time window) are
**accepted** (§4.9 / §4.10 / §4.11).

**A1 — The exclusion ledger must also exist at the WHOLE-READOUT level, not only per cohort.**
*Why:* §3.4 placed the exclusion ledger "alongside every cohort". But the exclusions the product most
needs to report — no-entry-record, `not_closed`, `never_filled`, `scenario_sourced` — belong to
records that **never reach a cell at all**, so no per-cohort ledger can hold them. Without a
ledger-level roll-up, **AC-17 (the coverage statement) is unbuildable** and the demo-seed exclusion
(AC-E10) is unreportable.
**→ ACCEPTED at GATE Z** (ARCH §3.4.3), shape adjusted further than requested: the per-cohort ledger
was deleted, the populations split (P1/P2/P3), and a binding balance identity added.

**A2 — The read must carry the pre-capture COUNT per cell family, not only the capture epoch.**
*Why:* a date alone cannot answer the user's actual question. "We started capturing on Mar 4" is not
honest coverage; **"of your 34 counted outcomes, 30 predate capture"** is — it is the difference
between "this cell is new" and "this cell will be empty for a year". **AC-19 and AC-E13 need the
count**, and §9.8 cannot be presented without it.
**→ ACCEPTED at GATE Z** (ARCH §3.4.4), with four sharpenings (per-family placement; tier's
`pre_capture` is structurally 0; AI-rec's fourth count; `attributed` derived from the population).

**Round 2 (GATE Z, this pass) — NONE.** The §11.6 ruling (§4.17) is fully buildable on the current
technical shape: both defaults stand, no new exclusion reason, no new count, no shape change. The one
change it requires is **copy**, and it is flagged to UX (§7.20), not bounced.

---

## 9. Open questions

**None for the Architect.** §9.1–§9.13 are all resolved in §4, plus three the Architect did not ask
(§9.14–§9.16), plus the GATE Z round 2 §11.6 ruling (§9.17/§4.17) — **ruled, not deferred**.

**One item is FLAGGED FOR UX, not open:** the no-entry-record reason's label must be revised so it
stays true of the rolled-into leg (§7.20 / AC-E20). The **fact** is decided here; the **words** are
UX's. It needs no new reason, count, or architecture change.
