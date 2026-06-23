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

- **system-1 · Interface-conformance check** — a script/test that verifies the built backend EMITS
  exactly the fields/types/presence the frontend CONSUMES, both checked against `INTERFACE_CONTRACT.md`.
  *Impact:* closes the most dangerous unguarded seam — integration drift currently caught only by a
  human reading code, late. *Value H · Effort M.* **Note:** runs at/after GATE U·X and at GATE S;
  complements, doesn't replace, the contract.
- **system-2 · QA / Verify role (a 6th role, with teeth)** — a fresh session that takes the shipped
  feature + its acceptance criteria and confirms point-by-point that each holds; it **fixes nothing**,
  bouncing any gap back via GATE Z. Adds a gate between the executioners and GATE S. *Impact:* ends
  "builders mark their own homework" — the one place the no-self-review principle breaks. *Value H ·
  Effort M.* **Invariant watch:** QA stays in lane (verifies, never repairs).
- **system-3 · Contract linter (mechanical gate-check)** — a script/hook the Orchestrator runs at each
  gateway: required sections present, lane-keyword violations flagged (e.g. endpoints in an
  ARCHITECTURE_CONTRACT, server internals in a FRONTEND file), every AC maps to a component state.
  *Impact:* gate-checks stop being pure human judgement; a malformed handoff can't advance. *Value M ·
  Effort M.* Pairs with the §B ledger-crossing hook (same hook surface).
- **system-4 · Lane enforcement via role subagents** — define `.claude/agents/*` per role with tool
  allowlists so e.g. the Architect *cannot* Write code and a builder *cannot* rewrite a contract;
  optional path-guard hooks for finer control. *Impact:* lanes become enforced, not trusted. *Value M ·
  Effort M.* **Note:** keeps each role's fresh-context isolation (subagents start clean).
- **system-5 · Ground-truth + ledger sharding (retrieval)** — load only the canon a feature's
  `BRIEF.md` cites instead of re-reading the whole `GAMMAFLOW_CONTEXT.md` every session. *Impact:*
  decouples per-session token cost from total system size — the economics that otherwise worsen as you
  ship more (SYSTEM_ANALYSIS §4.6/§6). *Value H (cost) · Effort M–L.* **Invariant watch:** every
  session must still see the invariants it could violate — shard by relevance, never drop a binding rule.
- **system-6 · Adversarial Security/red-team role (different model)** — a session whose whole mindset is
  "what could be made to go wrong?": least-privilege per role, injection from fetched/external content,
  data leakage — run on a **different base model** so its blind spots don't correlate with the builders'.
  *Impact:* the only structural fix for correlated error (one model, all hats — SYSTEM_ANALYSIS §5).
  *Value H (correctness) · Effort M.*
- **system-7 · Promoted-canon demotion path** — a trigger that demotes a graduated invariant (via
  GATE Z) when a runtime signal or a later bounce contradicts it, so the ledger tracks *truth*, not just
  *recurrence*. *Impact:* stops compounding memory from calcifying a wrong-but-repeated decision into
  law. *Value M · Effort S–M.* Follow-on to the Decision Ledger.
- **system-8 · Close the flywheel (observability → GATE I)** — add the shipped metrics as a first-class
  GATE I harvest source so Discovery grooms from measured reality, not guesses. *Impact:* the
  build→measure→discover loop becomes real. *Value M · Effort S.* **Depends-on:** `latency-visualizer`
  / the observability readout (§A/§D).
- **system-9 · Orchestrator-as-subagent-pipeline + parallel feature lanes** — automate the conductor so
  you *approve* gates instead of *running* them, and run several feature lanes at once (shared
  OPEN_THREADS to avoid collisions). *Impact:* removes the human-as-bottleneck. *Value H · Effort L.*
  **Binding:** do NOT promote before system-1…system-6 land (see the sequencing note above) — this one
  removes the human review the system currently leans on for correctness.
