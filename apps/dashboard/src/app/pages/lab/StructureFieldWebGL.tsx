/**
 * Structure Field — WebGL2 dual-clock instrument (lab comparison twin of Canvas2D).
 *
 * GPU path:
 *  - 1D GEX texture → fragment heat field + warped force lines + flip well + scan
 *  - LINE_STRIP curve ribbon (triangle strip from CPU)
 *  - Point-sprite particles (hedging pressure metaphor)
 *  - Vertical level / mid beams as thin quads
 * Overlay Canvas2D only for text (WebGL has no text API) — same honesty captions.
 *
 * Brand literals via structureFieldShared (tokens.ts). Honors prefers-reduced-motion.
 */
import type { StructureFieldModel } from '@/shared/charts/structure-field';
import { SF, fmtM, gexAt, hexRgb, relAge, structureKey } from '@/shared/charts/structure-field';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';

export interface StructureFieldWebGLProps {
  model: StructureFieldModel;
  height?: number;
  className?: string;
}

const VS_FULL = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS_FIELD = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_gex;
uniform float u_sampleCount;
uniform vec2 u_res;
uniform vec4 u_pad; // l,r,t,b in px
uniform float u_time;
uniform float u_reduce;
uniform float u_putU;
uniform float u_callU;
uniform float u_flipU;
uniform float u_spotU;
uniform float u_midU;
uniform float u_hasMid;
uniform float u_live;
uniform vec3 u_ink;
uniform vec3 u_panel;
uniform vec3 u_green;
uniform vec3 u_red;
uniform vec3 u_amber;
uniform vec3 u_signal;
uniform vec3 u_steel;

float sampleGex(float u) {
  float x = (u * (u_sampleCount - 1.0) + 0.5) / u_sampleCount;
  return texture(u_gex, vec2(x, 0.5)).r * 2.0 - 1.0; // stored 0..1 → -1..1
}

void main() {
  vec2 px = v_uv * u_res;
  float l = u_pad.x, r = u_pad.y, t = u_pad.z, b = u_pad.w;
  float plotW = u_res.x - l - r;
  float plotH = u_res.y - t - b;

  // Background vignette
  vec2 c = vec2(0.5, 0.45);
  float vd = length((v_uv - c) * vec2(1.0, 1.15));
  vec3 col = mix(u_panel, u_ink, smoothstep(0.15, 0.95, vd));

  // Outside plot → just bg
  if (px.x < l || px.x > l + plotW || px.y < t || px.y > t + plotH) {
    outColor = vec4(col, 1.0);
    return;
  }

  float u = (px.x - l) / plotW;
  float v = (px.y - t) / plotH; // 0 top → 1 bottom
  float g = sampleGex(u);
  float y0 = 0.5;
  // curve y in plot-normalized space (0 top, 1 bottom): positive g goes up
  float yCurve = y0 - g * 0.42;

  // Heat density toward zero line
  float dens = pow(abs(g), 0.85);
  float inField = g >= 0.0
    ? step(yCurve, v) * step(v, y0)
    : step(y0, v) * step(v, yCurve);
  vec3 heat = g >= 0.0 ? u_green : u_red;
  col = mix(col, heat, inField * dens * 0.32);

  // Soft wall blooms
  float putB = exp(-pow((u - u_putU) / 0.06, 2.0)) * 0.18;
  float callB = exp(-pow((u - u_callU) / 0.06, 2.0)) * 0.16;
  float flipB = exp(-pow((u - u_flipU) / 0.05, 2.0)) * (0.10 + (1.0 - u_reduce) * 0.08 * (0.5 + 0.5 * sin(u_time * 1.1)));
  col = mix(col, u_red, putB);
  col = mix(col, u_green, callB);
  col = mix(col, u_amber, flipB);

  // Warped force lines (GPU)
  for (int i = 0; i < 7; i++) {
    float base = (float(i) + 0.5) / 7.0;
    float amp = (0.55 + 0.45 * sin(u_time * 0.7 + float(i))) * mix(1.0, 0.35, u_reduce);
    float bend = g * 0.12 * amp;
    float lineV = base - bend;
    float d = abs(v - lineV);
    float a = (0.04 + 0.07 * dens) * smoothstep(0.012, 0.0, d);
    col = mix(col, heat, a);
  }

  // Zero line dash-ish
  float zd = abs(v - y0);
  float dash = step(0.5, fract(u * 40.0));
  col = mix(col, u_steel, smoothstep(0.004, 0.0, zd) * 0.35 * dash);

  // Level beams
  float beam = 0.0;
  beam = max(beam, smoothstep(0.004, 0.0, abs(u - u_putU)) * 0.55);
  col = mix(col, u_red, smoothstep(0.004, 0.0, abs(u - u_putU)) * 0.7);
  col = mix(col, u_green, smoothstep(0.004, 0.0, abs(u - u_callU)) * 0.7);
  col = mix(col, u_steel, smoothstep(0.003, 0.0, abs(u - u_spotU)) * 0.45);
  // Flip thicker amber
  float fd = abs(u - u_flipU);
  col = mix(col, u_amber, smoothstep(0.006, 0.0, fd) * 0.9);

  // Scan sweep
  if (u_reduce < 0.5) {
    float sweep = fract(u_time * 0.08);
    float sd = abs(u - sweep);
    col += vec3(0.04) * smoothstep(0.04, 0.0, sd);
  }

  // Live mid beam
  if (u_hasMid > 0.5) {
    float pulse = u_live > 0.5 && u_reduce < 0.5
      ? 0.55 + 0.45 * sin(u_time * 3.1)
      : 0.35;
    float md = abs(u - u_midU);
    col = mix(col, u_signal, smoothstep(0.01, 0.0, md) * (0.25 + pulse * 0.35));
    // bead at zero
    float bx = abs(u - u_midU);
    float by = abs(v - y0);
    float bead = smoothstep(0.012, 0.0, length(vec2(bx * 1.4, by)));
    col = mix(col, u_signal, bead * (0.6 + pulse * 0.4));
  }

  // Soft grain
  if (u_reduce < 0.5) {
    float n = fract(sin(dot(px + u_time * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 0.025;
  }

  outColor = vec4(col, 1.0);
}`;

const VS_COLOR = `#version 300 es
in vec2 a_pos;
in vec4 a_color;
uniform vec2 u_res;
out vec4 v_color;
void main() {
  vec2 ndc = vec2(
    (a_pos.x / u_res.x) * 2.0 - 1.0,
    1.0 - (a_pos.y / u_res.y) * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_color = a_color;
}`;

const FS_COLOR = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = v_color;
}`;

const VS_POINT = `#version 300 es
in vec2 a_pos;
in vec4 a_color;
in float a_size;
uniform vec2 u_res;
out vec4 v_color;
void main() {
  vec2 ndc = vec2(
    (a_pos.x / u_res.x) * 2.0 - 1.0,
    1.0 - (a_pos.y / u_res.y) * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`;

const FS_POINT = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d) * v_color.a;
  outColor = vec4(v_color.rgb, a);
}`;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rw: number,
  rh: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, r);
  ctx.arcTo(x + rw, y + rh, x, y + rh, r);
  ctx.arcTo(x, y + rh, x, y, r);
  ctx.arcTo(x, y, x + rw, y, r);
  ctx.closePath();
}

function requireGL<T>(value: T | null, what: string): T {
  if (value == null) throw new Error(what);
  return value;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = requireGL(gl.createShader(type), 'createShader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'shader compile failed';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = requireGL(gl.createProgram(), 'createProgram');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || 'program link failed';
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  return prog;
}

interface Particle {
  u: number;
  v: number;
  speed: number;
  sign: 1 | -1;
  size: number;
  life: number;
}

export function StructureFieldWebGL({ model, height = 520, className }: StructureFieldWebGLProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [hoverReadout, setHoverReadout] = useState<string | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = glRef.current;
    const overlay = overlayRef.current;
    if (!wrap || !canvas || !overlay) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setGlError('WebGL2 unavailable in this browser — switch to Canvas2D.');
      return;
    }
    setGlError(null);

    const octx = overlay.getContext('2d');
    if (!octx) return;

    let fieldProg: WebGLProgram;
    let colorProg: WebGLProgram;
    let pointProg: WebGLProgram;
    try {
      fieldProg = link(gl, VS_FULL, FS_FIELD);
      colorProg = link(gl, VS_COLOR, FS_COLOR);
      pointProg = link(gl, VS_POINT, FS_POINT);
    } catch (e) {
      setGlError(e instanceof Error ? e.message : 'WebGL shader compile failed');
      return;
    }

    const quadBuf = requireGL(gl.createBuffer(), 'createBuffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const colorBuf = requireGL(gl.createBuffer(), 'createBuffer');
    const pointBuf = requireGL(gl.createBuffer(), 'createBuffer');
    const gexTex = requireGL(gl.createTexture(), 'createTexture');
    gl.bindTexture(gl.TEXTURE_2D, gexTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const loc = {
      field: {
        a_pos: gl.getAttribLocation(fieldProg, 'a_pos'),
        u_gex: gl.getUniformLocation(fieldProg, 'u_gex'),
        u_sampleCount: gl.getUniformLocation(fieldProg, 'u_sampleCount'),
        u_res: gl.getUniformLocation(fieldProg, 'u_res'),
        u_pad: gl.getUniformLocation(fieldProg, 'u_pad'),
        u_time: gl.getUniformLocation(fieldProg, 'u_time'),
        u_reduce: gl.getUniformLocation(fieldProg, 'u_reduce'),
        u_putU: gl.getUniformLocation(fieldProg, 'u_putU'),
        u_callU: gl.getUniformLocation(fieldProg, 'u_callU'),
        u_flipU: gl.getUniformLocation(fieldProg, 'u_flipU'),
        u_spotU: gl.getUniformLocation(fieldProg, 'u_spotU'),
        u_midU: gl.getUniformLocation(fieldProg, 'u_midU'),
        u_hasMid: gl.getUniformLocation(fieldProg, 'u_hasMid'),
        u_live: gl.getUniformLocation(fieldProg, 'u_live'),
        u_ink: gl.getUniformLocation(fieldProg, 'u_ink'),
        u_panel: gl.getUniformLocation(fieldProg, 'u_panel'),
        u_green: gl.getUniformLocation(fieldProg, 'u_green'),
        u_red: gl.getUniformLocation(fieldProg, 'u_red'),
        u_amber: gl.getUniformLocation(fieldProg, 'u_amber'),
        u_signal: gl.getUniformLocation(fieldProg, 'u_signal'),
        u_steel: gl.getUniformLocation(fieldProg, 'u_steel'),
      },
      color: {
        a_pos: gl.getAttribLocation(colorProg, 'a_pos'),
        a_color: gl.getAttribLocation(colorProg, 'a_color'),
        u_res: gl.getUniformLocation(colorProg, 'u_res'),
      },
      point: {
        a_pos: gl.getAttribLocation(pointProg, 'a_pos'),
        a_color: gl.getAttribLocation(pointProg, 'a_color'),
        a_size: gl.getAttribLocation(pointProg, 'a_size'),
        u_res: gl.getUniformLocation(pointProg, 'u_res'),
      },
    };

    const ink = hexRgb(SF.ink);
    const panel = hexRgb(SF.panel);
    const green = hexRgb(SF.green);
    const red = hexRgb(SF.red);
    const amber = hexRgb(SF.amber);
    const signal = hexRgb(SF.signal);
    const steel = hexRgb(SF.steel);
    const phosphor = hexRgb(SF.phosphor);

    const pad = { l: 56, r: 20, t: 40, b: 48 };
    const particles: Particle[] = [];
    let spawnAcc = 0;
    let lastT = performance.now();
    let running = true;
    let raf = 0;
    let dpr = 1;
    let w = 320;
    let h = height;
    let lastStructKey = '';
    let maxAbs = 1;

    const layout = () => {
      w = Math.max(320, wrap.clientWidth);
      h = height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      overlay.width = Math.floor(w * dpr);
      overlay.height = Math.floor(h * dpr);
      overlay.style.width = `${w}px`;
      overlay.style.height = `${h}px`;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const uploadGex = (samples: StructureFieldModel['samples']) => {
      maxAbs = 1;
      for (const s of samples) maxAbs = Math.max(maxAbs, Math.abs(s.netGex));
      const n = samples.length;
      const data = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        const norm = (samples[i].netGex / maxAbs) * 0.5 + 0.5; // 0..1
        const v = Math.max(0, Math.min(255, Math.round(norm * 255)));
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, gexTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    };

    const xOf = (k: number, minK: number, maxK: number, plotW: number) =>
      pad.l + ((k - minK) / (maxK - minK || 1)) * plotW;
    const yOf = (g: number, plotH: number) => pad.t + plotH / 2 - (g / maxAbs) * (plotH * 0.42);

    /** Triangle strip ribbon along curve */
    const buildCurveRibbon = (
      samples: StructureFieldModel['samples'],
      minK: number,
      maxK: number,
      plotW: number,
      plotH: number,
      halfW: number,
      rgba: [number, number, number, number],
    ): Float32Array => {
      // each vertex: x,y,r,g,b,a  — 2 verts per sample
      const out = new Float32Array(samples.length * 2 * 6);
      let o = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const x = xOf(s.strike, minK, maxK, plotW);
        const y = yOf(s.netGex, plotH);
        let tx = 0;
        let ty = -1;
        if (i < samples.length - 1) {
          const n = samples[i + 1];
          const x2 = xOf(n.strike, minK, maxK, plotW);
          const y2 = yOf(n.netGex, plotH);
          const dx = x2 - x;
          const dy = y2 - y;
          const len = Math.hypot(dx, dy) || 1;
          tx = -dy / len;
          ty = dx / len;
        } else if (i > 0) {
          const p = samples[i - 1];
          const x0 = xOf(p.strike, minK, maxK, plotW);
          const y0 = yOf(p.netGex, plotH);
          const dx = x - x0;
          const dy = y - y0;
          const len = Math.hypot(dx, dy) || 1;
          tx = -dy / len;
          ty = dx / len;
        }
        // top
        out[o++] = x + tx * halfW;
        out[o++] = y + ty * halfW;
        out[o++] = rgba[0];
        out[o++] = rgba[1];
        out[o++] = rgba[2];
        out[o++] = rgba[3];
        // bottom
        out[o++] = x - tx * halfW;
        out[o++] = y - ty * halfW;
        out[o++] = rgba[0];
        out[o++] = rgba[1];
        out[o++] = rgba[2];
        out[o++] = rgba[3];
      }
      return out;
    };

    const drawColorMesh = (data: Float32Array, mode: number, count: number) => {
      gl.useProgram(colorProg);
      gl.uniform2f(loc.color.u_res, w, h);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.color.a_pos);
      gl.vertexAttribPointer(loc.color.a_pos, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(loc.color.a_color);
      gl.vertexAttribPointer(loc.color.a_color, 4, gl.FLOAT, false, 24, 8);
      gl.drawArrays(mode, 0, count);
    };

    layout();

    const paint = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const m = modelRef.current;
      const samples = m.samples;
      const reduce = reducedRef.current;

      if (samples.length < 2) {
        gl.clearColor(ink[0], ink[1], ink[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        raf = requestAnimationFrame(paint);
        return;
      }

      const key = structureKey(m);
      if (key !== lastStructKey) {
        lastStructKey = key;
        uploadGex(samples);
        particles.length = 0;
      }

      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const minK = samples[0].strike;
      const maxK = samples[samples.length - 1].strike;
      const span = maxK - minK || 1;
      const toU = (k: number) => (k - minK) / span;
      const y0 = pad.t + plotH / 2;

      // --- Field pass ---
      gl.disable(gl.BLEND);
      gl.useProgram(fieldProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gexTex);
      gl.uniform1i(loc.field.u_gex, 0);
      gl.uniform1f(loc.field.u_sampleCount, samples.length);
      gl.uniform2f(loc.field.u_res, w, h);
      gl.uniform4f(loc.field.u_pad, pad.l, pad.r, pad.t, pad.b);
      gl.uniform1f(loc.field.u_time, now / 1000);
      gl.uniform1f(loc.field.u_reduce, reduce ? 1 : 0);
      gl.uniform1f(loc.field.u_putU, toU(m.putWall));
      gl.uniform1f(loc.field.u_callU, toU(m.callWall));
      gl.uniform1f(loc.field.u_flipU, toU(m.gammaFlip));
      gl.uniform1f(loc.field.u_spotU, toU(m.spot));
      const mid = m.liveMid;
      const hasMid = mid != null && Number.isFinite(mid);
      gl.uniform1f(loc.field.u_hasMid, hasMid ? 1 : 0);
      gl.uniform1f(loc.field.u_midU, hasMid ? toU(mid) : 0);
      gl.uniform1f(loc.field.u_live, m.live ? 1 : 0);
      gl.uniform3fv(loc.field.u_ink, ink);
      gl.uniform3fv(loc.field.u_panel, panel);
      gl.uniform3fv(loc.field.u_green, green);
      gl.uniform3fv(loc.field.u_red, red);
      gl.uniform3fv(loc.field.u_amber, amber);
      gl.uniform3fv(loc.field.u_signal, signal);
      gl.uniform3fv(loc.field.u_steel, steel);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(loc.field.a_pos);
      gl.vertexAttribPointer(loc.field.a_pos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // --- Curve ribbon (glow + core via two strips) ---
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const glow = buildCurveRibbon(samples, minK, maxK, plotW, plotH, 5.5, [
        signal[0],
        signal[1],
        signal[2],
        0.22,
      ]);
      drawColorMesh(glow, gl.TRIANGLE_STRIP, samples.length * 2);
      const core = buildCurveRibbon(samples, minK, maxK, plotW, plotH, 1.6, [
        phosphor[0],
        phosphor[1],
        phosphor[2],
        0.85,
      ]);
      drawColorMesh(core, gl.TRIANGLE_STRIP, samples.length * 2);

      // --- Particles ---
      if (!reduce) {
        spawnAcc += dt * 40;
        while (spawnAcc >= 1 && particles.length < 160) {
          spawnAcc -= 1;
          let bestU = Math.random();
          let bestAbs = 0;
          for (let t = 0; t < 5; t++) {
            const uu = Math.random();
            const ga = Math.abs(gexAt(samples, minK + uu * span));
            if (ga > bestAbs) {
              bestAbs = ga;
              bestU = uu;
            }
          }
          const g = gexAt(samples, minK + bestU * span);
          if (Math.abs(g) < maxAbs * 0.08) continue;
          particles.push({
            u: bestU,
            v: 0.02 + Math.random() * 0.1,
            speed: 0.2 + Math.random() * 0.5 * (Math.abs(g) / maxAbs),
            sign: g >= 0 ? 1 : -1,
            size: 3 + Math.random() * 5,
            life: 0.7 + Math.random() * 1.0,
          });
        }

        const flipU = toU(m.gammaFlip);
        // each point: x,y,r,g,b,a,size = 7 floats
        const pdata = new Float32Array(particles.length * 7);
        let pi = 0;
        let pcount = 0;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.v += p.speed * dt;
          p.life -= dt * 0.35;
          p.u += (flipU - p.u) * 0.04 * dt;
          if (p.v >= 1 || p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          const k = minK + p.u * span;
          const g = gexAt(samples, k);
          const yCurve = yOf(g, plotH);
          const x = xOf(k, minK, maxK, plotW);
          const y = yCurve + (y0 - yCurve) * p.v;
          const alpha = Math.max(0, Math.min(1, p.life)) * (1 - p.v * 0.55);
          const rgb = p.sign > 0 ? green : red;
          pdata[pi++] = x;
          pdata[pi++] = y;
          pdata[pi++] = rgb[0];
          pdata[pi++] = rgb[1];
          pdata[pi++] = rgb[2];
          pdata[pi++] = 0.2 + alpha * 0.75;
          pdata[pi++] = p.size * (1 - p.v * 0.35) * dpr;
          pcount++;
        }

        if (pcount > 0) {
          gl.useProgram(pointProg);
          gl.uniform2f(loc.point.u_res, w, h);
          gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
          gl.bufferData(gl.ARRAY_BUFFER, pdata.subarray(0, pcount * 7), gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(loc.point.a_pos);
          gl.vertexAttribPointer(loc.point.a_pos, 2, gl.FLOAT, false, 28, 0);
          gl.enableVertexAttribArray(loc.point.a_color);
          gl.vertexAttribPointer(loc.point.a_color, 4, gl.FLOAT, false, 28, 8);
          gl.enableVertexAttribArray(loc.point.a_size);
          gl.vertexAttribPointer(loc.point.a_size, 1, gl.FLOAT, false, 28, 24);
          gl.drawArrays(gl.POINTS, 0, pcount);
        }
      }

      // --- Hover magnet + crosshair (CPU color mesh) ---
      const hover = hoverRef.current;
      if (hover) {
        const kx = minK + ((hover.x - pad.l) / plotW) * span;
        let best = samples[0];
        let bestD = Infinity;
        for (const s of samples) {
          const d = Math.abs(s.strike - kx);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        const hx = xOf(best.strike, minK, maxK, plotW);
        const hy = yOf(best.netGex, plotH);
        const intensity = Math.min(1, Math.abs(best.netGex) / maxAbs);
        const hc = best.netGex >= 0 ? green : red;

        // crosshair lines as thin quads
        const lines: number[] = [];
        const pushQuad = (
          x0: number,
          y0q: number,
          x1: number,
          y1: number,
          th: number,
          r: number,
          g: number,
          b: number,
          a: number,
        ) => {
          const dx = x1 - x0;
          const dy = y1 - y0q;
          const len = Math.hypot(dx, dy) || 1;
          const nx = (-dy / len) * th;
          const ny = (dx / len) * th;
          const verts = [
            [x0 + nx, y0q + ny],
            [x0 - nx, y0q - ny],
            [x1 + nx, y1 + ny],
            [x0 - nx, y0q - ny],
            [x1 - nx, y1 - ny],
            [x1 + nx, y1 + ny],
          ];
          for (const [x, y] of verts) {
            lines.push(x, y, r, g, b, a);
          }
        };
        pushQuad(hx, pad.t, hx, pad.t + plotH, 0.6, phosphor[0], phosphor[1], phosphor[2], 0.25);
        pushQuad(pad.l, hy, pad.l + plotW, hy, 0.6, phosphor[0], phosphor[1], phosphor[2], 0.25);

        // probe disc (approx as multi-quad ring — just a filled soft circle via many points)
        // Use color mesh disc as triangle fan-ish: 16 segments
        const disc: number[] = [];
        const segs = 20;
        const rad = 5;
        for (let i = 0; i < segs; i++) {
          const a0 = (i / segs) * Math.PI * 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2;
          disc.push(
            hx,
            hy,
            phosphor[0],
            phosphor[1],
            phosphor[2],
            0.95,
            hx + Math.cos(a0) * rad,
            hy + Math.sin(a0) * rad,
            phosphor[0],
            phosphor[1],
            phosphor[2],
            0.95,
            hx + Math.cos(a1) * rad,
            hy + Math.sin(a1) * rad,
            phosphor[0],
            phosphor[1],
            phosphor[2],
            0.95,
          );
        }
        // strength bar
        const barW = 52;
        const barH = 4;
        const bx = Math.min(Math.max(hx - barW / 2, pad.l), pad.l + plotW - barW);
        const by = Math.min(hy + 14, pad.t + plotH - 8);
        const bar: number[] = [
          bx,
          by,
          0.1,
          0.14,
          0.2,
          0.9,
          bx + barW,
          by,
          0.1,
          0.14,
          0.2,
          0.9,
          bx,
          by + barH,
          0.1,
          0.14,
          0.2,
          0.9,
          bx + barW,
          by,
          0.1,
          0.14,
          0.2,
          0.9,
          bx + barW,
          by + barH,
          0.1,
          0.14,
          0.2,
          0.9,
          bx,
          by + barH,
          0.1,
          0.14,
          0.2,
          0.9,
          bx,
          by,
          hc[0],
          hc[1],
          hc[2],
          1,
          bx + barW * intensity,
          by,
          hc[0],
          hc[1],
          hc[2],
          1,
          bx,
          by + barH,
          hc[0],
          hc[1],
          hc[2],
          1,
          bx + barW * intensity,
          by,
          hc[0],
          hc[1],
          hc[2],
          1,
          bx + barW * intensity,
          by + barH,
          hc[0],
          hc[1],
          hc[2],
          1,
          bx,
          by + barH,
          hc[0],
          hc[1],
          hc[2],
          1,
        ];

        const hoverMesh = new Float32Array([...lines, ...disc, ...bar]);
        drawColorMesh(hoverMesh, gl.TRIANGLES, hoverMesh.length / 6);
      }

      // --- Overlay text (2D) ---
      octx.clearRect(0, 0, w, h);
      octx.fillStyle = SF.phosphor;
      octx.font = '700 13px "IBM Plex Sans", system-ui, sans-serif';
      octx.fillText(`${m.symbol} · dealer field`, pad.l, 22);
      octx.fillStyle = SF.steel;
      octx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
      const age = relAge(m.asOfSec, now);
      const src = m.source === 'demo' ? 'synthetic demo' : 'live structure snap';
      octx.fillText(`${age}  ·  ${src}  ·  WebGL2  ·  probe strikes`, pad.l + 168, 22);

      octx.fillStyle = SF.steel;
      octx.fillText(`$${minK.toFixed(0)}`, pad.l, h - 16);
      octx.fillText(`$${maxK.toFixed(0)}`, pad.l + plotW - 40, h - 16);
      octx.fillText('+ dealer γ', pad.l + 4, pad.t + 14);
      octx.fillText('− dealer γ', pad.l + 4, pad.t + plotH - 8);

      octx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
      const labelAt = (k: number, color: string, text: string, yOff: number) => {
        const x = xOf(k, minK, maxK, plotW);
        octx.fillStyle = color;
        octx.fillText(text, Math.min(x + 6, pad.l + plotW - 78), pad.t + yOff);
      };
      labelAt(m.putWall, SF.red, `put $${m.putWall.toFixed(0)}`, 14);
      labelAt(m.callWall, SF.green, `call $${m.callWall.toFixed(0)}`, 14);
      labelAt(m.gammaFlip, SF.amber, 'flip', 28);
      labelAt(m.spot, SF.steel, `spot $${m.spot.toFixed(1)}`, 42);

      if (hasMid && mid != null) {
        const x = xOf(mid, minK, maxK, plotW);
        octx.fillStyle = SF.phosphor;
        octx.font = '600 11px "IBM Plex Sans", system-ui, sans-serif';
        octx.fillText(
          m.live ? `live $${mid.toFixed(2)}` : `mid $${mid.toFixed(2)}`,
          Math.min(x + 8, pad.l + plotW - 88),
          pad.t + plotH - 10,
        );
      }

      // pill
      const pill = m.live ? 'TAPE LIVE' : 'TAPE OFF';
      octx.font = '700 10px "IBM Plex Sans", system-ui, sans-serif';
      const pw = octx.measureText(pill).width + 14;
      octx.fillStyle = m.live ? 'rgba(94,139,196,0.28)' : 'rgba(224,122,63,0.22)';
      roundRect(octx, w - pad.r - pw - 8, 8, pw, 18, 9);
      octx.fill();
      octx.fillStyle = m.live ? SF.signal : SF.burnt;
      octx.fillText(pill, w - pad.r - pw, 21);

      // WebGL badge
      octx.font = '700 10px "IBM Plex Sans", system-ui, sans-serif';
      const badge = 'WEBGL2';
      const bw = octx.measureText(badge).width + 12;
      octx.fillStyle = 'rgba(242,169,59,0.2)';
      roundRect(octx, w - pad.r - pw - bw - 16, 8, bw, 18, 9);
      octx.fill();
      octx.fillStyle = SF.amber;
      octx.fillText(badge, w - pad.r - pw - bw - 10, 21);

      if (hover) {
        const kx = minK + ((hover.x - pad.l) / plotW) * span;
        let best = samples[0];
        let bestD = Infinity;
        for (const s of samples) {
          const d = Math.abs(s.strike - kx);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        const hx = xOf(best.strike, minK, maxK, plotW);
        const hy = yOf(best.netGex, plotH);
        const label = `$${best.strike.toFixed(0)}  ·  net GEX ${fmtM(best.netGex)}`;
        octx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
        const tw = octx.measureText(label).width + 16;
        const rx = Math.min(Math.max(hx - tw / 2, pad.l), pad.l + plotW - tw);
        const ry = Math.max(pad.t + 8, hy - 34);
        octx.fillStyle = SF.raised;
        octx.strokeStyle = 'rgba(138,155,180,0.4)';
        roundRect(octx, rx, ry, tw, 22, 6);
        octx.fill();
        octx.stroke();
        octx.fillStyle = SF.phosphor;
        octx.fillText(label, rx + 8, ry + 15);
      }

      raf = requestAnimationFrame(paint);
    };

    const onResize = () => layout();
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hoverRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const m = modelRef.current;
      if (m.samples.length < 2) return;
      const minK = m.samples[0].strike;
      const maxK = m.samples[m.samples.length - 1].strike;
      const plotW = w - pad.l - pad.r;
      const kx = minK + ((hoverRef.current.x - pad.l) / plotW) * (maxK - minK);
      let best = m.samples[0];
      let bestD = Infinity;
      for (const s of m.samples) {
        const d = Math.abs(s.strike - kx);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      setHoverReadout(`$${best.strike.toFixed(0)} · ${fmtM(best.netGex)}`);
    };
    const onLeave = () => {
      hoverRef.current = null;
      setHoverReadout(null);
    };

    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    // overlay is on top — receive pointer there too
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerleave', onLeave);
      gl.deleteProgram(fieldProg);
      gl.deleteProgram(colorProg);
      gl.deleteProgram(pointProg);
      gl.deleteBuffer(quadBuf);
      gl.deleteBuffer(colorBuf);
      gl.deleteBuffer(pointBuf);
      gl.deleteTexture(gexTex);
    };
  }, [
    height,
    model.samples,
    model.spot,
    model.callWall,
    model.putWall,
    model.gammaFlip,
    model.symbol,
  ]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  return (
    <div ref={wrapRef} className={className} style={{ width: '100%', position: 'relative' }}>
      {glError && (
        <div
          data-testid="structure-field-webgl-error"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: SF.ink,
            color: SF.burnt,
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            fontSize: 14,
            padding: 24,
            textAlign: 'center',
            borderRadius: '12px',
          }}
        >
          {glError}
        </div>
      )}
      <canvas
        ref={glRef}
        data-testid="structure-field-webgl"
        style={{
          display: 'block',
          width: '100%',
          height,
          borderRadius: '12px',
          border: '1px solid rgba(138,155,180,0.28)',
          boxShadow: '0 0 0 1px rgba(11,15,23,0.6), 0 18px 48px -24px rgba(0,0,0,0.65)',
        }}
      />
      <canvas
        ref={overlayRef}
        data-testid="structure-field-webgl-overlay"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height,
          borderRadius: '12px',
          cursor: 'crosshair',
          touchAction: 'none',
          pointerEvents: 'auto',
        }}
      />
      {hoverReadout && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: 12,
            color: SF.phosphor,
            background: SF.raised,
            border: '1px solid rgba(138,155,180,0.3)',
            borderRadius: '8px',
            padding: '6px 10px',
            pointerEvents: 'none',
          }}
        >
          {hoverReadout}
        </div>
      )}
    </div>
  );
}

export default StructureFieldWebGL;
