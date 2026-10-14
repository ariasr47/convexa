// F2 · A year of the Treasury curve, scrubbable (v5 frontier prototype, 2026-10-13). No dependencies.
// The page already shows the static fallback (today's curve and the year in four curves). This script
// adds the scrubber: a native range input (keyboard for free: arrows a day, Page Up/Down ten, Home/End),
// Play (15 business days a second; paused when the tab is hidden; under reduced motion each press steps
// one month and nothing animates), FOMC decisions on the track, and the claim recomputed for the chosen
// day. The selected curve morphs by snapping to each day's data: motion between related states, no tween.
(function () {
  var D = window.__F2, root = document.getElementById('f2');
  if (!D || !root) return;
  var plot = root.querySelector('.f2-plot'), range = root.querySelector('.f2-range'), play = root.querySelector('.f2-play');
  var date = root.querySelector('.f2-date'), claim = root.querySelector('.f2-claim'), rd = root.querySelector('.f2-readout'), live = root.querySelector('.f2-live');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var N = D.days.length, T = D.tenors, perf = (window.__f2perf = { renders: 0, cpu: [], intervals: [], last: 0 });
  var tx = function (tau) { return Math.sqrt(tau); }, x0 = tx(T[0][1]), x1 = tx(T[T.length - 1][1]);
  var X = function (tau) { return ((tx(tau) - x0) / (x1 - x0)) * 100; }, Y = function (v) { return (1 - (v - D.ymin) / (D.ymax - D.ymin)) * 100; };
  var fmt = function (v, dp) { return v == null ? '—' : v.toFixed(dp == null ? 2 : dp); };
  var signed = function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2); };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var dl = function (t) { var d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); };
  var i2 = T.findIndex(function (t) { return t[0] === '2Y'; }), i10 = T.findIndex(function (t) { return t[0] === '10Y'; }), i3 = T.findIndex(function (t) { return t[0] === '3M'; }), i30 = T.findIndex(function (t) { return t[0] === '30Y'; });
  var events = D.events; // [{ i, label, title }]

  function line(ys, cls, w) { return '<polyline class="' + cls + '" points="' + ys.map(function (v, k) { return (X(T[k][1]) * 10).toFixed(1) + ',' + (Y(v) * 10).toFixed(1); }).join(' ') + '" fill="none" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" data-mark="essential"></polyline>'; }
  function render(i) {
    var t0 = performance.now();
    var now = D.ys[i], mo = D.ys[Math.max(0, i - 21)], start = D.ys[0];
    var svg = '<svg class="ln" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">' + D.yticks.map(function (v) { return '<line x1="0" x2="1000" y1="' + (Y(v) * 10).toFixed(1) + '" y2="' + (Y(v) * 10).toFixed(1) + '" stroke="var(--c-grid)" vector-effect="non-scaling-stroke"></line>'; }).join('') + line(start, 'l2', 2).replace('class="l2"', 'class="l2" stroke="var(--c-ctx2)"') + line(mo, 'l1', 2).replace('class="l1"', 'class="l1" stroke="var(--c-ctx)"') + line(now, 'l0', 2.5).replace('class="l0"', 'class="l0" stroke="var(--c-emph)"') + '</svg>';
    var dots = now.map(function (v, k) { return '<span class="dot" style="left:' + X(T[k][1]).toFixed(2) + '%;top:' + Y(v).toFixed(2) + '%;background:var(--c-emph)"></span>'; }).join('');
    var yl = D.yticks.map(function (v, k) { return '<span class="yl" style="top:' + Y(v).toFixed(2) + '%">' + (k === D.yticks.length - 1 ? v.toFixed(1) + ' %' : v.toFixed(1)) + '</span>'; }).join('');
    var xl = T.filter(function (t) { return ['3M', '2Y', '5Y', '10Y', '30Y'].indexOf(t[0]) >= 0; }).map(function (t) { return '<span class="xl" style="left:' + X(t[1]).toFixed(2) + '%">' + t[0] + '</span>'; }).join('');
    // end labels with leaders when they meet (the same rule as the kit)
    var items = [[now[i30], '<span class="l">' + dl(D.days[i]).replace(/, \d{4}$/, '') + '</span><span class="s">Day</span>', fmt(now[i30]) + '%', ''], [mo[i30], '<span class="l">a month before</span><span class="s">−1M</span>', fmt(mo[i30]) + '%', ' ctx'], [start[i30], '<span class="l">Oct 13, 2025</span><span class="s">Start</span>', fmt(start[i30]) + '%', ' ctx']].map(function (a) { return { y: Y(a[0]), h: a[1], v: a[2], c: a[3] }; }).sort(function (a, b) { return a.y - b.y; });
    var gap = (30 / (plot.clientHeight - 46 || 200)) * 100;
    for (var k = 1; k < items.length; k++) { var prev = items[k - 1].m == null ? items[k - 1].y : items[k - 1].m; if (items[k].y - prev < gap) items[k].m = prev + gap; }
    var ends = items.map(function (it) { var at = it.m == null ? it.y : it.m; return (it.m != null ? '<span class="ldr" style="top:' + Math.min(it.y, at).toFixed(2) + '%;height:' + Math.abs(at - it.y).toFixed(2) + '%"></span>' : '') + '<span class="el' + it.c + '" style="top:' + at.toFixed(2) + '%">' + it.h + '<span class="v">' + it.v + '</span></span>'; }).join('');
    plot.querySelector('.pa').innerHTML = svg + dots + yl + xl + ends;
    var front = now[i3] - start[i3], longEnd = now[i30] - start[i30], s210 = now[i10] - now[i2];
    date.textContent = dl(D.days[i]);
    claim.textContent = i === 0 ? 'Oct 13, 2025: the year starts here, 2s10s at ' + signed(s210) + ' points' : 'By ' + dl(D.days[i]) + ' the front end had moved ' + signed(front) + ' points and the 30-year ' + signed(longEnd) + '; 2s10s ' + signed(s210);
    var ev = events.filter(function (e) { return Math.abs(e.i - i) <= 1; })[0];
    rd.innerHTML = '<span><b>' + fmt(now[i2]) + '%</b> 2-year</span><span><b>' + fmt(now[i10]) + '%</b> 10-year</span><span><b>' + signed(s210) + '</b> 2s10s (pp)</span><span><b>' + fmt(now[i30]) + '%</b> 30-year</span>' + (ev ? '<span class="ev-now"><b>' + ev.title + '</b></span>' : '');
    root.querySelectorAll('.f2-ev').forEach(function (el) { el.classList.toggle('on', Math.abs(+el.getAttribute('data-i') - i) <= 1); });
    range.setAttribute('aria-valuetext', dl(D.days[i]) + ': 2-year ' + fmt(now[i2]) + '%, 10-year ' + fmt(now[i10]) + '%');
    perf.renders++; perf.cpu.push(performance.now() - t0);
  }
  var cur = N - 1, raf = 0, lastT = 0, acc = 0;
  function set(i) { cur = Math.max(0, Math.min(N - 1, i)); range.value = String(cur); render(cur); }
  range.addEventListener('input', function () { set(+range.value); });
  range.addEventListener('change', function () { live.textContent = range.getAttribute('aria-valuetext'); });
  function tick(ts) {
    if (perf.last) perf.intervals.push(ts - perf.last); perf.last = ts;
    if (!lastT) lastT = ts; acc += (ts - lastT) * 0.015; lastT = ts; // 15 business days a second
    var step = Math.floor(acc); if (step) { acc -= step; set(cur + step); }
    if (cur >= N - 1) return stop();
    raf = requestAnimationFrame(tick);
  }
  function start() { if (cur >= N - 1) set(0); lastT = 0; acc = 0; perf.last = 0; play.setAttribute('aria-pressed', 'true'); play.textContent = 'Pause'; raf = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(raf); raf = 0; play.setAttribute('aria-pressed', 'false'); play.textContent = reduce.matches ? 'Next month' : 'Play the year'; live.textContent = range.getAttribute('aria-valuetext'); }
  play.addEventListener('click', function () { if (reduce.matches) { set(cur >= N - 1 ? 0 : cur + 21); live.textContent = range.getAttribute('aria-valuetext'); return; } if (raf) stop(); else start(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && raf) stop(); });
  reduce.addEventListener && reduce.addEventListener('change', function () { if (raf) stop(); play.textContent = reduce.matches ? 'Next month' : 'Play the year'; });
  root.querySelectorAll('.f2-ev').forEach(function (el) { el.addEventListener('click', function () { set(+el.getAttribute('data-i')); live.textContent = range.getAttribute('aria-valuetext'); }); });
  root.setAttribute('data-mode', 'live'); range.disabled = false; play.disabled = false; root.querySelectorAll('.f2-ev').forEach(function (el) { el.disabled = false; }); play.textContent = reduce.matches ? 'Next month' : 'Play the year';
  set(N - 1);
})();
