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
> Status note (2026-06-23): the Tier 1–2 + Tier 4-demotion mechanizations have **landed**, so most of
> the originally-identified weaknesses are now addressed. Each item is annotated with its current state;
> the two structural ones (you-as-bottleneck, correlated error) remain the real ceiling (§8).
1. **You are the bottleneck and single point of failure.** `[STILL OPEN]` The conductor is *you*
   announcing transitions; throughput is capped by your attention as conductor + integrator. GATE I
   **culls to ONE feature** — "parallel feature lanes" is aspirational; today it's strictly serial per
   feature. **system-9-lite** (fresh-subagent-per-gateway) is adopted, which moves the *role work* off
   you, but you still conduct; full **system-9** (orchestrator-as-pipeline + parallel lanes) is parked
   behind the go-live gate by the sequencing constraint (§7).
2. **Nothing is mechanically enforced.** `[MOSTLY ADDRESSED]` `contract_lint.py` (system-3) now blocks a
   handoff on a structural violation; lane-fenced subagents (system-4) + the `path_guard.py` PreToolUse
   hook (system-4b) mechanically stop an author from editing code and any session from writing outside
   its repo. **Residual:** per-role *intra*-repo rules (an author touching `src/`) and "strip
   deliberation" are still trusted, not enforced — a session-global hook can't see the active role.
3. **Integration is asserted, not verified.** `[ADDRESSED]` `interface_conformance.py` (system-1) runs
   the live backend's response against the `## Conformance spec` embedded in `INTERFACE_CONTRACT.md` at
   GATE Q (and now in the executioners' own pre-done self-check) — a FAIL bounces to Backend. The most
   dangerous unguarded seam is now guarded.
4. **Builders mark their own homework.** `[ADDRESSED]` The **QA/Verify role** (system-2, GATE Q) is a
   fresh session that confirms every AC point-by-point and **fixes nothing**, bouncing gaps via GATE Z;
   GATE S cannot fire without a passing `QA_REPORT.md`. Residual de-correlation work is system-6 (run QA
   on a *different* model) — deferred until live.
5. **The compounding memory compounds mistakes too.** `[ADDRESSED]` The **demotion path** (system-7) is
   the inverse of graduation: a promoted invariant contradicted by reality (an accepted GATE Z amendment
   or a GATE Q conformance/QA FAIL) is demoted — prose narrowed in canon, key moved to the ledger's
   "Demoted" table with evidence. Memory now tracks *truth*, not just recurrence. (Bar mirrors promotion:
   a one-off carve-out is an exception, not a demotion.)
6. **The economics quietly worsen as you succeed.** `[MITIGATED]` `context_for.py` (system-5) assembles a
   sharded pack — the always-load invariant floor (§3 math, §5 decisions) + the sections the BRIEF's
   `Context tags:` select — so a session loads only the canon it needs (39–72% savings on current
   features). **Residual:** the always-load floor still grows with graduation, so the floor's cost rises
   slowly; sharding decouples *per-session* cost from total canon size but doesn't make the floor free.
7. **GATE S verification is a human checkbox** — `[ADDRESSED]` superseded by item 4: "verified
   end-to-end" now means the QA role's observed point-by-point pass + the conformance check, not "I
   looked."
8. **It rots silently if a step is skipped.** `[STILL OPEN, REDUCED]` It still relies on you running the
   gateways, compressors, and ledger updates — but the linter now refuses a structurally incomplete
   handoff, and the `/conductor`, `/status`, `/gatecheck`, `/pack` slash commands make the steps
   one-shot. No alarm yet when you skip a *gateway* entirely (that's part of full system-9 + the
   ledger-crossing hook on the BACKLOG).

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
**Status (2026-06-23):** the *structural* half has landed — the **QA/Verify role** (system-2) is a
fresh, fixes-nothing inspector that gates the ship. But it currently runs on the **same base model** as
the builders, so it buys the no-marking-own-homework win without the full de-correlation win. The
*diversity* half — running QA (and a red-team) on a **different model** — is **system-6**, deliberately
**deferred until live**: pre-live there's no real data, external exposure, or untrusted-input surface,
so a different-model pass adds cost/overhead with low payoff. It re-promotes on the "going live" trigger.
So correlated error is *acknowledged and partly pre-paid*, not yet solved.

## 6. Where it sits on the scaling curve
- Excellent at the current scale: solo, one feature at a time, six features shipped.
- **Linear in human attention per feature** — you are O(features) busy as conductor. (system-9-lite
  offloads the role *work* to disposable subagents; the conducting is still yours.)
- **Token cost ≈ O(sessions × pack size), not × whole-canon size** — system-5 sharding (`context_for.py`)
  loads only the always-load floor + the BRIEF's tags, so per-session cost is decoupled from total canon
  size (the slowly-growing floor is the residual).
- The four levers, with status: (a) remove the human from the conductor loop `[full system-9, parked]`,
  (b) shard the ground truth `[LANDED, system-5]`, (c) add mechanical gates — linter, integration check,
  QA `[LANDED, system-1/2/3]`, (d) realize true parallel feature lanes `[parked with (a)]`. **(a)+(d)
  must come last** (see §7): they remove the human review that the rest of the system leans on.

## 7. Improvement roadmap (mirrored to BACKLOG.md §E)
Ordered by leverage, deliberately sequenced. Status as of 2026-06-23.
- **Tier 1 — mechanize what's trusted (correctness): `✓ LANDED`** — interface-conformance check
  (system-1, BE emits ⊇ FE consumes, run at GATE Q + executioner self-check); QA/verify role with teeth
  (system-2, GATE Q — confirms ACs point-by-point, fixes nothing, bounces gaps); contract linter
  (system-3, `contract_lint.py`, ERROR blocks the handoff); lane enforcement via role subagents +
  cross-repo path-guard hook (system-4/4b). **Residual:** per-role intra-repo fencing stays on the
  allowlist + prompt.
- **Tier 2 — fix the economics: `✓ LANDED`** — `context_for.py` (system-5) shards the ground truth by a
  logical slice (always-load invariant floor + the BRIEF's `Context tags:`), single-source kept. Ledger
  sharding deferred (the Promoted-canon index is already compact).
- **Tier 3 — diversify judgement: `⏸ DEFERRED until live (2026-06-23)`** — a Security/red-team role on a
  *different* model (system-6), to break correlated error. Pre-live the different-model cost/overhead
  outweighs the payoff (no real data/exposure/untrusted input yet); re-promote on the "going live"
  trigger. Tiers 4–5 may proceed ahead of it (this defers Tier 3, not the later tiers). The QA role's
  "run on a different model" guidance is the partial pre-payment.
- **Tier 4 — close the flywheel: `◑ PARTIAL`** — the **demotion path** has landed (system-7: a promoted
  invariant contradicted by a runtime signal or an accepted bounce gets demoted — memory tracks truth,
  not just recurrence). Still open: wiring observability metrics back into GATE I so Discovery harvests
  from measured reality, not guesses (**system-8**, depends on the shipped observability/latency readout).
- **Tier 5 — remove yourself as conductor: `◑ system-9-lite ADOPTED; full system-9 parked`** — the
  interim is adopted: each role runs as a fresh, disposable lane-fenced subagent (the freshness +
  lane-fencing win, human review intact). Full system-9 — orchestrator-as-pipeline where you *approve*
  gates instead of *running* them, plus parallel feature lanes — stays parked behind the go-live gate.

**Binding sequencing constraint:** Tier 5 is last. What makes the system trustworthy *today* is the
human reviewing every handoff. Automate the conductor before installing the mechanical gates (Tier 1)
and adversarial roles (Tier 3) and you remove the main error-correction mechanism while keeping the
correlated-error problem — a faster way to ship confident mistakes. **Install the guardrails the
human currently provides before you remove the human.**

## 8. One-line verdict
A legitimately strong solo-dev pattern — *stateless model, stateful files, human as scheduler,
contracts as types, recurrence as memory.* The Tier 1–2 + demotion mechanizations have closed the
*trusted-not-enforced* gaps (lanes, integration, QA, economics, memory-tracks-truth). Its ceiling is now
set by the two **structural** problems the roadmap can only partly touch pre-live: **correlated error**
(one model, all hats — partly pre-paid by QA, fully addressed only by a different-model red-team once
live) and **you-as-bottleneck** (conductor + sole reviewer — eased by system-9-lite, removed only by full
system-9, which is deliberately parked until the guardrails are proven). Everything remaining on the
roadmap serves those two.
