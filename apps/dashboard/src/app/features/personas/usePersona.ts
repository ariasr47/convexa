/**
 * usePersona — the persona brain. Owns the active selection + custom personas (client-local), and
 * the FE-assembled hand-off. Switching persona is a PURE client-state change: `assembleHandoff` is
 * synchronous, bundle-independent, and recomputed via useMemo — it triggers NO getTicker/streamTicker
 * and NO recompute of score/tier/gate/fingerprint.
 */
import type { Handoff, PersonaDefinition, PersonaRisk } from '@convexa/api';
import { useCallback, useMemo, useState } from 'react';
import { GENERIC_RISK_CALIBRATION, PRESETS, presetById } from './presets';
import {
  loadActiveId,
  loadCustoms,
  newPersonaId,
  removeCustom,
  saveActiveId,
  upsertCustom,
} from './store';
import { assembleHandoff } from './template';

export interface CustomDraft {
  name: string;
  basedOn: string; // preset id
  risk: PersonaRisk;
  reassessment_lean: string;
  emphasis_note: string;
}

export function usePersona() {
  const [customs, setCustoms] = useState<PersonaDefinition[]>(() => loadCustoms());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId()); // null ⇒ Default

  const personas = useMemo(() => [...PRESETS, ...customs], [customs]);
  const active = useMemo(
    () => personas.find((p) => p.id === (activeId ?? 'default')) ?? PRESETS[0],
    [personas, activeId],
  );

  // Pure, synchronous, bundle-independent → recomputes ONLY on a persona change, no network.
  const handoff: Handoff = useMemo(() => assembleHandoff(active), [active]);

  const setActive = useCallback((id: string) => {
    const v = id === 'default' ? null : id;
    setActiveId(v);
    saveActiveId(v);
  }, []);

  const saveCustom = useCallback(
    (draft: CustomDraft, existingId?: string): string => {
      const base = presetById(draft.basedOn) ?? PRESETS[0];
      const id = existingId ?? newPersonaId();
      const persona: PersonaDefinition = {
        id,
        name: draft.name.trim() || `${base.name} (custom)`,
        builtin: false,
        version: 1,
        objective: base.objective,
        risk: draft.risk,
        reassessment_lean: draft.reassessment_lean,
        emphasis_note: draft.emphasis_note.trim() || null,
        dte_pref: base.dte_pref ?? null,
        summary: `Custom — based on ${base.name}.`,
        objective_framing: base.objective_framing,
        // Risk text follows the (possibly overridden) risk level.
        risk_calibration: GENERIC_RISK_CALIBRATION[draft.risk],
        based_on: base.id,
      };
      setCustoms(upsertCustom(persona));
      setActive(id);
      return id;
    },
    [setActive],
  );

  const deleteCustom = useCallback(
    (id: string) => {
      setCustoms(removeCustom(id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  return {
    personas,
    presets: PRESETS,
    customs,
    active,
    activeId: activeId ?? 'default',
    isDefault: (activeId ?? 'default') === 'default',
    handoff,
    setActive,
    saveCustom,
    deleteCustom,
  };
}
