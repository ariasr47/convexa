/**
 * `/scanner` — the view controls row: which view is showing, the density control, the editor
 * affordance, and the in-context sign-in prompt.
 *
 * Honesty rules enforced here (UX §3.3): the label for the owner-curated default view says
 * "Default view" — it NEVER says "saved", "your", or anything implying persistence for a visitor who
 * has none. The anonymous prompt is standing, not a surprise on click, and it is the SAME prompt a
 * refused write re-raises. Nothing here writes: `onEditView`/`onDensity` are pure UI callbacks.
 */
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import type { GateApi } from '@/features/auth/useGate';
import { extrasFor } from '@/shared/theme/tokens';
import { Box, Typography } from '@mui/material';
import type { ScanDensity, ScanView } from '@org/api';
import { SCAN_COPY } from './labels';

export interface ScanToolbarProps {
  view: ScanView | null;
  density: ScanDensity;
  onDensity: (density: ScanDensity) => void;
  onEditView: () => void;
  gate: GateApi;
}

const DENSITY_OPTIONS: { key: ScanDensity; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'comfortable', label: 'Comfortable' },
];

const segContainerSx = (theme: { palette: { mode: string } }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  bgcolor: extrasFor(theme).panelRaised,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  padding: '3px',
});
const segItemSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: active ? 'divider' : 'transparent',
  background: active ? extrasFor(theme).panelRaised : 'transparent',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: '7px',
  color: active ? 'text.primary' : 'text.secondary',
  whiteSpace: 'nowrap',
});

const editButtonSx = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  background: 'transparent',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'text.primary',
  borderRadius: '8px',
  padding: '7px 13px',
};

/** "Default view" for the owner-curated fallback; the account view's own name (or a neutral
 *  "Your view") once one exists. Never a persistence claim for an anonymous visitor. */
function viewLabel(view: ScanView | null): string {
  if (view?.source !== 'account') return 'Default view';
  return view.name?.trim() ? view.name : 'Your view';
}

export function ScanToolbar({ view, density, onDensity, onEditView, gate }: ScanToolbarProps) {
  // Standing prompt while signed out (UX §3.3); a refused write replaces it with the gate's own text.
  const promptText = gate.promptText ?? (gate.allowed ? null : SCAN_COPY.signInToCustomize);
  return (
    <Box data-testid="scan-toolbar" sx={{ mb: '12px' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <Typography
          component="span"
          data-testid="scan-view-label"
          sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary' }}
        >
          {viewLabel(view)}
        </Typography>

        <Box sx={segContainerSx} role="group" aria-label="Row density" data-testid="scan-density">
          {DENSITY_OPTIONS.map((option) => (
            <Box
              key={option.key}
              component="button"
              type="button"
              aria-pressed={density === option.key}
              data-testid={`scan-density-${option.key}`}
              onClick={() => onDensity(option.key)}
              sx={segItemSx(density === option.key)}
            >
              {option.label}
            </Box>
          ))}
        </Box>

        <Box
          component="button"
          type="button"
          data-testid="scan-edit-view"
          onClick={onEditView}
          sx={{ ...editButtonSx, ml: 'auto' }}
        >
          {SCAN_COPY.editView}
        </Box>
      </Box>

      <Box sx={{ mt: promptText ? '10px' : 0 }}>
        <SignInPrompt
          text={promptText}
          testid="scan-signin-prompt"
          onSignIn={() => gate.signIn(SCAN_COPY.signInToCustomize)}
        />
      </Box>
    </Box>
  );
}
