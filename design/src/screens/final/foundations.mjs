// Final · Convexa v1 — Foundations: the rules every screen row below follows. Reuses the v4 state matrix
// and the v5 chart-system boards (now ruled: P-8 to P-13 approved 2026-10-14) instead of redrawing them.
import { SHEET_CSS, stateMatrixBody } from '../v4/data-sheets.mjs';
import { chartStatesBody, chartSystemBody, thirdPartyBody } from '../v5/system.mjs';

export const ROWS = [
  {
    key: 'foundations',
    label: 'Foundations',
    css: SHEET_CSS,
    specH: 2200,
    spec: {
      title: 'Foundations',
      route: 'every route',
      job: 'The contract every screen below keeps: which environment shows what, the closed set of state words, and how a chart is drawn.',
      env: {
        production: 'The portfolio site. Nothing is mocked. Every widget that needs the Massive options feed shows its Not live state and links to the same screen on the demo. Everything that works without Massive is live: Treasury, CFTC, SEC EDGAR, TradingView’s chart, research notes, and what Convexa computes from them. FINRA’s short data is Off, with the reason, until FINRA’s terms for showing its data here are confirmed (owner, 2026-10-15). Visitors are signed out; sign-ups are closed.',
        staging: 'A completely mocked app on the Oct 7, 2026 scenario, always signed in to the seed demo account. No API or third-party calls. No sign-in screens anywhere; “Reset demo data” in place of sign-out. Every source chip is dashed and says “shaped like”.',
      },
      widgets: [
        { name: 'Notice bar', source: 'build mode + /api/health market_data', production: ['notLive', 'Options data isn’t live'], staging: ['demo', 'Demo · sample data'] },
        { name: 'Account control', source: 'who-am-I (/api/auth/session; demo transport on staging)', production: ['locked', 'Log in'], staging: 'Demo account' },
        { name: 'Public data (rates, CFTC, FINRA, SEC)', source: '/api/public-data/* · each source’s own delay', production: [['current', 'Updated'], ['delayed', 'Delayed by source'], ['off', 'Off (FINRA)']], staging: 'demo' },
        { name: 'Dealer structure, flow, scores, AI reads', source: 'Massive options feed (not subscribed)', production: 'notLive', staging: 'sample' },
        { name: 'Daily price chart', source: 'TradingView widget (live build); sample bars (demo)', production: 'thirdParty', staging: ['computed', 'Computed · sample bars'] },
      ],
      states: [
        { tag: 'current', when: 'Public data current to its source: the word and the date, never a live dot.' },
        { tag: 'delayed', when: 'The source publishes late (CFTC; FINRA short interest wherever FINRA is on): say by how much.' },
        { tag: 'computed', when: 'Convexa computed it from named public inputs.' },
        { tag: 'stale', when: 'This cycle failed; the earlier copy shows dimmed with when it was fetched.' },
        { tag: 'unavailable', when: 'The source is down and nothing is retained. Unknown, not empty.' },
        { tag: 'error', when: 'Our request failed: the cause and Try again.' },
        { tag: 'notConfigured', when: 'This site lacks a setting (SEC_USER_AGENT, the FINRA credential).' },
        { tag: 'off', when: 'Switched off on purpose (FINRA on production, until its terms are confirmed).' },
        { tag: 'paused', when: 'A feed exists and an operator paused it. Not used while no Massive key is set.' },
        { tag: 'notLive', when: 'Needs the paid options feed: what it would show, why it is off, a link to the demo.' },
        { tag: 'sample', when: 'Sample data inside a live page: dashed frame, hatch, Sample tag, scenario date.' },
        { tag: 'demo', when: 'The whole site is the demo (staging).' },
        { tag: 'locked', when: 'Production only: what is behind the wall and the one way in.' },
        { tag: 'thirdParty', when: 'A third party draws it from its own data; Convexa reads nothing from it.' },
      ],
      phone: 'Every screen re-lays out at 390; nothing scales down. Text ≥ 11px, chart text included (P-13); targets ≥ 44px; tables become cards under 1000px.',
      acceptance: [
        'Production: no element carries Sample or Demo except the labelled landing illustrations and the hero (“Illustrative sample”).',
        'Production: no request to an endpoint that needs Massive; zero console errors on every route.',
        'Staging: zero requests to /api or any third party on every route; the words “Sign in”, “Log in” and “Sign up” appear nowhere.',
        'Every chart frame’s border matches its provenance: solid, dotted (third party) or dashed with hatch (sample) (P-8).',
        'No chart carries sign by hue alone; every green/red mark also has position or a signed label (P-11).',
        'Every chart title states a finding only in its ready state; other states name the metric (P-10).',
      ],
      built: [
        { status: 'shipped', what: 'The environments (production live build; staging demo build, signed in to the seed account).' },
        { status: 'shipped', what: 'The state words (P-2) and the Not live copy (P-1) in the dashboard’s dataState module.' },
        { status: 'shipped', what: 'The production desk calls no endpoint that needs Massive (the public desk, 2026-10-14).' },
        { status: 'shipped', what: 'The chart foundation (2026-10-14): extras.chartContext2 and chartBand in tokens.ts; shared/charts/frame (ChartFrame: provenance border, P-10 title by state, state tag, source chip and as-of, the table twin, loading and message bodies at the final height; chartRoles for emph, ctx, ctx2, band, edge).' },
        { status: 'shipped', what: 'Charts on the frame (2026-10-15): every Research chart (Markets, positioning by group, liquidity, Scorecard, short interest and short-sale volume) and every chart inside a note; the ticker desk’s charts follow the same rules inside their cards, with the demo’s cards dashed. The last three on their own frames moved in Wave 1: the positions P/L sparkline onto the chart roles (zero line, sign by position and text), the operator latency trend into small multiples in the frame, and the landing hero into the sample frame.' },
      ],
      rulings: ['P-1', 'P-2', 'P-3', 'P-4', 'P-6', 'P-8', 'P-9', 'P-10', 'P-11', 'P-12', 'P-13', 'Env 2026-10-14'],
      code: ['apps/dashboard/src/app/shared/dataState/', 'libs/api/src/lib/demo/', 'docs/demo-staging/DESIGN-2026-10-12.md', '.spire/clusters/tech/context/DESIGN_SYSTEM.md (Amendments)'],
    },
    boards: [
      { id: 'state-matrix', title: 'State vocabulary × families', w: 3220, h: 4100, body: (o) => stateMatrixBody(o) },
      { id: 'chart-system', title: 'Chart system (P-8–P-13, ruled)', w: 1440, h: 6000, body: (o) => chartSystemBody(o) },
      { id: 'chart-states', title: 'Every chart, in every state', w: 1440, h: 5200, body: (o) => chartStatesBody(o) },
      { id: 'third-party', title: 'Ours, and theirs (P-8, P-14 load on view)', w: 1440, h: 2400, body: (o) => thirdPartyBody(o) },
    ],
  },
];
