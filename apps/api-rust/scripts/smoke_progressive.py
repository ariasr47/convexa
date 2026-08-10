"""Time Path A price vs Path B GEX on progressive SSE (byte-streaming)."""
from __future__ import annotations

import re
import time
import urllib.request

BASE = "http://127.0.0.1:8001"


def timed_price(sym: str = "NVDA") -> None:
    t0 = time.perf_counter()
    with urllib.request.urlopen(f"{BASE}/api/price/{sym}", timeout=30) as r:
        body = r.read().decode()
    ms = (time.perf_counter() - t0) * 1000
    print(f"GET /api/price/{sym}  {ms:.0f} ms")
    print(f"  {body[:180]}")


def timed_sse(sym: str, label: str) -> None:
    print(f"=== {label} ({sym}) ===")
    t0 = time.perf_counter()
    req = urllib.request.Request(
        f"{BASE}/api/ticker/{sym}/progressive",
        headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
    )
    # Read one byte at a time for event boundaries (measures true progressive delivery).
    with urllib.request.urlopen(req, timeout=180) as r:
        buf = ""
        price_ms = analytics_ms = None
        while True:
            ch = r.read(1)
            if not ch:
                break
            buf += ch.decode("utf-8", errors="replace")
            while "\n\n" in buf:
                event, buf = buf.split("\n\n", 1)
                now = (time.perf_counter() - t0) * 1000
                if event.startswith(":"):
                    continue  # heartbeat comment
                if "event: price" in event and price_ms is None:
                    price_ms = now
                    print(f"  SSE price     @ {price_ms:7.0f} ms")
                    for line in event.splitlines():
                        if line.startswith("data:"):
                            print(f"    {line[:200]}")
                elif "event: analytics" in event and analytics_ms is None:
                    analytics_ms = now
                    print(f"  SSE analytics @ {analytics_ms:7.0f} ms")
                    m = re.search(r'"net_gex":([0-9.\-eE]+)', event)
                    src = re.search(r'"source":"([^"]+)"', event)
                    print(
                        f"    source={src.group(1) if src else '?'}  "
                        f"net_gex={m.group(1) if m else '?'}"
                    )
                elif "event: done" in event:
                    print(f"  SSE done      @ {now:7.0f} ms")
                    if price_ms is not None and analytics_ms is not None:
                        print(
                            f"  >>> price first by {analytics_ms - price_ms:.0f} ms "
                            f"(price@{price_ms:.0f} → gex@{analytics_ms:.0f})"
                        )
                    return


if __name__ == "__main__":
    print("=== Path A only ===")
    timed_price("MSFT")  # cold-ish symbol
    print()
    timed_sse("MSFT", "Progressive cold-ish")
    print()
    timed_sse("MSFT", "Progressive warm")
