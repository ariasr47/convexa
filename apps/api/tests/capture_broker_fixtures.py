"""
broker-connect task B1 — the Webull payload CAPTURE tool (owner-present, one run).

WHAT THIS IS. A standalone script (stdlib + the Webull SDK read subset only) that reads the
owner's REAL Webull book once, records the raw payload shapes into a GITIGNORED scratch dir,
and writes SANITIZED fixtures + a CAPTURE_FINDINGS.md draft answering the plan's six capture
questions. The sanitized fixtures are what task B4's adapter characterization tests bind to.

CREDENTIAL RULE (binding, PLAN.md B1). The owner's App Key + App Secret come from the OWNER'S
SHELL SESSION ENVIRONMENT for this one run:

    (PowerShell, run in the owner's own terminal, then CLOSE that terminal)
    cd C:\\Dev\\gammaflow-web\\apps\\api
    $env:WEBULL_APP_KEY    = '<app key>'
    $env:WEBULL_APP_SECRET = '<app secret>'
    .venv\\Scripts\\python.exe tests\\capture_broker_fixtures.py

The script reads os.environ ONLY. It refuses to run if either var is absent and NEVER prints
either value on any path (all captured text is scrubbed against both values before it is
written anywhere, scratch files included). Nothing here writes to .env or any dotfile.

WHAT IT CALLS (Webull OpenAPI, Individual keys, read subset only — no order/trade module is
even installed; see requirements.txt):
    GET /app/subscriptions/list   — account discovery (subscription -> account_id)
    GET /account/profile          — the account payload shape (question b)
    GET /account/positions        — the positions payload, paged to exhaustion (questions a/e)
    plus ONE deliberately-corrupted-secret call to capture the bad-credential error shape
    (question c) and the response/exception headers observed (question d).

SDK COMPAT SHIM. webull-python-sdk-core 0.1.18 vendors an ancient `requests`/`six` pair that
breaks on modern Python (`cgi` removed in 3.13; the vendored `six.moves` relies on the
`find_module` import protocol removed in 3.12). `_shim_sdk_compat()` aliases the REAL
installed `six` into both vendored paths before the SDK imports run; `legacy-cgi` (a
requirements.txt dep on py>=3.13) restores the `cgi` module. Recorded for the system-6
dependency review.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURES_DIR = HERE / "fixtures" / "broker"
SCRATCH_DIR = FIXTURES_DIR / "_raw_scratch"          # gitignored — raw payloads only ever land here
FINDINGS_PATH = HERE.parents[2] / ".claude" / "contracts" / "broker-connect" / "CAPTURE_FINDINGS.md"

REDACTED = "ACCT_REDACTED"

# Keys whose VALUES are account-identifying and must never reach a checked-in fixture.
# NORMALIZED form (lowercase, separators stripped) — compared via _normalize_key, so
# `account_id` / `AccountId` / `ACCOUNT-ID` all match. Importable: the unit test pins the rule.
ACCOUNT_IDENTIFYING_KEYS = frozenset({
    "accountid", "accountnumber", "accountno", "secaccountid",
    "subscriptionid", "userid", "customerid", "requestid",
    "appkey", "appsecret", "accesskey", "signature", "authorization", "token",
})

# Header names worth keeping in the rate-limit fixture (matched case-insensitively, substring).
_RATELIMIT_HEADER_HINTS = ("rate", "limit", "quota", "retry", "throttle", "x-request")


def _normalize_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", key.lower())


def sanitize_payload(obj, secrets: tuple[str, ...] = ()):
    """
    Return a deep copy of `obj` with every account-identifying value replaced by ACCT_REDACTED
    and every occurrence of a secret string (the real key/secret) scrubbed from string values.

    Structural keys, enum values and NUMERIC SHAPES are kept intact: a redacted value keeps its
    position under its original key, so the fixture still pins the payload's structure.
    """
    live_secrets = tuple(s for s in secrets if s)

    def scrub_str(s: str) -> str:
        for sec in live_secrets:
            if sec in s:
                s = s.replace(sec, REDACTED)
        return s

    def walk(node, parent_key: str | None = None):
        if isinstance(node, dict):
            return {k: (REDACTED if _normalize_key(k) in ACCOUNT_IDENTIFYING_KEYS
                        and node[k] is not None
                        else walk(node[k], k))
                    for k in node}
        if isinstance(node, list):
            return [walk(el, parent_key) for el in node]
        if isinstance(node, str):
            return scrub_str(node)
        return node

    return walk(obj)


def assert_no_nul_bytes(path: Path) -> None:
    """CLAUDE.md trap: a NUL byte makes the fixture binary to git/grep. Hard-fail if any."""
    count = io.open(path, "rb").read().count(bytes([0]))
    if count:
        raise SystemExit(f"FATAL: {path} contains {count} NUL byte(s) — fixture would be "
                         f"binary to git. Not committing this.")


def write_fixture(path: Path, payload, secrets: tuple[str, ...]) -> None:
    clean = sanitize_payload(payload, secrets)
    text = json.dumps(clean, indent=2, ensure_ascii=True, sort_keys=False)
    for sec in secrets:
        if sec and sec in text:
            raise SystemExit(f"FATAL: secret material survived sanitization for {path.name} — "
                             f"refusing to write.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")
    assert_no_nul_bytes(path)
    print(f"  wrote {path.relative_to(HERE.parent)}")


# --------------------------------------------------------------------------- SDK plumbing

def _shim_ssl_wrap_socket() -> None:
    """
    Python 3.12 REMOVED `ssl.wrap_socket` (deprecated since 3.7); this venv is 3.14.

    The SDK's vendored urllib3 imports three names on ONE line
    (`vendored/requests/packages/urllib3/util/ssl_.py:60`):

        from ssl import wrap_socket, CERT_NONE, PROTOCOL_SSLv23

    so the single missing name aborts the whole statement inside its bare
    `except ImportError: pass`, leaving **PROTOCOL_SSLv23 unbound as a module
    global** even though `ssl.PROTOCOL_SSLv23` itself still exists. The failure
    then surfaces far away, on the first HTTPS call, as
    `NameError: name 'PROTOCOL_SSLv23' is not defined` at that file's line 230.

    Restoring a working module-level `wrap_socket` BEFORE the SDK is imported lets
    that import line bind all three names. urllib3's live code paths use
    `SSLContext.wrap_socket` (lines 359/372) and never call this, but it delegates
    correctly if anything does.
    """
    import ssl
    if hasattr(ssl, "wrap_socket"):
        return

    def wrap_socket(sock, keyfile=None, certfile=None, server_side=False,
                    cert_reqs=ssl.CERT_NONE, ssl_version=ssl.PROTOCOL_TLS_CLIENT,
                    ca_certs=None, do_handshake_on_connect=True,
                    suppress_ragged_eofs=True, ciphers=None, **_kwargs):
        context = ssl.SSLContext(ssl_version)
        # check_hostname must go False BEFORE verify_mode=CERT_NONE, or SSLContext raises.
        if cert_reqs == ssl.CERT_NONE:
            context.check_hostname = False
        context.verify_mode = cert_reqs
        if certfile:
            context.load_cert_chain(certfile, keyfile)
        if ca_certs:
            context.load_verify_locations(ca_certs)
        if ciphers:
            context.set_ciphers(ciphers)
        return context.wrap_socket(
            sock, server_side=server_side,
            do_handshake_on_connect=do_handshake_on_connect,
            suppress_ragged_eofs=suppress_ragged_eofs)

    ssl.wrap_socket = wrap_socket  # type: ignore[attr-defined]


def _shim_sdk_compat() -> None:
    """Alias the real `six` into the SDK's two vendored six paths (see module docstring),
    and restore `ssl.wrap_socket` for the vendored urllib3 (see `_shim_ssl_wrap_socket`)."""
    _shim_ssl_wrap_socket()
    import six  # noqa: F401  (requirements.txt)
    import six.moves  # noqa: F401
    import six.moves.http_client, six.moves.queue  # noqa: E401,F401
    import six.moves.urllib, six.moves.urllib.parse, six.moves.urllib.request  # noqa: E401,F401
    import six.moves.urllib.error, six.moves.urllib.response, six.moves.urllib.robotparser  # noqa: E401,F401
    for prefix in ("webullsdkcore.vendored.six",
                   "webullsdkcore.vendored.requests.packages.urllib3.packages.six"):
        sys.modules[prefix] = six
        sys.modules[prefix + ".moves"] = six.moves
        for name in ("http_client", "queue"):
            sys.modules[f"{prefix}.moves.{name}"] = getattr(six.moves, name)
        sys.modules[prefix + ".moves.urllib"] = six.moves.urllib
        for name in ("parse", "request", "error", "response", "robotparser"):
            sys.modules[f"{prefix}.moves.urllib.{name}"] = getattr(six.moves.urllib, name)


def _build_requests():
    """
    The three read requests, defined directly over webullsdkcore's ApiRequest (the
    webull-python-sdk-trade package is deliberately NOT a dependency: its wrappers are
    one-liners over these paths and its install chain pins an unbuildable grpcio — see
    CAPTURE_FINDINGS / requirements.txt).
    Paths/verbs mirror webull-python-sdk-trade==0.1.18 request definitions verbatim.
    """
    from webullsdkcore.request import ApiRequest

    def subscriptions():
        return ApiRequest("/app/subscriptions/list", version="v1", method="GET", query_params={})

    def profile(account_id):
        r = ApiRequest("/account/profile", version="v1", method="GET", query_params={})
        r.add_query_param("account_id", account_id)
        return r

    def positions(account_id, page_size=100, last_instrument_id=None):
        r = ApiRequest("/account/positions", version="v1", method="GET", query_params={})
        r.add_query_param("account_id", account_id)
        r.add_query_param("page_size", page_size)
        if last_instrument_id is not None:
            r.add_query_param("last_instrument_id", last_instrument_id)
        return r

    return subscriptions, profile, positions


def _do(client, request):
    """
    Low-level call returning (status, headers, parsed_body, exception). Uses the client's
    internal do_action so response HEADERS are observable (get_response drops them).
    """
    status, headers, body, exception, response = client._implementation_of_do_action(request)
    parsed = response
    if parsed is None and body:
        try:
            parsed = json.loads(body if isinstance(body, str) else body.decode("utf-8"))
        except Exception:
            parsed = {"_unparsed_body_snippet": str(body)[:500]}
    return status, dict(headers or {}), parsed, exception


def _interesting_headers(headers: dict) -> dict:
    return {k: v for k, v in headers.items()
            if any(h in k.lower() for h in _RATELIMIT_HEADER_HINTS)}


def _exception_shape(exc) -> dict:
    """The error SHAPE (types/codes/status), never the raw message verbatim-unscrubbed."""
    if exc is None:
        return {}
    return {
        "exception_type": type(exc).__name__,
        "error_code": getattr(exc, "error_code", None),
        "error_msg": getattr(exc, "error_msg", None),
        "http_status": getattr(exc, "http_status", None),
        "request_id": getattr(exc, "request_id", None),
    }


# --------------------------------------------------------------------------- findings

def _findings_markdown(ctx: dict) -> str:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    grouping = ctx["grouping_evidence"]
    return f"""# broker-connect — CAPTURE_FINDINGS (task B1)

**Captured:** {now} · region `{ctx['region']}` · tool `tests/capture_broker_fixtures.py`
**Fixtures:** `apps/api/tests/fixtures/broker/positions_raw.json`, `account_raw.json`,
`error_bad_credential.json`, `rate_limit_headers.json` — all sanitized (`{REDACTED}`), NUL-scanned.

> Auto-generated by the capture run. The conductor routes the owner decisions in §a/§e.

## (a) Multi-leg grouping identity

Distinct top-level keys observed across ALL captured position entries:
```json
{json.dumps(sorted(ctx['position_keys']), indent=2)}
```
Grouping-identity candidates detected (keys shared by >1 option entry with equal values):
```json
{json.dumps(grouping, indent=2)}
```
**If the candidates list is empty the payload is FLAT per-contract** → the grouped-rendering
fallback is the NAMED POST-CAPTURE OWNER DECISION (SPEC §9.2); neither lane defaults it.

## (b) Account payload shape + identifier

`account_raw.json` holds the sanitized `/app/subscriptions/list` + `/account/profile` payloads.
The account identifier used for `account_ref` hashing is the value at key
`{ctx['account_id_key']}` (redacted in fixtures). `account_ref` = HMAC-SHA256(server secret,
identifier), hex-truncated to 16 — never the raw number (B4).

## (c) Bad-credential error shape

```json
{json.dumps(ctx['bad_credential_shape'], indent=2)}
```
Distinguished from outage: a credential rejection is a `ServerException` carrying the
status/code above; network unreachability surfaces as `ClientException` with
`SDK_HTTP_ERROR` and no HTTP status.

## (d) Rate-limit headers observed

```json
{json.dumps(ctx['rate_limit_headers'], indent=2)}
```
(Empty ⇒ Webull exposed no rate-limit headers on these reads; the server-side refresh
throttle remains our own `BROKER_REFRESH_MIN_INTERVAL_SECONDS`.)

## (e) Does Webull supply its own unrealized P/L?

Keys matching `unrealized*` observed on position entries:
```json
{json.dumps(ctx['unrealized_keys'], indent=2)}
```
Sample (sanitized): `{ctx['unrealized_sample']}`
**If non-empty this routes the AC-22 render question to the owner** (carried verbatim as the
tri-state `unrealized_pl`; render decision is the owner's within the standing ruling).

## (f) Exact SDK packages + modules the read path needs (B4 pin + import-scope test)

Installed for the read path (requirements.txt):
- `webull-python-sdk-core=={ctx['sdk_core_version']}` (+ `six`, `legacy-cgi` on py>=3.13 — compat shim,
  see the tool's docstring)
- `webull-python-sdk-trade` is deliberately NOT installed: its request classes are one-line
  path wrappers (mirrored inline), and its dependency chain pins `grpcio==1.51.1`
  (unbuildable on py>=3.12). **No order/trade/place module exists on disk.**

`webull*` modules actually loaded by this read run:
```json
{json.dumps(ctx['loaded_modules'], indent=2)}
```

## Security notes for the system-6 review (V5)

- Endpoint host resolved by the SDK for region `{ctx['region']}`: `{ctx['endpoint_host']}` (egress allowlist input).
- `webullsdkcore.client` logs response BODIES at DEBUG level (`logger.debug('Response
  received, ... body:...')`) — default level must stay above DEBUG in any deployed env.
- `ServerException.__str__` embeds `request.string_to_sign` context in client internals; the
  adapter maps exceptions to the closed failure-cause enum and never surfaces exception text.
"""


# --------------------------------------------------------------------------- main

def main() -> int:
    app_key = os.environ.get("WEBULL_APP_KEY", "")
    app_secret = os.environ.get("WEBULL_APP_SECRET", "")
    if not app_key or not app_secret:
        print("REFUSING TO RUN: set WEBULL_APP_KEY and WEBULL_APP_SECRET in THIS shell's "
              "environment first (never in a file). Neither value is echoed by this tool.")
        return 2
    secrets = (app_key, app_secret)
    region = os.environ.get("WEBULL_REGION", "us")

    _shim_sdk_compat()
    import webullsdkcore
    from webullsdkcore.client import ApiClient

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

    client = ApiClient(app_key, app_secret, region_id=region)
    subscriptions_req, profile_req, positions_req = _build_requests()

    print("1/5 account discovery (/app/subscriptions/list) ...")
    status, headers, subs, exc = _do(client, subscriptions_req())
    if exc is not None:
        print(f"  FAILED: {type(exc).__name__} code={getattr(exc, 'error_code', None)} "
              f"http={getattr(exc, 'http_status', None)} — is the key approved/active?")
        return 1
    account_id_key, account_id = None, None
    entries = subs if isinstance(subs, list) else (subs or {}).get("data") or []
    for entry in entries if isinstance(entries, list) else []:
        for k, v in (entry.items() if isinstance(entry, dict) else []):
            if _normalize_key(k) in ("accountid", "secaccountid") and v:
                account_id_key, account_id = k, str(v)
                break
        if account_id:
            break
    if not account_id:
        print(f"  could not find an account id key in the subscriptions payload; keys seen: "
              f"{sorted((entries[0] or {}).keys()) if entries else 'NONE'}")
        return 1
    rate_headers_all = {"subscriptions": _interesting_headers(headers)}

    print("2/5 account profile (/account/profile) ...")
    _, headers_p, profile, exc_p = _do(client, profile_req(account_id))
    rate_headers_all["profile"] = _interesting_headers(headers_p)

    print("3/5 positions, paged (/account/positions) ...")
    pages, last_id = [], None
    for _ in range(50):  # hard page cap — owner-scale book
        _, headers_pos, page, exc_pos = _do(client, positions_req(account_id, 100, last_id))
        if exc_pos is not None:
            print(f"  positions page FAILED: {_exception_shape(exc_pos)!r}")
            return 1
        pages.append(page)
        rate_headers_all.setdefault("positions", _interesting_headers(headers_pos))
        has_next = bool((page or {}).get("has_next")) if isinstance(page, dict) else False
        if not has_next:
            break
        items = (page or {}).get("holdings") or (page or {}).get("positions") or []
        last_id = (items[-1] or {}).get("instrument_id") or (items[-1] or {}).get("id") \
            if items else None
        if last_id is None:
            break
        time.sleep(0.6)  # be polite to the owner's own rate limits

    print("4/5 bad-credential probe (corrupted secret, ONE call) ...")
    bad_client = ApiClient(app_key, "X" + app_secret[1:][::-1], region_id=region)
    bad_status, bad_headers, bad_body, bad_exc = _do(bad_client, subscriptions_req())
    bad_shape = {
        "http_status": bad_status if bad_exc is None else getattr(bad_exc, "http_status", None),
        "body": bad_body,
        "exception": _exception_shape(bad_exc),
        "headers_of_interest": _interesting_headers(bad_headers or {}),
    }

    print("5/5 writing raw scratch + sanitized fixtures ...")
    raw_all = {"subscriptions": subs, "profile": profile, "positions_pages": pages,
               "bad_credential": bad_shape, "rate_limit_headers": rate_headers_all}
    scratch = SCRATCH_DIR / "capture_raw.json"
    # Even the SCRATCH copy is scrubbed of key/secret material (account ids stay, for eyeballing).
    scratch_text = json.dumps(raw_all, indent=2, default=str)
    for sec in secrets:
        scratch_text = scratch_text.replace(sec, "<SECRET_SCRUBBED>")
    scratch.write_text(scratch_text, encoding="utf-8", newline="\n")
    print(f"  raw (gitignored): {scratch}")

    write_fixture(FIXTURES_DIR / "positions_raw.json",
                  {"captured": True, "pages": pages}, secrets)
    write_fixture(FIXTURES_DIR / "account_raw.json",
                  {"captured": True, "subscriptions": subs, "profile": profile}, secrets)
    write_fixture(FIXTURES_DIR / "error_bad_credential.json",
                  {"captured": True, **bad_shape}, secrets)
    write_fixture(FIXTURES_DIR / "rate_limit_headers.json",
                  {"captured": True, **rate_headers_all}, secrets)

    # ---------------- findings
    entries_flat = []
    for page in pages:
        if isinstance(page, dict):
            entries_flat.extend((page.get("holdings") or page.get("positions") or []))
        elif isinstance(page, list):
            entries_flat.extend(page)
    position_keys = sorted({k for e in entries_flat if isinstance(e, dict) for k in e})
    unrealized_keys = sorted({k for k in position_keys if "unreal" in k.lower()})
    unrealized_sample = None
    for e in entries_flat:
        for k in unrealized_keys:
            if isinstance(e, dict) and e.get(k) is not None:
                unrealized_sample = f"{k} = {e[k]!r}"
                break
        if unrealized_sample:
            break
    options = [e for e in entries_flat if isinstance(e, dict)
               and "option" in str(e.get("instrument_type", "")).lower()]
    grouping_candidates = []
    grouping_hint_keys = [k for k in position_keys
                          if any(h in k.lower() for h in ("group", "combo", "strategy", "leg"))]
    for k in grouping_hint_keys:
        values = [e.get(k) for e in options if e.get(k) is not None]
        if len(values) > 1 and len(set(map(str, values))) < len(values):
            grouping_candidates.append({"key": k, "shared_values": True})
        elif values:
            grouping_candidates.append({"key": k, "shared_values": False})

    endpoint_host = "unknown"
    try:
        endpoint_host = client._resolve_endpoint(subscriptions_req())
    except Exception:
        pass

    ctx = {
        "region": region,
        "position_keys": position_keys,
        "grouping_evidence": grouping_candidates,
        "account_id_key": account_id_key,
        "bad_credential_shape": json.loads(json.dumps(
            sanitize_payload(bad_shape, secrets), default=str)),
        "rate_limit_headers": sanitize_payload(rate_headers_all, secrets),
        "unrealized_keys": unrealized_keys,
        "unrealized_sample": sanitize_payload(unrealized_sample, secrets) or "none observed",
        "sdk_core_version": getattr(webullsdkcore, "__version__", "0.1.18"),
        "loaded_modules": sorted(m for m in sys.modules if m.startswith("webull")),
        "endpoint_host": str(endpoint_host),
    }
    findings = _findings_markdown(ctx)
    for sec in secrets:
        if sec in findings:
            raise SystemExit("FATAL: secret material reached the findings draft — not writing.")
    FINDINGS_PATH.write_text(findings, encoding="utf-8", newline="\n")
    assert_no_nul_bytes(FINDINGS_PATH)
    print(f"  findings: {FINDINGS_PATH}")

    print("\nDONE. Now: (1) close this terminal (the env vars die with it); "
          "(2) review + git add the four fixtures and CAPTURE_FINDINGS.md; "
          "(3) delete tests/fixtures/broker/_raw_scratch/ after review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
