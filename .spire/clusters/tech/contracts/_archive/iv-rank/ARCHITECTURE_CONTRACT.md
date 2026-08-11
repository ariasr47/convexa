# iv-rank — ARCHITECTURE_CONTRACT

> GATE A·X deliverable. Technical SHAPE only: data-structure CONTENT, data-flow, component
> boundaries, isolation/error rules, non-goals, restated binding constraints. NO UI, NO endpoint
> signatures, NO wire field NAMES, NO product acceptance criteria, NO `def`-level code. Product/UX
> choices are deferred to the PM (see §9). Grounded against the repo (paths in §10), not assumptions.

---

## 1. Restated goal

Surface **IV Rank / IV Percentile** — where a ticker's *current* implied volatility sits within its
own *recent history* — as an **AI-context input + a Ticker display read**, so the AI and the trader
can judge whether option premium is **rich or cheap** and pick strategy accordingly (sell vs buy
premium). This is the options metric the app currently lacks.

The hard constraint that dominates the whole shape: **the vendor provides no historical IV series**
(confirmed by the 2026-07-06 market-backdrop probe; VIX/index feeds are `NOT_AUTHORIZED`). So IV
Rank cannot be computed from a vendor call. The feature must **accumulate its own daily IV sample**
into a **new persistent market-data time-series store**, then compute rank/percentile over the
accumulated window — carrying an honest **"building history / insufficient history"** state until
enough days exist. The read rides `market_state` as an **additive nullable field, attached AFTER
scoring**, exactly like `dealer_flow_projection` and `market_context`. It is **never a scoring
input** and **nothing rides SSE**.

This is the project's **first persistent MARKET-DATA store** (distinct from the auth state store).
Its relation to the "trading/bundle path stays stateless" narrowing is stated in §5.

---

## 2. The four resolved questions (the core of this contract)

### Q1 — What IV to sample: **constant-maturity ~30-day interpolated ATM IV** (with a defined fallback to the existing scalar)

**Decision.** Sample a **constant-maturity ~30-calendar-day interpolated ATM IV** ("CM30"), derived
from the term-structure curve the engine already computes, NOT the raw nearest-≥7-DTE `atm_iv`
scalar as the primary basis.

**Why.** The raw `atm_iv` scalar rides whatever the *nearest ≥7-DTE tenor* happens to be that day
(engine.py; `market_data["atm_iv"]`). As that tenor rolls (e.g. 8 DTE one day, 2 DTE the next → the
next expiry becomes anchor at ~9 DTE), the sampled maturity **jumps**, injecting term-structure
noise into what is supposed to be a *history-of-the-same-thing* series. A rank computed off a
jittering-maturity series is misleading — the opposite of this feature's intent. A constant-maturity
point holds the maturity fixed, so day-over-day changes reflect *IV level*, not *tenor roll*. This
is the industry-standard basis for IV Rank/Percentile (the "IV30" convention).

**How it is derived (basis, not implementation).** The engine already emits a full
**ATM-IV-by-tenor curve** — `compute_term_structure` returns `points` = ascending-by-DTE
`{dte, atm_iv}` records across all expirations. CM30 is a **linear interpolation of ATM IV in DTE
space at DTE = 30**, bracketing 30 between the two nearest available tenor points. Precise rule:
- If tenors bracket 30 (one ≤ 30, one ≥ 30): linear-interpolate `atm_iv` between them at DTE 30.
- If all tenors are > 30 (no short tenor) or all < 30 (no long tenor): do **not** extrapolate —
  fall back to the single nearest-tenor `atm_iv` and **record the actual DTE used** in the sample
  (see the sample record's `basis` / `basis_dte`, §3.1). Extrapolation would fabricate a level.
- If the curve is unavailable (term structure null): fall back to the raw nearest-≥7-DTE `atm_iv`
  scalar already on `market_state`, again recording the actual basis.

**Every sample is self-describing about its basis** — it stores whether it is `interpolated_30d`
or a `nearest_tenor` fallback and the actual DTE, honoring `model-read-carries-its-assumptions`.
The rank read (§3.2) surfaces the IV-basis so a consumer never assumes a cleaner series than exists.

**Non-goal (Q1):** no new vendor call, no new greeks math. CM30 is a pure read-and-interpolate over
the *already-computed* term-structure curve — the same input-reuse discipline as `context_pack`.

### Q2 — Accumulation mechanism: **write-through on bundle serve, once-per-ticker-per-UTC-day, best-effort**

**Decision.** WHO writes: the **bundle serve path** in `main.py`, at the same
attach-after-scoring boundary where `market_context` / `dealer_flow_projection` are attached (after
`generate_signals` returns). WHEN: a **write-through** on each served bundle, guarded by a
**once-per-(ticker, UTC-day) idempotent upsert** — the first served bundle for a ticker on a given
UTC calendar day writes that day's sample; subsequent serves that same UTC day are no-ops (the store
already holds a row for that `(ticker, session_date)` key). **NOT a scheduled job** — the app has no
scheduler, and a scheduled job would need its own ticker universe + vendor budget; write-through
piggybacks on organic traffic and needs neither.

**Session-date key.** The daily grain is the **UTC calendar date** derived from the bundle snapshot
timestamp (`market_state.timestamp`, already present). "One sample per ticker per session" is
implemented as a unique `(ticker, session_date)` key — the store's upsert-if-absent is the guard, so
the mechanism is **idempotent and self-correcting** even under request-coalescing / concurrent
misses (the store, not app-local state, is the source of truth for "did today already write").

**Which IV goes in.** Only a **valid** CM30 sample (or its defined fallback) with a positive IV and
a real spot is written; a degenerate/null IV is skipped (no row), mirroring `chain_store.put`'s
"only store a usable chain" guard. A skipped day simply leaves a gap — gaps are honest, never faked.

**No backfill — the store starts empty and grows.** There is no IV history to seed from; day 0 the
store is empty for every ticker, and it accumulates one row per ticker per active UTC day going
forward. This is a stated, accepted property, not a defect. The **minimum-sample floor** (§2 of Q4)
governs when a rank becomes emittable.

**Best-effort + must never perturb the bundle.** The write is wrapped so that **any** store fault
(unreachable DB, lock contention, serialization error) is swallowed and logged at debug/warn — it
**never** raises into the bundle, never changes the served payload, never touches
`market_state`-core / `strike_profile` / the cache / the SSE path, and never delays the response
path in a way the trader perceives as an error. The write is a **side effect around the stateless
compute**, exactly like `chain_store` pre-warm is a side read around it. If the write fails, the
*read* that cycle simply computes over whatever history already exists (or emits "building history").

### Q3 — Storage: a NEW **market-data time-series store/port**, non-Postgres default + Postgres prod adapter behind ONE port

**Decision.** Introduce a **new, self-contained market-data time-series subpackage** — a *sibling*
of `src/auth/`, **NOT** an extension of the auth leaf and **NOT** a new auth port. It defines:
- **One abstract port** — an "IV time-series store" (an ABC) whose **record dataclass IS the
  contract** (the sample shape, §3.1), mirroring `src/auth/ports.py` / `providers/base.py`
  discipline. The port exposes exactly the operations the write path and read path need:
  an **idempotent upsert-if-absent** of one `(ticker, session_date)` sample, and a **bounded
  read** of a ticker's most-recent-N samples ordered by session date. Nothing else.
- **A default adapter that requires NO external service** — the buildable/verifiable-here backend.
  It is either a process-local in-memory adapter (like the auth `:memory:` sqlite, resets on
  restart) **or** a local **file/SQLite-on-disk** adapter under `DATA_DIR` (survives restart). See
  the resolution note below; either satisfies the hard constraint. The default is what
  local/dev/CI runs and what the conductor's runtime-verify exercises.
- **A Postgres adapter behind the SAME port** — the prod persistence, a drop-in registered in an
  env-selected factory (mirroring `ACCOUNT_STORE`/`DATA_PROVIDER`; a new env var of the same shape,
  default = the non-Postgres adapter). It reads its connection string from **runtime env only**
  (never baked — `no-secrets-in-image`), and an unreachable DB **defers the fault to first use**
  rather than crashing boot, exactly like `auth/__init__.py::_make_postgres_stores`.

**HARD CONSTRAINT honored — no local Postgres on the dev box.** The design is fully
**buildable + runtime-verifiable on the non-Postgres default**; Postgres is a parity-reviewed prod
adapter behind the port, **not** runtime-verified in this feature's gate (persistent-db's
runtime-verify was deferred for exactly this reason). The port contract is the review surface for
Postgres parity.

**Default-adapter resolution (architect recommendation; a build-time call the Backend executioner
confirms).** Prefer a **file/SQLite-on-disk adapter under `DATA_DIR`** as the default over
pure-in-memory, because this data is *inherently accumulative* — a pure-memory store that resets on
restart would perpetually re-enter "building history" and never reach the min-sample floor in dev,
undermining the ability to *demonstrate* a real rank. On-disk persistence lets the store actually
accumulate. (The auth store accepted memory-resets because its data is re-creatable by re-signup;
IV history is **not** re-creatable — it is the whole point.) If a disk adapter proves heavier than
the phase warrants, in-memory remains a valid fallback that still satisfies the no-Postgres
constraint, at the cost of losing accumulation across restarts — flag to the PM as a UX honesty
point (§9), not an architecture blocker.

**Relation to the "stateless trading/bundle path" narrowing.** The trading/bundle **compute** stays
stateless: `compute_ticker` / `generate_signals` / the engine still take `market_data` in → produce
a byte-identical bundle out, reading **nothing** from this store. The IV store is a **best-effort
side-store read/write wrapped around** the stateless compute at the `main.py` orchestration
boundary — structurally the **chain_store precedent** (a side store the serve path writes to and
reads from without the compute depending on it), now made *persistent* and *market-data* rather than
ephemeral chain-input. The narrowing already carved out auth as "state outside the trading path";
this extends the same carve-out to a market-data side-store, with the same one-way-leaf discipline
(§4).

### Q4 — Rank vs Percentile definitions, window, and the minimum-sample floor

Let the read compute over the ticker's accumulated CM30 IV series (most-recent-N samples, one per
session). Define:

- **Window.** A **rolling trailing window of up to 252 sessions** ("~1 trading year"), with a
  **"since inception until 252"** ramp: until 252 samples exist, the window is *all* accumulated
  samples; once ≥252 exist, it is the trailing 252. The window length actually used is carried
  in-payload (`window_sessions` / sample count), never implied. 252 is the standard 1y trading-day
  count and matches the feature's "52-week form" intent.

- **IV Rank** (a *range-position*, 0–100): where current IV sits between the window **min** and
  **max**:
  `IV Rank = 100 × (IV_current − IV_min) / (IV_max − IV_min)`, over the window's samples.
  0 = at the window low, 100 = at the window high. When `IV_max == IV_min` (degenerate flat
  window), Rank is undefined → emit null for the rank field with the honest reason, never 50.

- **IV Percentile** (a *frequency*, 0–100): the **fraction of sessions in the window whose IV was
  below the current IV**, ×100:
  `IV Percentile = 100 × (count of window samples with IV < IV_current) / (window sample count)`.
  This is robust to a single outlier high/low (unlike Rank), so both are surfaced — Rank for the
  familiar range read, Percentile for the outlier-robust read.

- **Minimum-sample floor.** Below a floor of **N_min accumulated samples**, neither number is
  emitted — the read is the honest **"building history / insufficient history"** state carrying the
  current sample count and the floor ("N of N_min sessions"). **Recommended `N_min = 20`** sessions
  (roughly a trading month) as the smallest window where a percentile/rank is not laughably noisy;
  the exact floor is a **product tunable** (§9) — the architecture just mandates *a* floor and that
  it be self-describing. Never a rank off 3 days.

**Self-describing (`model-read-carries-its-assumptions`).** The rank read always carries: its
**window** (sessions used), its **sample count**, its **IV basis** (interpolated-30d vs
nearest-tenor fallback + actual DTE), and the framing that it is **advisory context — not a
forecast, not a guarantee, not a scored signal**. A bare "82" is never emitted without this envelope.

---

## 3. Data-structure CONTENT (records + the nested read shape)

> Content only — field *names* on the wire are the INTERFACE_CONTRACT's (GATE U·X). These are the
> structural records the store persists and the shape the read attaches to `market_state`.

### 3.1 The stored sample record (the store's contract, one row per ticker per session)

The record **IS** the port contract (like the auth record dataclasses). Its content:

- **ticker** — the symbol the sample belongs to (canonicalized, e.g. upper-cased).
- **session_date** — the UTC calendar date of the sample (the daily grain / dedupe key half).
- **iv_value** — the CM30 IV level for that session (percentage points, matching the engine's
  ×100 convention so it is comparable to `atm_iv` / `hv_30d` / `term_structure.points[].atm_iv`).
- **iv_basis** — how `iv_value` was derived: `interpolated_30d` | `nearest_tenor`.
- **basis_dte** — the actual DTE the sample represents (30 for a clean interpolation; the actual
  fallback tenor DTE otherwise). Makes the sample self-describing.
- **captured_at** — the epoch-second wall-clock write time (audit / freshness), distinct from the
  session_date business grain.

**Uniqueness / grain:** `(ticker, session_date)` is unique; the write is an upsert-if-absent on
that key (Q2 guard). The store never holds two rows for the same ticker-session.

**Non-secret:** these are **plain market-data values**, not credentials — `secret-encrypted-at-rest`
does **not** apply and MUST NOT be added (stated as a non-goal, §8). No encryption, no masked hint.

### 3.2 The `market_state` nested read shape (attached after scoring)

An additive **nullable nested object** on `market_state` (sibling of `market_context` /
`dealer_flow_projection`). Its structural content, in three mutually-exclusive states:

1. **Computed** — when ≥ N_min samples exist and a current IV is available:
   - the **current IV** used (level).
   - **iv_rank** (0–100 or null-with-reason if the window is degenerate-flat).
   - **iv_percentile** (0–100).
   - the **window descriptor**: sessions used (`window_sessions`) + total accumulated sample count.
   - the **basis descriptor**: `iv_basis` + `basis_dte` (Q1 self-description).
   - an **advisory framing** marker (context, not forecast/guarantee/scored-signal).
   - *(Optional, product-gated)* a small **digested rich/cheap band label** — see §8 /
     `digested-labels-not-raw-dump`: if surfaced, a single small band token (e.g. a low/mid/high
     band), **never the raw IV series**. The band thresholds are a **product choice (§9)**; the
     architecture only permits a *digested* label, never a raw dump.

2. **Building history** — when 1 ≤ samples < N_min: the honest state carrying the current sample
   count and the floor (`N of N_min`), no rank/percentile number. Same self-describing envelope
   (window/basis/framing) so the reason is legible.

3. **Null** — when the whole read is unavailable (store outage, no current IV this cycle, wrapper
   fault). The field is **always present as `object | null`** (never absent-key), and null is a
   legitimate honest value, never an error (§4).

**No raw series on the wire.** The `market_state` read carries *derived* numbers + descriptors +
(optionally) a digested band — it does **not** carry the accumulated IV history array. That series
lives only in the store (`digested-labels-not-raw-dump`).

---

## 4. Data-flow + component boundaries

**New component — the market-data time-series subpackage (a one-way leaf).** A new
self-contained package (sibling of `src/auth/`), containing: the port ABC + sample record, the
default no-external-service adapter, the Postgres adapter, an env-selected factory, and a thin
compute helper that reads the term-structure curve to produce a CM30 sample and computes
rank/percentile over a returned window. It imports **stdlib + its own port/adapters (+ the DB driver
lazily in the Postgres adapter only)** — and **NEVER** imports `signals.py` / `engine.py` /
`live.py` / `darkpool.py` / `chain_store.py` / the scoring path. This module boundary is the
**structural guarantee** of score byte-identity, identical to how `src/auth/` and
`ai_recommendation.py` and `context_pack.py` are one-way leaves.

**The leaf-import boundary the scoring modules MUST NOT cross:** `signals.py` / `engine.py` /
`live.py` / `darkpool.py` **do not import** the new subpackage. `main.py` is the **sole**
orchestration boundary that mounts it.

**WRITE path (accumulation):**
1. Bundle serve computes the bundle as today (stateless: `market_data` → `compute_ticker`).
2. **After `generate_signals` returns** (the same attach point as `market_context`), `main.py`
   derives the **CM30 sample** from the already-computed term-structure curve (best-effort; skipped
   if no usable IV) and calls the store's **idempotent upsert-if-absent** on `(ticker,
   session_date)`. Wrapped so any fault is swallowed — the bundle is unaffected.

**READ path (rank/percentile):**
1. Also **after scoring**, `main.py` calls the leaf's compute helper: it reads the ticker's
   most-recent-N samples from the store, derives the current-IV basis, computes rank/percentile (or
   the building-history / null state), and returns the §3.2 nested read.
2. `main.py` attaches that object to `market_state` under the read's key (as `market_context` is
   attached). One outer guard → the whole read becomes null on any wrapper fault.

**Order at the attach boundary:** the write-then-read ordering within a single serve is a build
detail (a same-cycle read may or may not include today's just-written sample — either is honest as
long as the sample count reported matches what was used). The Backend contract pins it; the
architecture only requires both happen **after** scoring and **best-effort**.

**Isolation from the AI export:** the read rides `market_state`, and the AI state exporter forwards
`market_state` **wholesale** (no serializer change needed, as with `dealer_flow_projection` /
`market_context`) — so the AI gets the rank as context automatically. No change to
`serialize_context`.

**Isolation from SSE:** the read is a **STATIC daily bundle read**. It is computed with the cached
60s bundle, never on the SSE path, and the widget stays visible + **un-dimmed** on a stream drop
(STATIC family, like the four positioning tiles / `dealer_flow_projection` / `market_context`).

---

## 5. This store vs the "stateless trading/bundle path" narrowing

- The **compute** (`compute_ticker` / engine / signals / fingerprint) stays **stateless and
  recompute-from-vendor**: it reads nothing from this store and produces a byte-identical bundle.
- The IV store is a **best-effort persistent side-store** the *serve orchestration* writes to and
  reads from — the **chain_store precedent**, now persistent + market-data. The stateless property
  is narrowed to the compute transform, not the serve orchestration (auth already established this
  carve-out; this extends it to market data).
- It is the project's **first persistent market-data store**. Unlike auth (state re-creatable via
  re-signup, so memory-reset was accepted), this store's value is *accumulation over time* — hence
  the disk-default recommendation (§Q3). But no downstream correctness depends on it: an empty or
  wiped store degrades to "building history," never an error.

---

## 6. Isolation & error rules (binding)

- **Best-effort, isolated, or null** (`best-effort-isolated-or-null`): store outage / insufficient
  history / write failure / no-IV-this-cycle → a **null read field** or a **"building history"**
  state, **never an HTTP error**; the key is always present as `object | null`; a write fault is
  swallowed and never perturbs the bundle / cache / SSE. This is a one-way leaf like `context_pack`.
- **Additive keeps score byte-identical** (`additive-keeps-score-byte-identical`, HARD): the store
  and read are AI-context + display ONLY. `signals.py` is untouched (0 diff). The IV read is
  attached to `market_state` **after** `generate_signals` returns, so the fields don't exist at
  score/gate/fingerprint time (belt), and `signals` imports none of the leaf (suspenders). The IV
  store NEVER feeds `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry gate.
- **Live-vs-static isolation** (`live-vs-static-isolation`): the read is a STATIC daily datum.
  Nothing rides SSE; the widget stays visible + un-dimmed on a stream drop.
- **Model-read-carries-its-assumptions** (PROMOTED): the read is self-describing — window +
  sample-count + IV-basis + advisory framing in-payload; never a bare number implying more history
  than exists; framed as context, not a forecast/guarantee/scored signal.
- **Digested-labels-not-raw-dump**: any surfaced rich/cheap label is a **small digested band**, not
  a raw IV series; the accumulated series never leaves the store.
- **Secret-encrypted-at-rest — NOT touched:** IV samples are **non-secret market data**; no
  encryption / masked-hint / crypto-boundary is added (explicit non-goal, §8).

---

## 7. Restated binding constraints (domain/math invariants + promoted build invariants)

**Domain / math (from PROJECT_CONTEXT §3):**
- IV values are expressed in **percentage points** (the engine multiplies the vendor's decimal IV by
  100 for `atm_iv`; `term_structure.points[].atm_iv` is likewise ×100). The CM30 sample and the rank
  read stay in this same unit so they are comparable and honestly labeled.
- **ATM IV** (engine) = avg of call+put IV at the ATM strike of the **nearest tenor ≥ 7 DTE**; the
  **term-structure curve** = ATM-IV-by-tenor across all expirations, ascending by DTE. CM30 is
  interpolated from that curve at DTE 30; **no new gamma/flip/greeks math is touched** (these
  IV reads sit alongside, never inside, the gamma structure — consistent with the existing "these
  four touch no gamma/flip/wall math" narrowing).
- Time-to-expiry / DTE conventions are the engine's existing ones (do not re-derive).

**Promoted build invariants (PROJECT_CONTEXT §5, apply to this feature):**
`best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` · `live-vs-static-isolation`
· `model-read-carries-its-assumptions` · `digested-labels-not-raw-dump` · `theme-token-discipline`
(FE, GATE U/FE) · `no-secrets-in-image` (Postgres connection string via runtime env only, never
baked). Not-touched-and-must-stay-not-touched: `secret-encrypted-at-rest`, `no-real-order-path`,
`server-side-gate-enforcement` (this read is anonymous-visible context, no gate),
`single-shared-sim-entry-dialog`. Score/tier/fingerprint byte-identity is the enforced invariant.

---

## 8. Explicit non-goals

- **No vendor IV-history call, no VIX/index feed.** Confirmed `NOT_AUTHORIZED` / unavailable. The
  store *is* the history; there is no external series.
- **No backfill / seeding.** The store starts empty and grows; no synthetic history is fabricated.
- **Not a scoring input.** Never feeds `signals` / score / tier / gate / `state_fingerprint`.
- **Nothing on SSE.** Not a live datum; no per-tick recompute.
- **No encryption / secret handling.** IV samples are non-secret market data;
  `secret-encrypted-at-rest` is deliberately not engaged (no crypto boundary, no masked hint).
- **No raw IV series on the wire / in the UI.** Only derived numbers + descriptors + an optional
  digested band.
- **No new port on the auth leaf.** This is a *separate* market-data subpackage, not a fifth auth
  store.
- **No Postgres runtime-verify in this gate.** Postgres is a parity-reviewed prod adapter behind
  the port; the default no-external-service adapter is what runs and is verified here.
- **No UI / layout / copy / placement / endpoint shape / wire field names** — those are PM / UX /
  Interface downstream (§9).
- **No scheduler.** Accumulation is write-through on organic bundle traffic, not a cron/worker.

---

## 9. Open questions for the PM (product/UX decisions deliberately deferred)

1. **Copy for the three states** — the "building history (N of N_min)" message, the rich/cheap
   framing, and the advisory-context disclaimer wording. (Architecture mandates *that* they are
   self-describing; PM/UX own the words.)
2. **The rich/cheap band thresholds** — whether a digested band label is surfaced at all, and if so
   the band cut points (e.g. what Rank/Percentile counts as "premium rich" vs "cheap" vs "neutral").
   A product judgment; the architecture only permits a *small digested* band, never a raw dump.
3. **The minimum-sample floor value (`N_min`)** — architecture recommends **20 sessions** and
   mandates *a* floor; the exact number is a product tunable. Also: should Rank/Percentile be gated
   at the *same* floor, or Percentile allowed at a lower count than Rank?
4. **Which IV metric leads** — Rank vs Percentile as the headline number (both are computed;
   which is primary on the display is a product/UX call).
5. **Display placement + widget family** — where the IV-rank read renders on the Ticker page (which
   bento section / after which widget). It is STATIC-family; exact placement is UX.
6. **Ticker scope of accumulation** — accumulation is organic (only tickers that get served
   accumulate). Confirm this is acceptable (a rarely-viewed ticker builds history slowly), or
   whether a curated warm-list is a *later* product ask (out of scope here).
7. **Disk-vs-memory default UX honesty** — if the Backend executioner picks the in-memory default
   (loses accumulation on restart), the "building history" state resets on each backend restart in
   dev; confirm the honesty framing is acceptable for the prototype, or push for the disk adapter.

---

## 10. Repo grounding (files this shape mirrors / touches — by path, not pasted)

- `apps/api/src/core/engine.py` — `compute_term_structure` (the ATM-IV-by-tenor curve CM30
  interpolates over) + `atm_iv` (the ×100 unit + nearest-≥7-DTE fallback basis).
- `apps/api/main.py` — `_build_market_state` (where `atm_iv`/`iv_skew`/`term_structure` are set) and
  the **attach-after-`generate_signals`** boundary (where `market_context` is attached — the write
  hook + read attach mirror this exactly).
- `apps/api/src/auth/__init__.py` + `ports.py` — the env-selected store-factory + port/record
  pattern (and the Postgres defer-fault-to-first-use precedent) the new market-data store MIRRORS —
  as *shape precedent*, not the leaf to extend.
- `apps/api/src/core/chain_store.py` — the best-effort side-store around the stateless compute
  (put/get-fresh + swallow-all-faults discipline) the new store's isolation MIRRORS, made persistent.
- `apps/api/src/core/context_pack.py` — the one-way-leaf, attach-after-scoring, self-describing
  additive-read precedent this read follows.
- `apps/api/src/providers/base.py` — the provider-port ABC discipline the new port mirrors.
