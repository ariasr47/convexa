#!/usr/bin/env python
"""contract_lint.py — mechanical gate-check for the delivery system (system-3).

Validates the structure + lane purity of a feature's `.claude/contracts/{FEATURE}/` folder so a
malformed handoff cannot advance a gateway. It checks STRUCTURE, not code — code-level integration
is system-1 (interface-conformance) and semantic ACs are system-2 (QA/Verify). Pairs with the
Decision-Ledger crossing-detection hook (BACKLOG §B), which shares this script surface.

Per-project coupling lives in `.claude/project.json` (the single seam): `context_file` (default
`PROJECT_CONTEXT.md`) names the ground-truth file. Absent config ⇒ the built-in defaults, so the tool
runs in a bare project unchanged.

Usage:
    python .claude/tools/contract_lint.py                # lint every LIVE feature (contracts/, not _archive)
    python .claude/tools/contract_lint.py FEATURE        # lint one feature (live or archived, by folder name)
    python .claude/tools/contract_lint.py --all          # lint live + archived (regression sweep)
    python .claude/tools/contract_lint.py --canon-only    # only the repo-level promoted-canon single-source check

Exit code: 1 if any ERROR, else 0. WARNINGs never fail the gate (heuristic lane flags).
Stdlib only; run with the project interpreter (see project.json `backend.python`).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Resolve repo root from this file's location (.claude/tools/contract_lint.py -> repo root).
ROOT = Path(__file__).resolve().parents[2]
CLAUDE = ROOT / ".claude"
CONTRACTS = CLAUDE / "contracts"
ARCHIVE = CONTRACTS / "_archive"


def _project_config() -> dict:
    """Read the project seam (.claude/project.json). Absent/malformed ⇒ {} (defaults apply)."""
    try:
        return json.loads((CLAUDE / "project.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


_CFG = _project_config()
CONTEXT_NAME = _CFG.get("context_file", "PROJECT_CONTEXT.md")
CONTEXT = CLAUDE / CONTEXT_NAME
LEDGER = CLAUDE / "DECISION_LEDGER.md"

MANIFEST_KEYS = ["Stage", "Repos", "Brief", "Contracts", "Last gateway"]
BRIEF_FIELDS = ["Goal", "Decision impact", "Feasibility", "Effort", "Invariant watch", "Source"]
STATUS_RE = re.compile(r"-\s+(\S+\.md)\s+(NO_BACKEND_CHANGE|NO_UI_CHANGE|locked|draft|n/a)")

# The council writes exactly two per-feature artifacts; both are checked structurally below.
SPEC_FILE = "SPEC.md"
INTERFACE_FILE = "INTERFACE_CONTRACT.md"
AC_HEADING_RE = re.compile(r"^##\s*\d*\.?\s*Acceptance criteria", re.M | re.I)
CONFORMANCE_RE = re.compile(r"##\s*Conformance spec.*?```json\s*(.*?)```", re.S | re.I)


class Findings:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"  ERROR  {where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"  warn   {where}: {msg}")


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def parse_manifest_statuses(text: str) -> dict[str, str]:
    """filename -> status token, from the Contracts: block."""
    return {m.group(1): m.group(2) for m in STATUS_RE.finditer(text)}


def lint_feature(folder: Path, f: Findings) -> None:
    name = folder.name
    man_path = folder / "_MANIFEST.md"
    if not man_path.exists():
        f.err(name, "_MANIFEST.md missing (every feature folder needs one)")
        return
    man = read(man_path)

    # M1 — required manifest keys present.
    for key in MANIFEST_KEYS:
        if not re.search(rf"^{re.escape(key)}\s*:", man, re.M):
            f.err(f"{name}/_MANIFEST.md", f"missing manifest key '{key}:'")

    statuses = parse_manifest_statuses(man)
    if not statuses:
        f.warn(f"{name}/_MANIFEST.md", "no parseable 'Contracts:' status lines found")

    # M2 — files the manifest claims are present (locked/draft) must exist; NO_* markers must be in-file.
    for fname, status in statuses.items():
        fpath = folder / fname
        if status in ("locked", "draft"):
            if not fpath.exists():
                f.err(f"{name}/_MANIFEST.md", f"{fname} marked '{status}' but the file is missing")
        elif status in ("NO_BACKEND_CHANGE", "NO_UI_CHANGE"):
            if fpath.exists() and status not in read(fpath):
                f.warn(f"{name}/{fname}", f"manifest says {status} but the file omits that marker")

    spec_path = folder / SPEC_FILE
    iface_path = folder / INTERFACE_FILE

    # Existence is checked unconditionally — a manifest that omits or mislabels a file must not
    # hide it going missing. Both artifacts are mandatory for every live feature.
    if not spec_path.exists():
        f.err(f"{name}/{SPEC_FILE}", f"{SPEC_FILE} is missing from the feature folder")
    if not iface_path.exists():
        f.err(f"{name}/{INTERFACE_FILE}", f"{INTERFACE_FILE} is missing from the feature folder")

    # M8 — the spec must carry acceptance criteria (the checklist GATE Q verifies).
    if spec_path.exists():
        spec_body = read(spec_path)
        if not AC_HEADING_RE.search(spec_body):
            f.err(f"{name}/{SPEC_FILE}",
                  "no 'Acceptance criteria' section — GATE Q has no checklist to verify")

        # M3 — the spec must bind to the interface, the single FE-to-BE truth.
        if INTERFACE_FILE.removesuffix(".md") not in spec_body:
            f.err(f"{name}/{SPEC_FILE}",
                  f"spec does not reference {INTERFACE_FILE} "
                  "(the single FE-to-BE truth must be named, never restated)")

    # M7 — the interface must carry a parseable machine-checkable conformance spec (system-1),
    # unless it is explicitly a no-backend-change feature. ERROR: without it GATE Q cannot verify.
    # The NO_BACKEND_CHANGE bypass keys off the file's own body, never the manifest label — a
    # manifest can mislabel a file, but it cannot put words in the file itself.
    if iface_path.exists():
        ibody = read(iface_path)
        if "NO_BACKEND_CHANGE" not in ibody:
            m = CONFORMANCE_RE.search(ibody)
            if not m:
                f.err(f"{name}/{INTERFACE_FILE}",
                      "no '## Conformance spec' ```json block — interface_conformance.py cannot verify "
                      "the live backend against this interface")
            else:
                try:
                    json.loads(m.group(1))
                except json.JSONDecodeError as exc:
                    f.err(f"{name}/{INTERFACE_FILE}",
                          f"'## Conformance spec' block is not valid JSON ({exc.msg} at line {exc.lineno})")

    # M4 — BRIEF fields (if a BRIEF exists).
    brief = folder / "BRIEF.md"
    if brief.exists():
        btext = read(brief)
        for field in BRIEF_FIELDS:
            if not re.search(rf"^{re.escape(field)}\s*:", btext, re.M):
                f.err(f"{name}/BRIEF.md", f"missing BRIEF field '{field}:'")


def lint_canon(f: Findings) -> None:
    """Repo-level: every key in the ledger's 'Promoted canon' table must have its prose in CONTEXT."""
    if not LEDGER.exists() or not CONTEXT.exists():
        f.warn("repo", f"DECISION_LEDGER.md or {CONTEXT_NAME} missing — skipping canon check")
        return
    ledger = read(LEDGER)
    context = read(CONTEXT)
    m = re.search(r"##\s*Promoted canon.*?(?=\n##\s)", ledger, re.S)
    if not m:
        f.warn("DECISION_LEDGER.md", "no 'Promoted canon' section found")
        return
    keys = re.findall(r"^\|\s*`([a-z0-9-]+)`\s*\|", m.group(0), re.M)
    for key in keys:
        if f"`{key}`" not in context and key not in context:
            f.err("DECISION_LEDGER.md",
                  f"promoted key '{key}' has no prose in {CONTEXT_NAME} "
                  f"(single-source rule: canon prose must live there)")


def live_features() -> list[Path]:
    if not CONTRACTS.exists():
        return []
    return sorted(p for p in CONTRACTS.iterdir() if p.is_dir() and p.name != "_archive")


def find_feature(arg: str) -> Path | None:
    for base in (CONTRACTS, ARCHIVE):
        cand = base / arg
        if cand.is_dir():
            return cand
    return None


def main(argv: list[str]) -> int:
    f = Findings()
    arg = argv[1] if len(argv) > 1 else None

    if arg == "--canon-only":
        lint_canon(f)
        folders: list[Path] = []
    elif arg == "--all":
        folders = live_features() + sorted(p for p in ARCHIVE.iterdir() if p.is_dir()) \
            if ARCHIVE.exists() else live_features()
        lint_canon(f)
    elif arg and not arg.startswith("--"):
        target = find_feature(arg)
        if target is None:
            print(f"feature '{arg}' not found under contracts/ or contracts/_archive/")
            return 2
        folders = [target]
        lint_canon(f)
    else:
        folders = live_features()
        lint_canon(f)

    for folder in folders:
        lint_feature(folder, f)

    scope = arg if arg else f"{len(folders)} live feature(s)"
    print(f"contract_lint — scope: {scope}")
    if not f.errors and not f.warnings:
        print("  OK — no findings.")
    for line in f.errors:
        print(line)
    for line in f.warnings:
        print(line)
    print(f"\n  {len(f.errors)} error(s), {len(f.warnings)} warning(s).")
    return 1 if f.errors else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
