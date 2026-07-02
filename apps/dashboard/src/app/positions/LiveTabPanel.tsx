/**
 * The Live tab (LOCKED placeholder — UX_BLUEPRINT §6 S10, ARCHITECTURE_CONTRACT §4.2). Present +
 * selectable, but structurally inert by construction: it imports NONE of the store, mark/fill engine,
 * `fetchTrackedContract`, the SSE feed, or the customization state; it receives no position data; it
 * makes NO network call and exposes NO entry / order affordance. If it imports nothing live, it can
 * wire to nothing.
 *
 * Zero-import boundary (the `no-real-order-path` enforcement): this module imports ONLY MUI, the
 * static copy constants (`labels.ts`), and the pure design-token values (`tokens.ts` — a static value
 * module, NOT a data source). Do NOT add any import of a data source here — that is the enforcement.
 * (The hatched-card visual is inlined here, NOT imported from `ui/ComingSoonBox`; the 18px-stripe hatch
 * is reproduced per this frame, single-sourcing its colors off the tokens.)
 */
import { Box, Typography } from '@mui/material';
import { LIVE_HEADING, LIVE_BODY, LIVE_LOCK_CHIP } from './labels';
import { hatchBackgroundImage } from '../ui/ComingSoonBox';

export function LiveTabPanel() {
  return (
    <Box
      data-testid="live-locked-panel"
      sx={{
        mt: '24px',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: '10px',
        // Hatched inert affordance — the shared mode-aware hatch (single-sourced in ComingSoonBox).
        backgroundImage: hatchBackgroundImage,
        p: '48px',
        textAlign: 'center',
      }}
    >
      <Typography component="div" sx={{ fontSize: '1.6rem', mb: '10px' }}>🔒</Typography>
      <Typography component="h3" sx={{ fontSize: '1.15rem', fontWeight: 700, m: '0 0 8px' }}>
        {LIVE_HEADING}
      </Typography>
      <Typography
        component="p"
        sx={{ maxWidth: 440, mx: 'auto', my: 0, fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.55, textAlign: 'center' }}
      >
        {LIVE_BODY}
      </Typography>
      <Box
        data-testid="live-lock-chip"
        component="span"
        sx={{
          display: 'inline-block',
          mt: '14px',
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: 'warning.main',
          border: '1px solid rgba(255,167,38,0.35)',
          bgcolor: 'rgba(255,167,38,0.08)',
          borderRadius: 999,
          padding: '3px 10px',
        }}
      >
        {LIVE_LOCK_CHIP}
      </Box>
    </Box>
  );
}
