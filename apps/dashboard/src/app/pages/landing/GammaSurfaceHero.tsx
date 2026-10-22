/**
 * GammaSurfaceHero — the landing's one hero instrument: the F1 dealer-gamma surface (canon P-15,
 * owner rulings 2026-10-14). Strike across, expiry deep, net dealer gamma up and down, turned by hand.
 *
 * Two renderings of one picture:
 * - The static projection, an inline SVG computed once at module load (`heroSurface.ts`). It is the
 *   designed fallback, not a loading screen: no WebGL2, a failed shader, a lost context, or before the
 *   script runs. Same labels, same readout, and the arrow keys still move the probe.
 * - The WebGL2 view (`heroGl.ts`): no dependency, render on demand (no frames while idle), no
 *   autoplay, a runtime pixel-ratio ladder. It replaces the projection after its first frame. It
 *   ships ON (`HERO_WEBGL_SHIPS` below, owner ruling 2026-10-15).
 *
 * P-11: sign reads by position (above or below the zero plane) and by the +γ / −γ labels, never by hue
 * alone. P-15: the flip is phosphor, not amber; production labels the panel "Illustrative sample".
 * P-3 / P-8: the frame is dashed with the hatch stripe, because the figure is a sample. Staging swaps
 * the tag for the demo's dashed chip (Env 2026-10-14).
 *
 * No request: the values are frozen and bundled with the page (AC-L17).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { LANDING_COPY } from './copy';
import {
  createHeroGl,
  parseColor,
  separateLevelLabels,
  type HeroColors,
  type HeroGl,
} from './heroGl';
import {
  LABELS,
  POSTER_FLIP,
  POSTER_H,
  POSTER_PLANE,
  POSTER_QUADS,
  POSTER_W,
  PROBE_HOME,
  posterPercent,
  probeWorld,
  readout,
  stepProbe,
  type Probe,
  type SurfaceLabel,
} from './heroSurface';
import { SAMPLE_MARK } from './samples';

const MONO = typographyTokens.monoFontFamily;
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const READOUT_ID = 'landing-hero-readout';
const CAPTION_ID = 'gs-sample-caption';

/**
 * P-15's shipping condition: p95 frame time ≤ 16.7 ms while turning, on a real GPU. Measured on the
 * demo build 2026-10-15 (Apple M1 Pro, ANGLE Metal, DPR 2, headed Chrome 155, tmp/hero-gpu-perf.mjs):
 * p95 18.4 and 18.4 ms, against an empty page's bare rAF p95 of 18.6 and 18.2 ms just before each run
 * (an earlier pair: 17.6 / 17.6 against 17.6; headless: 16.8 / 16.8). The Mac was driving a 60 Hz display,
 * so the interval is the display's clock, not the hero (p95 0.4–0.5 ms script and 0.1 ms GPU per frame,
 * 0 idle frames). The owner ruled on these numbers (2026-10-15, DESIGN_SYSTEM.md Amendments): the
 * condition is read as the hero's own work per frame, since the display caps the interval, so the WebGL
 * view ships. Turning it off is this one constant.
 */
const HERO_WEBGL_SHIPS = true;

type Mode = 'poster' | 'webgl' | 'fallback';

const LABEL_POS = new Map<string, { left: string; top: string }>(
  LABELS.map((l) => [l.key, posterPercent(...l.world)]),
);

function heroColors(t: Theme): HeroColors {
  const x = extrasFor(t);
  return {
    up: parseColor(t.palette.success.main),
    down: parseColor(t.palette.error.main),
    mid: parseColor(x.panelRaised),
    line: parseColor(x.lineStrong),
    phosphor: parseColor(t.palette.text.primary),
    steel: parseColor(t.palette.text.secondary),
  };
}

/** The static projection: every model cell as a polygon, back to front. */
function Poster({ hidden }: { hidden: boolean }) {
  const t = useTheme();
  const fill = useMemo(
    () => ({
      up: t.palette.success.main,
      down: t.palette.error.main,
      mid: extrasFor(t).panelRaised,
    }),
    [t],
  );
  const line = extrasFor(t).lineStrong;
  return (
    <Box
      component="svg"
      data-testid="gamma-surface-poster"
      viewBox={`0 0 ${POSTER_W} ${POSTER_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        visibility: hidden ? 'hidden' : 'visible',
      }}
    >
      <polygon
        points={POSTER_PLANE}
        fill="none"
        stroke={t.palette.text.secondary}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {POSTER_QUADS.map((q, n) => (
        <polygon
          key={n}
          points={q.points}
          fill={fill[q.sign]}
          fillOpacity={q.opacity}
          stroke={line}
          strokeWidth={0.6}
        />
      ))}
      {POSTER_FLIP.map(([x1, y1, x2, y2], n) => (
        <line
          key={n}
          data-testid="gs-flip"
          x1={x1.toFixed(1)}
          y1={y1.toFixed(1)}
          x2={x2.toFixed(1)}
          y2={y2.toFixed(1)}
          stroke={t.palette.text.primary}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </Box>
  );
}

function Label({ label }: { label: SurfaceLabel }) {
  const pos = LABEL_POS.get(label.key) ?? { left: '0', top: '0' };
  return (
    <span
      className={`gs-l gs-${label.kind}${label.minor ? ' minor' : ''}${label.above ? ' above' : ''}${label.end ? ' end' : ''}`}
      data-key={label.key}
      data-x={label.world[0].toFixed(4)}
      data-y={label.world[1].toFixed(4)}
      data-z={label.world[2].toFixed(4)}
      data-pl={pos.left}
      data-pt={pos.top}
      style={{ left: pos.left, top: pos.top }}
    >
      {label.text}
    </span>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-block',
        minWidth: 18,
        px: '4px',
        mx: '2px',
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '16px',
        textAlign: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: '4px',
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}

export function GammaSurfaceHero({ demo }: { demo: boolean }) {
  const theme = useTheme();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const glRef = useRef<HeroGl | null>(null);
  const [mode, setMode] = useState<Mode>('poster');
  const [probe, setProbe] = useState<Probe>(PROBE_HOME);
  const [announce, setAnnounce] = useState('');
  const colors = useMemo(() => heroColors(theme), [theme]);
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const probeRef = useRef(probe);
  probeRef.current = probe;

  // Start the WebGL2 view once; the static projection stays if it can't.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    const dot = dotRef.current;
    if (!stage || !canvas || !labels || !dot) return;
    if (!HERO_WEBGL_SHIPS && !window.__HERO_WEBGL__) {
      setMode('fallback');
      return;
    }
    const labelEls = Array.from(labels.querySelectorAll<HTMLElement>('.gs-l'));
    const gl = createHeroGl({
      stage,
      canvas,
      labels: () => labelEls,
      dot,
      colors: colorsRef.current,
      probe: probeRef.current,
      onProbe: setProbe,
      onContext: (ok) => {
        if (!ok) {
          // A lost context hands the stage back to the projection, labels and all.
          for (const el of labelEls) {
            el.style.left = el.dataset.pl ?? '';
            el.style.top = el.dataset.pt ?? '';
          }
        }
        setMode(ok ? 'webgl' : 'fallback');
      },
    });
    if (!gl) {
      setMode('fallback');
      return;
    }
    glRef.current = gl;
    return () => {
      gl.dispose();
      glRef.current = null;
    };
  }, []);

  useEffect(() => {
    glRef.current?.setColors(colors);
  }, [colors]);

  // The probe dot: placed by the WebGL frame in that mode, by the projection otherwise.
  useLayoutEffect(() => {
    glRef.current?.setProbe(probe);
    if (mode === 'webgl') return;
    const dot = dotRef.current;
    if (!dot) return;
    const p = posterPercent(...probeWorld(probe));
    dot.style.left = p.left;
    dot.style.top = p.top;
  }, [probe, mode]);

  // The projection's labels scale with the stage, so the level labels are kept apart on each resize
  // (the WebGL view does this after every frame).
  useLayoutEffect(() => {
    if (mode === 'webgl') return;
    const stage = stageRef.current;
    const labels = labelsRef.current;
    if (!stage || !labels) return;
    const els = Array.from(labels.querySelectorAll<HTMLElement>('.gs-l'));
    const run = () => separateLevelLabels(els);
    run();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(run);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [mode]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return; // Shift+arrows turn (heroGl)
    const next = stepProbe(probe, e.key);
    if (!next) return;
    e.preventDefault();
    setProbe(next);
    setAnnounce(readout(next));
  };

  return (
    <Box
      component="figure"
      data-testid="landing-hero-panel"
      data-mode={mode}
      data-provenance="sample"
      aria-label={LANDING_COPY.hero.surfaceName}
      sx={(t) => ({
        position: 'relative',
        m: 0,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        minWidth: 0,
        bgcolor: 'background.paper',
        borderRadius: '12px',
        // P-3 / P-8: a sample's frame is dashed, with the hatch stripe (ChartFrame's treatment).
        border: `1px dashed ${extrasFor(t).textTertiary}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 8,
          borderRadius: '11px 11px 0 0',
          pointerEvents: 'none',
          background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
            t.palette.text.secondary,
            0.28,
          )} 6px 12px)`,
        },
      })}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
        <Box
          component="span"
          sx={(t) => ({
            flex: '1 1 auto',
            fontFamily: SANS,
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: extrasFor(t).textAmber,
          })}
        >
          {LANDING_COPY.hero.panelEyebrow}
        </Box>
        {!demo && <DataStateTag state="sample" word={LANDING_COPY.sample.tag} />}
      </Box>

      <Box
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-roledescription="3D chart"
        // Only the WebGL view turns; the static projection (before the script, without WebGL2, or
        // after a lost context) offers the probe alone, so its name promises only that (W1-69).
        aria-label={`${LANDING_COPY.hero.surfaceName}. ${
          mode === 'webgl' ? LANDING_COPY.hero.surfaceKeys : LANDING_COPY.hero.surfaceKeysStatic
        }`}
        aria-describedby={`${READOUT_ID} ${CAPTION_ID}`}
        data-testid="gamma-surface-hero"
        onKeyDown={onKeyDown}
        sx={(t) => ({
          position: 'relative',
          width: '100%',
          aspectRatio: '1000 / 560',
          borderRadius: '10px',
          bgcolor: extrasFor(t).well,
          overflow: 'hidden',
          // Only the WebGL view takes a sideways drag; pinch-zoom always stays the reader's, so the
          // 11px labels can be enlarged on a phone (W1-71). The projection takes no gesture at all.
          touchAction: mode === 'webgl' ? 'pan-y pinch-zoom' : 'auto',
          containerType: 'inline-size',
          outline: 'none',
          '&:focus-visible': { outline: `2px solid ${extrasFor(t).textAmber}`, outlineOffset: 4 },
          '& .gs-l': {
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            whiteSpace: 'nowrap',
            fontSize: 11,
            lineHeight: 1,
            color: 'text.secondary',
          },
          '& .gs-tick': { fontFamily: MONO, fontWeight: 500 },
          '& .gs-axis': { fontFamily: SANS, fontWeight: 600 },
          '& .gs-level': {
            fontFamily: SANS,
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'text.primary',
            bgcolor: extrasFor(t).well,
            px: '5px',
            py: '2px',
            borderRadius: '4px',
          },
          // Clear of the 10px probe dot at its home point, at any width.
          '& .gs-l.above': { transform: 'translate(-50%, calc(-100% - 9px))' },
          '& .gs-l.end': { transform: 'translate(-100%, -50%)' },
          '@container (max-width: 520px)': { '& .minor': { display: 'none' } },
        })}
      >
        <Poster hidden={mode === 'webgl'} />
        <Box
          component="canvas"
          ref={canvasRef}
          aria-hidden="true"
          data-testid="gamma-surface-canvas"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: mode === 'webgl' ? 'block' : 'none',
            cursor: 'grab',
            touchAction: 'pan-y pinch-zoom',
            '&:active': { cursor: 'grabbing' },
          }}
        />
        <Box
          ref={labelsRef}
          aria-hidden="true"
          sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {LABELS.map((l) => (
            <Label key={l.key} label={l} />
          ))}
          <Box
            component="span"
            ref={dotRef}
            sx={(t) => ({
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'text.primary',
              boxShadow: `0 0 0 2px ${extrasFor(t).well}`,
            })}
          />
        </Box>
      </Box>

      <Box
        id={READOUT_ID}
        data-testid="gamma-surface-readout"
        sx={{
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.4,
          color: 'text.primary',
          overflowWrap: 'anywhere',
        }}
      >
        {readout(probe)}
      </Box>
      <Box
        component="span"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {announce}
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 12, lineHeight: 1.6, color: 'text.secondary' }}>
        {mode === 'fallback' ? (
          LANDING_COPY.hero.helpStatic
        ) : (
          <>
            {LANDING_COPY.hero.helpTurn} · <Kbd>←</Kbd>
            <Kbd>→</Kbd> strikes · <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> expiries · <Kbd>Home</Kbd> resets
          </>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 12px',
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        {demo ? (
          <>
            <Box
              component="span"
              id={CAPTION_ID}
              sx={(t) => ({
                display: 'inline-block',
                minHeight: 24,
                px: 1.25,
                py: '4px',
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: 1.35,
                borderRadius: '12px',
                border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
              })}
            >
              {LANDING_COPY.sample.demoChip}
            </Box>
            <span>{LANDING_COPY.hero.stagingNote}</span>
          </>
        ) : (
          <span id={CAPTION_ID}>{SAMPLE_MARK}</span>
        )}
      </Box>
    </Box>
  );
}

export default GammaSurfaceHero;
