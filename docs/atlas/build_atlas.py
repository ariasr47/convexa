#!/usr/bin/env python3
"""Build the Convexa Feature Atlas — a self-contained, interactive HTML map of the product,
GENERATED from the Spire Tech canon. Never hand-maintain atlas.html; regenerate with:

    py docs/atlas/build_atlas.py

No dependencies (stdlib only). House precedent: docs/blog/build_html.py — "the script IS the
sync step." Sources parsed (tolerantly — format variance must not crash the build):

  .spire/clusters/tech/context/OPEN_THREADS.md
  .spire/clusters/tech/contracts/_archive/*/_MANIFEST.md
  .spire/clusters/tech/contracts/<live>/   any non-archive feature with BRIEF + manifest
  .spire/clusters/tech/context/DECISION_LEDGER.md
  .spire/clusters/tech/context/BACKLOG.md

The generator FAILS LOUDLY (vacuity guards) rather than emit silently-empty sections.
Output: docs/atlas/atlas.html (committed, zero external requests, works from file://).
"""

import html
import pathlib
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).parent
REPO = HERE.parent.parent
TECH = REPO / ".spire" / "clusters" / "tech"
CONTEXT = TECH / "context"
OPEN_THREADS = CONTEXT / "OPEN_THREADS.md"
LEDGER = CONTEXT / "DECISION_LEDGER.md"
BACKLOG = CONTEXT / "BACKLOG.md"
CONTRACTS = TECH / "contracts"
ARCHIVE = CONTRACTS / "_archive"
OUT = HERE / "atlas.html"

# ---------------------------------------------------------------- helpers ----

def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def trunc(s: str, n: int) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut + " …"


def inline(s: str) -> str:
    """Escape + a tiny markdown-inline subset. Links are flattened to their text
    (the atlas makes zero external requests)."""
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)  # drop link targets
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = s.replace("**", "")  # a truncation can orphan a bold marker — never render it literally
    return s


def norm_tokens(s: str) -> set:
    return {t for t in re.split(r"[^a-z0-9]+", s.lower()) if len(t) > 2}


# ------------------------------------------------------- OPEN_THREADS parse ----

FEATURE_NUM_RANGE = range(3, 8)  # sections 3..7x are features; 1–2 strategic, 8/9 not features


def parse_threads(text: str):
    """Return (features, skipped) — tolerant section split on `## <num><letter?>. <name>`."""
    heads = list(re.finditer(r"^## (\d+[a-z]?)\. (.+)$", text, re.M))
    features, skipped = [], []
    for i, m in enumerate(heads):
        sec_id, title = m.group(1), m.group(2).strip()
        body = text[m.end(): heads[i + 1].start() if i + 1 < len(heads) else len(text)]
        num = int(re.match(r"\d+", sec_id).group())
        if num not in FEATURE_NUM_RANGE:
            skipped.append(sec_id)
            continue
        status = ""
        name = title
        sm = re.search(r"\(([^()]*)\)\s*$", title)
        if sm:
            status, name = sm.group(1).strip(), title[: sm.start()].strip()
        lines = body.splitlines()
        # first paragraph = contiguous non-blank lines
        para = []
        started = False
        for ln in lines:
            if ln.strip():
                para.append(ln.strip())
                started = True
            elif started:
                break
        seams = []
        for j, ln in enumerate(lines):
            if re.search(r"seams", ln, re.I):
                chunk = ln.strip()
                if chunk.rstrip().endswith(":**"):  # a list header — pull its bullets
                    for follow in lines[j + 1: j + 6]:
                        fs = follow.strip()
                        if fs.startswith("- "):
                            seams.append(trunc(fs[2:], 220))
                        elif not fs:
                            break
                    if not seams:
                        seams.append(trunc(chunk, 300))
                else:
                    seams.append(trunc(chunk, 300))
                break  # first seams mention is the open-seams line
        folders = set(re.findall(r"_archive/([A-Za-z0-9_-]+)", body))
        date = None
        dm = re.search(r"20\d\d-\d\d-\d\d", title + " " + body)
        if dm:
            date = dm.group()
        features.append({
            "id": sec_id, "name": name, "status": status, "body": body,
            "summary": trunc(" ".join(para), 400), "seams": seams,
            "folders": folders, "date": date,
        })
    return features, skipped


# ----------------------------------------------------------- manifest parse ----

def parse_manifest(path: pathlib.Path) -> dict:
    """Semi-structured `Key:  value` lines; indented lines continue the previous key."""
    out, key = {}, None
    for ln in read(path).splitlines():
        m = re.match(r"^([A-Za-z][A-Za-z0-9 ()·/&+.-]{0,40}):\s*(.*)$", ln)
        if m and not ln.startswith((" ", "\t", "-")):
            key = m.group(1).strip()
            if key in out:          # repeated key (e.g. two `Last gateway:`) — keep the last
                out[key] = m.group(2).strip()
            else:
                out[key] = m.group(2).strip()
        elif key and ln.startswith((" ", "\t")):
            out[key] = (out[key] + " " + ln.strip()).strip()
    return out


# --------------------------------------------------------------- ledger parse ----

def parse_table(text: str, heading: str):
    """Rows of the first markdown table following `heading`. Tolerant of long cells."""
    m = re.search(rf"^## {re.escape(heading)}.*$", text, re.M)
    if not m:
        return []
    rows = []
    for ln in text[m.end():].splitlines():
        s = ln.strip()
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                continue  # separator
            rows.append(cells)
        elif rows:  # table ended
            break
        elif s.startswith("## "):
            break
    return rows[1:] if rows else []  # drop header row


def parse_watch(text: str):
    m = re.search(r"^## Watch list.*$", text, re.M)
    if not m:
        return []
    tail = text[m.end():]
    stop = re.search(r"^## ", tail, re.M)
    if stop:
        tail = tail[: stop.start()]
    items, cur = [], None
    for ln in tail.splitlines():
        if ln.startswith("- "):
            if cur:
                items.append(cur)
            cur = ln[2:].strip()
        elif cur is not None and ln.startswith((" ", "\t")):
            cur += " " + ln.strip()
    if cur:
        items.append(cur)
    return items


# -------------------------------------------------------------- backlog parse ----

ANNOT = re.compile(r"^\s*<!-- atlas: theme=(\S+) horizon=(\S+) -->\s*$")
DONE_MARK = "✓"


def parse_backlog(text: str):
    lines = text.splitlines()
    pool_at = next((i for i, ln in enumerate(lines) if ln.startswith("## Pool")), len(lines))
    items = []

    def make(first: str, nxt: str, section: str):
        nm = re.search(r"\*\*(.+?)\*\*", first)
        name = (nm.group(1) if nm else first).replace("`", "").strip().rstrip(":")
        theme = horizon = None
        am = ANNOT.match(nxt or "")
        if am:
            theme, horizon = am.group(1), am.group(2)
        after = (first[nm.end():] if nm else first).replace("**", "")
        return {
            "name": name, "section": section, "first": first,
            "done": DONE_MARK in first,
            "theme": theme, "horizon": horizon,
            "summary": trunc(after.lstrip(" —–-*:"), 180),
        }

    # pre-Pool: only annotated entries count (e.g. the standing-NEXT `scanner` item)
    for i in range(pool_at):
        if re.match(r"^(?:- |\d+\. )\*\*", lines[i]) and i + 1 < len(lines) and ANNOT.match(lines[i + 1]):
            items.append(make(lines[i], lines[i + 1], "A"))
    # Pool sections A–E: every top-level bullet
    section = None
    for i in range(pool_at, len(lines)):
        ln = lines[i]
        sm = re.match(r"^### ([A-E])\.", ln)
        if sm:
            section = sm.group(1)
            continue
        if section and ln.startswith("- **"):
            items.append(make(ln, lines[i + 1] if i + 1 < len(lines) else "", section))
    return items


# ------------------------------------------------------------------- gather ----

def fail(msg: str):
    print(f"VACUITY GUARD FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


threads_text = read(OPEN_THREADS)
ledger_text = read(LEDGER)
backlog_text = read(BACKLOG)

features, skipped_sections = parse_threads(threads_text)

manifests = {}
for mp in sorted(ARCHIVE.glob("*/_MANIFEST.md")):
    manifests[mp.parent.name] = parse_manifest(mp)

# join manifests -> features: (1) explicit `_archive/<folder>` mention in the section body,
# (2) folder-name tokens contained in the section heading (fuzzy fallback).
folder_owner = {}
for f in features:
    for folder in f["folders"]:
        if folder in manifests:
            folder_owner.setdefault(folder, f["id"])
for folder in manifests:
    if folder in folder_owner:
        continue
    ftoks = norm_tokens(folder)
    for f in features:
        if ftoks and ftoks <= norm_tokens(f["name"]):
            folder_owner[folder] = f["id"]
            break
for folder in manifests:  # last resort: first section whose body names the folder verbatim
    if folder in folder_owner:
        continue
    for f in features:
        if re.search(rf"(?<![\w-]){re.escape(folder)}(?![\w-])", f["body"]):
            folder_owner[folder] = f["id"]
            break

by_id = {f["id"]: f for f in features}
for f in features:
    f["manifests"] = []
for folder, fid in folder_owner.items():
    by_id[fid]["manifests"].append((folder, manifests[folder]))
for f in features:
    f["manifests"].sort()

# live / queued features — any non-archive contract folder with a manifest
live_dirs = sorted(
    p for p in CONTRACTS.iterdir()
    if p.is_dir() and p.name != "_archive" and (p / "_MANIFEST.md").exists()
)
live_features = []
for d in live_dirs:
    m = parse_manifest(d / "_MANIFEST.md")
    brief_path = d / "BRIEF.md"
    brief = read(brief_path) if brief_path.exists() else ""
    goal_m = re.search(r"^Goal:\s*(.*(?:\n[ \t]+.*)*)", brief, re.M)
    summary = trunc(re.sub(r"\s+", " ", goal_m.group(1)) if goal_m else (brief or m.get("Stage", d.name)), 400)
    live_features.append({"name": d.name, "manifest": m, "summary": summary, "dir": d})

# ledger
promoted = [r for r in parse_table(ledger_text, "Promoted canon (key index → where the rule lives)") if len(r) >= 5]
demoted = [r for r in parse_table(ledger_text, "Demoted (contradicted by reality — system-7)") if len(r) >= 4]
watch = parse_watch(ledger_text)
append_rows = [r for r in parse_table(ledger_text, "Ledger (append-only — one row per binding decision instance)") if len(r) >= 5]

# reverse-join earned invariant keys -> features (via the append-only rows' feature column)
ledger_feats = {}
for r in append_rows:
    key = r[0].strip("`")
    feat = r[1].strip().strip("`")
    ledger_feats.setdefault(feat, set()).add(key)
for f in features:
    f["keys"] = set()
for feat, keys in ledger_feats.items():
    fid = folder_owner.get(feat)
    if fid is None:  # e.g. light-mode-parity (no archive folder) — body-mention fallback
        for f in features:
            if feat in f["body"]:
                fid = f["id"]
                break
    if fid:
        by_id[fid]["keys"] |= keys

# backlog roadmap
roadmap = parse_backlog(backlog_text)
live = [r for r in roadmap if not r["done"]]
done = [r for r in roadmap if r["done"]]
for r in live:
    r["theme"] = r["theme"] or "unthemed"
    r["horizon"] = r["horizon"] or "later"
# themed = live items that carried an explicit atlas annotation (unannotated default to
# unthemed/later, so anything off that default was annotated; done items keep raw values)
annotated = [r for r in live if (r["theme"], r["horizon"]) != ("unthemed", "later")]
explicit_annotations = len(re.findall(r"<!-- atlas: theme=\S+ horizon=\S+ -->", backlog_text))

# ------------------------------------------------------------ vacuity guards ----

if len(features) < 20:
    fail(f"only {len(features)} shipped-feature sections parsed from OPEN_THREADS (expected >= 20)")
if len(promoted) < 10:
    fail(f"only {len(promoted)} promoted-canon rows parsed from DECISION_LEDGER (expected >= 10)")
if len(roadmap) < 15:
    fail(f"only {len(roadmap)} roadmap items parsed from BACKLOG (expected >= 15)")
if not manifests:
    fail("zero archive manifests found")

# ------------------------------------------------------------ journey mapping ----
# Presentation data — the journey column layout lives HERE (the generator is its single source).
# Each entry: (label, feature-section-id or None). Ids are asserted against the parsed catalog.

JOURNEY = [
    ("Discover", [
        ("Landing page", "7d"),
        ("Blog", None),
    ]),
    ("Analyze", [
        ("Ticker viewer", "7e"),
        ("GEX profile chart", "7l"),
        ("Positioning metrics (DEX · Vol/OI · Skew · Term)", "4"),
        ("IV rank", "7r"),
        ("Market context", "7q"),
        ("Dealer-flow projection", "7o"),
        ("Off-exchange blocks", "3"),
    ]),
    ("AI read", [
        ("Personas", "7"),
        ("AI recommendations", "7b"),
        ("BYO AI key", "7h"),
        ("AI context pack", "7q"),
    ]),
    ("Act — simulated", [
        ("TradeEntryDialog (shared sim entry)", "7n"),
        ("Simulated orders", "7n"),
        ("Scenario harness", "7n"),
    ]),
    ("Track", [
        ("Positions portfolio", "7c"),
        ("Ghost-trade model", "5"),
    ]),
    ("Review", [
        ("Outcome ledger — the track record", "7t"),
    ]),
]
PLATFORM = [
    ("Auth & accounts", "7f"),
    ("Containerized apps", "7i"),
    ("Persistent DB", "7j"),
    ("Deploy — Railway + CF Pages", "7k"),
    ("Observability + /_ops/metrics", "6"),
    ("Delivery-kit (the build system)", None),
]
for _, entries in JOURNEY + [("Platform", PLATFORM)]:
    for label, fid in entries:
        if fid is not None and fid not in by_id:
            fail(f"journey entry '{label}' references unknown feature section '{fid}'")

THEMES = {
    "trust-the-signal": ("#2E86AB", "the numbers deserve belief"),
    "breadth": ("#7C5CE0", "more tickers, more context"),
    "reach": ("#1FA588", "more users can find + use it"),
    "go-live": ("#C87422", "real users, real data, real money readiness"),
    "the-machine": ("#8A7A9C", "the build system itself"),
    "unthemed": ("#8b8b8b", "not yet themed (defaults)"),
}
HORIZONS = ["now", "next", "later"]

# ------------------------------------------------------------------ HTML out ----

def chip(text, cls=""):
    return f'<span class="chip {cls}">{inline(text)}</span>'


def feature_card(f) -> str:
    fid = f["id"]
    st = f["status"] or "OPEN NOTE"
    st_cls = "shipped" if "SHIPPED" in st.upper() else "note"
    mani = ""
    lanes = qa = tests = ""
    for folder, m in f.get("manifests", []):
        lanes = lanes or m.get("Repos", "")
        qa = qa or m.get("QA (GATE Q)", "")
        tests = tests or m.get("Tests", "")
        mani += f'<div class="mrow"><code>{html.escape(folder)}</code> · {inline(trunc(m.get("Stage", ""), 130))}</div>'
    if not f.get("manifests"):
        mani = '<div class="mrow dim">no manifest — predates the manifest convention; rendered from OPEN_THREADS alone</div>'
    keys = "".join(f'<a class="chip key" href="#invariants">{html.escape(k)}</a>' for k in sorted(f["keys"]))
    seams = "".join(f'<div class="seam">{inline(s)}</div>' for s in f["seams"])
    meta = []
    if f.get("date"):
        meta.append(f'shipped {html.escape(f["date"])}')
    if lanes:
        meta.append("lanes: " + trunc(lanes, 60))
    qa_line = f'<div class="qa"><strong>QA:</strong> {inline(trunc(qa, 220))}</div>' if qa else ""
    tests_line = f'<div class="qa"><strong>Tests:</strong> {inline(trunc(tests, 160))}</div>' if tests else ""
    return f'''<article class="card f-card" id="f-{fid}" data-status="{st_cls}">
  <header><h3>§{fid} · {inline(f["name"])}</h3><span class="chip {st_cls}">{inline(trunc(st, 60))}</span></header>
  <div class="meta">{inline(" · ".join(meta))}</div>
  <p>{inline(f["summary"])}</p>
  {qa_line}{tests_line}
  <div class="mani">{mani}</div>
  {f'<div class="seams"><strong>Open seams:</strong>{seams}</div>' if seams else ""}
  {f'<div class="keys"><strong>Invariants earned:</strong> {keys}</div>' if keys else ""}
</article>'''


def live_feature_card(lf) -> str:
    m = lf["manifest"]
    name = lf["name"]
    return f'''<article class="card f-card queued" id="f-{html.escape(name)}" data-status="queued">
  <header><h3>{inline(name)} · live pipeline</h3><span class="chip queued">QUEUED / IN FLIGHT</span></header>
  <div class="meta">{inline(trunc(m.get("Stage", ""), 110))} · lanes: {inline(trunc(m.get("Lanes", ""), 60))}</div>
  <p>{inline(lf["summary"])}</p>
  <div class="qa"><strong>Invariant watch:</strong> {inline(trunc(m.get("Invariant watch (from BRIEF)", ""), 320))}</div>
  <div class="mani"><div class="mrow"><code>contracts/{html.escape(name)}</code> · {inline(trunc(m.get("Notes", ""), 180))}</div></div>
</article>'''


# journey
journey_cols = ""
for stage, entries in JOURNEY:
    cells = ""
    for label, fid in entries:
        if fid:
            cells += f'<a class="jcard" href="#f-{fid}">{inline(label)}</a>'
        else:
            cells += f'<span class="jcard nolink">{inline(label)}</span>'
    journey_cols += f'<div class="jcol"><h3>{inline(stage)}</h3>{cells}</div>'
platform_cells = "".join(
    (f'<a class="jcard" href="#f-{fid}">{inline(label)}</a>' if fid else f'<span class="jcard nolink">{inline(label)}</span>')
    for label, fid in PLATFORM)

# catalog
catalog_cards = "".join(live_feature_card(lf) for lf in live_features) + "".join(feature_card(f) for f in features)

# invariants
inv_cards = ""
for r in promoted:
    key, rule, lives, when, earned = (r + ["", "", "", "", ""])[:5]
    inv_cards += f'''<article class="card inv-card" id="inv-{html.escape(key.strip("`"))}">
  <header><h3><code>{html.escape(key.strip("`"))}</code></h3><span class="chip shipped">promoted {inline(when)}</span></header>
  <p>{inline(rule)}</p>
  <div class="meta">earned by: {inline(trunc(earned, 260))}</div>
</article>'''
watch_html = ""
for w in watch:
    graduated = w.startswith("_(")
    watch_html += f'<div class="watch{" dim" if graduated else ""}">{inline(trunc(w.strip("_"), 320))}</div>'
dem_html = ""
for r in demoted:
    key, when, ev, disp = (r + ["", "", "", ""])[:4]
    dem_html += f'''<article class="card inv-card demoted"><header><h3><code>{html.escape(key.strip("`"))}</code></h3>
  <span class="chip note">demoted {inline(when)}</span></header>
  <p><strong>Evidence:</strong> {inline(trunc(ev, 220))}</p><p>{inline(trunc(disp, 380))}</p></article>'''

# roadmap
def road_card(r):
    color = THEMES.get(r["theme"], THEMES["unthemed"])[0]
    return f'''<article class="card r-card" style="border-left:4px solid {color}">
  <header><h4>{inline(r["name"])}</h4></header>
  <div class="meta"><span class="chip sec">§{r["section"]}</span> <span class="chip" style="background:{color};color:#fff">{r["theme"]}</span></div>
  <p>{inline(r["summary"])}</p>
</article>'''

road_cols = ""
for hz in HORIZONS:
    cards = "".join(road_card(r) for r in live if r["horizon"] == hz)
    road_cols += f'<div class="rcol"><h3>{hz.capitalize()} <span class="count">{sum(1 for r in live if r["horizon"] == hz)}</span></h3>{cards}</div>'
legend = "".join(
    f'<span class="chip" style="background:{c};color:#fff">{t}</span> <span class="dim">{html.escape(d)}</span><br>'
    for t, (c, d) in THEMES.items())
done_html = "".join(
    f'<span class="chip done">§{r["section"]} · {inline(trunc(r["name"], 70))}</span>' for r in done)

# freshness (source mtimes — NOT the current time; determinism)
sources = [OPEN_THREADS, LEDGER, BACKLOG] + \
          [p for lf in live_features for p in (lf["dir"] / "BRIEF.md", lf["dir"] / "_MANIFEST.md") if p.exists()] + \
          sorted(ARCHIVE.glob("*/_MANIFEST.md"))
def mt(p):
    return datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
newest = max(sources, key=lambda p: p.stat().st_mtime)
freshness = f"{mt(newest):%Y-%m-%d %H:%M UTC} ({newest.relative_to(REPO).as_posix()})"
mtimes_rows = "".join(
    f"<tr><td><code>{p.relative_to(REPO).as_posix()}</code></td><td>{mt(p):%Y-%m-%d %H:%M UTC}</td></tr>"
    for p in sources)

counts = {
    "features": len(features), "queued": len(live_features), "manifests": len(folder_owner),
    "promoted": len(promoted), "watch": len(watch), "demoted": len(demoted),
    "roadmap": len(roadmap), "live": len(live), "done": len(done),
    "annotated": len(annotated),
}

PAGE = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Convexa Feature Atlas</title>
<meta name="description" content="A generated, interactive map of the Convexa product: journey, catalog, invariants, roadmap.">
<style>
  :root {{
    color-scheme: light dark;
    --bg:#F4F1EB; --card:#FFFFFF; --ink:#23252B; --dim:#6d6a63; --line:#DAD5CC;
    --accent:#2E6F69; --code:#E9E5DC; --shipped:#2E6F69; --queued:#1d6fe0; --note:#B4562B;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#15171c; --card:#1e2128; --ink:#e8e6e1; --dim:#9a978f; --line:#33363e;
      --accent:#5fb3aa; --code:#2a2d35; --shipped:#3f9e93; --queued:#5f95e8; --note:#d08a5e; }}
  }}
  body {{ margin:0; background:var(--bg); color:var(--ink); line-height:1.55;
    font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif; }}
  main {{ max-width:1100px; margin:0 auto; padding:28px 20px 80px; }}
  h1 {{ font-size:1.7rem; margin:0 0 .1em; letter-spacing:-.01em; }}
  .gen {{ font-size:.85rem; color:var(--dim); margin-bottom:1em; }}
  .gen code {{ background:var(--code); border-radius:4px; padding:.05em .3em; }}
  code {{ background:var(--code); border-radius:4px; padding:.05em .3em;
    font-family:'Cascadia Code',Consolas,Menlo,monospace; font-size:.88em; }}
  nav.tabs {{ display:flex; gap:6px; margin:14px 0 20px; flex-wrap:wrap; }}
  nav.tabs a {{ padding:.45em 1em; border:1px solid var(--line); border-radius:20px;
    text-decoration:none; color:var(--ink); font-weight:600; font-size:.95rem; }}
  nav.tabs a.active {{ background:var(--accent); border-color:var(--accent); color:#fff; }}
  section.tab {{ display:none; }}
  section.tab.active {{ display:block; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:10px;
    padding:14px 16px; margin:0 0 14px; }}
  .card header {{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; flex-wrap:wrap; }}
  .card h3 {{ margin:0; font-size:1.02rem; }} .card h4 {{ margin:0; font-size:.95rem; }}
  .card p {{ margin:.5em 0; font-size:.9rem; }}
  .chip {{ display:inline-block; padding:.1em .6em; border-radius:12px; font-size:.72rem;
    font-weight:650; background:var(--code); white-space:nowrap; }}
  .chip.shipped {{ background:var(--shipped); color:#fff; }}
  .chip.queued {{ background:var(--queued); color:#fff; }}
  .chip.note {{ background:var(--note); color:#fff; }}
  .chip.key {{ background:var(--code); color:var(--ink); text-decoration:none; margin:2px; font-weight:500; }}
  .chip.sec {{ background:var(--code); }}
  .chip.done {{ margin:3px; font-weight:500; }}
  .meta {{ font-size:.78rem; color:var(--dim); margin:.2em 0; }}
  .qa {{ font-size:.8rem; margin:.3em 0; }}
  .mani {{ border-top:1px dashed var(--line); margin-top:.6em; padding-top:.4em; }}
  .mrow {{ font-size:.78rem; color:var(--dim); margin:.15em 0; }}
  .seams {{ font-size:.8rem; margin-top:.5em; }} .seam {{ color:var(--dim); margin:.15em 0; }}
  .keys {{ margin-top:.5em; font-size:.8rem; }}
  .dim {{ color:var(--dim); }}
  .f-card.queued {{ border:2px dashed var(--queued); }}
  .f-card.hl {{ outline:3px solid var(--accent); }}
  .jwrap {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }}
  .jcol h3 {{ font-size:.9rem; border-bottom:2px solid var(--accent); padding-bottom:.3em; }}
  .jcard {{ display:block; background:var(--card); border:1px solid var(--line); border-radius:8px;
    padding:.5em .7em; margin:.4em 0; font-size:.82rem; text-decoration:none; color:var(--ink); }}
  a.jcard:hover {{ border-color:var(--accent); }}
  .jcard.nolink {{ color:var(--dim); }}
  .platform {{ margin-top:20px; border-top:1px solid var(--line); padding-top:10px; }}
  .platform .jcard {{ display:inline-block; margin-right:8px; }}
  .filters {{ display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }}
  .filters input, .filters select {{ padding:.45em .7em; border:1px solid var(--line); border-radius:8px;
    background:var(--card); color:var(--ink); font-size:.9rem; }}
  .rwrap {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; }}
  .rcol h3 {{ border-bottom:2px solid var(--line); padding-bottom:.3em; }}
  .count {{ font-size:.75rem; color:var(--dim); font-weight:400; }}
  details {{ margin:1em 0; font-size:.82rem; }} table {{ border-collapse:collapse; font-size:.8rem; }}
  td {{ border:1px solid var(--line); padding:.25em .6em; }}
  .legend {{ font-size:.82rem; margin:.8em 0 1.2em; line-height:1.9; }}
  .counts {{ font-size:.8rem; color:var(--dim); margin-bottom:1em; }}
  .donestrip summary {{ cursor:pointer; font-weight:650; }}
</style>
</head>
<body>
<main>
<h1>Convexa Feature Atlas</h1>
<p class="gen">GENERATED from <code>.spire/clusters/tech/</code> canon — do not edit; regenerate with
<code>py docs/atlas/build_atlas.py</code>. Freshness = newest source mtime: <strong>{freshness}</strong>.</p>
<details><summary>Source files + mtimes</summary><table>{mtimes_rows}</table></details>

<nav class="tabs">
  <a href="#journey" data-tab="journey">Journey</a>
  <a href="#catalog" data-tab="catalog">Catalog</a>
  <a href="#invariants" data-tab="invariants">Invariants</a>
  <a href="#roadmap" data-tab="roadmap">Roadmap</a>
</nav>

<section class="tab" id="tab-journey">
  <p class="counts">The trader's path through the product. Every card hash-links to its catalog entry.</p>
  <div class="jwrap">{journey_cols}</div>
  <div class="platform"><h3>Platform (underneath it all)</h3>{platform_cells}</div>
</section>

<section class="tab" id="tab-catalog">
  <p class="counts">{counts["features"]} shipped feature sections + {counts["queued"]} live/queued ·
  {counts["manifests"]} archive manifests joined.</p>
  <div class="filters">
    <input id="q" type="search" placeholder="Filter features…" aria-label="Filter">
    <select id="statusFilter" aria-label="Status filter">
      <option value="">All statuses</option>
      <option value="shipped">Shipped</option>
      <option value="queued">Queued</option>
      <option value="note">Other / notes</option>
    </select>
  </div>
  <div id="catalog-cards">{catalog_cards}</div>
</section>

<section class="tab" id="tab-invariants">
  <p class="counts">Why the app stays cohesive: {counts["promoted"]} promoted-canon rules ·
  {counts["watch"]} watch-list entries · {counts["demoted"]} demoted. Prose lives once in
  <code>PROJECT_CONTEXT.md</code> §5; this is the index.</p>
  {inv_cards}
  <h3>Watch list</h3>{watch_html}
  <h3>Demoted (contradicted by reality)</h3>{dem_html}
</section>

<section class="tab" id="tab-roadmap">
  <p class="counts">{counts["live"]} live items ({counts["annotated"]} themed) · {counts["done"]} shipped/closed.
  Sourced from <code>BACKLOG.md</code> §A–§E + the invisible atlas annotations.</p>
  <div class="legend">{legend}</div>
  <div class="rwrap">{road_cols}</div>
  <details class="donestrip"><summary>Shipped / closed ({counts["done"]})</summary><div>{done_html}</div></details>
</section>

<script>
(function () {{
  var tabs = ["journey", "catalog", "invariants", "roadmap"];
  function show(name) {{
    tabs.forEach(function (t) {{
      document.getElementById("tab-" + t).classList.toggle("active", t === name);
    }});
    document.querySelectorAll("nav.tabs a").forEach(function (a) {{
      a.classList.toggle("active", a.dataset.tab === name);
    }});
  }}
  function route() {{
    var h = location.hash.replace("#", "");
    if (tabs.indexOf(h) >= 0) {{ show(h); return; }}
    if (h.indexOf("f-") === 0) {{
      show("catalog");
      var el = document.getElementById(h);
      if (el) {{
        document.querySelectorAll(".f-card.hl").forEach(function (c) {{ c.classList.remove("hl"); }});
        el.classList.add("hl");
        el.scrollIntoView({{ block: "start" }});
      }}
      return;
    }}
    if (h.indexOf("inv-") === 0) {{
      show("invariants");
      var iv = document.getElementById(h);
      if (iv) iv.scrollIntoView({{ block: "start" }});
      return;
    }}
    show("journey");
  }}
  window.addEventListener("hashchange", route);
  route();
  var q = document.getElementById("q"), sf = document.getElementById("statusFilter");
  function filter() {{
    var needle = q.value.toLowerCase(), st = sf.value;
    document.querySelectorAll("#catalog-cards .f-card").forEach(function (c) {{
      var okText = !needle || c.textContent.toLowerCase().indexOf(needle) >= 0;
      var okStatus = !st || c.dataset.status === st;
      c.style.display = okText && okStatus ? "" : "none";
    }});
  }}
  q.addEventListener("input", filter);
  sf.addEventListener("change", filter);
}})();
</script>
</main>
</body>
</html>
'''

OUT.write_text(PAGE, encoding="utf-8")

# ----------------------------------------------------- structural self-verify ----

emitted = read(OUT)
for t in ("tab-journey", "tab-catalog", "tab-invariants", "tab-roadmap"):
    if f'id="{t}"' not in emitted:
        fail(f"emitted HTML missing section {t}")
fcards = emitted.count('class="card f-card')
expected_cards = len(features) + len(live_features)
if fcards != expected_cards:
    fail(f"catalog card count {fcards} != features({len(features)}) + live({len(live_features)})")
if re.search(r'(?:href|src)="https?://', emitted):
    fail("emitted HTML contains an external http(s) reference")

print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
print("--- parse report ---")
print(f"features (OPEN_THREADS 3..7t):  {counts['features']} shipped + {counts['queued']} live/queued")
print(f"non-feature sections skipped:   {skipped_sections}")
print(f"archive manifests found/joined: {len(manifests)}/{counts['manifests']}")
unjoined = sorted(set(manifests) - set(folder_owner))
if unjoined:
    print(f"  UNJOINED manifests:           {unjoined}")
print(f"promoted canon rows:            {counts['promoted']}")
print(f"watch-list entries:             {counts['watch']}  · demoted: {counts['demoted']}")
sec_counts = {}
for r in roadmap:
    sec_counts[r["section"]] = sec_counts.get(r["section"], 0) + 1
print(f"roadmap items:                  {counts['roadmap']} total {dict(sorted(sec_counts.items()))}")
print(f"  live: {counts['live']}  · done: {counts['done']}  · themed-annotated: {counts['annotated']}"
      f"  · annotation comments in BACKLOG: {explicit_annotations}")
