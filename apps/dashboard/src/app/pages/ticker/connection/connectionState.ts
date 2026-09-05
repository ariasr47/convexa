/**
 * `connectionState` — the ONE page-scoped connection resolver (SPEC §2.4). Pinned importer set of
 * EXACTLY `TickerHeader.tsx` and `CommandDeck.tsx` — this module is the DEFINITION site; neither
 * importer hosts the resolver. NOT re-exported from `shared/ui/index.ts` (the barrel records at
 * `:10-13` that a re-export would blind the importer-set scan — the same reasoning as `arc.ts`).
 *
 * `resolveConnectionState` is the ONLY exported way to build a `ConnectionState`. `live` is
 * REACHABLE ONLY when the delivering-stream predicate (`isDeliveringLive`, `sessionTapeStanding.ts`
 * — GATE Q bounce, finding 1: NOT `genuineIsLive`, which does not check `market_session` and is the
 * wrong predicate for exactly this reason) holds — `session_tape` present already poisons
 * `live: true` to `false` (`sessionTapeStanding.ts:29-32`), so a `replay` standing can never also
 * read as `live`. `LiveTape.tsx` calls the SAME `isDeliveringLive` for its per-figure dot, its
 * widget pulse and its tick flash — one predicate, one place, never re-derived a second way.
 *
 * The LATCH (ruling 1): before the first stream fact the chip slot shows the wordless placeholder,
 * never a `ConnectionState`. `useTickerStream.ts:42-47` starts the payload-gap watchdog only
 * INSIDE the first payload's callback, so `streamOffline` cannot become `true` before `live`
 * becomes non-null — `live !== null` is therefore the exact, already-monotonic "has a fact
 * arrived" signal (it is cleared only by `resetLiveTape()` on navigation-away, never by a gap/
 * drop/watchdog event within a session).
 *
 * `connectionStateFor` is that wrapper. It is a PLAIN FUNCTION, not a hook — both `TickerHeader`
 * and `CommandDeck` already receive `live`/`streamOffline`/`lastSessionPhase` as explicit PROPS
 * (threaded from `TickerDashboard.tsx`'s own `useLiveTape()` call, byte-identical values), and
 * existing component tests render both with those props overridden directly. Reading the shared
 * store a SECOND time inside this module would silently ignore that override path and diverge from
 * the props-driven contract both files already have — so the wrapper takes the same inputs the
 * pure resolver does, exactly mirroring the deleted `TickerHeader.connectionChip()`'s signature.
 */
import {
  consumeStanding,
  isDeliveringLive,
  type ConsumeStanding,
  type SessionTapeOccupancy,
} from '../sessionTapeStanding';
import type { LiveUpdate } from '@convexa/api';

/** Every replay standing except the no-session-tape arm — DERIVED, not retyped, from the shipped
 *  8-member union so an added standing is a compile error at the `sessionTapeChip` switch without
 *  duplicating the list anywhere. */
export type ReplayStanding = Exclude<ConsumeStanding, { kind: 's0' }>;

/**
 * The SIX states, exhaustively switched with a `never` default arm elsewhere so a seventh `kind`
 * is a COMPILE ERROR. No placeholder member exists here on purpose (SPEC §2.4) — the placeholder
 * is the visible ABSENCE of a `ConnectionState`, which this type cannot represent by construction.
 */
export type ConnectionState =
  | { kind: 'live' }
  | { kind: 'closed' }
  | { kind: 'overnight' }
  | { kind: 'noTicks' }
  | { kind: 'offline' }
  | { kind: 'replay'; standing: ReplayStanding };

export interface ResolveConnectionInput {
  live: LiveUpdate | null;
  streamOffline: boolean;
  routeSymbol: string;
  lastSessionPhase?: SessionTapeOccupancy['phase'] | null;
}

/**
 * Pure — no React, no store read. Session-tape standing branches BEFORE live status (SPEC §2.4).
 * `live` is typed nullable to match the store's real shape, but in normal operation the wrapper
 * (`useConnectionState` below) never calls this before `live !== null` — a null `live` reaching
 * here degrades to `offline` rather than being a documented seventh state.
 */
export function resolveConnectionState(input: ResolveConnectionInput): ConnectionState {
  const standing = consumeStanding({
    live: input.live,
    streamOffline: input.streamOffline,
    routeSymbol: input.routeSymbol,
    lastPhase: input.lastSessionPhase ?? undefined,
  });
  if (standing.kind !== 's0') {
    return { kind: 'replay', standing };
  }
  if (input.streamOffline) return { kind: 'offline' };
  const live = input.live;
  if (!live) return { kind: 'offline' };
  if (live.market_session === 'closed') return { kind: 'closed' };
  // The ONE delivering-stream predicate (GATE Q bounce, finding 1) — shared verbatim with
  // `LiveTape.tsx`'s per-figure dot/widget-pulse/tick-flash gating so the chip and the figures can
  // never answer "is this live?" two different ways again.
  if (isDeliveringLive(live, input.streamOffline)) return { kind: 'live' };
  if (live.market_session === 'overnight') return { kind: 'overnight' };
  return { kind: 'noTicks' };
}

/**
 * The wrapper (ruling 1). `null` while no stream fact has arrived yet — the caller renders the
 * wordless placeholder in that case, never a `ConnectionState`. Once `input.live` is non-null it
 * NEVER reverts within a mounted session (monotonic — see the module doc), so this can never
 * re-enter `null` for the same symbol (AC-7b): a payload gap, an undefined payload, and an expired
 * watchdog all leave `live` set to the last real payload, never back to `null`.
 */
export function connectionStateFor(input: ResolveConnectionInput): ConnectionState | null {
  if (input.live == null) return null;
  return resolveConnectionState(input);
}
