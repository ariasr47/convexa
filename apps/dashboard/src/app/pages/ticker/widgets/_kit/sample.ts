/**
 * The demo desk's sample words (canon P-3, P-8): in the demo build every figure on the desk is the
 * authored Oct 7 scenario, so the desk names the scenario's date instead of a clock age, and never
 * wears a live-feed cue (live dot, flash, "running", "as-of 35s", "1m ago").
 *
 * One flag (`DESK_IS_SAMPLE`) and one stamp, so every surface says the same scenario time the board
 * draws: "Scenario · Oct 7, 2026 · 2:30 PM ET" (design/src/screens/final/ticker-desk.mjs SAMPLE.asof).
 */
import { dataMode, scenarioProvenance } from '@convexa/api';

/** True in the demo build: every figure on the desk is sample data. */
export const DESK_IS_SAMPLE = dataMode === 'demo';

const ET_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const ET_SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
});
const ET_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/**
 * The scenario instant on the exchange clock, `{ date: 'Oct 7, 2026', short: 'Oct 7', time:
 * '2:30 PM ET' }`. `null` for a missing or unparseable instant, so no caller prints a raw ISO string.
 */
export function scenarioClock(
  iso: string | null | undefined,
): { date: string; short: string; time: string } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return {
    date: ET_DATE.format(d),
    short: ET_SHORT_DATE.format(d),
    time: `${ET_TIME.format(d)} ET`,
  };
}

/** "Scenario · Oct 7, 2026 · 2:30 PM ET" — the board's sample as-of line. */
export function scenarioStamp(iso: string | null | undefined): string {
  const c = scenarioClock(iso);
  return c ? `Scenario · ${c.date} · ${c.time}` : 'Scenario snapshot';
}

/** The demo scenario's as-of instant, or null in the live build. */
export function scenarioAsOf(): string | null {
  return scenarioProvenance()?.asOf ?? null;
}

/**
 * "Now" for a date that counts days to an event (DTE): the wall clock in the live build, the
 * scenario's as-of in the demo, so a sample expiry counts from the scenario's own day.
 */
export function deskNowMs(
  sample: boolean = DESK_IS_SAMPLE,
  asOf: string | null = scenarioAsOf(),
): number {
  const t = sample && asOf ? Date.parse(asOf) : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

/** The demo's stamp ("Scenario · Oct 7, 2026 · 2:30 PM ET"); only meaningful in the demo build. */
export const SCENARIO_STAMP = scenarioStamp(scenarioAsOf());

/**
 * A sample event's time inside the scenario, from its age at the scenario's as-of instant:
 * "2:29 PM ET in the scenario" (the board's "largest print, 10:41 in the scenario"). Replaces
 * "1m ago", which reads as a wall-clock age on sample data.
 */
export function scenarioTimeOf(iso: string | null | undefined, ageSeconds: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(ageSeconds)) return 'in the scenario';
  const c = scenarioClock(new Date(t - Math.max(0, ageSeconds) * 1000).toISOString());
  return c ? `${c.time} in the scenario` : 'in the scenario';
}

/** The masthead's sample source chip: "Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET". */
export function sampleQuoteSource(ticker: string, iso: string | null | undefined): string {
  const c = scenarioClock(iso);
  const what = `Shaped like a delayed ${ticker.toUpperCase()} quote`;
  return c ? `${what} · ${c.short}, ${c.time}` : what;
}

/**
 * The sample tape's line: it replays the scenario, and says so, with no advancing clock (P-3).
 * It carries the year ("Oct 7, 2026", as SCENARIO_STAMP does): it is the sample tape's only date.
 */
export function sampleReplayLine(iso: string | null | undefined, windowSeconds: number): string {
  const c = scenarioClock(iso);
  const window = `${Math.max(1, Math.round(windowSeconds / 60))}m window`;
  return c
    ? `Replays the ${c.date} scenario from ${c.time} · ${window}`
    : `Replays the scenario · ${window}`;
}
