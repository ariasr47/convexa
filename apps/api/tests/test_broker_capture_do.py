"""
broker-connect B1 — regression tests for the capture tool's `_do()` response unpacking.

Why this file exists: `webullsdkcore`'s `_implementation_of_do_action` returns a 5-tuple
`(status, headers, body, exception, response)` where `body` is `response.content` (raw
bytes, gzip already decoded) and `response` is the requests `Response` OBJECT — not parsed
JSON. Assigning `response` as the parsed body type-checks fine, imports fine, and passes
every offline test, then fails on the FIRST live call with
`AttributeError: 'Response' object has no attribute 'get'` — after real credentials have
already been used. That is precisely the silently-regressing class the risk-based rule says
to pin, and it cost the owner a live run once (2026-08-01).

No credentials, no network: a fake client returns the SDK's exact tuple shape.
"""
from __future__ import annotations

import json

from capture_broker_fixtures import _do

PAYLOAD = {"data": [{"account_id": "ZH1234567", "account_type": "CASH"}], "has_next": False}


class _FakeResponse:
    """Stands in for a requests Response: has .json()/.content, and NO .get()."""

    def __init__(self, payload):
        self._payload = payload
        self.content = json.dumps(payload).encode("utf-8")

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, status=200, headers=None, body=None, exception=None, response=None):
        self._tuple = (status, headers or {}, body, exception, response)

    def _implementation_of_do_action(self, request):  # noqa: D401 — mirrors the SDK name
        return self._tuple


def test_do_parses_the_body_not_the_response_object():
    """The bug: `parsed` was the Response object, so `.get(...)` blew up downstream."""
    body = json.dumps(PAYLOAD).encode("utf-8")
    client = _FakeClient(body=body, response=_FakeResponse(PAYLOAD))

    status, headers, parsed, exc = _do(client, object())

    assert status == 200
    assert exc is None
    assert isinstance(parsed, dict), "parsed body must be a dict, never the Response object"
    assert parsed == PAYLOAD
    assert parsed.get("data")[0]["account_type"] == "CASH"  # the call that used to crash


def test_do_accepts_a_str_body():
    client = _FakeClient(body=json.dumps(PAYLOAD))
    _, _, parsed, _ = _do(client, object())
    assert parsed == PAYLOAD


def test_do_falls_back_to_response_json_when_body_is_empty():
    client = _FakeClient(body=b"", response=_FakeResponse(PAYLOAD))
    _, _, parsed, _ = _do(client, object())
    assert parsed == PAYLOAD


def test_do_survives_an_unparseable_body_without_raising():
    client = _FakeClient(body=b"<html>gateway timeout</html>")
    _, _, parsed, _ = _do(client, object())
    assert isinstance(parsed, dict)
    assert "_unparsed_body_snippet" in parsed


def test_do_returns_none_body_and_the_exception_on_transport_failure():
    boom = RuntimeError("transport died")
    client = _FakeClient(status=None, headers=None, body=None, exception=boom, response=None)
    status, headers, parsed, exc = _do(client, object())
    assert status is None and parsed is None and exc is boom
    assert headers == {}


def test_do_always_returns_a_plain_dict_of_headers():
    client = _FakeClient(headers={"X-RateLimit-Remaining": "58"}, body=json.dumps(PAYLOAD))
    _, headers, _, _ = _do(client, object())
    assert type(headers) is dict and headers["X-RateLimit-Remaining"] == "58"
