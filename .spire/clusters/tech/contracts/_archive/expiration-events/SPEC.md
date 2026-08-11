# expiration-events — SPEC

**Wire truth:** `INTERFACE_CONTRACT.md` is the single FE↔BE truth — field names, types, presence and the
containment rule live there and are **never restated here**.

## What this ships
`market_state.event_calendar.expirations[]` — a per-expiration flag for whether a scheduled event falls
inside that option's life. Derived after scoring from the bundle's own tenor curve × the shipped
calendar. Backend only; the FE renders nothing this phase.

## Acceptance criteria

Observable against a running backend without reading code.

- **AC-1** For a curated ticker with a future event (e.g. NVDA, earnings 2026-08-26), every tenor
  expiring **on or after** that date has `contains_event: true`, `event_count: 1`,
  `event_types: ["earnings"]`, `first_event_date: "2026-08-26"`.
- **AC-2** Every tenor expiring **strictly before** the event date has `contains_event: false`,
  `event_count: 0`, `event_types: []`, `first_event_date: null`. **The boundary is the point of the
  feature** — a near expiry that dies before earnings must NOT be flagged.
- **AC-3 (the sharp edge)** An **`amc` event dated exactly on an expiration** is **NOT** contained by
  that expiration (the contract is dead at the close, before the after-close report), while the same
  event **IS** contained by the next expiration out. Verify with a fixture, since it may not occur
  naturally.
- **AC-4** An event dated exactly on an expiration with **`session: null`** **IS** contained — an
  unknown session must not be silently assumed to fall after the close.
- **AC-5** `expirations` is ordered ascending by `dte`, and `expiration`/`dte` echo the bundle's tenor
  curve exactly (no invented or renamed tenors).
- **AC-6** For `state == "none"` (e.g. SPY) and `state == "unknown"` (TSLA/MU/CSCO/UNH), `expirations`
  is `[]`. **`state` still governs** — an empty list under `unknown` is not a claim that no expiry is
  affected.
- **AC-7** When the bundle has no usable tenor curve, `expirations` is `[]` and the bundle still returns
  **200**; `event_calendar`'s other fields are unaffected.
- **AC-8** `expirations` is present (possibly `[]`) whenever `event_calendar` is non-null; when
  `event_calendar` is `null` the whole block is absent as before.
- **AC-9 (HARD)** `opportunity_score`, `opportunity_tier`, `state_fingerprint` and the entry gate are
  **byte-identical** with the field present versus the pre-change build on a real ticker; `git diff` of
  `engine.py` / `signals.py` / `live.py` / `darkpool.py` is **empty**. In particular
  `compute_term_structure` is **not** modified — the tenor curve is read, never decorated at source.
- **AC-10** The SSE payload gains **no** field.
- **AC-11** Multiple contained events on one expiration produce `event_count > 1` with **de-duped,
  sorted** `event_types` and `first_event_date` = the earliest.

## Verification method
Risk-based per `agents/qa-verify.md` §4 — **not** one test per AC. AC-2, AC-3, AC-4, AC-6 and AC-9 are
the silent-regression risks and warrant automated/negative checks with fixtures (the `amc`-on-expiry and
`session:null`-on-expiry cases will not occur naturally and must be constructed). AC-1/5/7/8/10/11 are
observable by review against the running backend plus the standalone conformance sweep named in
`INTERFACE_CONTRACT.md`.
