# bundle-events — pipeline manifest
Entry:        GATE M (backend fast-path — architect-style shape ruled by the conductor; PM/UX skipped,
              no UI implication per ORCHESTRATOR §3 Routine B)
Stage:        GATE M opened 2026-07-27 — interface + backend contracts locked; backend lane building
Repos:        backend only (`apps/api`) + `.claude/tools/conformance/`
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE M — the shape is a one-field additive attach following the
    shipped `iv_rank` / `market_context` attach-after-scoring precedent; no new architecture)
  - PRODUCT_CONTRACT.md        n/a (GATE M — no product surface; the FE renders nothing this phase)
  - UX_BLUEPRINT.md            n/a (GATE M)
  - INTERFACE_CONTRACT.md      locked — the single added field `market_state.event_calendar`
    (`object|null`, key always present) + the closed `state` enum (unknown/none/scheduled)
  - BACKEND_EXECUTION_CONTRACT.md   locked — projection helper in the events leaf, attach AFTER
    `generate_signals`, standalone conformance spec, runnable selftest, byte-identity GATE-Q surface
  - FRONTEND_EXECUTION_CONTRACT.md  NO_UI_CHANGE
Conformance:  standalone `.claude/tools/conformance/bundle_events.json` (authored by the lane; the
              canonical convention — precedent `iv_rank.json` / `scanner.json`, NOT an embedded block)
Open amendments: none
QA (GATE Q):  pending — byte-identity (HARD) · the three states live (scheduled/none/**unknown**) ·
              expiry-forces-unknown · best-effort null on a broken config · conformance + the iv_rank
              regression floor · SSE untouched · upcoming-only
Invariant watch (from BRIEF): additive-keeps-score-byte-identical (HARD) · best-effort-isolated-or-null ·
              model-read-carries-its-assumptions (the block carries the calendar's own as_of/horizon/
              covers/expiry) · digested-labels-not-raw-dump (closed `state` token is authoritative) ·
              live-vs-static-isolation (STATIC; SSE gains no field). **The `absent-is-not-none` contract
              must survive onto the wire — an uncurated ticker is `unknown`, never `none`.**
Notes:        Consumes the event calendar populated 2026-07-27 (`apps/api/src/scanner/config/events.json`,
              65/69 curated, 4 deliberately uncurated: TSLA/MU/CSCO/UNH — these are the natural `unknown`
              fixtures and must NOT be "fixed" by inventing dates). Realizes the wire half of BACKLOG §C
              `tradeable-rec-inputs` item 4; unblocks item 15 (event-adjusted forward IV).
Last gateway:  GATE M @ 2026-07-27
