/**
 * Below a ticker's note: who is positioned how (short interest, short-sale volume, insider trades) and
 * what the company has filed since the note was written. Each card names its source and its delay,
 * because each source reports late in its own way.
 */
import { dataMode, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { localToday, upcoming } from 'virtual:convexa-research';
import { standing } from './filings';
import { formatNoteDate, formatShortDate } from './format';
import type { Read } from './publicData';
import { Caps, SourceProblem, StaleNote } from './publicUi';
import type { Aging } from './types';
import { DISPLAY, MONO, PANEL_SX } from './ui';

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
        {d.detail && dataMode !== 'demo' && <StaleNote text={d.detail} />}
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
        </Box>
        {d.filings_state === 'not_configured' ? (
          <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
            SEC filings aren&apos;t set up on this server yet (EDGAR needs an identifying contact
            address).
          </Box>
        ) : d.filings_state === 'unavailable' && d.filings.length === 0 ? (
          <Box component="p" sx={{ m: 0, fontSize: 14, color: 'text.secondary' }}>
            {d.filings_detail ?? 'EDGAR did not answer.'}
          </Box>
        ) : newFilings.length === 0 ? (
          <Box
            sx={(t) => ({
              display: 'grid',
              gap: 1,
              p: 2,
              borderRadius: '10px',
              border: `1px dashed ${alpha(t.palette.text.secondary, 0.4)}`,
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

function Card({
  label,
  value,
  unit,
  children,
  source,
}: {
  label: string;
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
      <Caps>{label}</Caps>
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

function Missing({ label, text }: { label: string; text: string }) {
  return (
    <Box
      component="article"
      sx={(t) => ({
        ...PANEL_SX,
        p: '18px 20px',
        display: 'grid',
        gap: 1,
        alignContent: 'start',
        border: `1px dashed ${alpha(t.palette.text.secondary, 0.4)}`,
      })}
    >
      <Caps>{label}</Caps>
      <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
        {text}
      </Box>
    </Box>
  );
}

function ShortInterestCard({ d }: { d: PublicTicker }) {
  const si = d.short_interest;
  if (!si)
    return (
      <Missing label="Short interest" text="FINRA has no short-interest report for this symbol." />
    );
  const share = d.shares_outstanding ? si.shares_short / d.shares_outstanding.value : null;
  const max = Math.max(...si.history.map((h) => h.shares_short), si.shares_short, 1);
  return (
    <Card
      label="Short interest"
      value={share !== null ? `${(share * 100).toFixed(2)}%` : big(si.shares_short)}
      unit={share !== null ? 'of shares out' : 'shares'}
      source={`FINRA · settlement ${formatShortDate(si.settlement_date)}, published about a week later`}
    >
      {si.history.length > 1 && (
        <Box
          role="img"
          aria-label={`Shares short, last ${si.history.length} reports: ${si.history.map((h) => big(h.shares_short)).join(', ')}`}
          sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 40 }}
        >
          {si.history.map((h, i) => (
            <Box
              key={h.settlement_date}
              sx={(t) => ({
                flex: 1,
                height: Math.max(3, Math.round((h.shares_short / max) * 40)),
                borderRadius: '2px',
                bgcolor:
                  i === si.history.length - 1
                    ? 'text.primary'
                    : alpha(t.palette.text.secondary, 0.55),
              })}
            />
          ))}
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
    </Card>
  );
}

function ShortVolumeCard({ d }: { d: PublicTicker }) {
  const sv = d.short_volume;
  if (!sv)
    return (
      <Missing label="Short-sale volume" text="FINRA's daily file has no volume for this symbol." />
    );
  return (
    <Card
      label="Short-sale volume"
      value={`${Math.round(sv.ratio * 100)}%`}
      unit="of volume"
      source={`FINRA Reg SHO daily file · ${formatShortDate(sv.date)}`}
    >
      <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
        Counts every sale marked short, including market makers hedging customers&apos; buys. It is
        not short interest, and a high reading is normal.
      </Box>
      <Facts rows={[[`${sv.days}-day average`, `${Math.round(sv.avg_ratio * 100)}%`]]} />
    </Card>
  );
}

function InsidersCard({ d }: { d: PublicTicker }) {
  const ins = d.insiders;
  if (!ins || ins.state === 'not_configured')
    return (
      <Missing
        label="Insider trades"
        text="Insider filings come from SEC EDGAR, which isn't set up on this server yet."
      />
    );
  if (ins.state !== 'live')
    return <Missing label="Insider trades" text={ins.detail ?? 'EDGAR did not answer.'} />;
  return (
    <Card
      label={`Insider trades · ${ins.window_days} days`}
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
