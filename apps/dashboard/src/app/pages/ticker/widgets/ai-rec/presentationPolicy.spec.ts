import type { RecCap } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { recAllTraced, noTradeRec } from './fixtures';
import { deriveAiRecPresentation, type PresentationInput } from './presentationPolicy';

const cap: RecCap = { over_limit: false, remaining_today: 1, resets_at: '' };
const base = (): PresentationInput => ({
  rec: null,
  loading: false,
  stale: false,
  signedIn: true,
  inAppEnabled: true,
  cap,
  cooldownRemaining: 0,
  effectiveGateState: 'available',
  scenarioSelected: false,
  currentRiskInputs: null,
});
const input = (overrides: Partial<PresentationInput> = {}): PresentationInput => ({ ...base(), ...overrides });

describe('deriveAiRecPresentation', () => {
  it('idle exposes analyze and export', () => { const v = deriveAiRecPresentation(input()); expect(v.requestState).toBe('idle'); expect(v.resultState).toBeNull(); expect(v.actions.analyze).toBe(true); expect(v.actions.directExport).toBe(true); });
  it('loading has no old-result actions', () => { const v = deriveAiRecPresentation(input({ loading: true, rec: recAllTraced() })); expect(v.requestState).toBe('loading'); expect(v.actions.directExport).toBe(true); expect(v.actions.reviewTrade).toBe(false); expect(v.actions.createOrder).toBe(false); expect(v.actions.analysis).toBe(false); });
  it('signed out is the outermost gate', () => { const v = deriveAiRecPresentation(input({ signedIn: false })); expect(v.requestState).toBe('signed_out'); expect(v.actions.signIn).toBe(true); expect(v.actions.settings).toBe(false); });
  it('signed-out gate suppresses recovery actions from the retained/error state', () => { const rec = { ...recAllTraced(), status: 'unavailable' as const, strategy: null, unavailable_reason: 'no_key' }; const v = deriveAiRecPresentation(input({ rec, signedIn: false, effectiveGateState: 'no_fresh_edge' })); expect(v.requestState).toBe('signed_out'); expect(v.actions.askAnyway).toBe(false); expect(v.actions.retry).toBe(false); expect(v.actions.settings).toBe(false); expect(v.actions.signIn).toBe(true); });
  it('missing own key', () => { const rec = { ...recAllTraced(), status: 'unavailable' as const, strategy: null, unavailable_reason: 'no_key' }; const v = deriveAiRecPresentation(input({ rec })); expect(v.requestState).toBe('missing_key'); expect(v.actions.settings).toBe(true); });
  it('shared allowance exhausted', () => { const rec = { ...recAllTraced(), status: 'unavailable' as const, strategy: null, unavailable_reason: 'over_limit' }; expect(deriveAiRecPresentation(input({ rec })).requestState).toBe('shared_allowance_exhausted'); });
  it('shared key unavailable', () => { const rec = { ...recAllTraced(), status: 'unavailable' as const, strategy: null, unavailable_reason: 'shared_key_unconfigured' }; expect(deriveAiRecPresentation(input({ rec })).requestState).toBe('shared_key_unavailable'); });
  it('deployment key gate', () => { expect(deriveAiRecPresentation(input({ inAppEnabled: false })).requestState).toBe('missing_key'); });
  it('scenario bypasses deployment key gate', () => { expect(deriveAiRecPresentation(input({ inAppEnabled: false, scenarioSelected: true })).requestState).toBe('idle'); });
  it('daily cap', () => { expect(deriveAiRecPresentation(input({ cap: { ...cap, over_limit: true } })).requestState).toBe('daily_cap'); });
  it('scenario bypasses cap', () => { expect(deriveAiRecPresentation(input({ cap: { ...cap, over_limit: true }, scenarioSelected: true })).requestState).toBe('idle'); });
  it('cooldown', () => { expect(deriveAiRecPresentation(input({ cooldownRemaining: 4 })).requestState).toBe('cooldown'); });
  it('no edge exposes ask anyway', () => { const v = deriveAiRecPresentation(input({ effectiveGateState: 'no_fresh_edge' })); expect(v.requestState).toBe('no_edge'); expect(v.actions.askAnyway).toBe(true); });
  it('unavailable can retry when idle gate allows', () => { const rec = { ...recAllTraced(), status: 'unavailable' as const, strategy: null, unavailable_reason: 'transport' }; const v = deriveAiRecPresentation(input({ rec })); expect(v.requestState).toBe('unavailable'); expect(v.actions.retry).toBe(true); });
  it('fresh complete trade exposes simulated actions', () => { const v = deriveAiRecPresentation(input({ rec: recAllTraced(), currentRiskInputs: recAllTraced().sent!.risk_inputs })); expect(v.resultState).toBe('fresh_trade'); expect(v.actions.reviewTrade).toBe(true); expect(v.actions.createOrder).toBe(true); expect(v.actions.analysis).toBe(true); });
  it('soft fields may be absent without making a trade incomplete', () => { const rec = recAllTraced(); rec.strategy = { ...rec.strategy!, time_horizon: null, confidence: null }; const v = deriveAiRecPresentation(input({ rec })); expect(v.resultState).toBe('fresh_trade'); expect(v.missingPositionFields).toEqual([]); });
  it('blocked degraded refresh cannot retry through a cap gate', () => { const v = deriveAiRecPresentation(input({ rec: recAllTraced(), stale: true, cap: { ...cap, over_limit: true } })); expect(v.requestState).toBe('daily_cap'); expect(v.actions.retry).toBe(false); expect(v.actions.refresh).toBe(false); });
  it('scenario-selected cooldown bypass keeps degraded recovery available', () => { const v = deriveAiRecPresentation(input({ rec: recAllTraced(), stale: true, cooldownRemaining: 4, scenarioSelected: true })); expect(v.requestState).toBe('idle'); expect(v.actions.retry).toBe(true); expect(v.actions.refresh).toBe(true); });
  it('incomplete trade names structural fields and never exposes trade actions', () => { const rec = recAllTraced(); rec.strategy = { ...rec.strategy!, structure: null, strikes: [], expiration: null, entry_trigger: null }; const v = deriveAiRecPresentation(input({ rec })); expect(v.resultState).toBe('incomplete_trade'); expect(v.missingPositionFields).toEqual(['Structure', 'Strike(s)', 'Expiration', 'Entry trigger']); expect(v.actions.reviewTrade).toBe(false); expect(v.actions.createOrder).toBe(false); expect(v.actions.analysis).toBe(true); });
  it('newer snapshot is stale', () => { const v = deriveAiRecPresentation(input({ rec: recAllTraced(), stale: true })); expect(v.resultState).toBe('stale_newer_snapshot'); expect(v.actions.reviewTrade).toBe(false); expect(v.actions.refresh).toBe(true); });
  it('stale at generation is distinct', () => { const v = deriveAiRecPresentation(input({ rec: { ...recAllTraced(), stale_born: true } })); expect(v.resultState).toBe('stale_at_generation'); });
  it('superseded risk inputs block actions', () => { const rec = recAllTraced(); const current = { ...rec.sent!.risk_inputs!, account_size: (rec.sent!.risk_inputs!.account_size ?? 0) + 1 }; const v = deriveAiRecPresentation(input({ rec, currentRiskInputs: current })); expect(v.resultState).toBe('superseded_inputs'); expect(v.actions.reviewTrade).toBe(false); });
  it('no trade is complete but not actionable', () => { const v = deriveAiRecPresentation(input({ rec: noTradeRec() })); expect(v.resultState).toBe('no_trade'); expect(v.actions.analysis).toBe(true); expect(v.actions.reviewTrade).toBe(false); });
  it('poisoned stale snapshot names missing structural fields and stays safe', () => {
    const rec = recAllTraced(); rec.stale_born = true; rec.strategy = { ...rec.strategy!, structure: null, strikes: [Number.NaN], expiration: null, entry_trigger: ' ' };
    const currentRiskInputs = { ...rec.sent!.risk_inputs!, account_size: (rec.sent!.risk_inputs!.account_size ?? 0) + 1 };
    const view = deriveAiRecPresentation({ rec, loading: false, stale: true, signedIn: true, inAppEnabled: true, cap, cooldownRemaining: 0, effectiveGateState: 'available', scenarioSelected: false, currentRiskInputs });
    expect(view.resultState).toBe('stale_newer_snapshot'); expect(view.missingPositionFields).toEqual(['Structure', 'Strike(s)', 'Expiration', 'Entry trigger']); expect(view.actions.reviewTrade).toBe(false); expect(view.actions.createOrder).toBe(false); expect(view.actions.analysis).toBe(true); expect(String(deriveAiRecPresentation)).not.toMatch(/LiveUpdate|streamOffline|EventSource|SSE/);
  });
});
