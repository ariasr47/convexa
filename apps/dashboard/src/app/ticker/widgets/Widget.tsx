/**
 * Widget — the shared Ticker widget shell (the whole widget-identity foundation, and the exact seam
 * future editing hangs off). Wraps each data section in a uniform frame + header so the page reads as
 * a modular bento board, even though real widget functionality (drag-reorder, resize, add/remove,
 * per-widget config, persistence) is FUTURE work.
 *
 * Honesty (`no-real-order-path` lesson): the drag grip, the `⋮` menu, and resize are AFFORDANCE-ONLY
 * — disabled + "coming soon" tooltips, never fake-functional. The expand `⤢` IS functional (it is
 * presentation-only: it opens the same body in a larger focus overlay).
 *
 * Cutting-edge techniques, all feature-detected + reduced-motion-guarded + GPU-cheap + token-only
 * (color-mix off `--mui-palette-*`, zero hardcoded hex):
 *   - `container-type: inline-size` — the body styles by its own width (`@container`), so a widget
 *     looks right at any bento cell size (the seam for future resize).
 *   - `content-visibility: auto` + `contain-intrinsic-size` — off-screen render skipping.
 *   - `:has()` / `:focus-within` / `:hover` — parent-aware chrome reveals the toolbar + grip, no JS.
 *   - `@property --angle` + conic-gradient — an animated gradient border on the selected/live widget.
 *   - A one-time staggered mount reveal (`widgetRise`) — each widget fades + rises in with a small
 *     per-position delay fed by the board via `--widget-reveal-delay`; reduced-motion → instant.
 *   - View Transitions API (in `useExpand`) — the expand → focus overlay is a shared-element morph,
 *     with a graceful MUI `Fade`/`Dialog` fallback when unsupported.
 */
import {
  useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode,
} from 'react';
import {
  Box, Stack, Typography, Tooltip, IconButton, Fade, Dialog, Menu, MenuItem,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { SxProps, Theme } from '@mui/material/styles';
import { useReducedMotion } from './useReducedMotion';
import { useWidgetSelection } from './WidgetSelectionContext';

// A tactile spring-ish easing for the lift + toolbar (GPU-cheap; transform/opacity only).
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export interface WidgetProps {
  id: string;
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  info?: string;
  /** Live accent pulses ONLY when this is true (`isLive && !streamOffline`); frozen otherwise. */
  live?: boolean;
  /** The section's own always-visible controls (legend, "View what's sent", persona select, …). */
  actions?: ReactNode;
  children: ReactNode;
  /** Bento column span. */
  span?: 1 | 2;
  bodySx?: SxProps<Theme>;
  noBodyPad?: boolean;
  /** 'flush' (default) — content sits directly on the widget surface (charts/cards). 'inset' — the body
   *  is a recessed darker "well" so a grid of raised paper StatTiles regains contrast (Live tape / Dealer
   *  positioning, which are groups of same-surface tiles). */
  bodyVariant?: 'flush' | 'inset';
  /** Board position (0-based) — offsets the one-time mount reveal so the sections cascade in
   *  (~55ms/step, capped). Omitted ⇒ 0 (no delay), e.g. a standalone/expanded widget. */
  revealIndex?: number;
}

/**
 * useExpand — the functional expand/peek. Prefers the View Transitions API for a shared-element
 * morph into a larger focus overlay; feature-detects and falls back to a plain state toggle that a
 * MUI `Fade`/`Dialog` animates. Reduced-motion → instant, no transition.
 */
function useExpand(reduced: boolean) {
  const [open, setOpen] = useState(false);
  const supportsVT =
    typeof document !== 'undefined' &&
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

  const toggle = useCallback((next: boolean) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!reduced && supportsVT && typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => setOpen(next));
    } else {
      setOpen(next);
    }
  }, [reduced, supportsVT]);

  return { open, expand: () => toggle(true), collapse: () => toggle(false), supportsVT };
}

export function Widget({
  id, title, icon, subtitle, info, live = false, actions, children, span = 1, bodySx, noBodyPad,
  bodyVariant = 'flush', revealIndex = 0,
}: WidgetProps) {
  const reduced = useReducedMotion();
  // Body-wrapper chrome. 'inset' recesses the well (darker + inner shadow) so raised paper tiles pop.
  const bodyWrapperSx: SxProps<Theme> = (theme) => ({
    borderTop: '1px solid',
    borderColor: 'divider',
    flex: 1,
    // Flex column so a body that opts into `flex: 1` (via `bodySx`) fills the widget height — this is
    // what lets recharts `ResponsiveContainer height="100%"` resolve (e.g. the Term-structure line chart,
    // which fills its equal-height row). Content-sized bodies (tile grids, fixed-height charts) are
    // unaffected (a non-growing child just sizes to content).
    display: 'flex',
    flexDirection: 'column',
    ...(bodyVariant === 'inset'
      ? {
          backgroundColor: theme.palette.background.default,
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'inset 0 2px 10px -5px rgba(0,0,0,0.55)'
              : 'inset 0 2px 8px -6px rgba(16,24,40,0.25)',
        }
      : {}),
  });
  const { selectedId, select, clear } = useWidgetSelection();
  const selected = selectedId === id;
  const { open: expanded, expand, collapse, supportsVT } = useExpand(reduced);
  const headerId = useId();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const vtNameRef = useRef(`widget-vt-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`);

  // The header + body, reused by the inline card and the expanded overlay (so the peek shows the
  // full widget). `expanded` hides the toolbar's expand button and swaps in a close affordance.
  const body = (
    <Box
      sx={[
        !noBodyPad && { p: 2, pt: 1.5 },
        // Container-query context for the body: each widget styles its internals by its OWN width.
        { containerType: 'inline-size' },
        ...(Array.isArray(bodySx) ? bodySx : [bodySx]),
      ]}
    >
      {children}
    </Box>
  );

  const header = (inOverlay: boolean) => (
    <Box
      className="widget__header"
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1,
        px: 2, pt: 1.5, pb: 1,
      }}
    >
      {/* Drag grip — AFFORDANCE ONLY (coming soon). Hover-revealed, cursor:grab, but inert. */}
      {!inOverlay && (
        <Tooltip arrow title="Rearrange (coming soon)">
          <Box
            component="span"
            aria-label="Rearrange (coming soon)"
            className="widget__grip"
            sx={{
              display: 'inline-flex', alignItems: 'center', mt: 0.25, cursor: 'grab',
              color: 'text.disabled', opacity: 0, transition: `opacity 160ms ease`,
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
      )}

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {icon && <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>{icon}</Box>}
          <Typography variant="h6" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
          {info && (
            <Tooltip arrow title={info}>
              <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
            </Tooltip>
          )}
        </Stack>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{subtitle}</Typography>
        )}
      </Box>

      {/* Right region: the section's own always-visible actions + the hover toolbar. */}
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>{actions}</Box>}

        <Stack
          direction="row" spacing={0.25}
          className="widget__toolbar"
          onClick={(e) => e.stopPropagation()}
          sx={{
            alignItems: 'center',
            // Hover/focus-revealed via :has() on the frame (see frame sx). In the overlay it's always shown.
            opacity: inOverlay ? 1 : 0,
            transform: inOverlay ? 'none' : 'translateX(4px)',
            transition: `opacity 180ms ease, transform 220ms ${SPRING}`,
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          {inOverlay ? (
            <Tooltip arrow title="Close">
              <IconButton size="small" aria-label="Close expanded widget" onClick={collapse}>
                <OpenInFullIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip arrow title="Expand">
              <IconButton size="small" aria-label="Expand widget" onClick={expand}>
                <OpenInFullIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {!inOverlay && (
            <Tooltip arrow title="Configure — coming soon">
              {/* span so the tooltip works on the disabled button */}
              <span>
                <IconButton
                  size="small" aria-label="Configure — coming soon" disabled
                  aria-haspopup="menu"
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                >
                  <MoreVertIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      {/* The menu is never reachable (button disabled) — present only so the affordance reads honestly. */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem disabled>Configure — coming soon</MenuItem>
      </Menu>
    </Box>
  );

  const onSelect = useCallback(() => { if (!selected) select(id); }, [selected, select, id]);

  return (
    <>
      <Box
        data-testid={`widget-${id}`}
        data-widget-id={id}
        role="group"
        aria-labelledby={headerId}
        aria-current={selected ? 'true' : undefined}
        tabIndex={0}
        onClick={onSelect}
        onFocus={onSelect}
        style={{ ['--widget-reveal-delay']: `${Math.min(Math.max(revealIndex, 0), 8) * 55}ms` } as CSSProperties}
        sx={(theme) => ({
          gridColumn: span === 2 ? { xs: '1 / -1', md: 'span 2' } : undefined,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          overflow: 'clip',
          outline: 'none',
          // Off-screen perf: skip rendering work for widgets not near the viewport.
          contentVisibility: 'auto',
          containIntrinsicSize: '480px 320px',
          // Hover lift (GPU-cheap: transform + shadow + border tint from tokens via color-mix).
          transition: `transform 220ms ${SPRING}, box-shadow 220ms ease, border-color 220ms ease`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 6,
            borderColor: `color-mix(in srgb, var(--mui-palette-primary-main) 40%, ${theme.palette.divider})`,
          },
          // :has() parent-aware chrome — reveal the grip + toolbar on hover / keyboard focus, no JS.
          '&:hover .widget__grip, &:has(:focus-visible) .widget__grip': { opacity: 0.5 },
          '& .widget__grip:hover': { opacity: 1, color: 'text.secondary' },
          '&:hover .widget__toolbar, &:has(:focus-visible) .widget__toolbar': {
            opacity: 1, transform: 'none',
          },
          // Selected ring — an animated conic-gradient border (single-widget, tasteful).
          ...(selected && {
            '&::after': {
              content: '""', position: 'absolute', inset: 0, borderRadius: '12px', padding: '1.5px',
              // The gradient sweeps from primary through the live accent.
              background: 'conic-gradient(from var(--angle, 0deg), var(--mui-palette-primary-main), var(--mui-palette-info-main), var(--mui-palette-primary-main))',
              // Mask so only the 1.5px border shows (the fill is knocked out). The mask color is
              // arbitrary/opaque (only its alpha matters) — not a theme tint, so no token needed.
              WebkitMask: 'linear-gradient(rgb(0 0 0) 0 0) content-box, linear-gradient(rgb(0 0 0) 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(rgb(0 0 0) 0 0) content-box, linear-gradient(rgb(0 0 0) 0 0)',
              maskComposite: 'exclude',
              pointerEvents: 'none',
              '@media (prefers-reduced-motion: no-preference)': {
                animation: 'widgetAngleSpin 4s linear infinite',
              },
            },
          }),
          // Live accent — a subtle info top-left corner glow; pulses only when `live`.
          ...(live && {
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: 0, width: 3, height: '38%',
              borderTopLeftRadius: '12px',
              background: 'linear-gradient(180deg, var(--mui-palette-info-main), transparent)',
              pointerEvents: 'none',
              '@media (prefers-reduced-motion: no-preference)': {
                animation: 'widgetLivePulse 2.4s ease-in-out infinite',
              },
            },
          }),
          // @property + keyframes for the animated selected border + live pulse (registered here so
          // `--angle` interpolates smoothly). Guarded by prefers-reduced-motion above (animation only
          // attaches under no-preference); the @property declaration itself is inert.
          '@property --angle': {
            syntax: '"<angle>"', inherits: 'false', initialValue: '0deg',
          },
          '@keyframes widgetAngleSpin': { to: { '--angle': '360deg' } },
          '@keyframes widgetLivePulse': {
            '0%, 100%': { opacity: 0.4 }, '50%': { opacity: 1 },
          },
          // One-time staggered mount reveal (fade + rise). The per-widget stagger delay comes from the
          // inherited `--widget-reveal-delay` custom property (set inline from the board order), so the
          // sections cascade in ~55ms steps — FRONTEND_EXECUTION_CONTRACT §3. One-shot: the widget stays
          // mounted across the 60s poll, so the CSS animation never replays. Reduced-motion → inert.
          '@media (prefers-reduced-motion: no-preference)': {
            '@keyframes widgetRise': {
              from: { opacity: 0, transform: 'translateY(12px)' },
              to: { opacity: 1, transform: 'none' },
            },
            animationName: 'widgetRise',
            animationDuration: '300ms',
            animationTimingFunction: 'ease-out',
            animationFillMode: 'both',
            animationDelay: 'var(--widget-reveal-delay, 0ms)',
          },
          // The View-Transition name so expand can morph this element ↔ the overlay.
          ...(supportsVT && !expanded && { viewTransitionName: vtNameRef.current }),
        })}
      >
        <Box id={headerId}>{header(false)}</Box>
        <Box sx={bodyWrapperSx}>{body}</Box>
      </Box>

      {/* Expand/peek — the same widget in a larger focus overlay. View Transitions morph it when
          supported; otherwise MUI `Fade` (inside `Dialog`) provides the graceful fallback. */}
      <Dialog
        open={expanded}
        onClose={collapse}
        maxWidth="lg"
        fullWidth
        // Skip MUI's own transition when View Transitions is driving the morph (avoid double-animating);
        // keep Fade as the fallback path (and under reduced motion Fade is effectively instant).
        transitionDuration={supportsVT && !reduced ? 0 : undefined}
        slots={{ transition: Fade }}
        slotProps={{
          // Dim + blur the page behind for a premium "focus" feel.
          backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } },
          paper: {
            sx: {
              // Crisp dark surface: kill MUI's dark-mode elevation overlay (the washed-grey look) and
              // pin the widget surface, matching the inline widget exactly.
              bgcolor: 'background.paper',
              backgroundImage: 'none',
              borderRadius: '16px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 24,
              // A definite-height flex column so the body fills — this is what lets a `height="100%"`
              // chart (Term structure) resolve inside the Dialog, and gives a consistent focus view.
              display: 'flex',
              flexDirection: 'column',
              height: 'min(86vh, 720px)',
              overflow: 'hidden',
              ...(supportsVT && expanded && { viewTransitionName: vtNameRef.current }),
            },
          },
        }}
      >
        <Box id={`${headerId}-overlay`} data-testid={`widget-overlay-${id}`} sx={{ flexShrink: 0 }}>{header(true)}</Box>
        <Box sx={[bodyWrapperSx, { flex: 1, minHeight: 0, overflow: 'auto' }]}>{body}</Box>
      </Dialog>

      {/* Click-outside-to-clear-selection is owned by the provider region in TickerDashboard; here we
          only stop propagation on the actions/toolbar so interacting with them doesn't re-select. */}
      {selected && <ClearOnOutside clear={clear} widgetId={id} />}
    </>
  );
}

/**
 * ClearOnOutside — a document-level pointerdown listener that clears the selection when the next
 * click lands outside the selected widget (and outside any MUI popover/menu it spawned). Mounted only
 * while a widget is selected.
 */
function ClearOnOutside({ clear, widgetId }: { clear: () => void; widgetId: string }) {
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useOutsideClear(widgetId, () => clearRef.current());
  return null;
}

function useOutsideClear(widgetId: string, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Inside the selected widget → keep.
      if (target.closest(`[data-widget-id="${widgetId}"]`)) return;
      // Inside a MUI overlay (menu/dialog/tooltip/popover) → keep (it belongs to this widget).
      if (target.closest('.MuiPopover-root, .MuiDialog-root, .MuiTooltip-popper, .MuiModal-root')) return;
      onOutside();
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [widgetId, onOutside]);
}

export default Widget;
