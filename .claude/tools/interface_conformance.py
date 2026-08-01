#!/usr/bin/env python
"""interface_conformance.py — runtime FE↔BE conformance check (system-1).

Proves the dangerous unguarded seam: the live backend EMITS the fields the INTERFACE_CONTRACT promises
(= the fields the frontend CONSUMES, since the FE binds to the same interface). Integration stops being
*asserted* and becomes *verified*.

How it works: each `INTERFACE_CONTRACT.md` carries a machine-checkable **conformance spec** — a fenced
```json block under a "## Conformance spec" heading — listing each endpoint + the required field paths
(name · type · presence). This tool hits the live endpoint (or a captured sample) and validates the
emitted JSON against that spec. The interface stays the single source of truth; this just makes it
executable.

Usage:
    # live: boot the backend yourself (see project.json `backend.serve_cmd`), then —
    python .claude/tools/interface_conformance.py --contract .claude/contracts/{F}/INTERFACE_CONTRACT.md --url <backend-base-url>
    # or a standalone spec file:
    python .claude/tools/interface_conformance.py --spec .claude/tools/conformance/<feature>.json --url <backend-base-url>
    # offline: validate a captured response against one endpoint (CI / no server):
    python .claude/tools/interface_conformance.py --spec SPEC.json --sample resp.json --endpoint /api/example
    # auth-gated endpoints (spec entries carrying "auth": true) — EITHER bootstrap a throwaway
    # session (POST /api/auth/signup with a unique generated user, Set-Cookie captured):
    python .claude/tools/interface_conformance.py --spec SPEC.json --url <base> --auth-signup
    # OR supply an existing session cookie verbatim:
    python .claude/tools/interface_conformance.py --spec SPEC.json --url <base> --auth-cookie "convexa_session=..."

Spec schema (JSON):
    {"endpoints": [{
       "method": "GET", "path": "/api/example/{id}",
       "path_params": {"id": "abc"}, "query": {"limit": 7},
       "auth": true,
       "required": { "<dot.path>": "<typespec>", ... }
    }]}
Type specs: number | string | boolean | object | array | null ; unions "object|null"; trailing "?" =
optional (absent ⇒ pass, present ⇒ must match). A path segment "name[]" means "the value at name is an
array — apply the rest of the path to EACH element" (empty array ⇒ vacuously passes).
`"auth": true` marks an endpoint as session-gated: in live mode its request carries the session
Cookie (from --auth-signup or --auth-cookie; running such a spec without either is a spec error).
Endpoints without the flag are fetched anonymously, exactly as before — the anonymous surface stays
verified as anonymous. The Set-Cookie capture is manual (header parse), so it works regardless of
the cookie's Secure attribute even against a local http backend; the throwaway signup user persists
only for the process lifetime on the default in-memory store (a persistent store accrues one
disposable user per --auth-signup run).

Exit: 1 if any endpoint FAILs (missing field / type mismatch / non-200 / unreachable), else 0.
Stdlib only (urllib/json/re/argparse). Run with the project interpreter (project.json `backend.python`).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TYPE_CHECKS = {
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "null": lambda v: v is None,
}


def type_ok(value, typespec: str) -> bool:
    return any(TYPE_CHECKS.get(t.strip(), lambda v: False)(value) for t in typespec.split("|"))


class Fail(Exception):
    pass


def check_path(obj, path: str, typespec: str, failures: list[str]) -> None:
    """Resolve a dot-path (with name[] array fan-out) and type-check the leaf(s)."""
    optional = typespec.endswith("?")
    tspec = typespec[:-1] if optional else typespec
    segs = path.split(".")
    _walk(obj, segs, tspec, optional, path, failures)


def _walk(node, segs: list[str], tspec: str, optional: bool, full: str, failures: list[str]) -> None:
    if not segs:
        if not type_ok(node, tspec):
            failures.append(f"{full}: expected {tspec}, got {_typename(node)} ({node!r:.40})")
        return
    seg, rest = segs[0], segs[1:]
    fan = seg.endswith("[]")
    key = seg[:-2] if fan else seg
    if not isinstance(node, dict) or key not in node:
        if not optional:
            failures.append(f"{full}: missing field (no '{key}')")
        return
    val = node[key]
    if fan:
        if not isinstance(val, list):
            failures.append(f"{full}: expected array at '{key}', got {_typename(val)}")
            return
        for el in val:  # empty list ⇒ vacuously passes
            _walk(el, rest, tspec, optional, full, failures)
    else:
        _walk(val, rest, tspec, optional, full, failures)


def _typename(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    return {dict: "object", list: "array", str: "string"}.get(type(v), type(v).__name__)


def extract_spec_from_contract(text: str) -> dict:
    m = re.search(r"##\s*Conformance spec.*?```json\s*(.*?)```", text, re.S | re.I)
    if not m:
        raise Fail("no '## Conformance spec' ```json block found in the contract")
    return json.loads(m.group(1))


def fetch(base: str, ep: dict, cookie: str | None = None):
    path = ep["path"]
    for k, v in ep.get("path_params", {}).items():
        path = path.replace("{" + k + "}", urllib.parse.quote(str(v)))
    url = base.rstrip("/") + path
    if ep.get("query"):
        url += "?" + urllib.parse.urlencode(ep["query"])
    # Optional JSON request body (for POST/PUT endpoints). Absent ⇒ no body (GET semantics
    # unchanged), so this is fully backward-compatible with every existing flat spec.
    data, headers = None, {}
    if ep.get("body") is not None:
        data = json.dumps(ep["body"]).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if ep.get("auth"):
        if not cookie:
            raise Fail("endpoint is auth-gated ('auth': true) but no session cookie is available "
                       "— pass --auth-signup or --auth-cookie")
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, method=ep.get("method", "GET"), data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            raise Fail(f"HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def bootstrap_session(base: str) -> str:
    """POST /api/auth/signup with a unique throwaway user; return the 'name=value' session cookie.

    Manual Set-Cookie parse (first attribute pair) rather than a CookieJar, deliberately: a jar
    honors the cookie's Secure attribute and would refuse to replay it over a local http:// base,
    which is exactly where this tool runs during verification.
    """
    import uuid
    tag = uuid.uuid4().hex[:12]
    body = {"email": f"conformance-{tag}@sweep.invalid",
            "password": f"Sweep-{tag}!x9",
            "display_name": "conformance sweep"}
    req = urllib.request.Request(
        base.rstrip("/") + "/api/auth/signup",
        method="POST",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            raise Fail(f"auth bootstrap: signup returned HTTP {resp.status}")
        set_cookie = resp.headers.get("Set-Cookie")
    if not set_cookie or "=" not in set_cookie.split(";", 1)[0]:
        raise Fail("auth bootstrap: signup succeeded but no Set-Cookie header was returned")
    cookie = set_cookie.split(";", 1)[0].strip()
    print(f"  auth: session bootstrapped via /api/auth/signup ({body['email']})")
    return cookie


def validate_endpoint(ep: dict, payload) -> list[str]:
    failures: list[str] = []
    for path, tspec in ep.get("required", {}).items():
        check_path(payload, path, tspec, failures)
    return failures


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Runtime FE↔BE interface-conformance check (system-1).")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--contract", help="INTERFACE_CONTRACT.md with an embedded conformance spec")
    src.add_argument("--spec", help="standalone JSON conformance spec")
    ap.add_argument("--url", default=None, help="base URL of a running backend (live mode)")
    ap.add_argument("--sample", default=None, help="captured JSON response (offline mode)")
    ap.add_argument("--endpoint", default=None, help="with --sample: the spec path to validate against")
    ap.add_argument("--auth-signup", action="store_true",
                    help="live mode: bootstrap a throwaway session via POST /api/auth/signup for "
                         "endpoints marked 'auth': true")
    ap.add_argument("--auth-cookie", default=None, metavar="NAME=VALUE",
                    help="live mode: an existing session cookie to send on 'auth': true endpoints")
    args = ap.parse_args(argv[1:])

    try:
        if args.contract:
            spec = extract_spec_from_contract(Path(args.contract).read_text(encoding="utf-8"))
        else:
            spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, Fail) as e:
        print(f"spec error: {e}")
        return 2

    endpoints = spec.get("endpoints", [])
    if not endpoints:
        print("spec has no endpoints")
        return 2

    if args.sample:
        eps = [e for e in endpoints if e["path"] == args.endpoint] or endpoints[:1]
        payload = json.loads(Path(args.sample).read_text(encoding="utf-8"))
        cases = [(eps[0], payload, None)]
    elif args.url:
        cookie = args.auth_cookie
        if cookie is None and args.auth_signup and any(ep.get("auth") for ep in endpoints):
            try:
                cookie = bootstrap_session(args.url)
            except (urllib.error.URLError, Fail, json.JSONDecodeError, TimeoutError) as e:
                print(f"auth bootstrap error: {e}")
                return 2
        cases = []
        for ep in endpoints:
            try:
                cases.append((ep, fetch(args.url, ep, cookie), None))
            except (urllib.error.URLError, Fail, json.JSONDecodeError, TimeoutError) as e:
                cases.append((ep, None, str(e)))
    else:
        print("provide --url (live) or --sample (offline)")
        return 2

    total_fail = 0
    print(f"interface_conformance — {len(cases)} endpoint(s)")
    for ep, payload, err in cases:
        label = f"{ep.get('method','GET')} {ep['path']}"
        if err is not None:
            print(f"  FAIL  {label}: unreachable/error — {err}")
            total_fail += 1
            continue
        failures = validate_endpoint(ep, payload)
        if failures:
            total_fail += 1
            print(f"  FAIL  {label} — {len(failures)} issue(s):")
            for f in failures:
                print(f"          - {f}")
        else:
            n = len(ep.get("required", {}))
            print(f"  PASS  {label} — {n} required field(s) present + well-typed")
    print(f"\n  {total_fail} endpoint failure(s).")
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
