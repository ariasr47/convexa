/**
 * Client-local UI prefs (theme + default ticker) — the ANONYMOUS source of truth (AC-A3/F3). Mirrors
 * the personas store's guarded-localStorage pattern. The active-persona pref is owned by the EXISTING
 * personas store (`convexa.personas.v1`) and is read/written there — this store covers only the two
 * prefs that had no client-local home before (theme, default ticker).
 *
 * Precedence (D7): signed-in ⇒ the SERVER settings win (these locals are not applied). Anonymous ⇒
 * these locals are the only source. We never write the server value back into here on login (that
 * would break per-account isolation, AC-F2).
 */
import type { ThemePref } from '@org/api';
import { SETTINGS_DEFAULTS } from './copy';
import { resolveDurable } from '../durable/resolveDurable';

const KEY = 'convexa.uiprefs.v1';
const LEGACY_KEY = 'gammaflow.uiprefs.v1';
const SCHEMA_VERSION = 1;

interface PersistShape {
  schema_version: number;
  theme: ThemePref;
  default_ticker: string | null;
}

const empty = (): PersistShape => ({
  schema_version: SCHEMA_VERSION, theme: SETTINGS_DEFAULTS.theme, default_ticker: null,
});

let memory: PersistShape | null = null;

function read(): PersistShape {
  if (memory) return memory;
  try {
    const raw = resolveDurable(KEY, LEGACY_KEY);
    memory = raw ? { ...empty(), ...(JSON.parse(raw) as PersistShape) } : empty();
  } catch { memory = empty(); }
  return memory;
}

function write(s: PersistShape) {
  memory = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* in-memory only */ }
}

export function loadLocalTheme(): ThemePref { return read().theme; }
export function saveLocalTheme(theme: ThemePref) { write({ ...read(), theme }); }

export function loadLocalDefaultTicker(): string | null { return read().default_ticker; }
export function saveLocalDefaultTicker(t: string | null) {
  write({ ...read(), default_ticker: t && t.trim() ? t.trim().toUpperCase() : null });
}

/** Test seam — reset the in-memory cache (the persisted layer is cleared by the test's localStorage). */
export function __resetLocalPrefs() { memory = null; }

export const UIPREFS_KEY = KEY;
export const UIPREFS_LEGACY_KEY = LEGACY_KEY;
