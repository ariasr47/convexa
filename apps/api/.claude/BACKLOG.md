# BACKLOG — idea pool + roadmap discovery (standing reference)

> The divergent half of roadmap-advancement. The Orchestrator's **GATE I** (see
> `.claude/ORCHESTRATOR.md` §3) grooms this pool, culls to ONE next feature, and emits that as a
> per-feature `BRIEF.md` that seeds the pipeline. This file holds the candidates; it is NOT a
> commitment — promotion to a feature folder happens only through GATE I.
>
> Seeded from the deferred/open items already in `OPEN_THREADS.md`. Keep it current: when a thread
> ships, migrate its "deferred seams" here; when an item is promoted, mark it `→ promoted`.

## How an item earns promotion (the cull, from GATE I)
1. **Decision-impact test** — name the *trading decision* it improves and *how you'd observe* the
   improvement. No answer ⇒ parked, not promoted. (Mirrors the "AC observable without code" rule
   and the AI over-trading gate — we resist shiny features the same way we resist over-trading.)
2. **Feasibility gate** — data coverage + math invariants. Blocked items name their blocker.
3. **Score** — Value (H/M/L to the trading edge) × Effort (S/M/L); flag any locked invariant touched.

## Standing harvest sources (where the next wave comes from)
- **Deferred items** — `OPEN_THREADS.md` §7 + the "deferred seams" line inside each shipped thread.
- **Open strategic questions** — `OPEN_THREADS.md` §1/§9 (vendor + overnight).
- **Usage friction** — what's painful in your own daily trading use (capture as you hit it).
- **Downstream-AI quality** — does the `strategy_prompt` / `reassessment_prompt` hand-off produce
  better calls? Gaps here are first-class features.
- **Lifted constraints** — when a data/vendor limit lifts (e.g. overnight coverage), the features it
  was blocking become buildable.

---

## Last GATE I — 2026-06-23 (owner request: in-app AI recommendations)
**Chosen → `ai-recommendations`** — owner-directed (not a queue-drain cull): an in-app query to a
downstream LLM (latest Claude) for a **risk-first ENTRY recommendation**, fed the active persona's
assembled prompt + a **JSON export of the ticker's computed state**, rendered in the dashboard; the
manual hand-off is retained + augmented by the same JSON export; on-demand with `ai_eval` guardrails.
**Reverses promoted canon `ai-external-no-llm` by explicit owner decision** (GammaFlow may now call an
LLM via an isolated, gated, consumer-only path) → pending formal demotion at GATE S. Trading-decision
cull: passes (improves the entry decision). Effort L · entry = architect-first. Brief at
`.claude/contracts/ai-recommendations/BRIEF.md`; routed to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (pull: local latency visualization)
**Chosen → `latency-visualizer`** — carve the *visualization* slice out of §D "Observability
extensions," pulled by a concrete need (watch the already-measured bundle-stage latency locally +
free, pre-live). Brief at `.claude/contracts/latency-visualizer/BRIEF.md`; entry = architect-first
(stateless-client vs persisted-history is the pivotal call). Trading-decision cull N/A (operator
tooling — judged on operational value). The export/alerting/persistence rest of §D stays parked.

## Last GATE I — 2026-06-22 (pipeline had drained; 4 features archived)
**Chosen → `trader-personas`** (the only candidate clearing both decision-impact + feasibility;
Value H × Effort M). Brief at `.claude/contracts/trader-personas/BRIEF.md`; entry = architect-first.
Cull verdicts (so the next discovery doesn't re-litigate):
- **Parked, cleanliness/no observed friction:** flip-anchoring (user confirmed flip is fine),
  wall-distance guard (hasn't shown up live).
- **Blocked-on a decision/measurement (not a build):** vendor/overnight (cost-eval decision first),
  flip fixed-IV modeling (measure the divergence first).
- **Parked, scope/justification:** ghost-trade→real path (scope shift off paper-sim), multi-session
  dark-pool (dark-pool is locked context-only, never directional — §8), observability extensions
  (operator-facing, not a trading decision), multi-ticker scanner (revisits the single-ticker
  decision; needs re-justification).

## Pool

### A. Queued / in-mind (decided to build next)
- **ai-recommendations** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/ai-recommendations/`. In-app
  downstream-LLM query for a risk-first **entry** rec (active-persona prompt + JSON state export →
  rendered rec; Accept → paper-sim ghost trade; manual export floor). GammaFlow's first LLM call —
  isolated/gated/advisory consumer; score byte-identical. **DEMOTED `ai-external-no-llm`** (system-7,
  narrowed). Backend `eec3a3a`; frontend `42212f5`+`a2f6ae3`. QA PASS (Sonnet, de-correlated; E3 traceability
  catch resolved). Seams → OPEN_THREADS §7b. GATE Z reconciled the conformance-spec convention → system-12.
- **latency-visualizer** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/latency-visualizer/`.
  FE-only (`NO_BACKEND_CHANGE`): a local, ephemeral `LatencyTrend` card atop `/_ops/metrics` that
  trends the existing `GET /api/_metrics` windowed snapshots (per-stage/total/cache/vendor-latency
  p50/p95/max + headroom) via one stable poll loop (the page's single fetcher) + a bounded in-browser
  ring buffer; honest gaps / restart-break / stale-repeat, non-alerting, local Export only. Held
  `[operator-vs-trader-path-separation]` + `[best-effort-isolated-or-null]` (both logged at GATE S).
  **Parked (rest of §D):** OTel/Prometheus export, latency/headroom alert thresholds, persisted/
  cross-restart history, server-side store.
- **trader-personas** — `✓ SHIPPED + ARCHIVED (2026-06-22)` → `_archive/trader-personas/`. Both lanes
  landed (backend `1026190`; frontend `6dcdbe1`/`1233718`); persona reframes the AI hand-off only,
  gate/score/tier/fingerprint byte-identical, FE-rendered assembly. Seams it left → section D.
  (`OPEN_THREADS` §7)

### B. Ready candidates (feasible, small, unscheduled)
- **Live gamma-flip anchoring** — outside RTH, anchor the flip search to `gex_spot` (close) not the
  live mid, so a gapped pre-market anchor can't select a different crossing; also drop the per-tick
  `Gamma flip $…` INFO log to debug. *Impact:* a steadier, more consistent displayed flip across
  sessions. *Value M-low (you've said the displayed flip is fine) · Effort S.* Cleanliness. (`OPEN_THREADS` §7)
- **Wall-selection distance/DTE guard** — keep a deep-OTM round-number LEAP strike from becoming
  "the wall" far from spot. *Impact:* wall levels stay near the tradable zone. *Value M · Effort S.*
  **Invariant watch:** walls stay the gamma-based max/min net-GEX strike — a guard, not a redefinition.
  Bite only if it shows up live. (`OPEN_THREADS` §7)
- **Decision-Ledger crossing-detection hook** *(methodology/tooling — not a trading feature)* —
  mechanize the DETECT step of compounding memory: a `settings.json` hook (or small script) that
  tallies `DECISION_LEDGER.md` keys and flags when one crosses the promotion threshold (≥3 shipped
  features / ≥2 if binding), so at GATE S the Orchestrator is *told* "key X just crossed" instead of
  tallying by hand. *Impact:* orchestration reliability — a promotion can't be silently missed; the
  compounding loop fires even on a tired/long session. *Value M · Effort S.* **Note:** the
  decision-impact cull (trading-decision test) is **N/A** here — judge it on loop-fidelity, not edge;
  the promotion *judgement* + prose still stay with the Orchestrator (the hook only counts). Follow-on
  to the just-shipped Decision Ledger (`.claude/DECISION_LEDGER.md`; ORCHESTRATOR §3a).

### C. Strategic / blocked (high value, gated on a decision or heavy lift)
- **Data-vendor decision + overnight coverage** — Massive vs Databento (Blue Ocean overnight, full
  OPRA) vs Webull (cheap overnight underlying, no options). *Impact:* unlocks the overnight price gap
  — the core coverage hole. *Value H · Effort L.* **Blocked-on:** the cost/eval decision itself
  (verify whether Databento Standard $199 includes Blue Ocean). This is a *decision* before a build.
  (`OPEN_THREADS` §1/§2/§9)
- **Multi-session dark-pool accumulation map** — beyond the current bounded recent window; needs a
  heavier batched pull. *Impact:* see block accumulation across sessions, not just the last hour.
  *Value M · Effort L.* Future. (`OPEN_THREADS` §7/§9)
- **Flip fixed-IV-under-spot-move modeling** — the latent choice of holding IV fixed while repricing
  across the spot grid in the flip search. *Impact:* flip fidelity. *Value TBD · Effort L.*
  **Blocked-on:** measure the divergence first before any calibration (per §9 — judged immaterial so far).

### D. Shipped-feature seams (park until a concrete need pulls them)
- **Ghost-trade → real path** — broker `FillSource`/`PositionStore`, `BundleFeed`+clock replay,
  recorded-verdict reassessment, server-side trade store. *Note:* implies leaving paper-sim for a real
  order path — a deliberate scope shift, not an increment. Park until going live. (`OPEN_THREADS` §5)
- **Observability extensions** — OTel/Prometheus export, latency/headroom alert thresholds,
  persisted cross-restart baselines. *Value M · Effort M.* Pull when operating the service in earnest.
  (`OPEN_THREADS` §6) **Note:** the *local visualization* slice was carved out → `latency-visualizer`
  (§A, promoted 2026-06-23); what remains here is **export + alerting + cross-restart persistence**
  (the parts that imply external infra / going-live ops).
- **Multi-ticker scanner** — the observability baseline data supports it. *Value M · Effort M-L.*
  **Invariant watch:** revisits the deliberate "single-ticker, on-demand" decision (the watchlist scan
  was dropped for being too slow) — re-justify before promoting. (`OPEN_THREADS` §6, `GAMMAFLOW_CONTEXT` §5)
- **Persona data single-sourcing (FE↔BE reconciliation)** — the backend ships the canonical
  decomposed template + 7 presets at `GET /api/personas` (transport filed as a late interface
  amendment, after the FE froze), but the FE **embeds** a faithful copy and assembles client-side, so
  the canonical preset/prompt data is **dual-sourced** (drift risk). *Impact:* an operator edit to a
  preset/prompt would reach the AI briefing instead of silently diverging — concrete need = first time
  presets are edited server-side. *Fix:* FE hydrates presets/template from `GET /api/personas`, keeping
  the embedded copy as offline/assembly-failure fallback. *Value M · Effort S.* Behaviour is correct
  today; not blocking. (`OPEN_THREADS` §7)
- **Persona conservative-disposition cleanup** — UX/FE gave `conservative` the *softened* disposition
  text, but the backend Verification required it to contain "prone to greed"; resolved pragmatically as
  a **superset** (harsh phrase + map text). *Fix:* decide whether conservative should be softened-only
  and amend the prompt template + contract if so. *Value L · Effort S.* (`OPEN_THREADS` §7)
- **Persona deferred extensions** — multi-device sync, operator-shared persona library, richer
  customization knobs, per-persona acceptance analytics (decision-history harvest). *Value M · Effort
  M.* Park until a concrete need pulls them. (`OPEN_THREADS` §7)

### E. Methodology / system-of-building improvements *(improve the AI-role system itself, not the trading product)*
> Source: `docs/SYSTEM_ANALYSIS.md` (2026-06-23). The trading-decision cull is **N/A** for this class —
> judge each on **correctness, throughput, or cost of the build system**, not trading edge (same
> convention as the §B Decision-Ledger hook). Sibling already in the pool: the **Decision-Ledger
> crossing-detection hook** (§B) is the DETECT-step mechanization and belongs to this class.
> **Binding sequencing:** *system-1 … system-6 land before system-9* — automating the conductor before
> the mechanical gates + adversarial roles removes the human review that currently provides
> error-correction (SYSTEM_ANALYSIS §7).

- **system-1 · Interface-conformance check** — `✓ LANDED (2026-06-23, runtime variant) →
  .claude/tools/interface_conformance.py`. Each `INTERFACE_CONTRACT.md` embeds a machine-checkable
  `## Conformance spec` ```json block (endpoints → required field paths/types/presence); the tool hits
  the live backend (`--url`) — or a captured `--sample` for CI/offline — and validates the emitted JSON
  against it (dot-paths, `name[]` array fan-out, `type|null` unions, `?` optional). A FAIL = the live BE
  omits/mistypes a field the interface promises (= what the FE consumes). Wired into **GATE Q** (QA runs
  it; FAIL → GATE Z to Backend) + GATE U·X (interface must embed the spec) + the §3 linter (WARNs if a
  locked interface lacks the block — system-3 ensures the spec EXISTS, system-1 ensures the live
  response MATCHES it). Tested vs the real `/api/_metrics` shape (pass / array-fanout / drift-fail).
  *Value H · Effort M.* **Deferred:** static FE-type cross-check (`@org/api` TS vs the interface) — the
  runtime path already proves BE-emits ⊇ interface; FE-consumes ⊆ interface is held by the FE binding +
  the linter's interface-binding check.
- **system-2 · QA / Verify role (a 6th role, with teeth)** — `✓ LANDED (2026-06-23)`: new **GATE Q**
  (ORCHESTRATOR §3, between the executioners and GATE S) + role launch prompt (`ROLE_LAUNCH_PROMPTS.md`
  §6) + subagent (`.claude/agents/qa-verify.md`, tools: Read/Grep/Glob/Bash/Write — no Edit) + manifest
  `QA (GATE Q):` field + the §6 invariant "GATE S requires a passing `QA_REPORT.md`." A fresh session
  confirms each AC point-by-point, **fixes nothing**, bounces gaps via GATE Z; GATE Q re-runs on the
  fix. *Impact:* ends "builders mark their own homework." *Value H · Effort M.* **Invariant watch:** QA
  stays in lane (verifies, never repairs). **Best run on a DIFFERENT model** than the builders — partial
  down-payment on system-6 (correlated-error fix).
- **system-3 · Contract linter (mechanical gate-check)** — `✓ LANDED (2026-06-23) →
  .claude/tools/contract_lint.py`; wired into ORCHESTRATOR §0 step 7 (runs every gateway, ERROR blocks
  the handoff). **Implemented checks:** _MANIFEST present + required keys; files the manifest marks
  locked/draft exist; execution contracts bind to INTERFACE_CONTRACT (NO_*_CHANGE stubs exempt); BRIEF
  has all required fields; NEW-endpoint-in-architect/PM-lane flagged (existing endpoints exempt via
  ground-truth); server-internals-in-FE / UI-in-BE lane-purity warns; promoted-canon single-source
  (every ledger Promoted key has prose in GAMMAFLOW_CONTEXT §5). *Value M · Effort M.* Pairs with the
  §B ledger-crossing hook (same script surface). **Deferred extensions:** AC↔component-state mapping
  check (now tracked + broadened as **system-10**, AC↔test traceability); optional `settings.json`
  PreToolUse/Stop hook to auto-run it (offer made); the legacy 4 archived features predate `_MANIFEST.md`
  (flag only on `--all`, not on live gating).
- **system-4 · Lane enforcement via role subagents** — `✓ LANDED (2026-06-23, tools-allowlist half)`:
  `.claude/agents/{gammaflow-architect,gammaflow-pm,gammaflow-ux,gammaflow-backend,gammaflow-frontend}.md`
  + the earlier `qa-verify.md`. Contract authors (architect/pm/ux) + QA have **no `Edit`/`Bash`** (cannot
  modify or run code); executioners get the build toolset (Read/Grep/Glob/Edit/Write/Bash). Wired into
  ROLE_LAUNCH intro + ORCHESTRATOR §1/§6. *Value M · Effort M.* Keeps each role's fresh-context
  isolation (subagents start clean).
- **system-4b · PreToolUse path-guard hooks** — `✓ LANDED (2026-06-23, cross-repo fence) →
  .claude/tools/path_guard.py + .claude/settings.json`. A PreToolUse hook on `Write|Edit|MultiEdit|
  NotebookEdit` blocks any write whose resolved target is OUTSIDE this repo root (exit 2) — so a session
  in the backend repo can't write the frontend repo or arbitrary disk paths (Reads are never blocked).
  Tested both directions; fail-open on malformed input. **Scope honesty:** a session-global hook can't
  see WHICH role/subagent is active, so it enforces the **cross-repo / out-of-repo** fence robustly but
  NOT per-role intra-repo rules (e.g. "the architect can't touch `src/`") — that residual stays on the
  tool-allowlist (no `Edit`) + the role prompt. **Mirror needed:** copy `path_guard.py` + the settings
  hook into `C:\Dev\gammaflow-web/.claude/` (identical; REPO_ROOT is computed per-repo) so the frontend
  repo fences symmetrically — done from a gammaflow-web session, not here (that write is what the fence
  forbids). *Value M · Effort S.* **Activation:** new `settings.json` ⇒ open `/hooks` once or restart.
- **system-5 · Ground-truth + ledger sharding (retrieval)** — `✓ LANDED (2026-06-23, logical-slice) →
  .claude/tools/context_for.py`. Each `## N.` section in `GAMMAFLOW_CONTEXT.md` carries an inline
  `<!-- shard: tags=...; always -->` annotation; the tool assembles the minimal pack from the BRIEF's
  `Context tags:` (+ Invariant-watch keys) + the always-load invariant floor (§3 math, §5
  decisions/promoted invariants). `--print` emits the pack; `--stat` shows savings (39–72% on current
  features, growing with the canon). **Single-source kept** (logical slice, no physical split → no drift,
  unlike the rejected fork). Added a `Context tags:` BRIEF field (ORCHESTRATOR §4a); wired into
  ROLE_LAUNCH intro + §6 invariant. *Value H (cost) · Effort M–L.* **Invariant honored:** §3+§5 are
  `always` — sharding never drops a binding rule. **Deferred:** ledger sharding (the Promoted-canon
  index is already compact, so minor); auto-deriving `Context tags` from the BRIEF's free text.
- **system-6 · Adversarial Security/red-team role (different model)** — `⏸ DEFERRED until live
  (decided 2026-06-23)`: pre-live, a different-model red-team adds model cost/overhead with low payoff —
  no real data, no external exposure, no untrusted input surface yet. **Re-promote on the "going live"
  lifted-constraint trigger** (handling real funds/data, public exposure, or untrusted external content).
  A session whose whole mindset is "what could be made to go wrong?": least-privilege per role, injection
  from fetched/external content, data leakage — run on a **different base model** so its blind spots
  don't correlate with the builders'. *Impact:* the only structural fix for correlated error (one model,
  all hats — SYSTEM_ANALYSIS §5). *Value H (correctness, once live) · Effort M.* **Note:** the QA role's
  "run on a different model" guidance is a partial pre-payment on the de-correlation benefit.
- **system-7 · Promoted-canon demotion path** — `✓ LANDED (2026-06-23)`: the inverse of graduation. A
  promoted invariant contradicted by reality (an accepted **GATE Z** amendment, or a **GATE Q**
  QA/conformance FAIL proving it false/over-general) is **demoted** — prose removed/narrowed in
  GAMMAFLOW_CONTEXT §5 + OPEN_THREADS §9, key moved to the DECISION_LEDGER "Demoted" table with the
  contradicting evidence (earning rows retained as provenance). `contract_lint.py`'s canon check follows
  automatically (a demoted key leaves Promoted-canon). Wired: DECISION_LEDGER "Demoted" section + GATE Z
  "Demotion check" step + §6 invariant. **Bar mirrors promotion:** a one-off feature carve-out is an
  *exception*, not a demotion. *Impact:* stops compounding memory from calcifying a wrong-but-repeated
  decision into law (SYSTEM_ANALYSIS §4.5). *Value M · Effort S–M.*
- **system-8 · Close the flywheel (observability → GATE I)** — add the shipped metrics as a first-class
  GATE I harvest source so Discovery grooms from measured reality, not guesses. *Impact:* the
  build→measure→discover loop becomes real. *Value M · Effort S.* **Depends-on:** `latency-visualizer`
  / the observability readout (§A/§D).
- **system-9-lite · fresh-subagent-per-gateway** — `✓ ADOPTED (2026-06-23)`: run each role as a FRESH
  spawn of its `.claude/agents/gammaflow-*` subagent (+ `context_for.py` pack), discarded after each
  handoff — instead of long-lived role terminals that accumulate context. Captures the freshness +
  lane-fencing win with **no new infra and human review intact** (the conductor is still you). Wired into
  `ROLE_LAUNCH_PROMPTS.md` ("Running a role — the LITE path"). The on-ramp to full system-9.
- **system-9 · Orchestrator-as-subagent-pipeline + parallel feature lanes** — automate the conductor so
  you *approve* gates instead of *running* them, and run several feature lanes at once (shared
  OPEN_THREADS to avoid collisions). *Impact:* removes the human-as-bottleneck. *Value H · Effort L.*
  **Binding:** do NOT promote before system-1…system-6 land (see the sequencing note above) — this one
  removes the human review the system currently leans on for correctness; the **lite path above is the
  adopted interim** until then.
- **system-10 · Contract-linter AC↔test traceability check** — `PROPOSED (2026-06-23), unscheduled`.
  Mechanize the standing **FE-tests rule's** AC↔test traceability (GAMMAFLOW_CONTEXT §7; committed
  `d69e240`) that QA enforces by judgment today: extend `contract_lint.py` (system-3) so every
  `PRODUCT_CONTRACT` AC (and every required case in the FRONTEND_EXECUTION_CONTRACT "Tests to write"
  matrix) must map to **≥1 colocated `*.spec.tsx` test** — an uncovered AC fails the check even if the
  suite is green. **Resurrects system-3's own deferred AC↔component-state mapping extension.** *Impact:*
  an uncovered AC can't slip past a green suite; closes the residual that traceability is currently
  human-judged. *Value M · Effort M.* **Build-system class:** trading-decision cull **N/A** — judge on
  build-system correctness. **Design notes / depends-on:** (a) runs at **GATE Q (post-build)**, not the
  inter-role handoffs — the tests don't exist until the FE builds, so it's a QA-invoked mode of the
  linter, complementing the runtime conformance check (system-1); (b) needs a stable **AC-id/anchor
  convention** in `PRODUCT_CONTRACT` so an AC can be matched to a named test (likely the first sub-step);
  (c) **cross-repo read** — the linter runs in this repo but the specs live in `C:\Dev\gammaflow-web`
  (reads aren't fenced). Follow-on to the FE-tests rule + system-2/3.
- **system-11 · Cross-repo role-context on dispatch** — `PARKED for consideration (2026-06-23) — do NOT
  encode until decided`. Dispatching an executioner for the FRONTEND repo must use `spawn_task --cwd`
  (the Agent tool can't cross the path_guard fence — ORCHESTRATOR §2), which **bypasses the role
  framework**: no `gammaflow-frontend` lane/subagent, no `context_for.py` pack, no role launch prompt,
  and the chip is named by action, not role. **Question to settle:** should a cross-repo *executioner
  (feature)* brief be REQUIRED to (a) re-adopt the role — instruct the spawned session to read
  `ROLE_LAUNCH_PROMPTS.md §5` + the INTERFACE/FRONTEND_EXECUTION contracts + run
  `context_for.py {FEATURE} --print` itself — and (b) title the chip `gammaflow-frontend · {FEATURE}`
  for traceability (maintenance tasks keep the action-name)? *Impact:* closes the implicit "spawn_task
  drops the role context" hole so cross-repo feature work carries the same lane/context discipline as
  in-repo work. *Value M · Effort S (a convention + ORCHESTRATOR §2 edit; no code).* **Build-system
  class:** trading-decision cull **N/A**. **Origin:** raised 2026-06-23 after two *maintenance* tasks
  (test-tooling setup, path-guard parity) were dispatched ad-hoc with bespoke briefs; user deferred for
  further consideration. Relates to system-9-lite + the ORCHESTRATOR §2 cross-repo dispatch convention.
- **system-12 · system-1 standalone-spec standardization** — `DECIDED 2026-06-23 (standalone = canonical),
  partial`. The conformance spec drifted: docs say "embed a `## Conformance spec` ```json block in
  INTERFACE_CONTRACT.md," but the shipped precedent (`.claude/tools/conformance/api_metrics.json`) and the
  ONLY runnable form is a **standalone flat-schema file**. The UX (following the docs) embedded a rich
  nested block the tool can't run — heading `## 3. Conformance spec` breaks system-1's `##\s*Conformance
  spec` regex (yet system-3's linter accepted it: the two **disagree** on detection), and the nested
  enums/conditional/forbidden_fields schema isn't the tool's flat `{path_params,query,body,required}`.
  **Owner decision (2026-06-23):** the runnable spec is a committed standalone `.claude/tools/conformance/
  {feature}.json`; the interface's `## Conformance spec` section REFERENCES it (rich content stays as QA
  reference). **Done:** ai-recommendations interface points at its standalone spec; the backend added
  POST-body support to `interface_conformance.py` (additive, kept; `api_metrics.json` still passes).
  **Remaining (do before the next GATE U·X):** reconcile the authoring docs — `COMPRESSOR_PROMPTS #3`,
  `gammaflow-ux.md`, `ORCHESTRATOR §6 / GATE U·X / GATE Q`, `BACKLOG system-1` — to the standalone
  convention; tighten `contract_lint` M7 to verify the interface references an EXISTING standalone spec
  (it currently only string-matches "Conformance spec"); align the system-1 heading regex with system-3's
  looser detection so they agree. *Value M · Effort S–M.* **Build-system class:** trading-decision cull
  N/A. Surfaced by the backend executioner at the ai-recommendations fan-out (GATE Z).
