/**
 * ConvexityMotif — the shared hero convexity-curve SVG (ARCHITECTURE §2.2 + §6 Q4 resolution,
 * FRONTEND_EXECUTION_CONTRACT F2). Single-sourced so BOTH Landing and the new `/auth` page import one
 * component (the conductor resolved Q4: a shared `ui/` component, not duplicated inline).
 *
 * Decorative ONLY — no data, no fetch. The two bezier paths are the established motif
 * (`M0 380 C 300 360, 600 240, 1200 30` + the lighter `M0 400 C 360 390, 700 300, 1200 90`) at ~0.16
 * opacity in `primary.main`, plus a soft radial primary glow behind them.
 */
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface ConvexityMotifProps {
  /** Override / extend the wrapper styling (e.g. position, inset, sizing). */
  sx?: SxProps<Theme>;
}

export function ConvexityMotif({ sx }: ConvexityMotifProps) {
  return (
    <Box
      data-testid="convexity-motif"
      aria-hidden
      sx={[
        { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Soft radial primary glow behind the curves. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 50% at 80% 10%, rgba(79, 156, 255, 0.18) 0%, rgba(79, 156, 255, 0) 70%)',
        }}
      />
      <Box
        component="svg"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        data-testid="convexity-motif-svg"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.16,
          color: 'primary.main',
        }}
      >
        <path
          d="M0 380 C 300 360, 600 240, 1200 30"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        />
        <path
          d="M0 400 C 360 390, 700 300, 1200 90"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          opacity={0.6}
        />
      </Box>
    </Box>
  );
}

export default ConvexityMotif;
