#!/usr/bin/env python
r"""path_guard.py — RETIRED as the active hook (kept as a reference tool).

After the monorepo merge the active PreToolUse fence is `.claude/tools/path_guard.js` (node is
workspace-native; it carries the memory + plans carve-outs and computes the root from __dirname).
This Python version is retained for reference/parity only — it is NOT wired in settings.json.

path_guard.py — PreToolUse hook: lane-fence file writes to this repo (system-4b).

Completes the lane enforcement the per-role tool-allowlists (system-4) start. Tool-allowlists say WHICH
tools a role may use; this says WHERE they may write. It blocks Write/Edit/MultiEdit/NotebookEdit whose
target resolves OUTSIDE this repo root — so a session in the backend repo (C:\Dev\GammaFlow) cannot
write into the sibling frontend repo (C:\Dev\gammaflow-web) or arbitrary disk paths, and vice-versa
(install the mirror copy in gammaflow-web). One carve-out: the per-project Claude auto-memory store
(~/.claude/projects/<proj>/memory) is allowed — a sanctioned harness write location, not a cross-repo
code path.

Wire as a PreToolUse hook in `.claude/settings.json` matching Write|Edit|MultiEdit|NotebookEdit. Reads
the hook payload on stdin; exit 0 = allow, exit 2 + stderr = block (the standard hook deny signal).
Fail-open on any malformed/unknown input so it never wedges a session. Stdlib only.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GUARDED = ("Write", "Edit", "MultiEdit", "NotebookEdit")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # malformed payload → don't break the session
    if payload.get("tool_name", "") not in GUARDED:
        return 0
    ti = payload.get("tool_input", {}) or {}
    raw = ti.get("file_path") or ti.get("notebook_path")
    if not raw:
        return 0
    cwd = payload.get("cwd") or str(REPO_ROOT)
    target = Path(raw)
    if not target.is_absolute():
        target = Path(cwd) / target
    try:
        target = target.resolve()
    except OSError:
        return 0  # unresolvable path → fail-open
    # Sanctioned carve-out: the Claude per-project auto-memory store lives OUTSIDE the repo
    # (~/.claude/projects/<proj>/memory). The harness writes memory via Write/Edit — a sanctioned
    # path, not the cross-repo CODE leak this fence guards against. Scoped to */memory under
    # ~/.claude/projects, so it works in either repo's mirror and can't reach global config.
    try:
        rel = target.relative_to(Path.home() / ".claude" / "projects")
        if "memory" in rel.parts:
            return 0
    except ValueError:
        pass
    try:
        target.relative_to(REPO_ROOT)
        return 0  # inside this repo → allow
    except ValueError:
        sys.stderr.write(
            f"path_guard (system-4b): BLOCKED {payload['tool_name']} to '{target}' — outside this "
            f"repo ({REPO_ROOT}). Lane fence: a session in this repo may not write another repo or "
            f"arbitrary disk paths (the per-project ~/.claude/.../memory store is exempt). If "
            f"intended, run it from the owning repo's session.\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
