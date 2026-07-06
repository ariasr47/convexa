/**
 * copy formatter unit tests — pure, no DOM. Locks the compact big-dollar formatter (`fmtUsdCompact`)
 * the Net GEX / Net DEX tiles + the DEX tooltip route through: B/M/K boundaries, sign-FIRST placement
 * (figure minus U+2212), and null handling. Display-only; no value/scoring path touched.
 */
import { describe, expect, it } from 'vitest';
import {
  fmtUsdCompact, fmtDexM, netDexTip, humanOpex, dayCount,
  // ai-context-pack (Market context) formatters + maps
  humanSessionDate, fmt2, fmt1, fmtSigned2, fmtAtrUsd, mcComLine,
  mcTrendLine, mcStrengthLine, mcMomentumLine, mcConcentrationLine, mcBalanceLine,
  mcLocationLine, mcCompositionLine, mcAtrLine, mcTiBasis, mcShapeBasis, mcAtrBasis,
  MC_FLOW_BASIS, mcDisplay,
  MC_DIRECTION_DISPLAY, MC_STRENGTH_DISPLAY, MC_MOMENTUM_DISPLAY,
  MC_CONCENTRATION_DISPLAY, MC_BALANCE_DISPLAY, MC_LOCATION_DISPLAY, MC_COMPOSITION_DISPLAY,
} from './copy';

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

// ---- ai-context-pack ("Market context") — pure formatter/map units (display-only, no DOM) --------
describe('Market context formatters (ai-context-pack §5.3)', () => {
  it('humanSessionDate is the neutral alias of the ISO-date formatter (same UTC parse + raw fallback)', () => {
    expect(humanSessionDate('2026-07-03')).toBe('Fri Jul 3');
    expect(humanSessionDate('2026-07-03')).toBe(humanOpex('2026-07-03'));
    expect(humanSessionDate('not-a-date')).toBe('not-a-date'); // never blank, never invented
  });

  it('fmt2 / fmt1 — the pinned decimal places (2dp scalars; 1dp ADX/RSI/ATR-pct display)', () => {
    expect(fmt2(178.4)).toBe('178.40');
    expect(fmt2(0.41)).toBe('0.41');
    expect(fmt1(28.4)).toBe('28.4');
    expect(fmt1(2.31)).toBe('2.3');
  });

  it('fmtSigned2 — explicit sign, figure minus (U+2212) for negatives', () => {
    expect(fmtSigned2(0.34)).toBe('+0.34');
    expect(fmtSigned2(-0.34)).toBe('−0.34');
    expect(fmtSigned2(-0.34).includes('-')).toBe(false); // never the ASCII hyphen-minus
  });

  it('fmtAtrUsd — 2dp, locale-grouped dollars', () => {
    expect(fmtAtrUsd(4.12)).toBe('$4.12');
    expect(fmtAtrUsd(3.5)).toBe('$3.50');
    expect(fmtAtrUsd(1234.5)).toBe('$1,234.50');
  });

  it('mcComLine — the wire FRACTION rendered as a signed percent, 1dp, "% vs spot" suffix', () => {
    expect(mcComLine(0.012)).toBe('+1.2% vs spot');
    expect(mcComLine(-0.0301)).toBe('−3.0% vs spot');
    expect(mcComLine(0)).toBe('+0.0% vs spot');
  });

  it('scalar-line builders render the pinned §5.3 forms', () => {
    expect(mcTrendLine({ close: 178.4, ema20: 176.21, ema50: 171.83 })).toBe('close 178.40 · EMA20 176.21 · EMA50 171.83');
    expect(mcStrengthLine({ adx: 28.4 })).toBe('ADX(14) 28.4');
    expect(mcMomentumLine({ rsi: 51.2 })).toBe('RSI(14) 51.2');
    expect(mcConcentrationLine(0.41)).toBe('HHI 0.41');
    expect(mcBalanceLine(0.34)).toBe('+0.34');
    expect(mcLocationLine({ distribution_shift: 0.42 })).toBe('shift 0.42');
    expect(mcCompositionLine({ volume_pcr: 0.92, oi_pcr: 0.88, tilt_ratio: 1.05 })).toBe('vol PCR 0.92 · OI PCR 0.88 · tilt 1.05');
    expect(mcAtrLine({ value: 4.12, pct_of_close: 2.31 })).toBe('$4.12 · 2.3%');
  });

  it('basis-line builders render the pinned §5.3 forms (flow carries the unsigned/no-side phrase verbatim)', () => {
    expect(mcTiBasis('2026-07-03')).toBe('As of session Fri Jul 3 · daily bars · EMA 20/50 · ADX(14) · RSI(14)');
    expect(mcShapeBasis(178.4, 23)).toBe('At spot $178.40 · 23 strikes in the selected window');
    expect(MC_FLOW_BASIS).toBe(
      "Today's session cumulative option volume, unsigned (no buy/sell side) · vs standing open interest · full chain · captured at the last data load",
    );
    expect(mcAtrBasis('2026-07-03', 178.4)).toBe('As of session Fri Jul 3 · vs close $178.40 · 5/14/30 trading bars');
  });

  it('mcDisplay — closed 1:1 lookup: every pinned enum maps; an unknown value maps to null (unavailable), never a pass-through', () => {
    // The full 20-value §5.2 table, asserted row by row.
    expect(mcDisplay(MC_DIRECTION_DISPLAY, 'uptrend')).toBe('Uptrend');
    expect(mcDisplay(MC_DIRECTION_DISPLAY, 'downtrend')).toBe('Downtrend');
    expect(mcDisplay(MC_DIRECTION_DISPLAY, 'mixed')).toBe('Mixed');
    expect(mcDisplay(MC_STRENGTH_DISPLAY, 'weak')).toBe('Weak');
    expect(mcDisplay(MC_STRENGTH_DISPLAY, 'moderate')).toBe('Moderate');
    expect(mcDisplay(MC_STRENGTH_DISPLAY, 'strong')).toBe('Strong');
    expect(mcDisplay(MC_MOMENTUM_DISPLAY, 'overbought')).toBe('Overbought');
    expect(mcDisplay(MC_MOMENTUM_DISPLAY, 'bullish')).toBe('Bullish');
    expect(mcDisplay(MC_MOMENTUM_DISPLAY, 'neutral')).toBe('Neutral');
    expect(mcDisplay(MC_MOMENTUM_DISPLAY, 'bearish')).toBe('Bearish');
    expect(mcDisplay(MC_MOMENTUM_DISPLAY, 'oversold')).toBe('Oversold');
    expect(mcDisplay(MC_CONCENTRATION_DISPLAY, 'concentrated')).toBe('Concentrated');
    expect(mcDisplay(MC_CONCENTRATION_DISPLAY, 'mixed')).toBe('Mixed');
    expect(mcDisplay(MC_CONCENTRATION_DISPLAY, 'dispersed')).toBe('Dispersed');
    expect(mcDisplay(MC_BALANCE_DISPLAY, 'above_skewed')).toBe('Skewed above spot');
    expect(mcDisplay(MC_BALANCE_DISPLAY, 'balanced')).toBe('Balanced');
    expect(mcDisplay(MC_BALANCE_DISPLAY, 'below_skewed')).toBe('Skewed below spot');
    expect(mcDisplay(MC_LOCATION_DISPLAY, 'aligned')).toBe('Aligned');
    expect(mcDisplay(MC_LOCATION_DISPLAY, 'rotating')).toBe('Rotating');
    expect(mcDisplay(MC_LOCATION_DISPLAY, 'divergent')).toBe('Divergent');
    expect(mcDisplay(MC_COMPOSITION_DISPLAY, 'flow_put_tilted')).toBe('Flow put-tilted');
    expect(mcDisplay(MC_COMPOSITION_DISPLAY, 'consistent')).toBe('Consistent');
    expect(mcDisplay(MC_COMPOSITION_DISPLAY, 'flow_call_tilted')).toBe('Flow call-tilted');
    // Unknown / prototype-chain values ⇒ null (the unavailable state), never invented.
    expect(mcDisplay(MC_DIRECTION_DISPLAY, 'sideways')).toBeNull();
    expect(mcDisplay(MC_DIRECTION_DISPLAY, 'toString')).toBeNull(); // hasOwnProperty guard
    expect(mcDisplay(MC_COMPOSITION_DISPLAY, '')).toBeNull();
  });
});
