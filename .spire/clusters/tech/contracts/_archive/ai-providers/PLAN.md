# ai-providers — implementation plan

> **For agentic workers (lanes):** `delivery-backend` owns the BACKEND track; `delivery-frontend`
> owns the FRONTEND track; conductor + `qa-verify` own VERIFICATION. Steps use checkbox (`- [ ]`)
> syntax. Each lane reads its own track plus **Global Constraints**. Where this plan and
> `SPEC.md` / `INTERFACE_CONTRACT.md` appear to differ, the contracts win and the divergence is a
> GATE Z bounce — never a silent edit. Do not edit SPEC or INTERFACE.

**Goal:** Redesign how a signed-in trader powers Ask-AI so they always know which provider and
which named model will run (and which ran): one BYO ciphertext **per** closed provider, one
standing preference shared by Settings and Ask-AI, closed model catalogs, deletion of all free-uses
/ `shared_admin` paths, and an honest Grok **subscription** OAuth arm (user's own SuperGrok —
never a Convexa pool) that ships present-but-unavailable until §9 docs verify.

**Architecture:** Expand credential identity from live `(user_id, kind="ai")` to
`(user_id, kind="ai", provider)` under the same encrypt-at-rest floor. Persist standing
`ai_power_path` / `ai_provider` / `ai_model` on settings (single writer). Rewrite
`resolve_llm_key` to the INTERFACE fixed order (auth → power_path null → model gate →
`grok_subscription` | `own_key` — never env-key fallthrough). FE replaces Anthropic-only
`AiKeySection` with an AI providers panel (subscription card + per-provider matrix + model
control) and rewires Ask-AI gates / provenance to closed lookups. Score / tier / fingerprint
untouched.

**Tech stack:** Axum/Tokio Rust (`apps/api`, crate `api-rust`) · Fernet crypto in
`services/auth/crypto.rs` · React 19 + Vite + MUI (`apps/dashboard`, `@convexa/dashboard`) ·
shared TS client `@convexa/api` (`libs/api`) · Vitest · `cargo test -p api-rust` · interface
conformance via `node .grok/tools/interface_conformance.mjs`.

**Spec:** `.spire/clusters/tech/contracts/ai-providers/SPEC.md` (APPROVED 2026-08-17)
**Interface:** `.spire/clusters/tech/contracts/ai-providers/INTERFACE_CONTRACT.md`
**Decisions:** `council/decisions.md` D1–D7 (D7 = user Grok subscription, wire `grok_subscription`)

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`, `libs` types only via FE) | **B1 → B10** (strict order inside BE) | Parallel with FE |
| **Frontend** (`apps/dashboard` + `libs/api`) | **F1 → F9** (strict order inside FE) | Parallel with BE |
| **Verification** | **V1 → V7** after both lanes land | Read-only gates |

**Parallelism:** Backend and Frontend bind the same INTERFACE and run independently. FE may mock
the new wire shapes before BE is green. Verification waits for both.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Contracts of record:** SPEC.md (LOCKED — AC-1–AC-30; ship-blocking AC-1–19, AC-25, AC-27) and
INTERFACE_CONTRACT.md (LOCKED — FE↔BE wire truth). `council/decisions.md` is rationale. A needed
interface change during build is a GATE Z amendment — never a silent edit.

**Standing project traps:**

- **`nx typecheck` is mandatory before any green claim.** Vitest does not typecheck.
- **Check EXIT CODES** (`$LASTEXITCODE`), not printed summaries.
- **Never bare `nx format:write`.** Always `--files path/a,path/b`. Prefer Prettier scoped to
  touched files.
- **Never write a literal NUL byte.** Byte-scan fixtures:
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.
- **Cite live Rust/TS only.** Do not cite Python `ai_recommendation.py`. Verified live seams:
  `apps/api/src/services/llm.rs` (`LlmProvider`, `default_model`, `complete_strategy`);
  `apps/api/src/routes/auth.rs` (`AiKeyBody { key, provider: Option<String> }`);
  `apps/api/src/services/recommendation.rs` (`resolve_llm_key`: own key → `shared_admin` →
  `none`; model = env-default);
  `apps/api/src/services/auth/store.rs` (`CredentialRecord.provider`; PK `(user_id, kind)` via
  `cred_key`); `apps/dashboard/src/app/features/auth/AiKeySection.tsx` (Anthropic-only).
- **`npm run ports:free`** before any run-the-app verification.
- Do **not** edit SPEC.md / INTERFACE_CONTRACT.md / BRIEF.md / council/*.

**Feature hard rules (D1–D7 — do not reopen):**

- **D7:** `grok_subscription` = **user's own** Grok / SuperGrok subscription via OAuth. Never
  Convexa-billed pool, never shared `XAI_API_KEY` as product spend, never copy "Convexa Grok
  pool." No unvouched "cheaper" / "included" / "free."
- **D5:** Delete `shared_admin`, `remaining_free_uses`, `free_uses_total`, and all free-uses copy
  from resolution, status, rec envelopes, and UI. No silent env-key fallthrough.
- **D3:** One BYO ciphertext **per** provider (`anthropic`|`openai`|`xai`|`gemini`). Explicit
  schema/PK expansion. Client **must** send closed `provider`; server must **not** retitle the
  slot from `detect_from_key`.
- **D4:** First-visit persist named catalog recommended default as `ai_model` (does **not** write
  `power_path`). Ask enabled only when a usable power path also exists.
- **D1:** Saved model ∉ active catalog → block (`model_not_in_catalog` / alias `model_missing`);
  **no** LLM call; **no** silent substitute. Path-switch recommended-default write is D4-class,
  not D1.
- **D6:** Settings and Ask-AI share one standing preference. Ask-AI model select writes through.
  No one-shot override in v1.
- **D2:** Live store is one row today — multi-slot is new work, not already built.

**S2 leftovers addressed in this plan (planning fills — do not reopen product calls):**

1. **Migration backfill:** promote legacy `(user_id, kind=ai)` ciphertext into the provider slot
   **and** backfill `ai_power_path=own_key` + `ai_provider=<slot>` when that user has a set key and
   `ai_power_path` is still null — so current BYO users are not AC-13-bricked. Decrypt-fail on a
   promoted slot surfaces `key_unusable` once path is set (not "add a key").
2. **Ask-AI catalog read:** Ask-AI (signed-in) calls `GET /api/auth/ai-key` for `catalog.*` +
   preference echo (same bootstrap as Settings). Status probe stays **side-effect-free** and does
   not carry catalog. D4 first-visit persist lives only on GET ai-key.
3. **Leave subscription:** **Use this key** / successful BYO save writes `power_path=own_key`
   (AC-11). Connected+inactive Grok card also exposes **Use this subscription** that PUTs
   `ai_power_path=grok_subscription` (fills the return gesture; moot while arm is unavailable).
4. **Unpowered wire reason:** when `power_path` is null, `unavailable_reason=no_key` only
   (INTERFACE wins). FE may still offer Connect when `grok.available` from the ai-key bootstrap;
   do not emit `subscription_unavailable` for never-gestured users.

**Grok OAuth honesty (AC-27 / SPEC §9):** Primary xAI user-OAuth docs are **unverified**. This
plan ships the arm as **present-but-unavailable**: `grok.available=false`, Settings info note, no
completable Connect CTA, start endpoint returns 409 `grok_unavailable`. Do **not** invent
protocol URLs, token shapes, or remaining-allowance fields. Connect/callback spend path is gated
on a post-plan §9 lane-check; until then AC-9/10/14/15 stay explicitly open/blocked-on in the
gate record.

**Named non-goals:** Convexa pool framing · providers outside the four · OpenAI-compatible as a
trader slot · one-shot model override · spend dashboards · inventing OAuth endpoints · resurrecting
free uses · provider/model as scoring inputs · FE key-prefix forensics.

**Baselines (record at task start; ratchet up):**

| Suite | Command | Expectation |
|---|---|---|
| BE unit | `npx nx test api` (= `cargo test -p api-rust -p quant-engine`) | exit 0 + new tests |
| FE unit | `npx nx test @convexa/dashboard` | exit 0 + new tests |
| FE typecheck | `npx nx typecheck @convexa/dashboard` | exit 0 |
| Conformance | see V3 | exit 0 against INTERFACE block |
| Score identity | characterization in B8 / V4 | byte-identical fixtures |

### Conformance spec

Copied **verbatim** from `.spire/clusters/tech/contracts/ai-providers/INTERFACE_CONTRACT.md`
`## Conformance spec` — both lanes inherit this binding wire shape:

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/auth/ai-key",
      "path_params": {},
      "query": {},
      "auth": true,
      "required": {
        "storage_available": "boolean",
        "providers": "array",
        "providers[].provider": "string",
        "providers[].set": "boolean",
        "providers[].last4": "string|null",
        "grok.available": "boolean",
        "grok.connected": "boolean",
        "grok.unavailable_reason": "string|null",
        "preference.power_path": "string|null",
        "preference.provider": "string|null",
        "preference.model": "string|null",
        "catalog.providers": "array",
        "catalog.providers[].provider": "string",
        "catalog.providers[].models": "array",
        "catalog.providers[].models[].id": "string",
        "catalog.providers[].models[].recommended": "boolean",
        "catalog.grok_subscription.provider": "string",
        "catalog.grok_subscription.models": "array",
        "catalog.grok_subscription.models[].id": "string",
        "catalog.grok_subscription.models[].recommended": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/auth/settings",
      "path_params": {},
      "query": {},
      "auth": true,
      "required": {
        "theme": "string",
        "ai_power_path": "string|null",
        "ai_provider": "string|null",
        "ai_model": "string|null",
        "risk_inputs": "object"
      }
    },
    {
      "method": "GET",
      "path": "/api/recommendation/status/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "availability.in_app_enabled": "boolean",
        "gate.state": "string",
        "cap.over_limit": "boolean",
        "cap.remaining_today": "number",
        "powering.key_source": "string",
        "powering.provider": "string|null",
        "powering.model": "string|null",
        "powering.unavailable_reason": "string|null",
        "powering.preference.power_path": "string|null",
        "powering.preference.provider": "string|null",
        "powering.preference.model": "string|null",
        "scenarios.enabled": "boolean",
        "scenarios.catalog": "array"
      }
    },
    {
      "method": "POST",
      "path": "/api/recommendation/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "auth": true,
      "body": {
        "persona_id": null,
        "snapshot_fingerprint": "conformance-ai-providers",
        "dte_min": null,
        "dte_max": null,
        "dark_pool": true,
        "override": true
      },
      "required": {
        "key_source": "string",
        "provider": "string|null",
        "model": "string|null",
        "unavailable_reason": "string|null",
        "status": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state.ticker": "string",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "ai_eval.state_fingerprint": "string"
      }
    }
  ]
}
```

Run with:

```powershell
node .grok/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/ai-providers/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 --auth-signup `
  --report .spire/clusters/tech/contracts/ai-providers/conformance-receipt.json
```

`--auth-signup` only. Fresh account ⇒ typically unavailable/`no_key` — still type-checks additive
fields. Do not invent secret-bearing conformance probes.

---

## File map

**BACKEND — create:**

- `apps/api/src/services/auth/grok_oauth.rs` — config-gated stub (`available()==false` until §9)
- `apps/api/src/services/llm_catalog.rs` — closed model catalogs + recommended defaults
- `apps/api/src/services/auth/ai_preference.rs` (or co-locate in `service.rs`) — model switch rule +
  D4 persist helpers
- Unit tests beside touched modules / `apps/api/src/services/recommendation.rs` `#[cfg(test)]`

**BACKEND — modify:**

- `apps/api/src/db/migrations.rs` — v9: credentials PK `(user_id, kind, provider)`;
  `user_settings` AI preference columns; optional `grok_links` table skeleton (opaque link metadata
  only; unused while `available=false`)
- `apps/api/src/db/pg_auth.rs` — credential get/set/delete/list by provider; settings AI fields
- `apps/api/src/services/auth/store.rs` — `cred_key(user, kind, provider)`; list AI slots; migrate
  legacy `user::ai` → `user::ai::{provider}`; SettingsRecord + SettingsPatch AI fields
- `apps/api/src/services/auth/service.rs` — bootstrap shape; required-provider PUT; scoped DELETE;
  decrypt-by-provider; preference helpers; power gestures
- `apps/api/src/services/auth/mod.rs` — export grok_oauth
- `apps/api/src/services/auth/google_oauth.rs` — **read-only pattern reference** (do not change
  Google login)
- `apps/api/src/routes/auth.rs` — `AiKeyBody.provider` **required**; DELETE query `provider`;
  settings AI fields; grok start/callback/delete stubs
- `apps/api/src/routes/mod.rs` — mount `/api/auth/grok/*`
- `apps/api/src/services/llm.rs` — `ResolvedLlmKey.key_source` vocabulary drop `shared_admin`; add
  `grok_subscription`; stop treating env defaults as invisible call-time substitutes when a
  preference model is supplied
- `apps/api/src/services/recommendation.rs` — rewrite `resolve_llm_key` + `status_payload` + POST
  envelope fields; delete free-uses / shared_admin arms

**FRONTEND — create/modify:**

- `libs/api/src/lib/convexa.ts` (+ `convexa.spec.ts`) — new `AiProvidersBootstrap` types; require
  `provider` on set/remove; settings AI fields; `KeySource` drop `shared_admin` add
  `grok_subscription`; status `powering.*`; remove free-uses from product types
- `apps/dashboard/src/app/features/auth/AiKeySection.tsx` → redesign as AI providers panel
  (or rename to `AiProvidersSection.tsx` and update imports; keep `#ai-key` / dual-id)
- `apps/dashboard/src/app/features/auth/copy.ts` — new copy (no free / no Convexa Grok pool)
- `apps/dashboard/src/app/features/auth/SettingsPage.tsx` — panel heading "AI providers"
- `apps/dashboard/src/app/features/auth/testBackend.ts` — matrix bootstrap mock
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx` — gate matrix + model select
  + ai-key bootstrap read
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx` — provenance chips
  (subscription ≠ BYO Grok; delete free-uses chip)
- `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts` + `presentationPolicy.ts`
- Specs: `ai-rec.risk.spec.tsx`, `DecisionCard.spec.tsx`, new providers section specs; purge
  `shared_admin` / free-uses assertions from product paths (plan-scope AC-2 fixtures that
  intentionally poison `shared_admin` for **hide** predicates may keep the token as a negative
  fixture only — never as a live powering path)

**Do not touch:** scoring / signals / engine / SSE / bundle routes · Google account OAuth product
behavior · sim-trade gate · Python archive.

---

## Sequencing

```
BE:  B1 schema → B2 store API → B3 catalog+preference → B4 ai-key bootstrap/PUT/DELETE
     → B5 settings AI fields → B6 resolve rewrite → B7 status/POST envelopes
     → B8 score-identity characterization → B9 grok stub routes → B10 BE tests green

FE:  F1 @convexa/api types → F2 lookups/copy → F3 Settings panel chrome
     → F4 BYO matrix gestures → F5 model control + preference write-through
     → F6 Ask-AI bootstrap+gates → F7 provenance → F8 free-uses purge → F9 FE tests+typecheck

V:   after B10 ∩ F9 → V1–V7
```

Critical path for integration: **B4 + B6 + F1** before end-to-end Ask-AI against a real server.

---

## Backend track

### B1 — Schema expansion + settings AI columns

**Files:** `apps/api/src/db/migrations.rs`, `apps/api/src/db/pg_auth.rs` (read ahead; write in B2)

- [ ] **Step 1: Write failing migration-shape test** in `migrations.rs` `#[cfg(test)]` asserting
  version 9 exists and is named `ai_providers_slots` (or equivalent).

- [ ] **Step 2: Add migration v9** after v8 (`user_settings_risk_block`):

```rust
(
    9,
    "ai_providers_slots",
    r#"
-- Per-provider BYO identity: (user_id, kind, provider)
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'anthropic';

-- Rebuild PK (Postgres): promote legacy rows first (provider already column-defaulted).
ALTER TABLE credentials DROP CONSTRAINT IF EXISTS credentials_pkey;
ALTER TABLE credentials ADD PRIMARY KEY (user_id, kind, provider);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_power_path TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_provider   TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_model      TEXT;

-- Opaque Grok subscription link metadata (no secrets on wire). Unused while grok.available=false.
CREATE TABLE IF NOT EXISTS grok_links (
    user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'unlinked', -- unlinked | linked | expired
    encrypted_material TEXT,
    updated_at         DOUBLE PRECISION NOT NULL
);
"#,
),
```

Adjust DDL if live `provider` column already exists (it does — keep ADD IF NOT EXISTS). Confirm
current PK name via `\d credentials` in lane notes if DROP CONSTRAINT name differs.

- [ ] **Step 3: Run** `npx nx test api` focusing migration unit test — pass. Commit.

**Reviewer probe:** PK is `(user_id, kind, provider)`; `openai_compatible` rows are allowed in DB
but never appear in the four-row trader matrix.

---

### B2 — Store: multi-slot credentials + preference fields + legacy migrate

**Files:** `apps/api/src/services/auth/store.rs`, `apps/api/src/db/pg_auth.rs`

- [ ] **Step 1: Failing tests** — `set_credential` for two providers on same user; both readable;
  delete one leaves the other; legacy `cred_key(user, "ai")` row promotes on first list/get.

- [ ] **Step 2: Change keying:**

```rust
fn cred_key(user_id: &str, kind: &str, provider: &str) -> String {
    format!("{user_id}::{kind}::{provider}")
}

fn legacy_cred_key(user_id: &str, kind: &str) -> String {
    format!("{user_id}::{kind}")
}
```

On `list_ai_credentials(user_id)` / first AI read:

1. If legacy `user::ai` exists and `user::ai::{provider}` does not, move record to
   `user::ai::{rec.provider}` (default `anthropic` if empty).
2. Drop legacy key.
3. **Preference backfill (S2):** if settings `ai_power_path` is null and the promoted slot is a
   trader provider (`anthropic|openai|xai|gemini`), set `ai_power_path=Some("own_key")`,
   `ai_provider=Some(provider)`. Do **not** invent a model here if catalogs are not loaded yet —
   B3/B4 D4 persist fills `ai_model`.
4. Skip promoting `openai_compatible` into the trader matrix (leave operator row if present; omit
   from `providers[]`).

- [ ] **Step 3: Extend** `SettingsRecord` / `SettingsPatch` / PG settings read-write with
  `ai_power_path: Option<String>`, `ai_provider: Option<String>`, `ai_model: Option<String>`
  (`#[serde(default)]` for JSON forward-migrate).

- [ ] **Step 4: Update** `AuthStore` enum dispatch signatures for provider-scoped get/set/delete +
  `list_credentials(user, kind)`.

- [ ] **Step 5: Tests green. Commit.**

**Reviewer probe:** existing single-row user becomes `own_key` + that provider without a re-paste.

---

### B3 — Closed model catalog + model switch rule + D4 persist helper

**Files:** create `apps/api/src/services/llm_catalog.rs`; wire from `mod` / recommendation / auth

- [ ] **Step 1: Failing tests** for catalog recommended defaults matching today's
  `LlmProvider::default_model` values (`claude-opus-4-8`, `gpt-4o`, `grok-3`,
  `gemini-2.0-flash`) and env override `AI_REC_MODEL_{PROVIDER}` / `AI_REC_MODEL` becoming the
  **recommended** catalog entry (visible), not a hidden resolve override.

- [ ] **Step 2: Implement:**

```rust
pub struct CatalogModel { pub id: String, pub recommended: bool }
pub struct ProviderCatalog { pub provider: &'static str, pub models: Vec<CatalogModel> }

pub fn byo_catalogs() -> Vec<ProviderCatalog> { /* anthropic, openai, xai, gemini */ }
pub fn grok_subscription_catalog() -> ProviderCatalog { /* provider: "xai", models from env/default */ }

pub fn recommended_id(catalog: &ProviderCatalog) -> Option<&str> { … }

pub fn preview_catalog_for_null_path(grok_available: bool) -> ProviderCatalog {
    if grok_available { return grok_subscription_catalog(); }
    for p in byo_catalogs() {
        if recommended_id(&p).is_some() { return p; }
    }
    byo_catalogs().into_iter().next().unwrap()
}

/// When power_path and/or provider changes to a new active catalog:
pub fn apply_model_switch(current: Option<&str>, new_catalog: &ProviderCatalog) -> Option<String> {
    if let Some(m) = current {
        if new_catalog.models.iter().any(|x| x.id == m) {
            return Some(m.to_string());
        }
    }
    recommended_id(new_catalog).map(|s| s.to_string())
}
```

- [ ] **Step 3: Unit tests** — keep-if-in-catalog; else write recommended; empty catalog → unset.
  Commit.

---

### B4 — `GET/PUT/DELETE /api/auth/ai-key` bootstrap

**Files:** `apps/api/src/routes/auth.rs`, `apps/api/src/services/auth/service.rs`

- [ ] **Step 1: Tighten `AiKeyBody`:**

```rust
#[derive(Debug, Deserialize)]
pub struct AiKeyBody {
    pub key: String,
    /// Required closed BYO provider — never inferred into the slot from key prefix.
    pub provider: String,
}
```

422 when missing / outside `{anthropic,openai,xai,gemini}`.

- [ ] **Step 2: DELETE** requires query `?provider=`; same closed set; 422 otherwise.

- [ ] **Step 3: Replace `ai_key_hint` with full bootstrap** matching INTERFACE endpoint 1:

  - `providers`: len 4, stable order, `{provider,set,last4}`
  - `grok.available` ← `grok_oauth::available()` (false in v1 ship)
  - `grok.connected` / `grok.unavailable_reason` from `grok_links` (default unlinked)
  - `preference.*` echoes settings
  - `catalog.providers` + `catalog.grok_subscription`
  - **D4:** if `preference.model` would be null and preview catalog has recommended → persist
    `ai_model` and return it; **do not** write `power_path` / `provider`

- [ ] **Step 4: PUT power gesture** on successful encrypt+store:

  - store under requested provider slot (ignore `detect_from_key` for slot identity)
  - set `ai_power_path=own_key`, `ai_provider=<provider>`, `apply_model_switch` for that BYO catalog
  - return full bootstrap

- [ ] **Step 5: DELETE** clears that slot; if it was the active `own_key` provider, clear
  `ai_power_path` / `ai_provider` (model may remain).

- [ ] **Step 6: Never-echo tests** — response JSON string must not contain the raw key.
  Commit.

---

### B5 — Settings AI preference fields

**Files:** `apps/api/src/services/auth/service.rs` (`SettingsWire`, settings PATCH),
`apps/api/src/routes/auth.rs` (settings body parse)

- [ ] **Step 1:** Add to `SettingsWire` + GET session settings echo:

```rust
pub ai_power_path: Option<String>,
pub ai_provider: Option<String>,
pub ai_model: Option<String>,
```

- [ ] **Step 2:** PATCH handling:

  - absent field → no change
  - `ai_model: null` JSON present → **422** validation ("clear forbidden")
  - when `ai_power_path` and/or `ai_provider` changes → `apply_model_switch`
  - `ai_provider` required when path is `own_key` (422 otherwise)
  - reject `pool_grok` / unknown path tokens (422)

- [ ] **Step 3: Tests** for forbid-clear, switch rule, echo agreement with GET ai-key
  `preference.*`. Commit.

---

### B6 — Rewrite `resolve_llm_key` (D5 + D7)

**Files:** `apps/api/src/services/recommendation.rs`, `apps/api/src/services/llm.rs`

- [ ] **Step 1: Failing characterization tests** documenting NEW order (and asserting
  `shared_admin` is unreachable).

- [ ] **Step 2: Implement INTERFACE resolve contract exactly:**

```text
1. Auth outermost (caller).
2. ai_power_path == null → key_source=none, unavailable_reason=no_key; DO NOT evaluate model.
3. Model gate (path set only):
   - no model + no recommended → model_unset
   - model ∉ active catalog → model_not_in_catalog (alias model_missing accepted on wire)
4. path == grok_subscription → subscription/OAuth reasons only; NEVER decrypt BYO; NEVER env XAI
5. path == own_key → decrypt selected provider slot:
   empty → no_key; decrypt fail → key_unusable; vendor auth reject at call → key_rejected
6. Never fall through onto server env keys as allowance
```

- [ ] **Step 3: Delete** admin email shared-env loop, anonymous `shared_admin` status probe arm,
  and `remaining_free_uses` product fields from envelopes (omit keys entirely).

- [ ] **Step 4: `ResolvedLlmKey`:**

```rust
pub key_source: &'static str, // own_key | grok_subscription | none
```

While grok arm unavailable, step 4 always yields `oauth_unlinked` /
`subscription_unavailable` only when path is already `grok_subscription` (e.g. stale preference);
never invent connected state.

- [ ] **Step 5: Tests green. Commit.**

**Reviewer probe:** with path `grok_subscription` and a BYO key present, resolve must not spend
BYO.

---

### B7 — Status + POST envelopes

**Files:** `apps/api/src/services/recommendation.rs`, `apps/api/src/routes/recommendation.rs`

- [ ] **Step 1: Extend `status_payload`** (signed-in) with:

```json
"powering": {
  "key_source": "...",
  "provider": null,
  "model": "...",
  "unavailable_reason": "...",
  "preference": { "power_path": null, "provider": null, "model": "..." }
}
```

Signed-out: `key_source=none`, preference nulls, `unavailable_reason` null — FE shows auth gate
only. **No** `remaining_free_uses` / `free_uses_total` keys.
`availability.in_app_enabled` true only for usable `own_key` | `grok_subscription`.

- [ ] **Step 2: POST envelope** always includes `key_source`, `provider`, `model`,
  `unavailable_reason` on produced **and** unavailable base shapes. Provenance copies resolved
  values used for `complete_strategy`. On vendor HTTP 401/403 from provider → map to
  `key_rejected` (not `llm_error`).

- [ ] **Step 3: Tests** for status shape + POST additive fields on fresh user (`no_key`).
  Commit.

---

### B8 — Score / tier / fingerprint byte-identity (AC-25)

**Files:** characterization test under `apps/api/src/…` (recommendation or routes test)

- [ ] **Step 1:** Capture bundle `signals.opportunity_score`, `signals.opportunity_tier`,
  `ai_eval.state_fingerprint` for a fixed fixture ticker **before** resolve changes matter
  (scoring path must not read preference/provider/model).

- [ ] **Step 2:** Assert identical values across simulated path preferences (own_key anthropic /
  openai / xai / gemini / grok_subscription blocked) — score modules untouched proof via empty
  diff on engine/signals **or** explicit fixture equality.

- [ ] **Step 3: Commit.**

---

### B9 — Grok OAuth stub (present-but-unavailable)

**Files:** create `apps/api/src/services/auth/grok_oauth.rs`;
`apps/api/src/routes/auth.rs`; `apps/api/src/routes/mod.rs`

- [ ] **Step 1: Stub module** mirroring Google's config-gate shape **without inventing xAI URLs:**

```rust
/// True only when verified docs + env creds exist. v1 ship: always false until §9 lane-check.
pub fn available() -> bool {
    // Intentionally false until primary xAI user-OAuth endpoints/scopes are verified in-lane.
    // Do not read invented env vars as a fake enablement.
    false
}
```

- [ ] **Step 2: Routes:**

  - `GET /api/auth/grok/start` — session required; if `!available()` → 409
    `{error:"grok_unavailable"}`; never 302 to a fabricated URL
  - `GET /api/auth/grok/callback` — if unavailable, redirect home with error query; no token persist
  - `DELETE /api/auth/grok` — session required; clears link row; if `ai_power_path` was
    `grok_subscription`, clear it; 200

- [ ] **Step 3: Bootstrap** always reports `grok.available=false`,
  `grok.connected=false`, `grok.unavailable_reason` null or `oauth_unlinked` consistently with
  INTERFACE (pick one and test it — prefer `oauth_unlinked` when never linked is distinguishable,
  else null when `available=false` and not connected; document in test name).

- [ ] **Step 4: Commit.** Gate record note: AC-9/10/14/15 blocked-on per AC-27.

---

### B10 — Backend suite green

- [ ] **Step 1:** `npx nx test api` — exit 0. Record pass count.
- [ ] **Step 2:** `cargo build -p api-rust` — exit 0.
- [ ] **Step 3:** Confirm no `shared_admin` string remains as a **usable** path in
  `recommendation.rs` / status / POST builders (`rg shared_admin apps/api/src` should only hit
  comments/tests that assert absence, if any).

---

## Frontend track

### F1 — `@convexa/api` wire types + client

**Files:** `libs/api/src/lib/convexa.ts`, `libs/api/src/lib/convexa.spec.ts`

- [ ] **Step 1: Replace `AiKeyStatus` with bootstrap type** matching INTERFACE (all keys required).

- [ ] **Step 2: Client updates:**

```ts
export async function getAiKeyStatus(): Promise<AiProvidersBootstrap> { … }

export async function setAiKey(key: string, provider: ByoProvider): Promise<AiProvidersBootstrap> {
  body: JSON.stringify({ key, provider })
}

export async function removeAiKey(provider: ByoProvider): Promise<AiProvidersBootstrap> {
  // DELETE /api/auth/ai-key?provider=
}

export type KeySource = 'own_key' | 'grok_subscription' | 'none';
// Remove shared_admin from the product union.
```

- [ ] **Step 3: Extend `UserSettings` / patch** with `ai_power_path`, `ai_provider`, `ai_model`.

- [ ] **Step 4: Extend `RecStatus`** with `powering` object; **omit** free-uses fields from the
  required product surface (optional legacy ignore OK).

- [ ] **Step 5: Extend `RecResponse`** with `provider?: string | null`, `model?: string | null`
  (keep `key_source`, `unavailable_reason`).

- [ ] **Step 6: Update `convexa.spec.ts`** for required provider on PUT/DELETE; never-echo.
  `npx nx test @convexa/dashboard` may still fail elsewhere — scoped vitest on libs if available,
  or proceed to F2. Commit types.

---

### F2 — Closed lookups + copy (no free / no pool)

**Files:** `apps/dashboard/src/app/features/auth/copy.ts`,
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts`, new
`apps/dashboard/src/app/features/auth/aiProviderLabels.ts` (pure)

- [ ] **Step 1: Pure lookup module:**

```ts
export const BYO_PROVIDER_LABEL: Record<ByoProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  xai: 'Grok',
  gemini: 'Gemini',
};

export function pathLabel(keySource: KeySource, provider?: string | null): string | null {
  if (keySource === 'grok_subscription') return 'your Grok subscription';
  if (keySource === 'own_key' && provider) return BYO_PROVIDER_LABEL[provider as ByoProvider] ?? null;
  return null;
}
```

- [ ] **Step 2: Copy rules** — Settings helper two sentences per SPEC §4; banned substrings tests:
  `free`, `Convexa Grok pool`, `cheaper`, `included` must not appear in new AI providers /
  Ask-AI powering strings.

- [ ] **Step 3: Reason → CTA copy** for `no_key`, `key_unusable`, `key_rejected`,
  `model_not_in_catalog`, `oauth_expired`, `oauth_unlinked`, `subscription_unavailable` per SPEC
  samples (honesty fixed; wording may match samples).

- [ ] **Step 4: Unit tests** for lookups + banned words. Commit.

---

### F3 — Settings AI providers panel chrome

**Files:** `AiKeySection.tsx` (redesign in place **or** `AiProvidersSection.tsx` + import swap),
`SettingsPage.tsx`

- [ ] **Step 1: Panel heading** → `AI providers`; keep `id="ai-key"` (and optional dual-id) for
  Ask-AI deep-link (AC-28).

- [ ] **Step 2: Layout order:** helper → **Grok subscription card** (preferred; present-but-
  unavailable info when `!grok.available` — **no Connect button**) → **Your API key** matrix →
  **Model for recommendations** select.

- [ ] **Step 3: Anonymous** → sign-in prompt only (reuse `SignInPrompt`).

- [ ] **Step 4: storage_available=false** → info alert (not error-red); inputs disabled (AC-18).

- [ ] **Step 5: Component/integration tests** for anonymous, unavailable arm, heading, `#ai-key`.
  Commit.

**Theme:** tokens only; warnings use `warning.*` + icon; no new motion family (AC-30).

---

### F4 — BYO matrix gestures (AC-1–4, AC-11, AC-20)

**Files:** same Settings section; `testBackend.ts`

- [ ] **Step 1: Expand `testBackend` ai-key mock** to INTERFACE bootstrap (4 providers, catalog,
  grok, preference). Capture PUT bodies including `provider`.

- [ ] **Step 2: Per-provider row UI** — empty add form (provider known by row) / set masked last-4
  + Replace + Remove + **Use this key**. Active indicator when
  `preference.power_path==='own_key' && preference.provider===row`.

- [ ] **Step 3: Saving a key OR Use this key** → PUT key or `saveSettings({ ai_power_path:
  'own_key', ai_provider })` as appropriate; clear draft on success; never retain raw key (AC-2).

- [ ] **Step 4: Tests** — add each of 4 providers isolation; replace; remove; Use-this-key writes
  path; no full secret in DOM or subsequent GET. Commit.

---

### F5 — Model control + preference write-through (AC-5–7, D6)

**Files:** Settings section; Ask-AI model select lands in F6 but share a small hook/helper

- [ ] **Step 1: Model `<Select>`** options from `catalog` only (active path catalog when
  `power_path` set; else preview catalog). No empty clear. Show recommended caption when id is
  recommended.

- [ ] **Step 2: On change** → `saveSettings({ ai_model })` (or equivalent); refresh bootstrap /
  settings so both surfaces agree.

- [ ] **Step 3: First-visit** — trust server D4 persist from GET ai-key; display returned model
  name even when unpowered (AC-7 / AC-13).

- [ ] **Step 4: Tests.** Commit.

---

### F6 — Ask-AI bootstrap, gates, model select (AC-12–17)

**Files:** `AiRecPanel.tsx`, `presentationPolicy.ts`, `ai-rec.risk.spec.tsx`

- [ ] **Step 1: Signed-in mount** also calls `getAiKeyStatus()` for catalog + preference (S2
  leftover #2). Status probe remains for gates/cap/powering; do not invent model ids.

- [ ] **Step 2: Auth outermost** — signed-out shows only sign-in; never no_key / oauth / model
  chrome (AC-12).

- [ ] **Step 3: Gate matrix** keyed on `powering.unavailable_reason` + `powering.key_source`:

  | reason | UI |
  |---|---|
  | `no_key` | setup block → Settings `#ai-key` (not model-missing) |
  | `key_unusable` / `key_rejected` | replace-key CTAs (distinct copy) |
  | `model_not_in_catalog` / `model_missing` | choose-another-model (only when path set) |
  | `oauth_*` / `subscription_unavailable` | distinct; offer BYO Use-this-key path |
  | usable | Analyze + model select bound to standing preference |

- [ ] **Step 4: Delete** free-uses / `shared_admin` / `over_limit`-as-free-allowance product CTAs
  that described admin free uses. Keep orthogonal daily `cap.over_limit` process gate **after**
  usable powering exists (AC-22).

- [ ] **Step 5: Manual export** remains reachable in every body state (AC-21/29).

- [ ] **Step 6: Risk/integration tests** for the matrix. Commit.

---

### F7 — Provenance chips (AC-8, AC-23–24)

**Files:** `DecisionCard.tsx`, specs

- [ ] **Step 1: Replace free-uses chip path** with:

  - `key_source === 'grok_subscription'` → chip **your Grok subscription**
  - `key_source === 'own_key'` → `Using your {label} key` when provider named, else `Using your key`
  - Model chip only when `model` named; omit if absent (never `default`)

- [ ] **Step 2: Assert** subscription label ≠ BYO `xai` "Grok"; never "Convexa Grok pool".

- [ ] **Step 3: Tests + update plan-scope fixtures** that used `shared_admin` only as a
  **negative** poison for unrelated predicates (keep poison; do not render free-uses UI).
  Commit.

---

### F8 — Purge free-uses / shared_admin product UI

**Files:** `DecisionCard.tsx`, `AiRecPanel.tsx`, `copy.ts`, `testBackend.ts`, risk specs

- [ ] **Step 1:** `rg "remaining_free_uses|free uses|shared_admin|out of free" apps/dashboard
  libs/api` — every **product** hit removed or confined to negative fixtures / comments.
- [ ] **Step 2: AC-19 tests** assert absence of free-uses copy on Settings + Ask-AI.
- [ ] **Step 3: Commit.**

---

### F9 — Frontend green + typecheck

- [ ] **Step 1:** `npx nx test @convexa/dashboard` — exit 0. Record counts.
- [ ] **Step 2:** `npx nx typecheck @convexa/dashboard` — exit 0 (**mandatory**).
- [ ] **Step 3:** Scoped format only if needed:
  `npx nx format:write --files=<touched list>` — never bare.
- [ ] **Step 4:** NUL byte scan on touched fixtures.

---

## Verification track

### V1 — Unit suites

```powershell
npx nx test api
# expect: exit 0

npx nx test @convexa/dashboard
# expect: exit 0

npx nx typecheck @convexa/dashboard
# expect: exit 0
```

### V2 — Banned product vocabulary scan

```powershell
rg -n "Convexa Grok pool|remaining_free_uses|free_uses_total|shared_admin" apps/api/src apps/dashboard/src libs/api/src
```

Expect: no product-path matches (tests asserting **absence**, or plan-scope negative poisons,
only). `pool_grok` must not appear on the wire builders.

### V3 — Interface conformance

```powershell
npm run ports:free
npx nx serve api
# separate shell:
node .grok/tools/interface_conformance.mjs `
  --contract .spire/clusters/tech/contracts/ai-providers/INTERFACE_CONTRACT.md `
  --url http://127.0.0.1:8000 --auth-signup `
  --report .spire/clusters/tech/contracts/ai-providers/conformance-receipt.json
```

Expect: exit 0; receipt written.

### V4 — Score byte-identity (AC-25)

Re-run B8 characterization / compare ticker bundle score/tier/fingerprint across preference
permutations. Expect identical values; `$LASTEXITCODE -eq 0`.

### V5 — Migration smoke (existing BYO user)

Manual or automated: seed legacy single `kind=ai` credential → boot → GET ai-key shows that
provider `set:true`, `preference.power_path==="own_key"`, Ask status not AC-13 setup solely due to
null path. Expect powered (or model-gate only), not `no_key` from missing path.

### V6 — Grok arm honesty (AC-27)

Settings shows present-but-unavailable; no Connect CTA; `GET /api/auth/grok/start` as signed-in
user → 409; copy has no "Convexa Grok pool" / "free" / "cheaper" / "included". Gate record lists
AC-9/10/14/15 blocked-on until §9.

### V7 — Review ACs

Walk SPEC §3 rows marked `review`: AC-9 (ordering/copy — unavailable arm), AC-22, AC-23, AC-24,
AC-27, AC-30. Record pass/fail in QA_REPORT later; this verification step is the conductor
checklist.

---

## Per-AC → task map (ship-blocking emphasis)

| AC | Track tasks | Verify |
|---|---|---|
| 1–4 BYO matrix | B2 B4 / F4 | test |
| 2 never-echo | B4 / F4 F1 | test |
| 5 named path+model | B3 B5 B7 / F5 F6 | test |
| 6 write-through | B5 / F5 F6 | test |
| 7 D4 preselect | B3 B4 / F5 F6 | test |
| 8 provenance | B7 / F7 | test |
| 9–10,14–15 OAuth | B9 / F3 F6 | blocked-on + review |
| 11 Use-this-key | B4 B5 / F4 | test |
| 12 auth outermost | F6 | test |
| 13 setup block | B6 / F6 | test |
| 16 key_unusable/rejected | B6 B7 / F6 | test |
| 17 model not in catalog | B6 / F6 | test |
| 18 storage unavailable | B4 / F3 | test |
| 19 no free uses | B6 B7 / F8 | test |
| 20 provider switch | B3 B5 / F4 F5 | test |
| 21/29 export floor | F6 | test |
| 25 score identity | B8 / V4 | test |
| 27 OAuth honesty | B9 / V6 | review |
| 28 deep-link | F3 | test |
| 30 theme/motion | F3 | review |

---

## Planning choices a reviewer should know

1. **Grok Connect is not invented** — stub + present-but-unavailable is the shippable v1 arm;
   AC-9/10/14/15 stay open/blocked-on (AC-27).
2. **Legacy BYO backfill writes `power_path=own_key`** on promote (S2 Important #1) so current
   key users are not bricked; this is an explicit migration gesture, not a silent resolve
   fallthrough.
3. **Ask-AI reads GET `/api/auth/ai-key`** for catalog (S2 Important #2); status stays
   side-effect-free.
4. **Unpowered reason is always `no_key`** on the wire when `power_path` is null (INTERFACE over
   SPEC prose that also mentioned subscription-unavailable for Situation A/D).
5. **Connected+inactive → "Use this subscription"** PUTs `ai_power_path=grok_subscription`
   (return gesture); moot while `grok.available=false`.
