/**
 * OrdersWidget — the Ticker-board Orders widget (UX §4.4): `<Widget id="orders">` placed directly
 * after the AI-rec widget (act → watch reads as one motion) on the board.
 * Shows THIS ticker's orders — the place evaluation is actually live while you watch.
 * `live` pulses only while ≥1 of this ticker's orders is actually Watching.
 *
 * States: default (non-terminal rows + a collapsed "Recent {n} completed" group) · empty · store
 * fault (§4.6 block inside the widget body). No loading state — the store is client-local and
 * synchronous, so first paint is real data. Row-level eval states per §4.3; the widget frame
 * itself never dims. Status changes announce via an `aria-live="polite"` region (UX §8).
 */
import { SIMULATED_TIP } from '@/features/trading/positions/labels';
import { Widget } from '@/shared/ui/Widget';
import { Box, Button, Chip, Collapse, Stack, Tooltip, Typography } from '@mui/material';
import type { LiveUpdate } from '@convexa/api';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderRow } from './OrderRow';
import {
  ACTION_ALL_ORDERS,
  recentCompleted,
  STATUS_CHIP,
  STORE_FAULT_BODY,
  STORE_FAULT_TITLE,
  WIDGET_EMPTY,
  WIDGET_TITLE,
} from './copy';
import { isTerminal, SimOrder } from './types';
import { deriveEval, LiveCoverage, useOrders } from './useOrders';

/** §4.6 — the honest store-fault block (shared with the panel). */
export function StoreFaultBlock() {
  return (
    <Box data-testid="orders-store-fault" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
      {/* component="p" (stage-3 §5.6): a transient fault title must not mount/unmount an <h6>. */}
      <Typography variant="subtitle2" component="p">
        {STORE_FAULT_TITLE}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {STORE_FAULT_BODY}
      </Typography>
    </Box>
  );
}

/** aria-live announcements on status changes (UX §8): a visually-hidden polite region. */
export function useStatusAnnouncement(orders: SimOrder[]): string {
  const [announcement, setAnnouncement] = useState('');
  const prev = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const next = new Map<string, string>();
    let changed: SimOrder | null = null;
    for (const o of orders) {
      next.set(o.id, o.status);
      const before = prev.current.get(o.id);
      if (before && before !== o.status) changed = o;
    }
    prev.current = next;
    if (changed) {
      setAnnouncement(
        `Order ${changed.ticker} ${changed.strike}${changed.right === 'call' ? 'C' : 'P'} ${STATUS_CHIP[changed.status]}`,
      );
    }
  }, [orders]);
  return announcement;
}

const srOnly = {
  position: 'absolute',
  // '1px' STRINGS, deliberately: in MUI sx a bare numeric width/height <= 1 means a PERCENTAGE
  // (width: 1 -> '100%'), which made this "1px" sr-only span a full-width absolute box that
  // overhung the 393px viewport (caught by the Stage 0 no-overflow enforcement row).
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

interface Props {
  ticker: string;
  live: LiveUpdate | null;
  isLive: boolean;
  streamOffline: boolean;
}

export function OrdersWidget({ ticker, live, isLive, streamOffline }: Props) {
  const navigate = useNavigate();
  const { orders, faulted, cancel } = useOrders();
  const symbol = ticker.toUpperCase();
  const mine = orders.filter((o) => o.ticker === symbol);
  const open = mine.filter((o) => !isTerminal(o.status));
  const done = mine.filter((o) => isTerminal(o.status)); // newest-created first (store order)
  const [showDone, setShowDone] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const coverage: LiveCoverage = { ticker: symbol, mid: live?.mid ?? null, isLive, streamOffline };
  const watchingAny = open.some((o) => deriveEval(o, coverage)?.kind === 'watching');
  const announcement = useStatusAnnouncement(mine);

  const actions = (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Tooltip arrow title={SIMULATED_TIP}>
        <Chip size="small" variant="outlined" label="SIMULATED" />
      </Tooltip>
      {/* Link-class action text binds `info` (stage-3 §4.2 — matches the AiRec export action). */}
      <Button
        size="small"
        onClick={() => navigate('/positions')}
        sx={{
          p: 0,
          minWidth: 0,
          textTransform: 'none',
          fontWeight: 500,
          color: 'info.main',
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: 'transparent' },
        }}
      >
        {ACTION_ALL_ORDERS}
      </Button>
    </Stack>
  );

  return (
    <Widget id="orders" title={WIDGET_TITLE(symbol)} live={watchingAny} actions={actions}>
      <Box component="span" aria-live="polite" sx={srOnly} data-testid="orders-announce">
        {announcement}
      </Box>
      {faulted ? (
        <StoreFaultBlock />
      ) : mine.length === 0 ? (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid="orders-widget-empty"
        >
          {WIDGET_EMPTY(symbol)}
        </Typography>
      ) : (
        <Box>
          {open.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              compact
              evalState={deriveEval(o, coverage)}
              onDetails={setDetailId}
              onCancel={cancel}
            />
          ))}
          {done.length > 0 && (
            <Box sx={{ mt: open.length ? 1 : 0 }}>
              <Button
                size="small"
                onClick={() => setShowDone((s) => !s)}
                aria-expanded={showDone}
                sx={{ p: 0, minWidth: 0, textTransform: 'none', color: 'text.secondary' }}
                data-testid="orders-recent-completed"
              >
                {recentCompleted(done.length)} {showDone ? '▾' : '▸'}
              </Button>
              <Collapse in={showDone}>
                {done.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    compact
                    evalState={null}
                    onDetails={setDetailId}
                    onCancel={cancel}
                  />
                ))}
              </Collapse>
            </Box>
          )}
        </Box>
      )}
      <OrderDetailDialog
        order={detailId ? (mine.find((o) => o.id === detailId) ?? null) : null}
        onClose={() => setDetailId(null)}
        onViewPosition={() => navigate('/positions')}
      />
    </Widget>
  );
}
