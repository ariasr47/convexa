# R1 — pm position: broker-option-grouping

## Position

### The one-sentence product

On the Broker tab, the option legs Webull reports for a single underlying collapse into **one row
that says how many legs there are and what they cost net**, expandable to today's leg rows unchanged
— and that row **names no structure, ever**, because naming one would be Convexa asserting a fact
its data cannot support about the owner's real money.

### User stories

- **S1 — Read the cost of a name, not of a leg.** As the owner reading my real Webull book, I want a
  ticker's option legs on one row carrying a leg count and a netted entry cost, so I stop adding
  per-leg costs in my head against a figure the app currently declines to compute.
- **S2 — Am I up or down on this name.** As the owner, I want the same collapsed row to carry the
  current modeled P/L for those legs together, so the position-management question is answered
  where the cost is stated rather than one row at a time.
- **S3 — Refuse rather than approximate.** As the owner, I want the app to withhold the net when it
  cannot compute it honestly, so a fact Webull never sent me never reaches me as a number.
- **S4 — Know exactly what the row claims.** As the owner, I want the group to be legible as
  *grouped by ticker*, never as *a trade*, so I never read a vertical into a row the feed cannot
  prove.
- **S5 — Lose nothing to the collapse.** As the owner, I want every position I can see today to
  remain reachable and accounted for after grouping, so compression never costs me visibility of a
  real holding.
- **S6 — Nothing else moves.** As the owner, I want the sim book, the Ticker page, scoring and every
  shipped broker failure state to behave exactly as they did before.

### Product behavior — the seven open calls, ruled

**1. Collapsed vs expanded.**
A **collapsed group row shows exactly five things**: the underlying ticker · the count of option legs
in the group · the group's **net entry cost** with its basis label · the group's **modeled P/L** with
its basis label · an expand control. It shows **no quantity** (summing 4 long against 4 short
produces either 8 or 0, and both are lies), **no percent return**, **no structure field of any kind
— not even `Custom`**, and no strike/expiry/right (there are none). **Expand reveals today's leg
rows unchanged** — same fields, same literals, same fidelity notes, same per-leg figures. The
default on every load is **collapsed**; the leg count is what makes the collapse safe to trust.

**2. The lone single-leg option (the NVDA call).**
It stays a **plain option row** — today's row, with the same leg-count affordance reading one leg,
and **no expander**, because there is nothing behind it to reveal. The count is shown on *every*
option holding, grouped or not; the **expander exists only at two legs or more**. A user reading
that row is entitled to conclude precisely one thing: *this Webull book reports one option leg on
NVDA.* Not "this is a single-leg trade" (Convexa does not know what trades exist), and not "this leg
is unpaired" (Convexa knows only what this feed returned). Rejected alternative: rendering it as a
group-of-one with a disclosure control that reveals a copy of itself — pure friction, and it trains
the eye to read the group shape as a claim about multiplicity rather than a fact about the ticker.

**3. Equities.**
**Excluded from grouping, absolutely.** An equity holding never joins an option group and is never
netted with one, and **no ticker-level figure spanning shares and option legs renders anywhere**.
The share cost and the option-leg cost are not summable into anything the owner can act on — the
multipliers differ, the exposures differ, and a combined figure would assert a relationship Webull
never reported. There is also nothing to group: Webull returns one equity row per ticker. If a
ticker holds both, the equity row and the option group render as two separate entries.

**4. The netted entry cost — one number, two labels.**
**One number, not a labelled pair.** A `net debit / net credit` pair is spread vocabulary and would
smuggle in through the label exactly the structure claim the feature bans. The single figure carries
**two labels**: *what it is* — the signed sum of the per-leg costs Webull itself reported for this
ticker's option legs — and *what it rests on* — a contract size Convexa **reconstructed** from
Webull's own cost totals, **not a figure Webull supplied**
(`[model-read-carries-its-assumptions]`).

The owner is entitled to conclude, from this number, **only**: *what the option legs Webull reports
on this ticker have cost me in total, net of credits, according to Webull's own per-leg cost
figures.* They are entitled to conclude **none** of: that these legs form one trade · that they were
opened together or will be closed together · that the number is Webull's own figure · that it will
match Webull's displayed cost to the penny.

That last one matters and is **new at group level**: the reconstruction is accepted to differ from
Webull's own aggregate by $0–$2 **per leg** (owner-ruled at broker-connect, guard tolerance). Summed
across a four-leg group, the visible difference is up to roughly four times what the owner saw
row-by-row at the live verify. This must be disclosed in the basis copy, not discovered.

**5. A leg with no cost basis at all.**
The group's net entry goes to its **withheld literal — never a partial sum, never 0, never blank**,
and it takes the group's modeled P/L with it (a P/L off a partial basis is worse than no P/L). The
five literals stay distinct and the choice is by cause:

- a leg whose cost the **feed never carried** ⇒ **`not provided`**;
- a leg whose cost was **supplied but unusable this cycle** ⇒ the **`unavailable`** family;
- **mixed causes in one group ⇒ `not provided` wins.** The permanent cause outranks the transient
  one, because a refresh that fixes the transient leg still cannot produce the net. Deterministic,
  never blended, never a sixth literal.
- **`not recorded` can never appear on a broker surface** — it is about *our* saved records, and a
  broker row has none.
- **`—` and `no basis` have no group-level occurrence in v1** (no percent return at group level ⇒ no
  denominator ⇒ no `no basis`); both remain reachable on leg rows exactly as today.

Beside the withheld net, the group states **how many of its legs are missing the fact**, and the legs
that *do* have costs still show them on expand. The owner must be able to see that the app is
**refusing to net**, not failing to read.

**6. Expand/collapse persistence.**
**Not persisted in v1.** It is ephemeral session state: it survives switching between the Broker and
Simulated tabs and — this part is load-bearing — **a manual Refresh does not collapse an expanded
group** (refreshing must never punish the user by resetting their view). It does **not** survive a
page reload or a new visit; every load opens collapsed, and **this feature introduces no new durable
storage key**. Three reasons: a durable key drags in `[loss-free-durable-migration]` for a
disclosure toggle; a remembered expansion for a group that no longer exists is its own stale claim;
and the collapsed default *is* the feature — persistence would let the owner drift silently back to
the pre-feature view. **Future-dated, not refused**: if real use proves it tedious, it lands as its
own change carrying the migration discipline it demands.

**7. `Build reassessment` after grouping — LEG LEVEL, never group level.**
The affordance stays on the **expanded leg row**, unchanged in behavior and export; the **collapsed
group row carries no reassess affordance and no disabled/coming-soon ghost of one**.

The reason is precedent, not taste. `positions-legs` already ruled that `position_eval` is
**suppressed for a multi-leg position and for a ticker holding more than one open position — "the
app does not evaluate a subject it cannot faithfully represent."** A broker group is precisely a
multi-leg subject that this feature *explicitly refuses to name*. Putting "reassess this" on it
would have the app offer to evaluate, in one gesture, the very thing it just declined to describe.
At leg level the behavior is already ruled honest (QA, broker-connect: the export's null option
subject *is* the disclosure), so leaving it there adds **no new claim** and costs one click.

Per the BRIEF this still routes to the owner at R3 as a single **product** question. My proposed
wording: *"After grouping, should `Build reassessment` sit on the expanded leg row only (my
recommendation — no new claim, matches the existing multi-leg suppression rule), or be removed from
broker option rows entirely?"* A group-level option is not offered, because it requires a subject
the app cannot name until contract detail lands.

### Scope

**In (v1)**
Broker tab only, **both form factors** (desktop rows and mobile cards — the shipped `ModeledPl`
desktop/mobile divergence makes a desktop-only grouping a regression, not a partial win) · grouping
option legs by underlying ticker · the collapsed row's five elements · expand to today's leg rows ·
the withholding discipline on both group aggregates · the two degradation axes applied to the group
aggregates · ephemeral expand/collapse · the `Build reassessment` placement ruling.

**Out (v1)**
Any structure name, chip, tooltip, accessible name, confidence measure, or `Custom` on a group ·
inferring pairs from matching quantity + opposite side (**rejected, not re-litigable**) · manual user
pairing (**rejected, not re-litigable**) · group-level quantity, percent return, greeks, breakeven,
max loss · grouping equity holdings or any cross-type ticker total · grouping on the Simulated tab ·
durable expand/collapse or any new durable key · group-level reassessment · any order/write
affordance · sorting, filtering, customizing or saved views over the broker book · any backend
change (`apps/api` diff must be empty).

**Future-dated (named, not built)**
Real structures the day a contract-detail lookup lands (§7z R7) — grouping **upgrades
automatically**, and only then may a group be named · durable expand/collapse, if usage proves the
friction · group-level reassessment, once the subject can be named · a per-group percent return,
once a signed near-zero denominator has a stated meaning · a combined equity+option ticker roll-up,
once the combined number has one.

### Acceptance criteria

Verification is risk-based (`qa-verify` §4): `test` where a silent regression is plausible or the
criterion is negative space; `review` for visible, intentional copy, presence and ordering. One
integration-level check may satisfy several rows — do not split a single behavior into an assertion
per row.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 | With the owner's real captured book served, every underlying holding ≥2 option legs renders as ONE collapsed row: the 9 loose option-leg rows become 5 ticker entries (4 collapsed groups + 1 lone leg). **Review arm (one-time, owner):** the tickers and leg counts on the tab match what the Webull app shows. | test + review |
| 2 | S1 | A collapsed group row displays the underlying ticker, the count of option legs in the group, the net entry cost with its basis label, the modeled P/L with its basis label, and an expand control. | review |
| 3 | S1, S4 | A collapsed group row displays no single quantity figure and no percent-return figure. | test |
| 4 | S4 | No trader-visible string produced by this surface — group heading, count text, tooltip, accessible name, or reassessment export — names a structure (vertical, spread, condor, butterfly, straddle, strangle, collar, iron, …), and a group renders no structure field at all, **including `Custom`**. | test |
| 5 | S5 | Expanding a group reveals the per-leg rows exactly as they render today: same fields, same not-a-number literals, same fidelity notes, same per-leg figures — nothing dropped, nothing added. | test |
| 6 | S5 | With every group collapsed, the sum of the groups' leg counts plus the ungrouped rows equals the position count the broker reported. Collapsing never makes a position unreachable or uncounted. | test |
| 7 | S1 | On every load of the Broker tab, all groups render collapsed. | review |
| 8 | S1 | A group's net entry equals the signed sum of the same per-leg entry figures shown on that group's expanded leg rows — the owner can confirm it by adding the rows they can see. | test |
| 9 | S1 | The group's net entry carries a label naming both what it is (the sum of Webull's own per-leg costs for this ticker's option legs) and what it rests on (a contract size Convexa reconstructed, not one Webull supplied). A group net-entry dollar figure with an unnamed basis never renders. | review |
| 10 | S1, S3 | The group's net entry is never presented as Webull's own figure, and the copy discloses that it can differ slightly from Webull's displayed cost because the contract size is reconstructed. | review |
| 11 | S2 | The group's modeled P/L equals the sum of the same per-leg modeled P/L figures shown on its expanded rows, and carries the `Convexa-modeled` basis label everywhere it renders. | test |
| 12 | S3 | If **any** leg in a group has a cost the feed never carried, the group's net entry renders `not provided` — never a partial sum, never 0, never blank. | test |
| 13 | S3 | When a group's net entry is withheld, the group's modeled P/L is withheld with the same literal and for the same reason; it never falls back to summing only the legs that have one. | test |
| 14 | S3 | A leg whose cost was supplied but unusable this cycle drives the group's aggregates to the `unavailable` family, textually distinct from `not provided`; neither state can be produced by the other's condition. | test |
| 15 | S3 | When legs in one group are withheld for different reasons, the group renders `not provided` (the permanent cause) over `unavailable` (the transient one) — deterministic, never blended, never a sixth literal. | test |
| 16 | S3, S4 | The only not-a-number literals reachable on a group row are `not provided` and `unavailable`. `—`, `not recorded` and `no basis` never render on a group row, and remain reachable on leg rows exactly as today. | test |
| 17 | S3 | Beside a withheld net, the group states how many of its legs are missing the fact, and the legs that do have costs still show them on expand — a refusal to net is visibly not a failure to read. | review |
| 18 | S3 | **Snapshot stale, mark feed up:** the group's leg count and net entry keep their last-known values under the stale treatment; the group's modeled P/L keeps updating and its label names BOTH bases (`modeled now · on your book as of {time}`). | test |
| 19 | S3 | **Mark feed down:** the group's modeled P/L dims to last-known (⏸) and never blanks; the group's leg count and net entry render un-dimmed and unchanged. | test |
| 20 | S3, S6 | In every state where no book is served — not connected, first sync, confirmed empty, unknown — the tab renders no group row, no leg count and no expander, and each state's shipped copy is unchanged. | test |
| 21 | S3, S6 | In the degraded and reauth states, the last-known served book still renders **grouped** beneath its banner; grouping never suppresses a served snapshot. | test |
| 22 | S4 | An equity holding never joins an option group and is never netted with one; no figure spanning shares and option legs renders anywhere on the tab. | test |
| 23 | S4 | A ticker with exactly one option leg renders as a single option row carrying its leg count and no expander; its entry figure is that leg's own figure, unchanged from today. | review |
| 24 | S5 | A cannot-fully-display (`unrecognized`) entry is never absorbed into a group, never hidden by a collapse, and never counted in a group's leg count; it renders as its own entry with its shipped treatment. | test |
| 25 | S5 | A manual Refresh that returns the same book leaves expanded groups expanded. | test |
| 26 | S5 | After a page reload, all groups render collapsed. | review |
| 27 | S5 | This feature introduces no new durable storage key: the app's durable keys are identical before and after expanding and collapsing groups. | test |
| 28 | S5 | A refresh returning a book that no longer contains a previously-expanded group renders without error and without a stray empty group. | test |
| 29 | S5, S6 | For the same book, mobile cards render the same groups, the same leg counts, the same net-entry figure and the same withheld literal as desktop rows. | test |
| 30 | S6 | `Build reassessment` renders on an expanded leg row only — never on a collapsed group row — with no disabled or coming-soon group-level variant; its behavior and export on a leg row are unchanged from today. *(Final placement is the R3 owner ruling; this is my recommendation.)* | review |
| 31 | S6 | The Simulated tab, the outcome ledger, the Ticker page and a served bundle's score / tier / `state_fingerprint` are identical before and after this feature, and the `apps/api` diff is empty. | test |
| 32 | S6 | The Broker tab still exposes zero order, trade, close or modify affordances — grouping adds none, including on the group row. | test |
| 33 | S5 | Group order is stable: the same book renders groups in the same order across re-renders and across a refresh returning the same book. | test |

**Blocks the ship:** 1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24,
25, 27, 29, 30, 31, 32. Every one of those is either the honesty line, the never-lose-a-position
line, or a no-regression line on a surface that reads real money.
**Does not block:** 2, 7, 23, 26, 28, 33 — presence, default state and ordering polish. Shipping
with 33 unmet is an annoyance; shipping with 12 unmet is a fabricated number about the owner's money.

## Risks I see

- **The compression will briefly read as loss.** The owner verified 13 rows one-by-one five days ago
  and trusts that view. The first load after this ships shows fewer rows than their Webull app. The
  leg count and AC-6 are the mitigation, but the first impression is a real risk and the copy should
  carry it.
- **The single netted number invites the exact inference the feature bans.** A ticker with two legs
  and one net cost reads as "this spread cost me $X" whatever the label says. Copy is a weak
  instrument against a strong visual affordance. My mitigations — no quantity, no structure field
  at all (not even `Custom`), a count phrased as legs rather than as a position — are deliberately
  blunt for this reason, and R2 should push on whether they are enough.
- **Two same-size spreads on one ticker.** The net stays arithmetically correct and answers a
  question the owner is not asking ("what did NVDA options cost me net") instead of the one they
  are ("what did *this* trade cost me"). The feature is honest and *less useful than it appears* in
  that case. I do not have a product fix short of contract detail; I want it named in copy rather
  than discovered.
- **The reconstruction gap compounds at group level.** Per-leg $0–$2 becomes up to ~$8 on a four-leg
  group when compared against Webull's own aggregate. This was accepted at leg scale; nobody has
  accepted it at group scale. If the architect's summing order can reduce it, that changes the copy.
- **The withheld-net cascade has never fired on the real book.** All 9 captured legs resolve. The
  first time one leg lacks a cost, an entire group's numbers vanish at once — which is correct and
  will look broken. AC-17 exists solely so that moment reads as a refusal.
- **Deferring persistence may be wrong within a week.** The owner opens this tab many times a day. I
  am trading a known small friction against a durable-key migration burden; if the trade is bad it
  will be obvious fast, and it comes back as its own change.
- **Scope creep by small asks.** A percent return, a group quantity, a "probably a vertical" chip —
  each is a one-line request that breaks a hard line. I have put each in Out explicitly so the
  refusal is on the record rather than re-argued at execution.

## Assumptions I'm making about the other two lanes

**Architect**

- Grouping is a **pure presentation layer over the existing broker book projection** — no new
  endpoint, no new wire field, no change to the served envelope, and an **empty `apps/api` diff**.
  If any of my ACs turns out to require a wire change, AC-31 and the BRIEF's feasibility call are
  both wrong.
- **Every option leg's ticker is already the bare underlying**, requiring no normalization,
  suffix-stripping or symbol parsing to group on. If any leg's symbol needs interpretation to yield
  a grouping key, then "grouping by underlying is a FACT" is downgraded to a derivation and my whole
  no-guessing framing needs restating.
- The per-leg entry figure my group sums is **exactly the figure already rendered on today's leg
  row** — same value, same rounding, same withholding — so AC-8's "the owner can add the visible
  rows" is literally true rather than approximately true.
- The **sign of each leg's contribution (paid vs received) is derivable from broker-supplied data
  without inference.** If a short leg's credit must be inferred, AC-8 is unbuildable and my position
  changes to withholding the net entirely — I would rather show `not provided` on all four groups
  than a net whose sign was guessed. This is the single assumption most likely to break my position.
- The existing per-leg cost fact **already distinguishes "the feed never carried it" from "supplied
  but unusable"** at field level, so AC-12/14/15 can pick a literal from a typed cause rather than
  from a bare absence.
- **Whether an entry is an option leg or an equity holding is a fact already on the model**, not
  something inferred from a multiplier or a price shape. AC-22 rests on this; if it is inferred,
  equity exclusion becomes its own guess.
- A **deterministic group order is derivable from the served payload** without new sort state or a
  durable key (AC-33 + AC-27 together).
- The architect will **not** make a structure recogniser reachable from a broker group "for free"
  because the leg list is now conveniently shaped like one.
- The group's modeled P/L can be assembled from the **already-computed per-leg modeled P/L**, so it
  inherits the shipped mark ladder and its two-axis behavior rather than introducing a second
  valuation path (AC-11, 18, 19).

**UX**

- The collapsed group and the expanded legs live in **one row-shape family shared by desktop rows and
  mobile cards**, so AC-29 is achievable without authoring a second component — the surface that has
  already diverged once.
- The **expanded leg row is the shipped row unchanged**, not a re-skin. If UX redesigns the leg row
  in this feature, AC-5 becomes unverifiable as written and I will want that split into its own
  change.
- **Both** a labeled net entry and a labeled modeled P/L fit on the collapsed row at the smallest
  supported width (the 393px no-overflow set). If only one fits, the **net entry stays** — it is the
  BRIEF's named deliverable and the static, always-renderable one — and I will raise the P/L's
  placement as an R2 conflict rather than silently drop either.
- UX accepts **default-collapsed with a visible leg count** as sufficient discoverability and does
  **not** propose persisted expansion in v1.
- UX treats the structure-name ban as covering **accessible names, tooltips and title attributes**,
  not only visible text (AC-4).
- The **lone single-leg option row sits in the same list flow as the groups**, not in a separate
  section, so AC-23's missing expander is the only visible difference between it and a group.
- UX will author the **withheld-net copy** (AC-17) and the **reconstruction-gap disclosure** (AC-10)
  as first-class strings, not as tooltip afterthoughts — they are the two places this feature is
  most likely to be misread as a bug or as a broker fact.
