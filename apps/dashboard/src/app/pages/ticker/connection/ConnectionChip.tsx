/**
 * `ConnectionChip` — the renderer OVER the resolver's output type (SPEC §2.4). Exported alongside
 * `connectionState.ts`'s resolver; the CONTENT (tone/text/dot/pulse/warnIcon) is computed by the
 * pure `resolveChipContent` (`connection/copy.ts`) so it is independently testable without
 * mounting React — this component is the visual chrome only.
 *
 * `state === null` renders the wordless cold-skeleton PLACEHOLDER (ruling 1) — no text, no tone, no
 * dot, no connection vocabulary. Once a caller has a non-null `state` it must never go back to
 * passing `null` for the same mounted session (`useConnectionState`'s monotonic guarantee is what
 * makes this safe — AC-7b).
 *
 * `liveDotPulse` — MOVED here from `TickerHeader.tsx`'s local `TintChip` (this file is now its
 * SOLE declaration site; `single-motion-moment.spec.ts`'s `KEPT_KEYFRAMES` is re-pointed in the
 * same change). Only the `live` kind's dot ever plays it, gated on `!reduced` (AC-12).
 *
 * Neither this component nor `LivenessAnnouncer` carries `role="status"` on the chip itself — the
 * page-scoped `LivenessAnnouncer` owns the ONE `aria-live` region (SPEC §2.4).
 */
import { extrasFor } from '@/shared/theme/tokens';
import type { LiveUpdate } from '@convexa/api';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import type { ConnectionState } from './connectionState';
import { resolveChipContent } from './copy';

export interface ConnectionChipProps {
  /** `null` = no stream fact has arrived yet (ruling 1) — renders the wordless placeholder. */
  state: ConnectionState | null;
  live: LiveUpdate | null;
  routeSymbol: string;
  reduced: boolean;
}

export function ConnectionChip({ state, live, routeSymbol, reduced }: ConnectionChipProps) {
  if (state == null) {
    // The wordless cold-skeleton placeholder (ruling 1) — present in the slot, no text, no tone,
    // no dot, no connection vocabulary. A DISTINCT testid from FigureCell's `cold-skeleton` (that
    // testid is reserved for figure cells; sharing it would make `getByTestId` ambiguous on a page
    // that also renders FigureCell skeletons during the same cold-load window).
    return (
      <Skeleton
        variant="rounded"
        data-testid="connection-chip-placeholder"
        width={96}
        height={20}
        sx={{ borderRadius: '999px', display: 'inline-block' }}
      />
    );
  }

  const content = resolveChipContent(state, live, routeSymbol, reduced);
  const chip = (
    <Box
      component="span"
      data-testid="connection-chip"
      data-connection-state={state.kind}
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: content.dot || content.warnIcon ? 0.5 : 0,
        px: 1,
        py: '3px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        // PR #46 CI repair, §A — `info.main` (signal, deliberately the QUIETEST hue by design) measured
        // 4.43:1 as small TEXT on its own `alpha(info.main, 0.16)` tint here (the "live" state), under
        // WCAG AA 4.5:1 — `success`/`error`/`warning` all clear the SAME formula with real headroom
        // (4.7–7.0:1, computed), so this is `info` alone, not the pattern. `textInfo` is the
        // text-grade companion (the canon's two-amber-grades precedent, `extrasFor(theme).textAmber`,
        // applied to the info hue): the dot below keeps the FULL fill-grade `info.main` explicitly
        // (no longer `currentColor` — decoupled so the text can go text-grade without also fading the
        // dot, `[fill-vs-text-grade]`).
        color:
          content.tone === 'neutral'
            ? t.palette.text.secondary
            : content.tone === 'info'
              ? extrasFor(t).textInfo
              : t.palette[content.tone].main,
        bgcolor:
          content.tone === 'neutral'
            ? alpha(t.palette.text.secondary, 0.14)
            : alpha(t.palette[content.tone].main, 0.16),
      })}
    >
      {content.warnIcon && (
        <WarningAmberIcon aria-hidden sx={{ fontSize: 12, color: 'warning.main' }} />
      )}
      {content.dot === '●' && (
        <Box
          component="span"
          aria-hidden
          data-testid="connection-chip-dot"
          sx={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            // PR #46 CI repair, §A — explicit `info.main`, not `currentColor`: the container's
            // `color` is now text-grade (`textInfo`) for contrast, but this dot is the ≥3:1 UI-class
            // fill mark and should stay the FULL brand `info.main` (this filled dot only ever
            // renders for `tone: 'info'` — `copy.ts`'s `resolveChipContent`/`TONE_BY_KIND` — so this
            // is a pixel-identical decoupling, not a new colour).
            bgcolor: 'info.main',
            ...(content.pulse
              ? {
                  animation: 'liveDotPulse 1.6s ease-in-out infinite',
                  '@keyframes liveDotPulse': {
                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.45, transform: 'scale(1.3)' },
                  },
                }
              : {}),
          }}
        />
      )}
      {content.dot === '○' && (
        <Box
          component="span"
          aria-hidden
          data-testid="connection-chip-dot"
          sx={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1.5px solid currentColor',
          }}
        />
      )}
      {content.text}
    </Box>
  );
  return content.tip ? (
    <Tooltip arrow title={content.tip}>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

export default ConnectionChip;
