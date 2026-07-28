# positions-legs — pipeline manifest
Stage:        **GATE C CLOSED @ 2026-07-28 — SPEC APPROVED by the owner.** Council ran R1→R3 · R4
              synthesis · S2 skeptic (PASS, 0 Critical) · fix pass · UX copy pass (R5) · two post-R4
              owner rulings folded. §9 is EMPTY. Next: **GATE PLAN** (`superpowers:writing-plans`
              over SPEC.md → PLAN.md, Global Constraints copying the conformance block verbatim),
              then Frontend lane only (backend is NO_BACKEND_CHANGE).
Repos:        frontend (`apps/dashboard` + the durable stores). `apps/api` diff MUST be empty.
Brief:        BRIEF.md present
Contracts:
  - SPEC.md                    **locked** — `APPROVED 2026-07-28`, 82 ACs, §9 empty
  - INTERFACE_CONTRACT.md      NO_BACKEND_CHANGE — embedded `## Conformance spec` asserting the
    existing, unchanged `GET /api/contract/{ticker}` shape the positions surface consumes (15 required
    fields; validated non-vacuous — PASS on a synthetic response, FAIL on a mutated one)
Open amendments: none
QA (GATE Q):  n/a
Council:      18 conflicts raised / 18 accepted / 0 rejected (quote-verified). 10 technical settled by
              the voices; 4 owner-ruled (payoff math = MAX LOSS ONLY · `position_eval` SUPPRESSED for
              multi-leg · call/put tint SCOPED to gamma surfaces · faulted store = STRICT refuse-all-
              writes); #10 Group-by-Expiry HELD AS FUTURE (conductor default-with-veto, U17 cut);
              #16 moot. S2 (Sonnet, de-correlated from the Opus synthesizer): **PASS, 0 Critical**,
              2 Important + 1 citation fix applied. `contract_lint` 0 errors / 0 warnings.
              Artifacts: `council/` (R1×3, R2×3, R3×3, conflicts.json, decisions.md, S2-findings.md).
Canon action DONE (owed by ruling #18): `docs/design/DESIGN_SYSTEM.md` L42–43 palette-role column now
              scopes `success`/`error` — gamma/GEX surfaces keep call-vs-put; position + P&L surfaces
              are signed-P&L direction ONLY (never call-vs-put, never position side).
In-scope live defect: `positions/store.ts` has no fault latch — `read()` catches to empty and the next
              `write()` destroys the unparseable blob (half-violates `loss-free-durable-migration` in
              shipped code today). Repair is AC-56; `orders/store.ts` is the correct precedent.
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
Post-R4 owner rulings (in `council/decisions.md`):
              **Q2 → the max-loss eligible set is 15 members** (the 9 the architect enumerated + the 6
              single-leg/long-debit shapes: `long_call`, `long_put`, `long_straddle`, `long_strangle`,
              `short_put`, `shares_long`). Ineligible + reason-only: `Custom`, the unbounded shapes,
              the multi-expiry shapes. **Q6 → the figure gets a visible `max_loss` table column**
              (`FIGMA_COLUMNS` + `DEFAULT_COLUMNS` + `COLUMN_LABELS`) — a recorded, dated amendment to
              the REVISION-2 (2026-06-29) fixed-Figma-column decision. **One added column, NOT the
              return of column-customization** — the picker stays unbuilt and out of scope.
Lane instruction (GATE Z, not a squeeze): if `max_loss` cannot fit the framed-table treatment at both
              densities and every breakpoint above `md`, **bounce to the conductor** — never shrink a
              column below its design width, never truncate `unlimited risk` / `unnamed shape` into a
              shared prefix, never go below the 11px floor.
Last gateway:  GATE C @ 2026-07-28 (CLOSED — spec approved; ledger rows appended @ gate C)
