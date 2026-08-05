"""
broker-connect S-1 (system-6 security review, Critical) — the REAL `_SdkTransport`.

The gap this file closes: nothing in the suite ever constructed `_SdkTransport`
(`test_broker_adapter.py` injects a fake `transport_factory`; `:703` only calls `describe()`),
so a total TLS failure on Python >=3.12 shipped green. `ssl.wrap_socket` was removed in 3.12,
which aborts the vendored urllib3's three-names-on-one-line ssl import and leaves
`PROTOCOL_SSLv23`/`CERT_NONE` unbound and `HAS_SNI` False — a `NameError` on the first HTTPS
connect that `map_failure` classifies as `adapter_fault`, i.e. indistinguishable from a Webull
outage. The Dockerfile pins the removal version, so production had the identical gap.

NO NETWORK. The transport arms drive the SDK through a CONNECT tunnel on 127.0.0.1 that
answers the tunnel request and then hangs up during the TLS handshake, so the vendored stack
runs its complete pre-TLS + TLS path with every byte staying on loopback.

CI installs `requirements-dev.txt` only (no `webullsdkcore`), so the whole module skips there
while still running locally and in any image built from `requirements.txt`.
"""
from __future__ import annotations

import importlib
import importlib.util
import socket
import ssl
import sys
import threading

import pytest

from src.broker import webull_adapter as wa
from src.broker.ports import BrokerCredential

_SDK_MISSING = (importlib.util.find_spec("webullsdkcore") is None
                or importlib.util.find_spec("six") is None)

pytestmark = pytest.mark.skipif(
    _SDK_MISSING, reason="webull-python-sdk-core / six not installed (CI installs "
                         "requirements-dev.txt only) — the shim has nothing to shim")

_SSL_NAMES = ("PROTOCOL_SSLv23", "CERT_NONE", "HAS_SNI")


def _vendored_ssl():
    wa._shim_sdk_compat()
    return importlib.import_module(wa._VENDORED_SSL_MODULE)


# ------------------------------------------------------------------ the shim, directly

def test_shim_binds_every_name_the_vendored_urllib3_left_unbound():
    """Without the shim all three are missing/False and the two resolvers raise NameError."""
    vendored = _vendored_ssl()
    for name in _SSL_NAMES:
        assert hasattr(vendored, name), f"vendored ssl_.{name} is unbound after the shim"
    # HAS_SNI is the one a two-name fix silently misses: False here means SNI-less TLS to
    # api.webull.com (`ssl_wrap_socket` drops `server_hostname`), which is worse than the
    # NameError because it is intermittent.
    assert vendored.HAS_SNI is ssl.HAS_SNI is True
    assert vendored.resolve_ssl_version(None) is not None      # NameError before the fix
    assert vendored.resolve_cert_reqs(None) is not None        # NameError before the fix


def test_shim_does_not_install_a_global_insecure_wrap_socket():
    """Review I-3: the capture tool's `ssl.wrap_socket` restoration defaults to
    `cert_reqs=CERT_NONE` + `check_hostname=False`. Binding names on the vendored module must
    never become a process-wide insecure-by-default primitive."""
    _vendored_ssl()
    if sys.version_info >= (3, 12):
        assert not hasattr(ssl, "wrap_socket"), (
            "the shim reinstalled a global ssl.wrap_socket — insecure by default (I-3)")


def test_the_capture_tooling_consumes_the_PRODUCT_shim_not_a_copy():
    """The defect class, not just the defect. Two copies of this shim is exactly how a
    proven-against-real-Webull capture path and a broken shipped path coexisted (S-1). Pin
    that the tools import the product's implementation, and that no second copy exists."""
    import capture_broker_fixtures as capture
    import probe_webull_instrument as probe

    assert capture._shim_sdk_compat is wa._shim_sdk_compat
    assert probe._shim_sdk_compat is wa._shim_sdk_compat
    for module in (capture, probe):
        source = __import__("pathlib").Path(module.__file__).read_text(encoding="utf-8")
        assert "def _shim_sdk_compat" not in source, f"{module.__name__} re-declares the shim"
        assert "def _shim_ssl_wrap_socket" not in source, (
            f"{module.__name__} carries a second ssl shim — the S-1 divergence is back")


def test_the_shim_is_idempotent():
    vendored = _vendored_ssl()
    before = {name: getattr(vendored, name) for name in _SSL_NAMES}
    wa._shim_vendored_ssl()
    wa._shim_vendored_ssl()
    assert {name: getattr(vendored, name) for name in _SSL_NAMES} == before


# ------------------------------------------------------------------ the real transport

class _ConnectTunnel:
    """A loopback CONNECT proxy: completes the tunnel, then hangs up mid-handshake."""

    def __init__(self) -> None:
        self._server = socket.socket()
        self._server.bind(("127.0.0.1", 0))
        self._server.listen(8)
        self.port = self._server.getsockname()[1]
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self) -> None:
        while True:
            try:
                conn, _ = self._server.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(conn,), daemon=True).start()

    @staticmethod
    def _handle(conn: socket.socket) -> None:
        try:
            conn.settimeout(5)
            buf = b""
            while b"\r\n\r\n" not in buf:
                chunk = conn.recv(4096)
                if not chunk:
                    return
                buf += chunk
            conn.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
            conn.recv(4096)              # the TLS ClientHello
        except OSError:
            pass
        finally:
            conn.close()

    def close(self) -> None:
        self._server.close()


@pytest.fixture()
def loopback_egress(monkeypatch):
    """Pin ALL SDK egress to a loopback tunnel. Nothing leaves the machine."""
    tunnel = _ConnectTunnel()
    for var in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        monkeypatch.setenv(var, f"http://127.0.0.1:{tunnel.port}")
    for var in ("NO_PROXY", "no_proxy"):
        monkeypatch.setenv(var, "")
    try:
        yield tunnel
    finally:
        tunnel.close()


def _fetch_through(loopback_egress) -> str:
    book = wa.WebullProvider().fetch_book(BrokerCredential("dummy-key", "dummy-secret"))
    assert book.state == "unknown"
    return book.reason


def test_real_transport_fails_as_a_NETWORK_failure_not_an_adapter_fault(loopback_egress):
    """AC-20's honesty arm through the SHIPPED transport: a TLS/transport failure must land
    on `broker_unreachable`. `adapter_fault` here is the S-1 signature."""
    assert _fetch_through(loopback_egress) == "broker_unreachable"


def test_without_the_shim_the_same_call_is_the_S1_adapter_fault(loopback_egress, monkeypatch):
    """The other half of the proof: this is what shipped. Restoring the pre-fix vendored state
    turns the identical call into `adapter_fault`, so the test above genuinely discriminates
    rather than passing for an unrelated reason."""
    vendored = _vendored_ssl()
    saved = {name: getattr(vendored, name) for name in _SSL_NAMES if hasattr(vendored, name)}
    try:
        for name in ("PROTOCOL_SSLv23", "CERT_NONE"):
            if hasattr(vendored, name):
                delattr(vendored, name)
        vendored.HAS_SNI = False
        monkeypatch.setattr(wa, "_shim_vendored_ssl", lambda: None)
        assert _fetch_through(loopback_egress) == "adapter_fault"
    finally:
        for name, value in saved.items():
            setattr(vendored, name, value)
    assert vendored.resolve_ssl_version(None) is not None      # restored for the next test


# ---------------------------------------------------------------------------------------------
# THE SDK RETURN-CONTRACT TRAP (live-caught 2026-08-05, owner's first real connect).
#
# `ApiClient.get_response()` returns the vendored-requests **Response OBJECT**, not the parsed
# body (`client.py`: `status, headers, body, exception, response = ...; return response`).
# `_SdkTransport` handed that object straight to `_extract_account_id`/`_page_entries`, which
# both fall through their `isinstance(dict|list)` guards and answer "nothing here" — so a
# perfectly healthy account with two subscriptions and 14 positions surfaced as
# `adapter_fault` + "no account id in subscriptions payload".
#
# This is the SECOND instance of this exact trap (capture_broker_fixtures had it, fixed in
# 3416ef3) and the second time — after S-1 — that a product/tool pair diverged silently. It
# survived every existing test because they all inject a fake transport returning plain dicts,
# which is precisely the boundary that hides the real contract. These tests exercise the
# contract itself: a Response-shaped object in, parsed data out.
# ---------------------------------------------------------------------------------------------
import json as _json

from src.broker.webull_adapter import _SdkTransport, _extract_account_id


class _ResponseLike:
    """Mimics vendored-requests' Response: has .json()/.content, and NO .get()/.__iter__."""

    def __init__(self, payload):
        self._payload = payload
        self.content = _json.dumps(payload).encode("utf-8")

    def json(self):
        return self._payload


# The real captured subscriptions shape: a BARE LIST of entries carrying account_id.
_REAL_SUBS = [
    {"subscription_id": "s1", "user_id": "u1", "account_id": "ACC123", "account_number": "N1"},
    {"subscription_id": "s2", "user_id": "u1", "account_id": "ACC456", "account_number": "N2"},
]


def test_parsed_unwraps_a_response_object_into_real_data():
    out = _SdkTransport._parsed(_ResponseLike(_REAL_SUBS))
    assert isinstance(out, list), "a Response object must never reach the mappers"
    assert out == _REAL_SUBS


def test_account_id_is_found_through_the_transport_contract():
    """The end-to-end shape of the live failure: object in → account id out."""
    parsed = _SdkTransport._parsed(_ResponseLike(_REAL_SUBS))
    assert _extract_account_id(parsed) == "ACC123"


def test_a_raw_response_object_would_have_yielded_no_account_id():
    """Pins WHY this was invisible: the pre-fix value is silently account-less."""
    assert _extract_account_id(_ResponseLike(_REAL_SUBS)) is None


def test_parsed_passes_already_parsed_payloads_through_untouched():
    """Fake transports in the other tests hand back plain dicts/lists — must stay valid."""
    assert _SdkTransport._parsed(_REAL_SUBS) == _REAL_SUBS
    assert _SdkTransport._parsed({"holdings": []}) == {"holdings": []}
    assert _SdkTransport._parsed(None) is None


def test_parsed_falls_back_to_content_when_json_raises():
    class _NoJson:
        content = _json.dumps({"holdings": [{"instrument_id": "1"}]}).encode("utf-8")

        def json(self):
            raise ValueError("not json")

    assert _SdkTransport._parsed(_NoJson()) == {"holdings": [{"instrument_id": "1"}]}


def test_parsed_returns_none_on_an_unparseable_body_rather_than_raising():
    class _Junk:
        content = b"<html>gateway</html>"

        def json(self):
            raise ValueError("nope")

    assert _SdkTransport._parsed(_Junk()) is None
