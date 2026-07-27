"""Owner-curated EVENT-CALENDAR config loader (tradeable-rec-inputs item 4).

Mirrors `universe.py` in shape and operational story: a checked-in JSON the owner edits and the
process reads at start (no hot-reload), env-overridable for tests/ops via `SCAN_EVENTS_PATH`.

WHY CONFIG AND NOT A VENDOR CALL: Massive's earnings feed (`list_benzinga_earnings`) is a separate
add-on this plan is NOT entitled to (probed 2026-07-27), and scheduled macro events are not a Massive
product at all. Curating dates for a BOUNDED universe is cheap and decouples the calendar from the
vendor entirely.

THE LOAD-BEARING DISTINCTION — **absent is not none**:
  * symbol MISSING from the config      -> `events_for()` returns **None**  = "we do not know"
  * symbol present with an empty list   -> `events_for()` returns **[]**    = "checked; nothing scheduled"
Those are different claims about the world. Collapsing them would let the app state "no earnings
scheduled" on a ticker nobody ever checked — the exact fabrication this codebase refuses everywhere
else (cf. the scanner's `building` vs `error`, iv-rank's "building history"). The type signature is
the enforcement: callers cannot accidentally treat unknown as empty without handling `None`.

Unlike `universe.py`, a missing or malformed file here is **NOT fatal**: the calendar is an
enrichment, so it degrades to "everything unknown" rather than blocking start
(`[best-effort-isolated-or-null]`). An operator error is logged loudly, not raised.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import date

logger = logging.getLogger("Convexa")

_DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), "config", "events.json")

# Closed vocabulary. A row carrying an unrecognized type is DROPPED with a warning rather than
# passed through — an unknown label downstream is worse than a missing one.
EVENT_TYPES = ("earnings", "ex_div", "fomc", "cpi", "pce", "nfp", "product", "lockup")

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass(frozen=True)
class CalendarEvent:
    date: str                          # ISO YYYY-MM-DD
    type: str                          # one of EVENT_TYPES
    confirmed: bool                    # company/agency-confirmed vs owner-estimated
    session: str | None = None         # 'bmo' | 'amc' | None (earnings only, advisory)
    source: str | None = None          # provenance, for audit
    avg_abs_move_pct: float | None = None   # historical |move| for this event type on this ticker
    note: str | None = None            # caveats that survive into the data: which source, whether
                                       # sources DISAGREED and by how much, weak session provenance.
                                       # `confirmed:false` says "not company-announced"; this says WHY,
                                       # and "two sources 7 days apart" is materially different from a
                                       # clean cadence estimate.


@dataclass(frozen=True)
class EventsConfig:
    """`symbols` holds ONLY the symbols the owner has actually curated. Membership is the signal."""
    symbols: dict[str, list[CalendarEvent]] = field(default_factory=dict)
    as_of: str | None = None           # date the owner last verified the file
    horizon_end: str | None = None     # entries are only claimed valid up to here
    covers: tuple[str, ...] = ()       # WHICH event types this curation pass actually covered
    path: str | None = None

    def events_for(self, symbol: str) -> list[CalendarEvent] | None:
        """**None = unknown** (never curated). **[] = verified none, WITHIN `covers`.** An empty list is
        only ever a claim about the event types in `covers` — never "nothing at all happens to this
        ticker". An ETF curated for earnings correctly holds `[]` while still paying distributions."""
        return self.symbols.get((symbol or "").strip().upper())

    def is_known(self, symbol: str) -> bool:
        return (symbol or "").strip().upper() in self.symbols

    def is_expired(self, today: date | None = None) -> bool:
        """True when the file's own horizon has passed — consumers should stop trusting it entirely
        rather than quietly serving stale dates."""
        if not self.horizon_end or not _ISO_DATE.match(self.horizon_end):
            return True          # no stated horizon => cannot be trusted as current
        return (today or date.today()).isoformat() > self.horizon_end

    @property
    def curated_count(self) -> int:
        return len(self.symbols)


def _canon_covers(raw) -> list[str]:
    """Normalize the declared event-type scope; non-str / unknown entries are ignored by the caller."""
    return [str(t).strip().lower() for t in (raw or []) if isinstance(t, str) and t.strip()]


def _parse_events(symbol: str, raw) -> list[CalendarEvent]:
    out: list[CalendarEvent] = []
    for row in (raw or []):
        if not isinstance(row, dict):
            continue
        d = str(row.get("date", "")).strip()
        t = str(row.get("type", "")).strip().lower()
        if not _ISO_DATE.match(d):
            logger.warning(f"[events] {symbol}: dropped event with a non-ISO date {d!r}")
            continue
        if t not in EVENT_TYPES:
            logger.warning(f"[events] {symbol}: dropped event with unknown type {t!r}")
            continue
        move = row.get("avg_abs_move_pct")
        out.append(CalendarEvent(
            date=d,
            type=t,
            confirmed=bool(row.get("confirmed", False)),
            session=(str(row["session"]).strip().lower() if row.get("session") else None),
            source=(str(row["source"]).strip() if row.get("source") else None),
            avg_abs_move_pct=(float(move) if isinstance(move, (int, float)) else None),
            note=(str(row["note"]).strip() if row.get("note") else None),
        ))
    out.sort(key=lambda e: (e.date, e.type))
    return out


def load_events(path: str | None = None, universe: list[str] | None = None) -> EventsConfig:
    """Load the event calendar. Best-effort: a missing/malformed file degrades to an EMPTY config
    (everything unknown) with a loud log — never raises, because the calendar is enrichment."""
    cfg_path = path or os.getenv("SCAN_EVENTS_PATH", "").strip() or _DEFAULT_CONFIG
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        logger.warning(f"[events] no calendar at {cfg_path}; every symbol reads as UNKNOWN")
        return EventsConfig(path=cfg_path)
    except json.JSONDecodeError as e:
        logger.error(f"[events] calendar at {cfg_path} is not valid JSON ({e}); "
                     f"degrading to UNKNOWN for every symbol")
        return EventsConfig(path=cfg_path)

    if not isinstance(data, dict):
        # Valid JSON, wrong shape (e.g. a bare string or list). Same class of operator error as a
        # syntax error, so it degrades identically instead of raising an AttributeError upward.
        logger.error(f"[events] calendar at {cfg_path} is valid JSON but not an object; "
                     f"degrading to UNKNOWN for every symbol")
        return EventsConfig(path=cfg_path)

    raw_symbols = data.get("symbols")
    if not isinstance(raw_symbols, dict):
        raw_symbols = {}

    universe_set = {s.strip().upper() for s in (universe or [])}
    symbols: dict[str, list[CalendarEvent]] = {}
    for sym_raw, body in raw_symbols.items():
        if not isinstance(sym_raw, str) or sym_raw.startswith("_"):
            continue                      # _-prefixed keys are documentation, never data
        sym = sym_raw.strip().upper()
        if not sym:
            continue
        events = _parse_events(sym, (body or {}).get("events") if isinstance(body, dict) else None)
        if universe_set and sym not in universe_set:
            # Kept, not dropped: a calendar entry for an off-universe ticker is still true. Flagged
            # because it is far more often a typo than an intention.
            logger.warning(f"[events] {sym} is not in the tracked universe (kept; check for a typo)")
        symbols[sym] = events

    covers = tuple(t for t in _canon_covers(data.get("covers")) if t in EVENT_TYPES)
    cfg = EventsConfig(
        symbols=symbols,
        as_of=(data.get("as_of") if isinstance(data.get("as_of"), str) else None),
        horizon_end=(data.get("horizon_end") if isinstance(data.get("horizon_end"), str) else None),
        covers=covers,
        path=cfg_path,
    )
    if symbols and not covers:
        logger.warning("[events] config curates symbols but declares no 'covers' — an empty event list "
                       "is then an UNSCOPED claim ('nothing ever happens'), which is almost certainly "
                       "not what was meant. Declare the event types this pass covered.")
    known = cfg.curated_count
    total = len(universe_set) if universe_set else known
    if known == 0:
        logger.warning(f"[events] calendar at {cfg_path} is EMPTY — every symbol reads as UNKNOWN "
                       f"(this is honest, not broken: nothing has been curated yet)")
    else:
        logger.info(f"[events] loaded {known} curated symbol(s)"
                    + (f" of {total} tracked" if universe_set else "")
                    + f", as_of={cfg.as_of}, horizon_end={cfg.horizon_end} from {cfg_path}")
    if cfg.is_expired():
        logger.warning(f"[events] calendar horizon_end={cfg.horizon_end} has passed (or is unset) — "
                       f"treat entries as EXPIRED, not merely stale")
    return cfg


_CACHED: EventsConfig | None = None


def get_events() -> EventsConfig:
    """Process-cached calendar for the web read path (mirrors `universe.get_universe`)."""
    global _CACHED
    if _CACHED is None:
        _CACHED = load_events()
    return _CACHED
