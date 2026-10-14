/**
 * `/research` — every ticker with published notes (live mode): what's coming up across all of them,
 * then one card per ticker with its headline, a revenue sketch, price against value, three figures,
 * the next catalyst and the note's freshness. Everything comes from the build's index; freshness and
 * "coming up" are worked out in the reader's browser. In the demo build the per-ticker tabs carry
 * authored sample notes instead, so this page points at those.
 */
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  freshness as freshnessOf,
  localToday,
  researchIndex,
  upcoming,
} from 'virtual:convexa-research';
import { DeltaPill } from './blocks/Figures';
import { PriceValueStrip } from './blocks/Valuation';
import { filedSince } from './filings';
import { formatNoteDate, labelWithAsOf, STANCE_LABEL, UNCERTAINTY_LABEL } from './format';
import { RESEARCH_DISCLAIMER, ResearchColumn } from './NotesView';
import { usePublicFilings } from './publicData';
import { ResearchTabs } from './ResearchTabs';
import type { Freshness, NoteStance, ResearchTickerSummary } from './types';
import { DISPLAY, Eyebrow, FreshnessLine, MONO, Panel, PANEL_SX, Pill, YourCall } from './ui';

const TICKERS = researchIndex.map((r) => r.ticker);

const SAMPLE_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];

function DemoNotice() {
  return (
    <Panel sx={{ display: 'grid', gap: 1, p: 3 }}>
      <Box component="h2" sx={{ m: 0, fontSize: 17, fontWeight: 600 }}>
        Sample research in this demo
      </Box>
      <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
        Each sample symbol has an authored research note that matches its demo scenario.
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        {SAMPLE_SYMBOLS.map((symbol) => (
          <Link component={RouterLink} key={symbol} to={`/ticker/${symbol}/research`}>
            {symbol}
          </Link>
        ))}
      </Box>
    </Panel>
  );
}

type Row = ResearchTickerSummary & { f: Freshness };

const HATCH = (t: Theme) =>
  `repeating-linear-gradient(135deg, ${alpha(t.palette.text.secondary, 0.7)} 0 3px, ${alpha(t.palette.text.secondary, 0.28)} 3px 6px)`;

function MiniChart({ chart }: { chart: NonNullable<ResearchTickerSummary['latest']['chart']> }) {
  // One scale that includes zero, so a loss goes below a zero line instead of reading as a 3px stub
  // that looks like zero (design/CHARTS-2026-10-13.md RN-13: HOOD's −90% margin, MU's loss).
  const lo = Math.min(0, ...chart.bars.map((b) => b.value));
  const hi = Math.max(0, ...chart.bars.map((b) => b.value));
  const span = hi - lo || 1;
  const y = (v: number) => ((v - lo) / span) * 56;
  const last = chart.bars[chart.latest];
  return (
    // One column that may shrink below the caption's width, so a long caption ellipsizes instead of
    // widening the card past a phone screen.
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 1,
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        <Box
          component="span"
          sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {chart.caption}
        </Box>
        {last && (
          <Box component="span" sx={{ ...MONO, color: 'text.primary', whiteSpace: 'nowrap' }}>
            {last.shown || last.value.toLocaleString('en-US')}
          </Box>
        )}
      </Box>
      <Box
        role="img"
        aria-label={`${chart.caption}: ${chart.bars.map((b) => `${b.label} ${b.shown || b.value}`).join(', ')}`}
        sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 56, position: 'relative' }}
      >
        {lo < 0 && (
          <Box
            aria-hidden
            sx={(t) => ({
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${y(0)}px`,
              borderTop: `1px solid ${alpha(t.palette.text.secondary, 0.6)}`,
              pointerEvents: 'none',
            })}
          />
        )}
        {chart.bars.map((b, i) => (
          <Box
            key={i}
            sx={(t) => ({
              flex: 1,
              height: Math.max(2, Math.round(y(Math.max(0, b.value)) - y(Math.min(0, b.value)))),
              mb: `${Math.round(y(Math.min(0, b.value)))}px`,
              borderRadius: b.value < 0 ? '1px 1px 3px 3px' : '3px 3px 1px 1px',
              boxSizing: 'border-box',
              ...(b.kind === 'guide'
                ? { border: `1.5px dashed ${alpha(t.palette.text.primary, 0.6)}` }
                : b.kind === 'approx'
                  ? { background: HATCH(t) }
                  : {
                      bgcolor:
                        i === chart.latest ? 'text.primary' : alpha(t.palette.text.secondary, 0.75),
                    }),
            })}
          />
        ))}
      </Box>
    </Box>
  );
}

function TickerCard({ row, today }: { row: Row; today: string }) {
  const n = row.latest;
  const href = `/ticker/${encodeURIComponent(row.ticker)}/research`;
  const next =
    row.f.state === 'archived' ? null : (upcoming(n.aging.events, today, 3650)[0] ?? null);
  return (
    <Box
      component="article"
      aria-labelledby={`card-${row.ticker}`}
      sx={(t) => ({
        ...PANEL_SX,
        borderRadius: '16px',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        boxShadow:
          t.palette.mode === 'dark'
            ? `0 1px 2px ${alpha(t.palette.common.black, 0.24)}, 0 2px 6px ${alpha(t.palette.common.black, 0.16)}`
            : 'none',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
          <Link
            component={RouterLink}
            to={href}
            id={`card-${row.ticker}`}
            underline="hover"
            sx={{ ...DISPLAY, fontWeight: 800, fontSize: 32, lineHeight: 1, color: 'text.primary' }}
          >
            {row.ticker}
          </Link>
          {(n.company || n.about) && (
            <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
              {[n.company, n.about?.split('·')[0]?.trim()].filter(Boolean).join(' · ')}
            </Box>
          )}
        </Box>
        <Box sx={{ ml: 'auto', display: 'grid', justifyItems: 'end', gap: 0.5, flexShrink: 0 }}>
          {n.stance ? (
            <Pill variant="strong">{STANCE_LABEL[n.stance]}</Pill>
          ) : (
            <YourCall label="Stance · your call" />
          )}
          {n.uncertainty && (
            <Box
              component="span"
              sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              Uncertainty ·{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {UNCERTAINTY_LABEL[n.uncertainty]}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      <Box
        component="h2"
        sx={{
          ...DISPLAY,
          m: 0,
          fontWeight: 600,
          fontSize: 19,
          lineHeight: 1.25,
          textWrap: 'balance',
        }}
      >
        {n.title}
      </Box>
      {n.chart && <MiniChart chart={n.chart} />}
      {n.valuation ? (
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
            Price vs value range
          </Box>
          <PriceValueStrip
            data={n.valuation}
            uncertainty={null}
            priceAgeDays={row.f.priceAgeDays}
            priceStale={row.f.priceStale}
            compact
          />
        </Box>
      ) : (
        <Box
          sx={(t) => ({
            display: 'flex',
            justifyContent: 'space-between',
            px: 1.25,
            py: 1,
            borderRadius: '8px',
            border: `1px solid ${alpha(t.palette.text.secondary, 0.25)}`,
            fontSize: 12,
            color: 'text.secondary',
          })}
        >
          <span>Price vs value range</span>
          <span>no valuation yet</span>
        </Box>
      )}
      {n.metrics.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${n.metrics.length}, minmax(0, 1fr))`,
            gap: 1,
            pt: 1.75,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {n.metrics.map((m) => (
            <Box
              key={m.label}
              sx={{ display: 'grid', gap: 0.25, alignContent: 'start', minWidth: 0 }}
            >
              <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>
                {labelWithAsOf(m.label, m.asOf)}
              </Box>
              <Box
                component="span"
                sx={{
                  ...MONO,
                  fontSize: { xs: 15, sm: 17 },
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {m.value}
              </Box>
              {m.delta && (
                <Box sx={{ '& > span': { fontSize: 11 } }}>
                  <DeltaPill dir={m.dir}>{m.delta}</DeltaPill>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
      {next && (
        <Box
          sx={(t) => ({
            display: 'grid',
            gap: 0.25,
            px: 1.5,
            py: 1.25,
            borderRadius: '10px',
            bgcolor:
              t.palette.mode === 'dark'
                ? alpha(t.palette.common.black, 0.2)
                : alpha(t.palette.text.primary, 0.04),
            border: 1,
            borderColor: 'divider',
          })}
        >
          <Eyebrow sx={{ fontSize: 11 }}>
            Next ·{' '}
            {next.inDays <= 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`}
          </Eyebrow>
          <Box component="span" sx={{ fontSize: 14, fontWeight: 500 }}>
            {next.label}, {next.whenLabel}
          </Box>
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          fontSize: 12,
          color: 'text.secondary',
          mt: 'auto',
        }}
      >
        <FreshnessLine freshness={row.f} notFollowingSince={n.notFollowingSince} />
        <span>Written {formatNoteDate(n.date)}</span>
        <span>{n.readMinutes} min read</span>
        {n.sourceCount > 0 && (
          <span>{n.sourceCount === 1 ? '1 source' : `${n.sourceCount} sources`}</span>
        )}
        <Link component={RouterLink} to={href} sx={{ ml: 'auto', fontWeight: 500 }}>
          Open note →
        </Link>
      </Box>
    </Box>
  );
}

const FILTER_SX =
  (on: boolean, dashed = false) =>
  (t: Theme) => ({
    height: 36,
    px: 1.75,
    borderRadius: '999px',
    font: 'inherit',
    fontSize: 13,
    fontWeight: on ? 600 : 500,
    cursor: 'pointer',
    border: on
      ? '1px solid transparent'
      : `1px ${dashed ? 'dashed' : 'solid'} ${alpha(t.palette.text.secondary, 0.4)}`,
    bgcolor: on ? 'text.primary' : 'transparent',
    color: on ? 'background.default' : 'text.secondary',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
  });

type StanceFilter = 'all' | NoteStance | 'unset';
type FreshFilter = 'any' | Freshness['state'];

export function ResearchIndexPage() {
  const today = useMemo(() => localToday(), []);
  const [query, setQuery] = useState('');
  const [stance, setStance] = useState<StanceFilter>('all');
  const [fresh, setFresh] = useState<FreshFilter>('any');
  // Filings since each note make it due too; without them (API off or down) dates alone decide.
  const filings = usePublicFilings(TICKERS).data?.filings ?? null;
  const rows: Row[] = useMemo(
    () =>
      researchIndex.map((r) => ({
        ...r,
        f: freshnessOf(r.latest.aging, {
          today,
          notFollowingSince: r.latest.notFollowingSince,
          filed: filings
            ? filedSince(
                filings.filter((x) => x.ticker === r.ticker),
                r.latest,
              )
            : [],
        }),
      })),
    [today, filings],
  );
  const shown = rows.filter(
    (r) =>
      (!query ||
        `${r.ticker} ${r.latest.company ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())) &&
      (stance === 'all' ||
        (stance === 'unset' ? r.latest.stance === null : r.latest.stance === stance)) &&
      (fresh === 'any' || r.f.state === fresh),
  );
  const soon = rows
    .filter((r) => r.f.state !== 'archived')
    .flatMap((r) =>
      upcoming(r.latest.aging.events, today, 70).map((u) => ({ ...u, ticker: r.ticker })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);
  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length;
  const stances: { key: StanceFilter; label: string; dashed?: boolean }[] = [
    { key: 'all', label: `All · ${rows.length}` },
    ...(['bullish', 'bearish', 'neutral', 'watching'] as NoteStance[])
      .map((s) => ({
        key: s as StanceFilter,
        label: `${STANCE_LABEL[s]} · ${count((r) => r.latest.stance === s)}`,
      }))
      .filter((s) => !s.label.endsWith('· 0')),
    {
      key: 'unset',
      label: `Stance not set · ${count((r) => r.latest.stance === null)}`,
      dashed: true,
    },
  ];
  const freshStates: Freshness['state'][] = ['current', 'due', 'archived'];

  return (
    <ResearchColumn>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 4,
          pt: { xs: 1, md: 2 },
        }}
      >
        <ResearchTabs />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px 32px' }}>
          <Box sx={{ flex: '999 1 480px', display: 'grid', gap: 1.25 }}>
            <Box
              component="h1"
              sx={{
                ...DISPLAY,
                m: 0,
                fontWeight: 800,
                fontSize: { xs: 36, md: 48 },
                lineHeight: 1.05,
              }}
            >
              Research
            </Box>
            <Box
              component="p"
              sx={{ m: 0, maxWidth: '62ch', color: 'text.secondary', fontSize: 16 }}
            >
              Notes on the tickers being followed: what the price implies, the evidence, the debate,
              a valuation with its assumptions shown, and what comes next. Each opens with a
              30-second summary.
            </Box>
          </Box>
          {dataMode !== 'demo' && rows.length > 0 && (
            <Box
              sx={{
                flex: '1 1 240px',
                display: 'flex',
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
              }}
            >
              <Box
                component="label"
                htmlFor="research-find"
                sx={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                }}
              >
                Find a ticker
              </Box>
              <Box
                component="input"
                id="research-find"
                type="search"
                placeholder="Find a ticker"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                sx={(t) => ({
                  width: '100%',
                  maxWidth: 260,
                  height: 44,
                  boxSizing: 'border-box',
                  px: 1.75,
                  borderRadius: '8px',
                  border: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  font: 'inherit',
                  fontSize: 14,
                })}
              />
            </Box>
          )}
        </Box>

        {dataMode === 'demo' ? (
          <DemoNotice />
        ) : rows.length === 0 ? (
          <Panel sx={{ p: 3, display: 'grid', gap: 0.5 }}>
            <Box component="h2" sx={{ m: 0, fontSize: 17, fontWeight: 600 }}>
              No research published yet.
            </Box>
            <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
              Notes will be listed here as they're written.
            </Box>
          </Panel>
        ) : (
          <>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Box
                role="group"
                aria-label="Filter by stance"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {stances.map((s) => (
                  <Box
                    component="button"
                    type="button"
                    key={s.key}
                    aria-pressed={stance === s.key}
                    onClick={() => setStance(s.key)}
                    sx={FILTER_SX(stance === s.key, s.dashed)}
                  >
                    {s.label}
                  </Box>
                ))}
              </Box>
              <Box
                role="group"
                aria-label="Filter by freshness"
                sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
              >
                <Eyebrow sx={{ mr: 0.5 }}>Freshness</Eyebrow>
                {freshStates.map((s) => (
                  <Box
                    component="button"
                    type="button"
                    key={s}
                    aria-pressed={fresh === s}
                    onClick={() => setFresh(fresh === s ? 'any' : s)}
                    sx={FILTER_SX(fresh === s)}
                  >
                    {s === 'current' ? 'Current' : s === 'due' ? 'Review due' : 'Archived'} ·{' '}
                    {count((r) => r.f.state === s)}
                  </Box>
                ))}
              </Box>
            </Box>

            {soon.length > 0 && (
              <Box
                component="section"
                aria-labelledby="coming-up"
                sx={{ display: 'grid', gap: 1.5 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: '4px 12px',
                  }}
                >
                  <Box
                    component="h2"
                    id="coming-up"
                    sx={{ ...DISPLAY, m: 0, fontWeight: 600, fontSize: 20 }}
                  >
                    Coming up
                  </Box>
                  <Box component="span" sx={{ fontSize: 13, color: 'text.secondary' }}>
                    Catalysts from every note, next 10 weeks. Each date is also when its note comes
                    due for review.
                  </Box>
                </Box>
                <Box
                  component="ol"
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 1.25,
                  }}
                >
                  {soon.map((u, i) => (
                    <Box
                      component="li"
                      key={`${u.ticker}-${u.label}-${u.date}`}
                      sx={(t) => ({
                        ...PANEL_SX,
                        px: 1.75,
                        py: 1.5,
                        display: 'grid',
                        gap: 0.75,
                        ...(i === 0 ? { borderColor: alpha(t.palette.text.primary, 0.35) } : {}),
                      })}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Box
                          component="span"
                          sx={(t) => ({
                            ...MONO,
                            fontSize: 11,
                            fontWeight: 600,
                            px: 0.875,
                            py: '2px',
                            borderRadius: '5px',
                            bgcolor: alpha(t.palette.text.secondary, 0.16),
                          })}
                        >
                          {u.ticker}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            ...MONO,
                            fontSize: 11,
                            color: i === 0 ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {u.inDays <= 0
                            ? 'today'
                            : u.inDays === 1
                              ? 'tomorrow'
                              : u.inDays < 14
                                ? `in ${u.inDays} days`
                                : `~${Math.round(u.inDays / 7)} weeks`}
                        </Box>
                      </Box>
                      <Box
                        component="span"
                        sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}
                      >
                        {u.label}
                      </Box>
                      <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
                        {u.whenLabel}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <Box
              component="section"
              aria-label="Tickers"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: 2,
              }}
            >
              {shown.map((row) => (
                <TickerCard key={row.ticker} row={row} today={today} />
              ))}
              {shown.length === 0 && (
                <Box component="p" sx={{ m: 0, color: 'text.secondary' }}>
                  No ticker matches these filters.
                </Box>
              )}
            </Box>
          </>
        )}

        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
          {RESEARCH_DISCLAIMER}
        </Box>
      </Box>
    </ResearchColumn>
  );
}

export default ResearchIndexPage;
