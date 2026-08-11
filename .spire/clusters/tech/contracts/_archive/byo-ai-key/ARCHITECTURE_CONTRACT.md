# byo-ai-key — ARCHITECTURE CONTRACT

> Architect (entry). Scope: TECHNICAL SHAPE only — data-structure CONTENT, data-flow, component
> boundaries, isolation/error rules, restated binding constraints, non-goals. NOT here (→ PM):
> UI/layout, endpoint signatures, payload/JSON field names, copy, the literal allowance number /
> env-name strings. Grounded against shipped `apps/api/src/core/ai_recommendation.py`, the
> `/api/recommendation/*` endpoints in `apps/api/main.py`, and `apps/api/src/auth/`.

## 0. Goal
**Hybrid BYO-key.** Each signed-in user stores their **own** Anthropic key (used for their calls,
their cost, **no shared cap**). The shared server key gives a **free allowance to ADMIN users only
(default 3/day each); regular users get 0** and must add their own key. Encrypt the stored key at
rest; it never reaches the browser. **Additive + isolated** — touches only the AI-rec surface's
key resolution + metering + state reporting. Does NOT touch the bundle/SSE/score path.

## 1. Per-request key-resolution seam
Today `ai_recommendation.py` resolves the key **once, process-globally** from env
(`_resolve_api_key()`) and `_get_provider()` builds the provider from it. The module docstring
already names this exact "BYO-key / multi-tenant" seam. **Change: key + provider are resolved PER
REQUEST from the authenticated user.**

- Introduce a small **resolved-key value object** the boundary (`main.py`) computes and passes into
  `generate_recommendation(...)` + status derivation. CONTENT: which key material to use; the
  source enum `own_key | shared_admin | no_key`; the provider/model selection (carry provider+model
  so a future provider stays a contained swap — provider-agnostic-friendly); the metering identity
  (admin user-id for `shared_admin`; the user for own-cooldown on `own_key`). It NEVER carries the
  raw key in any field the caller logs/serializes.
- `LLMProvider` / `AnthropicLLMProvider` / `StubLLMProvider` are **unchanged in shape** — the
  Anthropic provider is just constructed from the per-request key, not the module-global one.
  `_get_provider()` evolves from "read env, build once" to "given a resolved key + provider/model,
  build for this request"; the stub still serves keyless/no-cost verification.

**Precedence (owner-fixed, hard order):** (a) user has own stored decryptable key → use it,
`own_key`, their cost, NOT metered against shared allowance (own cooldown only); else (b) user is
ADMIN with shared allowance left → shared server key, `shared_admin`, metered per-admin; else (c)
`no_key`, unavailable, no LLM call. **Own-key-first even for admins** (cheaper for owner,
least surprising — an admin with their own key preserves their allowance; "admin prefers shared
while having own" is a PM question §9).

**Isolation (HARD):** resolution + decryption + metering-identity happen at the **orchestration
boundary `main.py`** — exactly where `_resolve_auth`/`_gate_or_response` already resolve the
session. **Preferred shape: resolve in `main.py`, hand the leaf the resolved value object** so
`ai_recommendation.py`'s import surface stays unchanged (decryption co-located with the credential
store on the auth side). The leaf stays one-way: still MUST NOT import
`signals`/`engine`/`live`/`darkpool`/`chain_store`/the bundle path. `opportunity_score` /
`opportunity_tier` / `state_fingerprint` / gate / bundle / SSE remain **byte-identical**, identical
across users/roles/key-presence — none ever sees a key, identity, counter, or admin flag.

## 2. Encryption-at-rest seam (security-critical)
**`UserCredentialStore`** — a fourth storage port mirroring `UserStore`/`SessionStore`/
`UserSettingsStore` in `ports.py`, returned by the same env factory (`AuthStores` +
`_make_memory_stores`). Record (the record IS the contract): owning **user id** (opaque, never the
email); **encrypted ciphertext** of the key (never plaintext); a **non-secret masked hint**
(`set:true`+last-4, stored as cleartext metadata at save time — do NOT decrypt on every read);
created/updated timestamps. Port ops (behavior, not signatures): **set/rotate** (encrypt+store,
overwrite — rotate==overwrite, no history); **get-decrypted** (server-side ONLY, used solely by §1
resolution, never feeds a response); **get-hint** (the only credential thing a response may carry);
**delete** (→ back to `no_key` unless admin allowance applies). **In-memory adapter only** this
phase; persistent adapter = registered **seam, not built** ⇒ encrypted keys reset on restart
(accepted prototype, same as users/sessions).

**Mechanism:** symmetric, **decryptable** (NOT hashing — must recover to call Anthropic). Use
`cryptography` — **Fernet** recommended (authenticated, versioned, no nonce mgmt) or AES-GCM. Keyed
by a **NEW server-side env secret** (conceptually `AI_KEY_ENCRYPTION_KEY`; literal name → PM),
**gitignored**, read **only** inside a new **crypto helper leaf** (sibling of
`passwords.py`/`cookies.py`; imports only stdlib + `cryptography`; never imported by the scoring
path). **Absent-secret = config-gated, no crash** (mirrors `ANTHROPIC_API_KEY`-absent⇒`no_key` and
`GOOGLE_*`-absent⇒disabled): recommended fallback to an **ephemeral per-process key** like
`AUTH_SESSION_SIGNING_KEY` (ciphertext then non-portable/resets on restart — already true); exact
absent UX → PM.

**Security floor — HARD (behavior, enforced structurally):** raw key **NEVER logged** (no log line/
exception/trace dim/observability field — treat ciphertext as secret too); **NEVER returned, NEVER
sent to the browser**; resolution+decryption stay **server-side** (honors CONTEXT §8); once saved
the key is **write-only from the client** (masked hint at most — no reveal/read-back, ever); rotate
== overwrite + delete supported; the decrypted key lives only transiently in memory for one
call, never cached where a response reaches it, never written to the export floor (egress invariant
§6). **New dep: `cryptography`** in `apps/api/requirements.txt` (re-run pip install) — the only new
dep (admin = env, metering = existing pattern).

## 3. Admin determination — MINIMAL (`minimal-admin-not-RBAC`)
**Decision: env allowlist of admin emails** (conceptually `AI_REC_ADMIN_EMAILS`; literal → PM),
matched case-insensitively against `ResolvedSession.user.email` (already in hand at the boundary).
**Why over a user-record flag:** zero schema/store change (pure config read where the email already
is); **survives the reset-on-restart store** (a flag would be wiped with the user rows); trivially
the leanest thing scoped to the one decision (does this user get the shared free allowance?).
**HARD non-goal:** NOT roles/permissions/scopes/admin-UI — read nowhere except the allowance
decision; any broader admin concept is a separate feature/GATE Z.

## 4. Per-identity metering
Today `_RateState` is one **process-global** cap (`AI_REC_DAILY_CAP`) + cooldown
(`AI_REC_COOLDOWN_SECONDS`), local-ET-midnight reset, in-memory. Split into **per-identity**:

- **Shared-allowance meter (admins):** metered **per admin user-id** (NOT email, NOT global) —
  each admin has their own daily counter against the shared key. **Default 3/day per admin**
  (env-tunable; likely its own knob, semantically distinct from today's global cap — name+number →
  PM). A `shared_admin` success **consumes one unit** (mirror `commit_query` — count on success
  only). Reset = the existing local-ET-midnight boundary (`resets_at_iso()`), per counter.
  In-memory ⇒ resets on restart.
- **Own-key calls NOT metered** against the shared allowance (their key, their cost). MAY keep
  **their own per-identity cooldown** (the anti-over-trading rationale, CONTEXT §5).
  **Recommended:** cooldown stays per-identity (one user's calls don't cool down another's);
  whether own-key users get a cooldown at all → PM (§9). Never blocks on a *shared* counter.
- **Best-effort, process-local:** `_RateState` evolves from one global instance into a
  **keyed collection** (one entry per identity key, same lock pattern). A metering fault never
  raises 5xx; at worst a contained status. `reset_rate_state_for_tests()` clears the whole
  collection.

## 5. The four states as a state machine
Boundary resolves auth → key-source → metering; the rec surface returns one of four **outcome
states** (Architect defines states+transitions; wire `status` strings + copy → PM/UX). Every
outcome is **best-effort, ALWAYS HTTP 200 + status**, never 5xx. (The outermost auth gate precedes
all of this: logged-out → 403/503, never reaches resolution — shipped, unchanged.)

| # | Condition (signed-in) | Key source | Outcome | Semantic status |
|---|---|---|---|---|
| a | regular, no own key, 0 allowance | none | unavailable — "connect your key" | `no_key` |
| b | admin, allowance remaining | shared key | produce (expose remaining) | `produced` (metered) |
| c | admin, allowance exhausted, no own key | none | unavailable — "out of free uses, add key" | `over_limit` (admin variant) |
| d | any user with own key | own key | produce (on their key) | `produced` (own, unmetered) |

**Transitions:** a→d / c→d (add own key ⇒ `own_key`, produce; admin in c stops spending allowance);
d→a/c/b (delete own key ⇒ fall back per role+allowance); b→c (last allowance unit consumed); c→b
(reset window passes). The existing **`ai_eval` gate + cooldown stay orthogonal** —
`no_fresh_edge`⇒`gated_off`, cooldown surfaces in gate state. Key-resolution slots into the
EXISTING availability/cap branch (steps 3–4 of `generate_recommendation`), now per-identity.

**Status-vocabulary note (→ PM):** shipped reasons = `{timeout, llm_error, over_cap, no_key}`.
`no_key` (a) already exists. The **admin-allowance-exhausted** state (c) is distinct from "regular
has no key" and from a global cap — Architect's position: give it a **distinguishable** status so
UX renders "out of free uses, add your key" vs. "connect your key". The status surface should
carry an admin's **per-admin remaining count** (mirrors `cap.remaining_today`); regular users have
allowance structurally 0/N/A. Exact strings + field names → PM.

## 6. Restated binding constraints (MUST NOT violate)
- **`[additive-keeps-score-byte-identical]`** — resolution, credential store, crypto helper, admin
  allowlist, per-identity metering stay OUT of signals/scoring/bundle/`state_fingerprint`. Score /
  tier / fingerprint / gate **byte-identical** with/without the feature and identical across
  users/roles/key-presence. No credential/identity/counter is ever a scoring input. Module-import
  boundary = the enforcement.
- **`[best-effort-isolated-or-null]`** (rec-surface carve-out) — key lookup/decryption/LLM
  failure/over-limit/missing-encryption-secret degrades the **rec surface ALONE** to a contained
  status (`no_key`/`over_limit`/`unavailable`), **never 5xx**, never breaks bundle/SSE/chart/
  tracker. The **manual export floor** (`GET …/export`) keeps working (no LLM, no key needed). The
  auth-gate 403/503 on the POST is the deliberate auth-error-class carve-out.
- **`[no-real-order-path]`** — unaffected; Accept-into-ghost-trade stays SIMULATED + confirm.
- **Security floor (HARD §2)** — encrypt-not-hash; server-side gitignored secret; raw key never
  logged/returned/browser-sent; write-only (masked hint); rotate+delete; server-side decryption.
- **CONTEXT §8** — LLM stays external/advisory/consumer-only: never feeds
  signals/score/tier/gate/fingerprint, never recomputes/fetches, never rides SSE, never auto-acts;
  the (now per-user) key never reaches the browser. **`RecExport` egress invariant restated:**
  export carries context + persona prompt + glossary ONLY — no key, no other ticker, no identity,
  no order data.
- **`[minimal-admin-not-RBAC]`** (new §3) — admin = contained env allowlist for THIS allowance
  only.
- **`system-6` Security/red-team DEFERRED** by owner — encrypt+hygiene floor (§2) now; full
  credential-custody red-team re-fires at the persistent/multi-user/public go-live trigger.

## 7. Data-flow (summary)
```
Browser (signed-in) ── set/rotate/delete own key (write-only; only masked hint returns) ─┐
main.py (boundary — only importer of both leaves):                                        ▼
  1. auth gate (shipped): resolve session → user{id,email} | 403/503
  2. resolve key-source: own decryptable key? → own_key (own cooldown only)
                         else admin (email in allowlist) AND per-admin allowance? → shared_admin
                         else → no_key
  3. build resolved-key value object (no raw key in any logged/serialized field)
ai_recommendation.py (ONE-WAY LEAF, imports unchanged): generate_recommendation(...resolved obj...)
   existing order: gate → cap/allowance (now per-identity) → availability(no_key) → LLM → produced
   on shared_admin success: commit ONE unit to that admin's meter
LLMProvider (Anthropic | Stub): key used transiently, never persisted/returned
auth side (new leaves, never imported by scoring): UserCredentialStore port + in-mem adapter
   (ciphertext + masked hint); crypto helper (Fernet/AES-GCM, keyed by env)  ← sibling of passwords.py
```
Stores + metering: in-memory, reset on restart, best-effort. Decryption + resolution: server-side
only. Browser: sends a key (write), receives a masked hint (read).

## 8. Explicit non-goals
No general RBAC/roles/permissions; no persistent DB adapter (`UserCredentialStore` = seam +
in-memory only, keys reset on restart); no provider beyond Anthropic (but keep the seam
provider-agnostic-friendly); no real-order path; no red-team build (`system-6` deferred); no key
reveal/read-back (write-only, masked hint); no in-app LLM reassessment / token streaming /
acceptance analytics / vendor-model swap (those stay the separately-deferred ai-rec seams,
OPEN_THREADS §7b).

## 9. Open questions for the PM
1. **Four-state copy** — wording for a/b/c/d ("connect your key", "N free uses left", "out of free
   uses, add your key", produced).
2. **Masked-reveal UX** — what the hint shows (last-4 / set:true / updated-at), rotate/delete
   presentation, absent-encryption-secret surface.
3. **Allowance number + env names** — confirm 3/day per admin; literal names for the allowance, the
   admin allowlist, and the encryption secret (conceptual here:
   `AI_KEY_ENCRYPTION_KEY`/`AI_REC_ADMIN_EMAILS`/per-admin knob).
4. **Settings placement** — where BYO-key entry lives within the existing per-user Settings.
5. **Admin remaining count** — does the status surface expose remaining free uses (and only to
   admins)? Does a regular user see anything about allowance, or only "connect your key"?
6. **Wire status vocabulary** — admin-exhausted (c) reuses `over_cap`/`over_limit` or a distinct
   value (Architect recommends distinct); the field carrying per-admin remaining count.
7. **Own-key cooldown** — do own-key users get a per-identity cooldown, or is cooldown only on the
   shared path?
8. **Admin own-key preference** — default own-key-wins (§1); confirm, or allow an admin to prefer
   the shared key? (Architect default: own-key-wins, no override this phase.)
9. **Endpoint shape & field names** — the credential set/rotate/delete + masked-hint surface and
   the resolution wiring into `/api/recommendation/*` are PM (signatures) + executioner (internal
   names); this contract fixes behavior only.

---

## PM HANDOFF — 5 bullets
- **What this is:** a hybrid BYO-key model on the EXISTING isolated ai-rec leaf — per-request key
  resolution (own key → admin shared-allowance → no_key), encrypt-at-rest credential store,
  minimal env-allowlist admin, per-identity metering. Score/bundle/SSE byte-identical and
  untouched; everything is additive on the AI-rec surface only.
- **Three pivotal calls locked:** (1) resolve key+provider PER REQUEST in `main.py` (the boundary),
  hand the leaf a resolved value object — leaf imports unchanged; (2) new `UserCredentialStore`
  port + in-memory adapter storing **encrypted** ciphertext (Fernet via the new `cryptography`
  dep, keyed by a gitignored server-side secret) + a non-secret masked hint, **write-only from the
  client**, rotate/delete supported, server-side decryption only; (3) **admin = env email
  allowlist** (`minimal-admin-not-RBAC`), allowance metered **per-admin** (default 3/day),
  own-key calls unmetered.
- **Four states for you to turn into ACs + copy:** (a) regular/no-key/0 → `no_key` "connect your
  key"; (b) admin/allowance-left → produced + remaining count; (c) admin/exhausted/no-key →
  admin-exhausted "out of free uses, add your key"; (d) any/own-key → produced (their key,
  unmetered). All best-effort, **always HTTP 200 + status, never 5xx**; the existing auth gate
  (403/503) + `ai_eval` gate + cooldown stay orthogonal and unchanged.
- **Hard floors you must preserve in ACs:** raw key never logged/returned/browser-sent (write-only,
  masked hint at most); the export floor keeps working keyless; CONTEXT §8 (key server-side only) +
  the `RecExport` egress invariant (no key/identity in the export); SIMULATED-only (no order path);
  encrypted-not-hashed; in-memory ⇒ resets on restart (accepted). `system-6` red-team deferred.
- **Decisions I left to you (§9):** all copy, the masked-reveal UX, the literal allowance number +
  env-name strings, Settings placement, what admins vs. regular users see re: allowance, the wire
  status vocabulary (recommend a distinct value for admin-exhausted + a per-admin remaining-count
  field), whether own-key users get a cooldown, and the admin own-key-vs-shared preference
  (Architect default: own-key-wins). Endpoint signatures + payload field names are yours.
