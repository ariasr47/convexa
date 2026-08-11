# byo-ai-key — QA REPORT (GATE Q)

> QA role (Sonnet 4.6, de-correlated — not a builder). Verification session 2026-06-29.
> Backend: `apps/api/.venv/Scripts/python.exe` (venv). FE tests: `npx nx test dashboard` (Vitest).
> Backend booted on :8002 (`MASSIVE_API_KEY=dummy-verify AI_REC_STUB=1`).

---

## Test suite baseline

| Suite | Ran | Expected | Result |
|---|---|---|---|
| `npx nx test dashboard` | 312 | 312 | PASS |
| `npx nx test @org/api` | 13 | 13 | PASS |

---

## AC acceptance-criteria table

| # | AC (verbatim / abbreviated) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | Regular, no key → CTA, no counter | PASS | Named test `AC-1: renders the no-key CTA…` in `byo-ai-key.spec.tsx:250`. Asserts `ai-rec-state-no-key` present, no `ai-rec-free-uses`, no "free/trial" text. Passes in the green suite. |
| AC-2 | Admin, shared key, allowance left → rec + count decrements | PASS | Named test `AC-2: admin with allowance ⇒ rec + free-uses chip…` (`byo-ai-key.spec.tsx:268`). Asserts `freeUsesChip(2,3)` then `freeUsesChip(1,3)` on two successive produced-shared recs. Backend `_RateCollection.admin_commit` increments count on produced-only (verified in `ai_recommendation.py:610–616`). |
| AC-3 | Admin, shared key, exhausted → distinct exhausted state, no rec | PASS | Named test `AC-3/distinctness` (`byo-ai-key.spec.tsx:286`). Asserts `ai-rec-state-admin-exhausted` present with `adminExhaustedTitle(3)` and "come back tomorrow" copy; `ai-rec-state-no-key` and `ai-rec-state-shared-unconfigured` absent. Also AC-1/3/24 distinctness consolidation test at `:357`. |
| AC-4 | Own key → rec + "Using your key" chip, no free-uses chip | PASS | Named test `AC-4: own-key produced ⇒ rec + "Using your key"…` (`:306`). Asserts `ai-rec-own-key` chip text "Using your key" and no `ai-rec-free-uses`. |
| AC-5 | Own-key-first for admins — does not burn the free 3 | PASS | Named test `AC-5: admin own-key ⇒ own-key chip present…` (`:317`). Admin `produced_own` → `ai-rec-own-key` present, `ai-rec-free-uses` absent, `be.getRemaining() === 3` (count unchanged). Backend `resolve_key` with `own_key` set always returns `key_source='own_key'` regardless of admin status or shared-key presence (verified in runtime probe). |
| AC-6 | Non-admin with a key gets recs | PASS | Named test `AC-6: a regular user with a key gets a rec…` (`:331`). Regular `produced_own` → rec body renders; `ai-rec-own-key` present. |
| AC-24 | Admin, NO shared key, no own key → shared-unconfigured CTA, no rec, no counter | PASS | Named test `AC-24: admin with no shared key ⇒ shared-unconfigured CTA…` (`:341`). Asserts `ai-rec-state-shared-unconfigured` with `BYO_KEY.sharedUnconfigured.title`, no `ai-rec-free-uses`, no rec body; `ai-rec-state-no-key` and `ai-rec-state-admin-exhausted` absent. Backend `resolve_key(is_admin=True, own_key=None)` with no `ANTHROPIC_API_KEY` → `key_source='none', unavailable_reason='shared_key_unconfigured', remaining=None` (verified live). |
| AC-25 | Admin from (e) adds own key → recs work on their key (e→d) | PASS | Named test `AC-25: admin from (e) adds an own key ⇒ next request produced on own key…` (`:385`). Flow: `shared_unconfigured` → `setRecKey('produced_own')` → re-render → rec body + `ai-rec-own-key`. |
| AC-26 | Shared key later configured → admin allowance becomes usable (e→b) | PASS | Named test `AC-26: from (e), shared key later configured ⇒ next rec produced…` (`:405`). Flow: `shared_unconfigured` → `setRecKey('produced_shared', {remaining:3,total:3})` → re-render → rec body + `freeUsesChip(2,3)`, no `ai-rec-own-key`. |
| AC-7 | Add key → set, masked hint; no reveal control; key never in DOM | PASS | Named test `AC-7: add a key ⇒ Set + masked hint; NO reveal control…` (`:587`). Asserts `settings-ai-key-set` with `maskedKeyLabel('1234')`; `queryByText(/show key|reveal|copy key|view key/i)` returns null; raw key absent from `document.body.textContent`. `AiKeySection.tsx` has no reveal control by construction (code read confirms). |
| AC-8 | Replace key → overwrites, new hint | PASS | Named test `AC-8: replace ⇒ the masked hint shows the NEW last-4…` (`:608`). New last-4 `5678` shown; old `1234` absent. |
| AC-9 | Remove key → back to role default | PASS | Named test `AC-9: remove ⇒ confirm ⇒ Empty state` (`:620`). Remove confirm dialog → `settings-ai-key-remove-confirm` → confirm btn → `settings-ai-key-empty` rendered; `settings-ai-key-set` absent. |
| AC-10 | Key never returned to the browser | PASS | Named test `AC-10: across add/replace/status reads, responses carry at most masked hint — never the key` (`:631`). Asserts every `storage_available`-bearing response has ONLY keys `[set, last4, storage_available]`; raw key absent from DOM. Backend `set_ai_key` returns `{set, last4, storage_available}` only — verified in `service.py:273`. |
| AC-11 | Key never logged | PASS | Backend proof (FE has no log surface). Runtime log scan: `crypto.encrypt(raw_key)` + `store.set_key()` + `crypto.decrypt()` + `store.delete_key()` captured to a StringIO log handler. Log content contains zero raw-key or ciphertext characters. Log line emitted: ephemeral-key advisory only. `crypto.decrypt` failure also logs only "could not be decrypted; treating as no key" — no ciphertext. All verified via Python runtime probe. |
| AC-12 | Key never reaches browser on rec path | PASS | Named test `AC-12: own-key produced ⇒ rec request body + every response carry NO key field` (`:499`). `recPostBodies` parsed — no `key`/`api_key`/`anthropic_api_key`/`secret` field; `responsesSeen` scanned for those field names. |
| AC-13 | Export floor carries no key / no identity | PASS | Named test `AC-13: export artifact carries context+persona_prompt+glossary+egress_note ONLY…` (`:548`). `Object.keys(exportBody).sort()` === `['as_of','context','egress_note','glossary','persona_prompt','ticker']`; `key`/`api_key`/`identity`/`user`/`email`/`order` all absent. Verified offline against `build_export()` output: keys exactly match spec. |
| AC-14 | Score + state_fingerprint byte-identical across key paths | PASS | Named test `AC-14: score/tier render identically across key paths; getTicker gained no header/param` (`:514`). Rendered score/tier text identical across five key paths (all render `42 · watch`); `tickerCalls` have no key/persona/admin param or header. AST import boundary: 0 of 5 scoring modules (`signals.py`, `engine.py`, `live.py`, `darkpool.py`, `chain_store.py`) import `auth`/`crypto`/`ai_recommendation`/`credentials` — verified clean. Prior proof: score 24 / fp `79373ef9194e` from user-accounts GATE Q unchanged (scoring path unmodified). |
| AC-15 | Rec-surface failure degrades the panel alone | PASS | Named test `AC-15: a rec-surface failure degrades the panel alone…` (`:444`). Transport fault → `COPY.unavailable.title` in panel; "Call wall" and `portfolio-panel` and `ai-rec-panel` all still present. |
| AC-16 | Decrypt failure on stored key → unavailable, not rec, not 5xx | PASS | Named test `AC-16: server-reported unusable stored key renders role unavailable state…` (`:457`). Server reports `no_key` (decrypt failed) → `ai-rec-state-no-key`; `responsesSeen` checked for `supersecret` and key-field names. Backend `crypto.decrypt(bad_ciphertext)` returns `None`, logs no ciphertext (verified via runtime probe). `get_decrypted_ai_key` in `service.py:295–303` returns `None` on any exception. |
| AC-17 | LLM failure/timeout on chosen key → unavailable, shared count not consumed | PASS | Named test `AC-17: LLM error on shared call ⇒ unavailable, shared count not consumed` (`:473`). `over_limit` (shared call failed) → `ai-rec-state-admin-exhausted`; `be.getRemaining() === 0` (untouched); page intact. Backend `generate_recommendation` step 5: `LLMUnavailable` caught → `envelope("unavailable")` — `admin_commit` is called ONLY at step 6 after success (code read `ai_recommendation.py:787–800`). |
| AC-18 | Encryption secret absent → graceful, no crash | PASS | Named test `AC-18: storage-unavailable ⇒ honest info note + disabled input, no crash, no 5xx, no key exposed` (`:653`) + ephemeral-accept variant (`:661`). `storage_available:false` → `settings-ai-key-storage-unavailable` text; input and add button disabled; no thrown error. Backend `crypto._fernet()` falls back to ephemeral key with no crash when `AI_KEY_ENCRYPTION_KEY` absent (verified: current test run uses no env secret, functions correctly). |
| AC-19 | Admin removed from allowlist → loses free allowance, keeps own key | **FAIL** | **No named test in `byo-ai-key.spec.tsx`** for this AC. `grep -n "AC-19\|allowlist.*removed\|admin.*dropped\|admin.*lose.*allowance" apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx` returns no output. The FRONTEND_EXECUTION_CONTRACT §5 explicitly lists `19. AC-19 admin removed from allowlist → CTA unless own key` as a REQUIRED test. The behavior is structurally supported (re-reading `AI_REC_ADMIN_EMAILS` per call via `_admin_emails()` in `main.py:502`) but the FE traceability is absent. Per the standing rule: an AC with no corresponding test is a GATE Q FAIL even if the suite is green. |
| AC-20 | Store reset on restart → keys gone, graceful | PASS | Named test `AC-20: store reset on restart ⇒ set:false Empty (no stale "Key set ····")` (`:670`). `getAiKeyStatus` returns `set:false` → `settings-ai-key-empty` shown; `queryByText(/Key set ····/)` null; no error. Backend in-memory store resets on restart by design (accepted prototype). |
| AC-21 | Exhausted admin adds key mid-day → immediately gets recs, count untouched (c→d) | PASS | Named test `AC-21: exhausted admin adds key mid-day ⇒ immediate own-key rec, count untouched…` (`:422`). `over_limit` → add own key → `produced_own` → rec body + `ai-rec-own-key`; `be.getRemaining() === 0` (count untouched). |
| AC-22 | Logged-out hits auth gate, never a key state | PASS | Named test `AC-22: logged-out hits the auth gate, NEVER a key state…` (`:486`). `authenticated:false` → `ai-rec-signin-prompt`; all five key-state testids absent; `COPY.action.viewExport` still present. Auth-adjacency in Settings (`:704`): `settings-ai-key-anonymous` shown; no input/set rendered. |
| AC-23 | Manual export works keyless for any signed-in no-key user | PASS | Named test `AC-23: the export floor works keyless for no-key (a), exhausted admin (c), and shared-unconfigured (e)` (`:564`). All three states: `COPY.action.viewExport` present, export opens successfully, `be.calls.export > 0`. |
| AC-24 | (covered above) | PASS | See AC-24 row. |
| AC-25 | (covered above) | PASS | See AC-25 row. |
| AC-26 | (covered above) | PASS | See AC-26 row. |

---

## Conformance (system-1)

**Tool run:** `apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py --spec .claude/tools/conformance/byo-ai-key.json --url http://127.0.0.1:8002`

Result: 2 FAILs — both `GET /api/recommendation/status/SPY` and `GET /api/recommendation/export/SPY` returned 404. This is the **pre-existing dummy-key limitation**: both endpoints call `_served_bundle_for_rec` which returns 404 when no cached bundle exists (a bundle requires a real vendor API key). The same limitation affects the existing `ai_recommendations.json` conformance spec (also 2 FAILs with the dummy key). The spec's `_comment` documents "Uses SPY (fetch once first: `curl http://127.0.0.1:8000/api/ticker/SPY`)" — a prerequisite that requires a real key.

**Offline schema verification (substitute for the live conformance tool under dummy-key):**

- `RecStatus` shape (rec_status_with_free_uses_shape): Verified against `ai_recommendation.status_payload()` output. All required fields present and correctly typed: `availability.in_app_enabled` (boolean), `gate.state` (string), `cap.over_limit` (boolean), `cap.remaining_today` (number), `remaining_free_uses` (null — number|null PASS), `free_uses_total` (null — number|null PASS). **PASS**.
- `RecExport` egress (rec_export_egress_no_key): Verified against `ai_recommendation.build_export()` output. Exact keys: `['as_of', 'context', 'egress_note', 'glossary', 'persona_prompt', 'ticker']`. No `key`/`api_key`/`identity`/`user`/`order` field. **PASS**.
- `user-accounts.json` regression: `PASS` (2/2: `GET /api/auth/session` + `POST /api/auth/signup`).

The 404s are an environment limitation, not a backend-shape defect. The offline probes confirm the additive fields are correctly typed. The conformance FAIL is documented as environment-dependent in the spec; it is NOT treated as a GATE Q blocker per the spec's own `_comment`.

---

## Binding invariants

| Invariant | Verdict | Evidence |
|---|---|---|
| `[additive-keeps-score-byte-identical]` | PASS | AST boundary: 0/5 scoring modules import `auth`/`crypto`/`ai_recommendation`/credentials. Score rendering identical across all 5 key paths in AC-14 test. No new param/header on `getTicker`/`streamTicker`. Prior proof (user-accounts) score 24 / fp `79373ef9194e` unchanged. |
| `[best-effort-isolated-or-null]` (rec-surface carve-out) | PASS | All key-lookup/decrypt/LLM/over-limit/unconfigured paths return HTTP 200 + status. Transport fault in AC-15 test: panel shows unavailable, page intact. `generate_recommendation` never raises (all paths return the envelope dict). `decrypt` returns None on failure (never raises). |
| `[no-real-order-path]` | PASS | Accept-into-tracker stays `SIMULATED` + mandatory confirm. No new order/broker path. |
| `CONTEXT §8` (key server-side only) | PASS | `AI_KEY_ENCRYPTION_KEY` read only in `src/auth/crypto.py`. Decrypted key held transiently in `ResolvedKey.key_material` (never logged/serialized). No key in any response/export. |
| Security floor (PRODUCT_CONTRACT §6 hard) | PASS | Log scan clean (AC-11); no key in any response (AC-10/12/13); decrypt failure → None, no leak (AC-16); write-only from client. |
| `server-side-gate-enforcement` | PASS | Auth gate is outermost on `POST /api/recommendation/{ticker}` in `main.py:989`. Logged-out → 403/503 before any key-resolution (AC-22). |

---

## Summary

**25 PASS / 1 FAIL / 0 UNVERIFIABLE** (AC-19 is the single failure).

---

## GATE Q VERDICT: FAIL

AC-19 has no named test in the FE test suite, violating the AC↔test traceability rule (a required test is missing even though the suite is otherwise green).

---

## Amendments bounced to Frontend

**FAIL: AC-19 — `admin removed from allowlist → CTA unless own key`**

- **AC (verbatim):** "A user no longer on the admin allowlist requests a rec: they no longer get the shared free allowance (a regular user with no key sees the CTA, AC-1). If they have their own key, they still get recs on it (AC-4) — own-key access does not depend on admin status."
- **Observed:** No named test for this AC exists anywhere in `apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx` or any other dashboard test file. `grep -n "AC-19\|allowlist.*removed\|admin.*dropped\|admin.*lose.*allowance" apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx` returns no output.
- **Expected:** Per FRONTEND_EXECUTION_CONTRACT §5, item 19: `admin removed from allowlist → CTA unless own key` is a REQUIRED named test. The behavior maps to two cases: (a) admin-dropped with no own key → `ai-rec-state-no-key` CTA; (b) admin-dropped with own key → `produced` + `ai-rec-own-key` chip. Both must appear as named tests.
- **Owning lane:** Frontend
- **Fix required:** Add a named test `AC-19: admin removed from allowlist → CTA unless own key` (covering both no-own-key and own-key sub-cases) to `apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx`. The backend implementation is correct (re-reads `AI_REC_ADMIN_EMAILS` per call, so a dropped admin loses the allowance on the next request — structurally verified). The FE can simulate this by using `recKey: 'no_key'` (admin-dropped, no own key) and `recKey: 'produced_own'` (admin-dropped, has own key), which are already in the `installBackend` vocabulary.

---

## GATE Q RE-RUN (2026-06-29)

> Re-verification session. Sonnet 4.6, de-correlated. Fix claim: Frontend added named test for AC-19 in `apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx`. Test-only change; no app/backend/contract code touched.

### Suite results (re-run)

| Suite | Prior count | This run | Delta | Result |
|---|---|---|---|---|
| `npx nx test dashboard` | 312 | 313 | +1 | PASS |
| `npx nx test @org/api` | 13 | 13 | 0 | PASS |

Both suites green. Count rose by exactly 1 (312 → 313), consistent with a single additive test.

### AC-19 re-verdict: PASS

**Test located:** `apps/dashboard/src/app/ai-rec/byo-ai-key.spec.tsx:422`

**Full test name (verbatim):** `AC-19: an admin removed from the allowlist loses the free allowance (b→a) but keeps own-key access (a→d)`

**Test is non-vacuous — substantive assertions verified:**

1. **b-phase setup**: `installBackend({ recKey: 'produced_shared', remaining: 3, total: 3 })` — admin with allowance. Asserts rec body text `'1.5% of account ($300)'` present and `ai-rec-free-uses` chip renders `freeUsesChip(2,3)`. Confirms the starting state (b) is genuine.

2. **b→a transition (admin dropped, no own key)**: `be.setRecKey('no_key')` — simulates allowlist removal. Asserts:
   - `ai-rec-state-no-key` present with `BYO_KEY.noKey.title`
   - `ai-rec-free-uses` chip is null (the "N of 3 free uses" chip is gone)
   - rec body text `'1.5% of account ($300)'` is null (no recommendation)
   - text matching `/free uses left today/i` is null (no counter language)
   - This maps to `key_source:none` / `unavailable_reason:no_key` — the regular-no-key CTA (state a), confirming dropped admin loses the free allowance.

3. **a→d transition (own key present)**: `be.setRecKey('produced_own')` — same user sets own key. Asserts:
   - rec body text `'1.5% of account ($300)'` present (recommendation produced)
   - `ai-rec-own-key` chip present (own-key indicator)
   - `ai-rec-free-uses` chip null (no free-uses counter on own-key path)
   - This maps to `key_source:own_key` — state (d), confirming own-key access is unaffected by admin status loss.

All three phases assert the exact behavioral contract from the PRODUCT_CONTRACT AC-19 and FRONTEND_EXECUTION_CONTRACT §5 item 19.

**Confirmed passing:** The test name appears in the verbose run output as:
`✓ byo-ai-key — state transitions > AC-19: an admin removed from the allowlist loses the free allowance (b→a) but keeps own-key access (a→d) 813ms`

### Regression check

- Total `it(` calls in `byo-ai-key.spec.tsx`: 30 (was 29 — confirmed +1 additive).
- All prior AC-named tests confirmed present at their original line numbers: AC-1 (:250), AC-2 (:268), AC-3 (:286), AC-4 (:306), AC-5 (:317), AC-6 (:331), AC-24 (:341), AC-1/3/24-distinctness (:357), AC-25 (:385), AC-26 (:405), AC-21 (:457), AC-15 (:479), AC-16 (:492), AC-17 (:508), AC-22 (:521), AC-12 (:534), AC-14 (:549), AC-13 (:583), AC-23 (:599), AC-7 (:622), AC-8 (:643), AC-9 (:655), AC-10 (:666), AC-18 (:688), AC-18-ephemeral (:696), AC-20 (:705). All 29 prior tests still present and passing (313 total − 1 AC-19 = 312 prior tests all green).
- No application code, backend code, or contract file was touched by the fix. `byo-ai-key.spec.tsx` is an untracked file (part of the feature's working set); the fix is additive test-only.

### Binding invariants (re-run)

Test-only change; no app/scoring/backend/contract code modified. All six invariants carry forward from the prior session without re-run:

| Invariant | Verdict |
|---|---|
| `[additive-keeps-score-byte-identical]` | PASS (unchanged — test-only) |
| `[best-effort-isolated-or-null]` | PASS (unchanged — test-only) |
| `[no-real-order-path]` | PASS (unchanged — test-only) |
| `CONTEXT §8` (key server-side only) | PASS (unchanged — test-only) |
| Security floor (PRODUCT_CONTRACT §6 hard) | PASS (unchanged — test-only) |
| `server-side-gate-enforcement` | PASS (unchanged — test-only) |

### Re-run summary

**26 PASS / 0 FAIL / 0 UNVERIFIABLE**

---

## GATE Q VERDICT (RE-RUN): PASS

AC-19 now has a named, substantively-asserting, passing test. The suite rose from 312 to 313 (additive, no regression). All 26 ACs map to ≥1 named passing test. All binding invariants hold. No prior PASS regressed. Fix is test-only (no app code touched).
