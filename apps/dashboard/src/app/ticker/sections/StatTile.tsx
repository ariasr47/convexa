/**
 * StatTile — the shared "upgraded tile" atom for the Ticker re-skin (FRONTEND_EXECUTION_CONTRACT
 * §"Components to create"). It is the visual home of every stat figure on the Ticker page and drives
 * both tile grids (LiveTape live-derived + DealerPositioning static).
 *
 * Design (matched to the Figma Ticker tile, token-bound — NO hardcoded hex):
 *   - rounded card (r12 ≈ theme radius), `background.paper` surface, subtle `divider` border;
 *   - an optional **colored LEFT-accent bar** (success / error / none) **clipped to the radius**
 *     (overflow:hidden on the card + an absolutely-positioned bar, so the color never bleeds the
 *     rounded corner — the previous `borderLeft` could not be radius-clipped);
 *   - a label row: the label + an ⓘ info affordance (whole-tile hover Tooltip carries the copy);
 *   - a **mono** value (Roboto Mono via the theme font stack), optionally colored.
 *
 * Behavioral contract carried over byte-for-byte from the previous inline `Stat` (so every existing
 * ticker spec stays green):
 *   - `offline` (live-derived tiles only) → dim to 50% + an `⏸ offline` caption, so a kept last value
 *     is never read as current (`[live-vs-static-isolation]`). Static tiles never receive `offline`.
 *   - `accent` 'up'|'down'|'neutral' picks the success/error/divider accent; `accentColor` overrides
 *     the bar color (non-directional tier emphasis, e.g. the Opportunity tile).
 *   - `info` present → a whole-tile Tooltip (the ⓘ just signals one exists), unchanged.
 */
import { styled } from '@mui/material/styles';
import { Card, CardContent, Stack, Typography, Tooltip, Skeleton } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { typographyTokens } from '../../tokens';
import { flashColorSx, type FlashState } from './useFlashOnChange';

/** The mono numeric stack (Figma `font-family/mono`), single-sourced from tokens — figures are mono. */
const MONO = typographyTokens.monoFontFamily;

export type StatAccent = 'up' | 'down' | 'neutral';

// The card chrome: paper surface, divider border, radius-clipped so the absolute accent bar follows
// the rounded corner. `accent`/`accentColor` resolve the left-accent bar color from the theme palette.
const TileCard = styled(Card, {
  shouldForwardProp: (p) => p !== 'accent' && p !== 'accentColor' && p !== 'offline',
})<{ accent?: StatAccent; accentColor?: string; offline?: boolean }>(
  ({ theme, accent, accentColor, offline }) => ({
    position: 'relative',
    height: '100%',
    overflow: 'hidden', // clip the accent bar to the card radius
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    // Premium "raised chip": a top-lit gradient + resting elevation + inner top highlight, so each tile
    // reads as a physical chip catching light — restoring contrast when tiles sit on a widget's recessed
    // ('inset') well. Neutral white/black light+shadow overlays (theme-agnostic, not brand tints).
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 46%)',
    borderColor: theme.palette.divider,
    boxShadow: '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
    ...(offline ? { opacity: 0.5 } : {}),
    // Micro-interaction: subtle hover lift + a smooth opacity transition into/out of the offline dim
    // (never a hard snap). GPU-cheap (transform/opacity/box-shadow/border only). Honors reduced motion.
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, opacity 200ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
      borderColor: theme.palette.text.disabled,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'opacity 200ms ease',
      '&:hover': { transform: 'none' },
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor:
        accentColor != null
          ? accentColor
          : accent === 'up'
          ? theme.palette.success.main
          : accent === 'down'
          ? theme.palette.error.main
          : theme.palette.divider,
    },
  }),
);

export interface StatTileProps {
  label: string;
  value: string;
  accent?: StatAccent;
  /** Optional info copy → whole-tile hover Tooltip + the ⓘ affordance. */
  info?: string;
  /** Live-derived tiles only: dim + `⏸ offline` caption on an SSE drop. */
  offline?: boolean;
  /** Override the accent-bar color (non-directional tier emphasis). */
  accentColor?: string;
  /** Optional color for the value figure (e.g. directional P/L); defaults to text.primary. */
  valueColor?: string;
  /** Live value-flash pulse (from `useFlashOnChange`) applied to the figure. Null → no flash. */
  flash?: FlashState | null;
}

export function StatTile({ label, value, accent, info, offline, accentColor, valueColor, flash }: StatTileProps) {
  const tile = (
    <TileCard accent={accent} accentColor={accentColor} offline={offline} variant="outlined">
      <CardContent sx={{ pl: 2.25 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
          {info && <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />}
        </Stack>
        {offline && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', lineHeight: 1 }}>
            ⏸ offline
          </Typography>
        )}
        <Typography
          variant="h6"
          sx={[{ fontFamily: MONO, ...(valueColor ? { color: valueColor } : {}) }, flashColorSx(flash ?? null)]}
        >
          {value}
        </Typography>
      </CardContent>
    </TileCard>
  );
  // Whole-tile hover tooltip (the ⓘ just signals one exists). Only when `info` is given.
  return info ? <Tooltip title={info} arrow placement="top">{tile}</Tooltip> : tile;
}

/**
 * StatSkeleton — the COLD-LOAD placeholder shaped like a StatTile (AC-Skel-1). It is the LOADING look
 * (animated shimmer), visually distinct from EMPTY (resolved-null muted text) and OFFLINE (real value
 * dimmed + ⏸). `data-testid="cold-skeleton"` marks the LOADING class for the LOADING≠EMPTY≠OFFLINE
 * tests. It must NEVER appear post-load.
 */
export function StatSkeleton() {
  return (
    <TileCard accent="neutral" variant="outlined" data-testid="cold-skeleton">
      <CardContent sx={{ pl: 2.25 }}>
        <Skeleton variant="text" width="60%" sx={{ fontSize: '0.75rem' }} />
        <Skeleton variant="text" width="45%" sx={{ fontSize: '1.25rem' }} />
      </CardContent>
    </TileCard>
  );
}

export default StatTile;
