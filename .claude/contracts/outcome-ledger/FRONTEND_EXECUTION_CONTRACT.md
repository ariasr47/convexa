# outcome-ledger — FRONTEND_EXECUTION_CONTRACT

> **Binds to `.claude/contracts/outcome-ledger/INTERFACE_CONTRACT.md`** (verdict: `NO_BACKEND_CHANGE` —
> this feature consumes **no endpoint at all**; it derives from the durable client stores).
> Self-contained against `.claude/PROJECT_CONTEXT.md` + `INTERFACE_CONTRACT.md` — assume no chat history.
>
> **Read in full before writing code:** `ARCHITECTURE_CONTRACT.md` **§3.4** (the data shape you render —
> rewritten at GATE Z), **§5.1** (the four structural boundaries), **§6** (isolation/error rules), and
> `UX_BLUEPRINT.md` (every state + the exact copy). This contract is the build order; those are the law.

---

## 1. What you are building

An **honesty instrument** on `/positions`: a **Track record** in-page view that reads the user's own
recorded, closed, **simulated** decisions out of the durable client stores and reports how they actually
turned out — hit rate + mean per-trade return by **tier · AI-rec · setup · IV-rank band · persona**, each
inseparable from its sample count, its range, its window and its basis. Plus an **archive** (export + a
merge-only, never-destructive import).

**Its whole value is that it refuses to give a number it cannot support.** Four of the five families start
with **no number at all**, on purpose. Every decision below is subordinated to one risk: *not* "no data" —
**a confident-looking number over 3 trades**.

**This is the entire feature. There is no backend lane.**

---

## 2. Modules & structure

`apps/dashboard/src/app/README.md` is the authoritative structure map. Dependency direction is **downward
only**; **pages never import sibling pages**.

| Path | Holds |
|---|---|
| `features/trading/outcomes/ledger.*` | the harvest → join → classify → aggregate → account **pure derived read**. **ZERO write functions.** |
| `features/trading/outcomes/archive.*` | export (a pure read of the three stores → one envelope) + the **merge-only** import. **Different rules, different module — keep it separate from the read.** |
| `features/trading/outcomes/copy.ts` | **every** user-facing string + the closed label lookups (the `_kit/copy.ts` idiom) |
| `features/trading/outcomes/*.tsx` | `TrackRecordSection` + its children (`UX_BLUEPRINT` §3) |
| `pages/positions/PositionsPage.tsx` | renders `<TrackRecordSection personaLabel={…} />` **below** `<PortfolioPanel/>`, inside the existing 1240px column |

**Not a bento widget** — do **not** wrap it in `@/shared/ui/Widget` (that shell is the ticker bento's).
Match the Positions page's chrome-less idiom.

### ⚠ Import fences (all real, all lint-enforced — check these before you start)

- **Outcomes MAY import:** `features/trading/model` · `positions` · `orders` (read fns) + `shared/`.
  **Nothing else.**
- **Outcomes must NOT import `pages/ticker/widgets/_kit/*`** — an upward `features → pages` import.
  ⇒ Define the **IV-rank band lookup** and the `CaptionLabel`/ⓘ idiom **locally**, matching the ticker's
  wording. *(The 2nd-consumer rule points at promoting them to `shared/` — a **named seam, not this
  feature's work**. Keep the wording identical so the future promotion is a delete, not a merge.)*
- **Outcomes must NOT import `features/personas`** — not on the allow-list. The persona **display name**
  is injected by the page: prop `personaLabel?: (id: string) => string | null`.
- **Outcomes must NOT import `features/auth`** — see §5 (the archive is **ungated**).
- **Tier label:** export the module-local `WORD` map from `features/trading/model/OpportunityTier` and
  import **that** (allowed, single-sourced). **Do NOT use `tierMeta`** — it returns a palette colour and
  drags AC-14 into the readout.

---

## 3. What it consumes (per `INTERFACE_CONTRACT.md`)

**No endpoint. No SSE. No network call of any kind.**

**Durable sources (read-only, all pre-existing keys — no new key is created):**
`convexa.ghost-trade.v1` (decision log **+** the `trades` map) · `convexa.positions.v2` (decision log
**+** the `Position` map) · `convexa.orders.v1` (the `SimOrder` map).

**The only durable WRITE this feature adds** (`ARCHITECTURE_CONTRACT` §3.1 / §2/Q2, binding): an
**optional nested digest object** on `DecisionRecord` at the 5 decision-point events (`open` · `accept` ·
`reject` · `order_placed` · `order_filled`), each field independently nullable, plus an **optional
per-record id** on new records. **No key change, no shape break, no `SCHEMA_VERSION` bump, no backfill,
ever.** Capture is **best-effort** and **must never gate, block, or alter** the trade/position/order
write; it triggers **no fetch and no recompute** (it reads only the bundle already in hand + the persona
store). **Digest absent = pre-capture; digest present-with-null = unavailable that cycle.**

**The derived read the UI consumes:** `ARCHITECTURE_CONTRACT` §3.4 — cohorts (§3.4.1) + the readout-level
coverage roll-up (§3.4.3) + per-family coverage (§3.4.4) + the read's basis (§3.4.6), as **three
non-optional siblings** on one value.

### ⚠ The static rule is a component-signature rule, not a promise

`[live-vs-static-isolation]`, AC-E17. **`TrackRecordSection` and every component beneath it accept NO
`live` / `isLive` / `streamOffline` / `offline` / `data` prop and import nothing from the SSE/live path.**
No offline chip. No dimming. No `opacity` bound to any stream state. No "as of" line, no Refresh, no
freshness treatment, no poll.

**The file next door will mislead you:** `PositionsPage.tsx`'s Net P/L header does
`opacity: streamOffline ? 0.5 : 1` and `color: netPl >= 0 ? 'success.main' : 'error.main'`. That is a
*live P&L*. **Neither pattern may cross into this section.** (The iv-rank widget is the reference
implementation of the correct posture.)

---

## 4. Component states (`UX_BLUEPRINT` §5 has the exact copy — do not paraphrase it)

**Whole-readout body state — wire-driven, first match wins** (`UX_BLUEPRINT` §7):

| # | State | Condition | Renders |
|---|---|---|---|
| 1 | **unreadable** | `counted === 0 && M === 0 && (sources_complete === false \|\| unreadable_records > 0)` | header · frame · `TR_UNREADABLE_*` · archive |
| 2 | **empty** | `sources_complete === true` **and every count is 0** | header · frame · `TR_EMPTY_*` · archive |
| 3 | **partial** | `sources_complete === false` | header · frame · **partial banner** · `TR_COVERAGE_PARTIAL` (**M withheld**) · families · archive |
| 4 | **default** | otherwise | header · frame · `TR_COVERAGE` · families · archive |

⚠ **empty ≠ unreadable.** Telling a user with 400 trades "Nothing has closed yet" because a store failed
to read is a lie. Two states, two copies.

**Per-cell state** — the discriminated union, straight off the read; **never re-derived**:
- **`building`** — `TR_BUILDING` (`"Building history — {n} of {n_min} closed trades. No hit rate yet:
  fewer than {n_min} outcomes can't tell luck from edge."`) **and nothing else**.
- **`computed`** — label · the read line · the `> 20pp` qualifier (conditional) · the basis line.

**States that do NOT exist here, by decision** (`UX_BLUEPRINT` §2.8):
- **loading** — compute the read **synchronously in a `useMemo` on mount**. ⚠ **Do not defer into a
  `useEffect`**: a one-frame flash of the empty state is a lie. *(If a measured store proves too large, a
  skeleton is permitted — but it must be visually distinct from the empty state.)*
- **stale** — all-time, static, historical. No freshness concept.
- **offline** — AC-E17: unchanged + un-dimmed.
- **error** — corrupt history renders **empty / unreadable / partial with a stated reason**. **Never a
  throw, never `severity="error"`, never a Retry, never a repair or a write-back.**

---

## 5. The rules you must not break

1. **The counted read is ONE STRING.** The rate, its range, its N, its mean per-trade return and its
   dispersion come from **one copy builder** returning **one string**, rendered in **one
   `<Typography>`**; the window + basis from a second. **No decomposition into spans/columns/chips.** Any
   decomposition is one `&&` away from a rate-only render. **This is the structural enforcement of AC-8 +
   AC-9** (`PRODUCT_CONTRACT` §4.10, §7.14): *a hit rate alone is trivially gamed by many small wins and
   few large losses; a hit-rate-only read is a defect.*
2. **No typographic hierarchy inside the read line.** The rate renders at the **same size and weight** as
   its mean return and its N. A big rate over a small caption **is** a hero, and §7.1 forbids designing
   one. **The read is the headline; the rate is not.**
3. **No semantic tint. Ever.** No `success.main`/`error.main`/red/green/arrow/icon/sparkline/bar/gauge on
   any rate or return (AC-14). `text.primary`/`text.secondary` only. **The range is the verdict, not the
   hue.**
4. **No progress bar in the `building` cell.** "7 of 20" invites a meter; a meter beside a hit-rate-shaped
   cell reads as **35%**. Text only.
5. **AC-E3 — the 3-for-3 trap.** A cell with three counted outcomes, all winners, renders the `building`
   string **and nothing else**: **no `100%`, no `3 of 3 won`, no rate, no range, no mean, no window, no
   bar.** The type has **no rate field** — do not compute one.
6. **No dollar figure anywhere.** No total, none per cell. The strings `expectancy` and `$` do not appear
   (AC-10 — the per-trade mean is **size-unweighted** and is **not** dollar expectancy; and a dollar total
   would sum **overlapping** cells, AC-16).
7. **Cell Ns are never summed** (AC-16). One closed trade appears in **every** cell it qualifies for. No
   total, anywhere. And **`attributed` is derived from the outcome population, NEVER by summing cell Ns**
   — the **setup** family fans out, so summing overstates coverage.
8. **No include/exclude toggle, override, filter, sort, column customization, or saved view** (§8 non-goal
   15). Cell order is **fixed and never data-dependent** — sorting by rate builds a leaderboard the sample
   cannot support. **If you find yourself writing a function from an excluded record to a cohort member,
   you have misread the contract.**
9. **The archive is UNGATED** (AC-25, `[server-side-gate-enforcement]`, `PRODUCT_CONTRACT` §4.13). **Do
   NOT call `useGate` / `gate.guard` / `gate.prompt` / `simTradeGate` / `SignInPrompt`; do not import
   `features/auth`.** ⚠ **`PortfolioPanel.tsx` — the component directly above this one on the same page —
   server-gates every write, and the import *looks* like a write.** It is not comparable: it reaches no
   server, creates no position, costs nothing, and writes only into the user's own browser. There is **no
   boundary at which a gate could be enforced**, so an FE-only gate is **decorative and forbidden**.
   **Ungated is the decision.**
10. **The archive ONLY EVER ADDS** (`[loss-free-durable-migration]`). **No Restore / Replace / Overwrite /
    Clear / Reset / Start fresh** — not a button, not a mode, not a checkbox, not a copy line. Merge-only ·
    idempotent · keep-existing-on-conflict · **never throw** · writes go **only through the existing store
    append/put APIs**, never `localStorage` directly. A declined import leaves the stores **byte-untouched**
    and says so. **Never prune, compact, or delete a record** — not to "clean up" the readout, not on
    exclusion.
11. **The read is RECOMPUTED after an import, never incrementally patched** (`ARCHITECTURE_CONTRACT`
    §3.5). A patched count drifts from the stores and breaks the balance identity — the one thing the
    roll-up exists to guarantee.
12. **Labels come from closed lookups; never re-derive one from a scalar** (`[digested-labels-not-raw-dump]`).
    ⚠ **Never derive the tier from `opportunity_score`. Never derive the IV band from a rank.** An
    unrecognized setup name renders **verbatim, untransformed** (fail-honest).
13. **The demo seed gets NO special case** (AC-E10). `positions/testSeed.ts` writes a **fabricated closed
    position** (`realized_pl_dollar: 196`, `realized_pl_pct: 48.4`) via `putPosition` and **never calls
    `appendDecision`** — a naive "closed position = outcome" rule would inject a fabricated 48.4% winner
    into the hit rate. **The DecisionRecord-as-spine rule excludes it structurally, for free. DO NOT RELAX
    THAT ANCHOR.** It lands in `no_decision_record` like any other record with no decision. **The strings
    `seed` / `demo` / `test data` / `sample` appear nowhere in this surface**, and no code branch mentions
    it.
14. **`[theme-token-discipline]`** — bind to the MUI theme / `shared/theme/tokens.ts`; **zero hardcoded
    hex**; mode-aware values via **`extrasFor(theme)` inside sx callbacks** (bare `extras.` is dark-only).
    **Dark/light parity is part of done.**
15. **No score/threshold/weight suggestion** — not a control, not a chip, not a copy line, not a nudge
    (AC-6). This feature is `[score-change-is-deliberate-and-measured]`'s **enabler, never its exerciser**.
16. **A tooltip explains; it never informs.** No tooltip carries a number, a rate, a count, or any fact an
    AC requires.

---

## 6. Build order

1. **Capture (write) — inside the EXISTING recorders**, not in the ledger module:
   `useGhostTrade.recordDecision` · `usePortfolio.recordDecision` · `useOrders`. Attach the optional digest
   from the bundle already in hand + the persona store. Best-effort per field (absent ⇒ `null`). **Never
   blocks the trade write. No fetch, no recompute, no wire traffic.**
2. **AI-rec attribution — verify the seam, take the honest fallback.** Check whether the shared
   `TradeEntryDialog` prefill seam can thread the rec identity through to the `open` call **without forking
   the dialog** (`[single-shared-sim-entry-dialog]` **forbids a fork**). If it cannot be threaded cleanly,
   **AI-rec attribution is ORDER-PATH-ONLY** and those outcomes land in the AI-rec family's
   `not_attributable_by_path` count — which is **NOT** `unavailable_at_capture` (the rec *was* available;
   the plumbing could not carry it — collapsing them would make "not available at entry" a lie about the
   product). **The fallback is preferred to a fork.** The UI note self-cancels off the count (§4/AC-E18).
3. **Harvest (read) — `ledger.*`, pure, zero write functions.** Read **both** decision logs → union →
   de-dupe by the **one identity function** (per-record id when present, else the composite
   `(trade_id, event_type, clock_time)`). Read the **v2 positions map + the v1 `trades` map** → union →
   de-dupe by `id`, keep-existing-on-conflict. Read the orders map. **Record per-source read success ⇒ the
   `sources_complete` basis.** A malformed record is **skipped and counted, never thrown** — one bad record
   must not cost the other 99.
4. **Join → classify → aggregate → account.** Spine = the `DecisionRecord`. ⚠ **The digest is read from
   the SAME entry decision record the join fixed** — **never borrowed from another record with the same
   `trade_id`** (an `accept` record may carry a digest the `open` record lacks; reading across fabricates
   context the entry did not observe and under-counts `pre_capture`). Then partition **P1/P2/P3**, attribute
   each P1 record to **exactly one** reason by the **stated precedence order**, partition P3 per family, and
   **derive the epoch from the data**. The accounting is a **second pass over the populations the join
   already produced — never a second, independent read of the stores** (that is how numerator and
   denominator drift apart).
5. **`copy.ts`** — every string + every closed lookup, from `UX_BLUEPRINT` §5/§6. Verbatim.
6. **The UI** — `UX_BLUEPRINT` §3 tree, §7 state selection, §5 copy.
7. **`archive.*`** — export + the two-step import dialog (confirm → report), `UX_BLUEPRINT` §5.9.
8. **The boundary tests** — §7 case 30–39 below.

---

## 7. Tests to write

**⚠ This is your requirement set — you implement it and may add to it, but never drop a listed case. You
do not choose the requirement set.**

**Each case is marked with its verification kind**, per `.claude/agents/qa-verify.md` §4 (the **risk-based**
rule, amended 2026-07-13 — it **replaced** the old "one named test per AC" rule, which inflated suites with
brittle verbatim-copy assertions):
- **`test:`** — an **automated test is REQUIRED**: a silent regression is plausible **and** invisible to
  review (invariants · negative space · structural rules · stateful/visual behavior that regresses as a
  side effect of an unrelated refactor).
- **`review:`** — **review/QA is sufficient and preferred**: the behavior is visible and any change would
  be intentional (copy wording, presence, ordering). QA records these as "verified by review/QA". **Do not
  force a brittle assertion here.**

Prefer **one high-level integration check over many literal component pokes**; never split one behavior
into an assertion-per-AC. Stack: Vitest + Testing Library (`nx test @org/dashboard`).

### Placement & framing

| # | AC | Case | Kind |
|---|---|---|---|
| 1 | AC-1 | Track record renders on `/positions`; adds no nav item | `review:` |
| 2 | AC-1 | it renders on **neither** the Ticker route **nor** `/_ops/metrics` — covered by the forbidden-importer scan (#30) | `test:` |
| 3 | AC-2 | renders **fully** with no session; **zero** `features/auth` import | `test:` |
| 4 | AC-2 | `TR_STORAGE` ("stored in this browser only — not tied to your account") | `review:` |
| 5 | AC-3 | `TR_ADVISORY` | `review:` |
| 6 | AC-4 | `TR_SIM_DISCLOSURE` names **all six** sim facts; it is body text, **not** a tooltip/footnote | `review:` |
| 7 | AC-5 | `TR_MULTIPLICITY` | `review:` |
| 8 | AC-6 | **negative space**: no control/button/suggestion anywhere; the readout contains no score/weight/threshold-change copy; the ledger module has **zero write functions** | `test:` |

### The counted read

| # | AC | Case | Kind |
|---|---|---|---|
| 9 | AC-7 | a cell with ≥ `n_min` counted outcomes renders rate · range · N · mean · dispersion · window first+last · "quoted fills only" — **together, with no interaction** | `test:` |
| 10 | AC-8 | **invariant**: the builder emits no rate without N + range + window + basis | `test:` |
| 11 | AC-9 | **invariant**: the builder emits no rate without mean per-trade return + dispersion | `test:` |
| 12 | AC-10 | **negative space**: no `$` and no "expectancy" anywhere in the readout | `test:` |
| 13 | AC-10 | `TR_RETURN_DEF` states "size-unweighted" + "not dollar expectancy" | `review:` |
| 14 | AC-11 | the range renders as `plausibly {lo}–{hi}%` — not a bare ±, not behind an interaction | `test:` |
| 15 | AC-12 | width `> 20pp` ⇒ `TR_STILL_WIDE` renders; **exactly 20.0pp ⇒ it does not** | `test:` |
| 16 | AC-13 | `TR_HIT_DEF` (zero is not a hit; it stays in the denominator; closing by rolling is closing) | `review:` |
| 17 | AC-14 | **no semantic tint**: no `success.main`/`error.main`/red/green/arrow/icon on any rate ⚠ *the file next door does exactly this* | `test:` |
| 18 | AC-15 | five families, order: tier → AI-rec → setup → IV-rank band → persona | `review:` |
| 19 | AC-16 | `TR_OVERLAP` (a trade appears in every cell it qualifies for) | `review:` |
| 20 | AC-16 | **negative space**: no total that sums cell Ns exists anywhere | `test:` |

### Coverage & honesty

| # | AC | Case | Kind |
|---|---|---|---|
| 21 | AC-17 | `TR_COVERAGE` renders **outside** any disclosure: counted N of M, plus open, plus never-filled | `test:` |
| 22 | AC-18 | the breakdown's reason lookup is **exhaustive** — every reason key maps to a label (a missing key silently vanishes a count) | `test:` |
| 23 | AC-18 | each reason's label is plain and distinct; the `unpriced_basis` / `modeled_basis` labels do not collide | `review:` |
| 24 | AC-19 | the epoch is **DERIVED FROM THE DATA**: a fixture whose earliest digest-carrying record is older yields the **older** date. ⚠ *A hardcoded ship date is the natural implementer error and is invisible to review* | `test:` |
| 25 | AC-19 | `TR_EPOCH` explains that pre-epoch outcomes have no setup/persona/IV-band/score context | `review:` |

### Archive

| # | AC | Case | Kind |
|---|---|---|---|
| 26 | AC-20 | export ⇒ ONE file spanning **all three** stores; filename stem `convexa-archive-{YYYY-MM-DD}` | `test:` |
| 27 | AC-21 | export with **zero** history succeeds; the result says the archive is **empty** | `test:` |
| 28 | AC-22 | **no store write occurs before Import is pressed**; the confirm states only-adds/never-deletes/never-overwrites/never-replaces first | `test:` |
| 29 | AC-22 | `TR_IMPORT_CONFIRM_BODY` wording | `review:` |
| 30 | AC-23 | every attempt reports added / skipped-as-present / collided-kept-as-is (all three, including zeros) | `test:` |
| 31 | AC-24 | **idempotency**: re-importing the same file ⇒ `0 added`, and the readout's counted N, rates **and** coverage statement are identical before/after (`[loss-free-durable-migration]`) | `test:` |
| 32 | AC-25 | a **signed-out** user completes an import; **zero** `useGate`/`simTradeGate` call | `test:` |

### Edge / degraded

| # | AC | Case | Kind |
|---|---|---|---|
| 33 | AC-E1 | no history ⇒ the **empty** state; **not** confused with unreadable; no error, no blank page, no zero-rate | `test:` |
| 34 | AC-E2 | 1–19 counted ⇒ `N of 20` and **no rate, no range, no mean** — nothing numeric readable as a result | `test:` |
| 35 | AC-E3 | **the 3-for-3 trap**: 3 counted, all winners ⇒ `building`; the strings **`100%`** and **`3 of 3 won`** do not appear for that cell | `test:` |
| 36 | AC-E4 | day one (every cell building) ⇒ `TR_LEAD_EXPLAINER` renders, each cell shows its count vs the floor, **no rate anywhere** | `test:` |
| 37 | AC-E5 | corrupt history ⇒ **unreadable** (or **partial**) with a stated reason; **no throw**; the rest of the app unaffected; **the stored blob is not destroyed or rewritten** | `test:` |
| 38 | AC-E5 | **partial** (`sources_complete: false`) ⇒ the **"of M" comparison is withheld**, the banner renders, and every counted cell's basis line carries `· partial read`. ⚠ *A partial roll-up must NEVER present its smaller M as the whole population* | `test:` |
| 39 | AC-E6 | one malformed record ⇒ the other 99 still counted; it appears in the breakdown as an unreadable record | `test:` |
| 40 | AC-E7 | typed / theoretical / last-known / manual basis ⇒ excluded, own reason, contributes to no rate | `test:` |
| 41 | AC-E8 | `modeled` basis ⇒ excluded, own distinct reason, **and no `modeled` cohort/cell exists anywhere** | `test:` |
| 42 | AC-E9 | `provenance.source === 'ai_scenario'` ⇒ excluded, named as a scripted test scenario | `test:` |
| 43 | AC-E10 | a closed position with **no decision record** (incl. `testSeed.ts`'s fabricated `196` winner) ⇒ excluded, counted under `no_decision_record`, **reaches no rate**; **negative space**: `seed`/`demo` absent from the surface | `test:` |
| 44 | AC-E11 | an **open** position ⇒ in the "open — not yet counted" count only; its unrealized mark **never moves a rate** | `test:` |
| 45 | AC-E12 | a cancelled/expired/never-filled order ⇒ the "never filled" count only; no outcome | `test:` |
| 46 | AC-E13 | pre-capture outcome ⇒ **counted in its tier cell**; reported as pre-capture in the setup/persona/IV-band coverage; **never an "unknown" cell with a rate**. Tier's `pre_capture === 0` **from the data** — no tier-specific copy branch | `test:` |
| 47 | AC-E14 | captured-but-unavailable reads "had none available at entry" — **visibly distinct** from "predate capture" | `test:` |
| 48 | AC-E15 | declined import (corrupt / unreadable / wrong version) ⇒ not imported; reason reported; the report says existing data was **not changed**; counted N + rates **identical** before/after | `test:` |
| 49 | AC-E16 | a colliding, **differing** record ⇒ the **existing** record wins, the conflict is counted, the report says so | `test:` |
| 50 | AC-E17 | **stream drop** ⇒ the readout renders **unchanged and un-dimmed**: no offline chip, no dimming, no stale treatment. *(The iv-rank spec is the reference.)* | `test:` |
| 51 | AC-E18 | `not_attributable_by_path > 0` ⇒ `TR_AIREC_PATH_NOTE` renders; `=== 0` ⇒ it is **absent**. **Both directions.** | `test:` |

### Invariant / structural cases with no AC of their own — **the negative space that makes this feature safe**

| # | Case | Kind |
|---|---|---|
| 52 | **Forbidden-importer source-scan**: nothing imports `features/trading/outcomes` except its host surface. Forbidden importers, enumerated: `features/trading/model/*` · `positions/*` · `orders/*` · `features/personas/*` · the ai-rec panel / state-export / prompt assembly · **any `@org/api` fetcher call site**. ⚠ **Use the Vite `?raw` idiom — `fileURLToPath(new URL(...))` THROWS in this Vitest env** (the ai-context-pack lesson) | `test:` |
| 53 | the ledger read module has **zero write functions** | `test:` |
| 54 | the ledger's output rides **no** AI state-export / persona prompt / ai-rec context | `test:` |
| 55 | **the balance identity** `M == counted + Σ excluded_by_reason` over fixtures (nothing in `adjacent` participates). ⚠ **A CI assertion — NEVER a runtime throw** (`[best-effort-isolated-or-null]`) | `test:` |
| 56 | **the family identity** `counted_total == attributed + unavailable_at_capture + pre_capture` (+ `not_attributable_by_path` for AI-rec), per family | `test:` |
| 57 | **⚠ M spans BOTH position sources** — *the sharpest failure mode in this build*. Fixture: a closed position existing **only** in the v1 `trades` map (the Ticker's `useGhostTrade` is **live** and still writes v1; the v1→v2 migration runs **only once**, when no v2 blob exists) ⇒ it must appear in **both** `counted` and `M`. An M from the v2 map alone with a unioned numerator yields **a numerator that can exceed its denominator** — a coverage statement that lies, **in the direction of flattering the feature** | `test:` |
| 58 | **`attributed` is derived from the outcome population, never by summing cell Ns.** Fixture: one outcome firing **three** setups ⇒ the setup family's `attributed` is **1**, not 3 | `test:` |
| 59 | the **digest is read from the same entry record the join fixed** — never borrowed from an `accept` record with the same `trade_id` | `test:` |
| 60 | **negative space**: no include/exclude toggle, override, filter, or drill-through to an excluded record exists — in the data, the type, or the surface (§8 non-goal 15) | `test:` |
| 61 | capture **never blocks or alters** the trade/position/order write; an absent source ⇒ `null`, never a throw | `test:` |
| 62 | `[theme-token-discipline]` — zero hardcoded hex; `extrasFor(theme)` inside sx callbacks; **dark/light parity** | `review:` + lint |
| 63 | `apps/api` diff is **empty** (`NO_BACKEND_CHANGE`) | `review:` at GATE Q |

---

## 8. Done means

- `nx test @org/dashboard` green; `nx lint` clean (**including `@nx/enforce-module-boundaries`** — §2's
  fences are enforced there).
- Every case in §7 implemented at its stated kind; **no listed case dropped**.
- **`apps/api` diff empty.**
- `opportunity_score` / `opportunity_tier` / `state_fingerprint` **byte-identical**.
- **Dark/light parity**, zero hardcoded hex.
- Every string sourced from `outcomes/copy.ts`, matching `UX_BLUEPRINT` §5 verbatim.
