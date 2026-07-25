"""The scanstore subpackage — the Scanner sweep's persistent output sink (Scanner v1).
Structural sibling of src/marketdata/; a one-way leaf (see ports.py). The env-selected factory
(get_store) lands in Task 4."""
from __future__ import annotations

from .ports import ScanRow, ScanStore, SweepHeartbeat, SCAN_STATUSES

__all__ = ["ScanRow", "ScanStore", "SweepHeartbeat", "SCAN_STATUSES"]
