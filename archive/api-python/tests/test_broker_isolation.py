"""
broker-connect B6 — structural isolation proofs (the outcome-ledger one-way-leaf pattern).

Source-scan tests, not prose:
(a) SDK import scope — only `src/broker/webull_adapter.py` may import the Webull SDK, and
    its SDK imports stay inside the read subset (deny-list: trade/order/place/grpc/events/
    mdata module paths). Stronger still: the trade/order packages are not even installed
    (requirements.txt pins webull-python-sdk-core ONLY) — asserted here too.
(b) The broker leaf and the scoring path never import each other, in EITHER direction; the
    leaf also never imports auth (the credential arrives as a value object from main.py).
(c) `src/broker/ports.py` imports stdlib only.

The scoring byte-identity arm (AC-17) is carried by `test_scoring_characterization.py` in
this same suite (golden fixtures over generate_signals/state_fingerprint/the gate) — these
scans prove the structural reason it can never regress silently.
"""
from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
SRC = API_ROOT / "src"
BROKER = SRC / "broker"
ADAPTER = BROKER / "webull_adapter.py"

_IMPORT_RE = re.compile(r"^\s*(?:from|import)\s+([A-Za-z0-9_\.]+)", re.M)


def _py_files(root: Path) -> list[Path]:
    return [p for p in root.rglob("*.py") if ".venv" not in p.parts
            and "__pycache__" not in p.parts]


def _imports_of(path: Path) -> list[str]:
    return _IMPORT_RE.findall(path.read_text(encoding="utf-8"))


def _app_modules() -> list[Path]:
    return [API_ROOT / "main.py", API_ROOT / "worker.py"] + _py_files(SRC)


# ------------------------------------------------------------------ (a) SDK import scope

def test_only_the_webull_adapter_imports_the_sdk():
    offenders = []
    for path in _app_modules():
        if not path.exists() or path == ADAPTER:
            continue
        if any(mod.startswith("webull") for mod in _imports_of(path)):
            offenders.append(str(path.relative_to(API_ROOT)))
    assert offenders == [], f"Webull SDK imported outside the adapter: {offenders}"


def test_adapter_sdk_imports_stay_in_the_read_subset():
    sdk_imports = [m for m in _imports_of(ADAPTER) if m.startswith("webull")]
    assert sdk_imports, "the adapter should import the SDK (lazily, inside the transport)"
    denied = ("trade", "order", "place", "grpc", "events", "mdata", "quotes")
    for mod in sdk_imports:
        assert not any(d in mod.lower() for d in denied), (
            f"adapter imports a non-read SDK module: {mod}")
        assert mod.startswith("webullsdkcore"), (
            f"adapter SDK import outside webull-python-sdk-core: {mod}")


def test_no_order_capable_sdk_package_is_even_installed():
    """The strongest AC-15 arm this environment can state: the trade/order SDK packages do
    not exist on disk, so no code path — present or future — can import an order module
    without a dependency change (a visible, reviewable requirements.txt diff)."""
    for absent in ("webullsdktrade", "webullsdktradeeventscore", "webullsdkmdata"):
        assert importlib.util.find_spec(absent) is None, (
            f"{absent} is installed — the read path must not carry order-capable packages")


# ------------------------------------------------------------------ (b) leaf ↔ scoring walls

_SCORING_MODULES = ("core.engine", "core.signals", "core.live", "core.darkpool",
                    "core.chain_store", "chain_store")


def test_broker_leaf_never_imports_scoring_or_auth():
    for path in _py_files(BROKER):
        for mod in _imports_of(path):
            assert not any(mod.endswith(s) or f".{s}." in mod or mod.startswith(s)
                           for s in _SCORING_MODULES), (
                f"{path.name} imports scoring module {mod}")
            assert "auth" not in mod, (
                f"{path.name} imports auth ({mod}) — the credential must arrive as a VO "
                f"resolved at the main.py boundary")
            assert not mod.startswith("src.providers"), (
                f"{path.name} imports the market-data provider layer ({mod})")


def test_scoring_path_never_imports_the_broker_leaf():
    scoring_files = [SRC / "core" / f for f in
                     ("engine.py", "signals.py", "live.py", "darkpool.py", "chain_store.py")]
    scoring_files += _py_files(SRC / "providers")
    for path in scoring_files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for mod in _imports_of(path):
            assert "broker" not in mod, f"{path.name} imports the broker leaf ({mod})"
        # Belt + braces: no lazy/string-built import either.
        assert "src.broker" not in text and "from src import broker" not in text, (
            f"{path.name} references the broker leaf")


# ------------------------------------------------------------------ (c) ports.py is stdlib-only

def test_broker_ports_imports_stdlib_only():
    stdlib = set(sys.stdlib_module_names)
    for mod in _imports_of(BROKER / "ports.py"):
        top = mod.split(".")[0]
        assert top in stdlib, f"ports.py imports non-stdlib module {mod}"


# ------------------------------------------------------------------ leaf entry discipline

def test_main_is_the_only_app_module_importing_the_leaf():
    """One orchestration boundary: outside the leaf itself, only main.py may import
    src.broker (mirrors the auth/marketdata one-way-leaf rule)."""
    offenders = []
    for path in _app_modules():
        if not path.exists() or BROKER in path.parents or path.name == "main.py":
            continue
        if any(mod.startswith(("src.broker", "broker")) and "broker" in mod
               for mod in _imports_of(path)):
            offenders.append(str(path.relative_to(API_ROOT)))
    assert offenders == [], f"modules besides main.py import the broker leaf: {offenders}"
