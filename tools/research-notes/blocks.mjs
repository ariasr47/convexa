// Named fenced blocks in research notes (```metrics, ```catalysts, …): each row is `|`-separated
// cells, parsed into the typed data the dashboard draws. Every block is strict: a wrong cell count, an
// unknown status word, an undated figure or a number that isn't one fails the build with its line,
// never a silently half-drawn visual. Row formats are documented in research/README.md.

import { isCalendarDate, parseWhen } from './dates.mjs';
import { parseNumber, parseValuationBlock, splitAsOf, splitCells } from './valuation.mjs';

export const BLOCK_NAMES = [
  'strip',
  'tldr',
  'metrics',
  'chart',
  'split',
  'compare',
  'bridge',
  'units',
  'implied',
  'variant',
  'scorecard',
  'moat',
  'case',
  'premortem',
  'valuation',
  'catalysts',
  'kill',
  'forecasts',
  'changelog',
  'sources',
  'since',
  'moves',
];

const CHANGELOG_KINDS = [
  'initiation',
  'update',
  'outcome',
  'revision',
  'roll-forward',
  'correction',
];
/** Judgments a `moves` row may name, beside `<scenario>.<input>`. */
export const JUDGMENT_KEYS = [
  'terminal_tax',
  'terminal_growth',
  'terminal_wacc',
  'terminal_roc',
  'margin_year',
  'odds',
  'uncertainty',
  'stance',
  'target',
];
const SCENARIO_JUDGMENT_RE =
  /^(bear|base|bull)\.(rev_y1|reinvest_y1|growth|margin_y1|margin_target|sales_to_capital|wacc|p_fail|distress)$/;

/** `"Caption"` → Caption; anything else → null. */
function caption(args) {
  const m = /^"(.*)"$/.exec(args.trim());
  return m ? m[1] : null;
}

/**
 * Parse one named block.
 * @param {string} name
 * @param {string} args the rest of the opening line after the name
 * @param {{ text: string, line: number }[]} lines the block's inner lines
 * @param {{ fail: (line: number, message: string) => void, inline: (text: string, line: number) => any[] }} ctx
 * @param {number} openLine the line of the opening fence
 * @returns {any | null}
 */
export function parseTypedBlock(name, args, lines, ctx, openLine) {
  const { fail, inline } = ctx;
  if (name === 'valuation') {
    if (args.trim()) fail(openLine, 'The valuation block takes no arguments.');
    return parseValuationBlock(lines, fail, inline);
  }
  const rows = lines
    .filter((l) => l.text.trim())
    .map((l) => ({ cells: splitCells(l.text), line: l.line }));
  let ok = true;
  const need = (cond, line, message) => {
    if (!cond) {
      fail(line, message);
      ok = false;
    }
    return Boolean(cond);
  };
  const count = (min, max) =>
    need(
      rows.length >= min && rows.length <= max,
      openLine,
      min === max
        ? `A ${name} block has exactly ${min} row${min === 1 ? '' : 's'}.`
        : `A ${name} block has ${min} to ${max} rows; this one has ${rows.length}.`,
    );
  const cells = (row, min, max, format) =>
    need(
      row.cells.length >= min && row.cells.length <= max,
      row.line,
      `A ${name} row is "${format}"; this one has ${row.cells.length} cell${row.cells.length === 1 ? '' : 's'}.`,
    );
  const word = (row, value, allowed, what) =>
    need(
      allowed.includes(value),
      row.line,
      `${what} is one of ${allowed.filter(Boolean).join(', ')}; got ${JSON.stringify(value)}.`,
    );
  const number = (row, raw, what) => {
    const n = parseNumber(raw);
    need(n !== null, row.line, `${what} must be a number; got ${JSON.stringify(raw)}.`);
    return n;
  };
  const dated = (row, raw) => {
    const split = splitAsOf(raw);
    need(
      split,
      row.line,
      `Every figure carries its date: write ${JSON.stringify(raw)} as "value @ as-of", like "$209.9M @ Q2 2026".`,
    );
    return split ?? { value: raw, asOf: '' };
  };
  const when = (row, raw, options) => {
    const parsed = parseWhen(raw, options);
    if ('error' in parsed) {
      need(false, row.line, parsed.error);
      return null;
    }
    return parsed.when;
  };
  const text = (row, i) => inline(row.cells[i] ?? '', row.line);
  const plain = (row, i) => (row.cells[i] ?? '').replace(/\\\|/g, '|');

  /** @type {any} */
  let block = null;
  switch (name) {
    case 'strip': {
      count(1, 8);
      const items = rows.map((r) => {
        cells(r, 2, 3, 'label | value @ as-of | sub');
        const v = dated(r, r.cells[1] ?? '');
        return { label: plain(r, 0), value: v.value, asOf: v.asOf, sub: text(r, 2) };
      });
      block = { type: 'strip', items };
      break;
    }
    case 'tldr': {
      count(1, 4);
      const items = rows.map((r) => {
        cells(r, 2, 2, 'figure | sentence');
        return { figure: plain(r, 0), text: text(r, 1) };
      });
      block = { type: 'tldr', items };
      break;
    }
    case 'metrics': {
      count(1, 12);
      const items = rows.map((r) => {
        cells(r, 2, 5, 'label | value @ as-of | delta | up/down/flat | note');
        const v = dated(r, r.cells[1] ?? '');
        const dir = (r.cells[3] ?? '').toLowerCase() || 'flat';
        word(r, dir, ['up', 'down', 'flat'], 'The direction');
        return {
          label: plain(r, 0),
          value: v.value,
          asOf: v.asOf,
          delta: plain(r, 2),
          dir,
          note: text(r, 4),
        };
      });
      block = { type: 'metrics', items };
      break;
    }
    case 'chart': {
      const m = /^bar\s+"(.*)"$/.exec(args.trim());
      need(m, openLine, 'Write the chart as ```chart bar "Caption".');
      count(2, 16);
      const bars = rows.map((r) => {
        cells(r, 2, 4, 'label | number | approx/guide | shown text');
        const kind = (r.cells[2] ?? '').toLowerCase();
        word(r, kind, ['', 'approx', 'guide'], 'The bar kind');
        return {
          label: plain(r, 0),
          value: number(r, r.cells[1] ?? '', 'The bar'),
          kind,
          shown: plain(r, 3),
        };
      });
      const latest = bars.map((b) => b.kind).lastIndexOf('');
      block = { type: 'chart', caption: m ? m[1] : '', bars, latest };
      break;
    }
    case 'split': {
      count(2, 8);
      const items = rows.map((r) => {
        cells(r, 2, 3, 'label | number | detail');
        const value = number(r, r.cells[1] ?? '', 'The share');
        need(value === null || value > 0, r.line, 'Each share must be above zero.');
        return { label: plain(r, 0), value, detail: plain(r, 2) };
      });
      const total = items.reduce((s, i) => s + (i.value ?? 0), 0);
      for (const i of items)
        i.share = total > 0 ? Math.round(((i.value ?? 0) / total) * 1000) / 10 : 0;
      block = { type: 'split', caption: caption(args), items };
      break;
    }
    case 'compare': {
      count(1, 8);
      const items = rows.map((r) => {
        cells(r, 3, 4, 'label | number | shown text | emph');
        const value = number(r, r.cells[1] ?? '', 'The bar');
        need(value === null || value >= 0, r.line, "A compare bar can't be negative.");
        const emph = (r.cells[3] ?? '').toLowerCase();
        word(r, emph, ['', 'emph'], 'The last cell');
        return { label: plain(r, 0), value, shown: plain(r, 2), emph: emph === 'emph' };
      });
      block = { type: 'compare', caption: caption(args), items };
      break;
    }
    case 'bridge': {
      count(3, 10);
      const steps = rows.map((r) => {
        cells(r, 2, 2, 'label | number');
        return { label: plain(r, 0), value: number(r, r.cells[1] ?? '', 'The step') };
      });
      if (ok) {
        const start = steps[0].value;
        const end = steps.at(-1).value;
        const sum = steps.slice(1, -1).reduce((s, x) => s + x.value, start);
        need(
          Math.abs(sum - end) <= 0.05 + Math.abs(end) * 0.0005,
          rows.at(-1).line,
          `The bridge doesn't add up: ${start} plus the steps is ${Math.round(sum * 100) / 100}, not ${end}.`,
        );
      }
      block = { type: 'bridge', caption: caption(args), steps };
      break;
    }
    case 'units': {
      count(1, 1);
      const r = rows[0];
      if (r && cells(r, 2, 2, 'total | unit')) {
        const total = number(r, r.cells[0], 'The total');
        const unit = number(r, r.cells[1], 'The unit');
        if (need(total > 0 && unit > 0, r.line, 'The total and the unit must be above zero.')) {
          const units = total / unit;
          need(
            units <= 100,
            r.line,
            `That draws ${Math.round(units)} blocks; pick a unit that makes 100 or fewer.`,
          );
          block = {
            type: 'units',
            caption: caption(args),
            total,
            unit,
            count: Math.round(units * 10) / 10,
          };
        }
      }
      break;
    }
    case 'implied':
      need(
        rows.length === 0,
        openLine,
        'The implied block has no rows: it draws from the valuation block.',
      );
      block = { type: 'implied' };
      break;
    case 'variant': {
      count(1, 8);
      const items = rows.map((r) => {
        cells(r, 4, 4, 'driver | what the price implies | your view | what settles it');
        return { driver: plain(r, 0), implied: text(r, 1), view: text(r, 2), settles: text(r, 3) };
      });
      block = { type: 'variant', items };
      break;
    }
    case 'scorecard': {
      count(1, 8);
      const items = rows.map((r) => {
        cells(r, 5, 5, 'pillar | metric | latest | ok/watch/broken | kill criterion');
        const status = (r.cells[3] ?? '').toLowerCase();
        word(r, status, ['ok', 'watch', 'broken'], 'The status');
        return {
          pillar: plain(r, 0),
          metric: plain(r, 1),
          latest: plain(r, 2),
          status,
          kill: text(r, 4),
        };
      });
      block = { type: 'scorecard', items };
      break;
    }
    case 'moat': {
      count(1, 6);
      const items = rows.map((r) => {
        cells(r, 3, 3, 'source | evidence/unproven/none | why');
        const status = (r.cells[1] ?? '').toLowerCase();
        word(r, status, ['evidence', 'unproven', 'none'], 'The moat status');
        return { source: plain(r, 0), status, why: text(r, 2) };
      });
      block = { type: 'moat', items };
      break;
    }
    case 'case': {
      count(2, 12);
      const items = rows.map((r) => {
        cells(r, 2, 2, '+ headline | detail');
        const first = r.cells[0] ?? '';
        const side = first.startsWith('+') ? 'for' : first.startsWith('-') ? 'against' : null;
        need(side, r.line, 'Start each case row with + (the case for) or - (the case against).');
        return { side, head: inline(first.replace(/^[+-]\s*/, ''), r.line), body: text(r, 1) };
      });
      need(
        items.some((i) => i.side === 'for') && items.some((i) => i.side === 'against'),
        openLine,
        'A case block needs both sides: at least one + row and one - row.',
      );
      block = { type: 'case', items };
      break;
    }
    case 'premortem': {
      count(1, 6);
      const items = rows.map((r) => {
        cells(r, 1, 2, 'story | #n');
        const kill = plain(r, 1);
        need(
          !kill || /^#\d+$/.test(kill),
          r.line,
          `The kill criterion reference is written #n; got ${JSON.stringify(kill)}.`,
        );
        return { story: text(r, 0), kill: kill || null };
      });
      block = { type: 'premortem', items };
      break;
    }
    case 'catalysts': {
      count(1, 20);
      const items = rows.map((r) => {
        cells(r, 4, 5, 'date | event | detail | confirmed/expected/target | outcome');
        const status = (r.cells[3] ?? '').toLowerCase();
        word(r, status, ['confirmed', 'expected', 'target'], 'The status');
        return {
          when: when(r, r.cells[0] ?? ''),
          event: plain(r, 1),
          detail: text(r, 2),
          status,
          outcome: r.cells[4] ? text(r, 4) : null,
        };
      });
      block = { type: 'catalysts', items };
      break;
    }
    case 'kill': {
      count(1, 10);
      const items = rows.map((r) => {
        cells(r, 6, 7, '#n | trigger | threshold | source | check by | then | outcome');
        const n = plain(r, 0);
        need(
          /^#\d+$/.test(n),
          r.line,
          `Number each kill criterion #1, #2, …; got ${JSON.stringify(n)}.`,
        );
        return {
          n,
          trigger: plain(r, 1),
          threshold: text(r, 2),
          source: plain(r, 3),
          checkBy: when(r, r.cells[4] ?? '', { allowOngoing: true }),
          then: text(r, 5),
          outcome: r.cells[6] ? text(r, 6) : null,
        };
      });
      const seen = new Set();
      for (const [i, item] of items.entries()) {
        need(!seen.has(item.n), rows[i].line, `Kill criterion ${item.n} appears twice.`);
        seen.add(item.n);
      }
      block = { type: 'kill', items };
      break;
    }
    case 'forecasts': {
      count(1, 20);
      const items = rows.map((r) => {
        cells(r, 4, 5, 'claim | probability | resolve by | source | yes/no/void');
        const rawP = (r.cells[1] ?? '').trim();
        let p = null;
        if (rawP) {
          p = rawP.endsWith('%') ? Number(rawP.slice(0, -1)) / 100 : parseNumber(rawP);
          need(
            p !== null && Number.isFinite(p) && p >= 0 && p <= 1,
            r.line,
            `A probability is from 0 to 1 (or 0% to 100%); got ${JSON.stringify(rawP)}.`,
          );
        }
        const outcome = (r.cells[4] ?? '').toLowerCase() || null;
        if (outcome) word(r, outcome, ['yes', 'no', 'void'], 'The outcome');
        const hit = outcome === 'yes' ? 1 : outcome === 'no' ? 0 : null;
        return {
          claim: text(r, 0),
          p,
          resolveBy: when(r, r.cells[2] ?? ''),
          source: plain(r, 3),
          outcome,
          brier: p !== null && hit !== null ? Math.round((p - hit) ** 2 * 1000) / 1000 : null,
        };
      });
      block = { type: 'forecasts', items };
      break;
    }
    case 'changelog': {
      count(1, 60);
      const items = rows.map((r) => {
        cells(r, 3, 3, 'date | kind | text');
        const date = plain(r, 0);
        need(
          isCalendarDate(date),
          r.line,
          `A change-log date is a real day like 2026-10-12; got ${JSON.stringify(date)}.`,
        );
        const kind = (r.cells[1] ?? '').toLowerCase();
        word(r, kind, CHANGELOG_KINDS, 'The change kind');
        return { date, kind, text: text(r, 2) };
      });
      block = { type: 'changelog', items };
      break;
    }
    case 'sources': {
      count(1, 200);
      const seen = new Set();
      const items = rows.map((r) => {
        cells(r, 3, 3, 'n | title | https://…');
        const n = parseNumber(r.cells[0] ?? '');
        need(
          n !== null && Number.isInteger(n) && n > 0,
          r.line,
          `A source number is a whole number; got ${JSON.stringify(r.cells[0])}.`,
        );
        need(!seen.has(n), r.line, `Source ${n} appears twice.`);
        seen.add(n);
        const url = plain(r, 2);
        need(
          /^https?:\/\/\S+$/i.test(url),
          r.line,
          `A source link starts with https:// or http://; got ${JSON.stringify(url)}.`,
        );
        let host = url;
        try {
          host = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          need(false, r.line, `${JSON.stringify(url)} isn't a valid link.`);
        }
        return { n, title: plain(r, 1), url, host };
      });
      block = { type: 'sources', items };
      break;
    }
    case 'since': {
      count(1, 40);
      const items = rows.map((r) => {
        cells(r, 3, 3, 'catalyst/forecast/kill/pillar | the old call | what happened');
        const kind = (r.cells[0] ?? '').toLowerCase();
        word(r, kind, ['catalyst', 'forecast', 'kill', 'pillar'], 'The call kind');
        return { kind, call: text(r, 1), outcome: text(r, 2) };
      });
      block = { type: 'since', items };
      break;
    }
    case 'moves': {
      count(1, 40);
      const items = rows.map((r) => {
        cells(r, 4, 4, 'input | old → new | trigger | why');
        const input = plain(r, 0);
        need(
          JUDGMENT_KEYS.includes(input) || SCENARIO_JUDGMENT_RE.test(input),
          r.line,
          `"${input}" isn't a judgment input. Name one as written: base.margin_target, odds, stance, …`,
        );
        const change = plain(r, 1);
        need(/→|->/.test(change), r.line, 'Write the change as "old → new".');
        return { input, change, trigger: plain(r, 2), why: text(r, 3) };
      });
      block = { type: 'moves', items };
      break;
    }
    default:
      fail(openLine, `Unknown block "${name}". Blocks: ${BLOCK_NAMES.join(', ')}.`);
      return null;
  }
  return ok ? block : null;
}
