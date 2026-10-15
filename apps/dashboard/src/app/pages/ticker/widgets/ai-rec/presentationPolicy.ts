import type { RecCap, RecResponse, RiskInputs } from '@convexa/api';
import { riskInputsSuperseded } from './literals';

/** no-vendor-production-posture F4 — the FE-synthesized `unavailable_reason`
 *  (`useAiRecommendation.ts`'s status-fetch catch) for a `market_data_paused` fault. NOT a wire
 *  value on this field; a sentinel this module and `AiRecPanelBlocks.tsx` both recognize so the
 *  panel renders honest copy with no Retry, instead of the generic "Couldn’t get a read". */
export const MARKET_DATA_PAUSED_REASON = 'market_data_paused';

export type AiRecRequestState =
  | 'idle'
  | 'loading'
  | 'signed_out'
  | 'missing_key'
  | 'key_unusable'
  | 'key_rejected'
  | 'model_not_in_catalog'
  | 'model_unset'
  | 'oauth_expired'
  | 'oauth_unlinked'
  | 'subscription_unavailable'
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
  readinessGateState: 'available' | 'no_fresh_edge';
  scenarioSelected: boolean;
  currentRiskInputs: RiskInputs | null | undefined;
  /** Status `powering.unavailable_reason` — drives idle setup/replace blocks before an ask. */
  poweringReason?: string | null;
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

/** Map a closed powering / rec unavailable_reason. `over_limit` is NOT a powering CTA (daily cap
 *  is `cap.over_limit`). Retired free-uses reasons fall through to generic unavailable. */
export function poweringRequestState(reason: string | null | undefined): AiRecRequestState | null {
  switch (reason) {
    case 'no_key':
      return 'missing_key';
    case 'key_unusable':
      return 'key_unusable';
    case 'key_rejected':
      return 'key_rejected';
    case 'model_not_in_catalog':
    case 'model_missing':
      return 'model_not_in_catalog';
    case 'model_unset':
      return 'model_unset';
    case 'oauth_expired':
      return 'oauth_expired';
    case 'oauth_unlinked':
      return 'oauth_unlinked';
    case 'subscription_unavailable':
      return 'subscription_unavailable';
    default:
      return null;
  }
}

function responseKeyState(rec: RecResponse | null): AiRecRequestState | null {
  if (!rec || rec.status !== 'unavailable') return null;
  return poweringRequestState(rec.unavailable_reason) ?? 'unavailable';
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
      (scenarioSelected ? null : poweringRequestState(input.poweringReason)) ??
      (!input.inAppEnabled && !scenarioSelected ? 'missing_key' : null) ??
      (input.cap.over_limit && !scenarioSelected ? 'daily_cap' : null) ??
      (input.cooldownRemaining > 0 && !scenarioSelected ? 'cooldown' : null) ??
      (input.readinessGateState === 'no_fresh_edge' ? 'no_edge' : null) ??
      'idle';

  let resultState: AiRecResultState | null = null;
  if (produced && rec?.strategy) {
    if (input.stale) resultState = 'stale_newer_snapshot';
    else if (rec.stale_born) resultState = 'stale_at_generation';
    else if (superseded) resultState = 'superseded_inputs';
    else if (rec.strategy.decision === 'no_trade') resultState = 'no_trade';
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
    requestState === 'key_unusable' ||
    requestState === 'key_rejected' ||
    requestState === 'model_not_in_catalog' ||
    requestState === 'model_unset' ||
    requestState === 'oauth_expired' ||
    requestState === 'oauth_unlinked' ||
    requestState === 'subscription_unavailable';
  const unavailableRetryGate =
    requestState === 'unavailable' &&
    // A paused fact is not a transient fault — retrying cannot change the answer (SPEC F2/F4:
    // "Never a Retry loop … for the paused code"). Checked here, not ad hoc in the block, because
    // this policy is documented as the SOLE authority for retry actionability.
    rec?.unavailable_reason !== MARKET_DATA_PAUSED_REASON &&
    signedIn &&
    input.inAppEnabled &&
    input.readinessGateState === 'available' &&
    (scenarioSelected || (input.cooldownRemaining <= 0 && !input.cap.over_limit));

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
