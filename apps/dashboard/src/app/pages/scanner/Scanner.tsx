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
 * A row is a link to the Ticker page and nothing else (`[no-real-order-path]`, AC-11); customization
 * is the one gated write and the SERVER refuses it, not this file (`[server-side-gate-enforcement]`).
 */
import { extrasFor } from '@/shared/theme/tokens';
import { Jargon } from '@/shared/ui/Jargon';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
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
        borderRadius: '10px',
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
 * The three note cards (design/src/screens/scanner.mjs:106-108, `.scan-notes`) — honest, general
 * explanations of shipped behaviour, never a fabricated per-row example. NOT part of `SCAN_COPY`
 * (CF-1 governs that object's own keys only, `scanner.register.spec.tsx`'s `cf1Offenders`) —
 * these are new sentences on a page CF-1 otherwise freezes, so they stay a separate constant the
 * scan never walks.
 */
const SCAN_NOTES: { title: string; body: string }[] = [
  {
    title: 'How a score is built',
    body: 'Proximity to the nearest wall or flip, IV vs HV stretch, active setups and a flip-transition bonus all weigh in — never one input alone. Focus or hover any score for that row’s own breakdown.',
  },
  {
    title: 'Zero-state lead group',
    body: 'An empty or anonymous view opens on Indexes & megacaps so the first read is always a real one. Saved views need a sign-in and are never claimed for an anonymous visitor.',
  },
  {
    title: 'Price stream drops',
    body: 'Prices dim and the cadence header says so when the stream drops. Structure keeps rendering — a dropped stream never blanks a row.',
  },
];

const ctaSx = {
  mt: '12px',
  cursor: 'pointer',
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  border: 'none',
  font: 'inherit',
  fontSize: '0.82rem',
  fontWeight: 700,
  borderRadius: '8px',
  padding: '8px 15px',
};

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
  const flashActive = !scan.workerDown && !scan.degraded && !live.offline;

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
    <Box data-testid="scanner-page" sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
      {/* Header (design/src/screens/scanner.mjs:65-72, `.scan-head`): title + subtitle left, the
          right cluster (session chip · cadence line · Structure as-of) right — moved up from the
          toolbar row below so the mast reads as one unit, as the design draws it. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px 24px',
          mb: '14px',
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
            {SCAN_COPY.heading}
          </Typography>
          <Typography component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
            {SCAN_COPY.subhead}
          </Typography>
        </Box>

        <Box
          data-testid="scan-session-strip"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
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
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: 'text.primary',
              bgcolor: extrasFor(theme).panelRaised,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '6px',
              padding: '4px 9px',
            })}
          >
            {scan.session.label}
          </Box>
          {/* The two-speed basis, always present, with its plain-language glossary on hover/focus. */}
          <Typography
            component="p"
            data-testid="scan-cadence-header"
            sx={{ fontSize: '0.78rem', color: 'text.secondary', m: 0, textAlign: 'right' }}
          >
            <Jargon
              term={live.offline ? SCAN_COPY.cadenceHeaderOffline : SCAN_COPY.cadenceHeader}
              gloss={SCAN_COPY.cadenceGloss}
            />
            {' · '}
            <Link
              component={RouterLink}
              to="/methodology"
              data-testid="scan-methodology-link"
              underline="hover"
              sx={{ color: 'text.secondary', fontSize: 'inherit' }}
            >
              {SCAN_COPY.methodologyLink}
            </Link>
          </Typography>
          <Typography
            component="span"
            data-testid="scan-structure-asof"
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scan.structureAsOf != null
              ? SCAN_COPY.structureAsOf(scan.structureAsOf)
              : SCAN_COPY.structureAsOfUnknown}
          </Typography>
        </Box>
      </Box>

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
      {scan.phase === 'ready' && scan.workerDown && (
        <Alert severity="warning" data-testid="scan-worker-down" sx={{ mb: '12px' }}>
          {scan.workerDownText}
        </Alert>
      )}

      {scan.phase === 'loading' ? (
        <ScanSkeleton />
      ) : scan.isEmptyView ? (
        <Box data-testid="scan-empty-view">
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {SCAN_COPY.emptyViewTitle}
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: 'text.secondary' }}>
            {SCAN_COPY.emptyViewBody}
          </Typography>
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
        <Box data-testid="scan-empty-filter">
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {SCAN_COPY.emptyFilterTitle}
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: 'text.secondary' }}>
            {SCAN_COPY.emptyFilterBody}
          </Typography>
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
        <ScanCardList
          rows={displayRows}
          nowS={scan.nowS}
          flashActive={flashActive}
          deltas={scan.deltas}
          priceOffline={priceOffline}
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
        />
      )}

      {/* The three note cards (design :106-110) — present whenever the table/card body itself is
          (never on the cold skeleton, the empty-view or the empty-filter states, which already
          carry their own explanation). Mirrors the exact condition that renders the table/cards
          above, so the two can never disagree. */}
      {scan.phase === 'ready' &&
        !scan.isEmptyView &&
        !(displayRows.length === 0 && filtersActive(scan.filters)) && (
          <Box
            data-testid="scan-notes"
            sx={{
              mt: '16px',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: '14px',
            }}
          >
            {SCAN_NOTES.map((n) => (
              <Box
                key={n.title}
                sx={{
                  p: '12px 14px',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: '4px',
                  }}
                >
                  {n.title}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>
                  {n.body}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

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
