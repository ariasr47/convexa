# outcome-ledger — UX_BLUEPRINT

> GATE U·X deliverable. Targets the **Frontend executioner**. Concrete UI/interaction design + the exact
> user-facing copy for the readout the `PRODUCT_CONTRACT` scoped and the `ARCHITECTURE_CONTRACT` shaped.
> Self-contained against `.claude/PROJECT_CONTEXT.md` + `.claude/contracts/outcome-ledger/
> PRODUCT_CONTRACT.md` + `ARCHITECTURE_CONTRACT.md` — assume no chat history.
>
> **Lane:** no server internals, no math, no endpoint/payload decisions. Product scope is **not** re-opened:
> every state and string below traces to a PM decision (`PRODUCT_CONTRACT` §4/§6) or an architect data
> field (`ARCHITECTURE_CONTRACT` §3.4). Where I refined a §4.6 phrase, §2.9 says so and why.
>
> **This feature is `NO_BACKEND_CHANGE`.** It consumes **no endpoint**. It derives from the durable
> client stores. The empty `apps/api` diff **is** the structural no-auto-tuning guarantee.

---

## 1. The one-paragraph brief for the person building this

You are building an **honesty instrument**, not a stats dashboard. Its whole value is that it *refuses*
to give a number it cannot support. Four of the five cell families start with no number at all, on
purpose. The design below makes the refusal legible and un-apologetic, and makes the dishonest render
**structurally impossible** rather than merely discouraged: one string builder emits the rate *with* its
mean return, its dispersion, its N, its range, its window and its basis, so there is no `&&` you could
add that would render a rate alone. If you find yourself decomposing that string, splitting it into
columns, heroing the rate, tinting it, sorting cells by it, or adding a filter — stop; you have misread
this document.

---

## 2. Design decisions (binding)

### 2.1 Surface & placement (the PM locked the route — not reopened)

- **Route: `/positions`.** Its own **named in-page view**, headed **"Track record"** — **not** a third
  tab beside Simulated / Live (those tabs are *books*; this is not a book), **not** the Ticker page,
  **not** `/_ops/metrics`, **no** new top-level nav destination. (`PRODUCT_CONTRACT` §4.1, AC-1.)
- **Position on the page:** a section **below** the `PortfolioPanel` (the Simulated/Live book), inside
  the existing 1240px centered column of `pages/positions/PositionsPage.tsx`. The book is what the page
  is for; the track record is the reflective read under it.
- **Always expanded.** The section is **not** collapsible and **not** default-collapsed. AC-17 requires
  the coverage statement to be readable *without interaction*; a collapsed section is an interaction.
- **Anonymous + ungated, end to end** — the readout *and* the archive (AC-2, AC-25). See §2.7.

### 2.2 Files (the structure canon governs — `apps/dashboard/src/app/README.md`)

- **Logic + UI: `apps/dashboard/src/app/features/trading/outcomes/`** (`ARCHITECTURE_CONTRACT` §5.2 pins
  the logic here; its UI lives with it, exactly as `features/trading/positions/` holds `PositionRow` etc.).
- **Host: `pages/positions/PositionsPage.tsx`** renders `<TrackRecordSection …/>`. Pages import features:
  direction is downward, legal.
- **Not a bento widget.** Do **not** wrap it in `@/shared/ui/Widget` — that shell is the *ticker bento's*.
  Match the Positions page's chrome-less redesign idiom (bare `Box`/`Typography`, a `divider` rule for
  section separation), the same way `PortfolioPanel` does.
- **⚠ Import fences you will hit (all real, all lint-enforced):**
  - Outcomes **may** import `features/trading/model` · `positions` · `orders` (read fns) + `shared/`.
    **Nothing else.** (`ARCHITECTURE_CONTRACT` §5.1 boundary 2 enumerates the forbidden importers of
    outcomes; this is the mirror allow-list of what outcomes itself may reach.)
  - **Outcomes must NOT import `pages/ticker/widgets/_kit/copy`** — that is an upward `features → pages`
    import and it will fail `@nx/enforce-module-boundaries` / the structure rule. So the **IV-rank band
    label lookup is defined locally in outcomes** (§2.6), duplicating the ticker's wording on purpose.
    *(The 2nd-consumer rule points at promoting that lookup to `shared/`; that is a **named seam, not this
    feature's work**. Keep the wording identical so the future promotion is a delete, not a merge.)*
  - **Outcomes must NOT import `features/personas`** — it is not on the architect's allow-list. The
    persona **display name** is therefore **injected as a prop** by the page shell (which may import both):
    `personaLabel?: (id: string) => string | null`. See §2.6.
  - **Tier label:** import the existing tier word map from `features/trading/model/OpportunityTier`
    (export the module-local `WORD` map as a named export — a single source of truth, an allowed import).
    **Do NOT use `tierMeta`** — it returns a palette colour and would drag AC-14 (no semantic tint) into
    the readout.

### 2.3 The read is STATIC — this is a component-signature rule, not a promise

`[live-vs-static-isolation]` (AC-E17). The Track record renders **unchanged and un-dimmed** on an SSE drop.

- **`TrackRecordSection` and every component beneath it accept NO `live`, `isLive`, `streamOffline`,
  `offline`, or `data` (bundle) prop, and import nothing from the SSE/live path.** The iv-rank widget is
  the reference implementation of exactly this posture.
- **No offline chip. No dimming. No `opacity` bound to any stream state. No "as of" timestamp, no
  freshness line, no Refresh button, no stale treatment, no auto-poll.**
- ⚠ **The file next door will mislead you.** `PositionsPage.tsx`'s Net P/L header does
  `opacity: streamOffline ? 0.5 : 1` and `color: netPl >= 0 ? 'success.main' : 'error.main'`. That is a
  *live P&L*. **Neither pattern may cross into this section.**
- The read recomputes only when a position closes or an archive is imported — and then it is
  **recomputed from the stores, never patched** (`ARCHITECTURE_CONTRACT` §3.5).

### 2.4 The counted read is ONE STRING — the structural enforcement of the PM's inseparability rule

`PRODUCT_CONTRACT` §4.10 / §7.14 / AC-8 / AC-9: **a hit rate may never appear without its mean per-trade
return and dispersion, its N, its range, its window and its basis.** The type already refuses a bare rate
(`ARCHITECTURE_CONTRACT` §3.4.1). The **DOM** must refuse it too:

- **The counted cell's read line is produced by ONE copy builder returning ONE string, rendered in ONE
  `<Typography>`.** Do **not** decompose it into per-stat spans, columns, chips, or tiles. Any
  decomposition is one conditional away from a rate-only render, and a column is one hide-control away
  from the same.
- **No typographic hierarchy inside the read line.** The rate is rendered at the **same size and the same
  weight** as its mean return and its N. *This is deliberate and load-bearing:* a big rate over a small
  caption **is** a hero, and §7.1 forbids designing a hero for the rate. **The read is the headline; the
  rate is not.**
- **No table.** The Positions page has a column-customization culture (`CustomizationToolbar`). The track
  record has **no columns, no sort control, no density control, no filter, no saved views**. (Also §8
  non-goal 15 — no include/exclude toggle, override, or filter may exist.)
- **No dollar figure anywhere in the readout.** Not a total, not per cell. Two reasons: AC-10 forbids
  reading the per-trade mean as dollar expectancy, and a dollar total would be **summed across
  overlapping cells** — AC-16. The string `expectancy` and the character `$` do not appear in this
  surface.

### 2.5 No verdict may be manufactured (AC-14, and beyond it)

- **No semantic tint on any rate or return.** `text.primary` / `text.secondary` only. **No
  `success.main`, no `error.main`, no `warning.*`, no red/green, no arrow, no up/down icon, no
  sparkline, no bar, no gauge.** The range is the verdict; the hue is not.
- **No progress bar in the `building` state.** "7 of 20" invites a meter — and a meter next to a
  hit-rate-shaped cell reads as **35%**. Text only. (AC-E3's trap generalizes: any bar is a number.)
- **Cell order is fixed and never data-dependent.** Never sort cells by rate or by N — that builds a
  leaderboard the sample cannot support. See §2.6 for each family's fixed order.
- **The whole read line is one colour** (it is one string — this falls out of §2.4 for free).

### 2.6 Labels come from closed lookups — never re-derived (`[digested-labels-not-raw-dump]`)

| Family | Cell key | Label source | Fixed cell order |
|---|---|---|---|
| **Tier** | `dormant`\|`watch`\|`actionable`\|`prime` | the `WORD` map in `features/trading/model/OpportunityTier` → `Dormant` · `Watch` · `Actionable` · `Prime`. **⚠ NEVER derive the tier from `opportunity_score`** — that is precisely the re-derivation the rule bans. | the ladder: Dormant → Watch → Actionable → Prime |
| **AI rec** | *(one cell — §2.6.1)* | fixed string `Taken from an AI rec` | n/a |
| **Setup** | the recorded setup `name` | a closed lookup local to outcomes → the display label; **an unrecognized name renders the recorded token verbatim, untransformed** (fail-honest — never guess, never title-case a token into a claim) | **alphabetical by display label** |
| **IV-rank band** | `premium_rich`\|`neutral`\|`premium_cheap` | a closed lookup **local to outcomes** (see the import fence, §2.2) → `Premium rich` · `Neutral` · `Premium cheap`. **NEVER derive the band from an IV rank scalar.** | the scale: Premium cheap → Neutral → Premium rich |
| **Persona** | the recorded persona id | the injected `personaLabel(id)` prop; **`null` / unknown ⇒ the label `Persona no longer saved`** (never render the raw id) | **alphabetical by display label** |

*Accepted limitation:* two deleted custom personas render as two separate cells both labelled "Persona no
longer saved". Honest and rare; showing an internal id would be worse. Do not merge them (that would sum
two cells' Ns — AC-16).

#### 2.6.1 The AI-rec family has exactly ONE cell — decided here, and the reason is binding

The captured rec identity is a **fingerprint** — per-rec, not a class. Fanning cells out by fingerprint
gives N cells of N=1, permanently `building`, permanently useless. **S2 asks "how have the recs I took
closed?"** — one question, one cell:

- **`Taken from an AI rec`** — the counted outcomes whose entry carried a rec identity (= the family's
  `attributed`).
- **⚠ Do NOT add a "not from a rec" comparison cell.** Those outcomes have *missing context*, not a
  contrary context — **"unknown is never a cohort"** (`PRODUCT_CONTRACT` §4.8, §7.15). They are reported
  in the family's coverage line, which is where they belong. A comparison cell would also invite a
  head-to-head the sample cannot support.

### 2.7 The archive is UNGATED — the single most likely defect in this build

`[server-side-gate-enforcement]` + `PRODUCT_CONTRACT` §4.13 / AC-25: there is **no server surface here**,
so there is **no boundary at which a gate could be enforced**; an FE-only gate is **decorative and
forbidden**.

- **The Track record section and the archive must NOT call `useGate`, `gate.guard`, `gate.prompt`,
  `simTradeGate`, or `SignInPrompt`. They must not import `features/auth` at all.**
- ⚠ **Why you will get this wrong:** `PortfolioPanel.tsx` — the component immediately above this one on
  the same page — server-gates **every** write (`openPosition`, save-view) and the import *looks* like a
  write. It is not a comparable write: it reaches no server, creates no position, costs nothing, and
  writes only into the user's own browser. **Ungated is the decision, not an oversight.**

### 2.8 There is no error state, no loading state, no stale state

| Asked-for state | Verdict here | Why |
|---|---|---|
| **loading** | **none** — compute the read **synchronously in a `useMemo` on mount** | it is a client-local store read. ⚠ **Do not defer it into a `useEffect`** — a one-frame flash of the empty state ("Nothing has closed yet") to a user with 400 trades is a lie. *(If a measured store proves too large to read synchronously, a skeleton is permitted — but it MUST be visually distinct from the empty state, per the ticker page's skeleton-vs-empty precedent.)* |
| **stale** | **none** | all-time, static, historical (§2.3). No freshness concept exists. |
| **offline** | **none** | AC-E17 — renders unchanged + un-dimmed (§2.3). |
| **error** | **none** | `[best-effort-isolated-or-null]` + AC-E5. Corrupt/absent history renders **empty**, **unreadable**, or **partial** — with a stated reason. **Never a thrown error, never an Alert severity="error", never a broken page, never a Retry button, and never a write back to the store.** |

### 2.9 The three §4.6 phrases I refined (and one I split) — facts kept, defects fixed

`PRODUCT_CONTRACT` §7.18: *UX may refine phrasing; it may not drop a fact.* Four refinements, each with
its reason:

1. **`unpriced_basis` — the word "modeled" was collided.** §4.6 gives *"entry or exit price was typed or
   modeled, not quoted"* for `unpriced_basis`, but `modeled_basis` is a **separate, distinct reason**
   right below it. Two reasons sharing the word "modeled" makes the breakdown unreadable. Refined to
   **"Entry or exit price was typed, theoretical or stale — not a quote"** (which names the actual
   `unpriced` members: typed / theoretical / last-known / manual) and **"Re-priced between quotes — not a
   quote"** for `modeled_basis`. No fact dropped; the collision is gone.
2. **"spread ±31pts" → "±31pts trade to trade".** "Spread" means **bid-ask** on every other surface of
   this app. Using it for a standard deviation on a trading page is a genuine collision. The dispersion
   fact is unchanged.
3. **Window dates carry the year.** §4.6's example reads "Mar 4 – Jul 15". The window is **all-time and
   non-rolling** (§4.11) — it will span years, and a year-less date on a multi-year window is ambiguous.
   Locked: `MMM D, YYYY – MMM D, YYYY`.
4. **The empty state and the corrupt state get DIFFERENT copy.** §4.6 has one storage line and AC-E1/AC-E5
   are separate cases; conflating them would tell a user whose store failed to read that they have no
   history. See §5.2 vs §5.3.

### 2.10 `malformed` vs `unreadable_records` — **RESOLVED** (§11.4 item 1 was left to me)

**ONE user-facing concept: "unreadable record". No second concept is invented.** The distinction the
architect flagged (`excluded_by_reason.malformed` is *inside* the balance; `adjacent.unreadable_records`
is structurally outside it, because an unreadable record's closed-ness is unknowable) is **arithmetic, not
editorial** — exactly as §11.4 says.

**But the two counts must never be summed** (summing them across the balance boundary would break the
visible `M == counted + Σ excluded` identity — the one thing the roll-up exists to guarantee). So they
render as **two rows, in two clearly-headed groups, using the same concept**, and the *group heading* does
the differentiating work:

- In **"Not counted (out of the {M} recorded closed positions)"** → row **"Unreadable record — not
  counted"**, count = `excluded_by_reason.malformed`.
- In **"Counted beside these, not inside"** → row **"Unreadable record — not counted (couldn't tell if it
  was closed)"**, count = `adjacent.unreadable_records`.

The parenthetical is **not a second concept** — it is the same concept plus the plain-language reason it
sits outside the total. **Do not invent a third label. Do not sum the two. Do not merge the rows.**

### 2.11 `sources_complete: false` — the PARTIAL state — **RESOLVED** (§11.4 item 2 was left to me)

Binding rule from the architect's lane: **a partial roll-up must never present its smaller M as if it were
the whole population.** My design honours that by **withholding M entirely** rather than caveating it:

- **The "of {M}" comparison is NOT rendered when `sources_complete === false`.** A caveated wrong
  denominator is still a wrong denominator; the honest move is to say we cannot state it. Copy in §5.4.
- **Counted cells still render** (AC-E5 says "empty **or partial**" — partial means content). But every
  counted cell's **basis slot appends `· partial read`** — which rides the *already-mandatory* basis
  sibling, so the partiality is **inseparable from the number** for free, exactly like the range and the N.
- The **partial banner** sits at the top of the readout, above the families, **un-dismissable**.
- **Family coverage lines render unchanged.** They partition *the counted population* and they **state**
  that N ("Of your 34 counted outcomes, …") — they never claim it is everything. That is already honest.
- **Nothing is written, nothing is repaired, nothing is deleted.** `[loss-free-durable-migration]`.

---

## 3. Component tree

```
pages/positions/PositionsPage.tsx
└── <TrackRecordSection personaLabel={…} />          features/trading/outcomes/
    ├── TrackRecordHeader          "Track record" · subtitle · SIMULATED badge
    ├── ReadFrame                  the always-on framing block (§5.1) — NEVER collapsible
    │   ├── advisory line                       (AC-3)
    │   ├── SIMULATED disclosure                (AC-4)
    │   ├── storage disclosure                  (AC-2)
    │   ├── CoverageStatement                   (AC-17) + ⓘ basis
    │   │   └── ExclusionBreakdown  <details>   (AC-18) — the ONLY on-demand content
    │   ├── PartialBanner           conditional (§2.11, AC-E5)
    │   ├── CaptureEpochLine                    (AC-19) + ⓘ
    │   ├── HowToReadThis           hit def · range def · return def · basis def · overlap
    │   ├── lead explainer          conditional (AC-E1 / AC-E4)
    │   └── multiplicity caution                (AC-5) — the last line before the cells
    ├── CellFamilyList             5 families, fixed order (AC-15)
    │   └── CellFamily × 5         heading + ⓘ · FamilyCoverageLine · cells (fixed order)
    │       ├── BuildingCell        label + the count line. NOTHING numeric beyond the count.
    │       └── CountedCell         label + read line (ONE string) + qualifier? + basis line
    └── ArchiveBlock               (present in EVERY state, including empty/unreadable)
        ├── "Export archive"        → file download → snackbar result
        └── "Import archive"        → file pick → ImportDialog(confirm → report)
```

---

## 4. Where each datum surfaces

Every field the `ARCHITECTURE_CONTRACT` §3.4 read emits, and its single home. **A field with no home
below is not rendered.**

| Field (`ARCHITECTURE_CONTRACT` §3.4) | Surfaces as |
|---|---|
| cohort `building`: `n`, `n_min` | the **building cell**'s single count line (§5.6) |
| cohort `computed`: `hit_rate`, interval `lo`/`hi`, `n`, `mean_pl_pct`, `stdev_pl_pct` | the **counted cell's read line** — ONE string (§5.7) |
| cohort `computed`: `window.first` / `window.last`, `basis_class` | the **counted cell's basis line** (§5.7) |
| `hi − lo > 20pp` | the **"still wide" qualifier** line (§5.7, AC-12) |
| roll-up `counted`, `recorded_closed` (M) | the **coverage statement** headline (§5.4) + the balance line in the breakdown |
| roll-up `excluded_by_reason.*` (6 reasons) | the breakdown's **group 1** (§5.5) — never elsewhere |
| `adjacent.open_not_counted`, `adjacent.never_filled` | the **coverage statement** headline **and** the breakdown's group 2 |
| `adjacent.unreadable_records` | the breakdown's **group 2 only** (§2.10) |
| family `counted_total`, `pre_capture`, `unavailable_at_capture`, `attributed` | the **family coverage line** (§5.8) |
| family `not_attributable_by_path` (AI-rec only) | the family coverage line **+** the AI-rec path note — **both rendered iff `> 0`** (§5.8, AC-E18) |
| basis: sources spanned + de-dupe identity | the coverage statement's **ⓘ tooltip** (§6) |
| basis: `sources_complete` | the **partial banner** + the `· partial read` suffix on every counted cell's basis line (§2.11) |
| basis: the **derived** capture epoch | the **capture-epoch line** (§5.4) |
| basis: SIMULATED provenance | the header badge **+** the SIMULATED disclosure (§5.1) |
| basis: advisory framing | the advisory line (§5.1) |

---

## 5. The copy (exact strings)

**House rules for this file.** All strings live in **one module**: `features/trading/outcomes/copy.ts`
(the `_kit/copy.ts` idiom). `{…}` = an interpolated value. `·` = U+00B7. `–` = en dash (ranges). `—` =
em dash. `−` = U+2212 (a real minus sign — the page already uses it). `±` = U+00B1. Numerals render in
the mono token with `fontVariantNumeric: 'tabular-nums'`.

**Formatting, locked:**
- rate, interval bounds: **integer percent** → `58%`, `36–78%`
- `n`: integer + `closed trade` / `closed trades` (**pluralize**)
- mean per-trade return: **one decimal, always signed**, real minus → `+12.4%` / `−3.1%`
- dispersion: **integer** percentage points → `±31pts`
- dates: **one shared formatter**, `toLocaleDateString(undefined, {month:'short', day:'numeric',
  year:'numeric'})` → `Mar 4, 2026`
- **all counts render even when zero** (a disappearing count is a silent change; a stable shape is
  scannable)

### 5.1 The header + the read frame

```
TR_TITLE            = "Track record"
TR_SUBTITLE         = "How your own recorded simulated decisions actually closed."
TR_BADGE            = "SIMULATED"

TR_ADVISORY         = "Advisory context from your own recorded sim decisions. Not a guarantee, not a
                       forecast, and not an input to the opportunity score."

TR_SIM_DISCLOSURE   = "Simulated fills. The sim has no slippage, no partial fills, no queue position, no
                       assignment and no commissions or fees, and a limit order fills instantly at any
                       size on a live cross. Sim P&L is not what a broker would have given you."

TR_STORAGE          = "Stored in this browser only — not tied to your account. Export an archive to back
                       it up."
```

**`TR_SIM_DISCLOSURE` names all six facts required by AC-4** — slippage · partial fills · queue position ·
assignment · commissions/fees · instant unlimited limit fills. **It is body text, not a footnote, not a
tooltip, not a "learn more"** (`[no-real-order-path]`, §7.3). Do not shorten it.

**"How to read this"** — a visible block, **never an accordion** (AC-5/AC-10/AC-13/AC-16 all say *the
readout carries/states* it; a collapsed block does not):

```
TR_HIT_DEF     = "A hit is a closed sim position that realized more than zero. A zero result is not a hit
                  — it stays in the denominator."

TR_RANGE_DEF   = "“Plausibly X–Y%” is the 95% Wilson confidence interval around the rate — the band the
                  true rate is most likely in, given how few trades it's built on. The narrower it gets,
                  the more the rate means."

TR_RETURN_DEF  = "“Avg per trade” is the plain average of each trade's percent return — every trade counts
                  once, regardless of size. It is not dollar expectancy, and it does not tell you what you
                  made."

TR_BASIS_DEF   = "“Quoted fills only” means both ends of the trade were priced off a real market quote (or
                  a live cross). Trades where a price was typed in, modeled between quotes, or read from a
                  stale quote are not counted in any rate — they're listed under “What wasn't counted”."

TR_OVERLAP     = "One closed trade appears in every cell it qualifies for — its tier and its setups and
                  its persona. Cell counts overlap, so they are never added up."
```

`TR_RANGE_DEF` is where the statistical vocabulary lives — **secondary, never the headline** (§4.7).
`TR_RETURN_DEF` is where **"size-unweighted"** and **"not dollar expectancy"** are stated once, visibly,
for the whole readout (AC-10) — so 40 cells don't each repeat it.

**The lead explainer** — rendered **iff no cell anywhere in the readout is `computed`** (one rule; covers
AC-E1 *and* AC-E4's "still explains what it will answer"):

```
TR_LEAD_EXPLAINER = "Once a cell reaches {n_min} closed trades, it'll show how that cut of your decisions
                     actually turned out — hit rate, its range, and your average return per trade.
                     Nothing here shows a rate until then."
```

**The multiplicity caution** — the **last line of the frame, immediately above the families** (so it is
read against the cells, not three screens away):

```
TR_MULTIPLICITY = "Across this many cells and this few trades, some cell will look extreme by chance.
                   Read the range, not the headline."
```

### 5.2 Empty — nothing recorded at all (AC-E1)

**Selected iff** `sources_complete === true && counted === 0 && recorded_closed === 0 &&
open_not_counted === 0 && never_filled === 0 && unreadable_records === 0`.

Replaces **only** the coverage statement + the cell families. The header, the whole read frame and the
archive block still render (AC-2/3/4/5 say *the readout carries* the framing — unconditionally).

```
TR_EMPTY_TITLE = "Nothing has closed yet."
TR_EMPTY_BODY  = "When your simulated positions start closing, this is where you'll see how they actually
                  turned out — hit rate and average return by tier, AI rec, setup, IV-rank band and
                  persona, each with its sample count and its range. A cell needs {n_min} closed trades
                  before it will show a rate."
```

**No error. No zero-rate. No blank page. No "0%". No Retry.**

### 5.3 Unreadable — history exists but none of it could be read (AC-E5)

**Selected iff** `counted === 0 && recorded_closed === 0 && (sources_complete === false ||
unreadable_records > 0)`.

⚠ **This state exists because telling a user with 400 trades "Nothing has closed yet" is a lie.** Empty
and unreadable are different facts and get different copy.

```
TR_UNREADABLE_TITLE = "We couldn't read your stored history."
TR_UNREADABLE_BODY  = "None of your trade records could be read this time, so there's nothing to count.
                       Your stored data has not been changed or deleted — reload to try again. If you have
                       an archive file you can import it; import only ever adds."
```

**Never a thrown error. Never `severity="error"`. Never a repair, a rewrite, a prune or a clear.**

### 5.4 The coverage statement (AC-17) + the capture epoch (AC-19)

**Readable without interaction. Always renders all three counts, including zeros.**

```
TR_COVERAGE = "Counted {counted} of {M} recorded closed {position|positions}. {open} still open — not yet
               counted. {never_filled} {order|orders} never filled."
```
> e.g. `Counted 34 of 41 recorded closed positions. 6 still open — not yet counted. 3 orders never filled.`

**The PARTIAL variant** (`sources_complete === false`) — **M is withheld, not caveated** (§2.11):

```
TR_COVERAGE_PARTIAL_BANNER = "Partial read — some of your stored history couldn't be read this time."
TR_COVERAGE_PARTIAL        = "Counted {counted} outcomes from the records we could read. We can't say how
                              many recorded closed positions you actually have, so we're not showing an
                              “of {M}” — the number we could reach is not your whole history. Nothing was
                              changed or deleted; reload to try again."
```
The banner renders above the families and is **un-dismissable**. The `{open}` / `{never_filled}` counts
are **also withheld under partial** — they are read from the same indices and are equally understated.

**The capture epoch** — the date is **DERIVED FROM THE DATA** (an archive import can carry records from a
browser whose capture began earlier). ⚠ **A hardcoded ship date here is the natural implementer error and
it would misdate the user's own history.**

```
TR_EPOCH      = "We started recording entry context on {date}. Outcomes recorded before then still count
                 for tier — they have no setup, persona, IV-band or score context."

TR_EPOCH_NONE = "We haven't recorded entry context on any trade yet. Setup, AI-rec, IV-band and persona
                 cells stay empty until new trades are recorded; tier still counts every outcome."
```
`TR_EPOCH_NONE` renders iff the epoch is `null` (the day-one state).

### 5.5 The exclusion breakdown (AC-18) — the ONLY on-demand content in the readout

A native `<details>`/`<summary>` (or an MUI disclosure) directly under the coverage statement.

```
TR_BREAKDOWN_SUMMARY = "What wasn't counted — and why"
```

**Group 1 heading:** `TR_BREAKDOWN_G1 = "Not counted (out of the {M} recorded closed positions)"`

| Reason key | Row label |
|---|---|
| `no_decision_record` | `No decision recorded — not counted` |
| `unresolved_join` | `Couldn't link to its decision — not counted` |
| `scenario_sourced` | `Scripted test scenario — not a real decision` |
| `unpriced_basis` | `Entry or exit price was typed, theoretical or stale — not a quote` |
| `modeled_basis` | `Re-priced between quotes — not a quote` |
| `malformed` | `Unreadable record — not counted` |

Rows render **in the order above** (which is the architect's stated precedence order — so the breakdown
reads the way it was decided). **Render only rows whose count is `> 0`**; a zero exclusion is not an
exclusion. If every reason is 0:
```
TR_BREAKDOWN_NONE = "Everything recorded was counted."
```
**The balance line** closes group 1 — it makes the identity `M == counted + Σ excluded_by_reason`
user-checkable, which is the whole reason the roll-up exists:
```
TR_BALANCE = "{counted} counted + {excluded_total} not counted = {M} recorded closed positions."
```

**Group 2 heading:** `TR_BREAKDOWN_G2 = "Counted beside these, not inside"`

| Key | Row label |
|---|---|
| `open_not_counted` | `Still open — no result yet` |
| `never_filled` | `Order never filled — no position, no result` |
| `unreadable_records` | `Unreadable record — not counted (couldn't tell if it was closed)` |

```
TR_BREAKDOWN_G2_NOTE = "These aren't recorded closed positions, so they're not part of the {M} above — an
                        open trade has no result yet, an order that never filled never became a position,
                        and an unreadable record can't be checked either way."
```

**⚠ Binding on this whole panel:**
- **No record ids, no P&L, no per-record list, no drill-through, no "count it anyway", no toggle, no
  filter.** Integers and reasons, full stop (`ARCHITECTURE_CONTRACT` §3.4.5 lock 1 + §8 non-goal 15). **If
  you find yourself writing a function from an excluded record to a cohort member, you have misread the
  contract.**
- **The demo seed gets NO special case (AC-E10).** The `testSeed.ts` fabricated closed position lands in
  `no_decision_record` like any other record with no decision. **The strings "seed", "demo", "test data"
  and "sample" appear nowhere in this surface**, and no code branch mentions it.
- **The two groups are never summed with each other** (§2.10).

### 5.6 The `building` cell (AC-E2, AC-E3, AC-E4) — a count, and nothing numeric beside it

```
TR_BUILDING = "Building history — {n} of {n_min} closed {trade|trades}. No hit rate yet: fewer than
               {n_min} outcomes can't tell luck from edge."
```
> e.g. `Building history — 7 of 20 closed trades. No hit rate yet: fewer than 20 outcomes can't tell luck from edge.`

This deliberately mirrors the iv-rank widget's `Building history — {n} of {n_min} sessions` — **one floor
concept, one mental model** (`PRODUCT_CONTRACT` §4.9). It reads as **counting up, not as failing**: the
epoch is a feature.

**⚠ AC-E3 — the 3-for-3 trap, stated as the rule you must not break.** A cell whose only three counted
outcomes are all winners renders **exactly the string above and nothing else**. In a `building` cell there
is:

> **no percentage · no "3 of 3 won" · no "100%" · no rate · no range · no mean return · no dispersion · no
> window · no progress bar · no meter · no ✓/✗ · no tint.**

The type has no rate field to render (`ARCHITECTURE_CONTRACT` §3.4.1) — **do not compute one, do not
derive one, do not "just show the count as a fraction with a percent".**

### 5.7 The `counted` cell (AC-7 … AC-12, AC-14)

Four elements, in order. **Lines 2 and 4 are the mandatory inseparable read** (§2.4).

```
1. label          "Prime"                          ← the closed lookup (§2.6)

2. read line      ONE string, ONE <Typography>, no internal hierarchy:
   TR_COUNTED_READ = "{rate}% hit rate — plausibly {lo}–{hi}% · {n} closed {trade|trades} ·
                      avg {mean}% per trade, ±{sd}pts trade to trade"

3. qualifier      rendered IFF (hi − lo) > 20  (strictly greater than 20.0pp):
   TR_STILL_WIDE  = "still wide — not a conclusion yet"

4. basis line     TR_COUNTED_BASIS = "{first} – {last} · quoted fills only"
                  + " · partial read"   when sources_complete === false   (§2.11)
```

Rendered:
```
Prime
58% hit rate — plausibly 36–78% · 24 closed trades · avg +12.4% per trade, ±31pts trade to trade
still wide — not a conclusion yet
Mar 4, 2026 – Jul 15, 2026 · quoted fills only
```

- **Lines 2 and 4 have no conditional parts.** One builder → one string, each. There is no code path that
  renders line 2 without line 4, and no code path that renders any *part* of line 2.
- The qualifier's width test is computed **once, in the copy builder**, from the emitted interval — the UI
  does no arithmetic anywhere else. **`> 20` strictly**; exactly 20.0pp carries no qualifier.
- **`n_min` is data, not a literal.** Read it from the read; never hardcode `20` in copy.

### 5.8 The family heading + its coverage line (A2 — AC-19, AC-E13, AC-E14, AC-E18)

Family headings, **in this fixed order (AC-15)**: `Tier` · `AI rec` · `Setup` · `IV-rank band` ·
`Persona`.

**The coverage line — the honest answer to "is this cut NEW, or STARVED?"** (a date alone cannot say):

```
TR_FAMILY_COVERAGE = "Of your {counted_total} counted {outcome|outcomes}, {attributed} carry a {noun}{— shortfalls}."
```
`{noun}` per family: `tier` · `recorded AI rec` · `recorded setup` · `recorded IV-rank band` · `recorded
persona`.

`{— shortfalls}` = `" — "` + the **non-zero** clauses below, joined with `, ` (and `" and "` before the
last). Omitted entirely when every clause is 0.

| Count | Clause |
|---|---|
| `pre_capture` | `{n} predate capture` |
| `unavailable_at_capture` | `{n} had none available at entry` |
| `not_attributable_by_path` *(AI-rec only)* | `{n} came in through a path that can't carry the rec identity` |

> `Of your 34 counted outcomes, 4 carry a recorded setup — 30 predate capture.`
> `Of your 34 counted outcomes, 34 carry a tier.`

**"not available at entry" (AC-E14) vs "predate capture" (AC-E13) are two visibly distinct clauses**, from
two distinct counts, and neither is ever a cell with a rate (**"unknown is never a cohort"**, §4.8/§7.15).

**⚠ Tier: do NOT write a tier-specific copy branch.** Tier's `pre_capture` is **structurally 0** — it must
come out of the **data**, through the same generic builder. A hardcoded "tier is always complete" string
would **hide a real bug** the day it isn't. Same for the identity
`counted_total == attributed + unavailable_at_capture + pre_capture` (+ `not_attributable_by_path` for
AI-rec): assert it, don't assume it.

**The AI-rec path note (AC-E18 / §9.16) — rendered IFF `not_attributable_by_path > 0`. It self-cancels:**

```
TR_AIREC_PATH_NOTE = "Recs you took as a simulated order are attributed here. Recs you accepted straight
                      into an entry aren't — that path doesn't carry the rec's identity yet, so those
                      outcomes are counted in your totals but not in any AI-rec cell."
```
If the FE lane threads the rec identity through the shared `TradeEntryDialog` prefill seam **without
forking it** (`[single-shared-sim-entry-dialog]` forbids a fork), the count is `0` and **this note must
not render**. One data-driven rule satisfies AC-E18 in **both** directions — **no build flag, no
hand-toggle.**

**A family with no cells at all** (e.g. setup, day one):
```
TR_FAMILY_EMPTY = "Nothing recorded yet for this cut. Cells appear as trades close with a recorded {noun}."
```

### 5.9 The archive (AC-20 … AC-25, AC-E15, AC-E16)

A sub-block at the **bottom of the section, present in EVERY state** — including empty and unreadable
(AC-21: export must work with zero history, and on an empty surface the archive is the only useful thing).

```
TR_ARCHIVE_HEADING = "Archive"
TR_ARCHIVE_LEAD    = "Your trading history lives in this browser only. There's no server backup — if you
                      clear this browser's data, it's gone. An archive is one file with all of it: every
                      position, every order, every decision."
```

**Export (AC-20, AC-21).** Button **"Export archive"** — **always enabled, never gated, never disabled**.
Filename: **`convexa-archive-{YYYY-MM-DD}.json`** (the stem is locked by §4.12; `.json` is its natural
extension). Result → a **snackbar** (reuse `PortfolioPanel`'s `Snackbar`+`Alert severity="success"`
idiom):

```
TR_EXPORT_OK    = "Archive exported — {filename}. This is your complete backup: every position, order and
                   decision stored in this browser."
TR_EXPORT_EMPTY = "Archive exported — {filename}. It's empty: there's no history stored in this browser
                   yet. That's still a valid archive."
```

**Import (AC-22 … AC-25, AC-E15, AC-E16).** Button **"Import archive"** → a native file picker
(`<input type="file" accept="application/json">`). **No gate, no sign-in prompt — see §2.7.** Then **ONE
dialog with two steps**.

**Step 1 — the mandatory confirm, BEFORE any write (AC-22):**
```
TR_IMPORT_CONFIRM_TITLE = "Import archive?"
TR_IMPORT_CONFIRM_BODY  = "Importing only adds. It never deletes, never overwrites and never replaces
                           anything you already have. If a record in the file is already here, it's
                           skipped. If it collides with a different record, your existing record wins.
                           Importing the same file twice changes nothing."
TR_IMPORT_CONFIRM_FILE  = "File: {filename}"
```
Buttons: **Cancel** · **Import** (primary). **⚠ Nothing is parsed-and-written before Import is pressed.**

**Step 2 — the mandatory result report, after EVERY attempt (AC-23).** All three lines always render,
including zeros:
```
TR_IMPORT_DONE_TITLE = "Import complete"
TR_IMPORT_ADDED      = "{n} {record|records} added."
TR_IMPORT_SKIPPED    = "{n} already here — skipped."
TR_IMPORT_CONFLICT   = "{n} collided with a different record — your existing record was kept."
TR_IMPORT_FOOTER     = "Nothing was deleted or overwritten."
```
Button: **Done**. *(AC-24 falls out: re-importing the same file reports `0 records added.`, and the read —
**recomputed from the unchanged stores, never patched** — shows an identical counted N, identical rates
and an identical coverage statement.)*

**Declined import (AC-E15)** — same dialog, step 2, declined variant:
```
TR_IMPORT_DECLINED_TITLE = "Import declined"
TR_IMPORT_DECLINED_BODY  = "{reason} Nothing was imported. Your existing data was not changed."
```
`{reason}` from a **closed set** — never a raw parser message, never a stack trace:
```
TR_DECLINE_UNREADABLE = "This file couldn't be read."
TR_DECLINE_NOT_OURS   = "This isn't a Convexa archive file."
TR_DECLINE_VERSION    = "This archive was written by a version this app doesn't understand."
```

**⚠ Binding on the whole archive block (`[loss-free-durable-migration]`):**
**No "Restore". No "Replace". No "Overwrite". No "Clear". No "Reset". No "Start fresh". No
"Import as new".** Not a button, not a mode, not a checkbox, not a copy line. A destructive restore is
the one operation this invariant exists to forbid. **A declined import leaves the stores byte-untouched
and says so.**

---

## 6. Tooltips & glossary

**Binding rule: a tooltip explains; it never informs.** **No tooltip carries a number, a rate, a count, or
any fact an AC requires** (§7.1 forbids a tooltip that shows a rate; §7.18 forbids burying a required
fact behind an interaction). Every tooltip below is removable without losing a fact.

Affordance: the house `InfoOutlinedIcon` + MUI `Tooltip` idiom (the `_kit` `CaptionLabel` pattern —
reimplemented locally, **not imported from `pages/ticker`**; §2.2).

| Anchor | Tooltip |
|---|---|
| the coverage statement | `"Your decisions are recorded in two places — the Ticker page and the Positions page. This read merges both and drops records that appear in both, so a trade is counted once. These counts are a read of your stored records, with the same caveats as the rates below."` |
| the capture-epoch line | `"Before this date we recorded which tier you traded, but not the setups, persona, IV band or score behind it — so those cells can't count older trades. We never guess a value we didn't observe, and we never rewrite an old record."` |
| **Tier** heading | `"The opportunity tier the app showed when you entered. Recorded on every trade, including trades from before entry-context capture started."` |
| **AI rec** heading | `"Outcomes you entered from an in-app AI recommendation."` |
| **Setup** heading | `"The setups the app said were firing when you entered. A trade appears under every setup that fired for it, so these counts overlap."` |
| **IV-rank band** heading | `"Where the ticker's implied volatility sat in its own recent range when you entered — premium rich, neutral, or premium cheap."` |
| **Persona** heading | `"The trader persona that was active when you entered."` |

The coverage tooltip's last sentence is `[model-read-carries-its-assumptions]` applied to the **coverage
counts themselves** (`ARCHITECTURE_CONTRACT` §3.4.6) — they are a model read and carry their basis too.

**Glossary terms and where each is defined (all visible, none tooltip-only):** *hit rate* →
`TR_HIT_DEF` · *plausibly X–Y%* → `TR_RANGE_DEF` · *avg per trade / ±Npts trade to trade* →
`TR_RETURN_DEF` · *quoted fills only* → `TR_BASIS_DEF` · *building history* → `TR_BUILDING` ·
*predate capture* → `TR_EPOCH` + its ⓘ · *not available at entry* → the family coverage clause.

---

## 7. Whole-readout body-state selection (wire-driven, first match wins)

Mirrors the iv-rank precedent: the state is selected **from the read's own fields**, never re-derived,
and an unrecognized shape degrades **fail-honest**, never to a throw.

| # | State | Condition | Renders |
|---|---|---|---|
| 1 | **unreadable** | `counted === 0 && M === 0 && (sources_complete === false \|\| unreadable_records > 0)` | header · frame · §5.3 (replacing coverage + families) · archive |
| 2 | **empty** | `sources_complete === true && counted === 0 && M === 0 && open === 0 && never_filled === 0 && unreadable_records === 0` | header · frame · §5.2 (replacing coverage + families) · archive |
| 3 | **partial** | `sources_complete === false` | header · frame · **partial banner** · `TR_COVERAGE_PARTIAL` · families (cells' basis lines carry `· partial read`) · archive |
| 4 | **default** | otherwise | header · frame · `TR_COVERAGE` · families · archive |

**Notes.** The **lead explainer** (`TR_LEAD_EXPLAINER`) is orthogonal — it renders in *any* state where no
cell is `computed` (so it covers **empty**, **day one** (AC-E4), and a partial that reached no floor).
State 4 covers "3 open, nothing closed yet": coverage reads `Counted 0 of 0 recorded closed positions. 3
still open — not yet counted. 0 orders never filled.`, every family is `building`, **no rate exists
anywhere** — exactly AC-E4.

---

## 8. AC → component-state map

**⚠ Read this before using the map.** This mapping is the **verification matrix**, and per
`.claude/agents/qa-verify.md` §4 (the risk-based amendment, 2026-07-13) **verification is mandatory for
every AC, but an automated TEST is required only at the risk-based bar**:
- **`test:`** — a silent regression is plausible **and** invisible to review: invariants, negative space,
  structural rules, stateful/visual behavior that regresses as a side effect of an unrelated refactor.
- **`review:`** — the behavior is **visible** and any change to it would be **intentional**: copy wording,
  element presence, ordering, layout. Recorded in `QA_REPORT.md` as "verified by review/QA".

**This is not a per-AC-test rule.** Do not add a named test per AC.

| AC | Component state(s) | Verification |
|---|---|---|
| AC-1 placement / not on Ticker / not on `/_ops` / no new nav | all | `review:` present on `/positions` · `test:` the forbidden-importer source-scan (negative space) |
| AC-2 readable signed out + storage disclosure | all | `test:` renders with no session, **zero `features/auth` import** · `review:` `TR_STORAGE` |
| AC-3 advisory framing | all | `review:` `TR_ADVISORY` |
| AC-4 SIMULATED, six facts | all | `review:` `TR_SIM_DISCLOSURE` |
| AC-5 multiplicity caution | all | `review:` `TR_MULTIPLICITY` |
| AC-6 no score-change control/copy | all | **`test:`** negative space — no control anywhere + the forbidden strings absent + outcomes has zero write functions |
| AC-7 counted cell: 7 facts together, no interaction | counted | **`test:`** the `TR_COUNTED_READ` + `TR_COUNTED_BASIS` builders |
| AC-8 no rate without N/range/window/basis | counted | **`test:`** invariant (§2.4 one-string) |
| AC-9 no rate without mean + dispersion | counted | **`test:`** invariant (§2.4 one-string) |
| AC-10 mean per-trade %, size-unweighted, never dollar expectancy | counted + frame | **`test:`** negative space — no `$`, no "expectancy" in the readout · `review:` `TR_RETURN_DEF` |
| AC-11 plain range, not a bare ±, not behind an interaction | counted | **`test:`** builder emits `plausibly {lo}–{hi}%` |
| AC-12 >20pp ⇒ "still wide" | counted | **`test:`** threshold rule, strictly `> 20`; and **not** at exactly 20 |
| AC-13 hit definition stated | frame | `review:` `TR_HIT_DEF` |
| AC-14 no semantic tint on a rate | counted | **`test:`** no `success.main`/`error.main`/red/green/arrow/icon in the readout (the file next door does exactly this) |
| AC-15 five families, fixed order | default/partial | `review:` ordering |
| AC-16 overlap stated · no summed total | frame + all | `review:` `TR_OVERLAP` · **`test:`** no total that sums cell Ns exists |
| AC-17 coverage without interaction | default | **`test:`** `TR_COVERAGE` builder + it renders outside any disclosure |
| AC-18 full breakdown on demand, plain reasons | breakdown | `review:` the labels · **`test:`** the reason lookup is **exhaustive** (a missing key would silently vanish a count) |
| AC-19 epoch date + explanation | frame | `review:` `TR_EPOCH` · **`test:`** the epoch is **derived** — a fixture with an earlier digest-carrying record yields the earlier date (a hardcoded date is invisible to review) |
| AC-20 one file, three stores, filename stem | archive | **`test:`** durability |
| AC-21 export with zero history says empty | archive + empty | **`test:`** |
| AC-22 confirm states only-adds before any write | import step 1 | `review:` copy · **`test:`** no store write occurs before Import is pressed |
| AC-23 result report every attempt | import step 2 | `review:` copy · **`test:`** the three counts |
| AC-24 re-import same file ⇒ 0 added, readout unchanged | import + default | **`test:`** idempotency (`[loss-free-durable-migration]`) |
| AC-25 import not gated | import | **`test:`** a signed-out import completes; **zero** `useGate`/`simTradeGate` (§2.7) |
| AC-E1 no history ⇒ honest empty | **empty** | **`test:`** state selection + **not** confused with unreadable |
| AC-E2 1–19 counted ⇒ count only | **building** | **`test:`** |
| AC-E3 3-for-3 trap | **building** | **`test:`** the strings `100%` and `3 of 3 won` absent for that cell |
| AC-E4 day one, every cell building | **default** (no computed cell) | **`test:`** no rate anywhere + `TR_LEAD_EXPLAINER` renders |
| AC-E5 corrupt ⇒ empty/partial + reason, no throw, data intact | **unreadable** / **partial** | **`test:`** |
| AC-E6 one malformed record | default + breakdown | **`test:`** the other 99 still counted |
| AC-E7 typed/theoretical excluded | breakdown | **`test:`** |
| AC-E8 modeled excluded, not a cohort | breakdown | **`test:`** + no `modeled` cell exists anywhere |
| AC-E9 scripted scenario excluded | breakdown | **`test:`** |
| AC-E10 no decision record (incl. the seed) | breakdown | **`test:`** + negative space: `seed`/`demo` absent from the surface |
| AC-E11 open not counted, mark never moves a rate | default | **`test:`** |
| AC-E12 never-filled | default + breakdown | **`test:`** |
| AC-E13 pre-capture: tier counts, others report it | family coverage | **`test:`** tier `pre_capture === 0` **from the data**; no "unknown" cell exists |
| AC-E14 captured-but-unavailable, distinct | family coverage | **`test:`** the two clauses are distinct |
| AC-E15 declined import | import declined | **`test:`** counted N + rates identical before/after |
| AC-E16 conflict ⇒ existing wins | import step 2 | **`test:`** |
| AC-E17 stream drop ⇒ unchanged, un-dimmed | all | **`test:`** the iv-rank precedent — no live prop, no dim |
| AC-E18 AI-rec partial attribution, both directions | family coverage | **`test:`** note renders iff `not_attributable_by_path > 0`, absent when `0` |

**Invariant cases with no AC of their own — `test:` each** (these are the negative space; they are the
reason this feature is safe):

1. **Forbidden-importer source-scan** — nothing imports `features/trading/outcomes` except its host
   surface (`ARCHITECTURE_CONTRACT` §5.1 boundary 2 enumerates them). ⚠ Use the **Vite `?raw` idiom** —
   `fileURLToPath(new URL(...))` **throws** in this Vitest env (the ai-context-pack lesson).
2. **Zero write functions** in the ledger read module (boundary 3).
3. **The ledger's output rides no AI export / prompt / persona context** (boundary 4).
4. **The balance identity** `M == counted + Σ excluded_by_reason` over fixtures. ⚠ **A CI assertion, never
   a runtime throw** (`[best-effort-isolated-or-null]`).
5. **The family identity** `counted_total == attributed + unavailable_at_capture + pre_capture`
   (+ `not_attributable_by_path` for AI-rec), per family.
6. **⚠ M spans BOTH position sources.** *The sharpest failure mode in this build.* A denominator read from
   the v2 positions map alone, paired with a numerator from the unioned index, yields a coverage statement
   whose **numerator can exceed its denominator** — a statement that lies, **in the direction of
   flattering the feature**. Fixture: a closed position that exists **only** in the v1 `trades` map (the
   Ticker's `useGhostTrade` is live and still writes v1; the v1→v2 migration runs **only once**, when no
   v2 blob exists) ⇒ it must appear in **both** `counted` and `M`.
7. **`attributed` is derived from the outcome population, never by summing cell Ns.** Fixture: one outcome
   firing **three** setups ⇒ the setup family's `attributed` is **1**, not 3.
8. **No include/exclude toggle, override, or filter exists** — in the data, the type, or the surface
   (§8 non-goal 15).
9. **`[theme-token-discipline]`** — zero hardcoded hex; mode-aware values via **`extrasFor(theme)` inside
   sx callbacks** (bare `extras.` is dark-only). **Dark/light parity is part of done** → `review:` both
   modes + the lint/hex scan.
10. **`apps/api` diff is empty** → `review:` at GATE Q.

---

## 9. What I did NOT design (and you must not add)

- **No score/threshold/weight suggestion** — not a control, not a chip, not a copy line, not a "your Prime
  tier underperforms" nudge (AC-6, `[score-change-is-deliberate-and-measured]`: this feature is that
  rule's **enabler, never its exerciser**).
- **No include/exclude toggle, override, filter, sort, column customization, or saved view** (§8 non-goal
  15 + §2.4).
- **No `modeled` cohort** (§4.4 — it is a breakdown *reason*, never a cell).
- **No "stale open" flag** (§4.3).
- **No window selector** (§4.11).
- **No "would the rec I rejected have worked?"** — a rejected rec produces no position, so there is no
  outcome. Rejections are **not** a cohort.
- **No Ticker-page widget, no `/_ops/metrics` surface, no new nav item** (§3 Out).
- **No dollar figure, no total, no summed N** (§2.4, AC-16).
- **No restore / replace / clear / reset** (§5.9).
- **No AI interpretation of the ledger** (§8 non-goal 8).
- **Nothing from the architect's §8 non-goals 1–15.**
