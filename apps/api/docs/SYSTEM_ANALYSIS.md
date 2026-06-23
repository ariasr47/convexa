# SYSTEM ANALYSIS — the team-of-AI-roles as a solo-dev build tool

> A living, candid analysis of the GammaFlow delivery system (`.claude/ORCHESTRATOR.md`,
> `ROLE_LAUNCH_PROMPTS.md`, `COMPRESSOR_PROMPTS.md`, `DECISION_LEDGER.md`, `GAMMAFLOW_CONTEXT.md`,
> `OPEN_THREADS.md`, `BACKLOG.md`) **as a tool for one person to build large software fast**.
> Purpose: drive continuous improvement of the *system itself*. The roadmap (§7) is mirrored into
> `.claude/BACKLOG.md` §E so GATE I can cull and schedule these like any other feature.
> Last revised: 2026-06-23. Treat as a default, not canon — revise it as the system evolves.

## 1. What it actually is (precise characterization)
Strip the metaphors and it is **a state machine over the filesystem that uses LLM sessions as
stateless, role-typed pure functions, with the human as the scheduler and the contracts as the
type system.**
- **State lives in files, never in chat:** the constant ground truth, the per-feature `contracts/`
  folder, the decision ledger, the per-feature `_MANIFEST.md`, the global `OPEN_THREADS.md`.
- **Each session is a near-pure function:** `output_contract = role(ground_truth, inbound_contract)`
  — no chat memory, reproducible from its inputs.
- **The orchestrator is a router, not a worker:** it audits files, compresses, writes the next
  inbound contract, updates the manifest + ledger, and prints the next launch prompt.
- **The Interface Contract is a typed bus:** the two executioners are decoupled processes that
  communicate only through it.

The reason this works: it engineers around the single biggest LLM failure mode — **context rot** —
by making the model stateless and pushing all durable state into reviewable artifacts.

## 2. Load-bearing mechanisms (what's genuinely clever)
1. **Context isolation as a feature.** Fresh sessions can't drift, self-contradict, or smuggle a
   detail into a big decision. Continuity traded for reliability — the right trade for engineering.
2. **The single-writer Interface Contract** — the keystone. It lets backend and frontend be built
   *blind to each other* and still integrate. Most multi-agent setups fail exactly here.
3. **Compression as decision-distillation.** Strip deliberation, keep decisions: each handoff stays
   cheap and dense; the loss (the debate) is exactly what you want to drop.
4. **The gateway router makes it adaptive, not waterfall** — GATE M (math fast-path), GATE V (visual
   fast-path), GATE Z (bounce), PM-first vs Architect-first. The path bends to the work.
5. **The Decision Ledger** — capture every binding decision → graduate at ≥3 features (≥2 if binding)
   → single-source the prose into canon → every future brief inherits it. An automatic
   Architecture-Decision-Record with a promotion rule. This is what makes the system get *wiser*,
   not merely *bigger*.

## 3. Why it's a real force-multiplier for one person
A solo dev usually loses four things a team has; this externalizes all four:

| A team gives you… | The system's substitute |
|---|---|
| Separation of concerns | Lanes + role launch prompts |
| Review | Every handoff is a diffable contract, read before code exists |
| Institutional memory | The Decision Ledger's capture → graduate → reuse loop |
| Process discipline | The gateway catalog (fast-path / bounce / ship) |

The deep win: **you hold only the gateway map in your head, not the whole system.** Cognitive load
stays ~constant as the codebase grows, because the system's knowledge lives in the ground truth +
ledger, not in your memory. That is the scaling lever for a solo builder.

## 4. Weaknesses & failure modes (where to aim improvement)
1. **You are the bottleneck and single point of failure.** The orchestrator is *you* announcing
   transitions; throughput is capped by your attention as conductor + integrator. GATE I **culls to
   ONE feature** — "parallel feature lanes" is aspirational; today it's strictly serial per feature.
2. **Nothing is mechanically enforced.** Lanes, "strip deliberation," "both lanes bind to the
   interface" are *trusted*, not enforced. Only review catches a lane violation.
3. **Integration is asserted, not verified.** Nothing checks that the built backend actually emits
   what the frontend consumes. Drift is caught by a human, late, by reading code. The most dangerous
   unguarded seam.
4. **Builders mark their own homework.** The executioner prompts self-verify — the one place the
   "no marking your own homework" principle breaks. (QA is the highest-value missing role.)
5. **The compounding memory compounds mistakes too.** Promotion is gated on *recurrence*, and
   recurrence ≠ correctness. A wrong-but-repeated decision graduates into canon and then constrains
   every future feature. No "reality demotes it" path — only manual GATE Z.
6. **The economics quietly worsen as you succeed.** Every session re-reads the whole ground truth
   cold, and graduation *grows* that file. More shipped features → fatter ground truth → every future
   session is more expensive, even for a one-line fix. The compounding-memory win carries a
   compounding token cost.
7. **GATE S verification is a human checkbox** — "verified end-to-end" means "I looked"; nothing runs
   the acceptance criteria.
8. **It rots silently if a step is skipped.** It only works if you actually run the gateways,
   compressors, and ledger updates. The process needs an operator as disciplined as itself, with no
   alarm when you drift.

## 5. The deepest risk: correlated error
The blog sells "a team of fresh experts." But every role is **the same base model wearing a
different brief.** A human team has *diverse* minds — a blind spot in the architect gets caught by
the PM. This "team" has **one mind's blind spots replicated five times.** Fresh context and lanes
reduce drift and authority-creep; they do **not** create genuine diversity of judgement. If the
model is systematically wrong about something, every role is wrong the same way and hands the error
down the line, each one dutifully "in its lane."

The fix is structurally adversarial roles — a **QA** role incentivised to *break* the work, and a
**Security/red-team** role — ideally on a **different model**, so its blind spots don't correlate
with the builders'. This is the highest-leverage upgrade to *correctness* (as opposed to speed).

## 6. Where it sits on the scaling curve
- Excellent at the current scale: solo, one feature at a time, several features shipped.
- **Linear in human attention per feature** — you are O(features) busy as conductor.
- **Token cost ≈ O(sessions × ground-truth size)** — re-reading the whole canon every session.
- To go faster you must: (a) remove the human from the conductor loop, (b) shard the ground truth
  (retrieval, not whole-file), (c) add mechanical gates (linter, integration check, QA), (d) realize
  true parallel feature lanes — **and (a) must come last** (see §7).

## 7. Improvement roadmap (mirrored to BACKLOG.md §E)
Ordered by leverage, deliberately sequenced.
- **Tier 1 — mechanize what's trusted (correctness):** interface-conformance check (BE emits == FE
  consumes); a QA/verify role with teeth (confirms ACs point-by-point, fixes nothing, bounces gaps);
  a contract linter (gate-check as a script/hook); lane enforcement via role subagents with tool
  allowlists.
- **Tier 2 — fix the economics:** shard the ground truth + ledger so a session loads only the canon
  its `BRIEF.md` cites (retrieval). Decouples per-session cost from total system size.
- **Tier 3 — diversify judgement:** a Security/red-team role on a *different* model, to break
  correlated error. **⏸ DEFERRED until live (2026-06-23)** — pre-live the different-model cost/overhead
  outweighs the payoff (no real data/exposure/untrusted input yet); re-promote on the "going live"
  trigger. Tiers 4–5 may proceed ahead of it (this defers Tier 3, not the later tiers).
- **Tier 4 — close the flywheel:** wire observability metrics back into GATE I (Discovery harvests
  from reality), and add a **demotion path** so a promoted invariant contradicted by a runtime signal
  or a bounce gets demoted — memory tracks truth, not just recurrence.
- **Tier 5 — remove yourself as conductor:** turn the orchestrator into a subagent-driven pipeline
  where you *approve* gates instead of *running* them, and realize parallel feature lanes.

**Binding sequencing constraint:** Tier 5 is last. What makes the system trustworthy *today* is the
human reviewing every handoff. Automate the conductor before installing the mechanical gates (Tier 1)
and adversarial roles (Tier 3) and you remove the main error-correction mechanism while keeping the
correlated-error problem — a faster way to ship confident mistakes. **Install the guardrails the
human currently provides before you remove the human.**

## 8. One-line verdict
A legitimately strong solo-dev pattern — *stateless model, stateful files, human as scheduler,
contracts as types, recurrence as memory.* Its ceiling is set by two unsolved problems: **correlated
error** (one model, all hats) and **you-as-bottleneck** (conductor + sole reviewer). Everything on
the roadmap serves those two.
