"""Runnable check for the per-account scan-view field on the settings record (Scanner v1 Plan 3
Task 1). No pytest, no live server: drives the in-memory auth settings store directly. Proves the
scan_view JSON round-trips behind the EXISTING settings ports, a subset update does NOT clobber the
other fields, and — the load-bearing guard — SettingsRecord.to_wire() still does NOT carry scan_view
(the /api/auth/session + /api/auth/settings envelope stays byte-identical, INTERFACE §3.4).
Run: apps/api/.venv/Scripts/python.exe -m src.auth._scanview_selftest  (cwd = apps/api). 0=pass,1=fail."""
from __future__ import annotations

import json

from .ports import SettingsRecord
from .sqlite_store import make_stores


def run() -> None:
    stores = make_stores()
    uid = "user-scanview-1"
    stores.settings.upsert_defaults(uid)

    # 1. to_wire MUST NOT carry scan_view (the auth envelope byte-identity guard).
    wire = SettingsRecord(user_id=uid).to_wire()
    assert set(wire.keys()) == {"active_persona_id", "default_ticker", "theme"}, \
        f"settings to_wire drifted: {set(wire.keys())}"
    assert "scan_view" not in wire, "scan_view must NOT ride the settings wire (auth envelope)"

    # 2. round-trip the view JSON through the settings port (the D1 storage locus).
    view = {"symbols": ["SPY", "QQQ"], "name": "Morning",
            "sort": {"key": "score", "dir": "desc"}, "density": "compact"}
    stores.settings.update(uid, {"scan_view": json.dumps(view)})
    rec = stores.settings.get(uid)
    assert rec is not None and rec.scan_view is not None, "scan_view not persisted"
    assert json.loads(rec.scan_view) == view, f"scan_view round-trip failed: {rec.scan_view}"

    # 3. a later subset update (theme) must NOT clobber the saved scan_view (server-wins subset).
    stores.settings.update(uid, {"theme": "light"})
    rec2 = stores.settings.get(uid)
    assert rec2.theme == "light" and json.loads(rec2.scan_view) == view, \
        f"subset theme update clobbered scan_view: {rec2}"

    # 4. updating scan_view must NOT clobber theme.
    view2 = dict(view); view2["density"] = "comfortable"
    stores.settings.update(uid, {"scan_view": json.dumps(view2)})
    rec3 = stores.settings.get(uid)
    assert rec3.theme == "light" and json.loads(rec3.scan_view)["density"] == "comfortable", \
        f"scan_view update clobbered theme: {rec3}"


def main() -> int:
    try:
        run()
    except AssertionError as e:
        print(f"FAIL: {e}")
        return 1
    print("PASS: scan_view rides the settings ports; to_wire stays byte-identical")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
