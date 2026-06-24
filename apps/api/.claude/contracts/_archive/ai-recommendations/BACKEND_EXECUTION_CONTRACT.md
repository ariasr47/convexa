# BACKEND EXECUTION CONTRACT — AI Recommendations

> Producer: UX/Tech-Writer (compressor #3). Consumer: Backend executioner.
> Lane: **server work only.** References INTERFACE_CONTRACT.md for what it EMITS. **No UI detail.**
> Self-contained against GAMMAFLOW_CONTEXT.md + INTERFACE_CONTRACT.md.
> **This is a REAL backend lane — NOT NO_BACKEND_CHANGE.**

This is GammaFlow's **first in-app LLM call**. Build the isolated best-effort LLM proxy + the
state-export serializer + the server-side key + the rate cap + the gating-signal derivation. The model
is **latest Claude (Opus 4.8)** — consult the `claude-api` skill for the model id, structured-output,
and (optional) streaming specifics.

---

## 1. What to build (component boundaries)

A **new isolated backend module** (a one-way leaf, sibling to the existing best-effort modules — e.g.
`src/core/ai_recommendation.py` or `src/providers/llm/`), plus the three endpoints in `main.py`. The
module is a **one-way leaf**: `signals.py` / `engine.py` / `live.py` / `darkpool.py` **do NOT import
it** (mirrors the observability Level-1 rule). That import boundary is the structural enforcement of
`additive-keeps-score-byte-identical` — verify it (a dependency/import check).

### 1.1 The isolated LLM proxy → emits `RecResponse` (INTERFACE §1.1)
- **Server-side key:** read `ANTHROPIC_API_KEY` from `.env` (mirroring `MASSIVE_API_KEY`). The key is
  read ONLY by this module, **never** serialized into any bundle/SSE/response, never reaches the browser.
- **Context assembly — no recompute:** obtain the **already-cached** bundle for `{ticker}` (the same
  cached `MarketState`/`signals`/`strike_profile`/`meta` the dashboard holds — the 60s in-memory cache).
  Whether you re-read it server-side from the cache or accept it is your call (both satisfy "no
  recompute"); the binding rule is the context is a **serialization of already-computed state** — no new
  vendor fetch, no greek repricing, no DTE-scope change, **null stays null**.
- **Persona prompt:** assemble from the **canonical** decomposed template + presets in
  `src/core/personas.py` / `GET /api/personas` (resolves the dual-sourcing flag). `persona_id` selects
  which; `null` ⇒ Default (byte-identical to today's prompt). Persona is a **non-input to scoring**.
- **Call:** proxy → Claude with (persona prompt + serialized context [INTERFACE §1.2 `context`] +
  glossary `market_state_glossary.md`). Reconcile the model output to the **existing
  `prompts/strategy_prompt.md` risk-first ENTRY schema** (INTERFACE §1.1 `strategy`) — the schema MUST
  survive unchanged (lead with risk; `no_trade` is a valid+common answer; JSON-only). Streaming is
  OPTIONAL (the response is reconciled to the whole structured schema either way; the UI renders whole).
- **Pin:** stamp `as_of` = the bundle's `meta.freshness.snapshot_iso`, `pinned_fingerprint` =
  `ai_eval.state_fingerprint`, `stale_born` = the bundle's `meta.freshness.stale` at generation time.
- **Provenance:** `persona` = `{id, name}` of the persona that framed it.

### 1.2 The state-export serializer → emits `RecExport` (INTERFACE §1.2)
- A **read + serialize** of the cached bundle into `context` (ARCHITECTURE §A content: gamma structure +
  walls/flip/magnet/net-call-put GEX/max-pain/PCR; the four neutral reads [DEX, Vol/OI, IV skew, term
  structure] with existing nullability; vol/anchors [ATM IV, HV, IV/HV, VWAP+bands]; higher-order greeks
  [vanna/charm/volga]; live fields **as captured in that snapshot** (not a live re-read); dark-pool
  context **only when present in the bundle**; `signals` read-outs [setups, regime/vol-regime,
  opportunity_score, opportunity_tier, ai_eval]; the DTE window; the snapshot identity/as-of).
- **Egress invariant (system-6-adjacent, binding):** `RecExport` carries ONLY
  `{ticker, as_of, context, persona_prompt, glossary, egress_note}`. **No** API key, **no** other ticker,
  **no** user identity, **no** order/broker data. This same export feeds BOTH the in-app call (§1.1) and
  the manual hand-off — they must serialize identically (single serializer).
- **No LLM call** on this endpoint; always 200 when a bundle exists (404 if the ticker was never
  fetched / not in cache).

### 1.3 The rate cap + cooldown (server-side enforcement)
- **Cooldown: 60s default**, env-configurable (e.g. `AI_REC_COOLDOWN_SECONDS`). After a query, further
  queries within the window are blocked → `gate.state == "cooling_down"` with
  `cooldown_remaining_seconds` counted down.
- **Daily cap: 50/day default**, env-configurable (e.g. `AI_REC_DAILY_CAP`), counted per deployment
  (single user today). On reaching it: `cap.over_limit == true`, `remaining_today == 0`, and `resets_at`
  = the daily reset boundary (pick + document the boundary, e.g. local-midnight or a fixed ET instant).
- **Both are calm blocked states, never HTTP errors.** A query attempted while over-cap returns 200 with
  `status: "unavailable"`, `unavailable_reason: "over_cap"` (or short-circuits to the cap fields) — never
  a 429-that-breaks-the-page. (The FE reads the cap from §1.3 `RecStatus` and disables the action ahead
  of time; the server enforces regardless.)
- The cap/cooldown counter is server-side state (process-local is acceptable for single-user today,
  consistent with the metrics aggregate's ephemerality). Document reset-on-restart behavior.

### 1.4 The gating-signal derivation → emits `RecStatus.gate` (INTERFACE §1.3)
- Derive `gate.state` from the **existing `ai_eval` machinery** (do NOT recompute or alter it — read it):
  - `no_fresh_edge` ⇔ guardrails say not actionable/changed (e.g. `!ai_eval.ready` or `!ai_eval.changed`
    — wire to the exact fields; surface human strings in `gate.reasons`, mirroring `ai_eval.reasons`).
  - `cooling_down` ⇔ within the cooldown window (takes precedence in presentation, but report truthfully).
  - `available` otherwise.
- `availability.in_app_enabled` = whether `ANTHROPIC_API_KEY` is configured AND the feature is on. False
  ⇒ the in-app path is cleanly unavailable (the FE renders inert; the export floor stays).

---

## 2. Isolation / error rules (binding — `best-effort-isolated-or-null`)
- **Never HTTP 5xx for an LLM/cap/key fault.** LLM timeout/error/over-cap/no-key →
  `RecResponse.status == "unavailable"` (200) with a safe `unavailable_reason` (`"timeout"`,
  `"llm_error"`, `"over_cap"`, `"no_key"`) — **never leak key/secret/internal text**.
- The proxy is **off the bundle/SSE critical path** — its multi-second latency and failures cannot stall
  the ~60s cached bundle or the live stream. It owns its own timeout (bounded; document it).
- `gated_off` is returned only when the gate is `no_fresh_edge` and `override == false`
  (belt-and-suspenders; the FE normally gates ahead via §1.3).
- A `no_trade` result is a **success** (`status: "produced"`, `decision: "no_trade"`), not an error.

## 3. Invariants the backend must preserve (verify in tests)
- `additive-keeps-score-byte-identical` — `signals.py`/`engine.py` unmodified; the new module is NOT
  imported by them; the bundle (+ `opportunity_score`/`opportunity_tier`/`ai_eval`/`state_fingerprint`)
  is **byte-identical** with and without the feature and whether or not a rec was ever requested.
- `best-effort-isolated-or-null` — every fault path returns a contained 200 state; no 5xx on the bundle.
- `live-vs-static-isolation` — the server **never** auto-refreshes/re-runs a rec; the rec is pinned and
  static; the server does not push recs over SSE.
- `no-real-order-path` — no endpoint here creates/mutates a trade; no broker path exists.
- **No recompute / no new fetch / no new math** — gamma sourcing, rates/greeks (r=4.5%,
  `MIN_GREEK_T=1/365`), DTE/expiration scope all untouched; the export is read+serialize only.
- **Server-side key only** — `ANTHROPIC_API_KEY` never appears in any response; never reaches the browser.
- **Persona canonical-sourced + non-scoring** — prompt from `GET /api/personas` template/presets; persona
  changes only the AI briefing, never any computed number.

## 4. Config (operator-configurable, documented in `.env` conventions)
- `ANTHROPIC_API_KEY` — server-side LLM key (mirrors `MASSIVE_API_KEY`). Absent ⇒ `in_app_enabled:false`.
- `AI_REC_COOLDOWN_SECONDS` (default `60`) — per-query cooldown.
- `AI_REC_DAILY_CAP` (default `50`) — per-deployment daily recommendation cap.
- (Optional) a feature flag to disable the in-app call while keeping the export floor.

## 5. Seams (designed-for, NOT built now — ARCHITECTURE §Seams)
- **BYO-key / multi-tenant:** model the credential like the vendor provider port — single server-side key
  today behind a seam that could later accept a per-user key. Build the server-side-key + rate-cap path
  only; design the boundary so BYO-key is a contained later swap. NOT built.
- **Provider-port-like LLM abstraction:** keep "which LLM vendor/model" a contained choice (mirrors
  `MarketDataProvider`) so a model swap is an adapter swap. Designed-for; only Claude today.
- **Open-position reassessment** stays the separate existing path (`reassessment_prompt` / operator-
  mediated) — out of scope (entry only).

## 6. Tests to write (backend)
- `interface_conformance.py` passes the §3 Conformance spec (shapes/enums/presence/forbidden-fields).
- Score byte-identity: bundle bytes identical with the module present vs a query issued vs never issued.
- Import-boundary: `signals`/`engine`/`live`/`darkpool` do not import the new module.
- Fault paths → 200 `unavailable` (timeout, llm_error, over_cap, no_key), each with a safe reason and
  **no key/secret in the payload**.
- Export egress: only `{ticker, as_of, context, persona_prompt, glossary, egress_note}`; null stays null;
  no other ticker / identity / order data; same serializer as the in-app context.
- Cooldown: a second query within 60s → `cooling_down`; after the window → `available`.
- Daily cap: the (N+1)th query over `AI_REC_DAILY_CAP` → `over_limit`/`unavailable:over_cap`; `resets_at`
  set; export still 200.
- Gate derivation: `ai_eval` not ready/changed → `no_fresh_edge` with reasons; ready+changed →
  `available`; `ai_eval` itself unaltered.
- No-key: `ANTHROPIC_API_KEY` absent → `in_app_enabled:false`; export endpoint still 200.
- Pinning: `as_of`/`pinned_fingerprint`/`stale_born` stamped from the bundle's freshness at generation.
