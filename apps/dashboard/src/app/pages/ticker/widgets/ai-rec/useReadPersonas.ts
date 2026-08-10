/**
 * Canonical persona list for the AI-rec read picker (GET /api/personas with embedded fallback).
 */
import type { PersonaDefinition } from '@convexa/api';
import { fetchPersonas } from '@convexa/api';
import { useEffect, useRef, useState } from 'react';

/** Canonical persona source with the FE embed as the offline / assembly-failure fallback (E7).
 *  Tries `GET /api/personas` once; on any fault, keeps the embedded presets. Non-blocking. */
export function useReadPersonas(embedded: PersonaDefinition[]): {
  personas: PersonaDefinition[];
  canonical: boolean;
} {
  const embeddedRef = useRef(embedded);
  embeddedRef.current = embedded;
  const [personas, setPersonas] = useState<PersonaDefinition[]>(embedded);
  const [canonical, setCanonical] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchPersonas()
      .then((list) => {
        if (!cancelled) {
          setPersonas(list);
          setCanonical(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonas(embeddedRef.current);
          setCanonical(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { personas, canonical };
}
