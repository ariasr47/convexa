# ai-recommendations — brief

Goal:            Add an in-app action to query a downstream LLM (latest Claude) for a **risk-first
                 ENTRY recommendation** on the current ticker, and render it in the dashboard in a
                 UX-friendly way. The query sends two things as the agent's context: (1) the chosen
                 trader **persona's** assembled prompt (from the existing persona hand-off), and (2) a
                 **JSON export of the relevant computed state** for that ticker — the GEX profile /
                 walls / flip / magnet, plus DEX, Vol/OI, IV skew, term structure, live fields,
                 dark-pool context, and signals/opportunity_tier. The existing **manual copy-paste
                 hand-off stays** and is augmented by the same JSON state export (so the external path
                 gains the structured context it lacks today). Querying is **on-demand but gated by
                 guardrails**: the UI honors `ai_eval` (de-emphasized / "no fresh edge" when not ready)
                 and applies a cooldown/rate-limit so it can't become a firehose.

Decision impact: Improves the "should I enter, and how (risk-first)?" decision by giving an integrated,
                 persona-aware AI read **in-app** instead of manual copy-paste. Observed as a rendered
                 risk-first recommendation (entry / stop / targets / sizing per the `strategy_prompt`
                 schema) appearing on the dashboard after a query, attributed to the active persona and
                 the bundle snapshot it was generated from.

Feasibility:     pass. Buildable but introduces GammaFlow's FIRST LLM integration: API key/secret
                 management, market-data **egress** to an external API, cost + rate-limiting,
                 multi-second latency (vs the 60s cached bundle), optional token streaming, and
                 timeout/failure isolation. Hallucination risk is real (a confident-wrong trade rec is
                 high-stakes) → the risk-first output contract must survive, never presented as gospel.
                 Model: default to latest Claude (Opus 4.8); the BACKEND lane consults the `claude-api`
                 skill for model id / structured-output / streaming specifics. Security: this is
                 "going-live-adjacent" (data egress + a generated-content surface) and may re-trigger
                 the deferred **system-6** red-team consideration — Architect should weigh least-
                 privilege secret handling + exactly what state leaves the machine.

Effort:          L — new external integration + secret handling + a state→JSON context exporter +
                 the in-app call path + gate integration + UX rendering; first time GammaFlow calls an LLM.

Invariant watch:
                 - **RELAXES `ai-external-no-llm`** (promoted canon — CONTEXT §8 / DECISION_LEDGER) by
                   explicit OWNER DECISION (2026-06-23): GammaFlow MAY now call an LLM via an
                   **isolated, opt-in, gated** path; the external/manual hand-off remains valid. This is
                   a deliberate canon relaxation (not a one-off carve-out) → the §8/§9 prose narrows +
                   the ledger key moves/annotates at **GATE S** (system-7). The Architect MUST restate
                   the NEW boundary (GammaFlow may call an LLM, but only as a best-effort, isolated,
                   gated CONSUMER of already-computed state).
                 - `additive-keeps-score-byte-identical` — the AI call is a pure CONSUMER of state; it
                   must NEVER feed `signals` / `opportunity_score` / `opportunity_tier` / the gate /
                   `state_fingerprint`. Score byte-identical with and without the feature.
                 - `best-effort-isolated-or-null` — an LLM timeout / error / rate-limit yields a
                   graceful "unavailable — try again" state; never breaks the bundle, SSE, or the rest
                   of the page.
                 - `live-vs-static-isolation` — a recommendation is pinned to the bundle snapshot it was
                   generated from; show its as-of timestamp + honest staleness (a rec does NOT silently
                   refresh on an SSE drop).
                 - over-trading gate (`ai_eval.ready/changed`) — the query UI honors it (guardrails +
                   cooldown); preserve the risk-first output contract.
                 - persona — source the canonical decomposed template + presets from `GET /api/personas`
                   (resolves the persona dual-sourcing flag — the FE embed becomes offline fallback only).

Context tags:    ai,personas,architecture,backend,api,signals,features,observability
                 (context_for.py loads these + the always-load floor §3 math, §5 decisions/invariants).

Entry point:     architect-first — the dominant uncertainty is feasibility/architecture: WHERE the LLM
                 call lives (backend proxy vs FE), secret + egress handling, the state→JSON context
                 contract, gate integration, failure isolation, cost/latency. PM layers product after.

Source:          User request (2026-06-23 Discovery). Builds on the shipped **trader-personas** hand-off
                 (the persona prompt assembly already exists; missing = the JSON state export + the
                 actual LLM call + UX). Relates to OPEN_THREADS §7 persona reconciliation flag.
