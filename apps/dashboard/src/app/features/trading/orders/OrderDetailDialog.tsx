/**
 * OrderDetailDialog — the provenance/review dialog (UX §5): the order's status, its plan as placed
 * (the facts the audit compares against the rec's words — D3: edits at creation don't sever this),
 * SOURCE (rec fingerprint · persona or scenario identity · the rec's verbatim words, AC-30), the
 * LIFECYCLE timeline on the exchange clock, and "View position →" when filled (AC-31).
 *
 * Drawn as the Final order-detail board (`design/src/screens/final/account-dialogs.mjs`,
 * `orderDetailDemo`; fidelity audit 2026-10-25, OVL, ACC-10/12/13/15): the theme's flat overlay
 * panel, 560 wide, a ruled header (title, neutral `SIMULATED`, close), a status row, a 2×2 figure
 * grid, the lifecycle rows, and a footer with Cancel order and Close. Under 600px it is the shared
 * bottom sheet (`shared/ui/bottomSheet.ts`).
 */
import { SIMULATED_TIP } from '@/features/trading/positions/labels';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { marketDataOff } from '@/shared/dataState/marketData';
import { faceFor, MONO_FACE } from '@/shared/figure';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import { bottomSheetActionsSx, bottomSheetDialogSx, grabHandleSx } from '@/shared/ui/bottomSheet';
import { dataMode } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ACTION_CANCEL,
  ACTION_CONFIRM_CANCEL,
  ACTION_VIEW_POSITION,
  DETAIL_LIFECYCLE,
  detailPinned,
  detailScenarioSource,
  entryPriceText,
  NOT_EVALUATED_TEXT,
  REC_NO_TRIGGER_TEXT,
  REC_WORDS_LABEL,
  SCRIPTED_CHIP,
  scriptedStrip,
  sourceAiRead,
  STATUS_CHIP,
  triggerText,
} from './copy';
import { etStamp, statusTip } from './OrderRow';
import { isTerminal, type SimOrder } from './types';
import { cancelOrder } from './useOrders';

// Not-applicable, named rather than inlined: keeps this fallback text out of the raw-text window
// the shared face module's raw-text scan reads around a mono-bound line, so the scan never misreads
// a defensive fallback beside an unrelated mono figure as a closed-nine member inside a mono run.
const DASH = '—';

/** "Nov 20" from a bare `YYYY-MM-DD`. Formatted in UTC: the date is a calendar date, and reading it
 *  through any zone west of UTC would roll it back a day. */
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});
const monthDay = (ymd: string) => {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : MONTH_DAY.format(d);
};

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A caps label (the board's `.caps`). */
function Caps({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1.3,
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

/** One cell of the figure grid (the board's `.hd-fig > div`): the well behind a caps label and its
 *  value. Prose (the source) keeps the text face; a plan figure takes the figure face. */
function FigureCell({ label, value, figure }: { label: string; value: string; figure: boolean }) {
  return (
    <Box
      sx={(t) => ({
        bgcolor: extrasFor(t).well,
        p: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: 0,
      })}
    >
      <Caps>{label}</Caps>
      <Typography
        component="span"
        sx={{ ...faceFor(figure), fontSize: 14, lineHeight: 1.3, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** One lifecycle row (the board's `.drows > div`): the ET moment, then what happened. */
function LifecycleRow({ at, children }: { at: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '136px minmax(0, 1fr)',
        gap: 1,
        alignItems: 'center',
        py: '6px',
        borderTop: 1,
        borderColor: 'divider',
        fontSize: 12,
      }}
    >
      <Typography component="span" sx={{ ...MONO_FACE, fontSize: 12, color: 'text.secondary' }}>
        {at}
      </Typography>
      <Typography component="span" sx={{ fontSize: 12, minWidth: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

interface Props {
  order: SimOrder | null;
  onClose: () => void;
  /** Navigate to the created position (AC-31). Absent ⇒ the link is hidden. */
  onViewPosition?: (positionId: string) => void;
  /** Cancel a waiting or triggered order. Defaults to the orders store's own cancel, the same call
   *  the row's two-step Cancel makes. */
  onCancel?: (id: string) => void;
}

export function OrderDetailDialog({ order: o, onClose, onViewPosition, onCancel }: Props) {
  const titleId = useId();
  // With no options feed on this site an order can't trigger: say so quietly, and link the demo,
  // where orders trigger on the sample tape (Final Overlays, DLG-02).
  const marketDataMode = useMarketDataMode();
  const feedOff = marketDataOff(marketDataMode);

  // Cancel order is the row's two-step cancel (D6, AC-22): the first press arms "Confirm cancel",
  // the second cancels; a press anywhere else, or leaving the button, disarms it.
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
  const orderId = o?.id;
  useEffect(() => setArmed(false), [orderId]);

  const contract = o ? `${o.ticker} ${o.strike} ${o.right === 'call' ? 'C' : 'P'}` : '';
  const cancellable = o != null && (o.status === 'waiting' || o.status === 'triggered');

  return (
    <Dialog
      open={o != null}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      aria-labelledby={titleId}
      // The surface is the theme's flat overlay panel (OVL); this dialog sets only its width, the
      // board's 560 (ACC-10), and becomes the shared bottom sheet under 600px (ACC-15).
      sx={bottomSheetDialogSx}
      slotProps={{ paper: { sx: { maxWidth: 560 } } }}
    >
      {o && (
        <DialogContent data-testid="order-detail-dialog" sx={{ p: 0 }}>
          <Box aria-hidden sx={grabHandleSx} />
          {/* Header — title + SIMULATED (+ scripted) + close, ruled off the body. */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: '18px',
              py: '14px',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexGrow: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <Typography
                id={titleId}
                component="h2"
                sx={{
                  flex: '1 1 160px',
                  minWidth: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {`Simulated order · ${contract} · ${monthDay(o.expiration)}`}
              </Typography>
              {/* SIMULATED is a neutral outlined tag (ACC-12), never the success colour. */}
              <Chip
                size="small"
                variant="outlined"
                label="SIMULATED"
                title={SIMULATED_TIP}
                sx={(t) => ({
                  color: 'text.primary',
                  borderColor: extrasFor(t).lineStrong,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                })}
              />
              {o.provenance.source === 'ai_scenario' && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={SCRIPTED_CHIP}
                  data-testid="order-detail-scripted-chip"
                />
              )}
            </Stack>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close"
              sx={{ color: 'text.secondary', mr: -0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Stack spacing="14px" sx={{ px: '18px', py: '16px' }}>
            {/* STATUS — the lifecycle chip (neutral, as every status tag), where it is evaluated,
                and what it is waiting for. */}
            <Box
              data-testid="order-detail-status"
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
            >
              <Chip
                size="small"
                variant="outlined"
                icon={isTerminal(o.status) ? undefined : <ScheduleOutlined />}
                label={STATUS_CHIP[o.status]}
                sx={(t) => ({
                  color: 'text.primary',
                  borderColor: extrasFor(t).lineStrong,
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: 'text.secondary', fontSize: 14, ml: '6px' },
                })}
              />
              {dataMode === 'demo' && !isTerminal(o.status) && (
                <DataStateTag state="sample" label="Sample tape" />
              )}
              <Typography
                component="span"
                sx={{ fontSize: 12, lineHeight: 1.45, color: 'text.secondary', minWidth: 0 }}
              >
                {statusTip(o)}
              </Typography>
            </Box>

            {o.provenance.source === 'ai_scenario' && (
              <Alert severity="warning" sx={{ py: 0 }}>
                {scriptedStrip(
                  o.provenance.scenario_name ?? o.provenance.scenario_id ?? 'scenario',
                )}
              </Alert>
            )}

            {feedOff && !isTerminal(o.status) && (
              <Box data-testid="order-detail-not-live" sx={{ display: 'grid', gap: 0.75 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                  <DataStateTag state="notLive" label="Not evaluated" />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {NOT_EVALUATED_TEXT}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
                  The plan stays as placed; it can still expire or be cancelled. On the demo, orders
                  trigger on the sample tape.{' '}
                  <Link
                    href={`${STAGING_DEMO_URL}/positions`}
                    underline="always"
                    data-testid="order-detail-demo"
                    sx={{ color: (t) => extrasFor(t).textInfo, fontWeight: 600 }}
                  >
                    See it on the demo →
                  </Link>
                </Typography>
              </Box>
            )}

            {/* PLAN AS PLACED — the 2×2 figure grid, then the size and the risk plan. */}
            <Box data-testid="order-detail-plan">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '1px',
                  bgcolor: 'divider',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <FigureCell
                  label="Source"
                  figure={false}
                  value={
                    o.provenance.source === 'ai_scenario'
                      ? detailScenarioSource(
                          o.provenance.scenario_name ?? o.provenance.scenario_id ?? 'scenario',
                          o.provenance.scenario_id ?? DASH,
                        )
                      : sourceAiRead(o.provenance.persona?.name ?? 'Default (no persona)')
                  }
                />
                <FigureCell
                  label="Entry"
                  figure
                  value={sentenceCase(entryPriceText(o.limit_price))}
                />
                <FigureCell label="Trigger" figure value={sentenceCase(triggerText(o.trigger))} />
                <FigureCell label="Good til" figure value={monthDay(o.expires_at)} />
              </Box>
              <Typography
                component="p"
                sx={{ m: 0, mt: 1, fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}
              >
                {o.qty} × {contract} {monthDay(o.expiration)} · stop{' '}
                {o.stop == null ? DASH : `$${o.stop}`} · target{' '}
                {o.target == null ? DASH : `$${o.target}`}
              </Typography>
            </Box>

            {/* SOURCE (AC-30) — the source itself is the grid's first cell; here, what the order
                was pinned to and the rec's own words, verbatim. */}
            <Box data-testid="order-detail-source">
              {o.provenance.rec_fingerprint && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mb: 1, color: 'text.secondary', ...MONO_FACE }}
                >
                  {detailPinned(o.provenance.rec_fingerprint, o.provenance.rec_as_of ?? null)}
                </Typography>
              )}
              <Caps>{REC_WORDS_LABEL}</Caps>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: 'text.secondary', fontStyle: 'italic' }}
                data-testid="order-detail-verbatim"
              >
                {o.provenance.trigger_source_text
                  ? `“${o.provenance.trigger_source_text}”`
                  : REC_NO_TRIGGER_TEXT}
              </Typography>
            </Box>

            {/* LIFECYCLE — every moment on the exchange clock (ET), whatever the viewer's zone. */}
            <Box data-testid="order-detail-lifecycle">
              <Box sx={{ mb: 1 }}>
                <Caps>{DETAIL_LIFECYCLE}</Caps>
              </Box>
              <LifecycleRow at={etStamp(o.created_time)}>
                Placed · {o.qty} × {contract} {monthDay(o.expiration)}
              </LifecycleRow>
              {o.triggered_time && (
                <LifecycleRow at={etStamp(o.triggered_time)}>
                  {o.status !== 'triggered'
                    ? 'Triggered'
                    : o.limit_price != null
                      ? 'Triggered · waiting to fill at limit'
                      : 'Triggered · filling at the first live mark'}
                </LifecycleRow>
              )}
              {o.filled_time && (
                <LifecycleRow at={etStamp(o.filled_time)}>
                  Filled at ${o.fill_mark?.toFixed(2)}{' '}
                  <Tooltip
                    arrow
                    title={
                      o.fill_basis === 'limit_fill'
                        ? 'Filled at your limit on a live cross.'
                        : 'Filled at the first live option mark after the trigger crossed — recorded at fill time, never backfilled.'
                    }
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={o.fill_basis === 'limit_fill' ? 'filled at limit' : 'trigger fill'}
                    />
                  </Tooltip>
                </LifecycleRow>
              )}
              {o.close_time && (
                <LifecycleRow at={etStamp(o.close_time)}>
                  {o.close_reason === 'expired' ? 'Expired' : 'Cancelled'}
                </LifecycleRow>
              )}
              {!isTerminal(o.status) && (
                <LifecycleRow at={DASH}>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    Not filled
                  </Box>
                </LifecycleRow>
              )}
            </Box>
          </Stack>

          {/* Footer (the board's `.df`): where the order lives, then its actions. Under 600px the
              buttons stack full width at 44px. */}
          <Box
            sx={[
              {
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                px: '18px',
                py: '12px',
                borderTop: 1,
                borderColor: 'divider',
              },
              bottomSheetActionsSx,
            ]}
          >
            <Typography
              component="span"
              sx={{ flex: '1 1 240px', fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}
            >
              Stored in this browser · never sent to a broker
            </Typography>
            {o.status === 'filled' && o.position_id && onViewPosition && (
              <Button
                variant="outlined"
                onClick={() => onViewPosition(o.position_id as string)}
                data-testid="order-view-position"
              >
                {ACTION_VIEW_POSITION}
              </Button>
            )}
            {cancellable && (
              <Button
                ref={armedRef}
                variant="outlined"
                color={armed ? 'warning' : 'inherit'}
                data-testid={armed ? 'order-detail-cancel-confirm' : 'order-detail-cancel'}
                onClick={() => {
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  setArmed(false);
                  (onCancel ?? cancelOrder)(o.id);
                }}
                onBlur={() => setArmed(false)}
              >
                {armed ? ACTION_CONFIRM_CANCEL : ACTION_CANCEL}
              </Button>
            )}
            <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
              Close
            </Button>
          </Box>
        </DialogContent>
      )}
    </Dialog>
  );
}
