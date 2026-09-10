"""Rebuild the web report: JPEG the evidence set, then inline it into _artifact/template.html.
Run from the repo root:  uv run --with pillow python <this file>   → writes _artifact/index.html"""
import base64, os, re
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = f'{HERE}/_artifact'
crops = ['app-hero-real-1280-dark', 'design-hero-real-1280-dark', 'app-read-strip-real-1280-dark',
         'design-read-strip-real-1280-dark', 'app-masthead-real-1280-dark', 'design-masthead-real-1280-dark',
         'app-market-context-real-1280-dark', 'design-market-context-real-1280-dark',
         'app-term-structure-real-1280-light', 'app-ai-read-real-1280-dark', 'design-ai-read-real-1280-dark']
pairs = ['desk-real-1280-dark', 'desk-real-1280-light', 'desk-real-390-dark', 'positions-dense-1280-dark',
         'alerts-seeded-1280-dark', 'settings-signed-in-1280-dark', 'scanner-dense-1280-dark']
for c in crops:
    Image.open(f'{HERE}/crops/{c}.png').convert('RGB').save(f'{A}/{c}.jpg', quality=85, optimize=True)
for p in pairs:
    im = Image.open(f'{HERE}/pairs/{p}.png').convert('RGB')
    if im.width > 1200:
        im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    im.save(f'{A}/{p}.jpg', quality=78, optimize=True)
t = open(f'{A}/template.html', encoding='utf-8').read()
def sub(m):
    return 'data:image/jpeg;base64,' + base64.b64encode(open(f'{A}/{m.group(1)}.jpg', 'rb').read()).decode()
out = re.sub(r'\{\{img:([a-z0-9-]+)\}\}', sub, t)
open(f'{A}/index.html', 'w', encoding='utf-8').write(out)
print('index.html: %.1f MB' % (len(out.encode()) / 1024 / 1024))
