"""D3 universe-config loader. Reads the owner-curated CHECKED-IN JSON at worker start: the tracked
universe (50-100) + the D2 default-view list. Canonicalizes to UPPER, de-dupes preserving order, and
constrains default_view to the universe (unknown default-view symbols are dropped with a warning —
the config is git-reviewed, so this is a guard, not a feature). A missing/malformed file or an empty
universe is an operator config error surfaced at worker START (fail-fast at start, NOT a per-row
degrade). The universe is NOT a secret; the path is a checked-in file, env-overridable for tests/ops."""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("Convexa")

_DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), "config", "universe.json")


@dataclass(frozen=True)
class UniverseConfig:
    universe: list[str]       # canonical UPPER, de-duped, order-preserving
    default_view: list[str]   # subset of universe, order-preserving


def _canon_list(raw) -> list[str]:
    """UPPER + strip + de-dupe preserving first-seen order. Non-str / empty entries dropped."""
    out: list[str] = []
    seen: set[str] = set()
    for item in (raw or []):
        if not isinstance(item, str):
            continue
        sym = item.strip().upper()
        if sym and sym not in seen:
            seen.add(sym)
            out.append(sym)
    return out


def load_universe(path: str | None = None) -> UniverseConfig:
    """Load + validate the universe config. Raises ValueError on a missing/malformed file or an empty
    universe (an operator error surfaced at worker start)."""
    cfg_path = path or os.getenv("SCAN_UNIVERSE_PATH", "").strip() or _DEFAULT_CONFIG
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError as e:
        raise ValueError(f"Scanner universe config not found at {cfg_path}. Set SCAN_UNIVERSE_PATH "
                         f"or add the checked-in config file.") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Scanner universe config at {cfg_path} is not valid JSON: {e}") from e

    universe = _canon_list(data.get("universe"))
    if not universe:
        raise ValueError(f"Scanner universe config at {cfg_path} has an empty 'universe' list.")

    universe_set = set(universe)
    default_view: list[str] = []
    for sym in _canon_list(data.get("default_view")):
        if sym in universe_set:
            default_view.append(sym)
        else:
            logger.warning(f"[universe] default_view symbol {sym} is not in the universe; dropped.")

    logger.info(f"[universe] loaded {len(universe)} symbols, default_view={len(default_view)} "
                f"from {cfg_path}")
    return UniverseConfig(universe=universe, default_view=default_view)


_CACHED: UniverseConfig | None = None


def get_universe() -> UniverseConfig:
    """Process-cached universe config for the WEB read path (Scanner v1 P3). Loaded ONCE (D3: edit the
    checked-in config + restart to change it — no hot-reload). The sweep worker calls load_universe()
    fresh at its own start; the web app memoizes it here so /api/scan* reads don't re-read the file per
    request. Raises the same ValueError as load_universe on a missing/empty config."""
    global _CACHED
    if _CACHED is None:
        _CACHED = load_universe()
    return _CACHED
