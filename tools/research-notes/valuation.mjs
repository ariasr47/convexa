// The research notes' valuation: a 10-year free-cash-flow DCF in Damodaran's story-to-numbers form,
// with failure or distress weighted in the cash-flow outcome rather than the discount rate. A note
// states its inputs in a ```valuation block; every value a reader sees (scenario values, the weighted
// value, the sensitivity grid, the growth the price implies) is computed here at build time, so no
// output is ever typed by hand. The model is documented for authors in research/README.md.
//
// Units: money in $ millions, shares in millions, price and distress value in dollars per share,
// rates as fractions (the block writes them as percentages).

import { isCalendarDate, parseWhen } from './dates.mjs';

export const SCENARIOS = /** @type {const} */ (['bear', 'base', 'bull']);
const YEARS = 10;
const HIGH_GROWTH_YEARS = 5;

/** Scenario inputs: unit, whether required, and whether the column is a judgment the author owns. */
const COLUMNS = {
  rev_y1: { unit: 'money', required: false },
  growth: { unit: 'pct', required: true },
  margin_y1: { unit: 'pct', required: false },
  margin_target: { unit: 'pct', required: true },
  sales_to_capital: { unit: 'ratio', required: true },
  wacc: { unit: 'pct', required: true },
  p_fail: { unit: 'pct', required: true },
  distress: { unit: 'money', required: true },
};
const STORY = 'story';

const GLOBAL_KEYS = [
  'method',
  'why',
  'price',
  'shares',
  'net_cash',
  'revenue',
  'margin_now',
  'nol',
  'tax',
  'terminal_growth',
  'terminal_wacc',
  'terminal_roc',
  'margin_year',
  'uncertainty',
  'uncertainty_why',
  'sensitivity',
  'odds',
  'traded',
  'third_party',
];
const REQUIRED_KEYS = [
  'method',
  'price',
  'shares',
  'net_cash',
  'revenue',
  'margin_now',
  'tax',
  'terminal_growth',
  'terminal_wacc',
];
/** Global inputs a sensitivity grid may vary, beside the scenario columns. */
const SENSITIVE_GLOBALS = {
  terminal_growth: 'pct',
  terminal_wacc: 'pct',
  terminal_roc: 'pct',
  tax: 'pct',
  margin_year: 'int',
};
export const UNCERTAINTY = ['low', 'medium', 'high', 'very-high', 'extreme'];

// ---------------------------------------------------------------------------------------------
// Numbers

/** "1,234.5", "$146.62", "−16" → number; anything else → null. */
export function parseNumber(raw) {
  const t = String(raw).trim().replace(/[−–]/g, '-').replace(/\$/g, '').replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** "21%" → 0.21. The % is required, so a rate can never be read at the wrong scale. */
export function parsePercent(raw) {
  const m = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(String(raw).trim().replace(/[−–]/g, '-'));
  return m ? Number(m[1]) / 100 : null;
}

const parseUnit = (unit, raw) => {
  if (unit === 'pct') return parsePercent(raw);
  if (unit === 'int') {
    const n = parseNumber(raw);
    return n !== null && Number.isInteger(n) ? n : null;
  }
  return parseNumber(raw);
};
const UNIT_HINT = {
  pct: 'a percentage like 12%',
  money: 'a number',
  ratio: 'a number',
  int: 'a whole number',
};

/** Split "value @ as-of". */
export function splitAsOf(raw) {
  const at = raw.lastIndexOf('@');
  if (at === -1) return null;
  const value = raw.slice(0, at).trim();
  const asOf = raw.slice(at + 1).trim();
  return value && asOf ? { value, asOf } : null;
}

const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------
// The model

/**
 * One scenario through the DCF.
 * @param {ValuationInputs} g
 * @param {ScenarioInputs} s
 */
export function runScenario(g, s) {
  const marginYear = g.marginYear;
  const startMargin = s.margin_y1 ?? g.marginNow;
  const startYear = s.margin_y1 == null ? 0 : 1;
  let revenue = g.revenue;
  let nol = g.nol;
  let discount = 1;
  let pvExplicit = 0;
  for (let t = 1; t <= YEARS; t++) {
    let next;
    if (t === 1 && s.rev_y1 != null) next = s.rev_y1;
    else {
      const growth =
        t <= HIGH_GROWTH_YEARS
          ? s.growth
          : s.growth +
            ((g.terminalGrowth - s.growth) * (t - HIGH_GROWTH_YEARS)) / (YEARS - HIGH_GROWTH_YEARS);
      next = revenue * (1 + growth);
    }
    const margin =
      t >= marginYear
        ? s.margin_target
        : t <= startYear
          ? startMargin
          : startMargin +
            ((s.margin_target - startMargin) * (t - startYear)) / (marginYear - startYear);
    const ebit = next * margin;
    let taxable = 0;
    if (ebit > 0) {
      const used = Math.min(nol, ebit);
      nol -= used;
      taxable = ebit - used;
    } else nol -= ebit;
    const nopat = ebit - taxable * g.tax;
    const reinvestment = Math.max(0, next - revenue) / s.sales_to_capital;
    const wacc =
      t <= HIGH_GROWTH_YEARS
        ? s.wacc
        : s.wacc +
          ((g.terminalWacc - s.wacc) * (t - HIGH_GROWTH_YEARS)) / (YEARS - HIGH_GROWTH_YEARS);
    discount /= 1 + wacc;
    pvExplicit += (nopat - reinvestment) * discount;
    revenue = next;
  }
  const terminalRevenue = revenue * (1 + g.terminalGrowth);
  const terminalEbit = terminalRevenue * s.margin_target;
  const terminalNopat = terminalEbit > 0 ? terminalEbit * (1 - g.tax) : terminalEbit;
  const reinvestmentRate = g.terminalGrowth / g.terminalRoc;
  const terminalValue =
    (terminalNopat * (1 - reinvestmentRate)) / (g.terminalWacc - g.terminalGrowth);
  const pvTerminal = terminalValue * discount;
  const ev = pvExplicit + pvTerminal;
  const equity = ev + g.netCash;
  const goingConcern = Math.max(0, equity) / g.shares;
  const value = goingConcern * (1 - s.p_fail) + s.distress * s.p_fail;
  return { value, goingConcern, ev, equity, pvTerminal, revenueY10: revenue };
}

const vs = (value, price) => round2((value / price - 1) * 100);

/**
 * The base case solved for `growth`: the yearly revenue growth (through year 5) at which the base
 * value equals the price. Scans for a sign change, then bisects; null when no rate in range gets there.
 */
export function impliedGrowth(g, base, price) {
  const gap = (growth) => runScenario(g, { ...base, growth }).value - price;
  const lo = -0.5;
  const hi = 3;
  const step = 0.05;
  let a = lo;
  let fa = gap(a);
  for (let b = lo + step; b <= hi + 1e-9; b += step) {
    const fb = gap(b);
    if (fa === 0) return { growth: a, bound: null };
    if (Math.sign(fa) !== Math.sign(fb)) {
      let [x, y, fx] = [a, b, fa];
      for (let i = 0; i < 60; i++) {
        const mid = (x + y) / 2;
        const fm = gap(mid);
        if (Math.sign(fm) === Math.sign(fx)) [x, fx] = [mid, fm];
        else y = mid;
      }
      return { growth: (x + y) / 2, bound: null };
    }
    [a, fa] = [b, fb];
  }
  return { growth: null, bound: gap(hi) < 0 ? 'above' : 'below' };
}

/**
 * Every output the note shows.
 * @param {ValuationInputs} g
 */
export function computeValuation(g) {
  const price = g.price.value;
  /** @type {Record<string, { value: number, goingConcern: number, vsPrice: number }>} */
  const scenarios = {};
  for (const s of g.scenarios) {
    const r = runScenario(g, s.inputs);
    scenarios[s.name] = {
      value: round2(r.value),
      goingConcern: round2(r.goingConcern),
      vsPrice: vs(r.value, price),
    };
  }
  let weighted = null;
  if (g.odds) {
    const value =
      SCENARIOS.reduce((sum, name, i) => sum + scenarios[name].value * g.odds[i], 0) / 20;
    weighted = { value: round2(value), vsPrice: vs(value, price) };
  }
  let sensitivity = null;
  if (g.sensitivity) {
    const base = g.scenarios.find((s) => s.name === 'base').inputs;
    const { row, col } = g.sensitivity;
    const apply = (inputs, globals, axis, value) => {
      if (axis.key in COLUMNS) return [{ ...inputs, [axis.key]: value }, globals];
      const next = { ...globals, [axis.globalField]: value };
      // With no terminal_roc of its own, the terminal return tracks terminal_wacc (no excess returns).
      if (axis.globalField === 'terminalWacc' && globals.rocFollowsWacc) next.terminalRoc = value;
      return [inputs, next];
    };
    sensitivity = {
      row: { key: row.key, labels: row.labels },
      col: { key: col.key, labels: col.labels },
      cells: row.values.map((rv) =>
        col.values.map((cv) => {
          let [inputs, globals] = apply(base, g, row, rv);
          [inputs, globals] = apply(inputs, globals, col, cv);
          const value = runScenario(globals, inputs).value;
          return { value: round2(value), vsPrice: vs(value, price) };
        }),
      ),
    };
  }
  const base = g.scenarios.find((s) => s.name === 'base').inputs;
  const solved = impliedGrowth(g, base, price);
  const marketCap = price * g.shares;
  const ev = marketCap - g.netCash;
  const nopatNow =
    g.revenue * g.marginNow > 0 ? g.revenue * g.marginNow * (1 - g.tax) : g.revenue * g.marginNow;
  const steadyState = Math.max(0, nopatNow / base.wacc + g.netCash) / g.shares;
  const values = SCENARIOS.map((name) => scenarios[name].value);
  return {
    scenarios,
    weighted,
    sensitivity,
    range: { lo: Math.min(...values), hi: Math.max(...values) },
    implied: {
      growth: solved.growth === null ? null : round2(solved.growth * 100),
      bound: solved.bound,
      growthYears: base.rev_y1 == null ? 'years 1–5' : 'years 2–5',
      marketCap: round2(marketCap),
      ev: round2(ev),
      evToRevenue: round2(ev / g.revenue),
      steadyStateShare: round2(Math.min(1, steadyState / price) * 100),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The ```valuation block

/**
 * @typedef {{ rev_y1: number | null, growth: number, margin_y1: number | null, margin_target: number,
 *   sales_to_capital: number, wacc: number, p_fail: number, distress: number }} ScenarioInputs
 * @typedef {{ price: { value: number, asOf: string }, shares: number, netCash: number, revenue: number,
 *   marginNow: number, nol: number, tax: number, terminalGrowth: number, terminalWacc: number,
 *   terminalRoc: number, rocFollowsWacc: boolean, marginYear: number, odds: number[] | null,
 *   scenarios: { name: string, inputs: ScenarioInputs }[], sensitivity: any }} ValuationInputs
 */

function parseAxis(text, fail) {
  const m = /^([a-z_0-9]+)\s+(.+)$/.exec(text.trim());
  if (!m) return null;
  const key = m[1];
  const unit = key in COLUMNS ? COLUMNS[key].unit : SENSITIVE_GLOBALS[key];
  if (!unit) {
    fail(
      `Sensitivity can vary ${[...Object.keys(COLUMNS), ...Object.keys(SENSITIVE_GLOBALS)].join(', ')}; got "${key}".`,
    );
    return null;
  }
  const labels = m[2].split(',').map((v) => v.trim());
  const values = labels.map((v) => parseUnit(unit, v));
  if (labels.length !== 3 || values.some((v) => v === null)) {
    fail(`Sensitivity "${key}" needs three values, each ${UNIT_HINT[unit]}.`);
    return null;
  }
  const globalField = {
    terminal_growth: 'terminalGrowth',
    terminal_wacc: 'terminalWacc',
    terminal_roc: 'terminalRoc',
    tax: 'tax',
    margin_year: 'marginYear',
  }[key];
  return { key, labels, values, globalField };
}

/**
 * Parse a ```valuation block's lines.
 * @param {{ text: string, line: number }[]} lines
 * @param {(line: number, message: string) => void} fail
 * @param {(text: string, line: number) => any[]} inline
 */
export function parseValuationBlock(lines, fail, inline) {
  /** @type {Record<string, { value: string, line: number }>} */
  const fields = {};
  let header = null;
  /** @type {{ cells: string[], line: number }[]} */
  const rows = [];
  for (const { text, line } of lines) {
    const t = text.trim();
    if (!t) continue;
    if (/^scenario\s*\|/i.test(t)) {
      if (header) fail(line, 'The scenario table appears twice.');
      header = { cells: splitCells(t).map((c) => c.toLowerCase()), line };
      continue;
    }
    if (header && /^(bear|base|bull)\s*\|/i.test(t)) {
      rows.push({ cells: splitCells(t), line });
      continue;
    }
    const kv = /^([a-z_]+)\s*:\s*(.*)$/.exec(t);
    if (!kv) {
      fail(
        line,
        `Valuation lines are "key: value" or scenario table rows; got ${JSON.stringify(t)}.`,
      );
      continue;
    }
    if (!GLOBAL_KEYS.includes(kv[1])) {
      fail(line, `Unknown valuation field "${kv[1]}". Allowed: ${GLOBAL_KEYS.join(', ')}.`);
      continue;
    }
    if (kv[1] in fields) {
      fail(line, `Valuation field "${kv[1]}" appears twice.`);
      continue;
    }
    fields[kv[1]] = { value: kv[2].trim(), line };
  }
  const blockLine = lines[0]?.line ?? 0;
  let ok = true;
  const need = (cond, line, message) => {
    if (!cond) {
      fail(line, message);
      ok = false;
    }
    return cond;
  };
  for (const key of REQUIRED_KEYS)
    need(fields[key]?.value, fields[key]?.line ?? blockLine, `The valuation needs "${key}".`);

  const dated = (key, unit, { day = false } = {}) => {
    const f = fields[key];
    if (!f?.value) return null;
    const split = splitAsOf(f.value);
    if (!need(split, f.line, `"${key}" carries its date: write it as "value @ as-of".`))
      return null;
    const value = parseUnit(unit, split.value);
    if (
      !need(
        value !== null,
        f.line,
        `"${key}" must be ${UNIT_HINT[unit]}; got ${JSON.stringify(split.value)}.`,
      )
    )
      return null;
    if (
      day &&
      !need(
        isCalendarDate(split.asOf),
        f.line,
        `"${key}" is dated with a real day, like 2026-10-12.`,
      )
    )
      return null;
    return { value, asOf: split.asOf };
  };
  const plain = (key, unit) => {
    const f = fields[key];
    if (!f?.value) return null;
    const value = parseUnit(unit, f.value);
    need(
      value !== null,
      f.line,
      `"${key}" must be ${UNIT_HINT[unit]}; got ${JSON.stringify(f.value)}.`,
    );
    return value;
  };

  const price = dated('price', 'money', { day: true });
  const shares = dated('shares', 'money');
  const netCash = dated('net_cash', 'money');
  const revenue = dated('revenue', 'money');
  const marginNow = dated('margin_now', 'pct');
  const nol = fields.nol ? dated('nol', 'money') : null;
  const tax = plain('tax', 'pct');
  const terminalGrowth = plain('terminal_growth', 'pct');
  const terminalWacc = plain('terminal_wacc', 'pct');
  const terminalRoc = fields.terminal_roc ? plain('terminal_roc', 'pct') : terminalWacc;
  const marginYear = fields.margin_year ? plain('margin_year', 'int') : 5;

  if (price) need(price.value > 0, fields.price.line, '"price" must be above zero.');
  if (shares) need(shares.value > 0, fields.shares.line, '"shares" must be above zero.');
  if (revenue) need(revenue.value > 0, fields.revenue.line, '"revenue" must be above zero.');
  if (nol) need(nol.value >= 0, fields.nol.line, '"nol" can\'t be negative.');
  if (tax !== null)
    need(tax >= 0 && tax < 1, fields.tax.line, '"tax" must be from 0% to under 100%.');
  if (terminalGrowth !== null && terminalWacc !== null)
    need(
      terminalWacc > terminalGrowth,
      fields.terminal_wacc.line,
      '"terminal_wacc" must be above "terminal_growth", or the terminal value is infinite.',
    );
  if (terminalRoc !== null)
    need(
      terminalRoc > 0,
      fields.terminal_roc?.line ?? blockLine,
      '"terminal_roc" must be above zero.',
    );
  if (marginYear !== null)
    need(
      marginYear >= 1 && marginYear <= YEARS,
      fields.margin_year?.line ?? blockLine,
      `"margin_year" is a year from 1 to ${YEARS}.`,
    );

  const uncertainty = fields.uncertainty?.value.toLowerCase() || null;
  if (uncertainty)
    need(
      UNCERTAINTY.includes(uncertainty),
      fields.uncertainty.line,
      `"uncertainty" is one of ${UNCERTAINTY.join(', ')}.`,
    );

  let odds = null;
  if (fields.odds?.value) {
    const parts = fields.odds.value.split('/').map((p) => parseNumber(p));
    if (
      need(
        parts.length === 3 && parts.every((p) => p !== null && Number.isInteger(p) && p >= 0),
        fields.odds.line,
        '"odds" are three whole numbers, bear/base/bull, like 5/11/4.',
      ) &&
      need(
        parts.reduce((a, b) => a + b, 0) === 20,
        fields.odds.line,
        `"odds" are in twentieths, so they sum to 20; these sum to ${parts.reduce((a, b) => a + b, 0)}.`,
      )
    )
      odds = parts;
  }

  let traded = null;
  if (fields.traded?.value) {
    const split = splitAsOf(fields.traded.value);
    const range = split && /^(.+?)\s*[-–]\s*(.+)$/.exec(split.value);
    const lo = range && parseNumber(range[1]);
    const hi = range && parseNumber(range[2]);
    const when = split && parseWhen(split.asOf);
    if (
      need(
        lo !== null && hi !== null && lo > 0 && hi >= lo && when && 'when' in when,
        fields.traded.line,
        '"traded" is a low-high range with its dates, like "146 - 350 @ 2026-05-14..2026-10-12".',
      )
    )
      traded = { lo, hi, when: when.when };
  }

  let thirdParty = null;
  if (fields.third_party?.value) {
    const [head, ...rest] = fields.third_party.value.split('|');
    const split = splitAsOf(head);
    const value = split && parseNumber(split.value);
    if (
      need(
        value !== null && value > 0 && isCalendarDate(split.asOf) && rest.join('|').trim(),
        fields.third_party.line,
        '"third_party" is "value @ 2026-10-12 | who said it".',
      )
    )
      thirdParty = { value, asOf: split.asOf, label: rest.join('|').trim() };
  }

  // Scenario table
  const scenarios = [];
  if (
    need(
      header,
      blockLine,
      'The valuation needs a scenario table: a "scenario | …" header, then bear, base and bull rows.',
    )
  ) {
    const cols = header.cells;
    const known = new Set(['scenario', ...Object.keys(COLUMNS), STORY]);
    for (const c of cols)
      need(
        known.has(c),
        header.line,
        `Unknown scenario column "${c}". Allowed: ${[...known].join(', ')}.`,
      );
    for (const [key, spec] of Object.entries(COLUMNS))
      if (spec.required)
        need(cols.includes(key), header.line, `The scenario table needs a "${key}" column.`);
    need(cols.includes(STORY), header.line, 'The scenario table needs a "story" column.');
    need(
      cols[0] === 'scenario',
      header.line,
      'The scenario table starts with the "scenario" column.',
    );
    for (const name of SCENARIOS) {
      const matches = rows.filter((r) => r.cells[0].toLowerCase() === name);
      if (
        !need(
          matches.length === 1,
          header.line,
          `The scenario table needs exactly one "${name}" row.`,
        )
      )
        continue;
      const row = matches[0];
      if (
        !need(
          row.cells.length === cols.length,
          row.line,
          `The "${name}" row has ${row.cells.length} cells; the header has ${cols.length}.`,
        )
      )
        continue;
      /** @type {Record<string, any>} */
      const inputs = {};
      for (const [key, spec] of Object.entries(COLUMNS)) {
        const at = cols.indexOf(key);
        const raw = at === -1 ? '' : row.cells[at];
        if (!raw) {
          inputs[key] = null;
          need(!spec.required, row.line, `"${name}" needs a value for "${key}".`);
          continue;
        }
        const value = parseUnit(spec.unit, raw);
        if (
          need(
            value !== null,
            row.line,
            `"${name}" ${key} must be ${UNIT_HINT[spec.unit]}; got ${JSON.stringify(raw)}.`,
          )
        )
          inputs[key] = value;
      }
      if (inputs.sales_to_capital !== null && inputs.sales_to_capital !== undefined)
        need(
          inputs.sales_to_capital > 0,
          row.line,
          `"${name}" sales_to_capital must be above zero.`,
        );
      if (inputs.p_fail !== null && inputs.p_fail !== undefined)
        need(
          inputs.p_fail >= 0 && inputs.p_fail <= 1,
          row.line,
          `"${name}" p_fail is from 0% to 100%.`,
        );
      if (inputs.distress !== null && inputs.distress !== undefined)
        need(inputs.distress >= 0, row.line, `"${name}" distress value can't be negative.`);
      if (inputs.rev_y1 !== null && inputs.rev_y1 !== undefined)
        need(inputs.rev_y1 > 0, row.line, `"${name}" rev_y1 must be above zero.`);
      scenarios.push({
        name,
        inputs,
        story: inline(row.cells[cols.indexOf(STORY)] ?? '', row.line),
        line: row.line,
      });
    }
    for (const r of rows)
      need(
        SCENARIOS.includes(r.cells[0].toLowerCase()),
        r.line,
        `Scenario rows are bear, base and bull; got "${r.cells[0]}".`,
      );
  }

  let sensitivity = null;
  if (fields.sensitivity?.value) {
    const sides = fields.sensitivity.value.split(/\s+x\s+/);
    const local = (message) => need(false, fields.sensitivity.line, message);
    if (sides.length !== 2)
      local(
        '"sensitivity" is "input v1, v2, v3 x input v1, v2, v3", like "margin_target 20%, 25%, 30% x wacc 10%, 11%, 12%".',
      );
    else {
      const row = parseAxis(sides[0], local);
      const col = parseAxis(sides[1], local);
      if (row && col) {
        if (row.key === col.key) local('"sensitivity" varies two different inputs.');
        else sensitivity = { row, col };
      }
    }
  }

  if (!ok) return null;
  /** @type {ValuationInputs} */
  const inputs = {
    price,
    shares: shares.value,
    netCash: netCash.value,
    revenue: revenue.value,
    marginNow: marginNow.value,
    nol: nol?.value ?? 0,
    tax,
    terminalGrowth,
    terminalWacc,
    terminalRoc,
    rocFollowsWacc: !fields.terminal_roc,
    marginYear,
    odds,
    scenarios,
    sensitivity,
  };
  const result = computeValuation(inputs);
  /** Judgments the author owns, compared note to note (a change needs a `moves` row). */
  const judgments = {
    terminal_growth: terminalGrowth,
    terminal_wacc: terminalWacc,
    terminal_roc: fields.terminal_roc ? terminalRoc : null,
    margin_year: marginYear,
    odds: odds ? odds.join('/') : null,
    uncertainty,
  };
  for (const s of scenarios)
    for (const key of Object.keys(COLUMNS)) judgments[`${s.name}.${key}`] = s.inputs[key];
  return {
    type: 'valuation',
    method: fields.method.value,
    why: fields.why?.value ? inline(fields.why.value, fields.why.line) : null,
    price,
    shares,
    netCash,
    revenue,
    marginNow,
    nol,
    tax,
    terminalGrowth,
    terminalWacc,
    terminalRoc,
    marginYear,
    uncertainty,
    uncertaintyWhy: fields.uncertainty_why?.value
      ? inline(fields.uncertainty_why.value, fields.uncertainty_why.line)
      : null,
    scenarios: scenarios.map((s) => ({ name: s.name, inputs: s.inputs, story: s.story })),
    sensitivity: sensitivity && {
      row: { key: sensitivity.row.key, labels: sensitivity.row.labels },
      col: { key: sensitivity.col.key, labels: sensitivity.col.labels },
    },
    odds,
    traded,
    thirdParty,
    result,
    judgments,
  };
}

/** Cells of a `|` row; `\|` is a literal pipe. */
export function splitCells(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [];
  let cell = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && row[i + 1] === '|') {
      cell += '\\|';
      i++;
    } else if (row[i] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else cell += row[i];
  }
  cells.push(cell.trim());
  return cells;
}
