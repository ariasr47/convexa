# ai-providers — spec

**Source brief:** .spire/clusters/tech/contracts/ai-providers/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-17 — D7 user Grok subscription (not Convexa pool)

## 1. Goal + scope

Redesign how a signed-in trader powers in-app AI recommendations so they always know **which
provider** and **which named model** will run (and which actually ran) before they size from the
read. Powering is a closed set of two honest paths: **(1)** store a personal API key for Anthropic,
OpenAI, Gemini, or Grok/xAI (one ciphertext **per** provider so switching vendors does not force a
re-paste), or **(2)** preferentially **Connect Grok** (OAuth) and run Ask-AI on **that user's own
Grok / SuperGrok subscription** (preferred when available — **never** called "free"; UI does not
claim "cheaper" or "included" unless a vouched wire field exists — none in v1). This is **not** a
Convexa-billed pool, **not** a shared Convexa `XAI_API_KEY`, and product copy must never say
"Convexa Grok pool." There is **no** free-use path for anyone: the legacy admin shared-key
allowance, `shared_admin`, `remaining_free_uses`, and all "free uses" copy are removed (D5).
Score, tier, and fingerprint stay byte-identical. Manual export remains the always-available floor.

<!-- spire:council-resolution:v1 cc6cda0847e6ccf79a256db02e4dfb7c5db31bce791238c0cf6b7cd7acb240fc folded -->

**In scope:**

- Settings **AI providers** panel redesign (replaces Anthropic-only "AI key"): preferred Grok
  **subscription** OAuth path, per-provider BYO matrix (add / replace / remove), explicit **Use this
  path** gestures that write `power_path`, and a visible model control.
- Ask-AI honesty: named provider + named model before Analyze; distinct blocked states when
  powering or model selection prevents a call; provenance chips that distinguish **your Grok
  subscription** from a personal BYO Grok/xAI API key.
- Persist **one standing** provider + model + power-path preference shared by Settings and Ask-AI
  (Ask-AI select writes through; no one-shot "next ask only" override in v1 — D6).
- Explicit credential-identity expansion so one encrypted BYO secret can exist **per** closed
  provider under the same encrypt-at-rest / never-echo floors (D2 + D3).
- Closed server model catalog per BYO provider and for the Grok **subscription** path; env defaults
  become **catalog recommended defaults**, never invisible call-time substitutes.
- Remove admin shared-allowance / free-uses powering from resolution, status, rec envelopes, and UI
  copy (D5).
- **Grok / SuperGrok subscription OAuth** (D7 — now in scope): user-OAuth identity + spend on the
  **user's** subscription. When primary xAI docs/scopes are unverified, keep the arm
  **present-but-unavailable** (no fake Connect). Do not invent endpoints or remaining-allowance
  numbers without a vouched vendor field.

**Out of scope:**

- A Convexa-billed / shared server pool key (`XAI_API_KEY` or sibling) as the Grok OAuth product
  spend story (D7 forbids this framing).
- Providers outside Anthropic · OpenAI · Gemini · Grok/xAI; arbitrary OpenAI-compatible base URLs in
  trader Settings (`openai_compatible` stays a backend/operator capability only).
- One-shot "try this model for the next ask only" without changing the saved preference.
- Spend dashboards, invoice UI, or BYO token-cost metering surfaces.
- Admin RBAC / roles UI.
- Reassessment LLM path, token streaming, acceptance analytics.
- Any real-order / broker path (Accept stays SIMULATED).
- Inventing unverified xAI OAuth protocol URLs/token shapes or unvouched remaining-count fields as
  shipped fact.
- Changing AI asserted-number grounding / absence / plan-scope honesty already shipped.
- Redesigning Google account OAuth (reuse the config-gated pattern only).
- Vouched "cheaper" / "included" claims on the wire (none in v1 UI).

**Future (deliberately deferred):**

- One-shot next-ask model override.
- Per-provider BYO usage / estimated-cost visibility.
- Prefer-BYO-xAI while Grok subscription OAuth stays connected (today: subscription is the preferred
  *offer* when available; BYO remains fully selectable via Use-this-path).
- Expanding the closed provider set.
- Reassessment / streaming on the same multi-provider + model machinery.
- Vouched vendor remaining-allowance / cost fields that would authorize "cheaper" / "included" /
  remaining-count copy.

## 2. Architecture

### 2.1 Live baseline (cited at source — do not cite Python `ai_recommendation.py`)

| Seam | Verified fact |
| --- | --- |
| `apps/api/src/services/llm.rs` | `LlmProvider` already enumerates `anthropic \| openai \| xai \| gemini \| openai_compatible`; `detect_from_key`, `default_model`, and `complete_strategy` dispatch exist |
| `apps/api/src/routes/auth.rs` | `AiKeyBody { key, provider: Option<String> }`; `GET/PUT/DELETE /api/auth/ai-key` |
| `apps/api/src/services/auth/store.rs` (+ PG) | `CredentialRecord.provider` exists; live PK is `(user_id, kind="ai")` — **one** BYO ciphertext per user today |
| `apps/api/src/services/recommendation.rs` | `resolve_llm_key` order is own encrypted key → admin shared env keys → `none`; model is env-default only; envelope carries `key_source`, not the provider/model that ran |
| `apps/dashboard/src/app/features/auth/AiKeySection.tsx` | Settings UI is Anthropic-only; write-only / masked last-4 / no reveal |

### 2.2 Credential identity expansion (D2 + D3)

Live store is **not** multi-slot (D2). Owner chose **one BYO secret per provider** so the trader can
switch vendor without re-pasting (D3). Architect must ship an **explicit** schema/PK expansion under
the same encrypt-at-rest floors:

- Identity becomes `(user_id, kind="ai", provider)` for `provider ∈ {anthropic, openai, xai, gemini}`.
- Each slot holds at most one ciphertext + last4 + provider label.
- Migration: the existing single `kind="ai"` row promotes into the slot named by its stored
  `provider` (default `anthropic` if absent); other slots start empty. An `openai_compatible` row
  (if any) is **not** a trader slot — it does not appear in the four-row matrix.
- Write path: client **must** send an explicit closed `provider`. The server stores under that slot
  and **must not** retitle / reassign the slot from `detect_from_key` (key-prefix forensics on the
  server are the same integrity failure AC-23 forbids in the UI). Soft mismatch hints are Future.
- Decrypt failure ⇒ that slot is unusable with closed reason `key_unusable` (distinct from
  never-set `no_key` and vendor-reject `key_rejected`).
- BYO `xai` remains a **pay-per-token console API key** path — distinct from Grok subscription OAuth
  (D7).
- `openai_compatible` is not a trader BYO slot.

<!-- spire:council-resolution:v1 001a6137321f376386f5bca2b884ef1d19efc4241c6bf9c80a1ade267457a6f8 folded -->
<!-- spire:council-resolution:v1 4a76e0e7b41e24d8bef868f0c995afdf3062861843d8286a7440e1ea60c448fc folded -->
<!-- spire:council-resolution:v1 a66d19784849fd7e36a759db0bee7ba3ef815bdfcf0f284a4c93431697b9d7d6 folded -->
<!-- spire:council-resolution:v1 767922d1145b340dc44d73755b0698778d160123968024d748a4bb692c951452 folded -->

### 2.3 Standing preference (D6) + model catalog (D1 + D4) — Ask-enablement lock

Persist **one** standing preference per user. Settings `ai_*` fields are the **single writer**;
`GET /api/auth/ai-key` `preference.*` and status `powering.preference.*` are **echoes** of the same
three values (D6 — no drift).

| Field | Meaning |
| --- | --- |
| `power_path` | `own_key` \| `grok_subscription` when a **power gesture** has selected a path; **null** until then |
| `provider` | Closed BYO provider when `power_path = own_key`; null for subscription / before a BYO gesture |
| `model` | Exact catalog model id treated as the **selected** model (never a hidden env default) |

Wire token **`grok_subscription`** means **the user's own Grok / SuperGrok subscription** via OAuth
(D7). It must never be read as a Convexa-billed pool. (Do not use `pool_grok` on the wire.)

Settings and Ask-AI **always** bind to this preference. Changing the model (or active provider /
path) on either surface writes through before the next ask. One-shot override is Future.

Server owns a **closed model catalog** per BYO provider and for the Grok subscription path. Today's
`AI_REC_MODEL_*` / `LlmProvider::default_model` values become each catalog's **recommended default**
option — visible and selectable — not a hidden call-time override.

**Ask-enablement lock (folds D1 + D4 without opposition):**

| Situation | `power_path` | `model` on wire | Ask | Resolve reason if blocked |
| --- | --- | --- | --- | --- |
| **A. No-preference-yet / first visit** (never written, or D4 preselect not yet persisted) | null until a power gesture | Server+FE treat the catalog recommended default as the **selected** model; **persist** it on first settings/catalog read (or first Ask bootstrap) so the wire is **not** left as a three-null that looks like unset | Model control shows that **named** selection. Ask is enabled **only if** a usable power path also exists; otherwise Ask stays the AC-13 setup block | If Ask attempted with `power_path` still null → setup-block (`no_key` / subscription-unavailable), **never** `model_missing` / `model_unset` |
| **B. Explicit clear of model** | unchanged | **Forbidden** in v1 — preference PUT must not accept `ai_model: null` without a replacement catalog id (422). No API path produces "cleared model" | n/a | n/a |
| **C. Saved model ∉ active catalog** (D1) | set | stale id still stored | Blocked choose-another-model | `model_not_in_catalog` (alias `model_missing`); **no LLM call**; **no** silent substitute |
| **D. No power path** (no BYO slot set **and** Grok subscription not connected) | null | May still show/persist the D4 named default | Setup block (AC-13); Ask disabled for **power**, not for model | `no_key` (or honest subscription-unavailable when that is the only advertised fix) — **never** `model_missing` |

**Active path while `power_path` is null:** there is **no** active power path. Resolve must not
evaluate "model invalid for active path." First-visit model preselect **does not** write
`power_path`. `power_path` is written only by an explicit **power gesture** (§4 / INTERFACE).

**Which recommended default is preselected when `power_path` is null:** if Grok subscription OAuth
is advertised available, the subscription catalog's recommended model; else the recommended model of
the first BYO catalog entry that has one (stable order `anthropic`, `openai`, `xai`, `gemini`).
Persisted as `ai_model` only.

**Saved preference ∈ catalog for the active path:** use it.

**Provider / path switch (D3 compose with D1 — not an immediate AC-17 trap):** when a power gesture
changes `power_path` and/or `provider`, the server writes the new path's preference atomically:

1. If the current `model` is **∈ the new path's catalog**, keep it.
2. Else write that path's **catalog recommended default** as the new selected `model` (visible,
   named). This is **D4-class preselect on the new path**, not a D1 silent substitute of an
   invalid saved id behind the trader's back.
3. Settings and Ask-AI then label-agree on the new provider+model pair before the next ask (AC-20).

**Closed model reasons (disambiguated):**

| Reason | When |
| --- | --- |
| `model_not_in_catalog` (wire may also accept legacy alias `model_missing`) | `power_path` is set **and** stored `model` is non-null **and** ∉ the active catalog |
| `model_unset` | `power_path` is set **and** there is no selected model (no persisted id and no catalog recommended default to preselect). Should be rare given first-visit persist + forbid-clear |

<!-- spire:council-resolution:v1 731d5fa44042417cfa61e4648d71487510f111f5ebdd92f6ef2d7b4232c957f8 folded -->
<!-- spire:council-resolution:v1 0ec998f03b332e96443597d463f259e173b8a4b67e1203bd9b9c6802bb3f94a5 folded -->
<!-- spire:council-resolution:v1 9c1f8e7d955a07017bae6e89fc657978c2b891b49e183cf064ca2fcf438848ad folded -->

### 2.4 Power-path resolution (D5 + D7)

Closed `key_source` / power-path vocabulary after this feature:

| Path | Mechanism |
| --- | --- |
| `own_key` | Decrypt the BYO ciphertext for the **selected** provider slot → call that provider with the selected catalog model (BYO `xai` = personal console API key) |
| `grok_subscription` | Call xAI using credentials obtained via **user Grok OAuth** so spend hits **that user's** Grok / SuperGrok subscription; selected subscription-catalog model |
| `none` | No usable material; closed `unavailable_reason` |

**Deleted from product resolution and UI:** `shared_admin`, admin shared env-key fallthrough as an
allowance, `remaining_free_uses` / `free_uses_total`, and any "free uses" copy. No silent fallthrough
onto `ANTHROPIC_API_KEY` / `XAI_API_KEY` (or sibling env keys) as a free **or** shared-pool
allowance for anyone (D5 + D7).

**Observable precedence:** the trader's **explicit** `power_path` (written only by a power gesture)
is the control. "Preferred" means Settings offers Connect Grok / subscription first when the
deployment advertises that arm as available — not that BYO is disabled.

**No silent BYO fallthrough:** when `power_path = grok_subscription` and entitlement/subscription
fails, return the matching **subscription / OAuth** reason (`subscription_unavailable` /
`oauth_expired` / `oauth_unlinked`). **Never** spend a BYO ciphertext while `power_path` is still
`grok_subscription`. Declining the subscription path is an explicit BYO power gesture that writes
`power_path = own_key`.

**Closed unavailable reasons** (non-collapsing — `absent-is-not-none`), FE-consumable:

`no_key` · `subscription_unavailable` · `oauth_unlinked` · `oauth_expired` ·
`storage_unavailable` · `model_not_in_catalog` · `model_missing` · `model_unset` ·
`key_unusable` · `key_rejected` · plus existing orthogonal LLM/transport faults (`timeout` /
`llm_error` / …) and existing cooldown / fresh-edge / daily-cap gates (unchanged; shown only after
a usable powering path exists).

| Reason | Meaning (must not collapse) |
| --- | --- |
| `no_key` | No usable BYO slot for the selected provider / no power path yet |
| `key_unusable` | Slot exists but decrypt failed — replace key; **not** "add a key" |
| `key_rejected` | Vendor rejected the key at ask time (auth-class provider HTTP); **not** generic `llm_error` / `timeout` after a call started |
| `subscription_unavailable` | OAuth link present (or arm advertised) but the user's subscription cannot power Ask right now — **only when a vouched vendor/link signal supports it**; never a fabricated Convexa quota |
| `oauth_expired` | Linked identity expired / needs reconnect |
| `oauth_unlinked` | No link / disconnected — distinct from expired |
| `model_not_in_catalog` / `model_missing` | Saved model ∉ active catalog (D1) |
| `model_unset` | Path set but no selected model and no recommended default |

**Do not invent** a Convexa pool meter, `pool_exhausted`, or remaining-allowance number. If the
vendor does not expose a vouched remaining-count field, use link/subscription-unavailable reasons
only (D7). Existing Ask-AI daily `cap.over_limit` stays orthogonal process-local gating — not a
Grok subscription meter.

### 2.5 Grok subscription OAuth (D7)

- **In:** already signed into Convexa → **Connect Grok** (OAuth) → Ask runs on **that user's**
  Grok / SuperGrok subscription.
- **Not this path:** Convexa env `XAI_API_KEY` as a shared/sub pool; any "Convexa Grok pool" copy;
  Convexa-user-id pool metering as the product story.
- **Still distinct:** personal xAI API key (BYO `xai` row) is pay-per-token console key, not the
  subscription. Provenance must not collapse "your Grok subscription" and "Grok" (BYO key).

**Buildable mechanism (architect-owned):** user-OAuth identity + spend on the user's subscription —
mirror the config-gated Authorization-Code pattern of `google_oauth.rs` (Convexa-owned OAuth client,
anti-CSRF state, server-side code exchange). Persist only what the verified vendor flow requires to
call on the user's subscription (opaque tokens / link metadata as docs vouch) — never echo secrets to
the browser. Start is **session-required** (Connect while signed into Convexa — not Convexa account
login).

**Blocked-on honesty:** until primary xAI user-OAuth docs/scopes verify a buildable subscription
spend path, Settings renders the preferred path as **present-but-unavailable** (info note; no
Connect CTA that cannot complete). BYO multi-provider + model choice still ship. There is **no**
non-OAuth way to become `grok_subscription`-entitled in v1, and **no** silent fallthrough onto a
Convexa server xAI key.

### 2.6 Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| Auth credential + crypto leaf | Per-provider encrypt/store/delete; masked matrix hint; optional Grok OAuth link / subscription token record | Call LLM; touch signals/score; override provider from key prefix; treat Convexa env xAI key as subscription |
| Settings preference (single writer) | Persist standing `ai_power_path` / `ai_provider` / `ai_model`; first-visit model preselect persist | Enforce spend alone; accept naked model clear |
| Recommendation leaf (`recommendation.rs` + `llm.rs`) | Resolve power path; apply chosen model; call provider; attach provenance; best-effort rec envelope | Import engine/signals as writers; return raw keys; resurrect `shared_admin`; fall through subscription→BYO; invent Convexa pool meter |
| Settings / Ask-AI FE | Closed provider + model + path chrome; write-only keys; render server labels via lookup | Infer provider from key string; invent model ids; enforce gates alone; show subscription as BYO "Grok" or "Convexa Grok pool" |
| Bundle / SSE / scoring | Untouched | Know about keys, OAuth, or models |

### 2.7 Failure modes + isolation

- Ask-AI and all key / OAuth / preference writes stay **server-gated**; FE checks are UX only.
- Key / OAuth / subscription / LLM failure degrades the **rec surface alone** — always-shaped
  status/rec outcome with closed reason; bundle / SSE / score untouched.
- Auth-class failures on credential writes keep real HTTP statuses; storage fault ⇒
  `storage_available: false` shape (200), not a 5xx leak path.
- Provenance may name path/provider/model that **actually ran** (copied from resolved values used
  for `complete_strategy`); it must not invent a check the rec did not run.
- `no-real-order-path` unchanged.

**Not buildable / rejected approaches:**

- Treating multi-slot BYO as "already available" under the live one-row store.
- Silent catalog-default call when a **saved** preference is invalid (D1).
- Treating first-visit nulls as `model_missing` (collapses AC-13 into AC-17).
- Silent BYO spend while `power_path = grok_subscription`.
- Framing Grok OAuth as a Convexa-billed / shared `XAI_API_KEY` pool ("Convexa Grok pool").
- Inventing a Convexa subscription quota / remaining-count without a vouched vendor field.
- Shipping a fake "connected to Grok" / working Connect CTA while OAuth is unverified.
- Keeping admin "free uses" alongside subscription messaging.
- FE- or server-inferred provider labels from key prefixes.
- Hardcoded client model id lists as product truth.
- Provider/model as scoring / tier / fingerprint inputs.
- UI copy claiming "free" / unvouched "cheaper" / "included".

## 3. Acceptance criteria (with user stories)

Every row is observable without reading source. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 **(SB)** | As a signed-in trader, I want a BYO key per closed provider so I can switch vendors without re-pasting | From Settings, complete **add** of a BYO key for **each** of Anthropic, OpenAI, Gemini, and Grok/xAI; after each successful add that provider shows **set** with a **masked hint only** (no full secret), and other providers keep their prior set/empty state | test |
| 2 **(SB)** | As a signed-in trader, I want secrets write-only | After any successful add/replace, no Settings read, Ask-AI surface, client-visible network body, or product client storage shows the full secret again — only the masked hint (or not-set). There is **no** reveal / show / copy control | test |
| 3 **(SB)** | As a signed-in trader, I want to replace a key for one provider | Replace a stored BYO key for a provider; the new masked hint reflects the replacement; the previous secret is not shown; other providers' slots are unchanged | test |
| 4 **(SB)** | As a signed-in trader, I want to remove a key for one provider | Remove a stored BYO key for a provider; Settings then shows that provider as not set; Ask-AI no longer treats that slot as a usable path; other providers stay as they were | test |
| 5 **(SB)** | As a signed-in trader on a powered path, I want a named provider + named model before I ask | When a usable powering path exists, both Settings and Ask-AI show a **named provider/path label** and a **named model** before a recommendation is requested. Subscription path uses the closed **your Grok subscription** label — not the BYO "Grok" label and not "Convexa Grok pool" | test |
| 6 **(SB)** | As a signed-in trader, I want changing the model to stick for the next ask | Change the selected model from the closed catalog on Settings **or** Ask-AI; the other surface label-agrees; the next successful ask's pre-ask labels and post-ask provenance use the newly selected **named** model | test |
| 7 **(SB)** | As a signed-in trader on first visit, I want the catalog recommended default preselected and visible | When the catalog exposes a recommended default and no valid saved model exists, that named model is preselected and **persisted** as the selected model (optionally labeled as the catalog recommended default). The product does **not** call an unnamed / invisible env default. If a usable power path also exists, Ask is enabled; if not, Ask stays the setup block (AC-13) while the model name remains visible — never classified as `model_missing` | test |
| 8 **(SB)** | As a trader reading a produced rec, I want provenance to name what actually ran | A successfully produced recommendation displays provenance that names the **path/provider label** and **model label** that produced it; those labels match the path active for that ask. Subscription provenance identifies **your Grok subscription**, not a personal BYO Grok key and not a Convexa pool. If either field is absent on the response, that chip is **omitted** (never invent "default") | test |
| 9 **(SB)** | As a signed-in trader, I want Grok subscription OAuth offered as the preferred path when available | When the Grok subscription OAuth arm is **available** on the deployment, Settings presents Connect-with-Grok **first**, observably distinct from "add a personal Grok/xAI API key," and copy does **not** say "Convexa Grok pool," "free," "cheaper," or "included" (no vouched field in v1) | review |
| 10 **(SB)** | As a signed-in trader connected to Grok, I want Ask-AI to run on my subscription with my chosen model | With Grok OAuth connected, subscription usable, `power_path = grok_subscription`, and a model chosen, obtain a recommendation; pre-ask labels and post-ask provenance identify **your Grok subscription** and the chosen model (not a personal BYO key) | test |
| 11 **(SB)** | As a signed-in trader, I want to decline the subscription path and use BYO instead | With Grok connected **and** at least one BYO slot set, use the **Use this key** / select-BYO-row gesture on a set BYO row (writes `power_path = own_key` + that provider); Ask-AI then runs on that BYO path, not the subscription | test |
| 12 **(SB)** | As a signed-out trader, I want Ask-AI to stay auth-outermost | Ask-AI shows only the sign-in gate; cooldown, daily cap, no-key, OAuth-expired, OAuth-unlinked, subscription-unavailable, bad-key, and model-missing states do **not** appear. Settings powering controls require sign-in | test |
| 13 **(SB)** | As a signed-in trader with no powering path, I want a setup block — not a free trial and not a model-missing block | With `power_path` null (no BYO Use-this-path yet, Grok not connected): Ask-AI shows a setup blocked state with a path to Settings, produces **no** recommendation, is **not** framed as free / free trial / free uses, and is **not** classified as choose-another-model / `model_missing` even if a D4 model name is visible | test |
| 14 **(SB)** | As a signed-in trader with expired or unlinked Grok OAuth, I want those states named distinctly | Ask-AI and Settings show distinct **oauth_expired** vs **oauth_unlinked** states (reconnect vs connect / switch-to-BYO); each is textually and behaviorally distinct from no-key, from each other, and from subscription-unavailable; **no** recommendation | test |
| 15 **(SB)** | As a signed-in trader when my subscription cannot power Ask, I want that state named distinctly | While `power_path = grok_subscription`: **subscription_unavailable** (only when vouched) is a distinct blocked state with recovery toward retry later and/or BYO Use-this-path; **not** labeled as expired/unlinked OAuth or as "add your key" alone; **no** recommendation; **no** silent BYO spend; **no** fabricated Convexa quota / remaining-count | test |
| 16 **(SB)** | As a signed-in trader with a bad BYO key, I want replace-key paths that name the right fault | At ask time: vendor **key_rejected** shows a distinct state pointing at replace-key; decrypt **key_unusable** shows a distinct state (not "add a key", not generic LLM error); neither blanks the ticker dashboard; neither is labeled `llm_error` / `timeout` | test |
| 17 **(SB)** | As a signed-in trader whose saved model left the catalog, I want a block — not a silent substitute | When `power_path` is set and the saved selection is not in the current catalog for that path: Ask-AI/Settings show a distinct choose-another-model blocked state; the product does **not** silently substitute another model; **no** recommendation until the trader selects a catalog model. (Provider/path switch that auto-writes the **new** catalog's recommended default is the §2.3 switch rule — not this case.) | test |
| 18 **(SB)** | As a signed-in trader when key storage is unavailable, I want an honest refusal | Settings refuses saving a BYO key with an explicit storage-unavailable outcome (info, not error-red); the trader cannot be led to believe a key was stored; manual export remains available | test |
| 19 **(SB)** | As any trader, I must never see a free-uses / admin shared-allowance powering path | No Ask-AI or Settings surface shows remaining free uses, free-use counters, "out of free uses," or admin shared-allowance language; resolution never produces a rec via a deleted `shared_admin` / free-allowance path or a Convexa shared xAI key | test |
| 20 | As a trader switching among set BYO providers, I want Settings and Ask-AI to agree without an immediate model block | With keys set on more than one provider, the Use-this-key gesture on another set row updates `power_path`/`provider` and applies the §2.3 switch rule for `model` (keep if ∈ new catalog, else write that catalog's recommended default, visible); both surfaces agree before the next ask | test |
| 21 | As any trader (signed-in or not), I want manual export without LLM powering | In every blocked powering state in AC-12–AC-18, and when signed-out, the manual export / copy-paste hand-off remains usable without performing an Ask-AI call | test |
| 22 | As a signed-in trader with a usable path, I still want existing gates | Existing cooldown, fresh-edge gate, and daily-cap blocked states still appear when a usable powering path exists and those conditions apply; they do not replace or overwrite distinct powering-failure states when powering is the blocker | review |
| 23 | As a trader choosing a provider, I want closed labels — not key parsing | Provider labels shown are from the closed set (Anthropic / OpenAI / Gemini / Grok for BYO; **your Grok subscription** for OAuth) and are **not** inferred by parsing the pasted key string in the UI; never "Convexa Grok pool" | review |
| 24 | As a trader reading provenance, I do not want overclaim | Provenance naming provider/model/path does not claim grounding, verification, or any check the recommendation did not already express through existing honesty chrome | review |
| 25 **(SB)** | As the owner, I want powering never to touch score | For the same market inputs, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` are byte-identical across subscription vs each BYO provider path and vs pre-feature baseline | test |
| 26 | As a trader after an LLM fault, I want isolation | An LLM/transport failure after a valid path still isolates to the Ask-AI surface (unavailable + recovery); ticker bundle / positions / score tiles remain intact | test |
| 27 **(SB)** | As the owner, if the subscription OAuth arm is not buildable I want honesty — not a lie | If the Grok subscription OAuth arm cannot be delivered honestly in this build, the ship either (a) delivers the arm meeting AC-9/10/14/15, or (b) leaves those ACs **explicitly open / blocked-on** in the gate record — it must **not** ship a false "connected to Grok" affordance, invent endpoints, or redefine the path as a Convexa-billed pool | review |
| 28 | As a trader using Settings, I want the AI providers panel reachable from Ask-AI | The Ask-AI Settings CTA deep-links and scrolls to the AI providers panel (`#ai-key` or successor dual-id) | test |
| 29 | As a trader on every Ask-AI body, I want the export floor | Manual export remains reachable in every Ask-AI body state covered by this feature | test |
| 30 | As a trader, I want Curvature Terminal discipline on the redesign | Redesigned Settings/Ask-AI chrome uses theme tokens only; no new orchestrated motion family; no fourth convex arc; warnings use `warning.*` + icon | test |

**Method notes (risk-based).** `test` concentrates on silent wrong-power / wrong-model / secret-echo /
state-collapse / free-uses-regression / score byte-identity / subscription≠BYO Grok label /
decrypt≠reject. `review` owns preferred-path ordering/copy intent (no "Convexa Grok pool", no
unvouched "cheaper"), closed-label non-inference, provenance non-overclaim, orthogonality of
existing gates, and the honesty gate on a blocked OAuth arm.

**Ship-blocking set:** AC-1–AC-19, AC-25, AC-27 (subscription OAuth arm or honest blocked-on escape).

## 4. UI + interaction

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET** — The Curvature
Terminal). No second token table here.

**Design direction:** reuse Settings `PanelCard` + uppercase field-label rhythm; credential chrome
mirrors `BrokerageSection` (write-only, masked mono last-4, Replace/Remove, warning+icon confirm,
storage-unavailable as **info** not error-red). Chips stay outlined / quiet secondary captions —
green/red reserved for direction. Subscription/BYO status is not a P/L tint. Model / provider names
render in mono when they are Convexa-vouched wire labels. Touch ≥44px on coarse pointers; no 393px
overflow. No new motion family; no fourth convex arc; amber stays spent.

**Flows:**

1. **Anonymous Settings** — sign-in prompt only; no credential / OAuth / model forms.
2. **Signed-in Settings — AI providers** (panel heading replaces "AI key"; keep `#ai-key` deep-link
   or dual-id migration):
   1. Helper (two sentences): Connect Grok (while signed into Convexa) to run Ask-AI on **your Grok
      subscription** when available; otherwise store your own API key for Anthropic / OpenAI /
      Gemini / Grok. Encrypt / never-shown-again floor stays. **No "free" / "cheaper" / "included" /
      "Convexa Grok pool" claim.**
   2. **Preferred path — your Grok subscription** first when the deployment advertises availability;
      otherwise present-but-unavailable info (no lying Connect CTA).
      - **Connect Grok** (when available) / successful OAuth callback → power gesture writes
        `power_path = grok_subscription` and applies the §2.3 model switch rule for the
        subscription catalog.
      - **Disconnect** → unlinks (`oauth_unlinked`); clears `power_path` if it was
        `grok_subscription`.
   3. **Alternative — Your API key:** per-provider set / empty / replace / remove **matrix** (D3) —
      provider select before the secret field; placeholders switch by selected provider; set-state
      labels from **stored** provider + masked last-4 only.
      - **Saving a key** into a slot **or** pressing **Use this key** on an already-set row → power
        gesture writes `power_path = own_key` + that `provider`, and applies the §2.3 model switch
        rule for that provider's catalog. **This is how the trader declines the subscription path**
        when both materials exist (AC-11). BYO Grok/xAI is still "your API key," not the
        subscription.
   4. **Model for recommendations** — visible once a catalog exists to choose from (including
      first-visit D4 preselect while still unpowered). Options from server catalog only. Clearing
      to empty is not offered.
3. **Ask-AI** — auth outermost when signed out. When powered: visible model select bound to the
   **same** standing preference as Settings (D6). Unpowered: distinct CTA per closed reason
   (subscription-first when that is the honest fix). Provenance:
   - Path/provider chip via closed lookup: `key_source = grok_subscription` → **your Grok
     subscription**; `own_key` + provider → Anthropic / OpenAI / Gemini / Grok (BYO).
   - Model chip only when named.
   - Own-key honesty: `Using your {provider} key` when provider named, else `Using your key`.
   - Loading may say `Asking {label} ({model})…` only when those names are already known.

<!-- spire:council-resolution:v1 e4144d759d859ab85ade5cf1cf60772aab337fc4387a0fdaab7a6b7935c6f236 folded -->
<!-- spire:council-resolution:v1 55f323ae67ccb442f6a734619db3b3fb65d2b1e903095334169ed04d3390f248 folded -->

**Component states**

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Settings AI providers panel | Signed-in matrix + preferred Grok subscription chrome + model control | Quiet pending on status read (no false Set) | Unpowered: Connect Grok CTA (if advertised) + BYO form; model may show D4 named default with caption that a power path is still needed | Save-error alert; draft retained; never echoes secret | storage_unavailable info; inputs disabled |
| BYO provider row | Set: stored provider label + masked last-4 + Replace/Remove + **Use this key** (active indicator when `power_path=own_key` and provider matches) · Empty: add form | Submitting disables buttons | Empty slot for that provider | Inline validation / save-error | Same storage_unavailable as panel |
| Grok subscription card | Connected + **active** when `power_path=grok_subscription` + model + Disconnect **or** available disconnected + Connect **or** present-but-unavailable info | Connecting… | n/a (unavailable is not empty) | OAuth/connect fault with recovery | `oauth_expired` warning+icon; `oauth_unlinked` after disconnect / never linked; `subscription_unavailable` only when vouched |
| Model control | Named selection (incl. first-visit recommended default, persisted) | Catalog loading | Catalog empty/unavailable honest empty — no FE-invented ids | `model_not_in_catalog` blocked choose-another (only when `power_path` set) | Prefer last known catalog + blocked ask if selection invalid for active path |
| Ask-AI gate / action | idle_powered: Analyze + visible model | Thinking… + honest asking line | idle_unpowered: reason-specific CTA (`no_key` setup ≠ model-missing) | `key_rejected` / `key_unusable` / llm fault + recovery | Existing stale strips; never imply a new model ran |
| Provenance row | Path/provider + Model chips iff named; subscription ≠ BYO Grok; never "Convexa Grok pool" | n/a | Omit unnamed chips | n/a | Unchanged stale/superseded treatment |

Additional named states required by product honesty: `anonymous`, `subscription_available_disconnected`,
`subscription_connected`, `subscription_unavailable`, `oauth_expired`, `oauth_unlinked`,
`byo_set`, `byo_replace`, `byo_remove_confirm`, `model_catalog_empty`, `success` (path-specific
snackbar: e.g. `AI key saved.` / `Using your OpenAI key.` / `Connected to your Grok subscription.` /
`AI key removed.`). Do not collapse `no_key` · `subscription_unavailable` · `oauth_expired` ·
`oauth_unlinked` · `model_not_in_catalog` · `model_unset` · `key_unusable` · `key_rejected` into one
string.

**Copy (integrity rules + samples):**

1. Trace or omit — provider, model, path need vouched fields.
2. Never say "free uses," "free allowance," "out of free uses," or "free."
3. Never say **"Convexa Grok pool."** Prefer **your Grok subscription**.
4. Do **not** say "cheaper" or "included" in v1 (no vouched field).
5. No key-string forensics in UI labels.
6. Subscription path label ≠ BYO xAI "Grok".
7. Samples (intent; words may be edited, honesty may not):
   - Subscription unavailable: `Your Grok subscription isn't available for Ask-AI right now. You can still add your own API key below.`
   - OAuth expired: `Your Grok connection expired. Reconnect to use your subscription, or use your own key.`
   - OAuth unlinked: `Connect Grok to use your Grok subscription, or use your own API key.`
   - Key unusable: `Your saved key can't be used. Replace it in Settings.`
   - Key rejected: `The provider rejected your key. Replace it in Settings.`
   - BYO empty (no subscription): `Add an API key for Anthropic, OpenAI, Gemini, or Grok to power recommendations. Your key, your cost.`
   - Model unnamed on a produced card: omit model chip (never `Model · default`).

## 5. Error handling

| Failure class | User sees | Logged | Retry |
|---|---|---|---|
| Anonymous credential/OAuth/preference write | 403 → sign-in prompt | Auth-class only | Sign in |
| Empty / too-short key on PUT | 422 validation inline | No secret | Fix + resubmit |
| Preference PUT with `ai_model: null` | 422 validation — clear forbidden | No secret | Send a catalog id or omit field |
| Storage unavailable | 200 `storage_available:false`; info alert; inputs disabled | Store fault warn (no plaintext) | Manual export; retry later |
| Decrypt failure on resolve | Distinct `key_unusable`; Ask blocked; replace-key CTA | Decrypt fail without plaintext | Replace key |
| Saved model ∉ catalog (`power_path` set) | Distinct `model_not_in_catalog`; **no LLM call** | Closed reason | Pick catalog model |
| BYO key rejected by vendor at ask | Distinct `key_rejected`; no new rec; dashboard intact | Vendor auth fault without key | Replace key |
| Subscription unavailable (vouched only) | Distinct `subscription_unavailable`; offer BYO Use-this-key | Vendor/link signal | Retry later or BYO |
| OAuth expired | Warning+icon `oauth_expired`; Reconnect or BYO | Link state | Reconnect |
| OAuth unlinked | Distinct `oauth_unlinked`; Connect or BYO | Link state | Connect |
| Ask with `power_path` null | Setup block `no_key` (not model-missing) | Closed reason | Power gesture |
| OAuth arm config-gated / unverified | Present-but-unavailable info; no fake Connect | `available=false` | BYO only |
| LLM / transport after valid path | Ask-AI unavailable + Retry (`llm_error` / `timeout`); prior pinned card not silently rewritten | Existing leaf logging | Retry |
| Cooldown / fresh-edge / daily cap | Existing gate copy; only after usable powering path; not a stand-in for subscription state | Existing | Wait / refresh |

Secrets are never logged, never returned, never put in error text. No fabricated remaining-count UI.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/ai-providers/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This feature **changes the backend**. It expands BYO
credentials to a per-provider matrix, adds standing AI preference + closed model catalog fields,
removes the admin shared-allowance / free-uses powering path, extends recommendation status **and**
`POST /api/recommendation/{ticker}` envelopes with provider/model/path provenance and the
`grok_subscription` source (user subscription OAuth — **not** a Convexa pool), and adds a
config-gated Grok OAuth identity arm when verified. Authoritative field lists and the
machine-checkable conformance block live only in the interface file — not restated here.

## 7. Testing strategy

**Automate (`test`) where silence hurts:** per-provider add/replace/remove isolation; never-echo;
Use-this-path / Connect gestures writing `power_path`; preference write-through agreement; first-visit
recommended-default persist vs invalid-saved-model block (no LLM call) vs no-power setup block
(never `model_missing`); provider-switch model rule; provenance subscription≠BYO Grok; decrypt vs
reject; deletion of free-uses / `shared_admin` / Convexa-pool framing; export floor;
score/tier/fingerprint byte-identity; theme/motion discipline suites; POST rec envelope fields in
conformance.

**Review:** preferred-path ordering/copy intent (no "Convexa Grok pool", no unvouched
cheaper/included), closed-label non-inference, provenance non-overclaim, orthogonality of existing
cooldown/cap gates, AC-27 honesty when the OAuth arm stays blocked-on.

**FE tiers:** unit/component for pure preference + reason→copy lookups (including subscription vs
BYO Grok); integration at the network boundary (mock fetch only) for Settings matrix + Ask-AI gate
matrix; existing DOM harness for Settings AI + Ask-AI families.

**Invariants that must never silently regress:** secret never echoed; provider/model never scoring
inputs; no free-uses resurrection; no silent model substitute on invalid saved id; no
subscription→BYO fallthrough; no Convexa-pool product claim; absent reasons stay distinct; manual
export always reachable; auth outermost on Ask-AI.

## 8. Guardrails this feature must not break

From BRIEF invariant watch:

- `secret-encrypted-at-rest` — recoverable BYO secrets (and any OAuth tokens required to spend on the
  user's subscription) encrypted / server-side only as docs require; never logged / returned /
  browsed; no Convexa shared pool secret as the product spend story.
- `server-side-gate-enforcement` — Ask-AI + credential / OAuth / preference writes enforced server-side.
- `additive-keeps-score-byte-identical` — provider / model / path are non-inputs to signals / score /
  tier / fingerprint; recommendation remains a one-way leaf.
- `best-effort-isolated-or-null` — power-path / LLM faults degrade rec only.
- `no-real-order-path` — Accept stays paper-sim.
- `theme-token-discipline` — token-only styling; mode-aware via `extrasFor` / `elevationFor`.
- `single-motion-moment` — no new orchestrated motion family.
- `digested-labels-not-raw-dump` — provider/model/path are closed server labels; FE renders via lookup
  (subscription path has its own closed label, distinct from BYO Grok).
- `absent-is-not-none` — no key vs subscription unavailable vs OAuth expired vs OAuth unlinked vs BYO
  set vs model missing vs key unusable vs key rejected stay distinct through to the consumer.
- `cited-code-is-verified-not-assumed` — cite live Rust/TS paths above; Python leaf is not live.
- `ai-asserted-numbers-are-traceable` — provenance names what ran; does not fabricate checks.

## 9. Open questions

1. **Grok subscription OAuth identity arm — blocked-on verification.** Mechanism is named
   (user-OAuth onto the user's Grok / SuperGrok subscription). Primary xAI user-OAuth
   endpoints/scopes are not yet verified in-lane. Until that lane-check lands, AC-9/10/14/15 follow
   AC-27's honest blocked-on escape (present-but-unavailable chrome; BYO + model choice still ship).
   Do not invent endpoints or remaining-allowance numbers.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"4a76e0e7b41e24d8bef868f0c995afdf3062861843d8286a7440e1ea60c448fc","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"001a6137321f376386f5bca2b884ef1d19efc4241c6bf9c80a1ade267457a6f8","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"731d5fa44042417cfa61e4648d71487510f111f5ebdd92f6ef2d7b4232c957f8","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"a66d19784849fd7e36a759db0bee7ba3ef815bdfcf0f284a4c93431697b9d7d6","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"0ec998f03b332e96443597d463f259e173b8a4b67e1203bd9b9c6802bb3f94a5","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"cc6cda0847e6ccf79a256db02e4dfb7c5db31bce791238c0cf6b7cd7acb240fc","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":0,"conflict_id":"e4144d759d859ab85ade5cf1cf60772aab337fc4387a0fdaab7a6b7935c6f236","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"767922d1145b340dc44d73755b0698778d160123968024d748a4bb692c951452","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"9c1f8e7d955a07017bae6e89fc657978c2b891b49e183cf064ca2fcf438848ad","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"55f323ae67ccb442f6a734619db3b3fb65d2b1e903095334169ed04d3390f248","disposition":"folded","section":"§4"}]}
-->
