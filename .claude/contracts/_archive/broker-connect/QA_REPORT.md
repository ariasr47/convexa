# broker-connect — QA_REPORT (GATE Q RE-RUN, fresh de-correlated session)

**QA session:** fresh, no chat history with the fixing lanes. `HEAD` at session start and
throughout: `29b6463` (`5bcc89e` S-1 · `c48f45f` H-1/H-2/H-3 · `a137096` M-1 · `29b6463` M-3), all
four fix commits present and the tree clean (only this report + an unrelated `.claude/RESUME.md`
were touched by me). Verified by running the real app (`nx serve api`, `nx serve dashboard`), live
HTTP walks against the real (unmocked) Webull adapter with a deliberately-wrong-but-well-formed
credential (never a real one — never requested, per the task brief), a live Playwright browser walk
against the real UI, `interface_conformance.py --auth-signup`, and every gate re-run with EXIT CODES
checked (not printed summaries — the CLAUDE.md trap). Code was read to explain findings and to
locate the fixes, never as a substitute for observing them run.

## Prior pass — what failed, and that it was re-verified here

The prior GATE Q pass (scored against `HEAD=6fd9cdb`, i.e. before this session's four fix commits)
returned **overall FAIL**, driven by **S-1 (Critical)**: the shipped `WebullProvider` could not
complete a single real HTTPS request on Python ≥3.12 (the SDK's vendored `ssl_` module left
`PROTOCOL_SSLv23`/`CERT_NONE`/`HAS_SNI` unbound), so every real-adapter call died at the TLS layer
before ever reaching Webull and was misclassified as generic `adapter_fault` — indistinguishable
from an outage, for a dead key AND a hypothetically valid one alike. That one defect cascaded into
four scored AC failures (AC-2, AC-5, AC-13, AC-20) plus the live-reproduced H-2 (unthrottled `GET
/api/broker/book`) and M-1 (422 body echoes a wrong-typed secret) findings from the concurrently-
delivered `SECURITY_REVIEW_BROKER.md`. **Arithmetic discrepancy in the prior report, resolved:**
its headline said "5 FAIL" but its own table names and scores exactly **four** FAIL rows (AC-2,
AC-5, AC-13, AC-20); the "5th" was the AC-6a review arm, which the SAME report correctly scores as
**UNVERIFIABLE**, not FAIL, two sentences later. The "5" in the headline double-counted that
UNVERIFIABLE item as if it were also a FAIL. **Corrected prior tally: SPEC.md §3's AC table has 24
scored row-identifiers (items 1–23, with #6 split into 6a/6b) → 19 clean PASS rows · 4 FAIL rows
(AC-2, AC-5, AC-13, AC-20) · 1 compound row (AC-6a: test arm PASS, review arm UNVERIFIABLE) = 24.**
This re-run confirms all four named FAILs are now fixed and re-tests every other row for regression
(none found — see the table below).

## Gate re-runs (exit codes, this session)

| Gate | Result | Evidence |
|---|---|---|
| `nx test api` | **PASS** — 266 passed, exit 0 | matches the ≥266 target |
| `nx test dashboard --skip-nx-cache` | **PASS** — 1283 passed (115 files), exit 0 | matches the ≥1283 target; re-run with cache explicitly skipped after the first run showed an ambiguous cache-hit line |
| `nx run-many -t typecheck --skip-nx-cache` (dist + out-tsc/tsbuildinfo cleared first) | **PASS** — exit 0, 3 projects | clean-slate, no TS6305 flake |
| `nx lint dashboard --skip-nx-cache` | **PASS** — 0 errors / 0 warnings, exit 0 | |
| `nx build dashboard --skip-nx-cache` | **PASS** — exit 0, largest chunk `LineChart` 285.69 kB gzip 86.22 kB | no >500 kB warning |
| `nx e2e dashboard-e2e --skip-nx-cache` | **PASS** — 37/37, exit 0 | fresh run, includes all 4 `broker.spec.ts` cases |
| `interface_conformance.py --contract INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --auth-signup` | **PASS** — 0 endpoint failures (3/3: `GET credential`, `GET book`, `POST refresh`) | fresh throwaway account; `--auth-cookie` never used against a credentialed session, per the contract's own warning |

Every exit code above was captured explicitly (`echo $?` after redirecting to a log file, not piped
through `tail`), per the CLAUDE.md trap about printed summaries lying about exit status.

## The headline check: is S-1 actually fixed? (live, real network, real credential-rejection)

Signed up a fresh throwaway account, `PUT` a **syntactically-valid but deliberately wrong** Webull
App Key + Secret (never a real one — never requested), then `GET /api/broker/book` against the
real, unmocked `WebullProvider` (`POSITIONS_PROVIDER` unset ⇒ `webull`, the production default):

```
PUT /api/broker/credential {"app_key":"WRONGAPPKEY0000000001","app_secret":"WRONGAPPSECRET..."}
  -> 200 {"set":true,"last4":"0001","storage_available":true}
GET /api/broker/book   (0.36s wall time — a real round trip, not an instant local NameError)
  -> 200 {"state":"unknown","positions":[],"reason":"credential_rejected",
          "last_attempt_at":"2026-08-05T04:36:25Z","last_attempt_outcome":"credential_rejected"}
```

This is **new, and it is real**: the prior pass could only ever observe `adapter_fault` — a
`NameError` at the SSL layer, ~0ms, identical for every key. Here the response took real wall time,
and the failure cause is `credential_rejected`, **the specific state AC-13/AC-20 require the real
adapter to be able to reach**. I repeated this with a second, different wrong credential via
rotate: the retry produced a genuinely NEW `last_attempt_at` (confirmed by spacing requests >1s
apart so ISO-second truncation couldn't hide it) and another real ~0.3s round trip — rotate
correctly invalidates the cache/throttle and forces a fresh attempt against the new key. Then drove
the same flow through the **real browser** (Playwright, real UI, real backend, no stubbing):
Settings → save credential → Positions → Broker tab → after ~1.5s the tab rendered

> **Webull stopped accepting the saved key. Reconnect in Settings to resume reading your book.**
> `Reconnect in Settings`

— the exact S8 copy from SPEC §4, driven end-to-end from a real (rejected) Webull response, not a
fixture. `_shim_vendored_ssl()` (binding `PROTOCOL_SSLv23`/`CERT_NONE`/`HAS_SNI` on the vendored
module, confirmed in the diff to bind `HAS_SNI` too — the third casualty the original review found)
is doing exactly what it says. **S-1 is fixed, live-confirmed, not just unit-tested.**

## Acceptance criteria (SPEC.md §3, verbatim) — re-scored, all 24 rows

| # | Acceptance criterion (verbatim) | Verdict | Evidence |
|---|---|---|---|
| 1 | Signed in, the owner saves a Webull App Key + Secret in Settings; afterwards the UI shows only a masked hint (last-4 of the App Key). The full secret is never displayed again on any surface. | **PASS** | Live Playwright walk against the real backend: saved `LIVEQAWALKAPPKEY0007`/`...SECRET...0007`; Settings shows `Webull · key ····0007`; scanned `page.content()` (full HTML) and `localStorage`/`sessionStorage` for both submitted strings — both `false`. Backend suite green (unchanged tests). |
| 2 | Rotate: saving a replacement credential updates the masked hint, and subsequent real-book fetches use the new credential (observable: fetches succeed after rotating from a dead key to a good one). | **UNVERIFIABLE** (mechanism now proven; positive case structurally unavailable to QA) | Hint-rotate half: live-verified (`····0001` → `····0002` across two PUTs). Fetch-uses-new-credential half: live-verified — rotating to a *different* wrong key produced a genuinely new, later `last_attempt_at` and a fresh real round trip (not a throttle-served stale answer), proving rotation reaches the broker again with the new credential. **The literal "fetches succeed" clause needs a real, Webull-approved credential**, which per this role's constraints I do not have and must never request — this is now the SAME category of gap as AC-6a's owner-only review arm, not a code defect: the previously disqualifying property (S-1 made success/failure indistinguishable for ANY key) is gone, and the mechanism that would make a valid key succeed is the identical mechanism just proven live for the rejected-key path. |
| 3 | Delete/disconnect returns the Broker tab to not-connected, and no real-position data remains visible anywhere in the app afterwards (server cache invalidated on delete). | **PASS** (see also the narrow residual concurrency race noted in the invariant audit below — real but does not falsify this AC under a normal, non-race sequential walk) | Live direct-HTTP walk: credentialed → `GET /book` (`credential_rejected`) → `DELETE credential` → `{"set":false,"storage_available":true}` → next `GET /book` → `{"state":"unknown","reason":"no_credential_stored"}`, no attempt fields, no ghost book. `test_delete_invalidation_leaves_no_ghost_field` / `test_invalidate_drops_snapshot_and_attempt_history` pass (part of the 266). |
| 4 | Logged out (or with the client check bypassed), every broker surface — credential save, rotate, delete, real-book read, refresh — is refused server-side. | **PASS** | Live direct-HTTP walk, no cookie: `GET/PUT/DELETE /api/broker/credential`, `GET /api/broker/book`, `POST /api/broker/book/refresh` all → `403 {"error":"auth_required"}`. |
| 5 | After save, the plaintext secret appears in no server response, no page source, no browser storage, and no log line; a server decrypt failure presents as "no usable credential", never as leaked content and never as a Webull rejection. | **PASS** (was FAIL — M-1 now fixed, live-verified on both affected endpoints) | `PUT /api/broker/credential {"app_key":["ARRAYSENTINEL_APPKEY"],"app_secret":["ARRAYSENTINEL_SECRET"]}` → 422 body has NO `input`/`ctx` key at all, sentinel absent (`{"detail":[{"type":"string_type","loc":[...],"msg":"..."}]}`). Repeated on the sibling `PUT /api/auth/ai-key` (the SAME defect, pre-existing, also fixed by the app-wide handler): sentinel absent there too. `main.py`'s `_validation_error_without_body_echo` is a single `RequestValidationError` handler dropping `input`/`ctx` app-wide — confirmed by direct read, and the fix is architecturally un-bypassable (registered once, at the app level, not per-route). `credential_unreadable` distinctness unaffected by this session's changes; still holds per the unchanged tests. |
| 6a | *(unconditional)* every reported position listed, none absent/merged/altered, count never understating. **Test arm:** binds to captured fixtures. **Review arm:** owner app-vs-tab comparison. | **Test arm: PASS. Review arm: UNVERIFIABLE (owner-owed, structurally not QA's to do — but NOW DOABLE for the first time).** | Test arm: `test_every_fixture_position_appears_count_never_understates`, `test_the_real_book_maps_to_five_exact_nine_partial_zero_unrecognized` pass (unaffected by this session's changes — 5 exact + 9 partial + 0 unrecognized = 14). Review arm: unchanged from the prior pass in that I am not the owner and cannot perform the Webull-app comparison — but **the underlying blocker (no live fetch could ever succeed) is gone**: a real credential now reaches Webull and gets a real answer (proven above with a wrong key), so the owner CAN now run this comparison for the first time. Recommend it as a fast owner-only follow-up, not a GATE Q blocker (SPEC §7 names this arm as one "no automated test can observe" by design). |
| 6b | *(conditional)* grouping identity present ⇒ grouped; flat ⇒ honest per-contract rows, never heuristic composition. | **PASS** | Unaffected by this session (no diff touches `webull_adapter.py`'s grouping logic beyond the SSL/log shims); `test_flat_payload_never_composes_contracts_into_strategies` passes. |
| 7 | Every render carries a visible as-of stamp + read basis. Tab label "Broker". "live" never appears as a freshness claim except the negation phrase. | **PASS** | e2e `broker.spec.ts` "a populated tab never claims `live`" re-ran fresh and passed (37/37 includes it); FE files untouched by this session's fix commits (diff is backend-only: `main.py`, `src/broker/service.py`, `src/broker/webull_adapter.py`, plus tests). |
| 8 | Manual refresh always requests a fresh read; stamp advances on success; a cache-served/failed refresh visibly says so, never a silent no-op. | **PASS** | Unaffected (FE untouched); `BrokerTabPanel.spec.tsx` unchanged-and-why tests pass in the fresh 1283/1283 run. The successful-fresh-fetch arm against a REAL valid credential remains unconfirmable for the same reason as AC-2 (no valid key) — not newly broken, not previously PASS-with-caveat either; unchanged status. |
| 9 | Not connected: explicit not-connected state pointing to Settings, never an empty table. | **PASS** | e2e "signed in, no credential: the honest S1 not-connected state" re-ran fresh and passed. |
| 10 | Unknown vs empty textually/visually distinct, closed-lookup-driven, never derived from `positions.length`, neither producible by the other's condition. | **PASS** | Unaffected; `test_empty_and_unknown_both_carry_positions_list` passes; live-verified both `no_credential_stored` and `credential_rejected` unknown arms carry `positions: []` with `state` as sole disambiguator. |
| 11 | Stale snapshot fields keep last-known values, visibly marked, never blanked/silently-refreshed; governed by age vs `stale_after_seconds`, book-snapshot axis only. | **PASS** | Unaffected (FE untouched); `test_unreadable_keeps_serving_the_last_good_book`, `test_failed_attempt_advances_attempt_but_never_evicts` pass. |
| 12 | Broker outage/rate-limit degrades the Broker tab ONLY; Ticker/SSE/sim/scanner byte-identical; served snapshot stays visible under a degraded banner, else AC-10's unknown shows. | **PASS** | Live A/B I ran myself this session against the real `massive` provider (AAPL, not mocked): `(score, tier, fingerprint) = (63, 'actionable', 'e8a883b0544b')` identical before connecting, after connecting + a real credential-rejected fetch, and after deleting. H-3's prior liveness caveat is addressed below (per-user lock now confirmed, no longer process-global). |
| 13 | `credential_rejected`: distinct warning state, distinguishable from AC-12's outage and from `credential_unreadable`. | **PASS** (was FAIL) | Live-verified end-to-end, real network, real (rejected) Webull response: `GET /api/broker/book` → `{"state":"unknown","reason":"credential_rejected",...}` in ~0.3–0.4s wall time; real browser render → S8 copy "Webull stopped accepting the saved key. Reconnect in Settings to resume reading your book." + `Reconnect in Settings` CTA. Distinct from the generic `adapter_fault` S5/S7 path (unit-tested, unaffected) and from `credential_unreadable` (also unaffected). |
| 14 | Unrepresentable position ⇒ explicit cannot-fully-display entry; count never understates; missing facts render `not provided`, never 0/blank. | **PASS** | Unaffected; `test_the_real_book_maps_to_five_exact_nine_partial_zero_unrecognized`, `test_every_omission_is_named_in_fidelity_notes`, `test_option_contract_facts_are_omitted_on_the_wire_never_null_padded` pass (part of 266). |
| 15 | Zero order/trade/close/modify affordances, including disabled/"coming soon"; no copy implying an order path; nothing references `TradeEntryDialog`. | **PASS** | Unaffected; `broker.risk.spec.tsx` source-scan + mutation-guard tests pass in the fresh 1283/1283 run. |
| 16 | No flow creates/alters a sim position from a real row; sim tab + ledger numbers identical before/after connecting a broker. | **PASS** | Unaffected; durable-isolation test passes; this session's fix diff touches zero FE files and zero `convexa.*`-adjacent backend files. |
| 17 | Score/tier/`state_fingerprint` byte-identical with/without a connected broker (same ticker). | **PASS** | `git diff --stat dc60a09~1..HEAD -- apps/api/src/core apps/api/src/providers` is **empty** (re-confirmed this session, spans every broker-connect commit including all four fixes). Live A/B (above, AC-12 evidence) against the real `massive` provider confirms it end-to-end, not just by diff. |
| 18 | Reassessment referencing a real holding visibly carries the real position's as-of basis. | **PASS** | Unaffected (FE untouched); `reassess.spec.tsx` passes in the fresh 1283/1283 run. |
| 19 | Reassessment verdict on a real position offers no Accept-into-store or write action; sim Accept flow byte-identical. | **PASS** | Unaffected; same evidence as AC-18. |
| 20 | No fabricated sample/demo positions presented as real; a bad/unapproved key lands in AC-13's rejected state, not a hang or fake success. | **PASS** (was FAIL) | First half unaffected (stub provider is env-gated, never active with a real credential). Second half now live-verified: a bad/unapproved key produces `credential_rejected` in well under a second — not a hang (the SDK's 5s connect / 10s read timeouts are far above the observed ~0.3–0.4s), not a fake success (`state: unknown`, no positions), and it IS AC-13's named rejected state, not a generic catch-all. |
| 21 | Convexa-modeled P/L, market-data-axis-only degradation, dual-basis label when stale+feed-up. | **PASS** | Unaffected (FE untouched); two-axis degradation tests pass in the fresh 1283/1283 run. |
| 22 | *(conditional)* Webull's own P/L carried verbatim, may render as a static reference, never blended, never unnamed. | **PASS** | Unaffected; `unrenderedBrokerPl.spec.tsx` passes. |
| 23 | Cross-account isolation: a second signed-in account sees only its own state; anonymous gets 401/403, never data. | **PASS** | Live-verified this session with two freshly signed-up accounts (A, B): A connects a credential and gets a real (rejected) attempt against it; B — never touched — gets `{"set":false,"last4":null}` from `GET /broker/credential` and `{"state":"unknown","reason":"no_credential_stored"}` from `GET /broker/book`. No field of A's state reached B. Anonymous → 403 on all five endpoints (AC-4 evidence, same walk). |

**Summary: 24 scored rows (23 numbered ACs; #6 splits into 6a/6b, and 6a itself carries two
independent verification arms). 22 PASS (including AC-6b and AC-6a's test arm) · 0 FAIL · 2
UNVERIFIABLE-by-QA-role (AC-2's positive "fetches succeed" clause, and AC-6a's owner-only review
arm) — neither is a code defect; both require something this role must not obtain or is not the
one to perform (a real Webull-approved credential; the owner's own eyes on the Webull app),
exactly as SPEC §7 anticipated for AC-6a and as this task's own brief anticipated for AC-2/AC-13/
AC-20 (the latter two ARE now fully verifiable and PASS, because their claims resolve on the
rejected-credential path, which needs no real key).**

**All four previously-FAIL rows (AC-2, AC-5, AC-13, AC-20) are resolved**: AC-5 and AC-13/AC-20 are
now clean PASS; AC-2 moves from FAIL (definitively, structurally impossible for any key) to
UNVERIFIABLE (the mechanism is proven correct; only a real credential — which this role must not
obtain — would complete the positive-path observation). No other row regressed.

## Invariant audit

| Invariant | Verdict | Evidence |
|---|---|---|
| `[no-real-order-path]` | **PASS** | Re-introspected this session: `PositionsProvider.__abstractmethods__` = exactly `{'describe', 'fetch_book'}`. Unaffected by the fix diff (SSL/logging shims only). |
| `[secret-encrypted-at-rest]` | **PASS** (M-1 gap closed) | Fernet ciphertext-only persistence unaffected; the M-1 422-echo gap (AC-5's counter-example) is fixed and live-verified on BOTH affected endpoints (`/api/broker/credential`, `/api/auth/ai-key`) with a distinct sentinel per endpoint. |
| `[server-side-gate-enforcement]` | **PASS** | All five endpoints refuse anonymous requests server-side, live-verified this session. |
| `[best-effort-isolated-or-null]` | **PASS** — H-3's prior liveness flag addressed | AC-17's live A/B holds. H-3 (the process-global lock held across the blocking Webull call, previously flagged as reasoned-not-executed) is now a per-user `threading.Condition`, confirmed by direct read of `service.py`: the lock is claimed only for the state read/decision, released before `fetch_book`, and re-acquired only to commit — matches the documented fix. See the residual concurrency note below for a narrower, still-real edge case this redesign does not fully close. |
| `[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` | **PASS** | Unaffected; two-axis grid test-covered, FE untouched. |
| `[absent-is-not-none]` | **PASS** | Unaffected; `state` remains the sole disambiguator end-to-end, live-verified across `no_credential_stored`/`credential_rejected` this session. |
| `[loss-free-durable-migration]` | **PASS** | Unaffected; no durable shape changed this session (diff is SSL shim / logging / lock / validation-handler only). |
| `[single-shared-sim-entry-dialog]` (narrowed) | **PASS** | Unaffected. |
| `[additive-keeps-score-byte-identical]` | **PASS** | `git diff --stat dc60a09~1..HEAD -- apps/api/src/core apps/api/src/providers` empty (re-confirmed) + live A/B this session against the real `massive` provider. |
| `[theme-token-discipline]` | **PASS** | Unaffected (no FE files in this session's diff). |
| Amendment 1 omission compliance (absent option facts OMITTED not null-padded; `multiplier` omitted when unknown and every dependent output withheld) | **PASS** | Unaffected by this session; `test_option_contract_facts_are_omitted_on_the_wire_never_null_padded` and the G4 withhold-path FE tests pass (part of the fresh full-suite runs). Independently re-derived by hand against the real committed fixture this session (see the FE-lane flagged item #3 below) — omission discipline holds; the *reconstructed* multiplier (R2b) is a deliberate, owner-ruled approximation with known tolerance, not a silent defaulting. |
| `system-6 security review fires here` (BRIEF invariant watch) | **PASS, with Medium-severity residuals flagged (non-blocking)** | Critical (S-1) and all three High findings (H-1, H-2, H-3) are fixed and re-verified live/by-read this session. M-1 (Medium) is fixed. **M-2 and M-5 (Medium) are CONFIRMED STILL OPEN** — see the residual-risks section below; they are pre-existing, untouched by this fix session, and do not falsify `[secret-encrypted-at-rest]` (a transport/TLS concern, not a storage one) or any scored AC, so they do not block this GATE Q verdict, but they should not ride indefinitely into a real-money production posture. |

## Residual risks the fixing lane self-reported — confirmed or refuted, each with direct evidence

**(a) AC-3 in-flight concurrency race — CONFIRMED, real, narrow.** Wrote a standalone script
importing `BrokerBookService` directly with a synthetic slow provider and drove three threads: a
cold-start reader (claims `in_flight`), a second reader arriving 5–100ms later (parks in
`cond.wait()` since nothing is yet honest to serve), and a `DELETE`/`invalidate()` call racing
against the first reader's commit. Across 200 tightly-timed iterations, the second (waiting) reader
was served a real `state: ok` book **64/200 times (32%)** despite a concurrent delete. Root cause:
`cond.wait()` returning does not atomically re-check `invalidated` against the delete's own timing —
if the delete's `invalidate()` call is still waiting to acquire the per-user lock when the waiting
reader wakes (from the FETCHER's own `notify_all()` on a successful commit) and reacquires it first,
the reader sees a pre-delete, still-valid snapshot and correctly-per-that-moment serves it. This is
real and reproducible, but narrow: it requires a genuinely concurrent cold-start GET **and** a DELETE
arriving within the same fetch's in-flight window (this session's slow-provider repro used a 20ms
window; the real Webull adapter's round trip is ~300–400ms, which widens the window somewhat but the
phase-1 single-user/single-tab usage pattern makes simultaneous GET+DELETE unlikely). Does NOT
falsify AC-3's live walk (delete → next GET → clean `no_credential_stored`, done sequentially,
passed cleanly) — this is a race that requires deliberately overlapping requests to trigger, not the
normal usage the AC describes. Flagged for a future fix (a version/generation counter checked at
serve time, not just at wake time, would close it), not scored as an AC-3 failure.

**(b) M-5 (`WEBULL_API_CA_BUNDLE=""` silently disables TLS verification) — REFUTED as fixed. It is
STILL OPEN, unchanged from the security review.** The task brief's premise ("M-5 now fails CLOSED")
does not match the shipped code. Direct evidence: `grep -rn "verify\|CA_BUNDLE\|certifi" apps/api/src/broker/webull_adapter.py`
returns **zero matches** — nothing in this session's fix diff touches TLS verification at all. The
vendored SDK's `get_verify_value()` (`webullsdkcore/http/response.py:120-123`) is byte-identical to
what the security review quoted: `return os.environ.get('WEBULL_API_CA_BUNDLE', True)`, and
`_SdkTransport.__init__` constructs `ApiClient(credential.app_key, credential.app_secret,
region_id=region)` with no `verify=` argument, so the env-var fallback path is live. Setting
`WEBULL_API_CA_BUNDLE=""` still yields `verify=""` (falsy to `requests`) with no exception and no
warning — TLS verification silently off. This is a real, currently-open Medium finding; the
smallest fix the security review proposed (`ApiClient(..., verify=certifi.where())`) has not been
applied.

**(c) M-2 (2018-vintage vendored CA bundle) — CONFIRMED still untouched.** Same evidence path as
(b): zero references to `certifi` anywhere in `webull_adapter.py`; the vendored
`webullsdkcore/vendored/requests/packages/certifi/__init__.py` still reports `__version__ =
"2018.01.18"`. Unaffected by this session's fix diff, exactly as the task brief anticipated.

## Verdicts on the three FE-lane flagged items (report only — not fixed, not fixable by this role)

**1. Row/card `ModeledPl` asymmetry on `unrecognized` — CONFIRMED via direct code read.** In
`BrokerPositionRow.tsx`, `<ModeledPl .../>` renders **unconditionally** (line ~325, outside the
`unfaithful ? ... : ...` branch) — so an `unrecognized` (no mapped legs) row still shows a P/L slot
(rendering the `not provided` literal, since `pl_dollar` is null with zero legs). In
`BrokerPositionCard.tsx` — the same data, the `<sm` mobile collapse of the same component —
`<ModeledPl .../>` is placed **inside** the non-`unfaithful` branch only (line ~75); when `unfaithful`
is true the card renders solely `<UnfaithfulEntry .../>` with **no P/L slot at all**. Same logical
position, two different renders depending on viewport width. Neither is dishonest on its own (no
fabricated number either way), but it is a genuine visual inconsistency between the desktop and
mobile treatments of the exact same `unrecognized` position, unrelated to and unaffected by this
session's backend-only fixes.

**2. `Build reassessment` renders on `partial` rows, producing `position: null` in the export —
CONFIRMED via direct code read, and it is CORRECT/HONEST behavior, not a defect.**
`BrokerReassessAction` (`reassess.tsx:104`) gates only on `view.fidelity === 'unrecognized'`
returning `null` — so it renders on both `exact` and `partial` fidelity. For the 9 real `partial`
option positions (no strike/expiry/right from Webull, per Amendment 1), `buildBrokerReassessment`'s
`position` field (`reassess.tsx:65-76`) requires all three of `expiration`/`strike`/`right` to be
non-null on the subject leg — none are, for a real partial option — so `position: null` in the
exported JSON. This is the intended tri-state honesty behavior (nothing fabricated; `position: null`
signals "no option contract detail available," exactly what Amendment 1 says the real feed carries)
— the interface's own docstring comment ("null for a holding with no option subject (shares-only)")
undersells the actual scope (it now also covers option positions with omitted contract detail), a
comment-accuracy nit worth a follow-up edit, not a functional or spec defect.

**3. A per-unit-vs-aggregate rounding difference visible in AC-6a's review arm — CONFIRMED IN KIND;
the specific magnitude in the task brief ("12¢") was not reproduced, but the general phenomenon is
real and by design.** Hand-recomputed the R2b multiplier reconstruction (`mult = round(total_cost /
(unit_cost * qty))`) against all 9 real `partial` option rows in the committed
`positions_raw.json`: reconstructed `multiplier` is 100 for every row (correct), but because the
guards accept up to ~1% ratio tolerance, Convexa's `unit_cost × multiplier × qty` ("Net entry") does
**not always exactly equal** Webull's own `total_cost` — observed differences of **$0.00 to $2.00**
across the 9 rows (e.g. TSLA qty=4 unit_cost=16.34: computed `$6,536.00` vs Webull's own
`total_cost` `$6,537.00`, a $1.00 gap). This is an accepted, owner-ruled consequence of
`RECONCILIATION_PLAN.md` §4's R2b guards (round-trip tolerance `max($0.01, 0.5% of total_cost)`),
not a bug: the owner explicitly ruled "reconstruct it, with guards" knowing the reconstruction is an
approximation of Webull's own (already internally inconsistent) arithmetic. During the owner's
AC-6a app-vs-tab review, a handful of positions will show a Convexa "Net entry" figure a few cents
to ~$2 off Webull's own aggregate cost figure — worth a one-line heads-up to the owner before they
run that review so a correctly-functioning approximation isn't mistaken for a bug.

## Overall GATE Q verdict: **PASS**

All four previously-failing ACs are fixed and live-re-verified against the real, unmocked Webull
adapter (not just unit tests): AC-5 and AC-13/AC-20 are clean PASS; AC-2 moves from a hard,
structural FAIL to a correctly-scoped UNVERIFIABLE-by-QA-role (identical in kind to AC-6a's
long-standing owner-only review arm — SPEC §7's own design, not a gap this fix session could have
closed even in principle). Zero AC rows are FAIL. Every named invariant holds, including the two
that were previously broken (`[secret-encrypted-at-rest]` via the M-1 fix; `[best-effort-isolated-
or-null]` via the H-3 per-user-lock redesign) and the ones that were always fine and remain fine (
`[additive-keeps-score-byte-identical]`, re-proven live this session). All seven re-run gates are
green with checked exit codes (266 backend / 1283 frontend / 37 e2e / clean typecheck / 0-warning
lint / no oversized build chunk / clean conformance).

**Non-blocking follow-ups worth carrying forward** (none of these gate this PASS): the M-2/M-5
Medium-severity TLS findings remain genuinely open and should be closed before any real-money
production exposure (the security review's own one-line fix — `verify=certifi.where()` — closes
both at once); the narrow AC-3 concurrency race is real but requires deliberately overlapping
requests to trigger; the two FE cosmetic findings (row/card `ModeledPl` asymmetry, the reassess
docstring undersell) are worth a follow-up pass; and AC-2's positive case / AC-6a's review arm are
both now genuinely doable by the owner for the first time and worth a fast real-credential smoke
test before or at GATE S.

No amendments are bounced — there is nothing to route to GATE Z from this pass.
