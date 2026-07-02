/**
 * OrderDetailDialog — the provenance/review dialog (UX §5): SOURCE (rec fingerprint · persona or
 * scenario identity · the rec's verbatim words, AC-30) · PLAN AS PLACED (the facts the audit
 * compares against the rec's words — D3: edits at creation don't sever this) · LIFECYCLE timeline ·
 * "View position →" when filled (AC-31). Panel-raised skin, token-only, SIMULATED chip (AC-46).
 */
import { Box, Chip, Dialog, DialogContent, IconButton, Stack, Typography, Tooltip, Button, Alert } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { SIMULATED_TIP } from '../positions/labels';
import { extrasFor, typographyTokens } from '../tokens';
import type { SimOrder } from './types';
import {
  DETAIL_SOURCE, DETAIL_PLAN, DETAIL_LIFECYCLE, detailScenarioSource, detailPinned, sourceAiRead,
  REC_WORDS_LABEL, REC_NO_TRIGGER_TEXT, triggerText, entryPriceText, goodTilText,
  ACTION_VIEW_POSITION, SCRIPTED_CHIP, scriptedStrip,
} from './copy';

const MONO = { fontFamily: typographyTokens.monoFontFamily, letterSpacing: 0 } as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{
      display: 'block', color: 'text.disabled', letterSpacing: '0.07em', fontWeight: 700, fontSize: 11, mb: 0.5,
    }}>
      {children}
    </Typography>
  );
}

interface Props {
  order: SimOrder | null;
  onClose: () => void;
  /** Navigate to the created position (AC-31). Absent ⇒ the link is hidden. */
  onViewPosition?: (positionId: string) => void;
}

export function OrderDetailDialog({ order: o, onClose, onViewPosition }: Props) {
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : null);
  return (
    <Dialog
      open={o != null}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px', border: 1, borderColor: 'divider', backgroundImage: 'none',
            bgcolor: (theme) => extrasFor(theme).panelRaised,
          },
        },
      }}
    >
      {o && (
        <DialogContent data-testid="order-detail-dialog" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexGrow: 1, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Simulated order · {o.ticker} {o.strike}{o.right === 'call' ? 'C' : 'P'}
                </Typography>
                <Chip
                  size="small" label="SIMULATED" title={SIMULATED_TIP}
                  sx={(t) => ({ bgcolor: alpha(t.palette.success.main, 0.18), color: 'success.main', fontWeight: 700, letterSpacing: '0.04em' })}
                />
                {o.provenance.source === 'ai_scenario' && (
                  <Chip size="small" color="warning" variant="outlined" label={SCRIPTED_CHIP} data-testid="order-detail-scripted-chip" />
                )}
              </Stack>
              <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {o.provenance.source === 'ai_scenario' && (
              <Alert severity="warning" sx={{ py: 0 }}>
                {scriptedStrip(o.provenance.scenario_name ?? o.provenance.scenario_id ?? 'scenario')}
              </Alert>
            )}

            {/* SOURCE (AC-30). */}
            <Box data-testid="order-detail-source">
              <SectionLabel>{DETAIL_SOURCE}</SectionLabel>
              <Typography variant="body2">
                {o.provenance.source === 'ai_scenario'
                  ? detailScenarioSource(
                      o.provenance.scenario_name ?? o.provenance.scenario_id ?? 'scenario',
                      o.provenance.scenario_id ?? '—',
                    )
                  : sourceAiRead(o.provenance.persona?.name ?? 'Default (no persona)')}
              </Typography>
              {o.provenance.rec_fingerprint && (
                <Typography variant="caption" sx={{ color: 'text.secondary', ...MONO }}>
                  {detailPinned(o.provenance.rec_fingerprint, o.provenance.rec_as_of ?? null)}
                </Typography>
              )}
              <Box sx={{ mt: 1 }}>
                <SectionLabel>{REC_WORDS_LABEL}</SectionLabel>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }} data-testid="order-detail-verbatim">
                  {o.provenance.trigger_source_text
                    ? `“${o.provenance.trigger_source_text}”`
                    : REC_NO_TRIGGER_TEXT}
                </Typography>
              </Box>
            </Box>

            {/* PLAN AS PLACED. */}
            <Box data-testid="order-detail-plan">
              <SectionLabel>{DETAIL_PLAN}</SectionLabel>
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={MONO}>
                  {o.ticker} {o.strike}{o.right === 'call' ? 'C' : 'P'} · {o.expiration} · ×{o.qty}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  trigger {triggerText(o.trigger)} · {entryPriceText(o.limit_price)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  stop {o.stop == null ? '—' : `$${o.stop}`} · target {o.target == null ? '—' : `$${o.target}`} · {goodTilText(o.expires_at.slice(0, 10))}
                </Typography>
              </Stack>
            </Box>

            {/* LIFECYCLE. */}
            <Box data-testid="order-detail-lifecycle">
              <SectionLabel>{DETAIL_LIFECYCLE}</SectionLabel>
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>placed {fmt(o.created_time)}</Typography>
                {o.triggered_time && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>triggered {fmt(o.triggered_time)}</Typography>
                )}
                {o.filled_time && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    filled {fmt(o.filled_time)} · at ${o.fill_mark?.toFixed(2)}{' '}
                    <Tooltip arrow title={o.fill_basis === 'limit_fill'
                      ? 'Filled at your limit on a live cross.'
                      : 'Filled at the first live option mark after the trigger crossed — recorded at fill time, never backfilled.'}>
                      <Chip size="small" variant="outlined" label={o.fill_basis === 'limit_fill' ? 'filled at limit' : 'trigger fill'} />
                    </Tooltip>
                  </Typography>
                )}
                {o.close_time && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {o.close_reason === 'expired' ? 'expired' : 'cancelled'} {fmt(o.close_time)}
                  </Typography>
                )}
              </Stack>
            </Box>

            {o.status === 'filled' && o.position_id && onViewPosition && (
              <Box>
                <Button size="small" onClick={() => onViewPosition(o.position_id as string)} data-testid="order-view-position">
                  {ACTION_VIEW_POSITION}
                </Button>
              </Box>
            )}
          </Stack>
        </DialogContent>
      )}
    </Dialog>
  );
}
