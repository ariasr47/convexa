"""
M-1 (system-6 security review, Medium; failed GATE Q's AC-5) — FastAPI's default 422 handler
echoed the RAW submitted value back in the response body.

`src/auth/router.py` makes the credential fields optional at the Pydantic layer ON PURPOSE so
the MISSING-half case never trips the default handler. That defense cannot reach a wrong-TYPED
field: Pydantic raises `string_type` before any router code runs, and the default
`RequestValidationError` handler serializes the offending value under `input`. On the
credential routes that value IS the secret.

Reproduced live on BOTH `PUT /api/broker/credential` (broker-connect) and the already-shipped
`PUT /api/auth/ai-key` (byo-ai-key) — so it was a pre-existing leak, not only new-feature
surface. `[secret-encrypted-at-rest]`: a stored secret is never returned in a response, and a
422 body is a response.

The fix is app-wide (`main.py`), because no endpoint in this app benefits from having its
submitted value read back to it and a per-route defense is one new route away from being
bypassed again.
"""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("MASSIVE_API_KEY", "dummy-verify")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-dummy")
os.environ.setdefault("AI_REC_STUB", "1")
os.environ.setdefault("POSITIONS_PROVIDER", "stub")
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")

import pytest                                                       # noqa: E402
from fastapi.testclient import TestClient                            # noqa: E402

import main                                                          # noqa: E402

# Distinctive sentinels: if any of these reaches a response body, the leak is back.
SENTINEL_APP_KEY = "WEBULL-SENTINEL-APPKEY-Zq7x"
SENTINEL_APP_SECRET = "WEBULL-SENTINEL-SECRET-Vb3n"
SENTINEL_AI_KEY = "sk-ant-SENTINEL-KEY-Mr9t"


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        _signup(c)
        yield c


def _signup(c: TestClient) -> None:
    email = f"m1-{uuid.uuid4().hex[:10]}@test.invalid"
    r = c.post("/api/auth/signup", json={"email": email, "password": "Xx-test-passw0rd"})
    assert r.status_code == 200, r.text


# The wrong-TYPED shapes QA used. Each carries the sentinel inside a non-string container, so
# Pydantic's `string_type` error fires with the secret as its `input`.
_WRONG_TYPED_BROKER = [
    pytest.param({"app_key": [SENTINEL_APP_KEY], "app_secret": [SENTINEL_APP_SECRET]},
                 id="both-arrays"),
    pytest.param({"app_key": {"v": SENTINEL_APP_KEY}, "app_secret": SENTINEL_APP_SECRET},
                 id="key-object"),
    pytest.param({"app_key": SENTINEL_APP_KEY, "app_secret": [SENTINEL_APP_SECRET]},
                 id="secret-array-key-valid"),
]


@pytest.mark.parametrize("body", _WRONG_TYPED_BROKER)
def test_broker_credential_422_never_echoes_the_submitted_secret(client, body):
    r = client.put("/api/broker/credential", json=body)
    assert r.status_code == 422
    assert SENTINEL_APP_KEY not in r.text
    assert SENTINEL_APP_SECRET not in r.text


def test_ai_key_422_never_echoes_the_submitted_key(client):
    """The same leak on the already-shipped byo-ai-key route."""
    r = client.put("/api/auth/ai-key", json={"key": [SENTINEL_AI_KEY]})
    assert r.status_code == 422
    assert SENTINEL_AI_KEY not in r.text


def test_the_422_still_says_which_field_was_wrong(client):
    """Redaction must not make the error useless: the client still learns the field and why."""
    r = client.put("/api/broker/credential",
                   json={"app_key": [SENTINEL_APP_KEY], "app_secret": SENTINEL_APP_SECRET})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert isinstance(detail, list) and detail
    entry = next(e for e in detail if e["loc"] == ["body", "app_key"])
    assert entry["type"] == "string_type"
    assert "string" in entry["msg"].lower()
    assert "input" not in entry and "ctx" not in entry     # the value itself is gone


def test_no_422_anywhere_carries_an_input_or_ctx_key(client):
    """App-wide, not route-wide: a future route cannot reintroduce the echo by existing."""
    responses = [
        client.put("/api/broker/credential", json={"app_key": [SENTINEL_APP_KEY],
                                                   "app_secret": [SENTINEL_APP_SECRET]}),
        client.put("/api/auth/ai-key", json={"key": [SENTINEL_AI_KEY]}),
        client.post("/api/auth/signup", json={"email": 12345, "password": ["hunter2"]}),
        client.post("/api/auth/login", json={"email": {"a": 1}, "password": 7}),
        client.put("/api/auth/settings", json={"theme": ["dark"]}),
    ]
    for r in responses:
        assert r.status_code in (401, 403, 422), r.text
        if r.status_code != 422:
            continue
        for entry in r.json()["detail"]:
            assert "input" not in entry, f"422 body echo is back: {entry}"
            assert "ctx" not in entry, f"422 body echo is back: {entry}"
        for leaked in ("hunter2", SENTINEL_APP_KEY, SENTINEL_APP_SECRET, SENTINEL_AI_KEY):
            assert leaked not in r.text


def test_the_missing_half_422_is_unchanged(client):
    """The router's own both-halves message (AC-5) still owns the missing-field case — the new
    handler must not have swallowed it."""
    r = client.put("/api/broker/credential", json={"app_key": SENTINEL_APP_KEY})
    assert r.status_code == 422
    assert "Enter both the App Key and the App Secret" in r.text
    assert SENTINEL_APP_KEY not in r.text
