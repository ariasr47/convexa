# Context Compressors (standing reference)

Reusable prompts to distill a session into a portable, self-contained artifact. Every
artifact assumes the reader has ONLY `.claude/PROJECT_CONTEXT.md` (the constant ground
truth) plus the inbound contract — never chat history.

Placeholders: `{FEATURE}` = kebab folder name under `.claude/contracts/`; `{TARGET_ROLE}`;
`{CONTRACT_NAME}` = output filename.

---

## 1. Universal Context Compressor (general)
Use to capture *any* session's work into one handoff/continuation file.

```text
Compress everything decided in THIS session into a single self-contained Markdown artifact.
The reader will have ONLY .claude/PROJECT_CONTEXT.md plus this artifact — no chat history.
Capture: the goal, the decisions made (not the deliberation), any constraints that must not
be violated, the resulting spec/plan, what's done vs open, and concrete next steps. EXCLUDE
reasoning, alternatives explored, and dead-ends. Be decision-dense, prefer bullets.
Write it to .claude/contracts/{FEATURE}/{CONTRACT_NAME}.md, then print the path and a
5-bullet summary.
```

## 2. Session-Transition Compressor (role → role)
> **Scope narrowed in v1.0.0:** there are no role-to-role contract handoffs any more — the council
> replaced them. Use this for general session transitions (e.g. compressing a long build session for a
> fresh reviewer), not for a gateway handoff.

```text
Compress THIS session into a handoff for the next reader: {TARGET_ROLE}.
Reader has ONLY .claude/PROJECT_CONTEXT.md + this handoff.
Include exactly the sections {TARGET_ROLE} needs to act. Restate any binding constraint they must not
violate — explicitly including the promoted-canon keys this feature touches (the BRIEF's `Invariant
watch` keys) so the next reader inherits them without re-reading the ledger. EXCLUDE your rationale —
ship decisions, not deliberation.
{CONTRACT_NAME} = a session-transition handoff file (e.g. `HANDOFF.md`) under
.claude/contracts/{FEATURE}/ — write/finalize THAT one file in compressed form; do NOT create a
second handoff file. Print its path + a 5-bullet summary.
```

## 3. Split Context Compressor — RETIRED (v1.0.0)

Its whole job was emitting the three-file execution split at the UX exit. Under the design council the
R4 synthesizer writes `SPEC.md` + `INTERFACE_CONTRACT.md` directly, and there are no execution contracts
to split into. Use `.claude/council/R4-synthesis.md` instead.

## 4. Session-Resume Compressor (continue long work in a fresh tab)
When a single working session gets long/expensive, snapshot it to resume cleanly elsewhere.

```text
I'm about to continue this work in a fresh session. Write a resume note to
.claude/contracts/{FEATURE}/RESUME.md capturing: current objective, what's already done
(files changed + decisions locked), what's in-progress and exactly where it stopped, the
next concrete step, and any gotchas discovered. Self-contained against PROJECT_CONTEXT.md.
No narration of how we got here — just the state needed to pick up cold.
```

---
### Conventions
- **Claude Code sessions (repo access):** open each role with *"Read .claude/PROJECT_CONTEXT.md
  and .claude/contracts/{FEATURE}/{X}.md, then act as …"* — reference files, don't paste.
- **Plain web chat:** paste the file contents at the top instead.
- One feature = one folder under `.claude/contracts/`. Archive/delete when shipped.
- `PROJECT_CONTEXT.md` is the CONSTANT (read by every session); contracts are the VARIABLE.
