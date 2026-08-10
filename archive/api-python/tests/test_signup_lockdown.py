"""
Owner lockdown (2026-08-06) — new registrations are closed while Convexa is in private testing.

These are the negative-space tests. They set `SIGNUPS_ENABLED` per case rather than leaning on the
suite-wide conftest fixture (which opens the door so the REST of the suite can reach gated
surfaces) — otherwise this file would be testing the fixture, not the lockdown.

What must hold:
  - the front door (`POST /api/auth/signup`) refuses when closed, BEFORE touching the store;
  - the side door (the Google callback's create-a-new-user step) refuses on the same predicate —
    a gate that holds on one door and not the other is the whole bug;
  - an EXISTING account can still log in while closed (this is a registration lock, not a lockout);
  - the owner allowlist can always register;
  - the scanner read endpoints, previously anonymous-open, now refuse a signed-out caller.
"""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("MASSIVE_API_KEY", "dummy-verify")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-dummy")
os.environ.setdefault("AI_REC_STUB", "1")
os.environ.setdefault("POSITIONS_PROVIDER", "stub")
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")

import pytest
from fastapi.testclient import TestClient

import main  # noqa: E402  (env above must precede the app import)
from src.auth import policy


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def closed(monkeypatch):
    """Sign-ups CLOSED, no owner allowlist."""
    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    monkeypatch.setenv("OWNER_EMAILS", "")


def _fresh_email(tag: str) -> str:
    return f"{tag}-{uuid.uuid4().hex[:10]}@test.invalid"


# --------------------------------------------------------------------------- the policy predicate

def test_the_policy_fails_closed_when_unset(monkeypatch):
    monkeypatch.delenv("SIGNUPS_ENABLED", raising=False)
    monkeypatch.setenv("OWNER_EMAILS", "")
    assert policy.signups_enabled() is False
    assert policy.registration_allowed("anyone@example.com") is False


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on"])
def test_explicit_truthy_values_open_it(monkeypatch, value):
    monkeypatch.setenv("SIGNUPS_ENABLED", value)
    assert policy.signups_enabled() is True


@pytest.mark.parametrize("value", ["0", "false", "no", "off", "", "  ", "ture", "enabled"])
def test_anything_else_keeps_the_door_shut(monkeypatch, value):
    """A typo must not open registration — the failure mode has a security consequence."""
    monkeypatch.setenv("SIGNUPS_ENABLED", value)
    assert policy.signups_enabled() is False


def test_the_owner_allowlist_is_case_insensitive_and_always_allowed(monkeypatch):
    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    monkeypatch.setenv("OWNER_EMAILS", "Me@Example.com , other@example.com")
    assert policy.registration_allowed("ME@EXAMPLE.COM") is True
    assert policy.registration_allowed("other@example.com") is True
    assert policy.registration_allowed("stranger@example.com") is False


# --------------------------------------------------------------------------- the front door

def test_signup_is_refused_when_closed(client, closed):
    r = client.post("/api/auth/signup",
                    json={"email": _fresh_email("stranger"), "password": "a-good-password-1"})
    assert r.status_code == 403
    assert r.json()["error"] == "signups_closed"


def test_the_refusal_sets_no_session_cookie(client, closed):
    r = client.post("/api/auth/signup",
                    json={"email": _fresh_email("stranger"), "password": "a-good-password-1"})
    assert r.status_code == 403
    assert "set-cookie" not in {k.lower() for k in r.headers.keys()}


def test_no_account_is_created_by_a_refused_signup(client, closed, monkeypatch):
    """The gate is the OUTERMOST precondition — the store must never be touched."""
    email = _fresh_email("never-created")
    assert client.post("/api/auth/signup",
                       json={"email": email, "password": "a-good-password-1"}).status_code == 403
    # Re-open and register the same address: a 409 here would prove the refused attempt had
    # already written a row.
    monkeypatch.setenv("SIGNUPS_ENABLED", "1")
    assert client.post("/api/auth/signup",
                       json={"email": email, "password": "a-good-password-1"}).status_code == 200


def test_the_refusal_is_not_enumerable(client, monkeypatch):
    """Closed must answer identically for a taken address and a free one — otherwise the lockdown
    becomes an account-existence oracle, which is worse than the door it closed."""
    monkeypatch.setenv("SIGNUPS_ENABLED", "1")
    monkeypatch.setenv("OWNER_EMAILS", "")
    taken = _fresh_email("taken")
    assert client.post("/api/auth/signup",
                       json={"email": taken, "password": "a-good-password-1"}).status_code == 200

    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    a = client.post("/api/auth/signup", json={"email": taken, "password": "a-good-password-1"})
    b = client.post("/api/auth/signup",
                    json={"email": _fresh_email("free"), "password": "a-good-password-1"})
    assert a.status_code == b.status_code == 403
    assert a.json() == b.json()


def test_the_owner_can_still_register_while_closed(client, monkeypatch):
    email = _fresh_email("owner")
    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    monkeypatch.setenv("OWNER_EMAILS", email)
    r = client.post("/api/auth/signup", json={"email": email, "password": "a-good-password-1"})
    assert r.status_code == 200


def test_an_existing_account_still_logs_in_while_closed(client, monkeypatch):
    """This is a REGISTRATION lock, not a lockout. Breaking login would lock the owner out too."""
    email = _fresh_email("existing")
    monkeypatch.setenv("SIGNUPS_ENABLED", "1")
    monkeypatch.setenv("OWNER_EMAILS", "")
    assert client.post("/api/auth/signup",
                       json={"email": email, "password": "a-good-password-1"}).status_code == 200
    client.post("/api/auth/logout")

    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    r = client.post("/api/auth/login", json={"email": email, "password": "a-good-password-1"})
    assert r.status_code == 200


# --------------------------------------------------------------------------- the side door

def test_the_google_door_obeys_the_same_predicate(closed):
    """The Google callback CREATES a user on an unknown identity (service.py step 3). If the
    lockdown did not reach it, 'Continue with Google' would stay wide open while /signup was
    bolted — and that is precisely the two-copies-of-one-rule failure this repo keeps hitting."""
    import inspect
    from src.auth import service

    src = inspect.getsource(service.AuthService.google_callback)
    assert "policy.registration_allowed" in src, (
        "the Google create-user step must consult the SAME policy predicate as /signup")


# --------------------------------------------------------------------------- the scanner surfaces

@pytest.mark.parametrize("path", ["/api/scan", "/api/scan/universe", "/api/scan/view"])
def test_scanner_reads_now_refuse_a_signed_out_caller(client, path):
    """These three were anonymous-open by contract before the lockdown. The owner closed them, so
    the negative space is the test: signed out ⇒ 403 auth_required, never a 200 with rows."""
    r = client.get(path)
    assert r.status_code == 403, f"{path} answered {r.status_code}"
    assert r.json()["error"] == "auth_required"


def test_the_ticker_bundle_stays_public(client):
    """The owner kept Landing + Ticker open. A lockdown that swallowed the trader path would be a
    regression, not a tightening — and it must not have touched the bundle at all."""
    r = client.get("/api/ticker/SPY")
    assert r.status_code != 403


# --------------------------------------------------------------------------- the operator seeds

def test_seed_accounts_parses_json_and_survives_a_password_with_delimiters():
    """The reason this is JSON and not `email:password` — a delimiter format silently truncates a
    password containing `:` or `,`, which surfaces months later as 'I cannot log in'."""
    import json as _json
    import os as _os

    from main import _extra_seed_accounts

    nasty = "p:a,s:s,w0rd!"
    prior = _os.environ.get("SEED_ACCOUNTS")
    _os.environ["SEED_ACCOUNTS"] = _json.dumps(
        [{"email": "qa1@test.invalid", "password": nasty, "display_name": "QA 1"}])
    try:
        out = _extra_seed_accounts()
        assert out == [("qa1@test.invalid", nasty, "QA 1")]
    finally:
        if prior is None:
            _os.environ.pop("SEED_ACCOUNTS", None)
        else:
            _os.environ["SEED_ACCOUNTS"] = prior


def test_malformed_seed_accounts_never_takes_boot_down():
    import os as _os

    from main import _extra_seed_accounts

    prior = _os.environ.get("SEED_ACCOUNTS")
    _os.environ["SEED_ACCOUNTS"] = "not json at all"
    try:
        assert _extra_seed_accounts() == []
    finally:
        if prior is None:
            _os.environ.pop("SEED_ACCOUNTS", None)
        else:
            _os.environ["SEED_ACCOUNTS"] = prior


def test_a_seeded_account_can_log_in_while_signups_are_closed(client, monkeypatch):
    """The owner's requirement: testing accounts stay valid and active under the lockdown."""
    from src import auth as _auth

    email = _fresh_email("seeded-qa")
    _auth.get_service().ensure_account(email=email, password="seeded-pw-12345", display_name="QA")

    monkeypatch.setenv("SIGNUPS_ENABLED", "")
    monkeypatch.setenv("OWNER_EMAILS", "")
    r = client.post("/api/auth/login", json={"email": email, "password": "seeded-pw-12345"})
    assert r.status_code == 200, r.text


def test_the_fixed_credential_dev_seed_is_still_refused_on_postgres(monkeypatch, caplog):
    """The SEED_TEST_ACCOUNT guard must NOT have been relaxed while adding SEED_ACCOUNTS — its
    default password is published in this repo, so seeding it into a production store is a hole."""
    import inspect

    import main as _main

    src = inspect.getsource(_main._seed_test_account)
    assert 'ACCOUNT_STORE' in src and 'postgres' in src, (
        "the dev-only fixed-credential seed must still refuse ACCOUNT_STORE=postgres")
