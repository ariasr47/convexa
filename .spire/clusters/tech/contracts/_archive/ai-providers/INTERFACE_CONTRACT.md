# ai-providers — interface contract

**Spec:** `.spire/clusters/tech/contracts/ai-providers/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`, Axum/Tokio)
**Frontend:** `apps/dashboard` — `features/auth/` (Settings AI providers) + `pages/ticker/widgets/ai-rec/`
**Status:** locked — APPROVED 2026-08-17 (D7: user Grok subscription)

This feature **adds and extends backend surface**. It is **not** `NO_BACKEND_CHANGE`.

This file is the single FE↔BE truth. Token spellings, nullability, and closed vocabularies below are
authoritative here and are **not** restated in `SPEC.md`. Human-facing copy lives in `SPEC.md` §4.

---

## Standing rules

1. **Closed vocabularies are authoritative on the wire.** The frontend renders provider, power path,
   model ids, and unavailable reasons by **closed lookup**. It never re-derives a provider label from
   a pasted key string and never invents model ids (`digested-labels-not-raw-dump`).
2. **Secrets never cross back to the browser.** Credential reads return at most set / last4 /
   provider / storage flags. Raw keys, ciphertext, OAuth tokens, and any subscription credentials
   are never in any response (`secret-encrypted-at-rest`).
3. **Ask-AI and credential / preference / OAuth writes are server-gated.** A bypassed client check
   still cannot spend subscription or BYO material (`server-side-gate-enforcement`).
4. **Power-path / LLM faults degrade the rec surface alone** — always-shaped HTTP 200 rec/status
   outcomes with closed reasons; bundle / SSE / score untouched (`best-effort-isolated-or-null`).
   Auth-class failures on credential writes keep real HTTP statuses (existing carve-out).
5. **Provider and model are never scoring inputs.** `opportunity_score` / `opportunity_tier` /
   `state_fingerprint` stay byte-identical across paths (`additive-keeps-score-byte-identical`).
6. **Deleted powering path.** `shared_admin`, `remaining_free_uses`, and `free_uses_total` are
   removed from product resolution and must not reappear as a usable Ask-AI allowance. Rec/status
   envelopes after this feature do **not** require or advertise free-use counters. A Convexa env
   `XAI_API_KEY` is **not** a product power path (D5 + D7).
7. **Provenance names what ran.** `key_source` / `provider` / `model` on a produced rec are copied
   from the resolved values used for `complete_strategy`. Absent ⇒ omit chips; never invent
   "default" (`ai-asserted-numbers-are-traceable`).
8. **Single preference writer.** Settings fields `ai_power_path` / `ai_provider` / `ai_model` are
   authoritative. `GET /api/auth/ai-key` → `preference.*` and status → `powering.preference.*` are
   echoes of those three values (SPEC D6).
9. **`grok_subscription` means the user's own Grok / SuperGrok subscription** via OAuth (D7). It is
   **not** a Convexa-billed pool and must never be labeled "Convexa Grok pool."

---

## Closed wire vocabularies

| Token | Members |
| --- | --- |
| Trader BYO `provider` | `anthropic` · `openai` · `xai` · `gemini` |
| `power_path` / preference path | `own_key` · `grok_subscription` · **null** (before any power gesture) |
| Rec / status `key_source` | `own_key` · `grok_subscription` · `none` |
| Powering `unavailable_reason` (additive to existing LLM/gate reasons) | `no_key` · `subscription_unavailable` · `oauth_unlinked` · `oauth_expired` · `storage_unavailable` · `model_not_in_catalog` · `model_missing` · `model_unset` · `key_unusable` · `key_rejected` |
| Display labels (FE closed lookup only) | BYO `anthropic`→Anthropic · `openai`→OpenAI · `xai`→Grok · `gemini`→Gemini · **`key_source=grok_subscription`→your Grok subscription** (never the BYO "Grok" label; never "Convexa Grok pool") |

`openai_compatible` remains a backend capability only — **not** a trader BYO slot and **not** a
Settings provider option.

**No vouched cost / remaining-count fields in v1.** Do not invent Convexa meters, `pool_exhausted`,
or remaining-allowance numbers. UI must not assert "cheaper" / "included" / free (SPEC §4).

**Retired tokens (must not appear as product vocabulary):** `pool_grok`, `pool_exhausted`,
"Convexa Grok pool", `shared_admin` as a usable path.

---

## Endpoints

### 1. `GET /api/auth/ai-key` — EXISTING, **expanded** · session required

Settings bootstrap read for the AI providers panel. Returns the per-provider BYO matrix, Grok
subscription OAuth advertisement, standing preference echo, and closed model catalog. **Never**
returns secrets.

**First-visit model persist (D4 lock):** if `preference.model` would otherwise be null and the
preview catalog exposes a recommended default, this read **persists** that model id into settings
`ai_model` and returns it as selected. It does **not** write `power_path` or `provider`. Preview
catalog when `power_path` is null: subscription catalog if `grok.available`, else the first BYO
catalog in order `anthropic`, `openai`, `xai`, `gemini` that has a recommended model.

**Response (200)** — all keys always present:

| Path | Type | Notes |
| --- | --- | --- |
| `storage_available` | boolean | `false` ⇒ Settings storage-unavailable (inputs disabled); still 200 |
| `providers` | array (len 4) | Exactly one row per trader BYO provider, stable order `anthropic`, `openai`, `xai`, `gemini` |
| `providers[].provider` | enum | Closed BYO provider id |
| `providers[].set` | boolean | Ciphertext present for that slot |
| `providers[].last4` | string\|null | Non-null **iff** `set === true` |
| `grok.available` | boolean | Deployment advertises Grok **subscription** OAuth arm as usable (verified + configured) |
| `grok.connected` | boolean | This user has a usable opaque Grok identity / subscription link |
| `grok.unavailable_reason` | enum\|null | When not usable: `subscription_unavailable` · `oauth_unlinked` · `oauth_expired` · null when connected+available |
| `preference.power_path` | enum\|null | Echo of `ai_power_path`; null until a power gesture |
| `preference.provider` | enum\|null | Echo of `ai_provider` |
| `preference.model` | string\|null | Echo of `ai_model`; after first-visit persist, non-null whenever a recommended default existed |
| `catalog.providers` | array | Per BYO provider model allowlist |
| `catalog.providers[].provider` | enum | Closed BYO provider id |
| `catalog.providers[].models` | array | May be empty (honest empty — FE must not invent ids) |
| `catalog.providers[].models[].id` | string | Exact model id the leaf will call |
| `catalog.providers[].models[].recommended` | boolean | At most one `true` per provider list |
| `catalog.grok_subscription.provider` | string | Always `xai` when subscription catalog is advertised |
| `catalog.grok_subscription.models` | array | Subscription allowlist; same `{id, recommended}` shape |

**Errors:** 403 `auth_required` (anonymous → Settings sign-in prompt).

**Migration note:** live store today is one `(user_id, kind="ai")` row. This feature expands identity
to `(user_id, kind="ai", provider)` and promotes the existing row into its stored provider slot
(`anthropic` if absent). An `openai_compatible` ciphertext does not appear in the four-row matrix.

---

### 2. `PUT /api/auth/ai-key` — EXISTING, **tightened** · session required

Store or replace the BYO ciphertext for **one** provider slot.

**Request body:**

| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | Raw secret; write-only; never echoed |
| `provider` | enum | **Required** closed BYO provider (`anthropic`\|`openai`\|`xai`\|`gemini`) |

Server stores under the requested `provider` slot and **must not** reassign the slot from
`detect_from_key`. BYO `xai` is a personal console API key — not the subscription path.

**Power gesture:** a successful save also writes `ai_power_path = own_key`, `ai_provider = <provider>`,
and applies the **model switch rule** (below).

**Response (200):** same shape as `GET /api/auth/ai-key` (full bootstrap), reflecting the updated
slot + preference. On storage fault: `storage_available: false` — still 200, never 5xx leak.

**Errors:** 403 `auth_required`; 422 `validation` (empty / too-short key, or provider missing /
outside closed set).

---

### 3. `DELETE /api/auth/ai-key` — EXISTING, **scoped** · session required

Remove one provider slot. Idempotent.

**Request:** query `provider` (required) — same closed BYO enum. Empty body.

**Response (200):** same full bootstrap shape as GET; that provider's `set:false`, `last4:null`.

If the deleted slot was the active `own_key` provider, clear `ai_power_path` / `ai_provider` (model
may remain as the last selected id for D4 display until the next power gesture / switch rule).

**Errors:** 403 `auth_required`; 422 `validation` when `provider` missing / invalid.

---

### 4. `PUT /api/auth/settings` — EXISTING, **extended** · session required

Standing AI preference rides the existing settings write (server-wins). **Single writer** for the
three AI fields.

**Additive request fields** (absent = no change):

| Field | Type | Notes |
| --- | --- | --- |
| `ai_power_path` | `own_key`\|`grok_subscription` | Set only via documented power gestures; clients may also write after Use-this-key / Connect |
| `ai_provider` | BYO enum | Required when path is `own_key` |
| `ai_model` | string | Catalog model id. **`null` is forbidden (422)** — omit the field to leave unchanged; send a catalog id to change. No clear-without-replacement in v1 |

**Model switch rule** (server, when `ai_power_path` and/or `ai_provider` changes to a new active
catalog):

1. If current `ai_model` ∈ the new catalog → keep it.
2. Else if the new catalog has a recommended default → persist that id as `ai_model` (D4-class
   preselect on the new path — visible, named).
3. Else → `ai_model` stays unset and Ask blocks with `model_unset` once path is set.

**Response (200):** existing settings wire **plus**:

| Path | Type |
| --- | --- |
| `ai_power_path` | string\|null |
| `ai_provider` | string\|null |
| `ai_model` | string\|null |

`GET /api/auth/settings` and `GET /api/auth/session` identity `settings` echo the same three fields.

Ask-AI model changes use this same write (or an equivalent authenticated preference write that
mutates the same three fields) — **one** persisted preference (SPEC D6). No one-shot override field
in v1.

---

### 5. Grok subscription OAuth (NEW, config-gated) · mirrors Google pattern

| Method · path | Purpose | Auth | Notes |
| --- | --- | --- | --- |
| `GET /api/auth/grok/start` | Begin Authorization-Code | **session required** | 302 to provider when `grok.available`; else 409 `grok_unavailable` (or equivalent closed code). Not Convexa account login. No invented protocol URLs — build fills from verified docs or leaves arm blocked-on |
| `GET /api/auth/grok/callback` | Code exchange → opaque subscription link | browser redirect | Persists only what verified docs require to spend on **the user's** subscription; redirects to app. **Power gesture:** on success writes `ai_power_path = grok_subscription`, clears `ai_provider`, applies model switch rule for subscription catalog. Never returns raw secrets to the browser. **Not** a Convexa pool key |
| `DELETE /api/auth/grok` | Disconnect / unlink | session required | Clears link → `grok.connected=false`, `grok.unavailable_reason=oauth_unlinked`. If `ai_power_path` was `grok_subscription`, clear it. 200 |

Until primary xAI subscription-OAuth verification lands, `grok.available` stays `false` and start must
not advertise a completable Connect CTA (SPEC AC-27).

---

### 6. `GET /api/recommendation/status/{ticker}` — EXISTING, **extended** · anonymous-ok

Side-effect-free powering probe for Ask-AI chrome. Always 200 when the bundle read succeeds.

**Signed-out shape:** when no session, `powering.key_source` is `none`, `powering.unavailable_reason`
is null (or omitted-as-null), and preference fields are null — FE must still show only the auth gate
(AC-12) and must not render `no_key` / subscription / model chrome from this probe.

**Additive / changed response fields (signed-in):**

| Path | Type | Notes |
| --- | --- | --- |
| `powering.key_source` | enum | `own_key`\|`grok_subscription`\|`none` — what would resolve **now** |
| `powering.provider` | string\|null | BYO provider that would run; null for subscription / none |
| `powering.model` | string\|null | Selected catalog model (may be D4-persisted even when `power_path` null) |
| `powering.unavailable_reason` | string\|null | Closed reason when unusable; setup-block uses `no_key` when `power_path` null — **not** `model_missing` |
| `powering.preference` | object | Echo of standing preference (`power_path`, `provider`, `model`) |
| `availability.in_app_enabled` | boolean | True only when a usable `own_key` or `grok_subscription` path exists (not via deleted free allowance / Convexa shared key) |

**Removed from product surface:** `remaining_free_uses`, `free_uses_total` (omit; do not advertise).

Existing `gate` / `cap` / `scenarios` remain. Cooldown / daily-cap are orthogonal and must not replace
powering-failure reasons or invent a Grok subscription meter.

---

### 7. `POST /api/recommendation/{ticker}` — EXISTING, **extended** · session required (auth outermost)

No new secret fields on the request. Resolution uses standing preference + per-provider credentials +
Grok subscription entitlement.

**Request body (unchanged required core):**

| Field | Type | Notes |
| --- | --- | --- |
| `snapshot_fingerprint` | string | Bundle pin |
| `persona_id` | string\|null | Optional |
| `dte_min` / `dte_max` | number\|null | Optional |
| `dark_pool` | boolean | Optional (default true) |
| `override` | boolean | Optional fresh-edge override |
| `scenario_id` | string\|null | Optional |
| `open_positions` | object\|null | Optional digest |

**Additive / changed response fields** (on every `base`-built envelope — produced **and**
unavailable):

| Path | Type | Notes |
| --- | --- | --- |
| `key_source` | enum | `own_key`\|`grok_subscription`\|`none` — **not** `shared_admin`, **not** a Convexa pool token |
| `provider` | string\|null | BYO provider that ran / would run; null for subscription path or none |
| `model` | string\|null | Model that ran / was selected; null only when truly unknown |
| `unavailable_reason` | string\|null | Closed powering / model / key reasons when blocked |

FE provenance lookup:

- if `key_source === "grok_subscription"` → render **your Grok subscription**
- else look up `provider` for BYO labels (`xai` → Grok for personal API key)

These two must never collapse.

**Resolve contract (server) — fixed order, first match wins:**

1. **Auth outermost** (unsigned → 403/503; never a powering reason).
2. **No power path:** if `ai_power_path` is null → `key_source=none` + `unavailable_reason=no_key`
   (setup block). **Do not** evaluate model validity. **No LLM call.**
3. **Model gate (only when `ai_power_path` is set):**
   - If no selected model and no recommended default to treat as selected → `model_unset`; no LLM.
   - If selected model ∉ active catalog for that path → `model_not_in_catalog` (alias
     `model_missing`); no LLM; **no** silent substitute.
4. **`ai_power_path = grok_subscription`:** if user OAuth link entitles subscription spend and the
   call can proceed → `grok_subscription` with selected subscription-catalog model. Else → `none`
   with the matching **subscription / OAuth** reason (`subscription_unavailable` \|
   `oauth_expired` \| `oauth_unlinked`). **Never** decrypt or spend a BYO key on this branch.
   **Never** fall through onto a Convexa env `XAI_API_KEY` as a shared pool.
5. **`ai_power_path = own_key`:** if selected provider slot decrypts → `own_key`. If slot empty →
   `no_key`. If decrypt fails → `key_unusable`. If vendor auth-rejects at call time → `key_rejected`
   (distinct from post-auth `llm_error` / `timeout`).
6. **Never** fall through onto server env keys as a free / admin / shared-pool allowance.

**Removed:** `remaining_free_uses`, `free_uses_total`, any produced path with `key_source =
"shared_admin"`, and any Convexa-pool product framing.

---

### 8. `GET /api/recommendation/export/{ticker}` — UNCHANGED egress floor

Anonymous-ok; no LLM; no key / OAuth / subscription material. Existing export shape + egress note.
Manual export remains usable in every blocked powering state.

---

### 9. Untouched

Bundle (`GET /api/ticker/{ticker}`), SSE live stream, score / tier / fingerprint computation, Google
OAuth account login, and sim-trade gate are unchanged. Provider/model/path never enter them.

---

## State → wire mapping (observable)

| Situation | `key_source` | `unavailable_reason` (typical) | Produces rec |
| --- | --- | --- | --- |
| Signed-out Ask-AI | (auth gate on POST; status probe nullish powering) | — | No |
| `power_path` null (no power gesture yet); model may be D4-persisted | `none` | `no_key` | No |
| `power_path=own_key`, no ciphertext in that slot | `none` | `no_key` | No |
| `power_path=own_key`, decrypt fail | `none` | `key_unusable` | No |
| `power_path=grok_subscription`, OAuth expired | `none` | `oauth_expired` | No |
| `power_path=grok_subscription`, unlinked | `none` | `oauth_unlinked` | No |
| `power_path=grok_subscription`, subscription cannot spend (vouched) | `none` | `subscription_unavailable` | No |
| `power_path` set, saved model ∉ catalog | `none` | `model_not_in_catalog` | No |
| BYO vendor auth reject at ask | `none` | `key_rejected` | No |
| Storage unavailable on write | (GET shows `storage_available:false`) | — | n/a |
| `power_path=own_key` + usable slot + model ∈ catalog | `own_key` | null | Yes |
| `power_path=grok_subscription` + entitled + model ∈ catalog | `grok_subscription` | null | Yes |

---

## Conformance spec

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

**What this block pins:** authenticated AI-key bootstrap (matrix + `grok.*` subscription OAuth
advertisement + preference + catalog), settings preference echo, recommendation status powering
fields without free-use counters, **POST `/api/recommendation/{ticker}` provenance/powering
fields** (`key_source` / `provider` / `model` / `unavailable_reason`) on the always-shaped envelope
(fresh signup ⇒ typically unavailable/`no_key` — still type-checks the additive fields), and the
untouched score/tier/fingerprint paths on the ticker bundle.

**What remains test-owned (env-dependent):** PUT/DELETE mutations, Connect/Use-this-path preference
writes, produced happy-path LLM calls, OAuth start/callback against a live xAI subscription app,
decrypt vs vendor-reject branches, and vouched `subscription_unavailable` — covered by SPEC §7
automated suites, not by inventing secret-bearing or vendor-live conformance probes.
