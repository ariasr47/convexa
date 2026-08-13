# tradeable-rec-inputs — interface contract

**Spec:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio) over `libs/quant-engine`
**Status:** draft — S2 skeptic pass 1 folded (R4 pass 2)

This feature **adds and extends backend surface**. It is not `NO_BACKEND_CHANGE`.

---

## Standing rules for every field below

1. **Closed vocabularies are authoritative on the wire.** The frontend renders every state, reason,
   basis, presence, verdict and drop-reason by **closed lookup on the token**; it never re-derives a
   label from an underlying scalar and never picks a literal by inspecting a `null`
   (`[digested-labels-not-raw-dump]`, `[absent-is-not-none]`).
2. **Presence, not age, per contract.** `Contract` (`libs/quant-engine/src/types.rs`) carries only
   `bid`/`ask`, and the vendor mapper's `RawLastQuote`
   (`apps/api/src/infrastructure/massive/rest.rs:737-747`) deserializes only bid/ask/p/P and reads
   **no timestamp**. Therefore: one `as_of` + one `session_basis` **per set**, `quote_age: "unknown"`
   once at set level, and **presence only** per contract. A per-quote session or freshness label
   derived from the snapshot's `as_of` is forbidden on this wire.
3. **Zero-bid trap.** `normalize_contract` filters `bid`/`ask` with `> 0.0` (`rest.rs:823-824`), so a
   legitimate zero bid is indistinguishable from vendor-absent. The presence token is therefore
   `no_two_sided_quote` — **never** a claim that no quote existed.
4. **Unpriced-IV trap.** IV is coerced to `0.0` when greeks are absent (`rest.rs:813-817`), so
   `implied_volatility == 0.0` is an **unpriced sentinel**. A candidate carries
   `iv_state: "unpriced"` with `iv: null`; **`0.0` never ships as an IV or a greek.**
5. **Session token** is `MarketPhase::classify` (`apps/api/src/domain/market.rs:20-47`) applied to
   the snapshot's `as_of`, **not** to `now`: `rth` | `after_close` | `closed_pre`. The
   differently-membered `market_session()` in `routes/stream.rs:61-80` is live-lane SSE metadata and
   must not be conflated with it.
6. **Vendor cost.** Candidate assembly **never issues a vendor request on any path**: the selector
   takes a `&[Contract]` and has no access to the provider port, and the candidates route never
   forces a snapshot refresh. Obtaining the snapshot is the pre-existing warm-cache / singleflight
   read that anonymous `GET /api/ticker/{ticker}` and `GET /api/contract/{ticker}` already perform
   today. **An anonymous candidate pull therefore adds zero vendor requests over the snapshot read
   the caller already pays for, and opens no anonymous spend surface that does not already ship.**
   This is the fact the anonymous hand-off export (SPEC AC-97) stands on.
7. **Nothing here is live.** No field below appears on the SSE payload. Every datum is STATIC
   (chain-snapshot derived).
8. **Nothing here is a scoring input.** `signals.*`, `ai_eval.state_fingerprint` and
   `signals.opportunity_tier` are byte-identical with and without every field added by this feature,
   on both bundle branches (`dark_pool=true` and `dark_pool=false`).

---

## Endpoints

### 1. `GET /api/candidates/{ticker}` — NEW · anonymous-ok · STATIC

The dedicated deliberate pull. Re-serializes the warm chain snapshot into a bounded, ranked,
hard-capped candidate set. Never on the bundle, never on SSE, never on a passive page load.

**Query:** `min_dte` (number, optional) · `max_dte` (number, optional) · `budget`
(`handoff` default | `prompt`, optional).
The ±15% band is a **payload-stated constant, not a query knob** — deliberately, so it cannot erode.

**Auth:** none. **Errors:** `404` only when the ticker has no chain at all (the shipped
`/api/contract/{ticker}` carve-out). **Everything else is `200` with a stated `state`** — empty
band, all candidates dropped, assembly failed.

**Response**

| Path | Type | Notes |
|---|---|---|
| `ticker` | string | normalized upper-case |
| `state` | enum | `ok` · `none_in_band` (checked, empty) · `unavailable` (assembly failed this cycle) |
| `as_of` | string \| null | snapshot ISO timestamp |
| `snapshot_age_seconds` | number \| null | |
| `session_basis` | enum \| null | `rth` · `after_close` · `closed_pre` (rule 5) |
| `quote_age` | enum | `unknown` — set-level, one member in v1 (rule 2) |
| `anchor_spot` | number \| null | the `gex_spot` levels anchor |
| `anchor_basis` | enum | `gex_spot` — one inhabitant |
| `band_pct` | number | `15.0` |
| `budget` | enum | `handoff` (≤4 tenors × 2 rights × 8 strikes, ≤64 records) · `prompt` (≤2 × 2 × 5, ≤20 records) |
| `sent_to_model` | boolean | `false` on this endpoint — computed for display/hand-off, not sent |
| `caps.tenors` / `caps.rights` / `caps.strikes_per_tenor_right` / `caps.max_records` / `caps.max_bytes` | number | the ceilings actually applied; whichever binds first wins |
| `included.contracts` | number | |
| `included.expirations` | array of string | the expirations actually included |
| `included.expiration_count` | number | |
| `omitted.total` | number | |
| `omitted.expirations_omitted_by_cap` | number | |
| `omitted.by_reason.outside_window` / `.outside_band` / `.no_interest` / `.expiration_cap` / `.strike_cap` | number | five closed reasons, fixed evaluation order, each contract counted **exactly once**. Invariant: `included.contracts + omitted.total = rows scanned` |
| `liquidity.quoted` / `liquidity.no_two_sided_quote` | number | the digested set-level liquidity read |
| `liquidity.atm_relative_spread_band` | enum | `tight` · `moderate` · `wide` · `unknown` |
| `liquidity.wide_quotes` | boolean | |
| `liquidity.wide_quote_threshold_pct` | number | the threshold actually applied |
| `contracts[].expiration` | string | |
| `contracts[].dte` | number | |
| `contracts[].strike` | number | |
| `contracts[].right` | enum | `call` · `put` |
| `contracts[].distance_pct` | number | signed distance from `anchor_spot` |
| `contracts[].quote_presence` | enum | `quoted` · `no_two_sided_quote` (rule 3). A no-quote contract is **included**, never dropped |
| `contracts[].bid` / `.ask` / `.mid` | number \| null | null iff `quote_presence = no_two_sided_quote` |
| `contracts[].spread_abs` / `.spread_pct_of_mid` | number \| null | |
| `contracts[].open_interest` / `.volume` | number | zero-OI **and** zero-volume contracts are excluded from candidacy and counted under `no_interest` |
| `contracts[].iv_state` | enum | `priced` · `unpriced` (rule 4) |
| `contracts[].iv` | number \| null | null iff `unpriced`; never `0.0` |
| `contracts[].greeks.delta` / `.gamma` / `.theta` / `.vega` | number \| null | never `0.0` as a sentinel |

`liquidity.*` + `included.*` + `omitted.*` are the **exact** content of the digested
`What the numbers said` line and of the export drawer's `Candidate contracts` section: one
computation, two renderings. The browser never subtracts two counts to obtain an omitted figure.

### 2. `GET /api/ticker/{ticker}` — EXISTING, extended additively · anonymous-ok · STATIC

Gains **one** member on `market_state`, attached after `generate_signals`, alongside the shipped
additive packs (`market_context`, `iv_rank`, `vol_normalized_gex`).

`market_state.straddle_move` is **always an object, never a bare null** — a null cannot carry a
reason and the frontend is forbidden from inferring one from a null. `[best-effort-isolated-or-null]`
is honored by the closed `state` member plus an empty `tenors` list, with the bundle still `200` and
`market_state` / `strike_profile` / SSE untouched.

| Path | Type | Notes |
|---|---|---|
| `market_state.straddle_move.state` | enum | `ok` · `no_quote` · `not_computed` · `no_expiration_in_window` |
| `market_state.straddle_move.as_of` | string \| null | |
| `market_state.straddle_move.session_basis` | enum \| null | rule 5 |
| `market_state.straddle_move.anchor_spot` | number \| null | `gex_spot`, **not** the live display price |
| `market_state.straddle_move.anchor_basis` | enum | `gex_spot` |
| `market_state.straddle_move.anchor_label` | string | the words the basis line renders for the anchor |
| `market_state.straddle_move.primary_expiration` | string \| null | the tenor the UI renders; the client never picks by array order or by comparing DTEs |
| `market_state.straddle_move.wide_quote_threshold_pct` | number | |
| `market_state.straddle_move.tenors[]` | array | ≤3, ascending by DTE. **Sparse tenors are omitted, never emitted null** |
| `market_state.straddle_move.tenors[].expiration` | string | |
| `market_state.straddle_move.tenors[].dte` | number | |
| `market_state.straddle_move.tenors[].strike_used` | number | |
| `market_state.straddle_move.tenors[].strike_distance_pct` | number | |
| `market_state.straddle_move.tenors[].straddle_price` | number | |
| `market_state.straddle_move.tenors[].move_dollars` | number | |
| `market_state.straddle_move.tenors[].move_pct` | number | percent **of `anchor_spot`** |
| `market_state.straddle_move.tenors[].basis` | enum | `atm_straddle_mid` · `iv_derived_estimate` — a missing NBBO leg changes the **basis value**, never silently substitutes |
| `market_state.straddle_move.tenors[].quote_spread_pct_of_mid` | number \| null | |
| `market_state.straddle_move.tenors[].wide_quotes` | boolean | |

No other bundle field changes. `signals.opportunity_score`, `signals.opportunity_tier` and
`ai_eval.state_fingerprint` are byte-identical with and without this member.

### 3. `GET /api/recommendation/export/{ticker}` — EXISTING, extended additively · anonymous-ok · no LLM

The manual hand-off export. Resolves a session **optionally** (the mechanism already used by
`GET /api/recommendation/status/{ticker}`, `apps/api/src/routes/recommendation.rs:84-88`) so a
signed-in owner's drawer has one source of truth; anonymous callers keep working unchanged.

Gains, inside the existing `context` object plus two top-level fields:

| Path | Type | Notes |
|---|---|---|
| `context.candidates` | object | the §1 envelope, `budget: "handoff"`, `sent_to_model: false` |
| `context.risk_inputs.state` | enum | `set` · `not_set`. **Anonymous always `not_set`** — present, never omitted |
| `context.risk_inputs.account_size` | number \| null | present only when `state = set` and a session resolved |
| `context.risk_inputs.per_trade_cap` | object \| null | `{ value: number, unit: "usd" \| "percent" }` |
| `context.risk_inputs.effective_dollar_cap` | object | always an object — see §4 |
| `context.open_positions.source` | enum | `simulated` — one inhabitant |
| `context.open_positions.state` | enum | `none_open` · `not_sent` · `unavailable`. A GET export carries no client digest, so this path emits `not_sent` |
| `egress_note` | string | **amended.** Composed server-side from `egress_categories`; enumerates only what this artifact actually carries. The shipped claim "no account or identity" is removed |
| `egress_categories[].key` | enum | `context` · `candidates` · `risk_inputs` · `open_positions` · `persona_prompt` · `glossary` |
| `egress_categories[].sent` | boolean | a category with `sent: false` renders an explicit `Not sent` line, never an omitted section |

`context.market_state.straddle_move` rides through unchanged from §2.

### 4. `GET /api/auth/settings` · `PUT /api/auth/settings` — EXISTING, extended additively · **session required**

The risk block is per-user server-side state on the existing `SettingsRecord` / `SettingsPatch`
(`apps/api/src/services/auth/store.rs`), on **both** adapters (disk-JSON and Postgres). The write
resolves the session **before** applying the patch, by the shipped
`routes/auth.rs::put_settings` mechanism — `[server-side-gate-enforcement]`: a bypassed or absent
client check is still refused at the server. Anonymous ⇒ the shipped auth status; no new gate.

| Path | Type | Notes |
|---|---|---|
| `risk_inputs` | object | always present for a resolved session |
| `risk_inputs.state` | enum | `set` · `not_set` |
| `risk_inputs.account_size` | number \| null | `null` = not set. **`0` is a legal entry, never an encoding of unset** |
| `risk_inputs.per_trade_cap` | object \| null | `{ value: number, unit: "usd" \| "percent" }` — **one** cap, stored with its unit |
| `risk_inputs.effective_dollar_cap` | object | **always an object**, never null |
| `risk_inputs.effective_dollar_cap.state` | enum | `derived` · `not_derivable` · `not_set` |
| `risk_inputs.effective_dollar_cap.value` | number \| null | derived **exactly once, server-side**; the client performs no arithmetic on the owner's entered values |
| `risk_inputs.effective_dollar_cap.not_derivable_reason` | enum \| null | `percent_without_account_size` |
| `risk_inputs.effective_dollar_cap.derived_from` | object | `{ account_size, cap_value, cap_unit }` — what the figure was derived from, so the UI can label it *derived from your inputs* and never *validated* / *checked* / *enforced* |
| `risk_inputs.storage_available` | boolean | drives the storage-unavailable copy |
| `risk_inputs.updated_at` | number \| null | |

**`PUT` body** carries the same two owner-entered facts (`account_size`, `per_trade_cap`), each
independently clearable. Server-side refusals mirror the local ones and are authoritative: a dollar
cap exceeding an entered account size, a percent cap outside `(0, 100]`, and any non-positive or
non-numeric value are refused and **nothing is stored**. Existing settings fields
(`active_persona_id`, `default_ticker`, `theme`, `scan_view`) are untouched; a record written before
this feature reads forward, and a record that fails to parse degrades to defaults **without
overwriting the stored original**.

### 5. `POST /api/recommendation/{ticker}` — EXISTING, extended additively · **session required** (auth outermost)

The in-app rec. The request body additionally carries the client-supplied **open-positions digest**;
the response envelope gains the as-sent echo, the cap verdict, per-field reasons and the cited
contract, pinned beside the shipped `as_of` and `pinned_fingerprint`
(`apps/api/src/services/recommendation.rs:436-437`).

**Request body additions**

| Path | Type | Notes |
|---|---|---|
| `open_positions.source` | enum | `simulated` — one inhabitant; an unlabelled digest is unconstructable |
| `open_positions.state` | enum | `none_open` · `not_sent` · `unavailable` |
| `open_positions.this_underlying` | object \| null | `{ direction, leg_count, nearest_expiry_dte, max_loss: { state: "known" \| "ineligible", value: number\|null, reason: string\|null } }` |
| `open_positions.portfolio` | object \| null | `{ open_count: number, capital_at_risk: number \| null }` |

The digest is **never persisted server-side** and is never echoed back as server-authoritative.

**Response additions**

| Path | Type | Notes |
|---|---|---|
| `strategy.right` | enum \| null | `call` · `put` · absent. **No default** — unlike the shipped `bias` coercion (`llm.rs:364-371`), an unrecognised or absent right stays absent |
| `sent.budget` | enum | `prompt` |
| `sent.candidates` | object | the §1 envelope as actually sent, `sent_to_model: true` |
| `sent.straddle_move_tenors[]` | array of string | the tenors actually forwarded. Invariant: **⊆ the expirations in `sent.candidates`** |
| `sent.risk_inputs` | object | the as-sent risk block (§4 shape) — the authoritative source for the drawer's *as sent with this recommendation* label |
| `sent.risk_inputs_digest` | string | change detector for the superseded-inputs strip; compared against the currently stored block |
| `sent.open_positions` | object | as sent |
| `cap_check.verdict` | enum | five members, **evaluated in one fixed order, first match wins** (below) |
| `cap_check.effective_dollar_cap` | number \| null | the figure compared against. Still carried when the verdict is `not_applicable`, so the drawer can show what would have been used |
| `cap_check.cap_not_derivable_reason` | enum \| null | `percent_without_account_size` |
| `cap_check.parsed_risk_dollars` | number \| null | the output of the **one** server-side `max_risk` parse |
| `cap_check.model_max_risk_text` | string \| null | the model's raw prose, so copy can attribute each half: Convexa performed the comparison, on a figure the AI asserted |
| `field_reasons.max_risk` / `.position_size` / `.exit_target` / `.exit_stop` | object \| null | `null` when the field has a value; else `{ reason: "not_given" \| "unavailable", missing_input: "risk_block" \| "candidate_quotes" \| "straddle_move" \| null }`. Computed **server-side** from which blocks the assembler inserted — the model is never asked why it left a field blank |
| `cited_contract.state` | enum | `cited` · `right_undetermined` · `off_set` · `none` |
| `cited_contract.contract` | object \| null | the matching §1 candidate record; present only for `cited` |
| `cited_contract.legs[]` | array | both legs for `right_undetermined`, when the pair is available; otherwise empty and the no-quote-shown literal renders |

**`cap_check.verdict` — fixed evaluation order.** The field is a single token, so the order is what
keeps two implementations from disagreeing:

| Order | Member | Trigger |
|---|---|---|
| 1 | `not_applicable` | the rec states **no entry** (`no_trade`), so it asserts no risk figure to audit. **The UI renders no cap surface at all in this state** — no comparison, no caveat, no cap readout, no `not set` cap literal. Nothing to check is not the same fact as tried-and-failed |
| 2 | `no_cap` | no effective dollar cap: nothing entered, **or** percent-with-no-account-size. Both collapse here; the reason is read off `effective_dollar_cap.state`, never off a further verdict member |
| 3 | `not_checkable` | an effective dollar cap exists but the risk figure could not be read as an unambiguous dollar amount. **Includes the null case on an entry-stating verdict.** Never a pass by default |
| 4 | `within` | read unambiguously and **≤** the effective dollar cap. **Equality is `within`** |
| 5 | `above` | read unambiguously and **strictly greater** than the effective dollar cap |

**`field_reasons.missing_input` — fixed dependency order.** Each field's dependencies are declared
in priority order and `missing_input` names the **first** absent one. `position_size` is the only
field with two (`1.` risk block, `2.` candidate quotes), so it is the only one that needs the
tie-break: **when both are absent the token is `risk_block`**, because that is the input the owner
can fix and the one the `Set your risk inputs` action clears. The wire carries one token, never two.

**Match rule (structural).** A cited contract exists only when the parsed rec yields **exactly one**
`(expiration, strike, right)` triple — `strikes` length 1 **and** expiration present **and** right
present. The match key type has no constructor from a partial input; there is no "match on strike +
expiration and pick a side". `right_undetermined` is its own state and **never** renders the
`off_set` literal — the strike and expiration *were* sent, so that literal would assert a falsehood.
`position_size` is **never parsed** by any lane on either side of the wire; `max_risk` is parsed by
exactly one server-side function with a closed output.

---

## Running this contract

```
npm run ports:free
npx nx serve api                      # :8000, needs a working DATA_PROVIDER key
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:8000 \
  --auth-cookie <session-name>=<value> \
  --report .spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt.json
```

Two operational facts, stated so a run does not fail for the wrong reason:

- **Endpoint order in the block is load-bearing.** The runner iterates sequentially, so
  `GET /api/ticker/{ticker}` runs first and warms the ticker's analytics snapshot; the candidates
  read then serves off that warm snapshot. Reordering the block does not break correctness (the
  candidates read is `200` with a stated `state` either way) but it changes what a run observes.
- **`GET /api/auth/settings` is marked `"auth": true`.** Obtain a cookie from
  `POST /api/auth/signup` and replay it with `--auth-cookie NAME=VALUE`. Running the block without a
  session is a **configuration error (exit 2, no receipt)** — never a FAIL. `--auth-signup` is not
  available until `conformance.auth` (`signup_path` + `signup_body`) exists in
  `.spire/clusters/tech/project.json`; adding it is an owner-owned change outside this contract.

Two endpoints are deliberately **outside** the machine-checkable block and covered by prose above:
`PUT /api/auth/settings` and `POST /api/recommendation/{ticker}`. Both require a request body (the
conformance block uses the flat `{method, path, path_params, query, required}` shape), and the rec
POST additionally consumes the daily cap and needs a provider key — a conformance run must not spend
either. Their shapes are asserted by the build's own tests (SPEC §7), not by this runner.

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state.ticker": "string",
        "market_state.gex_spot": "number",
        "market_state.straddle_move": "object",
        "market_state.straddle_move.state": "string",
        "market_state.straddle_move.as_of": "string|null",
        "market_state.straddle_move.session_basis": "string|null",
        "market_state.straddle_move.anchor_spot": "number|null",
        "market_state.straddle_move.anchor_basis": "string",
        "market_state.straddle_move.anchor_label": "string",
        "market_state.straddle_move.primary_expiration": "string|null",
        "market_state.straddle_move.wide_quote_threshold_pct": "number",
        "market_state.straddle_move.tenors": "array",
        "market_state.straddle_move.tenors[].expiration": "string",
        "market_state.straddle_move.tenors[].dte": "number",
        "market_state.straddle_move.tenors[].strike_used": "number",
        "market_state.straddle_move.tenors[].straddle_price": "number",
        "market_state.straddle_move.tenors[].move_dollars": "number",
        "market_state.straddle_move.tenors[].move_pct": "number",
        "market_state.straddle_move.tenors[].basis": "string",
        "market_state.straddle_move.tenors[].wide_quotes": "boolean",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "ai_eval.state_fingerprint": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/candidates/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "ticker": "string",
        "state": "string",
        "as_of": "string|null",
        "snapshot_age_seconds": "number|null",
        "session_basis": "string|null",
        "quote_age": "string",
        "anchor_spot": "number|null",
        "anchor_basis": "string",
        "band_pct": "number",
        "budget": "string",
        "sent_to_model": "boolean",
        "caps.tenors": "number",
        "caps.rights": "number",
        "caps.strikes_per_tenor_right": "number",
        "caps.max_records": "number",
        "caps.max_bytes": "number",
        "included.contracts": "number",
        "included.expirations": "array",
        "included.expiration_count": "number",
        "omitted.total": "number",
        "omitted.expirations_omitted_by_cap": "number",
        "omitted.by_reason.outside_window": "number",
        "omitted.by_reason.outside_band": "number",
        "omitted.by_reason.no_interest": "number",
        "omitted.by_reason.expiration_cap": "number",
        "omitted.by_reason.strike_cap": "number",
        "liquidity.quoted": "number",
        "liquidity.no_two_sided_quote": "number",
        "liquidity.atm_relative_spread_band": "string",
        "liquidity.wide_quotes": "boolean",
        "liquidity.wide_quote_threshold_pct": "number",
        "contracts": "array",
        "contracts[].expiration": "string",
        "contracts[].dte": "number",
        "contracts[].strike": "number",
        "contracts[].right": "string",
        "contracts[].distance_pct": "number",
        "contracts[].quote_presence": "string",
        "contracts[].bid": "number|null",
        "contracts[].ask": "number|null",
        "contracts[].mid": "number|null",
        "contracts[].spread_pct_of_mid": "number|null",
        "contracts[].open_interest": "number",
        "contracts[].volume": "number",
        "contracts[].iv_state": "string",
        "contracts[].iv": "number|null",
        "contracts[].greeks.delta": "number|null",
        "contracts[].greeks.gamma": "number|null",
        "contracts[].greeks.theta": "number|null",
        "contracts[].greeks.vega": "number|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/recommendation/export/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "ticker": "string",
        "context.market_state.straddle_move": "object",
        "context.market_state.straddle_move.state": "string",
        "context.candidates.state": "string",
        "context.candidates.budget": "string",
        "context.candidates.sent_to_model": "boolean",
        "context.candidates.included.contracts": "number",
        "context.candidates.included.expiration_count": "number",
        "context.candidates.omitted.total": "number",
        "context.candidates.liquidity.atm_relative_spread_band": "string",
        "context.risk_inputs.state": "string",
        "context.risk_inputs.account_size": "number|null",
        "context.risk_inputs.effective_dollar_cap.state": "string",
        "context.open_positions.source": "string",
        "context.open_positions.state": "string",
        "egress_note": "string",
        "egress_categories": "array",
        "egress_categories[].key": "string",
        "egress_categories[].sent": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/auth/settings",
      "auth": true,
      "path_params": {},
      "query": {},
      "required": {
        "theme": "string",
        "risk_inputs": "object",
        "risk_inputs.state": "string",
        "risk_inputs.account_size": "number|null",
        "risk_inputs.per_trade_cap": "object|null",
        "risk_inputs.effective_dollar_cap": "object",
        "risk_inputs.effective_dollar_cap.state": "string",
        "risk_inputs.effective_dollar_cap.value": "number|null",
        "risk_inputs.effective_dollar_cap.not_derivable_reason": "string|null",
        "risk_inputs.effective_dollar_cap.derived_from": "object",
        "risk_inputs.storage_available": "boolean",
        "risk_inputs.updated_at": "number|null"
      }
    }
  ]
}
```
