/**
 * The demo's technical chart in the v5 system (canon P-8 to P-13): one chart frame, dashed with the
 * hatch stripe because the bars are sample data; neutral roles (close phosphor as the claim's series,
 * EMA 20 steel, EMA 50 chartContext2), each labelled at its line end; RSI 14 in its own panel under
 * the price, on the same time axis, with 30 and 70 dashed. The title states the finding from the
 * series itself (sampleTa.ts); "Show the numbers" lists the last ten bars.
 *
 * A probe picks a bar: pointer over either plot, or the arrow keys (Home, End) once the chart has
 * focus. The readings panel beside it follows the probed bar, so a reading still warming up says so.
 *
 * Design: design/src/screens/final/ticker-tech.mjs (sampleTaChart, sampleReadings).
 */
import { MONO } from '@/pages/research/ui';
import { useWidth } from '@/pages/research/useWidth';
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { extrasFor } from '@/shared/theme/tokens';
import type { IndicatorPoint, SampleBarsView } from '@convexa/api';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import type { KeyboardEvent, PointerEvent } from 'react';
import { sampleTaFinding } from './sampleTa';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-07" → "Oct 7". */
export const shortDate = (iso: string) =>
  `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
/** A mono character at 11px, for fitting labels before they're drawn. */
const CH = 6.7;

const valueOf = (p: IndicatorPoint | undefined) => (p && p.state === 'ready' ? p.value : null);

function niceStep(span: number, count = 4) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Labels at the line ends, nudged apart so none overlaps another (14 px apart at least). */
function spread<T extends { y: number }>(items: T[], gap = 14, top = 6, bottom = Infinity): T[] {
  const out = [...items].sort((a, b) => a.y - b.y).map((d) => ({ ...d }));
  for (let i = 1; i < out.length; i++)
    if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap;
  const over = out.length ? out[out.length - 1].y - bottom : 0;
  if (over > 0) for (const d of out) d.y -= over;
  for (let i = 0; i < out.length; i++) if (out[i].y < top + i * gap) out[i].y = top + i * gap;
  return out;
}

export function SampleTaChart({
  symbol,
  view,
  selected,
  onSelect,
  rsi: showRsi = true,
}: {
  symbol: string;
  view: SampleBarsView;
  selected: number;
  onSelect: (i: number) => void;
  /** The RSI 14 panel under the price. The sample research note draws the price alone
   *  (design ticker-note.mjs: `sampleTaChart({ rsi: false })`); the table keeps every column. */
  rsi?: boolean;
}) {
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const bars = view.bars;
  const n = bars.length;
  const closes = bars.map((b) => b.close);
  const e20 = view.indicators.ema20;
  const e50 = view.indicators.ema50;
  const rsi = view.indicators.rsi14;
  const last = bars[n - 1];
  const narrow = W > 0 && W < 480;

  const PL = 46;
  const PR = narrow ? 88 : 116;
  const PT = 14;
  const PH = narrow ? 180 : 220;
  const AX = 22;
  const H = PT + PH + AX;
  const RT = 10;
  const RH = 86;
  const RB = 10;
  const RSI_H = showRsi ? RT + RH + RB : 0;
  const plotW = Math.max(0, W - PL - PR);
  const slot = n ? plotW / n : 0;
  const x = (i: number) => PL + slot * (i + 0.5);

  const all = [
    ...closes,
    ...e20.map(valueOf).filter((v): v is number => v !== null),
    ...e50.map(valueOf).filter((v): v is number => v !== null),
  ];
  const step = niceStep(Math.max(...all) - Math.min(...all), narrow ? 3 : 4);
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const y = (v: number) => PT + ((hi - v) / (hi - lo || 1)) * PH;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  const ry = (v: number) => RT + ((100 - v) / 100) * RH;

  const path = (vals: (number | null)[], yy: (v: number) => number) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // Month starts on the time axis; the first bar names its day. Labels that would touch are dropped.
  const xTicks: { i: number; label: string }[] = [];
  bars.forEach((b, i) => {
    const label =
      i === 0
        ? shortDate(b.date)
        : b.date.slice(5, 7) !== bars[i - 1].date.slice(5, 7)
          ? MON[Number(b.date.slice(5, 7)) - 1]
          : null;
    if (!label) return;
    const prev = xTicks[xTicks.length - 1];
    if (prev && x(i) - x(prev.i) < (prev.label.length + label.length) * CH * 0.5 + 10) return;
    xTicks.push({ i, label });
  });

  const ends = spread(
    [
      {
        key: 'close',
        name: 'Close',
        value: last.close,
        v: last.close,
        color: roles.emph,
        weight: 600,
      },
      {
        key: 'e20',
        name: narrow ? '20' : 'EMA 20',
        value: valueOf(e20[n - 1]),
        v: valueOf(e20[n - 1]),
        color: roles.ctx,
        weight: 500,
      },
      {
        key: 'e50',
        name: narrow ? '50' : 'EMA 50',
        value: valueOf(e50[n - 1]),
        v: valueOf(e50[n - 1]),
        color: roles.ctx2,
        weight: 500,
      },
    ]
      .filter((d): d is typeof d & { value: number; v: number } => d.value !== null)
      .map((d) => ({ ...d, y: y(d.v) + 4 })),
    14,
    PT + 4,
    PT + PH + 4,
  );

  const sel = Math.min(Math.max(selected, 0), n - 1);
  const bar = bars[sel];
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!slot) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - PL) / slot - 0.5);
    onSelect(Math.min(Math.max(i, 0), n - 1));
  };
  const onKey = (e: KeyboardEvent) => {
    const next =
      e.key === 'ArrowLeft'
        ? sel - 1
        : e.key === 'ArrowRight'
          ? sel + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    onSelect(Math.min(Math.max(next, 0), n - 1));
  };

  const f2 = (v: number | null) => (v === null ? '—' : v.toFixed(2));
  const f1 = (v: number | null) => (v === null ? '—' : v.toFixed(1));
  const lastRsi = valueOf(rsi[n - 1]);
  const text = { fontSize: 11, fill: t.palette.text.secondary, style: MONO } as const;

  return (
    <ChartFrame
      finding={sampleTaFinding(symbol, closes, e20, e50, shortDate(last.date))}
      metric={`${symbol} daily close with EMA 20 and EMA 50`}
      sub={`${symbol} daily close · USD · ${n} synthetic daily bars to ${shortDate(last.date)}, ${last.date.slice(0, 4)} · EMA 20 and EMA 50 (EMA with SMA seed)${showRsi ? ' · below: RSI 14 (Wilder), 0–100' : ''}`}
      provenance="sample"
      tag={{ state: 'sample', detail: 'not recorded market history' }}
      height={H + RSI_H + 24}
      legend={
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 16px',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {[
            ['Close', roles.emph, 2.5],
            ['EMA 20', roles.ctx, 1.5],
            ['EMA 50 (from bar 50)', roles.ctx2, 1.5],
          ].map(([name, color, w]) => (
            <Box
              key={name as string}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ width: 14, height: w as number, bgcolor: color as string, borderRadius: 1 }}
              />
              {name}
            </Box>
          ))}
        </Box>
      }
      note="Indicators are descriptive context, not a forecast or a scored signal."
      source={{ text: 'Sample series · shaped like daily bars' }}
      asOf={`Scenario · ${shortDate(last.date)}, ${last.date.slice(0, 4)}`}
      table={{
        caption: `${symbol} sample bars, last 10, with indicators`,
        cols: ['Date', 'Close', 'EMA 20', 'EMA 50', 'RSI 14'],
        rows: bars.slice(-10).map((b, j) => {
          const i = n - 10 + j;
          return [
            shortDate(b.date),
            b.close.toFixed(2),
            f2(valueOf(e20[i])),
            f2(valueOf(e50[i])),
            f1(valueOf(rsi[i])),
          ];
        }),
      }}
      testId="chart-sample-ta"
    >
      <Box
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`${symbol} sample chart. Left and right arrows move between bars; Home and End jump to the first and last.`}
        onKeyDown={onKey}
        sx={(th) => ({
          minWidth: 0,
          borderRadius: '6px',
          touchAction: 'pan-y',
          '&:focus-visible': { outline: `2px solid ${extrasFor(th).textAmber}`, outlineOffset: 2 },
        })}
      >
        {W > 0 && (
          <>
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={`${symbol} sample daily close from $${closes[0].toFixed(2)} to $${last.close.toFixed(2)} over ${n} bars, with EMA 20 and EMA 50`}
              style={{ display: 'block' }}
              onPointerMove={pick}
              onPointerDown={pick}
            >
              {ticks.map((v, k) => (
                <g key={v}>
                  <line x1={PL} x2={PL + plotW} y1={y(v)} y2={y(v)} stroke={roles.grid} />
                  <text x={PL - 6} y={y(v) + 4} textAnchor="end" {...text}>
                    {k === ticks.length - 1
                      ? `$${v.toLocaleString('en-US')}`
                      : v.toLocaleString('en-US')}
                  </text>
                </g>
              ))}
              {xTicks.map(({ i, label }, k) => (
                <text
                  key={i}
                  x={k === 0 ? PL : x(i)}
                  y={PT + PH + 16}
                  textAnchor={k === 0 ? 'start' : 'middle'}
                  {...text}
                >
                  {label}
                </text>
              ))}
              <line
                x1={x(sel)}
                x2={x(sel)}
                y1={PT}
                y2={PT + PH}
                stroke={roles.edge}
                strokeDasharray="3 3"
              />
              <path
                d={path(e50.map(valueOf), y)}
                fill="none"
                stroke={roles.ctx2}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <path
                d={path(e20.map(valueOf), y)}
                fill="none"
                stroke={roles.ctx}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <path
                d={path(closes, y)}
                fill="none"
                stroke={roles.emph}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(sel)} cy={y(bar.close)} r={3.5} fill={roles.emph} />
              {ends.map((d) => (
                <text
                  key={d.key}
                  x={PL + plotW + 8}
                  y={d.y}
                  fontSize={11}
                  fill={d.key === 'close' ? t.palette.text.primary : t.palette.text.secondary}
                  fontWeight={d.weight}
                  style={MONO}
                >
                  {`${d.name} ${d.value.toFixed(2)}`}
                </text>
              ))}
            </svg>
            {showRsi && (
              <>
                <Box
                  component="span"
                  sx={{
                    ...MONO,
                    display: 'block',
                    mt: 0.5,
                    fontSize: 11,
                    color: 'text.secondary',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  RSI 14 · dashed at 30 and 70
                </Box>
                <svg
                  width={W}
                  height={RSI_H}
                  role="img"
                  aria-label={`RSI 14 ending at ${f1(lastRsi)}`}
                  style={{ display: 'block' }}
                  onPointerMove={pick}
                  onPointerDown={pick}
                >
                  <line x1={PL} x2={PL + plotW} y1={ry(100)} y2={ry(100)} stroke={roles.grid} />
                  <line x1={PL} x2={PL + plotW} y1={ry(0)} y2={ry(0)} stroke={roles.axis} />
                  {[30, 70].map((v) => (
                    <g key={v}>
                      <line
                        x1={PL}
                        x2={PL + plotW}
                        y1={ry(v)}
                        y2={ry(v)}
                        stroke={roles.edge}
                        strokeDasharray="4 3"
                      />
                      <text x={PL - 6} y={ry(v) + 4} textAnchor="end" {...text}>
                        {v}
                      </text>
                    </g>
                  ))}
                  <line
                    x1={x(sel)}
                    x2={x(sel)}
                    y1={RT}
                    y2={RT + RH}
                    stroke={roles.edge}
                    strokeDasharray="3 3"
                  />
                  <path
                    d={path(rsi.map(valueOf), ry)}
                    fill="none"
                    stroke={roles.emph}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  {lastRsi !== null && (
                    <text
                      x={PL + plotW + 8}
                      y={Math.min(Math.max(ry(lastRsi) + 4, RT + 8), RT + RH + 4)}
                      fontSize={11}
                      fill={t.palette.text.primary}
                      style={MONO}
                    >
                      {`${narrow ? 'RSI' : 'RSI 14'} ${lastRsi.toFixed(1)}`}
                    </text>
                  )}
                </svg>
              </>
            )}
          </>
        )}
      </Box>
      <Box
        component="p"
        aria-live="polite"
        sx={{ m: 0, fontSize: 12, color: 'text.secondary', ...MONO }}
      >
        {`${shortDate(bar.date)} · bar ${sel + 1} of ${n} · close $${bar.close.toFixed(2)} · EMA 20 ${f2(valueOf(e20[sel]))} · EMA 50 ${f2(valueOf(e50[sel]))}${showRsi ? ` · RSI 14 ${f1(valueOf(rsi[sel]))}` : ''}`}
      </Box>
    </ChartFrame>
  );
}
