/**
 * copy formatter unit tests — pure, no DOM. Locks the compact big-dollar formatter (`fmtUsdCompact`)
 * the Net GEX / Net DEX tiles + the DEX tooltip route through: B/M/K boundaries, sign-FIRST placement
 * (figure minus U+2212), and null handling. Display-only; no value/scoring path touched.
 */
import { describe, expect, it } from 'vitest';
import { fmtUsdCompact, fmtDexM, netDexTip, humanOpex, dayCount } from './copy';

describe('fmtUsdCompact (compact big-dollar, sign-first)', () => {
  it('null → em-dash', () => {
    expect(fmtUsdCompact(null)).toBe('—');
  });

  it('billions: 1 decimal, $B suffix (the Net DEX $36.6B case)', () => {
    expect(fmtUsdCompact(36_607_000_000)).toBe('$36.6B');
    expect(fmtUsdCompact(1.2e9)).toBe('$1.2B');
  });

  it('millions: 1 decimal, $M suffix', () => {
    expect(fmtUsdCompact(793_200_000)).toBe('$793.2M');
    expect(fmtUsdCompact(5.0e8)).toBe('$500.0M');
  });

  it('thousands: 1 decimal, $K suffix', () => {
    expect(fmtUsdCompact(12_300)).toBe('$12.3K');
  });

  it('below 1e3: bare rounded integer dollars, no suffix', () => {
    expect(fmtUsdCompact(420)).toBe('$420');
    expect(fmtUsdCompact(0)).toBe('$0');
    expect(fmtUsdCompact(999.6)).toBe('$1000'); // rounds to integer dollars, still < 1e3 threshold
  });

  it('sign FIRST with the figure minus (−$X), never $-X', () => {
    expect(fmtUsdCompact(-12_300_000)).toBe('−$12.3M');
    expect(fmtUsdCompact(-36_607_000_000)).toBe('−$36.6B');
    expect(fmtUsdCompact(-12_300)).toBe('−$12.3K');
    expect(fmtUsdCompact(-420)).toBe('−$420');
    // figure minus, not the ASCII hyphen-minus, and the $ follows the sign
    expect(fmtUsdCompact(-12_300_000).startsWith('−$')).toBe(true);
    expect(fmtUsdCompact(-12_300_000).includes('$-')).toBe(false);
  });

  it('boundary values land in the higher bucket (≥ inclusive)', () => {
    expect(fmtUsdCompact(1e9)).toBe('$1.0B');
    expect(fmtUsdCompact(1e6)).toBe('$1.0M');
    expect(fmtUsdCompact(1e3)).toBe('$1.0K');
    expect(fmtUsdCompact(999_999_999)).toBe('$1000.0M'); // just under 1e9 stays in $M
  });
});

describe('fmtDexM routes through fmtUsdCompact', () => {
  it('matches the tile formatter (so the DEX tooltip reads in $B/$M like the tile)', () => {
    expect(fmtDexM(36_607_000_000)).toBe('$36.6B');
    expect(fmtDexM(5.0e8)).toBe('$500.0M');
    expect(fmtDexM(null)).toBe('—');
  });

  it('netDexTip embeds the compact call/put dex (matches the tile, not the old $X.XM-only form)', () => {
    const tip = netDexTip(6.0e8, -1.0e8);
    expect(tip).toContain('call $600.0M');
    expect(tip).toContain('put −$100.0M');
  });
});

describe('humanOpex (ISO OPEX date → weekday+month+day; dealer-flow-projection §5.2)', () => {
  it('renders a UTC calendar date with weekday + short month + day (no TZ drift)', () => {
    expect(humanOpex('2026-07-17')).toBe('Fri Jul 17');
    expect(humanOpex('2026-08-21')).toBe('Fri Aug 21');
    expect(humanOpex('2026-01-16')).toBe('Fri Jan 16'); // OPEX are 3rd Fridays; sanity across months
    expect(humanOpex('2026-12-18')).toBe('Fri Dec 18');
  });

  it('falls back to the raw string on a malformed/empty input (never blank)', () => {
    expect(humanOpex('')).toBe('');
    expect(humanOpex('not-a-date')).toBe('not-a-date');
    expect(humanOpex('2026/07/17')).toBe('2026/07/17'); // wrong separator fails the ISO regex → raw fallback
    expect(humanOpex('07-17-2026')).toBe('07-17-2026'); // wrong order fails the regex → raw fallback
  });
});

describe('dayCount (singular/plural the horizon day count)', () => {
  it('pluralizes 0 and >1, keeps 1 singular', () => {
    expect(dayCount(1)).toBe('1 day');
    expect(dayCount(11)).toBe('11 days');
    expect(dayCount(0)).toBe('0 days');
    expect(dayCount(2)).toBe('2 days');
  });
});
