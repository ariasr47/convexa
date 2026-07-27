# Role Launch Prompts (standing reference)

Reusable, generalized prompts to **open** each role-scoped session in the delivery pipeline. The
council lane (§1) runs three voices through blind positions, cross-critique, conductor reconciliation
and a fresh synthesis to produce `SPEC.md` + `INTERFACE_CONTRACT.md` — no per-role compressor hand-off;
the round artifacts under `council/` ARE the trail. The two build lanes (§2/§3) each read the constant
ground truth + those two artifacts, do only their lane's work, and ship code directly — no outbound
contract, so no compressor either. QA (§4) reads the same two artifacts and writes only `QA_REPORT.md`.

Pipeline: **Discovery (GATE I, conductor-inline) → Design Council (GATE C) →
{Backend ‖ Frontend Executioners} → QA/Verify (GATE Q) → Ship.** Discovery has no launch prompt
below — it is the conductor's own inline opening move (ORCHESTRATOR §3 GATE I); the prompts here
cover the Council plus the two executioners + QA.

> To **automate** the hand-offs (audit → compress → write the next contract → route), open a session
> as the Orchestrator (`.claude/ORCHESTRATOR.md`) and announce the transition; it drives these
> prompts + the compressors for you instead of manual copy-paste.

> **Context retrieval (system-5):** instead of re-reading all of `PROJECT_CONTEXT.md`, a session can
> load the minimal pack — `<project.json backend.python> .claude/tools/context_for.py {FEATURE} --print`
> (the always-load invariant floor §3+§5 + the sections the BRIEF's `Context tags:` select). Opt-in; the
> whole file stays valid + single-source. Decouples per-session token cost from canon size.

> **Lane-fenced subagents (system-4):** each role also has a tool-fenced subagent in `.claude/agents/`
> (`delivery-architect` · `delivery-pm` · `delivery-ux` · `delivery-backend` · `delivery-frontend`
> · `qa-verify`). A role spawned via the Agent tool is mechanically held to its lane — the three
> council voices (architect/pm/ux) + QA have **no `Edit` and no `Bash`** (cannot modify or run code);
> executioners get the build toolset. Tool-allowlists are the per-tool guard; the workspace write fence
> (no writes outside the workspace root) is enforced by the `path_guard.js` PreToolUse hook
> (system-4b, LANDED). Both lanes (`backend.dir`, `frontend.dir` — see `.claude/project.json`) live in
> one repo, so each spawns as an in-repo Agent subagent.
> Running each role still works as a manual session with the prompts below — the subagents just make the
> lane enforceable when spawned.

Placeholders to fill before pasting:
- `{FEATURE}` = kebab folder name under `.claude/contracts/` (e.g. `user-auth-flow`).
- `{GOAL}` = one short paragraph: what this feature must accomplish for the user/system.

> Convention (per COMPRESSOR_PROMPTS.md): reference files, don't paste; assume **no chat history** —
> the reader has only `PROJECT_CONTEXT.md` + the named contract(s). One feature = one folder.

---

## Running a role — the LITE path (system-9-lite · ADOPTED 2026-06-23)
**Run each role as a FRESH spawn of its lane-fenced subagent, never a long-lived terminal.** Freshness
*is* the reliability: each session stays the pure function `output = role(ground_truth, inbound_contract)`
— no accumulated context to drift, self-contradict, or smuggle a stale detail into a new decision (and
no growing per-turn token cost). You (the human) still conduct — announce the transition, run the
mechanical gates + tools, route — but the ROLE work moves into a disposable subagent.

Per gateway, spawn the matching subagent with the launch prompt from the cited section + the sharded
context pack, let it write its one contract, then **discard it** (no reuse across roles or features):

| Gateway              | Spawn subagent        | Launch prompt | Writes                          |
|----------------------|-----------------------|---------------|---------------------------------|
| Council R1 (x3 parallel) | `delivery-architect` / `delivery-pm` / `delivery-ux` | §1 + `council/R1-position.md` | `council/R1-{role}.md` |
| Council R2 (x3 parallel) | the same three, fresh | §1 + `council/R2-critique.md` | `council/R2-{role}.md` |
| Council R4           | `general-purpose` (fresh) | `council/R4-synthesis.md` | `SPEC.md` + `INTERFACE_CONTRACT.md` |
| Council S2           | `general-purpose` (fresh, different model) | `council/S2-skeptic.md` | `council/S2-findings.md` |
| Backend (fan-out)    | `delivery-backend`   | §2            | server code (binds interface)   |
| Frontend (fan-out)   | `delivery-frontend`  | §3            | UI code (binds interface)       |
| QA / Verify (GATE Q) | `qa-verify`          | §4            | QA_REPORT.md                    |

- **Discovery has no subagent:** GATE I (Discovery) runs **inline in the conductor**, not as a spawn —
  its inputs are the conductor's boot state and it precedes the BRIEF the pack keys off (rationale:
  ORCHESTRATOR §3 GATE I). **R3 (Reconcile) is likewise the conductor's own work**, not a spawn: it
  collects the R2 conflicts, re-spawns only the two voices involved in a `technical` conflict for one
  exchange, and routes every `product` conflict to the human one at a time.
- **Lean context, not the whole canon:** give each spawn the pack —
  `<project.json backend.python> .claude/tools/context_for.py {FEATURE} --print` (always-load invariant floor
  + the BRIEF's `Context tags:`); it falls back to the floor if no tags.
- **You still run the gates between spawns:** `contract_lint.py` at every gateway; at GATE Q
  `interface_conformance.py` + the `qa-verify` spawn. Lanes are tool-fenced (the subagents) + workspace
  path-fenced (`path_guard.js`).
- **Translate hand-backs into cards:** when a spawn returns, report it to the operator per
  `OPERATOR_REPORTS.md` — a Re-orientation card for background completions, a Problem card for
  failures; the subagent's raw report is footer material, never pasted above the fold.
- **Discard, don't continue:** never reuse a subagent across gateways or features. The handoff is the
  written contract on disk, not a living session.
- **vs full system-9:** the *conductor is still you* (manual transitions + approvals). system-9 automates
  that into a Conductor agent spawning these same subagents + parallel feature lanes — parked behind the
  go-live gate. Lite = the freshness + lane-fencing win, no new infra, human review intact.

---

## 1. The Design Council (GATE C — replaces the Architect/PM/UX sessions)

Run it with `/council {FEATURE}`. The command is the authority; this section is the summary a human
needs to understand what is happening and where to intervene.

**Three voices, four rounds, one human touchpoint.**

| Round | Who | Sees | Produces |
|---|---|---|---|
| R1 Position | architect / pm / ux, in parallel | **nothing from the others** | `council/R1-{role}.md` |
| R2 Critique | the same three, fresh instances | all three positions | `council/R2-{role}.md` (structured conflicts) |
| R3 Reconcile | **the conductor** | everything | `council/decisions.md` |
| R4 Synthesis | one fresh agent, none of the three | everything | `SPEC.md` + `INTERFACE_CONTRACT.md` |

Then **S2**: a fresh skeptic on a different base model attacks the spec; Critical findings loop back to
R4 (cap 2 passes).

**R1 blindness is load-bearing.** It is what structurally replaces the independence the three separate
tool-fenced sessions used to provide. If the positions are written with visibility into each other, the
council collapses into a single voice and the design is worse than the pipeline it replaced.

**The one hard rule of R2:** a conflict must quote the exact sentence it contradicts. Vague
disagreement is rejected and sent back.

**Where you come in:** R3 surfaces `product` conflicts — priority, scope, user value — to you one at a
time as A/B decision cards. `technical` conflicts are settled between the two voices involved. After
S2, you approve the spec; that is the last cheap moment to change direction.

**Feature too small for a council?** Use the fast paths instead — GATE M (server-side only, no UI) or
GATE V (visual only, no server change) — which skip the council entirely. The council is for features
with a real FE-to-BE seam.

## 2. Backend Executioner
```text
Read these files for full context, then implement the backend, acting as a backend engineer:
- .claude/PROJECT_CONTEXT.md                                  (standing ground truth)
- .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md            (the single source of integration truth)
- .claude/contracts/{FEATURE}/SPEC.md                          (§2 architecture + §7 testing strategy — your server work)

Build only the server side. Emit exactly the fields/types/presence-and-error semantics the
INTERFACE_CONTRACT specifies — that contract is binding; do not deviate from it unilaterally (if it
is wrong, flag it, don't silently diverge). Honor every constraint in PROJECT_CONTEXT (its
domain/math invariants, best-effort isolation, and any promoted build invariants). Do not touch UI.

Run the project the standard way and verify your output matches the INTERFACE_CONTRACT (shape,
presence rules, and the failure/degradation semantics). Before reporting done, run the same
machine check QA will run at GATE Q — with the backend up:
`<project.json backend.python> .claude/tools/interface_conformance.py --contract
.claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md --url <backend-base-url>` — and make it PASS
(it proves the live response emits every field the interface promises = what the FE consumes). A
self-caught conformance FAIL now is one you fix in-lane instead of bouncing back from QA later.
Report what you changed and how you verified it (include the conformance result). If you discover
the interface itself is wrong/incomplete, note it for a contract amendment rather than silently
diverging or breaking the frontend's assumptions.
```

## 3. Frontend Executioner
```text
Read these files for full context, then implement the frontend, acting as a frontend engineer:
- .claude/PROJECT_CONTEXT.md                                  (standing ground truth)
- .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md            (the single source of integration truth)
- .claude/contracts/{FEATURE}/SPEC.md                          (§4 — component states, copy, design direction; your UI work)

Build only the client side. Consume exactly the fields the INTERFACE_CONTRACT defines — that
contract is binding; do not assume fields it doesn't promise. Implement every component state and
the exact degraded-state behavior from SPEC.md §4 (static content MUST persist
on live-stream loss; only live fields show offline/stale; never blank on a failed refresh once content
has loaded; auto-reconnect). Do not touch server internals or math.

Automated tests are PART OF THE DELIVERABLE for every feature (standing rule). Use the project's
configured component-test stack and run it via `project.json` → `frontend.test_cmd`; colocate the test
files with the code. Three levels, the flow-integration one is the CENTERPIECE:
- unit — pure logic (hook reducers/derivations, computed values, formatters), deterministic, no DOM;
- component — render each component state from the contract (default/loading/stale/offline/empty/
  error) + the key interactions, asserting observable output;
- integration (CENTERPIECE) — drive the actual USER FLOW end-to-end through every edge case/variation:
  mount the feature subtree, mock ONLY the network boundary (the typed API client, or fetch/the
  streaming transport — NEVER a live backend), then walk the journey (e.g. a record moves through its
  lifecycle -> a live event arrives -> the stream drops -> live fields go offline/stale while the static
  content persists -> reconnect), plus cold-start-fail vs post-success-refresh-fail, not-found/empty,
  per-field nulls. These are the manual mock checks done by hand, made re-runnable.
Assert the contract's observable behaviors + the promoted invariants (live-vs-static isolation,
best-effort degradation), not a coverage %. E2E: a real-browser flow tool is adopted nearer go-live for
the critical path, optional before then. Run the configured test command (plus any shared-lib test
command if you touched a shared client lib) and make it GREEN before reporting done — QA re-runs it at
GATE Q.

Design quality: build to the UX token plan ("Design tokens + signature") exactly, and run the
.claude/DESIGN_RULES.md visual verification loop (§1.6) before reporting done — it is part of "done".

Run the project the standard way (`project.json` → `frontend.serve_cmd`) and verify the live-loss /
stale / cold-start states behave as specified against the acceptance criteria. A controllable mock at
the network boundary lets you drive each degraded path manually too. Report what you changed and how
you verified it — name the states you exercised AND include the test result. If a needed field is
missing from the interface, flag it for a contract amendment — do not invent it.
```

## 4. QA / Verify (GATE Q — runs after BOTH executioners, before ship)
The teeth-having verification role (system-2). A **fresh session, NOT one of the builders** — it ends
"builders mark their own homework." It confirms every acceptance criterion point-by-point, **fixes
nothing**, and bounces any gap via GATE Z. Ideally run on a **different base model** than the builders
(de-correlates blind spots — foreshadows system-6). Subagent: `.claude/agents/qa-verify.md`.
```text
Read these files for full context, then act as a strict QA / Verification engineer (a FRESH session,
deliberately NOT one of the builders — no one marks their own homework):
- .claude/PROJECT_CONTEXT.md                                       (standing ground truth)
- .claude/contracts/{FEATURE}/SPEC.md                               (§3 ACCEPTANCE CRITERIA — your checklist)
- .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md                 (integration truth — what BE emits / FE consumes)
- .claude/OPEN_THREADS.md                                            (do not reopen "resolved"; honor the §9 promoted invariants)

Your job: confirm POINT BY POINT that every acceptance criterion in SPEC.md §3 actually holds
against the real built/running feature. You VERIFY; you FIX NOTHING — no code edits, no contract edits,
no "making the AC pass." Treat each builder's self-verification as UNVERIFIED until you observe it.

Method:
- Run the project the standard way (backend `project.json` → `backend.serve_cmd`; frontend
  `project.json` → `frontend.serve_cmd`) and OBSERVE. The ACs are written to be observable without
  reading code — verify by observation first; read code only to explain a failure.
- For EACH acceptance criterion, verbatim and in order, assign exactly one verdict:
  PASS (observed to hold — cite evidence) · FAIL (observed not to hold — expected vs actual + repro) ·
  UNVERIFIABLE (couldn't exercise it — say precisely why).
- Verify INTERFACE_CONTRACT integration with the runtime conformance check (system-1): with the
  backend running, run `<project.json backend.python> .claude/tools/interface_conformance.py --contract
  .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md --url <backend-base-url>`. A conformance FAIL
  (the live BE omits/mistypes a field the interface promises) is a GATE Q FAIL → bounce to Backend.
- Also check the binding invariants (BRIEF "Invariant watch" + the promoted canon). A green AC list
  over a broken invariant is still a FAIL.
- Re-run the frontend test suite + verify AC coverage per its `Verify by` marking (standing rule — tests
  are part of the FE deliverable): run the configured frontend test command (`project.json` →
  `frontend.test_cmd`, plus any shared-lib test command if a shared client lib was touched); a failing
  suite is a GATE Q FAIL → bounce to Frontend. Then verify traceability (NOT a spot-check): every
  SPEC.md §3 AC marked `test` in its `Verify by` column maps to ≥1 named, passing test; every AC marked
  `review` is confirmed by inspection. A `test`-marked AC with no corresponding test is a FAIL even if the
  green suite passes — name the uncovered AC in the bounce.

Write .claude/contracts/{FEATURE}/QA_REPORT.md: a table (AC verbatim · verdict · evidence), a summary
(n PASS / n FAIL / n UNVERIFIABLE), and an explicit overall GATE Q verdict — PASS only if every AC is
PASS and no invariant is broken, else FAIL. On any FAIL, ALSO append an "Amendments bounced to {owner}"
section (failing AC · observed vs expected · owning lane Backend|Frontend).

Stay in lane: QA_REPORT.md (and the bounce on failure) are your ONLY writes — no code, no contract
edits, no fixes. Run no compressor; the Orchestrator routes on your verdict (PASS → GATE S; FAIL →
GATE Z, then GATE Q re-runs on the fix). Then stop.
```

---
### Notes
- **Backend and Frontend run in parallel** — both bind to the same `INTERFACE_CONTRACT.md`, so neither
  blocks the other. That decoupling is the whole point of the council's R4 Synthesis output.
- **The Council's R4 Synthesis writes SPEC.md + INTERFACE_CONTRACT.md directly — no compressor step.**
  A fresh synthesis agent (none of the three voices) reads every R1/R2 position and critique plus the
  conductor's R3 decisions, then authors both files as its one write. S2's Critical findings loop back
  into at most 2 more synthesis passes before you approve.
- Executioners have **no outbound contract** (they ship code, not a handoff) and therefore run **no
  compressor** — the pipeline ends at integration.
- If a role finds its inbound contract wrong or incomplete, the fix is a **contract amendment** (bounce
  back to the owning role), not a silent in-lane workaround.
- Keep `PROJECT_CONTEXT.md` as the constant every session reads; the per-feature contracts are the
  variable. Archive a feature's folder when it ships.
