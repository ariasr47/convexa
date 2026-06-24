# Context Compressors (standing reference)

Reusable prompts to distill a session into a portable, self-contained artifact. Every
artifact assumes the reader has ONLY `.claude/GAMMAFLOW_CONTEXT.md` (the constant ground
truth) plus the inbound contract — never chat history.

Placeholders: `{FEATURE}` = kebab folder name under `.claude/contracts/`; `{TARGET_ROLE}`;
`{CONTRACT_NAME}` = output filename.

---

## 1. Universal Context Compressor (general)
Use to capture *any* session's work into one handoff/continuation file.

```text
Compress everything decided in THIS session into a single self-contained Markdown artifact.
The reader will have ONLY .claude/GAMMAFLOW_CONTEXT.md plus this artifact — no chat history.
Capture: the goal, the decisions made (not the deliberation), any constraints that must not
be violated, the resulting spec/plan, what's done vs open, and concrete next steps. EXCLUDE
reasoning, alternatives explored, and dead-ends. Be decision-dense, prefer bullets.
Write it to .claude/contracts/{FEATURE}/{CONTRACT_NAME}.md, then print the path and a
5-bullet summary.
```

## 2. Session-Transition Compressor (role → role)
Run at the Exit of Architect and PM. Targets the next role's needs.
> **This does NOT create a new file.** Your role's PRIMARY contract IS the compressed handoff:
> `{CONTRACT_NAME}` here = your own `ARCHITECTURE_CONTRACT.md` (Architect) or `PRODUCT_CONTRACT.md` (PM).
> "Run compressor #2" means *write that one contract in compressed, next-role-targeted form, then print
> a 5-bullet summary in your report* — do not emit a second handoff file (e.g. `*_INPUT.md`). Only
> compressor #3 (the UX Split) legitimately emits multiple files (the three execution contracts).

```text
Compress THIS session into a contract for the next role: {TARGET_ROLE}.
Reader has ONLY .claude/GAMMAFLOW_CONTEXT.md + this contract.
Include exactly the sections {TARGET_ROLE} needs to act (use that contract's template in
.claude/contracts/{FEATURE}/). Restate any binding constraint they must not violate — explicitly
including the promoted-canon keys this feature touches (the BRIEF's `Invariant watch`: e.g.
best-effort-isolated-or-null, additive-keeps-score-byte-identical, live-vs-static-isolation,
operator-vs-trader-path-separation) so the next role inherits them without re-reading the ledger.
Stay in your lane: the Architect emits no UI/endpoints; the PM emits no code/math. EXCLUDE your
rationale — ship decisions, not deliberation.
{CONTRACT_NAME} = your role's existing primary contract (ARCHITECTURE_CONTRACT.md for the Architect,
PRODUCT_CONTRACT.md for the PM) — write/finalize THAT one file in compressed form; do NOT create a
second handoff file. Print its path + a 5-bullet summary.
```

## 3. Split Context Compressor (decoupled execution)
Run at the Exit of the UX/Tech-Writer session. Emits the FE↔BE glue + two lane contracts.

```text
Compress THIS session into THREE files for decoupled execution:
1) .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md — the FE↔BE data contract ONLY:
   endpoints, payload fields (names, types, presence rules), and error/SSE semantics. Both
   sides bind to this; it is the single source of integration truth. It MUST embed a
   machine-checkable `## Conformance spec` fenced ```json block mapping each endpoint → its
   required field paths/types/presence (dot-paths; `name[]` for array fan-out; `type|null`
   unions; trailing `?` for optional), so interface_conformance.py (system-1) can verify the
   live backend against it at GATE Q and the executioners can self-check before reporting done.
   (A NO_BACKEND_CHANGE interface that only consumes an existing endpoint may point at that
   endpoint's existing spec instead of restating it.)
2) .claude/contracts/{FEATURE}/BACKEND_EXECUTION_CONTRACT.md — server work only; references
   the interface contract for what it must EMIT; contains NO UI detail.
3) .claude/contracts/{FEATURE}/FRONTEND_EXECUTION_CONTRACT.md — UI work only; references the
   interface contract for what it CONSUMES + the component states (default/loading/stale/
   offline/empty/error); contains NO server internals. Include a "Tests to write" matrix that
   ENUMERATES the required cases — derived from the PRODUCT_CONTRACT ACs × component states ×
   edge/invariant (each AC → at least one case). This is the FE's requirement set (the FE
   implements + may add unit tests, but never drops a listed case); QA traces every AC to ≥1
   passing test at GATE Q. (Vitest + Testing Library; tests are part of the FE deliverable.)
Each must be self-contained against GAMMAFLOW_CONTEXT.md + the interface contract. EXCLUDE
rationale. Print the three paths. (contract_lint.py runs next at GATE U·X: it ERRORs if an
execution contract isn't bound to the interface and WARNs if a locked interface lacks the
Conformance spec block — so emit the block now.)
```

## 4. Session-Resume Compressor (continue long work in a fresh tab)
When a single working session gets long/expensive, snapshot it to resume cleanly elsewhere.

```text
I'm about to continue this work in a fresh session. Write a resume note to
.claude/contracts/{FEATURE}/RESUME.md capturing: current objective, what's already done
(files changed + decisions locked), what's in-progress and exactly where it stopped, the
next concrete step, and any gotchas discovered. Self-contained against GAMMAFLOW_CONTEXT.md.
No narration of how we got here — just the state needed to pick up cold.
```

---
### Conventions
- **Claude Code sessions (repo access):** open each role with *"Read .claude/GAMMAFLOW_CONTEXT.md
  and .claude/contracts/{FEATURE}/{X}.md, then act as …"* — reference files, don't paste.
- **Plain web chat:** paste the file contents at the top instead.
- One feature = one folder under `.claude/contracts/`. Archive/delete when shipped.
- `GAMMAFLOW_CONTEXT.md` is the CONSTANT (read by every session); contracts are the VARIABLE.
