# broker-connect — CAPTURE_FINDINGS (task B1) — **PENDING OWNER CAPTURE RUN**

**Status:** the capture TOOL is built and its sanitization is unit-tested
(`apps/api/tests/capture_broker_fixtures.py`, `tests/test_broker_capture_sanitize.py`), but the
live run has NOT happened — it needs the owner's Webull App Key/Secret, which exist only in the
owner's shell. When the owner runs the tool, it OVERWRITES this file with the generated findings
(evidence-backed answers to a–f) and writes the four sanitized fixtures beside the
`*.PROVISIONAL-PENDING-CAPTURE.json` ones B4 currently binds to.

**The owner's exact run (PowerShell, own terminal, close it afterwards):**

```powershell
cd C:\Dev\gammaflow-web\apps\api
$env:WEBULL_APP_KEY    = '<app key>'
$env:WEBULL_APP_SECRET = '<app secret>'
.venv\Scripts\python.exe tests\capture_broker_fixtures.py
```

## The six questions (a–f) — answers PENDING capture; what is already FACT is marked

- **(a) Multi-leg grouping identity:** PENDING. The tool auto-detects candidate keys
  (`group`/`combo`/`strategy`/`leg` families) across option entries and prints the evidence.
  If flat ⇒ the grouped-rendering fallback is the NAMED POST-CAPTURE OWNER DECISION (SPEC §9.2).
- **(b) Account payload shape / identifier:** PENDING. Discovery path is FACT:
  `GET /app/subscriptions/list` → `account_id` (the tool records the exact key name).
- **(c) Bad-credential error shape:** PENDING (the tool makes one corrupted-secret probe).
  FACT from SDK source: non-2xx surfaces as `ServerException(error_code, error_msg,
  http_status, request_id)`; network failure as `ClientException(SDK_HTTP_ERROR)` — the
  rejected-vs-outage distinction the adapter maps from.
- **(d) Rate-limit headers:** PENDING. The tool records any header whose name matches
  rate/limit/quota/retry/throttle on every read.
- **(e) Webull-supplied unrealized P/L:** PENDING (routes AC-22 to the owner if supplied).
  Docs suggest `unrealized_profit_loss` exists on positions — treated as PROVISIONAL.
- **(f) Exact SDK packages/modules for the read path — FACT (established building the tool):**
  - `webull-python-sdk-core==0.1.18` is the ONLY Webull package required (+ `six`, and
    `legacy-cgi` on Python ≥3.13, as compat shims — see below).
  - `webull-python-sdk-trade` is deliberately NOT a dependency: its read request classes are
    one-line path wrappers over `webullsdkcore.request.ApiRequest` (mirrored inline in the
    capture tool and the adapter: `/app/subscriptions/list`, `/account/profile`,
    `/account/positions`, all `version='v1'`, GET), and installing it drags
    `webull-python-sdk-trade-events-core` → `grpcio==1.51.1`, which cannot build on
    Python ≥3.12 (no wheels, source build fails). **Consequence: no order/trade/place module
    exists on disk at all** — the strongest possible form of the AC-15 import-scope invariant.
  - SDK compat facts for the system-6 dependency review (V5):
    `webullsdkcore` vendors an ancient `requests`+`six` (imports `cgi`, removed in py3.13;
    vendored `six.moves` relies on the `find_module` protocol removed in py3.12). The read
    path works via an explicit shim aliasing the real `six` into the two vendored module
    paths (`_shim_sdk_compat()` in the adapter and the capture tool).
    Also: `webullsdkcore.client` logs response BODIES at DEBUG — deployed log level must stay
    above DEBUG.
