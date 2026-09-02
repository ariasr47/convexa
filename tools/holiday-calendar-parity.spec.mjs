/**
 * Holiday-calendar parity — `shared-session-eligibility-calendar`.
 *
 * The merged tree carries three NYSE full-day-closure date sets:
 *   1. `apps/api/src/services/session_chain_archive/calendars/xnys_full_day_2026_2035.v1.json`
 *      — the shared session-eligibility calendar (SPEC §2: "one calendar source").
 *   2. `apps/api/src/domain/nyse_full_day.rs` — the compile-time table behind
 *      `is_nyse_full_day_holiday`, which the research coverage matrix, the SSE
 *      `market_session`, flat-file keep and day-tape capture all consult.
 *   3. `apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts` — the scanner-badge replica.
 *
 * A holiday must be a holiday for all three. This test compares them by parsing each artifact at
 * source (no build step, no server), over exactly the years both sides of each pair cover.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CALENDAR_JSON = 'apps/api/src/services/session_chain_archive/calendars/xnys_full_day_2026_2035.v1.json';
const BACKEND_TABLE_RS = 'apps/api/src/domain/nyse_full_day.rs';
const DASHBOARD_REPLICA_TS = 'apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.ts';

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');
const yearOf = (iso) => Number(iso.slice(0, 4));
const sorted = (set) => [...set].sort();

/** Shared calendar: union of scheduled + exceptional closures, keyed by the ET date actually closed. */
function sharedCalendar() {
  const doc = JSON.parse(read(CALENDAR_JSON));
  const rows = [
    ...(doc.scheduled_full_day_closures ?? []),
    ...(doc.exceptional_full_day_closures ?? []),
  ];
  const dates = new Set(rows.map((row) => row.closed_et_date));
  return {
    dates,
    firstYear: yearOf(doc.domain_start),
    lastYear: yearOf(doc.domain_end),
    label: CALENDAR_JSON,
  };
}

/** Backend table: the `NYSE_FULL_DAY` `(year, month, day)` tuple list, production source only. */
function backendTable() {
  const source = read(BACKEND_TABLE_RS);
  const start = source.indexOf('NYSE_FULL_DAY: &[(i32, u8, u8)] = &[');
  assert.notEqual(start, -1, `${BACKEND_TABLE_RS}: NYSE_FULL_DAY table not found`);
  const end = source.indexOf('];', start);
  assert.notEqual(end, -1, `${BACKEND_TABLE_RS}: NYSE_FULL_DAY table is unterminated`);
  const body = source.slice(start, end);
  const dates = new Set(
    [...body.matchAll(/\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)/g)].map(
      ([, y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    ),
  );
  return spanOf(dates, BACKEND_TABLE_RS);
}

/** Dashboard replica: the ISO strings inside the `NYSE_FULL_DAY_HOLIDAYS` Set literal. */
function dashboardReplica() {
  const source = read(DASHBOARD_REPLICA_TS);
  const start = source.indexOf('NYSE_FULL_DAY_HOLIDAYS');
  assert.notEqual(start, -1, `${DASHBOARD_REPLICA_TS}: NYSE_FULL_DAY_HOLIDAYS not found`);
  const end = source.indexOf(']', start);
  assert.notEqual(end, -1, `${DASHBOARD_REPLICA_TS}: holiday Set literal is unterminated`);
  const dates = new Set(
    [...source.slice(start, end).matchAll(/'(\d{4}-\d{2}-\d{2})'/g)].map(([, iso]) => iso),
  );
  return spanOf(dates, DASHBOARD_REPLICA_TS);
}

function spanOf(dates, label) {
  const years = [...dates].map(yearOf);
  return { dates, firstYear: Math.min(...years), lastYear: Math.max(...years), label };
}

/**
 * Equality over the inclusive year range both artifacts cover, with an anti-vacuity floor: the
 * overlap must span several years and every year in it must carry a plausible number of closures
 * on both sides, so this can never pass by comparing two empty sets.
 */
function assertParity(left, right) {
  const firstYear = Math.max(left.firstYear, right.firstYear);
  const lastYear = Math.min(left.lastYear, right.lastYear);
  assert.ok(
    lastYear - firstYear >= 4,
    `overlap between ${left.label} and ${right.label} is too small to be meaningful ` +
      `(${firstYear}..${lastYear})`,
  );

  const inRange = (set) =>
    new Set([...set].filter((iso) => yearOf(iso) >= firstYear && yearOf(iso) <= lastYear));
  const a = inRange(left.dates);
  const b = inRange(right.dates);

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const [set, label] of [
      [a, left.label],
      [b, right.label],
    ]) {
      const count = [...set].filter((iso) => yearOf(iso) === year).length;
      assert.ok(
        count >= 8,
        `${label} declares only ${count} full-day closures in ${year}; the NYSE has at least 9 ` +
          '— the parity comparison would be vacuous',
      );
    }
  }

  const onlyLeft = sorted(a).filter((iso) => !b.has(iso));
  const onlyRight = sorted(b).filter((iso) => !a.has(iso));
  assert.deepEqual(
    { onlyIn: onlyLeft, missingFrom: onlyRight },
    { onlyIn: [], missingFrom: [] },
    `${left.label} and ${right.label} disagree over ${firstYear}..${lastYear}: ` +
      `only in ${left.label}: ${JSON.stringify(onlyLeft)}; ` +
      `only in ${right.label}: ${JSON.stringify(onlyRight)}`,
  );
}

test('dashboard replica equals the shared XNYS calendar for every year both cover', () => {
  assertParity(dashboardReplica(), sharedCalendar());
});

test('backend holiday table equals the shared XNYS calendar for every year both cover', () => {
  assertParity(backendTable(), sharedCalendar());
});

test('dashboard replica equals the backend holiday table for every year both cover', () => {
  assertParity(dashboardReplica(), backendTable());
});
