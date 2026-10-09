import { describe, expect, it } from 'vitest';
import { COVERAGE_CELLS, LIST_SOURCES, lookupCoverageCell, lookupListSource } from './occupancy';

describe('lookupListSource', () => {
  it('accepts closed list sources and never yields present', () => {
    for (const src of LIST_SOURCES) {
      expect(lookupListSource(src)).toEqual({ kind: 'known', source: src });
    }
    expect(LIST_SOURCES).not.toContain('present');
    expect(LIST_SOURCES).not.toContain('kept');
  });

  it('unknown wire → unavailable with raw token; never present', () => {
    expect(lookupListSource('weird_wire')).toEqual({
      kind: 'unavailable',
      raw: 'weird_wire',
    });
    expect(lookupListSource('present')).toEqual({ kind: 'unavailable', raw: 'present' });
    expect(lookupListSource('kept')).toEqual({ kind: 'unavailable', raw: 'kept' });
    expect(lookupListSource('LiveMassive')).toEqual({
      kind: 'unavailable',
      raw: 'LiveMassive',
    });
  });

  it('there is no function that maps list source → coverage present', () => {
    expect(lookupListSource('live_massive')).not.toMatchObject({ kind: 'present' });
    expect(lookupCoverageCell('live_massive').kind).toBe('unavailable');
  });
});

describe('lookupCoverageCell', () => {
  it('accepts closed coverage deck only', () => {
    for (const cell of COVERAGE_CELLS) {
      expect(lookupCoverageCell(cell)).toEqual({ kind: 'known', cell });
    }
    expect(COVERAGE_CELLS).toEqual([
      'present',
      'missing',
      'unreadable',
      'not yet due',
      'blocked occupancy',
    ]);
  });

  it('unknown coverage token → unavailable', () => {
    expect(lookupCoverageCell('kept')).toEqual({ kind: 'unavailable', raw: 'kept' });
    expect(lookupCoverageCell('live_massive')).toEqual({
      kind: 'unavailable',
      raw: 'live_massive',
    });
  });
});
