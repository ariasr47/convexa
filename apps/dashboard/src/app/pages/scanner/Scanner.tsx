/**
 * `/scanner` — the multi-ticker triage surface (UX_BLUEPRINT §0–§3, PRODUCT_CONTRACT §3).
 *
 * One dense table over the tracked universe, POLLED on a stated cadence — no stream, no per-row
 * subscription, and the word this page must never say is never said (`[live-vs-static-isolation]`,
 * AC-9). The page is SELF-DESCRIBING about its own freshness: a two-speed basis in the header with a
 * plain-language glossary, a per-row as-of + status, and a worker-down banner OVER the intact
 * last-known rows when the sweep falls behind (AC-6) — it never 5xx's, never blanks.
 *
 * The four honest states are three distinct things plus a per-row one, and they are deliberately not
 * interchangeable: the first-load SKELETON (shimmer, no numbers) ≠ a `building` ROW (present,
 * tracked, not yet computed) ≠ a DEGRADE (last-known rows under a warning banner). The per-row
 * `ok`/`stale`/`error`/`building` chips come from the closed lookup in `labels.ts`.
 *
 * A row links to the Ticker page and opens its own read-only preview, nothing else
 * (`[no-real-order-path]`, AC-11; the preview is ScanRowPreview.tsx); customization
 * is the one gated write and the SERVER refuses it, not this file (`[server-side-gate-enforcement]`).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { MONO_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import { Jargon } from '@/shared/ui/Jargon';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { coarseFloor } from '@/shared/ui/touch';
import { dataMode } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EMPTY_FILTERS, filtersActive, partitionLeadGroup } from './format';
import { SCAN_COPY } from './labels';
import { ScanCardList } from './ScanCard';
import { ScanTable, type ScanGroup } from './ScanTable';
import { ScanToolbar } from './ScanToolbar';
import { useLivePrices } from './useLivePrices';
import { useScan } from './useScan';
import { ViewEditorDialog } from './ViewEditorDialog';

/** Hoisted: the skeleton's row count is static, so the array never re-allocates per render. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/**
 * The COLD-LOAD placeholder. It is the LOADING look (shimmer, zero figures) and is visually and
 * structurally distinct from a `building` row (a real row that says why it has no score) and from a
 * degrade (real last-known rows under the banner). It must never appear after the first read.
 */
function ScanSkeleton() {
  return (
    <Box
      data-testid="scan-skeleton"
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        // The panel role, 12 (`shape.borderRadius`), not a raw '10px' (fidelity ACC-24).
        borderRadius: 1,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
        {SCAN_COPY.loading}
      </Typography>
      {SKELETON_ROWS.map((i) => (
        <Skeleton key={i} variant="rectangular" height={26} />
      ))}
    </Box>
  );
}

/**
 * The session chip's 6px mark: a neutral SHAPE, never a liveness claim. It is the clock's session
 * (`sessionBadge`, wall-clock derived), not a stream, so it is never green, never `signal`, never
 * pulsing (canon Banned: a live dot on a snapshot surface). Closed wears the canon's closed-chip
 * RING (DESIGN_SYSTEM Icons row, `chip.mjs` CONNECTION.closed); the trading phases a filled dot,
 * primary text in RTH and secondary text either side of it.
 */
function SessionMark({ phase }: { phase: string }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      data-mark={phase === 'closed' ? 'ring' : 'dot'}
      sx={{
        width: '6px',
        height: '6px',
        flex: '0 0 auto',
        borderRadius: '50%',
        boxSizing: 'border-box',
        ...(phase === 'closed'
          ? { border: '1.5px solid', borderColor: 'text.secondary' }
          : { bgcolor: phase === 'rth' ? 'text.primary' : 'text.secondary' }),
      }}
    />
  );
}

/** The demo build: every figure on this page is the authored Oct 7 scenario (canon P-3, P-8). */
const DEMO = dataMode === 'demo';

/**
 * The demo's own words (Final Scanner, staging board). Not part of `SCAN_COPY` (CF-1 freezes that
 * object's keys); a sample scan names its source and its clock, never a feed (site check D-03).
 */
const DEMO_COPY = {
  sessionSuffix: ' · scenario',
  cadence: 'Sample tape · structure ~3 min',
  legendLine:
    'Every figure on this page comes from the authored Oct 7 scenario. Nothing is fetched; prices don’t flash.',
  sampleTag: 'Sample scan',
  sampleLine:
    'Shaped like an options-chain scan · authored scenario, Oct 7, 2026, 2:30 PM ET. Not market data.',
  yourView:
    'The demo’s tracked universe has six names. Edits and filters stay in this browser until you reset the demo.',
} as const;

/** The sample frame's head over the demo table (SampleAwareFrame) and above the phone cards. */
const DEMO_SAMPLE_HEAD = (
  <>
    <DataStateTag state="sample" label={DEMO_COPY.sampleTag} />
    <Typography component="span" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
      {DEMO_COPY.sampleLine}
    </Typography>
  </>
);

/**
 * The note cards under the scan (Final Scanner board): how a score is built, and on the demo, where
 * the view lives. They replace three internal explainer cards that described engineering choices
 * ("zero-state lead group") rather than the page (site check D-03).
 */
function ScanNotes() {
  // The board's `.hd-p` panel (fidelity ACC-08): the panel colour, radius 12, 18px 20px in, a 14px
  // title with its tag at the right, then the 12px line. The titles stay h2 (the page's next level
  // under its h1); the board's h3 is its generic panel helper's.
  const card = {
    p: '18px 20px',
    // The board's `.hd-p` under 768px (`v4/hybrid-desk.mjs`): 16px all round.
    '@media (max-width: 767px)': { p: '16px' },
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  } as const;
  const head = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 10px',
  } as const;
  const title = {
    flex: '1 1 auto',
    minWidth: 0,
    m: 0,
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.5,
    color: 'text.primary',
  } as const;
  const body = { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.45 } as const;
  return (
    <Box
      data-testid="scan-notes"
      sx={{
        mt: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
        gap: '16px',
      }}
    >
      <Box sx={card}>
        <Box sx={head}>
          <Typography component="h2" sx={title}>
            How a score is built
          </Typography>
        </Box>
        <Typography sx={body}>
          Four parts: distance to a wall, IV stretch, setups and the flip.{' '}
          <Link component={RouterLink} to="/methodology#score" underline="always">
            Methodology
          </Link>
        </Typography>
      </Box>
      {DEMO && (
        <Box sx={card}>
          <Box sx={head}>
            <Typography component="h2" sx={title}>
              Your view
            </Typography>
            <DataStateTag state="local" />
          </Box>
          <Typography sx={body}>{DEMO_COPY.yourView}</Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * The empty states' panel and its one action, as the Final states board draws them (`account-pages.mjs`
 * scannerStates, "Empty view" and "No filter match"; fidelity ACC-23): a dashed panel, the title, the
 * line, and an outlined secondary button. The fix is a reader's next step, not the page's amber spend.
 */
const emptyPanelSx = {
  p: '18px 20px',
  // The board's `.hd-p` under 768px (`v4/hybrid-desk.mjs`): 16px all round.
  '@media (max-width: 767px)': { p: '16px' },
  bgcolor: 'background.paper',
  border: '1px dashed',
  borderColor: 'divider',
  borderRadius: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '12px',
} as const;
const emptyTitleSx = { fontSize: '0.875rem', fontWeight: 600, m: 0 } as const;
const emptyBodySx = {
  fontSize: '0.75rem',
  lineHeight: 1.45,
  color: 'text.secondary',
  m: 0,
} as const;
const ctaSx = (theme: Theme) => ({
  cursor: 'pointer',
  bgcolor: 'transparent',
  color: 'text.primary',
  border: '1px solid',
  borderColor: extrasFor(theme).lineStrong,
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  lineHeight: 1,
  borderRadius: '8px',
  minHeight: 36,
  padding: '0 14px',
  '&:hover': { bgcolor: extrasFor(theme).panelRaised, borderColor: 'text.secondary' },
  ...coarseFloor,
});

export function Scanner() {
  const scan = useScan();
  const [editorOpen, setEditorOpen] = useState(false);
  // `useMediaQuery` takes the STRING form; jsdom has no matchMedia ⇒ false ⇒ the desktop table.
  const isNarrow = useMediaQuery(useTheme().breakpoints.down('sm'));

  // index-first-defaults AC-3 — the ZERO-STATE lead group. Only a view that is NOT a saved one
  // (`source !== 'account'`) is regrouped: a user's saved view renders exactly as saved. The
  // partition runs AFTER the existing sort, so each group keeps today's internal order (score-desc
  // by default), and it degenerates to the flat table when no lead member is present.
  const groups = useMemo<ScanGroup[] | undefined>(() => {
    if (scan.view == null || scan.view.source === 'account') return undefined;
    const { lead, rest } = partitionLeadGroup(scan.rows);
    if (lead.length === 0) return undefined;
    return [
      { key: 'lead', label: SCAN_COPY.leadGroup, rows: lead },
      { key: 'rest', label: null, rows: rest },
    ];
  }, [scan.view, scan.rows]);
  // The rows in final display order (lead-first when grouped) — shared by the table AND the <sm
  // card list, so the first paint leads with the strong-signal set at every width (card chrome
  // itself is unchanged).
  const polledRows = useMemo(
    () => (groups ? groups.flatMap((g) => g.rows) : scan.rows),
    [groups, scan.rows],
  );

  // LIVE PRICES over the POLLED structure. Only the symbols actually on screen are subscribed —
  // subscribing the whole universe would re-create, in a new place, the overnight waste the
  // market-hours gate removed. One SSE connection covers all of them.
  const live = useLivePrices(useMemo(() => polledRows.map((r) => r.symbol), [polledRows]));

  // The sanctioned price flash only fires when the data really is turning over — a drop stops it
  // too (criterion 14): nothing on a dead stream should read as "just changed".
  const flashActive = !live.isSample && !scan.workerDown && !scan.degraded && !live.offline;

  // Overlay, never replace: a symbol with no live tick yet keeps the swept price, so a quiet tape
  // or a dropped stream leaves the table fully populated ([best-effort-isolated-or-null]).
  const displayRows = useMemo(
    () =>
      polledRows.map((r) => {
        const lp = live.prices[r.symbol];
        return lp ? { ...r, price: lp.price } : r;
      }),
    [polledRows, live.prices],
  );

  // GATE Z, finding 1 (criterion 9, SB) — `groups` MUST carry the overlaid rows, never the raw
  // `scan.rows` partition, or the table (which prefers `groups` over `rows` whenever `groups` is
  // defined — every non-account view, `ScanTable.tsx:290`) renders a different price than the card
  // for the same symbol in the same frame. `polledRows` is exactly `groups.flatMap(g => g.rows)`
  // (see above) and `displayRows` is `polledRows` overlaid IN THE SAME ORDER, so re-slicing
  // `displayRows` by each group's original length reconstructs the identical partition with the
  // live overlay applied — one overlay implementation, not two, so the two layouts cannot drift.
  const displayGroups = useMemo<ScanGroup[] | undefined>(() => {
    if (!groups) return undefined;
    let offset = 0;
    return groups.map((g) => {
      const rows = displayRows.slice(offset, offset + g.rows.length);
      offset += g.rows.length;
      return { ...g, rows };
    });
  }, [groups, displayRows]);

  // SPEC §2.2 — the ONE predicate, computed once, in shipped constants: the outer null/non-null is
  // the STREAM's own state, the inner boolean is the DATUM's provenance. `retained: true` only when
  // the displayed price came from the now-dead stream; a symbol that never ticked keeps the polled
  // swept price and this returns `null` regardless of `live.offline` — `offline-bare` is therefore
  // unreachable on scanner prices BY CONSTRUCTION (criterion 13), not by convention. No per-symbol
  // age, no third number (the withdrawn `ts`-age option, §2.2).
  const priceOffline = useCallback(
    (sym: string): { retained: boolean } | null =>
      live.offline && live.prices[sym] != null ? { retained: true } : null,
    [live.offline, live.prices],
  );

  return (
    // The one page column (`pageColumnSx`, the boards' `.wrap`; fidelity COL), with the page's own py.
    <Box data-testid="scanner-page" sx={{ ...pageColumnSx, py: 3 }}>
      {/* Header: the Final board's mast (`design/src/screens/final/account-pages.mjs` scannerStaging,
          `.ac-scanh`). A grid, not a wrapping flex row: from md (900) the session cluster owns a
          right column, top-aligned with the title; below md it drops under the lead as ONE
          left-aligned wrapping row, chip first. The flex row it replaces wrapped the cluster onto
          a row of its own at ~1000px, where each line sat right-aligned in a narrow column and
          read as floating (owner screenshot, production /scanner). */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
          columnGap: '32px',
          rowGap: '12px',
          alignItems: 'start',
          mb: '16px',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {/* The theme's h1 variant carries the display face (Archivo, its stretch, 700): a page
              source names no font family (fonts.spec N-1). */}
          <Typography
            component="h1"
            variant="h1"
            sx={{
              // One page-title size for the account pages (owner, NO-12 A, 2026-10-25): 40px at 1440.
              fontSize: 'clamp(30px, 3vw, 40px)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              m: '0 0 6px',
            }}
          >
            {SCAN_COPY.heading}
          </Typography>
          <Typography
            component="p"
            sx={{
              fontSize: '0.95rem',
              lineHeight: 1.5,
              color: 'text.secondary',
              maxWidth: '62ch',
              // A two-line lead: `balance` evens the lines; `pretty` left "for its desk." alone.
              textWrap: 'balance',
              m: 0,
            }}
          >
            {SCAN_COPY.subhead}
          </Typography>
        </Box>

        <Box
          data-testid="scan-session-strip"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            alignItems: { xs: 'center', md: 'flex-end' },
            alignSelf: 'start',
            gap: { xs: '6px 12px', md: '6px' },
            // The board's `.ac-sess` margin-top, 4px: the chip sits near the title's cap height.
            mt: { md: '4px' },
            minWidth: 0,
          }}
        >
          <Box
            component="span"
            role="status"
            aria-label={SCAN_COPY.sessionAria}
            data-testid="scan-session-badge"
            data-phase={scan.session.phase}
            sx={(theme) => ({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flex: '0 0 auto',
              height: '24px',
              padding: '0 9px',
              boxSizing: 'border-box',
              fontSize: '0.6875rem',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              color: 'text.primary',
              bgcolor: extrasFor(theme).panelRaised,
              border: '1px solid',
              borderColor: extrasFor(theme).lineStrong,
              borderRadius: '6px',
            })}
          >
            <SessionMark phase={scan.session.phase} />
            {scan.session.label}
            {DEMO && DEMO_COPY.sessionSuffix}
          </Box>
          {/* The two-speed basis, always present, with its plain-language glossary on hover/focus. */}
          <Typography
            component="p"
            data-testid="scan-cadence-header"
            sx={{
              fontSize: '0.75rem',
              lineHeight: 1.45,
              color: 'text.secondary',
              m: 0,
              textAlign: { xs: 'left', md: 'right' },
              textWrap: 'pretty',
            }}
          >
            <Jargon
              term={
                live.offline
                  ? SCAN_COPY.cadenceHeaderOffline
                  : DEMO
                    ? DEMO_COPY.cadence
                    : SCAN_COPY.cadenceHeader
              }
              gloss={SCAN_COPY.cadenceGloss}
            />
            {' · '}
            <Link
              component={RouterLink}
              to="/methodology"
              data-testid="scan-methodology-link"
              underline="none"
              sx={(theme) => ({
                // The board's link colour (`.v4 a` → `--text-info`): the one actionable piece of
                // the line reads as a link at rest, not only on hover.
                color: extrasFor(theme).textInfo,
                fontSize: 'inherit',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                textUnderlineOffset: '3px',
                '&:hover, &:focus-visible': { textDecoration: 'underline' },
              })}
            >
              {SCAN_COPY.methodologyLink}
            </Link>
          </Typography>
          <Typography
            component="span"
            data-testid="scan-structure-asof"
            sx={{
              ...MONO_FACE,
              fontSize: '0.75rem',
              lineHeight: 1.45,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
            }}
          >
            {scan.structureAsOf != null
              ? SCAN_COPY.structureAsOf(scan.structureAsOf)
              : SCAN_COPY.structureAsOfUnknown}
          </Typography>
        </Box>
      </Box>

      {DEMO && (
        <Box sx={{ mb: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Box
            component="section"
            aria-label="On this page"
            data-testid="scan-demo-legend"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
              px: 2,
              py: 1.25,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Typography
              component="span"
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
              }}
            >
              On this page
            </Typography>
            <DataStateTag state="demo" />
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {DEMO_COPY.legendLine}
          </Typography>
        </Box>
      )}

      <ScanToolbar
        view={scan.view}
        density={scan.density}
        onDensity={scan.setDensity}
        onEditView={() => setEditorOpen(true)}
        gate={scan.gate}
        filters={scan.filters}
        onFilters={scan.setFilters}
        filteredCount={scan.rows.length}
        totalCount={scan.totalRowCount}
      />

      {/* Worker-down: a TRUE warning ⇒ burnt orange + MUI's built-in warning icon, sitting OVER the
          intact rows. The rows below keep rendering — a worker death never takes the page down. */}
      {/* The demo's sample scenario is not a fault: the legend and the sample frame say what it is. */}
      {scan.phase === 'ready' && scan.workerDown && !DEMO && (
        <Alert severity="warning" data-testid="scan-worker-down" sx={{ mb: '12px' }}>
          {scan.workerDownText}
        </Alert>
      )}

      {scan.phase === 'loading' ? (
        <ScanSkeleton />
      ) : scan.isEmptyView ? (
        <Box data-testid="scan-empty-view" sx={emptyPanelSx}>
          <Typography sx={emptyTitleSx}>{SCAN_COPY.emptyViewTitle}</Typography>
          <Typography sx={emptyBodySx}>{SCAN_COPY.emptyViewBody}</Typography>
          {scan.view?.authenticated && (
            <Box
              component="button"
              type="button"
              data-testid="scan-empty-cta"
              onClick={() => setEditorOpen(true)}
              sx={ctaSx}
            >
              {SCAN_COPY.editView}
            </Box>
          )}
        </Box>
      ) : scan.phase === 'ready' && displayRows.length === 0 && filtersActive(scan.filters) ? (
        <Box data-testid="scan-empty-filter" sx={emptyPanelSx}>
          <Typography sx={emptyTitleSx}>{SCAN_COPY.emptyFilterTitle}</Typography>
          <Typography sx={emptyBodySx}>{SCAN_COPY.emptyFilterBody}</Typography>
          <Box
            component="button"
            type="button"
            data-testid="scan-empty-filter-clear"
            onClick={() => scan.setFilters(EMPTY_FILTERS)}
            sx={ctaSx}
          >
            {SCAN_COPY.clearFilters}
          </Box>
        </Box>
      ) : isNarrow ? (
        // On a phone the sample head stands in its own box and each card is dashed, not inset in a
        // frame (fidelity ACC-05).
        <ScanCardList
          rows={displayRows}
          nowS={scan.nowS}
          flashActive={flashActive}
          deltas={scan.deltas}
          priceOffline={priceOffline}
          sampleHead={DEMO ? DEMO_SAMPLE_HEAD : undefined}
        />
      ) : (
        <ScanTable
          rows={displayRows}
          sort={scan.sort}
          density={scan.density}
          nowS={scan.nowS}
          flashActive={flashActive}
          onSort={scan.setSort}
          groups={displayGroups}
          deltas={scan.deltas}
          priceOffline={priceOffline}
          sampleHead={DEMO ? DEMO_SAMPLE_HEAD : undefined}
        />
      )}

      {/* The note cards — present whenever the table/card body itself is (never on the cold skeleton,
          the empty-view or the empty-filter states, which carry their own explanation). */}
      {scan.phase === 'ready' &&
        !scan.isEmptyView &&
        !(displayRows.length === 0 && filtersActive(scan.filters)) && <ScanNotes />}

      <ViewEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        view={scan.view}
        sort={scan.sort}
        density={scan.density}
        saveError={scan.saveError}
        onSave={scan.saveView}
      />
    </Box>
  );
}

export default Scanner;
