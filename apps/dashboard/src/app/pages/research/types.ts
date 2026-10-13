/**
 * The shapes `tools/research-notes/` emits for research/<TICKER>/*.md at build time (notes.mjs,
 * blocks.mjs, valuation.mjs, freshness.mjs). The parser is the source of truth; keep these in step
 * with its JSDoc typedefs. Every computed figure (`ValuationBlock.result`) arrives computed: the
 * dashboard renders numbers, it never derives a valuation.
 */
export type NoteInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: NoteInline[] }
  | { type: 'em'; children: NoteInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: NoteInline[] };

export type NoteList = {
  type: 'list';
  ordered: boolean;
  items: { children: NoteInline[]; list?: NoteList }[];
};

export type When = {
  text: string;
  kind: 'day' | 'month' | 'quarter' | 'year' | 'window' | 'by' | 'ongoing';
  start: string | null;
  end: string | null;
  approx: boolean;
  label: string;
};

export type Direction = 'up' | 'down' | 'flat';

export type ScenarioName = 'bear' | 'base' | 'bull';

export type ScenarioInputs = {
  rev_y1: number | null;
  reinvest_y1: number | null;
  growth: number;
  margin_y1: number | null;
  margin_target: number;
  sales_to_capital: number;
  wacc: number;
  p_fail: number;
  distress: number;
};

export type Dated = { value: number; asOf: string };

export type ValuationBlock = {
  type: 'valuation';
  method: string;
  why: NoteInline[] | null;
  price: Dated;
  shares: Dated;
  netCash: Dated;
  revenue: Dated;
  marginNow: Dated;
  nol: Dated | null;
  tax: number;
  terminalTax: number;
  terminalGrowth: number;
  terminalWacc: number;
  terminalRoc: number;
  marginYear: number;
  uncertainty: Uncertainty | null;
  uncertaintyWhy: NoteInline[] | null;
  scenarios: { name: ScenarioName; inputs: ScenarioInputs; story: NoteInline[] }[];
  sensitivity: {
    row: { key: string; labels: string[] };
    col: { key: string; labels: string[] };
  } | null;
  odds: [number, number, number] | null;
  traded: { lo: number; hi: number; when: When } | null;
  thirdParty: { value: number; asOf: string; label: string } | null;
  result: {
    scenarios: Record<
      ScenarioName,
      { value: number; goingConcern: number; vsPrice: number; ev: number }
    >;
    weighted: { value: number; vsPrice: number } | null;
    sensitivity: {
      row: { key: string; labels: string[] };
      col: { key: string; labels: string[] };
      cells: { value: number; vsPrice: number }[][];
    } | null;
    range: { lo: number; hi: number };
    implied: {
      growth: number | null;
      bound: 'above' | 'below' | null;
      /** Faster growth adds value at base inputs (new capital earns more than it costs). */
      growthAddsValue: boolean;
      growthYears: string;
      marketCap: number;
      ev: number;
      evToRevenue: number;
      steadyStateShare: number;
    };
  };
};

export type Uncertainty = 'low' | 'medium' | 'high' | 'very-high' | 'extreme';

export type ChartBlock = {
  type: 'chart';
  caption: string;
  bars: { label: string; value: number; kind: '' | 'approx' | 'guide'; shown: string }[];
  /** Index of the last plain bar: the latest reported figure. */
  latest: number;
};

export type NoteBlock =
  | { type: 'heading'; level: 3; children: NoteInline[] }
  | { type: 'paragraph'; children: NoteInline[] }
  | NoteList
  | { type: 'quote'; children: NoteBlock[] }
  | { type: 'codeblock'; text: string }
  | { type: 'table'; header: NoteInline[][]; rows: NoteInline[][][] }
  | { type: 'rule' }
  | { type: 'strip'; items: { label: string; value: string; asOf: string; sub: NoteInline[] }[] }
  | { type: 'tldr'; items: { figure: string; text: NoteInline[] }[] }
  | {
      type: 'metrics';
      items: {
        label: string;
        value: string;
        asOf: string;
        delta: string;
        dir: Direction;
        note: NoteInline[];
      }[];
    }
  | ChartBlock
  | {
      type: 'split';
      caption: string | null;
      items: { label: string; value: number; detail: string; share: number }[];
    }
  | {
      type: 'compare';
      caption: string | null;
      items: { label: string; value: number; shown: string; emph: boolean }[];
    }
  | { type: 'bridge'; caption: string | null; steps: { label: string; value: number }[] }
  | { type: 'units'; caption: string | null; total: number; unit: number; count: number }
  | { type: 'implied' }
  | {
      type: 'variant';
      items: { driver: string; implied: NoteInline[]; view: NoteInline[]; settles: NoteInline[] }[];
    }
  | {
      type: 'scorecard';
      items: {
        pillar: string;
        metric: string;
        latest: string;
        status: 'ok' | 'watch' | 'broken';
        kill: NoteInline[];
      }[];
    }
  | {
      type: 'moat';
      items: { source: string; status: 'evidence' | 'unproven' | 'none'; why: NoteInline[] }[];
    }
  | {
      type: 'case';
      items: { side: 'for' | 'against'; head: NoteInline[]; body: NoteInline[] }[];
    }
  | { type: 'premortem'; items: { story: NoteInline[]; kill: string | null }[] }
  | ValuationBlock
  | {
      type: 'catalysts';
      items: {
        when: When;
        event: string;
        detail: NoteInline[];
        status: 'confirmed' | 'expected' | 'target';
        outcome: NoteInline[] | null;
      }[];
    }
  | {
      type: 'kill';
      items: {
        n: string;
        trigger: string;
        threshold: NoteInline[];
        source: string;
        checkBy: When;
        then: NoteInline[];
        outcome: NoteInline[] | null;
      }[];
    }
  | {
      type: 'forecasts';
      items: {
        claim: NoteInline[];
        p: number | null;
        resolveBy: When;
        source: string;
        outcome: 'yes' | 'no' | 'void' | null;
        brier: number | null;
      }[];
    }
  | {
      type: 'changelog';
      items: {
        date: string;
        kind: 'initiation' | 'update' | 'outcome' | 'revision' | 'roll-forward' | 'correction';
        text: NoteInline[];
      }[];
    }
  | { type: 'sources'; items: { n: number; title: string; url: string; host: string }[] }
  | {
      type: 'since';
      items: {
        kind: 'catalyst' | 'forecast' | 'kill' | 'pillar';
        call: NoteInline[];
        outcome: NoteInline[];
      }[];
    }
  | {
      type: 'moves';
      items: { input: string; change: string; trigger: string; why: NoteInline[] }[];
    };

export type NoteSection = {
  n: number;
  id: string;
  label: string;
  title: NoteInline[];
  carried: { from: string; reconfirmed: string } | null;
  blocks: NoteBlock[];
};

export type NotePart = { title: string | null; intro: NoteBlock[]; sections: NoteSection[] };

export type NoteStance = 'bullish' | 'bearish' | 'neutral' | 'watching';

export type AgingEvent = {
  kind: 'catalyst' | 'kill' | 'forecast';
  label: string;
  when: When;
  resolved: boolean;
  status?: string;
};

export type Aging = { priceAsOf: string | null; events: AgingEvent[] };

export type ResearchNote = {
  ticker: string;
  date: string;
  title: string;
  slug: string;
  path: string;
  company: string | null;
  about: string | null;
  stance: NoteStance | null;
  target: number | null;
  targetDate: string | null;
  position: string | null;
  horizon: string | null;
  updated: string | null;
  notFollowingSince: string | null;
  tags: string[];
  summary: string;
  lead: NoteBlock[];
  parts: NotePart[];
  sources: { n: number | null; href: string; label: string; host: string }[];
  readMinutes: number;
  aging: Aging;
};

export type ResearchTickerSummary = {
  ticker: string;
  count: number;
  latest: {
    slug: string;
    date: string;
    updated: string | null;
    title: string;
    company: string | null;
    about: string | null;
    stance: NoteStance | null;
    summary: string;
    notFollowingSince: string | null;
    readMinutes: number;
    sourceCount: number;
    uncertainty: Uncertainty | null;
    chart: Omit<ChartBlock, 'type'> | null;
    metrics: { label: string; value: string; asOf: string; delta: string; dir: Direction }[];
    valuation: {
      price: Dated;
      values: Record<ScenarioName, number>;
      weighted: number | null;
      baseVsPrice: number;
    } | null;
    aging: Aging;
  };
};

/** `tools/research-notes/freshness.mjs`, re-exported through the virtual module. */
export type AgingMark = {
  kind: 'catalyst' | 'kill' | 'forecast' | 'price';
  label: string;
  whenLabel: string;
  date: string;
};

export type Freshness = {
  state: 'current' | 'due' | 'superseded' | 'archived';
  since: string | null;
  passed: AgingMark[];
  next: AgingMark | null;
  priceAgeDays: number | null;
  priceStale: boolean;
};

export type Upcoming = { label: string; whenLabel: string; date: string; inDays: number };
