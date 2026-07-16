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
>
> **⚠ AMENDED AT GATE Z (2026-07-16) — TWO COPY RULINGS, nothing else.** The feature is built; this is a
> targeted copy amendment, **not** a re-design and **not** a re-fan-out (compressor #3 was **not** re-run).
> The amendment is confined to: **§5.5** (one reason label + one framing bullet) · **§5.9** (the decline
> set gains a **second class**; the set stays CLOSED) · **§8** (the AC map: AC-E10 sharpened; AC-E19 /
> AC-E20 / AC-E21 added) · **§10** (new — the rulings of record, with the exact final strings). **Every
> other state, string, decision and constraint below is unchanged and still locked.** No pin was reopened;
> no product scope changed; no new behavior, count, shape, badge, cohort or reason was created.

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

*(A fifth refinement — `no_decision_record`'s label, which under-described its own predicate the same way
— was made at **GATE Z, 2026-07-16**. It is recorded in §10.2, not here, because the PM named it
explicitly at §7.20 / AC-E20 rather than leaving it to me to catch.)*

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

*(This state's fact — "we could not read all of your stored history this time" — is also what **declines an
import**. See §5.9's class-B decline and §10.1.)*

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
| basis: `sources_complete` | the **partial banner** + the `· partial read` suffix on every counted cell's basis line (§2.11) **+ the class-B import decline** (§5.9) |
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

⚠ **The last sentence is scoped by §5.9's class-B decline.** "If you have an archive file you can import
it" is true — the *offer* stands, unconditionally, because the archive block renders in every state. But if
the store still cannot be read when the user presses Import, the import is **declined** (§10.1), and the
decline copy says why in terms that match this state's own words. **Do not fork this string to pre-empt
that**; a pre-emptive "but it might not work" here would take away an affordance that is usually fine.

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
| `no_decision_record` | `No entry decision recorded — it can't tell us whether entering was a good call` |
| `unresolved_join` | `Couldn't link to its decision — not counted` |
| `scenario_sourced` | `Scripted test scenario — not a real decision` |
| `unpriced_basis` | `Entry or exit price was typed, theoretical or stale — not a quote` |
| `modeled_basis` | `Re-priced between quotes — not a quote` |
| `malformed` | `Unreadable record — not counted` |

> ⚠ **`no_decision_record`'s label was amended at GATE Z (2026-07-16) — see §10.2 for the ruling, the
> reason, and the exact final string.** The old label (`No decision recorded — not counted`) was **false**
> for a rolled-into leg, which *does* have a recorded decision — just not an **entry** one. **Nothing else
> in this table changed. No reason was added; the pre-named slot after `scenario_sourced` stays EMPTY.**

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
- **⚠ `no_decision_record` is a LIVE, GROWING, ORDINARY bucket — not a demo-seed curiosity** (`PRODUCT_
  CONTRACT` §4.17-B2, AC-E10, AC-E20). Every **rolled-into leg** lands here the day it closes, from
  ordinary user activity. **Do not treat it as near-always-zero, do not design it as an edge case, and do
  not write copy that apologizes for it.** It is a normal category a real user will see routinely; it must
  read as one. **The demo seed still gets NO special case** — `testSeed.ts`'s fabricated closed position
  lands here like any other record with no entry decision, and it is **one member of this bucket, not its
  archetype**. **The strings "seed", "demo", "test data" and "sample" appear nowhere in this surface**, and
  no code branch mentions it.
- **⚠ No roll anything** (`PRODUCT_CONTRACT` §4.17-A2, AC-E21, §8 non-goal 15). No roll row, no roll
  reason, no roll count, no "X of these were rolls", no badge, no asterisk, no cohort, no filter. **A roll
  is a close, not a category.** The basis obligation is discharged by the hit **definition** (`TR_HIT_DEF`,
  AC-13), never by a count. *"Surfacing the roll count for transparency" is the failure mode here, not the
  safeguard.*
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
- **⚠ A rolled-OUT leg renders as a plain counted cell — nothing marks it** (AC-E19/AC-E21). No badge, no
  asterisk, no footnote, no separate line, no tint, no "(rolled)". It is an outcome without an asterisk,
  and that is the ruling (`PRODUCT_CONTRACT` §4.17-A).

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

#### 5.9.1 Declined import (AC-E15) — **TWO CLASSES, one closed set**

*(Restructured at GATE Z, 2026-07-16 — ruling of record in §10.1. Class A is unchanged.)*

The decline set was written as **file reasons only**. It is now **two classes**, because there are two
different things that can be wrong, and they are **not the same fact and not the same feeling**:

- **Class A — the FILE is the problem.** *"We looked at what you handed us and can't use it."*
- **Class B — YOUR STORED HISTORY is the problem, and we will not touch it.** *"Your file is fine. We
  stopped because writing into a history we can't fully read could destroy records."*

**The set is still CLOSED.** Two classes is not an open door: a new decline reason — in either class —
still requires a UX ruling. **Never a raw parser message, never a stack trace, never a `catch` string.**

**Class A — the file is the problem.** Same dialog, step 2, declined variant. Unchanged:
```
TR_IMPORT_DECLINED_TITLE = "Import declined"
TR_IMPORT_DECLINED_BODY  = "{reason} Nothing was imported. Your existing data was not changed."
```
`{reason}` from the class-A closed set:
```
TR_DECLINE_UNREADABLE = "This file couldn't be read."
TR_DECLINE_NOT_OURS   = "This isn't a Convexa archive file."
TR_DECLINE_VERSION    = "This archive was written by a version this app doesn't understand."
```

**Class B — your stored history is the problem, and we will not touch it.** Same dialog, step 2, a
**third variant** beside *complete* and *declined (file)*. It is **self-contained: it does NOT pass a
`{reason}` through `TR_IMPORT_DECLINED_BODY`.** Its own title, its own body:
```
TR_IMPORT_DECLINED_STORE_TITLE = "Import declined — your file is fine"
TR_IMPORT_DECLINED_STORE_BODY  = "We couldn't read all of your stored history this time. Importing adds to
                                  that history, and we won't write over records we can't read — so we
                                  stopped before touching anything. Nothing was imported, nothing was
                                  changed, nothing was deleted: your history and your file are exactly as
                                  they were. Reload and try the same file again — importing the same file
                                  twice changes nothing."
```
Button: **Done** (the same button; a decline is a report, not a dead end).

**⚠ Why class B does not reuse class A's template.** Class A's tail — *"Nothing was imported. Your
existing data was not changed."* — is a **reassurance beside the point**: the point was the file. In class
B, **not touching your data IS the entire event**. Passing a class-B reason through class A's sentence
would rank the protection as a footnote to a failure, when the protection is the whole answer. **Class B's
body is one string for the same reason the counted read is one string: the fact and its meaning arrive
together or not at all.**

**⚠ Binding on class B's wording:**
- **It must never imply the user's data was lost, damaged, deleted or changed. Nothing was touched — that
  is the point.** "couldn't be read **this time**" + "Reload and try again" is the same transient framing
  §5.3 and §5.4 already use for the same underlying fact. Keep it.
- **One string covers both the partial store and the fully-unreadable store.** *"We couldn't read all of
  your stored history"* is true in both. **Do not fork it into a partial variant and a total variant** —
  the user's situation and the app's answer are identical in both, and two strings would drift.
- **No "Retry" button, no "Import anyway", no "Repair", no "Force", no "Clear and import".** The refusal
  is the feature (`[loss-free-durable-migration]`). The remedy is a reload, and the body says so.
- **No blame, no apology, no `severity="error"`.** It is a normal, correct outcome of a safety rule.

**⚠ Binding on the whole archive block (`[loss-free-durable-migration]`):**
**No "Restore". No "Replace". No "Overwrite". No "Clear". No "Reset". No "Start fresh". No
"Import as new".** Not a button, not a mode, not a checkbox, not a copy line. A destructive restore is
the one operation this invariant exists to forbid. **A declined import — class A or class B — leaves the
stores byte-untouched and says so.**

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

**⚠ No tooltip on any exclusion row.** The breakdown panel is *integers and reasons, full stop* (§5.5) —
a per-row ⓘ would put an explanation behind an interaction inside content that is already behind one, and
it would be the thin end of the drill-through this feature forbids. **Each reason label carries its own
why, in the label.** That is why `no_decision_record`'s label is a sentence and not two words (§10.2).

**Glossary terms and where each is defined (all visible, none tooltip-only):** *hit rate* →
`TR_HIT_DEF` · *plausibly X–Y%* → `TR_RANGE_DEF` · *avg per trade / ±Npts trade to trade* →
`TR_RETURN_DEF` · *quoted fills only* → `TR_BASIS_DEF` · *building history* → `TR_BUILDING` ·
*predate capture* → `TR_EPOCH` + its ⓘ · *not available at entry* → the family coverage clause ·
*no entry decision* → the `no_decision_record` label itself (§5.5) + `TR_HIT_DEF`'s roll clause.

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

**The import dialog is not a body state** — it is a modal over any of the four. Its variants are: confirm ·
complete · declined (class A) · declined (class B) (§5.9.1). **The class-B decline is reachable from body
states 1 and 3** (the store could not be fully read) — which is exactly the pairing the copy assumes: the
user is looking at §5.3 or the partial banner, reads "import only ever adds", tries it, and gets a decline
whose first sentence echoes the state they are already looking at. **That echo is deliberate. Keep the
wording aligned if either ever changes.**

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
| AC-13 hit definition stated (incl. closing by rolling) | frame | `review:` `TR_HIT_DEF` |
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
| AC-E10 **no ENTRY decision record** — the seed **and** every rolled-into leg (a live, growing bucket) | breakdown | **`test:`** it is excluded and reaches no rate + negative space: `seed`/`demo` absent from the surface *(the existing case stands — the extension adds members to the bucket, not assertions)* · `review:` the label is true of **both** members (§10.2) |
| AC-E11 open not counted, mark never moves a rate | default | **`test:`** |
| AC-E12 never-filled | default + breakdown | **`test:`** |
| AC-E13 pre-capture: tier counts, others report it | family coverage | **`test:`** tier `pre_capture === 0` **from the data**; no "unknown" cell exists |
| AC-E14 captured-but-unavailable, distinct | family coverage | **`test:`** the two clauses are distinct |
| AC-E15 declined import — **class A (file) and class B (store)** | **import declined (A)** / **import declined (B)** | **`test:`** counted N + rates identical before/after *(the existing case covers both classes — same assertions, no new spec)* · `review:` the class-B title + body (§10.1) |
| AC-E16 conflict ⇒ existing wins | import step 2 | **`test:`** |
| AC-E17 stream drop ⇒ unchanged, un-dimmed | all | **`test:`** the iv-rank precedent — no live prop, no dim |
| AC-E18 AI-rec partial attribution, both directions | family coverage | **`test:`** note renders iff `not_attributable_by_path > 0`, absent when `0` |
| AC-E19 rolled-OUT leg ⇒ a plain counted outcome, no marker | **counted** | **`test:`** already covered by the Architect's pinned case-2 fixture (roll close ⇒ counted) — **do not edit that fixture** · `review:` no roll marker/badge/asterisk renders (§5.7) |
| AC-E20 the no-entry-record label is TRUE of the rolled-into leg | breakdown | `review:` **copy** — the exact string in §10.2. *(Per the 2026-07-13 risk-based rule a string is `review:`, not `test:`. **Do not add a named test for this label.** The existing AC-E10 assertion that hardcodes the old string must be updated to the new one — mechanical, not a new case.)* |
| AC-E21 no roll category (negative space) | all | **`test:`** — **fold into invariant 8's existing source-scan** (extend its assertion to the roll vocabulary; **no new spec file**): no roll cohort, no roll reason key, no roll count, no roll filter, in the data, the type, or the surface |

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
   (§8 non-goal 15). **Extended at GATE Z (AC-E21): the same scan also asserts no roll cohort, no roll
   exclusion reason key, no roll count and no roll filter exists** — the pre-named slot after
   `scenario_sourced` stays **empty**.
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
- **No "Retry" / "Import anyway" / "Repair" on a declined import** (§5.9.1).
- **No roll cell, roll rate, roll exclusion reason, roll count, roll badge or roll filter** (AC-E21,
  `PRODUCT_CONTRACT` §4.17-A2 — a roll is a close, not a category).
- **No AI interpretation of the ledger** (§8 non-goal 8).
- **Nothing from the architect's §8 non-goals 1–15.**

---

## 10. GATE Z copy rulings — 2026-07-16

**Scope of this section: WORDS ONLY.** Two items came back to this lane; both are ruled below. **No
product scope, no behavior, no math, no server internals, no new count, no new shape, no new exclusion
reason, no badge, no cohort, no asterisk.** The accepted pins, A1/A2/A3 and the PM's §11.6 ruling are
**not reopened**. The pre-named exclusion slot after `scenario_sourced` **stays EMPTY**; §8 non-goal 15
stands.

**How to read the verdicts:** each ruling says plainly whether the built FE **stands**, **changes**, or is
**replaced**, and names the constant.

### 10.1 RULING 1 — the store-unreadable import decline: **RESTRUCTURE §5.9. The FE's judgment STANDS; its wording is REPLACED.**

**What came back.** §5.9's decline set was **closed around file reasons** ("bad file, wrong shape, wrong
version"). The FE hit a case the set could not express: importing an archive into a store whose blob
**failed to read**. The store APIs would **rewrite that blob, destroying it** —
`[loss-free-durable-migration]` (never-delete · promote-forward · idempotent · never-throw) forbids that
outright. Refusing is the only non-destructive answer, and a refusal must state a reason. The FE composed
`TR_DECLINE_STORE_UNREADABLE` from §5.4's already-approved partial-read wording, marked it flagged
in-code, and asked for a ruling. **That was the correct escalation and the correct instinct: it invented
no fact and it wrote nothing.**

**The ruling — and why it is not "accept as-is".**

1. **The refusal itself: RATIFIED, unchanged.** Declining is not a gap in the design; it is the design.
   `[loss-free-durable-migration]` outranks the convenience of the import. **No "Retry", no "Import
   anyway", no "Repair", no "Force", no "Clear and import"** — §5.9's binding list already forbade the
   whole family, and this extends it explicitly (§9).
2. **§5.9 is RESTRUCTURED to admit a NON-FILE decline class** — because this is a new **class**, not a new
   string. The closed set was closed around *"the file is the problem."* This one is *"**your existing data
   is the problem, and we will not touch it.**"* That distinction is the **user's whole mental model of
   what just happened**, and it is why the refusal is a **protection, not a failure**. A set that cannot
   say which of those two things happened is not a closed set; it is an incomplete one. **The set stays
   CLOSED — two classes, not an open door.** A new reason in either class still needs a UX ruling.
3. **The FE's string is REPLACED**, for three reasons, none of them stylistic:
   - **It is a fact with no consequence attached.** *"Some of your stored history couldn't be read this
     time."* is true, but it never says **why that stops an import**. The user's file is fine; from where
     they sit the app has refused for a reason it did not give. A refusal that does not connect its reason
     to its refusal is a non-sequitur — and the most available inference the user has is *"my file is
     bad"*, which is exactly wrong.
   - **It inherits the wrong tail.** Fed through `TR_IMPORT_DECLINED_BODY`, it ends *"Nothing was
     imported. Your existing data was not changed."* — a **reassurance beside the point**, correct for
     class A where the point was the file. In class B, **not touching your data IS the entire event**.
     That template ranks the protection as a footnote to a failure. **Inverted.**
   - **It borrows §5.4's words but not §5.4's meaning.** In §5.4 an unreadable store means *the readout is
     understated*. Here it means *a write would destroy*. Same fact, different consequence — and the
     consequence is the whole message.

**The exact final strings.** Class A is **unchanged**. Class B is **self-contained** — it does **not**
pass a `{reason}` through `TR_IMPORT_DECLINED_BODY`:

```
TR_IMPORT_DECLINED_STORE_TITLE = "Import declined — your file is fine"

TR_IMPORT_DECLINED_STORE_BODY  = "We couldn't read all of your stored history this time. Importing adds to
                                  that history, and we won't write over records we can't read — so we
                                  stopped before touching anything. Nothing was imported, nothing was
                                  changed, nothing was deleted: your history and your file are exactly as
                                  they were. Reload and try the same file again — importing the same file
                                  twice changes nothing."
```

**Every clause is load-bearing.** The **title** kills the only inference the user can otherwise draw
(*"my file is bad"*) before they read a word of the body — the other three decline reasons are all about
the file, and the dialog is the same dialog. **"we won't write over records we can't read"** is the
protection, stated as a choice we made, in the user's own terms — not a failure that befell them. **"we
stopped before touching anything"** is the fact `[loss-free-durable-migration]` guarantees. **"nothing was
imported, nothing was changed, nothing was deleted: your history and your file are exactly as they were"**
is the standing rule that this copy must never imply data was lost or changed — **nothing was touched;
that is the point** — and it names **both** artifacts, because the user has two things to worry about.
**"this time"** + **"Reload and try the same file again"** is the same transient framing §5.3 / §5.4
already give the same underlying fact, so a user who sees both surfaces sees one story. The closing clause
reuses `TR_IMPORT_CONFIRM_BODY`'s already-approved idempotency fact so the retry is **known-safe**, not
hoped-safe.

**⚠ ONE string for both the partial store and the fully-unreadable store.** *"We couldn't read **all** of
your stored history"* is true in both cases. **Do not fork it** — the user's situation and the app's answer
are identical in both, and two strings would drift.

**Verdict for the FE — unambiguous:**
- **DELETE `TR_DECLINE_STORE_UNREADABLE`.** It was a `{reason}` fragment for a template class B does not
  use. It has no successor in the class-A set.
- **ADD `TR_IMPORT_DECLINED_STORE_TITLE` + `TR_IMPORT_DECLINED_STORE_BODY`** (above, verbatim).
- **The decline dispatch renders class B's own title + body directly** — it does **not** compose through
  `trImportDeclinedBody(...)`.
- **The condition under which the FE declines is UNCHANGED and not mine to set.** I ruled on the words and
  the state, not on the trigger.
- **Case matrix: AC-E15 (FE case 48) STANDS — same case, same assertions** ("declined ⇒ not imported;
  reason reported; existing data not changed; counted N + rates identical before/after"), now spanning
  both classes. **No new test is required for class B**: per the 2026-07-13 risk-based rule the strings
  are `review:`. The class-B *decline* (that a refusal happens and writes nothing) is already inside case
  48's assertions.

### 10.2 RULING 2 — `no_decision_record`'s label: **CHANGED. One constant, one string.**

**What came back.** `PRODUCT_CONTRACT` §7.20 / AC-E20: a roll's new leg has **only a `roll` record** — so
a decision **WAS** recorded; it just was not an **ENTRY**. The label read *"No decision recorded — not
counted"*. **For that leg it is false.** The reason's own predicate is already *"no **entry** decision
record"*, so **the label under-described its own rule and told the user something untrue.** The PM named
it, deliberately did not write the words, and called it **the same species as the AC-E1/AC-E5 lie this
lane already caught** — telling a user with 400 trades *"Nothing has closed yet"* when the truth was *"we
couldn't read your data"*. It is the same defect: **a label that describes the app's ignorance as the
world's absence.** The fix is the same shape too: **say the narrower, true thing.**

**Two things the old label got wrong, not one.**

1. **It lied.** "No decision recorded" claims a total absence. For a rolled-into leg there is a decision on
   record. Fixed by the **narrowest possible edit** — the PM's own predicate word: **"No **entry**
   decision recorded."** One word. That is the whole lie, gone.
2. **It read as a defect report.** *"— not counted"* states the consequence and stops, so the row reads as
   something that went wrong: a record we failed to keep, a gap, a bug. **AC-E10 was extended: this bucket
   is LIVE and GROWING from ordinary rolls** — not a rare demo-seed curiosity. A user will see it
   **routinely**, and must understand it **at a glance**: *we know this position exists and how it closed,
   but we have no record of how it was **entered** — so it cannot tell us anything about the score.* That
   last clause is the **why**, and without it the row invites the two wrong readings the PM is worried
   about: *"the app lost something"* or *"my trade was thrown away"*. **Neither is true.** It is excluded
   because it is **not evidence** — there is no recorded decision for its result to be evidence *about*.

**The exact final string:**

```
TR_REASON_LABEL.no_decision_record = "No entry decision recorded — it can’t tell us whether entering was
                                      a good call"
```

**Why this wording and not another.**
- **"No entry decision recorded"** is the reason's predicate, said out loud. It is true of **both**
  members of the bucket: the seed record (no decision at all) and the rolled-into leg (a roll decision,
  which is not an entry decision). It **does not claim no decision was recorded** — AC-E20's fact floor,
  met exactly.
- **"it can't tell us whether entering was a good call"** is the **why**, and it is *not evidence* said in
  the house register — the same register as `TR_BUILDING`'s *"fewer than {n_min} outcomes can't tell luck
  from edge"* and `TR_RETURN_DEF`'s *"it does not tell you what you made"*. **"it can't tell us"** puts the
  limit on the **record**, not on the user and not on the app: no blame, no apology, no failure. It reads
  as a **category**, which is what it is.
- **It answers the row's real question in the row.** The cells are keyed on the entry; this feature's one
  question is *"did entering on this read pay?"* (`TR_SUBTITLE`: *"How your own recorded simulated
  decisions actually closed"*). With no entry decision on record, **there is no decision for the outcome to
  be about** — so the exclusion is not a punishment, it is arithmetic honesty.
- **Rejected: "we don't know what it was entered on."** It collides with **pre-capture** (AC-E13), which
  is a *different* bucket that also lacks entry context yet **still counts in tier**. Two buckets must not
  share a sentence.
- **Rejected: "couldn't link it to its decision."** That is `unresolved_join`, verbatim. Here there **is**
  no entry decision to link to — a different fact.
- **Rejected: "we know what opened it."** For a rolled-into leg a roll opened it; for the seed nothing did.
  A clause true of only one member is the same defect this ruling is fixing.
- **Rejected: a per-row note, a G1 note, an ⓘ, or a footnote** to carry the why. **All are new elements in
  a locked panel** (§5.5: *integers and reasons, full stop*) and this is a **words-only** ruling. The label
  carries its own why — which is also why it is a sentence and not two words (§6).
- **Length is fine.** `unpriced_basis`'s label is already a full clause. The row renders `{label} · {n}`;
  the panel is a list of reasons, not a chip rail.

**Verdict for the FE — unambiguous:**
- **CHANGE exactly one entry: `TR_REASON_LABEL.no_decision_record`.** Old: `'No decision recorded — not
  counted'`. New: the string above, verbatim (note the curly apostrophe in `can’t`, per the file's
  existing convention).
- **Every other entry in `TR_REASON_LABEL` STANDS unchanged.** `unresolved_join` keeps its *"— not
  counted"* tail: it is true and it is not the same defect.
- **`EXCLUSION_PRECEDENCE`, the `ExclusionReason` union, the ledger classifier, the counts, the balance
  identity and the roll-up shape are ALL UNCHANGED.** The bucket, its members and its arithmetic are
  exactly as built. **This is words only.**
- **The `TR_REASON_LABEL` docstring must stop framing the bucket around the seed.** It currently reads as
  if the seed were the archetype; per AC-E10-as-extended the seed is **one member of a live, growing
  bucket** whose ordinary member is a rolled-into leg. The **seed still gets no special case** and
  `seed`/`demo`/`test data`/`sample` still appear **nowhere in the surface** — that rule is untouched.
  *(A comment, not user copy — but it is the next reader's mental model, and it is now wrong.)*
- **Case matrix: AC-E10 (FE case 43) STANDS — same case, same assertions.** The extension adds **members**
  to the bucket, not assertions to the case. **AC-E20 is `review:`** — copy. **Do not add a named test for
  this string** (2026-07-13 risk-based rule).
- **⚠ One mechanical follow-through, not a new test:** the existing AC-E10 assertion hardcodes the old
  label (`'No decision recorded — not counted · 1'` in `track-record.flow.spec.tsx`). **Update it to the
  new string.** That is a string update inside an existing case — it is not a new case and not a new
  requirement.

### 10.3 Downstream drift to close (no re-fan-out)

**Compressor #3 was NOT re-run** — the split exists and the lanes are built. Only these references may
drift from this blueprint:

- **`FRONTEND_EXECUTION_CONTRACT` §"Tests to write" case 43 (AC-E10)** — reads *"a closed position with
  **no decision record**"*. It must read **"no ENTRY decision record"**, and note the bucket's ordinary
  member is a **rolled-into leg**, not the seed. **Assertions unchanged.**
- **`FRONTEND_EXECUTION_CONTRACT` §"Tests to write" case 48 (AC-E15)** — reads *"declined import (corrupt
  / unreadable / wrong version)"*, which enumerates **class A only**. It must also name the **class-B**
  decline (store could not be fully read ⇒ refuse, write nothing). **Assertions unchanged** — they already
  cover it.
- **`FRONTEND_EXECUTION_CONTRACT` §"Tests to write"** has **no rows for AC-E19 / AC-E20 / AC-E21** (the PM
  added them at GATE Z round 2). Their verification is fixed by §8 above: **E19** = the Architect's pinned
  case-2 fixture + `review:` · **E20** = `review:` (copy) · **E21** = folded into the existing
  negative-space scan (**no new spec file**).
- **`FRONTEND_EXECUTION_CONTRACT` §"Definition of done"** already says *"Every string sourced from
  `outcomes/copy.ts`, matching `UX_BLUEPRINT` §5 verbatim."* — **that line needs no change**; it now
  resolves to the amended §5.5 / §5.9.1 strings. **This blueprint remains the single source of truth for
  copy.**
- **No `INTERFACE_CONTRACT` change.** The feature is `NO_BACKEND_CHANGE`; no field, no payload, no
  conformance-spec entry is touched by either ruling.
