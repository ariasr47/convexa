/**
 * OrdersPanel — the Positions-page management home (UX §4.5), rendered INSIDE the Simulated tab,
 * BELOW the book and beside the Track record (owner, NO-6 A, 2026-10-25: the Final board's order).
 * Every order, every ticker; Open / History segmented pill (History = filled/cancelled/expired,
 * never dropped, AC-24); two-step cancel; detail; client-side Export JSON
 * (`convexa-orders-{date}.json` — the AC-33 audit floor); empty + store-fault states (§4.6). Rows
 * for tickers other than this page's focused/streamed one show the §4.3 not-evaluated state —
 * CORRECT and required, not a bug (D5).
 */
import { SIMULATED_TIP } from '@/features/trading/positions/labels';
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { extrasFor } from '@/shared/theme/tokens';
import { coarseFloor } from '@/shared/ui/touch';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { useState } from 'react';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderRow } from './OrderRow';
import { StoreFaultBlock, useStatusAnnouncement } from './OrdersWidget';
import {
  ACTION_EXPORT,
  PANEL_EMPTY_HISTORY,
  PANEL_EMPTY_OPEN,
  PANEL_EMPTY_OPEN_WITH_HISTORY,
  PANEL_SUBTITLE,
  PANEL_TITLE,
} from './copy';
import { exportFilename } from './store';
import { isTerminal } from './types';
import { deriveEval, LiveCoverage, useOrders } from './useOrders';

/** The trade dialog's neutral SIMULATED tag (`TradeEntryDialogView.tsx`, fidelity ACC-12): text
 *  primary on a `lineStrong` outline, weight 600. MUI's default outlined chip drew a grey #616161
 *  border here, so the two chips differed (spec 2026-10-21/02, criterion 11). */
const SIMULATED_CHIP_SX = (t: Theme) => ({
  color: 'text.primary',
  borderColor: extrasFor(t).lineStrong,
  fontWeight: 600,
  letterSpacing: '0.04em',
});

interface Props {
  /** The page's live coverage (the focused/streamed ticker). Null ⇒ every row not-evaluated. */
  coverage: LiveCoverage | null;
  /** Externally-requested detail (the position-side "view order →" backlink, AC-31). */
  openDetailOrderId?: string | null;
  onDetailClose?: () => void;
  /** Navigate/scroll to a filled order's position (AC-31). */
  onViewPosition?: (positionId: string) => void;
}

export function OrdersPanel({ coverage, openDetailOrderId, onDetailClose, onViewPosition }: Props) {
  const { orders, faulted, cancel, exportPayload } = useOrders();
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const [detailId, setDetailId] = useState<string | null>(null);
  const announcement = useStatusAnnouncement(orders);

  const openOrders = orders.filter((o) => !isTerminal(o.status));
  const history = orders.filter((o) => isTerminal(o.status));
  const shown = tab === 'open' ? openOrders : history;

  const effectiveDetailId = openDetailOrderId ?? detailId;
  const detailOrder = effectiveDetailId
    ? (orders.find((o) => o.id === effectiveDetailId) ?? null)
    : null;

  const doExport = () => {
    // Client-side JSON download — no server touch (arch §8 export floor).
    const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportFilename();
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Box
      data-testid="orders-panel"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        // The panel role, 12 (`shape.borderRadius`), and the board's panel padding (`.hd-p`,
        // 18px 20px, 16 on a phone; fidelity ACC-24). It sits in the page's orders | track record
        // row, whose gap spaces it, so it carries no margin of its own.
        borderRadius: 1,
        p: { xs: '16px', sm: '18px 20px' },
        minWidth: 0,
        bgcolor: 'background.paper',
      }}
    >
      <Box component="span" aria-live="polite" sx={visuallyHidden}>
        {announcement}
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
      >
        {/* The board's panel title (`.hd-p .ph h3`): 14px/600. */}
        {/* h2: it sits straight under the page's h1 (axe heading-order; spec 2026-10-21/02). */}
        <Typography
          variant="subtitle1"
          component="h2"
          sx={{ fontSize: '0.875rem', fontWeight: 600 }}
        >
          {PANEL_TITLE}
        </Typography>
        <Tooltip arrow title={SIMULATED_TIP}>
          {/* The trade dialog's neutral SIMULATED tag (ACC-12), so the two read as one chip
              (spec 2026-10-21/02, criterion 11). */}
          <Chip size="small" variant="outlined" label="SIMULATED" sx={SIMULATED_CHIP_SX} />
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          onClick={doExport}
          data-testid="orders-export"
          sx={{ textTransform: 'none', ...coarseFloor }}
        >
          {ACTION_EXPORT}
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        {PANEL_SUBTITLE}
      </Typography>

      {/* Open / History segmented pill (the page's existing pill idiom). */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={tab}
        onChange={(_, v) => v && setTab(v)}
        aria-label="orders view"
        // The coarse 44 on each toggle (canon rule 7; fidelity ACC-17); the control role, 8, on
        // the group (ACC-24), not the panel role the group takes from `shape.borderRadius`.
        sx={{ mb: 1, borderRadius: '8px', '& .MuiToggleButton-root': coarseFloor }}
      >
        <ToggleButton value="open" data-testid="orders-tab-open">
          Open
        </ToggleButton>
        <ToggleButton value="history" data-testid="orders-tab-history">
          History
        </ToggleButton>
      </ToggleButtonGroup>

      {faulted ? (
        <StoreFaultBlock />
      ) : shown.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid={tab === 'open' ? 'orders-empty-open' : 'orders-empty-history'}
        >
          {tab === 'open'
            ? history.length > 0
              ? PANEL_EMPTY_OPEN_WITH_HISTORY
              : PANEL_EMPTY_OPEN
            : PANEL_EMPTY_HISTORY}
        </Typography>
      ) : (
        <Box>
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              evalState={deriveEval(o, coverage)}
              onDetails={setDetailId}
              onCancel={cancel}
            />
          ))}
        </Box>
      )}

      <OrderDetailDialog
        order={detailOrder}
        onClose={() => {
          setDetailId(null);
          onDetailClose?.();
        }}
        onViewPosition={onViewPosition}
      />
    </Box>
  );
}
