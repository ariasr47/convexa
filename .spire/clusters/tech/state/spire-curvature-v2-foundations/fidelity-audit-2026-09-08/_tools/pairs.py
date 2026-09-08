"""Side-by-side composites: app (left) | design (right), both scaled to the same width, top-aligned,
with a caption strip. Run from the repo root:  uv run --with pillow python <this file> [id-prefix]
Writes pairs/<id>.png (lossless) and pairs/<id>.jpg (q80, for a web report)."""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COL_W = 720   # each side scaled to this width
GUTTER = 24
CAP_H = 34
only = sys.argv[1] if len(sys.argv) > 1 else ''
ids = sorted(os.path.basename(p)[:-4] for p in glob.glob(f'{HERE}/app/*.png'))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
except Exception:
    font = ImageFont.load_default()
made = 0
for i in ids:
    if only and not i.startswith(only):
        continue
    a_p, d_p = f'{HERE}/app/{i}.png', f'{HERE}/design/{i}.png'
    if not os.path.exists(d_p):
        continue
    a, d = Image.open(a_p).convert('RGB'), Image.open(d_p).convert('RGB')
    def fit(im):
        s = COL_W / im.width
        return im.resize((COL_W, max(1, round(im.height * s))), Image.LANCZOS), s
    a2, sa = fit(a); d2, sd = fit(d)
    H = max(a2.height, d2.height) + CAP_H
    canvas = Image.new('RGB', (COL_W * 2 + GUTTER, H), (24, 24, 28))
    draw = ImageDraw.Draw(canvas)
    aj = json.load(open(a_p[:-4] + '.json')); dj = json.load(open(d_p[:-4] + '.json'))
    draw.text((8, 9), f"APP  {i}  page {aj['pageHeight']}px  conn={aj['probes'].get('connectionState')}", fill=(233, 228, 214), font=font)
    draw.text((COL_W + GUTTER + 8, 9), f"DESIGN  {os.path.basename(dj['url'])}  page {dj['pageHeight']}px", fill=(233, 228, 214), font=font)
    canvas.paste(a2, (0, CAP_H)); canvas.paste(d2, (COL_W + GUTTER, CAP_H))
    canvas.save(f'{HERE}/pairs/{i}.png', optimize=True)
    canvas.save(f'{HERE}/pairs/{i}.jpg', quality=80, optimize=True)
    made += 1
print(f'pairs written: {made}')
