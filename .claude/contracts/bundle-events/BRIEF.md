# bundle-events — brief

Goal:            Surface the owner-curated event calendar (`apps/api/src/scanner/config/events.json`,
                 populated 2026-07-27) on the served bundle as an additive, nullable
                 `market_state.event_calendar` block, so the downstream AI and the Ticker page can see
                 **whether a scheduled event sits inside the horizon they are reasoning about** —
                 today they cannot, and the AI had to web-search for it.
Decision impact: Improves entry/exit TIMING and the honesty of any premium read — an IV level means
                 something different with earnings inside the window than without. Observed when the
                 AI rec cites a dated event it did not have to search for, and when a ticker with an
                 uncurated calendar is visibly `unknown` rather than silently treated as event-free.
Feasibility:     pass — the loader (`src/scanner/events.py`) + data already exist and are tested; this
                 is attach-after-scoring plumbing following the `iv_rank` / `market_context` precedent
                 exactly. No vendor call, no new dependency.
Effort:          S
Invariant watch: **additive-keeps-score-byte-identical** (HARD — attach AFTER `generate_signals`;
                 `signals.py` 0 diff; the calendar is NEVER a scoring input) · **best-effort-isolated-
                 or-null** (a calendar fault yields `event_calendar: null`, never a 5xx) ·
                 **model-read-carries-its-assumptions** (the block carries the calendar's own `as_of` /
                 `horizon_end` / `covers` / expiry — a date is only as good as the file's freshness) ·
                 **digested-labels-not-raw-dump** (a closed `state` enum + a small bounded event list;
                 no raw dump) · **live-vs-static-isolation** (STATIC read — nothing rides SSE).
                 The **absent-is-not-none** contract from `events.py` must survive onto the wire: an
                 uncurated ticker is `unknown`, NOT "no events".
Context tags:    architecture,backend,api,ai,decisions
Entry point:     GATE M (backend fast-path — no UI implication; PM/UX skipped per ORCHESTRATOR §3).
Source:          BACKLOG §C `tradeable-rec-inputs` item 4 (the event-calendar half), owner-directed
                 2026-07-27 immediately after the calendar was populated.
