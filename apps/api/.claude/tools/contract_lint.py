#!/usr/bin/env python
"""contract_lint.py — mechanical gate-check for the GammaFlow delivery system (system-3).

Validates the structure + lane purity of a feature's `.claude/contracts/{FEATURE}/` folder so a
malformed handoff cannot advance a gateway. It checks STRUCTURE, not code — code-level integration
is system-1 (interface-conformance) and semantic ACs are system-2 (QA/Verify). Pairs with the
Decision-Ledger crossing-detection hook (BACKLOG §B), which shares this script surface.

Usage:
    python .claude/tools/contract_lint.py                # lint every LIVE feature (contracts/, not _archive)
    python .claude/tools/contract_lint.py FEATURE        # lint one feature (live or archived, by folder name)
    python .claude/tools/contract_lint.py --all          # lint live + archived (regression sweep)
    python .claude/tools/contract_lint.py --canon-only    # only the repo-level promoted-canon single-source check

Exit code: 1 if any ERROR, else 0. WARNINGs never fail the gate (heuristic lane flags).
Stdlib only; run with the project venv: .venv/Scripts/python.exe .claude/tools/contract_lint.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# Resolve repo root from this file's location (.claude/tools/contract_lint.py -> repo root).
ROOT = Path(__file__).resolve().parents[2]
CLAUDE = ROOT / ".claude"
CONTRACTS = CLAUDE / "contracts"
ARCHIVE = CONTRACTS / "_archive"
CONTEXT = CLAUDE / "GAMMAFLOW_CONTEXT.md"
LEDGER = CLAUDE / "DECISION_LEDGER.md"

MANIFEST_KEYS = ["Entry", "Stage", "Repos", "Brief", "Contracts", "Last gateway"]
BRIEF_FIELDS = ["Goal", "Decision impact", "Feasibility", "Effort",
                "Invariant watch", "Entry point", "Source"]
STATUS_RE = re.compile(r"-\s+(\S+\.md)\s+(NO_BACKEND_CHANGE|NO_UI_CHANGE|locked|draft|n/a)")

# Conservative, high-confidence lane-purity heuristics (WARN, not ERROR — they flag, you judge).
ENDPOINT_RE = re.compile(r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+(/\S+)", re.I)
PATH_RE = re.compile(r"/[\w/_{}.-]+")
# Files where DESIGNING a NEW endpoint is a lane violation (referencing an EXISTING one is fine).
NEW_ENDPOINT_FILES = ("ARCHITECTURE_CONTRACT.md", "PRODUCT_CONTRACT.md")
LANE_FORBIDDEN = {
    # file substring : list of (regex, why)
    "ARCHITECTURE_CONTRACT.md": [
        (re.compile(r"\.tsx\b"), "UI component reference (.tsx) in an architecture contract"),
    ],
    "PRODUCT_CONTRACT.md": [
        (re.compile(r"\bdef \w+\("), "code (def ...) in a product contract"),
    ],
    "BACKEND_EXECUTION_CONTRACT.md": [
        (re.compile(r"\.tsx\b"), "UI file (.tsx) in the backend execution contract"),
        (re.compile(r"\buseState\b|\buseEffect\b"), "React hook in the backend execution contract"),
    ],
    "FRONTEND_EXECUTION_CONTRACT.md": [
        (re.compile(r"\bsignals\.py\b|\bengine\.py\b|\buvicorn\b|\bPydantic\b"),
         "server internal in the frontend execution contract"),
    ],
}


def known_endpoint_paths(context: str) -> set[str]:
    """Endpoint paths already documented in the ground truth (existing infra is fair to reference)."""
    return set(PATH_RE.findall(context))


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


def lint_feature(folder: Path, f: Findings, known_endpoints: set[str]) -> None:
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

    # M3 — interface-binding: execution contracts must reference INTERFACE_CONTRACT.md.
    for ex in ("BACKEND_EXECUTION_CONTRACT.md", "FRONTEND_EXECUTION_CONTRACT.md"):
        status = statuses.get(ex)
        epath = folder / ex
        if status in ("locked", "draft") and epath.exists():
            body = read(epath)
            if "NO_BACKEND_CHANGE" in body or "NO_UI_CHANGE" in body:
                continue
            if "INTERFACE_CONTRACT" not in body:
                f.err(f"{name}/{ex}", "execution contract does not bind to INTERFACE_CONTRACT.md "
                                      "(the single FE↔BE truth must be referenced)")

    # M4 — BRIEF fields (if a BRIEF exists).
    brief = folder / "BRIEF.md"
    if brief.exists():
        btext = read(brief)
        for field in BRIEF_FIELDS:
            if not re.search(rf"^{re.escape(field)}\s*:", btext, re.M):
                f.err(f"{name}/BRIEF.md", f"missing BRIEF field '{field}:'")

    # M5 — lane-purity heuristics (WARN).
    for fname_sub, rules in LANE_FORBIDDEN.items():
        fpath = folder / fname_sub
        if not fpath.exists():
            continue
        body = read(fpath)
        if "NO_BACKEND_CHANGE" in body or "NO_UI_CHANGE" in body:
            continue  # stub files are exempt
        for rx, why in rules:
            for ln_no, line in enumerate(body.splitlines(), 1):
                if rx.search(line):
                    f.warn(f"{name}/{fname_sub}:{ln_no}", f"lane-purity: {why}")
                    break  # one flag per rule per file is enough signal

    # M7 — a locked INTERFACE_CONTRACT should carry a machine-checkable conformance spec (system-1),
    # so interface_conformance.py can verify the live backend against it at GATE Q.
    iface = folder / "INTERFACE_CONTRACT.md"
    if statuses.get("INTERFACE_CONTRACT.md") == "locked" and iface.exists():
        ibody = read(iface)
        if "Conformance spec" not in ibody and "NO_BACKEND_CHANGE" not in ibody:
            f.warn(f"{name}/INTERFACE_CONTRACT.md",
                   "no '## Conformance spec' block — system-1 runtime conformance cannot check this "
                   "interface (interface_conformance.py needs the embedded machine-checkable spec)")

    # M6 — NEW endpoint design in the Architect/PM lane (referencing an EXISTING endpoint is fine).
    for fname_sub in NEW_ENDPOINT_FILES:
        fpath = folder / fname_sub
        if not fpath.exists():
            continue
        for ln_no, line in enumerate(read(fpath).splitlines(), 1):
            m = ENDPOINT_RE.search(line)
            if not m:
                continue
            path_m = PATH_RE.search(m.group(1))
            if not path_m:
                continue
            clean = path_m.group(0).rstrip("`.,;:)")
            known = any(clean == k or clean.startswith(k) or k.startswith(clean)
                        for k in known_endpoints)
            if not known:
                f.warn(f"{name}/{fname_sub}:{ln_no}",
                       f"lane-purity: NEW endpoint '{clean}' designed in this lane "
                       f"(architect/PM leave endpoints to the interface; existing endpoints are fine)")
                break


def lint_canon(f: Findings) -> None:
    """Repo-level: every key in the ledger's 'Promoted canon' table must have its prose in CONTEXT."""
    if not LEDGER.exists() or not CONTEXT.exists():
        f.warn("repo", "DECISION_LEDGER.md or GAMMAFLOW_CONTEXT.md missing — skipping canon check")
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
                  f"promoted key '{key}' has no prose in GAMMAFLOW_CONTEXT.md "
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

    known_endpoints = known_endpoint_paths(read(CONTEXT))
    for folder in folders:
        lint_feature(folder, f, known_endpoints)

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
