"""Runnable universe-loader check (Scanner v1 Plan 2 Task 3). No pytest.
Run: apps/api/.venv/Scripts/python.exe -m src.scanner.universe_selftest  (cwd = apps/api)."""
from __future__ import annotations

import json
import os
import tempfile

from .universe import load_universe


def _write(tmp: dict) -> str:
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(tmp, f)
    return path


def main() -> int:
    try:
        # 1. canon (UPPER) + de-dupe (order-preserving) + default_view subset-filtering.
        p = _write({"universe": ["spy", "QQQ", "spy", "iwm"],
                    "default_view": ["qqq", "NOPE", "spy"]})
        cfg = load_universe(p)
        os.remove(p)
        assert cfg.universe == ["SPY", "QQQ", "IWM"], cfg.universe
        assert cfg.default_view == ["QQQ", "SPY"], cfg.default_view  # NOPE dropped (not in universe)

        # 2. empty universe -> ValueError.
        p = _write({"universe": [], "default_view": []})
        try:
            load_universe(p); assert False, "empty universe must raise"
        except ValueError:
            pass
        finally:
            os.remove(p)

        # 3. missing file -> ValueError.
        try:
            load_universe(os.path.join(tempfile.gettempdir(), "definitely-missing-xyz.json"))
            assert False, "missing file must raise"
        except ValueError:
            pass

        # 4. the CHECKED-IN config loads and is coherent (default_view ⊆ universe).
        cfg = load_universe()  # default path
        assert len(cfg.universe) >= 8, f"checked-in universe too small: {len(cfg.universe)}"
        assert set(cfg.default_view).issubset(set(cfg.universe)), "default_view must be a subset"
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: universe loader canonicalizes, validates, and loads the checked-in config")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
