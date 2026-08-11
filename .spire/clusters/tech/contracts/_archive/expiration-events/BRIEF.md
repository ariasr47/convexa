# expiration-events — brief

Goal:            Flag **which expirations contain a scheduled event**, on the bundle. `bundle-events`
                 shipped the calendar; this answers the question that actually changes a trade: *does the
                 option I am considering live through earnings?* An August 21 call and a September 18
                 call on the same ticker are different instruments when earnings land August 26 —
                 today the AI must eyeball two dates and infer it.
Decision impact: Directly conditions **tenor selection** and any premium read — IV rich into an
                 event-bearing expiry is normal, the same richness in an event-free expiry is not.
                 Observed when the AI cites "this expiry contains earnings" without being told, and when
                 an expiry that dies BEFORE the event is visibly not flagged.
Feasibility:     pass — pure derivation from data already on the bundle: the `term_structure` tenor curve
                 (`expiration` + `dte`, full-chain, ascending) crossed with the shipped `event_calendar`.
                 No vendor call, no new dependency, **no engine change**.
Effort:          S
Invariant watch: **additive-keeps-score-byte-identical** (HARD — derived AFTER `generate_signals`, inside
                 the events leaf; `engine.py`/`signals.py` 0 diff — do NOT decorate `compute_term_structure`
                 at source, that is a scoring-path module) · **best-effort-isolated-or-null** (no tenor
                 curve ⇒ empty list, never an error) · **model-read-carries-its-assumptions** (each entry
                 states its basis; the containment rule is explicit, not implied) ·
                 **digested-labels-not-raw-dump** (a small bounded per-tenor summary, not a re-dump of the
                 event list per expiry) · **live-vs-static-isolation** (STATIC; SSE gains no field) ·
                 **absent-is-not-none** (the new watch-list key — `state` still governs; an empty
                 `expirations` under `unknown` must never read as "no expiry is affected").
Context tags:    architecture,backend,api,ai,decisions
Entry point:     GATE M (backend fast-path — no UI implication; PM/UX skipped per ORCHESTRATOR §3).
Source:          BACKLOG §C `tradeable-rec-inputs` item 4, second half — named as a deferred seam at
                 `bundle-events` GATE S (OPEN_THREADS §7w) and owner-directed 2026-07-27.
