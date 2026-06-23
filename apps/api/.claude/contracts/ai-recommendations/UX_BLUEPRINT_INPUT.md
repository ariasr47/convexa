# SESSION-TRANSITION → UX/Tech-Writer — AI Recommendations

> Producer: Product Manager (architect-first §2). Consumer: UX/Tech-Writer (next; authors UX_BLUEPRINT.md).
> Reader has ONLY `.claude/GAMMAFLOW_CONTEXT.md` + this file (+ PRODUCT_CONTRACT.md / ARCHITECTURE_CONTRACT.md
> in the same folder). No chat history. This compresses the product layer into exactly what UX needs to act.
> Lane reminder: the PM emits no code/math/endpoints/UI-layout; UX owns layout, copy, component states.

## What you're designing (one line)
A dashboard, on-demand **"Get AI recommendation"** surface (current ticker) that frames the **active
persona** + a **structured export of already-computed state**, calls the LLM, and renders a **risk-first
ENTRY rec** that the trader can **Accept** (pre-fill the existing ghost-trade entry dialog, confirm) —
plus the augmented **manual copy-paste export** as the always-available floor.

## The component states you must design (every one is a traced AC)
- **Idle / Available** — action enabled (guardrails say fresh edge).
- **No fresh edge** — action de-emphasized + "no fresh edge" message, but an explicit **override-and-query** is still allowed (override still costs cooldown + cap).
- **Cooling down** — action disabled, visible time-remaining (default 60s after a query).
- **Daily cap reached** — action disabled, "daily AI limit reached — resets {when}" (calm, not an error); manual export still works.
- **Loading / thinking** — multi-second in-flight state; rec renders **whole** (no token streaming in v1).
- **Recommendation rendered** — risk-first fields, risk + invalidation foremost; **persona attribution** + **"as of {snapshot}"** pin.
- **`no_trade`** — legitimate outcome with rationale, visually distinct from error; **no Accept**.
- **Stale** — a newer bundle arrived → "older data — get a fresh recommendation"; never auto-refreshes.
- **AI unavailable** — error/timeout → "AI unavailable — try again" (retry respects cooldown+cap); rest of dashboard untouched.
- **No key / feature off** — in-app action cleanly inert ("in-app AI not configured"); manual export/copy-paste still works.
- **Accept → pre-filled entry dialog** — reuse the **shipped `TradeEntryDialog`** pre-filled; all fields editable; size is a suggestion; **confirm required**; cancel = no trade.
- **Manual export view** — view/copy exactly what would be / was sent (the complete, auditable egress list); available even when the in-app call is not.

## Product decisions resolved (so you don't re-decide)
1. **Rec UI scope** — dedicated, on-demand, current-ticker, independently-nullable rec surface. Layout/copy = yours. Must never read as an auto-executed instruction.
2. **Gating** — three states: Available / No-fresh-edge (override allowed, de-emphasized) / Cooling-down.
3. **Caps** — cooldown **60s** + daily cap **50/day** (operator-configurable defaults); over-limit = calm explained blocked state, never an error; manual export always available.
4. **Accept pre-fill** — pre-fill side/structure, strike, expiry, stop (from invalidation), target (from exit), suggested size; **all editable**; **mandatory confirm**; no Accept for `no_trade`.
5. **Error/no_trade/over-cap/no-key UX** — four distinct, non-alarming, isolated states (above).
6. **Manual export** — independently surfaceable, same export feeds both paths, available even when in-app call isn't; it is the auditable "what leaves the machine" list.
7. **Streaming** — **whole-rec render + loading state** (no token streaming in v1; streaming is future-dated).
8. **Attribution/staleness** — persona attribution + "as of {snapshot}" pin; stale-on-newer-bundle; **SSE drop does NOT touch the rec**; never auto-refresh.
9. **Persona at query time** — default = active persona; **per-query override allowed** (non-scoring, doesn't change the active persona, no recompute).

## Binding constraints you must not violate (promoted-canon keys this feature touches)
- **Relaxed `ai-external-no-llm`** — LLM is a best-effort, isolated, gated, **advisory CONSUMER** of already-computed state; manual hand-off remains valid + augmented. Never gospel; explicit Accept is the discipline.
- **`[additive-keeps-score-byte-identical]`** — rec/persona-framing NEVER feed signals/score/tier/gate/ai_eval/fingerprint; the dashboard numbers are byte-identical with/without the feature, requested or not.
- **`[best-effort-isolated-or-null]`** — any AI error/timeout/over-cap/no-key degrades the **rec surface alone**; never an HTTP error on the bundle/SSE/page; no blank page.
- **`[live-vs-static-isolation]`** — the rec is a **static artifact pinned to its snapshot**: newer bundle → stale; SSE drop → untouched; never silently refreshes/re-runs. (NOT a live-derived tile.)
- **`[no-real-order-path]`** — Accept = paper-sim ghost trade only; `SIMULATED` everywhere; advisory; explicit confirm; no broker order ever.
- **Over-trading gate binding** — guardrails + cooldown + cap; risk-first output (risk-first, `no_trade` valid+common) never softened.
- **Persona single-sourced + non-scoring**; **server-side key only** (never in the browser); **single-ticker on-demand**; **no recompute / no new fetch / no new math**; **honest live-vs-stale**.

## The 18 ACs are your "Tests to write" seed
Each AC in PRODUCT_CONTRACT.md (§Acceptance criteria, AC1–AC18) is one required FE behavioral test QA
traces at GATE Q. Your FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix = ACs × the component states
above × the promoted invariants. Don't drop any; an untestable case is a GATE Z bounce, not a silent cut.

## What's left explicitly to you (UX) and downstream
- All **layout, placement, copy, visual treatment** of every state above.
- How prominent the **per-query persona picker** is (a control vs tucked into the action).
- How the **manual export** is surfaced (view/copy affordance) and how its "what leaves the machine" honesty reads.
- Endpoint signatures, payload/field names, SSE semantics, the rate-cap mechanism, the exact gating signal wiring = **Interface** (after you).
