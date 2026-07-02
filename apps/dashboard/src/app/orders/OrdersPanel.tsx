/**
 * OrdersPanel — the Positions-page management home (UX §4.5), rendered INSIDE the Simulated tab
 * ABOVE the positions view (the Live tab stays the locked placeholder — untouched). Every order,
 * every ticker; Open / History segmented pill (History = filled/cancelled/expired, never dropped,
 * AC-24); two-step cancel; detail; client-side Export JSON (`convexa-orders-{date}.json` — the
 * AC-33 audit floor); empty + store-fault states (§4.6). Rows for tickers other than this page's
 * focused/streamed one show the §4.3 not-evaluated state — CORRECT and required, not a bug (D5).
 */
import { useState } from 'react';
import { Box, Button, Chip, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { SIMULATED_TIP } from '../positions/labels';
import { useOrders, deriveEval, LiveCoverage } from './useOrders';
import { OrderRow } from './OrderRow';
import { OrderDetailDialog } from './OrderDetailDialog';
import { StoreFaultBlock, useStatusAnnouncement } from './OrdersWidget';
import {
  PANEL_TITLE, PANEL_SUBTITLE, PANEL_EMPTY_OPEN, PANEL_EMPTY_HISTORY, ACTION_EXPORT,
} from './copy';
import { exportFilename } from './store';
import { isTerminal } from './types';

const srOnly = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
} as const;

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
  const detailOrder = effectiveDetailId ? orders.find((o) => o.id === effectiveDetailId) ?? null : null;

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
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 2, mb: 2, bgcolor: 'background.paper' }}
    >
      <Box component="span" aria-live="polite" sx={srOnly}>{announcement}</Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{PANEL_TITLE}</Typography>
        <Tooltip arrow title={SIMULATED_TIP}>
          <Chip size="small" variant="outlined" label="SIMULATED" />
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" onClick={doExport} data-testid="orders-export" sx={{ textTransform: 'none' }}>
          {ACTION_EXPORT}
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        {PANEL_SUBTITLE}
      </Typography>

      {/* Open / History segmented pill (the page's existing pill idiom). */}
      <ToggleButtonGroup
        exclusive size="small" value={tab}
        onChange={(_, v) => v && setTab(v)}
        aria-label="orders view" sx={{ mb: 1 }}
      >
        <ToggleButton value="open" data-testid="orders-tab-open">Open</ToggleButton>
        <ToggleButton value="history" data-testid="orders-tab-history">History</ToggleButton>
      </ToggleButtonGroup>

      {faulted ? (
        <StoreFaultBlock />
      ) : shown.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }} data-testid={tab === 'open' ? 'orders-empty-open' : 'orders-empty-history'}>
          {tab === 'open' ? PANEL_EMPTY_OPEN : PANEL_EMPTY_HISTORY}
        </Typography>
      ) : (
        <Box>
          {shown.map((o) => (
            <OrderRow
              key={o.id} order={o}
              evalState={deriveEval(o, coverage)}
              onDetails={setDetailId}
              onCancel={cancel}
            />
          ))}
        </Box>
      )}

      <OrderDetailDialog
        order={detailOrder}
        onClose={() => { setDetailId(null); onDetailClose?.(); }}
        onViewPosition={onViewPosition}
      />
    </Box>
  );
}
