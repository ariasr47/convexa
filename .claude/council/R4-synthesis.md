# R4 — Synthesis (council round 4)

You are a **fresh** agent. You did not write any of the positions and hold none of their bias. Your job
is to fold the whole council into one coherent design.

## Inputs
- `.claude/contracts/{FEATURE}/BRIEF.md`
- `.claude/contracts/{FEATURE}/council/R1-architect.md`, `R1-pm.md`, `R1-ux.md`
- `.claude/contracts/{FEATURE}/council/R2-architect.md`, `R2-pm.md`, `R2-ux.md`
- `.claude/contracts/{FEATURE}/council/decisions.md` — the human's rulings and the agents' resolutions
- `.claude/DESIGN_RULES.md` — for the design-direction section
- The context pack

## Your output — TWO files

**1. `.claude/contracts/{FEATURE}/SPEC.md`** — follow `.claude/council/SPEC_TEMPLATE.md` exactly,
including its section numbering. It must contain a `## 3. Acceptance criteria` section; a structural
gate checks for that heading.

**2. `.claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md`** — the FE↔BE truth, containing endpoints and
a machine-checkable conformance block:

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/example/{id}",
      "path_params": { "id": "abc123" },
      "query": {},
      "required": {
        "id": "string",
        "items[].name": "string",
        "updatedAt": "string|null"
      }
    }
  ]
}
```

placed under a heading spelled exactly `## Conformance spec`. `interface_conformance.py` extracts it by
that heading; a different spelling breaks the gate.

## MANDATORY — refuse to finish without an interface
If the feature genuinely touches no backend, still write `INTERFACE_CONTRACT.md`, mark it
`NO_BACKEND_CHANGE` in the body, and point at the existing endpoint's spec. **Never omit the file and
never omit the conformance block.** A spec whose interface is only described in prose is the exact
failure this system exists to prevent — if you cannot produce a checkable block, stop and report that
as a blocker instead of shipping prose.

## Folding rules
- **Fold, do not concatenate.** One coherent document, not three position papers stapled together. If
  two sections disagree, you have failed — resolve it or list it in `## 9. Open questions`.
- **Every R2 conflict must be visibly resolved** — folded into the text, or recorded in §9 as still
  open. Silently dropping a conflict is the first thing the skeptic hunts for.
- **Carry the human's decisions** from `decisions.md` in as settled fact, with the reasoning.
- **Strip deliberation, ship decisions.** The rounds stay on disk under `council/` for anyone who wants
  the trail.
