/**
 * The valuation's visuals: the price-vs-value strip, the football field, scenario cards, odds in
 * twentieths, the sensitivity grid, the assumptions, and "what the price implies". Every number here
 * arrives computed by the build (tools/research-notes/valuation.mjs); this file only draws.
 *
 * Uncertainty is shown, not hidden: ranges have soft ends, the base case is one mark inside a band,
 * and any figure measured against the price disappears once the price is 30 days old.
 */
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
import { Eyebrow, MONO, Panel, PANEL_SX, YourCall } from '../ui';

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

/** Signed change, arrow first, hue second: "▼ 13%". */
export function Signed({ value }: { value: number }) {
  return (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: value >= 0 ? 'success.main' : 'error.main' }}>
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

const band = (t: Theme, strength = 0.62) => {
  const c = t.palette.info.main;
  return `linear-gradient(90deg, ${alpha(c, 0)} 0%, ${alpha(c, strength * 0.5)} 12%, ${alpha(c, strength)} 38%, ${alpha(c, strength * 0.5)} 75%, ${alpha(c, 0)} 100%)`;
};

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

/**
 * Price against the value range: a soft-edged bear-to-bull band, the base case as one mark inside it,
 * and today's line at the dated price. `priceAgeDays` past 30 dashes the line and drops every figure
 * measured against it; the range itself stays, because it doesn't depend on the price.
 */
export function PriceValueStrip({
  data,
  uncertainty,
  priceAgeDays,
  priceStale,
  compact = false,
}: {
  data: StripData;
  uncertainty: Uncertainty | null;
  priceAgeDays: number | null;
  priceStale: boolean;
  compact?: boolean;
}) {
  const { price, values } = data;
  const lo = Math.min(values.bear, values.base, values.bull);
  const hi = Math.max(values.bear, values.base, values.bull);
  const max = axisMax([hi, price.value]);
  const lp = (lo / max) * 100;
  const hp = (hi / max) * 100;
  const bp = (values.base / max) * 100;
  const crowded = bp - lp < 18 || hp - bp < 18;
  const toBase = ((values.base - price.value) / price.value) * 100;
  const label =
    `Value range ${money(values.bear)} bear to ${money(values.bull)} bull, base ${money(values.base)}; ` +
    `price ${priceText(price.value)} on ${formatShortDate(price.asOf)}` +
    (priceStale
      ? `, ${priceAgeDays} days old`
      : `, ${Math.abs(Math.round(toBase))}% ${toBase >= 0 ? 'below' : 'above'} the base case`);
  const H = compact ? 44 : 64;
  return (
    <Box sx={{ display: 'grid', gap: compact ? 0.75 : 1.75, minWidth: 0 }}>
      {!compact && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 1,
          }}
        >
          <Eyebrow>Price vs value · per share</Eyebrow>
          {uncertainty && <UncertaintyMark level={uncertainty} />}
        </Box>
      )}
      <Box
        role="img"
        aria-label={label}
        sx={{
          position: 'relative',
          height: { xs: compact ? H : 44, sm: H + (crowded && !compact ? 16 : 0) },
        }}
      >
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: 0,
            right: 0,
            top: compact ? 16 : 30,
            height: 2,
            bgcolor: alpha(t.palette.text.secondary, 0.12),
          })}
        />
        <Box
          sx={(t) => ({
            position: 'absolute',
            top: compact ? 10 : 22,
            height: compact ? 12 : 18,
            left: `${lp}%`,
            width: `${Math.max(1, hp - lp)}%`,
            borderRadius: '9px',
            background: band(t),
          })}
        />
        {/* The base case: the one amber mark on the page. */}
        <Box
          sx={(t) => ({
            position: 'absolute',
            top: compact ? 10 : 23,
            left: `${bp}%`,
            width: compact ? 11 : 16,
            height: compact ? 11 : 16,
            ml: compact ? '-5.5px' : '-8px',
            transform: 'rotate(45deg)',
            bgcolor: 'primary.main',
            borderRadius: '2px',
            boxShadow: `0 0 0 2px ${t.palette.background.paper}`,
          })}
        />
        {data.weighted !== null && (
          <Box
            sx={{
              position: 'absolute',
              top: compact ? 6 : 16,
              left: at(data.weighted, max),
              width: 3,
              height: compact ? 20 : 30,
              ml: '-1.5px',
              borderRadius: '2px',
              bgcolor: 'text.primary',
            }}
          />
        )}
        <Box
          sx={(t) => ({
            position: 'absolute',
            left: at(price.value, max),
            top: compact ? 2 : 8,
            bottom: compact ? 14 : 0,
            borderLeft: priceStale
              ? `2px dashed ${alpha(t.palette.text.primary, 0.6)}`
              : `2px solid ${t.palette.text.primary}`,
          })}
        />
        {!compact && (
          <>
            <Box
              component="span"
              sx={{
                ...MONO,
                position: 'absolute',
                top: -6,
                left: at(price.value, max),
                ml: 1,
                fontSize: 11,
                whiteSpace: 'nowrap',
                color: priceStale ? 'text.secondary' : 'text.primary',
                transform: price.value / max > 0.7 ? 'translateX(calc(-100% - 16px))' : 'none',
              }}
            >
              Price {priceText(price.value)}
              {priceStale && ` · ${formatShortDate(price.asOf)}`}
            </Box>
            <Box
              component="span"
              sx={{
                ...MONO,
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                top: 46,
                left: `${lp}%`,
                fontSize: 11,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              Bear {money(values.bear)}
            </Box>
            <Box
              component="span"
              sx={{
                ...MONO,
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                top: crowded ? 62 : 46,
                left: `${bp}%`,
                transform: bp < 8 ? 'none' : bp > 92 ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: 11,
                color: 'text.primary',
                whiteSpace: 'nowrap',
              }}
            >
              Base {money(values.base)}
            </Box>
            <Box
              component="span"
              sx={{
                ...MONO,
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                top: 46,
                left: `${hp}%`,
                transform: 'translateX(-100%)',
                fontSize: 11,
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              Bull {money(values.bull)}
            </Box>
          </>
        )}
      </Box>
      {!compact && (
        <Box
          aria-hidden
          sx={{
            display: { xs: 'grid', sm: 'none' },
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            ...MONO,
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          {NAMES.map((name) => (
            <Box
              key={name}
              component="span"
              sx={{ display: 'grid', color: name === 'base' ? 'text.primary' : 'text.secondary' }}
            >
              <Box component="span" sx={{ fontFamily: 'inherit', fontSize: 11 }}>
                {TITLE[name]}
              </Box>
              {money(values[name])}
            </Box>
          ))}
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: compact ? '2px 12px' : '6px 18px',
          fontSize: compact ? 12 : 13,
          pt: compact ? 0 : 1.25,
          borderTop: compact ? 0 : 1,
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
            {!compact && (
              <span>
                Range <Signed value={((lo - price.value) / price.value) * 100} /> to{' '}
                <Signed value={((hi - price.value) / price.value) * 100} />
              </span>
            )}
          </>
        )}
        {data.weighted !== null ? (
          <span>
            Weighted{' '}
            <Box component="span" sx={{ ...MONO, color: 'text.primary' }}>
              {money(data.weighted)}
            </Box>
          </span>
        ) : (
          !compact && <span>Scenario odds not set</span>
        )}
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

function FootballField({ v, stale }: { v: ValuationBlock; stale: boolean }) {
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
  const ticks = [0.25, 0.5, 0.75].map((f) => f * max);
  return (
    <Box
      component="figure"
      sx={{ ...PANEL_SX, m: 0, p: 2.5, display: 'grid', gap: 0.5, minWidth: 0 }}
    >
      <Box
        component="figcaption"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 1,
          fontSize: 12,
          color: 'text.secondary',
          mb: 1,
        }}
      >
        <span>Value per share by method · bar ends fade because the edges are soft</span>
        <span>
          Price {priceText(v.price.value)} · {formatShortDate(v.price.asOf)}
          {stale && ' (over 30 days old)'}
        </span>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.label}
          role="img"
          aria-label={`${row.label}: ${row.lo !== null && row.hi !== null ? `${money(row.lo)} to ${money(row.hi)}` : ''}${row.mark !== null ? `${row.lo !== null ? ', ' : ''}mark ${money(row.mark)}` : ''}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '190px minmax(0, 1fr)' },
            gap: { xs: 0.5, sm: 1.75 },
            alignItems: 'center',
            minHeight: 48,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', fontSize: 13, lineHeight: 1.3 }}>
            <Box component="span" sx={{ fontWeight: 500 }}>
              {row.label}
            </Box>
            <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
              {row.sub}
            </Box>
          </Box>
          <Box sx={{ position: 'relative', height: 48 }}>
            <Box
              sx={(t) => ({
                position: 'absolute',
                left: 0,
                right: 0,
                top: 21,
                height: 2,
                bgcolor: alpha(t.palette.text.secondary, 0.08),
              })}
            />
            {row.lo !== null && row.hi !== null && (
              <Box
                sx={(t) => {
                  const c = row.kind === 'model' ? t.palette.info.main : t.palette.text.secondary;
                  return {
                    position: 'absolute',
                    top: 15,
                    height: 14,
                    borderRadius: '7px',
                    left: at(row.lo ?? 0, max),
                    width: `${Math.max(1, (((row.hi ?? 0) - (row.lo ?? 0)) / max) * 100)}%`,
                    background: `linear-gradient(90deg, ${alpha(c, 0)} 0%, ${alpha(c, 0.6)} 12%, ${alpha(c, 0.6)} 88%, ${alpha(c, 0)} 100%)`,
                  };
                }}
              />
            )}
            {row.mark !== null && (
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  top: 12,
                  height: 20,
                  left: at(row.mark ?? 0, max),
                  ...(row.kind === 'third'
                    ? {
                        width: 10,
                        ml: '-5px',
                        border: `1.5px dashed ${t.palette.text.secondary}`,
                        boxSizing: 'border-box',
                        borderRadius: '2px',
                      }
                    : { width: 4, ml: '-2px', borderRadius: '2px', bgcolor: 'text.primary' }),
                })}
              />
            )}
            {row.lo !== null && row.hi !== null && (row.hi - row.lo) / max < 0.16 ? (
              <Box
                component="span"
                sx={{
                  ...MONO,
                  position: 'absolute',
                  top: 32,
                  left: at(row.lo, max),
                  fontSize: 10,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  transform: row.lo / max > 0.7 ? 'translateX(-60%)' : 'none',
                }}
              >
                {money(row.lo)}–{money(row.hi)}
              </Box>
            ) : (
              row.lo !== null && (
                <Box
                  component="span"
                  sx={{
                    ...MONO,
                    position: 'absolute',
                    top: 32,
                    left: at(row.lo, max),
                    fontSize: 10,
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {money(row.lo)}
                </Box>
              )
            )}
            {row.hi !== null && row.lo !== null && (row.hi - row.lo) / max >= 0.16 && (
              <Box
                component="span"
                sx={{
                  ...MONO,
                  position: 'absolute',
                  top: 32,
                  left: at(row.hi, max),
                  transform: 'translateX(-100%)',
                  fontSize: 10,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {money(row.hi)}
              </Box>
            )}
            {row.lo === null && row.mark !== null && (
              <Box
                component="span"
                sx={{
                  ...MONO,
                  position: 'absolute',
                  top: 32,
                  left: at(row.mark, max),
                  ml: 1,
                  fontSize: 10,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {money(row.mark)}
              </Box>
            )}
            <Box
              sx={(t) => ({
                position: 'absolute',
                left: at(v.price.value, max),
                top: 0,
                bottom: 0,
                borderLeft: stale
                  ? `2px dashed ${alpha(t.palette.text.primary, 0.6)}`
                  : `2px solid ${t.palette.text.primary}`,
              })}
            />
          </Box>
        </Box>
      ))}
      <Box
        sx={{
          display: { xs: 'none', sm: 'grid' },
          gridTemplateColumns: '190px minmax(0, 1fr)',
          gap: 1.75,
          mt: 0.5,
        }}
      >
        <span />
        <Box
          sx={{ position: 'relative', height: 16, ...MONO, fontSize: 10, color: 'text.secondary' }}
        >
          <Box component="span" sx={{ position: 'absolute', left: 0 }}>
            $0
          </Box>
          {ticks.map((tk) => (
            <Box
              component="span"
              key={tk}
              sx={{ position: 'absolute', left: at(tk, max), transform: 'translateX(-50%)' }}
            >
              {money(tk)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
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

const ODDS_TONE: Record<ScenarioName, (t: Theme) => string> = {
  bear: (t) => alpha(t.palette.text.secondary, 0.55),
  base: (t) => t.palette.text.primary,
  bull: (t) => alpha(t.palette.info.main, 0.85),
};

function Odds({ v, stale }: { v: ValuationBlock; stale: boolean }) {
  const cells: (ScenarioName | null)[] = v.odds
    ? NAMES.flatMap((name, i) => Array.from({ length: v.odds?.[i] ?? 0 }, () => name))
    : Array.from({ length: 20 }, () => null);
  return (
    <Panel sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        Scenario odds, in twentieths · each cell is 1 in 20
      </Box>
      <Box
        role="img"
        aria-label={
          v.odds ? `Bear ${v.odds[0]}, base ${v.odds[1]}, bull ${v.odds[2]} in 20` : 'Odds not set'
        }
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(20, minmax(0, 1fr))', gap: '3px' }}
      >
        {cells.map((c, i) => (
          <Box
            key={i}
            sx={(t) => ({
              height: 22,
              borderRadius: '3px',
              boxSizing: 'border-box',
              ...(c
                ? { bgcolor: ODDS_TONE[c](t) }
                : { border: `1px dashed ${alpha(t.palette.text.secondary, 0.45)}` }),
            })}
          />
        ))}
      </Box>
      {v.odds && v.result.weighted ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 14px',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {NAMES.map((name, i) => (
            <Box
              key={name}
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <Box
                component="span"
                sx={(t) => ({
                  width: 10,
                  height: 10,
                  borderRadius: '2px',
                  bgcolor: ODDS_TONE[name](t),
                })}
              />
              {TITLE[name]} {v.odds?.[i]}/20
            </Box>
          ))}
          <Box component="span" sx={{ color: 'text.primary' }}>
            Weighted{' '}
            <Box component="span" sx={MONO}>
              {money(v.result.weighted.value)}
            </Box>
            {!stale && (
              <>
                {' '}
                (<Signed value={v.result.weighted.vsPrice} /> vs price)
              </>
            )}
          </Box>
        </Box>
      ) : (
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
          <YourCall label="not set" /> Write{' '}
          <Box component="code" sx={{ ...MONO, color: 'text.primary' }}>
            odds: 5/11/4
          </Box>{' '}
          (bear/base/bull in twentieths) and the cells fill, with the weighted value marked on the
          price-vs-value strip.
        </Box>
      )}
    </Panel>
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

function Sensitivity({ v, stale }: { v: ValuationBlock; stale: boolean }) {
  const s = v.result.sensitivity;
  if (!s) return null;
  const rowBase = baseInput(v, s.row.key);
  const colBase = baseInput(v, s.col.key);
  const isBase = (label: string, base: number | null) =>
    base !== null && Math.abs(labelValue(label) - base) < 1e-9;
  return (
    <Panel sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        Base value as {(INPUT_LABEL[s.row.key] ?? s.row.key).toLowerCase()} (rows) and{' '}
        {(INPUT_LABEL[s.col.key] ?? s.col.key).toLowerCase()} (columns) move
        {stale ? '' : ' · signed vs the price'}
      </Box>
      <Box
        role="table"
        aria-label="Sensitivity of the base value"
        sx={{
          display: 'grid',
          gridTemplateColumns: '56px repeat(3, minmax(0, 1fr))',
          gap: 0.5,
          ...MONO,
          fontSize: 12,
        }}
      >
        <Box
          role="columnheader"
          component="span"
          sx={{ color: 'text.secondary', fontSize: 10, py: 0.75 }}
        />
        {s.col.labels.map((l) => (
          <Box
            role="columnheader"
            key={l}
            component="span"
            sx={{ color: 'text.secondary', textAlign: 'center', py: 0.75 }}
          >
            {l}
          </Box>
        ))}
        {s.cells.map((row, ri) => [
          <Box
            role="rowheader"
            key={`h${ri}`}
            component="span"
            sx={{ color: 'text.secondary', py: 1 }}
          >
            {s.row.labels[ri]}
          </Box>,
          ...row.map((cell, ci) => {
            const base = isBase(s.row.labels[ri], rowBase) && isBase(s.col.labels[ci], colBase);
            return (
              <Box
                role="cell"
                key={`${ri}-${ci}`}
                component="span"
                sx={(t) => ({
                  textAlign: 'center',
                  py: 1,
                  borderRadius: '6px',
                  bgcolor: alpha(
                    t.palette.text.primary,
                    stale ? 0.06 : Math.min(0.26, 0.05 + Math.abs(cell.vsPrice) / 220),
                  ),
                  boxShadow: base ? `inset 0 0 0 1.5px ${t.palette.text.primary}` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  lineHeight: 1.3,
                })}
              >
                <span>{money(cell.value)}</span>
                {!stale && (
                  <Box component="span" sx={{ fontSize: 10, color: 'text.secondary' }}>
                    {arrow(cell.vsPrice)}
                    {percent(cell.vsPrice)}
                  </Box>
                )}
              </Box>
            );
          }),
        ])}
      </Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>
        Shading grows with distance from the price; the arrow gives the direction. Outlined: the
        base case.
      </Box>
    </Panel>
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
 *  1950–2015, inflation-adjusted. */
const BASE_RATES = [
  { label: 'Median company, 3 years', value: 5.4, shown: '5.4%' },
  { label: 'Top 2.5% of 3-year runs', value: 45, shown: '45%+' },
  { label: 'Top 1.3% of 5-year runs', value: 45, shown: '45%+' },
];

/** "What the price implies": enterprise value, the steady-state share, and the growth it needs. */
export function ImpliedBlockView() {
  const { valuation: v, freshness } = useNoteContext();
  if (!v) return null;
  const i = v.result.implied;
  const growthMax = Math.max(i.growth ?? 0, 45) * 1.05;
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
            aria-label={`Today's profit, capitalized, supports ${Math.round(i.steadyStateShare)}% of the price; future growth has to earn the other ${100 - Math.round(i.steadyStateShare)}%`}
            sx={{
              display: 'flex',
              height: 24,
              borderRadius: '6px',
              overflow: 'hidden',
              ...MONO,
              fontSize: 11,
            }}
          >
            <Box
              sx={{
                width: `${Math.max(2, i.steadyStateShare)}%`,
                bgcolor: 'text.secondary',
                color: 'background.default',
                display: 'flex',
                alignItems: 'center',
                pl: i.steadyStateShare > 18 ? 1 : 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {i.steadyStateShare > 18 ? `today ${Math.round(i.steadyStateShare)}%` : ''}
            </Box>
            <Box
              sx={(t) => ({
                flex: 1,
                bgcolor: alpha(t.palette.info.main, 0.5),
                display: 'flex',
                alignItems: 'center',
                pl: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              future growth {100 - Math.round(i.steadyStateShare)}%
            </Box>
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
            "Today" is current operating profit after tax, capitalized at the base cost of capital,
            plus net cash (Mauboussin's steady-state value). The rest of the price is a bet on
            growth.
          </Box>
        </Box>
      </Panel>
      <Panel sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
          Growth the price implies, against how often it happens
        </Box>
        <Box
          role="img"
          aria-label={`${i.growth === null ? 'No growth rate in range reaches the price' : `The price implies ${percent(i.growth)} a year, ${i.growthYears}`}; base rates: median 5.4%, top 2.5% of 3-year runs 45% or more`}
          sx={{ display: 'grid', gap: 1 }}
        >
          {BASE_RATES.map((b) => (
            <RateBar
              key={b.label}
              label={b.label}
              value={b.value}
              shown={b.shown}
              max={growthMax}
              emph={false}
            />
          ))}
          {i.growth !== null ? (
            <RateBar
              label={`This price implies (${i.growthYears})`}
              value={Math.max(0, i.growth)}
              shown={`${percent(i.growth)}/yr`}
              max={growthMax}
              emph
            />
          ) : (
            <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
              {!i.growthAddsValue
                ? 'No growth rate reaches this price. At base inputs new capital earns less than it costs, so faster growth lowers the value instead of raising it.'
                : i.bound === 'above'
                  ? 'No growth rate up to 300% a year reaches this price.'
                  : 'Even shrinking 50% a year leaves the base case above this price.'}
            </Box>
          )}
        </Box>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
          Implied: the base case solved for revenue growth, every other input held. Base rates:
          annual sales growth of the top 1,000 global companies, 1950–2015, after inflation
          (Mauboussin, The Base Rate Book, 2016). The implied rate is before inflation, so the
          comparison flatters the company slightly.
        </Box>
      </Panel>
    </Box>
  );
}

function RateBar({
  label,
  value,
  shown,
  max,
  emph,
}: {
  label: string;
  value: number;
  shown: string;
  max: number;
  emph: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr) 72px',
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
      <Box
        sx={(t) => ({
          height: 12,
          borderRadius: '3px',
          bgcolor: alpha(t.palette.text.secondary, 0.12),
        })}
      >
        <Box
          sx={{
            width: `${Math.min(100, Math.max(1, (value / max) * 100))}%`,
            height: '100%',
            borderRadius: '3px',
            bgcolor: emph ? 'text.primary' : 'text.secondary',
          }}
        />
      </Box>
      <Box component="span" sx={{ ...MONO, textAlign: 'right' }}>
        {shown}
      </Box>
    </Box>
  );
}
