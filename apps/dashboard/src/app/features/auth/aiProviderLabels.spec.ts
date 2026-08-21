import type { AiProvidersBootstrap, ByoProvider } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  BYO_PROVIDER_LABEL,
  GROK_SUBSCRIPTION_LABEL,
  catalogForPreference,
  ownKeyChip,
  pathLabel,
} from './aiProviderLabels';
import { AUTH_COPY } from './copy';

const bootstrap = (over: Partial<AiProvidersBootstrap> = {}): AiProvidersBootstrap => ({
  storage_available: true,
  providers: (['anthropic', 'openai', 'xai', 'gemini'] as ByoProvider[]).map((p) => ({
    provider: p,
    set: false,
    last4: null,
  })),
  grok: { available: false, connected: false, unavailable_reason: null },
  preference: { power_path: null, provider: null, model: 'claude-opus-4-8' },
  catalog: {
    providers: [
      { provider: 'anthropic', models: [{ id: 'claude-opus-4-8', recommended: true }] },
      { provider: 'openai', models: [{ id: 'gpt-4o', recommended: true }] },
      { provider: 'xai', models: [{ id: 'grok-3', recommended: true }] },
      { provider: 'gemini', models: [{ id: 'gemini-2.0-flash', recommended: true }] },
    ],
    grok_subscription: { provider: 'xai', models: [{ id: 'grok-3-sub', recommended: true }] },
  },
  ...over,
});

describe('aiProviderLabels — closed lookups (AC-5/8/23)', () => {
  it('subscription path never collapses onto the BYO Grok label', () => {
    expect(pathLabel('grok_subscription', 'xai')).toBe(GROK_SUBSCRIPTION_LABEL);
    expect(pathLabel('own_key', 'xai')).toBe('Grok');
    expect(pathLabel('grok_subscription', 'xai')).not.toBe(BYO_PROVIDER_LABEL.xai);
    expect(pathLabel('grok_subscription', 'xai')).not.toMatch(/Convexa Grok pool/i);
  });

  it('own-key labels are the closed BYO set — unknown provider omits the path chip', () => {
    expect(pathLabel('own_key', 'anthropic')).toBe('Anthropic');
    expect(pathLabel('own_key', 'openai')).toBe('OpenAI');
    expect(pathLabel('own_key', 'gemini')).toBe('Gemini');
    expect(pathLabel('own_key', 'not-a-provider')).toBeNull();
    expect(pathLabel('none')).toBeNull();
    expect(pathLabel('own_key', null)).toBeNull();
  });

  it('own-key honesty chip names the provider when vouched, else the generic floor', () => {
    expect(ownKeyChip('openai')).toBe('Using your OpenAI key');
    expect(ownKeyChip('xai')).toBe('Using your Grok key');
    expect(ownKeyChip(null)).toBe('Using your key');
  });

  it('preview catalog: subscription when advertised, else first BYO recommended (D4)', () => {
    expect(catalogForPreference(bootstrap()).map((m) => m.id)).toEqual(['claude-opus-4-8']);
    expect(
      catalogForPreference(
        bootstrap({ grok: { available: true, connected: false, unavailable_reason: null } }),
      ).map((m) => m.id),
    ).toEqual(['grok-3-sub']);
  });

  it('incomplete bootstrap degrades to an empty catalog — never throws (broker/legacy GET)', () => {
    expect(catalogForPreference({} as AiProvidersBootstrap)).toEqual([]);
    expect(
      catalogForPreference({
        storage_available: true,
        providers: undefined,
        grok: undefined,
        preference: undefined,
        catalog: undefined,
      } as unknown as AiProvidersBootstrap),
    ).toEqual([]);
  });

  it('active path catalog wins over preview once a power gesture exists', () => {
    expect(
      catalogForPreference(
        bootstrap({ preference: { power_path: 'own_key', provider: 'openai', model: 'gpt-4o' } }),
      ).map((m) => m.id),
    ).toEqual(['gpt-4o']);
    expect(
      catalogForPreference(
        bootstrap({
          preference: { power_path: 'grok_subscription', provider: null, model: 'grok-3-sub' },
        }),
      ).map((m) => m.id),
    ).toEqual(['grok-3-sub']);
  });
});

describe('AI providers panel — theme / motion floor (AC-30)', () => {
  const RAW = import.meta.glob('./AiKeySection.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('AiKeySection has no hex literals and no new keyframes', () => {
    const src = Object.values(RAW).join('\n');
    expect(src.length).toBeGreaterThan(100);
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(src).not.toMatch(/@keyframes/);
    // Vacuity: the scan is looking at the panel source, not an empty string.
    expect(src).toMatch(/settings-grok-card/);
  });
});

describe('AI providers copy — banned product vocabulary (AC-19 / D7)', () => {
  const banned = [/free/i, /Convexa Grok pool/i, /cheaper/i, /\bincluded\b/i];

  function collect(value: unknown, out: string[]): void {
    if (typeof value === 'string') out.push(value);
    else if (typeof value === 'function') {
      /* skip interpolators — they are not standing product copy */
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) collect(v, out);
    }
  }

  it('Settings AI providers strings never say free / pool / cheaper / included', () => {
    const strings: string[] = [];
    collect(AUTH_COPY.settings.aiKey, strings);
    const offenders = strings.filter((s) => banned.some((re) => re.test(s)));
    expect(offenders).toEqual([]);
  });
});
