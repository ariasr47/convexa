// Final · Convexa v1 — trust group (wave 2, 2026-10-14): Data sources and credits, Privacy, Terms and
// disclaimer. New screens with proposed routes, placed after the 404 row. Boards compose
// ./trust-pages.mjs on the shell-site group's page wrapper (see ./index.mjs for the row shape).
import { SS_CSS } from './shell-site-kit.mjs';
import { TR_CSS, creditsBoard, creditsStates, privacyBoard, termsBoard } from './trust-pages.mjs';

const APP = 'apps/dashboard/src/app/';
const API = 'apps/api/src/';
const light = { scheme: 'light' };
const CSS = SS_CSS + TR_CSS;
const DRAFT = 'Copy is a draft for the owner to review; not legal advice.';
const FOOTER_BUILT = { status: 'shipped', what: 'Footer links “Sources and credits”, “Privacy”, “Terms” after Lab (shell/Footer.tsx, 2026-10-14; lib.mjs v4Footer on the design side).' };
const SHELL_PHONE = 'The on-this-page index becomes a sideways rail of 44px chips under the nav; the reading column is full width with a 16px gutter. Tables scroll inside their own box.';

export const ROWS = [
  // ---------------------------------------------------------------------------------------------
  {
    key: 'credits',
    after: 'not-found',
    label: 'Data sources and credits',
    css: CSS,
    specH: 3291,
    spec: {
      title: 'Data sources and credits',
      route: '/credits (proposed; deep links /credits#treasury, #cftc, #finra-si, #finra-shvol, #sec, #tradingview, #massive)',
      job: 'Every source the site reads in one place: who owns it, what Convexa reads, how often and how late it publishes, the terms it is shown under, a link to it, and whether it is working on this site right now.',
      env: {
        production: 'Seven source cards with their live state today: Treasury Updated, CFTC and FINRA short interest Delayed by source, FINRA short-sale volume Updated, SEC EDGAR Not set up, TradingView Live · TradingView, the Massive options feed Not live (with the way to the demo). An “On this page” legend counts each state (P-1). FINRA’s required notice sits on both FINRA cards. Then the typefaces and what Convexa makes itself.',
        staging: 'The same cards, dashed, each saying the demo’s figures are sample data shaped like that source (scenario of Oct 7, 2026); TradingView says “Off on the demo”. FINRA’s notice is quoted as the live site shows it. Links to the live site’s credits. No request leaves the browser.',
      },
      widgets: [
        { name: 'On this page (legend)', source: 'counts of the cards’ states', production: [['current', 'Updated · 2'], ['delayed', 'Delayed by source · 2'], ['notConfigured', 'Not set up · 1'], ['thirdParty', 'Live · TradingView · 1'], ['notLive', 'Not live · 1']], staging: [['demo', 'Demo · sample data · 6'], ['off', 'Off · 1']] },
        { name: 'U.S. Treasury · daily par and real yield curves', source: 'home.treasury.gov CSVs via /api/public-data/markets · after the close, checked every 6 h', production: ['current', 'Updated · Oct 13'], staging: 'demo' },
        { name: 'CFTC · Traders in Financial Futures', source: 'publicreporting.cftc.gov (Socrata) · positions Tuesday, published Friday · checked every 12 h', production: ['delayed', 'Delayed by source · as of Oct 6'], staging: 'demo' },
        { name: 'FINRA · consolidated short interest', source: 'api.finra.org · twice a month, about a week after settlement · checked every 12 h', production: ['delayed', 'Delayed by source · settled Sep 30'], staging: 'demo' },
        { name: 'FINRA · Reg SHO daily short-sale volume', source: 'cdn.finra.org daily files · one business day late · each file read once', production: ['current', 'Updated · Oct 13 file'], staging: 'demo' },
        { name: 'SEC EDGAR · filings, Form 4, company facts', source: 'data.sec.gov · as filed; filings hourly, facts daily · needs SEC_USER_AGENT', production: 'notConfigured', staging: 'demo' },
        { name: 'TradingView · advanced chart widget', source: 'its own prices, delayed (Cboe One) · attribution “Chart by TradingView” · gets the visitor’s IP and page address', production: 'thirdParty', staging: ['off', 'Off on the demo'] },
        { name: 'Massive options feed', source: 'api.massive.com · not subscribed on this site', production: 'notLive', staging: 'demo' },
        { name: 'Typefaces', source: 'self-hosted /fonts (IBM Plex Sans, IBM Plex Mono, Archivo · SIL OFL 1.1); no Google Fonts or other font service', production: 'Static', staging: 'Static' },
        { name: 'State of each source', source: 'proposed GET /api/public-data/sources: one row per source with state, as_of, checked_at (not built; today the states are split across /markets and /tickers/{T})', production: 'Live per card', staging: 'none (no request)' },
      ],
      states: [
        { tag: 'current', when: 'The source answered on its schedule; the tag carries the source’s date.' },
        { tag: 'delayed', when: 'CFTC and FINRA short interest, always: they publish late by design; the tag says as of when.' },
        { tag: 'stale', when: 'This cycle failed and the API serves its earlier copy (needs the API to say so).' },
        { tag: 'unavailable', when: 'The source failed with nothing kept: unknown, not empty; says when Convexa asks again.' },
        { tag: 'notConfigured', when: 'SEC EDGAR while SEC_USER_AGENT is unset (production today); the operator hint folds away.' },
        { tag: 'off', when: 'PUBLIC_DATA=off: every public card says Off. On staging, TradingView says “Off on the demo”.' },
        { tag: 'notLive', when: 'The Massive options feed on production, with “See them on the demo →”.' },
        { tag: 'thirdParty', when: 'TradingView on production, always: Convexa can’t see whether it is up.' },
        { tag: 'loading', when: 'The state request is on its way: tag skeletons at final width; card text renders at once.' },
        { tag: 'error', when: 'The state request failed: tags say Couldn’t load, the legend offers one Try again; text stays.' },
        { tag: 'demo', when: 'Staging: every card dashed, “shaped like …”.' },
      ],
      phone: `${SHELL_PHONE} Each card’s label column moves above its text; the state tag wraps under the source’s name; links stack.`,
      acceptance: [
        'Production: seven source cards in the order Treasury, CFTC, FINRA short interest, FINRA short-sale volume, SEC EDGAR, TradingView, Massive; each names its owner, what Convexa reads, cadence and delay, terms, where it shows, and links to the source.',
        'Both FINRA cards carry “Data owned and provided by FINRA” and the notice “FINRA owns and is the source of … please don’t redistribute it”, word for word as NotePublicPanels ships it.',
        'The TradingView card says Convexa reads nothing from the chart, that the visitor’s IP address and page address go to TradingView, and keeps the attribution “Chart by TradingView”.',
        'The legend’s counts equal the cards’ states; no card says Updated without a source date; TradingView never says Updated.',
        'With SEC_USER_AGENT unset, the SEC card says Not set up and the operator hint is collapsed; with PUBLIC_DATA=off, every public card says Off.',
        'If the state request fails, every card’s text still renders and one Try again appears; the page never blanks.',
        'Staging: zero requests to /api or any third party; every card is dashed; no state other than Demo · sample data and Off appears.',
        'The page names no font service (the app self-hosts its three OFL typefaces) and loads no script but its own.',
        `${DRAFT}`,
      ],
      built: [
        { status: 'shipped', what: 'The /credits route and page (pages/trust/CreditsPage.tsx, 2026-10-14): seven cards with live state tags from /api/public-data/markets and /tickers/SPY, the legend counted from the same states, one Try again when a read fails; the demo makes no request.' },
        { status: 'todo', what: 'The sources endpoint (one row per source with state, as_of, checked_at), and the card deep links from each provenance chip on the site.' },
        { status: 'shipped', what: 'The credits it gathers exist on their cards today: FINRA’s notice and owner line (NotePublicPanels), TradingView’s chip, attribution and privacy line (TechnicalAnalysisLive), Treasury/CFTC/SEC source chips.' },
        { status: 'partial', what: 'The API’s public-data state is live / off / not_configured / unavailable only: it says “live” for a cached copy served after a failed fetch, so Last good copy can’t be shown yet, and Delayed by source is worked out in the browser from each source’s schedule.' },
        FOOTER_BUILT,
      ],
      rulings: ['P-1', 'P-2', 'P-4', 'P-8', 'P-13', 'P-14', 'Env 2026-10-14', 'FINRA terms §2.3', 'TradingView policies §3–4'],
      code: [`${APP}app.tsx (new route /credits)`, `${APP}pages/research/NotePublicPanels.tsx`, `${APP}pages/research/publicUi.tsx`, `${APP}pages/ticker/technical-analysis/TechnicalAnalysisLive.tsx`, `${API}routes/public_data.rs`, `${API}services/public_data/{treasury,cftc,finra,edgar}.rs`, 'docs/public-data/README.md', 'docs/public-data/CANDIDATES.md', 'apps/dashboard/public/fonts/*/OFL.txt'],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 4815, body: creditsBoard('staging') },
      { id: 'production', title: 'Production', w: 1440, h: 4611, body: creditsBoard('production') },
      { id: 'phone', title: 'Phone · production', w: 390, h: 6278, body: creditsBoard('production') },
      { id: 'light', title: 'Light · production', w: 1440, h: 4611, body: creditsBoard('production'), opts: light },
      { id: 'states', title: 'States', w: 1440, h: 2016, body: creditsStates },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'privacy',
    after: 'not-found',
    label: 'Privacy',
    css: CSS,
    specH: 2099,
    spec: {
      title: 'Privacy',
      route: '/privacy (proposed)',
      job: 'What the site stores and where, what leaves the visitor’s browser and to whom, what Convexa doesn’t do, and how to clear it — read from the code, not from a template.',
      env: {
        production: 'The live site’s storage keys, the account’s server-side record (only for invited accounts), the third parties (hosts, TradingView, the AI provider only with the user’s own key), what Convexa never does, and how to clear it signed out and signed in. Google sign-in isn’t configured on this site and Convexa doesn’t contact Webull yet (saved keys stay encrypted), so neither is listed as a recipient.',
        staging: 'Opens “This is the demo. Nothing you do here leaves this browser.” Lists the same keys under the convexa.demo.v1. prefix plus the demo’s four own keys, the in-browser demo account, “Nothing” under what leaves, and Reset demo data as the way to clear it.',
      },
      widgets: [
        { name: 'The short version', source: 'static; CSP connect-src ’self’ and no analytics code (apps/dashboard/public/_headers)', production: 'Static', staging: 'demo' },
        { name: 'In this browser (key table)', source: 'localStorage keys read from the stores: uiprefs, theme-paint, positions.v3, positions.touch_at, orders, alerts, personas, recent-tickers; demo prefix convexa.demo.v1.', production: ['local', 'Stored here'], staging: 'demo' },
        { name: 'If you have an account', source: 'apps/api auth store: UserRecord, SessionRecord, SettingsRecord, CredentialRecord (AES-256-GCM), /api/book blob', production: 'Static', staging: 'demo' },
        { name: 'What leaves your browser', source: 'static; Cloudflare Pages + Railway hosts, TradingView, AI providers (llm_catalog.rs: Anthropic, OpenAI, xAI, Gemini)', production: 'Static', staging: 'demo' },
        { name: 'How to clear it', source: 'static; resetDemoWorkspace() removes convexa.demo.v1.* keys', production: 'Static', staging: 'demo' },
      ],
      states: [
        { tag: 'Static', when: 'No data request: the route’s shared loading and Couldn’t load states (404 row) are its only others.' },
        { tag: 'demo', when: 'Staging: the demo form of every section.' },
      ],
      phone: `${SHELL_PHONE} The storage-key table becomes one stacked row per key (the key, what it holds, when it is written); the “doesn’t do” list goes to one column.`,
      acceptance: [
        'Every key in the browser table exists in a shipped store, and every key a shipped store writes is in the table (convexa.archive is an export file’s schema, not a key).',
        'The account section lists exactly what the auth store keeps: email, display name, argon2 password hash, timestamps, sessions (7 days idle, 30 days at most), settings, risk inputs, the book copy (positions, orders, decision notes), encrypted AI and Webull keys. Cookie attributes are not claimed: production sets them by environment.',
        'TradingView is named with what it receives (IP address, page address); the AI provider is named as reached only signed in, with the user’s key, on request, and links the “What’s sent” drawer.',
        'The page claims no analytics only while the CSP’s connect-src stays ’self’ and the bundle loads no analytics script.',
        'Staging: the page says nothing leaves the browser, and Reset demo data is the way to clear it; no “Sign in”.',
        'Owner adds a contact address before it ships (none is drawn).',
        `${DRAFT}`,
      ],
      built: [
        { status: 'shipped', what: 'The /privacy route and page (pages/trust/PrivacyPage.tsx, 2026-10-14), every claim checked against the code: the eight live keys and the demo’s four, the auth store, CSP, the four AI providers, Webull keys stored but never sent.' },
        { status: 'todo', what: 'A contact address (PRIVACY_CONTACT in PrivacyPage.tsx); until the owner supplies one, the page says to ask the site’s owner.' },
        { status: 'shipped', what: 'The behaviour it describes: local-only signed-out data, encrypted AI and Webull keys, HttpOnly session cookie, TradingView’s privacy line, the “What’s sent” drawer, Reset demo data.' },
        { status: 'todo', what: 'No self-serve account deletion exists (no endpoint in routes/auth.rs); the page says to ask the owner. Parked by owner (2026-10-14): the privacy page says to ask the owner.' },
        FOOTER_BUILT,
      ],
      rulings: ['P-2', 'P-4', 'P-13', 'P-14', 'Env 2026-10-14'],
      code: [`${APP}app.tsx (new route /privacy)`, `${APP}features/auth/localPrefs.ts`, `${APP}features/auth/firstPaintTheme.ts`, `${APP}features/trading/positions/{store,bookSync}.ts`, `${APP}features/trading/orders/store.ts`, `${APP}features/alerts/types.ts`, `${APP}features/personas/store.ts`, `${APP}pages/ticker/recentTickers/store.ts`, 'libs/api/src/lib/demo/workspace.ts', `${API}services/auth/{store,crypto,passwords,service}.rs`, `${API}routes/{auth,book,broker}.rs`, `${API}services/llm.rs`, 'apps/dashboard/public/_headers'],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 2204, body: privacyBoard('staging') },
      { id: 'production', title: 'Production', w: 1440, h: 3465, body: privacyBoard('production') },
      { id: 'phone', title: 'Phone · production', w: 390, h: 4877, body: privacyBoard('production') },
      { id: 'light', title: 'Light · production', w: 1440, h: 3465, body: privacyBoard('production'), opts: light },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    key: 'terms',
    after: 'not-found',
    label: 'Terms and disclaimer',
    css: CSS,
    specH: 1448,
    spec: {
      title: 'Terms and disclaimer',
      route: '/terms (proposed)',
      job: 'The long form of the footer’s disclaimer: an analysis tool, not investment advice, no buy or sell calls, simulated trades only, a read-only brokerage connection, data that can be late or wrong, and the third-party terms the data comes with.',
      env: {
        production: 'The terms, dated, in nine short sections, ending with the footer’s disclaimer sentence verbatim.',
        staging: 'The same terms under a dashed “On this demo” box: every figure is sample data from the Oct 7, 2026 scenario and describes no real market, company or account.',
      },
      widgets: [
        { name: 'Terms text', source: 'static copy', production: 'Static', staging: 'Static' },
        { name: 'On this demo', source: 'build mode', production: '—', staging: 'demo' },
        { name: 'Disclaimer line', source: 'DISCLAIMER_TEXT (shared/copy/disclaimer.tsx), imported', production: 'Static', staging: 'Static' },
      ],
      states: [
        { tag: 'Static', when: 'No data request: the route’s shared loading and Couldn’t load states (404 row) are its only others.' },
        { tag: 'demo', when: 'Staging: the “On this demo” box above the terms.' },
      ],
      phone: SHELL_PHONE,
      acceptance: [
        'The page contains the shipped sentence “a connected brokerage is read-only — Convexa never places, changes, or cancels an order”, imported from DISCLAIMER_TEXT, not retyped.',
        'No sentence on the page advises buying, selling or holding anything.',
        'The FINRA bullet matches the shipped notice; the page links to /credits and /privacy.',
        'Staging shows the “On this demo” box; production doesn’t.',
        `${DRAFT}`,
      ],
      built: [
        { status: 'shipped', what: 'The /terms route and page (pages/trust/TermsPage.tsx, 2026-10-14), closing with DISCLAIMER_TEXT imported.' },
        { status: 'shipped', what: 'The disclaimer sentence (DisclaimerCopy in the footer and Settings) and the Methodology page’s “What Convexa never does”.' },
        FOOTER_BUILT,
      ],
      rulings: ['P-2', 'P-4', 'P-13', 'Env 2026-10-14', 'No buy/sell language'],
      code: [`${APP}app.tsx (new route /terms)`, `${APP}shared/copy/disclaimer.tsx`, `${APP}shell/Footer.tsx`, `${APP}pages/methodology/copy.ts`],
    },
    boards: [
      { id: 'staging', title: 'Staging · demo account', w: 1440, h: 2602, body: termsBoard('staging') },
      { id: 'production', title: 'Production', w: 1440, h: 2444, body: termsBoard('production') },
      { id: 'phone', title: 'Phone · production', w: 390, h: 3446, body: termsBoard('production') },
      { id: 'light', title: 'Light · production', w: 1440, h: 2444, body: termsBoard('production'), opts: light },
    ],
  },
];
