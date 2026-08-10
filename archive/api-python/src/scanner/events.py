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


# ===================================================================== wire projection (bundle-events)
# The step that carries the semantics above onto the served bundle as `market_state.event_calendar`
# (INTERFACE_CONTRACT.md §1/§2). Pure + read-only: it takes an already-loaded config and a date and
# returns a plain JSON-serializable dict (or None). It performs NO I/O, imports nothing from the
# scoring path, and is called ONLY after `generate_signals` has returned
# ([additive-keeps-score-byte-identical]).

# The closed `state` vocabulary. `unknown` and `none` are DIFFERENT CLAIMS and are never collapsed:
# both ship `events: []`, so on the wire `state` is the ONLY thing that distinguishes "nobody checked"
# from "checked, nothing scheduled". This is `absent-is-not-none` (above) made observable.
WIRE_STATE_UNKNOWN = "unknown"      # not curated — we do not know this ticker's schedule
WIRE_STATE_NONE = "none"            # curated; nothing upcoming WITHIN `covers`
WIRE_STATE_SCHEDULED = "scheduled"  # curated; >= 1 upcoming event

# `[digested-labels-not-raw-dump]`: the wire carries a small bounded list, never the config file.
# With covers=["earnings"] over a ~3-month horizon the real count is 1-2; this is a ceiling against a
# pathological entry, not a working limit.
MAX_WIRE_EVENTS = 8


def _calendar_unusable(cfg: EventsConfig | None) -> bool:
    """True when nothing was actually loaded — a missing/corrupt/wrong-shape file makes `load_events`
    degrade to the DEFAULT config (no symbols, no as_of, no horizon, no covers). Such a config asserts
    nothing about the world, so the honest wire value is `null` (the enrichment is absent) rather than
    a confident "unknown for everything" carrying null freshness — `[best-effort-isolated-or-null]`."""
    if cfg is None:
        return True
    return not cfg.symbols and not cfg.as_of and not cfg.horizon_end and not cfg.covers


def _project_event(ev: CalendarEvent, today: date) -> dict | None:
    """One event -> the exact 7 fields INTERFACE §1 pins, or None if it is not upcoming/parseable.
    `avg_abs_move_pct` is deliberately NOT on the wire: it is a loader-internal field the interface
    does not carry, and passing it through would be a raw dump rather than the pinned shape."""
    try:
        d = date.fromisoformat(ev.date)
    except (TypeError, ValueError):
        return None
    days_until = (d - today).days
    if days_until < 0:
        return None                      # UPCOMING ONLY; the serving day itself still counts
    return {
        "date": ev.date,
        "type": ev.type,
        "confirmed": bool(ev.confirmed),
        "session": ev.session,           # null means genuinely unknown, NOT "assume amc"
        "days_until": days_until,
        "source": ev.source,
        "note": ev.note,                 # carries source DISAGREEMENT where it exists
    }


# ------------------------------------------------------------------ per-expiration containment
# (expiration-events) THE RULE, and why it is not a plain `<=`:
#
#   an event is CONTAINED by an expiration when   serving_day <= event.date <= expiration
#   EXCEPT an `amc` event dated exactly ON the expiration, which is NOT contained.
#
# A contract expiring at Friday's close is DEAD BEFORE an after-close report the same day. Flagging
# that expiry as "contains earnings" would be an off-by-one that sends the reader to a tenor which
# structurally cannot see the event — the exact wrong tenor choice this feature exists to prevent.
# The mirror case is deliberately asymmetric: an event with `session: null` on the expiration date IS
# contained, because an unknown session must never be silently assumed to land after the close; the
# conservative direction is to flag it ([model-read-carries-its-assumptions]). `bmo` (and any other
# recorded session token) on the expiry is trivially contained.
#
# Neither edge occurs in the shipped calendar; both are pinned by fixtures in
# `events_projection_selftest.py` (cases 14/15).
SESSION_AFTER_CLOSE = "amc"


def _contains(ev_date: str, session: str | None, exp: str, day_iso: str) -> bool:
    """ISO date strings compare lexicographically == chronologically, so no parsing is needed here;
    every date reaching this point has already been validated as ISO by the loader/curve reader."""
    if not (day_iso <= ev_date <= exp):
        return False
    if ev_date == exp and (session or "").strip().lower() == SESSION_AFTER_CLOSE:
        return False                     # dead at the close, hours before the report
    return True


def _tenor_rows(term_structure) -> list[tuple[int, str]]:
    """Read (dte, expiration) off the bundle's ALREADY-COMPUTED full-chain tenor curve.

    READ-ONLY BY DESIGN ([additive-keeps-score-byte-identical]): the curve is produced by
    `QuantEngine.compute_term_structure` in the scoring-path module `engine.py`, which this feature
    does NOT touch. Anything unusable — no curve, wrong shape, a malformed point — is skipped rather
    than repaired or invented, and an empty result becomes `expirations: []`
    ([best-effort-isolated-or-null])."""
    if not isinstance(term_structure, dict):
        return []
    points = term_structure.get("points")
    if not isinstance(points, list):
        return []
    rows: list[tuple[int, str]] = []
    for p in points:
        if not isinstance(p, dict):
            continue
        exp = p.get("expiration")
        dte = p.get("dte")
        if not isinstance(exp, str) or not _ISO_DATE.match(exp.strip()):
            continue
        if isinstance(dte, bool) or not isinstance(dte, (int, float)):
            continue
        rows.append((int(dte), exp.strip()))
    rows.sort(key=lambda r: (r[0], r[1]))     # ascending by DTE (the curve's own order)
    return rows


def _project_expirations(events: list[dict], term_structure, day: date) -> list[dict]:
    """One summary row per tenor: does a scheduled event fall inside this option's life?

    `[digested-labels-not-raw-dump]`: the row carries a COUNT + de-duped sorted type tokens + the
    earliest contained date — never the event objects, which live once, in `events`.

    `events` is the list ALREADY projected onto the wire (upcoming-only, capped at MAX_WIRE_EVENTS),
    so the counts here can never disagree with what the consumer can actually see."""
    day_iso = day.isoformat()
    out: list[dict] = []
    for dte, exp in _tenor_rows(term_structure):
        hits = [e for e in events
                if _contains(str(e.get("date") or ""), e.get("session"), exp, day_iso)]
        types = sorted({str(e.get("type")) for e in hits})
        out.append({
            "expiration": exp,                       # echoed from the curve, never recomputed
            "dte": dte,                              # echoed from the curve, never recomputed
            "contains_event": bool(hits),
            "event_count": len(hits),
            "event_types": types,
            "first_event_date": min(e["date"] for e in hits) if hits else None,
        })
    return out


def project_event_calendar(symbol: str | None,
                           cfg: EventsConfig | None = None,
                           today: date | None = None,
                           term_structure=None) -> dict | None:
    """Project the curated calendar for `symbol` into the `market_state.event_calendar` wire block.

    Returns None (=> `event_calendar: null`) when the calendar could not be loaded at all — never
    raises, whatever the input, because this is enrichment attached to an already-computed bundle.

    State rules (INTERFACE §2):
      * calendar EXPIRED (its own `horizon_end` passed or unset) -> `unknown` for EVERY symbol. An
        out-of-horizon file cannot support a `none`/`scheduled` claim, and silently serving dead dates
        is exactly the failure the horizon exists to prevent.
      * symbol not curated -> `unknown`  (NEVER `none` — see WIRE_STATE_* above)
      * curated, no upcoming event -> `none`  (scoped by `calendar_covers`)
      * curated, >= 1 upcoming event -> `scheduled`

    `term_structure` is the bundle's own full-chain tenor curve, passed in by the caller AFTER
    scoring and only ever READ (see `_tenor_rows`). It drives the additive `expirations[]` block
    (expiration-events). `expirations` is `[]` for BOTH `unknown` and `none` — and for a missing or
    unusable curve — so it is NOT self-disambiguating: `state` remains the sole disambiguator, and
    an empty list under `unknown` means "we cannot say", never "no expiry is affected"
    (`absent-is-not-none`, carried down one level). That is why no per-expiration row is emitted at
    all unless `state == scheduled`: a `contains_event: false` row would be a claim about an expiry
    on a ticker nobody ever checked.
    """
    try:
        cfg = cfg if cfg is not None else get_events()
        if _calendar_unusable(cfg):
            return None
        day = today or date.today()
        expired = cfg.is_expired(day)

        events: list[dict] = []
        if expired or not cfg.is_known(symbol or ""):
            state = WIRE_STATE_UNKNOWN
        else:
            for ev in (cfg.events_for(symbol or "") or []):
                row = _project_event(ev, day)
                if row is not None:
                    events.append(row)
            events.sort(key=lambda r: (r["date"], r["type"]))
            events = events[:MAX_WIRE_EVENTS]
            state = WIRE_STATE_SCHEDULED if events else WIRE_STATE_NONE

        # Derived from the events ALREADY projected above (upcoming-only) x the tenor curve. Its own
        # guard: a fault here degrades to [] and can never cost the block its calendar read.
        expirations: list[dict] = []
        if state == WIRE_STATE_SCHEDULED:
            try:
                expirations = _project_expirations(events, term_structure, day)
            except Exception:
                logger.exception(f"[events] per-expiration projection failed for {symbol!r}; "
                                 f"emitting expirations=[] (the calendar read is unaffected)")
                expirations = []

        return {
            "state": state,
            "events": events,
            "expirations": expirations,
            "calendar_as_of": cfg.as_of,
            "calendar_horizon_end": cfg.horizon_end,
            "calendar_covers": list(cfg.covers),
            "calendar_expired": bool(expired),
        }
    except Exception:
        logger.exception(f"[events] wire projection failed for {symbol!r}; emitting null")
        return None
