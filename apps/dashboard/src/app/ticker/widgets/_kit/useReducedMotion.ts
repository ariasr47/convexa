/**
 * useReducedMotion — the single shared reduced-motion guard for the Ticker micro-interactions
 * (FRONTEND_EXECUTION_CONTRACT §"HARD invariants · prefers-reduced-motion"). Reads the
 * `(prefers-reduced-motion: reduce)` media query and subscribes to changes, so every JS-driven
 * animation (the value flash, the live-dot pulse, the section reveal, the chart bar-grow) can fall
 * back to calm/instant from ONE source of truth.
 *
 * jsdom-safe: when `window.matchMedia` is unavailable (the default test environment) it returns
 * `false` (motion allowed) rather than throwing — the CSS `@media (prefers-reduced-motion: reduce)`
 * blocks on hover/offline transitions cover the no-JS path independently.
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(query);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    onChange(); // sync in case it changed between the initial render and the effect
    // addEventListener is the modern API; guard for older Safari's addListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

export default useReducedMotion;
