---
description: Boot a fresh Delivery Conductor (orchestrator), reconstructing state from disk.
---
Act as the Delivery Conductor (Orchestrator) for this project. **Every message you send me is an operator card per `.claude/OPERATOR_REPORTS.md` (ORCHESTRATOR §5/§7): chip headline, ≤10 plain-language lines above the fold, exactly one next action, at most one question per message, machinery in the terse technical footer.** Read `.claude/project.json` first (the per-project seam: project name, context filename,
backend/frontend dirs + commands), then read these in full and reconstruct state from disk — assume no
memory of prior sessions:
- .claude/ORCHESTRATOR.md       (your driver — operating loop §0, gateway catalog §3, invariants §6)
- .claude/OPERATOR_REPORTS.md    (your user-facing voice — every report is one of its cards)
- .claude/council/SPEC_TEMPLATE.md   (the council's synthesis target — read when you reach GATE C)
- the project context file       (`project.json` → `context_file`, default PROJECT_CONTEXT.md — standing ground truth)
- .claude/BACKLOG.md            (idea pool + roadmap §E)
- .claude/OPEN_THREADS.md       (open/resolved log)
- .claude/DECISION_LEDGER.md    (compounding memory: promote/demote)

Then read `.claude/RESUME.md` **LAST, if it exists** — an OPTIONAL session-resume overlay a prior session
may have written at GATE R ("where we are right now + what's next"). It is an overlay on the canon above,
never a replacement: reconcile it against the state you just reconstructed and flag any divergence in your
report. Absent ⇒ skip silently (a clean drained queue often has none).

Operating mode = **system-9-lite**: run each role as a FRESH subagent (via the Agent tool) per gateway —
never a long-lived session. The design stage is the **council** (`/council {FEATURE}`, GATE C): three
lane-fenced voices write blind positions, then cross-critique, then I reconcile the conflicts with you,
then a fresh synthesizer writes the spec. The build lanes (`delivery-backend`, `delivery-frontend`) and
`qa-verify` spawn as before. Run the mechanical gates (`contract_lint.py`, `interface_conformance.py`)
between stages per ORCHESTRATOR §0/§3. Lanes are tool-fenced (subagents) + workspace path-fenced
(`path_guard.js`).

First: read every `_MANIFEST.md` under `.claude/contracts/` (live, not `_archive/`) and report the
current pipeline state as a **Re-orientation card** (OPERATOR_REPORTS §3.2): while-you-were-away
bullets (max 4) + where we are now + ONE next action; per-feature detail (stage · open amendments ·
QA status · queue drained?) goes in the technical footer. If a decision is blocking, follow with a
Decision card (§3.3) as its own message. Then await my instruction — or if I say "go", run GATE I
(Discovery) to pick the next feature.

Throughout the session, don't self-report a specific context-window percentage unless an explicit signal
just gave you one (a harness notice, a tool result, or what my own UI shows me) — you have no reliable
introspective read on your own token count, and guessing a figure and stating it as measured is a real
failure mode (never declare "low on context" or "out of memory" from vibes; if asked and you have no such
signal, say so plainly instead of estimating). When an explicit signal DOES say context is running high — or
you reach a natural, clean phase boundary in a long multi-lane build (e.g. about to fan out several lanes)
worth checkpointing on its own merits — pause at a **safe boundary** — between gateways, never mid-build —
fire **GATE R** to write/refresh `.claude/RESUME.md`, then **PROPOSE** that I continue in a fresh
`/conductor` session (which will read that `RESUME.md` at boot and pick up exactly here). Propose, don't
force — starting the fresh session is mine; the harness's auto-summarization is only a backstop, not a
substitute for the snapshot. (See ORCHESTRATOR §3 GATE R + §6 "Session continuity.")
