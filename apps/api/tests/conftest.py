"""
Suite-wide fixtures.

`SIGNUPS_ENABLED` fails CLOSED in production (owner lockdown, 2026-08-06), but most of this suite
registers throwaway accounts to reach the gated surfaces it actually wants to test. Opening the
door for the suite keeps those tests testing what they are about, instead of all asserting the same
new 403.

The lockdown itself is covered explicitly by `test_signup_lockdown.py`, which sets the env per case
rather than relying on the ambient default — so this fixture cannot mask a regression in it.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True, scope="session")
def _signups_open_for_the_suite():
    import os

    prior = os.environ.get("SIGNUPS_ENABLED")
    os.environ["SIGNUPS_ENABLED"] = "1"
    yield
    if prior is None:
        os.environ.pop("SIGNUPS_ENABLED", None)
    else:
        os.environ["SIGNUPS_ENABLED"] = prior
