export const TRIO = ['SPY', 'QQQ', 'IWM'] as const;
export type TrioSymbol = (typeof TRIO)[number];

export type BookIdentity = { symbol: string; et_date: string };

export type ResearchGet =
  | { kind: 'list'; symbol: string }
  | { kind: 'coverage' }
  | { kind: 'load'; symbol: string; et_date: string };

export function pageRetryGets(selected: string): ResearchGet[] {
  return [{ kind: 'list', symbol: selected }, { kind: 'coverage' }];
}

export function digestRetryGets(identity: BookIdentity): ResearchGet[] {
  return [{ kind: 'load', symbol: identity.symbol, et_date: identity.et_date }];
}

export function unlockGets(selected: string): ResearchGet[] {
  return pageRetryGets(selected);
}

export function chipTapGets(symbol: string): ResearchGet[] {
  return [{ kind: 'list', symbol }];
}

export function presentClickGets(selectedChip: string, identity: BookIdentity): ResearchGet[] {
  if (identity.symbol === selectedChip) {
    return [{ kind: 'load', symbol: identity.symbol, et_date: identity.et_date }];
  }
  return [
    { kind: 'list', symbol: identity.symbol },
    { kind: 'load', symbol: identity.symbol, et_date: identity.et_date },
  ];
}
