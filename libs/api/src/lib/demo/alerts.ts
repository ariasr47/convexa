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
      note: 'Watch the authored sample flip',
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
      detail: '+2.70M contracts net, sample report, positions as of Tue Oct 6',
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
