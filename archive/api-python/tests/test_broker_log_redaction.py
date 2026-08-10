"""
broker-connect H-1 (system-6 security review, High) — the SDK's own logger leaks the raw
Webull account number at ERROR level.

`webullsdkcore/client.py:284-286` interpolates the requests exception on any transport
IOError, and that exception string embeds the FULL request URL — including
`?account_id=<the owner's real brokerage account number>` (`request.py:266-275`; the account
id has to ride the query string, it is Webull's API shape). Under the app's real logging
config (`main.py:61-62` configures only the "Convexa" logger; root stays WARNING) an ERROR
record IS emitted, so a single Webull timeout or DNS blip writes the owner's brokerage
account number to stderr, which the platform captures and retains. That defeats `account_ref`
one layer below it and breaks SPEC §8.1 ("no secret, signature material, account number, or
position detail in logs at any default level").

We never patch site-packages. The vendor logger is routed through OUR sanitizing handler and
stops propagating, so no record it produces reaches any other handler with the number intact.

No SDK import here — the leak is a logging-plumbing property, so these run on CI too.
"""
from __future__ import annotations

import io
import logging

import pytest

from src.broker import webull_adapter as wa

# The real record shape, copied from the review's executed proof.
_SDK_MESSAGE = (
    "HttpError occurred. Host:%s SDK-Version:%s ClientException:%s")
_ACCOUNT_NUMBER = "1234567890REALACCT"
_EXC_TEXT = (
    "SDK.HttpError HTTPSConnectionPool(host='api.webull.com', port=443): Max retries "
    f"exceeded with url: /account/positions?account_id={_ACCOUNT_NUMBER}&page_size=100 "
    "(Caused by ConnectTimeoutError(...))")


@pytest.fixture()
def vendor_log() -> io.StringIO:
    """Install the real redaction wiring and capture what its handler actually emits."""
    wa._install_sdk_log_redaction()
    vendor_logger = logging.getLogger(wa._SDK_LOGGER_NAME)
    handler = next(h for h in vendor_logger.handlers
                   if any(isinstance(f, wa._SdkLogRedactor) for f in h.filters))
    buffer = io.StringIO()
    previous = handler.setStream(buffer)
    try:
        yield buffer
    finally:
        handler.setStream(previous)


def _emit_the_real_sdk_error() -> None:
    """Exactly what `webullsdkcore/client.py:284-286` does, on the same child logger."""
    logging.getLogger("webullsdkcore.client").error(
        _SDK_MESSAGE, "api.webull.com", "0.1.18", _EXC_TEXT)


def test_the_account_number_never_reaches_the_emitted_log_line(vendor_log):
    _emit_the_real_sdk_error()
    emitted = vendor_log.getvalue()
    assert emitted, "the vendor ERROR record was dropped entirely — cause is unobservable"
    assert _ACCOUNT_NUMBER not in emitted            # the leak, before the fix
    assert "account_id=REDACTED" in emitted


def test_the_cause_survives_redaction(vendor_log):
    """Redaction must not cost the diagnostic: host, SDK version, the error class and the
    path all stay. Only the account-identifying VALUE goes."""
    _emit_the_real_sdk_error()
    emitted = vendor_log.getvalue()
    for kept in ("api.webull.com", "0.1.18", "SDK.HttpError", "/account/positions",
                 "ConnectTimeoutError", "page_size=100"):
        assert kept in emitted, f"redaction destroyed the diagnostic: {kept!r} is gone"


def test_nothing_from_the_sdk_logger_propagates_unredacted():
    """The filter lives on a HANDLER (so it covers child loggers, which a logger filter would
    not), and propagation is off so root/`logging.lastResort` never sees the raw record."""
    wa._install_sdk_log_redaction()
    vendor_logger = logging.getLogger(wa._SDK_LOGGER_NAME)
    assert vendor_logger.propagate is False
    assert any(any(isinstance(f, wa._SdkLogRedactor) for f in h.filters)
               for h in vendor_logger.handlers)


def test_a_child_logger_record_is_redacted_not_just_the_parent(vendor_log):
    """`webullsdkcore.client` is where the leak lives; a `Logger.addFilter` on the parent
    would NOT have caught it (logger filters only run on the originating logger)."""
    logging.getLogger("webullsdkcore.client.deeper").error(
        "positions failed url=/account/positions?account_id=%s", _ACCOUNT_NUMBER)
    assert _ACCOUNT_NUMBER not in vendor_log.getvalue()


def test_an_exception_traceback_cannot_carry_the_url_out(vendor_log):
    try:
        raise RuntimeError(_EXC_TEXT)
    except RuntimeError:
        logging.getLogger("webullsdkcore.client").error("HttpError occurred.", exc_info=True)
    assert _ACCOUNT_NUMBER not in vendor_log.getvalue()


@pytest.mark.parametrize("raw, expected", [
    ("?account_id=ACC123&page_size=100", "?account_id=REDACTED&page_size=100"),
    ("account_number=99887766 trailing", "account_number=REDACTED trailing"),
    ("sec_account_id=ABC'", "sec_account_id=REDACTED'"),
    ("subscription_id=S1,user_id=U2", "subscription_id=REDACTED,user_id=REDACTED"),
    ("app_key=WBK-LIVE-0001&signature=deadbeef",
     "app_key=REDACTED&signature=REDACTED"),
    ("nothing sensitive here", "nothing sensitive here"),
])
def test_redactor_scrubs_every_account_identifying_query_value(raw, expected):
    assert wa.redact_sensitive(raw) == expected


def test_install_is_idempotent():
    wa._install_sdk_log_redaction()
    before = list(logging.getLogger(wa._SDK_LOGGER_NAME).handlers)
    wa._install_sdk_log_redaction()
    wa._install_sdk_log_redaction()
    assert logging.getLogger(wa._SDK_LOGGER_NAME).handlers == before


# ---------------------------------------------------------------------------------------------
# M-3 — the SDK's own debug dump must be DISARMED, not merely un-set.
#
# `webullsdkcore/http/response.py` reads WEBULL_API_DEBUG per request and, when it is "sdk",
# prints the SIGNED request (App Key + Signature headers) and full response bodies — through a
# logger it configures at IMPORT TIME with propagate=False and its own StreamHandler. Those
# records therefore bypass H-1's sanitizing handler entirely, and no app-side logging config can
# silence them. Without this defense, "SDK log egress is closed" is true only at the default
# level — which is the most dangerous kind of security claim: correct until someone sets a var.
# ---------------------------------------------------------------------------------------------
import logging as _logging
import os as _os

import pytest as _pytest

_adapter = _pytest.importorskip("src.broker.webull_adapter", reason="SDK-adjacent shim")


def test_debug_env_var_is_cleared_so_the_credential_dump_branch_is_dead(monkeypatch):
    monkeypatch.setenv("WEBULL_API_DEBUG", "sdk")
    _adapter._shim_sdk_compat()
    assert _os.environ.get("WEBULL_API_DEBUG") is None, (
        "the SDK's dump branch keys off this var; leaving it set leaks App Key + Signature"
    )


def test_debug_env_var_is_cleared_case_insensitively(monkeypatch):
    # The SDK lowercases before comparing, so any casing arms it.
    monkeypatch.setenv("WEBULL_API_DEBUG", "SDK")
    _adapter._shim_sdk_compat()
    assert _os.environ.get("WEBULL_API_DEBUG") is None


def test_vendor_logger_is_detached_from_its_own_stderr_handler():
    """Belt and braces: even if something re-sets the var later, records must route through
    OUR redactor rather than straight to stderr."""
    _adapter._shim_sdk_compat()
    vendor_log = _logging.getLogger("webullsdkcore.http.response")
    assert vendor_log.handlers == [], "vendor's own StreamHandler bypasses H-1's redaction"
    assert vendor_log.propagate is True, "propagate=False would strand records off our handler"


def test_disarm_is_idempotent_and_safe_to_call_repeatedly():
    for _ in range(3):
        _adapter._shim_sdk_compat()
    assert _os.environ.get("WEBULL_API_DEBUG") is None
    assert _logging.getLogger("webullsdkcore.http.response").handlers == []
