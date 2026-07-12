/**
 * useFlashOnChange — the signature live-update micro-interaction (ticker-microinteractions
 * FRONTEND_EXECUTION_CONTRACT §1). When `value` changes while `active`, it briefly returns a flash
 * tone that a component maps to a color pulse on the figure. It is INERT:
 *   - on the initial render (no flash for the first value),
 *   - when the value is unchanged, null, or non-finite,
 *   - when `!active` (not live / SSE offline) — motion must only signal genuine live updates
 *     (`[live-vs-static-isolation]`), and
 *   - under `prefers-reduced-motion` (via the shared `useReducedMotion` guard).
 * The tone is directional for a numeric value ('up' on increase, 'down' on decrease) unless
 * `tone: 'neutral'` is forced. Each flash carries an incrementing `id` so consumers can key/retrigger
 * the animation. Returns `null` when not flashing.
 */
import type { Theme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export type FlashTone = 'up' | 'down' | 'neutral';
export interface FlashState {
  tone: FlashTone;
  id: number;
}

interface FlashOpts {
  /** Motion only fires when active — pass `isLive && !streamOffline`. */
  active: boolean;
  /** 'directional' (green up / red down) or 'neutral' (info tint). Default 'directional'. */
  tone?: 'directional' | 'neutral';
  /** Flash lifetime in ms (default 600). */
  durationMs?: number;
}

export function useFlashOnChange(
  value: number | null | undefined,
  { active, tone = 'directional', durationMs = 600 }: FlashOpts,
): FlashState | null {
  const reduced = useReducedMotion();
  const prev = useRef<number | null | undefined>(value);
  const idRef = useRef(0);
  const [flash, setFlash] = useState<FlashState | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (!active || reduced) return;
    if (before == null || value == null) return; // no flash on the first real value or a null
    if (!Number.isFinite(value) || !Number.isFinite(before)) return;
    if (value === before) return; // unchanged → no flash
    idRef.current += 1;
    const nextTone: FlashTone = tone === 'neutral' ? 'neutral' : value > before ? 'up' : 'down';
    setFlash({ tone: nextTone, id: idRef.current });
    const t = setTimeout(() => setFlash(null), durationMs);
    return () => clearTimeout(t);
  }, [value, active, reduced, tone, durationMs]);

  // Clear an in-flight flash if we stop being live or motion gets disabled mid-flash.
  useEffect(() => {
    if ((!active || reduced) && flash) setFlash(null);
  }, [active, reduced, flash]);

  return flash;
}

/**
 * flashColorSx — the sx fragment that turns a `FlashState` into a one-shot color pulse on a figure
 * (theme tokens only: success/error/info). Spread into an `sx` array on the value element. Settles
 * back to the element's own color when the flash clears. `null` → no styles.
 */
export function flashColorSx(flash: FlashState | null) {
  if (!flash) return {} as const;
  const name = `flash-${flash.tone}-${flash.id}`; // id in the name → the animation retriggers per flash
  return (theme: Theme) => ({
    animation: `${name} 600ms ease-out`,
    [`@keyframes ${name}`]: {
      '0%': {
        color:
          flash.tone === 'up'
            ? theme.palette.success.main
            : flash.tone === 'down'
              ? theme.palette.error.main
              : theme.palette.info.main,
      },
      '60%': {
        color:
          flash.tone === 'up'
            ? theme.palette.success.main
            : flash.tone === 'down'
              ? theme.palette.error.main
              : theme.palette.info.main,
      },
      '100%': { color: 'inherit' },
    },
  });
}

export default useFlashOnChange;
