/**
 * Client-local persona store: custom personas + the active selection, persisted across reload.
 * Built-in presets live in code (read-only); the server stores none of this. Guarded so a storage
 * failure degrades to in-memory only and never throws into the UI.
 */
import type { PersonaDefinition } from '@org/api';
import { resolveDurable } from '../durable/resolveDurable';

const KEY = 'convexa.personas.v1';
const LEGACY_KEY = 'gammaflow.personas.v1';
const SCHEMA_VERSION = 1;

interface PersistShape {
  schema_version: number;
  customs: PersonaDefinition[];
  active_persona_id: string | null; // null ⇒ Default (no persona)
}

const empty = (): PersistShape => ({ schema_version: SCHEMA_VERSION, customs: [], active_persona_id: null });
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

export function loadCustoms(): PersonaDefinition[] { return read().customs; }
export function loadActiveId(): string | null { return read().active_persona_id; }

export function saveActiveId(id: string | null) { write({ ...read(), active_persona_id: id }); }

export function upsertCustom(p: PersonaDefinition): PersonaDefinition[] {
  const s = read();
  const customs = [...s.customs.filter((c) => c.id !== p.id), p];
  write({ ...s, customs });
  return customs;
}
export function removeCustom(id: string): PersonaDefinition[] {
  const s = read();
  const customs = s.customs.filter((c) => c.id !== id);
  const active_persona_id = s.active_persona_id === id ? null : s.active_persona_id;
  write({ ...s, customs, active_persona_id });
  return customs;
}

export function newPersonaId(): string {
  return (crypto?.randomUUID?.() ?? `persona-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage. */
export function __resetPersonas() { memory = null; }

export const PERSONAS_KEY = KEY;
export const PERSONAS_LEGACY_KEY = LEGACY_KEY;
