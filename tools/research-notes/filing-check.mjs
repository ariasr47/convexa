// Figures against the filing (design: Planned · Figures against the filing). A note figure that names
// its XBRL concept (the last cell of a `metrics` or `strip` row, research/README.md) is compared with
// the value the company tagged in its filing for the same period. One implementation for the reader's
// browser (re-exported by vite-plugin.mjs, fed by the API's `periodic[].tagged`) and for the author's
// research check (check-filings.mjs, fed by saved company-facts files): a check, never an editor. The
// note's own figure is never rewritten.
//
// The rules:
// - **Period.** `Q2 FY2027` / `Q2 FY27` / `Q2 2026` is the filer's fiscal quarter, `FY2026` its fiscal
//   year, `2026-07-26` the filing whose period ends that day. Fiscal labels match the `fy`/`fp` the
//   filer tagged, never a calendar guess.
// - **Precision.** A figure matches when the filed value is within half a unit of the note's last
//   digit: $96.2B matches $96,221M, 66.2% doesn't match 66.37%.
// - **Units and scale.** `$` needs a currency (or per-share) unit, `%` a ratio of two concepts in the
//   same unit (or a pure value), a bare number with K/M/B/T a share count. Scale words multiply.
// - **Derived.** `A / B` is a ratio (a margin); `A - B` and `A + B` are computed figures (free cash flow)
//   and read "Computed" when they agree. `none` means no standard concept: "Not tagged · cites the
//   filing". Text after `;` explains a known difference, and the research check then accepts it.

/** The concepts a figure may cite: the API reads these and only these (apps/api filed_figures.rs keeps
 *  the same list, and a test there holds the two equal). */
export const CHECKED_CONCEPTS = [
  'us-gaap:Revenues',
  'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
  'us-gaap:CostOfRevenue',
  'us-gaap:GrossProfit',
  'us-gaap:ResearchAndDevelopmentExpense',
  'us-gaap:SellingGeneralAndAdministrativeExpense',
  'us-gaap:OperatingExpenses',
  'us-gaap:OperatingIncomeLoss',
  'us-gaap:NetIncomeLoss',
  'us-gaap:EarningsPerShareBasic',
  'us-gaap:EarningsPerShareDiluted',
  'us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding',
  'us-gaap:NetCashProvidedByUsedInOperatingActivities',
  'us-gaap:PaymentsToAcquirePropertyPlantAndEquipment',
  'us-gaap:PaymentsForRepurchaseOfCommonStock',
  'us-gaap:ShareBasedCompensation',
  'us-gaap:CashAndCashEquivalentsAtCarryingValue',
  'us-gaap:MarketableSecuritiesCurrent',
  'us-gaap:AccountsReceivableNetCurrent',
  'us-gaap:InventoryNet',
  'us-gaap:Assets',
  'us-gaap:Liabilities',
  'us-gaap:StockholdersEquity',
  'us-gaap:LongTermDebt',
  'us-gaap:LongTermDebtNoncurrent',
  'us-gaap:AccountsPayableCurrent',
  'ifrs-full:Revenue',
  'ifrs-full:GrossProfit',
  'ifrs-full:ProfitLossFromOperatingActivities',
  'ifrs-full:ProfitLoss',
  'ifrs-full:DilutedEarningsLossPerShare',
  'ifrs-full:CashAndCashEquivalents',
  'dei:EntityCommonStockSharesOutstanding',
];

const CONCEPT_RE = /^(us-gaap|ifrs-full|dei):[A-Za-z][A-Za-z0-9]*$/;
const OPS = { '/': '/', '÷': '/', '-': '-', '−': '-', '+': '+' };

/**
 * `us-gaap:GrossProfit / us-gaap:Revenues; as reported in the 8-K` → the expression and the
 * explanation. `none` is a figure with no standard concept.
 * @param {string} raw
 * @returns {{ concept: string, terms: string[], op: '/' | '-' | '+' | null, why: string | null } | { error: string }}
 */
export function parseConceptCell(raw) {
  const at = raw.indexOf(';');
  const expr = (at === -1 ? raw : raw.slice(0, at)).trim();
  const why = at === -1 ? null : raw.slice(at + 1).trim() || null;
  if (/^none$/i.test(expr)) return { concept: 'none', terms: [], op: null, why };
  const m = /^(\S+)\s*(?:([/÷+\-−])\s*(\S+))?$/.exec(expr);
  if (!m)
    return {
      error: `A figure's concept is one XBRL concept, two joined by / - or +, or "none"; got ${JSON.stringify(expr)}.`,
    };
  const terms = [m[1], m[3]].filter(Boolean);
  for (const t of terms) {
    if (!CONCEPT_RE.test(t))
      return {
        error: `${JSON.stringify(t)} isn't an XBRL concept: write it with its taxonomy, like us-gaap:Revenues.`,
      };
    if (!CHECKED_CONCEPTS.includes(t))
      return {
        error: `${t} isn't one the site checks; use one of tools/research-notes/filing-check.mjs CHECKED_CONCEPTS or "none".`,
      };
  }
  const op = m[2] ? OPS[m[2]] : null;
  return { concept: op ? `${terms[0]} ${op} ${terms[1]}` : terms[0], terms, op, why };
}

const SCALE = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/**
 * A note figure as a number with its precision: "$96.2B" → 96.2e9 ± 0.05e9; "66.2%" → 0.662 ±
 * 0.0005; "$2.46" → 2.46 ± 0.005; "24,285M" → 24.285e9 ± 0.5e6. Null when it isn't one of those
 * (a multiple like 14.2×, a range, words).
 * @param {string} raw
 */
export function parseFigure(raw) {
  let t = String(raw).trim().replace(/[−–]/g, '-');
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1).trim();
  }
  if (t.startsWith('-')) {
    negative = !negative;
    t = t.slice(1).trim();
  }
  const m = /^(\$)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*([KMBT])?\s*(%)?$/.exec(t);
  if (!m) return null;
  const [, dollar, whole, frac = '', scaleWord = '', pct] = m;
  if (dollar && pct) return null;
  const decimals = frac.length;
  const number = Number(`${whole.replace(/,/g, '')}${frac ? `.${frac}` : ''}`);
  const kind = dollar ? 'money' : pct ? 'percent' : 'count';
  if (kind === 'percent' && scaleWord) return null;
  const scale = kind === 'percent' ? 0.01 : SCALE[scaleWord];
  const step = 10 ** -decimals * scale;
  return {
    value: (negative ? -number : number) * scale,
    half: step / 2,
    step,
    decimals,
    scaleWord,
    kind,
  };
}

/**
 * The period a figure's as-of names: a fiscal quarter or year (as the filer tags `fy`/`fp`), or the
 * filing whose period ends on a date. Null for anything else (a price date is not a filed period
 * only when no filing ends that day, which the check reports).
 * @param {string} asOf
 * @returns {{ fy: number, fp: string, label: string } | { date: string, label: string } | null}
 */
export function parsePeriod(asOf) {
  const t = String(asOf).trim();
  const year = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));
  let m = /^Q([1-4])\s*(?:FY\s*)?(\d{4}|\d{2})$/i.exec(t);
  if (m && (/FY/i.test(t) || m[2].length === 4))
    return { fy: year(m[2]), fp: `Q${m[1]}`, label: `Q${m[1]} FY${year(m[2])}` };
  m = /^FY\s*(\d{4}|\d{2})$/i.exec(t);
  if (m) return { fy: year(m[1]), fp: 'FY', label: `FY${year(m[1])}` };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { date: t, label: t };
  return null;
}

const UNIT_KIND = (unit) =>
  unit === 'shares'
    ? 'count'
    : unit === 'pure'
      ? 'pure'
      : /\/shares$/i.test(unit)
        ? 'per-share'
        : /^[A-Z]{3}$/.test(unit)
          ? 'money'
          : 'other';

/** Which of a concept's units can stand for a note figure of this kind. */
function fits(kind, unit) {
  const u = UNIT_KIND(unit);
  if (kind === 'money') return u === 'money' || u === 'per-share';
  if (kind === 'count') return u === 'count';
  if (kind === 'percent') return u === 'pure';
  return false;
}

/** Filing value → text in the note's style, a digit finer than the note so a difference shows. */
export function formatFiled(value, note) {
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  const grouped = (n, d) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (note.kind === 'percent') return `${sign}${grouped(v * 100, note.decimals + 1)}%`;
  const prefix = note.kind === 'money' ? '$' : '';
  if (v >= 1e6) return `${sign}${prefix}${grouped(v / 1e6, 0)}M`;
  return `${sign}${prefix}${grouped(v, Math.max(2, note.decimals))}`;
}

/** The gap in the note's own unit and precision: "0.2 pts", "$0.01", "$0.1B", "12M". */
export function formatGap(gap, note) {
  const g = Math.abs(gap);
  if (note.kind === 'percent') return `${(g * 100).toFixed(Math.max(1, note.decimals))} pts`;
  const prefix = note.kind === 'money' ? '$' : '';
  const scale = SCALE[note.scaleWord] ?? 1;
  const d = Math.max(note.decimals, 0);
  let shown = (g / scale).toFixed(d);
  if (Number(shown) === 0) shown = (g / scale).toFixed(d + 1);
  return `${prefix}${Number(shown).toLocaleString('en-US', { maximumFractionDigits: d + 1 })}${note.scaleWord}`;
}

/**
 * The filed value of one figure's concept expression in one filing, in the unit the note's kind
 * needs. Null value with a reason when the filing doesn't tag it or the units don't fit.
 * @param {{ terms: string[], op: string | null }} expr
 * @param {{ tagged: { concept: string, unit: string, value: number }[] }} filing
 * @param {'money' | 'percent' | 'count'} kind
 */
function evaluate(expr, filing, kind) {
  const ofConcept = (c) => filing.tagged.filter((t) => t.concept === c);
  const missing = expr.terms.filter((c) => ofConcept(c).length === 0);
  if (missing.length) return { value: null, reason: 'not-tagged-in-filing', missing };
  if (!expr.op) {
    const hit = ofConcept(expr.terms[0]).find((t) => fits(kind, t.unit));
    if (!hit)
      return { value: null, reason: 'unit', units: ofConcept(expr.terms[0]).map((t) => t.unit) };
    return { value: hit.value, unit: hit.unit };
  }
  const [a, b] = expr.terms.map(ofConcept);
  for (const x of a)
    for (const y of b) {
      if (x.unit !== y.unit) continue;
      if (expr.op === '/') {
        if (kind !== 'percent' || y.value === 0) continue;
        return { value: x.value / y.value, unit: 'pure' };
      }
      if (!fits(kind, x.unit)) continue;
      return { value: expr.op === '-' ? x.value - y.value : x.value + y.value, unit: x.unit };
    }
  return { value: null, reason: 'unit', units: [...a, ...b].map((t) => t.unit) };
}

/**
 * @typedef {{ label: string, value: string, asOf: string, concept: string, why?: string | null }} NoteFigure
 * @typedef {{ accession: string, form: string, filed: string, period_end: string | null,
 *   fiscal_year: number | null, fiscal_period: string | null,
 *   tagged: { concept: string, unit: string, value: number, start: string | null, end: string }[] }} FiledFiling
 * @typedef {'matches' | 'computed' | 'differs' | 'not_tagged' | 'pending' | 'not_found' | 'missing' | 'unit' | 'invalid'} CheckStatus
 * @typedef {{ label: string, note: string, asOf: string, concept: string, why: string | null,
 *   status: CheckStatus, filed: number | null, filedText: string | null, gap: string | null,
 *   accession: string | null, form: string | null, detail: string }} CheckRow
 */

/**
 * Check each figure against the filings read (newest first). Statuses:
 * matches · computed · differs (with the gap) · not_tagged (`none`) · pending (the period's filing is
 * on EDGAR, its facts aren't in yet) · not_found (no filing read covers the period) · missing (the
 * filing doesn't tag the concept) · unit (the units don't fit the figure) · invalid (the figure or its
 * period can't be read as a filed value).
 * @param {NoteFigure[]} figures
 * @param {FiledFiling[]} filings
 * @returns {CheckRow[]}
 */
export function checkFigures(figures, filings) {
  return figures.map((f) => {
    const base = {
      label: f.label,
      note: f.value,
      asOf: f.asOf,
      concept: f.concept,
      why: f.why ?? null,
      filed: null,
      filedText: null,
      gap: null,
      accession: null,
      form: null,
    };
    const parsed = parseConceptCell(f.why ? `${f.concept}; ${f.why}` : f.concept);
    if ('error' in parsed) return { ...base, status: 'invalid', detail: parsed.error };
    if (parsed.concept === 'none')
      return {
        ...base,
        status: 'not_tagged',
        detail: 'No standard concept: the note cites the filing.',
      };
    const note = parseFigure(f.value);
    if (!note)
      return {
        ...base,
        status: 'invalid',
        detail: `${JSON.stringify(f.value)} isn't a filed amount ($, %, or a share count with K/M/B/T).`,
      };
    const period = parsePeriod(f.asOf);
    if (!period)
      return {
        ...base,
        status: 'invalid',
        detail: `"@ ${f.asOf}" isn't a filed period: write Q2 FY2027, FY2026 or the period-end date.`,
      };
    const withFacts = filings.filter((x) => x.tagged.length > 0);
    const filing =
      'date' in period
        ? withFacts.find((x) => x.period_end === period.date)
        : withFacts.find((x) => x.fiscal_year === period.fy && x.fiscal_period === period.fp);
    if (!filing) {
      const newest = filings[0];
      const pending =
        newest &&
        newest.tagged.length === 0 &&
        ('date' in period
          ? !withFacts.some((x) => x.period_end != null && x.period_end >= period.date)
          : !withFacts.some(
              (x) =>
                x.fiscal_year != null &&
                (x.fiscal_year > period.fy ||
                  (x.fiscal_year === period.fy && fpRank(x.fiscal_period) >= fpRank(period.fp))),
            ));
      return pending
        ? {
            ...base,
            status: 'pending',
            accession: newest.accession,
            form: newest.form,
            detail: `The ${newest.form} filed ${newest.filed} is on EDGAR; its tagged figures haven't reached the SEC's API yet.`,
          }
        : {
            ...base,
            status: 'not_found',
            detail: `No filing read covers ${period.label}.`,
          };
    }
    const where = { accession: filing.accession, form: filing.form };
    const got = evaluate(parsed, filing, note.kind);
    if (got.value === null) {
      return got.reason === 'unit'
        ? {
            ...base,
            ...where,
            status: 'unit',
            detail: `The note's ${note.kind === 'percent' ? 'percentage' : note.kind === 'money' ? 'dollar figure' : 'count'} doesn't fit the filing's unit (${[...new Set(got.units)].join(', ')}).`,
          }
        : {
            ...base,
            ...where,
            status: 'missing',
            detail: `The ${filing.form} doesn't tag ${got.missing.join(' or ')} for this period.`,
          };
    }
    const diff = got.value - note.value;
    // Half a unit of the note's last digit, plus float slack.
    const ok = Math.abs(diff) <= note.half + Math.abs(note.value) * 1e-12 + 1e-12;
    const filedText = formatFiled(got.value, note);
    if (ok)
      return {
        ...base,
        ...where,
        filed: got.value,
        filedText,
        status: parsed.op === '-' || parsed.op === '+' ? 'computed' : 'matches',
        detail:
          parsed.op === '-' || parsed.op === '+'
            ? 'Computed from tagged inputs; agrees at the note’s precision.'
            : 'Equal at the note’s precision.',
      };
    return {
      ...base,
      ...where,
      filed: got.value,
      filedText,
      status: 'differs',
      gap: formatGap(diff, note),
      detail: `The note says ${f.value}; the ${filing.form} tags ${filedText}.`,
    };
  });
}

const fpRank = (fp) => (fp === 'FY' ? 4 : Number(String(fp ?? '').slice(1)) || 0);

/** Statuses the research check fails on unless the figure explains itself after `;`. */
export const UNEXPLAINED = ['differs', 'missing', 'unit', 'invalid'];

// ---- saved company facts → filings ------------------------------------------------------------

const PERIODIC = ['10-Q', '10-K', '20-F', '40-F'];
const days = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
const spanOf = (p) => {
  if (!p.start) return 'instant';
  const d = days(p.start, p.end);
  return d >= 80 && d <= 100 ? 'quarter' : d >= 350 && d <= 380 ? 'annual' : null;
};

/**
 * A saved SEC company-facts answer as the filings the API would send (`periodic[]`, newest first):
 * each periodic filing's fiscal year and period and its checked concepts for its own period. The same
 * rules as apps/api filed_figures.rs `attach`, for the research check, which reads saved files only.
 * @param {any} json
 * @param {{ keep?: number }} [options]
 * @returns {FiledFiling[]}
 */
export function filingsFromCompanyFacts(json, { keep = 4 } = {}) {
  /** @type {any[]} */
  const points = [];
  for (const [taxonomy, concepts] of Object.entries(json?.facts ?? {}))
    for (const [name, concept] of Object.entries(/** @type {any} */ (concepts) ?? {})) {
      const key = `${taxonomy}:${name}`;
      if (!CHECKED_CONCEPTS.includes(key)) continue;
      for (const [unit, list] of Object.entries(concept?.units ?? {}))
        for (const p of /** @type {any[]} */ (list))
          if (Number.isFinite(p.val) && p.end && p.accn)
            points.push({
              concept: key,
              unit,
              start: p.start ?? null,
              end: p.end,
              value: p.val,
              ...p,
            });
    }
  const base = (form) => String(form ?? '').replace(/\/A$/, '');
  /** @type {Map<string, { accession: string, form: string, filed: string }>} */
  const byAccession = new Map();
  for (const p of points) {
    if (!PERIODIC.includes(base(p.form))) continue;
    const seen = byAccession.get(p.accn);
    if (!seen || (p.filed ?? '') > seen.filed)
      byAccession.set(p.accn, { accession: p.accn, form: base(p.form), filed: p.filed ?? '' });
  }
  const order = [...byAccession.values()]
    .sort((a, b) => b.filed.localeCompare(a.filed) || b.accession.localeCompare(a.accession))
    .slice(0, keep);
  const mode = (xs) => {
    const counts = new Map();
    for (const x of xs) if (x != null) counts.set(x, (counts.get(x) ?? 0) + 1);
    let best = null;
    let n = 0;
    for (const [x, c] of counts) if (c > n) [best, n] = [x, c];
    return best;
  };
  return order.map((f) => {
    const mine = points.filter((p) => p.accn === f.accession);
    const want = f.form === '10-Q' ? 'quarter' : 'annual';
    const end = mine
      .filter((p) => spanOf(p) === want)
      .map((p) => p.end)
      .sort()
      .at(-1);
    /** @type {FiledFiling['tagged']} */
    const tagged = [];
    for (const p of mine) {
      const s = spanOf(p);
      const own =
        s === 'instant'
          ? p.concept.startsWith('dei:') || p.end === end
          : s === want && p.end === end;
      if (!own) continue;
      const prior = tagged.find((t) => t.concept === p.concept && t.unit === p.unit);
      if (prior) {
        if (p.end > prior.end) Object.assign(prior, { value: p.value, end: p.end });
        continue;
      }
      tagged.push({
        concept: p.concept,
        unit: p.unit,
        value: p.value,
        start: p.start ?? null,
        end: p.end,
      });
    }
    tagged.sort((a, b) => a.concept.localeCompare(b.concept) || a.unit.localeCompare(b.unit));
    return {
      accession: f.accession,
      form: f.form,
      filed: f.filed,
      period_end: end ?? null,
      fiscal_year: mode(mine.map((p) => p.fy)),
      fiscal_period: mode(mine.map((p) => p.fp)),
      tagged,
    };
  });
}
