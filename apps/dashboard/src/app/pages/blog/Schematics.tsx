/**
 * The post's figures, redrawn neutral (P-9, P-11, amber spent): schematics of a gamma curve and of
 * the desk's two clocks, never a chart of any market. Sign is carried by position against a
 * labelled zero line and by the ±γ labels, not by hue. The SVG is drawn at its measured width so
 * its labels stay at 11px or more on a phone (P-13) instead of shrinking with a viewBox.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (levelsSchematic).
 */
import { chartRoles } from '@/shared/charts/frame';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Net dealer gamma across strikes (x 0–100, y −90…95): negative at the put wall, zero at the flip,
 *  positive at the call wall. The design's own points. */
const CURVE: readonly (readonly [number, number])[] = [
  [0, -40],
  [8, -55],
  [16, -70],
  [24, -62],
  [32, -40],
  [40, -12],
  [44, 0],
  [52, 30],
  [60, 58],
  [68, 72],
  [76, 64],
  [84, 44],
  [92, 26],
  [100, 18],
];
const PUT = 16;
const FLIP = 44;
const CALL = 68;

/** A Catmull-Rom path through the points, as cubic Béziers. */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function LevelsSchematic() {
  const theme = useTheme();
  const roles = chartRoles(theme);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(640);
  const narrow = width < 480;
  const height = narrow ? 200 : 240;
  const pl = 20;
  const pr = 20;
  const pt = 34;
  const pb = 30;
  const x = (v: number) => pl + (v / 100) * (width - pl - pr);
  const y = (v: number) => pt + ((95 - v) / (95 + 90)) * (height - pt - pb);
  const path = smoothPath(CURVE.map(([a, b]) => [x(a), y(b)] as const));
  const label = { fontSize: 12, fontFamily: theme.typography.fontFamily } as const;
  const minor = { fontSize: 11, fontFamily: theme.typography.fontFamily } as const;
  const level = (at: number, text: string, emph: boolean) => (
    <g key={text}>
      <line
        x1={x(at)}
        x2={x(at)}
        y1={y(95)}
        y2={y(-90)}
        stroke={emph ? roles.emph : roles.ctx}
        strokeWidth={emph ? 1.5 : 1.2}
        strokeDasharray="4 4"
      />
      <text
        x={x(at)}
        y={pt - 12}
        textAnchor="middle"
        fill={emph ? roles.emph : roles.ctx}
        fontWeight={600}
        style={label}
      >
        {text}
      </text>
    </g>
  );
  return (
    <Box ref={ref} sx={{ width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Schematic: a net dealer gamma curve across strikes, most negative at the put wall, crossing zero at the flip, most positive at the call wall."
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line x1={x(0)} x2={x(100)} y1={y(0)} y2={y(0)} stroke={roles.axis} strokeWidth={1} />
        {!narrow && (
          <text x={x(28)} y={y(0) - 6} fill={roles.ctx} style={minor}>
            zero
          </text>
        )}
        {level(PUT, 'Put wall · −γ', false)}
        {level(FLIP, 'Flip', true)}
        {level(CALL, 'Call wall · +γ', false)}
        <path d={path} fill="none" stroke={roles.emph} strokeWidth={2.5} strokeLinejoin="round" />
        <text x={x(0)} y={height - 8} fill={roles.ctx} style={minor}>
          lower strikes
        </text>
        <text x={x(100)} y={height - 8} textAnchor="end" fill={roles.ctx} style={minor}>
          higher strikes
        </text>
      </svg>
    </Box>
  );
}

function Panel({
  title,
  sub,
  chip,
  items,
}: {
  title: string;
  sub: string;
  chip?: string;
  items: string[];
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: 2,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box>
        <Box sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary' }}>{title}</Box>
        <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{sub}</Box>
      </Box>
      {chip && (
        <Box
          sx={{
            alignSelf: 'flex-start',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            px: 1,
            py: 0.25,
            fontSize: 12,
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {chip}
        </Box>
      )}
      <Box component="ul" sx={{ m: 0, pl: 2.25, fontSize: 13, color: 'text.secondary' }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </Box>
    </Box>
  );
}

export function TwoSpeedsSchematic() {
  return (
    <Box
      role="img"
      aria-label="Schematic: the live tape updates from a stream; structure refreshes on a slower poll and is stamped with its as-of time."
      sx={{ display: 'grid', gap: 1.5 }}
    >
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <Panel
          title="Live tape"
          sub="prices and marks · a stream, when healthy"
          items={[
            'can update every few seconds',
            'dims and says offline if the stream drops',
            'never pretends to be structure',
          ]}
        />
        <Panel
          title="Structure"
          sub="a slower poll · stamped as-of"
          chip="Structure as-of …"
          items={[
            'score · tier · flip · walls · GEX',
            'setups · score drivers',
            'stays readable when the tape is offline',
            'about every few minutes, sooner if a name just moved',
          ]}
        />
      </Box>
      <Box aria-hidden sx={{ fontSize: 13, color: 'text.secondary' }}>
        Mixing a live last with an unstamped wall invents urgency. Read the basis and the as-of
        stamp.
      </Box>
    </Box>
  );
}

const FIGURES: Record<string, () => ReactNode> = {
  'walls-and-flip': () => <LevelsSchematic />,
  'two-speed-desk': () => <TwoSpeedsSchematic />,
};

/** A post figure by its file name in docs/blog/img, framed and captioned; null for an unknown name. */
export function Schematic({ name, caption }: { name: string; caption: ReactNode }) {
  const draw = FIGURES[name];
  if (!draw) return null;
  return (
    <Box
      component="figure"
      data-testid={`schematic-${name}`}
      sx={{
        m: 0,
        my: 3,
        p: { xs: 1.5, sm: 2 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      {draw()}
      <Box
        component="figcaption"
        sx={{ mt: 1.5, fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}
      >
        {caption}
      </Box>
    </Box>
  );
}
