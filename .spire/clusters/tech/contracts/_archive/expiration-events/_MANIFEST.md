# expiration-events — pipeline manifest
Entry:        GATE M (backend fast-path — PM/UX skipped, no UI implication per ORCHESTRATOR §3 Routine B)
Stage:        GATE M opened 2026-07-27 — interface + spec + backend contracts locked; backend lane building
Repos:        backend only (`apps/api`) + `.spire/clusters/tech/state/conformance/`
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE M — a derived additive array on an already-shipped block)
  - PRODUCT_CONTRACT.md        n/a (GATE M — ACs live in SPEC.md; no product surface this phase)
  - UX_BLUEPRINT.md            n/a (GATE M)
  - SPEC.md                    locked — 11 ACs; AC-3/AC-4 are the fixture-only edge cases
  - INTERFACE_CONTRACT.md      locked — `market_state.event_calendar.expirations[]` + the containment
    rule (§2) + what an empty list does NOT mean (§3)
  - BACKEND_EXECUTION_CONTRACT.md   locked — extend the projection in the events leaf, read the tenor
    curve off the computed bundle, extend the existing conformance spec + selftest
  - FRONTEND_EXECUTION_CONTRACT.md  NO_UI_CHANGE
Conformance:  extends the existing standalone `.spire/clusters/tech/state/conformance/bundle_events.json` (no second
              spec file). Harness limit carried over: `interface_conformance` has **no enum matcher**, so
              `event_types` tokens are verified off-harness (selftest + live reads).
Open amendments: none
QA (GATE Q):  pending — the before/after-event boundary · **the `amc`-on-expiry EXCLUSION and the
              `session:null`-on-expiry INCLUSION (fixtures; will not occur naturally)** · `state` still
              governs (`none` and `unknown` both ⇒ `[]`) · byte-identity (HARD, incl. `compute_term_structure`
              untouched) · best-effort on a missing tenor curve · ordering + echo fidelity · conformance ·
              SSE untouched
Invariant watch (from BRIEF): additive-keeps-score-byte-identical (HARD — **the obvious wrong
              implementation is decorating `compute_term_structure` at source; that is an engine edit**) ·
              best-effort-isolated-or-null · model-read-carries-its-assumptions · digested-labels-not-raw-dump
              (per-entry SUMMARY, never the event objects repeated) · live-vs-static-isolation ·
              **absent-is-not-none** (the watch-list key from bundle-events, carried down a level)
Notes:        Second half of BACKLOG §C `tradeable-rec-inputs` item 4; the half that actually changes tenor
              selection. Builds on `bundle-events` (shipped + archived 2026-07-27, OPEN_THREADS §7w).
              Concurrent session active in this repo — `.spire/clusters/tech/contracts/redesign-*` and the untracked
              `apps/dashboard/src/app/auth|landing` paths belong to it and are off-limits to this lane.
Last gateway:  GATE M @ 2026-07-27
