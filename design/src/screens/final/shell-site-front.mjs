// Final · Convexa v1 — shell-site group: the global shell and the landing page, per environment.
import { icon, v4Footer, v4Nav, v4Notice } from '../../lib.mjs';
import { statesBoard } from '../v4/kit.mjs';
import { signInDlg } from '../v4/docs-dialogs.mjs';
import { aiIll, drawerF, fieldIll, heroPanel, paletteF, scoreIll, sitePage } from './shell-site-kit.mjs';

// ================================================================================================
// Global shell
// ================================================================================================
const researchSkeleton = `<div class="wrap" style="padding-top: 32px; display: flex; flex-direction: column; gap: 16px;"><h1 class="display" style="margin: 0; font-size: 44px;">Research</h1><p class="steel" style="margin: 0; max-width: 60ch; font-size: 16px;">Notes on 14 tickers, each with its sources, its freshness and what would change it.</p><div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">${[0, 1, 2, 3, 4, 5].map(() => '<span class="skel" style="height: 200px;"></span>').join('')}</div></div>`;

/** 1440: the shell around a page, with ⌘K open over it. */
export function shellBoard(env) {
  return ({ minHeight = 0, scheme = 'dark' } = {}) => {
    const page = sitePage({ env, scheme, minHeight, active: 'research', tabs: 'Notes', label: 'Research', main: researchSkeleton });
    return `<div data-scheme="${scheme}" style="position: relative;">${page}<div style="position: absolute; inset: 0; background: var(--scrim); display: flex; justify-content: center; align-items: flex-start; padding: 132px 24px 24px;">${paletteF({ env, state: 'results' })}</div></div>`;
  };
}

/** 390: the bar, the nav and the drawer open. */
export function shellPhone(env) {
  return ({ minHeight = 844, scheme = 'dark' } = {}) => {
    const page = sitePage({ env, scheme, minHeight, active: 'research', label: 'Research', main: `<div class="wrap" style="padding-top: 20px; display: flex; flex-direction: column; gap: 12px;"><span class="skel" style="display: block; height: 36px; width: 60%;"></span><span class="skel" style="display: block; height: 180px;"></span><span class="skel" style="display: block; height: 180px;"></span></div>`, footer: false });
    return `<div class="v4" data-scheme="${scheme}" style="position: relative; min-height: ${Math.max(minHeight, 844)}px; overflow: hidden; background: var(--ink);">${page}<div style="position: absolute; inset: 0; z-index: 30; background: var(--scrim);"></div>${drawerF({ env })}</div>`;
  };
}

const demoBar = (extra) => v4Notice('demo').replace('<span style="flex: 1;"></span>', `${extra}<span style="flex: 1;"></span>`);
const unknownBar = `<div role="status" class="v4-notice"><div class="wrap" style="display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center;">${icon('warn', 14, 'style="color: var(--warn);"')}<strong>Couldn’t check what’s live right now.</strong><span class="steel">Each panel still says where its numbers came from.</span><span style="flex: 1;"></span><a href="/methodology#data" class="t-info">What’s live</a></div></div>`;
const navLogIn = v4Nav({ active: 'ticker' }).replace('class="v4n-signin">Sign in</a>', 'class="v4n-signin">Log in</a>');

export function shellStates({ minHeight = 0, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Bar · production', tag: ['notLive'], when: 'Live build while /api/health reports market_data not_live (no options feed). Links: “What’s live” (the methodology section) and the demo.', html: v4Notice('hybrid') },
    { name: 'Bar · staging', tag: ['demo'], when: 'Every staging page. No sign-out exists; “Reset demo data” restores the seed account.', html: v4Notice('demo') },
    { name: 'Bar · couldn’t check', tag: ['unavailable', 'Couldn’t check'], when: 'Production: /api/health failed, so nothing claims what is or isn’t live. Each panel keeps its own tag.', html: unknownBar },
    { name: 'Bar · paused', tag: ['paused'], when: 'Only once a feed exists and an operator pauses it. Not shown while no Massive key is set.', html: v4Notice('paused') },
    { name: 'Demo bar · playback paused', tag: ['demo'], when: 'Staging: the simulated tape stopped (a storage fault or a hidden tab). Shipped copy.', html: demoBar('<span class="steel">Simulated playback paused. Showing the last sample.</span><button class="btn ghost sm" type="button">Retry demo</button>') },
    { name: 'Demo bar · playback ended', tag: ['demo'], when: 'Staging: the authored session ran to its close. Shipped copy.', html: demoBar('<span class="steel">Sample playback complete. Showing the last sample.</span>') },
    { name: 'Reset demo data · confirm', tag: ['demo'], when: 'Staging: asks in place before clearing this browser’s demo changes, then reloads on the seed account.', html: `<div class="hd-p" style="gap: 10px;"><strong style="font-size: 14px;">Reset the demo?</strong><span class="dline">Clears your demo positions, alerts and settings in this browser and puts the seed account back.</span><div style="display: flex; gap: 8px; flex-wrap: wrap;"><button class="btn primary" type="button">Reset demo data</button><button class="btn ghost" type="button">Keep my changes</button></div></div>` },
    { name: 'Nav · production, signed out', tag: ['locked', 'Log in'], wide: true, when: 'Every visitor. Sign-ups are closed, so there is no “Sign up” button; “Log in” opens the sign-in dialog.', html: navLogIn },
    { name: 'Nav · production, a private tester', tag: null, wide: true, when: 'Signed in: email (hidden under 600px) and a neutral avatar linking to Settings; sign-out lives in Settings.', html: v4Nav({ active: 'positions', signedIn: true }).replace('aria-label="Account settings"', 'aria-label="Account settings" title="r…@…"') },
    { name: 'Nav · staging', tag: ['demo'], wide: true, when: 'Always the seed account: “Demo account” and its avatar. Never “Log in” or “Sign up”.', html: v4Nav({ active: 'scanner', demo: true }) },
    { name: 'Nav · account loading', tag: null, wide: true, when: 'Production, while who-am-I answers: an 88 × 32 placeholder; the page renders around it.', html: v4Nav({ active: 'ticker' }).replace(/<a href="\/settings#account" class="v4n-signin">Sign in<\/a>/, '<span class="skel" style="width: 88px; height: 32px;"></span>') },
    { name: '⌘K · production', tag: null, when: 'Tickers by name (no scan call: scores need the options feed), then research notes.', html: paletteF({ env: 'production' }) },
    { name: '⌘K · staging', tag: ['demo'], when: 'Tickers ranked by the demo’s sample scan.', html: paletteF({ env: 'staging' }) },
    { name: '⌘K · empty query', tag: null, when: 'Go-to commands with their keys, then recents.', html: paletteF({ state: 'empty' }) },
    { name: '⌘K · loading', tag: null, when: 'Rows at their final height while the ticker list loads; never re-entered.', html: paletteF({ state: 'loading' }) },
    { name: '⌘K · no match', tag: ['empty', 'No match'], when: 'Offers the literal ticker; never a dead end.', html: paletteF({ state: 'nomatch' }) },
    { name: '⌘K · ticker list failed', tag: ['error', 'Couldn’t search'], when: 'Says what still works; the next open tries again.', html: paletteF({ state: 'failed' }) },
    { name: 'Skip link, focused', tag: null, when: 'The first tab stop on every page; jumps to main. The focus ring is text-grade amber.', html: `<a href="#main" class="btn primary" style="align-self: flex-start; outline: 2px solid var(--amber-text); outline-offset: 2px;">Skip to main content</a>` },
    { name: 'Keyboard shortcuts', tag: null, when: 'Opened with ?. ⌘K and / are ignored while typing in a field.', html: `<div class="v4dlg" style="width: 100%;"><div class="dh"><h2>Keyboard shortcuts</h2></div><div class="db" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; font-size: 13px;">${[['⌘K or /', 'Jump to a ticker or note'], ['g then s · t · r · p · a', 'Scanner · Ticker · Research · Positions · Alerts'], ['j · k', 'Next · previous row'], ['?', 'This sheet'], ['esc', 'Close a dialog or sheet']].map(([k, v]) => `<span class="mono">${k}</span><span class="steel">${v}</span>`).join('')}</div></div>` },
    { name: 'Footer', tag: null, wide: true, when: 'On every page in the shell, including the ticker desk: five links (Settings among them), the disclaimer and the copyright.', html: v4Footer().replace('Not investment advice.</p></div></footer>', 'Not investment advice.</p><p style="margin: 0; flex: 1 1 100%; font-size: 12px; color: var(--steel);">© 2026 Convexa. All rights reserved.</p></div></footer>') },
  ];
  return statesBoard({ scheme, minHeight, title: 'Global shell · every state', lead: 'The bar in each environment and its failure, the demo bar’s playback states and reset, the account control in each session, the jump-to box in each state, the skip link, the shortcuts sheet and the footer.', trace: 'SHL-01–SHL-05, X-01, Env 2026-10-14', items });
}

// ================================================================================================
// Landing
// ================================================================================================
const C = {
  chip: 'Dealer-gamma analytics · free ticker, no account',
  h1: 'See the dealer positioning behind the price.',
  sub: 'Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup. Practice the plan on a simulated book before you ever risk a dollar.',
  footnote: 'Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool; every trade is simulated.',
};
const FEATS = [
  { k: 'field', eyebrow: 'Where is price pulled?', h2: 'Walls, the flip, the magnet — drawn as a field, not a table.', body: 'Dealer hedging creates structure you can see: a call wall that caps, a put wall that catches, and a gamma flip where hedging turns from dampening to amplifying. The structure field plots net dealer gamma by strike and drops the live mid onto it, so you read where price is attracted or repelled at a glance.', bullets: ['Levels refresh about every minute on the desk and carry their as-of', 'On a ticker desk the mid is tape — it pulses only while the stream is genuinely live.', 'Magnet view shows the same levels as a pull, for the visual thinkers'], vis: fieldIll },
  { k: 'score', eyebrow: 'Is there an edge right now?', h2: 'A triage score that is honest about what it is.', body: 'Proximity to a wall or the flip, IV against realised vol, active setups, a flip transition and optional dark-pool confluence roll into a 0–100 score and a tier. It ranks names for a deeper look. It is not a trade signal, and it never uses the advisory reads.', bullets: ['Dormant → Watch → Actionable → Prime', 'Every component of the score is inspectable in the Scanner', 'Context reads (flow, vol, ATR) stay advisory — never score inputs'], vis: scoreIll, flip: true },
  { k: 'ai-read', eyebrow: 'What would I risk?', h2: 'A risk-first read, on your own key, grounded in the structure.', body: 'Ask for a read and get the verdict first — trade or no trade — then max risk, invalidation, entry and target before a single paragraph of rationale. Figures that trace to Convexa render in mono; the model’s own numbers render in body type so you always know whose number you are looking at.', bullets: ['Pinned to a snapshot; a newer one is flagged, never silently swapped', 'Your persona frames the read; your risk inputs cap the size', 'Accept it into a simulated trade — nothing is saved until you confirm'], vis: aiIll },
];
const TRUST = [
  ['Snapshot, never live', 'Structure — score, tier, walls, the flip — recomputes on a stated cadence: about a minute on a ticker desk, about three minutes across the scanner. Prices and the mid stream live and are labelled as tape. The two speeds never blur.'],
  ['Simulated, always', 'The sim book is paper: no slippage, no partial fills, nothing sent to a broker. A connected brokerage is read-only. Convexa never places an order.'],
  ['Advisory, never an order', 'The AI read runs on your own key, pins to a snapshot, and cites what it used. Figures it could not trace render in body type. You confirm every paper trade.'],
];

export function ctaBand(env) {
  return env === 'staging'
    ? `<section class="ss-cta" aria-labelledby="cta-h"><div><h2 id="cta-h" class="display">You’re signed in to the demo account.</h2><p>Every screen is open, on sample data: the Scanner, a simulated book, alerts, and AI reads written for the scenario.</p></div><div class="acts"><a href="/ticker" class="btn primary lg" aria-label="Open the Ticker">Open the Ticker →</a><a href="/positions" class="btn secondary lg">Open the demo book</a><span class="note">Your changes stay in this browser. Reset them any time from the demo bar.</span></div></section>`
    : `<section class="ss-cta" aria-labelledby="cta-h"><div><h2 id="cta-h" class="display">Open any ticker. No account, no card.</h2><p>Every ticker page is open: TradingView’s daily chart, short data, filings and the research notes. The Scanner, a simulated book and AI reads need an account.</p></div><div class="acts"><a href="/ticker" class="btn primary lg" aria-label="Open the Ticker">Open the Ticker →</a><button type="button" class="btn secondary lg" style="color: var(--amber-text);">Sign in</button><span class="note">New sign-ups are closed while Convexa is in private testing.</span></div></section>`;
}

export function landingBoard(env) {
  return ({ minHeight = 0, scheme = 'dark' } = {}) => {
    const hero = `<section class="ss-hero" aria-labelledby="ld-h1"><div style="display: flex; flex-direction: column; gap: 18px; min-width: 0;"><span class="ss-chip">${C.chip}</span><h1 id="ld-h1" class="display">${C.h1}</h1><p class="sub">${C.sub}</p><span class="ss-spine">Scan → Ticker → Plan → Track</span><div class="ss-ctas"><a href="/ticker" class="btn primary lg" aria-label="Open the Ticker">Open the Ticker →</a><a href="/methodology" class="btn secondary lg">How it’s built</a></div><span class="dline">${C.footnote}</span></div>${heroPanel({ env })}</section>`;
    const feats = FEATS.map((f) => `<section class="ss-feat${f.flip ? ' flip' : ''}" id="landing-sample-${f.k}" aria-labelledby="ld-${f.k}"><div><span class="ss-eyebrow">${f.eyebrow}</span><h2 id="ld-${f.k}" class="display">${f.h2}</h2><p>${f.body}</p><ul>${f.bullets.map((b) => `<li>${icon('check', 15)}<span>${b}</span></li>`).join('')}</ul></div><div class="vis">${f.vis(env)}</div></section>`).join('');
    const trust = `<section class="ss-trust" aria-labelledby="ld-trust"><div><span class="ss-eyebrow">Honest by design</span><h2 id="ld-trust" class="display" style="margin: 8px 0 0; font-size: clamp(26px, 2.6vw, 34px); line-height: 1.12;">Numbers say where they came from.</h2><p class="steel" style="margin: 14px 0 0; font-size: 15.5px; line-height: 1.6;">Every surface carries its basis. If you can’t tell whether a figure is live, a snapshot, or the model’s own guess, we have failed — so the type itself tells you.</p><a href="/methodology" class="ss-demo" style="margin-top: 14px; color: var(--amber-text) !important;">Read the methodology →</a></div><div class="cards">${TRUST.map(([t, b]) => `<div class="card"><h3>${t}</h3><p>${b}</p></div>`).join('')}</div></section>`;
    return sitePage({ env, scheme, minHeight, label: 'Convexa', main: `<div class="wrap">${hero}${feats}${trust}${ctaBand(env)}</div>` });
  };
}

export function landingStates({ minHeight = 0, scheme = 'dark' } = {}) {
  const items = [
    { name: 'Hero · WebGL, turned by hand', tag: ['sample', 'Illustrative sample'], when: 'WebGL2 available: drag sideways to turn, arrows move the probe, the readout is announced. Renders on demand: no frames while idle or hidden, no autoplay.', html: heroPanel({ env: 'production', mode: 'webgl' }) },
    { name: 'Hero · the static projection', tag: ['sample', 'Illustrative sample'], when: 'No WebGL, a blocked script, a lost context, or before the script runs. Reduced motion changes nothing: nothing moves unless the reader moves it.', html: heroPanel({ env: 'production', mode: 'poster' }) },
    { name: 'Hero · staging', tag: ['demo'], when: 'The demo’s scenario chip in place of the Illustrative sample tag.', html: heroPanel({ env: 'staging', mode: 'webgl' }) },
    { name: 'Illustration · production', tag: ['sample', 'Illustrative sample'], when: 'Each of the three feature visuals: dashed frame, hatch, tag and the shipped caption. No live dot, no clock time.', html: fieldIll('production') },
    { name: 'CTA band · production', tag: ['locked', 'Sign in'], wide: true, when: 'Signed out. “Sign in” opens the dialog; the closed sign-ups line sits under it, before any form.', html: ctaBand('production') },
    { name: 'CTA band · staging', tag: ['demo'], wide: true, when: 'Always signed in to the demo account: the second action opens the demo book (/positions).', html: ctaBand('staging') },
    { name: 'Sign in · from the CTA band', tag: ['locked'], when: 'Production only. New sign-ups are closed, so the dialog offers no “Create account”.', html: signInDlg() },
    { name: 'Phone · hero actions', tag: null, when: 'Under 700px the two hero actions stack full width at 44px; the panel moves under the copy.', html: `<div class="ss-ctas" style="flex-direction: column; align-items: stretch;"><a href="/ticker" class="btn primary lg" style="width: 100%;">Open the Ticker →</a><a href="/methodology" class="btn secondary lg" style="width: 100%;">How it’s built</a></div>` },
  ];
  return statesBoard({ scheme, minHeight, title: 'Landing · states', lead: 'The landing makes no data requests, so its states are the hero’s rendering ladder, the labels in each environment and the CTA band per session.', trace: 'LND-01–LND-04, P-15, Env 2026-10-14', items });
}
