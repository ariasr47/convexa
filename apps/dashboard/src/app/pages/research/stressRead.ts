/**
 * The fear–greed gauge's words (spec docs/product/specs/2026-10-21/07-stress-gauge.md, Copy): the
 * finding, each input's raw value, percentile sentence and score, the "Not counted" lines and the
 * withheld lines. The API computes the method (apps/api/src/services/public_data/stress.rs); this
 * only says what the markets answer's `stress` holds. Every number here comes from that answer.
 *
 * The reading is named by its poles, the fear–greed gauge, never "stress gauge": its scale runs 0 =
 * extreme fear to 100 = extreme greed, so a high number means low stress. "Stress" names only the
 * section and the OFR inputs, which do measure it, and every score carries its band word.
 */
import type { PublicSource, PublicStress, PublicStressComponent } from '@convexa/api';
import { daysBetween, formatShortDate } from './format';

export type StressBand = NonNullable<PublicStress['band']>;
export type StressInput = PublicStressComponent['id'];

/** The frame's title in every state but a published reading (P-10), and its loading name. */
export const STRESS_METRIC = 'Fear–greed gauge';

export const STRESS_LEAD =
  'A fear–greed gauge built only from data Convexa may show: five parts of the Office of Financial Research’s stress index and two CFTC positioning series, each ranked against its own last three years. 0 is extreme fear and 100 extreme greed, so high stress reads low. The familiar fear gauges need a licence to show, so none is used here.';

export const STRESS_SUB =
  'Seven public inputs · each a percentile of its own last 3 years · 0 = extreme fear, 100 = extreme greed · equal weights · published only when 5 of 7 are fresh';

export const STRESS_NOTE =
  'Five of the seven inputs come from one OFR file: one method and one outage drive most of this gauge, and without a fresh file it publishes nothing. The OFR’s categories are blends of 33 market variables worldwide, not raw prices. The percentiles are Convexa’s own arithmetic. Research, not a signal.';

export const STRESS_CAPTION =
  'Fear–greed gauge inputs: raw value, 3-year percentile and the 0–100 score averaged into the gauge (one decimal shown; the gauge averages the unrounded scores)';

/** Band names are proper names, capitalised as the design documents write them. */
export const BAND_WORD: Record<StressBand, string> = {
  extreme_fear: 'Extreme Fear',
  fear: 'Fear',
  neutral: 'Neutral',
  greed: 'Greed',
  extreme_greed: 'Extreme Greed',
};

/** The band of a whole 0–100 score, each edge belonging to the calmer band (method rule 7):
 *  0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. */
export function bandOf(score: number): StressBand {
  if (score <= 24) return 'extreme_fear';
  if (score <= 44) return 'fear';
  if (score <= 55) return 'neutral';
  if (score <= 75) return 'greed';
  return 'extreme_greed';
}

/** Each input, in table order: its name, what it is, its sentence subject and its short name in the
 *  finding (spec Copy › Rows, Frame). */
export const INPUTS: Record<
  StressInput,
  { name: string; what: string; subject: string; short: string }
> = {
  volatility: {
    name: 'Volatility',
    what: 'OFR FSI · Volatility',
    subject: 'Volatility stress',
    short: 'volatility',
  },
  credit: { name: 'Credit', what: 'OFR FSI · Credit', subject: 'Credit stress', short: 'credit' },
  safe_assets: {
    name: 'Safe haven',
    what: 'OFR FSI · Safe assets',
    subject: 'Safe-haven stress',
    short: 'safe havens',
  },
  equity_valuation: {
    name: 'Equity stress',
    what: 'OFR FSI · Equity valuation',
    subject: 'Equity valuation stress',
    short: 'equity stress',
  },
  funding: {
    name: 'Funding',
    what: 'OFR FSI · Funding',
    subject: 'Funding stress',
    short: 'funding',
  },
  vol_positioning: {
    name: 'Vol positioning',
    what: 'CFTC TFF · VIX futures, leveraged funds',
    subject: 'Leveraged funds’ net VIX position',
    short: 'vol positioning',
  },
  equity_positioning: {
    name: 'Equity positioning',
    what: 'CFTC TFF · E-mini S&P 500, asset managers',
    subject: 'Asset managers’ net E-mini S&P position',
    short: 'equity positioning',
  },
};

/** Each source's credit line on a row: the agency on production; on the demo, what the authored
 *  values are shaped like, since no agency is credited for them (spec Copy › Rows). */
export const CREDIT: Record<PublicStressComponent['source'], { live: string; demo: string }> = {
  ofr: {
    live: 'Source: Office of Financial Research, OFR Financial Stress Index',
    demo: 'Shaped like OFR Financial Stress Index data',
  },
  cftc: {
    live: 'Source: CFTC Commitments of Traders (TFF)',
    demo: 'Shaped like CFTC TFF data',
  },
};

/** Half up, for the one-decimal values the wire carries: tenths first, so 78.5 reads 79 and a float
 *  like 63.400000000000006 still reads 63. */
function halfUp(x: number): number {
  return Math.floor((Math.round(x * 10) + 5) / 10);
}

/**
 * A row's percentile as a whole number, as its sentence states it: half up from 50 on ("78.5 reads
 * 79"), and mirrored below 50, so "lower than N%" is the half-up of 100 − p.
 *
 * The wire carries the percentile and the score rounded to one decimal, so rounding each of them
 * again on its own would make a row disagree with itself: 78.5 and 21.5 round to 79 and 22, and the
 * row would read "higher than 79%" beside "22". The row's whole score is therefore the mirror of this
 * number (`wholeScore`), as the method's flip is exact (`100 − p`); this reproduces the spec's own
 * examples (21 Extreme Fear, 49 Neutral, 69 Greed) on the real files of 2026-10-22.
 */
export function wholePercentile(p: number): number {
  return p >= 50 ? halfUp(p) : 100 - halfUp(100 - p);
}

/** A row's score as a whole number (0 extreme fear, 100 extreme greed), or null without one. */
export function wholeScore(c: PublicStressComponent): number | null {
  if (c.percentile == null) return null;
  const p = wholePercentile(c.percentile);
  return c.higher_means === 'fear' ? 100 - p : p;
}

/** "2026-10-19" → "Oct 2026". */
function monthYear(day: string): string {
  return `${formatShortDate(day).split(' ')[0]} ${day.slice(0, 4)}`;
}

/** The method's cut: the as-of date three calendar years back (Feb 29 cuts at Feb 28). */
function threeYearsBefore(day: string): string {
  const year = Number(day.slice(0, 4)) - 3;
  const md = day.slice(5) === '02-29' ? '02-28' : day.slice(5);
  return `${year}-${md}`;
}

/** What the percentile is ranked against: "the last 3 years", or, when the series starts well after
 *  the cut (method rule 3), "the weeks since Oct 2024" or "the days since Oct 2024". A first
 *  observation within a week of the cut is a full window: weekends, holidays and weekly reports put
 *  it a few days after the cut. */
function rankedAgainst(c: PublicStressComponent): string {
  if (!c.as_of || !c.window_from) return 'the last 3 years';
  if (daysBetween(threeYearsBefore(c.as_of), c.window_from) <= 7) return 'the last 3 years';
  return `the ${c.cadence === 'weekly' ? 'weeks' : 'days'} since ${monthYear(c.window_from)}`;
}

/** "Volatility stress is higher than 79% of the last 3 years.", or null without a percentile. */
export function percentileSentence(c: PublicStressComponent): string | null {
  if (c.percentile == null) return null;
  const p = wholePercentile(c.percentile);
  const subject = INPUTS[c.id].subject;
  const span = rankedAgainst(c);
  return c.percentile >= 50
    ? `${subject} is higher than ${p}% of ${span}.`
    : `${subject} is lower than ${100 - p}% of ${span}.`;
}

/** A signed figure with a true minus sign: "−0.007", "+0.412". */
function signed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value < 0 ? '−' : '+'}${text}`;
}

/** The raw value as a row shows it, split into the figure (Mono) and the words after it (Sans):
 *  OFR index units to three decimals ("−0.007", " · 0 = average stress"), a CFTC net position as a
 *  share of open interest to one decimal with its side in words ("+47.4%", " of open interest, net
 *  long"), so the sign never rests on the glyph alone (P-11). Null when the source answered nothing. */
export function rawParts(c: PublicStressComponent): { figure: string; rest: string } | null {
  if (c.raw == null) return null;
  if (c.source === 'ofr') return { figure: signed(c.raw, 3), rest: ' · 0 = average stress' };
  const figure = `${signed(c.raw * 100, 1)}%`;
  const side = c.raw > 0 ? ', net long' : c.raw < 0 ? ', net short' : '';
  return { figure, rest: ` of open interest${side}` };
}

/** The raw value in the table twin: the OFR's three decimals, the CFTC share to two. */
export function rawFigure(c: PublicStressComponent): string | null {
  if (c.raw == null) return null;
  return c.source === 'ofr' ? signed(c.raw, 3) : `${signed(c.raw * 100, 2)}% of OI`;
}

/** Why an input is not counted, or null when it is (spec Copy › Rows, Not counted). */
export function notCountedLine(c: PublicStressComponent): string | null {
  if (c.counted) return null;
  switch (c.reason) {
    case 'stale':
      if (c.age == null) return null;
      return c.cadence === 'daily'
        ? `Not counted: ${c.age} weekdays old, past the 5-weekday limit.`
        : `Not counted: ${c.age} days old, past the 14-day limit.`;
    case 'no_data':
      return `Not counted: ${c.source === 'ofr' ? 'the OFR' : 'the CFTC'} didn’t answer and no earlier copy is kept.`;
    case 'short_history':
      return 'Not counted: less than a year of history.';
    default:
      return null;
  }
}

/**
 * The finding (P-10), worked out from the counted inputs (spec Behaviour › The finding). In Fear or
 * Extreme Fear the two lowest scores lead, lowest first; in Greed or Extreme Greed the two highest,
 * highest first; ties go to the earlier row. Neutral names the lowest input if it is under 45 and the
 * highest if it is over 55, or says no input is far from the middle. A positioning clause follows
 * when both CFTC inputs count and neither is named. A withheld gauge claims no finding: the metric.
 */
export function stressFinding(stress: PublicStress, demo: boolean): string {
  if (!stress.published || stress.gauge == null || stress.band == null) return STRESS_METRIC;
  const counted = stress.components
    .map((c, i) => ({ c, i, score: c.score, whole: wholeScore(c) }))
    .filter(
      (x): x is { c: PublicStressComponent; i: number; score: number; whole: number } =>
        x.c.counted && x.score != null && x.whole != null,
    );
  const lowest = [...counted].sort((a, b) => a.score - b.score || a.i - b.i);
  const highest = [...counted].sort((a, b) => b.score - a.score || a.i - b.i);
  const short = (x: { c: PublicStressComponent }) => INPUTS[x.c.id].short;
  const band = stress.band;
  let named: StressInput[] = [];
  let body: string;
  if ((band === 'fear' || band === 'extreme_fear') && lowest.length >= 2) {
    named = [lowest[0].c.id, lowest[1].c.id];
    body = `${short(lowest[0])} and ${short(lowest[1])} lead`;
  } else if ((band === 'greed' || band === 'extreme_greed') && highest.length >= 2) {
    named = [highest[0].c.id, highest[1].c.id];
    body = `${short(highest[0])} and ${short(highest[1])} lead`;
  } else {
    const fearmost = lowest[0] && lowest[0].whole < 45 ? lowest[0] : null;
    const greedmost = highest[0] && highest[0].whole > 55 ? highest[0] : null;
    named = [fearmost, greedmost].flatMap((x) => (x ? [x.c.id] : []));
    body =
      fearmost && greedmost
        ? `${short(fearmost)} pulls toward fear, ${short(greedmost)} toward greed`
        : fearmost
          ? `${short(fearmost)} pulls toward fear`
          : greedmost
            ? `${short(greedmost)} pulls toward greed`
            : 'no input is far from the middle';
  }
  const head = `${demo ? 'In the sample, the' : 'The'} fear–greed gauge reads ${BAND_WORD[band]} (${stress.gauge})`;
  return `${head}: ${body}${positioningClause(stress, named)}`;
}

/** ", positioning is neutral" (both 45–55), "leans fear" (both under 45), "leans greed" (both over
 *  55) or "is split", only when both CFTC inputs count and neither is already named. */
function positioningClause(stress: PublicStress, named: StressInput[]): string {
  const cftc = stress.components.filter((c) => c.source === 'cftc');
  if (cftc.length !== 2 || cftc.some((c) => !c.counted || named.includes(c.id))) return '';
  const scores = cftc.map(wholeScore);
  if (scores.some((s) => s == null)) return '';
  const all = (test: (s: number) => boolean) => scores.every((s) => test(s as number));
  if (all((s) => s >= 45 && s <= 55)) return ', positioning is neutral';
  if (all((s) => s < 45)) return ', positioning leans fear';
  if (all((s) => s > 55)) return ', positioning leans greed';
  return ', positioning is split';
}

/** Why a reading is withheld, as one P-2 word, from the `ofr` sources row (spec Copy › Frame, Tag):
 *  down with no copy is Source down; a kept copy too old to count is Last good copy; an OFR that
 *  answered but whose newest day is too old is Delayed by source (owner answer S7-Q2). Without the
 *  row, the OFR inputs' own reasons decide. */
export type WithheldCause = 'sourceDown' | 'lastGood' | 'delayed';

export function withheldCause(ofr: PublicSource | undefined, stress: PublicStress): WithheldCause {
  if (ofr?.state === 'source_down') return 'sourceDown';
  if (ofr?.state === 'last_good') return 'lastGood';
  if (ofr?.state === 'delayed' || ofr?.state === 'updated') return 'delayed';
  const ofrInputs = stress.components.filter((c) => c.source === 'ofr');
  return ofrInputs.length > 0 && ofrInputs.every((c) => c.reason === 'no_data')
    ? 'sourceDown'
    : 'delayed';
}

/** "Oct 21, 14:05 UTC": when the served copy was fetched. */
function fetchedAt(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${formatShortDate(iso.slice(0, 10))}, ${time} UTC`;
}

/** The withheld line under the cause's word (spec Copy › Withheld). `ends` is the newest day the
 *  OFR copy holds; `since` the `ofr` row's `checked_at`. */
export function withheldLine(
  cause: WithheldCause,
  { counted, ends, since }: { counted: number; ends: string | null; since: string | null },
): string {
  if (cause === 'sourceDown')
    return `No reading today. The OFR didn’t answer and there is no earlier copy, so only ${counted} of the 7 inputs are fresh; the gauge needs 5.`;
  const end = ends ? formatShortDate(ends) : null;
  if (cause === 'lastGood') {
    const answered = since
      ? `The OFR hasn’t answered since ${fetchedAt(since)}`
      : 'The OFR hasn’t answered';
    const copy = end
      ? `; its last copy ends ${end}, too old to count,`
      : ', and its last copy is too old to count,';
    return `No reading today. ${answered}${copy} so only ${counted} of 7 inputs are fresh.`;
  }
  return end
    ? `No reading today. The OFR’s file ends ${end}, more than 5 weekdays ago, so only ${counted} of 7 inputs are fresh.`
    : `No reading today. The OFR’s file is more than 5 weekdays old, so only ${counted} of 7 inputs are fresh.`;
}

/** Two decimals, cut rather than rounded, so a mean just under an edge never shows as the edge
 *  (spec Copy › Table twin: 50.1557 shows 50.15). Rounded to nine decimals first, so float noise
 *  (44.29 held as 44.28999999999999) never cuts a hundredth off. */
export function meanText(mean: number): string {
  const cents = Math.floor(Math.round(mean * 1e9) / 1e7);
  return (cents / 100).toFixed(2);
}
