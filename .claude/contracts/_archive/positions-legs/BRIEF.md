# positions-legs — brief

Goal:            Make a position **a set of legs** instead of a single option contract, and merge the
                 two position systems into one. Today `Position` IS a leg: `Strategy` is literally
                 `'long_call' | 'long_put'`, `side: 'long'` makes short unrepresentable, `strike` /
                 `expiration` / `right` are required so shares cannot exist, and P/L hardcodes the
                 ×100 option multiplier (`mark.ts:122`) so 100 shares would be wrong by exactly 100×.
                 Spreads, shares, short legs, calendars and condors are therefore not *unsupported* —
                 they are **unrepresentable**. This feature makes them expressible, retires the
                 duplicate `GhostTrade` system, and lands the naming convention
                 (`SimPosition` · `Leg` · `Order` · `PositionView`) in the SAME durable migration so
                 the store is migrated once, not twice.
Decision impact: Improves position management + exit decisions directly — a debit spread's real
                 breakeven and max loss are currently uncomputable, so the app cannot tell the trader
                 what they actually risk. Observed when a vertical, a covered call and 100 shares all
                 enter the portfolio, display correct net P/L, and group sensibly; and when the Ticker
                 page and the Positions page read the SAME store.
Feasibility:     pass. Pure frontend + durable-schema work; no vendor call, no backend change, no new
                 dependency. The migration mechanism already exists and is proven (`resolveDurable`
                 read-new-else-old + the shipped v1→v2 chain). **The risk is not technical difficulty
                 — it is data loss**, which is exactly what the governing invariant addresses.
Effort:          L
Invariant watch: **loss-free-durable-migration** (HARD, and the reason this is L not M — it is the one
                 key promoted on SEVERITY, guarding ~5 localStorage stores that hold the entire trading
                 history with NO server backup; read-new-else-old, promote-forward, never-delete,
                 idempotent, never-throw, composing with the existing v1→v2 chain) ·
                 **additive-keeps-score-byte-identical** (FE-only; `apps/api` diff must be EMPTY —
                 positions are never a scoring input) · **no-real-order-path** (everything stays
                 SIMULATED; this feature adds NO broker and NO order path — `Order` stays unqualified
                 precisely to encode that) · **single-shared-sim-entry-dialog** (as narrowed 2026-07-16:
                 the shared entry dialog gains multi-leg as a SIM variant; a real-money surface stays a
                 structurally separate component, out of scope here) · **digested-labels-not-raw-dump**
                 (`StructureKind` is DERIVED from leg shape, never stored — so condors/calendars need no
                 enum change and no future migration) · **theme-token-discipline** (any new UI is
                 token-only, dark/light parity) · **live-vs-static-isolation** (the P/L degrade
                 behaviour on an SSE drop must survive the refactor unchanged).
Context tags:    frontend,features,decisions,ghost-trade
Source:          Owner brainstorm 2026-07-27, sequencing the Webull-import track: the importer must not
                 be built against a model that cannot represent what it imports. Resolves DECISION_QUEUE
                 **Q2** (the split decision log — the two `appendDecision` definitions collapse here).
                 Explicitly OUT of scope, left as seams: `BrokerPosition` (nothing produces one yet —
                 adding the type now would be speculative; it lands as a NEW type later, needing no
                 further migration), the broker adapter, and the Webull connection (feasibility-gated,
                 triggers system-6).
