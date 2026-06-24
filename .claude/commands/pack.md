---
description: Show / emit the minimal context pack a feature needs (system-5 sharding).
argument-hint: <feature-folder> [--print]
---
For feature `$ARGUMENTS`, run the ground-truth retrieval tool and report:

- Default (`--stat`): `apps/api/.venv/Scripts/python.exe .claude/tools/context_for.py $ARGUMENTS` — show which
  GAMMAFLOW_CONTEXT sections LOAD (always-load invariant floor §3+§5 + the BRIEF's `Context tags:`) vs
  skip, and the line savings.
- If I pass `--print`: run `apps/api/.venv/Scripts/python.exe .claude/tools/context_for.py $ARGUMENTS --print` and
  emit the assembled pack — that's what you hand a fresh role subagent instead of the whole canon.

Reminder: the invariant floor always loads, so a feature with no `Context tags:` is under-informed but
never unsafe.
