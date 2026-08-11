# iv-rank — INTERFACE_CONTRACT

> GATE U·X deliverable. The **FE↔BE single source of truth ONLY**: the endpoint touched, the new
> `market_state` field (name / type / presence), its nested shape, the enum vocabularies, error + SSE
> semantics, and the machine-checkable `## Conformance spec`. Both execution lanes bind here.
>
> NOT here: server-internal implementation (no store adapter, no interpolation code, no `signals.py`/
> engine/uvicorn/Pydantic detail), no UI/layout/copy, no math derivation. Those live in the execution
> contracts. Field emit/consume semantics only.
>
> Precedent this mirrors exactly (typing discipline, `object|null` always-present additive nested read
> attached after scoring): `market_state.market_context` (ai-context-pack) and
> `market_state.dealer_flow_projection` (dealer-flow-projection) in `libs/api/src/lib/convexa.ts`.

---

## 1. Endpoint touched

- **`GET /api/ticker/{ticker}`** (and its byte-identical alias `GET /{ticker}` + slice variants) — the
  cached ~60s REST bundle. This feature adds **one additive nested field** to the response's
  `market_state` object. No new endpoint, no new query param, no request-shape change.
- **SSE stream:** UNCHANGED. Nothing about iv-rank rides SSE (`live-vs-static-isolation`). The SSE
  payload gains no field. A conformance/regression note: the SSE byte-shape is unchanged.
- **AI export** (`GET /api/recommendation/export/{ticker}` and the in-band export): UNCHANGED
  serializer — it already forwards `market_state` wholesale, so the new field rides along with no
  serializer change (this is how `market_context`/`dealer_flow_projection` reach the AI).

---

## 2. The new field — name, type, presence

**Wire field: `market_state.iv_rank` — type `IvRankRead | null`.**

- **Name:** `iv_rank` (snake_case on the wire; the TS interface is `IvRankRead`).
- **Presence:** the KEY is **always present** on a post-feature backend, emitted as **`object | null`**
  — mirroring `dealer_flow_projection` (always-present) and `market_context` (best-effort null). On the
  TS `MarketState` type it is declared **OPTIONAL** (`iv_rank?: IvRankRead | null`) so pre-feature
  payloads still type-check; **consumers read `m.iv_rank ?? null`.**
- **`null` is a legitimate honest value**, never an error — the whole read is null when the store is
  unreachable, there is no usable current IV this cycle, or the read wrapper faulted
  (`best-effort-isolated-or-null`). A null `iv_rank` NEVER turns the 200 bundle into an error and never
  perturbs `market_state` core / `strike_profile` / the cache / the SSE path.
- **Not a scoring input.** The field is attached to `market_state` **after** `generate_signals`
  returns; it does not exist at score/gate/fingerprint time; `signals` reads none of it. Score / tier /
  `state_fingerprint` are byte-identical with the field present-or-null (`additive-keeps-score-byte-
  identical`, HARD).

---

## 3. The `IvRankRead` shape (nested content)

The read carries an explicit **`state` discriminant** plus nullable children. This lets the FE map to
its four body states purely from the wire (never re-deriving state, band, or a rank from a scalar).
All numbers are on the wire as declared; the FE renders its own pinned copy for every label/descriptor
(the `*_descriptor` strings below exist so the **AI export is self-describing** — the FE does not parse
or render them).

```ts
/** The three mutually-exclusive read states. An unknown value → the FE treats the read as unavailable
 *  (fail-honest). `computed` = enough history + a current IV; `building` = 1..N_min-1 samples;
 *  (whole-read unavailable is expressed by `iv_rank == null`, NOT a `state` value). */
export type IvRankState = 'computed' | 'building';

/** The digested rich/cheap band token (D2), computed backend-side from the Rank. CLOSED enum — the FE
 *  displays it via a closed lookup and NEVER re-derives it from `rank` (an unknown value renders no
 *  band). Present ONLY when `state == 'computed'` AND `rank != null`; null otherwise. */
export type IvRankBand = 'premium_rich' | 'neutral' | 'premium_cheap';

/** How the sampled IV was derived (self-describing basis, `model-read-carries-its-assumptions`). */
export type IvBasis = 'interpolated_30d' | 'nearest_tenor';

export interface IvRankRead {
  /** Which of the two non-null states this read is in. Drives the FE body-state selection. */
  state: IvRankState;

  // ---- Computed-state numbers (all null unless state == 'computed') ----
  /** IV Rank 0–100 (headline, D4). null when state != 'computed' OR the window is degenerate-flat
   *  (IV_max == IV_min) — in the flat sub-case `state` stays 'computed', `rank` is null, and
   *  `rank_unavailable_reason` explains it. NEVER a fabricated midpoint. */
  rank: number | null;
  /** Set ONLY when state == 'computed' && rank == null (degenerate-flat): a short machine reason the
   *  FE maps to its pinned flat note. Closed value: 'flat_window'. null otherwise. */
  rank_unavailable_reason: 'flat_window' | null;
  /** IV Percentile 0–100 (secondary, D4). Present whenever state == 'computed' (incl. degenerate-flat,
   *  D8b — a flat window still has a defined percentile). null when state != 'computed'. */
  percentile: number | null;
  /** The digested band token (D2). Present ONLY when state == 'computed' && rank != null; null in the
   *  flat sub-case and in building. */
  band: IvRankBand | null;

  // ---- The self-describing envelope (present in BOTH states; carries the read's assumptions) ----
  /** The IV value the read measured this cycle (percentage points, ×100 convention). null in building
   *  when no current IV was usable but samples exist below the floor. */
  current_iv: number | null;
  /** Sessions actually used in the window (== sample_count until 252, then 252). In building this is
   *  the accumulated count so far. */
  window_sessions: number;
  /** Total accumulated samples for this ticker (== window_sessions until >252). */
  sample_count: number;
  /** The rolling window cap (252). Fixed descriptor for the "N of the last {window} sessions" copy. */
  window_cap: number;
  /** The minimum-sample floor (N_min = 20, D3). The FE renders "N of {N_min} sessions" in building. */
  min_samples: number;
  /** How current_iv was derived (self-describing basis, AC-19). */
  iv_basis: IvBasis;
  /** The actual DTE the sample represents: 30 for a clean interpolation; the fallback tenor DTE
   *  otherwise. The FE renders it in the fallback basis line. */
  basis_dte: number;

  // ---- Self-describing descriptors (WIRE-ONLY — for the AI export; the FE does NOT render these) ----
  /** Plain-language window/basis/framing descriptors so the AI export is self-describing. The FE has
   *  its OWN pinned copy and MUST NOT render these strings (a sentinel-value test guards this). */
  window_descriptor: string;
  basis_descriptor: string;
  advisory_note: string;
}
```

**Presence matrix (which fields are non-null in which state):**

| Field | `computed` (rank defined) | `computed` (flat) | `building` |
|---|---|---|---|
| `state` | `'computed'` | `'computed'` | `'building'` |
| `rank` | number | **null** | null |
| `rank_unavailable_reason` | null | `'flat_window'` | null |
| `percentile` | number | number | null |
| `band` | token | null | null |
| `current_iv` | number | number | number \| null |
| `window_sessions` / `sample_count` / `window_cap` / `min_samples` | present | present | present |
| `iv_basis` / `basis_dte` | present | present | present (when a sample exists) |
| `window_descriptor` / `basis_descriptor` / `advisory_note` | present | present | present |

**No raw series field (`digested-labels-not-raw-dump`).** `IvRankRead` carries ONLY derived numbers +
descriptors + the digested band. There is NO array/list of daily IV values on the wire, ever. The
accumulated series lives only in the backend store.

**Band ↔ rank consistency (D2):** the backend sets `band` from `rank` at cut points **70 / 30**:
`rank >= 70 → premium_rich`; `30 <= rank < 70 → neutral`; `rank < 30 → premium_cheap`. The FE does not
re-derive this; it trusts the wire token.

---

## 4. Error + degraded semantics

- **Always 200.** The bundle stays a 200 in every iv-rank state. A store outage / no-current-IV / read
  fault → `iv_rank == null` (or the `building` state where partial history exists). No 4xx/5xx is ever
  introduced by this field.
- **Best-effort isolation.** A write fault (accumulation) is swallowed server-side and NEVER perturbs
  the served bundle; a read fault yields `iv_rank == null`. Neither ever touches `market_state` core,
  `strike_profile`, the cache, or SSE.
- **No new headers, no new status codes, no new query params.**

---

## 5. Conformance spec (system-1)

**Canonical spec: the standalone file `.claude/tools/conformance/iv_rank.json`** (the recent
convention — mirrors `ai_context_pack.json` / `dealer-flow-projection.json`, NOT an embedded endpoints
block, NOT folded into another feature's spec). `interface_conformance.py` runs it via
`--spec .claude/tools/conformance/iv_rank.json`.

**What it asserts:** on `GET /api/ticker/{ticker}` (ticker `SPY`), the response carries
`market_state.iv_rank` present as **`object|null`** (always-present key, best-effort-null), plus the
`[additive-keeps-score-byte-identical]` regression floor (`market_state` envelope intact;
`signals.opportunity_score` / `opportunity_tier` / `prime_prompt_eligible` present; `ai_eval.ready` /
`state_fingerprint` present).

**Why the key is `object|null` and NO child is required:** the field is best-effort and every child is
nullable by design (the store starts empty → most early reads are `building` or `null`; a fault → null).
Asserting a required child (e.g. `iv_rank.rank`) would FAIL a legitimately-null/building cycle. So the
spec asserts only the KEY's presence + object-or-null type. The state-transition matrix, band↔rank cut
points, byte-identity, and the null family are verified off-harness by the BE runtime proofs + the FE
test matrix (UX_BLUEPRINT §5).

```json
## Conformance spec
{
  "version": "1.0",
  "feature": "iv-rank",
  "endpoints": [
    {
      "id": "bundle_score_floor_and_iv_rank_key",
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": {"ticker": "SPY"},
      "query": {"min_dte": "7", "max_dte": "45", "dark_pool": "true"},
      "required": {
        "market_state": "object",
        "market_state.iv_rank": "object|null",
        "signals": "object",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "signals.prime_prompt_eligible": "boolean",
        "ai_eval": "object",
        "ai_eval.ready": "boolean",
        "ai_eval.state_fingerprint": "string"
      }
    }
  ]
}
```

**Operator note (RESUME gotcha, carry into QA at GATE Q):** conformance on the `/api/ticker`
`dark_pool=true` **cold** path can exceed the tool's 30s timeout. **Warm the URL first** within the 60s
cache TTL (e.g. `curl http://127.0.0.1:8000/api/ticker/SPY?min_dte=7&max_dte=45&dark_pool=true`) then
run the spec; OR validate offline with
`--spec .claude/tools/conformance/iv_rank.json --sample <bundle.json> --endpoint "/api/ticker/{ticker}"`.

---

## 6. Binding for the execution lanes

- **BACKEND_EXECUTION_CONTRACT** binds here: it must EMIT `market_state.iv_rank` exactly as §2–§3
  specify — always-present key, `object|null`, the `state` discriminant, the enum vocabularies, the
  70/30 band cut, the self-describing envelope + descriptors, attached after scoring, best-effort.
- **FRONTEND_EXECUTION_CONTRACT** binds here: it CONSUMES `m.iv_rank ?? null`, maps the `state`
  discriminant + nullable `rank` to its four body states, displays `band`/`iv_basis` via closed
  lookups (never re-derived), and never renders the wire `*_descriptor` strings.
