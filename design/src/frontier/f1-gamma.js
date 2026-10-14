// F1 · The dealer-gamma surface in WebGL2 (v5 frontier prototype, 2026-10-13). No dependencies.
// Fallback first: the page already shows the static projection (the poster) with its labels and table;
// this script replaces the poster's drawing with a live WebGL2 surface only if a context is available.
// Render on demand (no loop: a frame is drawn only after input, a resize or a scheme change), so a hidden
// or idle tab costs nothing. Orthographic camera (CD10: sizes compared). Pixel ratio capped at 2 (1.5 on
// coarse pointers). Context loss falls back to the poster and recovers on restore. Colours are read from
// the page's tokens (CH4: a canvas ignores var()) and re-read when the scheme changes.
(function () {
  var D = window.__F1; var root = document.getElementById('f1');
  if (!D || !root) return;
  var stage = root.querySelector('.f1-stage'), poster = root.querySelector('.f1-poster'), labels = root.querySelector('.f1-labels');
  var readout = root.querySelector('.f1-readout'), live = root.querySelector('.f1-live');
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var perf = (window.__f1perf = { mode: 'pending', renders: 0, cpu: [], intervals: [], last: 0, ladder: [] });
  // Runtime ladder (CD6): the pixel ratio starts at 2 (1.5 on coarse pointers) and steps down to 1.5, then 1,
  // when the p95 of the last 24 frame intervals while turning exceeds 18 ms. It never steps back up in a session.
  var dprCap = coarse ? 1.5 : 2, win = [];

  // ---- data: refine the 33 × 9 model grid to 97 × 33 (bilinear; tenor spaced by √days, stated) ----
  var S = D.strikes, T = D.tenors, V = D.v; // V[j][i]: tenor j, strike i
  var NX = 97, NZ = 33, vmax = 0;
  var sq = T.map(function (t) { return Math.sqrt(t); }); var sq0 = sq[0], sq1 = sq[sq.length - 1];
  function sample(fx, fz) { // fx in [0, S.length-1], fz in sqrt-days space
    var i0 = Math.min(S.length - 2, Math.floor(fx)), tx = fx - i0; var j0 = 0; while (j0 < sq.length - 2 && sq[j0 + 1] < fz) j0++; var tz = (fz - sq[j0]) / (sq[j0 + 1] - sq[j0]);
    var a = V[j0][i0] * (1 - tx) + V[j0][i0 + 1] * tx, b = V[j0 + 1][i0] * (1 - tx) + V[j0 + 1][i0 + 1] * tx; return a * (1 - tz) + b * tz;
  }
  var G = new Float32Array(NX * NZ);
  for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++) { var v = sample((i / (NX - 1)) * (S.length - 1), sq0 + (j / (NZ - 1)) * (sq1 - sq0)); G[j * NX + i] = v; vmax = Math.max(vmax, Math.abs(v)); }
  vmax = D.vmax || vmax; var H = 0.45 / vmax; // height scale (the same as the poster's)
  var X = function (i) { return -1 + (2 * i) / (NX - 1); }, Z = function (j) { return 0.7 - (1.4 * j) / (NZ - 1); }; // short tenors at the front
  var XS = function (k) { return -1 + (2 * (k - S[0])) / (S[S.length - 1] - S[0]); }, ZT = function (t) { return 0.7 - (1.4 * (Math.sqrt(t) - sq0)) / (sq1 - sq0); };

  // ---- WebGL2, or stay on the poster ----
  var canvas = document.createElement('canvas'); canvas.className = 'f1-canvas'; canvas.setAttribute('aria-hidden', 'true');
  var gl = null;
  if (!window.__F1_FORCE_FALLBACK) { try { gl = canvas.getContext('webgl2', { antialias: true, alpha: true }); } catch (e) { gl = null; } }
  if (!gl) { perf.mode = 'fallback'; root.setAttribute('data-mode', 'fallback'); return; }
  stage.insertBefore(canvas, labels);

  var prog, lineProg, buf = {}, colors = {};
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function link(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  var VS = '#version 300 es\nin vec3 aPos; in vec3 aNor; in float aVal; uniform mat4 uMVP; uniform mat3 uRot; out vec3 vNor; out float vVal;\nvoid main(){ gl_Position = uMVP * vec4(aPos, 1.0); vNor = uRot * aNor; vVal = aVal; }';
  var FS = '#version 300 es\nprecision mediump float; in vec3 vNor; in float vVal; uniform vec3 uUp; uniform vec3 uDown; uniform vec3 uMid; uniform float uVmax; out vec4 o;\nvoid main(){ float t = clamp(abs(vVal) / uVmax, 0.0, 1.0); vec3 c = mix(uMid, vVal >= 0.0 ? uUp : uDown, 0.25 + 0.75 * smoothstep(0.0, 1.0, t)); if (abs(vVal) < 0.04 * uVmax) c = uMid; vec3 n = normalize(gl_FrontFacing ? vNor : -vNor); float l = 0.62 + 0.38 * max(dot(n, normalize(vec3(-0.3, 0.9, 0.4))), 0.0); o = vec4(c * l, 1.0); }';
  var LVS = '#version 300 es\nin vec3 aPos; uniform mat4 uMVP; void main(){ gl_Position = uMVP * vec4(aPos, 1.0); }';
  var LFS = '#version 300 es\nprecision mediump float; uniform vec4 uCol; out vec4 o; void main(){ o = uCol; }';

  function makeBuffers() {
    var pos = new Float32Array(NX * NZ * 3), nor = new Float32Array(NX * NZ * 3), val = new Float32Array(NX * NZ);
    for (var j = 0; j < NZ; j++) for (var i = 0; i < NX; i++) {
      var k = j * NX + i, y = G[k] * H; pos[k * 3] = X(i); pos[k * 3 + 1] = y; pos[k * 3 + 2] = Z(j); val[k] = G[k];
      var yl = G[j * NX + Math.max(0, i - 1)] * H, yr = G[j * NX + Math.min(NX - 1, i + 1)] * H, yb = G[Math.max(0, j - 1) * NX + i] * H, yf = G[Math.min(NZ - 1, j + 1) * NX + i] * H;
      var dx = 2 * (2 / (NX - 1)), dz = 2 * (1.4 / (NZ - 1));
      var nx = -(yr - yl) / dx, nz = (yf - yb) / dz, ny = 1, L = Math.hypot(nx, ny, nz); nor[k * 3] = nx / L; nor[k * 3 + 1] = ny / L; nor[k * 3 + 2] = nz / L;
    }
    var idx = new Uint16Array((NX - 1) * (NZ - 1) * 6), n = 0;
    for (var j2 = 0; j2 < NZ - 1; j2++) for (var i2 = 0; i2 < NX - 1; i2++) { var a = j2 * NX + i2, b = a + 1, c = a + NX, d = c + 1; idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d; }
    buf.vao = gl.createVertexArray(); gl.bindVertexArray(buf.vao);
    var attr = function (name, data, size) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); var loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    attr('aPos', pos, 3); attr('aNor', nor, 3); attr('aVal', val, 1);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); buf.count = idx.length;
    gl.bindVertexArray(null);
    // lines: surface wires, the zero plane, the zero contour (where dealers flip from long to short gamma)
    var wires = [], plane = [], contour = [];
    for (var j3 = 0; j3 < NZ; j3 += 4) for (var i3 = 0; i3 < NX - 1; i3++) wires.push(X(i3), G[j3 * NX + i3] * H + 0.003, Z(j3), X(i3 + 1), G[j3 * NX + i3 + 1] * H + 0.003, Z(j3));
    for (var i4 = 0; i4 < NX; i4 += 12) for (var j4 = 0; j4 < NZ - 1; j4++) wires.push(X(i4), G[j4 * NX + i4] * H + 0.003, Z(j4), X(i4), G[(j4 + 1) * NX + i4] * H + 0.003, Z(j4 + 1));
    plane.push(-1, 0, 0.7, 1, 0, 0.7, 1, 0, 0.7, 1, 0, -0.7, 1, 0, -0.7, -1, 0, -0.7, -1, 0, -0.7, -1, 0, 0.7);
    for (var j5 = 0; j5 < NZ; j5++) for (var i5 = 0; i5 < NX - 1; i5++) { var p0 = G[j5 * NX + i5], p1 = G[j5 * NX + i5 + 1]; if ((p0 < 0) !== (p1 < 0)) { var t = p0 / (p0 - p1), xx = X(i5) + t * (X(i5 + 1) - X(i5)); if (j5 < NZ - 1) { var q0 = G[(j5 + 1) * NX + i5], q1 = G[(j5 + 1) * NX + i5 + 1]; if ((q0 < 0) !== (q1 < 0)) { var t2 = q0 / (q0 - q1), x2 = X(i5) + t2 * (X(i5 + 1) - X(i5)); contour.push(xx, 0.004, Z(j5), x2, 0.004, Z(j5 + 1)); } } } }
    buf.lines = {};
    [['wires', wires], ['plane', plane], ['contour', contour]].forEach(function (pair) { var vao = gl.createVertexArray(); gl.bindVertexArray(vao); var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pair[1]), gl.STATIC_DRAW); var loc = gl.getAttribLocation(lineProg, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); buf.lines[pair[0]] = { vao: vao, n: pair[1].length / 3 }; });
    buf.probe = { vao: gl.createVertexArray(), b: gl.createBuffer() };
    gl.bindVertexArray(buf.probe.vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf.probe.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(6), gl.DYNAMIC_DRAW); var pl = gl.getAttribLocation(lineProg, 'aPos'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  }
  function init() { prog = link(VS, FS); lineProg = link(LVS, LFS); makeBuffers(); readColors(); }

  // ---- tokens ----
  function rgb(str) { var c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = str; var h = c.fillStyle; if (h[0] === '#') return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1]; var m = h.match(/[\d.]+/g).map(Number); return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] == null ? 1 : m[3]]; }
  function readColors() { var cs = getComputedStyle(root); var g = function (n) { return rgb(cs.getPropertyValue(n).trim()); }; colors = { up: g('--up'), down: g('--down'), mid: g('--raised-2'), line: g('--line-2'), phos: g('--phosphor'), steel: g('--steel') }; }

  // ---- camera: orthographic, yaw and pitch, fitted once per size over the whole allowed range ----
  var cam = { yaw: -0.55, pitch: 0.52 }, Y0 = -0.62, Y1 = 0.62, P0 = 0.25, P1 = 0.8, W = 0, Hh = 0, k = 1, cu = 0, cv = 0;
  function rot(yaw, pitch) { var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch); return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy]; }
  var ymin = -vmax * H, ymax = vmax * H;
  function fit() { var mu = 0, mv = 0; for (var a = 0; a <= 8; a++) for (var b = 0; b <= 4; b++) { var R = rot(Y0 + ((Y1 - Y0) * a) / 8, P0 + ((P1 - P0) * b) / 4); [-1, 1].forEach(function (x) { [ymin, ymax].forEach(function (y) { [-0.7, 0.7].forEach(function (z) { mu = Math.max(mu, Math.abs(R[0] * x + R[1] * y + R[2] * z)); mv = Math.max(mv, Math.abs(R[3] * x + R[4] * y + R[5] * z)); }); }); }); } k = Math.min((W / 2) * 0.94 / mu, (Hh / 2) * 0.9 / mv); }
  function matrices() { var R = rot(cam.yaw, cam.pitch), ax = k / (W / 2), ay = k / (Hh / 2), dz = 0.35; var m = new Float32Array([ax * R[0], ay * R[3], -dz * R[6], 0, ax * R[1], ay * R[4], -dz * R[7], 0, ax * R[2], ay * R[5], -dz * R[8], 0, 0, -0.08, 0, 1]); return { mvp: m, rot: new Float32Array([R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]), R: R, ax: ax, ay: ay }; }
  function project(M, x, y, z) { var R = M.R; return [(1 + M.ax * (R[0] * x + R[1] * y + R[2] * z)) * W / 2, (1 - (M.ay * (R[3] * x + R[4] * y + R[5] * z) - 0.08)) * Hh / 2]; }

  // ---- probe (keyboard and pointer share one index) ----
  var probe = { i: S.indexOf(D.levels.call), j: 2 };
  function gridVal(i, j) { return V[j][i]; }
  function say() {
    var v = gridVal(probe.i, probe.j), sign = v >= 0 ? 'dealers long gamma (moves tend to be damped)' : 'dealers short gamma (moves tend to be amplified)';
    var txt = 'Strike ' + S[probe.i].toFixed(1) + ' · ' + T[probe.j] + (T[probe.j] === 1 ? ' day' : ' days') + ' · ' + (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(2) + 'M per 1% · ' + sign;
    readout.textContent = txt; live.textContent = txt;
  }

  // ---- draw ----
  var pending = false;
  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }
  function resize() { var r = stage.getBoundingClientRect(); var dpr = Math.min(window.devicePixelRatio || 1, dprCap); perf.dpr = dpr; W = r.width; Hh = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr); fit(); request(); }
  function draw(ts) {
    pending = false; if (gl.isContextLost()) return; var t0 = performance.now();
    if (perf.last) { var iv = ts - perf.last; perf.intervals.push(iv); if (drag && iv < 100) { win.push(iv); if (win.length > 24) win.shift(); if (win.length === 24 && dprCap > 1) { var sorted = win.slice().sort(function (a, b) { return a - b; }); if (sorted[22] > 18) { dprCap = dprCap > 1.5 ? 1.5 : 1; win = []; perf.ladder.push({ at: Math.round(ts), dpr: dprCap, p95: +sorted[22].toFixed(1) }); var r = stage.getBoundingClientRect(); var d2 = Math.min(window.devicePixelRatio || 1, dprCap); perf.dpr = d2; canvas.width = Math.round(r.width * d2); canvas.height = Math.round(r.height * d2); } } } }
    perf.last = ts;
    var M = matrices();
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.useProgram(prog); gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, M.mvp); gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'uRot'), false, M.rot);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uUp'), colors.up.slice(0, 3)); gl.uniform3fv(gl.getUniformLocation(prog, 'uDown'), colors.down.slice(0, 3)); gl.uniform3fv(gl.getUniformLocation(prog, 'uMid'), colors.mid.slice(0, 3)); gl.uniform1f(gl.getUniformLocation(prog, 'uVmax'), vmax);
    gl.bindVertexArray(buf.vao); gl.drawElements(gl.TRIANGLES, buf.count, gl.UNSIGNED_SHORT, 0);
    gl.useProgram(lineProg); gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, 'uMVP'), false, M.mvp); var col = gl.getUniformLocation(lineProg, 'uCol');
    var L = buf.lines; gl.uniform4fv(col, [colors.line[0], colors.line[1], colors.line[2], 0.55]); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(L.wires.vao); gl.drawArrays(gl.LINES, 0, L.wires.n);
    gl.uniform4fv(col, [colors.steel[0], colors.steel[1], colors.steel[2], 0.9]); gl.bindVertexArray(L.plane.vao); gl.drawArrays(gl.LINES, 0, L.plane.n);
    gl.uniform4fv(col, colors.phos); gl.bindVertexArray(L.contour.vao); gl.drawArrays(gl.LINES, 0, L.contour.n);
    var px = XS(S[probe.i]), pz = ZT(T[probe.j]), py = gridVal(probe.i, probe.j) * H; gl.bindBuffer(gl.ARRAY_BUFFER, buf.probe.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array([px, 0, pz, px, py, pz])); gl.bindVertexArray(buf.probe.vao); gl.drawArrays(gl.LINES, 0, 2);
    gl.bindVertexArray(null); gl.disable(gl.BLEND);
    // HTML labels, placed by projection: text stays at true size (11px floor) at any width
    labels.querySelectorAll('[data-x]').forEach(function (el) { var p = project(M, +el.getAttribute('data-x'), +el.getAttribute('data-y'), +el.getAttribute('data-z')); el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; });
    var pp = project(M, px, py, pz); var dot = labels.querySelector('.f1-dot'); dot.style.left = pp[0] + 'px'; dot.style.top = pp[1] + 'px';
    perf.renders++; perf.cpu.push(performance.now() - t0);
    if (drag) request(); else perf.last = 0;
  }

  // ---- input: drag to orbit (horizontal on touch, so a vertical swipe still scrolls), arrows to probe ----
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, type: e.pointerType }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers can't be captured */ } request(); });
  canvas.addEventListener('pointermove', function (e) {
    if (drag) { cam.yaw = Math.max(Y0, Math.min(Y1, drag.yaw + (e.clientX - drag.x) * 0.006)); if (drag.type !== 'touch') cam.pitch = Math.max(P0, Math.min(P1, drag.pitch + (e.clientY - drag.y) * 0.004)); request(); return; }
    if (e.pointerType !== 'mouse') return; var M = matrices(), r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = 1e9, bi = 0, bj = 0;
    for (var j = 0; j < T.length; j++) for (var i = 0; i < S.length; i++) { var p = project(M, XS(S[i]), V[j][i] * H, ZT(T[j])); var d = (p[0] - mx) * (p[0] - mx) + (p[1] - my) * (p[1] - my); if (d < best) { best = d; bi = i; bj = j; } }
    if (best < 900 && (bi !== probe.i || bj !== probe.j)) { probe.i = bi; probe.j = bj; say(); request(); }
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function () { drag = null; }); });
  root.querySelector('.f1-stage').addEventListener('keydown', function (e) {
    var used = true;
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) cam.yaw = Math.max(Y0, Math.min(Y1, cam.yaw + (e.key === 'ArrowLeft' ? -0.12 : 0.12)));
    else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) cam.pitch = Math.max(P0, Math.min(P1, cam.pitch + (e.key === 'ArrowUp' ? 0.1 : -0.1)));
    else if (e.key === 'ArrowLeft') probe.i = Math.max(0, probe.i - 1); else if (e.key === 'ArrowRight') probe.i = Math.min(S.length - 1, probe.i + 1);
    else if (e.key === 'ArrowUp') probe.j = Math.min(T.length - 1, probe.j + 1); else if (e.key === 'ArrowDown') probe.j = Math.max(0, probe.j - 1);
    else if (e.key === 'Home') { cam.yaw = -0.55; cam.pitch = 0.52; } else used = false;
    if (used) { e.preventDefault(); say(); request(); }
  });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.setAttribute('data-mode', 'fallback'); perf.lost = (perf.lost || 0) + 1; labels.querySelectorAll('[data-pl]').forEach(function (el) { el.style.left = el.getAttribute('data-pl'); el.style.top = el.getAttribute('data-pt'); }); });
  canvas.addEventListener('webglcontextrestored', function () { init(); root.setAttribute('data-mode', 'webgl'); perf.restored = (perf.restored || 0) + 1; request(); });
  new MutationObserver(function () { readColors(); request(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

  try { init(); } catch (err) { perf.mode = 'fallback'; perf.error = String(err); root.setAttribute('data-mode', 'fallback'); canvas.remove(); return; }
  perf.mode = 'webgl2'; root.setAttribute('data-mode', 'webgl'); say(); resize();
})();
