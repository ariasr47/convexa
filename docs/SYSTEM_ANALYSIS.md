# SYSTEM ANALYSIS — the team-of-AI-roles as a solo-dev build tool

> A living, candid analysis of the delivery system (`.claude/ORCHESTRATOR.md`,
> `ROLE_LAUNCH_PROMPTS.md`, `COMPRESSOR_PROMPTS.md`, `DECISION_LEDGER.md`, `PROJECT_CONTEXT.md`,
> `OPEN_THREADS.md`, `BACKLOG.md`) **as a tool for one person to build large software fast**.
> Purpose: drive continuous improvement of the *system itself*. The roadmap (§7) is mirrored into
> `.claude/BACKLOG.md` §E so GATE I can cull and schedule these like any other feature.
> Last revised: **2026-06-28**. Treat as a default, not canon — revise it as the system evolves.
>
> **2026-06-24 — the framework is now a reusable kit (system-13).** What was Convexa's `.claude/` is
> extracted into a standalone **delivery-kit** (separate repo); this project is **consumer #1**.
> Framework files are byte-identical across projects, all per-project coupling pushed into one seam
> (`.claude/project.json` + `PROJECT_CONTEXT.md`). The analysis below now covers two things — the system
> as a build tool **and** its new portability (§2.6, §4.9, §6, §7, §8).
>
> **2026-06-28 — first stateful + security-sensitive feature, and the first hard evidence on correlated
> error.** `user-accounts` (email/password + Google auth, server-side sessions, per-user settings; the
> eleventh feature shipped) is the first that isn't a stateless additive read — it stands up a
> credential/session store. The method absorbed it **unchanged**: the same one-way-leaf isolation that keeps
> the score byte-identical, plus an invariant **carve-out** (§4.2, §5). The headline, though, is correctness
> evidence — its QA pass, run on a **different base model** than the builders, **caught a real defect they
> had shipped** (a sign-in gate enforced only in the browser, never server-side). First concrete payoff of
> the de-correlation pre-payment (§5); it also arms the **going-live trigger** for the system-6 red-team
> (Track B connects real accounts).

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
6. **The framework/project decoupling (2026-06-24, system-13).** The whole framework is reduced to one
   project-owned seam — `.claude/project.json` + `PROJECT_CONTEXT.md` — so every other framework file is
   **byte-identical across projects**. That property is what makes install (kit → project) and extract
   (project → kit) a *plain folder copy* in both directions: no templating, no re-substitution, no merge.
   And the discipline is **mechanically guaranteed**, not trusted: `kit_lint.mjs` scans framework files
   for project-coupling tokens and aborts an extract if any reappear. It is the *same structural move*
   the system already makes elsewhere — the Interface Contract (single-writer typed bus), `contract_lint`
   (structure), `interface_conformance` (integration), `path_guard` (write fence): **take a discipline
   you'd otherwise trust a human to hold, and turn it into a mechanical gate.** Here the discipline is
   "the framework stays project-neutral," and it caught a real re-coupling during the extraction itself.

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
   handoff on a structural violation; lane-fenced subagents (system-4) + the `path_guard.js` PreToolUse
   hook (system-4b) mechanically stop an author from editing code and any session from writing outside
   its repo. **Residual:** per-role *intra*-repo rules (an author touching `src/`) and "strip
   deliberation" are still trusted, not enforced — a session-global hook can't see the active role.
   **Illustration (2026-06-28):** the linter is *structural*, so it cannot catch a *semantic* invariant like
   "this gate is enforced server-side, not just in the client." On `user-accounts` exactly that gap shipped
   and was caught by the **QA role** (system-2), not a mechanical gate — a reminder that some properties are
   inherently the adversarial inspector's to catch, not the linter's (and the system logged a new watch-list
   key, `server-side-gate-enforcement`, straight from the catch).
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
   ledger-crossing hook on the BACKLOG). **New enabler (2026-06-28):** the repo now has a GitHub remote, so
   the checks that already exist (linter, conformance, test suite) can move from *locally, when you remember*
   to *automatically, on every push* via a GitHub Actions workflow (queued on the BACKLOG alongside the
   containerize item). CI doesn't remove you-as-conductor, but it closes the "I skipped a check that already
   exists" half of this residual.
9. **The kit introduces its own new seams (2026-06-24, system-13).** `[NEW — partly mitigated]` Making
   the framework reusable created exactly one class of problem it didn't have before: **two copies that
   must stay aligned.** Honest residuals: (a) **version skew** — `.claude/kit.version` records what a
   consumer is on, but nothing *alerts* when it's behind the kit; update is a manual re-run of
   `install.mjs`. (b) **divergence** — if two consumers refine the same framework file, `extract` is
   last-writer-wins; there's no three-way merge. (c) **`project.json` is now a single point of
   misconfiguration** the conductor + every tool depend on — a wrong or half-filled seam degrades the
   gates *silently* (e.g. a bad `backend.python` just makes a gate "not run"); there's no `project.json`
   validator yet. (d) the kit's **own scripts are untested** (install/extract/kit_lint were verified by
   hand at extraction, not by a suite). **Mitigated by:** `kit_lint` (keeps the framework genuinely
   generic, so the copies *can* stay byte-identical) and the byte-identical invariant itself (a clean
   extract is a no-op diff, which makes drift visible in `git diff`). The meta-point: the system applied
   its own "mechanize the trusted invariant" rule to the decoupling but **not yet to the kit's own
   lifecycle** — version/skew/config are still trusted, the way integration used to be before system-1.

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

**Evidence (2026-06-28) — the pre-payment is no longer hypothetical.** On `user-accounts`, QA ran on a
**different base model (Sonnet)** than the **Opus** builders and **caught a real, security-relevant defect
they had shipped**: the sign-in gate on the simulated-positions write actions was enforced **only in the
frontend** — the UI prompted for login, but the action never called the server-side gate the backend had
actually built, so a bypassed client check would have let the write through. One model wearing every hat had
replicated the same blind spot across design, build, and self-test; a *different* vantage point caught it in
a single pass — exactly the failure mode this section predicts, and the first time the partial fix
demonstrably earned its keep. It *strengthens* the case for funding the full fix at go-live: if a different
model catches a real bug as a **side-effect** of QA, a different model whose **whole job** is to break
things will catch more. (Characteristically, the system also turned the catch into a rule — it logged a new
watch-list invariant, `server-side-gate-enforcement`: "an access gate on an action must be enforced
server-side, not in the client." The flywheel manufacturing its own next guardrail from a failure.)

## 6. Where it sits on the scaling curve
- Excellent at the current scale: solo, one feature at a time, **eleven features shipped** — including
  (2026-06-28) the first that is **stateful and security-sensitive** (`user-accounts`: a credential/session
  store). The pattern absorbed it unchanged — same one-way-leaf isolation, plus an invariant carve-out —
  evidence it generalizes past the stateless additive reads it cut its teeth on.
- **A new axis as of 2026-06-24: reuse across *projects*, not just features.** Until now every scaling
  statement was *within* one project (cost per feature, attention per feature). The kit extraction adds a
  second axis — the *methodology itself* now compounds across projects: a framework refinement made while
  building anything flows back via `extract` and out to every consumer via `install`. The Decision Ledger
  made the system wiser per *feature*; the kit makes it wiser per *project*. This is a genuine
  force-multiplier increase, but note it's **orthogonal**: it multiplies reuse, it does **not** touch the
  two structural ceilings in §8 (correlated error, you-as-bottleneck) — those are per-build properties the
  kit copies into every new project unchanged.
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
  "run on a different model" guidance is the partial pre-payment. **Update (2026-06-28):** the trigger is now
  in sight — `user-accounts` shipped real credentials/sessions and Track B (`broker-connect`) will arm
  "going live" — and the partial pre-payment has now **caught a real defect** (§5), turning the case for
  system-6 from theoretical to evidenced.
- **Tier 4 — close the flywheel: `◑ PARTIAL`** — the **demotion path** has landed (system-7: a promoted
  invariant contradicted by a runtime signal or an accepted bounce gets demoted — memory tracks truth,
  not just recurrence). Still open: wiring observability metrics back into GATE I so Discovery harvests
  from measured reality, not guesses (**system-8**, depends on the shipped observability/latency readout).
- **Tier 5 — remove yourself as conductor: `◑ system-9-lite ADOPTED; full system-9 parked`** — the
  interim is adopted: each role runs as a fresh, disposable lane-fenced subagent (the freshness +
  lane-fencing win, human review intact). Full system-9 — orchestrator-as-pipeline where you *approve*
  gates instead of *running* them, plus parallel feature lanes — stays parked behind the go-live gate.
- **Portability — extract the framework into a reusable kit: `✓ LANDED (2026-06-24, system-13)`** — the
  framework is now a standalone kit; this project is consumer #1; all coupling lives in
  `.claude/project.json` + `PROJECT_CONTEXT.md`; `kit_lint` mechanically guards the byte-identical
  invariant. **Off the tier sequence** (it's an orthogonal axis — reuse, not correctness or
  automation), so it didn't have to wait behind Tier 5. **Next on this axis:** mechanize the kit's own
  lifecycle the way the build pipeline is mechanized — a version-skew check (consumer vs kit), a
  `project.json` validator, and tests for install/extract/kit_lint (see §4.9 residuals).

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
(one model, all hats — partly pre-paid by QA and, **as of 2026-06-28, demonstrably so** — a different-model
QA pass caught a real shipped defect (§5) — fully addressed only by a different-model red-team once live) and **you-as-bottleneck** (conductor + sole reviewer — eased by system-9-lite, removed only by full
system-9, which is deliberately parked until the guardrails are proven). Everything remaining on the
roadmap serves those two. As of 2026-06-24 the pattern is also **portable** — extracted into a reusable
kit so it compounds across projects, not just features — which raises its value as a *tool* without
moving either ceiling: every new project inherits the same strengths *and* the same two structural
limits. The kit added one new discipline of its own (keep the copies aligned), and characteristically
the system already mechanized the hard half of it (`kit_lint`) while leaving the lifecycle half
(version/skew/config) trusted — the next thing to mechanize.
