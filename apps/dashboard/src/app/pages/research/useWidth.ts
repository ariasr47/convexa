import { startTransition, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/** A mounted element waiting for its first width, and how to hand it over. */
interface Pending {
  el: HTMLElement;
  set: (width: number) => void;
}

const pending = new Set<Pending>();
let frame = 0;

/**
 * Every element mounted since the last frame, measured together at the start of the next frame,
 * before it paints: the first read lays the page out, the rest reuse that layout. A chart on
 * screen, or within a quarter screen of it, redraws at once, so the frame the reader sees has it. A
 * chart further away redraws in a transition: after that paint, in slices that let the page respond.
 */
function measurePending() {
  frame = 0;
  const viewport = window.innerHeight;
  const margin = viewport / 4;
  const now: [Pending, number][] = [];
  const later: [Pending, number][] = [];
  for (const p of pending) {
    const box = p.el.getBoundingClientRect();
    (box.bottom >= -margin && box.top <= viewport + margin ? now : later).push([p, box.width]);
  }
  pending.clear();
  if (now.length) flushSync(() => now.forEach(([p, width]) => p.set(width)));
  if (later.length) startTransition(() => later.forEach(([p, width]) => p.set(width)));
}

/**
 * An element's rendered width: measured once it is laid out, then tracked as it resizes.
 *
 * A chart draws nothing until it knows its width, so the measure costs it a second render. Each
 * chart used to measure in its own layout effect, which forced the page's layout inside the task
 * that mounted it and redrew every chart in that same task: on a phone, a note's charts held the
 * main thread for one long task (site audit 2026-10-25, PERF-10). The charts now share one measure
 * per frame (measurePending), and only those in view redraw before it paints.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let measured = -1;
    const set = (next: number) => {
      measured = next;
      setWidth(next);
    };
    let entry: Pending | null = null;
    if (typeof requestAnimationFrame === 'undefined') set(el.getBoundingClientRect().width);
    else {
      entry = { el, set };
      pending.add(entry);
      if (!frame) frame = requestAnimationFrame(measurePending);
    }
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(([change]) => {
        // Its first report repeats the measure: an update for it would redraw a far chart now,
        // ahead of its transition.
        if (change.contentRect.width !== measured) set(change.contentRect.width);
      });
      observer.observe(el);
    }
    return () => {
      if (entry) pending.delete(entry);
      observer?.disconnect();
    };
  }, []);
  return [ref, width] as const;
}
