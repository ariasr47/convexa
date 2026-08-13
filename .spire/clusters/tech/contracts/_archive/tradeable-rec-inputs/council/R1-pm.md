# R1 — pm position: tradeable-rec-inputs

## Position

### 0. The product problem, restated in one line

The rec is asked to return a max-risk figure, a position size, a target and a stop, and today the app
hands it **nothing that can produce those as numbers**. This feature does not make the AI smarter. It
makes the AI **answerable** — and, just as importantly, it makes the AI **checkable by the owner**,
because the moment a dollar figure appears next to the word "risk", the owner will believe it.

That second half is my central product call and the thing I expect the other lanes not to have
budgeted for: **we do not merely feed the model better inputs, we retain the owner's own numbers and
check the model's answer against them.** An AI that says "risk $900" when the owner's per-trade cap is
$400 must be *visibly over cap*, not silently trusted. The cheapest failure mode this feature can ship
is an authoritative-looking number nobody audited.

### 1. User stories

- **S1 — Tradeable strikes.** As the owner, when the rec names a strike and expiration, I want to see
  the actual bid/ask/mid and greeks of *that* contract, so I know it exists and what it costs before I
  act on it.
- **S2 — My own risk numbers.** As the owner, I want to tell the app my account size and my per-trade
  risk cap once, so the rec's sizing is expressed in *my* dollars instead of generic percentages.
- **S3 — What I already hold.** As the owner, I want the rec to know I already have open exposure in
  this underlying, so it does not size a second position as though the first did not exist.
- **S4 — What the market thinks is possible.** As the owner, I want the expected move implied by the
  ATM straddle for the expiration under discussion, so a target and a stop are arguable rather than
  invented.
- **S5 — Audit the AI.** As the owner, I want the app to tell me when the rec's dollar risk exceeds the
  cap I set, so I catch the one case where following the rec would hurt me most.
- **S6 — A better no-trade.** As the owner, when the verdict is no-trade, I want the liquidity and
  expected-move facts still in front of me, so "no trade" reads as an argued conclusion rather than a
  dead end.
- **S7 — Nothing moves real money.** As the owner, I want every one of these numbers to remain
  advisory sizing context that can only ever reach a simulated position behind a confirm.

### 2. Scope

**IN (this feature):**

1. A **candidate contract set** for the ticker — the contracts inside a ±15% strike band, restricted to
   the expirations in the trader's **active DTE/expiration window** — carrying the per-contract quote,
   greeks, IV and OI the snapshot already holds. Assembled on a **deliberate pull**, never added to the
   60-second polled bundle and never rendered as a standing chain table.
2. **Traceability of the rec's named contract**: for a produced trade rec, the quote and greeks of the
   exact contract it named, or an honest literal saying why they are absent.
3. An **owner-entered risk block** — account size + per-trade risk cap — stored per account behind a
   server-enforced write gate, clearable, and **disclosed** (these figures ride to the AI provider).
4. **Simulated open-positions exposure** for the ticker as sizing context, labelled simulated at the
   source.
5. **Expected move** from the ATM straddle for the nearest in-window expiration, self-describing
   (expiration, strike, anchor spot, basis) and framed as advisory.
6. The **cap check** — an annotation comparing the rec's dollar risk figure to the owner's cap, with an
   explicit "couldn't check" state.
7. **Loop closure**: the rec's suggested size flows into the existing simulated entry pre-fill, and the
   decision record additively captures whether a risk block was present at entry.
8. **Degraded states for every one of the above**, each distinguishable (see §4).
9. A **before/after verdict comparison artifact** produced as part of shipping (see AC-33).

**OUT (explicitly not this feature):**

- Any change to the opportunity score, tier, entry gate, state fingerprint, AI cooldown or daily cap.
  This is additive AI-context. `[additive-keeps-score-byte-identical]`.
- A **liquidity hard filter** (program item 5). A hard filter removes trades from consideration — that
  is a behavior change with its own before/after burden, not an input. It is a separate feature.
- Program items 6 (historical move distribution), 7 (local net GEX), 8 (gamma pockets), 9 (robust HV),
  11 (enforced DTE window), 13 (peak-GEX sign). Tier 2.
- **Real broker positions** as sizing context. The broker book is real exposure with its own
  unknown/partial honesty envelope; folding it into an advisory sizing input is a different-class risk
  decision and deserves its own scope. v1 counts the simulated book only, and says so.
- Any order, execution, broker-sizing or buying-power surface. `[no-real-order-path]`.
- The app computing multi-leg net debit/credit itself. The rec states its structure's risk; the app
  checks a **parseable dollar figure** against the cap and otherwise says it could not check.
- A full chain browser, a strike screener, or per-contract sorting/filtering UI.
- Accumulating expected-move history, or measuring implied-vs-realized accuracy.
- Feeding outcome-ledger base rates into the prompt (program item 23) — a deliberate v1 exclusion of
  the ledger, reversed only on purpose.
- Any new vendor call or new vendor spend.

**FUTURE-DATED (named, each with its trigger):**

- **Broker-book exposure as sizing context** — after the shipped broker book has been owner-verified in
  daily use for at least one full week, and as its own feature.
- **Expected-move accuracy tracking** — once ≥20 closed outcomes carry an expected-move stamp; joins
  the outcome ledger at its existing N-min floor.
- **Ledger breakdown by "sized under a risk block"** — at the ledger's existing 20-outcome floor; the
  capture ships now (AC-31) precisely so the breakdown is possible later without a backfill.
- **Richer risk model** (multiple accounts, per-strategy caps, buying power distinct from account size)
  — after the owner has lived with one account size and one cap for a month.
- **Liquidity gate (item 5)** — next in this program's order, as an explicit behavior-changing feature.

### 3. Product behavior (the rules the ACs enforce)

**R1 — Bounded, deliberate, not a dump.** The candidate set is bounded three ways: the ±15% band, the
active expiration window, and a cap on how many expirations are included. It is fetched only when the
owner does something deliberate (asks for a rec, or opens the hand-off export). It never rides the
polled bundle. This is the recorded resolution of the `[digested-labels-not-raw-dump]` tension and I
hold it as a hard product line: **if a passive page load ever carries a chain table, the resolution has
been abandoned.**

> **OPEN DECISION (owner):** the expiration cap. Proposed default — **the 4 nearest in-window
> expirations**. I am not inventing this as settled; a ticker like SPY has dozens of in-window
> expirations and "the whole window" is exactly the dump we forbade. The number is a product judgment
> and belongs to the owner.

**R2 — Never a fabricated number.** No dollar figure is ever derived from an assumed account size, and
no quote is ever synthesized from a model price when the NBBO is absent. Absence is stated, with its
reason. This is `[absent-is-not-none]` carried to the consumer, using the vocabulary already shipped in
`positions-legs` — I am asking for **three new reasons**, not a new vocabulary: *not in the candidate
set* · *no quote* · *not entered*.

**R3 — Quotes declare their basis.** Every candidate quote carries the snapshot's as-of and whether it
is a live-session or prior-close quote. A quote captured at 9 PM is a *last known* quote, and must not
be presented in the same voice as a 10:30 AM quote. Given the owner's evening usage pattern, this is
not an edge case — it may be the **majority** case.

**R4 — Wide quotes are visible.** An ATM straddle with a 40%-of-mid spread produces an expected-move
number that is mostly noise. The reading carries a wide-quotes marker and displays the threshold used.

> **OPEN DECISION (owner):** the wide-quote threshold. Proposed default — **quoted spread > 25% of
> mid**. Surfacing the decision rather than disguising a guess as precision.

**R5 — The cap check annotates, never blocks.** Over-cap is a warning that persists into the confirm
step of the simulated entry. It does not disable the action. The owner is an adult trading paper; the
app's job is to be impossible to miss, not to be a nanny.

**R6 — Sizing context is simulated context.** The open-positions summary is labelled simulated wherever
it appears, including inside the AI context. The AI must not reason about pretend exposure as if it
were real money.

**R7 — Consent before storage.** The risk-block entry surface states, before the first save, that the
figures are included in the context sent to the AI provider with each rec request. Account size is the
most personal number in this app. It must never appear on the operator route or in any export the app
offers besides the owner's own.

**R8 — The no-trade path is a first-class path.** Candidate liquidity and expected move render on a
no-trade verdict exactly as they do on a trade verdict. `no_trade` becoming *better argued* is the
stated success condition of this feature; a UI that hides the evidence on no-trade actively defeats it.

**R9 — The prompt's fixed floor gains one instruction, not a persona-variable one.** Any dollar risk
figure the rec states must name the contract and quote it was derived from. This belongs in the FIXED
floor (it is a schema-honesty rule, not a trader characterization), and the app's fallback when the
model ignores it is R2's honest absence — never a guess.

**R10 — The AI is not invoked more often.** Cooldown, daily cap and gate readiness behave exactly as
before. Better inputs are not a licence to increase call volume for a user who is prone to overtrading.

### 4. Acceptance criteria

Every row is observable without reading source. **Ship-blocking rows: AC-5, AC-9, AC-13, AC-16, AC-19,
AC-23, AC-26, AC-32, AC-33, AC-34.** `Verify by` is risk-based: `test` where a silent regression under an
unrelated change is plausible, `review` where the behavior is visible and intentional.

#### S1 — Tradeable strikes

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-1 | Given a produced trade rec naming a strike and expiration, the app displays that contract's bid, ask, mid and greeks taken from the same snapshot the rec was produced against. | test |
| AC-2 | Given a produced trade rec naming a contract that was **not** in the candidate set, the app displays the literal *not in the candidate set* — never a blank, a dash, or a price from elsewhere. | test |
| AC-3 | Given a produced trade rec naming a contract that **was** in the candidate set but has no NBBO, the app displays *no quote*, visibly distinct from AC-2's literal. | test |
| AC-4 | Given a narrower active DTE/expiration window, the candidate set for the same ticker contains strictly fewer expirations than under a wider window. | test |
| AC-5 | Given a ticker whose chain contains no contracts inside the band, the candidate set reports *none in band* (checked, empty); given a chain fetch or assembly failure, it reports *unavailable this cycle*. The two are distinguishable, and neither produces an error page — the rest of the ticker page keeps rendering. | test |
| AC-6 | Every candidate quote displays the snapshot as-of and whether it is a live-session or prior-close quote; loading the page outside market hours never presents quotes in the same voice as in-session quotes. | test |
| AC-7 | Loading and polling the ticker page with no deliberate action taken renders no candidate contract rows and issues no candidate assembly; the set appears only after asking for a rec or opening the hand-off export. | test |
| AC-8 | The candidate set covers no more than the agreed number of in-window expirations (R1's open decision); on a ticker with more in-window expirations than the cap, the surface names how many were included and that others were omitted by the cap. | test |

#### S2 — The owner's risk block

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-9 | A signed-in owner enters an account size and a per-trade risk cap, saves, reloads the app, and sees the same two values. | test |
| AC-10 | The entry surface states, visible before the first save, that these figures are included in the context sent to the AI provider with each rec request. | review |
| AC-11 | A zero, negative, or non-numeric entry is refused with a message naming the problem, and nothing is stored (reloading shows the previous values). | test |
| AC-12 | A per-trade risk cap larger than the account size is refused with a message; it is not silently accepted. | test |
| AC-13 | A save attempted without a valid session is refused **by the server** and nothing is stored, even when the client-side check is bypassed. | test |
| AC-14 | Signing in as a second account shows that account's risk block (or an empty one), never the first account's values. | test |
| AC-15 | Clearing the risk block succeeds, and the next rec produced afterwards reports *no account size entered* and shows no dollar sizing derived from an account size. | test |
| AC-16 | Given a signed-in owner who never entered a risk block, a rec still produces; its risk figures carry no account-derived dollar amount, and the surface names the absence as *not entered* rather than showing a dash. | test |
| AC-17 | The account size and per-trade cap appear on no operator/diagnostic route and in no export the app offers other than the owner's own settings surface. | review |

#### S3 — Existing exposure

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-18 | Given open simulated positions in the ticker, the rec context includes that exposure and the app names how many open positions were counted. | test |
| AC-19 | Given no open positions in the ticker, the context reports *none open* (checked, empty) — the fact is stated, not omitted. | test |
| AC-20 | Given the simulated positions store in its faulted state, the context reports *positions unavailable* and never *none open*. | test |
| AC-21 | Wherever the exposure summary appears — including inside the AI context — it is labelled simulated; with a broker connected, the surface still counts only simulated positions and names that limitation. | review |

#### S4 — Expected move

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-22 | Given a quotable ATM straddle in the nearest in-window expiration, the app shows an expected move as a ± dollar amount and as a percentage of the anchor spot. | test |
| AC-23 | The expected-move reading displays its expiration, the strike used, the anchor spot and its basis, and is framed as advisory context — never as a forecast or a guarantee. | review |
| AC-24 | Given either ATM leg without an NBBO, the expected move reads *unavailable — no quote* and shows no number; it is never computed from theoretical prices. | test |
| AC-25 | Given no expiration inside the active window, the expected move reads *unavailable — no expiration in window*, distinct from AC-24's reason. | test |
| AC-26 | Given a straddle whose quoted spread exceeds the agreed threshold (R4's open decision), the reading carries a wide-quotes marker and displays the threshold applied. | test |
| AC-27 | On a live-stream drop, the expected move keeps rendering un-dimmed while live-derived tiles degrade — it is a static read. | test |

#### S5 — Auditing the AI

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-28 | Given a rec whose risk figure is an unambiguous dollar amount and a cap that is set, the app states whether the figure is within or above the cap, showing both numbers. | test |
| AC-29 | Given a rec whose risk figure cannot be read as an unambiguous dollar amount, the app states *couldn't check against your cap* — it never shows a pass by default. | test |
| AC-30 | Given no cap set, the app shows no cap verdict at all (neither pass nor fail) and names the cap as not set. | test |
| AC-31 | An over-cap rec is still actionable: the entry flow opens, the over-cap warning is present at the confirm step, and the action is not disabled. | test |

#### S6/S7 — Loop closure and guardrails

| # | Acceptance criterion | Verify by |
|---|---|---|
| AC-32 | Given a no-trade verdict, the candidate liquidity picture and the expected move for the ticker are still displayed. | test |
| AC-33 | A recorded before/after comparison of rec verdicts exists across at least five named tickers **including one after-hours run**, every no-trade→trade flip is listed with the input the rec cited for the change, and the owner reviews it as a ship condition. | review |
| AC-34 | The opportunity score, tier and state fingerprint for a ticker are byte-identical with and without a risk block entered, and with and without candidates and expected move present. | test |
| AC-35 | The AI cooldown and daily-cap counters advance for a rec request exactly as they did before this feature; a gate-not-ready ticker is still gate-not-ready. | test |
| AC-36 | Acting on a rec creates only a simulated position behind the existing mandatory confirm; no order, broker or execution surface is added anywhere in this feature. | test |
| AC-37 | Given a rec that suggests no size, the entry pre-fill leaves the quantity at the minimum with a visible *size not suggested* note, rather than presenting a default as the AI's suggestion. | test |
| AC-38 | A position entered from a rec records whether a risk block was present at entry; positions entered before this feature remain readable and are neither altered nor destroyed. | test |
| AC-39 | The anonymous manual hand-off export includes the candidate set and the expected move, and reports the risk block as *not entered* — the section is present, not omitted. | test |

## Risks I see

1. **The stated failure mode of the whole program: more fields turn every no-trade into a trade.**
   AC-33 is the detector, and it is only as good as its sample. Five tickers in one afternoon of one
   regime will not detect it. My mitigation is the after-hours run plus the requirement that flips are
   *listed with their cited input* — a flip whose cited reason is "I now know the contract costs $2.10"
   is legitimate; a flip with no citable new input is the alarm.
2. **Fabricated precision.** An account size manufactures authority. "$412 max risk" derived from the
   mid of a contract quoted 1.20 × 3.00 is a fiction with two decimal places. R3 (basis) and R4 (wide
   quotes) exist entirely for this, and I expect pressure to drop them as clutter. I will defend them.
3. **Cap-check mis-parse.** "2% of account" parsed as "$2" and reported *within cap* is worse than no
   check at all — it converts an audit into false comfort. AC-29's refusal-to-parse is deliberate and
   should stay conservative: when in any doubt, say *couldn't check*.
4. **The dump line erodes.** The band is widened "just a little", the expiration cap is skipped for
   convenience, someone puts the set on the bundle because a second call felt wasteful. AC-7 and AC-8
   exist to make that visible; if either is softened, the invariant is gone in practice while still
   quoted in prose.
5. **Consent gap.** If the disclosure in AC-10 lands after the field rather than before it, the owner
   enters a real account size before learning it leaves the machine. This is the one row where wording
   placement is the product.
6. **Simulated exposure read as real.** If the label is applied only in the UI and not in the AI
   context, the model reasons about pretend positions as real risk. AC-21 names both surfaces on
   purpose.
7. **After-hours emptiness.** If the owner's dominant usage is evenings and most quotes are prior-close
   or absent, the feature can look broken on first contact. The honest-basis labels are the product
   here, and AC-33's after-hours run is where we find out.
8. **Latency.** The rec already takes seconds. If assembling candidates adds noticeably to that, the
   owner stops asking. I do not have a measured baseline to set a threshold against and will not invent
   one — **OPEN DECISION (owner/architect): the acceptable regression in rec round-trip time**,
   proposed as "no more than ~1s above today's measured baseline", to be confirmed against a real
   measurement rather than asserted here.
9. **Advice framing.** Dollar sizing tied to a real account size moves the product closer to the
   securities-counsel question already open in the threads. Keeping it *context for a simulated
   position*, never a standalone sizing calculator, is a product-scope guardrail, not just legal
   caution.
10. **Scope pressure toward the broker book.** Real positions are the more decision-relevant input and
    somebody will say so. I am holding it out of v1 deliberately; if a lane wants it in, that is a
    genuine `product` conflict for the owner, not a technical detail.

## Assumptions I'm making about the other two lanes

- **Architecture:** the candidate set for a ±15% band across the active window's expirations can be
  assembled entirely from the chain snapshot already fetched for the bundle, with **zero additional
  vendor requests**.
- **Architecture:** a contract that is absent from the snapshot is distinguishable from a contract
  present in the snapshot with no NBBO — the two states survive to the consumer rather than collapsing
  into one null. AC-2 and AC-3 fail without this.
- **Architecture:** the in-app rec can carry the candidate set into the **same single AI request** — no
  second model turn, no agentic tool loop — and the resulting context stays inside the model's window
  for the widest realistic ticker (SPY, full window, cap applied).
- **Architecture:** the ±15% band is anchored to the same spot the walls, flip and max-pain levels are
  anchored to, so a candidate strike and a level cited in the same rec are measured from one origin.
- **Architecture:** the account size and per-trade cap can live on the existing per-user settings record
  with a server-enforced write gate, requiring no new authentication surface and no new login state.
- **Architecture:** the expected move can be computed from the chain already in hand with no new fetch,
  and the presence of each ATM leg's quote is independently knowable (so AC-24 can name *which* side is
  missing if needed).
- **Architecture:** attaching all three new data families after scoring keeps score, tier and
  fingerprint byte-identical, by the same structural route the last four additive features used —
  AC-34 is a confirmation, not a hope.
- **Architecture:** the open-positions summary can reach the AI context from the client-local simulated
  book without that book becoming server state or a scoring input.
- **UX:** the rec surface can carry a per-contract quote line and a cap verdict without redesigning the
  risk-first hero — the verdict stays the first thing read.
- **UX:** the candidate set has an on-demand inspection affordance (disclosure, drawer, export) that is
  **not** a permanently rendered chain table, satisfying AC-7 without hiding the data from the owner.
- **UX:** Settings can host the risk block with its disclosure line placed **before** the input fields,
  and both fields individually clearable.
- **UX:** the existing not-a-number literal set can absorb three new reasons — *not in the candidate
  set*, *no quote*, *not entered* — as members of the same shipped vocabulary rather than a fourth
  parallel one.
- **UX:** an "above your cap" annotation can be rendered with warning semantics without borrowing the
  green/red reserved for signed price direction.
- **Both lanes:** no lane needs the risk block to work for anonymous users — asking for a rec already
  requires a session, so the anonymous path only needs AC-39's honest *not entered* state.
- **Both lanes:** nothing in this feature requires the outcome ledger to change its surfaces; AC-38's
  capture is additive and its presence is the epoch marker, exactly as the ledger's existing digest
  capture works.
