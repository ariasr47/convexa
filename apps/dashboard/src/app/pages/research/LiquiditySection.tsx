/**
 * Net liquidity (design: Planned · Liquidity, LIQUIDITY_SPEC): the Fed's total assets less the
 * Treasury General Account less overnight reverse repo, each H.4.1 Wednesday for 26 weeks. The
 * title states the four-week change and names the input that moved it most, worked out from the
 * figures; the axis says it doesn't start at zero; the three inputs show beside it on their own
 * ranges, stated; "Show the numbers" lists every third week and the latest.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { dataMode, type PublicMarkets } from '@convexa/api';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { FOMC_CHECKED, FOMC_SOURCE } from './fomc';
import { formatNoteDate, formatShortDate } from './format';
import {
  h41Release,
  h41Status,
  liquidityMarks,
  TAX_SOURCE,
  type LiquidityMark,
} from './liquidityCalendar';
import { MONO } from './ui';
import { useWidth } from './useWidth';

type Liquidity = NonNullable<PublicMarkets['liquidity']>;
type Week = Liquidity['weeks'][number];

const H41_URL = 'https://www.federalreserve.gov/releases/h41/';
/** $ millions → "$5.86T". */
const tril = (m: number) => `$${(m / 1e6).toFixed(2)}T`;
/** $ millions → "$886B". */
const bil = (m: number) => `$${Math.round(m / 1e3).toLocaleString('en-US')}B`;
const signedBil = (m: number) => `${m > 0 ? '▲' : m < 0 ? '▼' : '±'} ${bil(Math.abs(m))}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "2026-11-27" → "Fri Nov 27". */
const dayDate = (d: string) =>
  `${DAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${formatShortDate(d)}`;

/** What the last four weeks did, and which input did most of it (its share of the net change). */
export function liquidityFinding(weeks: Week[]): string {
  const last = weeks[weeks.length - 1];
  if (weeks.length < 5) return `Net liquidity is ${tril(last.net)}`;
  const then = weeks[weeks.length - 5];
  const change = last.net - then.net;
  const parts = [
    {
      d: last.fed_assets - then.fed_assets,
      sign: 1,
      up: 'the Fed’s assets grew',
      down: 'the Fed’s assets shrank',
    },
    {
      d: last.tga - then.tga,
      sign: -1,
      up: 'the Treasury’s cash account grew',
      down: 'the Treasury’s cash account shrank',
    },
    {
      d: last.reverse_repo - then.reverse_repo,
      sign: -1,
      up: 'reverse repo grew',
      down: 'reverse repo shrank',
    },
  ];
  const lead = parts.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
  if (Math.abs(change) < 1_000) return `Net liquidity held near ${tril(last.net)} over four weeks`;
  // Only name a driver whose move points the same way as the change.
  const helps = Math.sign(lead.d * lead.sign) === Math.sign(change);
  return `Net liquidity ${change > 0 ? 'rose' : 'fell'} ${bil(Math.abs(change))} in four weeks${
    helps ? `, mostly as ${lead.d > 0 ? lead.up : lead.down}` : ''
  }`;
}

export function LiquiditySection({
  liquidity,
  stale = false,
}: {
  liquidity: Liquidity;
  /** The sources failed this cycle and this is the last good copy (the API's own note says so). */
  stale?: boolean;
}) {
  const weeks = liquidity.weeks;
  if (weeks.length < 2) return null;
  const demo = dataMode === 'demo';
  // The Fed moves the H.4.1 off its Thursday for a holiday: worked out here from its schedule, so
  // the frame says the source is late rather than that the figures are current.
  const schedule = demo ? ({ state: 'onTime' } as const) : h41Status(liquidity.as_of, new Date());
  const published = h41Release(liquidity.as_of).date;
  const marks = liquidityMarks(weeks.map((w) => w.date));
  const byDate = new Map(weeks.map((w) => [w.date, w]));
  const last = weeks[weeks.length - 1];
  const four = weeks.length >= 5 ? weeks[weeks.length - 5] : null;
  const nets = weeks.map((w) => w.net / 1e6);
  let lo = Math.floor(Math.min(...nets) * 10) / 10;
  let hi = Math.ceil(Math.max(...nets) * 10) / 10;
  if (hi - lo < 0.2) {
    lo -= 0.1;
    hi += 0.1;
  }
  const strip: [string, string, string | null][] = [
    ['Net liquidity', tril(last.net), four ? `${signedBil(last.net - four.net)} in 4 weeks` : null],
    [
      'Fed total assets',
      tril(last.fed_assets),
      four ? `${signedBil(last.fed_assets - four.fed_assets)} in 4 weeks` : null,
    ],
    [
      'Treasury cash (TGA)',
      bil(last.tga),
      four ? `${signedBil(last.tga - four.tga)} in 4 weeks` : null,
    ],
    [
      'Reverse repo',
      bil(last.reverse_repo),
      four ? `${signedBil(last.reverse_repo - four.reverse_repo)} in 4 weeks` : null,
    ],
  ];
  return (
    <ChartFrame
      finding={liquidityFinding(weeks)}
      metric="Net liquidity"
      sub={`Fed total assets less the Treasury General Account less overnight reverse repo · $ trillions · weekly, on the H.4.1 Wednesday · the axis starts at $${lo.toFixed(1)}T, not zero: it shows change, not size`}
      headingLevel="h2"
      height={320}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : stale
            ? { state: 'lastGood', detail: `week to ${formatShortDate(liquidity.as_of)}` }
            : schedule.state === 'delayed'
              ? { state: 'delayed', detail: 'H.4.1' }
              : { state: 'computed', detail: 'weekly' }
      }
      source={
        demo
          ? { text: 'Demo · shaped like Fed H.4.1, Treasury DTS and NY Fed reverse repo' }
          : { text: 'Fed H.4.1 · Treasury DTS · NY Fed reverse repo', href: H41_URL }
      }
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(liquidity.as_of)}`
          : `Week to Wed ${formatNoteDate(liquidity.as_of)} · published ${dayDate(published)}`
      }
      note={
        <>
          Each Wednesday’s Fed figure is netted against the Treasury’s cash and reverse repo on that
          same day (or the business day before it), so a daily swing in the Treasury’s cash never
          shows as a weekly move. Marks under the line, each on the first Wednesday on or after it:
          quarter ends (■), FOMC decisions (●, ◆ with projections; from the{' '}
          <Box
            component="a"
            href={FOMC_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit' }}
          >
            Fed’s calendar
          </Box>
          , checked {formatNoteDate(FOMC_CHECKED)}) and corporate estimated-tax days (○; from the{' '}
          <Box
            component="a"
            href={TAX_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit' }}
          >
            IRS tax calendar
          </Box>
          ), when the Treasury’s cash account tends to jump.
        </>
      }
      table={{
        caption: 'Net liquidity and its inputs, $ billions, every third week and the latest',
        cols: ['Week to', 'Fed assets', 'TGA', 'Reverse repo', 'Net'],
        rows: [
          ...weeks
            .filter((_, i) => (weeks.length - 1 - i) % 3 === 0)
            .map((w) => [
              formatNoteDate(w.date),
              bil(w.fed_assets),
              bil(w.tga),
              bil(w.reverse_repo),
              bil(w.net),
            ]),
          // Each marked event with the week it falls in.
          ...marks.map((m) => {
            const w = byDate.get(weeks[m.index].date) as Week;
            return [
              `${m.label} · ${formatNoteDate(m.date)} (week to ${formatShortDate(w.date)})`,
              bil(w.fed_assets),
              bil(w.tga),
              bil(w.reverse_repo),
              bil(w.net),
            ];
          }),
        ],
      }}
      testId="chart-liquidity"
    >
      {schedule.state === 'delayed' && !stale && (
        <Box
          component="p"
          role="status"
          sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}
        >
          {`The H.4.1 for Wed ${formatShortDate(schedule.week)} is published ${dayDate(schedule.releases)} this week (${schedule.holiday}). Showing the week to ${formatShortDate(liquidity.as_of)}.`}
        </Box>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
          gap: 1.5,
        }}
      >
        {strip.map(([label, value, change]) => (
          <Box key={label} sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
            <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {label}
            </Box>
            <Box component="span" sx={{ ...MONO, fontSize: 20, lineHeight: 1.2 }}>
              {value}
            </Box>
            {change && (
              <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
                {change}
              </Box>
            )}
          </Box>
        ))}
      </Box>
      <NetLine weeks={weeks} lo={lo} hi={hi} marks={marks} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
          gap: 1.25,
        }}
      >
        <Spark
          name="Fed total assets"
          values={weeks.map((w) => w.fed_assets)}
          end={tril(last.fed_assets)}
        />
        <Spark
          name="Treasury cash (TGA) · subtracted"
          values={weeks.map((w) => w.tga)}
          end={bil(last.tga)}
        />
        <Spark
          name="Reverse repo · subtracted"
          values={weeks.map((w) => w.reverse_repo)}
          end={bil(last.reverse_repo)}
        />
      </Box>
    </ChartFrame>
  );
}

const LANES: { kind: LiquidityMark['kind']; label: string }[] = [
  { kind: 'quarter', label: 'Quarter' },
  { kind: 'fomc', label: 'FOMC' },
  { kind: 'tax', label: 'Tax' },
];

function NetLine({
  weeks,
  lo,
  hi,
  marks,
}: {
  weeks: Week[];
  lo: number;
  hi: number;
  marks: LiquidityMark[];
}) {
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const PL = 62;
  const PR = 96;
  const PT = 12;
  const PH = 170;
  // The event lanes sit under the dates: one per kind, each named, so no mark relies on its shape.
  const LANE0 = PT + PH + 38;
  const LANE = 16;
  const H = marks.length ? LANE0 + LANE * (LANES.length - 1) + 10 : PT + PH + 22;
  const n = weeks.length;
  const x = (i: number) => PL + (i / Math.max(1, n - 1)) * Math.max(0, W - PL - PR);
  const y = (v: number) => PT + ((hi - v) / (hi - lo || 1)) * PH;
  const step = hi - lo > 0.6 ? 0.2 : 0.1;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const last = weeks[n - 1];
  const dateIdx = [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Net liquidity, weekly, ${formatShortDate(weeks[0].date)} to ${formatShortDate(last.date)}: from ${tril(weeks[0].net)} to ${tril(last.net)}${marks.length ? `. Marked: ${marks.map((m) => `${m.label} ${formatShortDate(m.date)}`).join(', ')}` : ''}`}
          style={{ display: 'block' }}
        >
          {ticks.map((v, i) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke={roles.grid} />
              <text
                x={PL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill={t.palette.text.secondary}
                style={MONO}
              >
                {i === ticks.length - 1 ? `$${v.toFixed(1)}T` : v.toFixed(1)}
              </text>
            </g>
          ))}
          {marks.length > 0 && (
            <g aria-hidden="true">
              {LANES.map((lane, k) => (
                <text
                  key={lane.kind}
                  x={PL - 12}
                  y={LANE0 + k * LANE + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={t.palette.text.secondary}
                  style={MONO}
                >
                  {lane.label}
                </text>
              ))}
              {marks.map((m) => {
                const k = LANES.findIndex((l) => l.kind === m.kind);
                const cx = x(m.index);
                const cy = LANE0 + k * LANE;
                const ink = t.palette.text.secondary;
                return (
                  <g key={`${m.kind}-${m.date}`}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={PT}
                      y2={PT + PH}
                      stroke={roles.edge}
                      strokeDasharray="2 3"
                    />
                    {m.kind === 'quarter' ? (
                      <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} fill={ink} />
                    ) : m.kind === 'tax' ? (
                      <circle cx={cx} cy={cy} r={3.5} fill="none" stroke={ink} strokeWidth={1.5} />
                    ) : m.label.endsWith('projections') ? (
                      <rect
                        x={cx - 4}
                        y={cy - 4}
                        width={8}
                        height={8}
                        fill={ink}
                        transform={`rotate(45 ${cx} ${cy})`}
                      />
                    ) : (
                      <circle cx={cx} cy={cy} r={3.5} fill={ink} />
                    )}
                  </g>
                );
              })}
            </g>
          )}
          <polyline
            points={weeks.map((w, i) => `${x(i)},${y(w.net / 1e6)}`).join(' ')}
            fill="none"
            stroke={roles.emph}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle cx={x(n - 1)} cy={y(last.net / 1e6)} r={3.5} fill={roles.emph} />
          <text
            x={x(n - 1) + 8}
            y={y(last.net / 1e6) + 4}
            fontSize={11}
            fill={t.palette.text.primary}
            style={MONO}
          >
            {`Net ${tril(last.net)}`}
          </text>
          {dateIdx.map((i, k) => (
            <text
              key={i}
              x={x(i)}
              y={PT + PH + 16}
              textAnchor={k === 0 ? 'start' : k === dateIdx.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill={t.palette.text.secondary}
              style={MONO}
            >
              {formatShortDate(weeks[i].date)}
            </text>
          ))}
        </svg>
      )}
    </Box>
  );
}

/** One input over the same weeks, on its own range (stated), ending on its latest value. */
function Spark({ name, values, end }: { name: string; values: number[]; end: string }) {
  const t = useTheme();
  const roles = chartRoles(t);
  const w = 140;
  const h = 28;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * (w - 4) + 2},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`,
    )
    .join(' ');
  return (
    <Box
      sx={(th) => ({
        display: 'grid',
        gap: 0.5,
        p: 1.25,
        borderRadius: '10px',
        border: `1px solid ${th.palette.divider}`,
        minWidth: 0,
      })}
    >
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        {name}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <svg
          width={w}
          height={h}
          role="img"
          aria-label={`${name}, ${values.length} weeks on its own range, ending ${end}`}
        >
          <polyline points={pts} fill="none" stroke={roles.ctx} strokeWidth={1.5} />
        </svg>
        <Box component="span" sx={{ ...MONO, fontSize: 13 }}>
          {end}
        </Box>
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
        own range · {bilRange(lo, hi)}
      </Box>
    </Box>
  );
}

const bilRange = (lo: number, hi: number) => `${bil(lo)} – ${bil(hi)}`;
