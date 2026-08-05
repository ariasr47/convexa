# broker-connect — QA_REPORT (GATE Q, fresh de-correlated session)

**QA session:** fresh, no prior chat history with the build lanes. Verified by running the real
app (backend `nx serve api`, frontend `nx serve dashboard`), live HTTP walks, a Playwright
browser walk against the real UI, `interface_conformance.py --auth-signup`, and re-running every
gate with exit codes checked (not printed summaries). Every claim below is something I directly
observed this session; code was read only to explain a failure once observed, never to
substitute for observation.

## Gate re-runs (exit codes)

| Gate | Result | Evidence |
|---|---|---|
| `nx test api` | **PASS** — 225 passed, exit 0 | matches the ≥225 baseline |
| `nx test @org/dashboard` | **PASS** — 1283 passed (115 files), exit 0 | matches the ≥1283 baseline |
| `nx run-many -t typecheck` (clean-slate: deleted `dist` + `*.tsbuildinfo` first) | **PASS** — exit 0, 3 projects | no TS6305 flake observed |
| `nx lint @org/dashboard --skip-nx-cache` | **PASS** — 0 errors / 0 warnings, exit 0 | |
| `nx build @org/dashboard --skip-nx-cache` | **PASS** — exit 0, largest chunk `LineChart` 285.69 kB | no >500 kB chunk warning |
| `nx e2e dashboard-e2e --skip-nx-cache` | **PASS** — 37/37, exit 0 | fresh run, not cache |
| `interface_conformance.py --auth-signup` | **PASS** — 0 endpoint failures (3/3: `GET credential`, `GET book`, `POST refresh`) | fresh throwaway account |

No suite is "green by printed summary only" — every one above was checked for exit code and, for
the backend, individual test names were enumerated (`-o addopts="" -v`) and read, not just counted.

## Headline finding before the AC table — system-6 security review is UNRESOLVED and live-reproduced

`.claude/contracts/broker-connect/SECURITY_REVIEW_BROKER.md` exists on disk (uncommitted,
`git status` shows it untracked) recording a system-6 red-team pass dated 2026-08-04: **1
Critical, 3 High, 5 Medium, 5 Low, 7 Info** findings. The `_MANIFEST.md` still shows `QA (GATE Q):
n/a` — this is genuinely the first GATE Q pass, and the security findings have not been fixed. I
independently **re-reproduced three of them live** this session (not just read the document):

- **S-1 (Critical) — the real Webull adapter cannot complete a single HTTPS request.**
  `webull_adapter._shim_sdk_compat()` aliases `six` but never restores `ssl.wrap_socket` /
  `PROTOCOL_SSLv23` / `CERT_NONE`, which Python ≥3.12 removed. The production Docker image pins
  `PYTHON_VERSION=3.12` (confirmed: `apps/api/Dockerfile:42`); the local `.venv` is 3.14 — both
  affected. I called `WebullProvider().fetch_book()` directly against the real (unmocked)
  `_SdkTransport` with a synthetic credential and got:
  ```
  NameError: name 'PROTOCOL_SSLv23' is not defined
  ```
  every time, mapped by the adapter's own catch-all to `state: unknown, reason: adapter_fault` —
  **indistinguishable from a genuine Webull outage**, and identical for a dead key AND a
  hypothetically valid one. **No real Webull connection can succeed today, in any environment
  this repo deploys to.** This is the single most load-bearing runtime property this entire
  feature exists to deliver, and it is dead. It escaped both suites because every test (adapter
  fixtures, component tests, conformance, e2e) injects a fake transport or the `stub` provider —
  `_SdkTransport` itself has zero test coverage, exactly as the review states.
- **H-2 (High) — `GET /api/broker/book` is completely unthrottled before any good snapshot
  exists.** Live-reproduced: 8 rapid `GET /api/broker/book` calls against a credentialed account
  with `STUB_BROKER_BOOK=broker_unreachable` (no cache ever forms) produced **8 distinct
  `last_attempt_at` values** — every call is a real "attempt", none throttled. This directly
  contradicts SPEC §5 ("Server-side throttle owns retry aggression; the client never retries
  against the broker... No auto-retry storm; user-initiated only") and is reachable through the
  shipped UI's own S5 "Try again" button.
- **M-1 (Medium) — a plaintext secret is echoed in a 422 response on wrong-typed input.** Live-
  reproduced: `PUT /api/broker/credential` with `{"app_key": ["SUPERSECRET_MARKER_XYZ_9911"], ...}`
  (array instead of string) returns FastAPI's default validation error with
  `"input":["SUPERSECRET_MARKER_XYZ_9911"]` verbatim in the body. The existing AC-5 test only
  covers the fixed-message missing/empty-half 422 shape, not this one.

H-1 (account number in an ERROR-level log line) and H-3 (a process-global lock held across the
blocking Webull HTTP call — a cross-account DoS / thread-pool-starvation risk) were not
independently re-executed by me (H-1 needs log-capture plumbing, H-3 needs concurrent real
fetches which S-1 currently makes impossible to even attempt) but the review's method and the two
findings I did reproduce give me no reason to doubt them; I am treating them as verified-by-the-
system-6-review for this report.

**This is a GATE Q blocker independent of the AC table below** — a green AC list over a broken
invariant is still a FAIL, and `[no-real-order-path]`/`[secret-encrypted-at-rest]` structural
proofs (below) hold, but the feature's actual purpose — reading the owner's real book — cannot
happen.

## Acceptance criteria (SPEC.md §3, verbatim)

| # | Acceptance criterion (verbatim) | Verdict | Evidence |
|---|---|---|---|
| 1 | Signed in, the owner saves a Webull App Key + Secret in Settings; afterwards the UI shows only a masked hint (last-4 of the App Key). The full secret is never displayed again on any surface. | **PASS** | Live Playwright walk: `PUT` via the Settings `#brokerage` form → UI shows `Webull · key ····5678`; automated scan of the page's `innerText`, full HTML (`page.content()`), `localStorage`/`sessionStorage`, and every JSON network response for the submitted key/secret strings all returned `false` (no match). Backend: `test_put_both_halves_returns_masked_hint`, `test_get_after_put_shows_hint_only` pass. |
| 2 | Rotate: saving a replacement credential updates the masked hint, and subsequent real-book fetches use the new credential (observable: fetches succeed after rotating from a dead key to a good one). | **FAIL** | The masked-hint half is fine (`test_rotate_overwrites_single_record` passes; live PUT→PUT shows the hint's last4 change). The **"fetches succeed" half is unverifiable as true and in fact false today**: because of S-1 above, a real fetch fails identically (`adapter_fault`) for a dead key AND a valid key — there is no key value for which "fetches succeed" is observable in the shipped real adapter. |
| 3 | Delete/disconnect returns the Broker tab to not-connected, and no real-position data remains visible anywhere in the app afterwards (server cache invalidated on delete). | **PASS** | Live walk: connected (2 stub positions rendered, AAPL/SPY visible) → Settings → Disconnect → confirm → Settings shows the empty write-only form + "Webull disconnected."; Broker tab re-visited shows S1 with **no** AAPL/SPY text anywhere in the DOM (checked via `innerText.includes`). Direct API walk: `DELETE credential` → next `GET book` returns `{"state":"unknown","reason":"no_credential_stored"}` (no ghost book). Backend `test_delete_invalidation_leaves_no_ghost_field`, `test_invalidate_drops_snapshot_and_attempt_history` pass. |
| 4 | Logged out (or with the client check bypassed), every broker surface — credential save, rotate, delete, real-book read, refresh — is refused server-side. | **PASS** | Live direct-HTTP walk, no cookie: `GET/PUT/DELETE /api/broker/credential`, `GET /api/broker/book`, `POST /api/broker/book/refresh` all → `403 {"error":"auth_required",...}`. Backend `test_anonymous_is_refused_on_all_three`, `test_anonymous_is_refused_on_both_book_routes`, `test_gate_refusal_is_a_real_status_not_a_product_state` pass. |
| 5 | After save, the plaintext secret appears in no server response, no page source, no browser storage, and no log line; a server decrypt failure presents as "no usable credential", never as leaked content and never as a Webull rejection. | **FAIL** | The documented, happy-path save flow is clean (see AC-1 evidence) and `credential_unreadable` is correctly distinct from `credential_rejected` (`test_decrypt_fail_is_ours_never_webulls`, `test_credential_repr_and_str_are_masked` pass). **But** M-1 above is a live-reproduced counter-example to the literal claim "appears in no server response": a wrong-typed `PUT` echoes the raw secret verbatim in the 422 body. The existing suite does not cover this shape, so the AC's "test" verification is incomplete, and the AC's letter is currently false under a reachable request shape. |
| 6a | *(unconditional)* every reported position listed, none absent/merged/altered, count never understating. **Test arm:** binds to captured fixtures. **Review arm:** owner app-vs-tab comparison. | **Test arm: PASS. Review arm: UNVERIFIABLE (owner-owed, and currently blocked).** | Test arm: `test_every_fixture_position_appears_count_never_understates`, `test_the_real_book_maps_to_five_exact_nine_partial_zero_unrecognized` (5 exact + 9 partial + 0 unrecognized = 14, matching `CAPTURE_FINDINGS.md`'s "14 positions — 5 STOCK + 9 OPTION") pass against the real committed fixture. Review arm: I am not the owner and have no Webull app to compare against — correctly out of scope for me per the task brief. Separately, S-1 means **even the owner cannot perform this review today**: no live fetch against the real account can succeed to produce a tab to compare, so this arm is not just "not yet done," it is currently *undoable*. |
| 6b | *(conditional)* grouping identity present ⇒ grouped; flat ⇒ honest per-contract rows, never heuristic composition. | **PASS** | `CAPTURE_FINDINGS.md (a)`: grouping-identity candidate list is empty (flat payload, settled fact). Backend `test_flat_payload_never_composes_contracts_into_strategies`, `test_option_entries_carry_no_contract_detail_at_all` pass. Live-rendered stub multi-leg row (`SPY` vertical) correctly groups when *legs share an explicit position id* (stub-only shape) — consistent with "honest rows either way, one authority" since the real payload has no grouping identity and correctly renders one leg per position (confirmed by the 5/9/0 fidelity split above: 9 real option rows → 9 single-leg `partial` positions, not composed). |
| 7 | Every render carries a visible as-of stamp + read basis. Tab label "Broker". "live" never appears as a freshness claim except the negation phrase. | **PASS** | Live Playwright render: header text exactly `WEBULL · READ-ONLY / as of {time} / read on demand — a snapshot, never live.`; tab label reads "Broker" (internal testid `tab-live` kept per the carve-out, never rendered). FE forbidden-word test (`broker.risk.spec.tsx`: "every BROKER_COPY string... `live` appears ONLY negated", with its own mutation guard) and e2e `broker.spec.ts` ("appears only inside the negation phrase") both pass. |
| 8 | Manual refresh always requests a fresh read; stamp advances on success; a cache-served/failed refresh visibly says so, never a silent no-op. | **PASS** | Live walk: clicking Refresh immediately after the first fetch (inside the server's min-interval) produced the honest "Unchanged — still your book as of {time}. Webull wasn't asked again just now..." note, stamp unchanged — not a silent no-op. `BrokerTabPanel.spec.tsx`: "a THROTTLED refresh renders the unchanged-and-why note", "a transport-faulted refresh still notes itself" pass. Caveat: with the real adapter, the *successful*-fresh-fetch arm (stamp advancing) can never be observed today (S-1) — verified via the stub provider only, which is the sanctioned method per SPEC §7 for the wire mechanics, but the end-to-end real-broker claim is unconfirmable. |
| 9 | Not connected: explicit not-connected state pointing to Settings, never an empty table. | **PASS** | Live render: full S1 panel, "Connect your brokerage" heading, exact spec body copy, `Connect Webull` CTA deep-linking to `#brokerage`, sub-line present. No table/rows rendered. `BrokerTabPanel.spec.tsx` "S1 never-connected" test + e2e "signed in, no credential" test pass. |
| 10 | Unknown vs empty textually/visually distinct, closed-lookup-driven, never derived from `positions.length`, neither producible by the other's condition. | **PASS** | `BrokerTabPanel.spec.tsx` "S4 ≠ S5 TEXTUALLY... (AC-10)" test passes. Backend `test_empty_and_unknown_both_carry_positions_list` confirms both carry `positions: []` and `state` is the sole disambiguator (live-verified too: stub `empty` arm vs `no_credential_stored` unknown arm both return `positions: []` with different `state`). |
| 11 | Stale snapshot fields keep last-known values, visibly marked, never blanked/silently-refreshed; governed by age vs `stale_after_seconds`, book-snapshot axis only. | **PASS** | `BrokerTabPanel.spec.tsx` "stamp invariant" (S3–S8) and "stale book + feed up... AC-21" tests pass (these directly exercise AC-11's scope as the grid's snapshot-field column). Backend `test_unreadable_keeps_serving_the_last_good_book`, `test_failed_attempt_advances_attempt_but_never_evicts` confirm server-side retention within a process lifetime. |
| 12 | Broker outage/rate-limit degrades the Broker tab ONLY; Ticker/SSE/sim/scanner byte-identical; served snapshot stays visible under a degraded banner, else AC-10's unknown shows. | **PASS**, with a caveat noted separately (H-3) | Live A/B I performed myself (see AC-17) proves bundle/score/tier/fingerprint byte-identical connect vs disconnect. `BrokerTabPanel.spec.tsx` "S7 degraded" test passes. **Caveat, not scored against this AC:** the security review's H-3 (unreproduced by me — needs concurrent real fetches, which S-1 blocks) argues a process-global lock held across the blocking Webull call could, under real multi-account concurrency, starve the shared `asyncio.to_thread` pool and reach non-broker surfaces — a deeper violation of the same isolation invariant than AC-12 tests for today. Flagged in the invariant audit below, not scored as an AC-12 fail since it is a reasoned-not-executed escalation. |
| 13 | `credential_rejected`: distinct warning state, distinguishable from AC-12's outage and from `credential_unreadable`. | **FAIL** | The mapping logic and its render are correctly implemented and unit-tested (`test_bad_credential_fixture_maps_to_credential_rejected`; `BrokerTabPanel.spec.tsx` S8 tests pass against a wire fixture). **But S-1 means the real adapter can never reach Webull to receive the 401 that would produce `credential_rejected`** — every real attempt dies at the SSL layer first and surfaces as generic `adapter_fault`, the exact state AC-13 requires to be distinguishable from. In production, a revoked/expired/wrong key is currently indistinguishable from an outage. |
| 14 | Unrepresentable position ⇒ explicit cannot-fully-display entry; count never understates; missing facts render `not provided`, never 0/blank. | **PASS** | Backend `test_the_real_book_maps_to_five_exact_nine_partial_zero_unrecognized`, `test_every_omission_is_named_in_fidelity_notes`, `test_option_contract_facts_are_omitted_on_the_wire_never_null_padded` pass. FE `BrokerTabPanel.spec.tsx`: "fidelity: UNRECOGNIZED gets the cannot-fully-display entry, PARTIAL keeps its full row; the count never understates (AC-14)" passes. |
| 15 | Zero order/trade/close/modify affordances, including disabled/"coming soon"; no copy implying an order path; nothing references `TradeEntryDialog`. | **PASS** | Live render: only `Refresh` and `Build reassessment` buttons visible anywhere on the tab — no Close/Trim/Roll/disabled-order affordance. `broker.risk.spec.tsx`: "zero order affordances on every wire arm" (with a mutation guard proving the predicate actually fires) and "NO broker file references TradeEntryDialog, the sim store, or any durable key" pass. |
| 16 | No flow creates/alters a sim position from a real row; sim tab + ledger numbers identical before/after connecting a broker. | **PASS** | Live walk: "Track record" / sim ledger widget shows identical text ("Nothing has closed yet.", "+$0") before connecting, while connected, and after disconnecting. `broker.risk.spec.tsx` "durable isolation across connect/disconnect, mutates NO convexa.* byte" passes. |
| 17 | Score/tier/`state_fingerprint` byte-identical with/without a connected broker (same ticker). | **PASS** | Live A/B I ran myself against the real `massive` provider (not mocked): `(score, tier, fingerprint)` = `(62, 'actionable', 'e8a883b0544b')` identical across three states — before connecting, after connecting (credential + a full `GET /api/broker/book`), and after deleting. `git diff --stat` over `apps/api/src/core` + `apps/api/src/providers` across every broker-connect commit (`19e11a7..HEAD`) is **empty**. |
| 18 | Reassessment referencing a real holding visibly carries the real position's as-of basis. | **PASS** | Live render: "Build reassessment" opens a dialog titled "Reassessment request — advisory only" with a foregrounded basis line `on your book as of {iso} ({time}) · Webull · read-only · read on demand — a snapshot, never live.` and the same string duplicated machine-readably in the exported JSON's `as_of_basis`/`as_of`. `reassess.spec.tsx` "carries the as-of basis STRING and the machine stamp — staleness always disclosed (AC-18)" passes. |
| 19 | Reassessment verdict on a real position offers no Accept-into-store or write action; sim Accept flow byte-identical. | **PASS** | Live render: dialog offers only "Copy request" / "Close" — no Accept/write control. `reassess.spec.tsx` "BrokerReassessAction — advisory only (AC-19)" passes; the sim reassessment path is untouched by this feature's diff (no shared files modified) and the full dashboard suite (1283/1283) including the existing sim-accept specs is green. |
| 20 | No fabricated sample/demo positions presented as real; a bad/unapproved key lands in AC-13's rejected state, not a hang or fake success. | **FAIL** | First half PASS: the stub provider only serves when `POSITIONS_PROVIDER=stub` is explicitly selected (a keyless-verification env choice, never active alongside a real credential in a real deployment) — no fabricated data was observed under any live walk. **Second half FAILS live**, same root cause as AC-13: a bad/unapproved key does not "hang" and does not "fake a success," but it also does **not** land in AC-13's rejected state — it lands in the same generic `adapter_fault`/S5 state a perfectly valid key would also produce (S-1), which misattributes a credential problem as an outage. |
| 21 | Convexa-modeled P/L, market-data-axis-only degradation, dual-basis label when stale+feed-up. | **PASS** | `BrokerTabPanel.spec.tsx` "two-axis degradation" describe block (SSE-drop dims ⏸ / byte-identical snapshot fields; stale+feed-up dual-basis label; fresh+feed-up single-basis label) — all pass. Live render: the G3 not-provided-vs-unavailable split observed correctly (`unavailable` shown for the this-cycle no-live-feed case in my walk, matching the "this-cycle vs permanent" rule). |
| 22 | *(conditional)* Webull's own P/L carried verbatim, may render as a static reference, never blended, never unnamed. | **PASS** | Backend: `unrealized_pl` carried as tri-state verbatim (`test_unrealized_pl_supplied_is_carried_verbatim`, `test_webulls_own_option_pl_is_carried_verbatim_even_though_it_is_wrong` — including the arithmetically-wrong figure, un-"fixed"). Owner ruling Q2 elected NOT to render it; confirmed never rendered anywhere (`unrenderedBrokerPl.spec.tsx` + its source-scan + mutation guard pass). "May render" is discretionary, not mandatory — the owner's non-render choice satisfies the AC. |
| 23 | Cross-account isolation: a second signed-in account sees only its own state; anonymous gets 401/403, never data. | **PASS** | Live-verified with **two genuinely distinct, freshly signed-up Convexa accounts** (A and B): A connects a credential and gets a full `state: ok` book; B (never touched) gets `{"set":false,"last4":null}` and `{"state":"unknown","reason":"no_credential_stored"}` from both `GET /book` and would from `POST /refresh` — no field of A's book, `account_ref`, or hint reached B. Anonymous → 403 on all five endpoints. Backend `test_two_user_isolation_shares_no_field` passes. `SECURITY_REVIEW_BROKER.md`'s adversarial re-verification (session fixation, cache-key collision, log egress) is documented and consistent with what I observed. |

**Summary: 17 PASS · 5 FAIL (AC-2, AC-5, AC-13, AC-20, plus the AC-6a review arm UNVERIFIABLE) · 1 UNVERIFIABLE (AC-6a review arm).**

## Invariant audit

| Invariant | Verdict | Evidence |
|---|---|---|
| `[no-real-order-path]` | **PASS** | `PositionsProvider.__abstractmethods__` = exactly `{'fetch_book', 'describe'}` (introspected live). `find` over the installed site-packages for order/trade modules matching `webull*` returns nothing; `webull-python-sdk-trade` is not installed (confirmed via `pip`/`find_spec`, matches `CAPTURE_FINDINGS.md (f)`). |
| `[secret-encrypted-at-rest]` | **PASS**, with the AC-5/M-1 caveat above | Fernet via the existing `auth/crypto.py`, ciphertext-only persistence (`SECURITY_REVIEW_BROKER.md` "Checked and clean" confirms `sqlite_store.py`/`postgres_store.py` write only `(ciphertext, last4)`); live-verified no plaintext in the happy-path response/HTML/storage. The 422-echo gap (M-1) is a narrow, live-reproduced counter-example under malformed input, not a design failure of the encryption-at-rest mechanism itself. |
| `[server-side-gate-enforcement]` | **PASS** | All five endpoints refuse anonymous requests server-side (live-verified, direct HTTP, no cookie). |
| `[best-effort-isolated-or-null]` | **PASS** for the tested arm; **flagged** for H-3's untested concurrency escalation | AC-17's live A/B proves broker connect/disconnect leaves the scoring/bundle path byte-identical. H-3 (global lock across a blocking I/O call) is a *liveness* risk under real multi-account concurrency that the security review reasoned through but did not execute (S-1 currently makes it impossible to execute against the real adapter). Recorded, not scored as a fail, since phase-1 is one owner/one account and the isolation property I could actually exercise held. |
| `[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` | **PASS** | Two-axis grid fully test-covered and spot-checked live (AC-21). |
| `[absent-is-not-none]` | **PASS** | `state` is the sole disambiguator end-to-end (AC-10); tri-state `BrokerFact` confirmed at the wire (live `GET /book` response inspected: `{"state":"not_supplied"}` present with no `value` key, never a bare `null`). |
| `[loss-free-durable-migration]` | **PASS** | No durable shape changed; `BrokerPosition` is additive; confirmed via the empty `git diff --stat` over `core`/`providers`. |
| `[single-shared-sim-entry-dialog]` (narrowed) | **PASS** | No `TradeEntryDialog` reference anywhere on the broker surface (source-scan test, live code read). |
| `[additive-keeps-score-byte-identical]` | **PASS** | Live A/B (AC-17) + empty `git diff --stat` over `apps/api/src/core` and `apps/api/src/providers` across every `broker-connect` commit since `19e11a7`. |
| `[theme-token-discipline]` | **PASS** | `grep` for hex literals across every broker FE source file (excluding specs) returns nothing. |
| `system-6 security review fires here` (BRIEF invariant watch) | **FAIL** | The review happened and is thorough, but is **unresolved**: 1 Critical + 3 High findings stand in the shipped code, two of which (S-1, H-2) I independently reproduced live this session, plus one Medium (M-1) I also reproduced live. `_MANIFEST.md` still shows `QA (GATE Q): n/a` — these findings have not passed through any gate yet. |

## Overall GATE Q verdict: **FAIL**

Not every criterion failing is cosmetic: **S-1 means the shipped real Webull adapter cannot
complete a single HTTPS request in any environment this repo deploys to (Python 3.12 Docker
image, and the 3.14 local venv).** Every AC that depends on an actual live real-broker fetch
succeeding or a real credential rejection being distinguishable from an outage (AC-2, AC-13,
AC-20) is broken as a direct, traceable consequence, and AC-6a's owner-owed review arm cannot
even be attempted right now. This sits on top of a genuinely strong build otherwise — 225/225 and
1283/1283 unit suites, 37/37 e2e, clean conformance, a comprehensive fixture-backed
characterization suite for the real payload shape, and a live, self-verified score-byte-identity
A/B — but a green AC list over a broken invariant (here: the feature's entire reason to exist,
plus an unresolved system-6 Critical) is still a FAIL per the standing rule.

## Amendments bounced to Backend

| Failing AC / finding | Observed | Expected | Owning lane |
|---|---|---|---|
| S-1 (Critical, `SECURITY_REVIEW_BROKER.md`) — root cause of AC-2, AC-13, AC-20 | `WebullProvider().fetch_book()` raises `NameError: name 'PROTOCOL_SSLv23' is not defined` inside the vendored SDK's SSL path on every real call, on Python ≥3.12 (the pinned Docker version); mapped to indistinguishable `adapter_fault` | The runtime `_shim_sdk_compat()` must bind `PROTOCOL_SSLv23`/`CERT_NONE` on the vendored `ssl_` module before any SDK import (the review's own proposed smallest fix is in `SECURITY_REVIEW_BROKER.md` S-1) so a real HTTPS request can complete at all | Backend |
| AC-2 | "Fetches succeed after rotating from a dead key to a good one" is not observable — every key fails identically | A valid credential must be able to complete a real fetch after S-1 is fixed | Backend |
| AC-13 / AC-20 | `credential_rejected` can never be produced by the real adapter (dies before reaching Webull's 401) | Once S-1 is fixed, a genuinely rejected credential must reach Webull and surface `credential_rejected`, distinct from `adapter_fault` | Backend |
| H-2 (High) | 8 rapid `GET /api/broker/book` calls with no good snapshot → 8 distinct `last_attempt_at` (fully unthrottled) | The non-force GET arm must consult the same server-side min-interval throttle as the force-refresh arm (review's proposed fix is in `service.py`'s non-force branch) | Backend |
| M-1 (Medium) | `PUT /api/broker/credential` with a wrong-typed body (`{"app_key":["..."]}`) echoes the raw submitted value verbatim in the 422 `detail[].input` field | A `RequestValidationError` handler must strip `input`/`ctx` globally (or at minimum for the credential routes) so no submitted value round-trips in any 4xx body | Backend |
| AC-6a review arm | Owner-owed human app-vs-tab comparison; currently undoable because no live fetch can succeed (S-1) | Re-attempt once S-1 is fixed | Backend (blocker), then Owner (review) |

H-1 (account number reaching an ERROR-level log line) and H-3 (global lock held across the
blocking Webull call) are documented in `SECURITY_REVIEW_BROKER.md` and were not independently
re-executed by me this session (see the headline section above for why); recommend they ride the
same Backend bounce alongside S-1/H-2 since fixing S-1 makes both live for the first time.

---

## Addendum — a fix landed IN THE WORKING TREE during this QA session (uncommitted)

Everything above reflects the code as committed (`HEAD` at session start / throughout: `6fd9cdb`)
— that is what I ran every gate and every live reproduction against, and it is what the verdicts
above are scored on. Late in this session, `git status` showed
`apps/api/src/broker/webull_adapter.py` as **modified, unstaged, uncommitted** — a change I did
not make (my only `Write` this session was this report). Someone/something else was actively
editing this exact file, concurrently, in this same working tree, while I was testing it.

The diff adds `_shim_vendored_ssl()` (binding `PROTOCOL_SSLv23`/`CERT_NONE`/`HAS_SNI` on the
vendored `ssl_` module — the S-1 fix) and `_install_sdk_log_redaction()` (routing the SDK's
logger through a redacting filter and killing propagation — the H-1 fix), both wired into
`_shim_sdk_compat()`. It is well-commented and references S-1/H-1 by name, so it reads as a
direct response to `SECURITY_REVIEW_BROKER.md`.

**I ran exactly one read-only, informational check against this uncommitted code** (not a full
re-verification — that would need a fresh QA pass once it lands committed): calling
`_SdkTransport(fake_credential).subscriptions()` directly. It no longer raises `NameError` — it
now reaches `api.webull.com` and gets back a genuine `ServerException: HTTP Status: 401, Code:
UNAUTHORIZED` for the fake credential, which is real evidence the HTTPS path now completes and
that `credential_rejected` (AC-13/AC-20) may now be reachable once that response is threaded
through the existing (already-tested) failure-mapping logic. I did **not** re-run the full suite,
the e2e pass, or any live A/B against this change — it is uncommitted, unreviewed, and untested
work-in-progress by whoever is making it, not "shipped code."

**This does not change my verdict above.** GATE Q scores the code that was actually delivered to
this session (`HEAD`), and that code fails as documented. But the orchestrator should know: a fix
for the headline blocker may already be in flight, and a second, fully-fresh QA pass will be
needed once it is committed and its owning lane has re-run the full gate suite (this file's own
`_SdkTransport` has zero existing test coverage per the security review, so a new test guarding
against an S-1 regression should exist before the next GATE Q passes it).
