/**
 * The demo account's alerts (`convexa.alerts.v1`), seeded once into the demo workspace
 * (workspace.ts). The shipped SPY gamma-flip touch, plus one sample rule per public-data kind (Q-5) on
 * the demo's own names, and one firing that is part of the Oct 7 scenario.
 *
 * The demo never checks alerts on its own: the firing below is authored, and it agrees with the demo's
 * own sample data (public-data.ts): the 10-year T-note's asset managers sit at the top of their sample
 * three-year range (+2.70M, the window's high), as of the sample report dated Tue Oct 6. The design
 * board drew leveraged funds near a low, which the sample doesn't show; ruling (3) of 2026-10-14 has
 * the board follow the seed.
 */

const ANCHOR = Date.parse('2026-10-07T18:30:00Z');

export const DEMO_ALERTS_SEED = {
  schema_version: 1,
  rules: [
    {
      id: 'demo-alert-spy-flip',
      kind: 'level_touch',
      symbol: 'SPY',
      enabled: true,
      createdAt: ANCHOR,
      level: 'gamma_flip',
      note: 'Watch the flip',
    },
    {
      id: 'demo-alert-nvda-results',
      kind: 'results',
      symbol: 'NVDA',
      enabled: true,
      createdAt: ANCHOR,
      days: 7,
      notify: false,
    },
    {
      id: 'demo-alert-nvda-filing',
      kind: 'filing',
      symbol: 'NVDA',
      enabled: true,
      createdAt: ANCHOR,
      forms: ['8-K', '10-Q', '10-K'],
      items: ['2.02', '5.02'],
      notify: false,
    },
    {
      id: 'demo-alert-tsla-cluster',
      kind: 'cluster',
      symbol: 'TSLA',
      enabled: true,
      createdAt: ANCHOR,
      notify: false,
    },
    {
      id: 'demo-alert-tnote-positioning',
      kind: 'cftc',
      symbol: '043602',
      marketName: '10-year T-note',
      enabled: true,
      createdAt: ANCHOR,
      group: 'asset_managers',
      extreme: 'high',
      closeness: 'within5',
      notify: false,
      fired: ['cftc:043602:asset_managers:2026-10-06'],
      inZone: true,
    },
    {
      id: 'demo-alert-aapl-short',
      kind: 'si',
      symbol: 'AAPL',
      enabled: true,
      createdAt: ANCHOR,
      siMode: 'change',
      changePct: 15,
      notify: false,
    },
    {
      id: 'demo-alert-msft-note',
      kind: 'note',
      symbol: 'MSFT',
      enabled: false,
      createdAt: ANCHOR,
      days: 7,
      notify: false,
    },
  ],
  events: [
    {
      id: 'demo-alert-event-tnote',
      ruleId: 'demo-alert-tnote-positioning',
      kind: 'cftc',
      symbol: '10-year T-note',
      message: '10-year T-note: asset managers within 5% of a 3-year high',
      detail: '+2.70M contracts net, positions as of Tue Oct 6',
      at: ANCHOR,
      date: '2026-10-07',
      read: true,
      sample: true,
      source: 'Sample · shaped like CFTC TFF',
      link: { label: 'Open Markets', href: '/research/markets' },
    },
  ],
  notifyBrowser: false,
};

/**
 * Seed versions (W1-53, conductor's provisional decision 2026-10-15): a staging browser that set up
 * the demo workspace before a version keeps its own alerts, and gets that version's NEW sample rules
 * (and their scenario firings) merged in by id, once. Version 1 was the SPY flip alone; version 2
 * added one sample rule per public kind and the T-note firing.
 */
export const DEMO_ALERTS_SEED_VERSION = 2;
export const DEMO_ALERTS_SEED_VERSION_KEY = 'convexa.demo.alerts.seed.v';
const ADDED_IN: Record<number, { rules: string[]; events: string[] }> = {
  2: {
    rules: [
      'demo-alert-nvda-results',
      'demo-alert-nvda-filing',
      'demo-alert-tsla-cluster',
      'demo-alert-tnote-positioning',
      'demo-alert-aapl-short',
      'demo-alert-msft-note',
    ],
    events: ['demo-alert-event-tnote'],
  },
};

type Row = { id?: unknown; ruleId?: unknown };

/**
 * The stored alerts blob with every seed version after `from` merged in, or null when there is
 * nothing to write (already current, or a blob this can't read: the alerts store's own read-fault
 * latch owns that case, and nothing here may overwrite it).
 *
 * A version's rules are added only when none of them is already there: a browser seeded with that
 * version (before versions were recorded) has them, and one it deleted stays deleted. The visitor's
 * own rules, edits, firings and notification setting are never touched.
 */
export function mergeDemoAlertsSeed(raw: string | null, from: number): string | null {
  if (from >= DEMO_ALERTS_SEED_VERSION) return null;
  if (raw === null) return JSON.stringify(DEMO_ALERTS_SEED);
  let blob: { rules?: unknown; events?: unknown } & Record<string, unknown>;
  try {
    blob = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!blob || typeof blob !== 'object' || !Array.isArray(blob.rules)) return null;
  const rules = [...(blob.rules as Row[])];
  const events = Array.isArray(blob.events) ? [...(blob.events as Row[])] : [];
  let changed = false;
  for (let v = from + 1; v <= DEMO_ALERTS_SEED_VERSION; v++) {
    const added = ADDED_IN[v];
    if (!added) continue;
    const have = new Set(rules.map((r) => r?.id));
    if (added.rules.some((id) => have.has(id))) continue;
    for (const id of added.rules) {
      const rule = DEMO_ALERTS_SEED.rules.find((r) => r.id === id);
      if (rule) rules.push(JSON.parse(JSON.stringify(rule)));
    }
    const seen = new Set(events.map((e) => e?.id));
    for (const id of added.events) {
      const ev = DEMO_ALERTS_SEED.events.find((e) => e.id === id);
      if (ev && !seen.has(id)) events.push(JSON.parse(JSON.stringify(ev)));
    }
    changed = true;
  }
  return changed ? JSON.stringify({ ...blob, rules, events }) : null;
}
