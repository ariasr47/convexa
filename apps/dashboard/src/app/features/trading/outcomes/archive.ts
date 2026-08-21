/**
 * outcome-ledger — the ARCHIVE. Deliberately a SEPARATE module from `ledger.ts`: the ledger is a
 * pure read with zero write functions, the archive has the only write this feature performs.
 * Different rules, different module.
 *
 * ⚠ THE ARCHIVE ONLY EVER ADDS (`[loss-free-durable-migration]`). There is no Restore, no Replace,
 * no Overwrite, no Clear, no Reset, no "Start fresh" — not a function here, not a mode, not a flag.
 * A destructive restore is the one operation that invariant exists to forbid.
 *   - MERGE-ONLY · IDEMPOTENT · KEEP-EXISTING-ON-CONFLICT · NEVER THROW
 *   - every write goes through the EXISTING store append/put APIs — never `localStorage` directly
 *   - a declined import leaves the stores BYTE-UNTOUCHED and says so
 *   - no record is ever pruned, compacted or deleted — not to "clean up" the readout, not ever
 *
 * ⚠ It is UNGATED (AC-25, `[server-side-gate-enforcement]`). `PortfolioPanel` — the component
 * directly above this one on the same page — server-gates every write, and an import *looks* like a
 * write. It is not comparable: this reaches no server, creates no position, costs nothing, and
 * writes only into the user's own browser. There is NO boundary at which a gate could be enforced,
 * so an FE-only gate would be decorative — and a decorative gate is forbidden, not merely useless.
 * Hence: no `useGate`, no `gate.guard`, no `simTradeGate`, no `SignInPrompt`, no `features/auth`
 * import anywhere in this module or its surface.
 */
import { allDecisions as allGhostDecisions } from '@/features/trading/model/store';
import type { DecisionRecord } from '@/features/trading/model/types';
import { allOrders, getOrder, ordersFaulted, putOrder } from '@/features/trading/orders/store';
import type { SimOrder } from '@/features/trading/orders/types';
import type { SimPosition } from '@/features/trading/positions/leg';
import { liftLegacyRecord } from '@/features/trading/positions/migrate';
import {
  allDecisions as allPositionDecisions,
  allPositions,
  appendDecision as appendPositionDecision,
  getPosition,
  putPosition,
} from '@/features/trading/positions/store';
import type { Position } from '@/features/trading/positions/types';
import { decisionIdentity, readSources } from './sources';

// ---- The envelope (§3.5) — a FILE, not a store and not a wire format -----------------------------

/** The stamp that identifies the file as ours. */
export const ARCHIVE_SCHEMA = 'convexa.archive';
/**
 * The envelope version. A file from a HIGHER version is DECLINED — never half-read. A file from a
 * LOWER one still imports: v2 (the merged book) is what we write, v1 (the split ghost-trade +
 * positions stores) is what a trader may already have on disk, and refusing their own backup
 * because we reorganised our storage would be the exact loss this module exists to prevent.
 */
export const ARCHIVE_VERSION = 2;

export interface ArchiveEnvelope {
  schema: typeof ARCHIVE_SCHEMA;
  version: number;
  exported_at: string;
  /**
   * ONE envelope spanning every store. THE EXPORT FORMAT IS THE IMPORT FORMAT — the file is
   * round-trippable by construction.
   *
   * v2 writes exactly two slots: the merged `positions` book and `orders`. `ghost_trade` is the v1
   * slot: never written any more, still READ, and still routed through the IDENTICAL
   * `liftLegacyRecord` the store migration uses. ONE migrate function, two callers — if they
   * diverged, importing your own backup would produce different records than the migration did.
   */
  stores: {
    /** LEGACY (v1 files only). Absent from every v2 envelope this build writes. */
    ghost_trade?: { trades: Record<string, unknown>; decisions: DecisionRecord[] };
    positions: { positions: Record<string, SimPosition | Position>; decisions: DecisionRecord[] };
    orders: { orders: Record<string, SimOrder> };
  };
}

/** The v1 slot, normalized — absent reads as empty, never as a failure. */
const ghostSlot = (env: ArchiveEnvelope) =>
  env.stores.ghost_trade ?? { trades: {}, decisions: [] as DecisionRecord[] };

/** `convexa-archive-{YYYY-MM-DD}` — the house filename convention (§4.12). */
export function archiveFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `convexa-archive-${y}-${m}-${d}.json`;
}

/**
 * Build the envelope: a pure read of the stores. Never throws.
 *
 * v2 exports the MERGED book only. The two legacy blobs are deliberately NOT copied in: they were
 * already unioned into it, so carrying them too would make the file describe every pre-cutover
 * record twice and hand a re-import the resurrection problem the union exists to close. They are
 * still on disk, untouched, and they are still the rollback.
 *
 * NO `provenance` IS EVER EXPORTED. Provenance is a fact about THIS device's migration; a file that
 * carried it would let an import claim a migration that did not happen here.
 */
export function buildArchive(now: Date = new Date()): ArchiveEnvelope {
  const orders: Record<string, SimOrder> = {};
  for (const o of allOrders()) orders[o.id] = o;
  const positions: Record<string, SimPosition> = {};
  for (const p of allPositions()) positions[p.id] = p;
  return {
    schema: ARCHIVE_SCHEMA,
    version: ARCHIVE_VERSION,
    exported_at: now.toISOString(),
    stores: {
      positions: { positions, decisions: allPositionDecisions() },
      orders: { orders },
    },
  };
}

/** An archive with nothing in it is still a VALID archive (AC-21) — it just says so. */
export function isArchiveEmpty(env: ArchiveEnvelope): boolean {
  const s = env.stores;
  const ghost = ghostSlot(env);
  return (
    Object.keys(ghost.trades).length === 0 &&
    ghost.decisions.length === 0 &&
    Object.keys(s.positions.positions).length === 0 &&
    s.positions.decisions.length === 0 &&
    Object.keys(s.orders.orders).length === 0
  );
}

/** Trigger the browser download. Returns the filename so the caller can report it. */
export function downloadArchive(now: Date = new Date()): { filename: string; empty: boolean } {
  const env = buildArchive(now);
  const filename = archiveFilename(now);
  try {
    const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    /* best-effort: the result report still tells the user what happened */
  }
  return { filename, empty: isArchiveEmpty(env) };
}

// ---- Import: parse (no write) --------------------------------------------------------------------

export type DeclineReason = 'unreadable' | 'not_ours' | 'version' | 'store_unreadable';

export type ParseResult =
  { ok: true; envelope: ArchiveEnvelope } | { ok: false; reason: DeclineReason };

function asRecordMap<T>(v: unknown): Record<string, T> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, T>) : {};
}
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Parse + validate a candidate file. **Writes NOTHING** — this runs before the confirm, and the
 * confirm runs before any write (AC-22). A corrupt / foreign / future file declines with a reason
 * from a CLOSED set; a raw parser message or a stack trace never reaches the user.
 */
export function parseArchive(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'unreadable' };
  }
  const o = raw as Record<string, unknown>;
  if (o.schema !== ARCHIVE_SCHEMA) return { ok: false, reason: 'not_ours' };
  if (typeof o.version !== 'number' || o.version > ARCHIVE_VERSION) {
    // Only a FUTURE version is declined — never half-read. A v1 file still parses (AC-60): the
    // trader's own backup must survive our storage reorganisation.
    return { ok: false, reason: 'version' };
  }
  const stores = asRecordMap<unknown>(o.stores);
  const ghost = asRecordMap<unknown>(stores.ghost_trade);
  const positions = asRecordMap<unknown>(stores.positions);
  const orders = asRecordMap<unknown>(stores.orders);
  // ANY `provenance` on the file is DROPPED HERE, at the parse, before it can reach a merge: an
  // imported provenance would claim a migration that did not happen on this device (AC-60).
  return {
    ok: true,
    envelope: {
      schema: ARCHIVE_SCHEMA,
      version: o.version,
      exported_at: typeof o.exported_at === 'string' ? o.exported_at : '',
      stores: {
        ghost_trade: {
          trades: asRecordMap<unknown>(ghost.trades),
          decisions: asArray<DecisionRecord>(ghost.decisions),
        },
        positions: {
          positions: asRecordMap<SimPosition | Position>(positions.positions),
          decisions: asArray<DecisionRecord>(positions.decisions),
        },
        orders: { orders: asRecordMap<SimOrder>(orders.orders) },
      },
    },
  };
}

// ---- Import: merge (the ONLY write) --------------------------------------------------------------

export interface ImportReport {
  added: number;
  /** Already here, byte-for-byte — skipped. */
  skipped: number;
  /** Same identity, DIFFERENT record — the existing record wins and the conflict is counted. */
  conflicts: number;
}

export type ImportResult = ({ ok: true } & ImportReport) | { ok: false; reason: DeclineReason };

/** Key-order-independent equality, so a round-tripped record compares equal to its original. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .toSorted()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

const same = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

/**
 * Merge an archive into the durable stores.
 *
 * Idempotency (AC-24) is by the §3.2 identity for decisions and by `id` for positions/orders, so
 * re-importing the same file adds nothing and changes nothing — and the readout, which is
 * RECOMPUTED from the stores rather than patched, therefore reports an identical counted N, identical
 * rates and an identical coverage statement. (A patched count would drift from the stores and break
 * the balance identity — the one thing the roll-up exists to guarantee.)
 *
 * Never throws. Declines — writing NOTHING — when a target store's blob could not be read, because
 * the store APIs would rewrite that unreadable blob and a corrupt blob must survive intact.
 */
export function importArchive(env: ArchiveEnvelope): ImportResult {
  // Guard BEFORE any write: the store `read()` paths degrade a corrupt blob to an empty in-memory
  // shape, so a write against a faulted store would silently REPLACE the unreadable blob. Refusing
  // is the only non-destructive answer (`[loss-free-durable-migration]`).
  const raw = readSources();
  if (!raw.ghost.ok || !raw.positions.ok || !raw.book.ok || !raw.orders.ok || ordersFaulted()) {
    return { ok: false, reason: 'store_unreadable' };
  }

  const report: ImportReport = { added: 0, skipped: 0, conflicts: 0 };
  const tally = (existing: unknown, incoming: unknown, add: () => void) => {
    if (existing === null || existing === undefined) {
      add();
      report.added += 1;
    } else if (same(existing, incoming)) {
      report.skipped += 1;
    } else {
      report.conflicts += 1; // the EXISTING record wins — nothing is overwritten
    }
  };

  try {
    // --- decisions (each log merges back into its own store; the split is not "fixed" here) ---
    const mergeDecisions = (
      incoming: DecisionRecord[],
      existing: DecisionRecord[],
      append: (d: DecisionRecord) => void,
    ) => {
      const index = new Map(existing.map((d) => [decisionIdentity(d), d]));
      for (const d of incoming) {
        if (!d || typeof d !== 'object') continue;
        const key = decisionIdentity(d);
        tally(index.get(key) ?? null, d, () => {
          append(d);
          index.set(key, d);
        });
      }
    };
    // ONE LOG. The second `appendDecision` is deleted (DECISION_QUEUE Q2 resolved), so a v1
    // envelope's two logs merge into the single positions log, de-duped by the ONE identity rule —
    // no drops, no doubles, no renumbering, no lost timestamps (AC-49).
    mergeDecisions(
      [...ghostSlot(env).decisions, ...env.stores.positions.decisions],
      [...allGhostDecisions(), ...allPositionDecisions()],
      appendPositionDecision,
    );

    // --- positions, from BOTH halves of a v1 envelope, through the IDENTICAL lift the store
    //     migration uses. ONE migrate function, two callers (SPEC §2.6): if they diverged,
    //     importing your own backup would produce different records than the migration did — a
    //     discrepancy nobody would notice until it mattered.
    //
    //     The ghost-trade half no longer has a store of its own to merge back into: its writer is
    //     deleted, and its records belong in the one book like everything else. Keyed by RECORD ID
    //     there, not by ticker, so two trades on one symbol are two positions (AC-46).
    for (const raw of [
      ...Object.values(env.stores.positions.positions),
      ...Object.values(ghostSlot(env).trades),
    ]) {
      const p = liftLegacyRecord(raw);
      if (p == null) continue;
      tally(getPosition(p.id), p, () => putPosition(p));
    }

    // --- orders ---
    for (const o of Object.values(env.stores.orders.orders)) {
      if (!o || typeof o.id !== 'string') continue;
      tally(getOrder(o.id), o, () => putOrder(o));
    }
  } catch {
    /* isolated: whatever merged, merged; nothing was deleted or overwritten either way */
  }

  return { ok: true, ...report };
}
