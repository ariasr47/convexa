---
description: Run the mechanical gates (contract linter + interface conformance) on a feature; report only.
argument-hint: <feature-folder>
---
Run the mechanical gate-checks for feature `$ARGUMENTS` and report the results plainly. **Fix nothing**
— this is a gate, not a repair.

1. Structure / lane purity / canon single-source:
   `.venv/Scripts/python.exe .claude/tools/contract_lint.py $ARGUMENTS`
2. Runtime interface conformance — only if the backend is running AND the feature's
   `INTERFACE_CONTRACT.md` has a `## Conformance spec`:
   `.venv/Scripts/python.exe .claude/tools/interface_conformance.py --contract .claude/contracts/$ARGUMENTS/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000`

Summarize: ERRORs (block the handoff — must fix before routing) vs WARNINGs (advisory, judge them). If
conformance can't run (no server / no spec / NO_BACKEND_CHANGE), say so explicitly rather than skipping
silently.
