/**
 * The demo build's forecast ledger (libs/api demo research-ledger.ts): the six sample notes' calls on
 * the Oct 7, 2026 scenario with an authored scored history. Loaded once and shared by the Scorecard
 * and the Research tabs' badge; the live build never asks for it.
 */
import { dataMode, loadSampleLedger, type SampleLedger } from '@convexa/api';
import { useEffect, useState } from 'react';

let pending: Promise<SampleLedger | null> | null = null;

function load(): Promise<SampleLedger | null> {
  pending ??= loadSampleLedger().then((r) => (r.state === 'ready' ? r.value : null));
  return pending;
}

/** `undefined` while loading (or in the live build), `null` if it failed. */
export function useSampleLedger(): SampleLedger | null | undefined {
  const [ledger, setLedger] = useState<SampleLedger | null | undefined>(undefined);
  useEffect(() => {
    if (dataMode !== 'demo') return;
    let alive = true;
    void load().then((l) => {
      if (alive) setLedger(l);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ledger;
}
