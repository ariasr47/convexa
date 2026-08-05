"""
Webull positions adapter — `PositionsProvider` #1 (broker-connect B4).

Maps the Webull Individual OpenAPI read payloads into OUR leg-first records (`ports.py`).
The mapping is deliberately organized as small per-fact extractors, which is what made
reconciling against the REAL captured payloads a contained diff.

**RECONCILED against the owner's real capture (2026-08-03, R1).** Every field name, type
token and shape below is now a CONFIRMED capture fact pinned by the characterization tests
over `tests/fixtures/broker/*` — no provisional guesses remain. The corrections reality
forced: `qty` (not `quantity`) · `"STOCK"` (not `"EQUITY"`) · `instrument_id` and no `id` key
at all · all numerics are strings · option rows carry the SAME 13 generic keys as stock rows,
with no contract detail whatsoever (see `_map_option_entry`).

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

# The instrument_type vocabulary, CONFIRMED by capture: Webull says STOCK, not EQUITY. Read
# in exactly two places (the guard and the branch) via these constants so they cannot drift —
# a silent drift here maps an entire real book to `unrecognized`.
_EQUITY_TYPE = "STOCK"
_OPTION_TYPE = "OPTION"

# CONFIRMED by capture (CAPTURE_FINDINGS §a): the payload is FLAT — the grouping-identity
# candidate list came back EMPTY across all 14 real positions, so AC-6b's flat arm is a
# settled fact, not a fallback. One single-leg position per contract, NEVER composed by
# heuristic. If a future capture ever DOES show a grouping identity, set this to that key and
# extend `map_positions` to emit one multi-leg position per group (the AC-6b grouped arm).
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

# CONFIRMED by capture: the corrupted-secret probe returned http_status 401 + error_code
# `UNAUTHORIZED` with an EMPTY error_msg (CAPTURE_FINDINGS §c) — covered by both the status
# check and the `UNAUTHORIZED` hint below. The wider hint list stays: it costs nothing and
# covers the neighbouring codes Webull may return for an unapproved or expired key.
# Rate limiting was never observed (Webull returned no 429 and NO rate-limit headers at all,
# §d) — the hints below are OUR mapping logic, pinned by a synthetic test.
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
    """(parseable, value). Webull emits EVERY numeric as a string — confirmed by capture
    across all 14 real positions (`qty`, `unit_cost`, `total_cost`, `last_price`,
    `market_value`, both `unrealized_*` fields, `holding_proportion`)."""
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


# ------------------------------------------------------- multiplier reconstruction (R2b)
# OWNER RULING 2026-08-03 (RECONCILIATION_PLAN §4): reconstruct the contract multiplier from
# Webull's OWN cost aggregate — with all four guards binding. The reconstruction is not a
# guess about options in general; it reproduces a broker-SUPPLIED number (`total_cost`), so
# a multiplier-dependent figure is a restatement of Webull's own arithmetic rather than a
# Convexa derivation. `positions-legs` learned the hard way never to hardcode x100, and the
# guards are what distinguish this from that mistake — the whole basis of the ruling. They
# are not decoration; do not relax them without going back to the owner.
#
# ONE flippable constant. Set it False and every option row falls to the withhold path
# (multiplier omitted, `not provided` rendered) with no other behaviour change.
_RECONSTRUCT_MULTIPLIER_FROM_COST = True

_MULTIPLIER_RATIO_TOLERANCE = 0.01    # guard 2: |ratio - mult| <= 1% of the rounded mult
_MULTIPLIER_ROUNDTRIP_ABS = 0.01      # guard 3: round-trip floor, in currency units
_MULTIPLIER_ROUNDTRIP_REL = 0.005     # guard 3: round-trip tolerance vs |total_cost|
_MULTIPLIER_MIN_UNIT_COST = 0.05      # guard 4: below 5c a 2-decimal unit_cost can distort
                                      #          the ratio by >10% (the deep-OTM landmine)


def _derive_multiplier(entry: dict, qty: float) -> Optional[float]:
    """
    Reproduce the contract multiplier from `total_cost / (unit_cost * qty)`, or return None.

    None is a first-class answer: the caller withholds every multiplier-dependent output
    rather than emitting a plausible-looking 1 or 100. Four guards, all binding:
      1. `mult >= 1`            — a sub-unit scale is never a contract multiplier.
      2. ratio tolerance        — the ratio must sit within 1% of the whole number it rounds to.
      3. round-trip             — `unit_cost * mult * qty` must reproduce the broker's own
                                  `total_cost` within max(0.01, 0.5% of it). This is the
                                  binding guard in practice: it is roughly twice as tight as
                                  guard 2, which stands as belt-and-braces.
      4. precision floor        — reject `abs(unit_cost) < 0.05`, where 2-decimal rounding
                                  alone can move the ratio more than the tolerances allow.
    """
    if not _RECONSTRUCT_MULTIPLIER_FROM_COST:
        return None
    unit_ok, unit_cost = _parse_number(entry.get("unit_cost"))
    total_ok, total_cost = _parse_number(entry.get("total_cost"))
    if not unit_ok or not total_ok or unit_cost is None or total_cost is None:
        return None
    if qty == 0:
        return None
    if abs(unit_cost) < _MULTIPLIER_MIN_UNIT_COST:          # guard 4 (covers unit_cost == 0)
        return None

    ratio = total_cost / (unit_cost * qty)                  # signs cancel on a short
    mult = float(round(ratio))
    if mult < 1:                                            # guard 1
        return None
    if abs(ratio - mult) > _MULTIPLIER_RATIO_TOLERANCE * mult:      # guard 2
        return None
    tolerance = max(_MULTIPLIER_ROUNDTRIP_ABS,
                    _MULTIPLIER_ROUNDTRIP_REL * abs(total_cost))
    if abs(unit_cost * mult * qty - total_cost) > tolerance:        # guard 3
        return None
    return mult


# ------------------------------------------------------------------------ fidelity notes
# FIXED strings — never interpolated with payload content (a hygiene test enforces it). Each
# names an omission so the FE can render "we don't know" instead of "there is nothing".
_NOTE_NO_CONTRACT_DETAIL = (
    "Webull's positions feed carries no strike, expiry, or call/put for a held option — "
    "Convexa will not guess them")
_NOTE_MISSING_FACT = {
    "strike": "strike not supplied by the broker — Convexa will not guess it",
    "expiry": "expiry not supplied by the broker — Convexa will not guess it",
    "right": "call/put not supplied by the broker — Convexa will not guess it",
}
_NOTE_MULTIPLIER_WITHHELD = ("contract multiplier not supplied and not reproducible from "
                             "Webull's own cost aggregate")
_NOTE_MULTIPLIER_RECONSTRUCTED = ("contract multiplier not supplied — reproduced exactly "
                                  "from Webull's own total_cost")


# ----------------------------------------------------------------------------- entry mapping
# The real payload's 13 keys, CONFIRMED by capture, identical on STOCK and OPTION rows:
#   instrument_id · instrument_type · symbol · short_name · qty · unit_cost · currency ·
#   total_cost · last_price · market_value · unrealized_profit_loss ·
#   unrealized_profit_loss_rate · holding_proportion
# Each is read in exactly one place here, so a future vendor rename stays a one-line diff
# pinned by the fixture tests.

def _map_entry(entry: dict, index: int) -> BrokerPosition:
    pid = str(entry.get("instrument_id") or f"webull-{index}")
    unrealized = _fact(entry, "unrealized_profit_loss")
    itype = str(entry.get("instrument_type") or "").strip().upper()

    # `qty` — signed as the payload carries it (a short is already negative; no sign
    # synthesis anywhere in this module).
    qty_ok, qty = _parse_number(entry.get("qty"))
    if itype not in (_EQUITY_TYPE, _OPTION_TYPE):
        return _unrecognized(
            pid, [f"instrument_type {itype or '(missing)'} is not representable in the "
                  f"leg-first book model"], unrealized)
    if not qty_ok or qty is None:
        return _unrecognized(pid, ["quantity missing or unparseable"], unrealized)

    symbol = str(entry.get("symbol") or "").strip()

    if itype == _EQUITY_TYPE:
        if not symbol:
            return _unrecognized(pid, ["equity entry without a symbol"], unrealized)
        leg = BrokerLeg(kind="equity", symbol=symbol, underlying=symbol,
                        quantity=qty,                    # SIGNED as the payload carries it
                        multiplier=1.0,                  # a share's scale is 1 BY DEFINITION
                        cost_basis=_fact(entry, "unit_cost"),
                        broker_mark=_fact(entry, "last_price"))
        return BrokerPosition(pid, "exact", [], [leg], unrealized)

    return _map_option_entry(entry, pid, qty, symbol, unrealized)


def _map_option_entry(entry: dict, pid: str, qty: float, symbol: str,
                      unrealized: BrokerFact) -> BrokerPosition:
    """
    ONE `BrokerLeg` per option row, honest about what the feed did and did not carry
    (INTERFACE §4 as amended by Amendment 1, 2026-08-03).

    The real Webull feed carries NO contract detail for a held option — no strike, expiry,
    call/put, multiplier or underlying symbol; `symbol` is the bare underlying ticker, not an
    OCC code. So: the ticker rides VERBATIM (an OCC code is never synthesized and the
    underlying is never derived from a symbol prefix), the facts Webull DID supply — signed
    quantity, per-contract cost basis and mark — ride as themselves, and every fact it did
    not supply is OMITTED and NAMED in `fidelity_notes`.

    The rejected alternative — `unrecognized` + `legs: []` for every option — is legal under
    the unamended contract but reports less than we honestly know, on 9 of 14 real positions.

    Contract facts are read conditionally rather than assumed absent: the presence rule is
    "iff the broker supplies it", so a feed that one day DOES carry them maps to a full,
    `exact` leg with no notes and no code change.
    """
    if not symbol:
        return _unrecognized(pid, ["option entry without a symbol"], unrealized)

    right_raw = str(entry.get("option_type") or "").strip().lower()
    right = right_raw if right_raw in ("call", "put") else None
    strike_ok, strike = _parse_number(entry.get("strike_price"))
    strike = strike if strike_ok else None
    expiry = str(entry.get("expire_date") or "").strip() or None

    notes: list[str] = []
    missing = [name for name, value in (("strike", strike), ("expiry", expiry),
                                        ("right", right)) if value is None]
    if len(missing) == 3:
        notes.append(_NOTE_NO_CONTRACT_DETAIL)          # the real Webull case, named once
    else:
        notes.extend(_NOTE_MISSING_FACT[name] for name in missing)

    mult_ok, supplied_mult = _parse_number(entry.get("contract_multiplier"))
    multiplier = supplied_mult if mult_ok else None
    if multiplier is None:
        # Broker-supplied FIRST; reconstruction only as a fallback; withhold if neither.
        multiplier = _derive_multiplier(entry, qty)
        notes.append(_NOTE_MULTIPLIER_RECONSTRUCTED if multiplier is not None
                     else _NOTE_MULTIPLIER_WITHHELD)

    leg = BrokerLeg(kind="option", symbol=symbol, underlying=symbol,
                    quantity=qty,                       # SIGNED as the payload carries it
                    multiplier=multiplier,              # None ⇒ omitted, never defaulted
                    cost_basis=_fact(entry, "unit_cost"),
                    broker_mark=_fact(entry, "last_price"),
                    expiry=expiry, strike=strike, right=right)
    return BrokerPosition(pid, "partial" if notes else "exact", notes, [leg], unrealized)


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
            out.append(_unrecognized(str(entry.get("instrument_id") or f"webull-{i}"),
                                     ["entry could not be mapped"],
                                     BrokerFact("not_supplied")))
    return out


def _extract_account_id(subscriptions_payload: Any) -> Optional[str]:
    """/app/subscriptions/list → the first entry's `account_id`. CONFIRMED correct by capture
    (§b). FLAGGED, not a bug: the owner's response carried TWO subscription entries and this
    takes the first — an unpinned choice on a single data point. If multi-account selection
    ever matters it becomes a real product decision, not a silent index."""
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

_VENDORED_SSL_MODULE = "webullsdkcore.vendored.requests.packages.urllib3.util.ssl_"


def _shim_vendored_ssl() -> None:
    """
    Restore the ssl names Python >=3.12 leaves UNBOUND inside the SDK's vendored urllib3.
    THE single implementation of this shim (S-1, system-6 security review): the runtime
    adapter AND the capture/probe tools both call it, so it can never diverge again.

    `vendored/requests/packages/urllib3/util/ssl_.py:59-62` is:

        try:                       # Test for SSL features
            import ssl
            from ssl import wrap_socket, CERT_NONE, PROTOCOL_SSLv23
            from ssl import HAS_SNI                      # Has SNI?
        except ImportError:
            pass

    `ssl.wrap_socket` was REMOVED in 3.12, so the third line aborts the whole `try` inside a
    bare `except ImportError: pass`. The damage is silent and lands two lines wide:
      * `PROTOCOL_SSLv23` and `CERT_NONE` are left unbound as module globals, so
        `resolve_ssl_version(None)` / `resolve_cert_reqs(None)` raise `NameError` on the FIRST
        HTTPS connect (`connection.py:342-346`, reached because requests 2.18.3 never supplies
        an `ssl_context`). The NameError escapes far from here and `map_failure` classifies it
        as `adapter_fault` — indistinguishable from a Webull outage.
      * `HAS_SNI` never executes either, so it keeps its module default of False and
        `ssl_wrap_socket` calls `context.wrap_socket(sock)` with NO `server_hostname`. A
        name-binding fix that restores only the first two names produces SNI-less TLS to
        `api.webull.com` — a *worse* failure than the NameError because it is intermittent.

    We bind the names on the VENDORED module and nowhere else. We deliberately do NOT restore
    a module-level `ssl.wrap_socket` (the review's I-3): the only reader of that name is the
    Python-2 fallback `SSLContext` class in the same file, which is dead here (the real
    `ssl.SSLContext` imports fine on its own line), and any such shim is an insecure-by-default
    primitive (`cert_reqs=CERT_NONE`, `check_hostname=False`) installed process-wide.

    Idempotent, and a no-op when the SDK is not installed.
    """
    import ssl as _ssl
    try:
        from webullsdkcore.vendored.requests.packages.urllib3.util import ssl_ as vendored
    except Exception:              # SDK absent (CI) or vendored layout changed — nothing to do
        return
    if not hasattr(vendored, "PROTOCOL_SSLv23"):
        # PROTOCOL_TLS_CLIENT is the modern spelling of what the vendored code wanted; the
        # context is then explicitly configured by `create_urllib3_context` either way.
        vendored.PROTOCOL_SSLv23 = getattr(_ssl, "PROTOCOL_TLS_CLIENT",
                                           getattr(_ssl, "PROTOCOL_SSLv23", None))
    if not hasattr(vendored, "CERT_NONE"):
        vendored.CERT_NONE = _ssl.CERT_NONE
    if not getattr(vendored, "HAS_SNI", False):
        vendored.HAS_SNI = _ssl.HAS_SNI



def _shim_sdk_compat() -> None:
    """
    webull-python-sdk-core 0.1.18 vendors an ancient requests/six pair that breaks on modern
    Python (`cgi` removed in 3.13; vendored `six.moves` relies on the `find_module` protocol
    removed in 3.12). Alias the REAL `six` into both vendored paths before SDK imports run;
    `legacy-cgi` (requirements.txt, py>=3.13) restores `cgi`. Recorded in CAPTURE_FINDINGS
    for the system-6 dependency review.

    Then `_shim_vendored_ssl()` (S-1) — MUST run after the six aliasing, because importing
    the vendored ssl_ module pulls the vendored `six` in. Every SDK entry point in this
    module funnels through here, so no SDK code can run before the shim is in place.
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
    _shim_vendored_ssl()


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
                last_id = (str(tail.get("instrument_id"))
                           if isinstance(tail, dict) and tail.get("instrument_id") else None)
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
            # CONFIRMED by capture question (e): every real position carried
            # `unrealized_profit_loss`. It is carried VERBATIM (INTERFACE §4) even though
            # Webull's own option figure is arithmetically wrong by ~100x — correcting a
            # broker-stated fact and still labelling it the broker's would be a fabrication.
            supplies_unrealized_pl=True)
