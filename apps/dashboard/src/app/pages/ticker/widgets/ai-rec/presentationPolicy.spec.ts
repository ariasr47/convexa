import type { RecCap } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { noTradeRec, recAllTraced } from './fixtures';
import {
  type AiRecRequestState,
  deriveAiRecPresentation,
  type PresentationInput,
} from './presentationPolicy';

const cap: RecCap = { over_limit: false, remaining_today: 1, resets_at: '' };
const base = (): PresentationInput => ({
  rec: null,
  loading: false,
  stale: false,
  signedIn: true,
  canCreateOrder: true,
  inAppEnabled: true,
  cap,
  cooldownRemaining: 0,
  readinessGateState: 'available',
  scenarioSelected: false,
  currentRiskInputs: null,
});
const input = (overrides: Partial<PresentationInput> = {}): PresentationInput => ({
  ...base(),
  ...overrides,
});

describe('deriveAiRecPresentation', () => {
  it('idle exposes analyze and export', () => {
    const v = deriveAiRecPresentation(input());
    expect(v.requestState).toBe('idle');
    expect(v.resultState).toBeNull();
    expect(v.actions.analyze).toBe(true);
    expect(v.actions.directExport).toBe(true);
  });
  it('loading has no old-result actions', () => {
    const v = deriveAiRecPresentation(input({ loading: true, rec: recAllTraced() }));
    expect(v.requestState).toBe('loading');
    expect(v.actions.directExport).toBe(true);
    expect(v.actions.reviewTrade).toBe(false);
    expect(v.actions.createOrder).toBe(false);
    expect(v.actions.analysis).toBe(false);
  });
  it('signed out is the outermost gate', () => {
    const v = deriveAiRecPresentation(input({ signedIn: false }));
    expect(v.requestState).toBe('signed_out');
    expect(v.actions.signIn).toBe(true);
    expect(v.actions.settings).toBe(false);
  });
  it('signed-out gate suppresses recovery actions from the retained/error state', () => {
    const rec = {
      ...recAllTraced(),
      status: 'unavailable' as const,
      strategy: null,
      unavailable_reason: 'no_key',
    };
    const v = deriveAiRecPresentation(
      input({ rec, signedIn: false, readinessGateState: 'no_fresh_edge' }),
    );
    expect(v.requestState).toBe('signed_out');
    expect(v.actions.askAnyway).toBe(false);
    expect(v.actions.retry).toBe(false);
    expect(v.actions.settings).toBe(false);
    expect(v.actions.signIn).toBe(true);
  });
  it('each key/powering failure reason maps to its own distinct requestState; a retired reason is not a powering CTA', () => {
    const unavailable = (reason: string) => ({
      ...recAllTraced(),
      status: 'unavailable' as const,
      strategy: null,
      unavailable_reason: reason,
    });
    const rows: ReadonlyArray<[string, Partial<PresentationInput>, AiRecRequestState]> = [
      ['missing own key', { rec: unavailable('no_key') }, 'missing_key'],
      [
        'key unusable is distinct from no_key',
        { rec: unavailable('key_unusable') },
        'key_unusable',
      ],
      [
        'key rejected is distinct from unusable',
        { rec: unavailable('key_rejected') },
        'key_rejected',
      ],
      [
        'model not in catalog is distinct from no_key',
        { rec: unavailable('model_not_in_catalog') },
        'model_not_in_catalog',
      ],
      ['oauth expired', { rec: unavailable('oauth_expired') }, 'oauth_expired'],
      ['oauth unlinked', { rec: unavailable('oauth_unlinked') }, 'oauth_unlinked'],
      [
        'subscription unavailable',
        { rec: unavailable('subscription_unavailable') },
        'subscription_unavailable',
      ],
      [
        'status powering reason drives idle setup before an ask',
        { poweringReason: 'no_key' },
        'missing_key',
      ],
      [
        'retired free-uses over_limit is not a powering CTA',
        { rec: unavailable('over_limit') },
        'unavailable',
      ],
    ];
    for (const [name, overrides, requestState] of rows) {
      expect(deriveAiRecPresentation(input(overrides)).requestState, name).toBe(requestState);
    }
    expect(deriveAiRecPresentation(input({ rec: unavailable('no_key') })).actions.settings).toBe(
      true,
    );
  });
  it('deployment key gate', () => {
    expect(deriveAiRecPresentation(input({ inAppEnabled: false })).requestState).toBe(
      'missing_key',
    );
  });
  it('scenario bypasses deployment key gate', () => {
    expect(
      deriveAiRecPresentation(input({ inAppEnabled: false, scenarioSelected: true })).requestState,
    ).toBe('idle');
  });
  it('daily cap', () => {
    expect(deriveAiRecPresentation(input({ cap: { ...cap, over_limit: true } })).requestState).toBe(
      'daily_cap',
    );
  });
  it('scenario bypasses cap', () => {
    expect(
      deriveAiRecPresentation(input({ cap: { ...cap, over_limit: true }, scenarioSelected: true }))
        .requestState,
    ).toBe('idle');
  });
  it('cooldown', () => {
    expect(deriveAiRecPresentation(input({ cooldownRemaining: 4 })).requestState).toBe('cooldown');
  });
  it('no edge exposes ask anyway', () => {
    const v = deriveAiRecPresentation(input({ readinessGateState: 'no_fresh_edge' }));
    expect(v.requestState).toBe('no_edge');
    expect(v.actions.askAnyway).toBe(true);
  });
  it('unavailable can retry when idle gate allows', () => {
    const rec = {
      ...recAllTraced(),
      status: 'unavailable' as const,
      strategy: null,
      unavailable_reason: 'transport',
    };
    const v = deriveAiRecPresentation(input({ rec }));
    expect(v.requestState).toBe('unavailable');
    expect(v.actions.retry).toBe(true);
  });
  it('scenario cannot retry an unavailable response while the effective gate denies freshness', () => {
    const rec = {
      ...recAllTraced(),
      status: 'unavailable' as const,
      strategy: null,
      unavailable_reason: 'transport',
    };
    const v = deriveAiRecPresentation(
      input({ rec, scenarioSelected: true, readinessGateState: 'no_fresh_edge' }),
    );
    expect(v.requestState).toBe('unavailable');
    expect(v.actions.retry).toBe(false);
  });
  it('scenario bypasses active cap and cooldown when readiness is available', () => {
    const rec = {
      ...recAllTraced(),
      status: 'unavailable' as const,
      strategy: null,
      unavailable_reason: 'transport',
    };
    const v = deriveAiRecPresentation(
      input({
        rec,
        scenarioSelected: true,
        cap: { ...cap, over_limit: true },
        cooldownRemaining: 30,
        readinessGateState: 'available',
      }),
    );
    expect(v.actions.retry).toBe(true);
  });
  it('fresh complete trade exposes simulated actions when callback capability is present', () => {
    const v = deriveAiRecPresentation(
      input({
        rec: recAllTraced(),
        canCreateOrder: true,
        currentRiskInputs: recAllTraced().sent!.risk_inputs,
      }),
    );
    expect(v.resultState).toBe('fresh_trade');
    expect(v.actions.reviewTrade).toBe(true);
    expect(v.actions.createOrder).toBe(true);
    expect(v.actions.analysis).toBe(true);
  });
  it('fresh complete trade omits create-order action when callback capability is absent', () => {
    const v = deriveAiRecPresentation(
      input({
        rec: recAllTraced(),
        canCreateOrder: false,
        currentRiskInputs: recAllTraced().sent!.risk_inputs,
      }),
    );
    expect(v.resultState).toBe('fresh_trade');
    expect(v.actions.createOrder).toBe(false);
  });
  it('retained fresh result after sign-out has no create-order action', () => {
    const v = deriveAiRecPresentation(
      input({
        rec: recAllTraced(),
        signedIn: false,
        currentRiskInputs: recAllTraced().sent!.risk_inputs,
      }),
    );
    expect(v.resultState).toBe('fresh_trade');
    expect(v.actions.createOrder).toBe(false);
    expect(v.actions.reviewTrade).toBe(false);
  });
  it('soft fields may be absent without making a trade incomplete', () => {
    const rec = recAllTraced();
    rec.strategy = { ...rec.strategy!, time_horizon: null, confidence: null };
    const v = deriveAiRecPresentation(input({ rec }));
    expect(v.resultState).toBe('fresh_trade');
    expect(v.missingPositionFields).toEqual([]);
  });
  it('blocked degraded refresh cannot retry through a cap gate', () => {
    const v = deriveAiRecPresentation(
      input({ rec: recAllTraced(), stale: true, cap: { ...cap, over_limit: true } }),
    );
    expect(v.requestState).toBe('daily_cap');
    expect(v.actions.retry).toBe(false);
    expect(v.actions.refresh).toBe(false);
  });
  it('scenario-selected cooldown bypass keeps degraded recovery available', () => {
    const v = deriveAiRecPresentation(
      input({ rec: recAllTraced(), stale: true, cooldownRemaining: 4, scenarioSelected: true }),
    );
    expect(v.requestState).toBe('idle');
    expect(v.actions.retry).toBe(true);
    expect(v.actions.refresh).toBe(true);
  });
  it('incomplete trade names structural fields and never exposes trade actions', () => {
    const rec = recAllTraced();
    rec.strategy = {
      ...rec.strategy!,
      structure: null,
      strikes: [],
      expiration: null,
      entry_trigger: null,
    };
    const v = deriveAiRecPresentation(input({ rec }));
    expect(v.resultState).toBe('incomplete_trade');
    expect(v.missingPositionFields).toEqual([
      'Structure',
      'Strike(s)',
      'Expiration',
      'Entry trigger',
    ]);
    expect(v.actions.reviewTrade).toBe(false);
    expect(v.actions.createOrder).toBe(false);
    expect(v.actions.analysis).toBe(true);
  });
  it('newer snapshot is stale', () => {
    const v = deriveAiRecPresentation(input({ rec: recAllTraced(), stale: true }));
    expect(v.resultState).toBe('stale_newer_snapshot');
    expect(v.actions.reviewTrade).toBe(false);
    expect(v.actions.refresh).toBe(true);
  });
  it('stale at generation is distinct', () => {
    const v = deriveAiRecPresentation(input({ rec: { ...recAllTraced(), stale_born: true } }));
    expect(v.resultState).toBe('stale_at_generation');
  });
  it('superseded risk inputs block actions', () => {
    const rec = recAllTraced();
    const current = {
      ...rec.sent!.risk_inputs!,
      account_size: (rec.sent!.risk_inputs!.account_size ?? 0) + 1,
    };
    const v = deriveAiRecPresentation(input({ rec, currentRiskInputs: current }));
    expect(v.resultState).toBe('superseded_inputs');
    expect(v.actions.reviewTrade).toBe(false);
  });
  it('no trade is complete but not actionable', () => {
    const v = deriveAiRecPresentation(input({ rec: noTradeRec() }));
    expect(v.resultState).toBe('no_trade');
    expect(v.actions.analysis).toBe(true);
    expect(v.actions.reviewTrade).toBe(false);
  });
  it('poisoned stale snapshot names missing structural fields and stays safe', () => {
    const rec = recAllTraced();
    rec.stale_born = true;
    rec.strategy = {
      ...rec.strategy!,
      structure: null,
      strikes: [Number.NaN],
      expiration: null,
      entry_trigger: ' ',
    };
    const currentRiskInputs = {
      ...rec.sent!.risk_inputs!,
      account_size: (rec.sent!.risk_inputs!.account_size ?? 0) + 1,
    };
    const view = deriveAiRecPresentation({
      rec,
      loading: false,
      stale: true,
      signedIn: true,
      canCreateOrder: true,
      inAppEnabled: true,
      cap,
      cooldownRemaining: 0,
      readinessGateState: 'available',
      scenarioSelected: false,
      currentRiskInputs,
    });
    expect(view.resultState).toBe('stale_newer_snapshot');
    expect(view.missingPositionFields).toEqual([
      'Structure',
      'Strike(s)',
      'Expiration',
      'Entry trigger',
    ]);
    expect(view.actions.reviewTrade).toBe(false);
    expect(view.actions.createOrder).toBe(false);
    expect(view.actions.analysis).toBe(true);
    expect(String(deriveAiRecPresentation)).not.toMatch(/LiveUpdate|streamOffline|EventSource|SSE/);
  });
});
