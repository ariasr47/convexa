/**
 * `useStreamLatch` — holds the last non-null value that arrived ON THE STREAM (SPEC §2.2, owner
 * ruling 2's debt to this phase). It owns BOTH the rendered value and the `retained` boolean, because
 * `FigureCell.tsx:267-275` renders whatever the caller passes: a `retained` fix without a value fix
 * leaves the REST bundle's number under an `offline · last known` caption (criterion 14).
 *
 * It composes BESIDE `useFlashOnChange`, never through it, and `useFlashOnChange.ts:44` is NOT
 * reordered (non-goal, SPEC §2.2): moving that write after the null guard would make the first payload
 * after a reconnect flash against a pre-drop value — a fabricated tick.
 *
 * RESET TOKEN. One token gives both clears ruling 2 requires: route symbol AND replay-armed state.
 * Compose it at the call site as `` `${routeSymbol}|${replayArmed ? 'replay' : 'live'}` ``.
 */
import { useRef } from 'react';

export interface StreamLatch {
  /** The last non-null STREAM value, or null when the latch is empty. Never a bundle value. */
  value: number | null;
  /** True iff the latch currently holds a value. The ONLY thing that licenses `· last known`. */
  retained: boolean;
}

/**
 * @param streamValue the value AS RECEIVED ON THE STREAM (`live?.gamma_flip`) — never a composed
 *   render value with a `?? bundle` fallback in it.
 * @param resetToken route symbol + replay-armed state; a change empties the latch.
 */
export function useStreamLatch(
  streamValue: number | null | undefined,
  resetToken: string,
): StreamLatch {
  const held = useRef<number | null>(null);
  const token = useRef(resetToken);

  if (token.current !== resetToken) {
    token.current = resetToken;
    held.current = null; // both clears ruling 2 requires, from one token
  }
  if (streamValue != null && Number.isFinite(streamValue)) {
    held.current = streamValue;
  }
  return { value: held.current, retained: held.current != null };
}
