/**
 * A company against its peers (design: Planned · Peers, PEERS_SPEC and its boards). Two dot strips,
 * one per question, for one calendar quarter from the SEC's XBRL frames (apps/api xbrl_frames.rs):
 * GAAP gross margin, and revenue growth on the same quarter a year earlier. The note's company is
 * filled, peers are rings; only it and the extremes are labelled, every value is in the table. The
 * growth strip draws its zero line whenever a peer shrank (P-11). Peers that haven't filed are named
 * in the as-of line, never dropped silently.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { dataMode, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { formatNoteDate } from './format';
import { peersFinding, peersView, quarterLabel, type PublicPeerRow } from './peersRead';
import { MONO } from './ui';
import { useWidth } from './useWidth';

const DEMO_DAY = '2026-10-07';
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;

export function PeersSection({ d }: { d: PublicTicker }) {
  if (peersView(d).kind === 'hidden') return null;
  return (
    <Box
      component="section"
      aria-labelledby="against-peers"
      sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box
          component="h2"
          id="against-peers"
          sx={{
            m: 0,
            fontFamily: '"Archivo", "IBM Plex Sans", sans-serif',
            fontStretch: '112.5%',
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          Against its peers
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 13, color: 'text.secondary', maxWidth: '72ch', textWrap: 'pretty' }}
        >
          Reported figures across the note’s peer list for the same calendar quarter, from each
          company’s tagged filing.
        </Box>
      </Box>
      <PeersFrame d={d} />
    </Box>
  );
}

function PeersFrame({ d }: { d: PublicTicker }) {
  const demo = dataMode === 'demo';
  const view = peersView(d);
  const p = d.peers;
  const q = quarterLabel(p?.quarter);
  const metric = p?.quarter
    ? `${d.ticker} against its peers, ${q}`
    : `${d.ticker} against its peers`;
  const source = demo
    ? { text: 'Demo · shaped like SEC XBRL frames' }
    : {
        text: 'SEC · XBRL frames API',
        href: p?.quarter
          ? `https://data.sec.gov/api/xbrl/frames/us-gaap/GrossProfit/USD/${p.quarter}.json`
          : undefined,
      };
  const rows = p?.rows ?? [];
  const sub = rows.length
    ? `${demo ? 'Sample peers' : `${rows.length} filers on the note’s peer list`} · calendar quarter ${demo ? '(sample)' : q} · filled = ${d.ticker}, rings = peers · labelled: ${d.ticker} and the extremes; every value in the table`
    : `${d.ticker} and the peers on its note’s list · GAAP gross margin and revenue growth on a year · one calendar quarter, from each company’s tagged filing`;
  const message = (
    tag: DataStateKey,
    tone: 'warn' | 'quiet',
    text: string,
    cause?: string,
    action?: ReactNode,
  ) => (
    <ChartFrame
      finding={metric}
      metric={metric}
      sub={sub}
      status={{ kind: 'message', tone, text, cause }}
      tag={{ state: tag }}
      height={200}
      source={source}
      action={action}
      testId="chart-peers"
    />
  );
  if (view.kind === 'hidden' || !p) return null;
  if (view.kind === 'notSetUp')
    return message(
      'notSetUp',
      'quiet',
      'SEC filings aren’t set up on this site yet.',
      'Peer figures come from the SEC’s XBRL frames, through EDGAR. EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.',
      <Box component="details" sx={{ fontSize: 12, color: 'text.secondary' }}>
        <Box component="summary" sx={{ cursor: 'pointer', minHeight: 24 }}>
          For the site’s operator
        </Box>
        <Box component="span" sx={{ ...MONO, fontSize: 11 }}>
          Set SEC_USER_AGENT on the API
        </Box>
      </Box>,
    );
  if (view.kind === 'unavailable')
    return message(
      'sourceDown',
      'warn',
      'Peer figures are unavailable right now.',
      `${view.cause} The note above doesn’t depend on them.`,
    );
  if (view.kind === 'empty')
    return message('computed', 'quiet', 'Not enough peers have filed this quarter.', view.cause);
  const missing = view.missing;
  const listed = rows.filter((r) => !r.subject).length + missing.length;
  return (
    <ChartFrame
      finding={peersFinding(p, d.ticker, demo)}
      metric={metric}
      sub={sub}
      tag={
        view.stale
          ? { state: 'lastGood' }
          : missing.length
            ? { state: 'delayed', word: `${missing.length} of ${listed} not filed` }
            : { state: 'computed', detail: q }
      }
      height={2 * 112}
      source={source}
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : `${p.quarter} · ${listed - missing.length} of ${listed} peers have filed${missing.length ? `; not in the frames yet: ${missing.join(', ')}` : ''}`
      }
      note="Fiscal quarters differ: the frames API places each filing’s quarter in the calendar quarter it mostly covers (a quarter to late July counts as Q2). Growth compares the same company’s same calendar quarter a year earlier. A peer that tags no gross profit is left off that strip and kept in the table."
      table={{
        caption: `Peers, calendar quarter ${q}`,
        cols: ['Ticker', 'Gross margin', 'Revenue growth', 'Revenue, $B', 'Quarter as filed'],
        rows: rows.map((r) => [
          r.subject ? `${r.ticker} (this note)` : r.ticker,
          r.gross_margin_pct == null ? 'not tagged' : `${r.gross_margin_pct.toFixed(1)}%`,
          r.growth_pct == null ? 'no year-earlier quarter' : signed(r.growth_pct),
          (r.revenue / 1e9).toFixed(2),
          r.start ? `${r.start} to ${r.end}` : r.end,
        ]),
      }}
      testId="chart-peers"
    >
      {view.stale && p.detail && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
          {p.detail}
        </Box>
      )}
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Strip title="GAAP gross margin, %" rows={rows} pick={(r) => r.gross_margin_pct} />
        <Strip title="Revenue growth on a year, %" rows={rows} pick={(r) => r.growth_pct} zero />
      </Box>
    </ChartFrame>
  );
}

function ticksFor(lo: number, hi: number): number[] {
  const span = hi - lo || 1;
  const raw = span / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}

function Strip({
  title,
  rows,
  pick,
  zero = false,
}: {
  title: string;
  rows: PublicPeerRow[];
  pick: (r: PublicPeerRow) => number | null | undefined;
  zero?: boolean;
}) {
  const t = useTheme();
  const c = chartRoles(t);
  const [ref, W] = useWidth<HTMLDivElement>();
  const vals = rows
    .filter((r) => pick(r) != null)
    .map((r) => ({ t: r.ticker, v: pick(r) as number, me: r.subject }))
    .sort((a, b) => a.v - b.v);
  const lo0 = Math.min(...vals.map((v) => v.v), zero ? 0 : Infinity);
  const hi0 = Math.max(...vals.map((v) => v.v));
  const ticks = ticksFor(Math.min(lo0, hi0 - 1), hi0);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const PL = 14;
  const PR = 14;
  const H = 92;
  const AXIS = 66;
  const x = (v: number) => PL + ((v - lo) / (hi - lo || 1)) * Math.max(0, W - PL - PR);
  const me = vals.find((v) => v.me);
  const compact = W > 0 && W < 520;
  // NVDA and the extremes are labelled; a label crowding NVDA's rises a row.
  const labelled = vals.filter((v, i) => v.me || i === 0 || i === vals.length - 1);
  const negative = vals.some((v) => v.v < 0);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {title}
      </Box>
      <Box ref={ref} sx={{ height: H, minWidth: 0 }}>
        {W > 0 && (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`${title}: ${vals.map((v) => `${v.t} ${v.v.toFixed(1)}%`).join(', ')}`}
            style={{ display: 'block' }}
          >
            <line x1={PL} x2={W - PR} y1={AXIS} y2={AXIS} stroke={c.grid} />
            {ticks.map((v, i) => (
              <g key={v}>
                <line x1={x(v)} x2={x(v)} y1={AXIS - 3} y2={AXIS + 3} stroke={c.grid} />
                {(!compact || i % 2 === 0 || i === ticks.length - 1) && (
                  <text
                    x={x(v)}
                    y={AXIS + 18}
                    textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                    fontSize={11}
                    fill={t.palette.text.secondary}
                    style={MONO}
                  >
                    {`${v < 0 ? '−' : ''}${Math.abs(v)}%`}
                  </text>
                )}
              </g>
            ))}
            {zero && negative && (
              <line
                x1={x(0)}
                x2={x(0)}
                y1={AXIS - 24}
                y2={AXIS + 4}
                stroke={c.axis}
                strokeWidth={1}
              />
            )}
            {vals.map((v) =>
              v.me ? (
                <circle key={v.t} cx={x(v.v)} cy={AXIS - 16} r={6} fill={c.emph} />
              ) : (
                <circle
                  key={v.t}
                  cx={x(v.v)}
                  cy={AXIS - 16}
                  r={4.5}
                  fill={t.palette.background.paper}
                  stroke={c.ctx}
                  strokeWidth={2}
                />
              ),
            )}
            {labelled.map((v) => {
              const near = !v.me && me && Math.abs(x(v.v) - x(me.v)) < 70;
              const at = x(v.v);
              const anchor = at < 60 ? 'start' : at > W - 60 ? 'end' : 'middle';
              return (
                <text
                  key={`l-${v.t}`}
                  x={at}
                  y={near ? 12 : AXIS - 28}
                  textAnchor={anchor}
                  fontSize={11}
                  fontWeight={v.me ? 600 : 400}
                  fill={v.me ? t.palette.text.primary : t.palette.text.secondary}
                  style={MONO}
                >
                  {`${v.t} ${signedIf(v.v, zero)}`}
                </text>
              );
            })}
          </svg>
        )}
      </Box>
    </Box>
  );
}

const signedIf = (v: number, withSign: boolean) => (withSign ? signed(v) : `${v.toFixed(1)}%`);
