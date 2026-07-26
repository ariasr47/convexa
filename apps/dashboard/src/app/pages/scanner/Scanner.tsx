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
import { Alert, Box, Skeleton, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Jargon } from '@/shared/ui/Jargon';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { ScanToolbar } from './ScanToolbar';
import { SCAN_COPY } from './labels';
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
  // The sanctioned price flash only fires when the data really is turning over.
  const flashActive = !scan.workerDown && !scan.degraded;

  return (
    <Box data-testid="scanner-page" sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: '14px' }}>
        <Typography component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
          {SCAN_COPY.heading}
        </Typography>
        <Typography component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
          {SCAN_COPY.subhead}
        </Typography>
        {/* The two-speed basis, always present, with its plain-language glossary on hover/focus. */}
        <Typography
          component="p"
          data-testid="scan-cadence-header"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: '8px', mb: 0 }}
        >
          <Jargon term={SCAN_COPY.cadenceHeader} gloss={SCAN_COPY.cadenceGloss} />
        </Typography>
      </Box>

      <ScanToolbar
        view={scan.view}
        density={scan.density}
        onDensity={scan.setDensity}
        onEditView={() => setEditorOpen(true)}
        gate={scan.gate}
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
      ) : isNarrow ? (
        <ScanCardList rows={scan.rows} nowS={scan.nowS} flashActive={flashActive} />
      ) : (
        <ScanTable
          rows={scan.rows}
          sort={scan.sort}
          density={scan.density}
          nowS={scan.nowS}
          flashActive={flashActive}
          onSort={scan.setSort}
        />
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
