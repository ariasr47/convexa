# bundle-events — SPEC

> Required by the kit v1.0.0 `contract_lint` (M8: a spec carrying the acceptance criteria GATE Q
> verifies; M3: it must NAME `INTERFACE_CONTRACT.md` rather than restate it). For this GATE-M
> backend fast-path the spec carries the ACs that would otherwise sit in a PRODUCT_CONTRACT.

**Wire truth:** `INTERFACE_CONTRACT.md` is the single FE↔BE truth — field names, types, presence, the
closed `state` enum and the conformance pointer live there and are **never restated here**.

## What this ships
The owner-curated event calendar (`apps/api/src/scanner/config/events.json`) surfaced on the served
bundle as an additive, always-present, nullable `market_state.event_calendar` block, attached **after**
scoring. Backend only; the FE renders nothing this phase.

## Acceptance criteria

Each is observable against a running backend without reading code.

- **AC-1** For a curated ticker with upcoming dates (e.g. NVDA), `event_calendar.state == "scheduled"`
  and `events[]` lists them chronologically with a correct non-negative `days_until`.
- **AC-2** For a curated ticker with no events in scope (any of the 18 ETFs, e.g. SPY),
  `state == "none"` and `events == []`.
- **AC-3** For an **uncurated** ticker (TSLA, MU, CSCO or UNH — deliberately absent from the config),
  `state == "unknown"` and `events == []`. **AC-3 is the load-bearing one:** `unknown` must be
  distinguishable from `none` on the wire. A build that returns `none` here is a FAIL, not a nuance.
- **AC-4** Each event carries its `confirmed` flag, `source`, and `note` — a projected date is visibly
  not a company-announced one, and a recorded source disagreement survives to the wire.
- **AC-5** The block is self-describing: `calendar_as_of`, `calendar_horizon_end`, `calendar_covers`
  and `calendar_expired` are present whenever `event_calendar` is non-null.
- **AC-6** When the calendar's horizon has passed (`calendar_expired == true`), a curated ticker still
  reads `state == "unknown"` — an out-of-horizon file cannot support a `none`/`scheduled` claim.
- **AC-7** Only upcoming events appear; nothing dated before the serving day is listed.
- **AC-8** With `SCAN_EVENTS_PATH` pointed at a missing or corrupt file, `event_calendar` is `null`,
  the bundle still returns **200**, and `market_state` / `strike_profile` are intact.
- **AC-9** The `event_calendar` **key is always present** on the ticker endpoint, even when its value
  is `null`.
- **AC-10 (HARD)** `opportunity_score`, `opportunity_tier`, `state_fingerprint` and the entry gate are
  **byte-identical** with the block present, null, and versus the pre-change build on a real ticker;
  `git diff` of `signals.py` / `engine.py` / `live.py` / `darkpool.py` is **empty**.
- **AC-11** The SSE payload gains **no** field — this read is static, not live.

## Verification method
Risk-based per `agents/qa-verify.md` §4 — **not** one test per AC. AC-3, AC-6, AC-8 and AC-10 are the
silent-regression risks and warrant automated/negative checks (including an independent RED of the
`unknown`/`none` collapse); AC-1/2/4/5/7/9/11 are observable by review against the running backend plus
the standalone conformance sweep named in `INTERFACE_CONTRACT.md`.
