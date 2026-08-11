# byo-ai-key — INTERFACE CONTRACT (FE ↔ BE truth)

> Compressor #3 output 1 of 3. The single FE↔BE seam: the new credential endpoints + the extended
> rec-endpoint `status`/key-source/remaining-uses fields. Derived from UX_BLUEPRINT §3/§4/§6 +
> PRODUCT_CONTRACT §4/§5/§7 + ARCHITECTURE_CONTRACT §1/§2/§5. Field names below are the contract of
> record for both lanes. Behavior (not internal types) is fixed; the BE owns server internals, the FE
> owns rendering. EXTENDS the shipped ai-rec interface (`@org/api` `RecResponse`/`RecStatus`/`RecExport`)
> + the auth interface (`/api/auth/*`) — it does not replace them.

This feature is **additive on the AI-rec + Settings surfaces only**. The bundle/SSE/score path
(`getTicker`/`streamTicker`) is UNTOUCHED — no new header, no new param, no new field there (AC-14).

---

## 1. Credential endpoints (NEW — `/api/auth/ai-key/*`)

All three sit behind the EXISTING auth gate (signed-in only; anonymous ⇒ 403 `auth_required`,
mirroring the shipped auth-error class). The session is resolved server-side from the HTTP-only cookie
— the request body NEVER carries identity. These are a separate concern from the bundle/SSE path.

### 1.1 SET / REPLACE (write-only) — `PUT /api/auth/ai-key`
- **Purpose:** store (or overwrite — rotate == overwrite, no history) the user's Anthropic key.
- **Request body:** `{ "key": "<the raw Anthropic key>" }` — the key in the body (write-only). This is
  the ONLY request that carries a raw key, and it travels browser→server only.
- **Response (200):** the masked status shape — **NEVER echoes the key**:
  ```
  { "set": true, "last4": "1234", "storage_available": true }
  ```
  The response MUST NOT contain the raw key, the ciphertext, or any field from which the key is
  recoverable (AC-10). `last4` is the only credential datum returned.
- **Errors:** 403 `auth_required` (not signed-in); 422 `validation` (empty/obviously-malformed key —
  the FE also soft-validates); the storage-unavailable case returns **200** `{ "set": false,
  "storage_available": false }` (NEVER a 5xx — AC-18), not an error, so the FE shows the honest
  storage-unavailable note. A transport fault ⇒ the FE save-error toast.

### 1.2 DELETE / REMOVE (write/mutate) — `DELETE /api/auth/ai-key`
- **Purpose:** delete the stored key (→ role no-key behavior on the rec surface).
- **Request:** empty body; session from cookie.
- **Response (200):** `{ "set": false, "storage_available": true }`.
- **Errors:** 403 `auth_required`. Idempotent — removing when none is set is still 200 `set:false`.

### 1.3 STATUS-OF-KEY (read — masked hint only, NEVER the key) — `GET /api/auth/ai-key`
- **Purpose:** drive the Settings section Empty/Set state. This is a READ that returns at most a masked
  hint + a "set" flag — it can NEVER return the key (the server cannot reveal it; AC-10).
- **Response (200):**
  ```
  { "set": false, "last4": null, "storage_available": true }      // Empty state
  { "set": true,  "last4": "1234", "storage_available": true }    // Set state (masked)
  { "set": false, "last4": null, "storage_available": false }     // storage unavailable (AC-18)
  ```
  - `set` (boolean) — a key is stored.
  - `last4` (string|null) — last-4 masked hint; non-null ONLY when `set:true`. The ONLY credential
    datum ever read back. NEVER the full key, NEVER ciphertext.
  - `storage_available` (boolean) — false ⇒ Settings storage-unavailable variant.
- **Errors:** 403 `auth_required` (anonymous ⇒ the FE shows the section's sign-in prompt).

### 1.4 Egress floor (HARD, restated) — applies to ALL three
The raw key is **NEVER** in any response body (1.1/1.2/1.3 return only `set`/`last4`/
`storage_available`), **NEVER** logged, **NEVER** sent to the browser. Resolution + decryption are
server-side only. (AC-10/11/12; PROJECT_CONTEXT §8; ARCHITECTURE §2 security floor.)

---

## 2. Extended rec endpoints (EXISTING — `/api/recommendation/*`, fields added)

The shipped `POST /api/recommendation/{ticker}`, `GET …/export/{ticker}`, `GET …/status/{ticker}` keep
their shapes; the feature ADDS fields. Every rec/status outcome stays **best-effort, ALWAYS HTTP 200 +
status, never 5xx** (a 403/503 is only the OUTERMOST shipped auth gate, unchanged — AC-22). The
per-request key resolution (own → admin-shared-if-configured → none) happens server-side at the
`main.py` boundary; the FE reads only the result fields below.

### 2.1 `POST /api/recommendation/{ticker}` — added response fields
The shipped `RecResponse` gains:
- **`key_source`**: `"own_key" | "shared_admin" | "none"` — which key produced the rec (or none on an
  unavailable). Drives the provenance chip: `own_key` → "Using your key" (state d); `shared_admin` →
  free-uses chip (state b); `none` → no chip (a/c/e). NEVER a scoring input (AC-14).
- **`remaining_free_uses`**: `number | null` — present (≥0) ONLY for an ADMIN identity on a
  shared-key-CONFIGURED path; `null`/absent for regular users and for own-key/shared-unconfigured paths
  (a regular user NEVER carries a counter — PRODUCT_CONTRACT §6). On a produced shared rec, this is the
  count AFTER the decrement; an LLM-failed shared call does NOT decrement (AC-17).
- **`free_uses_total`**: `number | null` — the per-admin allowance (default 3), for the "{remaining} of
  {total}" copy; present whenever `remaining_free_uses` is.
- **`unavailable_reason`** (existing field) gains two distinguished values the FE keys off:
  - `"no_key"` — state (a): regular, no own key. (Existing value, reused.)
  - `"over_limit"` — state (c): admin, shared key configured, allowance exhausted, no own key.
    (Distinguished from the shipped GLOBAL `cap.over_limit` by the admin context + `remaining_free_uses:0`.)
  - **`"shared_key_unconfigured"`** (NEW distinct value) — state (e): admin, no shared key configured,
    no own key. Distinct from `no_key` (a) and `over_limit` (c) per PRODUCT_CONTRACT §7. The
    `unavailable_reason` MUST NEVER contain key text (AC-16 floor).
- The raw key NEVER appears in the request body or the response (the POST body carries only the existing
  identifiers + gating context — AC-12). Resolution/decryption stay server-side.

### 2.2 `GET …/status/{ticker}` — added field
The shipped `RecStatus` gains (for an authenticated request):
- **`remaining_free_uses`**: `number | null` — same semantics as 2.1, so the panel can pre-render an
  admin's count before requesting. `null`/absent for regular users (no counter).
- **`free_uses_total`**: `number | null` — the allowance, when applicable.
- The status read does NOT pre-commit a free use (side-effect-free, 200).

### 2.3 `GET …/export/{ticker}` — UNCHANGED (egress floor restated)
The `RecExport` shape is unchanged. The egress invariant is HARD: the export carries context +
persona prompt + glossary + egress_note ONLY — **no API key, no identity, no other ticker, no order
data** (AC-13). The export floor works keyless for any signed-in user incl. states (c)/(e) (AC-23) and
stays anonymous-usable (AC-22). No new field; the existing `egress_note` already states no key leaves.

---

## 3. State → wire mapping (the 5 states, observable)

| State | rec `status` | `key_source` | `unavailable_reason` | `remaining_free_uses` | Produces rec |
|---|---|---|---|---|---|
| (a) regular no key | `unavailable` | `none` | `no_key` | null/absent | No |
| (b) admin, shared, allowance | `produced` | `shared_admin` | — | N (≥0, post-decrement) | Yes |
| (c) admin, shared, exhausted | `unavailable` | `none` | `over_limit` | 0 | No |
| (d) any own key | `produced` | `own_key` | — | null/absent | Yes |
| (e) admin, no shared key | `unavailable` | `none` | `shared_key_unconfigured` | null/absent | No |

All five are HTTP 200. The auth gate (logged-out ⇒ 403/503) precedes all five and is NEVER one of them
(AC-22). The shipped `ai_eval` gate + cooldown + global cap remain orthogonal and unchanged; on the
shared path the per-admin allowance is an ADDITIONAL precondition (PRODUCT_CONTRACT §3).

---

## Conformance spec

Machine-checkable (system-1) shapes live in the STANDALONE runnable file
**`.claude/tools/conformance/byo-ai-key.json`** (flat `{method,path,path_params,query,body,required}`
schema `interface_conformance.py` executes — same standalone convention as
`conformance/user-accounts.json` + `conformance/ai_recommendations.json`; system-12). This embedded
block is the human-readable truth; the JSON is its runnable projection.

**What the tool CAN assert (statically-checkable, environment-INDEPENDENT shapes):**
1. **Key-status read for an authenticated request** — `GET /api/auth/ai-key` returns the masked-hint
   shape `{ set:boolean, last4:string|null, storage_available:boolean }` and NEVER a `key` field. (The
   probe must carry a session cookie from a fresh signup, exactly like the user-accounts signed-in
   probes — see the JSON `_comment` for the bootstrap.)
2. **Rec `status` read shape** — `GET /api/recommendation/status/{ticker}` carries the existing
   `availability`/`gate`/`cap` plus the additive `remaining_free_uses` / `free_uses_total` as
   `number|null` (presence+type invariant; value is env-dependent).
3. **Export egress shape** — `GET /api/recommendation/export/{ticker}` carries
   `{ticker, as_of, context, persona_prompt, glossary, egress_note}` and NO `key`/identity field
   (AC-13 boundary, statically checkable).

**What the tool CANNOT assert (environment-DEPENDENT — verified by FE/BE tests, NOT the tool):**
- The 5 produced/unavailable variants (a–e) — each depends on key state (own key set? admin? shared
  key configured? allowance left?), which the cookieless/static tool cannot drive. Verified by the
  BACKEND runtime proofs (per-state resolution, metering, decrypt-fail, byte-identical score, log scan)
  + the FRONTEND component/flow tests (the §7 matrix). The auth-gated `POST /api/recommendation/{ticker}`
  + the `PUT`/`DELETE` credential mutations are NOT in the anonymous sweep (they require a session and
  mutate state) — verified under the signed-in tests, same as the user-accounts precedent.
- The absent-key value (`last4`) — env-dependent; only `set`/`last4`/`storage_available` PRESENCE +
  TYPE are asserted, never a specific value.

**HARD negative invariant the tool + tests both enforce:** NO response from any of these endpoints ever
contains a `key`/`api_key`/ciphertext field (AC-10) — the conformance `required` map asserts the
masked-hint fields are present and the runtime/log proofs (BE) assert the raw key is absent everywhere.
