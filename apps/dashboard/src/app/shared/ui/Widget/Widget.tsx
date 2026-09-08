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
 *   - Expand is hover/focus-revealed; coming-soon grip/`⋮` only when the widget is selected.
 *   - `WidgetChromeProvider value="quiet"` softens context-band cards (no lift, lighter chrome).
 *   - A STATIC conic-gradient border marks the selected widget (redesign-stage-3 §3.1-6: the ring
 *     stays, the ambient 4s spin was retired — spectacle competing with the hero curve-draw).
 *   - View Transitions API (in `useExpand`) — the expand → focus overlay is a shared-element morph,
 *     with a graceful MUI `Fade`/`Dialog` fallback when unsupported.
 *
 * Motion note (redesign-stage-3 §3): widgets mount AT REST — the one-time staggered reveal was
 * retired (the hero curve-draw on `/` is THE one orchestrated moment). The only animation this
 * shell owns is the `live` accent pulse — a DATA SIGNAL (`[live-vs-static-isolation]` made
 * visible), reduced-motion-gated, firing only while genuinely live.
 */
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import { elevationFor, extrasFor } from '@/shared/theme/tokens';
import { AccessibleHelp } from '@/shared/ui/AccessibleHelp';
import { useWidgetChrome } from '@/shared/ui/Widget/WidgetChromeContext';
import { useWidgetSelection } from '@/shared/ui/Widget/WidgetSelectionContext';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

// A tactile spring-ish easing for the lift + toolbar (GPU-cheap; transform/opacity only).
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export interface WidgetProps {
  id: string;
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  info?: string;
  /** Live accent pulses ONLY when this is true (`isLive && !streamOffline`); frozen otherwise.
   *  Branded (FE-1, SPEC §2.1 invariant 1): only `isDeliveringLive(...)`/`andPresent(...)`/
   *  `NOT_LIVE` can produce this value — a raw boolean does not type-check here. */
  live?: LiveClaim;
  /**
   * A WATCH pulse — orders watching for a live cross (`OrdersWidget.tsx:144`). Deliberately NOT
   * `live`: it is not a delivering-stream claim, and branding it would launder a different fact
   * through the one predicate (SPEC §2.1). Drives the same `widgetLivePulse` declaration, so this
   * split changes no pixel. Pre-existing rule-22 question (does a watch pulse need a live stream?)
   * is UNCHANGED by this phase and is recorded in the build report, not fixed here.
   */
  watch?: boolean;
  /** The section's own always-visible controls (legend, "View what's sent", persona select, …). */
  actions?: ReactNode;
  children: ReactNode;
  /** Bento column span. */
  span?: 1 | 2;
  bodySx?: SxProps<Theme>;
  /**
   * Body surface. `flush` (default) sits on the widget; `inset` recesses a well so raised tiles pop.
   * Do not add a boolean for this — pick a named variant.
   */
  bodyVariant?: 'flush' | 'inset';
  /**
   * Body padding. `default` is the standard pad; `none` is for charts that paint to the edges.
   * Do not add `noBodyPad` — pick a named variant. Independent of `bodyVariant`.
   */
  bodyPad?: 'default' | 'none';
  /**
   * Ticker fidelity repair, change 4 (F4) — "no Widget title/subtitle (the strip is the frame)"
   * (`ReadStrip.tsx`'s own doc comment; `design/src/screens/desk.mjs:334`'s title-less `.panel.strip`).
   * `title` stays REQUIRED — it becomes the group's accessible name via `aria-label` instead of
   * `aria-labelledby` — but the whole header ROW is skipped: no visible h2/subtitle, and (for THIS
   * widget only) no `actions`/`info` affordance, no drag-grip/`⋮`/expand button either — none of
   * which `ReadStrip.tsx` passes anyway. Opt-in, default `false`; every other widget's header is
   * byte-unchanged. `live`'s accent edge (a border pseudo-element on the frame, not header content)
   * is unaffected either way.
   */
  hideHeader?: boolean;
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
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition ===
      'function';

  const toggle = useCallback(
    (next: boolean) => {
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (!reduced && supportsVT && typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(() => setOpen(next));
      } else {
        setOpen(next);
      }
    },
    [reduced, supportsVT],
  );

  return { open, expand: () => toggle(true), collapse: () => toggle(false), supportsVT };
}

export function Widget({
  id,
  title,
  icon,
  subtitle,
  info,
  live: liveClaim = NOT_LIVE,
  watch = false,
  actions,
  children,
  span = 1,
  bodySx,
  bodyVariant = 'flush',
  bodyPad = 'default',
  hideHeader = false,
}: WidgetProps) {
  const reduced = useReducedMotion();
  // `live` (the branded delivering-stream claim) OR `watch` (OrdersWidget's open-orders fact) both
  // drive the SAME `widgetLivePulse` declaration below — kept as the plain local `live` so the
  // pulse's shipped gate expression, spelled out where it is actually used a few lines down,
  // stays byte-identical for `single-motion-moment.spec.ts`'s structural mutation proof.
  const live = Boolean(liveClaim) || watch;
  const chrome = useWidgetChrome();
  const quiet = chrome === 'quiet';
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
          // v2 `ink2` — the WELL (SPEC §2.1). This faked the well with `background.default` (=
          // `ink`, not `ink2`) before the token existed; now theme-derived via `extrasFor`.
          backgroundColor: extrasFor(theme).well,
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
        bodyPad === 'default' && { p: 2, pt: 1.5 },
        // Container-query context for the body: each widget styles its internals by its OWN width.
        // NAMED (SPEC §2.5): an unnamed `@container` resolves against the NEAREST container
        // ancestor, so a future nested rail would answer the panel's question instead of the panel
        // itself. `FigureCell` queries `theme.containerQueries('panel')` and must NEVER query an
        // unnamed container.
        { containerType: 'inline-size', containerName: 'panel' },
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
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 2,
        pt: 1.5,
        pb: 1,
        // Below `sm` the actions region may wrap to its own row instead of forcing the header (and
        // the widget frame) wider than a narrow bento cell (Stage 0 item 1 — widget-header overflow).
        // The title keeps its ellipsis at every width.
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}
    >
      {/* Drag grip — AFFORDANCE ONLY. Visible only when selected (not on every hover). */}
      {!inOverlay && !quiet && (
        <Tooltip arrow describeChild title="Rearrange (coming soon)">
          <Box
            component="span"
            aria-hidden="true"
            className="widget__grip"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              mt: 0.25,
              cursor: 'grab',
              color: 'text.disabled',
              opacity: selected ? 0.55 : 0,
              pointerEvents: selected ? 'auto' : 'none',
              transition: `opacity 160ms ease`,
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
          {/* h2 ELEMENT (heading order: page h1 → widget h2), h6 STYLING unchanged (Stage 0 item 3). */}
          <Typography
            variant="h6"
            component="h2"
            sx={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...(quiet ? { fontSize: '1rem', fontWeight: 600 } : null),
            }}
          >
            {title}
          </Typography>
          {info && <AccessibleHelp label={`About ${title}`} text={info} />}
        </Stack>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Right region: the section's own always-visible actions + the hover toolbar. May wrap onto
          its own header row below `sm` (never wider than the widget frame). */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          alignItems: 'center',
          flexShrink: 0,
          maxWidth: '100%',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            {actions}
          </Box>
        )}

        <Stack
          direction="row"
          spacing={0.25}
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
          {/* Configure affordance — only when selected (reduces board chrome noise). */}
          {!inOverlay && selected && !quiet && (
            <Tooltip arrow title="Configure — coming soon">
              <span className="widget__affordance">
                <IconButton
                  size="small"
                  aria-label="Configure — coming soon"
                  disabled
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

  const onSelect = useCallback(() => {
    if (!selected) select(id);
  }, [selected, select, id]);

  return (
    <>
      <Box
        data-testid={`widget-${id}`}
        data-widget-id={id}
        role="group"
        aria-labelledby={hideHeader ? undefined : headerId}
        aria-label={hideHeader ? title : undefined}
        aria-current={selected ? 'true' : undefined}
        tabIndex={0}
        onClick={onSelect}
        onFocus={onSelect}
        sx={(theme) => ({
          gridColumn: span === 2 ? { xs: '1 / -1', md: 'span 2' } : undefined,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          // PANEL role (SPEC §2.2, ruling 4) — `1` is a THEME-DERIVED multiplier (1 × shape.borderRadius
          // = 12px today), not a literal: inside `sx`, MUI resolves a numeric `borderRadius` through
          // `createUnaryUnit(theme, 'shape.borderRadius', …)`, so `theme.shape.borderRadius` itself
          // must never be passed as the raw value here (that would resolve to 12 × 12 = 144px).
          borderRadius: 1,
          // Resting depth matches Command Deck (`elevationFor.e1`) — one material language.
          // Quiet (context band): same e1, no hover lift — tertiary claim.
          boxShadow: elevationFor(theme).e1,
          opacity: quiet ? 0.96 : 1,
          overflow: 'clip',
          outline: 'none',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
          contentVisibility: 'auto',
          containIntrinsicSize: '480px 320px',
          transition: quiet
            ? 'border-color 220ms ease'
            : `transform 220ms ${SPRING}, box-shadow 220ms ease, border-color 220ms ease`,
          ...(quiet
            ? {
                '&:hover': {
                  transform: 'none',
                  boxShadow: elevationFor(theme).e1,
                  borderColor: theme.palette.divider,
                },
              }
            : {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: elevationFor(theme).e2,
                  borderColor: theme.palette.text.disabled,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'box-shadow 220ms ease, border-color 220ms ease',
                  '&:hover': { transform: 'none' },
                },
              }),
          // Expand on hover/focus; grip is selected-only (inline opacity).
          '& .widget__grip:hover': { opacity: 1, color: 'text.secondary' },
          '&:hover .widget__toolbar, &:has(:focus-visible) .widget__toolbar': {
            opacity: 1,
            transform: 'none',
          },
          // Selected ring — a STATIC conic-gradient border (single-widget, tasteful). Stage-3
          // §3.1-6 tame: the ring's visual stays; the infinite `--angle` spin (pure ambient
          // spectacle) was retired with the `@property` registration.
          ...(selected && {
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 1, // PANEL role — theme-derived multiplier, see the note above
              padding: '1.5px',
              // The gradient sweeps from primary through the live accent.
              background:
                'conic-gradient(from 0deg, var(--mui-palette-primary-main), var(--mui-palette-info-main), var(--mui-palette-primary-main))',
              // Mask so only the 1.5px border shows (the fill is knocked out). The mask color is
              // arbitrary/opaque (only its alpha matters) — not a theme tint, so no token needed.
              WebkitMask:
                'linear-gradient(rgb(0 0 0) 0 0) content-box, linear-gradient(rgb(0 0 0) 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(rgb(0 0 0) 0 0) content-box, linear-gradient(rgb(0 0 0) 0 0)',
              maskComposite: 'exclude',
              pointerEvents: 'none',
            },
          }),
          // Live accent — thin info edge (deck owns connection chip; strip is secondary signal).
          // Quieter pulse so it doesn't compete with the hero connection chip. `live` here is the
          // LOCAL combined boolean (liveClaim || watch) computed above.
          ...(live &&
            !quiet && {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: 2,
                height: '32%',
                // `borderTopLeftRadius` is NOT one of MUI's recognized `sx` shorthand props (only
                // the bare `borderRadius` key is routed through `createUnaryUnit`), so a raw theme
                // number here passes straight through to emotion as CSS and is safely theme-derived
                // (unlike the plain `borderRadius` sites above, which need the `1 ×` multiplier idiom).
                borderTopLeftRadius: theme.shape.borderRadius,
                background: 'linear-gradient(180deg, var(--mui-palette-info-main), transparent)',
                pointerEvents: 'none',
                opacity: 0.75,
                '@media (prefers-reduced-motion: no-preference)': {
                  animation: 'widgetLivePulse 2.8s ease-in-out infinite',
                },
              },
            }),
          '@keyframes widgetLivePulse': {
            '0%, 100%': { opacity: 0.55 },
            '50%': { opacity: 0.95 },
          },
          // The View-Transition name so expand can morph this element ↔ the overlay.
          ...(supportsVT && !expanded && { viewTransitionName: vtNameRef.current }),
        })}
      >
        {/* Ticker fidelity repair, change 4 (F4) — `hideHeader` skips the whole row: no visible
            h2/subtitle (the accessible name moves to `aria-label` above), no actions/info,
            no drag-grip/`⋮`/expand. `ReadStrip.tsx` is the one caller today. */}
        {!hideHeader && <Box id={headerId}>{header(false)}</Box>}
        <Box sx={bodyWrapperSx}>{body}</Box>
      </Box>

      {/* Expand/peek — the same widget in a larger focus overlay. View Transitions morph it when
          supported; otherwise MUI `Fade` (inside `Dialog`) provides the graceful fallback.
          Skipped entirely with `hideHeader`: its only trigger (the header's `⤢` button) is also
          skipped, so an always-closed Dialog would just be unreachable DOM. */}
      {!hideHeader && (
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
            // v2 `scrim` (SPEC §2.1) — the hardcoded `rgba(0,0,0,0.6)` is GONE, not overridden: the
            // `MuiBackdrop` theme default now supplies `scrim` to every overlay, including this one.
            backdrop: { sx: { backdropFilter: 'blur(4px)' } },
            paper: {
              sx: {
                // Crisp dark surface: kill MUI's dark-mode elevation overlay (the washed-grey look) and
                // pin the widget surface, matching the inline widget exactly.
                bgcolor: 'background.paper',
                backgroundImage: 'none',
                // DIALOG role = 16px, declared ONCE via `theme.components.MuiDialog.styleOverrides
                // .paper` (SPEC §2.2, ruling 4) — no local literal here, so this paper inherits the
                // single declared dialog radius instead of duplicating (and drifting from) it.
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
          <Box
            id={`${headerId}-overlay`}
            data-testid={`widget-overlay-${id}`}
            sx={{ flexShrink: 0 }}
          >
            {header(true)}
          </Box>
          <Box sx={[bodyWrapperSx, { flex: 1, minHeight: 0, overflow: 'auto' }]}>{body}</Box>
        </Dialog>
      )}

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
      if (target.closest('.MuiPopover-root, .MuiDialog-root, .MuiTooltip-popper, .MuiModal-root'))
        return;
      onOutside();
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [widgetId, onOutside]);
}

export default Widget;
