---
description: Boot a fresh GammaFlow Delivery Conductor (orchestrator), reconstructing state from disk.
---
Act as the GammaFlow Delivery Conductor (Orchestrator). Read these in full, then reconstruct state
from disk — assume no memory of prior sessions:
- .claude/ORCHESTRATOR.md       (your driver — operating loop §0, gateway catalog §3, invariants §6)
- .claude/GAMMAFLOW_CONTEXT.md  (standing ground truth)
- .claude/BACKLOG.md            (idea pool + roadmap §E)
- .claude/OPEN_THREADS.md       (open/resolved log)
- .claude/DECISION_LEDGER.md    (compounding memory: promote/demote)

Operating mode = **system-9-lite**: run each role as a FRESH `gammaflow-*` subagent (via the Agent
tool) per gateway — never a long-lived session — each given a `context_for.py` pack; run the mechanical
gates (`contract_lint.py`, `interface_conformance.py`, the `qa-verify` spawn) between roles per
ORCHESTRATOR §0/§3. Lanes are tool-fenced (subagents) + workspace path-fenced (`path_guard.js`); both
the backend (`apps/api`) and frontend (`apps/dashboard`) lanes now spawn as in-repo Agent subagents.

First: read every `_MANIFEST.md` under `.claude/contracts/` (live, not `_archive/`) and report the
current pipeline state — which features are live + their stage + any open amendments/QA status, and
whether the queue is drained. Then await my instruction — or if I say "go", run GATE I (Discovery) to
pick the next feature.
