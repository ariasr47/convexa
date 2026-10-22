/**
 * useScrollRegion — a scroller is a tab stop only while it scrolls (spec 2026-10-21/02, part (d)).
 *
 * A keyboard user can only scroll an overflowing box that can take focus (axe
 * `scrollable-region-focusable`). A box that fits needs no stop: a focusable element that scrolls
 * nothing is a stop with no action. So this returns the region props while the element overflows,
 * and nothing otherwise:
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   const region = useScrollRegion(ref, 'Peer multiples table');
 *   <Box ref={ref} {...region} sx={{ overflowX: 'auto' }}>…</Box>
 *
 * Overflow means `scrollWidth > clientWidth` or `scrollHeight > clientHeight`. A `ResizeObserver`
 * on the element and on its first element child re-checks it at every width (a resize without a
 * reload included), when a closed `<details>` around it opens, and once web fonts have loaded.
 * The focus ring is the theme's global `*:focus-visible` ring (`textAmber`, 2px, offset 2).
 *
 * jsdom-safe: with no `ResizeObserver` it checks once; jsdom reports 0 sizes, so it returns `{}`.
 */
import { useEffect, useState, type RefObject } from 'react';

export type ScrollRegionProps =
  { tabIndex: 0; role: 'region'; 'aria-label': string } | Record<string, never>;

const NONE: Record<string, never> = {};

function overflows(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
}

export function useScrollRegion(
  ref: RefObject<HTMLElement | null>,
  label: string,
): ScrollRegionProps {
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const check = () => {
      if (live) setScrolls(overflows(el));
    };
    check();
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(check);
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [ref]);

  return scrolls ? { tabIndex: 0, role: 'region', 'aria-label': label } : NONE;
}
