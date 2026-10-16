/**
 * OrderRow — one sim order rendered per the UX §4.1 anatomy, shared by BOTH surfaces (the Ticker
 * widget + the Positions panel): contract line · plan facts · status chip + timestamp · source ·
 * the derived evaluation reality (§4.3) · Details + the keyboard-operable two-step Cancel (D6,
 * AC-22 — NO edit affordance anywhere).
 *
 * `[live-vs-static-isolation]`: ONLY the live-derived cells (Watching chip, distance readout) dim
 * on a stream drop (`⏸ offline` + last-known); the durable row facts never dim, never blank.
 * Token-only styling; the Watching pulse is reduced-motion-guarded via the CSS media query.
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { marketDataOff } from '@/shared/dataState/marketData';
import { MONO_FACE } from '@/shared/figure';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { upText } from '@/shared/theme/tokens';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import {
  ACTION_CANCEL,
  ACTION_CONFIRM_CANCEL,
  ACTION_DETAILS,
  CANCELLED_TIP,
  entryPriceText,
  EXPIRED_TIP,
  FILLED_TIP,
  GOOD_TIL_GLOSSARY,
  goodTilText,
  NOT_EVALUATED_FEED_OFF_TIP,
  NOT_EVALUATED_TEXT,
  notEvaluatedTip,
  sourceAiRead,
  sourceScripted,
  STATUS_CHIP,
  TRIGGER_GLOSSARY,
  TRIGGERED_MARKET_TIP,
  triggeredLimitTip,
  triggerText,
  waitingTip,
  WATCHING_CHIP,
  watchingTip,
} from './copy';
import type { OrderEvalState, SimOrder } from './types';

function statusTip(o: SimOrder): string {
  switch (o.status) {
    case 'waiting':
      return waitingTip(o.ticker);
    case 'triggered':
      return o.limit_price != null ? triggeredLimitTip(o.limit_price) : TRIGGERED_MARKET_TIP;
    case 'filled':
      return FILLED_TIP;
    case 'cancelled':
      return CANCELLED_TIP;
    case 'expired':
      return EXPIRED_TIP;
  }
}

/** Status timestamp per §4.1 — the relevant lifecycle moment. */
function statusTime(o: SimOrder): string {
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');
  switch (o.status) {
    case 'waiting':
      return `placed ${fmt(o.created_time)}`;
    case 'triggered':
      return `triggered ${fmt(o.triggered_time ?? o.created_time)}`;
    case 'filled':
      return `filled ${fmt(o.filled_time)}`;
    case 'cancelled':
      return `cancelled ${fmt(o.close_time)}`;
    case 'expired':
      return `expired ${fmt(o.close_time)}`;
  }
}

/** Terminal chips de-emphasize; `filled` uses the success tint; none is error-red (§4.2). */
function StatusChip({ order }: { order: SimOrder }) {
  const label = STATUS_CHIP[order.status];
  const success = order.status === 'filled';
  const terminal = order.status !== 'waiting' && order.status !== 'triggered';
  return (
    <Tooltip arrow describeChild title={statusTip(order)}>
      <Chip
        size="small"
        variant="outlined"
        label={label}
        data-testid={`order-status-${order.status}`}
        sx={(t) => ({
          fontWeight: 600,
          ...(success
            ? { color: upText(t), borderColor: alpha(t.palette.success.main, 0.5) }
            : terminal
              ? { color: 'text.secondary' }
              : {}),
        })}
      />
    </Tooltip>
  );
}

/** The §4.3 evaluation-reality cell (derived, non-terminal only; NEVER suppressed). */
function EvalCell({ order, evalState }: { order: SimOrder; evalState: OrderEvalState | null }) {
  if (!evalState) return null; // terminal rows show no evaluation cell
  if (evalState.kind === 'watching') {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center' }}
        data-testid="order-eval-watching"
      >
        <Tooltip arrow describeChild title={watchingTip(order.ticker)}>
          <Chip
            size="small"
            label={WATCHING_CHIP}
            sx={(t) => ({
              color: 'info.main',
              bgcolor: alpha(t.palette.info.main, 0.12),
              fontWeight: 600,
              // The live-dot pulse idiom, reduced-motion-guarded (instant/static when reduced).
              '@media (prefers-reduced-motion: no-preference)': {
                animation: 'ordersWatchPulse 2.4s ease-in-out infinite',
              },
              '@keyframes ordersWatchPulse': {
                '0%, 100%': { opacity: 0.75 },
                '50%': { opacity: 1 },
              },
            })}
          />
        </Tooltip>
        {evalState.mid != null && order.trigger && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', ...MONO_FACE }}
            data-testid="order-eval-distance"
          >
            mid {evalState.mid} · {Math.abs(order.trigger.level - evalState.mid).toFixed(2)} to
            trigger
          </Typography>
        )}
      </Stack>
    );
  }
  if (evalState.kind === 'offline') {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center' }}
        data-testid="order-eval-offline"
      >
        <Tooltip arrow describeChild title={notEvaluatedTip(order.ticker)}>
          <Typography variant="caption" sx={{ color: 'warning.main' }}>
            {NOT_EVALUATED_TEXT}
          </Typography>
        </Tooltip>
        {/* Live-derived cell degrades: dim + last-known, never blank (AC-26). */}
        {evalState.lastMid != null && order.trigger && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', opacity: 0.5, ...MONO_FACE }}
            data-testid="order-eval-distance-offline"
          >
            mid {evalState.lastMid} · {Math.abs(order.trigger.level - evalState.lastMid).toFixed(2)}{' '}
            to trigger · ⏸ offline
          </Typography>
        )}
      </Stack>
    );
  }
  return <NotEvaluated ticker={order.ticker} />;
}

/** Not evaluated. With no options feed on this site that is a standing fact, not a fault: quiet,
 *  the Not live tag, no warning colour (Final Positions states, DLG-02). */
function NotEvaluated({ ticker }: { ticker: string }) {
  const marketDataMode = useMarketDataMode();
  const feedOff = dataMode === 'live' && marketDataOff(marketDataMode);
  return (
    <Tooltip
      arrow
      describeChild
      title={feedOff ? NOT_EVALUATED_FEED_OFF_TIP : notEvaluatedTip(ticker)}
    >
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        data-testid="order-eval-not-evaluated"
      >
        {feedOff && <DataStateTag state="notLive" label="Not evaluated" />}
        <Typography variant="caption" sx={{ color: feedOff ? 'text.secondary' : 'warning.main' }}>
          {NOT_EVALUATED_TEXT}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

export interface OrderRowProps {
  order: SimOrder;
  /** Derived at render by the surface (deriveEval); null for terminal rows. */
  evalState: OrderEvalState | null;
  onDetails: (id: string) => void;
  onCancel: (id: string) => void;
  /** Compact rows for the Ticker widget. */
  compact?: boolean;
}

export function OrderRow({ order: o, evalState, onDetails, onCancel, compact }: OrderRowProps) {
  // Two-step inline cancel: first click arms ("Confirm cancel"), second cancels; click-away/blur
  // resets (keyboard-operable — it is a real button, so Enter/Space + blur behave natively).
  const [armed, setArmed] = useState(false);
  const armedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!armed) return;
    const reset = (e: PointerEvent) => {
      if (armedRef.current && e.target instanceof Node && armedRef.current.contains(e.target))
        return;
      setArmed(false);
    };
    document.addEventListener('pointerdown', reset, true);
    return () => document.removeEventListener('pointerdown', reset, true);
  }, [armed]);

  const cancellable = o.status === 'waiting' || o.status === 'triggered';

  return (
    <Box
      data-testid="order-row"
      data-order-id={o.id}
      data-status={o.status}
      sx={{
        py: compact ? 1 : 1.25,
        px: compact ? 0 : 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
      >
        {/* Contract line. */}
        <Typography
          component="span"
          variant="body2"
          sx={{ ...MONO_FACE, fontWeight: 600 }}
          data-testid="order-contract"
        >
          {o.ticker} {o.strike}
          {o.right === 'call' ? 'C' : 'P'} · {o.expiration}
        </Typography>
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ...MONO_FACE }}>
          ×{o.qty}
        </Typography>
        <StatusChip order={o} />
        <Typography
          component="span"
          variant="caption"
          sx={{ color: 'text.secondary' }}
          data-testid="order-status-time"
        >
          {statusTime(o)}
        </Typography>
      </Stack>

      {/* Plan facts. */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25, mt: 0.5 }}
      >
        <Tooltip arrow describeChild title={TRIGGER_GLOSSARY}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid="order-trigger"
          >
            trigger {triggerText(o.trigger)}
          </Typography>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary' }}
          data-testid="order-entry-price"
        >
          {entryPriceText(o.limit_price)}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary' }}
          data-testid="order-stop-target"
        >
          stop {o.stop == null ? '—' : `$${o.stop}`} · target{' '}
          {o.target == null ? '—' : `$${o.target}`}
        </Typography>
        <Tooltip arrow describeChild title={GOOD_TIL_GLOSSARY}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid="order-good-til"
          >
            {goodTilText(o.expires_at.slice(0, 10))}
          </Typography>
        </Tooltip>
      </Stack>

      {/* Source + evaluation reality + actions. */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, mt: 0.5 }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled' }} data-testid="order-source">
          {o.provenance.source === 'ai_scenario'
            ? sourceScripted(o.provenance.scenario_name ?? o.provenance.scenario_id ?? 'scenario')
            : sourceAiRead(o.provenance.persona?.name ?? 'Default (no persona)')}
        </Typography>
        <EvalCell order={o} evalState={evalState} />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          sx={{ py: 0, minWidth: 0, color: 'text.secondary' }}
          onClick={() => onDetails(o.id)}
        >
          {ACTION_DETAILS}
        </Button>
        {cancellable && (
          <Button
            ref={armedRef}
            size="small"
            color={armed ? 'warning' : 'inherit'}
            sx={{ py: 0, minWidth: 0, ...(armed ? {} : { color: 'text.secondary' }) }}
            data-testid={armed ? 'order-cancel-confirm' : 'order-cancel'}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              onCancel(o.id);
            }}
            onBlur={() => setArmed(false)}
          >
            {armed ? ACTION_CONFIRM_CANCEL : ACTION_CANCEL}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
