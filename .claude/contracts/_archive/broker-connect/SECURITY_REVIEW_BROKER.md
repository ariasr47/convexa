# broker-connect — system-6 security / red-team review

**Scope:** SPEC.md §8.1 (verbatim remit) + the capture/probe tooling.
**Reviewed:** 2026-08-04 · adversarial pass, **fixes nothing**.
**Method:** source read + targeted greps + executed proofs against the real modules and the
installed SDK. No real Webull credential was used or requested; live arms ran with
`POSITIONS_PROVIDER=stub` and a dummy `MASSIVE_API_KEY`, plus direct in-process probes.

## Verdict

| Severity | Count |
|---|---|
| **Critical** | 1 |
| **High** | 3 |
| **Medium** | 5 |
| **Low** | 5 |
| **Info** | 7 |

**Ordering note that matters for triage.** S-1 (Critical) means **no HTTPS request to Webull
can currently complete at all**. While S-1 stands, H-1/H-2/H-3 are latent — every "broker
contact" fails instantly and locally, so nothing reaches Webull and nothing blocks for long.
The moment S-1 is fixed, all three go live simultaneously. Fix S-1 and H-1/H-2/H-3 together
or the fix for S-1 is the trigger for the other three.

The confidentiality core is **strong**: no credential, ciphertext, or key fragment reaches any
response body, browser surface, committed file, or first-party log line on any path exercised.
Every finding below is either an SDK-transitive egress, an availability/abuse property, or a
scoping gap in a defense the code already intends.

---

## Critical

### S-1 · The shipped Webull adapter cannot complete a single HTTPS request (Python ≥3.12)

**Where:** `apps/api/src/broker/webull_adapter.py:376-397` (`_shim_sdk_compat`) vs
`apps/api/tests/capture_broker_fixtures.py:126-176` (`_shim_ssl_wrap_socket` + `_shim_sdk_compat`).
**Root cause:** `.venv/Lib/site-packages/webullsdkcore/vendored/requests/packages/urllib3/util/ssl_.py:60`
imports three names on one line —
`from ssl import wrap_socket, CERT_NONE, PROTOCOL_SSLv23` — inside a bare `except ImportError: pass`.
Python 3.12 **removed `ssl.wrap_socket`**, so the whole statement aborts and `PROTOCOL_SSLv23`
and `CERT_NONE` are left **unbound as module globals**. `connection.py:342-346` then calls
`resolve_ssl_version(self.ssl_version)` with `ssl_version=None` on every HTTPS connect
(`self.ssl_context is None` — requests 2.18.3 never sets one), and `ssl_.py:228-230` returns the
unbound name.

The **capture tool** applies `_shim_ssl_wrap_socket()` and therefore worked. The **runtime
adapter's** `_shim_sdk_compat()` only aliases `six` — it does **not** restore the ssl names. The
code path proven against real Webull is not the code path that ships.

**Proof (executed):**

```
== real HTTPS attempt through the vendored stack, RUNTIME shim only ==
  NameError: name 'PROTOCOL_SSLv23' is not defined
  map_failure(...) would classify this as: adapter_fault
== and WITH the capture tool's ssl shim applied (what B1 actually ran) ==
  after shim+reload, PROTOCOL_SSLv23 bound: True
```

**Why it survived to this gate:** no test constructs `_SdkTransport`. `tests/test_broker_adapter.py:142`
injects a fake `transport_factory`; `:703` only calls `describe()`. The real transport has zero
coverage. The Docker image pins `PYTHON_VERSION=3.12` (`apps/api/Dockerfile`) — the removal
version — so production has the identical gap; the local venv is 3.14.

**Concrete exposure:** the NameError escapes `_SdkTransport`, is caught by
`webull_adapter.py:466` (`except Exception`), and `map_failure` (a `NameError` carries no
`http_status`/`error_code` and is not an `OSError`) returns `"adapter_fault"`. The owner sees a
permanent S5/S7 "couldn't read your book" that is **indistinguishable from a Webull outage** —
the exact honesty failure the render-state machine was built to prevent. AC-2, AC-6a, AC-8,
AC-13 and AC-20 ("a connect attempt with a bad key lands in AC-13's rejected state, not a hang
or a fake success") cannot hold.

**Smallest fix:** in `webull_adapter._shim_sdk_compat()`, after the six aliasing and **before**
any SDK import, bind the two missing names on the vendored module:

```python
import ssl as _ssl
from webullsdkcore.vendored.requests.packages.urllib3.util import ssl_ as _v
if not hasattr(_v, "PROTOCOL_SSLv23"):
    _v.PROTOCOL_SSLv23 = _ssl.PROTOCOL_TLS_CLIENT
    _v.CERT_NONE = _ssl.CERT_NONE
```

**Do NOT** copy the capture tool's `_shim_ssl_wrap_socket` into the runtime — see I-3: it
installs a global `ssl.wrap_socket` whose defaults are `CERT_NONE` + `check_hostname=False`.
Add one test that drives `_SdkTransport` against a local listener and asserts the failure is a
*network* failure, not a `NameError`.

---

## High

### H-1 · The raw Webull account number reaches an **ERROR**-level log line (SDK transitive)

**Where:** `webullsdkcore/client.py:284-286`. On any transport `IOError`,
`_handle_single_request` builds
`ClientException(SDK_HTTP_ERROR, '%s' % e)` and emits
`logger.error("HttpError occurred. Host:%s SDK-Version:%s ClientException:%s")`. The requests/
urllib3 exception string embeds the **full request URL including its query string**, and
`webullsdkcore/request.py:266-275` (`ApiRequest.get_url`) puts `account_id` in the query string
(`webull_adapter.py:426` — Webull's own API shape, unavoidable).

**Proof (executed under the app's real logging config — `main.py:61-62` is the only logging
configuration in the app):**

```
  webullsdkcore.client   level=NOTSET  effective=WARNING  propagate=True   <- ERROR is emitted
  client.py:284-286 would logger.error(...):
    HttpError occurred. Host:api.webull.com SDK-Version:0.1.18 ClientException:SDK.HttpError
    HTTPSConnectionPool(host='127.0.0.1', port=1): Max retries exceeded with url:
    /account/positions?account_id=1234567890REALACCT&page_size=100 (Caused by ConnectTimeoutError(...
  ACCOUNT NUMBER PRESENT IN LOG LINE: True
```

**Attack/exposure:** no attacker action is needed — a single Webull timeout or DNS blip writes
the owner's raw brokerage account number to stderr, which the platform (Railway) captures and
retains. This is the precise thing `account_ref`'s keyed hash exists to prevent, defeated one
layer below it. SPEC §8.1 Logging: "no secret, signature material, **account number**, or
position detail in logs at any default level."

**Note:** `CAPTURE_FINDINGS.md` flagged the DEBUG body-logging risk (`client.py:367`) and that
one is genuinely mitigated (see "Checked and clean"). The live leak is at **ERROR**, which the
findings note did not anticipate.

**Smallest fix (one line, in our code):** silence the SDK's own logger at wiring time and rely
on the adapter's already-clean cause-only line at `webull_adapter.py:469`:

```python
logging.getLogger("webullsdkcore").setLevel(logging.CRITICAL + 1)
```

Put it in `webull_adapter._shim_sdk_compat()` so it lands before any SDK log call. (A
redaction filter on that logger is the fuller answer; suppression is the minimum, and we
already emit our own typed cause.)

### H-2 · `GET /api/broker/book` is completely unthrottled when no good snapshot exists — one real Webull call per request

**Where:** `apps/api/src/broker/service.py:125-129`.

```python
if not force:
    snap = ustate.snapshot
    if snap is not None and (now - snap.fetched_at) < self._ttl:
        return self._assemble(ustate, basis="cache")
    return self._attempt(ustate, credential, now)      # <- no throttle on this arm
```

The TTL is the GET path's *only* brake, and it requires a **successful** snapshot to exist.
Before the first success, or whenever the state is `credential_rejected` /
`broker_unreachable` / `rate_limited`, `ustate.snapshot is None` and **every GET performs a
real broker contact**. `_min_interval` is consulted only on the `force` (refresh) arm.

**Proof (executed):**

```
20 GET /api/broker/book -> 20 real broker contacts
20 POST /refresh        ->  1 real broker contact  (throttle works there)
```

**Attack/exposure:** the shipped UI reaches it — S5's `Try again` control calls
`useBrokerBook.refetch()` (`apps/dashboard/.../useBrokerBook.ts:95-109`), which is
`GET /api/broker/book`. A trader clicking "Try again" during a Webull outage generates one
unthrottled Webull call per click; a hostile or looping signed-in client generates them at
request rate. Against a **rejected** credential this hammers Webull's auth-failure counters
with the owner's own key. SPEC §5 states the opposite contract: "Server-side throttle owns
retry aggression; the client never retries against the broker" / "No auto-retry storm;
user-initiated only." The remit's replay/abuse question — "can it be abused to hammer the
owner's own Webull rate limits" — answers **yes, through the GET path**.

**Smallest fix:** apply the same server-authoritative interval to the non-force arm, before
`_attempt`:

```python
if not force:
    snap = ustate.snapshot
    if snap is not None and (now - snap.fetched_at) < self._ttl:
        return self._assemble(ustate, basis="cache")
    if ustate.last_attempt_ts is not None and \
            (now - ustate.last_attempt_ts) < self._min_interval:
        return self._assemble(ustate, basis="cache")     # not an attempt — C5 preserved
    return self._attempt(ustate, credential, now)
```

This keeps C5 intact (a throttled serve is still not an attempt; `last_attempt_at` does not
move) and the FE's existing `refreshOutcomeOf` already renders the honest unchanged-and-why
note for it.

### H-3 · The book-service lock is process-global and is **held across the blocking broker HTTP call**

**Where:** `apps/api/src/broker/service.py:86` (`self._lock = threading.Lock()`), `:92-98`
(`with self._lock: return self._serve(...)`), `:137-149` (`_attempt` calls
`self._provider.fetch_book(...)` — up to 50 pages × 10s read timeout — *inside* that lock).

**Proof (executed):**

```
== global lock / head-of-line block across accounts ==
  A took 2.00s; B (a DIFFERENT account) took 3.80s for its own 2.0s fetch
  VERDICT: GLOBAL LOCK CONFIRMED (B blocked ~1.80s)
```

**Attack/exposure:** the *throttle* is correctly per-account (probe 3: A then B → 2 contacts),
but the *lock* is not. One account's slow or hanging Webull fetch stalls every other account's
broker request — a cross-account DoS by construction, which is exactly the property SPEC §8.1
asks the red team to look for.

The escalation (reasoned, not executed): `main.py:945` dispatches the call via
`asyncio.to_thread`, which uses the event loop's **default `ThreadPoolExecutor`**
(`min(32, cpu+4)` workers), shared with every other `asyncio.to_thread` caller in the app —
including bundle compute. Enough concurrent broker requests behind a stalled fetch occupy all
of those workers, and the starvation reaches non-broker surfaces. That crosses
`[best-effort-isolated-or-null]`'s "a broker failure degrades the Broker tab ONLY".

**Mitigating context, stated honestly:** phase-1 is one account and one trader, so the
cross-account arm has no second party today; and while S-1 stands, no fetch takes any wall time.

**Smallest fix:** hold the lock only for the state read/write, never across I/O — take the
credential + prior_ref under the lock, release it, perform `fetch_book`, then re-acquire to
commit the snapshot. A per-user lock (`self._user_locks[user_id]`) is the alternative and also
removes the cross-account arm; the "never hold a lock across network I/O" version additionally
removes the thread-pool escalation.

---

## Medium

### M-1 · FastAPI's 422 validation echo returns raw credential material — the documented AC-5 defense is incomplete

**Where:** `apps/api/src/auth/router.py:71-78`. The comment states the intent exactly:

> Fields are optional at the Pydantic layer ON PURPOSE: the router does the both-halves 422
> itself, because FastAPI's default validation error echoes the request body back (`input`) —
> which would leak the present half when the other is missing (AC-5).

Making the fields `str | None = None` prevents the *missing-field* 422 — but a **wrong-typed**
field still trips Pydantic's `string_type` validation, and FastAPI's default
`RequestValidationError` handler echoes `input` verbatim. There is no app-wide
`RequestValidationError` handler (`grep RequestValidationError|exception_handler` over `main.py`
+ `src/` returns nothing).

**Proof (executed, live app):**

```
PUT /api/broker/credential {"app_key": ["WEBULL_REAL_APPKEY_ABCD"], "app_secret": ["WEBULL_REAL_SECRET_WXYZ"]}
 -> 422 {"detail":[{"type":"string_type","loc":["body","app_key"],"msg":"Input should be a valid
        string","input":["WEBULL_REAL_APPKEY_ABCD"]},{...,"input":["WEBULL_REAL_SECRET_WXYZ"]}]}
    APPKEY echoed=True   SECRET echoed=True
PUT /api/auth/ai-key      {"key": ["sk-ant-REALKEY-0000"]}
 -> 422 ... "input":["sk-ant-REALKEY-0000"]      echoed=True
```

**Exposure, scoped honestly:** this is a **self-echo** — the requester gets back what they sent,
so it is not a cross-account leak, and SameSite=Lax + CORS deny-all block a cross-site
induction of the request. The real cost is that the response body now carries live key material
where the codebase asserts it never does: browser devtools/extensions, any client-side error
reporter, and any intermediary that captures 4xx bodies. It also falsifies the AC-5 test's
claim of coverage.

**Smallest fix:** register one handler so the echo can never happen anywhere:

```python
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def _no_body_echo(request, exc):
    return JSONResponse(status_code=422, content={
        "detail": [{"type": e["type"], "loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]})
```

(Drop `input` and `ctx` globally — no endpoint needs them.)

### M-2 · All Webull TLS is validated against a **2018** CA bundle vendored inside the SDK

**Where:** `webullsdkcore/http/response.py:120-122` → `verify=True` → the *vendored* requests'
`certs.where()` → `webullsdkcore/vendored/requests/packages/certifi/` — `__version__ =
"2018.01.18"`, 132 roots. The venv has a current `certifi==2026.6.17`; it is not used on this
path.

**Exposure:** an ~8-year-stale trust store. It still contains roots the ecosystem has since
distrusted (the Symantec/Thawte/GeoTrust/VeriSign chain, and later removals such as Camerfirma,
e-Tugra, TrustCor), which weakens MITM resistance on the one connection that carries the
owner's brokerage credential; and it lacks roots added since 2018, so a Webull chain rotation
would present as `broker_unreachable` with no diagnosable cause.

**Smallest fix:** pass the modern bundle at transport construction —
`webull_adapter._SdkTransport.__init__`: `import certifi` and
`ApiClient(..., region_id=region, verify=certifi.where())`. `ApiClient` already takes `verify`
(`client.py:87`), and `get_verify_value()` prefers an explicit value.

### M-3 · `WEBULL_API_DEBUG=sdk` dumps the signed request headers and full response bodies to stderr through a logger the app **cannot** silence

**Where:** `webullsdkcore/http/response.py:50-55` — at import time the module does
`logger.setLevel(logging.DEBUG)`, `logger.propagate = False`, `logger.addHandler(StreamHandler())`.
Verified live: `webullsdkcore.http.response  level=DEBUG effective=DEBUG propagate=False
handlers=[<StreamHandler <stderr>>]`. `do_http_debug` (`:107-117`) then logs the request line,
**every request header** — which includes the `App Key` and the request `Signature`
(`auth/composer/default_signature_composer.py:105`, `:123`) — plus `response.text`, the full
positions payload.

The gate is the env var `WEBULL_API_DEBUG` (`:58`), **not** the app's log level. Because
`propagate=False` and the module owns its handler, `logging.getLogger("webullsdkcore").setLevel(...)`
does not suppress it. Nothing in the repo sets, documents, or defends against this variable.

**Smallest fix:** neutralize it at wiring time in `_shim_sdk_compat()` (both effects):

```python
os.environ.pop("WEBULL_API_DEBUG", None)
_rl = logging.getLogger("webullsdkcore.http.response")
_rl.handlers.clear(); _rl.setLevel(logging.CRITICAL + 1)
```

### M-4 · The owner's real portfolio is committed to the repository

**Where:** `apps/api/tests/fixtures/broker/positions_raw.json` (tracked; commit `dc60a09`
"fixtures(broker-connect): B1 real Webull capture lands (R6)"). Remote:
`https://github.com/ariasr47/convexa.git`.

The sanitizer worked exactly as designed for **identifiers** — `account_id`, `account_number`,
`subscription_id`, `user_id` are all `ACCT_REDACTED` (verified in `account_raw.json`) — but it
was deliberately scoped to identifying *keys*, so the **position content survived verbatim**:
14 real holdings with `symbol`, `qty`, `unit_cost`, `total_cost`, `last_price`, `market_value`,
`unrealized_profit_loss` and `holding_proportion` (e.g. `AMD 25 @ 461.41`, `AAPL 10 @ 309.00`).
That is the owner's live book — position sizes, entry prices and portfolio weights — permanently
in git history.

This is a deliberate engineering choice (the fixtures are the AC-6a characterization baseline)
and it is not a credential leak. It is flagged because "sanitized fixtures" reads as *scrubbed*,
and the decision to publish one's own book was probably never made explicitly.

**Smallest fix (owner's call, not the reviewer's):** either (a) confirm the repo is and stays
private and record the acceptance here, or (b) re-baseline the fixtures with symbols and
quantities substituted by a deterministic mapping — the characterization tests bind to shapes
and types (string numerics, the 13-key set), not to `AMD`/`25`, so the pin survives the
substitution. History rewriting is only worth it under (b) plus a public repo.

### M-5 · `WEBULL_API_CA_BUNDLE=""` silently disables TLS certificate verification

**Where:** `webullsdkcore/http/response.py:120-122`:

```python
def get_verify_value(self):
    if self.__verify is not None:
        return self.__verify
    return os.environ.get('WEBULL_API_CA_BUNDLE', True)
```

An **empty-string** value for that env var is falsy to requests, i.e. `verify=""` ⇒
verification off, with no warning and no visible symptom. A misconfigured or emptied deploy
variable turns the credential-bearing connection into a plaintext-trust connection.

**Smallest fix:** the M-2 fix closes this too — passing an explicit `verify=certifi.where()`
to `ApiClient` makes `self.__verify is not None`, so the env branch is never reached.

---

## Low

- **L-1 · Cryptographic key reuse without domain separation.**
  `webull_adapter._ref_secret()` (`:65-77`) reuses `AUTH_SESSION_SIGNING_KEY` — the session
  cookie HMAC key (`auth/service.py:50-67`) — as the `account_ref` HMAC key. Two purposes, one
  key, no separation label. No practical attack today (both are HMAC-SHA256 over disjoint,
  attacker-unchosen input domains), but it couples the blast radius of either key. Verified:
  `account_ref` is a proper opaque handle — 16 lowercase hex, the raw account never appears in
  it, an empty env value correctly falls through to an ephemeral key. It **is** reproducible
  from key + account number (confirmed), so a weak operator-chosen signing key makes a leaked
  `account_ref` offline-brute-forceable against a ~10-digit account space.
  *Fix:* `hmac.new(key, b"convexa.broker.account_ref\x00" + id, sha256)`, or a dedicated
  `BROKER_ACCOUNT_REF_KEY` env with the same ephemeral fallback.

- **L-2 · The capture sanitizer misses `X-Request-Id`.**
  `capture_broker_fixtures.py:58-62` normalizes keys by stripping non-alphanumerics
  (`_normalize_key`), so `request_id` → `requestid` ✓ matches, but the *header* name
  `X-Request-Id` → `xrequestid` ✗ does not. Result, visible in the committed fixtures:
  `error_bad_credential.json` redacts `"request_id"` while `rate_limit_headers.json` and the
  same file's `headers_of_interest` publish four real Webull request UUIDs verbatim. Low
  sensitivity (correlation handles, not identifiers), but the redaction is inconsistent with
  its own rule. *Fix:* add `"xrequestid"` to `ACCOUNT_IDENTIFYING_KEYS`.

- **L-3 · No CSRF token on the state-changing credential endpoints.**
  `PUT`/`DELETE /api/broker/credential` and `POST /api/broker/book/refresh` are
  cookie-authenticated with no token. The defenses are `SameSite=Lax` and CORS deny-all — both
  real, but `AUTH_COOKIE_SAMESITE` is operator-overridable at runtime (`router.py:43`). With
  `SameSite=None`, `POST /api/broker/book/refresh` is a CORS-simple request and would fire
  cross-site (burning the owner's rate limits; PUT/DELETE would still be preflight-blocked).
  *Fix:* refuse to start with `AUTH_COOKIE_SAMESITE=none` unless a CSRF token is also present,
  or drop the env override.

- **L-4 · The vendored HTTP stack is 8–9 years old.**
  `requests 2.18.3` (2017), `urllib3 1.24.3` (2019), `six 1.11.0`, inside
  `webullsdkcore/vendored/`. The material CVEs in that window are all redirect-borne —
  CVE-2018-18074 / CVE-2023-32681 (Authorization / Proxy-Authorization header leak across a
  redirect), CVE-2023-43804 / CVE-2023-45803 (Cookie header and body retained across a
  redirect) — and every one is **mitigated by `allow_redirects=False`** at
  `http/response.py:158`, which this SDK hardcodes. CVE-2021-33503 (urllib3 URL-parsing ReDoS)
  needs an attacker-controlled URL; ours are fixed constants. Recorded so the residual risk is
  a legible accepted one rather than an unexamined one — the live consequence of the vendoring
  is M-2, not a CVE.

- **L-5 · `_ref_secret()` ephemeral-key race.**
  `webull_adapter.py:70-77` uses a `global` + `try/except NameError` to memoize the ephemeral
  key. Two threads that both miss can mint different secrets, last-write-wins, so `account_ref`
  can change mid-process when `AUTH_SESSION_SIGNING_KEY` is unset. Cosmetic today (no consumer
  renders `account_ref`; `service._attempt` passes the prior ref back as a hint only).
  *Fix:* a module-level `threading.Lock`, or the same `Optional[str] = None` + `if is None`
  shape used in `auth/crypto.py:38`.

---

## Info

- **I-1 · `BrokerCredential` masking is `repr`/`str` only.** `ports.py:167-180` masks both
  (verified: `repr`, `str`, f-string, and exception-message interpolation all yield
  `BrokerCredential(masked)`), but `dataclasses.asdict()` and `vars()` return the plaintext
  halves — proven. The docstring's "NEVER serializable into a trace" is stronger than the code.
  Accurate as written today (nothing calls either), but a future structured-log emitter using
  `asdict` would leak silently. Consider `field(repr=False)` plus a `__getstate__` that raises.
- **I-2 · A `CAPTURE_FINDINGS.md` security note is factually wrong.** It states
  "`ServerException.__str__` embeds `request.string_to_sign` context". Verified false:
  `webullsdkcore/exception/exceptions.py` `ServerException.__str__` returns only
  `HTTP Status / Code / Msg / RequestID`, and `client._get_server_exception` accepts
  `string_to_sign` as a parameter but never uses it. The note's companion claim (DEBUG body
  logging) is correct and mitigated. Worth correcting so the next reviewer isn't chasing it.
- **I-3 · Do not promote the capture tool's ssl shim to the runtime.**
  `capture_broker_fixtures.py:150-170` installs a global `ssl.wrap_socket` whose signature
  defaults to `cert_reqs=ssl.CERT_NONE` and, on that branch, sets `check_hostname = False`. It
  is currently harmless (urllib3's live paths call `SSLContext.wrap_socket`, and the tool is a
  one-shot owner-run script), but it is an insecure-by-default primitive installed
  process-wide. The S-1 fix must bind names, not restore this function.
- **I-4 · Request signing is HMAC-SHA1** (`auth/algorithm/sha_hmac1.py`, the SDK default). No
  practical forgery risk for HMAC-SHA1, and it is vendor-mandated — not actionable, recorded
  for the record.
- **I-5 · Egress is redirectable by environment.** `http/response.py:150-158` honors
  `HTTPS_PROXY`/`HTTP_PROXY`. Host selection itself is closed: `WEBULL_REGION` indexes
  `webullsdkcore/data/endpoints.json` (`api.webull.com` / `api.webull.hk` / `api.webull.co.jp`),
  and the adapter never calls `add_endpoint` (verified), so there is no arbitrary-host override
  in our code. There is, however, **no automated egress-allowlist test** as SPEC §8.1 asks —
  the property currently holds by construction, not by assertion.
- **I-6 · Multi-account subscription index.** `_extract_account_id` (`webull_adapter.py:348-363`)
  takes the *first* subscription entry; the owner's capture returned **two**. Already flagged
  in the code as "FLAGGED, not a bug". Re-stated here because it is a security-adjacent
  correctness risk: the wrong account's book rendered as "your book" is a fabrication about
  real money. Should become an explicit product decision before multi-account.
- **I-7 · The R7 probe called `/trade/instrument`** with the owner's live credential
  (`instrument_probe.json`). It is a `GET` read that returned an echo-only 200, no order module
  exists on disk, and no write was possible — no `[no-real-order-path]` violation. Noted only
  because a `/trade/*` path appears in the artifact record.

---

## Checked and clean — verified, not merely unexamined

Each line below was actively probed; absence of a finding here is a positive result.

**Credential lifecycle (remit §1)**
- Ciphertext-only at rest. `auth/service.py:428-452` — both halves are `json.dumps`'d into ONE
  blob, Fernet-encrypted by `crypto.encrypt` **before** the store sees it; `sqlite_store.py:266-280`
  and `postgres_store.py:413-426` write only `(ciphertext, last4)`. No plaintext column exists.
- No key, secret, or ciphertext in any response body. Live-verified across `GET`/`PUT`/`DELETE
  /api/broker/credential` and both book endpoints: the hint read returns exactly
  `{"set":true,"last4":"1111","storage_available":true}`; full key present = **False**, secret
  present = **False**.
- Errors echo no fragment. All four *missing/empty-half* 422 shapes return the fixed message
  "Enter both the App Key and the App Secret — they are saved together" with `LEAK=[]`. (The
  wrong-*type* arm is M-1.)
- Plaintext lifetime is request-scope only. `main.py:915-930` resolves the pair per request into
  a frozen `BrokerCredential` VO; `webull_adapter._SdkTransport` holds it for one `fetch_book`.
  No module-level or cache-held credential anywhere in the leaf.
- Decrypt failure is no-usable-credential, never a leak, never misattributed.
  `crypto.decrypt` (`:79-91`) returns `None` on any exception and logs a key-free breadcrumb;
  `service.get_decrypted_broker_credential` (`:469-495`) returns `None` on a corrupt blob;
  `main.py:929` maps it to `("unreadable", None)`; `broker/service.py:118-123` emits
  `credential_unreadable` — its own warning-class render, distinct from `credential_rejected`.
- Rotate = overwrite, no history. Single upsert keyed `(user_id, kind)`; `created_at` preserved,
  ciphertext replaced. `set_broker_credential` also invalidates the book cache (`:451`) so a
  rotated credential cannot serve the previous credential's book.
- Delete really deletes, cache included. Live-verified: `state: ok` with positions →
  `DELETE` → `{"state":"unknown","reason":"no_credential_stored"}` on the very next GET.
  `_invalidate_broker_cache` is called **before** the store delete (`:460`) so a store fault
  cannot leave a ghost book.
- Credential-kind separation is real. `kind` is in the primary key in both stores, and the
  Postgres path has an idempotent, named-constraint PK migration (`postgres_store.py:165-191`).
  Live-verified: setting and deleting the AI key leaves the broker `last4` untouched, and the
  two hints are independent.
- FE write-only floor. `BrokerageSection.tsx` — both fields `type="password"`,
  `autoComplete: 'off'`, drafts cleared on success (`:92`), no reveal/show/copy control, no
  `localStorage`/`sessionStorage`/`convexa.*` write, and errors render fixed copy that never
  interpolates input (`:96-100`).
- No secret in a committed file. `git ls-files` finds only `apps/api/.env.example`; no `.env`,
  `.pem`, or `.key` is tracked.

**Cross-account isolation — AC-23 (remit §2)**
- Cache key is the opaque server user id only (`broker/service.py:85`, `main.py:945`) — never an
  email, never a broker account number.
- Live two-account proof: A stores a credential and gets `state: ok` with positions and an
  `account_ref`; B (separate signed-in account, separate cookie jar) receives
  `{"set":false,"last4":null}` and `{"state":"unknown","reason":"no_credential_stored"}` from
  both `GET /book` and `POST /refresh`. B sees A's `account_ref` = **False**; B sees A's `last4`
  = **False**.
- Anonymous gets the gate, never data. All five endpoints → `403 auth_required` while signed
  out, verified individually.
- Session integrity: the cookie is HMAC-SHA256-signed with a constant-time compare
  (`cookies.py:39-52`); a tampered signature resolves to anonymous → `403` on both credential
  and book endpoints (verified). Session ids are `secrets.token_urlsafe(32)` and a **new** row
  is minted per login (`service._new_session`) — the cookie value rotates across logout/login
  (verified `True`), so there is no fixation path; and a fixated cookie would in any case land
  the victim in the *attacker's* account, not expose the victim's book.
- No process-global broker state is shared across users: `_users` is a per-user-id dict; there
  is no module-level snapshot, credential, or account_ref cache. (The one global lock is H-3 —
  a liveness issue, not a data-isolation one.)

**Log egress (remit §3)**
- **Our** code is clean at every level. The complete set of log calls on the broker path is
  three lines in the leaf (`service.py:146`, `webull_adapter.py:445`, `:469`), four in
  `main.py` (`:903`, `:912`, `:949`) and five in `auth/service.py` (`:110`, `:421`, `:448`,
  `:464`, `:479`). Every one is a fixed string or a closed-enum cause name; none interpolates a
  payload, position, symbol, account id, key, or ciphertext; all pass `exc_info=False`.
- `fidelity_notes` are fixed constants (`webull_adapter.py:219-230`) and are never interpolated
  with payload content — so no broker datum reaches the wire through the notes channel either.
- **The deployed log level does not expose the SDK's DEBUG body logging.** The remit asked this
  specifically. Verified live under the app's real config (`main.py:61-62` sets only the
  `"Convexa"` logger; no `basicConfig`, and uvicorn does not configure root): root = `WARNING`,
  `webullsdkcore` = `NOTSET`/effective `WARNING`, `webullsdkcore.client` = effective `WARNING`.
  So `client.py:367` (response bodies) and `default_signature_composer.py:105-123` (App Key,
  `string_to_sign`, signature) are **dropped**. `CAPTURE_FINDINGS`' concern is correctly
  handled — the live leaks are at ERROR (H-1) and behind an env var (M-3), not at DEBUG.
- A boot-time stable-key guard already exists from an earlier system-6 pass — `main.py:732-750`
  emits a conspicuous startup warning when `ACCOUNT_STORE=postgres` and
  `AUTH_SESSION_SIGNING_KEY` / `AI_KEY_ENCRYPTION_KEY` are unset. It is a warning, not a
  refusal, but the Fernet-key provenance gap is surfaced rather than silent.

**Replay / abuse (remit §4)**
- **The refresh throttle is per-account, not global** — the specific thing the remit warned
  about. Proven: A then B refresh → 2 contacts, i.e. B is not starved by A's throttle window.
  (The abuse path is the *unthrottled GET*, H-2, and the *global lock*, H-3.)
- No client-controllable retry parameter exists on any broker endpoint; `BROKER_BOOK_TTL_SECONDS`,
  `BROKER_STALE_AFTER_SECONDS` and `BROKER_REFRESH_MIN_INTERVAL_SECONDS` are server-side env
  only and never ride the wire.
- No auto-retry inside the SDK: `ApiClient(auto_retry=False)` by default and the adapter does
  not override it — `NO_RETRY_POLICY`. So one request is one broker call.
- Replay protection is present at the vendor layer: every signed request carries a fresh
  `Timestamp` (ISO-8601) and a `Nonce` UUID (`default_signature_composer.py:56-66`).
- Nothing is enumerable through these endpoints: no user/account/ticker path parameter exists —
  the account is derived server-side from the session, and `account_ref` is a keyed hash.
- Timeouts are bounded: connect 5s, read 10s (`client.py:68`, `:315-330`), pages capped at 50
  (`_MAX_PAGES`) with a page size of 100.
- Broker trouble is never a 5xx: `_serve_broker_book` (`main.py:947-950`) has a typed catch-all
  returning a 200 `{"state":"unknown","reason":"adapter_fault"}`; verified by the suite.

**SDK dependency (remit §5)**
- **No order/trade/place module exists on disk.** `find` over the entire site-packages tree for
  `*order*|*trade*|*place*.py` returns nothing Webull-related (only `massive/rest/trades.py`, the
  market-data provider's historical-trades read, and unrelated numpy/scipy/anthropic hits).
  `importlib.util.find_spec` for `webullsdktrade`, `webullsdktradeeventscore`, `webullsdkmdata`
  → all `None`, asserted by `tests/test_broker_isolation.py`.
- SDK import scope is source-scanned and enforced: only `webull_adapter.py` may import
  `webull*`, imports must start with `webullsdkcore`, and a deny-list rejects
  trade/order/place/grpc/events/mdata/quotes paths.
- TLS verification is **never disabled** in our code. `verify` is never set to `False` anywhere
  in `apps/api` (the vendored default resolves to `True`); the only ways to weaken it are the
  env-driven M-5 and the stale-bundle M-2.
- Redirects are disabled (`allow_redirects=False`), which is what neutralizes the vendored
  stack's redirect-borne CVE class (L-4).
- Credentials and signatures ride **headers**, never URLs or query strings —
  `default_signature_composer._refresh_sign_headers` puts `App Key`, `Timestamp`, `Nonce`,
  `Signature` in headers; the query string carries only `account_id` and paging parameters. The
  remit's "credentials/signatures never in URLs" requirement is **met**. (`account_id` in the
  query is Webull's API shape and is what H-1 exfiltrates via an exception string.)
- SDK request signing is computed in exactly one place (`calc_signature`), and the App Secret is
  used only as an HMAC key — it is never transmitted and never appears in any log call.

**`[no-real-order-path]` — structural (remit §6)**
- Introspected the live type surface, not the prose: `PositionsProvider` has **exactly two**
  functions, `['describe', 'fetch_book']`, both abstract. `StubProvider` and `WebullProvider`
  expose exactly the same two public methods. A regex for any `def *order|trade|place|cancel|
  execute|submit|buy|sell|close_position*` across all five broker modules returns **NONE**.
  There is no write method to disable and no caller can express one.

**`account_ref` opacity (remit §7)**
- Derivation is a keyed hash: `HMAC-SHA256(server secret, account_identifier)` hex-truncated to
  16 (`webull_adapter.py:80-83`). Verified: output is 16 lowercase hex, deterministic within a
  process, contains no substring of the raw account number, and differs between the keyed and
  ephemeral cases.
- The key is not predictable or empty: `_ref_secret()` treats an **empty** `AUTH_SESSION_SIGNING_KEY`
  as absent (`if key:`) and falls back to `secrets.token_urlsafe(32)` — verified by setting the
  env var to `""`. (Key *reuse* is L-1; the *race* is L-5.)
- The raw account number never leaves the adapter: it is used for the query param and the hash,
  and only `ref` is placed on `BrokerBook.account_ref`. No FE surface renders it —
  `libs/api/src/lib/broker.ts:111` types it as "NEVER the raw broker account number. No render
  consumes it in v1", and a grep across the broker FE finds it only in test fixtures.

**Capture / probe tooling (beyond the remit)**
- `_raw_scratch/` is genuinely gitignored (`apps/api/.gitignore`) and **has never been
  committed** — `git log --all -- "*_raw_scratch*"` is empty and `git ls-files` matches nothing.
  Two raw files exist locally and should be deleted per the tool's own closing instruction.
- Both tools read credentials from `os.environ` only, refuse to run when either is absent
  (exit 2), and never echo either value on any path — including failure paths, which print only
  `error_code`/`http_status`.
- The secret scrub is belt-and-braces: `write_fixture` re-checks the **serialized text** for
  each secret and raises `SystemExit` rather than write; the findings markdown gets the same
  check; even the gitignored scratch copy is scrubbed of key material before it is written.
- Account identifiers *are* redacted in every committed fixture (`ACCT_REDACTED` verified in
  `account_raw.json` across `subscription_id`, `user_id`, `account_id`, `account_number`, and in
  the exception `request_id`). The gaps are M-4 (position content, deliberate) and L-2
  (`X-Request-Id`, a normalization miss).
- The NUL-byte trap is defended: `assert_no_nul_bytes` hard-fails before any fixture or findings
  file is committed.

**Suite state at review time:** `pytest -k broker` — 198 passed, exit code **0**. None of the
findings above is caught by an existing test; each is a gap in coverage as much as in code.
