/* The atlas's renderers. content.js (above, same scope) holds what the page says; this file draws
   it, and replays the recordings embedded as JSON in #atlas-data (written by tools/atlas/run.mjs):
   files (the every-file index), startup, clicks, wire (cold visits), bundle, checks, health. A
   recording the run skipped (--offline skips every live one) is simply absent, and the page says
   so where it would have been. */
const D = JSON.parse(document.getElementById('atlas-data').textContent);
const META = D.meta;
const IDX = D.files;
const ST = D.startup;
const CK = D.clicks;
const FV = D.wire;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const fmtKb = (kb) => `${kb >= 10 ? Math.round(kb) : kb.toFixed(1)} KB`;
const range = (vals, unit) => {
  const v = vals.filter((x) => x != null);
  if (!v.length) return 'not recorded';
  const lo = Math.min(...v),
    hi = Math.max(...v);
  return lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`;
};
const SKIPPED =
  'Not recorded: this page was generated with <code>--offline</code>, which skips the live site.';

/* ---------- %placeholders%: content filled from the recordings ---------- */
const wirePages = () => WF_PAGES.map(([k]) => k).filter((k) => FV[k]);
const landingKey = () => (FV.liveLanding ? 'liveLanding' : FV.demoLanding ? 'demoLanding' : null);
const rowsOf = (key, kind) => (FV[key] ? FV[key].rows.filter((r) => r[2] === kind) : []);
const sumKb = (rows) => rows.reduce((a, r) => a + r[4], 0);
const checkLine = (c) => (c ? `${esc(c.summary)} (exit ${c.exit})` : 'not run');
const FILL = {
  doc: () => {
    const k = landingKey();
    const d = k && rowsOf(k, 'document')[0];
    return d ? fmtKb(d[4]) : 'not recorded';
  },
  ttfb: () =>
    range(
      wirePages().map((k) => FV[k].m.ttfb),
      ' ms',
    ),
  fcp: () =>
    range(
      wirePages().map((k) => FV[k].m.fcp),
      ' ms',
    ),
  fonts: () => {
    const ks = wirePages();
    if (!ks.length) return 'not recorded';
    return `${range(
      ks.map((k) => rowsOf(k, 'font').length),
      '',
    )} font files, ${range(
      ks.map((k) => Math.round(sumKb(rowsOf(k, 'font')))),
      ' KB',
    )} per page`;
  },
  api: () => {
    const a = rowsOf('liveLanding', 'api').map((r) => `<code>${esc(r[3])}</code>`);
    return FV.liveLanding ? (a.length ? a.join(' and ') : 'none') : 'not recorded (offline)';
  },
  tv: () => {
    const t = rowsOf('liveTicker', 'third')[0];
    return t ? (t[3].match(/(\d+) requests/) || [0, '?'])[1] : 'no';
  },
  costpage: () => (landingKey() === 'liveLanding' ? 'live' : 'demo'),
  cost: () => {
    const k = landingKey();
    if (!k) return 'not recorded';
    const js = rowsOf(k, 'script'),
      fonts = rowsOf(k, 'font'),
      css = rowsOf(k, 'css'),
      api = rowsOf(k, 'api');
    return `${js.length} scripts (${fmtKb(sumKb(js))}), ${fonts.length} fonts (${fmtKb(sumKb(fonts))}), ${css.length} stylesheet${css.length === 1 ? '' : 's'}, ${api.length} API call${api.length === 1 ? '' : 's'}`;
  },
  filings: () => checkLine(D.checks.filings),
  tokens: () => checkLine(D.checks.tokens),
  budgets: () => {
    const B = D.bundle;
    if (!B) return 'not run';
    const charts = B.failures.some((f) => f.budget === 'positions-no-charts')
      ? 'PositionsPage imports charts'
      : 'PositionsPage has no charts dependency';
    const over = B.failures
      .filter((f) => f.budget !== 'positions-no-charts')
      .map(
        (f) =>
          `${esc(f.file)} ${f.brotliKb} KB over its ${f.maxBrotliKb} KB ${esc(f.budget)} budget`,
      );
    return `${B.passes} brotli checks within budget across ${B.assets.length} JavaScript files${over.length ? `; over budget: ${over.join(', ')}` : ''}; ${charts} (exit ${B.exit})`;
  },
};
const expand = (s) => String(s).replace(/%([a-z]+)%/g, (m, k) => (FILL[k] ? FILL[k]() : m));

/* ---------- layers ---------- */
const LNAME = Object.fromEntries(LAYERS);
LNAME.repo = 'Repository';

/* ---------- folder tree ---------- */
const FOLDERS = {},
  PARENT = {};
(function walk(list, parent) {
  for (const f of list) {
    FOLDERS[f.p] = f;
    PARENT[f.p] = parent;
    if (f.kids) walk(f.kids, f.p);
  }
})(T, null);
const ARCH_FOLDERS = {};
for (const f of Object.values(FOLDERS)) if (f.a) (ARCH_FOLDERS[f.a] ||= []).push(f.p);
const chip = (p) =>
  FOLDERS[p]
    ? `<button class="folder-link" type="button" data-folder="${esc(p)}" data-layer="${FOLDERS[p].L}"><span class="dot"></span>${esc(FOLDERS[p].n)}</button>`
    : '';

/* ---------- legend ---------- */
let layerFilter = null;
const legend = $('#legend');
for (const [id, name] of LAYERS) {
  const b = el(
    'button',
    { class: 'lg', type: 'button', 'data-layer': id, 'aria-pressed': 'false' },
    `<span class="dot"></span>${esc(name)}`,
  );
  b.addEventListener('click', () => {
    layerFilter = layerFilter === id ? null : id;
    paint();
  });
  legend.append(b);
}

/* ---------- tree ---------- */
const tree = $('#tree');
const open = new Set(['apps', 'apps/api', 'apps/dashboard', 'libs']);
let selected = 'apps/api',
  selArch = 'apirust';
function renderTree() {
  tree.innerHTML = '';
  const build = (list, ul) => {
    for (const f of list) {
      const li = el('li', {
        role: 'treeitem',
        'aria-expanded': f.kids ? String(open.has(f.p)) : null,
        'aria-selected': String(f.p === selected),
      });
      const btn = el(
        'button',
        { class: 'row', type: 'button', 'data-p': f.p, 'data-layer': f.L },
        `<span class="caret" aria-hidden="true">${f.kids ? (open.has(f.p) ? '▾' : '▸') : ''}</span><span class="dot"></span><span class="nm">${esc(f.n)}</span><span class="ct">${f.c != null ? esc(f.c) : ''}</span><span class="hint">${esc(f.d)}</span>`,
      );
      btn.addEventListener('click', (e) => {
        if (f.kids && (e.target.classList.contains('caret') || selected === f.p)) {
          if (open.has(f.p)) open.delete(f.p);
          else open.add(f.p);
        }
        select(f.p);
      });
      li.append(btn);
      if (f.kids) {
        const sub = el('ul', { role: 'group' });
        if (!open.has(f.p)) sub.hidden = true;
        build(f.kids, sub);
        li.append(sub);
      }
      ul.append(li);
    }
  };
  build(T, tree);
  paint();
}
$('#collapse').addEventListener('click', () => {
  open.clear();
  renderTree();
});

/* ---------- diagram ---------- */
const svg = $('#arch');
for (const z of ZONES) {
  const g = sv('g', { class: 'zone' });
  g.append(
    sv('rect', { x: z.x, y: z.y, width: z.w, height: z.h, rx: 12 }),
    sv('text', { x: z.x + 12, y: z.bottom ? z.y + z.h - 6 : z.y + 18 }, z.t),
  );
  svg.append(g);
}
for (const w of WIRES) {
  svg.append(
    sv('path', { d: w.d, class: 'wire' + (w.paused ? ' paused' : ''), 'marker-end': 'url(#ah)' }),
  );
  (w.l || []).forEach((t, i) =>
    svg.append(sv('text', { x: w.lx, y: w.ly + i * 12, class: 'wl' }, t)),
  );
}
for (const [id, n] of Object.entries(ARCH)) {
  const g = sv('g', {
    class: 'node',
    'data-arch': id,
    'data-layer': n.L,
    tabindex: '0',
    role: 'button',
    'aria-pressed': 'false',
    'aria-label': `${n.t}: ${n.s.join(', ')}`,
  });
  g.append(
    sv('rect', {
      class: 'b' + (n.style ? ' ' + n.style : ''),
      x: n.x,
      y: n.y,
      width: n.w,
      height: n.h,
      rx: 8,
    }),
  );
  g.append(sv('text', { class: 'k', x: n.x + 10, y: n.y + 16 }, n.k));
  g.append(sv('text', { class: 't', x: n.x + 10, y: n.y + 34 }, n.t));
  n.s.forEach((s, i) => g.append(sv('text', { class: 's', x: n.x + 10, y: n.y + 52 + i * 15 }, s)));
  const act = (e) => {
    e.stopPropagation();
    selectArch(id);
  };
  g.addEventListener('click', act);
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act(e);
    }
  });
  svg.append(g);
}

/* ---------- selection, both directions ---------- */
function openAncestors(p) {
  let q = PARENT[p];
  while (q) {
    open.add(q);
    q = PARENT[q];
  }
}
function revealRow(p) {
  const row = tree.querySelector(`[data-p="${CSS.escape(p)}"]`);
  if (row) row.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}
function select(p, fromOutside) {
  selected = p;
  selArch = FOLDERS[p].a || null;
  openAncestors(p);
  renderTree();
  renderDetail();
  revealRow(p);
  if (fromOutside)
    document.getElementById('map').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
  try {
    localStorage.setItem('atlas.sel', p);
  } catch (e) {
    /* storage unavailable */
  }
}
function selectArch(id) {
  const n = ARCH[id];
  selected = n.folder;
  selArch = id;
  openAncestors(n.folder);
  renderTree();
  renderDetail();
  revealRow(n.folder);
}
function paint() {
  for (const b of legend.querySelectorAll('.lg'))
    b.setAttribute('aria-pressed', String(b.dataset.layer === layerFilter));
  const lit = new Set(selArch ? ARCH_FOLDERS[selArch] || [] : []);
  for (const r of tree.querySelectorAll('.row')) {
    const f = FOLDERS[r.dataset.p];
    r.classList.toggle('sel', r.dataset.p === selected);
    r.classList.toggle('lit', lit.has(r.dataset.p));
    r.classList.toggle('dim', !!layerFilter && f.L !== layerFilter);
  }
  for (const g of svg.querySelectorAll('.node')) {
    const id = g.dataset.arch;
    g.classList.toggle('on', id === selArch);
    g.classList.toggle('off', !!layerFilter && ARCH[id].L !== layerFilter);
    g.setAttribute('aria-pressed', String(id === selArch));
  }
}
function renderDetail() {
  const f = FOLDERS[selected];
  const d = $('#detail');
  d.setAttribute('data-layer', f.L);
  const arch = f.a ? ARCH[f.a] : null;
  const crumbs = [];
  let q = f.p;
  while (q) {
    crumbs.unshift(FOLDERS[q].n);
    q = PARENT[q];
  }
  const siblings = f.a ? (ARCH_FOLDERS[f.a] || []).filter((p) => p !== f.p) : [];
  const strip = RUNSTRIP.map(
    ([L, name], i) =>
      `${i ? '<i>›</i>' : ''}<span data-layer="${L}" class="${L === f.L ? 'on' : ''}">${name}</span>`,
  ).join('');
  const goTitle = f.go ? (document.querySelector(f.go + ' h2')?.textContent || '').trim() : '';
  d.innerHTML = `
    <div class="path">${esc(crumbs.join(' '))}</div>
    <h3>${esc(f.d)}</h3>
    <div class="badges">
      <span class="badge" data-layer="${f.L}"><span class="dot"></span>${esc(LNAME[f.L])}</span>
      ${arch ? `<span class="badge plain">in the diagram · ${esc(arch.t)}</span>` : '<span class="badge plain">not part of the running system</span>'}
      ${f.c != null ? `<span class="badge plain">${esc(f.c)} files</span>` : ''}
    </div>
    <div class="runstrip" aria-label="Layer">${strip}</div>
    ${f.more ? `<p>${expand(f.more)}</p>` : ''}
    <div class="dgrid">
      ${f.runs ? `<div><h4>Where it runs</h4><p style="font-size:13.5px">${f.runs}</p></div>` : ''}
      ${f.libs ? `<div><h4>Libraries</h4><div>${f.libs.map((l) => `<span class="libchip">${esc(l)}</span>`).join('')}</div></div>` : ''}
      ${f.talks ? `<div><h4>Talks to</h4><ul>${f.talks.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
      ${f.files ? `<div><h4>Key files</h4><ul class="files">${f.files.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${f.kids ? `<div><h4>Inside</h4><div>${f.kids.map((k) => chip(k.p)).join('')}</div></div>` : ''}
      ${siblings.length ? `<div><h4>Same box in the diagram</h4><div>${siblings.map(chip).join('')}</div></div>` : ''}
    </div>
    ${f.go ? `<a class="go" href="${f.go}">Go deeper: ${esc(goTitle)} →</a>` : ''}`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-folder]');
  if (!b) return;
  e.preventDefault();
  select(b.dataset.folder, !b.closest('#map'));
});

/* ---------- stack ---------- */
const stb = $('#stackTable tbody');
let lastL = null;
for (const [L, name, ver, use, where] of STACK) {
  if (L !== lastL) {
    stb.append(
      el(
        'tr',
        { class: 'grp', 'data-layer': L },
        `<td colspan="4"><span class="dot"></span> ${esc(LNAME[L])}</td>`,
      ),
    );
    lastL = L;
  }
  stb.append(
    el(
      'tr',
      {},
      `<td><b>${esc(name)}</b></td><td class="n">${esc(ver)}</td><td>${use}</td><td>${where.map(chip).join('')}</td>`,
    ),
  );
}

/* ---------- hero numbers and the offline notice ---------- */
$('#statTests').textContent = TESTS.filter((t) => t[5])
  .reduce((a, t) => a + t[1], 0)
  .toLocaleString('en-US');
if (D.bundle) {
  const kb = D.bundle.assets.reduce((a, x) => a + x.brotliKb, 0);
  $('#statBundle').textContent = `${Math.round(kb).toLocaleString('en-US')} KB`;
  $('#statBundleSub').textContent = `all JS, brotli · ${D.bundle.assets.length} chunks`;
}
if (META.offline) {
  $('#offlineNote').hidden = false;
  for (const id of ['#stTabs', '#ckTabs', '#wfTabs'])
    $(id).after(
      el(
        'p',
        { class: 'note' },
        'The live runs are missing from this copy: it was generated with <code>--offline</code>.',
      ),
    );
}

/* ---------- on the wire ---------- */
const vs = $('#visitSteps');
for (const [t, d, m] of VISIT)
  vs.append(
    el(
      'li',
      {},
      `<div><div class="t">${t}</div><div class="d">${expand(d)}</div><div class="ms">${expand(m)}</div></div>`,
    ),
  );
const WFC = {
  document: 'var(--fg)',
  script: 'var(--l-client)',
  css: 'var(--l-shared)',
  font: 'var(--l-process)',
  api: 'var(--l-api)',
  data: 'var(--l-tool)',
  third: 'var(--l-source)',
  image: 'var(--l-data)',
  other: 'var(--dim)',
};
const WFN = {
  document: 'document',
  script: 'JavaScript',
  css: 'CSS',
  font: 'fonts',
  api: '/api calls',
  data: 'static data',
  third: 'TradingView',
  image: 'image',
  other: 'other',
};
const tabs = $('#wfTabs');
let wfSel = wirePages()[0] || null;
for (const [k, name] of WF_PAGES) {
  if (!FV[k]) continue;
  const b = el(
    'button',
    {
      class: 'tab',
      role: 'tab',
      type: 'button',
      'aria-selected': String(k === wfSel),
      'data-k': k,
    },
    esc(name),
  );
  b.addEventListener('click', () => {
    wfSel = k;
    for (const x of tabs.children) x.setAttribute('aria-selected', String(x.dataset.k === k));
    drawWF();
  });
  tabs.append(b);
}
function groupRows(rows) {
  const out = [];
  for (const r of [...rows].sort((a, b) => a[0] - b[0])) {
    const [t, e, kind, name, kb] = r;
    const g = out[out.length - 1];
    const small = (kind === 'script' && kb < 4) || kind === 'font' || kind === 'data';
    if (small && g && g.kind === kind && g.small && Math.abs(t - g.t) <= 8) {
      g.n++;
      g.e = Math.max(g.e, e);
      g.kb += kb;
      g.names.push(name);
      continue;
    }
    out.push({ t, e, kind, name, kb, n: 1, small, names: [name] });
  }
  return out;
}
function drawWF() {
  const P = wfSel && FV[wfSel];
  const s = $('#wf');
  s.innerHTML = '';
  if (!P) {
    $('#wfSum').textContent = 'No visit was recorded for this copy of the page.';
    return;
  }
  const rows = groupRows(P.rows);
  const maxE = Math.max(...P.rows.map((r) => r[1]), P.m.lcp || 0);
  const tick = maxE > 1600 ? 200 : maxE > 800 ? 100 : 50;
  const span = Math.max(tick, Math.ceil(maxE / tick) * tick);
  const W = 760,
    L = 230,
    R = 52,
    top = 34,
    rh = 19;
  const H = top + rows.length * rh + 22;
  s.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const x = (ms) => L + (ms / span) * (W - L - R);
  for (let ms = 0; ms <= span; ms += tick) {
    s.append(sv('line', { x1: x(ms), x2: x(ms), y1: top - 4, y2: H - 18, class: 'grid' }));
    s.append(
      sv(
        'text',
        { x: x(ms), y: H - 4, class: 'ax', 'text-anchor': 'middle' },
        ms ? `${ms} ms` : '0',
      ),
    );
  }
  [
    ['first paint', P.m.fcp, 'var(--amber)', 12],
    ['largest paint', P.m.lcp, 'var(--up)', 25],
  ].forEach(([n, ms, c, ly]) => {
    if (ms == null) return;
    s.append(sv('line', { x1: x(ms), x2: x(ms), y1: ly + 3, y2: H - 18, class: 'mk', stroke: c }));
    const right = x(ms) + 150 > W;
    s.append(
      sv(
        'text',
        {
          x: right ? x(ms) - 4 : x(ms) + 4,
          y: ly,
          class: 'mkl',
          fill: c,
          'text-anchor': right ? 'end' : 'start',
        },
        `${n} ${ms} ms`,
      ),
    );
  });
  rows.forEach((r, i) => {
    const y = top + i * rh;
    const noun = { script: 'JavaScript', font: 'font', data: 'data' }[r.kind] || WFN[r.kind];
    let label =
      r.n > 1
        ? `${r.n} ${noun} files`
        : r.kind === 'document'
          ? `document ${r.name}`
          : r.kind === 'api' || r.kind === 'third'
            ? r.name
            : r.name.replace(/-[A-Za-z0-9_-]{8}\.(js|css|json)$/, '.$1').replace(/^.*\//, '');
    if (label.length > 32) label = label.slice(0, 31) + '…';
    s.append(sv('text', { x: L - 8, y: y + 12, class: 'lab', 'text-anchor': 'end' }, label));
    const x0 = x(r.t),
      bw = Math.max(2, x(r.e) - x0);
    const rect = sv('rect', {
      x: x0,
      y: y + 3,
      width: bw,
      height: 12,
      rx: 2,
      fill: WFC[r.kind] || 'var(--dim)',
    });
    rect.append(
      sv(
        'title',
        {},
        `${r.names.slice(0, 12).join(', ')}${r.names.length > 12 ? '…' : ''}\n${r.t}–${r.e} ms · ${r.kb.toFixed(1)} KB`,
      ),
    );
    s.append(rect);
    if (r.kb >= 1)
      s.append(sv('text', { x: x0 + bw + 5, y: y + 12, class: 'ax' }, `${Math.round(r.kb)} KB`));
  });
  const by = {};
  for (const r of P.rows) {
    by[r[2]] ||= { n: 0, kb: 0 };
    by[r[2]].n += r[2] === 'third' ? Number((r[3].match(/(\d+) requests/) || [0, 1])[1]) : 1;
    by[r[2]].kb += r[4];
  }
  const total = Object.values(by).reduce((a, b) => a + b.n, 0);
  $('#wfSum').innerHTML =
    `<span><b>${total}</b> requests</span>` +
    Object.entries(by)
      .map(([k, v]) => `<span>${WFN[k]} <b>${v.n}</b> · ${Math.round(v.kb)} KB</span>`)
      .join('') +
    `<span>first byte <b>${P.m.ttfb} ms</b></span>`;
  $('#wfKey').innerHTML =
    Object.keys(by)
      .map((k) => `<span><i style="background:${WFC[k]}"></i>${WFN[k]}</span>`)
      .join('') +
    '<span>small files that start together share a row · sizes are bytes on the wire · hover a bar for its files</span>';
  $('#wfNote').innerHTML = expand(WF_NOTES[wfSel] || '');
}

/* ---------- who owns what ---------- */
function rnode(n) {
  const card = `<div class="rnode"><div class="h"><span class="nm">${esc(n.n)}</span><span class="kind ${n.k}">${n.k}</span></div><div class="f">${esc(n.f)}</div><div class="o">${n.o}</div></div>`;
  const li = el('li');
  if (n.kids) {
    const d = el('details', { class: 'rd' });
    d.open = true;
    d.innerHTML = `<summary>${card}</summary>`;
    const ul = el('ul');
    for (const k of n.kids) ul.append(rnode(k));
    d.append(ul);
    li.append(d);
  } else li.innerHTML = card;
  return li;
}
$('#rtree').append(rnode(R));

/* ---------- data flows ---------- */
const flows = $('#flows');
for (const f of FLOWS) {
  const wrap = el('div', { style: 'display:grid;gap:10px' });
  wrap.append(
    el(
      'div',
      { class: 'flowcap' },
      `<h3>${esc(f.h)}</h3><span class="muted" style="font-size:13px">${esc(f.sub)}</span>`,
    ),
  );
  const row = el('div', { class: 'flow' });
  for (const [L, t, d, file] of f.st)
    row.append(
      el(
        'div',
        { class: 'stage', 'data-layer': L, title: LNAME[L] },
        `<div class="st">${t}</div><div class="sd">${d}</div><div class="sf">${esc(file)}</div>`,
      ),
    );
  wrap.append(row);
  flows.append(wrap);
}

/* ---------- API ---------- */
const aps = $('#apiSteps');
for (const [t, d, m] of API_STEPS)
  aps.append(
    el(
      'li',
      {},
      `<div><div class="t">${t}</div><div class="d">${d}</div><div class="ms">${m}</div></div>`,
    ),
  );
const rtb = $('#routeTable tbody');
for (const [a, r, f] of ROUTES)
  rtb.append(
    el(
      'tr',
      {},
      `<td><b>${a}</b></td><td>${r}</td><td class="mono" style="font-size:12px">${esc(f)}</td>`,
    ),
  );
const H = D.health;
$('#healthBody').innerHTML = H
  ? `<code>/api/health</code> on ${esc(META.liveApi.replace(/^https?:\/\//, ''))}: status <b>${esc(H.status)}</b>, market_data <b>${esc(H.market_data)}</b>${H.market_data === 'not_live' ? ' (no options feed on this site: the API holds no vendor key)' : ''}, durable_store <b>${esc(H.durable_store)}</b>. Production runs its own deploy, which may be older or newer than this commit. In this commit the price cache, the GEX kernel and the rate limits are on the token-gated <code>/api/_metrics</code>, which the Pages edge does not serve, so this page states them from the code.`
  : SKIPPED;

/* ---------- Nx ---------- */
const nxc = $('#nxCards');
for (const [name, path, L, tags, targets] of NX)
  nxc.append(
    el(
      'div',
      { class: 'card', 'data-layer': L },
      `<h3><span class="dot"></span><span class="mono" style="font-size:14px">${esc(name)}</span></h3><div>${chip(path)}</div><p class="mono" style="font-size:11.5px">${esc(tags)}</p><ul style="margin:0;padding-left:18px;font-size:13px;display:grid;gap:3px">${targets.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`,
    ),
  );
const vfs = $('#verifySteps');
for (const [t, d, m] of VERIFY)
  vfs.append(
    el(
      'li',
      {},
      `<div><div class="t">${t}</div><div class="d">${d}</div><div class="ms">${m}</div></div>`,
    ),
  );

/* ---------- environments ---------- */
const etb = $('#envTable tbody');
for (const r of ENV)
  etb.append(
    el('tr', {}, r.map((c, i) => (i === 0 ? `<td><b>${c}</b></td>` : `<td>${c}</td>`)).join('')),
  );
const df = $('#deployFlow');
for (const [L, t, d, f] of DEPLOY)
  df.append(
    el(
      'div',
      { class: 'stage', 'data-layer': L },
      `<div class="st">${t}</div><div class="sd">${d}</div><div class="sf">${esc(f)}</div>`,
    ),
  );

/* ---------- tests ---------- */
const tmax = Math.max(...TESTS.map((t) => t[1]));
const tb = $('#testBars');
for (const [n, v, L, sub, p] of TESTS)
  tb.append(
    el(
      'div',
      { class: 'bar', 'data-layer': L },
      `<span class="bn" title="${esc(sub)}"><button class="folder-link" type="button" data-folder="${esc(p)}" data-layer="${L}" style="margin:0"><span class="dot"></span>${esc(n)}</button></span><span class="bt"><span class="bf" style="width:${(v / tmax) * 100}%"></span></span><span class="bv">${v.toLocaleString('en-US')} cases</span>`,
    ),
  );
$('#testKey').innerHTML =
  `<span>${esc(TESTS_NOTE)}</span><span>${esc(TESTS_CHECKED)}</span><span>${TESTS.map(([n, , , sub]) => `${esc(n)}: ${esc(sub)}`).join(' · ')}</span>`;
const gc = $('#gateCards');
for (const [L, t, d] of GATES)
  gc.append(
    el(
      'div',
      { class: 'card', 'data-layer': L },
      `<h3><span class="dot"></span>${esc(t)}</h3><p>${expand(d)}</p>`,
    ),
  );

/* ---------- bundle ---------- */
if (D.bundle) {
  const B = D.bundle;
  const sum = (k) => Math.round(B.assets.reduce((a, x) => a + x[k], 0)).toLocaleString('en-US');
  $('#bundleLede').innerHTML =
    `Measured on the production ${esc(B.mode)} build of this commit: ${B.assets.length} JavaScript chunks, ${sum('rawKb')} KB raw, ${sum('gzipKb')} KB gzip, ${sum('brotliKb')} KB brotli. The project's own <code>tools/check-dashboard-bundle.mjs</code> on the same build: ${expand('%budgets%')}.`;
  const cap = Object.fromEntries(B.budgets.map((b) => [b.name, b.maxBrotliKb]));
  const bars = BUNDLE.map(([name, re, budget, note]) => {
    const a = B.assets.find((x) => new RegExp(re).test(x.file));
    return { name, v: a ? a.brotliKb : null, cap: cap[budget], note };
  });
  const scale = Math.ceil(Math.max(...bars.map((b) => Math.max(b.v || 0, b.cap || 0))) / 25) * 25;
  const bb = $('#bundleBars');
  for (const { name, v, cap: c, note } of bars)
    bb.append(
      el(
        'div',
        { class: 'bar', 'data-layer': 'client' },
        `<span class="bn" title="${esc(note)}">${esc(name)}</span><span class="bt">${v != null ? `<span class="bf" style="width:${(v / scale) * 100}%"></span>` : ''}${c != null ? `<span class="bb" style="left:${(c / scale) * 100}%" title="budget ${c} KB"></span>` : ''}</span><span class="bv">${v != null ? v.toFixed(1) : '—'} / ${c ?? '—'} KB</span>`,
      ),
    );
  $('#bundleKey').innerHTML =
    `<span data-layer="client"><i></i>brotli size</span><span><i class="tick"></i>its budget</span><span>one scale, 0–${scale} KB</span>`;
} else $('#bundleLede').innerHTML = 'The bundle was not measured for this copy of the page.';
const bcc = $('#bundleCards');
for (const [L, t, d] of BC)
  bcc.append(
    el(
      'div',
      { class: 'card', 'data-layer': L },
      `<h3><span class="dot"></span>${esc(t)}</h3><p>${expand(d)}</p>`,
    ),
  );

/* ---------- security ---------- */
const scc = $('#secCards');
for (const [L, t, d] of SEC)
  scc.append(
    el(
      'div',
      { class: 'card', 'data-layer': L },
      `<h3><span class="dot"></span>${esc(t)}</h3><p>${d}</p>`,
    ),
  );

/* ---------- docs vs code ---------- */
const dtb = $('#driftTable tbody');
for (const [a, b, c] of DRIFT)
  dtb.append(
    el(
      'tr',
      {},
      `<td>${a}</td><td>${b}</td><td class="mono" style="font-size:12px;overflow-wrap:anywhere">${c}</td>`,
    ),
  );

/* ---------- reading order & glossary ---------- */
const rs = $('#readSteps');
for (const [t, d] of READ)
  rs.append(
    el(
      'li',
      {},
      `<div><div class="t mono" style="font-size:13px;overflow-wrap:anywhere">${esc(t)}</div><div class="d">${esc(d)}</div></div>`,
    ),
  );
const gl = $('#gloss');
for (const [t, d] of GLOSS) {
  gl.append(el('dt', {}, esc(t)));
  gl.append(el('dd', {}, esc(d)));
}

/* ================= Part I · every file ================= */
const ROWS = IDX.rows;
const BYP = Object.fromEntries(ROWS.map((r) => [r.p, r]));
const IMPBY = {};
for (const r of ROWS) for (const t of r.im) (IMPBY[t] ||= []).push(r.p);
const FILECOMPS = {};
const SHADOWED = new Set(IDX.shadowed); // names the recorders could not tell from a library's
for (const [name, fs] of Object.entries(IDX.comp))
  if (!SHADOWED.has(name)) for (const f of fs) (FILECOMPS[f] ||= []).push(name);
const layerOf = (p) => {
  if (/^apps\/api\/src\/db\//.test(p)) return 'data';
  if (/^apps\/api\/src\/infrastructure\//.test(p)) return 'source';
  if (/^apps\/api\/(tests|scripts)\//.test(p)) return 'tool';
  if (/^apps\/api\/(openapi\/|src\/capacity\/)/.test(p) || /^libs\/api\/src\/generated\//.test(p))
    return 'shared';
  if (/^apps\/api\//.test(p) || /^libs\/quant-engine\//.test(p)) return 'api';
  if (/^apps\/dashboard\/public\//.test(p) || /^functions\//.test(p)) return 'edge';
  if (/^apps\/dashboard-e2e\//.test(p)) return 'tool';
  if (/^apps\/dashboard\//.test(p)) return 'client';
  if (/^libs\/api\//.test(p)) return 'shared';
  if (/^(research|design|docs|\.spire|\.claude|\.codex|\.grok)\b/.test(p)) return 'process';
  return 'tool';
};
const KL = {
  component: 'component',
  page: 'page',
  hook: 'hook',
  store: 'store',
  context: 'context',
  module: 'module',
  types: 'types',
  test: 'test',
  script: 'script',
  config: 'config',
  route: 'route handler',
  service: 'service',
  entry: 'entry point',
  binary: 'binary',
  doc: 'doc',
  style: 'style',
  'page-html': 'html',
  asset: 'asset',
  file: 'file',
};
const HOW = {
  header: "Quoted from the file's own header comment",
  heading: "Quoted from the file's first heading",
  known: 'File type',
  none: 'This file has no header comment',
};
const flink = (p, label) =>
  `<button class="flink" type="button" data-fp="${esc(p)}">${esc(label || p)}</button>`;

// folder tree
const FT = { name: '', path: '', dirs: new Map(), files: [], n: 0 };
function ensureDir(path) {
  let node = FT,
    acc = '';
  for (const part of path.split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${part}` : part;
    if (!node.dirs.has(part))
      node.dirs.set(part, { name: part, path: acc, dirs: new Map(), files: [], n: 0 });
    node = node.dirs.get(part);
  }
  return node;
}
for (const r of ROWS) {
  const i = r.p.lastIndexOf('/');
  (i < 0 ? FT : ensureDir(r.p.slice(0, i))).files.push(r);
}
for (const b of IDX.bulk) ensureDir(b.p.replace(/\/$/, '')).bulk = b;
const DIRS = {};
(function count(d) {
  let n = d.files.length + (d.bulk ? d.bulk.n : 0);
  for (const c of d.dirs.values()) n += count(c);
  d.n = n;
  DIRS[d.path] = d;
  return n;
})(FT);
const ROOT_ORDER = [
  'apps',
  'libs',
  'functions',
  'tools',
  'research',
  'design',
  'docs',
  '.spire',
  '.claude',
  '.codex',
  '.grok',
  '.github',
  '.supply-chain',
  '.vscode',
];
const sortDirs = (d) =>
  [...d.dirs.values()].sort((a, b) => {
    if (d === FT) {
      const ia = ROOT_ORDER.indexOf(a.name),
        ib = ROOT_ORDER.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
const sortFiles = (d) =>
  [...d.files].sort((a, b) => (a.k === 'test') - (b.k === 'test') || a.p.localeCompare(b.p));

const fxOpen = new Set(['apps', 'apps/dashboard', 'apps/dashboard/src']);
let fxSel = { t: 'file', p: 'apps/dashboard/src/main.tsx' };
let fxKind = null,
  fxTag = null,
  fxQ = '';
const KINDS = [
  'component',
  'page',
  'hook',
  'store',
  'context',
  'module',
  'route',
  'service',
  'entry',
  'test',
  'script',
  'config',
  'doc',
];
const TAGS = [
  'state',
  'routing',
  'data',
  'streaming',
  'auth',
  'theme',
  'demo',
  'charts',
  'a11y',
  'errors',
  'cache',
  'db',
  'contract',
  'money',
];
const fxKinds = $('#fxKinds'),
  fxTags = $('#fxTags'),
  ftree = $('#ftree');
for (const k of KINDS)
  fxKinds.append(
    el(
      'button',
      { class: 'fchip', type: 'button', 'data-kind': k, 'aria-pressed': 'false' },
      esc(KL[k]),
    ),
  );
for (const t of TAGS)
  fxTags.append(
    el(
      'button',
      { class: 'fchip', type: 'button', 'data-tag': t, 'aria-pressed': 'false' },
      '#' + esc(t),
    ),
  );
fxKinds.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  fxKind = fxKind === b.dataset.kind ? null : b.dataset.kind;
  renderFx();
});
fxTags.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tag]');
  if (!b) return;
  fxTag = fxTag === b.dataset.tag ? null : b.dataset.tag;
  renderFx();
});
$('#fxq').addEventListener('input', (e) => {
  fxQ = e.target.value.trim().toLowerCase();
  renderFx();
});

const fileRow = (r, showDir) => {
  const name = showDir ? r.p : r.p.split('/').pop();
  const sel = fxSel.t === 'file' && fxSel.p === r.p ? ' sel' : '';
  const d = r.d || (r.ex.length ? `exports ${r.ex.slice(0, 4).join(', ')}` : '');
  return `<li role="treeitem" aria-selected="${!!sel}"><button class="frow${sel}${r.d ? '' : ' nohead'}" type="button" data-fp="${esc(r.p)}" data-layer="${layerOf(r.p)}"><span></span><span class="dot"></span><span class="nm">${esc(name)}</span><span class="ct">${esc(KL[r.k] || r.k)}</span><span class="fd">${esc(d)}</span></button></li>`;
};
function dirHtml(d) {
  let h = '';
  for (const c of sortDirs(d)) {
    const isOpen = fxOpen.has(c.path);
    const sel = fxSel.t === 'dir' && fxSel.p === c.path ? ' sel' : '';
    const desc = FOLDERS[c.path] ? FOLDERS[c.path].d : c.bulk ? c.bulk.d : '';
    h += `<li role="treeitem" aria-expanded="${isOpen}"><button class="frow dir${sel}" type="button" data-fd="${esc(c.path)}" data-layer="${layerOf(c.path + '/')}"><span class="caret" aria-hidden="true">${c.bulk && !c.dirs.size && !c.files.length ? '·' : isOpen ? '▾' : '▸'}</span><span class="dot"></span><span class="nm">${esc(c.name)}/</span><span class="ct">${c.n.toLocaleString('en-US')}</span>${desc ? `<span class="fd">${esc(desc)}</span>` : ''}</button>`;
    if (isOpen) h += `<ul role="group">${dirHtml(c)}</ul>`;
    h += '</li>';
  }
  for (const r of sortFiles(d)) h += fileRow(r, false);
  return h;
}
function renderFx() {
  for (const b of fxKinds.children)
    b.setAttribute('aria-pressed', String(b.dataset.kind === fxKind));
  for (const b of fxTags.children) b.setAttribute('aria-pressed', String(b.dataset.tag === fxTag));
  const st = ftree.scrollTop;
  if (fxQ || fxKind || fxTag) {
    const hits = ROWS.filter(
      (r) =>
        (!fxKind || r.k === fxKind) &&
        (!fxTag || r.t.includes(fxTag)) &&
        (!fxQ || (r.p + ' ' + r.d + ' ' + r.ex.join(' ')).toLowerCase().includes(fxQ)),
    );
    $('#fxMeta').textContent =
      `${hits.length.toLocaleString('en-US')} files match${hits.length > 400 ? ' · showing the first 400' : ''}`;
    ftree.innerHTML =
      hits
        .slice(0, 400)
        .map((r) => fileRow(r, true))
        .join('') || '<li class="muted" style="padding:8px">Nothing matches.</li>';
  } else {
    $('#fxMeta').textContent =
      `${ROWS.length.toLocaleString('en-US')} files listed one by one · ${IDX.bulk.reduce((a, b) => a + b.n, 0).toLocaleString('en-US')} more in summarised folders`;
    ftree.innerHTML = dirHtml(FT);
    ftree.scrollTop = st;
  }
  renderFxDetail();
}
function openTo(p) {
  const parts = p.split('/');
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    fxOpen.add(acc);
  }
}
function selectFile(p, scroll) {
  if (!BYP[p]) return;
  fxSel = { t: 'file', p };
  openTo(p);
  if (fxQ || fxKind || fxTag) {
    fxQ = '';
    fxKind = null;
    fxTag = null;
    $('#fxq').value = '';
  }
  renderFx();
  const row = ftree.querySelector(`[data-fp="${CSS.escape(p)}"]`);
  if (row) {
    const top = row.offsetTop - ftree.offsetTop;
    if (top < ftree.scrollTop || top > ftree.scrollTop + ftree.clientHeight - 40)
      ftree.scrollTop = top - 120;
  }
  if (scroll)
    document.getElementById('files').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
}
ftree.addEventListener('click', (e) => {
  const d = e.target.closest('[data-fd]');
  if (d) {
    const p = d.dataset.fd;
    if ((fxSel.t === 'dir' && fxSel.p === p) || e.target.classList.contains('caret')) {
      fxOpen.has(p) ? fxOpen.delete(p) : fxOpen.add(p);
    } else fxOpen.add(p);
    fxSel = { t: 'dir', p };
    renderFx();
    return;
  }
  const f = e.target.closest('[data-fp]');
  if (f) {
    e.stopPropagation();
    fxSel = { t: 'file', p: f.dataset.fp };
    renderFx();
  }
});
const FIRST = {};
for (const [k, run] of Object.entries(ST)) {
  FIRST[k] = {};
  for (const c of run.rec.commits)
    for (const m of c.m || []) if (FIRST[k][m[0]] == null) FIRST[k][m[0]] = c.t;
}
function renderFxDetail() {
  const box = $('#fdetail');
  if (fxSel.t === 'dir') {
    const d = DIRS[fxSel.p];
    if (!d) return;
    const L = layerOf(d.path + '/');
    box.setAttribute('data-layer', L);
    const kinds = {};
    (function walk(x) {
      for (const r of x.files) kinds[r.k] = (kinds[r.k] || 0) + 1;
      for (const c of x.dirs.values()) walk(c);
    })(d);
    const all = [];
    (function walk(x) {
      all.push(...x.files);
      for (const c of x.dirs.values()) walk(c);
    })(d);
    const top = all
      .filter((r) => IMPBY[r.p])
      .sort((a, b) => IMPBY[b.p].length - IMPBY[a.p].length)
      .slice(0, 8);
    const F = FOLDERS[d.path];
    box.innerHTML = `<div class="path">${esc(d.path)}/</div><h3>${esc(F ? F.d : d.bulk ? d.bulk.d : d.name + '/')}</h3>
      <div class="badges"><span class="badge" data-layer="${L}"><span class="dot"></span>${esc(LNAME[L])}</span><span class="badge plain">${d.n.toLocaleString('en-US')} files</span>${F ? chip(F.p) : ''}</div>
      ${F && F.more ? `<p>${expand(F.more)}</p>` : ''}
      ${d.bulk ? `<p class="muted">Summarised, not listed file by file: ${d.bulk.n.toLocaleString('en-US')} files. For example: ${d.bulk.ex.map(esc).join(', ')}.</p>` : ''}
      <div class="dgrid">
        ${
          Object.keys(kinds).length
            ? `<div><h4>What's inside</h4><div>${Object.entries(kinds)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `<span class="libchip">${n} ${esc(KL[k] || k)}</span>`)
                .join('')}</div></div>`
            : ''
        }
        ${top.length ? `<div><h4>Most imported inside</h4><div class="flist">${top.map((r) => `${flink(r.p, r.p.slice(d.path.length + 1))}<span class="src">imported by ${IMPBY[r.p].length}</span>`).join('')}</div></div>` : ''}
      </div>`;
    return;
  }
  const r = BYP[fxSel.p];
  if (!r) return;
  const L = layerOf(r.p);
  box.setAttribute('data-layer', L);
  const by = (IMPBY[r.p] || []).slice().sort();
  const comps = FILECOMPS[r.p] || [];
  const mounts = [];
  for (const [k, label] of RUNS_ST)
    for (const c of comps)
      if (FIRST[k] && FIRST[k][c] != null) mounts.push([k, label, c, FIRST[k][c]]);
  const strip = RUNSTRIP.map(
    ([Lx, name], i) =>
      `${i ? '<i>›</i>' : ''}<span data-layer="${Lx}" class="${Lx === L ? 'on' : ''}">${name}</span>`,
  ).join('');
  box.innerHTML = `
    <div class="path">${esc(r.p.split('/').slice(0, -1).join(' / '))}</div>
    <h3 class="mono" style="font-size:1.2rem;font-family:var(--f-mono)">${esc(r.p.split('/').pop())}</h3>
    <div class="badges"><span class="badge" data-layer="${L}"><span class="dot"></span>${esc(LNAME[L])}</span><span class="badge plain">${esc(KL[r.k] || r.k)}</span>${r.l ? `<span class="badge plain">${r.l.toLocaleString('en-US')} lines</span>` : ''}<span class="badge plain">imported by ${by.length}</span></div>
    <div class="runstrip" aria-label="Layer">${strip}</div>
    <div class="quote" data-layer="${L}">${r.d ? esc(r.d) : '<span class="muted">No header comment in this file.</span>'}</div>
    <div class="src">${HOW[r.h] || ''}</div>
    <div class="dgrid">
      ${r.ex.length ? `<div><h4>Exports</h4><div>${r.ex.map((x) => `<span class="libchip">${esc(x)}</span>`).join('')}</div></div>` : ''}
      ${r.t.length ? `<div><h4>Touches</h4><div>${r.t.map((t) => `<button class="tagchip" type="button" data-fxtag="${t}">#${t}</button>`).join('')}</div></div>` : ''}
      ${r.im.length ? `<div><h4>Imports (${r.im.length})</h4><div class="flist">${r.im.map((p) => flink(p)).join('')}</div></div>` : ''}
      ${by.length ? `<div><h4>Imported by (${by.length})</h4><div class="flist">${by.map((p) => flink(p)).join('')}</div></div>` : ''}
      ${mounts.length ? `<div><h4>On startup</h4><div class="flist">${mounts.map(([k, label, c, t]) => `<button class="flink" type="button" data-run="${k}" data-comp="${esc(c)}">${esc(c)} mounts at ${Math.round(t)} ms · ${esc(label)}</button>`).join('')}</div></div>` : comps.length ? `<div><h4>On startup</h4><p class="src">Declares ${comps.slice(0, 6).map(esc).join(', ')}; none mounted in the ${Object.keys(ST).length} recorded startups.</p></div>` : ''}
    </div>`;
}

/* where to look */
const wc = $('#whereCards');
for (const [tag, q, lede, files] of WHERE) {
  const n = tag ? ROWS.filter((r) => r.t.includes(tag)).length : 0;
  const L = layerOf(files[0][0]);
  wc.append(
    el(
      'div',
      { class: 'card', 'data-layer': L },
      `<h3><span class="dot"></span>${esc(q)}</h3><p>${esc(lede)}</p>
    <ol class="wl-files">${files.map(([p, why]) => `<li><div>${BYP[p] ? flink(p, p.split('/').pop()) : `<span class="mono">${esc(p)}</span>`}<div class="src" style="overflow-wrap:anywhere">${esc(p.split('/').slice(0, -1).join('/'))}</div><div class="why">${esc(why)}</div></div></li>`).join('')}</ol>
    ${tag ? `<button class="tagchip" type="button" data-fxtag="${tag}" style="justify-self:start">All ${n} files tagged #${tag} →</button>` : ''}`,
    ),
  );
}

/* ================= Part II · startup player ================= */
const EVC = {
  nav: 'var(--fg)',
  load: 'var(--l-client)',
  commit: 'var(--amber)',
  rerender: 'var(--l-tool)',
  api: 'var(--l-api)',
  fetch: 'var(--l-tool)',
  stream: 'var(--l-edge)',
  store: 'var(--l-data)',
  theme: 'var(--l-shared)',
  paint: 'var(--up)',
};
const RTY = {
  script: ['JavaScript', 'var(--l-client)'],
  css: ['CSS', 'var(--l-shared)'],
  font: ['font', 'var(--l-process)'],
  third: ['third-party', 'var(--l-source)'],
  other: ['other', 'var(--dim)'],
  data: ['data', 'var(--l-tool)'],
};
const resType = (n) =>
  /^https?:/.test(n)
    ? 'third'
    : /\.js(\?|$)/.test(n)
      ? 'script'
      : /\.css(\?|$)/.test(n)
        ? 'css'
        : /\.woff2?(\?|$)/.test(n)
          ? 'font'
          : /\.json(\?|$)/.test(n)
            ? 'data'
            : 'other';
const shortName = (n) =>
  n
    .replace(/^https?:\/\/([^/]+).*/, '$1')
    .replace(/^\/assets\//, '')
    .replace(/^\/fonts\/[^/]+\//, '')
    .replace(/-[A-Za-z0-9_-]{8}\.(js|css|json)$/, '.$1');
const viaText = (v) =>
  v && v.names && v.names.length
    ? v.names.slice().reverse().join(' → ')
    : 'not visible on the stack';
const RUNEV = {};
function buildRun(key) {
  const R0 = ST[key],
    rec = R0.rec,
    ev = [];
  ev.push({ t: 0, k: 'nav', h: 'The browser asks for the page', b: `GET ${esc(R0.url)}` });
  if (R0.marks.ttfb != null)
    ev.push({
      t: R0.marks.ttfb,
      k: 'nav',
      h: 'The HTML arrives',
      b: 'The head starts the font preloads, the stylesheet, the module preloads and the blocking bootstrap script all at once.',
    });
  const res = R0.res
    .filter((r) => !r.n.startsWith('/api/'))
    .map((r) => ({ ...r, ty: resType(r.n) }))
    .filter((r) => r.ty !== 'data' && !/\/(ticker|positions)\/?|^\/$/.test(r.n))
    .sort((a, b) => a.s - b.s);
  let g = null;
  for (const r of res) {
    if (g && g.ty === r.ty && r.s - g.t <= 8) {
      g.items.push(r);
      continue;
    }
    g = { t: r.s, ty: r.ty, items: [r] };
    ev.push({ t: r.s, k: 'load', g });
  }
  let rr = null;
  for (const c of rec.commits) {
    if (c.err) continue;
    const mounted = (c.m || []).reduce((a, m) => a + m[3], 0);
    const un = Object.values(c.u || {}).reduce((a, n) => a + n, 0);
    if (mounted || un) {
      ev.push({ t: c.t, k: 'commit', c, mounted, un });
      rr = null;
      continue;
    }
    if (rr && c.t - rr.tEnd < 40) {
      rr.cs.push(c);
      rr.tEnd = c.t;
      continue;
    }
    rr = { t: c.t, tEnd: c.t, k: 'rerender', cs: [c] };
    ev.push(rr);
  }
  for (const n of rec.net)
    ev.push({ t: n.t, k: n.url.startsWith('/api/') ? 'api' : 'fetch', n, path: n.url });
  for (const s of rec.streams) ev.push({ t: s.t, k: 'stream', s });
  let sg = null;
  for (const s of rec.storage) {
    const who = s.names[0] || '';
    if (sg && sg.who === who && s.t - sg.tEnd <= 4) {
      sg.items.push(s);
      sg.tEnd = s.t;
      continue;
    }
    sg = { t: s.t, tEnd: s.t, k: 'store', who, items: [s] };
    ev.push(sg);
  }
  for (const th of rec.theme) ev.push({ t: th.t, k: 'theme', th });
  if (R0.marks.fcp != null)
    ev.push({
      t: R0.marks.fcp,
      k: 'paint',
      h: 'First contentful paint',
      b: 'The first text or image is on screen.',
    });
  if (R0.marks.lcp != null)
    ev.push({
      t: R0.marks.lcp,
      k: 'paint',
      h: 'Largest contentful paint',
      b: 'The largest element is on screen.',
    });
  ev.forEach((e, n) => (e.seq = n)); // arrival order, the tie-break for equal times
  ev.sort((a, b) => a.t - b.t || a.seq - b.seq);
  RUNEV[key] = ev;
  return ev;
}
let stRun = RUNS_ST.map(([k]) => k).find((k) => ST[k]) || null,
  stIdx = 0,
  stCompSel = null;
const stTabs = $('#stTabs');
for (const [k, label] of RUNS_ST) {
  if (!ST[k]) continue;
  const b = el(
    'button',
    {
      class: 'tab',
      role: 'tab',
      type: 'button',
      'aria-selected': String(k === stRun),
      'data-k': k,
    },
    esc(label),
  );
  b.addEventListener('click', () => setRun(k));
  stTabs.append(b);
}
function setRun(k, idx) {
  stRun = k;
  stCompSel = null;
  for (const x of stTabs.children) x.setAttribute('aria-selected', String(x.dataset.k === k));
  const ev = RUNEV[k] || buildRun(k);
  const rangeEl = $('#stRange');
  rangeEl.max = String(ev.length - 1);
  stIdx =
    idx != null
      ? idx
      : Math.max(
          0,
          ev.findIndex((e) => e.k === 'commit'),
        );
  drawLanes();
  renderLog();
  goTo(stIdx);
}
const evLabel = (e) => {
  switch (e.k) {
    case 'nav':
      return e.h;
    case 'load':
      return `${e.g.items.length} ${RTY[e.g.ty][0]} file${e.g.items.length > 1 ? 's' : ''} start loading`;
    case 'commit':
      return `React commit: ${e.mounted} of our components mount${e.un ? `, ${e.un} unmount` : ''}`;
    case 'rerender': {
      const n = new Set(e.cs.flatMap((c) => Object.keys(c.r))).size;
      return `${e.cs.length} commit${e.cs.length > 1 ? 's' : ''} re-render ${n} component${n > 1 ? 's' : ''}`;
    }
    case 'api':
      return `${e.n.m} ${e.path}`;
    case 'fetch':
      return `${e.n.m} ${shortName(e.path)}`;
    case 'stream':
      return `EventSource ${e.s.url}`;
    case 'store':
      return `${e.items.length} localStorage write${e.items.length > 1 ? 's' : ''}${e.who ? ` by ${e.who}` : ''}`;
    case 'theme':
      return `data-theme = ${e.th.v}`;
    case 'paint':
      return e.h;
  }
  return e.k;
};
function renderLog() {
  const ev = RUNEV[stRun];
  $('#stLog').innerHTML = ev
    .map(
      (e, i) =>
        `<button class="ev" type="button" role="listitem" data-ei="${i}"><span class="tm">${Math.round(e.t)} ms</span><span class="dot" style="background:${EVC[e.k]}"></span><span>${esc(evLabel(e))}</span></button>`,
    )
    .join('');
  const R0 = ST[stRun];
  const mounts = R0.rec.commits.reduce((a, c) => a + (c.m || []).reduce((x, m) => x + m[3], 0), 0);
  const kinds = new Set(R0.rec.commits.flatMap((c) => (c.m || []).map((m) => m[0]))).size;
  $('#stSum').innerHTML =
    `<span><b>${R0.rec.commits.length}</b> React commits</span><span><b>${kinds}</b> of our components · <b>${mounts}</b> instances mounted</span><span><b>${R0.rec.net.length}</b> fetches</span><span><b>${R0.rec.streams.length}</b> streams</span><span><b>${R0.rec.storage.length}</b> storage writes</span><span><b>${R0.res.length}</b> files and requests</span><span>first paint <b>${R0.marks.fcp} ms</b> (local)</span>`;
}
$('#stLog').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ei]');
  if (b) goTo(Number(b.dataset.ei));
});
$('#stRange').addEventListener('input', (e) => goTo(Number(e.target.value)));
$('#stPrev').addEventListener('click', () => goTo(Math.max(0, stIdx - 1)));
$('#stNext').addEventListener('click', () => goTo(Math.min(RUNEV[stRun].length - 1, stIdx + 1)));
let LX = null;
function drawLanes() {
  const R0 = ST[stRun],
    ev = RUNEV[stRun],
    s = $('#stLanes');
  s.innerHTML = '';
  const maxT = Math.max(...ev.map((e) => e.t), ...R0.res.map((r) => r.e || r.s));
  const steps = [50, 100, 200, 250, 500, 1000, 2000];
  const step = steps.find((x) => maxT / x <= 9) || 2000;
  const span = Math.ceil(maxT / step) * step;
  const W = 760,
    L = 96,
    Rr = 34,
    top = 30,
    lh = 26;
  const lanes = ['files', 'React', 'requests', 'storage', 'paint'];
  const Hh = top + lanes.length * lh + 22;
  s.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
  const x = (ms) => L + (ms / span) * (W - L - Rr);
  LX = { x, span, L, W, Rr };
  for (let t = 0; t <= span; t += step) {
    s.append(sv('line', { x1: x(t), x2: x(t), y1: top - 6, y2: Hh - 18, class: 'grid' }));
    s.append(
      sv('text', { x: x(t), y: Hh - 4, class: 'ax', 'text-anchor': 'middle' }, t ? `${t} ms` : '0'),
    );
  }
  lanes.forEach((n, i) =>
    s.append(
      sv('text', { x: L - 8, y: top + i * lh + 13, class: 'lane', 'text-anchor': 'end' }, n),
    ),
  );
  const y = (i) => top + i * lh;
  for (const r of R0.res) {
    if (r.n.startsWith('/api/')) {
      s.append(
        sv('rect', {
          x: x(r.s),
          y: y(2) + 4,
          width: Math.max(2, x(r.e) - x(r.s)),
          height: 10,
          rx: 2,
          fill: 'var(--l-api)',
          opacity: '.55',
        }),
      );
      continue;
    }
    const ty = resType(r.n);
    s.append(
      sv('rect', {
        x: x(r.s),
        y: y(0) + 5,
        width: Math.max(2, x(r.e || r.s) - x(r.s)),
        height: 9,
        rx: 2,
        fill: RTY[ty][1],
        opacity: '.55',
      }),
    );
  }
  for (const e of ev) {
    if (e.k === 'commit') {
      const h = Math.min(18, 5 + Math.log2(e.mounted + 1) * 2.4);
      s.append(
        sv('rect', {
          x: x(e.t) - 1.5,
          y: y(1) + 18 - h,
          width: 3,
          height: h,
          fill: 'var(--amber)',
        }),
      );
    }
    if (e.k === 'rerender')
      for (const c of e.cs)
        s.append(
          sv('rect', { x: x(c.t) - 1, y: y(1) + 13, width: 2, height: 5, fill: 'var(--l-tool)' }),
        );
    if (e.k === 'api' || e.k === 'fetch' || e.k === 'stream')
      s.append(sv('circle', { cx: x(e.t), cy: y(2) + 9, r: 3.2, fill: EVC[e.k] }));
    if (e.k === 'store')
      s.append(
        sv('rect', { x: x(e.t) - 1.5, y: y(3) + 3, width: 3, height: 13, fill: 'var(--l-data)' }),
      );
    if (e.k === 'paint')
      s.append(sv('path', { d: `M${x(e.t)},${y(4) + 3} l5,6 l-5,6 l-5,-6 z`, fill: 'var(--up)' }));
    if (e.k === 'theme')
      s.append(sv('circle', { cx: x(e.t), cy: y(3) + 9, r: 3, fill: 'var(--l-shared)' }));
  }
  s.append(sv('line', { id: 'stPh', x1: x(0), x2: x(0), y1: top - 10, y2: Hh - 18, class: 'ph' }));
  s.append(
    sv('text', { id: 'stPhL', x: x(0) + 4, y: top - 14, class: 'mkl', fill: 'var(--amber)' }, ''),
  );
}
$('#stLanes').addEventListener('click', (e) => {
  if (!LX) return;
  const s = $('#stLanes');
  const pt = s.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(s.getScreenCTM().inverse());
  const t = ((p.x - LX.L) / (LX.W - LX.L - LX.Rr)) * LX.span;
  const ev = RUNEV[stRun];
  let best = 0,
    bd = Infinity;
  ev.forEach((x, i) => {
    const d = Math.abs(x.t - t);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  goTo(best);
});
function mountedAt(idx) {
  const ev = RUNEV[stRun];
  const m = new Map();
  let fresh = new Set(),
    gone = new Set();
  for (let i = 0; i <= idx; i++) {
    const e = ev[i];
    if (e.k !== 'commit') continue;
    if (i === idx) {
      fresh = new Set();
      gone = new Set();
    }
    for (const [name, parent, depth, n] of e.c.m || []) {
      const key = `${name}|${parent || ''}`;
      const cur = m.get(key) || { name, parent, depth, n: 0, first: e.t };
      cur.n += n;
      m.set(key, cur);
      if (i === idx) fresh.add(name);
    }
    for (const [name, n] of Object.entries(e.c.u || {})) {
      let left = n;
      for (const [key, v] of [...m].reverse()) {
        if (v.name !== name || left <= 0) continue;
        const d = Math.min(left, v.n);
        v.n -= d;
        left -= d;
        if (v.n <= 0) m.delete(key);
      }
      if (i === idx) gone.add(name);
    }
  }
  return { m, fresh, gone };
}
function renderTreeAt(idx) {
  const { m, fresh, gone } = mountedAt(idx);
  const kids = new Map();
  const names = new Set([...m.values()].map((v) => v.name));
  for (const v of m.values()) {
    const p = v.parent && names.has(v.parent) ? v.parent : '';
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(v);
  }
  const seen = new Set();
  const rec = (p, d) => {
    const list = kids.get(p) || [];
    if (!list.length || d > 40) return '';
    return `<ul>${list
      .map((v) => {
        const k = `${v.name}|${v.parent}`;
        if (seen.has(k)) return '';
        seen.add(k);
        return `<li><button class="cn${fresh.has(v.name) ? ' new' : ''}${stCompSel === v.name ? ' sel' : ''}" type="button" data-comp="${esc(v.name)}">${esc(v.name)}${v.n > 1 ? ` <span class="x">×${v.n}</span>` : ''}</button>${v.name !== p ? rec(v.name, d + 1) : ''}</li>`;
      })
      .join('')}</ul>`;
  };
  const total = [...m.values()].reduce((a, v) => a + v.n, 0);
  $('#stTreeHead').textContent = `Mounted so far · ${names.size} components, ${total} instances`;
  $('#stTree').innerHTML =
    (rec('', 0) || '<p class="muted">Nothing has rendered yet. React hasn\'t committed.</p>') +
    (gone.size
      ? `<p class="src">Unmounted at this step: ${[...gone].map(esc).join(', ')}</p>`
      : '');
}
function compCard(name) {
  if (!name) {
    $('#stComp').innerHTML = '';
    return;
  }
  const files = (IDX.comp[name] || []).filter((p) => !/\.spec\./.test(p));
  const R0 = ST[stRun];
  let first = null,
    rr = 0,
    parent = null;
  for (const c of R0.rec.commits) {
    for (const m of c.m || [])
      if (m[0] === name && first == null) {
        first = c.t;
        parent = m[1];
      }
    rr += (c.r && c.r[name]) || 0;
  }
  const desc = files[0] && BYP[files[0]] ? BYP[files[0]].d : '';
  $('#stComp').innerHTML =
    `<div class="compcard" data-layer="${files[0] ? layerOf(files[0]) : 'client'}"><div class="h"><span class="mono" style="font-weight:600">${esc(name)}</span></div>
    ${OWNS[name] ? `<div>${esc(OWNS[name])}</div>` : ''}
    ${desc ? `<div class="src">From its file: ${esc(desc)}</div>` : ''}
    <div class="src">First mounted at ${first != null ? Math.round(first) + ' ms' : '—'}${parent ? ` inside ${esc(parent)}` : ''} · re-rendered ${rr} time${rr === 1 ? '' : 's'} in this run</div>
    <div>${files.map((p) => flink(p)).join('')}</div></div>`;
}
$('#stTree').addEventListener('click', (e) => {
  const b = e.target.closest('[data-comp]');
  if (!b) return;
  stCompSel = b.dataset.comp;
  renderTreeAt(stIdx);
  compCard(stCompSel);
});
function eventCard(e) {
  let h = esc(evLabel(e)),
    b = '';
  if (e.k === 'nav' || e.k === 'paint') b = `<p>${e.b}</p>`;
  if (e.k === 'load')
    b = `<p class="via">${e.g.items
      .slice(0, 18)
      .map((r) => esc(shortName(r.n)))
      .join(' · ')}${e.g.items.length > 18 ? ' …' : ''}</p>`;
  if (e.k === 'commit') {
    const top = e.c.m
      .slice()
      .sort((a, b2) => a[2] - b2[2])
      .slice(0, 16);
    b = `<p>React committed at ${Math.round(e.t)} ms. Library elements created alongside (MUI, router…): ${e.c.lib}.</p>
      <div style="display:grid;gap:6px">${top.map(([n, p, , c]) => `<div><button class="cn new" type="button" data-comp="${esc(n)}">${esc(n)}${c > 1 ? ` <span class="x">×${c}</span>` : ''}</button> <span class="src">${p ? 'in ' + esc(p) : 'at the root'}</span>${OWNS[n] ? `<div class="src" style="padding-left:6px">${esc(OWNS[n])}</div>` : ''}</div>`).join('')}${e.c.m.length > 16 ? `<p class="src">…and ${e.c.m.length - 16} more kinds; see the tree.</p>` : ''}</div>`;
  }
  if (e.k === 'rerender') {
    const cnt = {};
    for (const c of e.cs) for (const [n, k] of Object.entries(c.r)) cnt[n] = (cnt[n] || 0) + k;
    b = `<p class="via">${Object.entries(cnt)
      .sort((a, b2) => b2[1] - a[1])
      .slice(0, 20)
      .map(([n, k]) => `${esc(n)}${k > 1 ? ' ×' + k : ''}`)
      .join(
        ' · ',
      )}</p><p class="src">Updates to components that were already mounted, from state or prop changes.</p>`;
  }
  if (e.k === 'api' || e.k === 'fetch')
    b = `<p class="via">Called by: ${esc(viaText(e.n))}</p>${e.n.chunk ? `<p class="src">From the <b>${esc(e.n.chunk)}</b> chunk</p>` : ''}${e.k === 'fetch' && /seed/.test(e.path) ? '<p class="src">A demo seed file bundled with the site, read from its own host.</p>' : ''}`;
  if (e.k === 'stream') b = `<p class="via">Opened by: ${esc(viaText(e.s))}</p>`;
  if (e.k === 'store')
    b = `<p class="via">${e.items.map((s) => `${s.op} ${esc(s.k)}${s.b ? ` (${s.b} chars)` : ''}`).join('<br>')}</p><p class="src">Called by: ${esc(viaText(e.items[0]))}</p>`;
  if (e.k === 'theme') b = '<p>The theme attribute on &lt;html&gt; changed.</p>';
  $('#stEvent').innerHTML =
    `<div class="evcard"><div class="badges"><span class="badge plain"><span class="dot" style="background:${EVC[e.k]}"></span>${Math.round(e.t)} ms</span></div><h3>${h}</h3>${b}</div>`;
}
$('#stEvent').addEventListener('click', (e) => {
  const b = e.target.closest('[data-comp]');
  if (!b) return;
  stCompSel = b.dataset.comp;
  renderTreeAt(stIdx);
  compCard(stCompSel);
});
function goTo(i) {
  const ev = RUNEV[stRun];
  stIdx = i;
  const e = ev[i];
  $('#stRange').value = String(i);
  $('#stNow').textContent = `${Math.round(e.t)} ms · step ${i + 1} of ${ev.length}`;
  if (LX) {
    const ph = $('#stPh'),
      pl = $('#stPhL');
    const xx = LX.x(e.t);
    ph.setAttribute('x1', xx);
    ph.setAttribute('x2', xx);
    pl.setAttribute('x', xx + 4 > LX.W - 60 ? xx - 4 : xx + 4);
    pl.setAttribute('text-anchor', xx + 4 > LX.W - 60 ? 'end' : 'start');
    pl.textContent = `${Math.round(e.t)} ms`;
  }
  const log = $('#stLog');
  for (const b of log.children) {
    const k = Number(b.dataset.ei);
    b.classList.toggle('cur', k === i);
    b.classList.toggle('past', k < i);
  }
  const cur = log.children[i];
  if (
    cur &&
    (cur.offsetTop < log.scrollTop || cur.offsetTop > log.scrollTop + log.clientHeight - 30)
  )
    log.scrollTop = cur.offsetTop - 80;
  eventCard(e);
  renderTreeAt(i);
  compCard(stCompSel);
}
function jumpToComp(run, comp) {
  setRun(run);
  const ev = RUNEV[run];
  const i = ev.findIndex((e) => e.k === 'commit' && e.c.m.some((m) => m[0] === comp));
  stCompSel = comp;
  goTo(i < 0 ? 0 : i);
  document.getElementById('startup').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fp]');
  if (f && !f.closest('#ftree')) {
    e.preventDefault();
    selectFile(f.dataset.fp, !f.closest('#files'));
    return;
  }
  const tg = e.target.closest('[data-fxtag]');
  if (tg) {
    e.preventDefault();
    fxTag = tg.dataset.fxtag;
    fxKind = null;
    fxQ = '';
    $('#fxq').value = '';
    renderFx();
    document.getElementById('files').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    return;
  }
  const j = e.target.closest('[data-run][data-comp]');
  if (j) {
    e.preventDefault();
    jumpToComp(j.dataset.run, j.dataset.comp);
  }
});
renderFx();
if (stRun) setRun(stRun);

/* ================= Part II · follow a click ================= */
const compFile = (n) => (IDX.comp[n] || []).find((p) => !/\.spec\./.test(p));
const compChip = (n, extra, cls) => {
  const f = compFile(n);
  const desc = (OWNS[n] || (f && BYP[f] && BYP[f].d) || '').slice(0, 220);
  return `<button class="cn ${cls || ''}" type="button" ${f ? `data-fp="${esc(f)}"` : ''} title="${esc((f || '') + (desc ? ' — ' + desc : ''))}">${esc(n)}${extra ? ` <span class="x">${extra}</span>` : ''}</button>`;
};
const CKEV = {};
function prepFlow(key) {
  const F = CK[key],
    rec = F.rec;
  const st = rec.marks.find((m) => m.label === 'start').t;
  const end = (rec.marks.find((m) => m.label === 'end') || { t: st + 3000 }).t;
  const bgSet = new Set();
  for (const c of rec.commits)
    if (c.t < st && c.t > st - 2500) for (const o of Object.keys(c.o || {})) bgSet.add(o);
  const inputs = rec.input.filter((i) => i.t >= st);
  const ev = [];
  let step = 0;
  for (const m of rec.marks)
    if (m.t >= st && m.label !== 'start' && m.label !== 'end')
      ev.push({ t: m.t - st, k: 'step', label: m.label, n: ++step });
  for (const i of inputs) ev.push({ t: i.t - st, k: 'input', i });
  for (const c of rec.commits) {
    if (c.t < st || c.err) continue;
    const origins = Object.keys(c.o || {});
    const lastIn = inputs
      .filter((i) => i.t <= c.t)
      .map((i) => i.t)
      .pop();
    const recent = lastIn != null && c.t - lastIn < 250;
    const bg =
      !c.m.length &&
      !Object.keys(c.u).length &&
      origins.length > 0 &&
      origins.every((o) => bgSet.has(o)) &&
      !recent;
    ev.push({
      t: c.t - st,
      k: bg ? 'bg' : 'commit',
      c,
      n: Object.values(c.r).reduce((a, b) => a + b, 0),
    });
  }
  for (const s of rec.storage) if (s.t >= st) ev.push({ t: s.t - st, k: 'store', s });
  for (const r of rec.route) if (r.t >= st) ev.push({ t: r.t - st, k: 'route', r });
  for (const n of rec.net) if (n.t >= st) ev.push({ t: n.t - st, k: 'net', n });
  for (const th of rec.theme) if (th.t >= st) ev.push({ t: th.t - st, k: 'theme', th });
  ev.forEach((e, n) => (e.seq = n)); // arrival order, the tie-break for equal times
  ev.sort((a, b) => a.t - b.t || (a.k === 'step' ? -1 : b.k === 'step' ? 1 : a.seq - b.seq));
  CKEV[key] = { all: ev, span: end - st, bgSet };
  return CKEV[key];
}
let ckFlow = CK_FLOWS.map(([k]) => k).find((k) => CK[k]) || null,
  ckIdx = 0,
  ckShowBg = false;
const ckTabs = $('#ckTabs');
for (const [k, label] of CK_FLOWS) {
  if (!CK[k]) continue;
  const b = el(
    'button',
    {
      class: 'tab',
      role: 'tab',
      type: 'button',
      'aria-selected': String(k === ckFlow),
      'data-k': k,
    },
    esc(label),
  );
  b.addEventListener('click', () => setFlow(k));
  ckTabs.append(b);
}
$('#ckBg').addEventListener('change', (e) => {
  ckShowBg = e.target.checked;
  setFlow(ckFlow, true);
});
const ckList = () => {
  const E = CKEV[ckFlow] || prepFlow(ckFlow);
  return ckShowBg ? E.all : E.all.filter((e) => e.k !== 'bg');
};
const CKC = {
  step: 'var(--fg)',
  input: 'var(--signal)',
  commit: 'var(--amber)',
  bg: 'var(--dim)',
  store: 'var(--l-data)',
  route: 'var(--l-edge)',
  net: 'var(--l-api)',
  theme: 'var(--l-shared)',
};
const ckLabel = (e) => {
  switch (e.k) {
    case 'step':
      return `Step ${e.n} · ${e.label}`;
    case 'input':
      return e.i.type === 'keydown'
        ? `You press ${e.i.key}`
        : e.i.type === 'input'
          ? `You type “${e.i.value}”`
          : `You click ${e.i.target}`;
    case 'commit':
    case 'bg': {
      const o = Object.keys(e.c.o || {});
      const m = e.c.m.reduce((a, x) => a + x[3], 0);
      const u = Object.values(e.c.u).reduce((a, x) => a + x, 0);
      const parts = [`${e.n} re-render`];
      if (m) parts.push(`${m} mount`);
      if (u) parts.push(`${u} unmount`);
      return `${e.k === 'bg' ? 'Background: ' : ''}update starts in ${o.length ? o.slice(0, 2).join(', ') + (o.length > 2 ? '…' : '') : e.c.m[0] ? e.c.m[0][1] || 'the root' : '—'} · ${parts.join(', ')}`;
    }
    case 'store':
      return `${e.s.op === 'remove' ? 'Remove' : 'Save'} ${e.s.k.replace(/^convexa\.demo\.v1\./, '')}`;
    case 'route':
      return `URL becomes ${e.r.url}`;
    case 'net':
      return `${e.n.m} ${shortName(e.n.url)}`;
    case 'theme':
      return `data-theme = ${e.th.v}`;
  }
  return e.k;
};
function setFlow(k, keepIdx) {
  ckFlow = k;
  for (const x of ckTabs.children) x.setAttribute('aria-selected', String(x.dataset.k === k));
  const E = CKEV[k] || prepFlow(k);
  const list = ckList();
  const caused = E.all.filter((e) => e.k === 'commit');
  const bgN = E.all.filter((e) => e.k === 'bg');
  const sum = (arr, f) => arr.reduce((a, e) => a + f(e), 0);
  const F = CK[k];
  $('#ckSum').innerHTML =
    `<span>${esc(F.site === 'live' ? 'Live' : 'Demo')} · <b>${esc(F.url)}</b>${F.finalUrl !== F.url ? ` → <b>${esc(F.finalUrl)}</b>` : ''}</span><span><b>${E.all.filter((e) => e.k === 'input').length}</b> inputs</span><span><b>${caused.length}</b> commits caused</span><span><b>${sum(caused, (e) => e.n)}</b> re-renders</span><span><b>${sum(caused, (e) => e.c.m.reduce((a, x) => a + x[3], 0))}</b> mounts</span><span><b>${sum(caused, (e) => Object.values(e.c.u).reduce((a, x) => a + x, 0))}</b> unmounts</span><span><b>${E.all.filter((e) => e.k === 'store').length}</b> storage writes</span><span><b>${E.all.filter((e) => e.k === 'net').length}</b> requests</span>`;
  $('#ckBgNote').textContent = bgN.length
    ? `(${bgN.length} background commits, ${sum(bgN, (e) => e.n).toLocaleString('en-US')} re-renders, mostly from ${[...E.bgSet].slice(0, 3).join(', ')})`
    : '(none in this recording)';
  const agg = {},
    org = {};
  for (const e of caused) {
    for (const [n, c] of Object.entries(e.c.r)) agg[n] = (agg[n] || 0) + c;
    for (const n of Object.keys(e.c.o || {})) org[n] = true;
  }
  const top = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16);
  const mx = top.length ? top[0][1] : 1;
  $('#ckBars').innerHTML = top.length
    ? top
        .map(
          ([n, c]) =>
            `<div class="bar" data-layer="${org[n] ? 'api' : 'client'}"><span class="bn">${compChip(n, '', org[n] ? 'new' : '')}</span><span class="bt"><span class="bf" style="width:${(c / mx) * 100}%"></span></span><span class="bv">${c}×${org[n] ? ' · started here' : ''}</span></div>`,
        )
        .join('') +
      (Object.keys(agg).length > 16
        ? `<p class="src">…and ${Object.keys(agg).length - 16} more components.</p>`
        : '')
    : '<p class="muted">Nothing re-rendered.</p>';
  $('#ckNote').innerHTML = esc(CK_NOTES[k] || '');
  $('#ckRange').max = String(list.length - 1);
  $('#ckLog').innerHTML = list
    .map(
      (e, i) =>
        `<button class="ev${e.k === 'step' ? ' stepev' : ''}" type="button" role="listitem" data-ci="${i}"><span class="tm">+${Math.round(e.t)} ms</span><span class="dot" style="background:${CKC[e.k]}"></span><span>${esc(ckLabel(e))}</span></button>`,
    )
    .join('');
  drawCkLanes(E, list);
  ckGo(keepIdx ? Math.min(ckIdx, list.length - 1) : 0);
}
let CLX = null;
function drawCkLanes(E, list) {
  const s = $('#ckLanes');
  s.innerHTML = '';
  const span0 = Math.max(80, ...list.map((e) => e.t)) * 1.06;
  const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((x) => span0 / x <= 10) || 1000;
  const span = Math.ceil(span0 / step) * step;
  const W = 760,
    L = 96,
    Rr = 34,
    top = 30,
    lh = 26,
    lanes = ['you', 'React', 'state', 'network', 'URL'];
  const Hh = top + lanes.length * lh + 22;
  s.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
  const x = (ms) => L + (ms / span) * (W - L - Rr);
  CLX = { x, span, L, W, Rr };
  for (let t = 0; t <= span; t += step) {
    s.append(sv('line', { x1: x(t), x2: x(t), y1: top - 6, y2: Hh - 18, class: 'grid' }));
    s.append(
      sv(
        'text',
        { x: x(t), y: Hh - 4, class: 'ax', 'text-anchor': 'middle' },
        t ? `+${t} ms` : 'start',
      ),
    );
  }
  lanes.forEach((n, i) =>
    s.append(
      sv('text', { x: L - 8, y: top + i * lh + 13, class: 'lane', 'text-anchor': 'end' }, n),
    ),
  );
  const y = (i) => top + i * lh;
  for (const e of E.all) {
    if (e.k === 'step')
      s.append(
        sv('line', {
          x1: x(e.t),
          x2: x(e.t),
          y1: y(0),
          y2: Hh - 18,
          stroke: 'var(--fg)',
          'stroke-dasharray': '2 3',
          opacity: '.5',
        }),
      );
    if (e.k === 'input')
      s.append(sv('circle', { cx: x(e.t), cy: y(0) + 9, r: 3.6, fill: 'var(--signal)' }));
    if (e.k === 'commit' || (e.k === 'bg' && ckShowBg)) {
      const h = Math.min(18, 4 + Math.log2(e.n + 1) * 2.2);
      s.append(
        sv('rect', {
          x: x(e.t) - 1.5,
          y: y(1) + 18 - h,
          width: 3,
          height: h,
          fill: e.k === 'bg' ? 'var(--dim)' : 'var(--amber)',
          opacity: e.k === 'bg' ? '.6' : '1',
        }),
      );
    }
    if (e.k === 'commit' && e.c.ctx && e.c.ctx.length)
      s.append(sv('circle', { cx: x(e.t), cy: y(2) + 5, r: 2.6, fill: 'var(--l-shared)' }));
    if (e.k === 'store')
      s.append(
        sv('rect', { x: x(e.t) - 1.5, y: y(2) + 8, width: 3, height: 10, fill: 'var(--l-data)' }),
      );
    if (e.k === 'theme')
      s.append(sv('circle', { cx: x(e.t), cy: y(2) + 13, r: 3, fill: 'var(--l-shared)' }));
    if (e.k === 'net')
      s.append(sv('circle', { cx: x(e.t), cy: y(3) + 9, r: 3.2, fill: 'var(--l-api)' }));
    if (e.k === 'route')
      s.append(
        sv('path', { d: `M${x(e.t)},${y(4) + 3} l5,6 l-5,6 l-5,-6 z`, fill: 'var(--l-edge)' }),
      );
  }
  s.append(sv('line', { id: 'ckPh', x1: x(0), x2: x(0), y1: top - 10, y2: Hh - 18, class: 'ph' }));
  s.append(
    sv('text', { id: 'ckPhL', x: x(0) + 4, y: top - 14, class: 'mkl', fill: 'var(--amber)' }, ''),
  );
}
$('#ckLanes').addEventListener('click', (e) => {
  if (!CLX) return;
  const s = $('#ckLanes');
  const pt = s.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(s.getScreenCTM().inverse());
  const t = ((p.x - CLX.L) / (CLX.W - CLX.L - CLX.Rr)) * CLX.span;
  const list = ckList();
  let best = 0,
    bd = Infinity;
  list.forEach((x, i) => {
    const d = Math.abs(x.t - t);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  ckGo(best);
});
$('#ckLog').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ci]');
  if (b) ckGo(Number(b.dataset.ci));
});
$('#ckRange').addEventListener('input', (e) => ckGo(Number(e.target.value)));
$('#ckPrev').addEventListener('click', () => ckGo(Math.max(0, ckIdx - 1)));
$('#ckNext').addEventListener('click', () => ckGo(Math.min(ckList().length - 1, ckIdx + 1)));
function ckCard(e) {
  let h = esc(ckLabel(e)),
    b = '';
  if (e.k === 'step')
    b = `<p>The recorder performs: <b>${esc(e.label)}</b>. Everything below until the next step follows from it, apart from background updates.</p>`;
  if (e.k === 'input')
    b = `<p class="via">${esc(e.i.type)} on <b>${esc(e.i.target || '—')}</b>${e.i.value != null ? ` · value “${esc(e.i.value)}”` : ''}</p><p class="src">Captured on the document before React sees it.</p>`;
  if (e.k === 'commit' || e.k === 'bg') {
    const c = e.c;
    const o = Object.entries(c.o || {});
    const rr = Object.entries(c.r).sort((a, b2) => b2[1] - a[1]);
    b = `${e.k === 'bg' ? '<p class="src">Background: these components also update with no input (here, the demo clock).</p>' : ''}
      <div><div class="eyebrow" style="margin-bottom:4px">Started in</div>${o.length ? o.map(([n, k]) => compChip(n, k > 1 ? '×' + k : '', 'new')).join(' ') : '<span class="src">A mount with no re-render above it.</span>'}${o.map(([n]) => (OWNS[n] ? `<div class="src">${esc(n)}: ${esc(OWNS[n])}</div>` : '')).join('')}</div>
      ${c.ctx && c.ctx.length ? `<div><div class="eyebrow" style="margin-bottom:4px">Context values changed under</div><div class="via">${[...new Set(c.ctx.map((x) => x[1] || 'the root'))].map(esc).join(' · ')}</div></div>` : ''}
      ${c.m.length ? `<div><div class="eyebrow" style="margin-bottom:4px">Mounted</div>${c.m.map((m) => compChip(m[0], m[3] > 1 ? '×' + m[3] : '')).join(' ')}</div>` : ''}
      ${
        Object.keys(c.u).length
          ? `<div><div class="eyebrow" style="margin-bottom:4px">Unmounted</div>${Object.entries(
              c.u,
            )
              .map(([n, k]) => compChip(n, k > 1 ? '×' + k : '', 'gone'))
              .join(' ')}</div>`
          : ''
      }
      ${
        rr.length
          ? `<div><div class="eyebrow" style="margin-bottom:4px">Re-rendered (${e.n})</div><div class="via">${rr
              .slice(0, 24)
              .map(([n, k]) => `${esc(n)}${k > 1 ? ' ×' + k : ''}`)
              .join(' · ')}${rr.length > 24 ? ' …' : ''}</div></div>`
          : ''
      }`;
  }
  if (e.k === 'store')
    b = `<p class="via">${esc(e.s.k)}</p><p>${e.s.op === 'remove' ? 'Removed.' : e.s.same ? 'Written with the same value it already had.' : e.s.pb == null ? `New key, ${e.s.b.toLocaleString('en-US')} characters.` : `${e.s.pb.toLocaleString('en-US')} → ${e.s.b.toLocaleString('en-US')} characters.`}</p><p class="src">Called by: ${esc(viaText(e.s))}</p>`;
  if (e.k === 'route')
    b = `<p class="via">${esc(e.r.how)} → ${esc(e.r.url)}</p><p class="src">React Router changes the URL without a page load.</p>`;
  if (e.k === 'net') b = `<p class="via">Called by: ${esc(viaText(e.n))}</p>`;
  if (e.k === 'theme')
    b =
      '<p>The theme attribute on &lt;html&gt; changes, so the page repaints in the new palette.</p>';
  $('#ckEvent').innerHTML =
    `<div class="evcard"><div class="badges"><span class="badge plain"><span class="dot" style="background:${CKC[e.k]}"></span>+${Math.round(e.t)} ms</span></div><h3>${h}</h3>${b}</div>`;
}
function ckGo(i) {
  const list = ckList();
  if (!list.length) return;
  ckIdx = i;
  const e = list[i];
  $('#ckRange').value = String(i);
  $('#ckNow').textContent = `+${Math.round(e.t)} ms · ${i + 1} of ${list.length}`;
  if (CLX) {
    const xx = CLX.x(e.t);
    const ph = $('#ckPh'),
      pl = $('#ckPhL');
    ph.setAttribute('x1', xx);
    ph.setAttribute('x2', xx);
    const right = xx + 70 > CLX.W;
    pl.setAttribute('x', right ? xx - 4 : xx + 4);
    pl.setAttribute('text-anchor', right ? 'end' : 'start');
    pl.textContent = `+${Math.round(e.t)} ms`;
  }
  const log = $('#ckLog');
  for (const bt of log.children) {
    const k = Number(bt.dataset.ci);
    bt.classList.toggle('cur', k === i);
    bt.classList.toggle('past', k < i);
  }
  const cur = log.children[i];
  if (
    cur &&
    (cur.offsetTop < log.scrollTop || cur.offsetTop > log.scrollTop + log.clientHeight - 30)
  )
    log.scrollTop = cur.offsetTop - 80;
  ckCard(e);
}
if (ckFlow) setFlow(ckFlow);

/* ---------- rail ---------- */
const links = [...document.querySelectorAll('.rail a')];
const io = new IntersectionObserver(
  (ents) => {
    for (const e of ents)
      if (e.isIntersecting)
        for (const a of links)
          a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id);
  },
  { rootMargin: '-30% 0px -60% 0px' },
);
for (const s of document.querySelectorAll('main section')) io.observe(s);

/* ---------- boot ---------- */
let start = 'apps/api';
try {
  const s = localStorage.getItem('atlas.sel');
  if (s && FOLDERS[s]) start = s;
} catch (e) {
  /* storage unavailable */
}
selected = start;
selArch = FOLDERS[start].a || null;
openAncestors(start);
renderTree();
renderDetail();
drawWF();
