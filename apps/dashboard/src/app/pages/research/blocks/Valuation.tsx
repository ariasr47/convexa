/**
 * The valuation's visuals: the price-vs-value strip, the football field, scenario cards, odds in
 * twentieths, the sensitivity grid, the assumptions, and "what the price implies". Every number here
 * arrives computed by the build (tools/research-notes/valuation.mjs); this file only draws.
 *
 * Uncertainty is shown, not hidden: ranges are solid to their ends (the edges are the range), the
 * base case is one mark inside a band, open-ended rates are drawn open, and any figure measured
 * against the price disappears once the price is 30 days old. The charts sit on the v5 chart frame
 * (canon P-8 to P-13; design/src/screens/v5/families-research.mjs, RN-06 and RN-08 to RN-11).
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import {
  arrow,
  formatAsOf,
  formatShortDate,
  INPUT_LABEL,
  millions,
  money,
  percent,
  priceText,
  rate,
  UNCERTAINTY_LABEL,
  UNCERTAINTY_LEVEL,
} from '../format';
import { NoteInlines } from '../Inlines';
import { useNoteContext } from '../noteContext';
import type { Dated, ScenarioName, Uncertainty, ValuationBlock } from '../types';
import { MONO, Panel, PANEL_SX, YourCall } from '../ui';
import { useWidth } from '../useWidth';
import { useNoteFrame } from './noteFrame';

const NAMES: ScenarioName[] = ['bear', 'base', 'bull'];
const TITLE: Record<ScenarioName, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

/** The axis maximum: a round number a little above everything drawn. */
function axisMax(values: number[]) {
  const max = Math.max(...values, 1) * 1.1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (
    (n <= 1.5
      ? 1.5
      : n <= 2
        ? 2
        : n <= 3
          ? 3
          : n <= 4
            ? 4
            : n <= 5
              ? 5
              : n <= 6
                ? 6
                : n <= 8
                  ? 8
                  : 10) * pow
  );
}
const at = (v: number, max: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
/** An axis tick in dollars: round numbers print without cents ("$0", "$250"). */
const tickMoney = (v: number) =>
  `$${v.toLocaleString('en-US', { maximumFractionDigits: v === Math.round(v) ? 0 : 2 })}`;

/** Signed change, arrow first, hue second: "▼ 13%". */
export function Signed({ value }: { value: number }) {
  return (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: 'text.primary' }}>
        {arrow(value)}
      </Box>{' '}
      <Box component="span" sx={MONO}>
        {percent(value)}
      </Box>
    </Box>
  );
}

export function UncertaintyMark({ level }: { level: Uncertainty }) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 12 }}
    >
      <Box component="span" sx={{ color: 'text.secondary' }}>
        Uncertainty
      </Box>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Box
            key={n}
            component="span"
            sx={(t) => ({
              width: 6,
              height: 12,
              borderRadius: '1px',
              bgcolor:
                n <= UNCERTAINTY_LEVEL[level]
                  ? 'text.primary'
                  : alpha(t.palette.text.secondary, 0.3),
            })}
          />
        ))}
      </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>
        {UNCERTAINTY_LABEL[level]}
      </Box>
    </Box>
  );
}

export type StripData = {
  price: Dated;
  values: Record<ScenarioName, number>;
  weighted: number | null;
  baseVsPrice: number;
};

export function stripData(v: ValuationBlock): StripData {
  return {
    price: v.price,
    values: {
      bear: v.result.scenarios.bear.value,
      base: v.result.scenarios.base.value,
      bull: v.result.scenarios.bull.value,
    },
    weighted: v.result.weighted?.value ?? null,
    baseVsPrice: v.result.scenarios.base.vsPrice,
  };
}

/** A mono character at 11px, a little generous, for laying labels out before they're drawn. */
const CH = 6.8;

/**
 * Price against the value range (RN-06), on the chart frame in the note's header: a band solid to
 * its ends (the edges are the range, so it must not look narrower than it is), the base case as the
 * page's one amber diamond, the odds-weighted value as a labelled steel mark, and the dated price as
 * the phosphor line. Labels sit at their marks, on a second row when they would touch, and the axis
 * names its scale. A price over 30 days old dashes the line and drops every figure measured against
 * it, the title included; the range stays, because it doesn't depend on the price.
 */
export function PriceValueFrame({
  data,
  uncertainty,
  priceAgeDays,
  priceStale,
}: {
  data: StripData;
  uncertainty: Uncertainty | null;
  priceAgeDays: number | null;
  priceStale: boolean;
}) {
  const frame = useNoteFrame();
  const { price, values } = data;
  const toBase = ((values.base - price.value) / price.value) * 100;
  const finding = priceStale
    ? `Value range ${money(values.bear)} to ${money(values.bull)}, base case ${money(values.base)}`
    : Math.abs(toBase) < 0.5
      ? `At ${priceText(price.value)} the price sits at the base case of ${money(values.base)}`
      : `At ${priceText(price.value)} the price sits ${percent(toBase)} ${toBase >= 0 ? 'below' : 'above'} the base case of ${money(values.base)}`;
  return (
    <ChartFrame
      {...frame}
      testId="note-price-value"
      finding={finding}
      metric="Price against the value range"
      sub={`Value per share · the note’s bear, base and bull${data.weighted !== null ? ' and odds-weighted value' : ''} · price from the note (${formatShortDate(price.asOf)})`}
      height={96}
      legend={uncertainty ? <UncertaintyMark level={uncertainty} /> : undefined}
      table={{
        caption: 'Value per share against the price',
        cols: ['Mark', 'Per share'],
        rows: [
          ['Bear', money(values.bear)],
          ['Base', money(values.base)],
          ['Bull', money(values.bull)],
          ...(data.weighted !== null ? [['Weighted by the odds', money(data.weighted)]] : []),
          [`Price, ${formatShortDate(price.asOf)}`, priceText(price.value)],
        ],
      }}
    >
      <PriceValueStrip data={data} priceAgeDays={priceAgeDays} priceStale={priceStale} />
    </ChartFrame>
  );
}

function PriceValueStrip({
  data,
  priceAgeDays,
  priceStale,
}: {
  data: StripData;
  priceAgeDays: number | null;
  priceStale: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const { price, values } = data;
  const lo = Math.min(values.bear, values.base, values.bull);
  const hi = Math.max(values.bear, values.base, values.bull);
  const max = axisMax([hi, price.value, data.weighted ?? 0]);
  const X = (v: number) => (Math.min(max, Math.max(0, v)) / max) * W;
  const toBase = ((values.base - price.value) / price.value) * 100;
  const label =
    `Value range ${money(values.bear)} bear to ${money(values.bull)} bull, base ${money(values.base)}` +
    (data.weighted !== null ? `, weighted ${money(data.weighted)}` : '') +
    `; price ${priceText(price.value)} on ${formatShortDate(price.asOf)}` +
    (priceStale
      ? `, ${priceAgeDays} days old`
      : `, ${Math.abs(Math.round(toBase))}% ${toBase >= 0 ? 'below' : 'above'} the base case`);

  // Labels at their marks: base first, then the ends, then the weighted value; each takes the first
  // row it fits on without touching another, and anything left over is in the line below and the table.
  const marks: { key: string; v: number; text: string; primary: boolean }[] = [
    { key: 'base', v: values.base, text: `Base ${money(values.base)}`, primary: true },
    { key: 'bear', v: values.bear, text: `Bear ${money(values.bear)}`, primary: false },
    { key: 'bull', v: values.bull, text: `Bull ${money(values.bull)}`, primary: false },
    ...(data.weighted !== null
      ? [
          {
            key: 'weighted',
            v: data.weighted,
            text: `Weighted ${money(data.weighted)}`,
            primary: false,
          },
        ]
      : []),
  ];
  const rows: { key: string; cx: number; w: number; text: string; primary: boolean }[][] = [[], []];
  if (W > 0)
    for (const m of marks) {
      const w = m.text.length * CH;
      const cx = Math.min(Math.max(X(m.v), w / 2), W - w / 2);
      const row = rows.find((r) => r.every((o) => Math.abs(o.cx - cx) >= (o.w + w) / 2 + 10));
      row?.push({ key: m.key, cx, w, text: m.text, primary: m.primary });
    }
  const used = rows.filter((r) => r.length).length;
  const TRACK = 30;
  const LABELS = 52;
  const AXIS = LABELS + used * 16 + 4;
  const H = AXIS + 14;
  const ticks = [0, max / 2, max];
  const priceText_ = `Price ${priceText(price.value)}${priceStale ? ` · ${formatShortDate(price.asOf)}, ${priceAgeDays} days old` : ''}`;
  const priceRight = W > 0 && X(price.value) + 8 + priceText_.length * CH > W;
  return (
    <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
      <Box
        ref={ref}
        role="img"
        aria-label={label}
        sx={{ position: 'relative', height: H, ...MONO }}
      >
        {W > 0 && (
          <>
            <Box
              component="span"
              sx={{
                position: 'absolute',
                top: 0,
                left: X(price.value),
                fontSize: 11,
                lineHeight: '14px',
                whiteSpace: 'nowrap',
                color: priceStale ? 'text.secondary' : 'text.primary',
                transform: priceRight ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
              }}
            >
              {priceText_}
            </Box>
            <Box
              sx={(t) => ({
                position: 'absolute',
                left: 0,
                right: 0,
                top: TRACK - 1,
                height: 2,
                bgcolor: chartRoles(t).grid,
              })}
            />
            <Box
              sx={(t) => ({
                position: 'absolute',
                top: TRACK - 10,
                height: 20,
                left: X(lo),
                width: Math.max(2, X(hi) - X(lo)),
                boxSizing: 'border-box',
                borderRadius: '3px',
                bgcolor: chartRoles(t).band,
                borderLeft: `1.5px solid ${chartRoles(t).edge}`,
                borderRight: `1.5px solid ${chartRoles(t).edge}`,
              })}
            />
            {data.weighted !== null && (
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  top: TRACK - 14,
                  left: X(data.weighted ?? 0) - 1.5,
                  width: 3,
                  height: 28,
                  borderRadius: '2px',
                  bgcolor: chartRoles(t).ctx,
                })}
              />
            )}
            {/* The base case: the one amber mark on the page. */}
            <Box
              sx={(t) => ({
                position: 'absolute',
                top: TRACK - 8,
                left: X(values.base) - 8,
                width: 16,
                height: 16,
                transform: 'rotate(45deg)',
                bgcolor: 'primary.main',
                borderRadius: '2px',
                boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
              })}
            />
            <Box
              sx={(t) => ({
                position: 'absolute',
                left: X(price.value) - 1,
                top: 14,
                height: LABELS - 14,
                borderLeft: priceStale
                  ? `2px dashed ${chartRoles(t).ctx}`
                  : `2px solid ${chartRoles(t).emph}`,
              })}
            />
            {rows.map((r, i) =>
              r.map((l) => (
                <Box
                  key={l.key}
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: LABELS + i * 16,
                    left: l.cx - l.w / 2,
                    width: l.w,
                    textAlign: 'center',
                    fontSize: 11,
                    lineHeight: '14px',
                    whiteSpace: 'nowrap',
                    color: l.primary ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {l.text}
                </Box>
              )),
            )}
            {ticks.map((v, i) => (
              <Box
                key={v}
                component="span"
                aria-hidden
                sx={{
                  position: 'absolute',
                  top: AXIS,
                  left: X(v),
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticks.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  fontSize: 11,
                  lineHeight: '14px',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {tickMoney(v)}
              </Box>
            ))}
          </>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 18px',
          fontSize: 13,
          pt: 1.25,
          borderTop: 1,
          borderColor: 'divider',
          color: 'text.secondary',
        }}
      >
        {priceStale ? (
          <span>
            % to base hidden: the price is {priceAgeDays} days old. The range doesn't depend on it.
          </span>
        ) : (
          <>
            <Box component="span" sx={{ color: 'text.primary' }}>
              <Signed value={toBase} /> from the {formatShortDate(price.asOf)} price to base
            </Box>
            <span>
              Range <Signed value={((lo - price.value) / price.value) * 100} /> to{' '}
              <Signed value={((hi - price.value) / price.value) * 100} />
            </span>
          </>
        )}
        {data.weighted === null && <span>Scenario odds not set</span>}
      </Box>
    </Box>
  );
}

/** The note's valuation section body. */
export function ValuationBlockView({ block: v }: { block: ValuationBlock }) {
  const { freshness } = useNoteContext();
  const stale = freshness.priceStale;
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, fontSize: 12, color: 'text.secondary' }}
      >
        <Box component="span" sx={{ ...PANEL_SX, borderRadius: '8px', px: 1.25, py: 0.5 }}>
          Method · {v.method}
        </Box>
        {v.why && (
          <Box component="span" sx={{ ...PANEL_SX, borderRadius: '8px', px: 1.25, py: 0.5 }}>
            Why · <NoteInlines nodes={v.why} />
          </Box>
        )}
      </Box>
      <FootballField v={v} stale={stale} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 1.5,
        }}
      >
        {NAMES.map((name) => (
          <ScenarioCard key={name} v={v} name={name} stale={stale} />
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 1.5,
        }}
      >
        <Odds v={v} stale={stale} />
        {v.result.sensitivity && <Sensitivity v={v} stale={stale} />}
      </Box>
      <Assumptions v={v} />
    </Box>
  );
}

/**
 * Value per share by method (RN-08): each method's range solid to its ends, its base case a phosphor
 * tick, a third party's figure a dotted box (dotted is a third party's mark, P-8), and the dated price
 * the line through every row. Labels sit beside the ends they name; the axis keeps three ticks on a
 * phone, and the legend names every mark.
 */
function FootballField({ v, stale }: { v: ValuationBlock; stale: boolean }) {
  const frame = useNoteFrame('football');
  const r = v.result;
  const sens = r.sensitivity ? r.sensitivity.cells.flat().map((c) => c.value) : [];
  const rows: {
    label: string;
    sub: string;
    lo: number | null;
    hi: number | null;
    mark: number | null;
    kind: 'model' | 'trade' | 'third';
  }[] = [
    {
      label: 'Scenario model',
      sub: 'bear to bull · tick = base',
      lo: r.range.lo,
      hi: r.range.hi,
      mark: r.scenarios.base.value,
      kind: 'model',
    },
  ];
  if (sens.length && r.sensitivity)
    rows.push({
      label: 'Sensitivity grid',
      sub: `${INPUT_LABEL[r.sensitivity.row.key] ?? r.sensitivity.row.key} × ${(INPUT_LABEL[r.sensitivity.col.key] ?? r.sensitivity.col.key).toLowerCase()}`,
      lo: Math.min(...sens),
      hi: Math.max(...sens),
      mark: r.scenarios.base.value,
      kind: 'model',
    });
  if (v.traded)
    rows.push({
      label: 'Where it has traded',
      sub: v.traded.when.label,
      lo: v.traded.lo,
      hi: v.traded.hi,
      mark: null,
      kind: 'trade',
    });
  if (v.thirdParty)
    rows.push({
      label: 'Third party',
      sub: `${v.thirdParty.label}, ${formatShortDate(v.thirdParty.asOf)}`,
      lo: null,
      hi: null,
      mark: v.thirdParty.value,
      kind: 'third',
    });
  const max = axisMax([...rows.flatMap((x) => [x.hi ?? 0, x.mark ?? 0]), v.price.value]);
  const ticks = [0, max / 2, max];
  // A valuation method's figures against the price: the traded range is where the price has been,
  // not a value, so it never counts toward the finding.
  const methods = rows.filter((x) => x.kind !== 'trade');
  const lows = methods.map((x) => x.lo ?? x.mark ?? 0);
  const highs = methods.map((x) => x.hi ?? x.mark ?? 0);
  const p = v.price.value;
  const finding = stale
    ? `Value per share runs from ${money(Math.min(...lows))} to ${money(Math.max(...highs))} across the methods`
    : lows.every((x) => x > p)
      ? `Every method puts value above the ${priceText(p)} price`
      : highs.every((x) => x < p)
        ? `Every method puts value below the ${priceText(p)} price`
        : `The methods straddle the ${priceText(p)} price`;
  const legendItems: [string, (t: Theme) => object][] = [
    [
      'Range',
      (t) => ({ bgcolor: chartRoles(t).band, border: `1.5px solid ${chartRoles(t).edge}` }),
    ],
    ['Base case', (t) => ({ width: 4, bgcolor: chartRoles(t).emph })],
    ...(v.thirdParty
      ? ([
          [
            'A third party’s figure',
            (t: Theme) => ({ border: `1.5px dotted ${chartRoles(t).emph}` }),
          ],
        ] as [string, (t: Theme) => object][])
      : []),
    [
      `Price ${priceText(p)}, ${formatShortDate(v.price.asOf)}${stale ? ', over 30 days old' : ''}`,
      (t) => ({
        width: 2,
        height: 14,
        borderLeft: `2px ${stale ? 'dashed' : 'solid'} ${chartRoles(t).emph}`,
      }),
    ],
  ];
  const LABEL_COL = { xs: 'minmax(0, 1fr)', sm: '190px minmax(0, 1fr)' };
  const [axisRef, TW] = useWidth<HTMLDivElement>();
  return (
    <ChartFrame
      {...frame}
      finding={finding}
      metric="Value per share by method"
      sub="Value per share by method · $ · each method’s range, its base case, and the price"
      height={rows.length * 48 + 20}
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
          {legendItems.map(([name, sx]) => (
            <Box
              key={name}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <Box
                component="span"
                aria-hidden
                sx={(t) => ({
                  width: 12,
                  height: 10,
                  borderRadius: '2px',
                  boxSizing: 'border-box',
                  ...sx(t),
                })}
              />
              {name}
            </Box>
          ))}
        </Box>
      }
      table={{
        caption: 'Value per share by method',
        cols: ['Method', 'Low', 'High', 'Mark'],
        rows: rows.map((x) => [
          `${x.label} (${x.sub})`,
          x.lo !== null ? money(x.lo) : '—',
          x.hi !== null ? money(x.hi) : '—',
          x.mark !== null ? money(x.mark) : '—',
        ]),
      }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        {rows.map((row) => (
          <Box
            key={row.label}
            role="img"
            aria-label={`${row.label}: ${row.lo !== null && row.hi !== null ? `${money(row.lo)} to ${money(row.hi)}` : ''}${row.mark !== null ? `${row.lo !== null ? ', ' : ''}${row.kind === 'third' ? 'figure' : 'base'} ${money(row.mark)}` : ''}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: LABEL_COL,
              gap: { xs: 0.25, sm: 1.75 },
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', fontSize: 13, lineHeight: 1.3 }}>
              <Box
                component="span"
                sx={{
                  fontWeight: row.kind === 'model' ? 600 : 400,
                  color: row.kind === 'model' ? 'text.primary' : 'text.secondary',
                }}
              >
                {row.label}
              </Box>
              <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {row.sub}
              </Box>
            </Box>
            <Box
              sx={{
                position: 'relative',
                height:
                  TW > 0 && endLabels(row.lo, row.hi, row.mark, TW, max).some((l) => l.below)
                    ? 42
                    : 30,
              }}
            >
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 14,
                  height: 2,
                  bgcolor: chartRoles(t).grid,
                })}
              />
              {row.lo !== null && row.hi !== null && (
                <Box
                  sx={(t) => ({
                    position: 'absolute',
                    top: 8,
                    height: 14,
                    borderRadius: '3px',
                    boxSizing: 'border-box',
                    left: at(row.lo ?? 0, max),
                    width: `${Math.max(1, (((row.hi ?? 0) - (row.lo ?? 0)) / max) * 100)}%`,
                    bgcolor: row.kind === 'model' ? chartRoles(t).band : 'transparent',
                    border: `1.5px solid ${row.kind === 'model' ? chartRoles(t).edge : chartRoles(t).ctx}`,
                  })}
                />
              )}
              {row.mark !== null && (
                <Box
                  sx={(t) => ({
                    position: 'absolute',
                    top: 5,
                    height: 20,
                    left: at(row.mark ?? 0, max),
                    ...(row.kind === 'third'
                      ? {
                          width: 10,
                          ml: '-5px',
                          border: `1.5px dotted ${chartRoles(t).emph}`,
                          boxSizing: 'border-box',
                          borderRadius: '2px',
                        }
                      : { width: 4, ml: '-2px', borderRadius: '2px', bgcolor: chartRoles(t).emph }),
                  })}
                />
              )}
              {TW > 0 &&
                endLabels(row.lo, row.hi, row.mark, TW, max).map((l) => (
                  <Box
                    key={l.text}
                    component="span"
                    sx={{
                      ...MONO,
                      position: 'absolute',
                      top: l.below ? 26 : 8,
                      left: l.left,
                      fontSize: 11,
                      lineHeight: '14px',
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l.text}
                  </Box>
                ))}
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  left: at(p, max),
                  top: -4,
                  bottom: -4,
                  borderLeft: `2px ${stale ? 'dashed' : 'solid'} ${chartRoles(t).emph}`,
                })}
              />
            </Box>
          </Box>
        ))}
        <Box sx={{ display: 'grid', gridTemplateColumns: LABEL_COL, gap: 1.75, mt: 0.5 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box
            ref={axisRef}
            aria-hidden
            sx={{
              position: 'relative',
              height: 16,
              ...MONO,
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            {ticks.map((tk, i) => (
              <Box
                component="span"
                key={tk}
                sx={{
                  position: 'absolute',
                  left: at(tk, max),
                  whiteSpace: 'nowrap',
                  transform:
                    i === 0
                      ? 'none'
                      : i === ticks.length - 1
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                }}
              >
                {tickMoney(tk)}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </ChartFrame>
  );
}

/**
 * Where a football-field row's figures go, in pixels on a track `tw` wide. Each end beside its end,
 * outside the band, when both fit; otherwise under the band, low end left-aligned to it and high end
 * right-aligned, or one centred "lo–hi" when the band is too short for two. Never inside the band,
 * where the base tick and the price line run. A single figure (a third party's) sits right of its
 * mark, or left when the right is short. Nothing is placed past the track.
 */
function endLabels(
  lo: number | null,
  hi: number | null,
  mark: number | null,
  tw: number,
  max: number,
) {
  const X = (v: number) => (Math.min(max, Math.max(0, v)) / max) * tw;
  const w = (t: string) => t.length * CH;
  const GAP = 6;
  const fit = (left: number, t: string) => Math.min(Math.max(0, left), tw - w(t));
  if (lo === null || hi === null) {
    if (mark === null) return [];
    const t = money(mark);
    const right = X(mark) + 10;
    return [
      { text: t, left: right + w(t) <= tw ? right : fit(X(mark) - 10 - w(t), t), below: false },
    ];
  }
  const a = money(lo);
  const b = money(hi);
  if (X(lo) - GAP - w(a) >= 0 && X(hi) + GAP + w(b) <= tw)
    return [
      { text: a, left: X(lo) - GAP - w(a), below: false },
      { text: b, left: X(hi) + GAP, below: false },
    ];
  const la = fit(X(lo), a);
  const lb = fit(X(hi) - w(b), b);
  if (la + w(a) + 8 <= lb)
    return [
      { text: a, left: la, below: true },
      { text: b, left: lb, below: true },
    ];
  const c = `${a}–${b}`;
  return [{ text: c, left: fit((X(lo) + X(hi) - w(c)) / 2, c), below: true }];
}

function inputChips(v: ValuationBlock, name: ScenarioName) {
  const s = v.scenarios.find((x) => x.name === name)?.inputs;
  if (!s) return [];
  const chips: string[] = [];
  if (s.rev_y1 !== null) chips.push(`yr-1 rev ${millions(s.rev_y1)}`);
  chips.push(`growth ${rate(s.growth)}`, `margin ${rate(s.margin_target)}`, `WACC ${rate(s.wacc)}`);
  if (s.p_fail > 0) chips.push(`failure ${rate(s.p_fail)}`);
  return chips;
}

function ScenarioCard({
  v,
  name,
  stale,
}: {
  v: ValuationBlock;
  name: ScenarioName;
  stale: boolean;
}) {
  const r = v.result.scenarios[name];
  const story = v.scenarios.find((x) => x.name === name)?.story ?? [];
  return (
    <Panel
      sx={(t) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        borderColor: name === 'base' ? alpha(t.palette.text.primary, 0.35) : 'divider',
      })}
    >
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}
      >
        <Box component="span" sx={{ fontWeight: 600 }}>
          {TITLE[name]}
        </Box>
        {!stale && (
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            <Signed value={r.vsPrice} /> vs price
          </Box>
        )}
      </Box>
      <Box component="span" sx={{ ...MONO, fontSize: 30, fontWeight: 500, lineHeight: 1.1 }}>
        {money(r.value)}
      </Box>
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}>
        <NoteInlines nodes={story} />
      </Box>
      {r.goingConcern === 0 && (
        <Box component="span" sx={{ fontSize: 12, lineHeight: 1.5 }}>
          The enterprise value ({millions(r.ev)}) is below net debt of {millions(-v.netCash.value)},
          so nothing is left for shareholders in this case.
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          pt: 1,
          mt: 'auto',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {inputChips(v, name).map((c) => (
          <Box
            key={c}
            component="span"
            sx={(t) => ({
              ...MONO,
              px: 1,
              py: '2px',
              borderRadius: '6px',
              bgcolor: alpha(t.palette.background.default, 0.6),
              fontSize: 11,
            })}
          >
            {c}
          </Box>
        ))}
      </Box>
    </Panel>
  );
}

/** Each scenario's cells: ordered context steps, base the claim's phosphor (P-9). The group labels
 *  above the cells carry the scenario, so no cell's meaning rests on its shade (RN-09). */
const ODDS_TONE: Record<ScenarioName, (t: Theme) => string> = {
  bear: (t) => chartRoles(t).ctx2,
  base: (t) => chartRoles(t).emph,
  bull: (t) => chartRoles(t).ctx,
};

function Odds({ v, stale }: { v: ValuationBlock; stale: boolean }) {
  const frame = useNoteFrame('odds');
  const odds = v.odds;
  const weighted = v.result.weighted;
  const finding = odds
    ? `The note gives the base case ${odds[1]} in 20${odds[1] > 10 ? ', better than even' : odds[1] === 10 ? ', even odds' : ''}`
    : 'Scenario odds';
  return (
    <ChartFrame
      {...frame}
      finding={finding}
      metric="Scenario odds"
      sub="Scenario odds, in twentieths · each cell is 1 in 20"
      height={64}
      status={
        odds
          ? { kind: 'ready' }
          : {
              kind: 'message',
              tone: 'quiet',
              text: 'This note sets no odds.',
              cause:
                'Write odds: 5/11/4 (bear/base/bull in twentieths) and the cells fill, with the weighted value marked on the price-vs-value strip.',
            }
      }
      action={odds ? undefined : <YourCall label="not set" />}
      table={
        odds
          ? {
              caption: 'Scenario odds in twentieths',
              cols: ['Scenario', 'In 20', 'Value'],
              rows: NAMES.map((name, i) => [
                TITLE[name],
                odds[i],
                money(v.result.scenarios[name].value),
              ]),
            }
          : undefined
      }
      note={
        odds && weighted ? (
          <>
            Weighted{' '}
            <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
              {money(weighted.value)}
            </Box>
            {!stale && (
              <>
                {' '}
                (<Signed value={weighted.vsPrice} /> vs price)
              </>
            )}
          </>
        ) : undefined
      }
    >
      {odds && (
        <Box
          role="img"
          aria-label={`Bear ${odds[0]}, base ${odds[1]}, bull ${odds[2]} in 20`}
          sx={{
            display: 'grid',
            gridTemplateColumns: NAMES.map((_, i) => `${Math.max(odds[i], 0.0001)}fr`).join(' '),
            columnGap: '3px',
            rowGap: 0.75,
          }}
        >
          {NAMES.map((name, i) =>
            odds[i] > 0 ? (
              <Box
                key={`l-${name}`}
                component="span"
                sx={{
                  gridRow: 1,
                  fontSize: 12,
                  lineHeight: 1.3,
                  minWidth: 0,
                  color: name === 'base' ? 'text.primary' : 'text.secondary',
                  fontWeight: name === 'base' ? 600 : 400,
                }}
              >
                {TITLE[name]} · {odds[i]}
              </Box>
            ) : (
              <span key={`l-${name}`} />
            ),
          )}
          {NAMES.map((name, i) => (
            <Box
              key={name}
              sx={{
                gridRow: 2,
                display: 'grid',
                gridTemplateColumns: `repeat(${odds[i]}, minmax(0, 1fr))`,
                gap: '3px',
              }}
            >
              {Array.from({ length: odds[i] }, (_, k) => (
                <Box
                  key={k}
                  sx={(t) => ({ height: 22, borderRadius: '3px', bgcolor: ODDS_TONE[name](t) })}
                />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </ChartFrame>
  );
}

/** "20%" → 0.2, "1.5" → 1.5: an axis label back to the number it stands for. */
const labelValue = (label: string) =>
  label.trim().endsWith('%')
    ? Number(label.trim().slice(0, -1)) / 100
    : Number(label.replace(/[$,]/g, ''));

function baseInput(v: ValuationBlock, key: string): number | null {
  const base = v.scenarios.find((s) => s.name === 'base')?.inputs as
    Record<string, number | null> | undefined;
  if (base && key in base) return base[key];
  const globals: Record<string, number> = {
    terminal_tax: v.terminalTax,
    terminal_growth: v.terminalGrowth,
    terminal_wacc: v.terminalWacc,
    terminal_roc: v.terminalRoc,
    tax: v.tax,
    margin_year: v.marginYear,
  };
  return globals[key] ?? null;
}

/** The base value as two inputs move (RN-10): a real table, the base case outlined, each cell's
 *  distance from the price as its shade and as a signed figure (never the shade alone). */
function Sensitivity({ v, stale }: { v: ValuationBlock; stale: boolean }) {
  const frame = useNoteFrame('sensitivity');
  const s = v.result.sensitivity;
  if (!s) return null;
  const rowBase = baseInput(v, s.row.key);
  const colBase = baseInput(v, s.col.key);
  const isBase = (label: string, base: number | null) =>
    base !== null && Math.abs(labelValue(label) - base) < 1e-9;
  const rowName = INPUT_LABEL[s.row.key] ?? s.row.key;
  const colName = (INPUT_LABEL[s.col.key] ?? s.col.key).toLowerCase();
  const all = s.cells.flat().map((c) => c.value);
  const p = v.price.value;
  const finding = stale
    ? `The base value runs from ${money(Math.min(...all))} to ${money(Math.max(...all))} across the grid`
    : all.every((x) => x > p)
      ? 'The base value stays above the price across the grid'
      : all.every((x) => x < p)
        ? 'The base value stays below the price across the grid'
        : `The base value crosses the ${priceText(p)} price within the grid`;
  return (
    <ChartFrame
      {...frame}
      finding={finding}
      metric="Sensitivity of the base value"
      sub={`Base value per share · rows: ${rowName.toLowerCase()} · columns: ${colName}${stale ? '' : ' · signed vs the price'}`}
      height={150}
      note="Shading grows with distance from the price; the sign gives the direction. Outlined: the base case."
    >
      <Box
        role="region"
        aria-label="Sensitivity of the base value"
        tabIndex={0}
        sx={{ overflowX: 'auto', minWidth: 0 }}
      >
        <Box
          component="table"
          sx={{
            borderCollapse: 'separate',
            borderSpacing: '4px',
            width: '100%',
            ...MONO,
            fontSize: 12,
            '& th': { fontWeight: 400, color: 'text.secondary', fontSize: 11, py: 0.75, px: 0.5 },
            '& thead th': { textAlign: 'center' },
            '& tbody th': { textAlign: 'left', whiteSpace: 'nowrap' },
          }}
        >
          <thead>
            <tr>
              <Box component="th" scope="col" sx={{ textAlign: 'left !important' }}>
                {rowName}
              </Box>
              {s.col.labels.map((l) => (
                <th key={l} scope="col">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.cells.map((row, ri) => (
              <tr key={ri}>
                <th scope="row">{s.row.labels[ri]}</th>
                {row.map((cell, ci) => {
                  const base =
                    isBase(s.row.labels[ri], rowBase) && isBase(s.col.labels[ci], colBase);
                  return (
                    <Box
                      component="td"
                      key={ci}
                      sx={(t) => ({
                        textAlign: 'center',
                        py: 0.75,
                        borderRadius: '6px',
                        lineHeight: 1.3,
                        bgcolor: alpha(
                          t.palette.text.primary,
                          stale ? 0.06 : Math.min(0.26, 0.05 + Math.abs(cell.vsPrice) / 220),
                        ),
                        boxShadow: base ? `inset 0 0 0 1.5px ${t.palette.text.primary}` : 'none',
                      })}
                    >
                      <Box component="span" sx={{ display: 'block' }}>
                        {money(cell.value)}
                      </Box>
                      {!stale && (
                        // Primary, not secondary: on the deepest cell tint secondary measures 2.94:1
                        // (dark), primary 6.55:1. The smaller size carries the hierarchy.
                        <Box
                          component="span"
                          sx={{ display: 'block', fontSize: 11, color: 'text.primary' }}
                        >
                          {cell.vsPrice >= 0 ? '+' : '−'}
                          {percent(cell.vsPrice)}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </ChartFrame>
  );
}

function Assumptions({ v }: { v: ValuationBlock }) {
  const keys = [
    'rev_y1',
    'reinvest_y1',
    'growth',
    'margin_y1',
    'margin_target',
    'sales_to_capital',
    'wacc',
    'p_fail',
    'distress',
  ] as const;
  const show = (key: (typeof keys)[number], value: number | null) => {
    if (value === null) return '—';
    if (key === 'rev_y1' || key === 'reinvest_y1') return millions(value);
    if (key === 'distress') return money(value);
    if (key === 'sales_to_capital') return value.toFixed(2);
    return rate(value);
  };
  const used = keys.filter((k) => v.scenarios.some((s) => s.inputs[k] !== null));
  const fact = (label: string, d: Dated | null, render: (n: number) => string) =>
    d && (
      <Box component="li" key={label}>
        {label}:{' '}
        <Box component="span" sx={MONO}>
          {render(d.value)}
        </Box>{' '}
        <Box component="span" sx={{ color: 'text.secondary' }}>
          @ {formatAsOf(d.asOf)}
        </Box>
      </Box>
    );
  return (
    <Box
      component="details"
      sx={{
        ...PANEL_SX,
        '& > summary': { listStyle: 'none' },
        '& > summary::-webkit-details-marker': { display: 'none' },
      }}
    >
      <Box
        component="summary"
        sx={{
          cursor: 'pointer',
          px: 2,
          py: 1.5,
          minHeight: 44,
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        How the model works, and every input
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          Show ▾
        </Box>
      </Box>
      <Box sx={{ px: 2, pb: 2, display: 'grid', gap: 1.75, fontSize: 13, lineHeight: 1.6 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            component="table"
            sx={{
              borderCollapse: 'collapse',
              width: '100%',
              minWidth: 420,
              '& th, & td': {
                textAlign: 'left',
                py: 0.75,
                px: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
              },
              '& th': { color: 'text.secondary', fontWeight: 500, fontSize: 12 },
            }}
          >
            <thead>
              <tr>
                <th scope="col">Input</th>
                {NAMES.map((n) => (
                  <th scope="col" key={n}>
                    {TITLE[n]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {used.map((k) => (
                <tr key={k}>
                  <th scope="row">{INPUT_LABEL[k]}</th>
                  {NAMES.map((n) => (
                    <Box component="td" key={n} sx={MONO}>
                      {show(k, v.scenarios.find((s) => s.name === n)?.inputs[k] ?? null)}
                    </Box>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.25 }}>
          {fact('Revenue, year 0', v.revenue, millions)}
          {fact('Operating margin now', v.marginNow, rate)}
          {fact('Shares, diluted', v.shares, (n) => `${n.toLocaleString('en-US')}M`)}
          {fact('Net cash (debt if negative)', v.netCash, millions)}
          {fact('Losses carried forward', v.nol, millions)}
          <li>
            Tax{' '}
            <Box component="span" sx={MONO}>
              {rate(v.tax)}
            </Box>{' '}
            {v.terminalTax !== v.tax && (
              <>
                · terminal tax{' '}
                <Box component="span" sx={MONO}>
                  {rate(v.terminalTax)}
                </Box>{' '}
              </>
            )}
            · terminal growth{' '}
            <Box component="span" sx={MONO}>
              {rate(v.terminalGrowth)}
            </Box>{' '}
            · terminal cost of capital{' '}
            <Box component="span" sx={MONO}>
              {rate(v.terminalWacc)}
            </Box>{' '}
            · terminal return on capital{' '}
            <Box component="span" sx={MONO}>
              {rate(v.terminalRoc)}
            </Box>{' '}
            · margin reached in year{' '}
            <Box component="span" sx={MONO}>
              {v.marginYear}
            </Box>
          </li>
        </Box>
        <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
          A 10-year free-cash-flow model. Revenue grows at the scenario's rate through year 5 (year
          1 is set directly when given), then fades to the terminal rate by year 10. The operating
          margin moves in a straight line to its target, then holds. Taxes apply after losses
          carried forward; reinvestment is new revenue divided by sales-to-capital, except that year
          1 can state its own (a jump that comes from prices, not capacity, needs less capital). The
          cost of capital moves to its terminal level over years 6–10. Value per share is the
          enterprise value plus net cash, over diluted shares, then weighted by the chance of
          failure against the value in distress. Every output on this page is computed from these
          inputs when the site builds.
        </Box>
      </Box>
    </Box>
  );
}

/** Mauboussin, The Base Rate Book (Credit Suisse, 2016): sales growth, top 1,000 global companies
 *  1950–2015, inflation-adjusted. "45%+" is open-ended: drawn with an arrow end, never as exactly 45. */
const BASE_RATES = [
  { label: 'Median company, 3 years', value: 5.4, shown: '5.4%', open: false },
  { label: 'Top 2.5% of 3-year runs', value: 45, shown: '45%+', open: true },
  { label: 'Top 1.3% of 5-year runs', value: 45, shown: '45%+', open: true },
];

const signedPct = (v: number) => `${v < 0 ? '−' : ''}${percent(v)}`;

/** "What the price implies": enterprise value, the steady-state share, and the growth it needs. */
export function ImpliedBlockView() {
  const { valuation: v, freshness } = useNoteContext();
  const frame = useNoteFrame('implied');
  if (!v) return null;
  const i = v.result.implied;
  const lo = Math.min(0, i.growth ?? 0);
  const hi = Math.max(i.growth ?? 0, 45) * 1.12;
  const today = Math.round(i.steadyStateShare);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 1.5,
      }}
    >
      <Panel sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
        <Box component="span" sx={{ fontSize: 17, lineHeight: 1.45 }}>
          At {priceText(v.price.value)} ({formatShortDate(v.price.asOf)}
          {freshness.priceStale ? ', over 30 days ago' : ''}) the market values the business at{' '}
          <Box component="span" sx={{ ...MONO, fontWeight: 600 }}>
            {millions(i.ev)}
          </Box>{' '}
          of enterprise value:{' '}
          <Box component="span" sx={{ ...MONO, fontWeight: 600 }}>
            {i.evToRevenue.toFixed(1)}×
          </Box>{' '}
          its revenue ({millions(v.revenue.value)}, {formatAsOf(v.revenue.asOf)}).
        </Box>
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            Where the price sits
          </Box>
          <Box
            role="img"
            aria-label={`Today's profit, capitalized, supports ${today}% of the price; future growth has to earn the other ${100 - today}%`}
            sx={{ display: 'flex', gap: '2px', height: 16 }}
          >
            <Box
              sx={(t) => ({
                width: `${Math.max(2, i.steadyStateShare)}%`,
                borderRadius: '4px',
                bgcolor: chartRoles(t).ctx,
              })}
            />
            <Box
              sx={(t) => ({
                flex: 1,
                borderRadius: '4px',
                boxSizing: 'border-box',
                bgcolor: chartRoles(t).band,
                border: `1.5px solid ${chartRoles(t).edge}`,
              })}
            />
          </Box>
          {/* The labels sit under the bar: inside a segment they clip whenever its share is small. */}
          <Box
            aria-hidden
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 2,
              rowGap: 0.5,
              fontSize: 12,
              color: 'text.secondary',
            }}
          >
            {[
              { name: 'today', share: today, fill: (t: Theme) => ({ bgcolor: chartRoles(t).ctx }) },
              {
                name: 'future growth',
                share: 100 - today,
                fill: (t: Theme) => ({
                  bgcolor: chartRoles(t).band,
                  border: `1.5px solid ${chartRoles(t).edge}`,
                }),
              },
            ].map((x) => (
              <Box
                key={x.name}
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
              >
                <Box
                  component="span"
                  sx={(t) => ({
                    width: 10,
                    height: 10,
                    borderRadius: '2px',
                    boxSizing: 'border-box',
                    ...x.fill(t),
                  })}
                />
                {x.name}{' '}
                <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
                  {x.share}%
                </Box>
              </Box>
            ))}
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
            "Today" is current operating profit after tax, capitalized at the base cost of capital,
            plus net cash (Mauboussin's steady-state value). The rest of the price is a bet on
            growth.
          </Box>
        </Box>
      </Panel>
      <ChartFrame
        {...frame}
        finding={
          i.growth !== null
            ? `The price implies ${signedPct(i.growth)} a year of revenue growth (${i.growthYears})`
            : 'No growth rate reaches this price'
        }
        metric="Growth the price implies"
        sub="Revenue growth the price implies, against how often companies achieved it · % a year"
        height={140}
        note={
          <>
            {i.growth === null &&
              (!i.growthAddsValue
                ? 'At base inputs new capital earns less than it costs, so faster growth lowers the value instead of raising it. '
                : i.bound === 'above'
                  ? 'No growth rate up to 300% a year reaches this price. '
                  : 'Even shrinking 50% a year leaves the base case above this price. ')}
            Implied: the base case solved for revenue growth, every other input held. Base rates:
            annual sales growth of the top 1,000 global companies, 1950–2015, after inflation
            (Mauboussin, The Base Rate Book, 2016). The implied rate is before inflation, so the
            comparison flatters the company slightly. “45%+” is open-ended (the arrow), not 45.
          </>
        }
        table={{
          caption: 'Implied growth against base rates, % a year',
          cols: ['Rate', '% a year'],
          rows: [
            ...(i.growth !== null
              ? [[`This price implies (${i.growthYears})`, `${signedPct(i.growth)}`]]
              : []),
            ...BASE_RATES.map((b) => [b.label, b.shown]),
          ],
        }}
      >
        <Box
          role="img"
          aria-label={`${i.growth === null ? 'No growth rate in range reaches the price' : `The price implies ${signedPct(i.growth)} a year, ${i.growthYears}`}; base rates: median 5.4%, top 2.5% of 3-year runs 45% or more`}
          sx={{ display: 'grid', gap: 1 }}
        >
          {i.growth !== null && (
            <RateBar
              label={`This price implies (${i.growthYears})`}
              value={i.growth}
              shown={`${signedPct(i.growth)}/yr`}
              lo={lo}
              hi={hi}
              emph
            />
          )}
          {BASE_RATES.map((b) => (
            <RateBar
              key={b.label}
              label={b.label}
              value={b.value}
              shown={b.shown}
              lo={lo}
              hi={hi}
              open={b.open}
            />
          ))}
        </Box>
      </ChartFrame>
    </Box>
  );
}

/** One rate on a shared scale from zero: below-zero growth runs left of the zero line, and an
 *  open-ended rate ends in an arrow instead of a square end (RN-11). */
function RateBar({
  label,
  value,
  shown,
  lo,
  hi,
  emph = false,
  open = false,
}: {
  label: string;
  value: number;
  shown: string;
  lo: number;
  hi: number;
  emph?: boolean;
  open?: boolean;
}) {
  const P = (x: number) => ((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100;
  const zero = P(0);
  const end = P(value);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr) 64px',
        gap: 1.25,
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <Box
        component="span"
        sx={{ color: emph ? 'text.primary' : 'text.secondary', fontWeight: emph ? 600 : 400 }}
      >
        {label}
      </Box>
      <Box sx={{ position: 'relative', height: 16 }}>
        <Box
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
            top: 2,
            height: 12,
            left: `${Math.min(zero, end)}%`,
            width: `max(2px, ${Math.abs(end - zero)}%)`,
            borderRadius: value >= 0 ? '0 3px 3px 0' : '3px 0 0 3px',
            bgcolor: emph ? chartRoles(t).emph : chartRoles(t).ctx,
          })}
        />
        {open && (
          <Box
            aria-hidden
            sx={(t) => ({
              position: 'absolute',
              top: 0,
              left: `${end}%`,
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: `9px solid ${emph ? chartRoles(t).emph : chartRoles(t).ctx}`,
            })}
          />
        )}
      </Box>
      <Box component="span" sx={{ ...MONO, textAlign: 'right' }}>
        {shown}
      </Box>
    </Box>
  );
}
