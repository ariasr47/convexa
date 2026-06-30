/**
 * One position rendered as a set of cells (used by both table + card layouts). Honors the component
 * states (UX_BLUEPRINT §6 S4/S7): live cells (mark, P/L, Δ since entry, Session Δ, trend) dim + show
 * `⏸ offline` + last-known on an SSE drop; static cells (contract, status, entry, qty, ...) keep
 * rendering; a per-row lookup failure shows "unavailable" only on that row. Pending limits show the
 * waiting affordance + Cancel; nothing here can place a real order.
 */
import { Stack, Typography, Chip, Tooltip, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { MARK_BASIS_META } from '../ghost-trade/mark';
import type { DerivedRow } from './derive';
import { strategyLabel } from './derive';
import type { ColumnKey } from './types';
import {
  money, pct, ENTRY_MODE_LABEL, STATUS_LABEL, ENTRY_BASIS_META,
  SIMULATED_TIP, PL_TIP, DELTA_ENTRY_TIP, SESSION_DELTA_TIP, TREND_TIP, LIMIT_TIP,
  PENDING_PL_TIP, ROW_UNAVAILABLE_TIP,
} from './labels';
import { PlSparkline } from './PlSparkline';
import type { PlSample } from './useTrends';
import { typographyTokens } from '../tokens';

const OFFLINE = '⏸ offline';
// Figma table cell numerics: Roboto Mono, 13.8px (0.86rem), letterSpacing 0 (MUI `body2` would
// otherwise force 0.875rem + its own letter-spacing). Spread LAST in each cell's sx so it wins.
const MONO = {
  fontFamily: typographyTokens.monoFontFamily, fontVariantNumeric: 'tabular-nums',
  fontSize: '0.86rem', letterSpacing: 0,
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Frame "Expiry" format: `Mon DD · {dte}d` (e.g. `Jul 18 · 19d`). Parses the YYYY-MM-DD parts
 *  directly (no timezone drift) and computes days-to-expiry as pure calendar arithmetic, so it always
 *  shows even when live metrics are unavailable. Display-only — never feeds scoring/math. */
export function formatExpiry(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const md = `${MONTHS[m - 1]} ${d}`;
  const now = new Date();
  const dte = Math.max(0, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000));
  return `${md} · ${dte}d`;
}

export interface RowContext {
  row: DerivedRow;
  markRes: { mark: number | null; basis: string; frozen: boolean } | null;
  trend: PlSample[];
  streamOffline: boolean;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
}

function statusChipColor(status: string): 'default' | 'info' {
  return status === 'pending' ? 'info' : 'default';
}

export function cellContent(col: ColumnKey, ctx: RowContext): React.ReactNode {
  const { row, markRes, streamOffline } = ctx;
  const p = row.position;
  const mtr = row.metrics;
  const liveDim = streamOffline ? 0.5 : 1;
  const offlineTag = streamOffline ? (
    <Typography component="span" variant="caption" sx={{ color: 'text.disabled' }}> · {OFFLINE}</Typography>
  ) : null;

  switch (col) {
    case 'simulated':
      return <Tooltip arrow title={SIMULATED_TIP}><Chip size="small" variant="outlined" label="SIMULATED" /></Tooltip>;
    case 'contract':
      // REVISION 1 — the frame's "Ticker" style: bold mono symbol + secondary `$400 Call` leg
      // (strike + Call/Put) ONLY. The contract/exp/qty details now live in their own columns.
      return (
        <Stack direction="row" spacing={0.875} sx={{ alignItems: 'baseline' }} data-testid="cell-contract">
          <Typography component="span" variant="body2" sx={{ ...MONO, fontWeight: 600 }}>{p.ticker}</Typography>
          <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem', letterSpacing: 0, color: 'text.secondary' }}>
            ${p.strike} {p.right === 'call' ? 'Call' : 'Put'}
          </Typography>
        </Stack>
      );
    case 'status':
      return <Chip size="small" variant="outlined" color={statusChipColor(p.status)}
        sx={{ opacity: p.status === 'cancelled' ? 0.6 : 1 }} label={STATUS_LABEL[p.status]} />;
    case 'mode': {
      const mode = p.entry_mode ?? 'manual';
      const basisMeta = ENTRY_BASIS_META[p.entry_basis];
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="body2">{ENTRY_MODE_LABEL[mode]}</Typography>
          {basisMeta && <Tooltip arrow title={basisMeta.tip}><Chip size="small" variant="outlined" label={basisMeta.label} /></Tooltip>}
        </Stack>
      );
    }
    case 'mark': {
      if (p.status === 'pending') {
        return (
          <Tooltip arrow title={LIMIT_TIP}>
            <Typography variant="body2" sx={{ color: 'info.main' }}>limit ${(p.limit_price ?? 0).toFixed(2)}</Typography>
          </Tooltip>
        );
      }
      if (mtr.unavailable) {
        return <Tooltip arrow title={ROW_UNAVAILABLE_TIP}><Typography variant="body2" sx={{ color: 'text.disabled' }} data-testid="cell-unavailable">unavailable</Typography></Tooltip>;
      }
      const basisMeta = markRes ? MARK_BASIS_META[markRes.basis as keyof typeof MARK_BASIS_META] : null;
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', opacity: liveDim }} data-testid="cell-mark">
          <Typography variant="body2" sx={MONO}>
            {markRes?.mark == null ? '—' : `${markRes.basis === 'modeled' ? '≈ ' : ''}$${markRes.mark.toFixed(2)}`}
          </Typography>
          {basisMeta && <Tooltip arrow title={basisMeta.tip}><Chip size="small" variant="outlined" label={basisMeta.label} /></Tooltip>}
          {offlineTag}
        </Stack>
      );
    }
    case 'pl': {
      if (p.status === 'pending') {
        return <Tooltip arrow title={PENDING_PL_TIP}><Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography></Tooltip>;
      }
      if (mtr.unavailable) {
        return <Tooltip arrow title={ROW_UNAVAILABLE_TIP}><Typography variant="body2" sx={{ color: 'text.disabled' }} data-testid="cell-unavailable">unavailable</Typography></Tooltip>;
      }
      const color = mtr.plDollar == null ? 'text.primary' : mtr.plDollar >= 0 ? 'success.main' : 'error.main';
      // REVISION 1 — $ amount ONLY (the % moved to the dedicated `pl_pct` column).
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', opacity: liveDim }} data-testid="cell-pl">
          <Tooltip arrow title={PL_TIP}>
            <Typography variant="body2" sx={{ color, fontWeight: 600, ...MONO }}>
              {mtr.plDollar == null ? '—' : money(mtr.plDollar)}
            </Typography>
          </Tooltip>
          {offlineTag}
        </Stack>
      );
    }
    case 'pl_pct': {
      // REVISION 1 — % ONLY, same sign-color + offline dim. Reuses the row's already-computed
      // metrics (mtr.plPct) — no new compute path.
      if (p.status === 'pending') {
        return <Tooltip arrow title={PENDING_PL_TIP}><Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography></Tooltip>;
      }
      if (mtr.unavailable) {
        return <Tooltip arrow title={ROW_UNAVAILABLE_TIP}><Typography variant="body2" sx={{ color: 'text.disabled' }} data-testid="cell-unavailable">unavailable</Typography></Tooltip>;
      }
      const color = mtr.plDollar == null ? 'text.primary' : mtr.plDollar >= 0 ? 'success.main' : 'error.main';
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', opacity: liveDim }} data-testid="cell-pl-pct">
          <Tooltip arrow title={PL_TIP}>
            <Typography variant="body2" sx={{ color, ...MONO }}>
              {mtr.plPct == null ? '—' : pct(mtr.plPct)}
            </Typography>
          </Tooltip>
          {offlineTag}
        </Stack>
      );
    }
    case 'delta_entry': {
      if (p.status !== 'open') return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
      return (
        <Tooltip arrow title={DELTA_ENTRY_TIP}>
          <Typography variant="body2" sx={{ opacity: liveDim, ...MONO, color: 'text.secondary' }} data-testid="cell-delta-entry">
            {mtr.deltaEntry == null ? '—' : money(mtr.deltaEntry)}{streamOffline ? ' ⏸' : ''}
          </Typography>
        </Tooltip>
      );
    }
    case 'session_delta': {
      if (p.status !== 'open') return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
      return (
        <Tooltip arrow title={SESSION_DELTA_TIP}>
          <Typography variant="body2" sx={{ opacity: liveDim }} data-testid="cell-session-delta">
            {streamOffline ? '⏸' : mtr.sessionDelta == null ? '—' : money(mtr.sessionDelta)}
          </Typography>
        </Tooltip>
      );
    }
    case 'trend': {
      if (p.status !== 'open') return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>;
      return <Tooltip arrow title={TREND_TIP}><span><PlSparkline samples={ctx.trend} offline={streamOffline} /></span></Tooltip>;
    }
    case 'entry': {
      // Frame "Entry" = just the price (e.g. `$8.40`). The entry-basis provenance is preserved as a
      // hover tooltip (honesty kept) rather than an inline chip the frame doesn't show.
      const basisMeta = ENTRY_BASIS_META[p.entry_basis];
      const price = (
        <Typography component="span" variant="body2" sx={{ ...MONO, color: 'text.secondary' }} data-testid="cell-entry">
          ${p.entry_mark.toFixed(2)}
        </Typography>
      );
      return basisMeta ? <Tooltip arrow title={basisMeta.tip}>{price}</Tooltip> : price;
    }
    case 'qty': return <Typography variant="body2" sx={MONO}>{p.qty} ×</Typography>;
    case 'expiry': return <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', letterSpacing: 0 }} data-testid="cell-expiry">{formatExpiry(p.expiration)}</Typography>;
    case 'strike': return <Typography variant="body2">${p.strike}</Typography>;
    case 'right': return <Typography variant="body2">{p.right === 'call' ? 'Call' : 'Put'}</Typography>;
    case 'strategy': return <Typography component="span" variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary', letterSpacing: 0 }}>{strategyLabel(row.strategy)}</Typography>;
    case 'dte': return <Typography variant="body2">{mtr.dte == null ? '—' : mtr.dte}</Typography>;
    case 'entry_time': return <Typography variant="body2">{p.entry_time ? new Date(p.entry_time).toLocaleString() : '—'}</Typography>;
    case 'stop': return <Typography variant="body2">{p.stop == null ? '—' : `$${p.stop}`}</Typography>;
    case 'target': return <Typography variant="body2">{p.target == null ? '—' : `$${p.target}`}</Typography>;
    default: return null;
  }
}

/** The pending-limit affordance + Cancel (UX_BLUEPRINT §6 S7). */
export function PendingAffordance({ ctx }: { ctx: RowContext }) {
  const { row, markRes, streamOffline, onCancel } = ctx;
  const p = row.position;
  if (p.status !== 'pending') return null;
  const liveMark = markRes?.mark;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }} data-testid="pending-affordance">
      {streamOffline ? (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>Paused — resumes pricing when the live feed returns. ⏸</Typography>
      ) : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Waiting for mark ≤ ${(p.limit_price ?? 0).toFixed(2)}{liveMark != null ? ` (live $${liveMark.toFixed(2)})` : ''}
        </Typography>
      )}
      <Button size="small" onClick={() => onCancel(p.id)}>Cancel</Button>
    </Stack>
  );
}

/** Realized summary for a closed/cancelled position (static — UX_BLUEPRINT §6 S4 closed). */
export function ClosedSummary({ row }: { row: DerivedRow }) {
  const theme = useTheme();
  const p = row.position;
  if (p.status === 'cancelled') {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Cancelled · resting limit never filled</Typography>;
  }
  const held = p.close_time && p.entry_time
    ? Math.round((Date.parse(p.close_time) - Date.parse(p.entry_time)) / 60000) : 0;
  const r$ = p.realized_pl_dollar ?? 0;
  return (
    <Typography variant="body2" sx={{ color: r$ >= 0 ? theme.palette.success.main : theme.palette.error.main }}>
      Closed · realized {money(r$)} ({pct(p.realized_pl_pct ?? 0)}) · held {held < 60 ? `${held}m` : `${Math.floor(held / 60)}h ${held % 60}m`}
    </Typography>
  );
}
