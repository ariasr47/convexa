import type { RecCap, RecResponse, RiskInputs } from '@convexa/api';
import { riskInputsSuperseded } from './literals';

export type AiRecRequestState =
  | 'idle'
  | 'loading'
  | 'signed_out'
  | 'missing_key'
  | 'shared_allowance_exhausted'
  | 'shared_key_unavailable'
  | 'cooldown'
  | 'daily_cap'
  | 'no_edge'
  | 'unavailable';
export type AiRecResultState =
  | 'fresh_trade'
  | 'no_trade'
  | 'stale_newer_snapshot'
  | 'stale_at_generation'
  | 'superseded_inputs'
  | 'incomplete_trade';
export type MissingPositionField = 'Structure' | 'Strike(s)' | 'Expiration' | 'Entry trigger';

export interface PresentationInput {
  rec: RecResponse | null;
  loading: boolean;
  stale: boolean;
  signedIn: boolean;
  canCreateOrder: boolean;
  inAppEnabled: boolean;
  cap: RecCap;
  cooldownRemaining: number;
  effectiveGateState: string;
  scenarioSelected: boolean;
  currentRiskInputs: RiskInputs | null | undefined;
}

export interface AiRecPresentation {
  requestState: AiRecRequestState;
  resultState: AiRecResultState | null;
  missingPositionFields: MissingPositionField[];
  actions: {
    directExport: boolean;
    analyze: boolean;
    askAnyway: boolean;
    retry: boolean;
    settings: boolean;
    signIn: boolean;
    reviewTrade: boolean;
    createOrder: boolean;
    analysis: boolean;
    refresh: boolean;
    dismiss: boolean;
  };
}

function missingFields(rec: RecResponse | null): MissingPositionField[] {
  const strategy = rec?.strategy;
  if (!strategy || strategy.decision !== 'trade') return [];
  const missing: MissingPositionField[] = [];
  if (!strategy.structure?.trim()) missing.push('Structure');
  if (!strategy.strikes.some(Number.isFinite)) missing.push('Strike(s)');
  if (!strategy.expiration?.trim()) missing.push('Expiration');
  if (!strategy.entry_trigger?.trim()) missing.push('Entry trigger');
  return missing;
}

function responseKeyState(rec: RecResponse | null): AiRecRequestState | null {
  if (!rec || rec.status !== 'unavailable') return null;
  switch (rec.unavailable_reason) {
    case 'no_key':
      return 'missing_key';
    case 'over_limit':
      return 'shared_allowance_exhausted';
    case 'shared_key_unconfigured':
      return 'shared_key_unavailable';
    default:
      return 'unavailable';
  }
}

export function deriveAiRecPresentation(input: PresentationInput): AiRecPresentation {
  const { rec, loading, signedIn, scenarioSelected } = input;
  const produced = rec?.status === 'produced' && rec.strategy != null;
  const missingPositionFields = missingFields(rec);
  const superseded =
    produced && rec?.strategy?.decision === 'trade'
      ? riskInputsSuperseded(rec.sent?.risk_inputs, input.currentRiskInputs)
      : false;

  let requestState: AiRecRequestState;
  if (loading) requestState = 'loading';
  else if (!signedIn) requestState = 'signed_out';
  else
    requestState =
      responseKeyState(rec) ??
      (!input.inAppEnabled && !scenarioSelected ? 'missing_key' : null) ??
      (input.cap.over_limit && !scenarioSelected ? 'daily_cap' : null) ??
      (input.cooldownRemaining > 0 && !scenarioSelected ? 'cooldown' : null) ??
      (input.effectiveGateState === 'no_fresh_edge' ? 'no_edge' : null) ??
      'idle';

  let resultState: AiRecResultState | null = null;
  if (produced) {
    if (input.stale) resultState = 'stale_newer_snapshot';
    else if (rec!.stale_born) resultState = 'stale_at_generation';
    else if (superseded) resultState = 'superseded_inputs';
    else if (rec!.strategy!.decision === 'no_trade') resultState = 'no_trade';
    else if (missingPositionFields.length > 0) resultState = 'incomplete_trade';
    else resultState = 'fresh_trade';
  }

  const degraded =
    resultState === 'stale_newer_snapshot' ||
    resultState === 'stale_at_generation' ||
    resultState === 'superseded_inputs' ||
    resultState === 'incomplete_trade';
  const keyState =
    requestState === 'missing_key' ||
    requestState === 'shared_allowance_exhausted' ||
    requestState === 'shared_key_unavailable';
  const unavailableRetryGate =
    requestState === 'unavailable' &&
    signedIn &&
    input.inAppEnabled &&
    (scenarioSelected ||
      (input.effectiveGateState === 'available' &&
        input.cooldownRemaining <= 0 &&
        !input.cap.over_limit));

  return {
    requestState,
    resultState,
    missingPositionFields,
    actions: {
      // Anonymous users retain the existing export floor even when a produced response is pinned;
      // the host's signed-out branch suppresses every result/recovery control.
      directExport: !signedIn || loading || !produced,
      analyze: !loading && requestState === 'idle' && !produced,
      askAnyway: !loading && requestState === 'no_edge',
      retry: !loading && ((degraded && requestState === 'idle') || unavailableRetryGate),
      settings: !loading && keyState && requestState !== 'signed_out',
      signIn: !loading && requestState === 'signed_out',
      reviewTrade: !loading && resultState === 'fresh_trade' && signedIn,
      // The policy owns both fresh-result and auth actionability; the host only applies the
      // callback capability when consuming this one boolean.
      createOrder: !loading && resultState === 'fresh_trade' && signedIn && input.canCreateOrder,
      analysis: !loading && produced,
      refresh: !loading && degraded && requestState === 'idle',
      dismiss: !loading && produced,
    },
  };
}
