# byo-ai-key — FRONTEND EXECUTION CONTRACT (→ apps/dashboard)

> Compressor #3 output 3 of 3. The frontend lane's build sheet. References INTERFACE_CONTRACT.md (the
> fields the UI consumes) + UX_BLUEPRINT.md (states + exact copy + the AC↔state matrix). Implements the
> client-side half of the five states + the Settings AI-key section. The key is entered and sent but
> the masked hint is all that's ever read back. Stay in lane: rendering + client behavior; no server
> internals.

EXTENDS the shipped `apps/dashboard/src/app/ai-rec/*` (`AiRecPanel`, `useAiRecommendation`, `copy.ts`)
and `apps/dashboard/src/app/auth/SettingsPage.tsx` + `copy.ts`. Adds new `@org/api` client functions +
types for the credential endpoints + the extended rec fields. Does NOT touch the bundle/SSE/score path
(`getTicker`/`streamTicker` gain no header/param — AC-14).

---

## 1. `@org/api` client additions  (libs/api/src/lib/convexa.ts)

- **Types:** extend `RecResponse` + `RecStatus` with `key_source?: 'own_key'|'shared_admin'|'none'`,
  `remaining_free_uses?: number | null`, `free_uses_total?: number | null`. The `unavailable_reason`
  string gains the recognized values `'no_key' | 'over_limit' | 'shared_key_unconfigured'` (the FE maps
  these to states a/c/e). NEVER add a `key` field anywhere (AC-10).
- **New `AiKeyStatus` type:** `{ set: boolean; last4: string | null; storage_available: boolean }`.
- **New client fns** (all `credentials:'same-origin'`, auth-class error handling via the shipped
  `toAuthError`, mirroring `simTradeGate`):
  - `getAiKeyStatus(): Promise<AiKeyStatus>` — `GET /api/auth/ai-key` (masked-hint read).
  - `setAiKey(key: string): Promise<AiKeyStatus>` — `PUT /api/auth/ai-key`, body `{key}` (the ONLY call
    that sends a raw key; browser→server only). Returns the masked status — NEVER the key.
  - `removeAiKey(): Promise<AiKeyStatus>` — `DELETE /api/auth/ai-key`.
  - A 403 ⇒ `AuthError('auth_required')`; the FE shows the section sign-in prompt. The key value is
    NEVER stored in React state beyond the in-flight submit; clear the input on success.

---

## 2. AiRecPanel — the five key-resolution states  (UX_BLUEPRINT §3)

Render exactly one body/action state per request, layered AFTER the shipped auth gate +
in-app-off state (UX_BLUEPRINT §2). Drive off `rec.status` + `rec.unavailable_reason` + `rec.key_source`
+ `rec.remaining_free_uses` / `free_uses_total` (and the same on the status read for pre-render).

- **(a) `no_key`** → `ai-rec-state-no-key` CTA block (`byoKey.noKey.*`), button `ai-rec-add-key-cta` →
  Settings. No counter, no rec, no "free/trial" text.
- **(b) produced + `key_source:shared_admin`** → existing `RecResult` UNCHANGED + a subordinate
  `ai-rec-free-uses` chip `freeUsesChip(remaining,total)` in the provenance row + its tooltip.
- **(c) `over_limit` (admin)** → `ai-rec-state-admin-exhausted` block (`byoKey.adminExhausted.*`),
  button `ai-rec-add-key-cta`. Copy + testid DISTINCT from (a) and (e).
- **(d) produced + `key_source:own_key`** → existing `RecResult` UNCHANGED + a subordinate
  `ai-rec-own-key` chip `OWN_KEY_CHIP` ("Using your key") + tooltip. NO free-uses chip.
- **(e) `shared_key_unconfigured`** → `ai-rec-state-shared-unconfigured` block
  (`byoKey.sharedUnconfigured.*`), button `ai-rec-add-key-cta`. Copy + testid DISTINCT from (a)/(c).

The "View what's sent" export control stays present in ALL five states (AC-23). The auth gate +
in-app-off states precede all five (logged-out NEVER shows a–e — AC-22). Add the new strings to
`ai-rec/copy.ts` under a `byoKey` block (verbatim from UX_BLUEPRINT §5) — do not improvise.

The "Add your key in Settings" CTA navigates to the Settings route (React Router) and ideally deep-links
the AI-key section. The rec is STILL a static artifact (the hook fires no query on poll/SSE — unchanged).

---

## 3. Settings AI-key section  (UX_BLUEPRINT §4)

A new section appended INSIDE `SettingsPage`, below Theme; heading "AI key" (`settings-ai-key-section`).
Drive its Empty/Set/storage-unavailable state from `getAiKeyStatus()` (read on mount + after each
mutation). Signed-in only; anonymous ⇒ the `settings-ai-key-anonymous` sign-in prompt.

- **Empty** (`set:false`, `storage_available:true`) → `settings-ai-key-empty`: a `type="password"` input
  (`settings-ai-key-input`) + "Add key" button (`settings-ai-key-add`). On submit: client-validate
  (empty → `validationEmpty`; soft format warn → `validationFormat`), call `setAiKey`, clear the input,
  re-read status, success toast `settings-ai-key-saved` "AI key saved.".
- **Set** (`set:true`) → `settings-ai-key-set`: masked display `settings-ai-key-masked`
  `maskedKeyLabel(last4)` + sub-line; **Replace** (`settings-ai-key-replace`) → the Replace form
  (overwrites; AC-8) + **Remove** (`settings-ai-key-remove`) → the Remove confirm
  (`settings-ai-key-remove-confirm`, btn `settings-ai-key-remove-confirm-btn`). NO reveal/show/copy
  control exists — assert its absence (AC-7/10).
- **Replace form** → input + "Replace key" + Cancel; on success the masked hint reflects the NEW last-4.
- **storage-unavailable** (`storage_available:false`) → `settings-ai-key-storage-unavailable` info note,
  input disabled, never an error/5xx (AC-18).
- **Save error** (transport fault on set/remove) → `settings-ai-key-error` "Couldn't save your key.
  Please try again." (NEVER echoes the key). Remove success toast: "AI key removed.".

Add the new strings to `auth/copy.ts` under `settings.aiKey` (verbatim from UX_BLUEPRINT §5). The input
value lives only in local component state during the submit and is cleared on success — never persisted,
never logged, never put in any other state (AC-10/12).

---

## 4. Isolation + invariants the FE upholds
- The AiRecPanel failure NEVER blanks the GEX chart, neutral tiles, off-exchange blocks, ghost-trade
  tracker, or the live stream (the panel is an isolated sibling card — shipped; preserve — AC-15).
- The bundle/SSE/score path is untouched — no new header/param on `getTicker`/`streamTicker`; the panel
  renders the same `opportunity_score`/`opportunity_tier`/`state_fingerprint` regardless of key path
  (AC-14). The provenance chips read ONLY `key_source` (never a score field).
- The export floor ("View what's sent") works keyless in every state, signed-in or anonymous
  (AC-13/22/23) — unchanged shipped behavior; assert it stays present.
- No raw key ever appears in the DOM, in any rendered response, or in `console` (AC-10/12).

---

## 5. Tests to write (the REQUIRED set — a FLOOR, not a ceiling)

The FE does NOT choose the requirement set. The following enumerates every required case
(each AC × component state × edge/invariant) from UX_BLUEPRINT §7. Each is a NAMED test in
`byo-ai-key.spec.tsx` (component + flow-integration), mocking ONLY the network boundary (the `@org/api`
fns / `fetch`). QA enforces AC↔test traceability at GATE Q — every AC maps to ≥1 named passing test.

**Core key-resolution states (AiRecPanel):**
1. **AC-1** `renders no-key CTA for a regular user` — `status:unavailable`+`no_key`, regular ⇒
   `ai-rec-state-no-key` visible, NO `ai-rec-free-uses`, no rec body, CTA → Settings, copy contains no
   "free"/"trial".
2. **AC-2** `renders rec + free-uses chip for an admin with allowance; chip decrements` — `produced`+
   `shared_admin`, `remaining_free_uses:3,total:3` ⇒ rec body + chip "3 of 3 free uses left today";
   a second produced shared rec returning `2` ⇒ chip "2 of 3…".
3. **AC-3** `renders distinct admin-exhausted state` — `over_limit` admin ⇒ `ai-rec-state-admin-exhausted`,
   no rec; assert its copy/testid DIFFER from `ai-rec-state-no-key` (a) and `ai-rec-state-shared-unconfigured` (e).
4. **AC-4** `renders rec + "Using your key" chip for own-key` — `produced`+`own_key` ⇒ rec body +
   `ai-rec-own-key` chip, NO `ai-rec-free-uses`.
5. **AC-5** `admin own-key shows own-key chip and does not change free count` — admin `produced`+`own_key`
   ⇒ `ai-rec-own-key` present, `ai-rec-free-uses` absent, `remaining_free_uses` unchanged across the call.
6. **AC-6** `regular user with a key gets a rec (BYO works for non-admins)` — regular `produced`+`own_key`
   ⇒ rec body (d), proving non-admin usability.
24. **AC-24** `renders shared-key-unconfigured CTA for an admin with no shared key` — `shared_key_unconfigured`
   admin, no own key ⇒ `ai-rec-state-shared-unconfigured`, no rec, NO `ai-rec-free-uses`; DISTINCT from (a)/(c).
25. **AC-25** `admin from (e) adds own key → gets a rec on their key (e→d)` — flow: (e) state, then key
   set → next request `produced`+`own_key` (d). Shared-key absence never blocks an own-key user.
26. **AC-26** `shared key later configured → admin allowance becomes usable (e→b)` — flow: (e) state, then
   next request `produced`+`shared_admin`+`remaining_free_uses` ⇒ (b) with the free-uses chip, no own key.

**Key management (Settings):**
7. **AC-7** `add key → set + masked hint; no reveal control; full key never in DOM` — Empty → enter key →
   `settings-ai-key-set` + `settings-ai-key-masked` "Key set ···· 1234"; assert NO reveal/show/copy
   control; assert the typed key is absent from the DOM after submit.
8. **AC-8** `replace key → overwrites + new hint; next rec uses new key` — Set → Replace → new key ⇒
   masked hint shows the NEW last-4; a subsequent request resolves `own_key` produced; no old-key history.
9. **AC-9** `remove key → Empty; regular next rec → CTA (a); admin → (c)/(e)` — Set → Remove confirm →
   `settings-ai-key-empty`; then regular next rec ⇒ (a); admin with shared key ⇒ (c); admin without ⇒ (e).

**Egress / security floor (boundary assertions):**
10. **AC-10** `key never returned to the browser` — across set/replace/status/rec-on-own-key, the mocked
    responses carry at most `set`/`last4`/masked hint; assert no `key`/`api_key` field reaches the FE and
    no raw key is in the DOM.
12. **AC-12** `key never in any browser payload on the rec path` — produced-on-own-key ⇒ the request body
    (mock capture) + the response carry rec+status+identifiers only; no key field.
13. **AC-13** `export floor carries no key / no identity` — the `RecExport` artifact = context +
    persona_prompt + glossary + egress_note ONLY; assert no key/identity/other-ticker/order field; the
    egress note renders verbatim.
23. **AC-23** `manual export works keyless for any signed-in no-key user` — regular (a), admin-exhausted
    (c), shared-unconfigured (e) ⇒ "View what's sent" present + produces export, no rec, no key.

**Score / isolation invariants:**
14. **AC-14** `score + fingerprint byte-identical across key paths (FE)` — render the panel against a fixed
    bundle under each of (a)/(b)/(c)/(d)/(e); assert the page's `opportunity_score`/`opportunity_tier`/
    `state_fingerprint` rendering is identical; assert `getTicker`/`streamTicker` got no new header/param.
15. **AC-15** `a rec-surface failure degrades the panel alone` — an `unavailable` (key/decrypt/LLM/limit)
    ⇒ contained status in the panel; the GEX chart, neutral tiles, off-exchange blocks, ghost-trade
    tracker, and live stream keep rendering (assert their test surfaces still present).

**Degraded / edge / transition (each its own named test):**
16. **AC-16** `decrypt-failure renders unavailable per role, not a rec` — a stored key that the server
    reports unusable ⇒ regular (a) / admin (c)/(e) fallback, no rec; no key/ciphertext in the FE.
17. **AC-17** `LLM error/timeout → unavailable, shared count not consumed` — `unavailable` on a shared call
    ⇒ unavailable panel state, page intact; the next observed `remaining_free_uses` is unchanged.
18. **AC-18** `encryption-secret-absent → graceful Settings, no crash` — `storage_available:false` ⇒
    `settings-ai-key-storage-unavailable`, input disabled, no thrown error; (and the ephemeral-accept
    variant: normal Empty/Set flow when `storage_available:true`).
19. **AC-19** `admin removed from allowlist → CTA unless own key` — admin-dropped ⇒ (a) regular-no-key
    CTA; with own key ⇒ (d) produced.
20. **AC-20** `store reset on restart → no stale "set" hint` — `getAiKeyStatus` returns `set:false` after
    restart ⇒ `settings-ai-key-empty` (no "Key set ···· " shown); rec shows role no-key behavior, no error.
21. **AC-21** `exhausted admin adds key mid-day → immediate rec, count untouched (c→d)` — flow: (c) →
    key set → next request `produced`+`own_key` (d); free count not affected.
22. **AC-22** `logged-out hits the auth gate, never a key state` — logged-out ask-AI ⇒ `ai-rec-auth-gate`/
    `ai-rec-signin-prompt`, assert NONE of `ai-rec-state-no-key`/`ai-rec-free-uses`/
    `ai-rec-state-admin-exhausted`/`ai-rec-own-key`/`ai-rec-state-shared-unconfigured` render; export floor
    stays anonymous-usable.

**Distinctness (the PRODUCT_CONTRACT §6 hard requirement) — one consolidated test:**
- **AC-1/3/24** `the three CTA states are observably distinct` — render (a), (c), (e); assert distinct
  testids AND distinct title/body copy (none frames a free trial; (c) implies daily renewal).

Note: AC-11 (key never logged) is a BACKEND-only proof (log scan) and is enumerated in the BACKEND
contract §9; the FE has no log surface to assert it. AC-14's byte-identical score PROOF and AC-16/19/20's
server-side resolution are co-verified on the backend; the FE tests above assert the rendered FE half.
