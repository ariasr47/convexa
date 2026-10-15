#!/usr/bin/env python3
"""Build self-contained blog HTML from markdown, inlining every SVG.

No dependencies — a small Markdown subset converter (h1/h2/h3, p, ul/ol, blockquote,
tables, hr, images-as-inline-SVG, `code`/**bold**/*em*/links) tailored to these posts.

Each article's one source is its markdown here. The site renders it inside the shell at
/blog/<slug>.html (apps/dashboard/src/app/pages/blog/posts.ts reads the same file at build
time). This script writes the PLAIN copy for readers without JavaScript (index.html's
<noscript> links to it): here in docs/blog/ and into apps/dashboard/public/blog/plain/.
Never write a page to public/blog/<slug>.html itself: a static file there would win over the
in-shell route and the post would lose the site's bar, nav and footer.
"""
import html
import pathlib
import re

HERE = pathlib.Path(__file__).parent
REPO = HERE.parent.parent
PUBLIC = REPO / "apps" / "dashboard" / "public" / "blog" / "plain"
IMG = HERE / "img"

ARTICLES = [
    {
        "md": HERE / "how-we-read-dealer-structure.md",
        "slug": "how-we-read-dealer-structure",
        "title": "How We Read Dealer Structure",
        "description": (
            "Walls, the gamma flip, GEX, score, and two data speeds — what Convexa actually "
            "computes, on what basis, and where the read is weak."
        ),
    },
]


def inline(s: str) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])_([^_]+)_(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    return s


def convert(md: str) -> str:
    out, para, quote = [], [], []
    items = []  # list of (kind, [lines]) where kind is 'ul' | 'ol'
    table = []  # raw table rows

    def flush_para():
        if para:
            out.append("<p>" + inline(" ".join(para).strip()) + "</p>")
            para.clear()

    def flush_list():
        if items:
            kind = items[0][0]
            out.append(
                f"<{kind}>"
                + "".join("<li>" + inline(" ".join(it).strip()) + "</li>" for _, it in items)
                + f"</{kind}>"
            )
            items.clear()

    def flush_quote():
        if quote:
            out.append("<blockquote>" + inline(" ".join(quote).strip()) + "</blockquote>")
            quote.clear()

    def flush_table():
        if table:
            rows = [
                [c.strip() for c in r.strip().strip("|").split("|")]
                for r in table
                if not re.match(r"^\s*\|?[\s:|-]+\|?\s*$", r)  # drop the separator row
            ]
            if rows:
                head, body = rows[0], rows[1:]
                thead = "<tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>"
                tbody = "".join(
                    "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body
                )
                out.append(f"<table><thead>{thead}</thead><tbody>{tbody}</tbody></table>")
            table.clear()

    def flush_all():
        flush_para(); flush_list(); flush_quote(); flush_table()

    for raw in md.split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if stripped == "":
            flush_all(); continue
        if stripped == "---":
            flush_all(); out.append("<hr>"); continue
        if stripped.startswith("|"):
            flush_para(); flush_list(); flush_quote(); table.append(stripped); continue
        m = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if m:
            flush_all()
            alt, path = m.group(1), m.group(2)
            svg_path = IMG / pathlib.Path(path).name
            svg = svg_path.read_text(encoding="utf-8") if svg_path.exists() else ""
            cap = "<figcaption>" + inline(alt) + "</figcaption>" if alt else ""
            out.append("<figure>" + svg + cap + "</figure>"); continue
        if line.startswith("### "):
            flush_all(); out.append("<h3>" + inline(line[4:].strip()) + "</h3>"); continue
        if line.startswith("## "):
            flush_all(); out.append("<h2>" + inline(line[3:].strip()) + "</h2>"); continue
        if line.startswith("# "):
            flush_all(); out.append("<h1>" + inline(line[2:].strip()) + "</h1>"); continue
        if line.startswith("> "):
            flush_para(); flush_list(); flush_table(); quote.append(line[2:].strip()); continue
        if stripped == ">":
            flush_para(); flush_list(); flush_table(); quote.append(""); continue
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            flush_para(); flush_quote(); flush_table()
            if items and items[0][0] != "ol":
                flush_list()
            items.append(("ol", [m.group(2).strip()])); continue
        if re.match(r"^- ", line):
            flush_para(); flush_quote(); flush_table()
            if items and items[0][0] != "ul":
                flush_list()
            items.append(("ul", [line[2:].strip()])); continue
        if items and (raw.startswith("  ") or raw.startswith("\t")):
            items[-1][1].append(stripped); continue
        flush_list(); flush_quote(); flush_table(); para.append(stripped)
    flush_all()
    return "\n".join(out)


TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex">
<link rel="canonical" href="https://convexa.pages.dev/blog/{slug}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Convexa">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="https://convexa.pages.dev/blog/{slug}.html">
<meta property="og:image" content="https://convexa.pages.dev/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
<style>
  /* Curvature Terminal tokens (redesign-stage-1 §4.4) — values single-sourced from
     apps/dashboard/src/app/shared/theme/tokens.ts (ink/panel/phosphor/steel/gammaAmber/signal);
     the generator cannot import TypeScript, so the literals are carried here by hand
     (change tokens.ts -> update these literals and re-run this script).
     Fonts: the app's self-hosted same-origin faces (/fonts/..., OFL 1.1) — never a CDN. */
  @font-face {{ font-family:'IBM Plex Sans'; font-style:normal; font-display:swap; font-weight:400;
    src:url('/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2') format('woff2'); }}
  @font-face {{ font-family:'IBM Plex Sans'; font-style:normal; font-display:swap; font-weight:600;
    src:url('/fonts/ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2') format('woff2'); }}
  @font-face {{ font-family:'IBM Plex Sans'; font-style:normal; font-display:swap; font-weight:700;
    src:url('/fonts/ibm-plex-sans/ibm-plex-sans-latin-700-normal.woff2') format('woff2'); }}
  @font-face {{ font-family:'IBM Plex Mono'; font-style:normal; font-display:swap; font-weight:400;
    src:url('/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2') format('woff2'); }}
  @font-face {{ font-family:'Archivo'; font-style:normal; font-display:swap; font-weight:100 900;
    font-stretch:62% 125%;
    src:url('/fonts/archivo/archivo-latin-standard-normal.woff2') format('woff2-variations'); }}
  :root {{ color-scheme: dark; }}
  body {{ margin:0; background:#0B0F17; color:#E9E4D6; font-size:15px;
    font-family:'IBM Plex Sans',system-ui,'Segoe UI',Roboto,sans-serif;
    line-height:1.65; -webkit-font-smoothing:antialiased; }}
  main {{ max-width:760px; margin:0 auto; padding:48px 22px 80px; }}
  h1, h2, h3 {{ font-family:'Archivo','IBM Plex Sans',system-ui,sans-serif;
    font-stretch:112.5%; }}
  h1 {{ font-size:2.05rem; line-height:1.2; margin:0 0 .2em; letter-spacing:-.01em; }}
  h2 {{ font-size:1.4rem; margin:2.4em 0 .5em; letter-spacing:-.01em; }}
  h3 {{ font-size:1.15rem; margin:1.8em 0 .4em; }}
  p {{ margin:0 0 1.05em; }}
  ul, ol {{ margin:0 0 1.2em; padding-left:1.25em; }}
  li {{ margin:.4em 0; }}
  strong {{ font-weight:650; }}
  code {{ background:#131A24; border-radius:5px; padding:.08em .35em; font-size:.92em;
    font-family:'IBM Plex Mono',Consolas,Menlo,monospace; }}
  a {{ color:#5E8BC4; }}
  blockquote {{ margin:1.4em 0; padding:.4em 0 .4em 1.1em; border-left:3px solid #8A9BB4;
    font-size:1.05rem; color:#8A9BB4; font-style:italic; }}
  hr {{ border:none; border-top:1px solid rgba(138,155,180,0.25); margin:2.4em 0; }}
  figure {{ margin:1.8em 0; }}
  figure svg {{ width:100%; height:auto; display:block; }}
  figcaption {{ margin-top:.5em; text-align:center; font-size:.82rem; color:#8A9BB4; }}
  table {{ border-collapse:collapse; margin:1.4em 0; width:100%; font-size:.95em; }}
  th, td {{ border:1px solid rgba(138,155,180,0.25); padding:.5em .7em; text-align:left;
    vertical-align:top; }}
  th {{ background:#131A24; font-weight:650; }}
  .backlink {{ display:inline-block; margin-bottom:1.6em; font-size:.92rem; }}
  @media (max-width:560px) {{ h1 {{ font-size:1.7rem; }} main {{ padding:32px 16px 60px; }}
    table {{ display:block; overflow-x:auto; }} }}
</style>
</head>
<body>
<main>
<a class="backlink" href="/blog">&#8592; All posts</a>
{body}
</main>
</body>
</html>
"""


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for art in ARTICLES:
        body = convert(art["md"].read_text(encoding="utf-8"))
        page = TEMPLATE.format(
            title=html.escape(art["title"], quote=True),
            description=html.escape(art["description"], quote=True),
            slug=art["slug"],
            body=body,
        )
        for dest in (HERE / f"{art['slug']}.html", PUBLIC / f"{art['slug']}.html"):
            dest.write_text(page, encoding="utf-8")
            print("Wrote", dest, f"({dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
