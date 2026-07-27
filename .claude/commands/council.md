---
description: Run the design council on one feature — R1 positions, R2 critique, R3 reconcile, R4 synthesis, then an adversarial review.
---
Run **GATE C — the design council** for the feature named in `$ARGUMENTS` (the kebab folder under
`.claude/contracts/`). Read `.claude/project.json` first, then that feature's `BRIEF.md`. If no BRIEF
exists, stop and say so — the council designs a chosen feature; choosing is GATE I's job.

You are the **controller**, not a voice. You never write a position, a critique, or the spec yourself.
Report to me throughout as operator cards per `.claude/OPERATOR_REPORTS.md`.

Create `.claude/contracts/{FEATURE}/council/` for the round artifacts.

**R1 — positions (parallel, blind).** Spawn `delivery-architect`, `delivery-pm` and `delivery-ux`
**in a single message** so they run concurrently. Give each: the BRIEF, the context pack
(`<project.json backend.python> .claude/tools/context_for.py {FEATURE} --print`), and the prompt in
`.claude/council/R1-position.md` with its role substituted. **Do not show any voice another's output.**

**R2 — cross-critique (parallel, sighted).** When all three positions exist, spawn three FRESH
instances of the same agents in one message, each given all three R1 files plus
`.claude/council/R2-critique.md`. Each returns one `json` block. Collect them into
`.claude/contracts/{FEATURE}/council/conflicts.json` as `{"conflicts": [...]}` — the union of every
voice's `conflicts` array, each entry keeping its `quote`, `source`, `why`, `proposal` and `kind`.
**Reject any conflict whose `quote` does not appear verbatim in the named source position** — send that
voice back once to restate it properly.

**R3 — reconcile (you, the controller).**
- `kind: "technical"` → re-spawn **only the two voices involved**, each given the opposing conflict, for
  exactly ONE resolution exchange. If they converge, fold the resolution in. If they do not, promote it
  to a product call.
- `kind: "product"` → **mine to decide.** Surface them to me **one at a time** as Decision cards
  (`OPERATOR_REPORTS.md` §3.3): the question in one sentence, then lettered options with a one-line
  consequence each and your recommendation marked. Never batch two questions into one message.
- Record every outcome — agent-resolved and human-ruled — in
  `.claude/contracts/{FEATURE}/council/decisions.md` with the conflict that prompted it.
- **Loop cap: 2.** If R2 materially changed positions, run one more critique round, then decide and move
  on. An uncapped debate burns tokens without converging.

**R4 — synthesis.** Spawn ONE fresh `general-purpose` agent — never one of the three voices — with
`.claude/council/R4-synthesis.md`, all R1 + R2 artifacts, and `decisions.md`. It writes `SPEC.md` and
`INTERFACE_CONTRACT.md`.

**S2 — adversarial review.** Spawn one fresh agent with `.claude/council/S2-skeptic.md`, **on a
different base model than the synthesizer** where the harness allows it. Any **Critical** finding loops
back to R4 with the findings attached. Cap the loop at 2 passes, then surface what remains to me.

**Gate-check.** Run `<project.json backend.python> .claude/tools/contract_lint.py {FEATURE}`. A
structural ERROR blocks the handoff — fix it before reporting done.

**Report + hand off.** Close with a Status card: what the council decided, how many conflicts were
raised and how they were settled, and the skeptic's verdict. Then ask me to approve the spec. On
approval the next step is the plan (GATE PLAN), not the build.
