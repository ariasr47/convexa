"""
Webull positions adapter — `PositionsProvider` #1 (broker-connect B4).

Maps the Webull Individual OpenAPI read payloads into OUR leg-first records (`ports.py`).
The mapping is deliberately organized as small per-fact extractors so reconciling against the
REAL captured payloads (task B1, owner-present) is a contained diff: every assumption that is
not yet capture-confirmed is marked `PROVISIONAL(capture)` below and is pinned by the
characterization tests over `tests/fixtures/broker/*` (which prefer the captured fixtures the
moment they exist).

SDK surface (CAPTURE_FINDINGS §f): `webull-python-sdk-core` ONLY. The read requests are
defined inline over `webullsdkcore.request.ApiRequest` (mirroring webull-python-sdk-trade's
one-line wrappers verbatim) because installing the trade package would (a) put order/place
modules on disk and (b) drag `webull-python-sdk-trade-events-core` → `grpcio==1.51.1`, which
cannot build on Python ≥3.12. **No order/trade/place module exists in this environment at
all** — the strongest form of `[no-real-order-path]`'s import-scope arm (pinned by B6's scan).

ALL SDK imports stay inside this module (lazy, at transport construction), so the module —
and everything else in the leaf — imports cleanly with no SDK installed; a missing SDK at
fetch time maps to `adapter_fault` like any other adapter-side trouble. Errors NEVER raise
payload/exception text upward: they map onto the closed failure-cause enum.

`account_ref` (INTERFACE §2 / AC-23): HMAC-SHA256 over the broker account identifier, keyed
by the server session secret, hex-truncated to 16 — a non-reversible server-derived handle.
The raw account number never leaves this module.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets as _secrets
import sys
from typing import Any, Callable, Optional

from .ports import (BrokerBook, BrokerCredential, BrokerFact, BrokerLeg, BrokerPosition,
                    PositionsProvider, ProviderCapabilities)

logger = logging.getLogger("Convexa")

_MAX_PAGES = 50          # hard cap; owner-scale book is one page
_PAGE_SIZE = 100

# PROVISIONAL(capture): the flat-payload assumption. If the B1 capture shows a grouping
# identity for multi-leg option positions, set this to that key and extend `map_positions`
# to emit one multi-leg position per group (the AC-6b grouped arm). Until then the payload is
# treated as FLAT: one single-leg position per contract, NEVER composed by heuristic.
_GROUPING_IDENTITY_KEY: Optional[str] = None


# ----------------------------------------------------------------------------- account_ref

def _ref_secret() -> str:
    """The keyed-hash secret for account_ref. Reuses the server session secret (env; read
    directly — the leaf never imports auth). Absent ⇒ ephemeral per-process key, consistent
    with the in-memory store's lifetime."""
    key = os.getenv("AUTH_SESSION_SIGNING_KEY")
    if key:
        return key
    global _EPHEMERAL_REF_SECRET
    try:
        return _EPHEMERAL_REF_SECRET
    except NameError:
        _EPHEMERAL_REF_SECRET = _secrets.token_urlsafe(32)
        return _EPHEMERAL_REF_SECRET


def account_ref_for(account_identifier: str) -> str:
    """Non-reversible opaque handle: HMAC-SHA256(server secret, id), hex-truncated to 16."""
    return hmac.new(_ref_secret().encode("utf-8"), account_identifier.encode("utf-8"),
                    hashlib.sha256).hexdigest()[:16]


# ----------------------------------------------------------------------------- failure map

# PROVISIONAL(capture): code hints pending the B1 corrupted-secret probe; the fixtures
# (error_bad_credential / rate_limit_headers) are the truth these are reconciled against.
_CREDENTIAL_REJECTED_CODE_HINTS = (
    "INVALID_SIGNATURE", "INVALID_ACCESS", "INVALID_TOKEN", "INVALID_KEY", "EXPIRED",
    "UNAUTHORIZED", "ACCESS_DENIED", "FORBIDDEN", "AUTH_FAIL", "PERMISSION")
_RATE_LIMIT_CODE_HINTS = ("RATE", "THROTTLE", "TOO_MANY", "FREQUEN", "QUOTA")


def map_failure(exc: BaseException) -> str:
    """
    Map any adapter-side exception onto the closed failure-cause set. Duck-typed over the
    SDK exception surface (ServerException carries error_code/error_msg/http_status/
    request_id; ClientException carries error_code/error_msg only — transport-level).
    Never raises; never returns free prose.
    """
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return "broker_unreachable"
    status = getattr(exc, "http_status", None)
    try:
        status = int(status) if status is not None else None
    except (TypeError, ValueError):
        status = None
    code = str(getattr(exc, "error_code", "") or "").upper()
    if status == 429 or any(h in code for h in _RATE_LIMIT_CODE_HINTS):
        return "rate_limited"
    if status in (401, 403) or any(h in code for h in _CREDENTIAL_REJECTED_CODE_HINTS):
        return "credential_rejected"
    if status is not None and status >= 500:
        return "broker_unreachable"      # vendor-side outage, not our fault class
    if code and status is None:
        return "broker_unreachable"      # ClientException: failed before/at transport
    return "adapter_fault"


# ----------------------------------------------------------------------------- fact parsing

def _parse_number(value: Any) -> tuple[bool, Optional[float]]:
    """(parseable, value). Webull emits numerics as strings — PROVISIONAL(capture) detail."""
    if isinstance(value, bool):
        return False, None
    if isinstance(value, (int, float)):
        return True, float(value)
    if isinstance(value, str):
        try:
            return True, float(value.strip())
        except ValueError:
            return False, None
    return False, None


def _fact(entry: dict, key: str) -> BrokerFact:
    """Tri-state: absent/None ⇒ not_supplied · malformed ⇒ unparseable · else supplied."""
    if key not in entry or entry.get(key) is None:
        return BrokerFact("not_supplied")
    ok, value = _parse_number(entry.get(key))
    return BrokerFact("supplied", value) if ok else BrokerFact("unparseable")


def _unrecognized(pid: str, notes: list[str], unrealized: BrokerFact) -> BrokerPosition:
    return BrokerPosition(broker_position_id=pid, fidelity="unrecognized",
                          fidelity_notes=notes, legs=[], unrealized_pl=unrealized)


# ----------------------------------------------------------------------------- entry mapping
# PROVISIONAL(capture): field names below (`instrument_type`, `quantity`, `unit_cost`,
# `last_price`, `unrealized_profit_loss`, `option_type`, `strike_price`, `expire_date`,
# `contract_multiplier`, `underlying_symbol`) mirror the provisional fixtures derived from
# Webull's documented shapes. Each is read in exactly one place here, so a captured rename is
# a one-line diff pinned by the fixture tests.

def _map_entry(entry: dict, index: int) -> BrokerPosition:
    pid = str(entry.get("id") or entry.get("instrument_id") or f"webull-{index}")
    unrealized = _fact(entry, "unrealized_profit_loss")
    itype = str(entry.get("instrument_type") or "").strip().upper()

    qty_ok, qty = _parse_number(entry.get("quantity"))
    if itype not in ("EQUITY", "OPTION"):
        return _unrecognized(
            pid, [f"instrument_type {itype or '(missing)'} is not representable in the "
                  f"leg-first book model"], unrealized)
    if not qty_ok or qty is None:
        return _unrecognized(pid, ["quantity missing or unparseable"], unrealized)

    symbol = str(entry.get("symbol") or "").strip()
    notes: list[str] = []
    fidelity = "exact"

    if itype == "EQUITY":
        if not symbol:
            return _unrecognized(pid, ["equity entry without a symbol"], unrealized)
        leg = BrokerLeg(kind="equity", symbol=symbol, underlying=symbol,
                        quantity=qty,                    # SIGNED as the payload carries it
                        multiplier=1.0,                  # explicit shares-multiplier
                        cost_basis=_fact(entry, "unit_cost"),
                        broker_mark=_fact(entry, "last_price"))
        return BrokerPosition(pid, fidelity, notes, [leg], unrealized)

    # ---- option
    right_raw = str(entry.get("option_type") or "").strip().lower()
    right = right_raw if right_raw in ("call", "put") else None
    strike_ok, strike = _parse_number(entry.get("strike_price"))
    expiry = str(entry.get("expire_date") or "").strip() or None
    mult_ok, mult = _parse_number(entry.get("contract_multiplier"))
    if right is None or not strike_ok or expiry is None:
        return _unrecognized(
            pid, ["option entry missing right/strike/expiry — not representable"], unrealized)
    if not mult_ok or mult is None:
        # NEVER a plausible-looking x100 guess — an explicit multiplier or no leg at all.
        return _unrecognized(
            pid, ["option entry missing an explicit contract multiplier — Convexa does not "
                  "assume x100"], unrealized)
    underlying = str(entry.get("underlying_symbol") or "").strip()
    if not underlying:
        # Derive from the OCC-style symbol prefix; honest about the derivation.
        underlying = "".join(ch for ch in symbol if ch.isalpha())[:6] or symbol
        fidelity = "partial"
        notes.append("underlying not supplied — derived from the contract symbol")
    leg = BrokerLeg(kind="option", symbol=symbol or pid, underlying=underlying,
                    quantity=qty, multiplier=mult,
                    cost_basis=_fact(entry, "unit_cost"),
                    broker_mark=_fact(entry, "last_price"),
                    expiry=expiry, strike=strike, right=right)
    return BrokerPosition(pid, fidelity, notes, [leg], unrealized)


def map_positions(entries: list) -> list[BrokerPosition]:
    """
    Map every raw entry — the count NEVER understates the broker's book (AC-6a): a mapping
    exception on one entry contains to THAT entry (an `unrecognized` marker), never drops it,
    never touches its neighbours. Flat payload ⇒ one single-leg position per contract; no
    heuristic composition, ever (AC-6b; see _GROUPING_IDENTITY_KEY).
    """
    out: list[BrokerPosition] = []
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            out.append(_unrecognized(f"webull-{i}", ["entry was not an object"],
                                     BrokerFact("not_supplied")))
            continue
        try:
            out.append(_map_entry(entry, i))
        except Exception:
            # Contained: the entry surfaces as unrecognized; no payload content in the note.
            out.append(_unrecognized(str(entry.get("id") or f"webull-{i}"),
                                     ["entry could not be mapped"],
                                     BrokerFact("not_supplied")))
    return out


def _extract_account_id(subscriptions_payload: Any) -> Optional[str]:
    """PROVISIONAL(capture): /app/subscriptions/list → the first entry's account_id."""
    entries = subscriptions_payload
    if isinstance(subscriptions_payload, dict):
        entries = subscriptions_payload.get("data") or subscriptions_payload.get("items") or []
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if isinstance(entry, dict):
            for key in ("account_id", "accountId", "sec_account_id", "secAccountId"):
                if entry.get(key):
                    return str(entry[key])
    return None


def _page_entries(page: Any) -> list:
    if isinstance(page, dict):
        return list(page.get("holdings") or page.get("positions") or [])
    if isinstance(page, list):
        return list(page)
    return []


# ----------------------------------------------------------------------------- SDK transport

def _shim_sdk_compat() -> None:
    """
    webull-python-sdk-core 0.1.18 vendors an ancient requests/six pair that breaks on modern
    Python (`cgi` removed in 3.13; vendored `six.moves` relies on the `find_module` protocol
    removed in 3.12). Alias the REAL `six` into both vendored paths before SDK imports run;
    `legacy-cgi` (requirements.txt, py>=3.13) restores `cgi`. Recorded in CAPTURE_FINDINGS
    for the system-6 dependency review.
    """
    import six  # noqa: F401
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


class _SdkTransport:
    """
    The real HTTP transport: webullsdkcore's signed client + the three READ requests defined
    inline (paths/verbs mirror webull-python-sdk-trade==0.1.18 verbatim — see module
    docstring for why that package is not installed). Holds the credential only for the
    lifetime of one fetch_book call.
    """

    def __init__(self, credential: BrokerCredential):
        _shim_sdk_compat()
        from webullsdkcore.client import ApiClient  # lazy: SDK touched only on a real fetch
        region = os.getenv("WEBULL_REGION", "us")
        self._client = ApiClient(credential.app_key, credential.app_secret, region_id=region)

    @staticmethod
    def _request(path: str, params: dict):
        from webullsdkcore.request import ApiRequest
        req = ApiRequest(path, version="v1", method="GET", query_params={})
        for k, v in params.items():
            req.add_query_param(k, v)
        return req

    def subscriptions(self):
        return self._client.get_response(self._request("/app/subscriptions/list", {}))

    def positions_page(self, account_id: str, last_instrument_id: Optional[str] = None):
        params = {"account_id": account_id, "page_size": _PAGE_SIZE}
        if last_instrument_id is not None:
            params["last_instrument_id"] = last_instrument_id
        return self._client.get_response(self._request("/account/positions", params))


# ----------------------------------------------------------------------------- the provider

class WebullProvider(PositionsProvider):
    def __init__(self, transport_factory: Optional[
            Callable[[BrokerCredential], Any]] = None):
        self._transport_factory = transport_factory or _SdkTransport

    def fetch_book(self, credential: BrokerCredential,
                   account_ref: Optional[str] = None) -> BrokerBook:
        try:
            transport = self._transport_factory(credential)
            account_id = _extract_account_id(transport.subscriptions())
            if not account_id:
                logger.warning("broker/webull: no account id in subscriptions payload")
                return BrokerBook(state="unknown", reason="adapter_fault")
            ref = account_ref_for(account_id)

            entries: list = []
            last_id: Optional[str] = None
            for _ in range(_MAX_PAGES):
                page = transport.positions_page(account_id, last_id)
                page_entries = _page_entries(page)
                entries.extend(page_entries)
                if not (isinstance(page, dict) and page.get("has_next")):
                    break
                tail = page_entries[-1] if page_entries else None
                last_id = (str(tail.get("instrument_id") or tail.get("id"))
                           if isinstance(tail, dict) else None)
                if last_id is None:
                    break

            positions = map_positions(entries)
            state = "ok" if positions else "empty"
            return BrokerBook(state=state, positions=positions, account_ref=ref)
        except Exception as exc:
            cause = map_failure(exc)
            # Cause name only — never exception text, payload content, or key material.
            logger.warning("broker/webull: fetch failed (%s)", cause)
            return BrokerBook(state="unknown", reason=cause)

    def describe(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_id="webull", refresh_basis="on_demand_snapshot",
            supplies_cost_basis=True, supplies_broker_mark=True,
            supplies_unrealized_pl=True)  # PROVISIONAL(capture): confirmed by question (e)
