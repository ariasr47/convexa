# ai-rec-backtest-orders — brief
Goal:            Make the AI recommendation ACTIONABLE and TESTABLE, sim-only. (a) A scripted
                 mock/scenario provider for the in-app AI rec so every answer shape the tool can produce
                 (trade long_call/long_put with entry/stop/target, no_trade, conditional "enter on a
                 break of X / on confluence Y", plus every degraded status) can be simulated on demand —
                 the harness for backtesting rec quality without LLM cost. (b) An "Act on this rec"
                 flow: accepting a rec creates a SIMULATED ORDER that encodes the rec's plan —
                 conditional entry trigger(s), limit price, stop, target — surfaced in a new Orders
                 widget; when an order's trigger/limit is satisfied by LIVE data it fills into the
                 existing positions portfolio (the shipped pending→filled/cancelled lifecycle is the
                 seed pattern). The existing pre-filled-dialog Accept stays as the manual path; an
                 order is the automated-bookkeeping path. No real order, ever.
Decision impact: Closes the read→act→review loop: the trader can (1) backtest whether the AI's calls
                 are worth following before risking attention on them, (2) act on a rec without
                 babysitting the entry, and (3) audit fills vs the rec's stated plan. Observed via the
                 Orders widget + the decision-record linkage from rec fingerprint → order → position.
Feasibility:     pass — builds on shipped seams: `StubLLMProvider`/`AI_REC_STUB` (backend LLM seam),
                 `ai-rec` panel + `prefill.ts`, the positions entry resolver's resting-limit lifecycle
                 (`positions/entry.ts`), page-scoped SSE for trigger evaluation. Open architect
                 questions: order-store locus (client-local durable, mirroring positions, is the
                 default — server order store would be a new stateful surface), trigger-evaluation
                 scope (orders for tickers whose SSE isn't open — evaluate only while a stream is up,
                 honest "waiting for live data" state), scenario-provider locus (backend scripted
                 provider vs FE mock at the network boundary — backend preferred, it already has the
                 seam + keyless stub precedent).
Effort:          L
Invariant watch: no-real-order-path (orders are SIM bookkeeping, mandatory confirm at order creation,
                 zero broker path); additive-keeps-score-byte-identical (orders/scenarios never feed
                 signals/score/tier/fingerprint); best-effort-isolated-or-null (scenario provider +
                 order engine degrade alone); live-vs-static-isolation (a trigger/limit NEVER fires off
                 a frozen/stale mark — live cross only, like the shipped resting limit);
                 server-side-gate-enforcement (order-creating writes ride the sim-trade gate).
Context tags:    architecture,ai,features,decisions
Entry point:     architect-first — the order-engine shape, trigger grammar (how rich is "wait for a
                 break of X"?), store locus, and scenario-provider seam are structural calls that bound
                 everything downstream; PM then scopes the product surface on that skeleton.
Source:          Owner directive 2026-07-01 item 4; subsumes BACKLOG §B "AI-rec Accept → tracked
                 position — full build-out" (raised 2026-07-01); realizes the ai-rec deferred seams
                 (scenario/backtest + acceptance-outcome analytics precursor).
