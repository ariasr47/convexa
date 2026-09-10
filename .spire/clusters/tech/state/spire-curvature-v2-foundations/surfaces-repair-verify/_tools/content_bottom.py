"""Content-bottom table for a harness output folder. The harness's raw `pageHeight` is
`document.documentElement.scrollHeight`; when `settle()` has grown the viewport to 1800 px for a page
that fitted in 900 px, the app shell fills the viewport with background and `scrollHeight` reads the
viewport, not the content. This prints both: the raw field and the real content bottom
(max region.y + region.h over the same JSON's `regions`). Usage: python content_bottom.py <folder>..."""
import glob, json, os, sys

NAMED = {
    'positions': ['positions-capital-at-risk', 'positions-net-pl', 'orders-panel', 'customization-toolbar',
                  'portfolio-panel', 'track-record', 'tr-families'],
    'alerts': ['alerts-composer', 'alerts-rules', 'alerts-events'],
    'settings': ['settings-ai-key-panel', 'cap-row', 'risk-inputs-form'],
    'scanner': ['scan-notes', 'scan-table', 'scan-toolbar', 'cell-score-bar'],
}


def bottom(c):
    return max((r['y'] + r['h'] for r in c.get('regions', [])), default=0)


for folder in sys.argv[1:]:
    print(f'\n##### {folder}')
    ids = sorted(os.path.basename(p)[:-5] for p in glob.glob(f'{folder}/app/*.json'))
    print(f"{'id':32} {'app pageH':>9} {'app bottom':>10} {'des pageH':>9} {'des bottom':>10} {'ratio':>6} {'ovX a/d':>8}  named regions (app)")
    for i in ids:
        a = json.load(open(f'{folder}/app/{i}.json'))
        dp = f'{folder}/design/{i}.json'
        d = json.load(open(dp)) if os.path.exists(dp) else None
        ab, db = bottom(a), (bottom(d) if d else 0)
        ratio = f'{ab / db:.3f}' if db else '-'
        surface = i.split('-')[0]
        named = []
        for key in NAMED.get(surface, []):
            rs = [r for r in a['regions'] if r['key'] == key]
            if rs:
                r = rs[0]
                named.append(f"{key}={r['h']}@{r['y']}(w{r['w']},x{r['x']})" + (f'x{len(rs)}' if len(rs) > 1 else ''))
        print(f"{i:32} {a['pageHeight']:9} {ab:10} {(d['pageHeight'] if d else 0):9} {db:10} {ratio:>6} {str(a['overflowX'])[0]}/{(str(d['overflowX'])[0] if d else '-'):6}  {' '.join(named)}")
