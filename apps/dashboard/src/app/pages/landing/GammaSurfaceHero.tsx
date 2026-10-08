/**
 * GammaSurfaceHero — THE one hero instrument (canon `DESIGN_SYSTEM.md:52-53,113`; owner ruling
 * D-B = (A), 2026-09-10). A faithful inline-SVG port of `design/src/lib.mjs:383-425`'s
 * `gammaSurface()`: the dealer-gamma surface over strike × tenor, net gamma as height, drawn in
 * depth as an isometric wireframe, with the gamma-flip / call-wall / put-wall ridges.
 *
 * BUILD CONSTRAINT, not a device-conditional state (SPEC §2.3): prop-free, static from first paint,
 * geometry computed ONCE at module load from closed-form arithmetic. No WebGL, no Canvas2D, no rAF
 * paint loop, no lifecycle-effect hook, no new runtime dependency. The one real failure mode is a
 * JavaScript throw, and the route ErrorBoundary covers it (SPEC §5).
 *
 * THREE THINGS FROM THE DESIGN SOURCE MUST NOT TRAVEL HERE, and this is enforced, not remembered:
 *   - `class="beam"` on the spot marker (`lib.mjs:429`) — an ungated data-signal keyframe;
 *   - the `panel is-live` wrapper with its `chip live` + dot (`landing.mjs:51-52`);
 *   - the two mono figures painted INTO the SVG (`lib.mjs:430-431`, `mid 573.12` / `gamma flip
 *     568.50`) — mono is the traced register, and a specific mid painted into a marketing hero is an
 *     untraceable figure wearing it.
 * THIS SVG PAINTS NO TEXT AT ALL. Legend, eyebrow and the sample disclosure are DOM text beside the
 * picture (Landing.tsx), in the accessibility tree.
 *
 * The `<radialGradient>` below is the camelCase SVG ELEMENT — distinct from the hyphenated CSS
 * function of the same family that `landing-structure.spec.tsx` scans for and bans from the DOM
 * layer; a faithful port stays inside that ban without narrowing it. The CTA band's matching CSS
 * glow wash (`landing.mjs:116`) is DROPPED here too, not re-admitted.
 *
 * Tokens only — every colour is a palette slot resolved in `sx`. Every design-source CSS custom
 * property below carries its app-side slot, confirmed by exact hex match in BOTH colour schemes
 * (`shared/theme/tokens.ts`) — not by resemblance:
 *   `--up` (`lib.mjs` call-wall ridge)   → `palette.success.main`  (`up`/`down` are the app's
 *   `--down` (put-wall ridge)            → `palette.error.main`     RESERVED signed-direction slots,
 *                                           `tokens.ts:62-63`: "calls / +gamma" / "puts / -gamma").
 *   `--amber` (flip ridge + glow)        → `palette.primary.main` — dark `#F2A93B`/light `#C57F19`
 *                                           match `gammaAmber`/`amberDeep` byte-for-byte
 *                                           (`tokens.ts:37,43,60,73`); `tokens.ts:64`'s own comment
 *                                           records the flip semantic as "moved to primary". NOT
 *                                           `extras.textAmber` — that slot is documented
 *                                           TEXT-grade-only ("body/label-size (<18px) amber text",
 *                                           `tokens.ts:141-148`), diverges from `--amber` in light
 *                                           mode (`#8F5C0F` vs the source's `#C57F19`), and this SVG
 *                                           paints no text.
 *   `--signal` (spot marker fill)        → `palette.info.main` — dark `#5E8BC4`/light `#3D6DA5`
 *                                           match `signal`/`lightInfo` byte-for-byte
 *                                           (`tokens.ts:45,54`); also the app's own existing
 *                                           precedent (`shared/charts/structure-field/levelStrokes.ts`
 *                                           `resolveLevelPalette().mid === palette.info.main`).
 *                                           NOT `primary.main` — that is the amber brand fill; the
 *                                           spot must read as the distinct "live/signal" hue the
 *                                           call/put/flip ridges are not, the same way the ticker
 *                                           desk's own mid never borrows the flip's colour.
 * Every one of the above is passed as an `sx` CALLBACK — `(t) => t.palette.<slot>.main` — never a
 * bare dot-path string. MUI's `sx` only auto-resolves theme dot-paths (e.g. `'primary.main'`) for
 * the handful of props registered in `@mui/system`'s `defaultSxConfig` (`color`, `bgcolor`,
 * `backgroundColor`, `borderColor`, …); `fill` and `stroke` are not among them
 * (`styleFunctionSx.js`'s `setThemeValue`: `if (!options) { css[prop] = value; return; }`), so a
 * bare string there is emitted VERBATIM as invalid CSS (e.g. `fill:primary.main`) and silently
 * drops to the SVG initial value (`fill:black` / `stroke:none`) — an invisible wireframe and a
 * black spot dot, passing every DOM-presence assertion while failing to render. Confirmed against
 * this folder's own shipped precedent: `HeroCurve.tsx:88,95`
 * uses the callback form exclusively; there is no bare dot-path `fill`/`stroke` anywhere else in the
 * app. `GammaSurfaceHero.spec.tsx`'s "resolved paint, not a broken theme path" block proves this
 * both ways (mutation-tested: reintroducing a bare string turns the guard red).
 */
import Box from '@mui/material/Box';

// ---- the sample structure, from `design/src/data/index.mjs` (illustrative, frozen) -------------
const SPOT = 573.12;
const CALL_WALL = 580;
const PUT_WALL = 560;
const FLIP = 568.5;

const WIDTH = 720;
const HEIGHT = 440;
const ROWS = 9; // tenors
const COLS = 21; // strikes

const OX = WIDTH * 0.5;
const OY = HEIGHT * 0.6;
const SX = WIDTH / 34;
const SY = WIDTH / 62;
const SZ = 78;

/** Net dealer gamma as height — `lib.mjs:387-394`, unchanged. */
function z(i: number, j: number): number {
  const k = 550 + (j * 50) / (COLS - 1);
  const tenor = i / (ROWS - 1);
  const d = k - FLIP - tenor * 4;
  const call = Math.exp(-((k - CALL_WALL - tenor * 3) ** 2) / 34);
  const put = -Math.exp(-((k - PUT_WALL + tenor * 2) ** 2) / 44);
  return (d >= 0 ? call : put) * (1 - tenor * 0.55) + Math.sign(d) * 0.08;
}

/** The isometric projection — `lib.mjs:395-399`, unchanged. Three axes in ONE projection: strike
 *  across `j`, tenor across `i`, net dealer gamma as height through `z(i, j)`. */
function proj(i: number, j: number): [number, number] {
  const u = j - (COLS - 1) / 2;
  const v = i - (ROWS - 1) / 2;
  return [OX + (u - v) * SX * 0.72, OY + (u + v) * SY * 0.5 - z(i, j) * SZ];
}

interface Wire {
  d: string;
  opacity: number;
}

/** Computed ONCE at module load — never per render, never per frame. */
const WIRES: Wire[] = (() => {
  const out: Wire[] = [];
  for (let i = 0; i < ROWS; i++) {
    let d = '';
    for (let j = 0; j < COLS; j++) {
      const [x, y] = proj(i, j);
      d += `${j ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out.push({ d, opacity: Number((0.25 + (1 - i / ROWS) * 0.55).toFixed(2)) });
  }
  for (let j = 0; j < COLS; j++) {
    let d = '';
    for (let i = 0; i < ROWS; i++) {
      const [x, y] = proj(i, j);
      d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out.push({ d, opacity: 0.22 });
  }
  return out;
})();

/** A ridge at a target strike — `lib.mjs:411-421`, minus the drop-shadow filter. */
function ridgePath(kTarget: number): string {
  let d = '';
  for (let i = 0; i < ROWS; i++) {
    const j = ((kTarget - 550) / 50) * (COLS - 1);
    const j0 = Math.floor(j);
    const t = j - j0;
    const [x0, y0] = proj(i, j0);
    const [x1, y1] = proj(i, Math.min(COLS - 1, j0 + 1));
    d += `${i ? 'L' : 'M'} ${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t).toFixed(1)} `;
  }
  return d;
}

const RIDGE_FLIP = ridgePath(FLIP);
const RIDGE_CALL = ridgePath(CALL_WALL);
const RIDGE_PUT = ridgePath(PUT_WALL);
/** The spot marker position — a quiet dot, NO `beam` class, NO pulse, NO painted figure. */
const [SPOT_X, SPOT_Y] = proj(0, ((SPOT - 550) / 50) * (COLS - 1));

export function GammaSurfaceHero() {
  return (
    <Box
      component="svg"
      role="img"
      aria-label="Dealer gamma surface across strike and tenor"
      aria-describedby="gs-sample-caption"
      data-testid="gamma-surface-hero"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="gs-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Box
        component="rect"
        width={WIDTH}
        height={HEIGHT}
        fill="url(#gs-glow)"
        sx={{ color: (t) => t.palette.primary.main }}
      />
      {WIRES.map((w, n) => (
        <Box
          key={n}
          component="path"
          data-testid="gs-wire"
          d={w.d}
          fill="none"
          strokeWidth={1}
          strokeOpacity={w.opacity}
          sx={{ stroke: (t) => t.palette.text.secondary }}
        />
      ))}
      <Box
        component="path"
        data-testid="gs-ridge-put-wall"
        d={RIDGE_PUT}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        sx={{ stroke: (t) => t.palette.error.main }}
      />
      <Box
        component="path"
        data-testid="gs-ridge-call-wall"
        d={RIDGE_CALL}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        sx={{ stroke: (t) => t.palette.success.main }}
      />
      <Box
        component="path"
        data-testid="gs-ridge-flip"
        d={RIDGE_FLIP}
        fill="none"
        strokeWidth={2.25}
        strokeLinecap="round"
        sx={{ stroke: (t) => t.palette.primary.main }}
      />
      <Box
        component="circle"
        data-testid="gs-spot"
        cx={SPOT_X.toFixed(1)}
        cy={SPOT_Y.toFixed(1)}
        r={5}
        sx={{ fill: (t) => t.palette.info.main }}
      />
    </Box>
  );
}

export default GammaSurfaceHero;
