// F3 · Forecast calibration with intervals, explorable (v5 frontier prototype, 2026-10-13). No dependencies.
// The page shows the static fallback (tenths, 95% Wilson intervals). This script lets a reader change the
// interval (80 · 90 · 95%) and the bin width (tenths · fifths), step through bins with the keyboard, and
// read the calls inside a bin. Nothing animates: every change is an instant redraw, so reduced motion
// needs no separate path. Sample calls, labelled; production's Scorecard has fewer than 20 graded calls.
(function () {
  var D = window.__F3, root = document.getElementById('f3');
  if (!D || !root) return;
  var plot = root.querySelector('.f3-plot'), list = root.querySelector('.f3-calls'), sub = root.querySelector('.f3-sub'), claim = root.querySelector('.f3-claim'), live = root.querySelector('.f3-live');
  var Z = { 80: 1.2816, 90: 1.6449, 95: 1.96 }, st = { level: 95, width: 0.1, sel: -1 };
  var perf = (window.__f3perf = { renders: 0, cpu: [] });
  function wilson(k, n, z) { if (!n) return [0, 1]; var p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; }
  function bins() { var w = st.width, nb = Math.round(1 / w), out = []; for (var b = 0; b < nb; b++) out.push({ lo: b * w, hi: (b + 1) * w, calls: [] }); D.calls.forEach(function (c) { var b = Math.min(nb - 1, Math.floor(c.p / w)); out[b].calls.push(c); }); return out.map(function (b) { var n = b.calls.length, k = b.calls.filter(function (c) { return c.y; }).length, mid = b.calls.reduce(function (s, c) { return s + c.p; }, 0) / (n || 1); return { lo: b.lo, hi: b.hi, n: n, k: k, p: n ? mid : (b.lo + b.hi) / 2, hit: n ? k / n : null, ci: wilson(k, n, Z[st.level]), calls: b.calls }; }); }
  var pc = function (v) { return Math.round(v * 100) + '%'; };
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  function render() {
    var t0 = performance.now(), B = bins();
    var X = function (v) { return (v * 100).toFixed(2); }, Y = function (v) { return ((1 - v) * 100).toFixed(2); };
    var grid = [0, 0.25, 0.5, 0.75, 1].map(function (v) { return '<line x1="0" x2="1000" y1="' + Y(v) * 10 + '" y2="' + Y(v) * 10 + '" stroke="var(--c-grid)" vector-effect="non-scaling-stroke"></line>'; }).join('');
    var svg = '<svg class="ln" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">' + grid + '<line x1="0" y1="1000" x2="1000" y2="0" stroke="var(--c-edge)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"></line></svg>';
    var marks = B.map(function (b, i) { if (!b.n) return ''; var on = i === st.sel; return '<span class="wk" data-mark="essential" style="left:' + X(b.p) + '%;top:' + Y(b.ci[1]) + '%;height:' + (Y(b.ci[0]) - Y(b.ci[1])).toFixed(2) + '%"></span><span class="dt" data-mark="essential" style="left:' + X(b.p) + '%;top:' + Y(b.hit) + '%;width:' + (on ? 14 : 10) + 'px;height:' + (on ? 14 : 10) + 'px;background:var(--c-emph)"></span><span class="pl" style="left:' + X(b.p) + '%;top:' + Y(b.ci[1]) + '%">n ' + b.n + '</span>' + (on ? '<span class="fring" style="left:' + X(b.p) + '%;top:' + Y(b.hit) + '%;width:22px;height:22px"></span>' : ''); }).join('');
    var rug = D.calls.map(function (c) { return '<span class="rug' + (c.y ? ' y' : '') + '" style="left:' + X(c.p) + '%"></span>'; }).join('');
    var xl = [0, 0.25, 0.5, 0.75, 1].map(function (v, i) { return '<span class="xl' + (i === 0 ? ' a0' : i === 4 ? ' a1' : '') + '" style="left:' + X(v) + '%">' + (v === 1 ? '100% said' : pc(v)) + '</span>'; }).join('');
    var yl = [0, 0.25, 0.5, 0.75, 1].map(function (v) { return '<span class="yl" style="top:' + Y(v) + '%">' + (v === 1 ? '100% true' : pc(v)) + '</span>'; }).join('');
    plot.querySelector('.pa').innerHTML = svg + marks + xl + yl + '<div class="f3-rug" aria-hidden="true">' + rug + '</div>';
    var widest = B.filter(function (b) { return b.n; }).sort(function (a, b) { return (b.ci[1] - b.ci[0]) - (a.ci[1] - a.ci[0]); })[0];
    sub.textContent = 'Share of forecasts that came true, by stated probability · ' + D.calls.length + ' sample calls · dot = hit rate, bar = ' + st.level + '% interval (Wilson), n above each, dashed line = perfectly calibrated · ticks below: each call (raised = came true)';
    claim.textContent = 'At ' + st.level + '% confidence, the ' + pc(widest.lo) + '–' + pc(widest.hi) + ' bin is the least certain: ' + widest.n + ' calls, anywhere from ' + pc(widest.ci[0]) + ' to ' + pc(widest.ci[1]) + ' true';
    if (st.sel >= 0 && B[st.sel] && B[st.sel].n) { var b = B[st.sel]; list.innerHTML = '<p class="cf-note" style="color: var(--phosphor);"><b>' + pc(b.lo) + '–' + pc(b.hi) + '</b> · ' + b.n + ' calls · ' + b.k + ' came true (' + pc(b.hit) + ') · ' + st.level + '% interval ' + pc(b.ci[0]) + '–' + pc(b.ci[1]) + '</p><ul class="f3-ul">' + b.calls.slice(0, 8).map(function (c) { return '<li><span class="mono">' + pc(c.p) + '</span> ' + esc(c.t) + ' · <span class="steel">' + (c.y ? 'came true' : 'did not') + '</span></li>'; }).join('') + (b.calls.length > 8 ? '<li class="steel">and ' + (b.calls.length - 8) + ' more calls</li>' : '') + '</ul>'; live.textContent = list.querySelector('p').textContent; }
    else list.innerHTML = '<p class="cf-note">Choose a bin (arrow keys on the chart, or click a dot) to read its calls.</p>';
    perf.renders++; perf.cpu.push(performance.now() - t0);
  }
  root.querySelectorAll('[data-level]').forEach(function (b) { b.addEventListener('click', function () { st.level = +b.getAttribute('data-level'); root.querySelectorAll('[data-level]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render(); }); });
  root.querySelectorAll('[data-width]').forEach(function (b) { b.addEventListener('click', function () { st.width = +b.getAttribute('data-width'); st.sel = -1; root.querySelectorAll('[data-width]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render(); }); });
  plot.addEventListener('keydown', function (e) { var nb = Math.round(1 / st.width), used = true; if (e.key === 'ArrowRight') st.sel = Math.min(nb - 1, st.sel + 1); else if (e.key === 'ArrowLeft') st.sel = Math.max(0, st.sel < 0 ? 0 : st.sel - 1); else if (e.key === 'Home') st.sel = 0; else if (e.key === 'End') st.sel = nb - 1; else if (e.key === 'Escape') st.sel = -1; else used = false; if (used) { e.preventDefault(); render(); } });
  plot.addEventListener('click', function (e) { var r = plot.querySelector('.pa').getBoundingClientRect(); var x = (e.clientX - r.left) / r.width; if (x < 0 || x > 1) return; st.sel = Math.min(Math.round(1 / st.width) - 1, Math.floor(x / st.width)); render(); });
  root.setAttribute('data-mode', 'live'); root.querySelectorAll('.f3-controls button').forEach(function (b) { b.disabled = false; });
  render();
})();
