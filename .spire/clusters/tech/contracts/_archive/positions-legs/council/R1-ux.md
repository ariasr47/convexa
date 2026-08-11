# R1 — ux position: positions-legs

> Lane: component STATES + user-facing COPY + the DESIGN_RULES front-half. No server internals, no
> math, no endpoint/payload decisions beyond naming the fields the UI consumes. Ground truth read:
> `PositionRow.tsx` · `PositionCard.tsx` · `PositionsView.tsx` · `CustomizationToolbar.tsx` ·
> `PortfolioPanel.tsx` · `labels.ts` · `defaults.ts` · `derive.ts` · `types.ts` · `mark.ts` ·
> `TradeEntryDialog.tsx` · `mobile-no-overflow.cy.ts`. Binding: `.claude/DESIGN_RULES.md` +
> `convexa-design` skill + `docs/design/DESIGN_SYSTEM.md`.

---

## Position

### 0. The one-line thesis

**The ROW is the position. The LEG is a detail, one disclosure away.** Every hard question below
(mobile, shares, grouping, partial marks) resolves out of that one commitment, and every alternative
I rejected violates it.

---

### 1. How a multi-leg position renders in a dense table row

**Stand: exactly one `<tr>` per `SimPosition`, always — never one row per leg, never a `rowSpan`
ticker.** Legs surface in an *optional, ephemeral* disclosure row.

Rejected alternative (state it so R2 can attack it): one row per leg with a spanned ticker cell.
That is what most broker tables do, and it breaks three shipped behaviours at once — the group
subtotal (`derive.ts:subtotalOf`) would double-count a spread's legs, "sort by P/L" becomes
meaningless because a leg has no position P/L, and `excludedCount` ("N positions excluded
(unavailable)") starts counting legs while calling them positions.

**The `contract` cell (header stays `Ticker`; internal key `contract`) renders a two-part
STRUCTURE LINE:**

| Structure | Cell text |
|---|---|
| Single-leg option (today) | `TSLA` · `$400 Call` — **byte-identical to shipped** |
| Vertical | `TSLA` · `$400/$420 Call vertical` |
| Calendar / diagonal | `TSLA` · `$400 Call calendar · Jul 18 → Aug 15` |
| Iron condor | `TSLA` · `$380/$400/$440/$460 condor` |
| Covered call | `TSLA` · `100 sh + $420 Call` |
| Shares only | `TSLA` · `100 shares` |
| Unrecognised shape | `TSLA` · `4 legs` |

Binding rules on that cell:

1. **Never more than one line, never wrapping.** The cell keeps today's `whiteSpace: nowrap`. When
   the strike list would exceed the cell, it collapses to first-and-last: `$380…$460 condor
   (4 legs)`. The full list lives in the cell's tooltip **and** in the expansion — truncation never
   makes information unreachable.
2. **The ticker stays bold mono; the structure descriptor stays `text.secondary` at `0.8rem`** —
   the shipped hierarchy is correct and multi-leg must not promote the descriptor.
3. Expiry stays in its own `expiry` column for single-expiry structures. It appears inside the
   structure line **only** for multi-expiry structures (calendar/diagonal), where the `expiry`
   column then shows the **nearest** expiry with the multi-expiry tooltip (§4).

**The `strategy` column becomes `structure`** (header `Structure`, label map `STRUCTURE_LABEL`), a
**closed lookup** off the derived `StructureKind` — the FE never re-derives a label from leg shape
(`digested-labels-not-raw-dump`). An unknown/absent kind falls back to `Custom` + the leg count.
Rendered as today's outlined neutral chip: `divider` border, `text.secondary` ink. **No color.**

**The expansion.** A `⌄` disclosure `<button aria-expanded aria-controls>` sits at the right edge of
the `contract` cell, labelled by leg count for screen readers (`Show 4 legs of this TSLA iron
condor`). It renders **only when `legs.length > 1`** — a single-leg row gains no chrome at all.
Expanded, a sibling `<tr>` with `colSpan={columns.length + 1}` renders one indented line per leg:

```
│ Long   1 ×   $400 Call   Jul 18      $12.40   snapshot mid
│ Short  1 ×   $420 Call   Jul 18       $6.10   modeled
│ Short  1 ×   $380 Put    Jul 18   unavailable
```

- Side renders as the **word** `Long` / `Short` in `text.secondary`. Never `+`/`−`, never colored.
- Each leg carries its **own** mark + basis chip — this is where mixed-basis and partial-resolution
  truth lives (§5).
- **Legs carry no actions.** No per-leg Close, no per-leg Cancel. You cannot close half a spread in
  v1. (If the architect or PM wants leg-level close, that is an R2 conflict, not a detail.)
- **Expansion state is component-ephemeral** — it is NOT added to `ViewConfig`, is NOT part of a
  saved view, and does NOT survive reload. A durable expansion flag would fight density and would
  put a presentational toggle inside the store this feature is migrating.

---

### 2. The mobile card at 393px — the 4-leg condor

The 393px no-overflow rule is enforced e2e on `/positions` (`mobile-no-overflow.cy.ts:156`, both
color schemes). Below `md` the table is already forced to cards (`PositionsView.tsx:97`); multi-leg
does **not** move that breakpoint.

**Stand: a card's COLLAPSED height is identical for a 1-leg and a 4-leg position.** Leg count
changes one label and nothing else. The hard case is solved by not rendering the hard case until
asked.

Card anatomy at 393px (single column below `sm`, unchanged):

| Slot | Content | Behaviour |
|---|---|---|
| 1 — header | `TSLA` (mono 700, 1rem) + structure line (`text.secondary`, 0.85rem) · **`Iron condor` chip right-aligned** | structure line gets `minWidth: 0` + `textOverflow: ellipsis`; the chip never shrinks. *A flex child without `minWidth: 0` is the classic 393 offender — naming the mechanism, not just the rule.* |
| 2 — live block | big mono P/L + P/L% (left) · sparkline (right) | dims to `0.5` + the offline treatment, unchanged |
| 3 — footer | `Qty` · **`Net debit`/`Net credit`** · `Mark` · expiry | **exactly four items — this is the cap at 393px.** Multi-leg adds nothing; `Entry` is relabelled, not joined |
| 4 — disclosure | `4 legs ⌄` — full-width-left button, ≥44px hit target, `text.secondary` | absent for a 1-leg position |
| 5 — expansion | one line per leg, **stacked vertically**, `Long · 1 × · $400 Call · Jul 18 · $12.40` | never a horizontal mini-table; a table inside a 393px card is guaranteed overflow |
| 6 — actions | Close / pending affordance / closed summary, unchanged | |

Multi-expiry (calendar) on mobile: the footer's expiry slot shows the **nearest** expiry with a
`+1 more` suffix; both expiries are in the expansion. Never two dates crammed into the footer slot.

---

### 3. Shares alongside options in one table

**Stand: one table, one row shape, no separate equity treatment.** A second table for shares breaks
subtotals, grouping, sorting and saved views simultaneously.

**Stand: not-applicable renders `—` (em dash) in `text.disabled` with a plain-English tooltip.
Never blank, never `N/A`, never `0`.** Blank reads as a load failure; `N/A` is system voice;
`0` violates `unknown ≠ zero` twice over.

The load-bearing distinction — and I am binding it as a hard rule:

| Meaning | Renders | Tooltip |
|---|---|---|
| **Not applicable** (shares have no strike) | `—`, `text.disabled` | *"Not applicable — this position holds shares, which have no strike or expiry."* |
| **Not applicable** (multi-leg has no single strike) | `—`, `text.disabled` | *"Multiple legs — expand the position to see each strike."* |
| **Unavailable this cycle** (lookup failed) | the word **`unavailable`**, `text.disabled`, `data-testid="cell-unavailable"` | existing `ROW_UNAVAILABLE_TIP` |

Two different truths must never share one glyph. `—` and `unavailable` are already distinct in the
shipped code and I am making that distinction binding rather than incidental.

Per-column behaviour for an equity position: `strike` `—` · `right` `—` · `expiry` `—` · `dte` `—`.
The row's **`Shares` structure chip is what makes the dashes legible on the row itself** — the
tooltip is the second line of defence, not the first.

**`qty` becomes unit-aware.** Today the cell renders `{qty} ×`, which is meaningless for equity.

- Option position: `2 ×` (unchanged), tooltip *"2 contracts — 100 shares each."*
- Equity position: **`100 sh`**, tooltip *"100 shares."*
- Mixed structure (covered call): the **structure-level** unit — `1 ×`, tooltip *"1 covered call —
  100 shares plus 1 short call. Expand the position to see each leg's size."*

`PL_TIP` must be rewritten — it currently hardcodes the ×100 claim the feature exists to fix:

> **New `PL_TIP`:** *"Running gain/loss across every leg of this position, measured from your net
> entry. Each leg uses its own multiplier — ×100 for an option contract, ×1 for shares. Fees,
> slippage, assignment and taxes are not modeled. Green = gain, red = loss."*

---

### 4. Grouping and sorting when `strategy` becomes derived structure

**Group axis becomes `None · Ticker · Structure · Expiry`** (Expiry returns to the toolbar; it was
dropped at REVISION 2 and multi-expiry positions make it meaningful again).

Two axes are now ambiguous and both need an explicit, visible resolution:

- **Group by Expiry** uses the position's **nearest** expiry, and the group header says so:
  `Exp Jul 18 · nearest (3)`. Positions with no expiry go to a **`Shares · no expiry`** bucket.
  **Falsifiable invariant: every filtered row appears in exactly one group. Nothing is silently
  dropped from a grouped view, ever.**
- **Group by Structure** groups on the derived `StructureKind`, label from the closed lookup.

**Sort by `structure`** orders by a **declared canonical complexity order** — `shares → single leg
→ vertical → calendar/diagonal → butterfly/condor → custom` — not alphabetically by display label.
Sorting by the accident of an English name puts `Condor` next to `Covered call`; sorting by
structure puts simple things together and complex things together, which is how a trader scans a
book. (Deliberately arguable — attack it in R2 if you disagree.)

#### Saved views whose filter references `long_call` — the durable case

Saved views are durable and the governing invariant is HARD. **Stand: never silently drop, never
silently rewrite, never throw, never delete the saved view, and never write back on read.**

The behaviour, in order:

1. The migration maps every existing filter value forward where a forward mapping exists
   (`long_call` → the `StructureKind` a single long call derives to). A mapped view behaves
   identically to before and the user sees nothing.
2. Where **no** forward mapping exists, the filter on that axis **degrades to "no filter"** for
   rendering — the view still opens, still shows rows, never errors, never blanks.
3. The degraded view is **visibly flagged, not silently healed.** The view-picker entry shows the
   name + an `adjusted` marker; selecting it renders a one-line dismissible notice above the table:

   > **"'Tech swings' filtered on a strategy Convexa no longer has. That filter is off — everything
   > else in the view is unchanged. Save the view to keep it this way."**

4. That notice is **`info`-class, not `warning`-class** — `info.main` link color, no burnt orange,
   no warning icon. Nothing broke and no data was lost; dressing it as a warning would be dishonest
   in the other direction. (This is the one place I expect the design-token rule "warnings always
   carry an icon" to be *avoided by not being a warning*.)
5. **The store is not written until the user chooses to save.** Reading a view never mutates it —
   that is `loss-free-durable-migration` expressed at the UI layer, and it is why the notice says
   "Save the view to keep it this way" rather than "We fixed your view."
6. If the mapped filter matches zero rows, the existing `EMPTY_FILTERED` + `Clear filter` path
   applies. Never a blank surface.

**Column set:** the fixed set stays fixed; `strategy` → `structure` is the only change. `strike` and
`right` remain **single-leg-only optional columns** rendering `—` + the multi-leg tooltip on a
multi-leg row. I am adding **no new column** in this feature.

---

### 5. Partial mark resolution — one leg prices, another doesn't

This is the sharpest call in my lane and I will not hedge it.

**Stand: a position's P/L and net mark are shown ONLY when EVERY leg resolves. One unresolved leg
⇒ `unavailable`, never a partial sum.**

The reason is not incompleteness, it is **sign inversion**. A partial sum of a spread is not a
smaller number — it can be the *wrong direction*. Drop the short leg from a credit spread and a
losing position renders as a winner. `unknown ≠ zero` is exactly this: a missing leg silently
contributes zero, and zero is a lie with a plus sign on it.

Concretely:

- **`pl` / `pl_pct` cells** render the existing literal `unavailable` with the existing
  `data-testid="cell-unavailable"` and a **new, more specific tip**:
  > *"1 of 4 legs couldn't be priced this cycle. A partial spread price would be wrong, not just
  > incomplete — so no P/L is shown. Your other positions are unaffected."*
- **`mark` cell** renders `unavailable` under the same all-or-nothing rule.
- The row is **excluded from the group subtotal and counted** — the shipped
  `· N positions excluded (unavailable)` copy already does exactly this and **must survive the
  refactor unchanged**.
- **The expansion is where the partial information lives.** Resolved legs show their marks;
  the failed leg shows `unavailable` on its own line. Nothing is hidden — it is just never
  aggregated into a misleading total.
- **Weakest-basis rule for a resolved net mark:** when legs resolve on different bases, the row's
  basis chip shows the **weakest** basis in the ladder (`snapshot` → `modeled` → `theoretical` →
  `last_known`), because a net price is only as honest as its shakiest leg. Its tip appends:
  > *"Legs priced on different bases — this net uses the weakest (theoretical). Expand the position
  > to see each leg."*
- **Offline (`streamOffline`) is unchanged and must stay byte-identical in behaviour**
  (`live-vs-static-isolation`): the whole live block dims to `0.5`, `⏸ offline` appends, basis goes
  `last_known`, the group header carries `⏸`, and the toolbar banner reads *"⚠ Live marks paused —
  P/L shown is from the last update. Records persist."* Static cells (structure line, qty, net
  entry, expiry, status) never dim. **Offline is not the same state as partial-unavailable and the
  two must never render alike** — offline is dimmed-but-showing-a-number; partial is showing a word.
- **Loading (cold)**: skeleton. **Pending limit**: `—` + `PENDING_PL_TIP`, unchanged. Four distinct
  states — skeleton ≠ offline ≠ unavailable ≠ pending — as `convexa-design` rule 3 requires.

---

### 6. Copy — net debit vs net credit

**Stand: the word "Cost" is retired from every surface that can show a credit.** It is currently in
`TradeEntryDialog.tsx:833/859/911` and it reads wrong for money you received.

| Surface | Today | New |
|---|---|---|
| `entry` column header | `Entry` | **`Net entry`** |
| `entry` cell, debit | `$8.40` | **`$8.40 debit`** |
| `entry` cell, credit | *(unrepresentable)* | **`$1.15 credit`** |
| Card footer | `Entry $8.40` | **`Net debit $840`** / **`Net credit $115`** (position total, matching the dialog) |
| Dialog, manual | `Opens at your price $8.40 · Cost $840 — user-entered, not a market quote.` | `Opens at your price $8.40 · **Net debit $840** — user-entered, not a market quote.` |
| Dialog, credit structure | — | `Opens at your price $1.15 · **Net credit $115** — you receive this at open.` |
| Dialog, market | `Fill: mid 8.40 · Cost 840 (mid …)` | `Fill: mid $8.40 · **Net debit $840** (mid × 100 × qty)` |
| Dialog, limit | `Fills at your limit $8.40 · Cost $840 (price × 100 × qty)` | `Fills at your limit $8.40 · **Net debit $840**` |
| Confirm button | `Open simulated position` | **unchanged** — an action's name never changes per case (DESIGN_RULES §6) |

The qualifier word is **derived from the sign, never from the structure name** — a "vertical" can be
either. **No abbreviation** (`Dr`/`Cr`/`db`) — abbreviating into an 11px floor is a slop tell and the
full word `debit` costs six characters in an already-narrow-friendly column.

New glossary entries (`labels.ts`):

- `NET_ENTRY_TIP` — *"What this position cost or paid you to open, netted across every leg. A **net
  debit** is money you paid. A **net credit** is money you received — your risk is what you can
  still lose, not what you paid."*
- `STRUCTURE_TIP` — *"The shape Convexa reads from your legs — it is derived from the position, not
  something you chose or something we store."*
- `LEGS_TIP` — *"The individual contracts (and shares) that make up this position. Each is priced on
  its own; the position's P/L is the net of all of them."*
- `SHORT_LEG_TIP` — *"A leg you sold. Assignment, early exercise and margin are not modeled —
  this is paper."* (Honesty, and it belongs in the read, not a footnote.)

**P/L sign convention is unchanged:** a credit spread decaying in your favour shows a **positive**
P/L in green. A credit is not "negative cost" in the P/L cell. `money()`/`pct()` formatters are
untouched.

---

### 7. Green/red reserved for direction only

`convexa-design` rule 2 + `DESIGN_SYSTEM` palette rule 2. The proximity-chip regression is the
precedent: a semantic-looking axis tempted a directional palette and shipped wrong.

**On the positions surface, `success.main` / `error.main` appear in exactly three places, all of
them signed dollar direction:** the `pl` cell, the `pl_pct` cell, and the group subtotal (plus the
sparkline stroke and the `ClosedSummary` realized figure, which are the same datum). Nothing else.

Explicitly **NOT** colored, each one a real temptation:

| Datum | Why the tint is banned |
|---|---|
| Structure chip (`Iron condor`, `Shares`) | not a direction; also not amber — amber is spent on the one CTA on this page |
| Leg side (`Long` / `Short`) | **the exact proximity-chip class** — a short leg is not a loss, and a red `Short` one cell from a red P/L is a direct misread |
| `Call` / `Put` in the leg list | the palette table reserves green/red for "calls/puts" in the **GEX-chart** domain; importing that convention into a P/L table puts a green `Call` beside a red P/L. **I am binding: no call/put tint in positions.** This is a deliberate divergence from a literal reading of `DESIGN_SYSTEM.md`'s palette-role column and I want it argued in R2, not discovered at GATE Q |
| `debit` / `credit` | a credit is money received, not a gain; tinting it green manufactures a verdict |
| `unavailable` / `—` / offline tags | `text.disabled` only — a degraded state is never directional |

Suggested structural guard for the FE lane (a `test`-class case, invisible to review, silently
regressing): **className identity** between a `Short` leg label and a `Long` leg label, and between a
`credit` and a `debit` entry cell. Testing-gotcha carried from the skill: MUI `sx` compiles to
classes — assert className identity, never `getAttribute('style')`.

---

### 8. Design direction (DESIGN_RULES §1.1–§1.4 → SPEC.md §4)

**1. The brief, pinned.**
- **Subject:** a **book of option structures and shares** — the thing a trader is actually carrying
  overnight, not a list of contracts.
- **Audience:** a swing trader who lives in a dark broker terminal and assumes a dashboard is lying
  until it proves otherwise.
- **Single job of the surface:** *answer "what am I carrying and what is it worth right now" in one
  glance — without ever implying a number is live, complete, or real when it isn't.*

**2. Structure before style (no color, no type yet).**
- Row = position. Leg = detail behind a disclosure. Group = a subtotal-bearing container.
- Left→right, each row answers in order: **what it is** (ticker + structure) → **how big** (qty) →
  **what I paid or received** (net entry) → **what it's worth** (mark) → **am I up** (P/L, P/L%,
  Δ since entry, trend) → **when does it end** (expiry).
- Semantics: real `<table>`/`<thead>`; the expansion is a sibling `<tr colSpan>` driven by a
  `<button aria-expanded aria-controls>`; on mobile a list of cards, each leg list a `<ul>`. Stat
  values are **never headings** (canon rule 6 — the 29-`<h6>` ticker page is the documented
  failure). Every disclosure is keyboard-reachable with a visible authored `:focus-visible` ring.

**3. Token plan (no new tokens — this feature adds zero values to `tokens.ts`).**
- **Color, 5 named values:** `text.primary` (structure line + figures) · `text.secondary` (leg
  detail, qualifiers, chip ink) · `text.disabled` (`—`, offline tags, `unavailable`) ·
  `success.main`/`error.main` (**P/L direction only**) · `divider` (chip borders, the leg rule).
  Plus `info.main` for the saved-view notice link (existing link-class rule) and **`primary.main`
  exactly once — the "+ Open simulated position" CTA, unchanged.** The disclosure chevron does not
  earn amber.
- **Type:** IBM Plex Mono `tabular-nums` for every figure including strikes and leg marks —
  `0.86rem` in table cells, `0.8rem` in leg lines (both above the 11px floor); IBM Plex Sans for
  labels and chips; **no display face on this surface**.
- **Layout, one sentence:** *one dense row per position carrying a single truncating structure line,
  plus one indented leg block that appears only when asked.*
- **Signature:** **the leg block's left rule** — a 1px `divider` vertical rule indenting the legs
  beneath their parent position, so a spread reads as *one object with parts* rather than four loose
  rows. It is the only new visual idea in the feature and it costs zero color. **Deliberately not an
  arc** — the arc is set-pinned to three importers and a fourth fails the build (`arc.spec.ts`).

**4. Self-critique — the default I would have produced, and what I changed.**

| The default | Why it's slop | What I did instead |
|---|---|---|
| One row per leg, `rowSpan` ticker | what every broker table does badly; double-counts subtotals, kills sort-by-P/L | position-as-row + ephemeral disclosure |
| Green `Call` / red `Put` in the leg list | reflexive domain color; the proximity-chip regression exactly | no tint on any leg attribute |
| Amber chevron / amber structure chip | "make the new thing feel branded" — amber is *spent*, not sprinkled | `text.secondary` chevron, `divider` chip |
| Show a partial P/L when 3 of 4 legs price | "some information beats none" — false here, it can invert the sign | all-or-nothing at the display layer; per-leg truth in the expansion |
| `Cost` everywhere | inherited word, wrong for a credit | `Net debit` / `Net credit`, derived from sign |
| `N/A` for a share's strike | system voice | `—` + plain-English tooltip, kept distinct from `unavailable` |
| Silently drop the stale `long_call` filter | silence is the exact failure mode this app is built against | a visible, dismissible, **non-writing** notice |
| A second table for equity | "different thing, different table" | one table; the `Shares` chip does the work |
| An accordion animation on expand | a second "wow" moment; `single-motion-moment.spec.ts` set-equality | instant disclosure, no keyframe |
| **The accessory I cut:** a per-leg P/L column inside the expansion | it invites the exact partial-sum reading §5 bans, and quadruples the mobile line length | legs show **mark + basis** only; P/L exists only at the position level |

---

### 9. Acceptance criteria → component states → `Verify by`

`Verify by` is marked per the risk-based rule (`qa-verify` §4): `test` where a regression is
plausible **and** invisible to review (invariants, negative space, state behaviour that breaks as a
side effect of an unrelated refactor); `review` where the change would be visible and intentional
(copy, presence, ordering). No named test is demanded for any AC.

| # | Acceptance criterion | Component state(s) that satisfy it | Verify by |
|---|---|---|---|
| U1 | A multi-leg position renders as **exactly one** table row; leg count never changes the row count | default (table) | `test` |
| U2 | The structure line reads per the §1 table for single-leg / vertical / calendar / condor / covered call / shares, and a single-leg row is **unchanged from shipped** | default | `review` |
| U3 | The structure line never wraps and never overflows its cell; an over-long strike list collapses to `$380…$460 (4 legs)` with the full list in tooltip + expansion | default, dense | `review` |
| U4 | The disclosure appears only when `legs.length > 1`; expanding reveals one line per leg with side-as-word, size, instrument and per-leg mark + basis | default, expanded | `review` |
| U5 | Expansion state is ephemeral — it is absent from `ViewConfig`, never persisted, and gone after reload | default | `test` |
| U6 | At 393px, a 4-leg condor card's **collapsed height equals** a 1-leg card's, and `/positions` keeps `scrollWidth ≤ innerWidth` in both color schemes | mobile default | `test` |
| U7 | A shares position renders `—` (not blank, not `N/A`, not `0`) in strike/expiry/right/DTE, carries a `Shares` structure chip, and its qty reads `100 sh` | default, equity | `review` |
| U8 | `—` (not applicable) and the word `unavailable` (failed this cycle) are never rendered for each other's meaning | default, error(row) | `test` |
| U9 | When **any** leg's mark is unresolved, the position's P/L, P/L% and mark all render `unavailable`; **no partial sum is ever displayed** | error(row) / partial | `test` |
| U10 | A position excluded for U9 is omitted from the group subtotal and counted in `· N positions excluded (unavailable)` — never summed as zero | default, error(row) | `test` |
| U11 | With mixed leg bases, the row's basis chip shows the **weakest** basis and its tip names the mixing | default, stale | `review` |
| U12 | On an SSE drop the live block dims + `⏸ offline` + `last known` while structure line, qty, net entry and expiry keep rendering undimmed — behaviour unchanged from shipped | offline | `test` |
| U13 | Skeleton, offline, `unavailable` and pending-limit are four visually distinct states and never render alike | loading, offline, error, pending | `review` |
| U14 | No surface reads `Cost`; a debit shows `Net debit`, a credit shows `Net credit`, derived from sign; the confirm button label is unchanged | default, dialog | `review` |
| U15 | Green/red appear **only** on P/L $, P/L %, the subtotal, the sparkline and the realized summary — structure chips, leg sides, call/put and debit/credit are untinted | default | `test` |
| U16 | A saved view whose filter references a value that no longer exists **opens**, shows rows, flags itself `adjusted`, shows the §4 notice, and **does not write to the store** until the user saves | default, saved-view degraded | `test` |
| U17 | Grouping by Expiry puts every filtered row in exactly one group, uses the **nearest** expiry with the header saying `· nearest`, and buckets equity as `Shares · no expiry` | grouped | `test` |
| U18 | Group axis reads `None · Ticker · Structure · Expiry`; sort-by-structure follows the declared complexity order, not alphabetical | default | `review` |
| U19 | The disclosure is keyboard-operable with a visible `:focus-visible` ring and correct `aria-expanded`/`aria-controls`; leg text is ≥11px; mobile hit targets ≥44px | default, focus | `test` |
| U20 | Expanding, collapsing, grouping, sorting and switching views trigger **no fetch and no store write**, and nothing on this surface can reach a real order path | default, all | `test` |

---

## Risks I see

1. **The partial-mark rule will feel like a regression to whoever built it.** "3 of 4 legs priced,
   why won't you show me anything?" is a legitimate complaint and the pressure to relax U9 into a
   partial sum with an asterisk will be real. It must not be relaxed. The mitigation is the
   expansion: per-leg truth is fully visible, it is only the *aggregate* that is withheld.
2. **The truncated structure line silently becomes the primary identifier.** If truncation is
   implemented as CSS ellipsis on a nowrap cell without the explicit first-and-last collapse rule,
   a condor renders `$380/$400/$44…` — which looks like data, not truncation. The collapse must be
   authored in the string, not delegated to overflow.
3. **393px is enforced but only on the routes' cold render.** The e2e visits `/positions` and
   asserts `scrollWidth`. It does **not** expand a leg block. A 4-leg expansion could overflow and
   the shipped guard would stay green. Whoever writes the FE case has to expand before asserting.
4. **Two "not a number" states, one em dash.** U8 is the AC I most expect to regress quietly.
   `text.disabled` `—` and `text.disabled` `unavailable` differ by *text*, not by treatment — one
   well-meaning "let's shorten the unavailable cell" and the distinction is gone.
5. **The `structure` closed lookup can go stale against a derived enum.** `StructureKind` is derived
   at runtime from leg shape, so a shape the lookup doesn't know is possible in a way the scanner's
   wire-enum case wasn't. The `Custom · N legs` fallback must exist from day one and must never
   throw or render `undefined`.
6. **The saved-view notice is a copy surface with no natural test.** It only appears for a user with
   pre-existing durable state, which is exactly the user we cannot reproduce in a fresh browser.
   The FE lane needs a seeded fixture or U16 becomes UNVERIFIABLE at GATE Q.
7. **`PL_TIP`'s hardcoded "× 100" is live user-facing misinformation the moment shares exist.** It is
   a one-string fix that will be missed because it isn't in a component — it's in `labels.ts`.
8. **Scope creep through my own §6.** Asking for `Max loss` / `Max gain` in the dialog touches math
   and could pull the feature wider. I am claiming the *slot and its degraded copy*, not the
   computation — but I'd rather have that argument in R2 than discover at GATE Q that the BRIEF's
   stated decision impact ("the app cannot tell the trader what they actually risk") went
   undelivered.
9. **A parallel session is active in `apps/dashboard/src/app/` today** (`_MANIFEST.md`). Any copy
   constant I pin here (`labels.ts`, `defaults.ts`) is a collision candidate.

---

## Assumptions I'm making about the other two lanes

**Architecture lane**

1. `PositionView` exposes, per position, a **derived `structure_kind` from a closed enum with an
   explicit `custom` member** — so my label lookup is total and `Custom · N legs` is a reachable
   branch, not a defensive guess.
2. `PositionView` exposes `legs[]` where each leg carries `{ side: 'long'|'short', qty,
   instrument_kind: 'option'|'equity', strike?, expiration?, right?, multiplier }` — i.e. the
   component can decide "render `—` for strike" by reading `instrument_kind`, **without inferring it
   from a null strike**.
3. `PositionView` gives me the debit/credit answer **without arithmetic in a component** — either an
   explicit `entry_direction: 'debit'|'credit'` or a signed `net_entry` I resolve with one
   comparison against zero. I never sum legs in `PositionRow`/`PositionCard`.
4. The mark resolver returns **both** a per-leg result and a position-level result, and the
   position-level `mark`/`pl` is **`null` whenever any leg is null** — the all-or-nothing rule of §5
   is enforced in `mark.ts`, not re-implemented in a component.
5. The position-level result exposes the **weakest basis across legs** (or the per-leg bases plus a
   documented ladder ordering) so the row does not re-derive `snapshot > modeled > theoretical >
   last_known`.
6. **Resolution is per-leg at the fetch layer even though display is all-or-nothing** — the row can
   render (dimmed/loading) before all four leg lookups return, rather than blocking the whole table
   on the slowest `GET /api/contract`.
7. The migration maps **every** existing `Strategy` value (`long_call`, `long_put`) to a
   `StructureKind`, so no *migrated* row ever renders `Custom`. If a migrated row can render
   `Custom`, my U2 ("a single-leg row is unchanged from shipped") is false.
8. The migration **preserves** `ViewConfig.filter.strategy` on a saved view as an inspectable value
   rather than deleting it, and does not throw on an unmappable value — U16's "flag it, don't heal
   it" is only implementable if the stale value survives to the render layer.
9. **No durable field is added for expansion state**, layout of legs, or anything presentational.
10. `apps/api` diff is **empty**; no wire field is added; positions never reach scoring
    (`additive-keeps-score-byte-identical`).
11. Leg count is **not capped** by the render contract — my truncation and disclosure rules handle
    arbitrary N even though v1 shapes are ≤ 4.

**Product / PM lane**

12. **Multi-leg ENTRY is in scope** — the shared `TradeEntryDialog` gains a SIM multi-leg variant, as
    the BRIEF's `single-shared-sim-entry-dialog` note implies. If entry stays single-leg-only, my §6
    dialog copy is dead code and **no multi-leg position can ever exist** (the migration produces
    none), which would make the whole feature unobservable at GATE Q.
13. **Closing is position-level only in v1** — no per-leg close, no trimming one leg out of a spread.
    My expansion carries zero actions because of this. If PM wants leg-level close, the expansion
    needs buttons, 44px targets and a whole confirm flow I have not designed.
14. At least one of **max loss / max gain / breakeven** surfaces in this feature. The BRIEF's
    decision-impact sentence is explicit that the app "cannot tell the trader what they actually
    risk." If none of it lands, say so in R2 and I will cut §6's `Max loss` slot rather than let it
    ship half-specified.
15. **No column-customization UI returns** in this feature — REVISION 2 removed the Columns/Sort/
    Filters menus and the visible set stays fixed with `strategy` → `structure`. If the Columns menu
    returns, single-leg-only columns need a menu-level affordance I have not specified.
16. **The `Live` tab stays a zero-import locked placeholder** and gains nothing from multi-leg.
17. **The outcome ledger counts a multi-leg position as ONE record**, not one per leg — otherwise
    the track record's N silently quadruples and every Wilson interval it prints is wrong.
18. **The 393px no-overflow e2e set stays green and `/positions` stays in it**
    (`mobile-no-overflow.cy.ts:156`); it is a shipped constraint, not a nice-to-have.
19. **Grouping by Expiry returning to the toolbar is acceptable** — REVISION 2 dropped it to match a
    Figma frame that predates multi-expiry structures. If the owner wants the frame preserved
    literally, calendars have no group axis that makes sense and U17 should be cut.
20. Everything stays **`SIMULATED`**; no broker, no order path, no real-money surface, and the
    `PAPER` badge + `positions-disclosure` copy survive verbatim.
