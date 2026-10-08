/**
 * Client-local durable store for the positions portfolio — **`convexa.positions.v3`**, the ONE book
 * both pages read. Backed by localStorage (working cache), versioned, exportable. Signed-in clients
 * also sync the opaque v3 blob via GET/PUT `/api/book` (`bookSync.ts`, latest-wins by touch time).
 *
 * ── THE CUTOVER (SPEC §2.6) ──────────────────────────────────────────────────────────────────────
 * v3 is reached by a **UNION**, not the shipped read-new-else-old chain:
 *
 *   if convexa.positions.v3 exists  -> it ALONE is authoritative; NO source is consulted. Done.
 *   else, read ALL of: positions.v2 (either brand), ghost-trade.v1 (either brand)
 *     -> lift each record through the ONE lift, union by record id, keep-first v2-before-v1
 *     -> union decisions by decisionIdentity()
 *     -> write ONE v3 blob carrying provenance, in a SINGLE setItem
 *     -> delete nothing, ever
 *
 * FOUR THINGS THAT MUST NOT GO WRONG, and where each is enforced:
 *
 *  1. **THE UNION RUNS EXACTLY ONCE.** A repeated union is a RESURRECTION MACHINE — a record the
 *     trader closed or removed in v3 comes back out of a source blob. Enforced by the first branch
 *     of `read()`: once the v3 key exists, no source is read again, for any reason. Corrupt or
 *     absent provenance NEVER re-arms it (provenance is non-load-bearing by construction: it is
 *     never an input to P/L, grouping, the recogniser, the ledger or the archive's record set, so it
 *     can cost at most one notice and never a record). The residual hole — a stale tab on the
 *     pre-v3 build writing a NEW v1 record — is closed structurally in this same release:
 *     `useGhostTrade` and every `model/store` write path are DELETED.
 *  2. **THE PROMOTE ABORTS ENTIRELY** if any source is unreadable. A partial v3 would freeze a
 *     truncated history behind a key that claims completeness, and writing v3 permanently stops the
 *     read path from consulting sources. A migration that half-succeeds is worse than one that does
 *     not run.
 *  3. **A LOGICAL SOURCE IS ONE SOURCE.** `resolveDurable` promotes a legacy-brand blob to the new
 *     key BEFORE anything parses it, so an unparseable `gammaflow.positions.v2` leaves the same
 *     corrupt bytes under `convexa.positions.v2`. Resolve FIRST, then hand the union exactly one
 *     entry per store — never one per physical key, or `unread_sources` reports two failures for one
 *     blob and `source_counts` misreports provenance.
 *  4. **NEVER-DELETE IS THE BACKUP.** No delete path, no prune, no compaction, no "clean up the old
 *     keys" step. The untouched v2/v1 blobs ARE the rollback.
 *
 * FAULT LATCH (`positionsHealth()`, SPEC §2.9/§2.10, AC-56/AC-61): when a blob does not parse the
 * store degrades to empty/partial in memory AND refuses every durable write, so the
 * unparseable-but-possibly-recoverable blob is left byte-identical. Determination is SYNCHRONOUS at
 * hydration (localStorage is synchronous), so no frame paints enabled affordances on a faulted
 * store, and mutators return `false` as the second line of defence.
 */
import { resolveDurable } from '@/shared/lib/durable/resolveDurable';
import { dataMode, demoStorageKey, demoNowMs } from '@convexa/api';
import { defaultCustomization } from './defaults';
import type { SimPosition } from './leg';
import { liftLegacyRecord, unionSources, type ParsedSource } from './migrate';
import {
  CustomizationState,
  DecisionRecord,
  PersistShapeV3,
  PORTFOLIO_SCHEMA_VERSION,
  PositionId,
  Provenance,
  StoreHealth,
} from './types';

// The current-brand durable keys. The legacy `gammaflow.*` keys are retained ONLY as migration
// sources for `resolveDurable` (read-new-else-old, promote forward, NEVER delete old).
const V3_KEY = 'convexa.positions.v3';
const V2_KEY = 'convexa.positions.v2';
const V1_KEY = 'convexa.ghost-trade.v1';
const LEGACY_V2_KEY = 'gammaflow.positions.v2';
const LEGACY_V1_KEY = 'gammaflow.ghost-trade.v1';

/** The LOGICAL source labels the union accounts by — one per store, never per physical key. */
const SOURCE_V2 = V2_KEY;
const SOURCE_V1 = V1_KEY;

function empty(): PersistShapeV3 {
  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: {},
    decisions: [],
    customization: defaultCustomization(),
  };
}

let memory: PersistShapeV3 | null = null; // fallback / cache
/** Set SYNCHRONOUSLY by read() (SPEC §2.9); no frame ever paints on a stale value. */
let faulted = false;
/** The LOGICAL storage keys that failed to read this hydration. */
let unreadSources: string[] = [];

// ---- External-store subscription (the `orders/store.ts` seam, copied verbatim) -------------------
// AC-70/AC-71: a position opened on the Ticker page must appear in the portfolio, and a close on the
// Positions page must reflect on the Ticker page, WITHOUT a reload. `model/store.ts` had no
// subscription seam; the one book needs one, and both pages subscribe.

let version = 0;
const listeners = new Set<() => void>();

export function subscribePositions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPositionsVersion(): number {
  return version;
}

function notify() {
  version += 1;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a bad listener never breaks the store */
    }
  });
}

// ---- Hydration ----------------------------------------------------------------------------------

function hydrateCustomization(c: CustomizationState | undefined): CustomizationState {
  const d = defaultCustomization();
  if (!c || !Array.isArray(c.views) || c.views.length === 0 || !c.working) return d;
  // Ensure the seeded default view always exists (a corrupt list shouldn't lose the default).
  const hasDefault = c.views.some((v) => v.builtin);
  const views = hasDefault ? c.views : [d.views[0], ...c.views];
  const activeViewId = views.some((v) => v.id === c.activeViewId) ? c.activeViewId : d.activeViewId;
  return { views, activeViewId, working: c.working };
}

/**
 * Provenance is NON-LOAD-BEARING BY CONSTRUCTION. Anything unrecognised reads as ABSENT: records
 * stay authoritative, the migration is never re-armed, the read never fails, and the merge notice is
 * suppressed (fail-closed — showing a merge notice to a trader whose merge state is unknown is a
 * false claim; suppressing it costs one informational message).
 */
function hydrateProvenance(raw: unknown): Provenance | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.migrated_at !== 'string') return undefined;
  const counts: Provenance['source_counts'] = {};
  if (r.source_counts != null && typeof r.source_counts === 'object') {
    for (const [k, v] of Object.entries(r.source_counts as Record<string, unknown>)) {
      if (v == null || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      counts[k] = {
        read: typeof e.read === 'number' ? e.read : 0,
        contributed: typeof e.contributed === 'number' ? e.contributed : 0,
      };
    }
  }
  return {
    migrated_at: r.migrated_at,
    source_counts: counts,
    merge_notice_dismissed: r.merge_notice_dismissed === true,
  };
}

/**
 * One record out of a parsed v3 blob. A well-formed v3 record is kept VERBATIM. A record that
 * somehow has no `legs` is LIFTED rather than dropped — `loss-free` beats tidy, and the lift is the
 * same one the migration and the archive import use.
 */
function hydrateV3Position(raw: unknown): SimPosition | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  if (Array.isArray(r.legs) && r.legs.length > 0) return r as unknown as SimPosition;
  const lifted = liftLegacyRecord(r);
  if (lifted == null) return null;
  if (typeof r.opened_time === 'string') lifted.opened_time = r.opened_time;
  return lifted;
}

function hydrateV3(raw: Partial<PersistShapeV3>): PersistShapeV3 {
  const positions: Record<PositionId, SimPosition> = {};
  if (raw.positions && typeof raw.positions === 'object') {
    for (const value of Object.values(raw.positions as Record<string, unknown>)) {
      const p = hydrateV3Position(value);
      if (p != null) positions[p.id] = p;
    }
  }
  const provenance = hydrateProvenance((raw as Record<string, unknown>).provenance);
  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions,
    decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
    customization: hydrateCustomization(raw.customization),
    ...(provenance ? { provenance } : {}),
  };
}

// ---- The union promote --------------------------------------------------------------------------

interface LogicalSource {
  parsed: ParsedSource;
  /** The v2 blob's customization, when this source is the v2 store and it read. */
  customization?: CustomizationState;
}

/**
 * Read ONE LOGICAL SOURCE across both brand keys.
 *
 * `resolveDurable` is the right helper for a RENAME and is used here for exactly that — the brand
 * hop — and NOTHING else. It runs BEFORE any parse, so the two brand keys are already two names for
 * one blob by the time this returns; the caller hands the union a single entry, so `unread_sources`
 * and `source_counts` count that blob once.
 */
function readLogicalSource(
  key: string,
  legacyKey: string,
  label: string,
  recordsOf: (blob: Record<string, unknown>) => unknown,
): LogicalSource {
  let rawText: string | null = null;
  try {
    rawText = resolveDurable(key, legacyKey);
  } catch {
    // Storage unavailable is an INCOMPLETE read, never an empty one.
    return { parsed: { key: label, ok: false, records: [], decisions: [] } };
  }
  // An ABSENT blob is a COMPLETE read of nothing — it must not abort the promote.
  if (rawText == null) return { parsed: { key: label, ok: true, records: [], decisions: [] } };
  try {
    const blob = JSON.parse(rawText) as Record<string, unknown>;
    const map = recordsOf(blob);
    const records = map != null && typeof map === 'object' ? Object.values(map) : [];
    const decisions = Array.isArray(blob.decisions) ? blob.decisions : [];
    const customization = blob.customization as CustomizationState | undefined;
    return { parsed: { key: label, ok: true, records, decisions }, customization };
  } catch {
    // Corrupt ⇒ UNREAD. The blob is left exactly as it is, under both brand keys.
    return { parsed: { key: label, ok: false, records: [], decisions: [] } };
  }
}

function read(): PersistShapeV3 {
  if (memory) return memory;
  // Cleared BEFORE anything below, never after: `write()` consults the latch, and the promote at the
  // bottom of this function goes through it.
  faulted = false;
  unreadSources = [];

  // ── 1. v3 exists ⇒ IT ALONE IS AUTHORITATIVE. No source is consulted, ever again. ──────────────
  let rawV3: string | null = null;
  try {
    rawV3 = localStorage.getItem(demoStorageKey(V3_KEY));
  } catch {
    // Storage unavailable: refuse every write rather than run a migration we cannot persist.
    memory = empty();
    faulted = true;
    unreadSources = [V3_KEY];
    return memory;
  }
  if (rawV3 != null) {
    try {
      memory = hydrateV3(JSON.parse(rawV3) as Partial<PersistShapeV3>);
    } catch {
      // The v3 blob itself failed to parse. Sources are NOT consulted (v3 exists — consulting them
      // now would be the resurrection this design forbids) and NOTHING is written.
      memory = empty();
      faulted = true;
      unreadSources = [V3_KEY];
    }
    return memory;
  }

  // ── 2. No v3 ⇒ the union runs, ONCE. ──────────────────────────────────────────────────────────
  const v2 = readLogicalSource(demoStorageKey(V2_KEY), demoStorageKey(LEGACY_V2_KEY), SOURCE_V2, (b) => b.positions);
  const v1 = readLogicalSource(demoStorageKey(V1_KEY), demoStorageKey(LEGACY_V1_KEY), SOURCE_V1, (b) => b.trades);
  // EXACTLY TWO ParsedSource entries reach the union, never four. Order IS source precedence.
  const union = unionSources([v2.parsed, v1.parsed]);
  const customization = hydrateCustomization(v2.customization);

  if (union.aborted) {
    // ABORT ENTIRELY. The store runs in memory from whatever parsed; every durable write is refused;
    // every source blob is left byte-identical. No partial v3 is ever written.
    memory = {
      schema_version: PORTFOLIO_SCHEMA_VERSION,
      positions: union.positions,
      decisions: union.decisions,
      customization,
    };
    faulted = true;
    unreadSources = union.unread_sources;
    return memory;
  }

  const promoted: PersistShapeV3 = {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: union.positions,
    decisions: union.decisions,
    customization,
    provenance: {
      migrated_at: new Date(dataMode === 'demo' ? demoNowMs() : Date.now()).toISOString(),
      source_counts: union.source_counts,
      merge_notice_dismissed: false,
    },
  };
  memory = promoted;
  // THE PROMOTE-WRITE RUNS EVEN WHEN THERE ARE NO SOURCES (all counts zero). Deferring it leaves the
  // union path armed indefinitely, so a source blob appearing later — a stale tab, a restored
  // profile — would be unioned in at an unpredictable moment. ONE setItem: `setItem` is
  // all-or-nothing, so either the whole v3 blob lands or none of it does, and the sources are
  // untouched either way (the migration simply retries on the next load).
  write(promoted);
  return memory;
}

function write(s: PersistShapeV3): boolean {
  if (positionsFaulted()) return false; // NEVER overwrite a readable-but-unparseable prior blob
  memory = s;
  try {
    localStorage.setItem(demoStorageKey(V3_KEY), JSON.stringify(s));
    localStorage.setItem(demoStorageKey(BOOK_TOUCH_KEY), String((dataMode === 'demo' ? demoNowMs() : Date.now()) / 1000));
  } catch {
    /* quota/private mode — keep the in-memory copy this session */
  }
  notify();
  // Best-effort multi-device push (signed-in only; no-op when offline/anonymous).
  scheduleBookPush();
  return true;
}

/** Client clock of last local durable write (seconds). Used for multi-device latest-wins. */
const BOOK_TOUCH_KEY = 'convexa.positions.touch_at';

/** Opaque v3 blob for server sync (multi-device). */
export function exportBookBlob(): PersistShapeV3 {
  return read();
}

export function localBookTouchAt(): number {
  try {
    const t = Number(localStorage.getItem(demoStorageKey(BOOK_TOUCH_KEY)) ?? '0');
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

/**
 * Adopt a server blob when it is newer than the local touch (or local is empty).
 * Does not re-arm the v3 migration — writes v3 directly.
 */
export function importBookBlobIfNewer(blob: unknown, serverUpdatedAt: number): boolean {
  if (positionsFaulted()) return false;
  if (blob == null || typeof blob !== 'object' || Array.isArray(blob)) return false;
  const localTouch = localBookTouchAt();
  const local = read();
  const localEmpty = Object.keys(local.positions).length === 0;
  if (!localEmpty && serverUpdatedAt < localTouch) return false;
  const next = hydrateV3(blob as Partial<PersistShapeV3>);
  memory = next;
  try {
    localStorage.setItem(demoStorageKey(V3_KEY), JSON.stringify(next));
    if (serverUpdatedAt > 0 && dataMode !== 'demo') localStorage.setItem(demoStorageKey(BOOK_TOUCH_KEY), String(serverUpdatedAt));
  } catch {
    /* keep memory */
  }
  notify();
  return true;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleBookPush() {
  if (dataMode === 'demo') return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void import('./bookSync').then((m) => m.pushLocalBook()).catch(() => undefined);
  }, 800);
}

/** Is the durable store faulted? Reading forces hydration so the answer is always current. */
export function positionsFaulted(): boolean {
  read();
  return faulted;
}

/**
 * Fault state on the READ path, alongside the records (SPEC §2.9) — returned on the same object the
 * view layer already reads, so the state cannot be dropped by a caller forgetting to inspect a
 * return value.
 */
export function positionsHealth(): StoreHealth {
  read();
  return { faulted, unread_sources: [...unreadSources] };
}

// ---- Provenance + the merge notice ---------------------------------------------------------------

export function getProvenance(): Provenance | null {
  return read().provenance ?? null;
}

/**
 * The merge notice appears ONLY for a trader who actually had items in BOTH places. Absent or
 * corrupt provenance ⇒ suppressed (fail-closed). The notice itself states NO counts at all (SPEC §4
 * ruling 2); the counts stay in provenance, inspectable for support, out of the trader's read.
 */
export function shouldShowMergeNotice(): boolean {
  const p = getProvenance();
  if (p == null || p.merge_notice_dismissed) return false;
  const contributing = Object.values(p.source_counts).filter((c) => c.contributed > 0);
  return contributing.length >= 2;
}

export function dismissMergeNotice(): boolean {
  const s = read();
  if (faulted || s.provenance == null) return false;
  return write({ ...s, provenance: { ...s.provenance, merge_notice_dismissed: true } });
}

// ---- Positions ---------------------------------------------------------------------------------

export function allPositions(): SimPosition[] {
  return Object.values(read().positions);
}

export function getPosition(id: PositionId): SimPosition | null {
  return read().positions[id] ?? null;
}

/** Returns false when the store is faulted (nothing written, nothing partial). */
export function putPosition(p: SimPosition): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, positions: { ...s.positions, [p.id]: p } });
}

export function removePosition(id: PositionId): boolean {
  const s = read();
  if (faulted) return false;
  const positions = { ...s.positions };
  delete positions[id];
  return write({ ...s, positions });
}

// ---- Decisions ---------------------------------------------------------------------------------

/** THE one decision log (DECISION_QUEUE Q2 resolved — the second `appendDecision` is deleted). */
export function appendDecision(rec: DecisionRecord): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, decisions: [...s.decisions, rec] });
}

/** Records for one position, newest first. */
export function decisionsForPosition(id: PositionId): DecisionRecord[] {
  return read()
    .decisions.filter((d) => d.trade_id === id)
    .reverse();
}

/** The full append-only log, oldest first (feeds the orders Export JSON — a read, never a write). */
export function allDecisions(): DecisionRecord[] {
  return read().decisions;
}

// ---- Customization -----------------------------------------------------------------------------

export function getCustomization(): CustomizationState {
  return read().customization;
}

export function putCustomization(c: CustomizationState): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, customization: c });
}

// ---- Misc --------------------------------------------------------------------------------------

export function newId(): string {
  return crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage. */
export function __resetMemory() {
  memory = null;
  faulted = false;
  unreadSources = [];
}

export const PORTFOLIO_V1_KEY = V1_KEY;
export const PORTFOLIO_V2_KEY = V2_KEY;
export const PORTFOLIO_V3_KEY = V3_KEY;
export const PORTFOLIO_LEGACY_V1_KEY = LEGACY_V1_KEY;
export const PORTFOLIO_LEGACY_V2_KEY = LEGACY_V2_KEY;
