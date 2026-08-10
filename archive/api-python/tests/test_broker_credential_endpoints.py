"""
broker-connect B3 — the /api/broker/credential trio + the credential-kind discriminator.

Pins: the server gate (AC-4 arm), the write-only/masked-hint shape (AC-1/5), both-halves-or-
nothing (422 that echoes NO fragment), rotate-is-overwrite, idempotent delete, the
storage-unavailable 200, kind isolation (broker rows never disturb kind="ai" rows), and the
log-scan arm (no half, no ciphertext, in any log record during a save).
"""
from __future__ import annotations

import logging
import os
import uuid

os.environ.setdefault("MASSIVE_API_KEY", "dummy-verify")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-dummy")
os.environ.setdefault("AI_REC_STUB", "1")
os.environ.setdefault("POSITIONS_PROVIDER", "stub")
# TestClient talks http://testserver — a Secure cookie would never be replayed.
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")

import pytest
from fastapi.testclient import TestClient

import main  # noqa: E402  (env above must precede the app import)
from src import auth

APP_KEY = "wbk-test-app-key-77AB"
APP_SECRET = "wbs-test-app-secret-93ZZ"


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        yield c


def _signup(c: TestClient) -> str:
    """Create a fresh throwaway account on this client; returns the server user id."""
    email = f"broker-cred-{uuid.uuid4().hex[:10]}@test.invalid"
    r = c.post("/api/auth/signup", json={"email": email, "password": "Xx-test-passw0rd"})
    assert r.status_code == 200, r.text
    return r.json()["user"]["id"]


# ------------------------------------------------------------------ gate (AC-4 arm)

def test_anonymous_is_refused_on_all_three(client):
    assert client.get("/api/broker/credential").status_code in (401, 403)
    assert client.put("/api/broker/credential",
                      json={"app_key": APP_KEY, "app_secret": APP_SECRET}).status_code in (401, 403)
    assert client.delete("/api/broker/credential").status_code in (401, 403)


# ------------------------------------------------------------------ save / hint / rotate

def test_put_both_halves_returns_masked_hint(client):
    _signup(client)
    r = client.put("/api/broker/credential",
                   json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    assert r.status_code == 200
    assert r.json() == {"set": True, "last4": APP_KEY[-4:], "storage_available": True}
    # The response never carries either half or any ciphertext-looking blob.
    assert APP_KEY not in r.text and APP_SECRET not in r.text


@pytest.mark.parametrize("body", [
    {"app_key": APP_KEY},                                  # secret missing
    {"app_secret": APP_SECRET},                            # key missing
    {"app_key": "", "app_secret": APP_SECRET},             # key empty
    {"app_key": APP_KEY, "app_secret": "   "},             # secret whitespace
    {},                                                    # both missing
])
def test_put_with_missing_half_is_422_and_echoes_no_fragment(client, body):
    _signup(client)
    r = client.put("/api/broker/credential", json=body)
    assert r.status_code == 422
    assert APP_KEY not in r.text
    assert APP_SECRET not in r.text


def test_get_after_put_shows_hint_only(client):
    _signup(client)
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    r = client.get("/api/broker/credential")
    assert r.status_code == 200
    assert r.json() == {"set": True, "last4": APP_KEY[-4:], "storage_available": True}
    assert APP_KEY not in r.text and APP_SECRET not in r.text


def test_get_with_nothing_stored(client):
    _signup(client)
    r = client.get("/api/broker/credential")
    assert r.json() == {"set": False, "last4": None, "storage_available": True}


def test_rotate_overwrites_single_record(client):
    user_id = _signup(client)
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    r = client.put("/api/broker/credential",
                   json={"app_key": "replacement-key-55QQ", "app_secret": "replacement-secret"})
    assert r.json()["last4"] == "55QQ"
    # One record, the new one, ciphertext only (server-side inspection).
    store = auth.get_service().stores.credentials
    rec = store.get_record(user_id, kind="broker_webull")
    assert rec is not None and rec.last4 == "55QQ"
    assert "replacement-key-55QQ" not in rec.ciphertext
    assert "replacement-secret" not in rec.ciphertext


def test_delete_is_idempotent(client):
    _signup(client)
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    r1 = client.delete("/api/broker/credential")
    r2 = client.delete("/api/broker/credential")   # nothing stored anymore — still 200
    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json() == {"set": False, "storage_available": True}
    assert client.get("/api/broker/credential").json()["set"] is False


# ------------------------------------------------------------------ storage-unavailable

def test_storage_unavailable_is_a_contained_200(client, monkeypatch):
    _signup(client)
    from src.auth import sqlite_store

    def boom(self, user_id, kind="ai"):
        raise RuntimeError("store down")

    monkeypatch.setattr(sqlite_store.SqliteUserCredentialStore, "get_record", boom)
    r = client.get("/api/broker/credential")
    assert r.status_code == 200
    assert r.json() == {"set": False, "last4": None, "storage_available": False}


# ------------------------------------------------------------------ kind isolation

def test_broker_rows_never_disturb_ai_rows(client):
    user_id = _signup(client)
    # Existing byo-ai-key surface, untouched semantics.
    r = client.put("/api/auth/ai-key", json={"key": "sk-ant-test-ai-key-4321"})
    assert r.json() == {"set": True, "last4": "4321", "storage_available": True}
    # Broker set + delete cycles do not touch the ai row.
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    client.delete("/api/broker/credential")
    r = client.get("/api/auth/ai-key")
    assert r.json() == {"set": True, "last4": "4321", "storage_available": True}
    # And the ai row still decrypts (kind="ai" path byte-identical in behavior).
    assert auth.get_service().get_decrypted_ai_key(user_id) == "sk-ant-test-ai-key-4321"


def test_ai_delete_never_disturbs_broker_row(client):
    user_id = _signup(client)
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    client.put("/api/auth/ai-key", json={"key": "sk-ant-test-ai-key-9999"})
    client.delete("/api/auth/ai-key")
    assert client.get("/api/broker/credential").json()["set"] is True
    assert auth.get_service().get_decrypted_broker_credential(user_id) == (APP_KEY, APP_SECRET)


# ------------------------------------------------------------------ server-side resolution

def test_decrypted_resolution_and_decrypt_fail_path(client):
    user_id = _signup(client)
    svc = auth.get_service()
    assert svc.get_decrypted_broker_credential(user_id) is None  # nothing stored
    client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
    assert svc.get_decrypted_broker_credential(user_id) == (APP_KEY, APP_SECRET)
    # Corrupt the ciphertext: decrypt-fail resolves to None, never raises.
    svc.stores.credentials.set_key(user_id, "not-a-fernet-token", APP_KEY[-4:],
                                   kind="broker_webull")
    assert svc.get_decrypted_broker_credential(user_id) is None


# ------------------------------------------------------------------ log hygiene (AC-5 arm)

def test_no_half_or_ciphertext_in_logs_during_save(client):
    _signup(client)
    records: list[logging.LogRecord] = []

    class Collector(logging.Handler):
        def emit(self, record):
            records.append(record)

    collector = Collector(level=logging.DEBUG)
    convexa = logging.getLogger("Convexa")
    convexa.addHandler(collector)
    try:
        client.put("/api/broker/credential", json={"app_key": APP_KEY, "app_secret": APP_SECRET})
        client.get("/api/broker/credential")
        client.delete("/api/broker/credential")
    finally:
        convexa.removeHandler(collector)
    logged = "\n".join(str(r.getMessage()) for r in records)
    assert APP_KEY not in logged
    assert APP_SECRET not in logged
    assert "gAAAA" not in logged   # Fernet token prefix — no ciphertext either
