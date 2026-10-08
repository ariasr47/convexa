import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';

/**
 * Keyboard and pointer reachable help trigger used by the decision card, `FigureCell`'s ⓘ, and
 * (curvature-v2-foundations ruling 6) the four look-alike widgets.
 *
 * `stopPropagation` on BOTH click and focus — a real, live-browser-confirmed defect, not a style
 * choice: `Widget.tsx` wires `onClick={onSelect}` AND `onFocus={onSelect}` on the card root (React
 * focus bubbles in its synthetic event system, unlike native DOM focus). Selecting the widget grows
 * its header (drag-grip + Expand + Configure controls appear), which RESHUFFLES card content
 * downward. A mouse click or a real touch tap is a down-then-up pair at FIXED coordinates; the
 * `down` half focuses this button and (via bubbling) selects the widget mid-gesture, the header
 * grows, everything below it shifts — and the `up` half then lands on whatever is now at the STALE
 * coordinates instead, so no completed click/tap ever reaches this button and its Tooltip never
 * opens. Confirmed live (dark, real Chromium): hover alone opens it every time (no focus, no
 * selection, no shift); a raw `el.focus()` call opens it too (no mouse coordinates to go stale); a
 * real `.click()`/`.tap()` on an UNSELECTED widget's info affordance fails every time; a SECOND
 * click, after the widget is already selected (`onSelect`'s `if (!selected)` guard is then a
 * no-op — no more shift), succeeds. `stopPropagation` on both events keeps this small utility
 * control from ever counting as "select the card" at all, matching the app's own established
 * pattern for header controls (`Widget.tsx`'s Expand/Close buttons already `stopPropagation` on
 * click for exactly this class of reason) — not a `Widget.tsx` layout rewrite, which is a much
 * larger, riskier change this phase does not need. A pre-existing gap (the underlying `onClick`/
 * `onFocus`-to-select wiring predates this feature): only a REAL browser click/tap races it —
 * jsdom performs no layout, so no existing component test could have caught it, and no e2e test
 * exercised a real click on this class of control until curvature-v2-foundations' AC-35 (FE-10).
 *
 * `enterTouchDelay={0}` — a SEPARATE, more fundamental defect, also only visible on a real touch
 * device: MUI `Tooltip` defaults `enterTouchDelay` to 700ms, i.e. its stock touch behavior is a
 * LONG PRESS, not a tap — confirmed live (`hasTouch` context): a genuine quick tap (`touchstart`
 * immediately followed by `touchend`, exactly what a real finger tap or Playwright's `.tap()` does)
 * never opens it, while holding for >700ms does. "Reachable by tap" (ruling 6; AC-35) means an
 * ordinary tap, not a 700ms hold nobody would discover — this override applies to all six sites.
 * A completed click also opens the same controlled Tooltip: a native short touch can release before
 * MUI's zero-delay enter timer runs, and touchend cancels that timer. MUI still owns hover/focus
 * opening and Escape/blur/touch-leave dismissal through onOpen/onClose.
 *
 * PROMOTED into `shared/ui/` (curvature-v2-surfaces SPEC §2.8, OWNER ruling D-C): the single
 * `Widget.tsx` frame's `info` render site needs this component, and `shared/` may never import from
 * `pages/` (the same inversion §2.1 refuses for the figure module — `notANumber.ts:18-23`,
 * `liveClaim.ts:9-14`). Moved byte-for-byte from its prior home under the ticker widget kit —
 * same props, same `aria-label`, same `stopPropagation`, same `enterTouchDelay={0}` — zero behaviour
 * change for its nine existing importers, all re-pointed in the same change.
 */
export function AccessibleHelp({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <Tooltip
      arrow
      title={text}
      describeChild
      enterTouchDelay={0}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <IconButton
        size="small"
        aria-label={label}
        onClick={(event) => {
          stop(event);
          setOpen(true);
        }}
        onFocus={stop}
        sx={{ p: 0.5 }}
      >
        <InfoOutlinedIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
