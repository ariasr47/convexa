/**
 * Fund holdings from 13F filings (design: Planned · Fund holdings (13F), HOLDERS_SPEC and its boards).
 * The largest holders among the managers Convexa reads (apps/api edgar_13f.rs), at the last complete
 * quarter, as a % of shares outstanding with the change in points since the quarter before: a split or
 * a buyback can't read as buying. ▲/▼ with the number carry the sign, never green or red (P-11).
 * Holder names are as filed. During the filing window the chart stays on the complete quarter and the
 * strip counts what has arrived for the next one.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { dataMode, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { formatNoteDate, formatShortDate } from './format';
import {
  changeText,
  heldText,
  holdersFinding,
  holdersView,
  type PublicHolder,
  type PublicHolders,
} from './holdersRead';
import { Caps } from './publicUi';
import { MONO } from './ui';

const DEMO_DAY = '2026-10-07';
const one = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const quarterTo = (d: string | null | undefined) =>
  d ? `quarter to ${formatShortDate(d)}` : 'the last complete quarter';
const weekday = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export function FundHoldingsSection({ d }: { d: PublicTicker }) {
  const view = holdersView(d);
  if (view.kind === 'hidden') return null;
  return (
    <Box
      component="section"
      aria-labelledby="fund-holdings"
      sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Box
          component="h2"
          id="fund-holdings"
          sx={{
            m: 0,
            fontFamily: '"Archivo", "IBM Plex Sans", sans-serif',
            fontStretch: '112.5%',
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          Who holds it
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 13, color: 'text.secondary', maxWidth: '72ch', textWrap: 'pretty' }}
        >
          The largest institutional holders at the last complete quarter, from their 13F filings,
          and what each added or cut. 13F arrives up to 45 days after the quarter, by law.
        </Box>
      </Box>
      {view.kind === 'ready' && d.holders && <HoldersStrip h={d.holders} />}
      <HoldersFrame d={d} />
    </Box>
  );
}

function HoldersStrip({ h }: { h: PublicHolders }) {
  const demo = dataMode === 'demo';
  const receipts = h.units === 'receipts';
  const cells: { label: string; value: string; sub: string }[] = [
    receipts
      ? {
          label: `These ${h.managers_read} managers`,
          value: heldText((h.holders ?? []).reduce((s, r) => s + r.shares, 0)),
          sub: 'depositary receipts held · no % of shares (the ratio isn’t in the filing)',
        }
      : {
          label: `These ${h.managers_read} managers`,
          value: h.total_pct == null ? '—' : `${one(h.total_pct)}%`,
          sub: `of ${demo ? 'sample ' : ''}shares outstanding${h.total_change_pts == null ? '' : ` · ${changeText(h.total_change_pts)} pts on the quarter`}`,
        },
    {
      label: 'Managers holding',
      value: `${h.managers_holding} of ${h.managers_read}`,
      sub: `${quarterTo(h.quarter_end)} · of the ${h.managers_listed} largest 13F filers read`,
    },
    h.window
      ? {
          label: `Quarter to ${formatShortDate(h.window.quarter_end)}`,
          value: `${h.window.filed} of ${h.window.of} filed`,
          sub: `window open · due ${weekday(h.window.deadline)} ${formatShortDate(h.window.deadline)}; the chart switches then`,
        }
      : {
          label: 'Next quarter',
          value: 'Not open',
          sub: 'its filings arrive in the 45 days after it ends',
        },
  ];
  return (
    <Box
      role="group"
      aria-label="Fund holdings at a glance"
      sx={(t) => ({
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
        gap: '1px',
        bgcolor: t.palette.divider,
        border: `1px ${demo ? 'dashed' : 'solid'} ${demo ? alpha(t.palette.text.secondary, 0.55) : t.palette.divider}`,
      })}
    >
      {cells.map((c, i) => (
        <Box
          key={c.label}
          sx={{
            bgcolor: 'background.paper',
            p: { xs: '12px 14px', sm: '14px 18px' },
            display: 'grid',
            gap: 0.5,
            alignContent: 'start',
            minWidth: 0,
            // Three cells: on a phone the last spans the row (the strip becomes 2 + 1).
            gridColumn: { xs: i === 2 ? '1 / -1' : 'auto', sm: 'auto' },
          }}
        >
          <Caps>{c.label}</Caps>
          <Box
            component="span"
            sx={{ ...MONO, fontSize: { xs: 20, sm: 24 }, fontWeight: 500, lineHeight: 1.2 }}
          >
            {c.value}
          </Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
            {c.sub}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function HoldersFrame({ d }: { d: PublicTicker }) {
  const demo = dataMode === 'demo';
  const view = holdersView(d);
  const h = d.holders;
  const metric = `${d.ticker} largest 13F holders`;
  const source = demo
    ? { text: 'Demo · shaped like SEC 13F-HR information tables' }
    : {
        text: 'SEC EDGAR · 13F-HR',
        href: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F-HR',
      };
  const receipts = h?.units === 'receipts';
  const sub = receipts
    ? `${d.ticker} depositary receipts held at the quarter’s end by the largest 13F filers Convexa reads · receipts, not % of shares · ▲/▼ = change since the prior quarter · long US-listed positions only`
    : `${d.ticker} shares held at the quarter’s end by the largest 13F filers Convexa reads · % of the ${
        h?.shares_outstanding ? (demo ? 'sample' : heldText(h.shares_outstanding.value)) : ''
      } shares outstanding · ▲/▼ = change in points since the prior quarter · long US-listed positions only`;
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
      provenance={demo ? 'sample' : 'primary'}
      status={{ kind: 'message', tone, text, cause }}
      tag={
        demo
          ? { state: 'demo' }
          : {
              state: tag,
              ...(tag === 'delayed' ? { word: 'Delayed by law', detail: '45 days' } : {}),
            }
      }
      height={150}
      source={source}
      action={action}
      testId="chart-fund-holdings"
    />
  );
  if (view.kind === 'hidden' || !h) return null;
  if (view.kind === 'notSetUp')
    return message(
      'notSetUp',
      'quiet',
      'SEC filings aren’t set up on this site yet.',
      'Fund holdings come from 13F filings, through EDGAR. EDGAR asks every program that reads it to identify itself with a contact address; this site hasn’t been given one.',
      <OperatorNote />,
    );
  if (view.kind === 'unavailable')
    return message(
      'sourceDown',
      'warn',
      'Fund holdings are unavailable right now.',
      `${view.cause} Unknown, not empty.`,
    );
  if (view.kind === 'empty')
    return message(
      'delayed',
      'quiet',
      'No 13F filer among those read reports this security.',
      `${view.cause} 13F covers US-listed stocks held by managers with over $100M; Convexa reads the ${h.managers_listed} largest.`,
    );
  const rows = h.holders ?? [];
  return (
    <ChartFrame
      finding={holdersFinding(h, d.ticker, demo)}
      metric={metric}
      sub={sub}
      provenance={demo ? 'sample' : 'primary'}
      tag={
        demo
          ? { state: 'demo' }
          : view.stale
            ? { state: 'lastGood' }
            : { state: 'delayed', word: 'Delayed by law', detail: '45 days' }
      }
      height={rows.length * 34 + 30}
      source={source}
      asOf={
        demo
          ? `Scenario · ${formatNoteDate(DEMO_DAY)}`
          : `${quarterTo(h.quarter_end).replace(/^q/, 'Q')} · filed by ${formatShortDate(
              rows.reduce((m, r) => (r.filed > m ? r.filed : m), rows[0].filed),
            )}`
      }
      note={`Change is in points of shares outstanding, so a split or a buyback can’t read as buying. 13F covers long positions in US-listed securities only; what anyone bought or sold since ${formatShortDate(h.quarter_end ?? DEMO_DAY)} isn’t in it. Convexa reads the 13F-HRs of the ${h.managers_listed} largest filers; holder names are as filed.`}
      table={{
        caption: 'Largest 13F holders',
        cols: receipts
          ? ['Holder', 'Receipts held', 'Prior quarter', 'Filed']
          : ['Holder', '% of shares', 'Change, pts', 'Shares held', 'Filed'],
        rows: rows.map((r) =>
          receipts
            ? [
                r.manager,
                heldText(r.shares),
                r.prior_shares == null ? 'not filed' : heldText(r.prior_shares),
                formatShortDate(r.filed),
              ]
            : [
                r.manager,
                r.pct == null ? '—' : one(r.pct),
                r.change_pts == null
                  ? 'no prior report'
                  : `${r.change_pts > 0 ? '+' : r.change_pts < 0 ? '−' : ''}${one(Math.abs(r.change_pts))}`,
                heldText(r.shares),
                formatShortDate(r.filed),
              ],
        ),
      }}
      testId="chart-fund-holdings"
    >
      {view.stale && h.detail && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'warning.main', textWrap: 'pretty' }}>
          {h.detail}
        </Box>
      )}
      <BarList rows={rows} receipts={receipts} />
    </ChartFrame>
  );
}

/** Room kept right of the longest bar for its label (`8.4% · ▲ 0.2`). */
const LABEL_ROOM = 100;

/** A tidy step for a 0..max axis: 1, 2 or 5 × 10^n, at most four steps. */
function axis(max: number): number[] {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(6));
}

function BarList({ rows, receipts }: { rows: PublicHolder[]; receipts: boolean }) {
  const t = useTheme();
  const roles = chartRoles(t);
  const value = (r: PublicHolder) => (receipts ? r.shares : (r.pct ?? 0));
  const ticks = axis(Math.max(...rows.map(value), receipts ? 1 : 0.1));
  const top = ticks[ticks.length - 1] || 1;
  // The largest change is the one the title names: its bar carries the claim (P-9).
  const biggest = rows.reduce<PublicHolder | null>(
    (a, r) =>
      r.change_pts != null && (!a || Math.abs(r.change_pts) > Math.abs(a.change_pts ?? 0)) ? r : a,
    null,
  );
  const label = (r: PublicHolder) =>
    receipts ? heldText(r.shares) : `${one(r.pct ?? 0)}% · ${changeText(r.change_pts)}`;
  const tickText = (v: number) => (receipts ? heldText(v) : `${v}%`);
  return (
    <Box
      role="img"
      aria-label={rows
        .map((r) => `${r.manager} ${label(r).replace('▲', 'up').replace('▼', 'down')}`)
        .join('; ')}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '150px minmax(0, 1fr)', sm: '190px minmax(0, 1fr)' },
        columnGap: 1.5,
        rowGap: 0.75,
        alignItems: 'center',
      }}
    >
      {rows.map((r) => {
        const emph = biggest?.cik === r.cik;
        return (
          <Box key={r.cik} sx={{ display: 'contents' }}>
            <Box
              component="span"
              title={r.manager}
              sx={{
                fontSize: 12.5,
                lineHeight: 1.25,
                color: emph ? 'text.primary' : 'text.secondary',
                fontWeight: emph ? 600 : 400,
                overflowWrap: 'anywhere',
              }}
            >
              {r.manager}
            </Box>
            <Box
              sx={{
                position: 'relative',
                height: 26,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  height: 14,
                  // The scale leaves room for the value label at the bar's end (P-13).
                  width: `calc((100% - ${LABEL_ROOM}px) * ${Math.max(0.005, value(r) / top)})`,
                  bgcolor: emph ? roles.emph : roles.ctx2,
                  borderRadius: '2px',
                  flex: 'none',
                }}
              />
              <Box
                component="span"
                sx={{
                  ...MONO,
                  fontSize: 11.5,
                  ml: 1,
                  whiteSpace: 'nowrap',
                  color: emph ? 'text.primary' : 'text.secondary',
                }}
              >
                {label(r)}
              </Box>
            </Box>
          </Box>
        );
      })}
      <Box />
      <Box
        aria-hidden
        sx={{
          position: 'relative',
          height: 16,
          width: `calc(100% - ${LABEL_ROOM}px)`,
          borderTop: 1,
          borderColor: roles.axis,
          mt: 0.5,
        }}
      >
        {ticks.map((v, i) => (
          <Box
            key={v}
            component="span"
            sx={{
              ...MONO,
              position: 'absolute',
              top: 2,
              left: `${(v / top) * 100}%`,
              transform:
                i === 0
                  ? 'none'
                  : i === ticks.length - 1
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            {tickText(v)}
          </Box>
        ))}
      </Box>
    </Box>
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
