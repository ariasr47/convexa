# positions-legs — pipeline manifest
Stage:        GATE I closed — BRIEF written; routing to GATE C (design council)
Repos:        frontend (`apps/dashboard` + the durable stores). `apps/api` diff MUST be empty.
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    n/a (GATE C — the council's R4 synthesis writes it)
  - INTERFACE_CONTRACT.md      n/a (GATE C — expected NO_BACKEND_CHANGE: positions are client-local
    and never a scoring input; the council confirms and states it explicitly)
Open amendments: none
QA (GATE Q):  n/a
Scope:        IN — a position becomes `Leg[]`; `GhostTrade` + `Position` merge into ONE `SimPosition`;
              `Strategy` → `StructureKind` DERIVED from leg shape; the ×100 multiplier moves onto the
              leg so equity works; the two `appendDecision` definitions collapse to one (resolves
              DECISION_QUEUE **Q2**); one durable migration carries the rename + the shape change.
              A `PositionView` render contract is introduced so presentational components stay shared.
              OUT — `BrokerPosition` (nothing produces one yet; a NEW type later needs no further
              migration), the broker adapter, the Webull connection (feasibility-gated + system-6),
              and any real-money entry surface (`single-shared-sim-entry-dialog`, as narrowed).
Invariant watch (from BRIEF): **loss-free-durable-migration** (HARD — the SEVERITY-promoted key; ~5
              stores hold the entire trading history with NO server backup) · additive-keeps-score-byte-
              identical (empty `apps/api` diff) · no-real-order-path · single-shared-sim-entry-dialog
              (multi-leg is a SIM variant of the ONE dialog, never a fork) · digested-labels-not-raw-dump
              (`StructureKind` derived, never stored) · theme-token-discipline · live-vs-static-isolation
              (the SSE-drop P/L degrade must survive the refactor).
Notes:        Sequenced ahead of the Webull import deliberately — the importer must not be built against
              a model that cannot represent what it imports. Ground truth verified in code before the
              BRIEF: `positions/types.ts:70` `Strategy = 'long_call' | 'long_put'`; `model/types.ts`
              `side: 'long'`; `model/mark.ts:122` `(mark - entryMark) * 100 * qty`; `useGhostTrade`
              still mounted at `pages/ticker/TickerDashboard.tsx:101`.
              ⚠ A parallel session has been active in `apps/dashboard/src/app/` today — coordinate
              before the build lane starts, since this refactor touches the whole trading domain.
Last gateway:  GATE I @ 2026-07-27
