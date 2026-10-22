import type { FocusEvent } from 'react';

/**
 * `onFocus` handler: when keyboard focus lands on a control outside the visual viewport (a pinch-
 * zoomed phone, say), scroll the page by just enough to bring it into view. A control already
 * partly visible is left where it is.
 */
export function revealFocusedControl(event: FocusEvent<HTMLElement>) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const left = viewport.offsetLeft;
  const top = viewport.offsetTop;
  const right = left + viewport.width;
  const bottom = top + viewport.height;
  const intersects =
    rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
  if (intersects) return;
  const dx = rect.right <= left ? rect.left - left : rect.left >= right ? rect.right - right : 0;
  const dy = rect.bottom <= top ? rect.top - top : rect.top >= bottom ? rect.bottom - bottom : 0;
  window.scrollBy({ left: dx, top: dy, behavior: 'auto' });
}
