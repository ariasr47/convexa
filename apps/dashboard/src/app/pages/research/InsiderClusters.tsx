/**
 * Insider trades over twelve months (design: Planned · Insider clusters, CLUSTERS_SPEC). Every Form 4
 * open-market trade on a row per insider, placed by trade date (DB-08), never by index. A ring is a
 * sale and a filled dot an open-market purchase: shape carries the kind, never hue (P-11). Shaded
 * spans are ten days with three or more insiders trading the same way; only a buying span outside any
 * 10b5-1 plan is a cluster, which the API works out (apps/api insider_trades.rs) and this draws.
 * Roles, not names: each dot links to its filing, where the names are.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
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
import { MONO } from './ui';
import { useWidth } from './useWidth';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEMO_DAY = '2026-10-07';
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const span = (w: PublicInsiderWindow) => Math.round((ms(w.to) - ms(w.from)) / DAY) + 1;
const period = (days: number) => (days >= 360 ? '12 months' : `${Math.round(days / 30.4)} months`);
const sharesText = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const numberWord = (n: number) =>
  ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n);

/** The frame's title over data: the latest buying cluster, or why there is none (P-10). */
export function clustersFinding(
  ins: Pick<PublicInsiders, 'clusters' | 'transactions' | 'history_days'>,
  demo: boolean,
): string {
  const lead = demo ? 'In the sample, ' : '';
  const clusters = ins.clusters ?? [];
  const tx = ins.transactions ?? [];
  if (clusters.length) {
    const last = clusters[clusters.length - 1];
    const month = MONTHS[Number(last.to.slice(5, 7)) - 1];
    const more =
      clusters.length > 1
        ? ` (${count(clusters.length, 'cluster')} in ${period(ins.history_days)})`
        : '';
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
  return `${lead}No buying cluster in ${period(ins.history_days)}: ${count(sellers, 'insider')} sold ${count(sales.length, 'time')}${plan}, ${buying}`;
}

const NOT_SET_UP_CAUSE =
  'Insider trades come from SEC Form 4, through EDGAR. EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.';

export function InsiderClustersSection({ d }: { d: PublicTicker }) {
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
          {`Insider trades · ${period(d.insiders?.history_days ?? 365)}`}
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
  const demo = dataMode === 'demo';
  const ins = d.insiders;
  const metric = `${d.ticker} insider trades, ${period(ins?.history_days ?? 365)}`;
  const source = demo
    ? { text: 'Demo · shaped like SEC Form 4' }
    : {
        text: 'SEC EDGAR · Form 4',
        href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(d.ticker)}&type=4&owner=include`,
      };
  const sub = `${d.ticker} Form 4 transactions by insider and date · ${period(ins?.history_days ?? 365)} · ring = sale, filled = open-market purchase · shaded = 10 days with 3 or more insiders trading the same way`;
  const message = (
    tag: DataStateKey,
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
      tag={{ state: tag }}
      height={150}
      source={source}
      action={action}
      testId="chart-insider-clusters"
    />
  );
  if (!ins || ins.state === 'not_configured')
    return message(
      'notSetUp',
      'quiet',
      'SEC filings aren’t set up on this site yet.',
      NOT_SET_UP_CAUSE,
      <OperatorNote />,
    );
  if (ins.state === 'unavailable')
    return message(
      'sourceDown',
      'warn',
      'Insider trades are unavailable right now.',
      `${ins.detail ?? 'SEC EDGAR didn’t answer'} There is no earlier copy. Unknown, not empty.`,
    );
  if (ins.state === 'off') return null;
  const tx = ins.transactions ?? [];
  const roles = ins.roles ?? [];
  if (tx.length === 0)
    return message(
      'computed',
      'quiet',
      `No open-market Form 4 trades by ${d.ticker} insiders in ${period(ins.history_days)}.`,
      'A cluster is three or more insiders buying on the open market within ten days. Option exercises, gifts and awards are left out.',
    );
  const stale = !demo && !!ins.detail && /did not answer/i.test(ins.detail);
  const latestFiled = tx.reduce((m, t) => (t.filed > m ? t.filed : m), tx[0].filed);
  const coverage =
    ins.history_reaches_back_to && ins.history_filings_read < ins.history_filings
      ? ` ${count(ins.history_filings, 'Form 4')} were filed in the period; the newest ${ins.history_filings_read} were read, back to ${formatNoteDate(ins.history_reaches_back_to)}.`
      : '';
  const windows = [...(ins.clusters ?? []), ...(ins.sale_windows ?? [])].sort((a, b) =>
    a.from.localeCompare(b.from),
  );
  return (
    <ChartFrame
      finding={clustersFinding(ins, demo)}
      metric={metric}
      sub={sub}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : stale
            ? { state: 'lastGood' }
            : { state: 'computed', detail: 'from Form 4' }
      }
      height={roles.length * 30 + 64}
      legend={<Legend />}
      source={source}
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : `Filed by ${formatShortDate(latestFiled)} · insiders file within 2 business days`
      }
      note={`A cluster counts open-market purchases only. Sales under a 10b5-1 plan were scheduled months ahead and never count; option exercises and gifts are left out. Roles, not names: the names stay in the filings.${coverage}`}
      // "Show the numbers": the windows, as the design's table twin; with none, every trade.
      table={
        windows.length
          ? {
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
            }
          : {
              caption: `${d.ticker} Form 4 trades by trade date`,
              cols: ['Trade date', 'Insider', 'Kind', 'Shares', 'Price', 'Under a plan', 'Filed'],
              rows: tx.map((t) => [
                formatNoteDate(t.trade_date),
                roles[t.insider] ?? 'Insider',
                t.kind === 'purchase' ? 'Purchase' : 'Sale',
                sharesText(t.shares),
                t.price == null ? '—' : `$${t.price.toFixed(2)}`,
                t.planned ? 'yes' : 'no',
                formatShortDate(t.filed),
              ]),
            }
      }
      testId="chart-insider-clusters"
    >
      {stale && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
          {ins.detail}
        </Box>
      )}
      <Timeline
        tx={tx}
        roles={roles}
        clusters={ins.clusters ?? []}
        saleWindows={ins.sale_windows ?? []}
        end={demo ? DEMO_DAY : localToday()}
        days={ins.history_days}
      />
    </ChartFrame>
  );
}

function OperatorNote() {
  return (
    <Box component="details" sx={{ fontSize: 12, color: 'text.secondary' }}>
      <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24 }}>
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
  const n = Math.max(1, roles.length);
  const H = PT + n * ROW + 26;
  const t1 = ms(end);
  const t0 = t1 - days * DAY;
  const x = (d: string) =>
    LABEL +
    ((Math.min(Math.max(ms(d), t0), t1) - t0) / (t1 - t0 || 1)) * Math.max(0, W - LABEL - PR);
  const y = (i: number) => PT + (i + 0.5) * ROW;
  // Month starts inside the period; on a phone every other label shows.
  const months: { at: string; label: string; show: boolean }[] = [];
  const first = new Date(t0);
  for (let m = 1; m <= 13; m++) {
    const at = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + m, 1);
    if (at >= t1) break;
    months.push({
      at: iso(at),
      label: MONTHS[new Date(at).getUTCMonth()],
      show: !compact || m % 2 === 1,
    });
  }
  const shaded = [...saleWindows, ...clusters];
  const labelled = clusters.length ? clusters : saleWindows.slice(-1);
  return (
    <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
      {W > 0 && (
        <svg
          width={W}
          height={H}
          role="group"
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
              {m.show && (
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
              <text
                x={LABEL - 10}
                y={y(i) + 4}
                textAnchor="end"
                fontSize={compact ? 11 : 12}
                fill={t.palette.text.secondary}
              >
                {clip(r, compact ? 15 : 24)}
                <title>{r}</title>
              </text>
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
          {tx.map((v, i) => {
            const buy = v.kind === 'purchase';
            const role = roles[v.insider] ?? 'Insider';
            const what = `${role} ${buy ? 'bought' : 'sold'} ${sharesText(v.shares)} shares on ${formatNoteDate(v.trade_date)}${v.planned ? ' under a 10b5-1 plan' : ''}; filed ${formatShortDate(v.filed)}`;
            return (
              <a
                key={`${v.accession}-${i}`}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={what}
              >
                <title>{what}</title>
                {buy ? (
                  <circle cx={x(v.trade_date)} cy={y(v.insider)} r={6} fill={c.emph} />
                ) : (
                  <circle
                    cx={x(v.trade_date)}
                    cy={y(v.insider)}
                    r={4.5}
                    fill={t.palette.background.paper}
                    stroke={c.ctx}
                    strokeWidth={2}
                  />
                )}
              </a>
            );
          })}
        </svg>
      )}
    </Box>
  );
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
