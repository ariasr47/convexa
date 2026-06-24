#!/usr/bin/env python
"""context_for.py — ground-truth retrieval / sharding (system-5).

Decouples per-session token cost from total system size. Instead of re-reading the whole
`GAMMAFLOW_CONTEXT.md` every session, a role loads only the **minimal context pack** a feature needs:
the always-load invariant floor + the sections relevant to the feature's tags. As more features ship
and the canon grows, the savings grow with it.

Logical-slice (not a physical split): `GAMMAFLOW_CONTEXT.md` stays the single source. Each `## N.`
section carries an inline `<!-- shard: tags=...; always -->` annotation; this tool selects sections by
relevance. **Binding invariant: invariant-bearing sections are `always` — sharding never drops a rule
a feature could violate** (§3 math constraints + §5 key decisions/promoted invariants are always-load).

Usage:
    python .claude/tools/context_for.py {FEATURE}            # --stat (what would load + savings)
    python .claude/tools/context_for.py {FEATURE} --print    # emit the assembled context pack
    python .claude/tools/context_for.py --tags a,b --stat    # ad-hoc: select by explicit tags
Feature tags come from the BRIEF's optional `Context tags:` line + its Invariant-watch keys; `--tags`
overrides. Stdlib only.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLAUDE = ROOT / ".claude"
CONTEXT = CLAUDE / "GAMMAFLOW_CONTEXT.md"
CONTRACTS = CLAUDE / "contracts"
ARCHIVE = CONTRACTS / "_archive"
SHARD_RE = re.compile(r"<!--\s*shard:\s*(.*?)\s*-->")


class Section:
    def __init__(self, heading: str, lines: list[str]):
        self.heading = heading
        self.lines = lines
        self.tags: set[str] = set()
        self.always = False

    def scan_shard(self) -> None:
        """Parse the inline `<!-- shard: tags=...; always -->` annotation. Call AFTER all body
        lines are appended (the annotation sits just under the heading)."""
        for ln in self.lines[:3]:
            m = SHARD_RE.search(ln)
            if m:
                spec = m.group(1)
                self.always = "always" in spec
                tm = re.search(r"tags=([\w,\-]+)", spec)
                if tm:
                    self.tags = {t.strip() for t in tm.group(1).split(",") if t.strip()}

    @property
    def n_lines(self) -> int:
        return len(self.lines)


def parse_sections(text: str) -> tuple[list[str], list[Section]]:
    lines = text.splitlines()
    preamble: list[str] = []
    sections: list[Section] = []
    cur: Section | None = None
    for ln in lines:
        if ln.startswith("## "):
            cur = Section(ln, [ln])
            sections.append(cur)
        elif cur is None:
            preamble.append(ln)
        else:
            cur.lines.append(ln)
    for s in sections:
        s.scan_shard()
    return preamble, sections


def feature_tags(feature: str | None, explicit: str | None) -> set[str]:
    if explicit:
        return {t.strip().lower() for t in explicit.split(",") if t.strip()}
    if not feature:
        return set()
    brief = None
    for base in (CONTRACTS, ARCHIVE):
        cand = base / feature / "BRIEF.md"
        if cand.exists():
            brief = cand.read_text(encoding="utf-8")
            break
    if brief is None:
        print(f"(no BRIEF for '{feature}' — selecting always-load only)")
        return set()
    tags: set[str] = set()
    m = re.search(r"^Context tags:\s*(.+)$", brief, re.M)
    if m:
        tags |= {t.strip().lower() for t in re.split(r"[,\s]+", m.group(1)) if t.strip()}
    # Invariant-watch keys (e.g. `[best-effort-isolated-or-null]`) double as tags.
    inv = re.search(r"Invariant watch:(.*?)(?:\n[A-Z][a-z].*?:|\Z)", brief, re.S)
    if inv:
        tags |= {k.lower() for k in re.findall(r"[`\[]([a-z][a-z0-9-]{3,})[`\]]", inv.group(1))}
    return tags


def main(argv: list[str]) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # canon contains arrows/box chars
    except AttributeError:
        pass
    args = argv[1:]
    do_print = "--print" in args
    explicit = None
    if "--tags" in args:
        explicit = args[args.index("--tags") + 1]
    feature = next((a for a in args if not a.startswith("--")
                    and (explicit is None or a != explicit)), None)

    preamble, sections = parse_sections(CONTEXT.read_text(encoding="utf-8"))
    ftags = feature_tags(feature, explicit)

    selected: list[Section] = []
    for s in sections:
        if s.always or (s.tags & ftags):
            selected.append(s)

    if do_print:
        out = list(preamble)
        for s in selected:
            out += s.lines
        print("\n".join(out))
        return 0

    total = sum(s.n_lines for s in sections) + len(preamble)
    loaded = sum(s.n_lines for s in selected) + len(preamble)
    print(f"context_for — feature: {feature or '(ad-hoc)'}  tags: {sorted(ftags) or '—'}")
    print(f"  preamble (always): {len(preamble)} lines")
    for s in sections:
        on = s in selected
        why = "always" if s.always else ("tag" if on else "—")
        mark = "LOAD" if on else "skip"
        print(f"  [{mark}] {s.heading[:48]:48} {s.n_lines:4d} ln  ({why})")
    saved = total - loaded
    pct = (saved / total * 100) if total else 0
    print(f"\n  pack: {loaded}/{total} lines  —  {saved} saved ({pct:.0f}% smaller)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
