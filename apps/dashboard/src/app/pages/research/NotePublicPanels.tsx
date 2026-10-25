/**
 * Below a ticker's note: who is positioned how (short interest, short-sale volume, insider trades) and
 * the SEC record. Beside it, in the note's side column: what the company has filed since the note was
 * written (`FiledSinceCard`). Each card names its source and its delay, because each source reports
 * late in its own way, and carries one data-state word (canon P-2): an outage reads "Source down",
 * never as an empty fact.
 *
 * FINRA's data is credited to FINRA as owner and source, derived figures included, with a
 * do-not-redistribute notice (FINRA Equity Data terms §2.3; docs/public-data/README.md).
 *
 * The cards are exported for the public desk (pages/ticker/public-desk), which shows the same
 * figures beside TradingView's chart when the options feed is off.
 */
import { ChartFrame, chartRoles } from '@/shared/charts/frame';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { publicDataWord, publicPartGap } from '@/shared/dataState/vocabulary';
import { dataMode, type PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { localToday, upcoming } from 'virtual:convexa-research';
import { standing } from './filings';
import { formatNoteDate, formatShortDate } from './format';
import type { Read } from './publicData';
import { Caps, ProvenanceChip, SourceProblem } from './publicUi';
import { SecRecordSections, SECTION_TITLE } from './SecRecordSections';
import { notSecFiler, tickerSecStale } from './secState';
import type { Aging } from './types';
import { DISPLAY, Eyebrow, MONO, Panel, PANEL_SX } from './ui';
import { useWidth } from './useWidth';

const big = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`
    : n >= 1e6
      ? `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
      : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

type FiledSinceNote = { date: string; accessions: string[]; aging: Aging };
/** What "Filed since this note" reads: the page's one public-data answer and the note it checks. */
type FiledSinceInput = { read: Read<PublicTicker>; note: FiledSinceNote };

/**
 * "Filed since this note" sits in the note's side column, under "This note comes due" (fidelity
 * audit 2026-10-25, NO-4 A), but the page reads the public answer once, in NotesView, and hands it
 * to NotePublicPanels under the note. NotePublicPanels shares that read with the side column through
 * this store, keyed by ticker, so the move costs no second request. It holds an entry only while the
 * newest note's panels are mounted: an older note has none, so its side column has no such card.
 */
const filedSinceInputs = new Map<string, FiledSinceInput>();
const filedSinceListeners = new Set<() => void>();
function shareFiledSince(ticker: string, input: FiledSinceInput | null) {
  if (input) filedSinceInputs.set(ticker.toUpperCase(), input);
  else filedSinceInputs.delete(ticker.toUpperCase());
  filedSinceListeners.forEach((listener) => listener());
}
function subscribeFiledSince(listener: () => void) {
  filedSinceListeners.add(listener);
  return () => {
    filedSinceListeners.delete(listener);
  };
}

export function NotePublicPanels({
  ticker,
  read,
  note,
}: {
  ticker: string;
  read: Read<PublicTicker>;
  note: FiledSinceNote;
}) {
  const { data, error, loading, retry } = read;
  const { date, accessions, aging } = note;
  // Before paint, so the side column's card is there on the first frame. `retry` is a new closure
  // over the same setter on every render; the read itself is the rest.
  useLayoutEffect(() => {
    shareFiledSince(ticker, {
      read: { data, error, loading, retry },
      note: { date, accessions, aging },
    });
    return () => shareFiledSince(ticker, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, data, error, loading, date, accessions, aging]);
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
  // PUBLIC_DATA=off on the API: one line where the panels were, never silence.
  if (d.state === 'off')
    return (
      <ChartFrame
        finding="Positioning and filings"
        metric="Positioning and filings"
        sub={`${ticker} · FINRA and SEC`}
        provenance="primary"
        status={{
          kind: 'message',
          tone: 'quiet',
          text: 'Public-data panels are off on this server.',
          cause: 'They return when the operator switches the public-data API on.',
        }}
        tag={{ state: 'off' }}
        height={90}
        headingLevel="h2"
        testId="note-public-off"
      />
    );
  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Box component="section" aria-labelledby="positioned" sx={{ display: 'grid', gap: 1.75 }}>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Box
            component="h2"
            id="positioned"
            sx={{ ...DISPLAY, m: 0, fontWeight: 600, ...SECTION_TITLE }}
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
        {finraShown(d) && (
          <Box
            component="p"
            sx={{ m: 0, fontSize: 12, color: 'text.secondary', maxWidth: 720, textWrap: 'pretty' }}
          >
            FINRA owns and is the source of the short-interest and short-sale-volume data here,
            including the percentages and averages Convexa calculates from it. Shown free for
            non-commercial personal use; please don&apos;t redistribute it.
          </Box>
        )}
      </Box>
      <SecRecordSections d={d} />
    </Box>
  );
}

/**
 * "Filed since this note", in the newest note's side column under "This note comes due" (fidelity
 * audit 2026-10-25, NO-4 A): the filings made after the note's date that it doesn't cite, from SEC
 * EDGAR, on the answer NotePublicPanels shares (`shareFiledSince`). Until that answer is shared, and
 * on an older note, it renders nothing.
 */
export function FiledSinceCard({ ticker }: { ticker: string }) {
  const input = useSyncExternalStore(
    subscribeFiledSince,
    () => filedSinceInputs.get(ticker.toUpperCase()) ?? null,
  );
  const today = useMemo(() => localToday(), []);
  if (!input) return null;
  const { read, note } = input;
  const d = read.data;
  const line = {
    m: 0,
    fontSize: 13,
    color: 'text.secondary',
    lineHeight: 1.5,
    textWrap: 'pretty',
  } as const;
  let tag: React.ReactNode = null;
  let body: React.ReactNode;
  let sourced = false;
  if (read.loading && !d) {
    body = (
      <Box
        aria-busy="true"
        aria-label="Loading the filings since this note"
        sx={(t) => ({
          height: 44,
          borderRadius: '8px',
          bgcolor: alpha(t.palette.text.secondary, 0.06),
        })}
      />
    );
  } else if (read.error || !d) {
    tag = <DataStateTag state="couldntLoad" />;
    body = (
      <>
        <Box component="p" sx={line}>
          Convexa&apos;s server didn&apos;t answer, so this list is unknown, not empty.
        </Box>
        <Button onClick={read.retry} sx={{ justifySelf: 'start', minHeight: 44 }}>
          Try again
        </Button>
      </>
    );
  } else if (d.state === 'off') {
    // PUBLIC_DATA=off on the API: the band under the note says so too, never silence.
    tag = <DataStateTag state="off" />;
    body = (
      <Box component="p" sx={line}>
        Public-data panels are off on this server.
      </Box>
    );
  } else {
    sourced = true;
    tag = (
      <DataStateTag
        state={publicDataWord(d.filings_state, {
          stale: d.filings_state === 'live' && tickerSecStale(d),
          demo: dataMode === 'demo',
        })}
      />
    );
    const newFilings = d.filings.filter((f) => standing(f, note) === 'new');
    const nextResults = upcoming(note.aging.events, today, 3650).find((u) =>
      /results|earnings/i.test(u.label),
    );
    body =
      d.filings_state === 'not_configured' ? (
        <Box component="p" sx={line}>
          SEC filings aren&apos;t set up on this server yet (EDGAR needs an identifying contact
          address).
        </Box>
      ) : d.filings_state === 'unavailable' && d.filings.length === 0 ? (
        <Box component="p" sx={line}>
          {`${d.filings_detail ?? 'EDGAR did not answer.'} This list is unknown, not empty.`}
        </Box>
      ) : newFilings.length === 0 ? (
        <>
          <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
            {`Nothing yet. The note was written ${formatNoteDate(note.date)}.`}
          </Box>
          {nextResults && (
            <Box component="span" sx={{ ...line, fontSize: 12 }}>
              {`Next expected: ${nextResults.label.replace(/\.$/, '')}, ${nextResults.whenLabel}. When a results or quarterly filing lands, the note comes due and the filing is listed here.`}
            </Box>
          )}
        </>
      ) : (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
          {newFilings.map((f) => (
            <Box
              component="li"
              key={f.accession}
              sx={(t) => ({
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
                py: 1,
                borderTop: `1px solid ${t.palette.divider}`,
                fontSize: 13,
              })}
            >
              <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
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
      );
  }
  return (
    <Panel
      component="section"
      aria-label="Filed since this note"
      sx={{ display: 'grid', gap: 1, alignContent: 'start' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        <Eyebrow component="h2" sx={{ m: 0, fontWeight: 400 }}>
          Filed since this note
        </Eyebrow>
        {tag}
      </Box>
      {body}
      {sourced && (
        <Box sx={{ justifySelf: 'start', maxWidth: '100%' }}>
          <ProvenanceChip text="SEC EDGAR · checked every hour" kind="primary" />
        </Box>
      )}
    </Panel>
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

/** Whether either FINRA card draws a figure: FINRA's ownership credit sits under the cards only
 *  then. With FINRA switched off it would credit FINRA for data the page doesn't show. */
export const finraShown = (d: PublicTicker) => {
  const demo = dataMode === 'demo';
  return (
    publicPartGap(d.short_interest_state, !!d.short_interest, { demo }) === null ||
    publicPartGap(d.short_volume_state, !!d.short_volume, { demo }) === null
  );
};

/** When the API sends no reason with an Off or Not set up FINRA part. Neither claims the symbol has
 *  no data: FINRA was not asked. */
const FINRA_NOT_SHOWN = {
  off: 'FINRA data is off on this site.',
  notSetUp: 'FINRA data is not set up on this server.',
} as const;

/**
 * Short interest at each FINRA settlement (RP-01, canon P-8 to P-13): the frame's title states the
 * year's change; the bars carry their settlement dates and their unit; the latest bar is the claim's
 * and is labelled; the table twin lists every settlement.
 *
 * `compact` is the desk's and the demo side column's form (Final · Ticker desk, siCompact): the days
 * to cover move into the subtitle and the facts list under the bars is dropped; the table twin keeps
 * every settlement.
 */
export function ShortInterestCard({ d, compact = false }: { d: PublicTicker; compact?: boolean }) {
  const si = d.short_interest;
  const demo = dataMode === 'demo';
  const gap = publicPartGap(d.short_interest_state, !!si, { demo });
  if (gap === 'sourceDown')
    return (
      <Missing
        label="Short interest"
        tag={<DataStateTag state="sourceDown" />}
        text={`${d.short_interest_detail ?? 'FINRA did not answer.'} Unknown, not empty.`}
      />
    );
  if (gap === 'off' || gap === 'notSetUp')
    return (
      <Missing
        label="Short interest"
        tag={<DataStateTag state={gap} />}
        text={d.short_interest_detail ?? FINRA_NOT_SHOWN[gap]}
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
      sub={`${d.ticker} short interest at each FINRA settlement · ${u === 'B' ? 'billions' : 'millions'} of shares${out ? ` · right: % of the ${formatShortDate(out.as_of)} shares outstanding (SEC)` : ''}${hist.length > 1 ? (compact ? ` · last ${hist.length} settlements` : ` · ${formatShortDate(first.settlement_date)} – ${formatShortDate(si.settlement_date)}`) : ''}${compact && si.days_to_cover != null ? ` · ${si.days_to_cover.toFixed(2)} days to cover` : ''}`}
      height={PLOT + 28}
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
                  // Solid gridlines on the grid token (fidelity FND-17): dashes are the canon's mark for
                  // sample frames and the average line, not for a scale.
                  borderTop: `1px solid ${v === 0 ? chartRoles(t).axis : chartRoles(t).grid}`,
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
                {/* A regular label keeps a full step clear of the last one, so they never touch. */}
                {((k % every === 0 && hist.length - 1 - k >= every) || last) && (
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
      {!compact && (
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
      )}
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
  const gap = publicPartGap(d.short_volume_state, !!sv, { demo });
  if (gap === 'sourceDown')
    return (
      <Missing
        label="Short-sale volume"
        tag={<DataStateTag state="sourceDown" />}
        text={`${d.short_volume_detail ?? "FINRA's daily files did not answer."} Unknown, not empty.`}
      />
    );
  if (gap === 'off' || gap === 'notSetUp')
    return (
      <Missing
        label="Short-sale volume"
        tag={<DataStateTag state={gap} />}
        text={d.short_volume_detail ?? FINRA_NOT_SHOWN[gap]}
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
  // EDGAR lists no company under the symbol (an index, a fund, a fresh IPO): a fact, not a fault.
  if (notSecFiler(d))
    return (
      <Missing
        label="Insider trades"
        text={`Not an SEC filer: ${d.filings_detail ?? `SEC EDGAR lists no company under ${d.ticker}.`} There are no Form 4s to count.`}
      />
    );
  if (ins?.state === 'not_configured' || d.filings_state === 'not_configured')
    return (
      <Missing
        label="Insider trades"
        tag={<DataStateTag state="notSetUp" />}
        text="Insider filings come from SEC EDGAR, which isn't set up on this server yet."
      />
    );
  if (!ins || ins.state !== 'live')
    return (
      <Missing
        label="Insider trades"
        tag={<DataStateTag state={publicDataWord(ins?.state ?? d.filings_state, { demo })} />}
        text={`${ins?.detail ?? d.filings_detail ?? 'EDGAR did not answer.'} Unknown, not empty.`}
      />
    );
  // Staleness is EDGAR's own word for this answer; `ins.detail` is a coverage note ("Counts cover
  // the 30 newest of 47…", "2 documents could not be read"), shown under the figure, never a tag.
  const stale = !demo && tickerSecStale(d);
  return (
    <Card
      label={`Insider trades · ${ins.window_days} days`}
      tag={
        <DataStateTag
          state={publicDataWord(ins.state, { stale, demo })}
          detail={demo || !ins.latest || stale ? null : `latest ${formatShortDate(ins.latest)}`}
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
      {ins.detail && !demo && (
        <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary', textWrap: 'pretty' }}>
          {ins.detail}
        </Box>
      )}
      {stale && <PartNote text={d.filings_detail} />}
    </Card>
  );
}
