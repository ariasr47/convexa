/**
 * TermStructureCard — ATM implied vol by days to expiry (TD-08, design/src/screens/v5/families-desk.mjs
 * `termAfter`): a line with a dot per tenor on an absolute scale, each dot labelled with its IV as
 * text, and the state named in a finding line. It replaces amber cells shaded by each tenor's IV
 * within the sampled range: relative heat read as absolute, amber spent on data, and the hottest
 * cell's tenor label measured 1.44:1. Neutral roles only (canon P-9): the line is phosphor.
 *
 * Cross-tenor; ignores DTE filter; static bundle field, never offline-dimmed.
 */
import { chartRoles, TableTwin } from '@/shared/charts/frame';
import { typographyTokens } from '@/shared/theme/tokens';
import { Widget } from '@/shared/ui/Widget';
import { dataMode, type TermStructure } from '@convexa/api';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { sampleTermPoints, termTip, withStructureAge } from '../_kit/copy';

const MONO = typographyTokens.monoFontFamily;
const CH = 6.8;

interface Props {
  termStructure: TermStructure | null;
  structureAgeSeconds?: number | null;
}

/** Signed 1dp, U+2212 minus — this codebase's own convention (`_kit/copy.ts`'s `fmtSigned2`). */
const fmtSlope = (v: number): string => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;

const STATE_WORD = { contango: 'Contango', backwardation: 'Backwardation', flat: 'Flat' } as const;

/** What the line shows, in its own figures: the far tenor against the near one. It never names the
 *  state: the wire's state word is the authority (it renders on its own line below) and may differ
 *  from the direction the two IVs alone suggest, so a sentence joining them could contradict itself. */
export function termFinding(pts: TermStructure['points']): string {
  const near = pts[0];
  const far = pts[pts.length - 1];
  if (!near || !far || near === far) return 'ATM implied vol by tenor';
  const d = far.atm_iv - near.atm_iv;
  const rel =
    Math.abs(d) < 0.05
      ? `level with ${near.dte}-day`
      : `${Math.abs(d).toFixed(1)} points ${d > 0 ? 'above' : 'below'} ${near.dte}-day`;
  return `${far.dte}-day implied vol at ${far.atm_iv.toFixed(1)}% sits ${rel}`;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Plot geometry: the top pad, the inline plot height and the band under it for the day labels. */
const PT = 20;
const PH_INLINE = 110;
const PB = 22;

/** The line: days to expiry on x (to scale), IV on an absolute scale with round gridlines. */
function TermLine({ pts }: { pts: TermStructure['points'] }) {
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, { w: W, h: boxH }] = useSize<HTMLDivElement>();
  const ivs = pts.map((p) => p.atm_iv);
  const step = 2;
  let lo = Math.floor(Math.min(...ivs) / step) * step;
  let hi = Math.ceil(Math.max(...ivs) / step) * step;
  if (hi - lo < 4) {
    lo -= 2;
    hi += 2;
  }
  lo = Math.max(0, lo);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  // Fewer gridlines when the range is wide, so the axis never crowds.
  const shown = ticks.filter((_, i) => ticks.length <= 5 || i % 2 === 0 || i === ticks.length - 1);
  const maxDte = Math.max(...pts.map((p) => p.dte), 1);
  const PL = 44;
  const PR = 16;
  // The box is 152px inline. In the expand overlay its column has a definite height and the box
  // takes what is left of it, so the plot grows to fill the dialog instead of sitting 152px tall
  // above ~400px of nothing (fidelity DESK-09; the board's expanded term structure is ~375px).
  const PH = Math.max(PH_INLINE, Math.floor(boxH) - PT - PB);
  const H = PT + PH + PB;
  const x = (dte: number) => PL + (dte / maxDte) * Math.max(0, W - PL - PR);
  const y = (v: number) => PT + ((hi - v) / (hi - lo || 1)) * PH;
  // A dot's label above it, dropped when it would touch the one before (the table has them all).
  // A label's centre, kept inside the plot so the last tenor's figure never runs off the edge.
  const cx = (dte: number, text: string) => {
    const w = text.length * CH;
    return Math.min(Math.max(x(dte), w / 2), W - w / 2);
  };
  let lastRight = -Infinity;
  const labelled = pts.map((p) => {
    const w = `${p.atm_iv.toFixed(1)}%`.length * CH;
    const left = x(p.dte) - w / 2;
    if (left < lastRight + 4) return false;
    lastRight = left + w;
    return true;
  });
  let lastTick = -Infinity;
  const dteShown = pts.map((p) => {
    const w = `${p.dte}d`.length * CH;
    const left = x(p.dte) - w / 2;
    if (left < lastTick + 6) return false;
    lastTick = left + w;
    return true;
  });
  return (
    <Box
      ref={ref}
      data-testid="term-ribbon"
      // `flex: 1 1 0` with the inline height as its floor: inline (content-sized column) the box is
      // 152px; in a column with room to spare (the overlay) it takes the room.
      sx={{ flex: '1 1 0', minHeight: PT + PH_INLINE + PB, minWidth: 0 }}
    >
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`ATM implied vol by days to expiry: ${pts.map((p) => `${p.dte} days ${p.atm_iv.toFixed(1)}%`).join(', ')}`}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {shown.map((v, i) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke={roles.grid} />
              <text
                x={PL - 8}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fontFamily={MONO}
                fill={t.palette.text.secondary}
              >
                {i === shown.length - 1 ? `${v}%` : v}
              </text>
            </g>
          ))}
          <polyline
            points={pts.map((p) => `${x(p.dte)},${y(p.atm_iv)}`).join(' ')}
            fill="none"
            stroke={roles.emph}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <g key={p.expiration} data-testid="term-tenor-cell">
              <circle
                cx={x(p.dte)}
                cy={y(p.atm_iv)}
                r={4}
                fill={roles.emph}
                stroke={t.palette.background.paper}
                strokeWidth={2}
              />
              {labelled[i] && (
                <text
                  x={cx(p.dte, `${p.atm_iv.toFixed(1)}%`)}
                  y={y(p.atm_iv) - 9}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily={MONO}
                  fill={t.palette.text.primary}
                >
                  {p.atm_iv.toFixed(1)}%
                </text>
              )}
              {dteShown[i] && (
                <text
                  x={cx(p.dte, `${p.dte}d`)}
                  y={PT + PH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily={MONO}
                  fill={t.palette.text.secondary}
                >
                  {p.dte}d
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </Box>
  );
}

export const TermStructureCard = memo(function TermStructureCard({
  termStructure,
  structureAgeSeconds = null,
}: Props) {
  const termSampled = termStructure
    ? dataMode === 'demo'
      ? termStructure.points.toSorted((a, b) => a.dte - b.dte)
      : sampleTermPoints(termStructure.points)
    : [];
  const unavailable = termStructure == null || termSampled.length === 0;

  const stateLabel =
    unavailable || !termStructure || termStructure.points.length < 2 ? '—' : termStructure.state;
  const subtitle = withStructureAge(`ATM IV by tenor · ${stateLabel}`, structureAgeSeconds);

  return (
    <Widget
      id="term-structure"
      title="Term structure"
      subtitle={subtitle}
      info={termStructure ? termTip(termStructure) : undefined}
      // A flex column down to the line, so the line can take the overlay's spare height (DESK-09).
      bodySx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <Box
        data-testid="term-structure"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {unavailable || !termStructure ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Term structure unavailable this cycle.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
              {termFinding(termSampled)}
            </Typography>
            <TermLine pts={termSampled} />
            {/* State + slope — the wire's OWN `slope` field (`TermStructureWire.slope`), never
                re-derived FE-side. */}
            <Typography
              variant="caption"
              data-testid="term-ribbon-state"
              sx={{ display: 'block', color: 'text.secondary' }}
            >
              {STATE_WORD[termStructure.state]}
              {' · slope '}
              <Box component="span" sx={{ fontFamily: MONO }}>
                {fmtSlope(termStructure.slope)}
              </Box>
            </Typography>
            <TableTwin
              caption="ATM implied vol by expiration"
              cols={['Expiration', 'Days', 'ATM IV']}
              rows={termSampled.map((p) => [p.expiration, p.dte, `${p.atm_iv.toFixed(1)}%`])}
            />
          </>
        )}
      </Box>
    </Widget>
  );
});

export default TermStructureCard;
