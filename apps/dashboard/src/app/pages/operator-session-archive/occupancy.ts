/** Closed list/load `source` deck (INTERFACE). Never includes `present` / `kept`. */
export const LIST_SOURCES = ['live_massive', 'fixture', 'session_tape'] as const;
export type ListSource = (typeof LIST_SOURCES)[number];

/** Closed coverage `cell` deck (INTERFACE). `present` only here. */
export const COVERAGE_CELLS = [
  'present',
  'missing',
  'unreadable',
  'not yet due',
  'blocked occupancy',
] as const;
export type CoverageCell = (typeof COVERAGE_CELLS)[number];

export type ListSourceLookup =
  { kind: 'known'; source: ListSource } | { kind: 'unavailable'; raw: string };

export type CoverageCellLookup =
  { kind: 'known'; cell: CoverageCell } | { kind: 'unavailable'; raw: string };

export function lookupListSource(raw: string): ListSourceLookup {
  if ((LIST_SOURCES as readonly string[]).includes(raw)) {
    return { kind: 'known', source: raw as ListSource };
  }
  return { kind: 'unavailable', raw };
}

export function lookupCoverageCell(raw: string): CoverageCellLookup {
  if ((COVERAGE_CELLS as readonly string[]).includes(raw)) {
    return { kind: 'known', cell: raw as CoverageCell };
  }
  return { kind: 'unavailable', raw };
}
