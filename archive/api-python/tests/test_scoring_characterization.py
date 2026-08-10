"""
CHARACTERIZATION TESTS for the scoring path — the first automated tests this backend has.

WHAT PROBLEM THIS SOLVES. `[additive-keeps-score-byte-identical]` is the invariant every feature in
this repo has to preserve: an additive feature must leave `opportunity_score`, `opportunity_tier`,
the entry gate and `state_fingerprint` byte-identical. Until now that was proven AD HOC, PER FEATURE,
by whoever happened to be building — a live A/B against a second instance here, a git-worktree A/B at
the pre-change commit there. It held, but it held because of unusually good discipline rather than
because anything checked. These tests move that cost from "every feature, by hand" to "every push,
automatically".

WHY `signals.py` AND NOT THE WHOLE BUNDLE. `generate_signals` is a PURE function — no clock, no
randomness, no environment (verified: the module imports only `hashlib` and `logging`). `engine.py`
by contrast reads `datetime.now()` to window expirations, so a whole-bundle golden test would go red
every time an expiration rolled past, and a test that cries wolf gets deleted. So the pin is placed
exactly where the invariant lives and where determinism is free.

WHERE THE EXPECTATIONS CAME FROM. Real production bundles, captured from a live vendor-backed API by
`capture_fixtures.py`. They are not hand-written ideas of what the scorer should say; they are what it
DID say, on four real underlyings spanning both gamma regimes and scores 9 / 60 / 76 / 83. That is the
point of a characterization test: it detects CHANGE, and makes no claim that the recorded behaviour is
correct.

WHEN THESE SHOULD FAIL. Only on a deliberate score change — which
`[score-change-is-deliberate-and-measured]` permits, but requires to come with a stated rationale, a
recorded before/after on real tickers, and a fingerprint-basis version bump. Re-run
`capture_fixtures.py`; the diff of the committed JSON IS that recorded before/after. If these fail and
you did NOT mean to change the score, something additive has reached the scoring path and that is the
regression this exists to catch.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.core.signals import (
    ACTIONABLE_CONVICTIONS,
    FLIP_PROXIMITY_PCT,
    compute_opportunity_tier,
    evaluate_gate,
    generate_signals,
    state_fingerprint,
)

FIXTURES = sorted((Path(__file__).parent / "fixtures").glob("signals_*.json"))


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _ids(paths):
    return [p.stem.replace("signals_", "") for p in paths]


def test_fixtures_exist():
    """A guard against the whole suite silently passing on zero fixtures."""
    assert FIXTURES, (
        "No golden fixtures found. Run tests/capture_fixtures.py against a live API. "
        "Without them every test below would vacuously pass."
    )
    assert len(FIXTURES) >= 4, f"Expected the full captured spread, found {len(FIXTURES)}"


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_signals_are_byte_identical_to_the_recorded_bundle(path: Path):
    """
    THE CORE PIN. Same `market_state` in -> byte-identical signals out.

    Full-dict equality, deliberately, rather than asserting on `opportunity_score` alone: the score is
    a reduction over the setups and distances, so pinning only the number would let two compensating
    changes cancel out and slip through.
    """
    fx = _load(path)
    inputs = fx["inputs"]
    expected = dict(fx["expected_signals"])

    # main.py adds tier + prime eligibility AFTER generate_signals; they are not its output.
    for k in fx["serve_time_keys"]:
        expected.pop(k, None)

    actual = generate_signals(inputs["market_state"], inputs["off_exchange"])

    assert actual == expected, (
        f"{fx['ticker']}: signals changed vs the recorded bundle. If this was DELIBERATE, re-run "
        f"tests/capture_fixtures.py and commit the fixture diff as the required before/after."
    )


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_state_fingerprint_is_stable(path: Path):
    """
    The fingerprint is the dedupe key the AI-gating path keys off — a silent change to its BASIS
    (which fields feed it) would silently change when the app re-asks the model.
    """
    fx = _load(path)
    regenerated = generate_signals(fx["inputs"]["market_state"], fx["inputs"]["off_exchange"])
    assert state_fingerprint(regenerated) == fx["expected_state_fingerprint"], (
        f"{fx['ticker']}: state_fingerprint changed. A fingerprint-basis change requires a "
        f"deliberate version bump per [score-change-is-deliberate-and-measured]."
    )


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_scoring_is_deterministic_across_repeated_calls(path: Path):
    """
    Not redundant with the pin above: that one proves the output matches a RECORDING, this proves the
    function is stable within a single process. Dict/set iteration order and float accumulation order
    are the classic ways a 'pure' function stops being one — and this repo has already seen
    ~9th-significant-digit float-ordering jitter in the higher-order greeks.
    """
    fx = _load(path)
    state, oe = fx["inputs"]["market_state"], fx["inputs"]["off_exchange"]
    first = generate_signals(state, oe)
    for _ in range(3):
        assert generate_signals(state, oe) == first
        assert state_fingerprint(generate_signals(state, oe)) == state_fingerprint(first)


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_generate_signals_does_not_mutate_its_input(path: Path):
    """
    `market_state` is shared — the cached bundle, the snapshot cache and the live session all hand the
    same dict around. A scorer that mutated it in place would corrupt every later reader, and the
    damage would surface far from the cause.
    """
    fx = _load(path)
    state = fx["inputs"]["market_state"]
    before = json.dumps(state, sort_keys=True)
    generate_signals(state, fx["inputs"]["off_exchange"])
    assert json.dumps(state, sort_keys=True) == before, "generate_signals mutated market_state"


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_tier_derives_from_the_recorded_score(path: Path):
    """Tier is a pure function of the score and its bands — pin the DERIVATION, not just the number."""
    fx = _load(path)
    regenerated = generate_signals(fx["inputs"]["market_state"], fx["inputs"]["off_exchange"])
    score = regenerated["opportunity_score"]

    # Asserted against the score this fixture actually has rather than a hardcoded band, so the test
    # keeps its meaning if the recorded scores are ever deliberately re-baselined.
    tier = compute_opportunity_tier(score, True, watch=40, actionable=60, prime=75)
    if score >= 75:
        assert tier == "prime"
    elif score >= 60:
        assert tier == "actionable"
    elif score >= 40:
        assert tier == "watch"


@pytest.mark.parametrize("path", FIXTURES, ids=_ids(FIXTURES))
def test_gate_readiness_is_exactly_its_three_or_conditions(path: Path):
    """
    THE GATE IS AN **OR**, NOT A SCORE THRESHOLD — and this test exists in this shape because the
    first version of it asserted the opposite and was wrong. NVDA scores **9** and is still
    `ready: True`, because it carries a medium-conviction Pin-confluence setup. That is by design:
    the gate asks "is this worth escalating to the AI", not "is this a high score".

    So rather than a weaker assertion that merely passes, this pins the actual contract: `ready` is
    true **iff** at least one reason fired, and each of the three reason kinds appears **iff** its own
    condition holds. A change that silently dropped one of the three arms — say, stopped honouring
    setup conviction — would still satisfy "ready when score is high" but would fail here.
    """
    fx = _load(path)
    sig = generate_signals(fx["inputs"]["market_state"], fx["inputs"]["off_exchange"])
    threshold = 50
    gate = evaluate_gate(sig, score_threshold=threshold)

    assert gate["ready"] is bool(gate["reasons"]), "ready must be exactly 'at least one reason fired'"
    assert gate["score_threshold"] == threshold

    score_reasons = [r for r in gate["reasons"] if r.startswith("score>=")]
    assert bool(score_reasons) is (sig["opportunity_score"] >= threshold), (
        f"{fx['ticker']}: the score arm fired inconsistently with the score"
    )

    actionable = [s for s in sig.get("setups", []) if s.get("conviction") in ACTIONABLE_CONVICTIONS]
    setup_reasons = [r for r in gate["reasons"] if r.startswith("setup:")]
    assert len(setup_reasons) == len(actionable), (
        f"{fx['ticker']}: {len(actionable)} actionable setups but {len(setup_reasons)} setup reasons"
    )

    flip = (sig.get("distances") or {}).get("gamma_flip_pct")
    near = flip is not None and abs(flip) <= FLIP_PROXIMITY_PCT
    assert ("near gamma flip" in gate["reasons"]) is near


def test_gate_can_actually_say_no():
    """
    VACUITY GUARD, and a necessary one: all four captured fixtures are `ready: True`, so every
    assertion above runs only against the positive case. Without this, `evaluate_gate` could be
    replaced by `return {"ready": True, ...}` and the suite would stay green.

    Built by neutering a real fixture rather than inventing a signal dict from scratch, so the shape
    stays exactly what production produces.
    """
    fx = _load(FIXTURES[0])
    sig = generate_signals(fx["inputs"]["market_state"], fx["inputs"]["off_exchange"])

    quiet = dict(sig)
    quiet["opportunity_score"] = 0
    quiet["setups"] = [dict(s, conviction="low") for s in sig.get("setups", [])]
    quiet["distances"] = dict(sig.get("distances") or {}, gamma_flip_pct=99.0)

    gate = evaluate_gate(quiet, score_threshold=50)
    assert gate["ready"] is False, f"gate stayed ready with no reason to be: {gate['reasons']}"
    assert gate["reasons"] == []


def test_the_fixture_set_spans_more_than_one_code_path():
    """
    Coverage insurance for the pins above. Four fixtures that all scored the same on the same regime
    would look like coverage while exercising one path through the scorer.
    """
    loaded = [_load(p) for p in FIXTURES]
    scores = {fx["expected_signals"]["opportunity_score"] for fx in loaded}
    regimes = {fx["expected_signals"].get("regime") for fx in loaded}
    assert len(scores) >= 3, f"Fixtures are not varied enough — scores seen: {sorted(scores)}"
    assert len(regimes) >= 2, f"Fixtures cover only one regime: {regimes}"
