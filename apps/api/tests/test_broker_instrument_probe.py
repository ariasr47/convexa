"""
broker-connect R7 — unit tests for the instrument-detail lookup PROBE.

The probe run itself is owner-present (real Webull credentials exist only in the owner's
shell) and hits the live API. NOTHING here touches the network. What CI can and must pin is
everything around that one live call:

- the credential protocol (refuses to run without BOTH env vars; never echoes either),
- the failure CLASSIFIER — the three buckets lead to three DIFFERENT product conclusions
  (`endpoint_absent` = Webull has no such read; `not_permitted_for_this_key` = it exists but
  our key can't see it; `bad_params` = we spelled it wrong and should retry once). Collapsing
  them would silently turn "ask for entitlement" into "close Q1 forever",
- the call-budget / no-retry-on-429 safety rules, which run against the owner's real rate
  limits and cannot be rehearsed live,
- the sanitizer boundary: response VALUES never reach a committed fixture, only key sets,
- subject selection from the committed fixture (so the probe takes no account-identifying
  input from the owner).
"""
from __future__ import annotations

import json

import pytest

import probe_webull_instrument as probe
from capture_broker_fixtures import REDACTED

FAKE_KEY = "e2ab9f0c81d34e0f9d7a"
FAKE_SECRET = "f00dfeedbeefcafe1234"

P1, P2, P3 = probe.CANDIDATE_PATHS


# --------------------------------------------------------------- credential protocol

def test_refuses_to_run_without_either_credential_and_exits_2(monkeypatch, capsys):
    monkeypatch.delenv("WEBULL_APP_KEY", raising=False)
    monkeypatch.delenv("WEBULL_APP_SECRET", raising=False)

    assert probe.main([]) == 2

    out = capsys.readouterr().out
    assert "WEBULL_APP_KEY" in out and "WEBULL_APP_SECRET" in out


@pytest.mark.parametrize("present,absent", [
    ("WEBULL_APP_KEY", "WEBULL_APP_SECRET"),
    ("WEBULL_APP_SECRET", "WEBULL_APP_KEY"),
])
def test_refuses_when_only_one_credential_is_present(monkeypatch, present, absent):
    monkeypatch.setenv(present, FAKE_KEY)
    monkeypatch.delenv(absent, raising=False)
    assert probe.main([]) == 2


def test_the_printed_owner_command_carries_placeholders_never_values():
    assert "<app key>" in probe.OWNER_RUN_COMMAND
    assert "<app secret>" in probe.OWNER_RUN_COMMAND
    assert "probe_webull_instrument.py" in probe.OWNER_RUN_COMMAND


def test_scrub_secrets_removes_every_occurrence_from_text():
    text = f'{{"note": "key={FAKE_KEY}", "sig": "{FAKE_SECRET}", "ok": "AAPL"}}'
    scrubbed = probe.scrub_secrets(text, (FAKE_KEY, FAKE_SECRET))
    assert FAKE_KEY not in scrubbed and FAKE_SECRET not in scrubbed
    assert "AAPL" in scrubbed


# --------------------------------------------------------------- failure classifier

@pytest.mark.parametrize("status,code,expected", [
    (404, None, probe.ENDPOINT_ABSENT),
    (404, "NOT_FOUND", probe.ENDPOINT_ABSENT),
    (403, None, probe.NOT_PERMITTED),
    (400, None, probe.BAD_PARAMS),
    (422, None, probe.BAD_PARAMS),
    (200, "PERMISSION_DENIED", probe.NOT_PERMITTED),
    (401, "UNAUTHORIZED", probe.NOT_PERMITTED),
    (200, "INVALID_PARAMETER", probe.BAD_PARAMS),
    (429, None, probe.OTHER),
    (500, None, probe.OTHER),
    (None, None, probe.OTHER),
])
def test_classify_failure_maps_status_to_its_bucket(status, code, expected):
    assert probe.classify_failure(status, code) == expected


def test_the_three_buckets_are_distinct_and_never_collapse():
    buckets = {
        probe.classify_failure(404, None),
        probe.classify_failure(403, None),
        probe.classify_failure(400, None),
    }
    assert len(buckets) == 3, "the three failure classes lead to three different conclusions"
    assert probe.OTHER not in buckets


@pytest.mark.parametrize("status", [200, 201, 204, 299])
def test_success_statuses_are_not_failures(status):
    assert probe.is_success(status) is True


@pytest.mark.parametrize("status", [None, 199, 300, 400, 404, 429, 500])
def test_non_2xx_is_never_a_success(status):
    assert probe.is_success(status) is False


# --------------------------------------------------------------- key sets, never values

def test_response_key_set_records_keys_never_values():
    payload = {"instrument_id": "1058096497", "strike_price": "180.00",
               "option_type": "CALL", "expire_date": "2026-09-18"}
    keys = probe.response_key_set(payload)
    assert keys == ["expire_date", "instrument_id", "option_type", "strike_price"]
    flat = json.dumps(keys)
    for value in payload.values():
        assert value not in flat


def test_response_key_set_of_a_list_names_the_array_and_its_element_keys():
    keys = probe.response_key_set([{"symbol": "NVDA", "strike_price": "180.00"}])
    assert keys[0] == "<array>"
    assert "strike_price" in keys and "symbol" in keys
    assert "NVDA" not in json.dumps(keys)


def test_response_key_set_of_a_scalar_is_empty():
    assert probe.response_key_set("nope") == []
    assert probe.response_key_set(None) == []


# --------------------------------------------------------------- attempt records

def test_build_attempt_scrubs_secrets_and_keeps_the_error_code():
    payload = {"error_code": "PERMISSION_DENIED",
               "msg": f"key {FAKE_KEY} not entitled",
               "request_id": "fb225192-5146-40f1-9904-e1fc739451cc"}

    record = probe.build_attempt(P1, "instrument_id", 403, payload, None,
                                 secrets=(FAKE_KEY, FAKE_SECRET))

    text = json.dumps(record)
    assert FAKE_KEY not in text and FAKE_SECRET not in text
    assert record["error_code"] == "PERMISSION_DENIED"
    assert record["classification"] == probe.NOT_PERMITTED
    assert record["http_status"] == 403
    assert record["path"] == P1 and record["param"] == "instrument_id"


def test_build_attempt_records_only_the_key_set_of_a_successful_response():
    payload = {"instrument_id": "1058096497", "strike_price": "180.00", "option_type": "CALL"}
    record = probe.build_attempt(P1, "instrument_id", 200, payload, None)
    assert record["classification"] == probe.RESOLVED
    assert record["response_keys"] == ["instrument_id", "option_type", "strike_price"]
    assert "180.00" not in json.dumps(record)


def test_build_attempt_redacts_an_account_identifying_request_id():
    payload = {"error_code": "NOT_FOUND", "request_id": "fb225192-5146-40f1"}
    record = probe.build_attempt(P1, "instrument_id", 404, payload, None)
    assert "fb225192-5146-40f1" not in json.dumps(record)


def test_build_attempt_falls_back_to_the_exception_for_status_and_code():
    class _Exc(Exception):
        error_code = "UNAUTHORIZED"
        error_msg = ""
        http_status = 401
        request_id = "abc-123"

    record = probe.build_attempt(P1, "instrument_id", None, None, _Exc())
    assert record["http_status"] == 401
    assert record["error_code"] == "UNAUTHORIZED"
    assert record["classification"] == probe.NOT_PERMITTED
    assert record["exception"]["exception_type"] == "_Exc"
    assert record["exception"]["request_id"] == REDACTED


# --------------------------------------------------------------- subject selection

def test_subject_is_an_option_id_read_from_the_committed_fixture():
    instrument_id = probe.select_instrument_id()
    assert instrument_id == "1058096497"

    entries = json.loads(probe.POSITIONS_FIXTURE.read_text(encoding="utf-8"))
    holdings = [e for page in entries["pages"] for e in page["holdings"]]
    match = [e for e in holdings if e["instrument_id"] == instrument_id]
    assert match and match[0]["instrument_type"] == "OPTION"


def test_subject_selection_skips_stock_entries(tmp_path):
    fixture = tmp_path / "positions_raw.json"
    fixture.write_text(json.dumps({"pages": [{"holdings": [
        {"instrument_id": "1", "instrument_type": "STOCK"},
        {"instrument_id": "2", "instrument_type": "STOCK"},
        {"instrument_id": "3", "instrument_type": "OPTION"},
    ]}]}), encoding="utf-8")
    assert probe.select_instrument_id(fixture) == "3"


def test_subject_selection_hard_fails_when_the_fixture_holds_no_option(tmp_path):
    fixture = tmp_path / "positions_raw.json"
    fixture.write_text(json.dumps({"pages": [{"holdings": [
        {"instrument_id": "1", "instrument_type": "STOCK"}]}]}), encoding="utf-8")
    with pytest.raises(SystemExit) as excinfo:
        probe.select_instrument_id(fixture)
    assert "capture_broker_fixtures" in str(excinfo.value)


def test_subject_selection_hard_fails_when_the_fixture_is_missing(tmp_path):
    with pytest.raises(SystemExit) as excinfo:
        probe.select_instrument_id(tmp_path / "absent.json")
    assert "capture_broker_fixtures" in str(excinfo.value)


# --------------------------------------------------------------- the probe loop

class _ScriptedClient:
    """Returns the SDK's exact 5-tuple; the 'request' is the (path, param) pair."""

    def __init__(self, script, default=(404, {"error_code": "NOT_FOUND"})):
        self.script = script
        self.default = default
        self.calls = []

    def _implementation_of_do_action(self, request):  # noqa: D401 — mirrors the SDK name
        self.calls.append(request)
        status, body = self.script.get(request, self.default)
        content = json.dumps(body).encode("utf-8") if body is not None else b""
        return status, {}, content, None, None


def _factory(path, param, instrument_id):
    return (path, param)


def _run(client, sleeps=None):
    return probe.run_probe(client, "1058096497", request_factory=_factory,
                           sleep=(sleeps.append if sleeps is not None else (lambda _s: None)))


def test_probe_stops_on_the_first_2xx_and_reports_outcome_a():
    client = _ScriptedClient({(P1, "instrument_id"): (200, {"strike_price": "180.00"})})
    result = _run(client)
    assert client.calls == [(P1, "instrument_id")]
    assert result["outcome"] == "A"
    assert result["resolved"]["path"] == P1


def test_probe_tries_every_candidate_path_then_stops_when_all_are_404():
    client = _ScriptedClient({})
    result = _run(client)
    assert client.calls == [(P1, "instrument_id"), (P2, "instrument_id"), (P3, "instrument_id")]
    assert result["outcome"] == "B"
    assert {a["classification"] for a in result["attempts"]} == {probe.ENDPOINT_ABSENT}


def test_probe_retries_the_first_non_404_path_snake_case_spelling_first():
    client = _ScriptedClient({(P2, "instrument_id"): (400, {"error_code": "INVALID_PARAMETER"})})
    result = _run(client)
    assert client.calls == [
        (P1, "instrument_id"), (P2, "instrument_id"), (P3, "instrument_id"),
        (P2, "instrument_ids"), (P2, "instrumentId"),
    ]
    assert result["outcome"] == "B"


def test_a_retry_that_resolves_flips_the_outcome_to_a():
    client = _ScriptedClient({
        (P1, "instrument_id"): (400, {"error_code": "INVALID_PARAMETER"}),
        (P1, "instrument_ids"): (200, {"option_type": "CALL"}),
    })
    result = _run(client)
    assert client.calls[-1] == (P1, "instrument_ids")
    assert result["outcome"] == "A"
    assert result["resolved"]["param"] == "instrument_ids"


def test_a_429_is_never_retried():
    client = _ScriptedClient({(P1, "instrument_id"): (429, {"error_code": "RATE_LIMIT"})})
    result = _run(client)
    assert client.calls == [(P1, "instrument_id"), (P2, "instrument_id"), (P3, "instrument_id")]
    assert all(param == "instrument_id" for _path, param in client.calls)
    assert result["attempts"][0]["classification"] == probe.OTHER


def test_a_transport_failure_is_not_worth_a_spelling_retry():
    client = _ScriptedClient({(P1, "instrument_id"): (None, None)})
    result = _run(client)
    assert client.calls == [(P1, "instrument_id"), (P2, "instrument_id"), (P3, "instrument_id")]


def test_the_call_budget_hard_stops_the_probe(monkeypatch):
    monkeypatch.setattr(probe, "MAX_CALLS", 2)
    client = _ScriptedClient({})
    result = _run(client)
    assert len(client.calls) == 2
    assert result["calls"] == 2


def test_the_budget_is_eight_calls_zero_point_six_seconds_apart():
    assert probe.MAX_CALLS == 8
    assert probe.SLEEP_SECONDS == 0.6


def test_the_probe_sleeps_between_calls_but_not_before_the_first():
    sleeps = []
    _run(_ScriptedClient({}), sleeps=sleeps)
    assert sleeps == [0.6, 0.6]


def test_the_probe_never_touches_the_positions_endpoint():
    """Its captured semantics are pinned; no speculative param may be added to it."""
    assert "/account/positions" not in probe.CANDIDATE_PATHS
    client = _ScriptedClient({})
    _run(client)
    assert all("positions" not in path for path, _param in client.calls)


def test_raw_payload_values_go_only_to_the_sink_for_the_gitignored_scratch():
    sink = []
    client = _ScriptedClient({(P1, "instrument_id"): (200, {"strike_price": "180.00"})})
    probe.run_probe(client, "1058096497", request_factory=_factory,
                    sleep=lambda _s: None, raw_sink=sink)
    assert sink and sink[0]["payload"] == {"strike_price": "180.00"}


# --------------------------------------------------------------- findings section

def _ctx(outcome, attempts=None):
    return probe.findings_context(
        instrument_id="1058096497",
        region="us",
        result={"outcome": outcome,
                "attempts": attempts or [
                    {"path": P1, "param": "instrument_id", "http_status": 404,
                     "error_code": "NOT_FOUND", "response_keys": ["error_code"],
                     "classification": probe.ENDPOINT_ABSENT}],
                "resolved": ({"path": P1, "param": "instrument_id", "http_status": 200,
                              "response_keys": ["option_type", "strike_price"]}
                             if outcome == "A" else None),
                "calls": 1},
    )


@pytest.mark.parametrize("outcome", ["A", "B"])
def test_findings_section_carries_exactly_one_conclusion_line(outcome):
    section = probe.findings_section(_ctx(outcome))
    assert section.count("CONCLUSION:") == 1
    conclusion = [ln for ln in section.splitlines() if "CONCLUSION:" in ln][0]
    assert f"OUTCOME {outcome}" in conclusion


def test_findings_section_records_the_desk_research_verbatim():
    section = probe.findings_section(_ctx("B"))
    for bullet in probe.DESK_RESEARCH:
        assert bullet in section


def test_findings_section_tabulates_every_attempt():
    attempts = [
        {"path": P1, "param": "instrument_id", "http_status": 404, "error_code": "NOT_FOUND",
         "response_keys": ["error_code"], "classification": probe.ENDPOINT_ABSENT},
        {"path": P2, "param": "instrument_id", "http_status": 403, "error_code": "NO_PERMISSION",
         "response_keys": ["error_code"], "classification": probe.NOT_PERMITTED},
    ]
    section = probe.findings_section(_ctx("B", attempts))
    assert section.count("| 1 |") == 1 and section.count("| 2 |") == 1
    assert probe.ENDPOINT_ABSENT in section and probe.NOT_PERMITTED in section
    assert P1 in section and P2 in section


def test_findings_section_heading_is_the_one_the_plan_names():
    assert "(i) — Instrument-detail lookup probe (R7)" in probe.findings_section(_ctx("B"))


def test_desk_research_keeps_the_grpcio_locked_trade_package_excluded():
    """`webull-python-sdk-trade` staying uninstalled is a `no-real-order-path` asset."""
    text = "\n".join(probe.DESK_RESEARCH)
    assert "webull-python-sdk-trade" in text
    assert "NOT installed" in text


# ---------------------------------------------------------------------------------------------
# ECHO_ONLY — the fifth outcome, proved by the FIRST LIVE RUN (2026-08-05).
#
# `GET /trade/instrument?instrument_id=1058096497` answered **HTTP 200** with the payload
# `{"instrument_id": "1058096497"}` — a bare echo of the id we sent, carrying no strike, expiry,
# right or multiplier. The original classifier keyed resolution off HTTP status alone, so it
# (a) reported OUTCOME A — "Webull DOES resolve contract detail" — which was false and would have
# scheduled an enrichment feature that cannot work, and (b) stopped the sweep on that 2xx, so the
# remaining candidate paths and parameter spellings were never tried.
#
# These tests pin both halves of the correction. They are the regression net for a bug that a
# green suite could not see, because nothing offline had ever produced a contentless 200.
# ---------------------------------------------------------------------------------------------

REAL_ECHO_PAYLOAD = {"instrument_id": "1058096497"}


def test_the_real_live_echo_is_not_a_resolution():
    """The exact payload the live run returned must classify as ECHO_ONLY, never RESOLVED."""
    record = probe.build_attempt(P1, "instrument_id", 200, REAL_ECHO_PAYLOAD, None)
    assert record["classification"] == probe.ECHO_ONLY
    assert record["classification"] != probe.RESOLVED


@pytest.mark.parametrize("payload", [
    {"strike_price": "180.00"},
    {"expire_date": "2026-09-18"},
    {"option_type": "CALL"},
    {"contract_multiplier": 100},
    {"underlying_symbol": "NVDA"},
    {"data": {"instrument": {"strikePrice": 180}}},      # nested envelope still counts
    [{"underlying_symbol": "NVDA"}],                      # list envelope still counts
])
def test_payloads_that_carry_real_contract_detail_resolve(payload):
    assert probe.carries_contract_detail(payload) is True


@pytest.mark.parametrize("payload", [
    REAL_ECHO_PAYLOAD, {}, None, {"instrument_id": "1", "region": "us"}, [], [{"id": 1}],
])
def test_payloads_without_contract_detail_do_not_resolve(payload):
    assert probe.carries_contract_detail(payload) is False


def test_an_echo_does_not_stop_the_sweep():
    """The original bug: a contentless 200 short-circuited every remaining candidate."""
    client = _ScriptedClient({(P1, "instrument_id"): (200, REAL_ECHO_PAYLOAD)})
    result = _run(client)

    tried = [c[0] for c in client.calls]
    assert P1 in tried, "the echoing path must still be attempted"
    assert len(client.calls) > 1, "an echo must NOT end the sweep — remaining candidates are owed"
    assert result["resolved"] is None
    assert result["outcome"] == "B"
    assert any(a["classification"] == probe.ECHO_ONLY for a in result["attempts"])


def test_echo_path_gets_the_spelling_retries_because_it_demonstrably_exists():
    """A 200-but-empty route is the best lead available; spend the retry budget on IT."""
    client = _ScriptedClient({(P1, "instrument_id"): (200, REAL_ECHO_PAYLOAD)})
    _run(client)
    retried_params = [c[1] for c in client.calls if c[0] == P1]
    for spelling in probe.RETRY_PARAMS:
        assert spelling in retried_params, f"{spelling} should have been tried against {P1}"


def test_a_late_real_resolution_after_an_echo_is_still_found():
    """Sweeping past the echo must actually be able to succeed, or continuing is pointless."""
    client = _ScriptedClient({
        (P1, "instrument_id"): (200, REAL_ECHO_PAYLOAD),
        (P1, "instrument_ids"): (200, {"strike_price": "180.00", "option_type": "CALL"}),
    })
    result = _run(client)
    assert result["outcome"] == "A"
    assert result["resolved"]["param"] == "instrument_ids"


def test_echo_conclusion_does_not_overclaim_that_the_api_has_no_detail():
    """An unexplained live 200 route means the strong 'Webull exposes nothing' claim is unearned."""
    client = _ScriptedClient({(P1, "instrument_id"): (200, REAL_ECHO_PAYLOAD)})
    result = _run(client)
    counts = {}
    for a in result["attempts"]:
        counts[a["classification"]] = counts.get(a["classification"], 0) + 1
    line = probe._conclusion_line({**result, "counts": counts})

    assert "OUTCOME B (echo sub-case)" in line
    # The strong claim ("Webull's API exposes no contract detail") may APPEAR only inside the
    # sentence FORBIDDING it — so assert the prohibition, not the mere absence of the phrase.
    assert "must NOT" in line and "not earned" in line
    assert "endpoint_absent" not in line.split("NOT the same dead end")[0].split("CONCLUSION:")[1][:120], \
        "the echo sub-case must not be summarized as an absent endpoint"
    assert "entitlement" in line or "parameter" in line
    # And it must say plainly that the route is alive — that is the whole distinction.
    assert "EXISTS" in line or "is live" in line
