"""
broker-connect B1 — unit tests for the capture tool's SANITIZATION on a synthetic payload.

The capture run itself is owner-present (real credentials exist only in the owner's shell).
What CI can and must pin is the sanitizer: no account-identifying value, no key/secret
fragment, survives into anything the tool would check in — while every structural key, enum
value and numeric shape stays intact.
"""
from __future__ import annotations

import json

from capture_broker_fixtures import (
    ACCOUNT_IDENTIFYING_KEYS,
    REDACTED,
    sanitize_payload,
)

FAKE_KEY = "e2ab9f0c81d34e0f9d7a"
FAKE_SECRET = "f00dfeedbeefcafe1234"

SYNTHETIC = {
    "subscriptions": [
        {"subscription_id": "70873060", "account_id": "ZH1234567", "user_id": "u-9",
         "account_type": "CASH", "status": "ACTIVE"}
    ],
    "positions": {
        "has_next": False,
        "holdings": [
            {
                "id": 1001,
                "account_id": "ZH1234567",
                "instrument_id": "913256135",
                "instrument_type": "EQUITY",
                "symbol": "AAPL",
                "currency": "USD",
                "quantity": "100",
                "unit_cost": "142.7500",
                "unrealized_profit_loss": "735.00",
            },
            {
                "id": 1002,
                "account_id": "ZH1234567",
                "instrument_type": "OPTION",
                "symbol": "SPY260918C00500000",
                "option_type": "CALL",
                "strike_price": "500.00",
                "quantity": "-2",
                "note": f"debug echo: key={FAKE_KEY} sig={FAKE_SECRET}",
            },
        ],
    },
    "error": {"error_code": "INVALID_SIGNATURE", "message": f"bad signature for {FAKE_KEY}"},
}


def _sanitized():
    return sanitize_payload(SYNTHETIC, (FAKE_KEY, FAKE_SECRET))


def test_no_secret_fragment_survives_anywhere():
    text = json.dumps(_sanitized())
    assert FAKE_KEY not in text
    assert FAKE_SECRET not in text


def test_account_identifying_values_are_redacted_under_their_keys():
    clean = _sanitized()
    assert clean["subscriptions"][0]["account_id"] == REDACTED
    assert clean["subscriptions"][0]["subscription_id"] == REDACTED
    assert clean["subscriptions"][0]["user_id"] == REDACTED
    assert clean["positions"]["holdings"][0]["account_id"] == REDACTED
    # The raw account number appears nowhere, under any key.
    assert "ZH1234567" not in json.dumps(clean)


def test_structural_keys_enums_and_numeric_shapes_survive():
    clean = _sanitized()
    eq = clean["positions"]["holdings"][0]
    opt = clean["positions"]["holdings"][1]
    # Keys intact (the fixture still pins the payload structure).
    assert set(eq) == set(SYNTHETIC["positions"]["holdings"][0])
    # Enum values + numeric shapes intact.
    assert eq["instrument_type"] == "EQUITY"
    assert eq["quantity"] == "100"
    assert eq["unit_cost"] == "142.7500"
    assert eq["unrealized_profit_loss"] == "735.00"
    assert opt["option_type"] == "CALL"
    assert opt["strike_price"] == "500.00"
    assert opt["quantity"] == "-2"
    assert clean["positions"]["has_next"] is False
    # Non-identifying ids (instrument, symbol) are NOT redacted.
    assert eq["instrument_id"] == "913256135"
    assert eq["symbol"] == "AAPL"


def test_error_shape_keeps_code_but_loses_secret_text():
    clean = _sanitized()
    assert clean["error"]["error_code"] == "INVALID_SIGNATURE"
    assert FAKE_KEY not in clean["error"]["message"]
    assert REDACTED in clean["error"]["message"]


def test_key_matching_is_case_and_separator_insensitive():
    clean = sanitize_payload({"AccountId": "A1", "ACCOUNT_NUMBER": "B2", "accountNo": "C3"})
    assert clean == {"AccountId": REDACTED, "ACCOUNT_NUMBER": REDACTED, "accountNo": REDACTED}


def test_redaction_key_list_is_the_binding_rule():
    # The redaction contract: these families are covered. A future edit that drops one fails here.
    for needed in ("accountid", "accountnumber", "subscriptionid", "userid",
                   "appkey", "appsecret", "signature", "token"):
        assert needed in ACCOUNT_IDENTIFYING_KEYS
