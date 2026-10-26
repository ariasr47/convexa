/**
 * Insider trades over twelve months (design: Planned · Insider clusters, CLUSTERS_SPEC). Every Form 4
 * open-market trade on a row per insider, placed by trade date (DB-08), never by index. A ring is a
 * sale and a filled dot an open-market purchase: shape carries the kind, never hue (P-11). Shaded
 * spans are ten days with three or more insiders trading the same way; only a buying span outside any
 * 10b5-1 plan is a cluster, which the API works out (apps/api insider_trades.rs) and this draws.
 * Roles, not names. The plot is one image (role="img", its summary as the label) with no tab stop;
 * its dots are aria-hidden circles that keep their hover titles. Every trade's detail is in "Show
 * the numbers": the windows, then one row per trade, and on the live site each row links to its
 * filing, where the names are (spec 2026-10-21/02, part (d); owner answers S2-Q2 and S2-Q3).
 */
import { ChartFrame, chartRoles, type TableTwinData } from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { coarseFloor } from '@/shared/ui/touch';
import {
  dataMode,
  type PublicInsiders,
  type PublicInsiderTransaction,
  type PublicInsiderWindow,
  type PublicTicker,
} from '@convexa/api';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { localToday } from 'virtual:convexa-research';
import { formatNoteDate, formatShortDate } from './format';
import { insiderFrame, notSecFiler, tickerSecStale } from './secState';
import { MONO } from './ui';
import { useWidth } from './useWidth';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEMO_DAY = '2026-10-07';
/** A month label's estimated width a character (11px IBM Plex Mono at 0.6em), and the clearance
 *  it keeps from the last label drawn (P-13). */
const MONTH_CH = 6.6;
const MONTH_GAP = 8;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const span = (w: PublicInsiderWindow) => Math.round((ms(w.to) - ms(w.from)) / DAY) + 1;
const period = (days: number) => {
  if (days >= 360) return '12 months';
  const m = Math.max(1, Math.round(days / 30.4));
  return m === 1 ? '1 month' : `${m} months`;
};
/** The months the timeline covers: the full period, or, when only the newest Form 4s were read, from
 *  the oldest filing read to `end` (never a 12-month claim over months nobody read). */
function coveredDays(
  ins: Partial<Pick<PublicInsiders, 'history_days'>>,
  backTo: string | null,
  end: string,
) {
  const full = ins.history_days ?? 365;
  if (!backTo) return full;
  return Math.min(full, Math.max(1, Math.round((ms(end) - ms(backTo)) / DAY)));
}
const monthName = (d: string, today: string) => {
  const m = MONTHS[Number(d.slice(5, 7)) - 1];
  // "Oct" alone, eleven months on, reads as this month: name the year unless it is this month.
  return d.slice(0, 7) === today.slice(0, 7) ? m : `${m} ${d.slice(0, 4)}`;
};
const sharesText = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const numberWord = (n: number) =>
  ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n);
/** One trade as a sentence: a dot's hover title, and its Form 4 link's name in the twin. */
const tradeSentence = (v: PublicInsiderTransaction, roles: string[]) =>
  `${roles[v.insider] ?? 'Insider'} ${v.kind === 'purchase' ? 'bought' : 'sold'} ${sharesText(v.shares)} shares on ${formatNoteDate(v.trade_date)}${v.planned ? ' under a 10b5-1 plan' : ''}; filed ${formatShortDate(v.filed)}`;

/** The frame's title over data: the latest buying cluster, or why there is none (P-10). */
export function clustersFinding(
  ins: Partial<Pick<PublicInsiders, 'clusters' | 'transactions'>>,
  demo: boolean,
  /** The days the timeline covers (coveredDays), and the day it ends. */
  days: number,
  today: string,
): string {
  const lead = demo ? 'In the sample, ' : '';
  const clusters = ins.clusters ?? [];
  const tx = ins.transactions ?? [];
  if (clusters.length) {
    const last = clusters[clusters.length - 1];
    const month = monthName(last.to, today);
    const more =
      clusters.length > 1 ? ` (${count(clusters.length, 'cluster')} in ${period(days)})` : '';
    const said = `${numberWord(last.insiders)} insiders bought on the open market within ${count(span(last), 'day')} in ${month}: a buying cluster${more}`;
    return lead ? `${lead}${said}` : `${said.charAt(0).toUpperCase()}${said.slice(1)}`;
  }
  const sales = tx.filter((t) => t.kind === 'sale');
  const buys = tx.filter((t) => t.kind === 'purchase');
  const sellers = new Set(sales.map((t) => t.insider)).size;
  const planned = sales.filter((t) => t.planned).length;
  const plan =
    sales.length === 0
      ? ''
      : planned === sales.length
        ? ', every sale under a pre-set 10b5-1 plan'
        : planned > 0
          ? `, ${planned} of the sales under a pre-set 10b5-1 plan`
          : ', none under a 10b5-1 plan';
  const buying =
    buys.length === 0
      ? 'and no one bought'
      : `and ${count(buys.length, 'open-market purchase')} too few or too spread out to cluster`;
  return `${lead}No buying cluster in ${period(days)}: ${count(sellers, 'insider')} sold ${count(sales.length, 'time')}${plan}, ${buying}`;
}

const NOT_SET_UP_CAUSE =
  'Insider trades come from SEC Form 4, through EDGAR. EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.';

/** The frame's reading of the answer and the period it may claim, shared by the heading and the frame. */
function coverageOf(d: PublicTicker) {
  const demo = dataMode === 'demo';
  const end = demo ? DEMO_DAY : localToday();
  const ins = d.insiders;
  const frame = ins ? insiderFrame(ins) : null;
  const backTo = frame?.kind === 'ready' && frame.partial ? frame.partial.backTo : null;
  return { demo, end, ins, frame, days: coveredDays(ins ?? {}, backTo, end) };
}

export function InsiderClustersSection({ d }: { d: PublicTicker }) {
  const { days } = coverageOf(d);
  return (
    <Box component="section" aria-labelledby="insider-trades" sx={{ display: 'grid', gap: 1.75 }}>
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box
          component="h2"
          id="insider-trades"
          sx={{
            m: 0,
            fontFamily: '"Archivo", "IBM Plex Sans", sans-serif',
            fontStretch: '112.5%',
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          {`Insider trades · ${period(days)}`}
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 13, color: 'text.secondary', maxWidth: '72ch', textWrap: 'pretty' }}
        >
          Every Form 4 by insider and date. A cluster is three or more insiders buying on the open
          market within ten days; sales under pre-set 10b5-1 plans never count.
        </Box>
      </Box>
      <InsiderClustersFrame d={d} />
    </Box>
  );
}

function InsiderClustersFrame({ d }: { d: PublicTicker }) {
  const { demo, end, ins, frame, days } = coverageOf(d);
  const metric = `${d.ticker} insider trades, ${period(days)}`;
  const source = demo
    ? { text: 'Demo · shaped like SEC Form 4' }
    : {
        text: 'SEC EDGAR · Form 4',
        href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(d.ticker)}&type=4&owner=include`,
      };
  const sub = `${d.ticker} Form 4 transactions by insider and date · ${period(days)} · ring = sale, filled = open-market purchase · shaded = 10 days with 3 or more insiders trading the same way`;
  const stale = !demo && tickerSecStale(d);
  const message = (
    tag: DataStateKey | null,
    tone: 'warn' | 'quiet',
    text: string,
    cause?: string,
    action?: React.ReactNode,
  ) => (
    <ChartFrame
      finding={metric}
      metric={metric}
      sub={sub}
      provenance={demo ? 'sample' : 'primary'}
      status={{ kind: 'message', tone, text, cause }}
      tag={tag ? { state: tag } : undefined}
      height={150}
      source={source}
      action={action}
      testId="chart-insider-clusters"
    />
  );
  // SEC answered and EDGAR lists no company under the symbol (an index, a fund, a fresh IPO): a fact
  // about the ticker, not a setup fault, so no tag and no operator step.
  if (notSecFiler(d))
    return message(
      null,
      'quiet',
      'Not an SEC filer.',
      `${d.filings_detail ?? `SEC EDGAR lists no company under ${d.ticker}.`} Funds, indexes and some foreign issuers read this way; there are no Form 4s to show.`,
    );
  if (ins?.state === 'not_configured' || d.filings_state === 'not_configured')
    return message(
      'notSetUp',
      'quiet',
      'SEC filings aren’t set up on this site yet.',
      NOT_SET_UP_CAUSE,
      <OperatorNote />,
    );
  if (ins?.state === 'off') return null;
  if (!ins || !frame || ins.state === 'unavailable')
    return message(
      'sourceDown',
      'warn',
      'Insider trades are unavailable right now.',
      `${ins?.detail ?? d.filings_detail ?? 'SEC EDGAR didn’t answer.'} There is no earlier copy. Unknown, not empty.`,
    );
  // An API from before the timeline (during a deploy, or after a rollback): no claim about trades.
  if (frame.kind === 'olderServer')
    return message(null, 'quiet', 'The 12-month timeline arrives with the next server update.');
  if (frame.kind === 'unread')
    return message(
      'sourceDown',
      'warn',
      'EDGAR didn’t answer for this year’s Form 4s.',
      `${count(frame.filings, 'Form 4')} ${frame.filings === 1 ? 'was' : 'were'} filed in the period and none could be read. Unknown, not empty.`,
    );
  if (frame.kind === 'emptyPartial')
    return message(
      stale ? 'lastGood' : 'computed',
      'quiet',
      `No open-market Form 4 trades among the ${frame.read} newest of ${count(frame.filings, 'filing')}${frame.backTo ? `, back to ${formatNoteDate(frame.backTo)}` : ''}.`,
      'The older filings in the period weren’t read, so this covers only those months. Option exercises, gifts and awards are left out.',
    );
  if (frame.kind === 'empty')
    return message(
      stale ? 'lastGood' : 'computed',
      'quiet',
      `No open-market Form 4 trades by ${d.ticker} insiders in ${period(days)}.`,
      'A cluster is three or more insiders buying on the open market within ten days. Option exercises, gifts and awards are left out.',
    );
  const tx = ins.transactions ?? [];
  const roles = ins.roles ?? [];
  const latestFiled = tx.reduce((m, t) => (t.filed > m ? t.filed : m), tx[0].filed);
  const partial = frame.partial;
  const coverage = partial
    ? ` ${count(partial.filings, 'Form 4')} were filed in the period; the newest ${partial.read} were read${partial.backTo ? `, back to ${formatNoteDate(partial.backTo)}` : ''}.`
    : '';
  const windows = [...(ins.clusters ?? []), ...(ins.sale_windows ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from),
  );
  // Every trade, one row each. On the live site the last column links to the trade's Form 4 on
  // sec.gov. The sample has no such column: its trades are invented, and their links would open the
  // company's real EDGAR page.
  const trades: TableTwinData = {
    caption: `${d.ticker} Form 4 trades by trade date`,
    cols: [
      'Trade date',
      'Insider',
      'Kind',
      'Shares',
      'Price',
      'Under a plan',
      'Filed',
      ...(demo ? [] : ['Filing']),
    ],
    rows: tx.map((t) => [
      formatNoteDate(t.trade_date),
      roles[t.insider] ?? 'Insider',
      t.kind === 'purchase' ? 'Purchase' : 'Sale',
      sharesText(t.shares),
      t.price == null ? '—' : `$${t.price.toFixed(2)}`,
      t.planned ? 'yes' : 'no',
      formatShortDate(t.filed),
      ...(demo
        ? []
        : [{ text: 'Form 4 ↗', href: t.url, label: `Form 4: ${tradeSentence(t, roles)}` }]),
    ]),
  };
  return (
    <ChartFrame
      finding={clustersFinding(ins, demo, days, end)}
      metric={metric}
      sub={sub}
      tag={stale ? { state: 'lastGood' } : { state: 'computed', detail: 'from Form 4' }}
      height={roles.length * 30 + 64}
      legend={<Legend />}
      source={source}
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : `Filed by ${formatShortDate(latestFiled)} · insiders file within 2 business days`
      }
      note={`A cluster counts open-market purchases only. Sales under a 10b5-1 plan were scheduled months ahead and never count; option exercises and gifts are left out. Roles, not names: the names stay in the filings.${coverage}`}
      // "Show the numbers": the windows, as the design's table twin, then every trade (S2-Q2).
      table={
        windows.length
          ? [
              {
                caption: 'Windows with 3 or more insiders trading the same way',
                cols: ['From', 'To', 'Kind', 'Insiders', 'Trades', 'Under a plan'],
                rows: windows.map((w) => [
                  formatNoteDate(w.from),
                  formatNoteDate(w.to),
                  (ins.clusters ?? []).includes(w) ? 'Buying cluster' : 'Sales',
                  w.insiders,
                  w.trades,
                  w.planned_trades === 0
                    ? 'none'
                    : w.planned_trades === w.trades
                      ? 'all'
                      : `${w.planned_trades} of ${w.trades}`,
                ]),
              },
              trades,
            ]
          : trades
      }
      testId="chart-insider-clusters"
    >
      {stale && d.filings_detail && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
          {d.filings_detail}
        </Box>
      )}
      <Timeline
        tx={tx}
        roles={roles}
        clusters={ins.clusters ?? []}
        saleWindows={ins.sale_windows ?? []}
        end={end}
        days={days}
      />
    </ChartFrame>
  );
}

function OperatorNote() {
  return (
    <Box component="details" sx={{ fontSize: 12, color: 'text.secondary' }}>
      <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24, ...coarseFloor }}>
        For the site’s operator
      </Box>
      <Box component="span" sx={{ ...MONO, fontSize: 11 }}>
        Set SEC_USER_AGENT on the API
      </Box>
    </Box>
  );
}

function Legend() {
  const t = useTheme();
  const roles = chartRoles(t);
  const key = (mark: React.ReactNode, label: string) => (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12 }}
    >
      {mark}
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {key(
        <svg width={12} height={12} aria-hidden>
          <circle cx={6} cy={6} r={4.5} fill="none" stroke={roles.ctx} strokeWidth={2} />
        </svg>,
        'Sale',
      )}
      {key(
        <svg width={12} height={12} aria-hidden>
          <circle cx={6} cy={6} r={6} fill={roles.emph} />
        </svg>,
        'Open-market purchase',
      )}
      {key(
        <svg width={14} height={10} aria-hidden>
          <rect width={14} height={10} rx={2} fill={roles.band} />
        </svg>,
        '3+ insiders within 10 days',
      )}
    </Box>
  );
}

function Timeline({
  tx,
  roles,
  clusters,
  saleWindows,
  end,
  days,
}: {
  tx: PublicInsiderTransaction[];
  roles: string[];
  clusters: PublicInsiderWindow[];
  saleWindows: PublicInsiderWindow[];
  end: string;
  days: number;
}) {
  const t = useTheme();
  const c = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = W > 0 && W < 600;
  const LABEL = compact ? 120 : 170;
  const PR = compact ? 12 : 24;
  const PT = 34;
  const ROW = 30;
  const roleSize = compact ? 11 : 12;
  const n = Math.max(1, roles.length);
  const H = PT + n * ROW + 26;
  const t1 = ms(end);
  const t0 = t1 - days * DAY;
  const x = (d: string) =>
    LABEL +
    ((Math.min(Math.max(ms(d), t0), t1) - t0) / (t1 - t0 || 1)) * Math.max(0, W - LABEL - PR);
  const y = (i: number) => PT + (i + 0.5) * ROW;
  // Month starts inside the period. A month is labelled only when its label's left edge clears the
  // last drawn label's right edge by 8px, the width estimated at 6.6px a character (11px IBM Plex
  // Mono at 0.6em): a narrow axis drops labels instead of shrinking or overprinting them (P-13).
  // Every month keeps its grid line. The first label drawn in each year carries the year ("Nov ’25
  // … Jan ’26"), so a month eleven months back never reads as this one.
  const months: { at: string; label: string | null }[] = [];
  const first = new Date(t0);
  let labelledYear = -1;
  let lastRight = -Infinity;
  for (let m = 1; m <= 13; m++) {
    const at = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + m, 1);
    if (at >= t1) break;
    const year = new Date(at).getUTCFullYear();
    const label = `${MONTHS[new Date(at).getUTCMonth()]}${year !== labelledYear ? ` ’${String(year).slice(2)}` : ''}`;
    const cx = x(iso(at));
    const half = (label.length * MONTH_CH) / 2;
    const show = cx - half >= lastRight + MONTH_GAP;
    if (show) {
      lastRight = cx + half;
      labelledYear = year;
    }
    months.push({ at: iso(at), label: show ? label : null });
  }
  const shaded = [...saleWindows, ...clusters];
  const labelled = clusters.length ? clusters : saleWindows.slice(-1);
  return (
    <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
      {W > 0 && (
        // One image with its summary as the label, and no tab stop on the plot (S2-Q3): the frame's
        // source chip and "Show the numbers" are the chart's keyboard path, and the twin has every
        // trade. Inside role="img" the marks are presentational.
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`${count(tx.filter((v) => v.kind === 'sale').length, 'sale')} and ${count(tx.filter((v) => v.kind === 'purchase').length, 'purchase')} by ${count(roles.length, 'insider')}; ${count(clusters.length, 'buying cluster')}`}
          style={{ display: 'block' }}
        >
          {shaded.map((w) => (
            <rect
              key={`${w.from}-${w.to}`}
              x={x(w.from) - 4}
              y={PT}
              width={Math.max(8, x(w.to) - x(w.from) + 8)}
              height={n * ROW}
              rx={3}
              fill={c.band}
            />
          ))}
          {months.map((m) => (
            <g key={m.at}>
              <line x1={x(m.at)} x2={x(m.at)} y1={PT} y2={PT + n * ROW} stroke={c.grid} />
              {m.label && (
                <text
                  x={x(m.at)}
                  y={PT + n * ROW + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill={t.palette.text.secondary}
                  style={MONO}
                >
                  {m.label}
                </text>
              )}
            </g>
          ))}
          {roles.map((r, i) => (
            <g key={r}>
              <line x1={LABEL} x2={W - PR} y1={y(i)} y2={y(i)} stroke={c.grid} />
              {/* The role wraps to two lines inside the label column (two lines fit the row), so a
                  title such as "EVP & Chief Financial Officer" reads whole on a phone. SVG text
                  cannot wrap, so the label is HTML; only a role past two lines ends in "…", and the
                  hover title has it in full. */}
              <foreignObject x={0} y={y(i) - ROW / 2} width={LABEL - 10} height={ROW}>
                <Box
                  title={r}
                  sx={{
                    height: ROW,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      minWidth: 0,
                      overflowWrap: 'break-word',
                      textAlign: 'right',
                      fontSize: roleSize,
                      lineHeight: `${roleSize + 2}px`,
                      color: 'text.secondary',
                    }}
                  >
                    {r}
                  </Box>
                </Box>
              </foreignObject>
            </g>
          ))}
          {labelled.map((w) => {
            const buy = clusters.includes(w);
            const label = buy
              ? `Buying cluster · ${w.insiders} insiders`
              : `${w.insiders} insiders sold${w.planned_trades === w.trades ? ' · plans' : ''}`;
            const at = x(w.from);
            const anchor = at > W - 160 ? 'end' : 'start';
            return (
              <text
                key={`l-${w.from}`}
                x={anchor === 'end' ? Math.min(W - PR, x(w.to) + 4) : at - 4}
                y={PT - 10}
                textAnchor={anchor}
                fontSize={11}
                fontWeight={buy ? 600 : 400}
                fill={buy ? t.palette.text.primary : t.palette.text.secondary}
                style={MONO}
              >
                {label}
              </text>
            );
          })}
          {/* A dot is a mark, not a link: aria-hidden, never focusable, its hover title kept. The
              twin's trades table carries each one's sentence and its Form 4 link. */}
          {tx.map((v, i) => {
            const buy = v.kind === 'purchase';
            return (
              <circle
                key={`${v.accession}-${i}`}
                aria-hidden
                cx={x(v.trade_date)}
                cy={y(v.insider)}
                {...(buy
                  ? { r: 6, fill: c.emph }
                  : { r: 4.5, fill: t.palette.background.paper, stroke: c.ctx, strokeWidth: 2 })}
              >
                <title>{tradeSentence(v, roles)}</title>
              </circle>
            );
          })}
        </svg>
      )}
    </Box>
  );
}
