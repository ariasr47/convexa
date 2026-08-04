# broker-connect — RECONCILIATION plan (R0–R8)

> Written 2026-08-03, post-capture. The council's `PLAN.md` (B1-B6/F1-F8/V1-V6) shipped both lanes
> against **PROVISIONAL fixtures**; the owner's real Webull capture then surfaced facts bigger than
> the council anticipated. This is the reconciliation: it does not replace `PLAN.md`, it extends it.
> Produced by an Opus Plan agent, spot-verified by the conductor (two highest-stakes claims — the
> interface gap and the multiplier math — independently confirmed by hand against the raw fixture,
> not just trusted). **Two items (R2b, R8) are flagged and NOT yet owner-ruled** — see §4 and §10.

---

## 0. New facts the plan agent found (verify-worthy; §2 below re-derives the two load-bearing ones)

- Real book: **14 positions — 5 STOCK + 9 OPTION** (not the smaller PROVISIONAL-fixture count).
- `apps/api/tests/fixtures/broker/_raw_scratch/capture_raw.json` still exists on disk (correctly
  gitignored, never tracked) — the original B1 done-condition said "scratch dir empty"; it isn't.
  **The owner deletes this themselves, in their own shell — never an agent** (it holds unsanitized
  account identifiers).

## 1. THE BIG NEW FACT — Webull's real payload carries zero contract-identifying detail for options

`/account/positions` returns 13 generic keys shared by stock AND option rows — no `option_type`,
`strike_price`, `expire_date`, `contract_multiplier`, or `underlying_symbol` anywhere:
`instrument_id, instrument_type ("STOCK"|"OPTION"), symbol (bare underlying ticker — NOT an OCC
code), qty, unit_cost, last_price, total_cost, market_value, unrealized_profit_loss,
unrealized_profit_loss_rate, holding_proportion, currency, short_name`. There is no `id` key, only
`instrument_id`. This is bigger than the council's "flat payload → honest per-contract rows"
fallback anticipated — it assumed rows would at least be individually *identifiable*. They are not:
two option positions on the same underlying render identically except for dollar figures.

**Conductor-verified by hand against the committed `positions_raw.json`** (not just trusting an
agent — recomputed on NVDA, PLTR, and a short AAPL position):
- `total_cost = unit_cost × qty × 100` for every option row (the contract multiplier, applied
  consistently).
- `market_value = last_price × qty` — **no ×100** — for every option row.
- `unrealized_profit_loss = market_value − total_cost` **exactly**, on every row — meaning
  **Webull's own P/L figure for options is arithmetically wrong by ~100×** (it subtracts a ×100'd
  cost from a non-×100'd market value). NVDA: Webull says `-7840.50`; the true economic figure is
  `(4.85−7.89)×10×100 = -3040`. This independently validates the owner's Q2 ruling (§3).
- `holding_proportion` is computed *with* the ×100 applied — a second independent witness for the
  multiplier, consistent across all 14 rows against what looks like a total-account-value
  denominator (not fully identified, not load-bearing for anything below).

**Also conductor-verified:** the LOCKED `INTERFACE_CONTRACT.md`'s `BrokerLeg` table states
`expiry`/`strike`/`right` presence as `iff kind: option` (no "absent when unsupplied" allowance) and
`multiplier` as `always` — read directly, confirmed the locked contract genuinely does not cover
this case. A real GATE Z amendment is needed (§2).

## 2. GATE Z ruling — YES, a narrow `INTERFACE_CONTRACT.md` amendment is needed

**Proposed amendment text** (drafted by the plan agent; not yet owner-reviewed — route through the
normal GATE Z process before merging any code that depends on it):

> **AMENDMENT 1 (post-capture) — `BrokerLeg` presence rules under a feed with no contract detail.**
> `expiry`, `strike`, `right`: presence changes from *"iff `kind: option`"* to **"iff `kind: option`
> AND the broker's payload carries the fact; omitted otherwise (absent, never null-padded). A
> position with any omitted option fact is `fidelity: partial` and each omission is named in
> `fidelity_notes`."**
> `multiplier`: presence changes from *"always"* to **"always when known — supplied by the broker,
> or reproduced exactly from broker-supplied aggregates. Omitted when neither holds; every
> multiplier-dependent output is then withheld (`not provided`), never defaulted to 1 or 100."**

The rejected alternative — map every option to `fidelity: unrecognized, legs: []` — is contract-legal
today with **no** amendment, but throws away quantity/cost/mark Webull *did* supply on 9 of 14 real
positions. The plan agent rejected it on merit; the conductor agrees with the reasoning, but this is
a real design fork worth the owner's eyes, not a rubber-stamp.

## 3. Owner decisions already made (binding — do not re-ask)

- **Credential storage:** per-user via Settings (Fernet, ciphertext-only), **never** an env var or
  file — matching the byo-ai-key pattern. (Owner caught the conductor defaulting to an env-var
  shortcut early in the build; corrected and baked into the shipped design.)
- **P/L rendering (council product ruling):** dynamic, Convexa-modeled, real-time, always
  basis-labeled, never blended with any broker-supplied figure.
- **Q1 — the missing-contract-detail problem:** owner chose **"research a secondary lookup first"**
  — don't ship a permanently-generic row without first checking whether Webull exposes any way to
  resolve `instrument_id` → contract detail. → R7.
- **Q2 — Webull's own P/L figure:** owner chose **"modeled figure only, for now"** — do not render
  Webull's `unrealized_profit_loss` (independently vindicated by the ~100× arithmetic error above).
  Stays carried on the record (already required by the tri-state pattern), unrendered.
- **Social/X posting:** deferred by owner until personal testing of the app is done (roadmap N4).

## 4. R2b — ⚠️ FLAGGED, NOT YET OWNER-RULED — reproduce the ×100 multiplier from Webull's own cost data?

**Proposal:** `_derive_multiplier(entry, qty)`: `ratio = total_cost / (unit_cost * qty)`,
`mult = round(ratio)`; accept only if `mult >= 1`, `abs(ratio − mult) <= 1%`, a round-trip check
passes, **and** a precision guard rejects when `abs(unit_cost) < 0.05` (below that, 2-decimal
rounding can distort the ratio by >10% — the deep-OTM landmine). Gated behind one module constant,
flippable in a line. If declined, or a specific entry fails the guards, that entry's `multiplier`
stays `None` and `Net entry` renders `not provided` — **the withhold path is built either way**;
R2b is a pure enhancement, never a dependency for anything else in this plan.

**For:** all 14 rows agree; `holding_proportion` independently corroborates it; using it makes "Net
entry" exactly reproduce Webull's own `total_cost` (a broker-supplied fact, not a derivation); the
guards specifically target the failure class the app's own `positions-legs` history already learned
the hard way (never hardcode a multiplier).

**Against:** it's an inference about Webull's arithmetic from one account at one instant, and the
same payload proves Webull's arithmetic is *internally inconsistent* elsewhere (the P/L figure). An
untested account/contract could break the guards silently while still passing them.

**✅ OWNER RULING (2026-08-03): RECONSTRUCT IT, WITH GUARDS.** Build `_derive_multiplier` exactly as
specced above — all four guards binding (`mult >= 1`, 1% ratio tolerance, round-trip check, and the
`abs(unit_cost) < 0.05` precision floor), behind the single flippable module constant. Any entry
failing any guard keeps `multiplier = None` and renders `not provided`; the withhold path stays
live and tested. The guards are not optional decoration — they are the whole basis on which this
ruling was made.

## 5. R1 — Adapter mechanical reconciliation (high confidence, no further decisions needed)

**File:** `apps/api/src/broker/webull_adapter.py`
- Primary key: `entry.get("id") or entry.get("instrument_id")` → `entry.get("instrument_id")` only
  (no `id` key exists in real data) — three call sites: `_map_entry`, `map_positions`'s exception
  branch, `fetch_book`'s paging tail.
- Quantity: `entry.get("quantity")` → `entry.get("qty")` (real key `qty`, signed string, sign
  already correct from Webull — no sign synthesis needed).
- Type vocabulary: `("EQUITY", "OPTION")` → `("STOCK", "OPTION")`; `itype == "EQUITY"` branch →
  `itype == "STOCK"`. Add module constants `_EQUITY_TYPE`/`_OPTION_TYPE` so the two reads can't drift.
- De-provisionalize (comment-only, no logic change) on: `_GROUPING_IDENTITY_KEY` (confirmed `None`
  — flat payload; AC-6b is now a settled fact, not a fallback), `_CREDENTIAL_REJECTED_CODE_HINTS`
  (real shape: `401`/`UNAUTHORIZED`/empty `error_msg` — the existing check already covers it),
  rate-limit hints (Webull returns **no** rate-limit headers at all — the adapter's own time-based
  `BROKER_REFRESH_MIN_INTERVAL_SECONDS` throttle is the sole real mechanism), `_parse_number`'s
  docstring (confirmed all-string numerics), `_extract_account_id` (confirmed correct — flag that
  the owner's response carried 2 subscription entries and the tool took the first; unpinned choice
  on one data point, not a bug), `describe()`'s `supplies_unrealized_pl`.

**File:** `apps/api/src/broker/ports.py` — `BrokerLeg.to_wire()` currently emits explicit `null` for
unknown `expiry`/`strike`/`right`; must **omit** the key instead (never null-pad), per the module's
own stated contract and Amendment 1. Requires `multiplier: Optional[float]`.

**Done-condition:** `nx test api` exit 0; zero `PROVISIONAL(capture)` markers remain in `src/broker/`.

## 6. R2 — Honest option mapping: `partial` legs with omitted contract detail *(blocked on §2's amendment)*

Map every OPTION entry to **one** `BrokerLeg`: `kind="option"`, `symbol`/`underlying` = the bare
ticker **verbatim** (never synthesize an OCC code — delete the existing underlying-from-symbol
derivation branch; it assumed an OCC-style symbol that doesn't exist), `quantity` = signed `qty`,
`cost_basis`/`broker_mark` from `unit_cost`/`last_price`, `expiry`/`strike`/`right` = `None`
(omitted on wire). `fidelity = "partial"` with fixed-string `fidelity_notes` (no payload values leak
— an existing hygiene test enforces this):
- `"Webull's positions feed carries no strike, expiry, or call/put for a held option — Convexa will
  not guess them"`
- + iff multiplier unresolved: `"contract multiplier not supplied and not reproducible from
  Webull's own cost aggregate"`
- + iff resolved by R2b: `"contract multiplier not supplied — reproduced exactly from Webull's own
  total_cost"`

`unrecognized` becomes reserved for genuinely unmappable entries (bad type, unparseable qty) — real
data currently produces none; keep synthetic test coverage.

**Done-condition:** mapping the real fixture → 14 positions, 5 `exact` / 9 `partial` / 0
`unrecognized`; every option position has exactly 1 leg; no wire leg has a `null` for
`strike`/`expiry`/`right`.

## 7. R3 — `test_broker_adapter.py` reconciliation (10 of 22 tests currently fail; all traced, all fixable)

Named `instrument_id` constants replace magic `"1001".."1004"` strings. Replace the fixture loader's
silent captured-else-provisional fallback with a **hard failure** naming the capture tool when the
real fixture is missing — that fallback is exactly the mechanism that let 10 tests pass against
fiction and then break the instant reality arrived. The `throttle_probe` test needs a synthetic 429
(Webull never returned one during capture; this pins *our* mapping logic, not observed vendor
behavior), plus a new tripwire asserting the real `rate_limit_headers.json` has no
rate/limit/quota/retry/throttle-named key, so a future capture that *does* see headers fails loudly.
New recommended tests: verbatim-carry of Webull's (wrong) P/L figure with an explicit assertion we
do **not** "fix" it toward the true value; cost-basis-is-per-unit-never-aggregate (executes R9c);
position-ids-are-instrument-ids-no-id-key-exists (pins the exact bug class that broke 10 tests).
Full per-test breakdown is dense; re-derive from §5's key-name corrections if needed, or re-run a
Plan agent against this file with the same context.

## 8. R4 — FE: render a generic option row honestly *(ships now, independent of R7's outcome)*

The existing sim-book machinery (`structure.ts`'s `Custom`-residue pattern, `maxLossOf`'s
`unnamed_shape` withhold, the `unpriceable` flag) **already handles** "we know less than a full
spec" correctly, and the broker projection already flows through it. Four real gaps, found by
reading the actual FE files:
- **G1** — `BrokerPositionRow.tsx`/`BrokerPositionCard.tsx` currently route **any** non-`exact`
  fidelity into a bare "can't fully display" state — under real data this blanks 9 of 14 rows,
  discarding quantity/cost/legs Webull *did* supply. Fix: only `unrecognized` gets the bare
  treatment; `partial` renders the full existing row grammar plus its fidelity notes.
- **G2** — the wrong not-a-number literal leaks in: `NOT_RECORDED` ("our own saved record never
  held this") is currently emitted for a fact that's actually missing from the *feed*, which needs
  `NOT_PROVIDED` instead. One closed substitution in `buildBrokerPositionView`.
- **G3** — the modeled-P/L selector currently picks a "this cycle" not-a-number literal
  (`unavailable`) for a *permanent* condition; should use the existing `unpriceable` flag to select
  `not provided`, plus one new tooltip copy string (route as a GATE Q wordsmithing review, not an
  amendment).
- **G4** (only reachable if R2b is declined or refuses a specific entry) — when multiplier is
  unknown, `net_entry_text`/`pl_dollar`/`pl_pct` must all render withheld, and the quantity
  tooltip's "100 shares each" clause must not be silently asserted.

Explicitly **not** touched: the S1–S9 state machine, `renderState.ts`, the two-axis degradation
logic, the envelope. Small and additive on top of already-shipped, working components.

## 9. R5 — Already-decided small items (safe to just do)

- **R5a** — the standing disclaimer ("…No brokerage connection.") is now **false** the instant a
  credential is stored. Two render sites confirmed: `shell/Footer.tsx`, `SettingsPage.tsx` (the
  latter's own comment says "reuse Landing's caption verbatim"). No test pins the current wording
  (`landing.spec.tsx` explicitly excludes "disclaimer wording") — low risk. Extract to one shared
  constant so the two copies can't drift again; wording is owner-reviewable at GATE Q.
- **R5b** — Q2 (Webull's P/L stays unrendered) is *already* true in shipped FE code; just update the
  docstring from "pending owner decision" to "decided", and add a regression test asserting Webull's
  own P/L number never appears in rendered text anywhere.
- **R5c** — the FE's assumption that `cost_basis` fields are per-unit (not aggregate) is *confirmed*
  by the real fixture (`unit_cost` per-unit; `total_cost`/`market_value` are aggregates); upgrade the
  comment from "assumption" to "confirmed fact," backed by R3's new test.

## 10. R8 — ⚠️ FLAGGED, NOT YET OWNER-RULED — pre-existing cross-ticker equity mark bug (out of the original brief's scope)

Found by the plan agent while reading the code — **conductor-independently-confirmed** by directly
reading `apps/dashboard/src/app/features/trading/broker/useBrokerMarks.ts:108-127`: the equity-leg
mark handler unconditionally uses the **currently-viewed ticker's** price/mid (`m.price` /
`live?.mid`), with no check that the leg's own `symbol` matches the focused ticker. On a real
multi-underlying book (the owner's captured book spans 10 different tickers), viewing `/ticker/TSLA`
would compute wrong modeled P/L for every non-TSLA equity leg. **The same pattern exists in the
already-shipped sim book** (`usePortfolio.ts:224-232`, byte-identical branch) — it never surfaced
because sim/provisional data was effectively single-ticker. **Not yet observed in the running app**
— this is a code-reading claim.

**✅ OWNER RULING (2026-08-03): VERIFY FIRST, THEN DECIDE.** Before any fix is designed or scoped,
run the app with a genuinely multi-ticker book and **observe what actually renders** on a ticker
page for an equity position belonging to a different underlying. Turn the code-reading claim into
an observed fact (or refute it). Report findings — including whether the sim book manifests it as
well — and only then bring the scope question (broker-only / both / separate track) back to the
owner with evidence. **Do not fix anything under R8 before this verification lands.**

## 11. R6 — Housekeeping

- Commit the 4 real fixtures + `CAPTURE_FINDINGS.md` **first**, before any code change, so the
  reconciliation diff reads as "reality landed, then code moved to meet it." Byte-scan each first
  (the repo's own NUL-byte trap).
- **Delete the 4 `*.PROVISIONAL-PENDING-CAPTURE.json` fixtures** once R3's tests are reconciled —
  they encode actively-wrong field names that invite a future reader to copy them, and are fully
  preserved in git history via `git show` regardless. Pair with R3's hard-failing loader in the
  same commit.
- Delete `_raw_scratch/capture_raw.json` — **the owner does this in their own shell**, not an agent.
- Suggested sequencing: fixtures+findings → R1+R3 mechanical (green proves the mechanical half in
  isolation) → §2 amendment note → R2(+R2b?) + its new tests → R4 FE → R5 small items.

## 12. R7 — SPIKE: does Webull expose any way to resolve `instrument_id` → contract detail? (non-blocking)

Directly executes the owner's Q1 answer (§3). **Non-blocking by construction**: writes no `src/`
code, ships nothing until it resolves, and R1–R6 ship with generic option rows regardless of its
outcome or timing — it may finish after GATE Q.

**Conductor's own web research this session** (URLs in §13):
- The only installed SDK (`webull-python-sdk-core`) has no instrument/quote-lookup request classes.
- A separate PyPI package `webull-python-sdk-mdata` exists (same version/release date as `-core`)
  with documented "Option Market Data" endpoints (Tick/Snapshot/Historical-Bars) — but these take an
  **already-known option code as input** to fetch pricing; they don't resolve instrument_id → spec.
  Doesn't solve the problem.
- A promising **named** endpoint surfaced only via a search-result snippet: **"Query Trade
  Instrument"** (`developer.webull.com/api-doc/trade/order/query-trade-instrument/`), method
  signature `getTradeInstrument(instrumentId)` mentioned. **Could not confirm its exact HTTP
  method/path/request/response shape** — Webull's docs site appears to be a JS-rendered SPA that
  doesn't serve full page content to automated fetching. Needs either a human browsing the real
  site, or a live probe call.
- Options order placement (confirmed via docs) requires `strike_price`/`option_expire_date`/
  `option_type` supplied directly by the caller — proving Webull's own systems *can* resolve this
  data somewhere, just not confirmed as a documented public read.

**Proposed probe design:** `apps/api/tests/probe_webull_instrument.py` (filename does **not** start
with `test_`, so pytest never auto-collects it), reusing the capture tool's existing credential
protocol exactly (owner's shell env only, never a file, refuses to run without both vars, scrubs
everything written) and its shim/parsing helpers. Tries `GET /trade/instrument`,
`GET /instrument/query`, `GET /quote/instrument` (sane path guesses, capped at 8 total calls, 0.6s
apart, never retrying a 429) against a real OPTION `instrument_id` already sitting in the committed
`positions_raw.json`. Records every attempt's status/error-code/response-key-set (never values) into
a new `CAPTURE_FINDINGS.md §(i)`, classifying failures into three buckets that lead to different
conclusions: doesn't-exist (404) vs not-permitted-for-this-key (403) vs wrong-params (400/422, worth
one spelling retry).

- **Outcome A (resolves successfully):** write up a follow-up feature (best-effort, additive,
  independently-nullable enrichment — mirroring `dealer-flow-projection`'s null-limb-on-failure
  precedent) as explicitly **out of this build's critical path**. Write no code for it now.
- **Outcome B (404 everywhere / permission-gated / needs the excluded grpcio-locked trade
  package):** Q1 closes definitively — the generic-row treatment becomes the **permanent** v1
  answer, and `fidelity_notes` wording may strengthen from "capture showed no detail" to "Webull's
  API exposes no contract detail for a held option position."

## 13. Web research URLs consulted (for R7, if picking up research rather than running the probe)

- `developer.webull.com/apis/docs/trade-api/options/` — order-placement fields only, no lookup.
- `developer.webull.com/apis/docs/reference/option-market-data/` — Tick/Snapshot/Bars, input =
  known option code, not a resolver.
- `pypi.org/project/webull-python-sdk-mdata/` — market-data package exists, v0.1.18, deps unclear
  from the PyPI page alone (would need `pip download` or GitHub to see `setup.py`/`pyproject.toml`).
- `developer.webull.com/api-doc/trade/order/query-trade-instrument/` and
  `developer.webull.com/api-doc/quote/get/instrument/` — **both returned only generic landing-page
  shell content to WebFetch**, likely a JS-rendered SPA. A human browsing these directly, or the
  probe script (§12), are the two remaining ways to resolve this.

## 14. What the next session should do, in order

1. Verify repo state fresh (`git status`; re-run `nx test api` — expect the ~10 failures in §7 to
   still match; check whether the owner has since deleted `_raw_scratch/`).
2. **Ask the owner the two open questions** — §4 (R2b) and §10 (R8). Genuine judgment calls with
   real-money/scope implications; do not default them.
3. Get §2's interface amendment reviewed/approved (narrow, additive — but it touches a locked
   contract, so treat it with the same care as any other GATE Z amendment).
4. Decide whether to run R7's probe now or defer — it's non-blocking; the owner already has
   approved keys in hand, so running it costs little.
5. Execute R1 → R3 → (§2 amendment + R2/R2b) → R4 → R5 → R6 via the normal build-lane process
   (dispatch `delivery-backend`/`delivery-frontend` subagents per task, re-verify independently,
   then GATE Q with a fresh de-correlated QA session, then GATE S).
