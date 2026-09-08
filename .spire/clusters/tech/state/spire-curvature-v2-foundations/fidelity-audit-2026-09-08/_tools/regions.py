"""Region table for one capture id: the app's testid census beside the design's panel census, in
document order, so composition can be compared by y/height. Usage: python regions.py <id> [min-h]"""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
i = sys.argv[1]; minh = int(sys.argv[2]) if len(sys.argv) > 2 else 60
a = json.load(open(f'{HERE}/app/{i}.json')); d = json.load(open(f'{HERE}/design/{i}.json'))
def rows(c, keep):
    out = []
    for r in c['regions']:
        if r['h'] < minh or not keep(r['key']): continue
        out.append(r)
    return sorted(out, key=lambda r: (r['y'], -r['w']))
app_keep = lambda k: not k.startswith(('figure-', 'palette-', 'nav-', 'kbd', 'chip')) and k not in ('app-shell',)
des_keep = lambda k: k.startswith(('nav-bar', 'wrap:', 'panel:', 'block:'))
cb = lambda c: f" (content {c['contentBottom']}px)" if 'contentBottom' in c else ''
print(f"== {i}   app page {a['pageHeight']}px{cb(a)} · design page {d['pageHeight']}px{cb(d)} · app conn={a['probes'].get('connectionState')} skeletons={a['probes'].get('skeletons')}")
print(f"{'APP (data-testid)':44} {'y':>5} {'h':>5} {'w':>5} | {'DESIGN (panel/wrap)':52} {'y':>5} {'h':>5} {'w':>5}")
A, D = rows(a, app_keep), rows(d, des_keep)
for k in range(max(len(A), len(D))):
    l = f"{A[k]['key'][:44]:44} {A[k]['y']:5} {A[k]['h']:5} {A[k]['w']:5}" if k < len(A) else ' ' * 62
    r = f"{D[k]['key'][:52]:52} {D[k]['y']:5} {D[k]['h']:5} {D[k]['w']:5}" if k < len(D) else ''
    print(f"{l} | {r}")
print("\n-- app panel chrome --")
for p in a.get('panels', [])[:8]: print(f"  {p['key'][:34]:34} r={p['radius']:8} bg={p['background']:24} border={p['border'][:40]:40} shadow={p['shadow'][:30]}")
print("-- design panel chrome --")
for p in d.get('panels', [])[:8]: print(f"  {p['key'][:34]:34} r={p['radius']:8} bg={p['background']:24} border={p['border'][:40]:40} shadow={p['shadow'][:30]}")
