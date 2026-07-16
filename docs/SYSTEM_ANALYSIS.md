# SYSTEM ANALYSIS — the team-of-AI-roles as a solo-dev build tool

> A living, candid analysis of the delivery system (`.claude/ORCHESTRATOR.md`,
> `ROLE_LAUNCH_PROMPTS.md`, `COMPRESSOR_PROMPTS.md`, `DECISION_LEDGER.md`, `PROJECT_CONTEXT.md`,
> `OPEN_THREADS.md`, `BACKLOG.md`) **as a tool for one person to build large software fast**.
> Purpose: drive continuous improvement of the _system itself_. The roadmap (§7) is mirrored into
> `.claude/BACKLOG.md` §E so GATE I can cull and schedule these like any other feature.
> Last revised: **2026-07-16**. Treat as a default, not canon — revise it as the system evolves.
>
> **2026-07-16 — the strongest evidence yet for this document's own two theses, plus one genuinely new
> failure class.** Twenty-four features are now shipped and archived (the count below was eleven). An
> owner-requested **canon review** found that the compounding memory — the thing §2.5 is proudest of — had
> silently **frozen the product's core judgment for 210 commits** (§4.10, the one-sided-invariant gap: a
> correct rule with no counterpart becomes a fossil, and the demotion path can't catch it because the rule
> is never *contradicted*, only obeyed). The same review added a **severity promotion path** to the ledger
> (recurrence is a proxy for importance, and it was mis-ranking — a *dialog* had become law while
> data-loss protection waited) — and that path **validated itself the same day** (§6). The next ship,
> `outcome-ledger`, closed the loop this document had no name for: the product now **measures its own
> judgment** (is the opportunity score any good?) — the flywheel's Measure station, built for the product
> itself. Its pipeline fired the amendment bounce **four times, every one a real defect, every one raised
> by a downstream lane refusing to decide outside its lane** (§5) — and the de-correlated QA caught the
> builders' gaps while the **human conductor caught the QA's own** (a fabricated headline count; §5). And
> the kit produced the new failure class: a standing-rule change (the 2026-07-13 risk-based testing
> amendment) landed in **2 of the 5 framework files that state the rule**, shipping a release in which the
> kit **contradicts itself** — nothing checks the framework's *internal* consistency (§4.9).
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
   _blind to each other_ and still integrate. Most multi-agent setups fail exactly here.
3. **Compression as decision-distillation.** Strip deliberation, keep decisions: each handoff stays
   cheap and dense; the loss (the debate) is exactly what you want to drop.
4. **The gateway router makes it adaptive, not waterfall** — GATE M (math fast-path), GATE V (visual
   fast-path), GATE Z (bounce), PM-first vs Architect-first. The path bends to the work.
5. **The Decision Ledger** — capture every binding decision → graduate at ≥3 features (≥2 if binding)
   → single-source the prose into canon → every future brief inherits it. An automatic
   Architecture-Decision-Record with a promotion rule. This is what makes the system get _wiser_,
   not merely _bigger_.
6. **The framework/project decoupling (2026-06-24, system-13).** The whole framework is reduced to one
   project-owned seam — `.claude/project.json` + `PROJECT_CONTEXT.md` — so every other framework file is
   **byte-identical across projects**. That property is what makes install (kit → project) and extract
   (project → kit) a _plain folder copy_ in both directions: no templating, no re-substitution, no merge.
   And the discipline is **mechanically guaranteed**, not trusted: `kit_lint.mjs` scans framework files
   for project-coupling tokens and aborts an extract if any reappear. It is the _same structural move_
   the system already makes elsewhere — the Interface Contract (single-writer typed bus), `contract_lint`
   (structure), `interface_conformance` (integration), `path_guard` (write fence): **take a discipline
   you'd otherwise trust a human to hold, and turn it into a mechanical gate.** Here the discipline is
   "the framework stays project-neutral," and it caught a real re-coupling during the extraction itself.

## 3. Why it's a real force-multiplier for one person

A solo dev usually loses four things a team has; this externalizes all four:

| A team gives you…      | The system's substitute                                       |
| ---------------------- | ------------------------------------------------------------- |
| Separation of concerns | Lanes + role launch prompts                                   |
| Review                 | Every handoff is a diffable contract, read before code exists |
| Institutional memory   | The Decision Ledger's capture → graduate → reuse loop         |
| Process discipline     | The gateway catalog (fast-path / bounce / ship)               |

The deep win: **you hold only the gateway map in your head, not the whole system.** Cognitive load
stays ~constant as the codebase grows, because the system's knowledge lives in the ground truth +
ledger, not in your memory. That is the scaling lever for a solo builder.

## 4. Weaknesses & failure modes (where to aim improvement)

> Status note (2026-06-23): the Tier 1–2 + Tier 4-demotion mechanizations have **landed**, so most of
> the originally-identified weaknesses are now addressed. Each item is annotated with its current state;
> the two structural ones (you-as-bottleneck, correlated error) remain the real ceiling (§8).

1. **You are the bottleneck and single point of failure.** `[STILL OPEN]` The conductor is _you_
   announcing transitions; throughput is capped by your attention as conductor + integrator. GATE I
   **culls to ONE feature** — "parallel feature lanes" is aspirational; today it's strictly serial per
   feature. **system-9-lite** (fresh-subagent-per-gateway) is adopted, which moves the _role work_ off
   you, but you still conduct; full **system-9** (orchestrator-as-pipeline + parallel lanes) is parked
   behind the go-live gate by the sequencing constraint (§7).
2. **Nothing is mechanically enforced.** `[MOSTLY ADDRESSED]` `contract_lint.py` (system-3) now blocks a
   handoff on a structural violation; lane-fenced subagents (system-4) + the `path_guard.js` PreToolUse
   hook (system-4b) mechanically stop an author from editing code and any session from writing outside
   its repo. **Residual:** per-role _intra_-repo rules (an author touching `src/`) and "strip
   deliberation" are still trusted, not enforced — a session-global hook can't see the active role.
   **Illustration (2026-06-28):** the linter is _structural_, so it cannot catch a _semantic_ invariant like
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
   on a _different_ model) — deferred until live.
5. **The compounding memory compounds mistakes too.** `[ADDRESSED — then found INCOMPLETE, see item 10]`
   The **demotion path** (system-7) is the inverse of graduation: a promoted invariant contradicted by
   reality (an accepted GATE Z amendment or a GATE Q conformance/QA FAIL) is demoted — prose narrowed in
   canon, key moved to the ledger's "Demoted" table with evidence. Memory now tracks _truth_, not just
   recurrence. (Bar mirrors promotion: a one-off carve-out is an exception, not a demotion.)
   **2026-07-16:** demotion turned out to cover only _half_ the ways memory goes wrong — it fires when a
   rule is *contradicted*, and a rule that is **correct but one-sided** is never contradicted. See item 10.
6. **The economics quietly worsen as you succeed.** `[MITIGATED]` `context_for.py` (system-5) assembles a
   sharded pack — the always-load invariant floor (§3 math, §5 decisions) + the sections the BRIEF's
   `Context tags:` select — so a session loads only the canon it needs (39–72% savings on current
   features). **Residual:** the always-load floor still grows with graduation, so the floor's cost rises
   slowly; sharding decouples _per-session_ cost from total canon size but doesn't make the floor free.
7. **GATE S verification is a human checkbox** — `[ADDRESSED]` superseded by item 4: "verified
   end-to-end" now means the QA role's observed point-by-point pass + the conformance check, not "I
   looked."
8. **It rots silently if a step is skipped.** `[STILL OPEN, REDUCED]` It still relies on you running the
   gateways, compressors, and ledger updates — but the linter now refuses a structurally incomplete
   handoff, and the `/conductor`, `/status`, `/gatecheck`, `/pack` slash commands make the steps
   one-shot. No alarm yet when you skip a _gateway_ entirely (that's part of full system-9 + the
   ledger-crossing hook on the BACKLOG). **New enabler (2026-06-28):** the repo now has a GitHub remote, so
   the checks that already exist (linter, conformance, test suite) can move from _locally, when you remember_
   to _automatically, on every push_ via a GitHub Actions workflow (queued on the BACKLOG alongside the
   containerize item). CI doesn't remove you-as-conductor, but it closes the "I skipped a check that already
   exists" half of this residual.
9. **The kit introduces its own new seams (2026-06-24, system-13).** `[NEW — partly mitigated]` Making
   the framework reusable created exactly one class of problem it didn't have before: **two copies that
   must stay aligned.** Honest residuals: (a) **version skew** — `.claude/kit.version` records what a
   consumer is on, but nothing _alerts_ when it's behind the kit; update is a manual re-run of
   `install.mjs`. (b) **divergence** — if two consumers refine the same framework file, `extract` is
   last-writer-wins; there's no three-way merge. (c) **`project.json` is now a single point of
   misconfiguration** the conductor + every tool depend on — a wrong or half-filled seam degrades the
   gates _silently_ (e.g. a bad `backend.python` just makes a gate "not run"); there's no `project.json`
   validator yet. (d) the kit's **own scripts are untested** (install/extract/kit_lint were verified by
   hand at extraction, not by a suite). **Mitigated by:** `kit_lint` (keeps the framework genuinely
   generic, so the copies _can_ stay byte-identical) and the byte-identical invariant itself (a clean
   extract is a no-op diff, which makes drift visible in `git diff`). The meta-point: the system applied
   its own "mechanize the trusted invariant" rule to the decoupling but **not yet to the kit's own
   lifecycle** — version/skew/config are still trusted, the way integration used to be before system-1.
   **2026-07-16 — residual (a) bit for real, and a THIRD failure class appeared that none of these
   predicted.** Consumer #1 sat on kit **0.3.1** while the kit was at **0.3.2**, and nothing said so. And
   new: **a standing-rule change is a multi-file edit, and nothing verifies it landed everywhere.** The
   2026-07-13 risk-based testing amendment was applied to **2 of the 5** framework files that state the
   rule — so a release *titled after the new rule* shipped a kit in which `ORCHESTRATOR.md` says *"not
   'one named test per AC'"* while `ROLE_LAUNCH_PROMPTS.md` tells every PM the opposite. `kit_lint`
   cannot catch it — it scans for project-coupling tokens, not internal consistency. Found only because a
   conductor had to override the stale prompt **twice in one session**. Logged in `KIT_BACKLOG` §0 with a
   proposed fix (a retired-phrasings scan — the same mechanize-the-invariant move, pointed inward).
10. **The ratchet has no counterpart (the one-sided-invariant gap).** `[NEW 2026-07-16 — the meatiest
   finding since the original analysis]` The orchestrator sells the compounding memory with the line
   *"each ship can only **add** to the constraint envelope the next feature inherits."* That is also a
   **failure mode**. An invariant that is correct but **one-sided** — "feature X must NOT touch artifact
   Y" — accumulates precedent every ship, and with no companion rule saying *how Y may deliberately
   change*, it silently **freezes Y**. Nobody decides the freeze; the envelope just never opens. The
   demotion path (item 5) is structurally blind to it: a one-sided rule is never *contradicted* — it is
   *obeyed*, feature after feature, until the artifact it protects is fossilized. **The evidence is not
   hypothetical:** `additive-keeps-score-byte-identical` — promoted 2026-06-22, correct, never once
   violated — froze the product's core scoring judgment for **210 commits**, during which **eight**
   enrichment features shipped that were structurally forbidden from improving it (the score cannot
   distinguish rich from cheap premium while the IV-rank band that names exactly that difference sits in
   the same payload, unreachable). The fix was a **counterpart rule**
   (`score-change-is-deliberate-and-measured`: the artifact MAY change — via an explicit feature, a
   stated rationale, a **measured before/after**, a version bump) plus the `outcome-ledger` feature to
   make "measured" possible at all. The memory model needs **three operations, not two**: **promote**
   (recurrence or severity), **demote** (contradicted), **counterpart** (one-sided). The third is landed
   in this consumer and queued for the kit (`KIT_BACKLOG` §B). Related same-review fix: the promotion
   rule itself was mis-ranking — recurrence is a *proxy* for importance, and it had made a **dialog**
   canon at 2 instances while data-loss protection waited at 1. A **severity path**
   (catastrophic + irreversible ⇒ promote at 1 instance, with a written justification) was added — and
   validated itself the same day (§6).

## 5. The deepest risk: correlated error

The blog sells "a team of fresh experts." But every role is **the same base model wearing a
different brief.** A human team has _diverse_ minds — a blind spot in the architect gets caught by
the PM. This "team" has **one mind's blind spots replicated five times.** Fresh context and lanes
reduce drift and authority-creep; they do **not** create genuine diversity of judgement. If the
model is systematically wrong about something, every role is wrong the same way and hands the error
down the line, each one dutifully "in its lane."

The fix is structurally adversarial roles — a **QA** role incentivised to _break_ the work, and a
**Security/red-team** role — ideally on a **different model**, so its blind spots don't correlate
with the builders'. This is the highest-leverage upgrade to _correctness_ (as opposed to speed).
**Status (2026-06-23):** the _structural_ half has landed — the **QA/Verify role** (system-2) is a
fresh, fixes-nothing inspector that gates the ship. But it currently runs on the **same base model** as
the builders, so it buys the no-marking-own-homework win without the full de-correlation win. The
_diversity_ half — running QA (and a red-team) on a **different model** — is **system-6**, deliberately
**deferred until live**: pre-live there's no real data, external exposure, or untrusted-input surface,
so a different-model pass adds cost/overhead with low payoff. It re-promotes on the "going live" trigger.
So correlated error is _acknowledged and partly pre-paid_, not yet solved.

**Evidence (2026-06-28) — the pre-payment is no longer hypothetical.** On `user-accounts`, QA ran on a
**different base model (Sonnet)** than the **Opus** builders and **caught a real, security-relevant defect
they had shipped**: the sign-in gate on the simulated-positions write actions was enforced **only in the
frontend** — the UI prompted for login, but the action never called the server-side gate the backend had
actually built, so a bypassed client check would have let the write through. One model wearing every hat had
replicated the same blind spot across design, build, and self-test; a _different_ vantage point caught it in
a single pass — exactly the failure mode this section predicts, and the first time the partial fix
demonstrably earned its keep. It _strengthens_ the case for funding the full fix at go-live: if a different
model catches a real bug as a **side-effect** of QA, a different model whose **whole job** is to break
things will catch more. (Characteristically, the system also turned the catch into a rule — it logged a new
watch-list invariant, `server-side-gate-enforcement`: "an access gate on an action must be enforced
server-side, not in the client." The flywheel manufacturing its own next guardrail from a failure.)

**More evidence (2026-07-16) — and an honest twist.** The de-correlated QA is now routine and kept paying:
on `outcome-ledger` a fresh Sonnet inspector re-ran every gate itself (804/804 tests, the empty backend
diff, the mutation-tested source-scan) rather than trusting the builders' self-report, and passed the
feature 46/46. The twist: **the inspector itself then fabricated a number** — its headline claimed *"52
PASS across the 52 numbered ACs"* when the contract defines 46. Coverage was complete (46 defined, 46
verdicted, a perfect 1:1 set match); the *count* was **generated rather than counted**, then repeated in
its summary unchecked. It was caught by the **human conductor cross-checking the report against the
contract** — and QA's own post-mortem is the sharpest line in the incident: *"a QA artifact that asserts a
number it didn't verify has no standing to demand that the FE lane's tests actually bite."* Two lessons.
First, de-correlation is not a hierarchy — **every layer of checking is itself a language model with the
same failure modes**, and today the last check is still the human. Second, the fix is the usual one:
mechanize it (an AC↔verification-evidence lint that cross-checks the QA table against the contract's
defined AC ids — queued in `KIT_BACKLOG` §B; the manual catch was exactly that check, run by hand).

**And the lane discipline earned separate evidence the same week.** The `outcome-ledger` pipeline fired
the amendment bounce **four times** (architect ×2, PM, UX) plus two copy rulings — and **every single one
was a real defect, raised by a downstream lane refusing to decide outside its own lane**: the FE lane
found the join rule excluded real closes and *refused to widen a rule it didn't own*; the fresh architect
who took that bounce proved the "obvious" widen was *itself* wrong (a replacement-less Roll writes an
`accept` that doesn't close — the naive fix would have counted a non-close as an exit and shipped green);
the PM's roll ruling and the UX copy rulings each caught the layer below mis-stating something. One more
structural point the same feature validated: **GATE Z amendments should go to a FRESH instance of the
owning role, not the authoring session** — the fresh architect didn't just accept the PM's amendments, it
found the contested structure could *never populate* and **deleted** it rather than patching around it. A
session defending its own work plausibly patches. That is the QA de-correlation argument applied to
self-amendment, and it is now queued for the kit's GATE Z prose.

## 6. Where it sits on the scaling curve

- Excellent at the current scale: solo, one feature at a time, **twenty-four features shipped and
  archived** — including (2026-06-28) the first stateful + security-sensitive one (`user-accounts`), a
  full deploy (Railway + Cloudflare Pages, live), and (2026-07-16) `outcome-ledger`, the first feature
  whose *subject is the product's own judgment*. The pattern has absorbed every shape thrown at it —
  stateless additive reads, a credential store, infra fast-paths, an FE-only re-skin program, and now a
  measurement loop — without a structural change.
- **A new axis as of 2026-07-16: the product measures itself.** `outcome-ledger` harvests the decision
  records the app already writes and reports hit-rate/expectancy by tier/setup/persona — i.e. the flywheel's
  **Measure** station, built *for the product* (the build-loop half of system-8 — observability metrics
  feeding GATE I — is still open). Notable for this analysis: the whole feature is the "mechanize the
  trusted invariant" move pointed at the *product's* claims instead of the build's — the score asserted it
  was good; now there is a gate that checks. And the **severity promotion path validated itself the same
  day it was added**: `loss-free-durable-migration` was promoted at 1 instance on severity (over the
  objection that recurrence was unmet), and the very next feature became its 2nd binding instance — it had
  to *refuse an import* rather than let the store APIs rewrite an unreadable blob. Under recurrence-only,
  the key would still have been waiting while the feature that needed it was built.
- **A new axis as of 2026-06-24: reuse across _projects_, not just features.** Until now every scaling
  statement was _within_ one project (cost per feature, attention per feature). The kit extraction adds a
  second axis — the _methodology itself_ now compounds across projects: a framework refinement made while
  building anything flows back via `extract` and out to every consumer via `install`. The Decision Ledger
  made the system wiser per _feature_; the kit makes it wiser per _project_. This is a genuine
  force-multiplier increase, but note it's **orthogonal**: it multiplies reuse, it does **not** touch the
  two structural ceilings in §8 (correlated error, you-as-bottleneck) — those are per-build properties the
  kit copies into every new project unchanged.
- **Linear in human attention per feature** — you are O(features) busy as conductor. (system-9-lite
  offloads the role _work_ to disposable subagents; the conducting is still yours.)
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
  _different_ model (system-6), to break correlated error. Pre-live the different-model cost/overhead
  outweighs the payoff (no real data/exposure/untrusted input yet); re-promote on the "going live"
  trigger. Tiers 4–5 may proceed ahead of it (this defers Tier 3, not the later tiers). The QA role's
  "run on a different model" guidance is the partial pre-payment. **Update (2026-06-28):** the trigger is now
  in sight — `user-accounts` shipped real credentials/sessions and Track B (`broker-connect`) will arm
  "going live" — and the partial pre-payment has now **caught a real defect** (§5), turning the case for
  system-6 from theoretical to evidenced.
- **Tier 4 — close the flywheel: `◑ PARTIAL, advanced 2026-07-16`** — the **demotion path** has landed
  (system-7), and the memory model has since grown its **third operation** (2026-07-16): the
  **counterpart** check for one-sided invariants (§4.10) plus a **severity** promotion path — promote
  (recurrence/severity) · demote (contradicted) · counterpart (one-sided). The **product half** of
  closing the loop has now shipped: `outcome-ledger` measures the product's own judgment (hit-rate by
  tier/setup/persona), so "is the score any good?" stopped being unanswerable. Still open: the
  **build-loop half** (**system-8** — observability metrics feeding GATE I so Discovery harvests from
  measured reality), and the testing rule refinement landed **2026-07-13**: QA's AC verification is now
  **risk-based** (verification mandatory for every AC; an automated *test* only where regression risk
  earns it — invariants, negative space, silent regressions; visible/intentional things verified by
  review, recorded as such) — replacing the blunter one-named-test-per-AC rule. **Caveat:** that
  amendment's incomplete propagation through the kit is the §4.9 self-contradiction — the rule is right,
  the rollout exposed a new gap.
- **Tier 5 — remove yourself as conductor: `◑ system-9-lite ADOPTED; full system-9 parked`** — the
  interim is adopted: each role runs as a fresh, disposable lane-fenced subagent (the freshness +
  lane-fencing win, human review intact). Full system-9 — orchestrator-as-pipeline where you _approve_
  gates instead of _running_ them, plus parallel feature lanes — stays parked behind the go-live gate.
- **Portability — extract the framework into a reusable kit: `✓ LANDED (2026-06-24, system-13)`** — the
  framework is now a standalone kit; this project is consumer #1; all coupling lives in
  `.claude/project.json` + `PROJECT_CONTEXT.md`; `kit_lint` mechanically guards the byte-identical
  invariant. **Off the tier sequence** (it's an orthogonal axis — reuse, not correctness or
  automation), so it didn't have to wait behind Tier 5. **Next on this axis:** mechanize the kit's own
  lifecycle the way the build pipeline is mechanized — a version-skew check (consumer vs kit), a
  `project.json` validator, and tests for install/extract/kit_lint (see §4.9 residuals).

**Binding sequencing constraint:** Tier 5 is last. What makes the system trustworthy _today_ is the
human reviewing every handoff. Automate the conductor before installing the mechanical gates (Tier 1)
and adversarial roles (Tier 3) and you remove the main error-correction mechanism while keeping the
correlated-error problem — a faster way to ship confident mistakes. **Install the guardrails the
human currently provides before you remove the human.**

## 8. One-line verdict

A legitimately strong solo-dev pattern — _stateless model, stateful files, human as scheduler,
contracts as types, recurrence as memory._ The Tier 1–2 + demotion mechanizations have closed the
_trusted-not-enforced_ gaps (lanes, integration, QA, economics, memory-tracks-truth). Its ceiling is now
set by the two **structural** problems the roadmap can only partly touch pre-live: **correlated error**
(one model, all hats — partly pre-paid by QA and, **as of 2026-06-28, demonstrably so** — a different-model
QA pass caught a real shipped defect (§5) — fully addressed only by a different-model red-team once live) and **you-as-bottleneck** (conductor + sole reviewer — eased by system-9-lite, removed only by full
system-9, which is deliberately parked until the guardrails are proven). Everything remaining on the
roadmap serves those two. As of 2026-06-24 the pattern is also **portable** — extracted into a reusable
kit so it compounds across projects, not just features — which raises its value as a _tool_ without
moving either ceiling: every new project inherits the same strengths _and_ the same two structural
limits. The kit added one new discipline of its own (keep the copies aligned), and characteristically
the system already mechanized the hard half of it (`kit_lint`) while leaving the lifecycle half
(version/skew/config) trusted — the next thing to mechanize.

**Amendment to the verdict (2026-07-16), after 24 ships and the first canon review.** Three things
changed the picture without changing the shape of it. First, the compounding memory — the mechanism this
analysis was proudest of — was shown to have a **third failure mode** neither promotion nor demotion
covers: a *correct, one-sided* rule silently fossilizes what it protects (the score froze for 210 commits
under a rule nobody ever violated). The memory model is now promote / demote / **counterpart**, and the
honest generalization is: *a compounding system needs machinery for rules that are wrong, AND for rules
that are right in only one direction.* Second, the correlated-error section gained its most instructive
data point yet — not the QA catching the builders (that's now routine) but the QA **itself fabricating a
headline count** that the human conductor caught by hand: de-correlation is not a hierarchy, every checker
is a model with the same failure modes, and the last check is still human — which is both the strongest
argument *for* the mechanization roadmap and the honest limit of it. Third, the flywheel's Measure station
now exists **for the product itself** (`outcome-ledger`): the system that had gotten wiser about *how it
builds* every ship can finally get wiser about *whether what it built works*. The two structural ceilings
stand exactly where §5 and §4.1 put them — but the system now catches a class of its own mistakes it
previously couldn't even name.
