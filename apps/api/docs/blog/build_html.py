#!/usr/bin/env python3
"""Build a single self-contained HTML file from the blog markdown, inlining every SVG.
No dependencies — a small Markdown subset converter tailored to this post."""
import re, pathlib

HERE = pathlib.Path(__file__).parent
MD = HERE / "building-a-team-of-ai-roles.md"
OUT = HERE / "building-a-team-of-ai-roles.html"
IMG = HERE / "img"

def inline(s: str) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    return s

def convert(md: str) -> str:
    out, para, items, quote = [], [], [], []
    def flush_para():
        if para:
            out.append("<p>" + inline(" ".join(para).strip()) + "</p>"); para.clear()
    def flush_list():
        if items:
            out.append("<ul>" + "".join("<li>" + inline(" ".join(it).strip()) + "</li>" for it in items) + "</ul>")
            items.clear()
    def flush_quote():
        if quote:
            out.append("<blockquote>" + inline(" ".join(quote).strip()) + "</blockquote>"); quote.clear()
    def flush_all():
        flush_para(); flush_list(); flush_quote()

    for raw in md.split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if stripped == "":
            flush_all(); continue
        if stripped == "---":
            flush_all(); out.append("<hr>"); continue
        m = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if m:
            flush_all()
            alt, path = m.group(1), m.group(2)
            svg = (IMG / pathlib.Path(path).name).read_text(encoding="utf-8") if (IMG / pathlib.Path(path).name).exists() else ""
            cap = "<figcaption>" + inline(alt) + "</figcaption>" if alt else ""
            out.append("<figure>" + svg + cap + "</figure>"); continue
        if line.startswith("## "):
            flush_all(); out.append("<h2>" + inline(line[3:].strip()) + "</h2>"); continue
        if line.startswith("# "):
            flush_all(); out.append("<h1>" + inline(line[2:].strip()) + "</h1>"); continue
        if line.startswith("> "):
            flush_para(); flush_list(); quote.append(line[2:].strip()); continue
        if re.match(r"^- ", line):
            flush_para(); flush_quote(); items.append([line[2:].strip()]); continue
        if items and (raw.startswith("  ") or raw.startswith("\t")):
            items[-1].append(stripped); continue
        flush_list(); flush_quote(); para.append(stripped)
    flush_all()
    return "\n".join(out)

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>We Didn't Hire a Team. We Built One — Out of AI Sessions.</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ margin:0; background:#F4F1EB; color:#23252B;
    font-family:'Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
    line-height:1.7; -webkit-font-smoothing:antialiased; }}
  main {{ max-width:760px; margin:0 auto; padding:48px 22px 80px; }}
  h1 {{ font-size:2.05rem; line-height:1.2; margin:0 0 .2em; letter-spacing:-.01em; }}
  h2 {{ font-size:1.4rem; margin:2.4em 0 .5em; letter-spacing:-.01em; }}
  p {{ margin:0 0 1.05em; }}
  ul {{ margin:0 0 1.2em; padding-left:1.25em; }}
  li {{ margin:.4em 0; }}
  strong {{ font-weight:650; }}
  code {{ background:#E9E5DC; border-radius:5px; padding:.08em .35em; font-size:.92em;
    font-family:'Cascadia Code',Consolas,Menlo,monospace; }}
  a {{ color:#2E6F69; }}
  blockquote {{ margin:1.4em 0; padding:.4em 0 .4em 1.1em; border-left:4px solid #B4562B;
    font-size:1.12rem; color:#3a3d45; font-style:italic; }}
  hr {{ border:none; border-top:1px solid #DAD5CC; margin:2.4em 0; }}
  figure {{ margin:1.8em 0; }}
  figure svg {{ width:100%; height:auto; display:block; }}
  figcaption {{ margin-top:.5em; text-align:center; font-size:.82rem; color:#8A8170; }}
  .byline {{ color:#707684; font-size:1.02rem; font-style:italic; }}
  @media (max-width:560px) {{ h1 {{ font-size:1.7rem; }} main {{ padding:32px 16px 60px; }} }}
</style>
</head>
<body>
<main>
{body}
</main>
</body>
</html>
"""

def main():
    body = convert(MD.read_text(encoding="utf-8"))
    OUT.write_text(TEMPLATE.format(body=body), encoding="utf-8")
    print("Wrote", OUT, f"({OUT.stat().st_size//1024} KB)")

if __name__ == "__main__":
    main()
