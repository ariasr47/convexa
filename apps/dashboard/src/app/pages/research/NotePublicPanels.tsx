/**
 * Below a ticker's note: who is positioned how (short interest, short-sale volume, insider trades) and
 * what the company has filed since the note was written. Each card names its source and its delay,
 * because each source reports late in its own way, and carries one data-state word (canon P-2): an
 * outage reads "Source down", never as an empty fact.
 *
 * FINRA's data is credited to FINRA as owner and source, derived figures included, with a
 * do-not-redistribute notice (FINRA Equity Data terms §2.3; docs/public-data/README.md).
 *
 * The cards are exported for the public desk (pages/ticker/public-desk), which shows the same
 * figures beside TradingView's chart when the options feed is off.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord } from '@/shared/dataState/vocabulary';
import { dataMode, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { localToday, upcoming } from 'virtual:convexa-research';
import { standing } from './filings';
import { formatNoteDate, formatShortDate } from './format';
import type { Read } from './publicData';
import { Caps, SourceProblem } from './publicUi';
import type { Aging } from './types';
import { DISPLAY, MONO, PANEL_SX } from './ui';
import { useWidth } from './useWidth';

const big = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`
    : n >= 1e6
      ? `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
      : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function NotePublicPanels({
  ticker,
  read,
  note,
}: {
  ticker: string;
  read: Read<PublicTicker>;
  note: { date: string; accessions: string[]; aging: Aging };
}) {
  const today = useMemo(() => localToday(), []);
  if (read.loading && !read.data) {
    return (
      <Box
        aria-busy="true"
        aria-label={`Loading ${ticker} positioning and filings`}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 2,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={(t) => ({
              ...PANEL_SX,
              height: 200,
              bgcolor: alpha(t.palette.text.secondary, 0.06),
            })}
          />
        ))}
      </Box>
    );
  }
  if (read.error || !read.data) {
    return (
      <SourceProblem
        title="Positioning and filings didn't load."
        body="Convexa's server didn't answer. The note above doesn't depend on it."
        onRetry={read.retry}
      />
    );
  }
  const d = read.data;
  if (d.state === 'off') return null;
  const newFilings = d.filings.filter((f) => standing(f, note) === 'new');
  const nextResults = upcoming(note.aging.events, today, 3650).find((u) =>
    /results|earnings/i.test(u.label),
  );
  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Box component="section" aria-labelledby="positioned" sx={{ display: 'grid', gap: 1.75 }}>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Box
            component="h2"
            id="positioned"
            sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 22 }}
          >
            Who is positioned how
          </Box>
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            Short sellers and insiders, from public records. Each card names its source and how late
            it reports.
          </Box>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 2,
          }}
        >
          <ShortInterestCard d={d} />
          <ShortVolumeCard d={d} />
          <InsidersCard d={d} />
        </Box>
        <Box
          component="p"
          sx={{ m: 0, fontSize: 12, color: 'text.secondary', maxWidth: 720, textWrap: 'pretty' }}
        >
          FINRA owns and is the source of the short-interest and short-sale-volume data here,
          including the percentages and averages Convexa calculates from it. Shown free for
          non-commercial personal use; please don&apos;t redistribute it.
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="filed-since"
        sx={{ ...PANEL_SX, p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 14px' }}>
          <Box
            component="h2"
            id="filed-since"
            sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 22 }}
          >
            Filed since this note
          </Box>
          <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
            From SEC EDGAR, checked every hour.
          </Box>
          <DataStateTag
            state={publicDataWord(d.filings_state, {
              stale: d.filings_state === 'live' && !!d.filings_detail && dataMode !== 'demo',
              demo: dataMode === 'demo',
            })}
          />
        </Box>
        {d.filings_state === 'not_configured' ? (
          <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
            SEC filings aren&apos;t set up on this server yet (EDGAR needs an identifying contact
            address).
          </Box>
        ) : d.filings_state === 'unavailable' && d.filings.length === 0 ? (
          <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
            {`${d.filings_detail ?? 'EDGAR did not answer.'} This list is unknown, not empty.`}
          </Box>
        ) : newFilings.length === 0 ? (
          <Box
            sx={(t) => ({
              display: 'grid',
              gap: 1,
              p: 2,
              borderRadius: '10px',
              border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
            })}
          >
            <Box
              component="span"
              sx={{ fontWeight: 600 }}
            >{`Nothing yet. The note was written ${formatNoteDate(note.date)}.`}</Box>
            {nextResults && (
              <Box
                component="span"
                sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}
              >
                {`Next expected: ${nextResults.label.replace(/\.$/, '')}, ${nextResults.whenLabel}. When a results or quarterly filing lands, the note comes due and the filing is listed here.`}
              </Box>
            )}
          </Box>
        ) : (
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
            {newFilings.map((f) => (
              <Box
                component="li"
                key={f.accession}
                sx={(t) => ({
                  display: 'grid',
                  gridTemplateColumns: '64px minmax(0, 1fr) auto',
                  gap: 1.5,
                  alignItems: 'center',
                  py: 1.25,
                  borderTop: `1px solid ${t.palette.divider}`,
                  fontSize: 13,
                })}
              >
                <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
                  {formatShortDate(f.filed)}
                </Box>
                <Box
                  component="span"
                  sx={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box
                    component="span"
                    sx={{ ...MONO, fontSize: 11, color: 'text.secondary', mr: 1 }}
                  >
                    {f.form}
                  </Box>
                  {f.description || f.form}
                </Box>
                <Box
                  component="a"
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: 12, fontWeight: 500 }}
                >
                  Open
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function CardHead({ label, tag }: { label: string; tag: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px 10px',
      }}
    >
      <Caps>{label}</Caps>
      {tag}
    </Box>
  );
}

function Card({
  label,
  tag,
  value,
  unit,
  children,
  source,
}: {
  label: string;
  tag: React.ReactNode;
  value: string;
  unit?: string;
  children: React.ReactNode;
  source: string;
}) {
  return (
    <Box
      component="article"
      sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1.25, alignContent: 'start' }}
    >
      <CardHead label={label} tag={tag} />
      <Box component="span" sx={{ ...MONO, fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>
        {value}
        {unit && (
          <Box component="span" sx={{ fontSize: 14, color: 'text.secondary' }}>
            {` ${unit}`}
          </Box>
        )}
      </Box>
      {children}
      <Box component="span" sx={{ mt: 'auto', fontSize: 11, color: 'text.secondary' }}>
        {source}
      </Box>
    </Box>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '4px 12px',
        fontSize: 12,
      }}
    >
      {rows.map(([k, v]) => (
        <Box key={k} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ color: 'text.secondary' }}>
            {k}
          </Box>
          <Box component="dd" sx={{ ...MONO, m: 0 }}>
            {v}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** A card with no figure: nothing to report (no tag), or a state that explains why (Source down,
 *  Not set up). Solid border: canon P-3 reserves dashed frames for sample data. */
export function Missing({
  label,
  text,
  tag,
}: {
  label: string;
  text: string;
  tag?: React.ReactNode;
}) {
  return (
    <Box
      component="article"
      sx={{ ...PANEL_SX, p: '18px 20px', display: 'grid', gap: 1, alignContent: 'start' }}
    >
      <CardHead label={label} tag={tag} />
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {text}
      </Box>
    </Box>
  );
}

/** A part-level note, shown under a figure: a stale copy, or files that couldn't be read. */
function PartNote({ text }: { text: string | null }) {
  if (!text || dataMode === 'demo') return null;
  return (
    <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
      {text}
    </Box>
  );
}

const FINRA_SI_URL = 'https://www.finra.org/finra-data/browse-catalog/equity-short-interest';
const FINRA_SV_URL = 'https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data';

/**
 * Short interest at each FINRA settlement (RP-01, canon P-8 to P-13): the frame's title states the
 * year's change; the bars carry their settlement dates and their unit; the latest bar is the claim's
 * and is labelled; the table twin lists every settlement.
 */
export function ShortInterestCard({ d }: { d: PublicTicker }) {
  const si = d.short_interest;
  const demo = dataMode === 'demo';
  if (d.short_interest_state === 'unavailable' && !demo)
    return (
      <Missing
        label="Short interest"
        tag={<DataStateTag state="sourceDown" />}
        text={`${d.short_interest_detail ?? 'FINRA did not answer.'} Unknown, not empty.`}
      />
    );
  if (!si)
    return (
      <Missing label="Short interest" text="FINRA has no short-interest report for this symbol." />
    );
  const stale = !!d.short_interest_detail && !demo;
  const out = d.shares_outstanding;
  const share = out ? si.shares_short / out.value : null;
  // Shares outstanding from the latest filing, one denominator for every settlement: the right-hand
  // labels restate the same axis in % of shares outstanding (not the float, which SEC data here
  // doesn't give). Shown only when SEC filings are set up.
  const pctOut = (shares: number) =>
    out ? `${((shares / out.value) * 100).toFixed(shares / out.value < 0.1 ? 1 : 0)}%` : '';
  const hist = si.history.some((h) => h.settlement_date === si.settlement_date)
    ? si.history
    : [...si.history, { settlement_date: si.settlement_date, shares_short: si.shares_short }];
  const first = hist[0];
  const unit = Math.max(...hist.map((h) => h.shares_short)) >= 1e9 ? 1e9 : 1e6;
  const u = unit === 1e9 ? 'B' : 'M';
  const top = niceTop(Math.max(...hist.map((h) => h.shares_short)) / unit);
  const change = first && first.shares_short > 0 ? si.shares_short / first.shares_short - 1 : null;
  const finding =
    hist.length > 1 && change !== null
      ? `Shares sold short ${Math.abs(change) < 0.005 ? 'held level' : `${change > 0 ? 'rose' : 'fell'} about ${Math.round(Math.abs(change) * 100)}%`} since ${formatShortDate(first.settlement_date)}, to ${big(si.shares_short)}${share !== null ? ` (${(share * 100).toFixed(2)}% of shares out)` : ''}`
      : `${big(si.shares_short)} shares sold short at the ${formatShortDate(si.settlement_date)} settlement`;
  const every = Math.max(1, Math.ceil(hist.length / 4));
  const PLOT = 120;
  return (
    <ChartFrame
      finding={finding}
      metric="Short interest"
      sub={`${d.ticker} short interest at each FINRA settlement · ${u === 'B' ? 'billions' : 'millions'} of shares${out ? ` · right: % of the ${formatShortDate(out.as_of)} shares outstanding (SEC)` : ''}${hist.length > 1 ? ` · ${formatShortDate(first.settlement_date)} – ${formatShortDate(si.settlement_date)}` : ''}`}
      height={PLOT + 28}
      provenance={demo ? 'sample' : 'primary'}
      tag={{
        state: publicDataWord(d.short_interest_state, { stale, delayed: true, demo }),
        detail: stale || demo ? undefined : `settled ${formatShortDate(si.settlement_date)}`,
      }}
      source={
        demo
          ? { text: 'Demo · shaped like FINRA short interest' }
          : { text: 'FINRA · consolidated short interest', href: FINRA_SI_URL }
      }
      asOf={`Settled ${formatNoteDate(si.settlement_date)} · published about a week later`}
      table={{
        caption: `${d.ticker} shares sold short by settlement date`,
        cols: out
          ? ['Settlement', 'Shares short', `% of shares out (${formatShortDate(out.as_of)})`]
          : ['Settlement', 'Shares short'],
        rows: hist.map((h) =>
          out
            ? [formatNoteDate(h.settlement_date), big(h.shares_short), pctOut(h.shares_short)]
            : [formatNoteDate(h.settlement_date), big(h.shares_short)],
        ),
      }}
      testId="chart-short-interest"
    >
      <PartNote text={d.short_interest_detail} />
      {hist.length > 1 && (
        <Box
          role="img"
          aria-label={`Shares short by settlement: ${hist.map((h) => `${formatShortDate(h.settlement_date)} ${big(h.shares_short)}`).join(', ')}`}
          sx={{
            position: 'relative',
            height: PLOT,
            ml: '40px',
            mr: out ? '44px' : '8px',
            mt: '14px',
            mb: '22px',
          }}
        >
          {[0, top / 2, top].map((v) => (
            <Box key={v}>
              <Box
                sx={(t) => ({
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(v / top) * 100}%`,
                  borderTop: `1px ${v === 0 ? 'solid' : 'dashed'} ${v === 0 ? chartRoles(t).axis : chartRoles(t).grid}`,
                })}
              />
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  right: 'calc(100% + 6px)',
                  bottom: `${(v / top) * 100}%`,
                  transform: 'translateY(50%)',
                  ...MONO,
                  fontSize: 11,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {v === 0 ? '0' : `${trimNum(v)}${u}`}
              </Box>
              {out && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    left: 'calc(100% + 6px)',
                    bottom: `${(v / top) * 100}%`,
                    transform: 'translateY(50%)',
                    ...MONO,
                    fontSize: 11,
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pctOut(v * unit)}
                </Box>
              )}
            </Box>
          ))}
          {hist.map((h, k) => {
            const last = k === hist.length - 1;
            const left = `${((k + 0.5) / hist.length) * 100}%`;
            const height = `${(h.shares_short / unit / top) * 100}%`;
            return (
              <Box key={h.settlement_date}>
                <Box
                  sx={(t) => ({
                    position: 'absolute',
                    bottom: 0,
                    left,
                    width: `min(14px, ${(100 / hist.length) * 0.6}%)`,
                    height,
                    transform: 'translateX(-50%)',
                    borderRadius: '3px 3px 0 0',
                    bgcolor: last ? chartRoles(t).emph : chartRoles(t).ctx,
                  })}
                />
                {last && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      left,
                      bottom: `calc(${height} + 4px)`,
                      transform: 'translateX(-70%)',
                      ...MONO,
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {big(h.shares_short)}
                  </Box>
                )}
                {(k % every === 0 || last) && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left,
                      transform: last ? 'translateX(-85%)' : 'translateX(-50%)',
                      ...MONO,
                      fontSize: 11,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatShortDate(h.settlement_date)}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
      <Facts
        rows={[
          ...(share !== null
            ? ([['Shares short', big(si.shares_short)]] as [string, string][])
            : []),
          ['Days to cover', si.days_to_cover == null ? '—' : si.days_to_cover.toFixed(1)],
          [
            'Since the last report',
            si.change_percent == null
              ? '—'
              : `${si.change_percent >= 0 ? '+' : '−'}${Math.abs(si.change_percent).toFixed(1)}%`,
          ],
        ]}
      />
    </ChartFrame>
  );
}

/** The axis top: the next 1, 2, 2.5 or 5 step above the largest value. */
function niceTop(max: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(max, 1e-9)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}
const trimNum = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

/**
 * FINRA daily short-sale volume (RP-02): each trading day's share of volume marked short, as bars
 * from zero, with the average of the same days as a dashed line. Twenty days, the window the API
 * reads: each day's file lists every symbol in the market, and the API keeps the parsed files in
 * memory, so a longer window would cost it several times the memory for one chart.
 */
export function ShortVolumeCard({ d }: { d: PublicTicker }) {
  const sv = d.short_volume;
  const demo = dataMode === 'demo';
  if (d.short_volume_state === 'unavailable' && !demo)
    return (
      <Missing
        label="Short-sale volume"
        tag={<DataStateTag state="sourceDown" />}
        text={`${d.short_volume_detail ?? "FINRA's daily files did not answer."} Unknown, not empty.`}
      />
    );
  if (!sv)
    return (
      <Missing label="Short-sale volume" text="FINRA's daily file has no volume for this symbol." />
    );
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  // `?? []`: an API from before the daily series existed draws the figures without the bars.
  const days = sv.daily ?? [];
  const first = days[0];
  return (
    <ChartFrame
      finding={`${pct(sv.ratio)} of ${formatShortDate(sv.date)} volume was marked short; the ${sv.days}-day average is ${pct(sv.avg_ratio)}`}
      metric="Short-sale volume"
      sub={`${d.ticker} · share of each day’s reported volume marked short · ${sv.days} trading days${first ? `, ${formatShortDate(first.date)} – ${formatShortDate(sv.date)}` : ''} · dashed = their average`}
      height={150}
      provenance={demo ? 'sample' : 'primary'}
      tag={{
        state: publicDataWord(d.short_volume_state, { demo }),
        detail: demo ? undefined : formatShortDate(sv.date),
      }}
      source={
        demo
          ? { text: 'Demo · shaped like FINRA Reg SHO daily files' }
          : { text: 'FINRA · Reg SHO daily short-sale volume', href: FINRA_SV_URL }
      }
      asOf={`Latest file ${formatNoteDate(sv.date)} · data owned and provided by FINRA`}
      note="Counts every sale marked short, including market makers hedging customers’ buys. It is not short interest, and a high reading is normal."
      table={{
        caption: `${d.ticker} short-sale volume by day`,
        cols: ['Day', 'Marked short', 'Total volume', 'Share'],
        rows: [...days]
          .reverse()
          .map((x) => [
            formatNoteDate(x.date),
            big(x.short_volume),
            big(x.total_volume),
            pct(x.ratio),
          ]),
      }}
      testId="chart-short-volume"
    >
      <PartNote text={d.short_volume_detail} />
      {days.length > 1 && <ShortVolumeBars days={days} avg={sv.avg_ratio} />}
    </ChartFrame>
  );
}

function ShortVolumeBars({
  days,
  avg,
}: {
  days: NonNullable<PublicTicker['short_volume']>['daily'];
  avg: number;
}) {
  const t = useTheme();
  const roles = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const top = Math.min(1, Math.ceil(Math.max(avg, ...days.map((x) => x.ratio)) * 10) / 10);
  const PL = 40;
  const PR = 64;
  const PT = 8;
  const PH = 100;
  const H = PT + PH + 20;
  const slot = Math.max(0, W - PL - PR) / days.length;
  const x = (i: number) => PL + slot * (i + 0.5);
  const y = (r: number) => PT + (1 - r / top) * PH;
  const bw = Math.max(2, Math.min(14, slot * 0.6));
  const ticks = [0, top / 2, top];
  return (
    <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Share of volume marked short by day: ${days.map((x) => `${formatShortDate(x.date)} ${Math.round(x.ratio * 100)}%`).join(', ')}; average ${Math.round(avg * 100)}%`}
          style={{ display: 'block' }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? roles.axis : roles.grid}
              />
              <text
                x={PL - 6}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill={t.palette.text.secondary}
                style={MONO}
              >
                {`${Math.round(v * 100)}%`}
              </text>
            </g>
          ))}
          {days.map((day, i) => (
            <rect
              key={day.date}
              x={x(i) - bw / 2}
              y={y(day.ratio)}
              width={bw}
              height={Math.max(1, y(0) - y(day.ratio))}
              rx={2}
              fill={i === days.length - 1 ? roles.emph : roles.ctx}
            />
          ))}
          <line
            x1={PL}
            x2={W - PR}
            y1={y(avg)}
            y2={y(avg)}
            stroke={roles.emph}
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          <text
            x={W - PR + 6}
            y={y(avg) + 4}
            fontSize={11}
            fill={t.palette.text.primary}
            style={MONO}
          >
            {`avg ${Math.round(avg * 100)}%`}
          </text>
          <text x={PL} y={PT + PH + 16} fontSize={11} fill={t.palette.text.secondary} style={MONO}>
            {formatShortDate(days[0].date)}
          </text>
          <text
            x={W - PR}
            y={PT + PH + 16}
            textAnchor="end"
            fontSize={11}
            fill={t.palette.text.secondary}
            style={MONO}
          >
            {formatShortDate(days[days.length - 1].date)}
          </text>
        </svg>
      )}
    </Box>
  );
}

export function InsidersCard({ d }: { d: PublicTicker }) {
  const ins = d.insiders;
  const demo = dataMode === 'demo';
  if (!ins || ins.state === 'not_configured')
    return (
      <Missing
        label="Insider trades"
        tag={<DataStateTag state="notSetUp" />}
        text="Insider filings come from SEC EDGAR, which isn't set up on this server yet."
      />
    );
  if (ins.state !== 'live')
    return (
      <Missing
        label="Insider trades"
        tag={<DataStateTag state={publicDataWord(ins.state)} />}
        text={`${ins.detail ?? 'EDGAR did not answer.'} Unknown, not empty.`}
      />
    );
  return (
    <Card
      label={`Insider trades · ${ins.window_days} days`}
      tag={
        <DataStateTag
          state={publicDataWord(ins.state, { stale: !!ins.detail && !demo, demo })}
          detail={
            demo || !ins.latest || ins.detail ? null : `latest ${formatShortDate(ins.latest)}`
          }
        />
      }
      value={`${ins.sales} ${ins.sales === 1 ? 'sale' : 'sales'}`}
      unit={`· ${ins.buys} ${ins.buys === 1 ? 'buy' : 'buys'}`}
      source={`SEC Form 4 · ${ins.filings} filings${ins.latest ? `, latest ${formatShortDate(ins.latest)}` : ''}`}
    >
      {ins.sales > 0 && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
          {ins.planned > 0
            ? `${ins.planned} of the trades were under pre-set 10b5-1 plans, which schedule sales months ahead.`
            : 'None were marked as pre-set 10b5-1 plan trades.'}
        </Box>
      )}
      <Facts
        rows={[
          ['Shares sold', big(ins.shares_sold)],
          ['Shares bought', big(ins.shares_bought)],
        ]}
      />
    </Card>
  );
}
