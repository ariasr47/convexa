/**
 * Client-local recent tickers for the Command Deck Quick row (recent-ticker-chips).
 *
 * Durable key: `convexa.recent-tickers.v1` (new — no brand migration).
 * Pins are a closed code constant. Every visit is stored MRU, pins included, so the ⌘K jump box's
 * “Recent” group (`listRecentVisits`) shows the pinned tickers you opened too; the Quick row's
 * `listRecents` leaves the pins out (it always shows them) and stays capped at 8.
 * Corrupt/unreadable → empty in-memory; original blob left intact until a successful write.
 * Never throws into the UI. Never a scoring input.
 */
import { demoStorageKey } from '@convexa/api';

const KEY = 'convexa.recent-tickers.v1';
const SCHEMA_VERSION = 1;
export const MAX_RECENTS = 8;
export const PINNED_TICKERS = ['SPY', 'QQQ', 'NVDA'] as const;
export type PinnedTicker = (typeof PINNED_TICKERS)[number];
/** Room for every pin on top of MAX_RECENTS, so the Quick row never loses a recent to a pin. */
const MAX_STORED = MAX_RECENTS + PINNED_TICKERS.length;

interface PersistShape {
  schema_version: number;
  /** Uppercase symbols, most-recent-first, pins included. */
  symbols: string[];
}

const empty = (): PersistShape => ({
  schema_version: SCHEMA_VERSION,
  symbols: [],
});

const PIN_SET = new Set<string>(PINNED_TICKERS);

let memory: PersistShape | null = null;
let faulted = false;

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function read(): PersistShape {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(demoStorageKey(KEY));
    if (raw == null) {
      memory = empty();
      faulted = false;
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    if (!parsed || !Array.isArray(parsed.symbols)) throw new Error('malformed recents');
    const symbols = Array.isArray(parsed.symbols)
      ? parsed.symbols
          .filter((s): s is string => typeof s === 'string')
          .map(normalize)
          .filter((s) => s)
      : [];
    // de-dupe preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const s of symbols) {
      if (seen.has(s)) continue;
      seen.add(s);
      deduped.push(s);
    }
    memory = {
      schema_version: SCHEMA_VERSION,
      symbols: deduped.slice(0, MAX_STORED),
    };
    faulted = false;
  } catch {
    // Corrupt → empty in memory; do NOT removeItem (leave original blob).
    memory = empty();
    faulted = true;
  }
  return memory;
}

function write(s: PersistShape) {
  if (faulted) return;
  memory = s;
  try {
    localStorage.setItem(demoStorageKey(KEY), JSON.stringify(s));
  } catch {
    /* in-memory only (quota / private mode) */
  }
}

/** Recents only (no pins), for the Quick row. Most-recent-first, at most MAX_RECENTS. */
export function listRecents(): string[] {
  return read()
    .symbols.filter((s) => !PIN_SET.has(s))
    .slice(0, MAX_RECENTS);
}

/** Every ticker opened, pins included, most-recent-first — the ⌘K jump box's “Recent” group. */
export function listRecentVisits(limit: number = MAX_STORED): string[] {
  // Re-read storage on each ⌘K open, so visits made in another tab show here (Wave 2 review);
  // recordVisit then writes on top of the fresh list, not this tab's stale copy.
  memory = null;
  faulted = false;
  return read().symbols.slice(0, Math.max(0, limit));
}

/**
 * Record a successful navigation to `symbol`. Blank → no-op. Self-de-dupes to front. Caps at
 * MAX_STORED, which leaves MAX_RECENTS non-pins however many pins were opened.
 */
export function recordVisit(symbol: string): void {
  const s = normalize(symbol);
  if (!s) return;
  const prev = read().symbols.filter((x) => x !== s);
  write({
    schema_version: SCHEMA_VERSION,
    symbols: [s, ...prev].slice(0, MAX_STORED),
  });
}

/** Test seam — drop in-memory cache so the next read re-hydrates from localStorage. */
export function __resetRecentTickers(): void {
  memory = null;
  faulted = false;
}

export const RECENT_TICKERS_KEY = KEY;
