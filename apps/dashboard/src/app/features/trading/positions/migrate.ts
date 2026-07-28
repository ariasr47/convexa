/**
 * The v3 migration: `positions.v2` + `ghost-trade.v1` -> ONE `SimPosition` collection, as a UNION.
 *
 * WHY A UNION AND NOT THE SHIPPED READ-NEW-ELSE-OLD CHAIN: `useGhostTrade` is LIVE and has been
 * writing `convexa.ghost-trade.v1` continuously, while `positions/store.ts` consults v1 ONLY when no
 * v2 blob exists. `outcomes/sources.ts:160` documents the consequence in shipped code — "v1-only
 * positions exist and are PERMANENT". An else-chain v3 migration would therefore SILENTLY DROP every
 * Ticker-page ghost trade for any user who has ever opened the Positions page.
 *
 * ID COLLISIONS BETWEEN THE TWO SOURCES ARE THE EXPECTED CASE, not an edge case:
 * `positions/store.ts:49` (`v1TradeToPosition`) carries `id: t.id` forward verbatim. Consequence:
 * the count-after criterion is a DISTINCT-ID count, never the arithmetic sum (AC-46).
 *
 * THIS MODULE IS PURE. It takes parsed source material and returns a result; it never reads or
 * writes storage. `liftLegacyRecord` has exactly TWO production callers — the store migration and
 * the archive import — and they must never diverge (SPEC §2.6): if they do, importing your own
 * backup produces different records than the migration did.
 *
 * THE UNION RUNS EXACTLY ONCE, and this module cannot enforce that: it is handed sources and knows
 * nothing about an existing v3 collection, so once-only lives in the CALLER (F18 — once
 * `convexa.positions.v3` exists, no source is ever consulted again). A repeated union is a
 * RESURRECTION MACHINE: a record the trader closed or removed in v3 comes back out of a source blob.
 * `migrate.spec.ts` pins that hazard explicitly so nobody "helpfully" re-runs it.
 */
import { decisionIdentity } from '@/features/trading/outcomes/sources';
import type { OptionRight } from '@org/api';
import { SIM_POSITION_SCHEMA_VERSION, type Leg, type SimPosition } from './leg';
import type { DecisionRecord, EntryBasis, EntryMode, PositionStatus } from './types';

/**
 * ONE LOGICAL SOURCE = ONE ENTRY, even when the blob exists under two physical keys.
 *
 * `resolveDurable` (`shared/lib/durable/resolveDurable.ts:33-44`) promotes a legacy-brand blob to
 * the new key BEFORE anything parses it, so a user holding an unparseable `gammaflow.positions.v2`
 * ends up holding the SAME corrupt bytes under `convexa.positions.v2` as well. Nothing is lost, but
 * the accounting must not see two failures where there is one blob: `unread_sources` would list the
 * store twice and the trader would be told the wrong reason for the abort.
 *
 * `key` is therefore the LOGICAL label (`'convexa.positions.v2'`, `'convexa.ghost-trade.v1'`), never
 * whichever physical key happened to answer. Resolving the brand hop is the CALLER's job. This
 * module additionally collapses a brand pair defensively, so the accounting holds even if a caller
 * regresses — see `logicalSourceKey`.
 */
export interface ParsedSource {
  key: string;
  ok: boolean;
  records: unknown[];
  decisions: unknown[];
}

export interface UnionResult {
  positions: Record<string, SimPosition>;
  decisions: DecisionRecord[];
  /** Keyed by LOGICAL source. `read` = rows offered; `contributed` = DISTINCT ids it added. */
  source_counts: Record<string, { read: number; contributed: number }>;
  /** LOGICAL keys that failed to read — one entry per store, never per physical key. */
  unread_sources: string[];
  /**
   * True iff any source is unread. THE CALLER MUST NOT WRITE A v3 BLOB WHEN THIS IS TRUE (F18):
   * a partial v3 freezes a truncated history behind a key that claims completeness, and writing v3
   * permanently stops the read path from consulting sources. A migration that half-succeeds is
   * worse than one that does not run. This function still returns whatever parsed, so the store can
   * run in memory from it.
   */
  aborted: boolean;
}

/** The current-brand prefix every logical source key carries. */
const BRAND_PREFIX = 'convexa.';
/** The pre-rebrand prefix `resolveDurable` promotes forward. */
const LEGACY_BRAND_PREFIX = 'gammaflow.';

/**
 * Map a physical storage key to its LOGICAL source label. `gammaflow.positions.v2` and
 * `convexa.positions.v2` are two names for ONE blob, and the union must never count them twice.
 * This is the same class of error as the id collision that forced the distinct-id count in AC-46:
 * two names for one thing.
 */
export function logicalSourceKey(key: string): string {
  return key.startsWith(LEGACY_BRAND_PREFIX)
    ? BRAND_PREFIX + key.slice(LEGACY_BRAND_PREFIX.length)
    : key;
}

const POSITION_STATUSES: ReadonlySet<string> = new Set<PositionStatus>([
  'open',
  'pending',
  'closed',
  'cancelled',
]);
const ENTRY_MODES: ReadonlySet<string> = new Set<EntryMode>(['manual', 'market', 'limit']);

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * THE ONE LIFT. A legacy `Position` / `GhostTrade` row -> a one-leg `SimPosition`.
 *
 * FORBIDDEN FROM FABRICATING a `right`, a `strike` or an `entry_time`. A malformed legacy record
 * lifts to a leg carrying `null`s, renders `Custom`, and shows `not recorded` in the cells whose
 * facts were never held — it is never healed, never guessed, never dropped.
 *
 * `kind: 'option'` and `side: 'long'` are facts about the SOURCE KEY (both legacy stores are
 * option-only and long-only by construction), not guesses about the record — so a leg whose
 * instrument kind is itself unknown is unreachable and no fourth cell literal is needed.
 *
 * The old `Strategy` value is NEVER carried forward: the recogniser derives the kind from the leg,
 * and that is what makes future recogniser changes migration-free.
 *
 * Returns `null` only for material that has no usable id — never throws.
 */
export function liftLegacyRecord(raw: unknown): SimPosition | null {
  try {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const id = str(r.id);
    if (id == null) return null;

    const right = r.right === 'call' || r.right === 'put' ? (r.right as OptionRight) : null;

    const leg: Leg = {
      // Minted DETERMINISTICALLY from the record id, so a repeated lift of the same row produces
      // the same leg id — the archive import and the store migration must agree exactly.
      id: `${id}-l0`,
      kind: 'option',
      ticker: (str(r.ticker) ?? '').toUpperCase(),
      side: 'long',
      qty: num(r.qty) ?? 0,
      multiplier: 100,
      entry_price: num(r.entry_mark) ?? 0,
      entry_basis: (str(r.entry_basis) as EntryBasis | null) ?? 'manual',
      expiration: str(r.expiration),
      strike: num(r.strike),
      right,
    };

    const status = POSITION_STATUSES.has(r.status as string)
      ? (r.status as PositionStatus)
      : // An unrecognised status is not information: `open` is the shipped v1 default and the only
        // non-fabricating choice. It never turns a KNOWN `closed` into `open` — that branch is
        // reached solely for a value the record does not actually hold.
        'open';

    const p: SimPosition = {
      id,
      legs: [leg],
      // VERBATIM, including `''` on a pending limit. Never backfilled with an invented timestamp.
      opened_time: typeof r.entry_time === 'string' ? r.entry_time : '',
      status,
      entry_mode: ENTRY_MODES.has(r.entry_mode as string) ? (r.entry_mode as EntryMode) : 'manual',
      schema_version: SIM_POSITION_SCHEMA_VERSION,
    };

    if (r.limit_price !== undefined) p.limit_price = num(r.limit_price);
    if (r.placed_time !== undefined) p.placed_time = str(r.placed_time) ?? undefined;
    if (r.stop !== undefined) p.stop = num(r.stop);
    if (r.target !== undefined) p.target = num(r.target);
    if (r.realized_pl_dollar !== undefined) p.realized_pl_dollar = num(r.realized_pl_dollar) ?? 0;
    if (r.realized_pl_pct !== undefined) p.realized_pl_pct = num(r.realized_pl_pct) ?? 0;
    if (r.close_time !== undefined) p.close_time = str(r.close_time) ?? undefined;
    if (r.origin_order_id !== undefined) p.origin_order_id = str(r.origin_order_id) ?? undefined;

    return p;
  } catch {
    return null;
  }
}

/**
 * Keep-first, v2-before-v1, with ONE monotone exception: for a colliding id the two copies are the
 * same trade, forked, with no reliable clock to order them. The v2 copy generally wins (it is the
 * one edited on the Positions page), EXCEPT that a record closed in EITHER source is closed, taking
 * that source's close_time / realized figures. Re-opening a closed trade fabricates an exposure the
 * trader does not have; the reverse error is not symmetric. Plan fields take the v2 (first) copy.
 */
export function mergeCollidingRecords(first: SimPosition, second: SimPosition): SimPosition {
  const terminal = (s: SimPosition) => s.status === 'closed' || s.status === 'cancelled';
  if (terminal(first) || !terminal(second)) return first;
  return {
    ...first,
    status: second.status,
    close_time: second.close_time,
    realized_pl_dollar: second.realized_pl_dollar,
    realized_pl_pct: second.realized_pl_pct,
  };
}

/**
 * Collapse the given entries to ONE per LOGICAL source, preserving first-seen order.
 *
 * The caller is contracted to pass exactly one entry per store; this is defence in depth against a
 * caller that forwards both brand keys for the same blob. The FIRST entry's material is kept (a
 * promoted brand pair holds identical bytes, so the second adds nothing but inflation) and `ok` is
 * ANDed — a logical source that did not read COMPLETELY has not read, which is the conservative
 * direction: it favours the abort over a partial promote.
 */
function collapseToLogicalSources(sources: readonly ParsedSource[]): ParsedSource[] {
  const byKey = new Map<string, ParsedSource>();
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const key = logicalSourceKey(String(s.key));
    const prior = byKey.get(key);
    if (prior == null) {
      byKey.set(key, {
        key,
        ok: s.ok !== false,
        records: Array.isArray(s.records) ? s.records : [],
        decisions: Array.isArray(s.decisions) ? s.decisions : [],
      });
      continue;
    }
    byKey.set(key, { ...prior, ok: prior.ok && s.ok !== false });
  }
  return [...byKey.values()];
}

/**
 * The UNION. Walks the sources IN THE GIVEN ORDER — the caller passes v2 first, v1 second (source
 * precedence) — lifts every row, and merges colliding ids under `mergeCollidingRecords`.
 *
 * Never throws. Never touches storage. Never deletes anything, from anywhere.
 */
export function unionSources(sources: readonly ParsedSource[]): UnionResult {
  const positions: Record<string, SimPosition> = {};
  const decisions: DecisionRecord[] = [];
  const seenDecisions = new Set<string>();
  const source_counts: Record<string, { read: number; contributed: number }> = {};
  const unread_sources: string[] = [];

  for (const source of collapseToLogicalSources(sources)) {
    // An unread source contributes NOTHING — not a record, not a decision, not even the rows it
    // happens to be carrying. Nothing is ever half-adopted from a store that did not read.
    if (!source.ok) {
      unread_sources.push(source.key);
      source_counts[source.key] = { read: 0, contributed: 0 };
      continue;
    }

    let contributed = 0;
    for (const raw of source.records) {
      const lifted = liftLegacyRecord(raw);
      if (lifted == null) continue; // read, but unusable — never a phantom position
      const existing = positions[lifted.id];
      if (existing == null) {
        positions[lifted.id] = lifted;
        contributed += 1; // DISTINCT-ID accounting, never the arithmetic sum (AC-46)
      } else {
        positions[lifted.id] = mergeCollidingRecords(existing, lifted);
      }
    }
    source_counts[source.key] = { read: source.records.length, contributed };

    // Decisions: union by the EXISTING identity helper (per-record uuid, else the composite key),
    // preserving first-seen order. No renumbering, no timestamp rewriting, no drops, no doubles.
    for (const raw of source.decisions) {
      if (raw == null || typeof raw !== 'object') continue;
      const d = raw as DecisionRecord;
      const identity = decisionIdentity(d);
      if (seenDecisions.has(identity)) continue;
      seenDecisions.add(identity);
      decisions.push(d);
    }
  }

  return {
    positions,
    decisions,
    source_counts,
    unread_sources,
    aborted: unread_sources.length > 0,
  };
}
