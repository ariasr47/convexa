/**
 * Closed FE lookups for AI providers / power path / model catalog.
 * Labels come from this table — never from parsing a pasted key (`digested-labels-not-raw-dump`).
 * `grok_subscription` is "your Grok subscription" — never the BYO "Grok" label, never "Convexa Grok pool".
 */
import type { AiProvidersBootstrap, ByoProvider, CatalogModel, KeySource } from '@convexa/api';
import { BYO_PROVIDERS } from '@convexa/api';

export const BYO_PROVIDER_LABEL: Record<ByoProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  xai: 'Grok',
  gemini: 'Gemini',
};

export const GROK_SUBSCRIPTION_LABEL = 'your Grok subscription';

export const BYO_PROVIDER_PLACEHOLDER: Record<ByoProvider, string> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  xai: 'xai-…',
  gemini: 'AIza…',
};

export function isByoProvider(value: string | null | undefined): value is ByoProvider {
  return !!value && (BYO_PROVIDERS as readonly string[]).includes(value);
}

/** Closed path/provider label for provenance + pre-ask chrome. Null when unnamed — omit the chip. */
export function pathLabel(
  keySource: KeySource | null | undefined,
  provider?: string | null,
): string | null {
  if (keySource === 'grok_subscription') return GROK_SUBSCRIPTION_LABEL;
  if (keySource === 'own_key' && isByoProvider(provider)) return BYO_PROVIDER_LABEL[provider];
  return null;
}

/** Own-key honesty chip. Named provider when vouched; else the generic floor. */
export function ownKeyChip(provider?: string | null): string {
  return isByoProvider(provider)
    ? `Using your ${BYO_PROVIDER_LABEL[provider]} key`
    : 'Using your key';
}

/** Active catalog for the standing preference; preview catalog when `power_path` is still null (D4).
 *  Incomplete / legacy GET shapes degrade to [] — never throw (Settings must stay up). */
export function catalogForPreference(bootstrap: AiProvidersBootstrap): CatalogModel[] {
  const preference = bootstrap?.preference;
  const catalog = bootstrap?.catalog;
  const grok = bootstrap?.grok;
  if (!catalog?.providers) return [];
  if (preference?.power_path === 'grok_subscription')
    return catalog.grok_subscription?.models ?? [];
  if (preference?.power_path === 'own_key' && isByoProvider(preference.provider)) {
    return catalog.providers.find((p) => p.provider === preference.provider)?.models ?? [];
  }
  if (grok?.available) return catalog.grok_subscription?.models ?? [];
  for (const id of BYO_PROVIDERS) {
    const row = catalog.providers.find((p) => p.provider === id);
    if (row?.models.some((m) => m.recommended)) return row.models;
  }
  return catalog.providers[0]?.models ?? [];
}

export function recommendedModelId(models: CatalogModel[]): string | null {
  return models.find((m) => m.recommended)?.id ?? models[0]?.id ?? null;
}
