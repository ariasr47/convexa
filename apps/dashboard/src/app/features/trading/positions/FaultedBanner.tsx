/**
 * THE FAULTED-STORE BANNER and the REFUSED-CONTROL treatment (SPEC §2.9, §4; AC-61..AC-69).
 *
 * Owner ruling #8 is STRICT: while the durable store is faulted, every durable write is refused. The
 * state is scoped to the STORE, not the route — the Ticker page opens the same shared dialog against
 * the same store, so the banner and the refusal follow the store wherever it can be written.
 *
 * ─ THE HTML `disabled` ATTRIBUTE IS BANNED ON A REFUSED CONTROL. ─
 * A `disabled` MUI button drops out of the tab order AND swallows pointer events, so its tooltip
 * never opens and the REASON for the refusal becomes unreachable by both keyboard and hover. That is
 * precisely the failure this state exists to prevent: a trader who cannot find out why nothing is
 * saving will keep trading into a store that is dropping everything. So a refused control is
 * `aria-disabled="true"`, STILL FOCUSABLE, described by the banner, and a no-op on activation.
 *
 * There is NO in-app repair, reset or "clear and start over" — that is a delete path, and this
 * feature adds none. The only in-app step offered is `Reload the page`.
 */
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { cloneElement, type MouseEvent, type ReactElement } from 'react';
import {
  FAULTED_BANNER_ACTION_EXPORT,
  FAULTED_BANNER_ACTION_RELOAD,
  FAULTED_BANNER_BODY,
  FAULTED_BANNER_CLOSING,
  FAULTED_BANNER_HEADING,
  TICKER_FAULTED_NOTICE,
  WRITE_REFUSED_TIP,
} from './labels';

/** Every refused control points its `aria-describedby` here. One id, one explanation. */
export const FAULTED_BANNER_ID = 'store-faulted-banner';

/** The Archive block the export pointer moves focus to. It does NOT duplicate the export button. */
const ARCHIVE_TESTID = 'tr-archive';

/**
 * THE VISUAL HALF OF A REFUSAL (SPEC §4, "RULED 2026-07-28"; AC-63, AC-69).
 *
 * The aria half alone shipped once and was wrong: the CTA rendered as a fully bright amber button
 * with the fault banner sitting right above it, so it looked live and then refused — which is
 * *"accepts input and fails after the fact"*, the very failure §2.9 exists to prevent, arriving one
 * layer up. A refusal has to be **visible before it is read**.
 *
 * The theme's OWN disabled ink/fill/border, so this is one treatment in two colour schemes and adds
 * no token (`theme-token-discipline`): no hex, no opacity hack. `boxShadow: none` because a raised
 * control reads as live even when its ink is quiet, and the hover block repeats the resting values
 * so hover shifts neither colour nor elevation.
 *
 * ─ WHAT THIS DELIBERATELY DOES NOT DO, and must never start doing. ─
 * No `disabled`, no `pointerEvents: 'none'`, no `tabIndex: -1`. Each of those would swallow the
 * pointer or drop the tab stop, putting the tooltip that explains the refusal out of reach — the
 * exact defect the HTML `disabled` attribute was banned for. This is IN ADDITION TO the aria half,
 * never INSTEAD OF it. `cursor: not-allowed` is the one pointer cue that costs nothing: it changes
 * the cursor without stopping the hover that opens the tooltip.
 *
 * Scope: refused CONTROLS only. Faulted dims no DATA — no figure, no live block, no `⏸` (AC-65).
 */
const refusedSx = {
  color: 'action.disabled',
  bgcolor: 'action.disabledBackground',
  borderColor: 'action.disabledBackground',
  boxShadow: 'none',
  cursor: 'not-allowed',
  '&:hover': {
    color: 'action.disabled',
    bgcolor: 'action.disabledBackground',
    borderColor: 'action.disabledBackground',
    boxShadow: 'none',
  },
} as const;

/**
 * Wrap ANY control to refuse it while the store is faulted.
 *
 * `when === false` returns the child untouched, so a healthy surface is byte-identical to shipped
 * and this component costs nothing. When refused, the child keeps its tab stop, gains
 * `aria-disabled`, is described by the banner, shows `WRITE_REFUSED_TIP` on hover AND on focus (MUI
 * `Tooltip` gives both, which a `disabled` child would silently lose), does nothing at all when
 * clicked or activated from the keyboard, and — the half that is visible from across the room —
 * takes the reduced-emphasis treatment above.
 *
 * The treatment is applied HERE, once, rather than at each of the consumer sites: every refused
 * control in the app already routes through this primitive, so one implementation is also the
 * only place it can be forgotten. The child must therefore be an `sx`-taking MUI element
 * (`Box`/`Button`/`IconButton`/`MenuItem`) — all five call sites are, and the site's own `sx` is
 * MERGED with, never replaced by, this one.
 */
export function Refused({ when, children }: { when: boolean; children: ReactElement }) {
  if (!when) return children;
  const swallow = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const ownSx = (children.props as { sx?: SxProps<Theme> }).sx;
  const blocked = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-disabled': true,
    'aria-describedby': FAULTED_BANNER_ID,
    'data-refused': 'true',
    // NEVER `disabled` — see the module header. Activation is a no-op instead.
    onClick: (e: MouseEvent) => swallow(e),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') swallow(e);
    },
    // Array form: MUI merges left-to-right, so the site keeps its own geometry and only the
    // emphasis is overridden.
    sx: [...(Array.isArray(ownSx) ? ownSx : [ownSx]), refusedSx].filter(Boolean),
  });
  return (
    <Tooltip arrow title={WRITE_REFUSED_TIP}>
      {blocked}
    </Tooltip>
  );
}

const linkSx = {
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: '0.78rem',
  // Link-class text binds `info` (links are signal-blue, never amber).
  color: 'info.main',
  p: 0,
  textAlign: 'left' as const,
  // At 393px the row wraps; `nowrap` makes it break BETWEEN the two actions rather than mid-phrase
  // ("Export an archive of what / loaded"), which reads as a broken sentence rather than a link.
  whiteSpace: 'nowrap' as const,
} as const;

/**
 * `role="status"` — a STANDING CONDITION, not an interruption. It is non-dismissible: a dismissal
 * could not be persisted by a store that refuses writes, so the banner would return forever anyway,
 * and the state it describes is still true.
 *
 * The copy is four blocks, verbatim from SPEC §4: what happened · what was protected and what is
 * refused · what you can do · what to expect. No apology, no "oops", no "something went wrong", no
 * error code.
 */
export function FaultedBanner({ onReload }: { onReload?: () => void }) {
  const reload = onReload ?? (() => window.location.reload());
  return (
    <Box
      id={FAULTED_BANNER_ID}
      role="status"
      data-testid="faulted-banner"
      sx={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        border: '1px solid',
        borderColor: 'warning.main',
        borderRadius: '8px',
        p: '10px 12px',
        m: '0 0 12px',
      }}
    >
      {/* Hue alone never carries "warning" — the icon does half the work. Decorative: the heading
          beside it already says what this is, so a screen reader must not hear it twice. */}
      <WarningAmberIcon fontSize="small" aria-hidden sx={{ color: 'warning.main', mt: '1px' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'warning.main', m: 0 }}
        >
          {FAULTED_BANNER_HEADING}
        </Typography>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.primary', m: '4px 0 0', lineHeight: 1.5 }}
        >
          {FAULTED_BANNER_BODY}
        </Typography>
        <Box
          sx={{ display: 'flex', gap: '10px', alignItems: 'baseline', mt: '6px', flexWrap: 'wrap' }}
        >
          <Box
            component="button"
            type="button"
            data-testid="faulted-export-pointer"
            onClick={() => {
              // MOVES FOCUS to the existing Archive block. It does not duplicate the export button
              // and it does not rename the shipped `Export archive` action.
              const target = document.querySelector<HTMLElement>(
                `[data-testid="${ARCHIVE_TESTID}"]`,
              );
              if (!target) return;
              if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
              target.focus();
              // Optional-called: jsdom does not implement `scrollIntoView`, and an uncaught
              // TypeError inside a click handler turns the whole suite red on a purely cosmetic
              // scroll. Focus is the part that matters and it has already happened.
              target.scrollIntoView?.({ block: 'start' });
            }}
            sx={linkSx}
          >
            {FAULTED_BANNER_ACTION_EXPORT}
          </Box>
          {/* Hidden once the row wraps — a separator with nothing after it reads as a typo. */}
          <Typography
            component="span"
            aria-hidden
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              display: { xs: 'none', sm: 'inline' },
            }}
          >
            ·
          </Typography>
          {/* The ONLY in-app step that can clear a transient read failure. A "Repair" or "Reset"
              button would be dishonest: the store never repairs and never deletes. */}
          <Box
            component="button"
            type="button"
            data-testid="faulted-reload"
            onClick={reload}
            sx={linkSx}
          >
            {FAULTED_BANNER_ACTION_RELOAD}
          </Box>
        </Box>
        <Typography
          component="p"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', m: '6px 0 0', lineHeight: 1.5 }}
        >
          {FAULTED_BANNER_CLOSING}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * THE TICKER-PAGE DOOR. The faulted state is not scoped to `/positions`: that page opens the same
 * shared dialog against the same store, so it carries its own one-line notice above the refused CTA.
 * It shares `FAULTED_BANNER_ID` so the refused control there is described by the notice the trader
 * can actually see — only one of these two ever renders on a given page.
 */
export function TickerFaultedNotice() {
  return (
    <Typography
      component="p"
      id={FAULTED_BANNER_ID}
      role="status"
      data-testid="ticker-faulted-notice"
      sx={{
        fontSize: '0.78rem',
        color: 'warning.main',
        m: '0 0 8px',
        lineHeight: 1.5,
        textAlign: { xs: 'left', sm: 'right' },
      }}
    >
      ⚠ {TICKER_FAULTED_NOTICE}
    </Typography>
  );
}
