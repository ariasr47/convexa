// Dates in research notes. Catalysts, kill criteria and forecasts are often approximate ("~Nov 2026",
// "by Nov 10"), and a note ages when one of them passes, so each written form normalizes to a window
// whose `end` is the day it counts from. An approximate date counts from the END of its window, so a
// note never claims to predate an event that may not have happened yet (docs/research-method/README.md).

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** @param {string} value */
export function isCalendarDate(value) {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const parts = (day) => day.split('-').map(Number);

/** "2026-10-14" → "Oct 14, 2026". By hand, so no time zone can move the day. */
export function formatDay(day) {
  const [y, m, d] = parts(day);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from, to) {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** `day` moved by `n` days. */
export function addDays(day, n) {
  const [y, m, d] = parts(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function windowLabel(start, end) {
  const [y1, m1, d1] = parts(start);
  const [y2, m2, d2] = parts(end);
  if (y1 !== y2) return `${MONTH_NAMES[m1 - 1]} ${d1}, ${y1}–${MONTH_NAMES[m2 - 1]} ${d2}, ${y2}`;
  if (m1 !== m2) return `${MONTH_NAMES[m1 - 1]} ${d1}–${MONTH_NAMES[m2 - 1]} ${d2}, ${y1}`;
  return `${MONTH_NAMES[m1 - 1]} ${d1}–${d2}, ${y1}`;
}

/**
 * @typedef {{ text: string, kind: 'day' | 'month' | 'quarter' | 'year' | 'window' | 'by' | 'ongoing',
 *   start: string | null, end: string | null, approx: boolean, label: string }} When
 */

/**
 * Parse a written date. `ongoing` is accepted only where `allowOngoing` is set (kill criteria).
 * @param {string} raw
 * @param {{ allowOngoing?: boolean }} [options]
 * @returns {{ when: When } | { error: string }}
 */
export function parseWhen(raw, { allowOngoing = false } = {}) {
  const text = raw.trim();
  const bad = {
    error:
      `Write the date as 2026-10-14, 2026-11, 2026-Q4, 2027, 2026-11-05..2026-11-16, 2027-07..2027-12 or ` +
      `"by 2026-11-10"${allowOngoing ? ' (or "ongoing")' : ''}; got ${JSON.stringify(text)}.`,
  };
  if (/^ongoing$/i.test(text)) {
    if (!allowOngoing) return bad;
    return {
      when: { text, kind: 'ongoing', start: null, end: null, approx: true, label: 'Ongoing' },
    };
  }
  if (DAY_RE.test(text)) {
    if (!isCalendarDate(text)) return { error: `${JSON.stringify(text)} is not a real date.` };
    return {
      when: { text, kind: 'day', start: text, end: text, approx: false, label: formatDay(text) },
    };
  }
  const by = /^by\s+(\d{4}-\d{2}-\d{2})$/i.exec(text);
  if (by) {
    if (!isCalendarDate(by[1])) return { error: `${JSON.stringify(by[1])} is not a real date.` };
    return {
      when: {
        text,
        kind: 'by',
        start: null,
        end: by[1],
        approx: true,
        label: `by ${formatDay(by[1])}`,
      },
    };
  }
  const win = /^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/.exec(text);
  if (win) {
    const [, start, end] = win;
    if (!isCalendarDate(start) || !isCalendarDate(end))
      return { error: `${JSON.stringify(text)} has a date that isn't real.` };
    if (end < start) return { error: `The window ${JSON.stringify(text)} ends before it starts.` };
    return {
      when: { text, kind: 'window', start, end, approx: true, label: windowLabel(start, end) },
    };
  }
  const months = /^(\d{4})-(\d{2})\s*\.\.\s*(\d{4})-(\d{2})$/.exec(text);
  if (months) {
    const [y1, m1, y2, m2] = months.slice(1).map(Number);
    if (m1 < 1 || m1 > 12 || m2 < 1 || m2 > 12) return bad;
    const start = iso(y1, m1, 1);
    const end = iso(y2, m2, lastDay(y2, m2));
    if (end < start) return { error: `The window ${JSON.stringify(text)} ends before it starts.` };
    const label =
      y1 === y2
        ? `${MONTH_NAMES[m1 - 1]}–${MONTH_NAMES[m2 - 1]} ${y1}`
        : `${MONTH_NAMES[m1 - 1]} ${y1}–${MONTH_NAMES[m2 - 1]} ${y2}`;
    return { when: { text, kind: 'window', start, end, approx: true, label } };
  }
  const month = /^(\d{4})-(\d{2})$/.exec(text);
  if (month) {
    const [y, m] = [Number(month[1]), Number(month[2])];
    if (m < 1 || m > 12) return bad;
    return {
      when: {
        text,
        kind: 'month',
        start: iso(y, m, 1),
        end: iso(y, m, lastDay(y, m)),
        approx: true,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      },
    };
  }
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(text);
  if (quarter) {
    const [y, q] = [Number(quarter[1]), Number(quarter[2])];
    const endMonth = q * 3;
    return {
      when: {
        text,
        kind: 'quarter',
        start: iso(y, endMonth - 2, 1),
        end: iso(y, endMonth, lastDay(y, endMonth)),
        approx: true,
        label: `Q${q} ${y}`,
      },
    };
  }
  const year = /^(\d{4})$/.exec(text);
  if (year) {
    const y = Number(year[1]);
    return {
      when: {
        text,
        kind: 'year',
        start: iso(y, 1, 1),
        end: iso(y, 12, 31),
        approx: true,
        label: String(y),
      },
    };
  }
  return bad;
}
