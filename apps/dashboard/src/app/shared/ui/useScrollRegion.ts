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
 * reload included), and it is re-checked once web fonts have loaded.
 *
 * A box inside a closed `<details>` counts as fitting: it is not drawn and takes no focus, but
 * Chrome still lays it out on demand and reports its real widths (a 420px table measured
 * scrollWidth 420 > clientWidth 324 inside a closed details at 390, 2026-10-22). Each `<details>`
 * around it re-checks on `toggle`, so the box becomes a stop when it opens and stops being one when
 * it closes.
 * The focus ring is the theme's global `*:focus-visible` ring (`textAmber`, 2px, offset 2).
 *
 * jsdom-safe: with no `ResizeObserver` it checks once; jsdom reports 0 sizes, so it returns `{}`.
 */
import { useEffect, useState, type RefObject } from 'react';

export type ScrollRegionProps =
  { tabIndex: 0; role: 'region'; 'aria-label': string } | Record<string, never>;

const NONE: Record<string, never> = {};

/** Every `<details>` that holds `el` outside its own `<summary>`, nearest first. */
function detailsAround(el: HTMLElement): HTMLDetailsElement[] {
  const out: HTMLDetailsElement[] = [];
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) {
    if (el.closest('summary')?.parentElement !== d) out.push(d);
  }
  return out;
}

function overflows(el: HTMLElement, around: HTMLDetailsElement[]): boolean {
  if (around.some((d) => !d.open)) return false;
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
    const around = detailsAround(el);
    const check = () => {
      if (live) setScrolls(overflows(el, around));
    };
    check();
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(check);
    for (const d of around) d.addEventListener('toggle', check);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      live = false;
      ro?.disconnect();
      for (const d of around) d.removeEventListener('toggle', check);
    };
  }, [ref]);

  return scrolls ? { tabIndex: 0, role: 'region', 'aria-label': label } : NONE;
}
