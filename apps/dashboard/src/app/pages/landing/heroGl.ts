/**
 * The landing hero's WebGL2 view (F1, canon P-15). No dependency: raw WebGL2, about 150 lines, ported
 * from the design prototype `design/src/frontier/f1-gamma.js`.
 *
 * The binding conditions (DESIGN_SYSTEM.md Amendments, P-15 and 2026-10-14):
 * - Render on demand. There is no loop: a frame is drawn only after input, a resize or a colour
 *   change, so an idle or hidden tab draws nothing (0 idle frames).
 * - No autoplay. Nothing moves unless the reader moves it, so reduced motion changes nothing.
 * - A runtime pixel-ratio ladder: the ratio starts at 2 (1.5 on coarse pointers) and steps down to
 *   1.5, then 1, when the p95 of the last 24 frame intervals while turning exceeds both 18 ms and 1.5× their
 *   median (frames dropped, not a 60 Hz display's vsync jitter). It never steps back up.
 * - The static projection is the designed fallback: `createHeroGl` returns null when there is no
 *   WebGL2 or a shader fails, and a lost context hands the stage back to it until a restore.
 * - The flip contour is phosphor (the theme's text colour), never amber.
 *
 * Orthographic camera, so heights compare. Labels are HTML placed by projection, so text stays at its
 * true size (the 11px floor, P-13) at any width.
 *
 * `window.__heroPerf` exposes counters for the frame-time harness (tmp/hero-gpu-perf.mjs). Per-frame
 * samples are kept only when `window.__HERO_PERF__` is set, so a normal visit stores nothing per frame.
 */
import {
  CAMERA,
  HSCALE,
  STRIKES,
  TENORS,
  V,
  VMAX,
  XS,
  ZT,
  probeWorld,
  rot,
  type Probe,
} from './heroSurface';

export type Rgba = [number, number, number, number];
export interface HeroColors {
  up: Rgba;
  down: Rgba;
  mid: Rgba;
  line: Rgba;
  phosphor: Rgba;
  steel: Rgba;
}

export interface HeroPerf {
  mode: 'pending' | 'webgl2' | 'fallback';
  renders: number;
  dpr: number;
  ladder: { at: number; dpr: number; p95: number }[];
  cpu: number[];
  intervals: number[];
  lost: number;
  restored: number;
  error?: string;
}

declare global {
  interface Window {
    __heroPerf?: HeroPerf;
    __HERO_PERF__?: boolean;
    __HERO_FORCE_FALLBACK__?: boolean;
    /** Turns the WebGL view on in a build that ships it off (the frame-time harness; see GammaSurfaceHero). */
    __HERO_WEBGL__?: boolean;
  }
}

export interface HeroGl {
  setColors(c: HeroColors): void;
  setProbe(p: Probe): void;
  dispose(): void;
}

interface Options {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Elements carrying data-x / data-y / data-z (world coordinates), placed after every frame. */
  labels: () => HTMLElement[];
  dot: HTMLElement;
  colors: HeroColors;
  probe: Probe;
  onProbe: (p: Probe) => void;
  /** false when the context is lost; true after the first frame, and after the first frame of a restore. */
  onContext: (ok: boolean) => void;
}

// ---- colour parsing (theme values are hex or rgb()/rgba()) ------------------------------------------
export function parseColor(str: string): Rgba {
  const s = str.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full =
      h.length <= 4
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const n = (k: number) => parseInt(full.slice(k, k + 2), 16) / 255;
    return [n(0), n(2), n(4), full.length >= 8 ? n(6) : 1];
  }
  const m = s.match(/[\d.]+/g);
  if (m && m.length >= 3) {
    const [r, g, b, a] = m.map(Number);
    return [r / 255, g / 255, b / 255, a == null ? 1 : a];
  }
  return [0.5, 0.5, 0.5, 1];
}

/**
 * The put wall label lifts clear of the call wall label when they meet (a narrow stage, or a turned
 * surface), so both sign labels stay readable (P-11). Two rects per placement; no loop.
 */
export function separateLevelLabels(labels: HTMLElement[]) {
  const call = labels.find((el) => el.dataset.key === 'call');
  const put = labels.find((el) => el.dataset.key === 'put');
  if (!call || !put) return;
  put.style.marginTop = '0px';
  const a = call.getBoundingClientRect();
  const b = put.getBoundingClientRect();
  const gap = 4;
  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (overlapX > -gap && overlapY > -gap) put.style.marginTop = `${-(b.bottom - a.top + gap)}px`;
}

// ---- the refined grid: 33 × 9 model points → 97 × 33 (bilinear; tenor spaced by √days) -------------
const NX = 97;
const NZ = 33;
const SQ = TENORS.map(Math.sqrt);
function sample(fx: number, fz: number): number {
  const i0 = Math.min(STRIKES.length - 2, Math.floor(fx));
  const tx = fx - i0;
  let j0 = 0;
  while (j0 < SQ.length - 2 && SQ[j0 + 1] < fz) j0++;
  const tz = (fz - SQ[j0]) / (SQ[j0 + 1] - SQ[j0]);
  const a = V[j0][i0] * (1 - tx) + V[j0][i0 + 1] * tx;
  const b = V[j0 + 1][i0] * (1 - tx) + V[j0 + 1][i0 + 1] * tx;
  return a * (1 - tz) + b * tz;
}
const GRID = (() => {
  const g = new Float32Array(NX * NZ);
  const sq0 = SQ[0];
  const sq1 = SQ[SQ.length - 1];
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++)
      g[j * NX + i] = sample(
        (i / (NX - 1)) * (STRIKES.length - 1),
        sq0 + (j / (NZ - 1)) * (sq1 - sq0),
      );
  return g;
})();
const gx = (i: number) => -1 + (2 * i) / (NX - 1);
const gz = (j: number) => 0.7 - (1.4 * j) / (NZ - 1);

const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in float aVal; uniform mat4 uMVP; uniform mat3 uRot; out vec3 vNor; out float vVal;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vNor = uRot * aNor; vVal = aVal; }`;
const FS = `#version 300 es
precision mediump float; in vec3 vNor; in float vVal; uniform vec3 uUp; uniform vec3 uDown; uniform vec3 uMid; uniform float uVmax; out vec4 o;
void main(){ float t = clamp(abs(vVal) / uVmax, 0.0, 1.0); vec3 c = mix(uMid, vVal >= 0.0 ? uUp : uDown, 0.25 + 0.75 * smoothstep(0.0, 1.0, t)); if (abs(vVal) < 0.04 * uVmax) c = uMid; vec3 n = normalize(gl_FrontFacing ? vNor : -vNor); float l = 0.62 + 0.38 * max(dot(n, normalize(vec3(-0.3, 0.9, 0.4))), 0.0); o = vec4(c * l, 1.0); }`;
const LVS = `#version 300 es
in vec3 aPos; uniform mat4 uMVP; void main(){ gl_Position = uMVP * vec4(aPos, 1.0); }`;
const LFS = `#version 300 es
precision mediump float; uniform vec4 uCol; out vec4 o; void main(){ o = uCol; }`;

interface Line {
  vao: WebGLVertexArrayObject;
  n: number;
}
interface Gpu {
  prog: WebGLProgram;
  lineProg: WebGLProgram;
  surface: WebGLVertexArrayObject;
  count: number;
  wires: Line;
  plane: Line;
  flip: Line;
  probeVao: WebGLVertexArrayObject;
  probeBuf: WebGLBuffer;
  u: Record<string, WebGLUniformLocation | null>;
}

function build(gl: WebGL2RenderingContext): Gpu {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error('createShader failed');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const link = (vs: string, fs: string) => {
    const p = gl.createProgram();
    if (!p) throw new Error('createProgram failed');
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  const prog = link(VS, FS);
  const lineProg = link(LVS, LFS);
  const G = GRID;
  const H = HSCALE;

  const pos = new Float32Array(NX * NZ * 3);
  const nor = new Float32Array(NX * NZ * 3);
  const val = new Float32Array(NX * NZ);
  const dx = 2 * (2 / (NX - 1));
  const dz = 2 * (1.4 / (NZ - 1));
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      pos[k * 3] = gx(i);
      pos[k * 3 + 1] = G[k] * H;
      pos[k * 3 + 2] = gz(j);
      val[k] = G[k];
      const yl = G[j * NX + Math.max(0, i - 1)] * H;
      const yr = G[j * NX + Math.min(NX - 1, i + 1)] * H;
      const yb = G[Math.max(0, j - 1) * NX + i] * H;
      const yf = G[Math.min(NZ - 1, j + 1) * NX + i] * H;
      const nx = -(yr - yl) / dx;
      const nz = (yf - yb) / dz;
      const L = Math.hypot(nx, 1, nz);
      nor[k * 3] = nx / L;
      nor[k * 3 + 1] = 1 / L;
      nor[k * 3 + 2] = nz / L;
    }
  const idx = new Uint16Array((NX - 1) * (NZ - 1) * 6);
  let n = 0;
  for (let j = 0; j < NZ - 1; j++)
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i;
      const b = a + 1;
      const c = a + NX;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], n);
      n += 6;
    }
  const surface = gl.createVertexArray();
  if (!surface) throw new Error('createVertexArray failed');
  gl.bindVertexArray(surface);
  const attr = (name: string, data: Float32Array, size: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  attr('aPos', pos, 3);
  attr('aNor', nor, 3);
  attr('aVal', val, 1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Lines: the surface wires, the zero plane, the flip contour (where dealers turn from short to long).
  const wires: number[] = [];
  const plane = [
    -1, 0, 0.7, 1, 0, 0.7, 1, 0, 0.7, 1, 0, -0.7, 1, 0, -0.7, -1, 0, -0.7, -1, 0, -0.7, -1, 0, 0.7,
  ];
  const flip: number[] = [];
  for (let j = 0; j < NZ; j += 4)
    for (let i = 0; i < NX - 1; i++)
      wires.push(
        gx(i),
        G[j * NX + i] * H + 0.003,
        gz(j),
        gx(i + 1),
        G[j * NX + i + 1] * H + 0.003,
        gz(j),
      );
  for (let i = 0; i < NX; i += 12)
    for (let j = 0; j < NZ - 1; j++)
      wires.push(
        gx(i),
        G[j * NX + i] * H + 0.003,
        gz(j),
        gx(i),
        G[(j + 1) * NX + i] * H + 0.003,
        gz(j + 1),
      );
  const crossAt = (j: number) => {
    for (let i = 0; i < NX - 1; i++) {
      const p0 = G[j * NX + i];
      const p1 = G[j * NX + i + 1];
      if (p0 < 0 !== p1 < 0) return gx(i) + (p0 / (p0 - p1)) * (gx(i + 1) - gx(i));
    }
    return null;
  };
  for (let j = 0; j < NZ - 1; j++) {
    const x0 = crossAt(j);
    const x1 = crossAt(j + 1);
    if (x0 != null && x1 != null) flip.push(x0, 0.004, gz(j), x1, 0.004, gz(j + 1));
  }
  const line = (data: number[]): Line => {
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(lineProg, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, n: data.length / 3 };
  };
  const probeVao = gl.createVertexArray();
  const probeBuf = gl.createBuffer();
  if (!probeVao || !probeBuf) throw new Error('probe buffers failed');
  gl.bindVertexArray(probeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, probeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(6), gl.DYNAMIC_DRAW);
  const pl = gl.getAttribLocation(lineProg, 'aPos');
  gl.enableVertexAttribArray(pl);
  gl.vertexAttribPointer(pl, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const u = {
    mvp: gl.getUniformLocation(prog, 'uMVP'),
    rot: gl.getUniformLocation(prog, 'uRot'),
    up: gl.getUniformLocation(prog, 'uUp'),
    down: gl.getUniformLocation(prog, 'uDown'),
    mid: gl.getUniformLocation(prog, 'uMid'),
    vmax: gl.getUniformLocation(prog, 'uVmax'),
    lmvp: gl.getUniformLocation(lineProg, 'uMVP'),
    lcol: gl.getUniformLocation(lineProg, 'uCol'),
  };
  return {
    prog,
    lineProg,
    surface,
    count: idx.length,
    wires: line(wires),
    plane: line(plane),
    flip: line(flip),
    probeVao,
    probeBuf,
    u,
  };
}

/** The camera's scale, fitted once per size over every angle it can turn to, so turning never clips. */
function fitScale(W: number, Hh: number): number {
  const ymin = -VMAX * HSCALE;
  const ymax = VMAX * HSCALE;
  let mu = 0;
  let mv = 0;
  for (let a = 0; a <= 8; a++)
    for (let b = 0; b <= 4; b++) {
      const R = rot(
        CAMERA.yaw0 + ((CAMERA.yaw1 - CAMERA.yaw0) * a) / 8,
        CAMERA.pitch0 + ((CAMERA.pitch1 - CAMERA.pitch0) * b) / 4,
      );
      for (const x of [-1, 1])
        for (const y of [ymin, ymax])
          for (const z of [-0.7, 0.7]) {
            mu = Math.max(mu, Math.abs(R[0] * x + R[1] * y + R[2] * z));
            mv = Math.max(mv, Math.abs(R[3] * x + R[4] * y + R[5] * z));
          }
    }
  return Math.min(((W / 2) * 0.94) / mu, ((Hh / 2) * 0.9) / mv);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Start the WebGL2 view, or return null (no WebGL2, or it failed): the static projection stays. */
export function createHeroGl(o: Options): HeroGl | null {
  const record = typeof window !== 'undefined' && window.__HERO_PERF__ === true;
  const perf: HeroPerf = {
    mode: 'pending',
    renders: 0,
    dpr: 1,
    ladder: [],
    cpu: [],
    intervals: [],
    lost: 0,
    restored: 0,
  };
  window.__heroPerf = perf;

  let gl: WebGL2RenderingContext | null = null;
  if (!window.__HERO_FORCE_FALLBACK__) {
    try {
      gl = o.canvas.getContext('webgl2', { antialias: true, alpha: true });
    } catch {
      gl = null;
    }
  }
  if (!gl) {
    perf.mode = 'fallback';
    return null;
  }
  const ctx = gl;
  let gpu: Gpu;
  try {
    gpu = build(ctx);
  } catch (err) {
    perf.mode = 'fallback';
    perf.error = String(err);
    return null;
  }

  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  let dprCap = coarse ? 1.5 : 2;
  let win: number[] = [];
  let colors = o.colors;
  let probe = o.probe;
  const cam = { yaw: CAMERA.yaw, pitch: CAMERA.pitch };
  let W = 0;
  let Hh = 0;
  let k = 1;
  let last = 0;
  let pending = 0;
  let lost = false;
  let disposed = false;
  let shown = false;
  let drag: { x: number; y: number; yaw: number; pitch: number; type: string } | null = null;

  const matrices = () => {
    const R = rot(cam.yaw, cam.pitch);
    const ax = k / (W / 2);
    const ay = k / (Hh / 2);
    const dz = 0.35;
    const mvp = new Float32Array([
      ax * R[0],
      ay * R[3],
      -dz * R[6],
      0,
      ax * R[1],
      ay * R[4],
      -dz * R[7],
      0,
      ax * R[2],
      ay * R[5],
      -dz * R[8],
      0,
      0,
      -0.08,
      0,
      1,
    ]);
    const rot3 = new Float32Array([R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);
    const project = (x: number, y: number, z: number): [number, number] => [
      ((1 + ax * (R[0] * x + R[1] * y + R[2] * z)) * W) / 2,
      ((1 - (ay * (R[3] * x + R[4] * y + R[5] * z) - 0.08)) * Hh) / 2,
    ];
    return { mvp, rot3, project };
  };

  const setSize = (dpr: number) => {
    perf.dpr = dpr;
    o.canvas.width = Math.max(1, Math.round(W * dpr));
    o.canvas.height = Math.max(1, Math.round(Hh * dpr));
  };

  const request = () => {
    if (!pending && !disposed) pending = requestAnimationFrame(draw);
  };

  function draw(ts: number) {
    pending = 0;
    if (lost || ctx.isContextLost() || W === 0 || Hh === 0) return;
    const t0 = performance.now();
    if (last && drag) {
      const iv = ts - last;
      if (record) perf.intervals.push(iv);
      if (iv < 100) {
        win.push(iv);
        if (win.length > 24) win.shift();
        if (win.length === 24 && dprCap > 1) {
          const sorted = win.slice().sort((a, b) => a - b);
          const p95 = sorted[22];
          // Dropped frames, not the display clock's jitter: on a 60 Hz display every interval is ~16.7 ms
          // and vsync jitter alone reaches 18 ms, so the bar is also 1.5× the median interval.
          if (p95 > Math.max(18, 1.5 * sorted[12])) {
            dprCap = dprCap > 1.5 ? 1.5 : 1;
            win = [];
            perf.ladder.push({ at: Math.round(ts), dpr: dprCap, p95: Number(p95.toFixed(1)) });
            setSize(Math.min(window.devicePixelRatio || 1, dprCap));
          }
        }
      }
    }
    last = drag ? ts : 0;

    const M = matrices();
    const g = ctx;
    g.viewport(0, 0, o.canvas.width, o.canvas.height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.useProgram(gpu.prog);
    g.uniformMatrix4fv(gpu.u.mvp, false, M.mvp);
    g.uniformMatrix3fv(gpu.u.rot, false, M.rot3);
    g.uniform3fv(gpu.u.up, colors.up.slice(0, 3));
    g.uniform3fv(gpu.u.down, colors.down.slice(0, 3));
    g.uniform3fv(gpu.u.mid, colors.mid.slice(0, 3));
    g.uniform1f(gpu.u.vmax, VMAX);
    g.bindVertexArray(gpu.surface);
    g.drawElements(g.TRIANGLES, gpu.count, g.UNSIGNED_SHORT, 0);

    g.useProgram(gpu.lineProg);
    g.uniformMatrix4fv(gpu.u.lmvp, false, M.mvp);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    g.uniform4fv(gpu.u.lcol, [colors.line[0], colors.line[1], colors.line[2], 0.55]);
    g.bindVertexArray(gpu.wires.vao);
    g.drawArrays(g.LINES, 0, gpu.wires.n);
    g.uniform4fv(gpu.u.lcol, [colors.steel[0], colors.steel[1], colors.steel[2], 0.9]);
    g.bindVertexArray(gpu.plane.vao);
    g.drawArrays(g.LINES, 0, gpu.plane.n);
    // The flip and the probe stem: phosphor, never amber (P-15).
    g.uniform4fv(gpu.u.lcol, colors.phosphor);
    g.bindVertexArray(gpu.flip.vao);
    g.drawArrays(g.LINES, 0, gpu.flip.n);
    const [px, py, pz] = probeWorld(probe);
    g.bindBuffer(g.ARRAY_BUFFER, gpu.probeBuf);
    g.bufferSubData(g.ARRAY_BUFFER, 0, new Float32Array([px, 0, pz, px, py, pz]));
    g.bindVertexArray(gpu.probeVao);
    g.drawArrays(g.LINES, 0, 2);
    g.bindVertexArray(null);
    g.disable(g.BLEND);

    for (const el of o.labels()) {
      const p = M.project(Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z));
      el.style.left = `${p[0]}px`;
      el.style.top = `${p[1]}px`;
    }
    separateLevelLabels(o.labels());
    const pp = M.project(px, py, pz);
    o.dot.style.left = `${pp[0]}px`;
    o.dot.style.top = `${pp[1]}px`;

    perf.renders++;
    if (record) perf.cpu.push(performance.now() - t0);
    // The projection gives way only once a WebGL frame exists to replace it.
    if (!shown) {
      shown = true;
      o.onContext(true);
    }
  }

  const resize = () => {
    const r = o.stage.getBoundingClientRect();
    W = r.width;
    Hh = r.height;
    if (W === 0 || Hh === 0) return;
    setSize(Math.min(window.devicePixelRatio || 1, dprCap));
    k = fitScale(W, Hh);
    request();
  };

  // ---- input: drag to turn (sideways only on touch, so a vertical swipe still scrolls) ----------
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, type: e.pointerType };
    last = 0;
    try {
      o.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic pointer can't be captured */
    }
  };
  const onMove = (e: PointerEvent) => {
    if (drag) {
      cam.yaw = clamp(drag.yaw + (e.clientX - drag.x) * 0.006, CAMERA.yaw0, CAMERA.yaw1);
      if (drag.type !== 'touch')
        cam.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, CAMERA.pitch0, CAMERA.pitch1);
      request();
      return;
    }
    if (e.pointerType !== 'mouse' || W === 0) return;
    // Hover reads the nearest model point within 30px.
    const M = matrices();
    const r = o.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = 1e9;
    let bi = 0;
    let bj = 0;
    for (let j = 0; j < TENORS.length; j++)
      for (let i = 0; i < STRIKES.length; i++) {
        const p = M.project(XS(STRIKES[i]), V[j][i] * HSCALE, ZT(TENORS[j]));
        const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2;
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    if (best < 900 && (bi !== probe.i || bj !== probe.j)) o.onProbe({ i: bi, j: bj });
  };
  const onUp = () => {
    drag = null;
    last = 0;
  };
  const onKey = (e: KeyboardEvent) => {
    if (!e.shiftKey && e.key !== 'Home') return;
    let used = true;
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))
      cam.yaw = clamp(cam.yaw + (e.key === 'ArrowLeft' ? -0.12 : 0.12), CAMERA.yaw0, CAMERA.yaw1);
    else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))
      cam.pitch = clamp(
        cam.pitch + (e.key === 'ArrowUp' ? 0.1 : -0.1),
        CAMERA.pitch0,
        CAMERA.pitch1,
      );
    else if (e.key === 'Home') {
      cam.yaw = CAMERA.yaw;
      cam.pitch = CAMERA.pitch;
    } else used = false;
    if (used) {
      e.preventDefault();
      request();
    }
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    shown = false;
    perf.lost++;
    if (pending) cancelAnimationFrame(pending);
    pending = 0;
    o.onContext(false);
  };
  const onRestored = () => {
    try {
      gpu = build(ctx);
    } catch (err) {
      perf.error = String(err);
      return;
    }
    lost = false;
    perf.restored++;
    request();
  };

  o.canvas.addEventListener('pointerdown', onDown);
  o.canvas.addEventListener('pointermove', onMove);
  o.canvas.addEventListener('pointerup', onUp);
  o.canvas.addEventListener('pointercancel', onUp);
  o.stage.addEventListener('keydown', onKey);
  o.canvas.addEventListener('webglcontextlost', onLost);
  o.canvas.addEventListener('webglcontextrestored', onRestored);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(o.stage);
  else window.addEventListener('resize', resize);

  perf.mode = 'webgl2';
  resize();

  return {
    setColors(c) {
      colors = c;
      request();
    },
    setProbe(p) {
      probe = p;
      request();
    },
    dispose() {
      disposed = true;
      if (pending) cancelAnimationFrame(pending);
      o.canvas.removeEventListener('pointerdown', onDown);
      o.canvas.removeEventListener('pointermove', onMove);
      o.canvas.removeEventListener('pointerup', onUp);
      o.canvas.removeEventListener('pointercancel', onUp);
      o.stage.removeEventListener('keydown', onKey);
      o.canvas.removeEventListener('webglcontextlost', onLost);
      o.canvas.removeEventListener('webglcontextrestored', onRestored);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
    },
  };
}
