# R1 — architect position: ai-providers

## Position

### Verified live baseline (cited-code-is-verified-not-assumed)

Read at source before claiming:

- `apps/api/src/services/llm.rs` — `LlmProvider` already enumerates `anthropic | openai | xai | gemini | openai_compatible`; `detect_from_key` prefixes (`sk-ant-`, `sk-`, `xai-`, `AIza`, `sk-or-`); `default_model` / `default_base_url`; `complete_strategy` dispatches Anthropic Messages vs OpenAI-compatible Chat Completions (incl. xAI) vs Gemini `generateContent`.
- `apps/api/src/routes/auth.rs` — `AiKeyBody { key, provider: Option<String> }` already accepts optional provider; PUT validates non-empty key then encrypts via auth service.
- `apps/api/src/services/auth/store.rs` + `db/migrations.rs` — `CredentialRecord.provider` column exists; PK is `(user_id, kind)` with `kind = "ai"` ⇒ **one stored BYO credential per user** (replace overwrites).
- `apps/api/src/services/recommendation.rs` — `resolve_llm_key` order is own encrypted key → admin shared env keys → `none`; **model is env-default only** (`AI_REC_MODEL_{PROVIDER}` / `AI_REC_MODEL` / `LlmProvider::default_model`). Rec envelope today carries `key_source`, **not** the provider/model that ran.
- `apps/api/src/services/auth/google_oauth.rs` — Google Authorization-Code flow is **account login**, config-gated off when creds absent; it is not an LLM spend path.
- `apps/dashboard/src/app/features/auth/AiKeySection.tsx` + `copy.ts` — Settings UI is **Anthropic-only** (`sk-ant-…` copy, soft format warn, `setAiKey(key)` with no provider). `@convexa/api` `AiKeyStatus` type omits `provider` even though the server hint already returns it.

Do not cite Python `ai_recommendation.py` as live. PROJECT_CONTEXT §2 still describes the Python-era leaf; the live leaf is the Rust paths above.

### Technical shape

**1. Power-path vocabulary (closed; absent-is-not-none)**

A rec is powered by exactly one resolved **power path**, enforced as a closed server enum on the resolution result (not prose):

| Path | Mechanism |
| --- | --- |
| `own_key` | Decrypt stored BYO ciphertext → call that provider with that material. |
| `pool_grok` | Call xAI using **Convexa's server-side pool key** (env), never a browser secret; meter the user against the pool. |
| `shared_admin` | Existing admin shared-key allowance (`AUTH_ADMIN_EMAILS` + shared env keys). Keep this **named distinctly** from `pool_grok` so the cheaper Grok pool is never confused with the Anthropic admin free-tier. |
| `none` | No usable material; carry a **closed unavailable reason** (see isolation). |

Resolution works by a single function (evolve today's `resolve_llm_key`) that returns a `ResolvedLlmKey`-shaped value including `key_source`, `provider`, `model`, and usable material-or-reason. Prefer **complexity + team familiarity**: extend the existing resolver rather than a second parallel key system.

**Proposed order (attackable):** when the user is pool-entitled and has not explicitly overridden to BYO for this request, prefer `pool_grok` over `own_key`; else `own_key`; else `shared_admin`; else `none`. Dominating axis: BRIEF "preferentially … Convexa's Grok sub-pool". If PM/UX make path an explicit always-visible choice, the resolver still enforces server-side which sources are actually usable.

**2. BYO multi-provider (shippable half)**

- Keep **one active BYO credential** (`kind = "ai"`). Switching vendor = replace. Dominating axes: complexity + cost (no PK/migration to multi-slot; current encrypt/store/hint path stays).
- Provider on write: client sends an explicit closed provider label **or** server falls back to `LlmProvider::detect_from_key` (already implemented). UI must not be the sole classifier (`digested-labels-not-raw-dump` — labels come from the closed server vocabulary / stored provider, not from FE re-parsing the key string for display).
- Encrypt-at-rest floor unchanged: Fernet before store; ciphertext + last4 + provider only; write-only; never echo; decrypt failure ⇒ treat as no usable secret (`secret-encrypted-at-rest`).
- `openai_compatible` stays a **backend capability** for operators; v1 trader BYO surface is the four named vendors (Anthropic / OpenAI / Gemini / Grok-xAI). Non-goal to expose arbitrary base URLs in Settings unless a later brief says so.

**3. User-chosen model (mandatory on every powered path)**

Mechanism:

- Server owns a **closed model catalog** per `LlmProvider` (allowlist of model ids the leaf will call). Env defaults (`AI_REC_MODEL_*` / `default_model`) become the **catalog's recommended default**, not a hidden override the trader cannot see.
- Persist the trader's selection as a **per-user preference** (settings record or credential-adjacent field — synthesizer owns wire shape). On resolve: if preference ∈ catalog for the active provider → use it; else fall back to catalog default **and surface that effective model** on status/rec provenance so it is never invisible.
- Ask-AI / status reads must expose the **effective** provider + model before a call (so two traders, or one trader on two days, can tell what will run). After a produced rec, provenance names the provider + model that **actually** ran — copied from the resolved values used for `complete_strategy`, not re-inferred.

Provider and model are **never scoring inputs** (`additive-keeps-score-byte-identical`); module boundary stays recommendation/auth leaf only.

**4. Grok OAuth + Convexa sub-pool (architect-owned; split into shippable vs blocked-on)**

Two different products; only the first is in scope:

- **In scope:** "Log in with Grok to spend **Convexa's** cheaper pool."
- **Out of scope / non-goal:** SuperGrok-subscription OAuth that spends the user's xAI subscription instead of a key.

**Buildable pool spend (not blocked):**

- Operator configures a server-only pool secret (dedicated env such as a pool-scoped xAI key, or a clearly metered use of `XAI_API_KEY` — ops naming is interface/ops, not this lane).
- New `key_source = pool_grok` branch calls `LlmProvider::Xai` via existing OpenAI-compatible client at `api.x.ai`, with `metering_identity` = the Convexa user id (or a pool meter key derived from it).
- Entitlement gate (closed): pool configured ∧ user pool-linked/opted-in ∧ pool meter not exhausted. Failures map to distinct reasons (`pool_unavailable` | `pool_exhausted` | …), never collapse into plain `no_key`.
- Pool key never reaches the browser; never logged (`secret-encrypted-at-rest` / no-secrets-in-image for deploy artifacts — pool secret is runtime env only).

**OAuth identity arm — mechanism named, verification blocked-on:**

- Intended how: mirror `google_oauth.rs` — Convexa-owned OAuth client, Authorization-Code, config-gated `available() == false` when client id/secret/redirect absent, anti-CSRF state, server-side code exchange. Persist only an **opaque identity link** (provider subject + linked_at), **not** a spendable user API key and **not** a SuperGrok billing token. Linking satisfies the pool entitlement predicate; spend still uses Convexa's pool key.
- **Blocked-on:** I have **not** verified from primary xAI docs in this round that xAI ships a user-OAuth product suitable for this identity-link use. Until the owner or a lane-check cites live xAI OAuth endpoints + scopes, do **not** invent protocol URLs, token shapes, or "Sign in with Grok" as if shipped fact. Ship BYO + model choice + `pool_grok` behind an entitlement flag the OAuth link later sets; keep the OAuth module stubbed/config-gated like Google until verified.

**5. Component boundaries**

| Component | Owns | Must not |
| --- | --- | --- |
| Auth credential + crypto leaf | Encrypt/store/delete BYO; hint (`set`/`last4`/`provider`/`storage_available`); optional OAuth-link record | Call LLM; touch signals/score |
| Recommendation leaf (`recommendation.rs` + `llm.rs`) | Resolve power path; apply chosen model; call provider; attach provenance; best-effort rec envelope | Import engine/signals as writers; return raw keys |
| Settings / Ask-AI FE | Collect closed provider + model + path choice; write-only key; render server labels via lookup | Infer provider from key for display; enforce gates alone; invent model ids |
| Bundle / SSE / scoring | Untouched | Know about keys, pool, or models |

**6. Isolation / error rules**

- Ask-AI and all key/OAuth/preference writes stay **server-gated** (`server-side-gate-enforcement`); FE checks are UX only.
- Key / OAuth / pool / LLM failure degrades the **rec surface alone** (`best-effort-isolated-or-null` for the advisory leaf): always-shaped rec/status outcome with closed reason; bundle/SSE/score untouched.
- Auth-class failures on credential writes keep real HTTP statuses (existing carve-out); storage fault ⇒ `storage_available: false` shape already used by BYO, not a 5xx leak path.
- Closed unavailable reasons must not collapse (`absent-is-not-none`): at minimum distinguish `no_key` · `shared_key_unconfigured` · `pool_unavailable` · `pool_exhausted` · `oauth_unlinked` / `oauth_expired` (if OAuth ships) · `storage_unavailable` · LLM call faults (`timeout` / `llm_error` / etc. already used by `complete_strategy`).
- Provenance may name provider/model; it must not invent a check the rec did not run (`ai-asserted-numbers-are-traceable`).
- `no-real-order-path` unchanged — Accept/Act stay paper-sim.

**7. Explicit non-goals**

- SuperGrok (or any vendor) **subscription passthrough** / spending the user's vendor plan via OAuth.
- Inventing an unverified xAI OAuth protocol as shipped fact.
- Storing multiple concurrent BYO keys (multi-slot credential matrix) in v1.
- Exposing arbitrary OpenAI-compatible base URLs in trader Settings.
- Provider/model as scoring, tier, or fingerprint inputs.
- Any real broker/order path.
- Redesigning Google account OAuth (reuse pattern only).
- UI copy, layout, endpoint product naming, or AC rows (other lanes / R4).

### Binding constraints restated (this lane)

- `secret-encrypted-at-rest` — recoverable BYO secrets encrypted before store; ciphertext only; never logged/returned/browsed; pool/OAuth client secrets runtime-env only.
- `server-side-gate-enforcement` — Ask-AI + credential/OAuth/preference writes enforced server-side.
- `additive-keeps-score-byte-identical` — provider/model/path are non-inputs to signals/score/tier/fingerprint; recommendation remains a one-way leaf.
- `best-effort-isolated-or-null` — power-path / LLM faults degrade rec only.
- `no-real-order-path` — unchanged.
- `digested-labels-not-raw-dump` — provider/model are closed labels from server vocabulary; FE renders via lookup, does not re-derive from key string.
- `absent-is-not-none` — no key vs pool unavailable vs OAuth expired vs BYO set stay distinct in type/vocab through to the consumer.
- `cited-code-is-verified-not-assumed` — live Rust/TS citations above; Python leaf not live.
- `ai-asserted-numbers-are-traceable` — provenance names what ran; does not fabricate checks.
- `theme-token-discipline` / `single-motion-moment` — FE execution concern; architecture adds no new motion family and no hex.

## Risks I see

1. **OAuth arm blocked-on verification** — shipping "Sign in with Grok" UI without a verified xAI identity API creates a fake affordance; keep config-gated unavailable until docs/owner confirm.
2. **Collapsing `shared_admin` into `pool_grok`** — would mis-meter and mis-explain cost; keep separate sources and copy/status vocab.
3. **Hidden model default** — if preference is optional but status omits the effective model, the BRIEF's "always choose / never hidden" fails even when `default_model` works.
4. **FE still Anthropic-shaped** while BE is multi-provider — a half-ship leaves `detect_from_key` as the only classifier and keeps traders unable to pick models.
5. **Pool cost blow-ups** — without a hard server meter on `pool_grok`, Convexa's cheaper pool becomes an unbounded shared bill; meter must be server-authoritative like today's caps.
6. **PROJECT_CONTEXT Python-era drift** — citing archived Python paths would violate `cited-code-is-verified-not-assumed`; this feature must not treat §2 AI leaf prose as ground truth.

## Assumptions I'm making about the other two lanes

- **PM** will treat "one active BYO key (replace to switch vendor)" as acceptable v1 scope rather than requiring four concurrently stored keys; if false, the credential PK and hint shape must expand before build.
- **PM** will accept `shared_admin` remaining a separate power path from `pool_grok` (rename/clarify in product language only), and will not require SuperGrok subscription passthrough.
- **PM** will allow the Grok OAuth **identity** arm to ship config-gated / blocked-on verified xAI OAuth docs while BYO + model choice + pool spend behind an entitlement flag proceed.
- **PM** will require Ask-AI/status to expose effective provider + model **before** a rec request as acceptance-level behavior, not only post-hoc provenance.
- **UX** will redesign Settings + Ask-AI around **closed provider and model pickers** fed by server vocabulary, and will stop presenting Anthropic-only `sk-ant-…` as the sole path.
- **UX** will not ask the UI to infer provider from the key string for labels; display binds to server `provider` / catalog model ids (`digested-labels-not-raw-dump`).
- **UX** will keep write-only key entry (masked last4, replace/remove, no reveal) and will distinguish no-key / pool-unavailable / OAuth-expired / BYO-set as separate states rather than one empty Settings panel.
- **UX** will present Grok-pool as the preferential path when available without implying the trader's personal SuperGrok subscription is being billed.
- **Neither lane** will invent endpoint paths, JSON field names, or AC rows in a way that forces scoring-path edits — interface ownership stays with R4 synthesizer after critique.
