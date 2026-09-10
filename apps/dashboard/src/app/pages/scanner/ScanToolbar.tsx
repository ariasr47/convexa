/**
 * `/scanner` — the view controls row: which view is showing, the density control, the editor
 * affordance, the in-context sign-in prompt, plus the desk strip (session badge · structure as-of)
 * and client-side triage filters.
 *
 * Honesty rules enforced here (UX §3.3): the label for the owner-curated default view says
 * "Default view" — it NEVER says "saved", "your", or anything implying persistence for a visitor who
 * has none. The anonymous prompt is standing, not a surprise on click, and it is the SAME prompt a
 * refused write re-raises. Nothing here writes: `onEditView`/`onDensity`/`onFilters` are pure UI
 * callbacks. Session is clock-derived, not a stream claim.
 */
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import type { GateApi } from '@/features/auth/useGate';
import { extrasFor } from '@/shared/theme/tokens';
import type { ScanDensity, ScanView } from '@convexa/api';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { EMPTY_FILTERS, filtersActive, type ScanFilters } from './format';
import {
  FLIP_FILTER_OPTIONS,
  SCAN_COPY,
  SCORE_FILTER_OPTIONS,
  TIER_FILTER_OPTIONS,
  VOL_FILTER_OPTIONS,
} from './labels';

export interface ScanToolbarProps {
  view: ScanView | null;
  density: ScanDensity;
  onDensity: (density: ScanDensity) => void;
  onEditView: () => void;
  gate: GateApi;
  filters: ScanFilters;
  onFilters: (filters: ScanFilters) => void;
  /** Post-filter row count. */
  filteredCount: number;
  /** Pre-filter row count of the current view. */
  totalCount: number;
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
  flexWrap: 'wrap' as const,
});
const segItemSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: active ? 'divider' : 'transparent',
  background: active ? extrasFor(theme).panelRaised : 'transparent',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: '7px',
  color: active ? 'text.primary' : 'text.secondary',
  whiteSpace: 'nowrap',
  // Spine #6: ≥40 desktop comfort; theme coarse floor raises to 44 on touch.
  minHeight: 40,
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
  minHeight: 44,
};

const chipSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: active ? 'primary.main' : 'divider',
  background: active ? extrasFor(theme).panelRaised : 'transparent',
  font: 'inherit',
  fontSize: '0.72rem', // ≥11px type floor (0.72rem ≈ 11.5)
  fontWeight: 600,
  padding: '7px 12px',
  borderRadius: '999px',
  color: active ? 'text.primary' : 'text.secondary',
  whiteSpace: 'nowrap',
  // Spine #6: comfortable keyboard target; theme coarse media lifts to 44.
  minHeight: 40,
});

/** "Default view" for the owner-curated fallback; the account view's own name (or a neutral
 *  "Your view") once one exists. Never a persistence claim for an anonymous visitor. */
function viewLabel(view: ScanView | null): string {
  if (view?.source !== 'account') return 'Default view';
  return view.name?.trim() ? view.name : 'Your view';
}

function toggleScalar<T>(current: T | null, next: T): T | null {
  return current === next ? null : next;
}

export function ScanToolbar({
  view,
  density,
  onDensity,
  onEditView,
  gate,
  filters,
  onFilters,
  filteredCount,
  totalCount,
}: ScanToolbarProps) {
  // Standing prompt while signed out (UX §3.3); a refused write replaces it with the gate's own text.
  const promptText = gate.promptText ?? (gate.allowed ? null : SCAN_COPY.signInToCustomize);
  const active = filtersActive(filters);

  return (
    <Box data-testid="scan-toolbar" sx={{ mb: '12px' }}>
      {/* The desk strip (session + structure as-of) moved up into the page header (Scanner.tsx,
          design/src/screens/scanner.mjs:65-72's right cluster) — this row now opens directly on
          the view label + controls (design :73-81, `.scan-tools`): view label + count + Edit
          view, the seven preset chips and Showing X of N · clear all on ONE wrapping row, the
          density toggle trailing it. */}
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
        <Typography
          component="span"
          data-testid="scan-view-count"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
        >
          {totalCount} name{totalCount === 1 ? '' : 's'}
        </Typography>

        <Box
          component="button"
          type="button"
          data-testid="scan-edit-view"
          onClick={onEditView}
          sx={editButtonSx}
        >
          {SCAN_COPY.editView}
        </Box>

        <Box sx={{ width: '1px', height: '20px', bgcolor: 'divider' }} />

        {/* Desk filters — client-side only; chips toggle (second click clears that dimension). */}
        <Box
          role="group"
          aria-label={SCAN_COPY.filterAria}
          data-testid="scan-filters"
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          {TIER_FILTER_OPTIONS.map((opt) => (
            <Box
              key={opt.value}
              component="button"
              type="button"
              data-testid={`scan-filter-tier-${opt.value}`}
              aria-pressed={filters.tier === opt.value}
              onClick={() => onFilters({ ...filters, tier: toggleScalar(filters.tier, opt.value) })}
              sx={chipSx(filters.tier === opt.value)}
            >
              {opt.label}
            </Box>
          ))}
          {VOL_FILTER_OPTIONS.map((opt) => (
            <Box
              key={opt.value}
              component="button"
              type="button"
              data-testid={`scan-filter-vol-${opt.value}`}
              aria-pressed={filters.volRegime === opt.value}
              onClick={() =>
                onFilters({
                  ...filters,
                  volRegime: toggleScalar(filters.volRegime, opt.value),
                })
              }
              sx={chipSx(filters.volRegime === opt.value)}
            >
              {opt.label}
            </Box>
          ))}
          {SCORE_FILTER_OPTIONS.map((opt) => (
            <Box
              key={opt.value}
              component="button"
              type="button"
              data-testid={`scan-filter-score-${opt.value}`}
              aria-pressed={filters.minScore === opt.value}
              onClick={() =>
                onFilters({
                  ...filters,
                  minScore: toggleScalar(filters.minScore, opt.value),
                })
              }
              sx={chipSx(filters.minScore === opt.value)}
            >
              {opt.label}
            </Box>
          ))}
          {FLIP_FILTER_OPTIONS.map((opt) => (
            <Box
              key={opt.value}
              component="button"
              type="button"
              data-testid={`scan-filter-flip-${opt.value}`}
              aria-pressed={filters.maxAbsDistFlip === opt.value}
              onClick={() =>
                onFilters({
                  ...filters,
                  maxAbsDistFlip: toggleScalar(filters.maxAbsDistFlip, opt.value),
                })
              }
              sx={chipSx(filters.maxAbsDistFlip === opt.value)}
            >
              {opt.label}
            </Box>
          ))}
          {active && (
            <>
              <Typography
                component="span"
                data-testid="scan-filter-count"
                sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: '4px' }}
              >
                {SCAN_COPY.filterShowing(filteredCount, totalCount)}
              </Typography>
              <Box
                component="button"
                type="button"
                data-testid="scan-filter-clear"
                onClick={() => onFilters(EMPTY_FILTERS)}
                sx={(theme) => ({
                  ...chipSx(false)(theme),
                  textDecoration: 'underline',
                  borderColor: 'transparent',
                })}
              >
                {SCAN_COPY.clearFilters}
              </Box>
            </>
          )}
        </Box>

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
