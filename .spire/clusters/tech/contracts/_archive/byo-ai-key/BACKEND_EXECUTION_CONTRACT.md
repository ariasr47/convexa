# byo-ai-key — BACKEND EXECUTION CONTRACT (→ apps/api)

> Compressor #3 output 2 of 3. The backend lane's build sheet. References INTERFACE_CONTRACT.md (the
> wire truth) + ARCHITECTURE_CONTRACT.md (§1 key-resolution seam, §2 encryption-at-rest seam, §3 admin
> allowlist, §4 per-identity metering, §5 the states, §6 binding constraints). Implements the
> server-side half of the five states + the credential store. The AI rec stays a one-way leaf;
> score / `opportunity_tier` / `state_fingerprint` byte-identical. Stay in lane: backend internals only.

Grounded against: `apps/api/src/core/ai_recommendation.py` (the leaf), the `/api/recommendation/*`
endpoints in `apps/api/main.py`, and `apps/api/src/auth/` (`ports.py`, `sqlite_store.py`, `__init__.py`,
`passwords.py`, `cookies.py`, `service.py`).

---

## 1. Per-request key resolution at the `main.py` boundary  (ARCHITECTURE §1)

Today `ai_recommendation.py` resolves the key once, process-globally from env. CHANGE: resolve key +
provider **per request, from the authenticated user**, at the `main.py` orchestration boundary —
exactly where `_resolve_auth`/`_gate_or_response` already resolve the session for
`POST /api/recommendation/{ticker}`.

**Resolution order (HARD, owner-fixed — ARCHITECTURE §1, PRODUCT_CONTRACT §4):**
```
1. auth gate (shipped): resolve session → user{id,email} | 403/503   (precedes everything)
2. own decryptable key?  → key_source = own_key   (their cost, NOT metered against shared; own cooldown only)
3. else admin (email in allowlist) AND shared key configured AND per-admin allowance left?
                         → key_source = shared_admin  (shared server key; metered per-admin)
4. else                  → key_source = none, with the unavailable reason distinguished:
                              - admin AND shared key configured AND allowance == 0  → over_limit   (state c)
                              - admin AND shared key NOT configured                 → shared_key_unconfigured (state e)
                              - else (regular, no own key)                          → no_key       (state a)
```
Note the precondition ORDER on the admin path: *is a shared key configured?* gates *has the admin
allowance left?* — so an admin with no shared key resolves to `shared_key_unconfigured` (e), NOT
`over_limit` (c). Own-key-first applies even for admins, even when no shared key exists (AC-5, AC-25).

**Resolved-key value object (computed in `main.py`, passed into the leaf):** carries which key material
to use, `key_source` (`own_key|shared_admin|none`), the provider+model selection (keep
provider-agnostic-friendly), and the metering identity (admin user-id for `shared_admin`; the user for
own-cooldown on `own_key`). It MUST NEVER carry the raw key in any field the caller logs or serializes
(the leaf receives the key material transiently; it is never put on a logged/serialized field — AC-11/12).

**Leaf isolation (HARD):** resolution + decryption + metering-identity happen at the boundary; hand the
leaf the resolved value object so `ai_recommendation.py`'s import surface stays UNCHANGED. The leaf
stays one-way — it MUST NOT import `signals`/`engine`/`live`/`darkpool`/`chain_store`/the bundle path.
`_get_provider()` evolves from "read env, build once" to "given a resolved key + provider/model, build
for this request"; the `StubLLMProvider` still serves keyless/no-cost verification.

**On `shared_admin` success only:** commit ONE unit to that admin's meter (mirror the shipped
`commit_query` — count on a PRODUCED rec only; an LLM error/timeout does NOT consume a unit — AC-17).

---

## 2. Response field derivation (feeds INTERFACE §2)

At the boundary / in the leaf's status derivation, populate the added rec-response + status fields:
- `key_source` ∈ `own_key|shared_admin|none` — set from the resolution above. NEVER derived from or
  feeding any scoring field (AC-14).
- `unavailable_reason` — for `key_source:none`, set `no_key` (a) / `over_limit` (c) /
  `shared_key_unconfigured` (e) per the resolution branch. MUST NEVER contain key text (AC-16).
- `remaining_free_uses` — for an ADMIN on a shared-key-CONFIGURED path: the per-admin meter's remaining
  count (post-decrement on a produced shared rec). `null`/omitted for regular users, own-key, and
  shared-unconfigured paths (a regular user NEVER carries a counter — PRODUCT_CONTRACT §6).
- `free_uses_total` — the per-admin allowance (default 3, env-tunable), present whenever
  `remaining_free_uses` is.
- The `GET …/status` read populates `remaining_free_uses`/`free_uses_total` the same way WITHOUT
  committing a unit (side-effect-free, 200).

Every outcome is best-effort HTTP 200 + status, never 5xx (the only 403/503 is the shipped outermost
auth gate — AC-15/22).

---

## 3. Credential endpoints (NEW — `/api/auth/ai-key/*`)  (INTERFACE §1)

Mount on the auth router (`src/auth/router.py`) behind the SAME signed-in gate (anonymous ⇒ 403
`auth_required`). Session resolved from the HTTP-only cookie; the body NEVER carries identity.
- `PUT /api/auth/ai-key` — body `{key}`; encrypt+store (overwrite — rotate==overwrite, no history);
  response `{set:true,last4,storage_available}`. NEVER echo the key/ciphertext (AC-10). Storage
  unavailable ⇒ 200 `{set:false,storage_available:false}` (never 5xx — AC-18).
- `DELETE /api/auth/ai-key` — delete; response `{set:false,storage_available}`. Idempotent.
- `GET /api/auth/ai-key` — masked-hint read; response `{set,last4,storage_available}`. NEVER the key.

---

## 4. `UserCredentialStore` port + in-memory adapter + crypto leaf  (ARCHITECTURE §2)

**`UserCredentialStore`** — a FOURTH storage port in `src/auth/ports.py`, mirroring `UserStore`/
`SessionStore`/`UserSettingsStore`, returned by the same env factory (`AuthStores` +
`_make_memory_stores` in `__init__.py`). The RECORD is the contract:
- owning **user id** (opaque, never the email),
- **encrypted ciphertext** of the key (never plaintext),
- a **non-secret masked hint** (`set:true` + `last4`, stored as cleartext metadata at SAVE time — do
  NOT decrypt on every read),
- created/updated timestamps.

**Port ops (behavior, not signatures):**
- **set/rotate** — encrypt + store, overwrite (no history).
- **get-decrypted** — server-side ONLY, used SOLELY by §1 resolution; NEVER feeds a response.
- **get-hint** — the only credential thing a response may carry (`set`+`last4`).
- **delete** — → back to `no_key`/role fallback.

**In-memory adapter only** this phase (single shared store, like `sqlite_store.py`); the persistent
adapter is a registered SEAM, not built ⇒ encrypted keys reset on restart (accepted prototype — AC-20).

**Crypto helper leaf** — a NEW sibling of `passwords.py`/`cookies.py` in `src/auth/`. Imports ONLY
stdlib + `cryptography`; NEVER imported by the scoring path. Symmetric, decryptable (NOT hashing —
the key must recover to call Anthropic). **Fernet recommended** (authenticated, versioned, no nonce
mgmt) or AES-GCM. Keyed by a **NEW server-side, gitignored env secret** `AI_KEY_ENCRYPTION_KEY` (the
literal name; read ONLY inside this helper). **Absent-secret = config-gated, no crash** (mirrors
`AUTH_SESSION_SIGNING_KEY`): fall back to an EPHEMERAL per-process key (ciphertext then non-portable /
resets on restart, already true of the in-memory store). The honest absent-UX is the FE's
storage-available signaling (AC-18) — if the chosen fallback is ephemeral-accept, the FE Empty/Set flow
is normal; if the deployment opts to report storage unavailable, surface `storage_available:false`.

**New dep:** `cryptography` in `apps/api/requirements.txt` (re-run the venv `pip install -r
requirements.txt`). The ONLY new dep.

---

## 5. Admin determination (MINIMAL — `minimal-admin-not-RBAC`)  (ARCHITECTURE §3)

Env allowlist of admin emails: **`AI_REC_ADMIN_EMAILS`** (the literal name; comma-separated), matched
case-insensitively against `ResolvedSession.user.email` (already in hand at the boundary). Read NOWHERE
except the allowance decision (does this user get the shared free allowance?). **HARD non-goal:** NOT
roles/permissions/scopes/admin-UI. An admin dropped from the env list loses the allowance on the next
request (AC-19); their own-key access is unaffected (it does not depend on admin status).

---

## 6. Per-identity metering  (ARCHITECTURE §4)

Today `_RateState` is one process-global cap + cooldown, local-ET-midnight reset, in-memory. Split:
- **Shared-allowance meter (admins):** metered per ADMIN USER-ID (NOT email, NOT global) — each admin
  has their own daily counter against the shared key. **Default 3/day per admin**, env-tunable —
  **`AI_REC_ADMIN_FREE_DAILY`** (the literal name; semantically distinct from the shipped global
  `AI_REC_DAILY_CAP`). A `shared_admin` PRODUCED rec consumes one unit (count on success only — mirror
  `commit_query`). Reset = the existing local-ET-midnight boundary (`resets_at_iso()`), per counter.
  Only consumed when a shared key is configured (state e never decrements — AC-24).
- **Own-key calls NOT metered** against the shared allowance (their key, their cost). KEEP a
  per-identity cooldown (the anti-over-trading rationale, PRODUCT_CONTRACT §3 decision 7) — applied
  per-identity so one user's calls never cool down another's. NEVER blocked by a shared counter.
- **Best-effort, process-local:** `_RateState` evolves from one global instance into a keyed
  collection (one entry per identity key, same lock pattern). A metering fault never raises 5xx; at
  worst a contained status. `reset_rate_state_for_tests()` clears the whole collection.

The shipped `ai_eval` gate + cooldown + global cap stay orthogonal; on the shared path the per-admin
allowance is an ADDITIONAL precondition (PRODUCT_CONTRACT §3).

---

## 7. HARD security floor (enforced structurally — ARCHITECTURE §2/§6, PRODUCT_CONTRACT §6)
- Raw key **NEVER logged** — no log line / exception / trace / observability field; treat ciphertext as
  secret too (AC-11). A log scan across add/replace/use/remove finds no key material.
- Raw key **NEVER returned** in any response (set/delete/status return only `set`/`last4`/
  `storage_available`; the rec response/export carry no key — AC-10/12/13).
- Raw key **NEVER sent to the browser**; resolution + decryption stay server-side.
- The decrypted key lives only transiently in memory for ONE call, is never cached where a response
  reaches it, and NEVER enters the export floor (egress invariant — AC-13).
- Write-only from the client (masked hint only); rotate == overwrite; delete supported.
- A decrypt failure (e.g. secret changed) ⇒ treat as no usable key (regular (a), admin (c)/(e)
  fallback) — unavailable, not a rec, not 5xx, no raw/ciphertext leaked (AC-16).

---

## 8. Isolation invariants (the enforcement boundary)
- **`[additive-keeps-score-byte-identical]`** — resolution, credential store, crypto helper, admin
  allowlist, per-identity metering stay OUT of `signals`/scoring/bundle/`state_fingerprint`. Score /
  tier / fingerprint / gate **byte-identical** with/without the feature and identical across
  anonymous / regular-no-key / admin-allowance / admin-exhausted / admin-shared-unconfigured / own-key
  (AC-14). Module-import boundary = the enforcement. Prove byte-identical with a recorded score +
  fingerprint across all six conditions (precedent: user-accounts proved score 24, fp `79373ef9194e`).
- **`[best-effort-isolated-or-null]`** (rec-surface carve-out) — any key lookup / decrypt / LLM /
  over-limit / missing-secret failure degrades the rec surface ALONE to a contained status, never 5xx,
  never breaks bundle/SSE/chart/tracker; the export floor keeps working keyless (AC-15/16/17/23).
- **CONTEXT §8** — the LLM stays external/advisory/consumer-only: never feeds
  signals/score/tier/gate/fingerprint, never recomputes/fetches, never rides SSE, never auto-acts; the
  per-user key never reaches the browser.
- **`[no-real-order-path]`** — unaffected.

---

## 9. Backend required-proofs (the BE half of the §7 matrix in UX_BLUEPRINT)
Verified by app-run + `.claude/tools/interface_conformance.py` + targeted runtime assertions (NO pytest
suite — repo convention):
1. **Conformance** — run `.claude/tools/conformance/byo-ai-key.json` (status-shape + export-egress
   shapes) green; plus the existing `ai_recommendations.json`/`user-accounts.json` still green.
2. **Five-state resolution (AC-1/2/3/4/5/6/24)** — drive each state via a signed-in session +
   (no key / own key / admin allowlist / shared-key configured-or-not / allowance left-or-0) and assert
   `status`/`key_source`/`unavailable_reason`/`remaining_free_uses` per INTERFACE §3.
3. **Metering (AC-2/5/17)** — produced shared rec decrements by one; own-key rec leaves the admin count
   unchanged; an LLM-failed shared call does NOT decrement.
4. **Decrypt-fail (AC-16)** — a stored key that can't be decrypted ⇒ unavailable, not a rec, not 5xx,
   no key/ciphertext in the response.
5. **Allowlist + restart (AC-19/20)** — drop an admin from `AI_REC_ADMIN_EMAILS` ⇒ loses allowance,
   keeps own key; restart ⇒ keys gone, `set:false`, role no-key behavior, no error.
6. **Byte-identical score (AC-14)** — recorded `opportunity_score`/`opportunity_tier`/`state_fingerprint`
   identical across all six conditions; import-boundary AST check (0 scoring modules import the
   credential store / crypto helper).
7. **Security floor (AC-10/11/12/13)** — log scan across add/replace/use/remove finds no key/ciphertext;
   no response (credential, rec, export) carries a key; egress of the export = context+persona+glossary
   +egress_note only.
8. **Encryption-secret absent (AC-18)** — no crash; chosen config-gated behavior honest, never 5xx,
   never exposes a key.
