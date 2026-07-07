# iv-rank — BACKEND_EXECUTION_CONTRACT

> GATE U·X deliverable. **Server work ONLY** (targets `apps/api`). References the
> **INTERFACE_CONTRACT** (`.claude/contracts/iv-rank/INTERFACE_CONTRACT.md`) for what it EMITS. NO UI
> detail. Independently buildable by a fresh executioner reading ONLY this file + the
> INTERFACE_CONTRACT + PROJECT_CONTEXT.
>
> Bound interface: **`.claude/contracts/iv-rank/INTERFACE_CONTRACT.md`** — this lane EMITS
> `market_state.iv_rank` exactly as that contract's §2–§3 specify.
>
> Locked technical shape you implement (do NOT re-decide): `.claude/contracts/iv-rank/
> ARCHITECTURE_CONTRACT.md` — CM30 basis, write-through accumulation, the new persistent market-data
> store/port, the 252-window, the after-scoring attach, the §3.1 sample record, the §3.2 read shape.
> Product decisions D1–D8 are locked (`.claude/contracts/iv-rank/PRODUCT_CONTRACT.md`).

---

## 1. What to build (scope)

1. A **new, self-contained market-data time-series subpackage** — a *sibling* of `src/auth/`, NOT an
   extension of the auth leaf, NOT a new auth port (ARCHITECTURE §Q3/§4). It contains:
   - **One abstract port** (an ABC) — an "IV time-series store" whose **record dataclass IS the
     contract** (the ARCHITECTURE §3.1 sample: ticker, session_date, iv_value, iv_basis, basis_dte,
     captured_at). Operations: an **idempotent upsert-if-absent** of one `(ticker, session_date)`
     sample, and a **bounded read** of a ticker's most-recent-N samples ordered by session date.
     Nothing else. Mirrors the `src/auth/ports.py` / `src/providers/base.py` port+record discipline.
   - **A default adapter requiring NO external service** — the buildable/verifiable-here backend.
     **Recommended: file/SQLite-on-disk under `DATA_DIR`** (survives restart, so the store actually
     accumulates to the floor in dev — the architect's recommendation, and product's D7 preference,
     so a *real* Computed rank can be demonstrated). A process-local in-memory adapter is a valid
     fallback that still satisfies the no-Postgres constraint but loses accumulation on restart — if
     you choose it, the honesty requirement (§4 D7) still binds.
   - **A Postgres adapter behind the SAME port** — the prod persistence, a drop-in registered in an
     env-selected factory (mirroring `ACCOUNT_STORE` / `DATA_PROVIDER`; a new env var of the same
     shape, default = the non-Postgres adapter). Connection string from **runtime env only**
     (`no-secrets-in-image`, never baked). An unreachable DB **defers the fault to first use**, never
     crashes boot (mirror `auth/__init__.py::_make_postgres_stores`). **Postgres is NOT runtime-
     verified this gate** — it is a parity-reviewed prod adapter behind the port.
   - **A thin compute helper** (in the leaf) that: derives the current-cycle **CM30 sample** from the
     already-computed term-structure curve, reads the ticker's most-recent-N samples, and computes the
     `IvRankRead` (or the building/null state). Imports **stdlib + math + its own port/adapters (+ the
     DB driver lazily in the Postgres adapter only)**. It **NEVER** imports the scoring path.

2. **Wire the write + read at the `main.py` orchestration boundary** — the write-through accumulation
   and the read attach, both **after** `generate_signals` returns (the same attach point where
   `market_context` / `dealer_flow_projection` are set on `market_state`).

3. **Emit `market_state.iv_rank`** exactly per the INTERFACE_CONTRACT §2–§3.

4. **The env-selected factory** for the store adapter (default = non-Postgres).

---

## 2. The write path (accumulation) — after scoring, best-effort

- WHO: the bundle serve path in `main.py`, at the attach-after-scoring boundary.
- WHEN: a **write-through** on each served bundle, guarded by a **once-per-`(ticker, session_date)`
  idempotent upsert-if-absent**. The first served bundle for a ticker on a given UTC calendar day
  writes that day's sample; subsequent serves that same UTC day are no-ops (the store, not app-local
  state, is the source of truth).
- **session_date** = the UTC calendar date derived from the bundle snapshot timestamp
  (`market_state.timestamp`, already present).
- **Which IV goes in:** only a **valid** CM30 sample (or its defined fallback) with a positive IV and a
  real spot is written; a degenerate/null IV is **skipped** (no row — an honest gap, never faked),
  mirroring `chain_store.put`'s "only store a usable chain" guard.
- **CM30 derivation** (ARCHITECTURE §Q1 — implement, don't re-decide): linear-interpolate ATM IV in
  DTE space at DTE=30 from `compute_term_structure`'s ascending `{dte, atm_iv}` points, bracketing 30.
  If all tenors > 30 or all < 30 → do **not** extrapolate; fall back to the single nearest-tenor
  `atm_iv`, recording `iv_basis='nearest_tenor'` + the actual `basis_dte`. If the curve is unavailable
  → fall back to the raw nearest-≥7-DTE `atm_iv` scalar on `market_state`, again recording the basis.
  Every sample is self-describing about its basis (`interpolated_30d` | `nearest_tenor` + `basis_dte`).
  IV stays in **percentage points** (×100 convention), comparable to `atm_iv` / `term_structure`.
- **NO new vendor call, no new greeks math** — CM30 is a pure read-and-interpolate over the
  already-computed term-structure curve.
- **NOT a scheduled job** — write-through piggybacks organic traffic (the app has no scheduler).
- **NO backfill / seeding** — the store starts empty and grows one row per ticker per active UTC day.
- **Best-effort + must never perturb the bundle:** wrap the write so ANY store fault (unreachable DB,
  lock contention, serialization error) is swallowed and logged at debug/warn — it NEVER raises into
  the bundle, never changes the served payload, never touches `market_state` core / `strike_profile` /
  the cache / the SSE path. If the write fails, the read that cycle computes over whatever history
  already exists (or emits building/null).

---

## 3. The read path (rank/percentile) — after scoring, attaches the field

- Also **after `generate_signals` returns**, `main.py` calls the leaf's compute helper: it reads the
  ticker's most-recent-N samples, derives the current-IV basis, and computes the `IvRankRead`.
- **Window** (ARCHITECTURE §Q4): rolling trailing **up to 252 sessions**; until 252 exist, the window
  is ALL accumulated samples; once ≥252, the trailing 252. Carry `window_sessions` + `sample_count` +
  `window_cap` (252) in the read.
- **IV Rank** (0–100): `100 × (IV_current − IV_min) / (IV_max − IV_min)` over the window. When
  `IV_max == IV_min` (degenerate-flat) → `rank = null`, `state = 'computed'`,
  `rank_unavailable_reason = 'flat_window'`. **Never a fabricated midpoint (never 50).**
- **IV Percentile** (0–100): `100 × (count of window samples with IV < IV_current) / window_count`.
  Present whenever `state == 'computed'` (incl. degenerate-flat — a flat window still has a defined
  percentile, D8b).
- **Minimum-sample floor** `N_min = 20` (D3, LOCKED): below 20 accumulated samples →
  `state = 'building'`, NO rank, NO percentile, NO band; carry `sample_count` + `min_samples` (20).
  **Rank and Percentile gate at the SAME floor** (D3 — do NOT split).
- **Band** (D2, LOCKED cut points **70 / 30** on Rank): `rank >= 70 → 'premium_rich'`;
  `30 <= rank < 70 → 'neutral'`; `rank < 30 → 'premium_cheap'`. Set `band` ONLY when
  `state == 'computed'` AND `rank != null`; else `band = null` (never a band off a missing rank).
- **Self-describing descriptors** (wire-only, for the AI export — the FE does NOT render them): set
  `window_descriptor`, `basis_descriptor`, `advisory_note` to plain-language strings carrying the
  window / basis / "advisory context — not a forecast, not a scored signal, not a guarantee" framing.
  (These do not need to match the FE's pinned copy; they exist so the AI's state export is
  self-describing. `model-read-carries-its-assumptions`.)
- **Attach:** `main.py` sets `state["iv_rank"] = iv_rank_read` (as `market_context` is attached), under
  ONE outer guard → the whole read becomes `null` on any wrapper fault. The KEY is ALWAYS emitted
  (`object|null`).
- **Ordering** (write-then-read within one serve): a build detail — a same-cycle read may or may not
  include today's just-written sample; either is honest **as long as the reported `sample_count`
  matches what the read actually used**. Pin your choice and keep it consistent.
- **No raw series on the wire** (`digested-labels-not-raw-dump`): the read carries derived numbers +
  descriptors + the digested band only — NEVER the accumulated IV array.

---

## 4. Binding invariants — verification obligations

- **`additive-keeps-score-byte-identical` (HARD).** The field is attached to `market_state` AFTER
  `generate_signals` returns, so it does not exist at score/gate/fingerprint time (belt); `signals.py`
  imports none of the new leaf and has **0 diff** (suspenders); the new store is a **one-way leaf** the
  scoring modules (`signals.py` / `engine.py` / `live.py` / `darkpool.py` / `chain_store.py`) never
  import. **Verification obligation:** prove `opportunity_score` / `opportunity_tier` /
  `state_fingerprint` are **byte-identical** with the field present vs absent vs forced-fault (e.g.
  SPY: capture score/tier/fp before and after the change; they must not move). This is the primary
  gate. (AC-16.)
- **`best-effort-isolated-or-null`.** The key is always `object|null`; every child nullable; a
  store/read/write fault → `iv_rank = null` (or `building`), never a 5xx; a write fault never perturbs
  the bundle / cache / SSE. **Obligation:** a forced store outage yields a 200 with `iv_rank = null`
  and the rest of `market_state`/`strike_profile` intact. (AC-14, AC-15.)
- **`live-vs-static-isolation`.** STATIC — the read is computed with the cached 60s bundle, never on
  the SSE path; the SSE payload gains NO field. (AC-17 is the FE face.)
- **`model-read-carries-its-assumptions`.** The read carries window + sample-count + IV-basis +
  advisory framing in-payload (the descriptors + envelope fields). (AC-7, AC-8, AC-18, AC-19.)
- **`digested-labels-not-raw-dump`.** The band is one small token; NO raw IV series on the wire.
- **`no-secrets-in-image`.** The Postgres connection string is read from runtime env only, never baked.
- **`secret-encrypted-at-rest` NOT engaged.** IV samples are non-secret market data — NO encryption,
  NO masked hint, NO crypto boundary (ARCHITECTURE §8 explicit non-goal).
- **D7 honesty (independent of the adapter choice).** The `building` vs `computed` distinction must
  ALWAYS reflect the actual accumulated sample count at read time — the read must never claim more
  history than the store currently holds. After a memory-adapter reset, the read truthfully shows
  `building` with the reduced count, never a stale/fabricated rank.

---

## 5. Isolation from the AI export

The read rides `market_state`, and the AI state exporter forwards `market_state` **wholesale** — NO
serializer change (as with `dealer_flow_projection` / `market_context`). The AI gets the rank as
context automatically (AC-2). Do NOT modify `serialize_context`.

---

## 6. Files (grounding — by path, not pasted)

- **New:** `apps/api/src/marketdata/` (or equivalent sibling-of-`auth` package name) — the port ABC +
  sample record, the default no-external-service adapter, the Postgres adapter, the env-selected
  factory, the CM30 + rank/percentile compute helper. (Choose the package name; keep it a one-way
  leaf.)
- **`apps/api/main.py`** — `_build_market_state` (where `atm_iv`/`term_structure` are set) and the
  attach-after-`generate_signals` boundary (where `market_context`/`dealer_flow_projection` are set —
  the write hook + read attach mirror this exactly; see the existing `state["market_context"] = …`
  block for the wrap-and-swallow pattern).
- Mirror (shape precedents, NOT leaves to extend): `apps/api/src/auth/__init__.py` + `ports.py` (the
  env-selected store-factory + port/record pattern + defer-fault-to-first-use);
  `apps/api/src/core/chain_store.py` (best-effort side-store around the stateless compute);
  `apps/api/src/core/context_pack.py` (one-way-leaf, attach-after-scoring, self-describing additive
  read); `apps/api/src/core/engine.py` (`compute_term_structure`, `atm_iv`, the ×100 unit).
- **The response model** `apps/api/src/models/market_data.py` (`MarketState`) — add the `iv_rank`
  optional nested field so the serialized bundle carries it (mirror how `market_context` /
  `dealer_flow_projection` are declared there).

---

## 7. Build & verification notes (so the executioner doesn't rediscover them)

- **Backend boot / verify:** `nx serve api` → uvicorn :8000. No pytest suite — verified by app-run +
  `.claude/tools/interface_conformance.py`. `py` (not `python`); the app boots on a dummy key.
- **Conformance:** run the standalone spec `.claude/tools/conformance/iv_rank.json` via
  `interface_conformance.py --spec .claude/tools/conformance/iv_rank.json`. **RESUME gotcha:** the
  `/api/ticker` `dark_pool=true` COLD path can exceed the tool's 30s timeout — **warm the URL first**
  within the 60s cache TTL (`curl http://127.0.0.1:8000/api/ticker/SPY?min_dte=7&max_dte=45&dark_pool=true`)
  then run the spec; OR validate offline with `--sample <bundle.json> --endpoint "/api/ticker/{ticker}"`.
- **Byte-identity proof:** capture `signals.opportunity_score` / `opportunity_tier` /
  `ai_eval.state_fingerprint` for a fixed ticker+filter before and after your change; they MUST be
  identical (the HARD gate). Prove it also holds under a forced iv-rank read fault (field null).
- **Demoing a real Computed rank in dev:** with the on-disk default adapter, view the same ticker on
  ≥20 distinct UTC days (or seed the store's accumulation by advancing the session_date in a dev
  harness — do NOT fabricate IV values). A memory adapter will sit in `building` across restarts —
  acceptable per D7 only if the count stays honest.
