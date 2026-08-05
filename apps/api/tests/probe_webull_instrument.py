"""
broker-connect task R7 — the instrument-detail lookup PROBE (owner-present, one run).

WHAT THIS IS. A standalone SPIKE script that answers exactly one question, on the record:
**does any Webull read endpoint resolve an `instrument_id` into option contract detail?**
Webull's `/account/positions` returns ZERO contract-identifying detail for options (no strike,
expiry, right, multiplier or underlying — just a bare ticker; see CAPTURE_FINDINGS §a). The
owner ruled "research a secondary lookup first" (RECONCILIATION_PLAN §3 Q1) before accepting
permanently-generic option rows. This probe converts a documentation GUESS into a recorded
fact.

It writes NO `src/` code and ships nothing. It is a test-directory tool, and its filename
deliberately does NOT start with `test_` so pytest never collects it — exactly like
`capture_broker_fixtures.py`, whose credential protocol and helpers it reuses verbatim.

CREDENTIAL RULE (binding, identical to B1). The owner's App Key + App Secret come from the
OWNER'S SHELL SESSION ENVIRONMENT for this one run:

    (PowerShell, run in the owner's own terminal, then CLOSE that terminal)
    cd C:\\Dev\\gammaflow-web\\apps\\api
    $env:WEBULL_APP_KEY    = '<app key>'
    $env:WEBULL_APP_SECRET = '<app secret>'
    .venv\\Scripts\\python.exe tests\\probe_webull_instrument.py

The script reads os.environ ONLY. It refuses to run (exit 2) if either var is absent and NEVER
prints either value on any path; every byte it writes anywhere — the committed fixture, the
findings section, and the GITIGNORED `_raw_scratch/` copy — is scrubbed against both values
first. Nothing here writes to .env or any dotfile.

WHAT IT CALLS. Three GUESSED read paths against ONE option `instrument_id` taken from the
already-committed `fixtures/broker/positions_raw.json` (so the probe takes no
account-identifying input from the owner), stopping on the first 2xx:

    GET /trade/instrument        )  guesses, informed by the NAMED-but-unverified
    GET /instrument/query        )  "Query Trade Instrument" endpoint (see DESK_RESEARCH)
    GET /quote/instrument        )

then ONE spelling retry pass (`instrument_ids`, `instrumentId`) on the first non-404 path.
Hard budget: 8 calls total, 0.6s apart, and a 429 is NEVER retried. `/account/positions` is
deliberately NOT touched — its captured semantics stay pinned.

WHAT IT WRITES.
  - `fixtures/broker/instrument_probe.json` — sanitized: per attempt, the path, param
    spelling, HTTP status, error_code, the response's top-level KEY SET (never values) and one
    of three failure classifications.
  - a new `(i) — Instrument-detail lookup probe (R7)` section in CAPTURE_FINDINGS.md carrying
    the desk research, the attempt table and exactly ONE `CONCLUSION:` line.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from capture_broker_fixtures import (  # the B1 tool — importable, it is __main__-guarded
    FINDINGS_PATH,
    FIXTURES_DIR,
    SCRATCH_DIR,
    _do,
    _exception_shape,
    _interesting_headers,  # noqa: F401  (kept in scope: raw scratch header capture)
    _shim_sdk_compat,
    _shim_ssl_wrap_socket,  # noqa: F401  (called by _shim_sdk_compat; named here as the pin)
    assert_no_nul_bytes,
    sanitize_payload,
    write_fixture,
)

POSITIONS_FIXTURE = FIXTURES_DIR / "positions_raw.json"
PROBE_FIXTURE = FIXTURES_DIR / "instrument_probe.json"
SCRATCH_FILE = SCRATCH_DIR / "instrument_probe_raw.json"

FINDINGS_MARKER = "## (i) — Instrument-detail lookup probe (R7)"

# --- the probe's shape (GUESSES — recording which of them is wrong IS the deliverable) ---
CANDIDATE_PATHS = ("/trade/instrument", "/instrument/query", "/quote/instrument")
PRIMARY_PARAM = "instrument_id"          # snake_case first: /account/positions uses
RETRY_PARAMS = ("instrument_ids", "instrumentId")  # account_id / last_instrument_id
MAX_CALLS = 8                            # hard cap across the WHOLE run
SLEEP_SECONDS = 0.6                      # be polite to the owner's own rate limits

# --- the three failure classes. They lead to three DIFFERENT product conclusions and must
#     never be collapsed: absent = Webull has no such read at all; not-permitted = it exists
#     but this key cannot see it (an entitlement question for the owner); bad-params = we
#     spelled it wrong and it is worth exactly one retry.
ENDPOINT_ABSENT = "endpoint_absent"
NOT_PERMITTED = "not_permitted_for_this_key"
BAD_PARAMS = "bad_params"
OTHER = "other"                          # 429/5xx/transport: honestly none of the three
RESOLVED = "resolved"

_PERMISSION_CODE_HINTS = ("PERMISSION", "FORBIDDEN", "UNAUTHORIZED", "NOT_AUTHORIZED",
                          "NO_AUTH", "SCOPE", "SUBSCRIPTION", "ENTITLE")
_ABSENT_CODE_HINTS = ("NOT_FOUND", "NO_SUCH", "UNKNOWN_API", "INVALID_URI", "UNSUPPORTED")
_BAD_PARAM_CODE_HINTS = ("PARAM", "INVALID_ARG", "MISSING", "ILLEGAL", "VALIDATION",
                         "BAD_REQUEST")

OWNER_RUN_COMMAND = (
    "cd C:\\Dev\\gammaflow-web\\apps\\api\n"
    "$env:WEBULL_APP_KEY    = '<app key>'\n"
    "$env:WEBULL_APP_SECRET = '<app secret>'\n"
    ".venv\\Scripts\\python.exe tests\\probe_webull_instrument.py\n"
)

# Recorded VERBATIM from the conductor's desk research (RECONCILIATION_PLAN §12/§13). Do not
# redo this research; the probe exists to settle the one thing it could not settle.
DESK_RESEARCH = (
    "`webullsdkcore` (the only installed SDK) exposes no instrument/quote lookup request "
    "classes — only generic HTTP transport/signing.",
    "`webull-python-sdk-mdata` exists on PyPI (v0.1.18) with \"Option Market Data\" endpoints "
    "(Tick/Snapshot/Historical-Bars) — but they take an ALREADY-KNOWN option code as INPUT to "
    "return pricing. They do not resolve instrument_id -> spec. Not a solution.",
    "`webull-python-sdk-trade` is deliberately NOT installed (its chain pins "
    "`grpcio==1.51.1`, unbuildable on py>=3.12) and its absence is a `[no-real-order-path]` "
    "asset — do NOT add it.",
    "A promising endpoint is NAMED but UNVERIFIED: \"Query Trade Instrument\" "
    "(`developer.webull.com/api-doc/trade/order/query-trade-instrument/`), signature "
    "`getTradeInstrument(instrumentId)`. Its exact method/path/params could NOT be confirmed "
    "— Webull's docs site is a JS-rendered SPA that defeats automated fetching. Converting "
    "this guess into a recorded fact is the entire point of the probe.",
    "Options ORDER PLACEMENT requires the caller to supply `strike_price`/"
    "`option_expire_date`/`option_type` directly — so Webull's systems clearly hold this "
    "data; it is just not confirmed as a documented public read.",
)


# --------------------------------------------------------------------------- pure helpers

def scrub_secrets(text: str, secrets: tuple[str, ...]) -> str:
    """Remove every occurrence of live secret material from a block of text."""
    for secret in secrets:
        if secret:
            text = text.replace(secret, "<SECRET_SCRUBBED>")
    return text


def is_success(status) -> bool:
    return bool(isinstance(status, int) and 200 <= status < 300)


def classify_failure(status, error_code=None) -> str:
    """Map one failed attempt into exactly one of the three classes (or `other`).

    Status wins where it is unambiguous; otherwise the vendor error_code decides (Webull can
    return an application-level error under HTTP 200 — the bad-credential capture returned
    `UNAUTHORIZED` as a CODE, and a key that simply lacks an entitlement is expected to look
    the same way).
    """
    if status == 404:
        return ENDPOINT_ABSENT
    if status == 403:
        return NOT_PERMITTED
    if status in (400, 422):
        return BAD_PARAMS
    code = str(error_code or "").upper()
    if any(hint in code for hint in _PERMISSION_CODE_HINTS):
        return NOT_PERMITTED
    if any(hint in code for hint in _ABSENT_CODE_HINTS):
        return ENDPOINT_ABSENT
    if any(hint in code for hint in _BAD_PARAM_CODE_HINTS):
        return BAD_PARAMS
    return OTHER


def response_key_set(payload) -> list[str]:
    """The response's top-level KEY SET — never its values (a value could be anything)."""
    if isinstance(payload, dict):
        return sorted(payload)
    if isinstance(payload, list):
        return ["<array>"] + sorted({k for el in payload if isinstance(el, dict) for k in el})
    return []


def build_attempt(path, param_name, status, payload, exception, secrets=()) -> dict:
    """One SANITIZED attempt record: shape and codes only, no response values."""
    error_code = None
    if isinstance(payload, dict):
        error_code = payload.get("error_code") or payload.get("errorCode") or payload.get("code")
    if error_code is None and exception is not None:
        error_code = getattr(exception, "error_code", None)
    http_status = status if status is not None else getattr(exception, "http_status", None)

    record = {
        "path": path,
        "param": param_name,
        "http_status": http_status,
        "error_code": error_code,
        "response_keys": response_key_set(payload),
        "classification": (RESOLVED if is_success(http_status)
                           else classify_failure(http_status, error_code)),
        "exception": _exception_shape(exception),
    }
    return sanitize_payload(record, tuple(s for s in secrets if s))


def select_instrument_id(fixture_path: Path = POSITIONS_FIXTURE) -> str:
    """The probe's subject: the FIRST OPTION instrument_id in the COMMITTED capture fixture.

    Reading it from the fixture (rather than asking) means this tool takes no
    account-identifying input. A missing/optionless fixture is a HARD failure naming the
    capture tool — never a silent fallback to a made-up id (R3's lesson).
    """
    try:
        data = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SystemExit(
            f"FATAL: cannot read {fixture_path} ({exc.__class__.__name__}). The real capture "
            f"fixture is required — run tests/capture_broker_fixtures.py first."
        ) from exc

    pages = data.get("pages") if isinstance(data, dict) else data
    for page in pages or []:
        entries = (page.get("holdings") or page.get("positions") or []) \
            if isinstance(page, dict) else page
        for entry in entries or []:
            if isinstance(entry, dict) and str(entry.get("instrument_type", "")).upper() == "OPTION":
                return str(entry["instrument_id"])

    raise SystemExit(
        f"FATAL: no OPTION entry in {fixture_path} — nothing to probe. Re-capture with "
        f"tests/capture_broker_fixtures.py, or pass --instrument-id explicitly."
    )


# --------------------------------------------------------------------------- the probe loop

def _build_probe_request(path: str, param_name: str, instrument_id: str):
    """Built exactly as the capture tool's `_build_requests()` does."""
    from webullsdkcore.request import ApiRequest

    request = ApiRequest(path, version="v1", method="GET", query_params={})
    request.add_query_param(param_name, instrument_id)
    return request


def _retry_candidate(attempts: list[dict]):
    """The first attempt worth ONE spelling retry: not 404 (no spelling fixes a missing
    route), not 429 (HARD RULE: never retried), not a transport failure (proves nothing)."""
    for record in attempts:
        status = record.get("http_status")
        if status is None or status == 404 or status == 429:
            continue
        return record["path"]
    return None


def run_probe(client, instrument_id, *, request_factory=None, sleep=time.sleep,
              secrets=(), raw_sink=None) -> dict:
    """Drive the candidates, stop on the first 2xx, and record every attempt.

    Network access lives entirely behind `client` + `request_factory`, so the loop's safety
    rules (call budget, 0.6s spacing, never-retry-a-429) are unit-testable offline.
    """
    factory = request_factory or _build_probe_request
    attempts: list[dict] = []
    state = {"calls": 0, "resolved": None}

    def attempt(path: str, param_name: str):
        if state["calls"] >= MAX_CALLS:
            return None
        if state["calls"]:
            sleep(SLEEP_SECONDS)
        state["calls"] += 1
        status, headers, payload, exc = _do(client, factory(path, param_name, instrument_id))
        record = build_attempt(path, param_name, status, payload, exc, secrets)
        attempts.append(record)
        if raw_sink is not None:
            raw_sink.append({"path": path, "param": param_name, "status": status,
                             "headers": dict(headers or {}), "payload": payload,
                             "exception": _exception_shape(exc)})
        if is_success(record["http_status"]):
            state["resolved"] = record
        return record

    for path in CANDIDATE_PATHS:
        if attempt(path, PRIMARY_PARAM) is None or state["resolved"]:
            break

    if not state["resolved"]:
        retry_path = _retry_candidate(attempts)
        if retry_path:
            for param_name in RETRY_PARAMS:
                if attempt(retry_path, param_name) is None or state["resolved"]:
                    break

    return {
        "attempts": attempts,
        "resolved": state["resolved"],
        "outcome": "A" if state["resolved"] else "B",
        "calls": state["calls"],
    }


# --------------------------------------------------------------------------- findings

def findings_context(*, instrument_id, region, result, now=None) -> dict:
    counts: dict[str, int] = {}
    for record in result["attempts"]:
        key = record.get("classification", OTHER)
        counts[key] = counts.get(key, 0) + 1
    return {
        "probed_at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
        "instrument_id": instrument_id,
        "region": region,
        "attempts": result["attempts"],
        "resolved": result.get("resolved"),
        "outcome": result["outcome"],
        "calls": result.get("calls", len(result["attempts"])),
        "counts": counts,
    }


def _conclusion_line(ctx: dict) -> str:
    if ctx["outcome"] == "A":
        hit = ctx["resolved"] or {}
        return (
            f"CONCLUSION: OUTCOME A — Webull DOES resolve an option `instrument_id` into "
            f"contract detail: `GET {hit.get('path')}` with param `{hit.get('param')}` "
            f"returned HTTP {hit.get('http_status')} carrying top-level keys "
            f"{hit.get('response_keys')}. Q1 reopens as an ADDITIVE, independently-nullable "
            f"enrichment follow-up (RECONCILIATION_PLAN §12 Outcome A) — explicitly OUT of "
            f"this build's critical path; no code is written for it now."
        )
    counts = ctx["counts"]
    breakdown = ", ".join(f"{counts.get(k, 0)} {k}" for k in
                          (ENDPOINT_ABSENT, NOT_PERMITTED, BAD_PARAMS, OTHER))
    return (
        f"CONCLUSION: OUTCOME B — no probed Webull read endpoint resolved an option "
        f"`instrument_id` into contract detail ({breakdown}, across {ctx['calls']} calls). "
        f"Q1 CLOSES: the honest generic option row is the PERMANENT v1 answer "
        f"(RECONCILIATION_PLAN §12 Outcome B), and `fidelity_notes` wording may strengthen "
        f"from \"capture showed no detail\" to \"Webull's API exposes no contract detail for "
        f"a held option position\"."
    )


def findings_section(ctx: dict) -> str:
    research = "\n".join(f"- {bullet}" for bullet in DESK_RESEARCH)
    rows = "\n".join(
        "| {n} | `{path}` | `{param}` | {status} | {code} | {keys} | `{cls}` |".format(
            n=i,
            path=record.get("path"),
            param=record.get("param"),
            status=record.get("http_status") if record.get("http_status") is not None
            else "(none — transport)",
            code=f"`{record.get('error_code')}`" if record.get("error_code") else "(none)",
            keys=f"`{record.get('response_keys')}`" if record.get("response_keys") else "(none)",
            cls=record.get("classification"),
        )
        for i, record in enumerate(ctx["attempts"], start=1)
    )
    return f"""{FINDINGS_MARKER}

**Probed:** {ctx['probed_at']} · region `{ctx['region']}` · tool
`tests/probe_webull_instrument.py` · subject: option `instrument_id` `{ctx['instrument_id']}`,
read from the committed `fixtures/broker/positions_raw.json` (the probe takes no
account-identifying input). Budget: {ctx['calls']}/{MAX_CALLS} calls, {SLEEP_SECONDS}s apart,
no 429 retried. `/account/positions` was NOT touched.

Answers the owner's Q1 ruling ("research a secondary lookup first" — RECONCILIATION_PLAN §3).

### Desk research recorded before the probe (do not redo)

{research}

### Attempts

| # | path | param spelling | HTTP status | error_code | response top-level keys | classification |
|---|------|----------------|-------------|------------|-------------------------|----------------|
{rows}

Response VALUES are never recorded — only the top-level key set. The three failure classes are
kept distinct on purpose: `{ENDPOINT_ABSENT}` (Webull has no such read), `{NOT_PERMITTED}`
(the read exists but this key cannot see it — an entitlement question, not a dead end),
`{BAD_PARAMS}` (worth exactly one spelling retry — this run performs it, `instrument_ids` then
`instrumentId`, on the first non-404 path if there was one). `{OTHER}` covers 429/5xx/transport,
which prove nothing either way.

### Conclusion

{_conclusion_line(ctx)}
"""


def append_findings(section: str, path: Path = FINDINGS_PATH) -> None:
    """Append (or REPLACE, if the probe is re-run) the §(i) section."""
    text = path.read_text(encoding="utf-8")
    index = text.find(FINDINGS_MARKER)
    if index != -1:
        text = text[:index]
    path.write_text(text.rstrip("\n") + "\n\n" + section, encoding="utf-8", newline="\n")
    assert_no_nul_bytes(path)


# --------------------------------------------------------------------------- main

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="broker-connect R7 spike: probe Webull for an instrument-detail lookup.")
    parser.add_argument("--instrument-id", default=None,
                        help="override the subject (default: first OPTION in positions_raw.json)")
    args = parser.parse_args(argv)

    app_key = os.environ.get("WEBULL_APP_KEY", "")
    app_secret = os.environ.get("WEBULL_APP_SECRET", "")
    if not app_key or not app_secret:
        print("REFUSING TO RUN: set WEBULL_APP_KEY and WEBULL_APP_SECRET in THIS shell's "
              "environment first (never in a file). Neither value is echoed by this tool.\n")
        print(OWNER_RUN_COMMAND)
        return 2
    secrets = (app_key, app_secret)
    region = os.environ.get("WEBULL_REGION", "us")

    instrument_id = args.instrument_id or select_instrument_id()
    print(f"R7 probe — subject option instrument_id {instrument_id} · region {region} · "
          f"budget {MAX_CALLS} calls\n")

    _shim_sdk_compat()
    from webullsdkcore.client import ApiClient

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    client = ApiClient(app_key, app_secret, region_id=region)

    raw: list[dict] = []
    result = run_probe(client, instrument_id, secrets=secrets, raw_sink=raw)

    for record in result["attempts"]:
        print(f"  GET {record['path']:<20} {record['param']:<15} "
              f"status={record['http_status']} code={record['error_code']} "
              f"keys={record['response_keys']} -> {record['classification']}")

    # Raw (gitignored) copy — scrubbed of key/secret material even here.
    scratch_text = scrub_secrets(json.dumps({"instrument_id": instrument_id, "attempts": raw},
                                            indent=2, default=str), secrets)
    SCRATCH_FILE.write_text(scratch_text, encoding="utf-8", newline="\n")
    print(f"\n  raw (gitignored): {SCRATCH_FILE}")

    write_fixture(PROBE_FIXTURE, {"probed": True, "instrument_id": instrument_id,
                                  "region": region, **result}, secrets)

    ctx = findings_context(instrument_id=instrument_id, region=region, result=result)
    section = findings_section(ctx)
    for secret in secrets:
        if secret and secret in section:
            raise SystemExit("FATAL: secret material reached the findings section — not writing.")
    append_findings(section)
    print(f"  findings: {FINDINGS_PATH} (section '{FINDINGS_MARKER}')")

    print(f"\n{_conclusion_line(ctx)}\n")
    print("Re-run (or run again after closing this terminal) with:\n")
    print(OWNER_RUN_COMMAND)
    print("Then: (1) close this terminal (the env vars die with it); (2) review + git add "
          "fixtures/broker/instrument_probe.json and CAPTURE_FINDINGS.md; (3) delete "
          "tests/fixtures/broker/_raw_scratch/ after review.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
