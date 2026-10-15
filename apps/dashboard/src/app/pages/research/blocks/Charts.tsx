/**
 * A note's chart blocks on the v5 chart frame (canon P-8 to P-13; design/src/screens/v5/
 * families-research.mjs, RN-01 to RN-05): a column chart, a proportion, comparison bars, a bridge and a
 * unit chart. Notes render on production only (the demo keeps its authored sample note), and their
 * figures are the owner's from primary filings, so every frame is solid and says which note it is from.
 *
 * Each title states what the figures show, worked out from the block itself, never more than they say;
 * the author's caption is the subtitle; "Show the numbers" lists every value, so the plot can label
 * only the ones that matter. Charts lay themselves out from their own width, not the viewport, and no
 * text falls under 11px (P-13): a narrow axis drops labels instead of shrinking them.
 *
 * Company facts are neutral (canon 2026-10-13): the latest or emphasised figure is phosphor, context
 * steel, and a sign is carried by position and by its printed − or +, never by a hue (P-11).
 */
import { ChartFrame, chartRoles, type TableTwinData } from '@/shared/charts/frame';
import Box from '@mui/material/Box';
import { useTheme, type Theme } from '@mui/material/styles';
import { useId, type ReactNode } from 'react';
import type { NoteBlock } from '../types';
import { MONO } from '../ui';
import { useWidth } from '../useWidth';
import { captionUnit, fmt, fmtIn, guideRange, type Unit } from './chartText';
import { useNoteFrame } from './noteFrame';

type Of<T extends NoteBlock['type']> = Extract<NoteBlock, { type: T }>;

/** A mono character at 11px, a little generous, for fitting labels before they're drawn. */
const CH = 6.8;
const LINE = 14;

/** A round step for about four gridlines. */
function niceStep(span: number) {
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/** Gridline values from a low to a high, on a round step, always including zero. */
function scaleOf(values: number[]) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const step = niceStep(hi - lo || 1);
  const top = hi > 0 ? Math.ceil(hi / step - 1e-9) * step : 0;
  const bottom = lo < 0 ? Math.floor(lo / step + 1e-9) * step : 0;
  const ticks: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return { top, bottom, ticks };
}

/** A bar with a rounded data end: the top of a positive bar, the bottom of a negative one. */
function barPath(x: number, w: number, y0: number, y1: number) {
  const up = y1 <= y0;
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return `M${x},${y0}h${w}`;
  return up
    ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`
    : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

/** A label split into at most two lines at the space nearest its middle, when one line won't fit. */
function twoLines(label: string, room: number): string[] {
  if (label.length * CH <= room || !label.includes(' ')) return [label];
  const mid = label.length / 2;
  let at = -1;
  for (let i = 0; i < label.length; i++)
    if (label[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  return [label.slice(0, at), label.slice(at + 1)];
}

function Swatch({ sx }: { sx: (t: Theme) => object }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={(t) => ({
        width: 10,
        height: 10,
        borderRadius: '2px',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...sx(t),
      })}
    />
  );
}

function Legend({ items }: { items: [ReactNode, (t: Theme) => object][] }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        fontSize: 12,
        color: 'text.secondary',
      }}
    >
      {items.map(([name, sx], i) => (
        <Box
          key={i}
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
        >
          <Swatch sx={sx} />
          {name}
        </Box>
      ))}
    </Box>
  );
}

const hatch = (t: Theme) =>
  `repeating-linear-gradient(135deg, ${chartRoles(t).ctx} 0 2px, transparent 2px 5px)`;

// =================================================================================================
// RN-01 · Column chart
// =================================================================================================

const KIND_WORD = { '': 'reported', approx: 'approximate', guide: 'guidance' } as const;

/** What the bars show, in their own figures: where the series went and the guidance after it. */
export function columnFinding(block: Of<'chart'>, unit: Unit | null): string {
  const bars = block.bars;
  const at = block.latest >= 0 ? block.latest : bars.length - 1;
  const first = bars[0];
  const last = bars[at];
  const shown = (b: (typeof bars)[number]) => b.shown || fmtIn(b.value, unit);
  let head: string;
  if (at === 0) head = `${last.label}: ${shown(last)}`;
  else if (unit?.suf === '%') {
    const d = last.value - first.value;
    head =
      Math.abs(d) < 0.05
        ? `${last.label}: ${shown(last)}, level with ${first.label}`
        : `${last.label}: ${shown(last)}, ${d > 0 ? 'up' : 'down'} ${fmt(Math.abs(d))} points from ${first.label}`;
  } else if (first.value > 0 && last.value > 0) {
    const pct = (last.value / first.value - 1) * 100;
    head =
      Math.abs(pct) < 0.5
        ? `${last.label}: ${shown(last)}, level with ${first.label}`
        : `${last.label}: ${shown(last)}, ${pct > 0 ? 'up' : 'down'} ${Math.round(Math.abs(pct))}% from ${first.label}`;
  } else head = `${last.label}: ${shown(last)}, from ${shown(first)} in ${first.label}`;
  const guide = bars.slice(at + 1).find((b) => b.kind === 'guide');
  return guide ? `${head}; ${guide.label}: ${guide.shown || fmtIn(guide.value, unit)}` : head;
}

export function ChartBlock({ block }: { block: Of<'chart'> }) {
  const frame = useNoteFrame('chart');
  const t = useTheme();
  const roles = chartRoles(t);
  const hatchId = useId();
  const [ref, W] = useWidth<HTMLDivElement>();
  const unit = captionUnit(block.caption);
  const bars = block.bars;
  const n = bars.length;
  const anchor = block.latest >= 0 ? block.latest : n - 1;
  const ranges = bars.map((b) =>
    b.kind === 'guide' && b.shown ? guideRange(b.shown, b.value) : null,
  );
  const { top, bottom, ticks } = scaleOf(
    bars.flatMap((b, i) => [b.value, ranges[i]?.lo ?? b.value, ranges[i]?.hi ?? b.value]),
  );
  // The unit rides on the tick furthest from zero, so the axis says what its numbers are.
  const unitTick = top > 0 ? top : bottom;
  const tickText = (v: number) => (v === unitTick && v !== 0 ? fmtIn(v, unit) : fmt(v));
  const gutter = Math.max(...ticks.map((v) => tickText(v).length)) * CH + 10;

  const PT = 22;
  const PH = 190;
  const NEG = bottom < 0 ? 16 : 0;
  const plotW = Math.max(0, W - gutter - 4);
  const slot = n ? plotW / n : 0;
  const x = (i: number) => gutter + slot * (i + 0.5);
  const y = (v: number) => PT + ((top - v) / (top - bottom || 1)) * PH;
  const barW = Math.min(24, Math.max(6, slot * 0.6));

  // Axis labels: one or two lines; when neighbours still collide, every k-th keeps its label,
  // counted from the latest so it is always named (P-13: drop labels, never shrink them).
  const xLines = bars.map((b) => twoLines(b.label, slot - 6));
  const xWidth = xLines.map((ls) => Math.max(...ls.map((l) => l.length)) * CH);
  let k = 1;
  const kept = (step: number) =>
    bars.map((_, i) => i).filter((i) => Math.abs(i - anchor) % step === 0);
  while (
    W > 0 &&
    k < n &&
    kept(k).some(
      (i, j, ks) => j > 0 && x(i) - x(ks[j - 1]) < (xWidth[i] + xWidth[ks[j - 1]]) / 2 + 6,
    )
  )
    k++;
  const xKept = new Set(kept(k));
  const AX = Math.max(...xLines.filter((_, i) => xKept.has(i)).map((l) => l.length), 1) * LINE + 8;
  const H = PT + PH + NEG + AX;

  // Value labels on the latest, the guidance, the extremes and the first; the table has the rest.
  const textOf = (i: number) => bars[i].shown || fmtIn(bars[i].value, unit);
  const plain = bars.map((_, i) => i).filter((i) => bars[i].kind !== 'guide');
  const hi = plain.reduce((a, i) => (bars[i].value > bars[a].value ? i : a), plain[0] ?? 0);
  const lo = plain.reduce((a, i) => (bars[i].value < bars[a].value ? i : a), plain[0] ?? 0);
  const order = [
    anchor,
    ...bars.map((_, i) => i).filter((i) => bars[i].kind === 'guide'),
    hi,
    lo,
    0,
  ].filter((i, j, a) => i >= 0 && i < n && a.indexOf(i) === j);
  type Placed = { i: number; cx: number; cy: number; w: number };
  const placed: Placed[] = [];
  if (W > 0)
    for (const i of order) {
      const b = bars[i];
      const w = textOf(i).length * CH;
      const end = ranges[i] ? (b.value >= 0 ? ranges[i].hi : ranges[i].lo) : b.value;
      const cy = b.value >= 0 ? y(end) - 6 : y(end) + 14;
      // Kept inside the plot: never over the axis numbers in the gutter, never past the right edge.
      const cx = Math.min(Math.max(x(i), gutter + w / 2), W - w / 2);
      const clash = placed.some(
        (p) => Math.abs(p.cx - cx) < (p.w + w) / 2 + 6 && Math.abs(p.cy - cy) < LINE,
      );
      if (!clash) placed.push({ i, cx, cy, w });
    }

  const has = (kind: '' | 'approx' | 'guide') => bars.some((b) => b.kind === kind);
  const legend: [ReactNode, (t: Theme) => object][] = [
    ['Latest reported', (th) => ({ bgcolor: chartRoles(th).emph })],
    ['Reported', (th) => ({ bgcolor: chartRoles(th).ctx })],
  ];
  if (has('approx')) legend.push(['Approximate', (th) => ({ background: hatch(th) })]);
  if (has('guide'))
    legend.push([
      ranges.some(Boolean) ? 'Guidance midpoint, its range as a whisker' : 'Guidance',
      (th) => ({ border: `1.5px dashed ${chartRoles(th).ctx}` }),
    ]);

  const table: TableTwinData = {
    caption: block.caption,
    cols: ['Period', unit ? `Value (${unit.pre}${unit.suf})` : 'Value', 'Kind'],
    rows: bars.map((b, i) => [
      b.label,
      b.kind === 'guide' && b.shown ? b.shown : textOf(i),
      i === anchor ? 'latest reported' : KIND_WORD[b.kind],
    ]),
  };
  const aria = `${block.caption}: ${bars
    .map((b, i) => `${b.label} ${textOf(i)}${b.kind ? ` (${KIND_WORD[b.kind]})` : ''}`)
    .join(', ')}`;

  return (
    <ChartFrame
      {...frame}
      finding={columnFinding(block, unit)}
      metric={block.caption}
      sub={block.caption}
      height={H}
      legend={<Legend items={legend} />}
      table={table}
    >
      <Box ref={ref} sx={{ minWidth: 0, height: H }}>
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label={aria} style={{ display: 'block' }}>
            <defs>
              <pattern
                id={hatchId}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="2" height="5" fill={roles.ctx} />
              </pattern>
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={gutter}
                  x2={W}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? roles.axis : roles.grid}
                  strokeWidth={1}
                />
                <text
                  x={gutter - 8}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={t.palette.text.secondary}
                  style={MONO}
                >
                  {tickText(v)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const bx = x(i) - barW / 2;
              const d = barPath(bx, barW, y(0), y(b.value));
              if (b.kind === 'guide')
                return (
                  <g key={i}>
                    <path
                      d={d}
                      fill="none"
                      stroke={roles.ctx}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    {ranges[i] && (
                      <g stroke={roles.emph} strokeWidth={1.5}>
                        <line x1={x(i)} x2={x(i)} y1={y(ranges[i].lo)} y2={y(ranges[i].hi)} />
                        <line
                          x1={x(i) - 5}
                          x2={x(i) + 5}
                          y1={y(ranges[i].lo)}
                          y2={y(ranges[i].lo)}
                        />
                        <line
                          x1={x(i) - 5}
                          x2={x(i) + 5}
                          y1={y(ranges[i].hi)}
                          y2={y(ranges[i].hi)}
                        />
                      </g>
                    )}
                  </g>
                );
              return (
                <g key={i}>
                  {b.kind === 'approx' && <path d={d} fill={roles.band} />}
                  <path
                    d={d}
                    fill={
                      b.kind === 'approx'
                        ? `url(#${hatchId})`
                        : i === anchor
                          ? roles.emph
                          : roles.ctx
                    }
                  />
                </g>
              );
            })}
            {placed.map((p) => (
              <text
                key={p.i}
                x={p.cx}
                y={p.cy}
                textAnchor="middle"
                fontSize={11}
                fill={p.i === anchor ? t.palette.text.primary : t.palette.text.secondary}
                style={MONO}
              >
                {textOf(p.i)}
              </text>
            ))}
            {bars.map((_, i) =>
              xKept.has(i) ? (
                <text
                  key={i}
                  x={Math.min(Math.max(x(i), xWidth[i] / 2), W - xWidth[i] / 2)}
                  y={PT + PH + NEG + LINE}
                  textAnchor="middle"
                  fontSize={11}
                  fill={i === anchor ? t.palette.text.primary : t.palette.text.secondary}
                  style={MONO}
                >
                  {xLines[i].map((line, j) => (
                    <tspan
                      key={j}
                      x={Math.min(Math.max(x(i), xWidth[i] / 2), W - xWidth[i] / 2)}
                      dy={j === 0 ? 0 : LINE}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              ) : null,
            )}
          </svg>
        )}
      </Box>
    </ChartFrame>
  );
}

// =================================================================================================
// RN-02 · Proportion, RN-03 · Comparison: horizontal bars on one scale, labelled at their ends
// =================================================================================================

interface BarRow {
  label: string;
  value: number;
  text: string;
  detail?: string | null;
  emph: boolean;
}

/** Horizontal bars from a shared zero: names left, bars right, each value printed past its bar's end.
 *  Values below zero run left of the zero line. 0 and the top of the scale are marked under the bars.
 *  On a phone the name stacks above its bar and the value moves up beside the name, so a long value
 *  ("4,000+ in 15 metros") never pushes past the frame and every bar keeps the full width. */
function BarList({ rows, unit, aria }: { rows: BarRow[]; unit: Unit | null; aria: string }) {
  const lo = Math.min(0, ...rows.map((r) => r.value));
  const hi = Math.max(0, ...rows.map((r) => r.value));
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;
  const zero = pct(0);
  // Every track leaves the same room past its end for the longest printed value: one scale for all rows.
  const room = `${Math.min(24, Math.max(...rows.map((r) => r.text.length))) * 0.62 + 0.5}em`;
  return (
    <Box
      role="img"
      aria-label={aria}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 200px) minmax(0, 1fr)' },
        columnGap: 1.5,
        rowGap: { xs: 0.5, sm: 1 },
        alignItems: 'center',
      }}
    >
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: 'contents' }}>
          <Box
            sx={{
              fontSize: 13,
              lineHeight: 1.3,
              color: r.emph ? 'text.primary' : 'text.secondary',
              fontWeight: r.emph ? 600 : 400,
              mt: { xs: 0.75, sm: 0 },
              display: { xs: 'flex', sm: 'block' },
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              columnGap: 1,
            }}
          >
            <span>{r.label}</span>
            <Box
              component="span"
              sx={{
                ...MONO,
                display: { xs: 'inline', sm: 'none' },
                fontSize: 12,
                fontWeight: 400,
                order: 2,
                color: r.emph ? 'text.primary' : 'text.secondary',
              }}
            >
              {r.text}
            </Box>
            {r.detail && (
              <Box
                component="span"
                sx={{
                  display: 'block',
                  flexBasis: '100%',
                  order: 3,
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'text.secondary',
                }}
              >
                {r.detail}
              </Box>
            )}
          </Box>
          <Box sx={{ position: 'relative', height: 22, mr: { xs: 0, sm: room }, fontSize: 12 }}>
            <Box
              aria-hidden
              sx={(t) => ({
                position: 'absolute',
                top: -3,
                bottom: -3,
                left: `${zero}%`,
                borderLeft: `1px solid ${chartRoles(t).axis}`,
              })}
            />
            <Box
              sx={(t) => ({
                position: 'absolute',
                top: 5,
                height: 12,
                left: `${pct(Math.min(0, r.value))}%`,
                width: `${Math.max(0.6, Math.abs(pct(r.value) - zero))}%`,
                borderRadius: r.value >= 0 ? '0 3px 3px 0' : '3px 0 0 3px',
                bgcolor: r.emph ? chartRoles(t).emph : chartRoles(t).ctx,
              })}
            />
            <Box
              component="span"
              sx={{
                ...MONO,
                position: 'absolute',
                top: 3,
                display: { xs: 'none', sm: 'block' },
                fontSize: 12,
                lineHeight: '16px',
                whiteSpace: 'nowrap',
                color: r.emph ? 'text.primary' : 'text.secondary',
                ...(r.value >= 0
                  ? { left: `calc(${pct(r.value)}% + 6px)` }
                  : { right: `calc(${100 - pct(r.value)}% + 6px)` }),
              }}
            >
              {r.text}
            </Box>
          </Box>
        </Box>
      ))}
      <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Box
        aria-hidden
        sx={{
          ...MONO,
          position: 'relative',
          height: 16,
          fontSize: 11,
          color: 'text.secondary',
          // In 12px ems, as the tracks above are.
          mr: { xs: 0, sm: `calc(${room} * 12 / 11)` },
        }}
      >
        <Box
          component="span"
          sx={{
            position: 'absolute',
            left: `${zero}%`,
            transform: zero > 0 ? 'translateX(-50%)' : undefined,
          }}
        >
          0
        </Box>
        {hi > 0 && (
          <Box component="span" sx={{ position: 'absolute', right: 0, whiteSpace: 'nowrap' }}>
            {fmtIn(hi, unit)}
          </Box>
        )}
        {lo < 0 && (
          <Box component="span" sx={{ position: 'absolute', left: 0, whiteSpace: 'nowrap' }}>
            {fmtIn(lo, unit)}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Shares of one total, in the author's order (often time buckets, so never re-sorted): one neutral
 *  hue, the largest share phosphor, each labelled with its share and amount. Over five parts, the
 *  smallest fold into "Other" so no sliver needs a shade to be told apart (RN-02). */
export function SplitBlock({ block }: { block: Of<'split'> }) {
  const frame = useNoteFrame('split');
  const unit = captionUnit(block.caption);
  const items = block.items;
  const MAX = 5;
  let shown = items;
  if (items.length > MAX) {
    const keep = [...items]
      .sort((a, b) => b.share - a.share)
      .slice(0, MAX - 1)
      .map((i) => i.label);
    const rest = items.filter((i) => !keep.includes(i.label));
    shown = [
      ...items.filter((i) => keep.includes(i.label)),
      {
        label: `Other (${rest.length})`,
        value: rest.reduce((s, i) => s + i.value, 0),
        share: rest.reduce((s, i) => s + i.share, 0),
        detail: rest.map((i) => i.label).join(', '),
      },
    ];
  }
  const top = shown.reduce((a, i) => (i.share > a.share ? i : a), shown[0]);
  const share = (s: number) => `${Math.round(s * 10) / 10}%`;
  // Some notes' detail is the share itself ("41%"); don't print it twice.
  const detail = (i: (typeof shown)[number]) =>
    i.detail && i.detail !== `${Math.round(i.share)}%` ? i.detail : null;
  const metric = block.caption ?? 'Share of the total';
  return (
    <ChartFrame
      {...frame}
      finding={`${top.label} is ${share(top.share)} of the total`}
      metric={metric}
      sub={block.caption ?? undefined}
      height={shown.length * 34}
      table={{
        caption: metric,
        cols: ['Part', 'Share', unit ? `Amount (${unit.pre}${unit.suf})` : 'Amount', 'Note'],
        rows: items.map((i) => [i.label, share(i.share), fmtIn(i.value, unit), i.detail ?? '']),
      }}
    >
      <BarList
        unit={{ pre: '', suf: '%' }}
        aria={items.map((i) => `${i.label} ${share(i.share)}, ${fmtIn(i.value, unit)}`).join('; ')}
        rows={shown.map((i) => ({
          label: i.label,
          value: i.share,
          text: `${share(i.share)} · ${fmtIn(i.value, unit)}`,
          detail: detail(i),
          emph: i === top,
        }))}
      />
    </ChartFrame>
  );
}

export function CompareBlock({ block }: { block: Of<'compare'> }) {
  const frame = useNoteFrame('compare');
  const unit = captionUnit(block.caption);
  const items = block.items;
  const top = items.reduce((a, i) => (i.value > a.value ? i : a), items[0]);
  const metric = block.caption ?? 'Comparison';
  return (
    <ChartFrame
      {...frame}
      finding={`${top.label} is the largest, at ${top.shown}`}
      metric={metric}
      sub={block.caption ?? undefined}
      height={items.length * 34}
      table={{
        caption: metric,
        cols: ['Item', 'Value'],
        rows: items.map((i) => [i.label, i.shown]),
      }}
    >
      <BarList
        unit={unit}
        aria={items.map((i) => `${i.label}: ${i.shown}`).join('; ')}
        rows={items.map((i) => ({ label: i.label, value: i.value, text: i.shown, emph: i.emph }))}
      />
    </ChartFrame>
  );
}

// =================================================================================================
// RN-04 · Bridge
// =================================================================================================

/** A walk from one total to another (RN-04). One scale spans every running total and zero, so a total
 *  or a walk below zero sits below a real zero line; hairline connectors carry the running total from
 *  step to step. Up steps are filled, down steps outlined, and every step's sign is printed: the sign
 *  never rests on a hue (P-11). Where columns would be narrower than their labels (under 480px, or
 *  many steps), it turns into rows: one per step, label left, bar right, on a horizontal scale. */
export function BridgeBlock({ block }: { block: Of<'bridge'> }) {
  const frame = useNoteFrame('bridge');
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const unit = captionUnit(block.caption);
  const steps = block.steps;
  const n = steps.length;
  let running = steps[0].value;
  const bars = steps.map((s, i) => {
    const isTotal = i === 0 || i === n - 1;
    if (isTotal) return { ...s, isTotal, from: 0, to: s.value };
    const from = running;
    running += s.value;
    return { ...s, isTotal, from, to: running };
  });
  const signed = (b: (typeof bars)[number]) =>
    b.isTotal
      ? fmtIn(b.value, unit)
      : `${b.value >= 0 ? '+' : '−\u2060'}${fmtIn(Math.abs(b.value), unit)}`;
  const biggest = bars
    .filter((b) => !b.isTotal)
    .reduce<(typeof bars)[number] | null>(
      (a, b) => (!a || Math.abs(b.value) > Math.abs(a.value) ? b : a),
      null,
    );
  const first = bars[0];
  const last = bars[n - 1];
  const ends = `${first.label} ${fmtIn(first.value, unit)} to ${last.label} ${fmtIn(last.value, unit)}`;
  // The largest step only while the title stays about two lines; the table always has it.
  const step = biggest ? `; the largest step is ${biggest.label}, ${signed(biggest)}` : '';
  const finding = (ends + step).length <= 120 ? ends + step : ends;
  const metric = block.caption ?? 'Bridge';
  const aria = bars
    .map((b) =>
      b.isTotal
        ? `${b.label} ${fmtIn(b.value, unit)}`
        : `${b.value >= 0 ? 'plus' : 'minus'} ${b.label} ${fmtIn(Math.abs(b.value), unit)}`,
    )
    .join(', ');

  const rows = W > 0 && (W < 480 || W / n < 72);
  const PT = 20;
  const PH = 180;
  const PB = 20;
  const H = rows ? n * 30 + 22 : PT + PH + PB;
  const values = bars.flatMap((b) => [b.from, b.to]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;

  return (
    <ChartFrame
      {...frame}
      finding={finding}
      metric={metric}
      sub={block.caption ?? undefined}
      height={H}
      legend={
        <Legend
          items={[
            ['Totals', (th) => ({ bgcolor: chartRoles(th).ctx })],
            ['Step up (+)', (th) => ({ bgcolor: chartRoles(th).ctx2 })],
            ['Step down (−)', (th) => ({ border: `1.5px solid ${chartRoles(th).ctx}` })],
          ]}
        />
      }
      table={{
        caption: metric,
        cols: ['Step', unit ? `Amount (${unit.pre}${unit.suf})` : 'Amount', 'Running total'],
        rows: bars.map((b) => [b.label, signed(b), fmtIn(b.to, unit)]),
      }}
    >
      <Box ref={ref} sx={{ minWidth: 0 }}>
        {W > 0 && !rows && (
          <>
            <svg width={W} height={H} role="img" aria-label={aria} style={{ display: 'block' }}>
              {(() => {
                const slot = W / n;
                const bw = Math.min(56, slot * 0.6);
                const x = (i: number) => slot * (i + 0.5);
                const y = (v: number) => PT + ((hi - v) / span) * PH;
                return (
                  <>
                    <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={roles.axis} />
                    {bars.map((b, i) => {
                      const a = y(Math.max(b.from, b.to));
                      const z = y(Math.min(b.from, b.to));
                      const down = !b.isTotal && b.value < 0;
                      const fill = b.isTotal
                        ? i === n - 1
                          ? roles.emph
                          : roles.ctx
                        : down
                          ? 'none'
                          : roles.ctx2;
                      const below = b.value < 0;
                      return (
                        <g key={i}>
                          {i < n - 1 && (
                            <line
                              x1={x(i) + bw / 2}
                              x2={x(i + 1) - bw / 2}
                              y1={y(b.to)}
                              y2={y(b.to)}
                              stroke={roles.edge}
                              strokeDasharray="2 2"
                            />
                          )}
                          <rect
                            x={x(i) - bw / 2 + (down ? 0.75 : 0)}
                            y={a + (down ? 0.75 : 0)}
                            width={bw - (down ? 1.5 : 0)}
                            height={Math.max(2, z - a - (down ? 1.5 : 0))}
                            rx={2}
                            fill={fill}
                            stroke={down ? roles.ctx : 'none'}
                            strokeWidth={1.5}
                          />
                          <text
                            x={x(i)}
                            y={below ? z + 14 : a - 6}
                            textAnchor="middle"
                            fontSize={11}
                            fill={b.isTotal ? t.palette.text.primary : t.palette.text.secondary}
                            style={MONO}
                          >
                            {signed(b)}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
            <Box
              aria-hidden
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
                gap: 1,
                mt: 0.5,
                fontSize: 12,
                lineHeight: 1.3,
                textAlign: 'center',
                color: 'text.secondary',
              }}
            >
              {bars.map((b, i) => (
                <Box
                  component="span"
                  key={i}
                  sx={{
                    color: b.isTotal ? 'text.primary' : undefined,
                    fontWeight: b.isTotal ? 600 : 400,
                    overflowWrap: 'break-word',
                  }}
                >
                  {b.label}
                </Box>
              ))}
            </Box>
          </>
        )}
        {rows && (
          <Box role="img" aria-label={aria} sx={{ display: 'grid', gap: 0.75 }}>
            {(() => {
              // Headroom past each end for the widest printed value, sized in pixels against the track
              // (the row's width less its 118px label column and gap), so no label leaves the frame.
              const track = Math.max(80, W - 128);
              const frac = Math.min(
                0.45,
                (Math.max(...bars.map((b) => signed(b).length)) * CH + 8) / track,
              );
              const fracL = bars.some((b) => b.value < 0) ? frac : 0;
              const T = span / Math.max(0.1, 1 - frac - fracL);
              const L = lo - T * fracL;
              const R = hi + T * frac;
              const P = (v: number) => ((v - L) / (R - L)) * 100;
              return bars.map((b, i) => {
                const a = Math.min(b.from, b.to);
                const z = Math.max(b.from, b.to);
                const down = !b.isTotal && b.value < 0;
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 118px) minmax(0, 1fr)',
                      gap: 1.25,
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.25,
                        color: b.isTotal ? 'text.primary' : 'text.secondary',
                        fontWeight: b.isTotal ? 600 : 400,
                      }}
                    >
                      {b.label}
                    </Box>
                    <Box sx={{ position: 'relative', height: 22 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -4,
                          bottom: -4,
                          left: `${P(0)}%`,
                          borderLeft: `1px solid ${roles.axis}`,
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 5,
                          height: 12,
                          left: `${P(a)}%`,
                          width: `${Math.max(0.6, P(z) - P(a))}%`,
                          borderRadius: '3px',
                          boxSizing: 'border-box',
                          bgcolor: b.isTotal
                            ? i === n - 1
                              ? roles.emph
                              : roles.ctx
                            : down
                              ? 'transparent'
                              : roles.ctx2,
                          border: down ? `1.5px solid ${roles.ctx}` : 'none',
                        }}
                      />
                      <Box
                        component="span"
                        sx={{
                          ...MONO,
                          position: 'absolute',
                          top: 3,
                          fontSize: 11,
                          lineHeight: '16px',
                          whiteSpace: 'nowrap',
                          color: b.isTotal ? 'text.primary' : 'text.secondary',
                          ...(b.value >= 0
                            ? { left: `calc(${P(z)}% + 6px)` }
                            : { right: `calc(${100 - P(a)}% + 6px)` }),
                        }}
                      >
                        {signed(b)}
                      </Box>
                    </Box>
                  </Box>
                );
              });
            })()}
          </Box>
        )}
      </Box>
    </ChartFrame>
  );
}

// =================================================================================================
// RN-05 · Units
// =================================================================================================

/** The total drawn as blocks of the unit: "29 years of this year's revenue". The legend names the
 *  block, so the first one's emphasis is explained (RN-05). */
export function UnitsBlock({ block }: { block: Of<'units'> }) {
  const frame = useNoteFrame('units');
  const whole = Math.floor(block.count);
  const part = block.count - whole;
  const cells = Array.from({ length: Math.ceil(block.count) }, (_, i) => (i < whole ? 1 : part));
  const metric = block.caption ?? 'Total in blocks';
  return (
    <ChartFrame
      {...frame}
      finding={`The total is ${fmt(block.count)} times one block`}
      metric={metric}
      sub={block.caption ?? undefined}
      height={80}
      legend={
        <Legend
          items={[
            [`One block: ${fmt(block.unit)}`, (th) => ({ bgcolor: chartRoles(th).emph })],
            ['Further blocks', (th) => ({ bgcolor: chartRoles(th).ctx2 })],
            ...(part > 0
              ? ([
                  ['Part of a block', (th) => ({ border: `1px dashed ${chartRoles(th).ctx}` })],
                ] as [ReactNode, (t: Theme) => object][])
              : []),
          ]}
        />
      }
      note={
        <Box component="span" sx={MONO}>
          {fmt(block.total)} ÷ {fmt(block.unit)} = {fmt(block.count)} (calc)
        </Box>
      }
      table={{
        caption: metric,
        cols: ['Figure', 'Value'],
        rows: [
          ['Total', fmt(block.total)],
          ['One block', fmt(block.unit)],
          ['Blocks', fmt(block.count)],
        ],
      }}
    >
      <Box
        role="img"
        aria-label={`${fmt(block.total)} is ${fmt(block.count)} blocks of ${fmt(block.unit)}`}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
      >
        {cells.map((fill, i) => (
          <Box
            key={i}
            sx={(t) => {
              const r = chartRoles(t);
              return {
                width: { xs: 22, sm: 28 },
                height: { xs: 22, sm: 28 },
                borderRadius: '6px',
                boxSizing: 'border-box',
                ...(i === 0
                  ? { bgcolor: r.emph }
                  : fill < 1
                    ? {
                        border: `1px dashed ${r.ctx}`,
                        background: `linear-gradient(90deg, ${r.ctx2} ${fill * 100}%, transparent ${fill * 100}%)`,
                      }
                    : { bgcolor: r.ctx2 }),
              };
            }}
          />
        ))}
      </Box>
    </ChartFrame>
  );
}
